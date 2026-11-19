import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, realpath, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { reviewedRepositoryComponentsFor } from '../../shared/operational-packet-registry.ts'
import { PORTFOLIO_CATALOG } from '../../workers/quests/src/portfolio-catalog.ts'

const exec = promisify(execFile)
const cap = 2_000_000
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const lower = (value) => value?.toLowerCase()
export const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`
export const repoName = (value) => /^(?:https:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)?([a-z0-9][a-z0-9-]*\/(?!\.{1,2}(?:\.git)?\/?$)[\w.-]+?)(?:\.git)?\/?$/i.exec(value || '')?.[1] ?? null
const contained = (root, file) => {
  const rel = relative(root, file)
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

async function run(tool, args) {
  try {
    return (await exec(tool, args, { timeout: 12_000, maxBuffer: cap, env: { ...process.env, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' } })).stdout.trim()
  } catch { return null }
}

async function ghJson(args, projectRead = run) {
  try { return JSON.parse(await projectRead('gh', args)) } catch { return null }
}

async function localRead(root, path, namespace) {
  try {
    const actual = await realpath(join(root, path))
    if (!contained(root, actual)) return null
    const info = await stat(actual)
    if (!info.isFile() || info.size > cap) return null
    const bytes = await readFile(actual)
    return { ref: `${namespace}:${path}`, fingerprint: digest(bytes), bytes }
  } catch { return null }
}

export async function localJson(root, path) {
  const file = root && await localRead(root, path, 'local')
  if (!file) return null
  try { return JSON.parse(file.bytes) } catch { return null }
}

function qualifiedRefs(record) {
  return (record?.provenance || []).flatMap((ref) => {
    const match = /^repo:([\w.-]+\/[\w.-]+)(?:\/|$)/.exec(ref)?.[1]
    // Workbench provenance also contains slug-relative filenames such as
    // repo:fitcheck-landing/README.md. They are not standalone repo identities.
    return match && repoName(match) && !/\.(?:md|json|ya?ml|pdf|txt)$/i.test(match) ? [match] : []
  })
}

export function resolveWorkObject(target, records = PORTFOLIO_CATALOG.records, components = reviewedRepositoryComponentsFor) {
  const token = lower(target.trim())
  const exact = records.filter((r) => lower(r.workId) === token)
  if (exact.length === 1) return exact[0]
  const repo = lower(repoName(token))
  const candidates = records.filter((r) => repo
    ? [...qualifiedRefs(r), ...components(r.workId).map((c) => c.nameWithOwner)].some((name) => lower(name) === repo)
    : [r.accountId, r.name, r.workId.split(':')[1]].some((name) => lower(name) === token))
  if (candidates.length > 1) throw new Error(`Ambiguous target. Choose an exact WorkObject: ${candidates.map((r) => r.workId).join(', ')}`)
  return candidates[0] ?? null
}

const repoFiles = [
  'AGENTS.md', 'PROJECT.md', 'ISA.md', 'README.md', 'package.json', '.project/HANDOFF.md',
  '.planning/HANDOFF.json', '.planning/STATE.md', '.planning/ROADMAP.md', '.planning/RN-ROADMAP.md',
  '.planning/GITHUB_ROADMAP.md', '.temperance/project.json', '.specify/memory/constitution.md',
  'specs/README.md', 'docs/change-requests.md', 'docs/traceability-matrix.md',
]

async function localGit(root) {
  try { await lstat(join(root, '.git')) } catch { return null }
  const git = (...args) => run('git', ['--no-optional-locks', '-C', root, '-c', 'core.fsmonitor=false', ...args])
  const [origin, commit, branch, defaultRef, changes] = await Promise.all([
    git('remote', 'get-url', 'origin'), git('rev-parse', '--verify', 'HEAD'), git('symbolic-ref', '--quiet', '--short', 'HEAD'),
    git('symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'), git('status', '--porcelain=v1', '--untracked-files=normal'),
  ])
  const repository = repoName(origin)
  if (!repository || !commit) return null
  return { repository, branch: branch ?? '(detached)', commit, defaultBranch: defaultRef?.replace(/^origin\//, '') ?? null,
    worktree: changes === null ? 'unknown' : changes ? 'dirty' : 'clean' }
}

async function gitDocuments(root, repository) {
  const names = await readdir(join(root, 'specs'), { withFileTypes: true }).catch(() => [])
  const features = names.filter((row) => row.isDirectory() && /^[0-9]{2,4}-[\w-]+$/.test(row.name)).map((row) => row.name).sort()
  const files = [...repoFiles, ...features.slice(0, 60).flatMap((feature) => ['spec.md', 'plan.md', 'tasks.md'].map((file) => `specs/${feature}/${file}`))]
  return (await Promise.all(files.map((path) => localRead(root, path, `repo:${repository}`)))).filter(Boolean).map(({ bytes: _bytes, ...file }) => file)
}

async function liveRepo(repository, requestedBranches, projectRead) {
  const row = await ghJson(['repo', 'view', repository, '--json', 'nameWithOwner,id,defaultBranchRef,isArchived,visibility'], projectRead)
  if (!row?.id || !row.defaultBranchRef?.name) return { status: 'unavailable' }
  const defaultBranch = row.defaultBranchRef.name
  const readPin = async (branch) => {
    const detail = await ghJson(['api', 'repos/' + repository + '/branches/' + encodeURIComponent(branch), '--jq', '.commit.sha | {sha: .}'], projectRead)
    return /^[a-f0-9]{40}$/.test(detail?.sha) ? detail.sha : null
  }
  const defaultCommit = await readPin(defaultBranch)
  const selectedBranches = await Promise.all(requestedBranches.map(async (branch) => {
    const commit = branch === defaultBranch ? defaultCommit : await readPin(branch)
    if (!commit) return { branch, commit: null, rootPaths: null }
    const paths = await ghJson(['api', `repos/${repository}/git/trees/${commit}`, '--jq', '{paths:[.tree[].path],truncated}'], projectRead)
    return { branch, commit, rootPaths: Array.isArray(paths?.paths) && !paths.truncated && paths.paths.length <= 100 ? paths.paths.sort() : null }
  }))
  return { status: 'observed', repository: row.nameWithOwner, repoId: row.id, defaultBranch: row.defaultBranchRef.name,
    defaultCommit, branches: selectedBranches, archived: row.isArchived, visibility: lower(row.visibility) }
}

const boardMatch = (value) => /^([a-z\d](?:[a-z\d-]*[a-z\d])?)\/([1-9]\d{0,8})$/i.exec(value ?? '')
function boardPointer(data) {
  const pointer = data?.planning?.github_project
  const path = /^https:\/\/github\.com\/(?:users|orgs)\/([\w-]+)\/projects\/([1-9]\d{0,8})\/?$/.exec(pointer?.url ?? '')
  return path && Number(path[2]) === pointer.number && (!pointer.owner || lower(path[1]) === lower(pointer.owner)) ? `${path[1]}/${path[2]}` : null
}

export async function readBoard({ requested, packet, primary, repos, name, github }, projectRead = run) {
  if (packet?.planning?.github_project && !boardPointer(packet)) return { status: 'invalid-temperance-binding' }
  const knownBoard = boardPointer(packet)
  if (requested && !boardMatch(requested)) throw new Error('Board must be OWNER/NUMBER.')
  if (knownBoard && requested && lower(knownBoard) !== lower(requested)) return { status: 'conflicting-bindings', requested, knownBoard }
  const selected = requested ?? knownBoard
  if (!github) return { status: selected ? 'local-binding-only' : 'unbound', selected }
  if (!selected) {
    const owners = [...new Set([primary, ...repos].filter(Boolean).map((repo) => repo.split('/')[0]))].slice(0, 4)
    const titleTokens = new Set([name, ...repos.map((repo) => repo.split('/')[1])].map(lower).filter(Boolean))
    const listings = await Promise.all(owners.map((owner) => ghJson(['project', 'list', '--closed', '--owner', owner, '--limit', '100', '--format', 'json'], projectRead)))
    const candidates = listings.flatMap((listing) => (listing?.projects || []).filter((p) => [...titleTokens].some((part) => lower(p.title)?.includes(part)))
      .map(({ title, number, url, closed, public: isPublic }) => ({ title, number, url, closed, public: isPublic })))
    return { status: 'unbound', candidates, ownerListsComplete: !!owners.length && listings.every((list) => Array.isArray(list?.projects) && Number.isInteger(list.totalCount) && list.projects.length >= list.totalCount) }
  }
  const [, owner, number] = boardMatch(selected)
  const board = await ghJson(['project', 'view', number, '--owner', owner, '--format', 'json'], projectRead)
  const returned = boardPointer({ planning: { github_project: { owner, number: Number(number), url: board?.url } } })
  if (!returned || board.number !== Number(number) || !board.id) return { status: 'board-unavailable', selected }
  const [items, fields] = await Promise.all([
    ghJson(['project', 'item-list', number, '--owner', owner, '--limit', '100', '--format', 'json'], projectRead),
    ghJson(['project', 'field-list', number, '--owner', owner, '--format', 'json'], projectRead),
  ])
  const linkedByItems = !!primary && items?.items?.some((i) => lower(i.content?.repository) === lower(primary))
  return { status: board.closed ? 'board-closed' : board.public !== false ? 'board-not-private' : linkedByItems ? 'verified-exact' : 'board-repo-unconfirmed',
    selected, title: board.title, url: board.url, projectId: board.id, itemCount: items?.totalCount ?? null,
    existingIssueUrls: (items?.items || []).map((i) => i.content?.url).filter((url) => /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+$/.test(url)),
    fieldNames: (fields?.fields || []).map((f) => f.name).filter(Boolean),
  }
}

export async function readEvidence(opts, cambiumRoot) {
  const workspace = await realpath(opts.workspace ?? dirname(cambiumRoot))
  const vault = await realpath(opts.vault ?? process.env.THOUGHTSEED_VAULT_ROOT ?? join(workspace, 'thoughtseed-labs')).catch(() => null)
  const originRoot = opts.root ? await realpath(opts.root) : null
  const startRepo = originRoot && await localGit(originRoot)
  if (originRoot && !startRepo) throw new Error('--root must be a GitHub checkout root with an origin and a pinned HEAD.')
  const target = opts.target || startRepo?.repository
  if (typeof target !== 'string' || !target.trim() || target.length > 160 || /[\r\n\u0000]/.test(target)) throw new Error('Provide a WorkObject, client/project, or GitHub repository target.')
  const record = resolveWorkObject(target)
  const registry = await localJson(vault, '00-meta/work-object-registry.v1.json')
  const vaultRow = registry?.workObjects?.find((r) => r.workId === record?.workId)
  const classification = record?.classification ?? null
  const account = record?.accountId ?? null
  const classAgree = !record || !vaultRow ? null : vaultRow.kind === (classification === 'sapling' ? 'sapling' : 'program')
    && (classification !== 'client-branch' || (vaultRow.programKind === 'client' && vaultRow.accountId === account))
  const rootMap = await localJson(cambiumRoot, 'docs/project-management/portfolio-roots.v1.json')
  const indexFolders = rootMap?.portfolios?.find((p) => p.portfolioId === 'thoughtseed')?.folders ?? []
  const folders = [...new Set([account, record?.workId?.split(':')[1], ...indexFolders.filter((row) => row.workIds?.includes(record?.workId)).map((row) => row.folder)].filter((folder) => slug.test(folder ?? '')))]
  const reviewed = record ? reviewedRepositoryComponentsFor(record.workId) : []
  const names = new Map()
  const track = (repo) => { if (repoName(repo) && !names.has(lower(repo))) names.set(lower(repo), repo) }
  const requestedRepo = repoName(target)
  const primary = opts.primary ? repoName(opts.primary) : null
  if (opts.primary && !primary) throw new Error('--primary must be a GitHub repository.')
  for (const name of [...reviewed.map((c) => c.nameWithOwner), ...qualifiedRefs(record), requestedRepo, startRepo?.repository, primary]) track(name)
  for (const name of opts.repositories) {
    if (!repoName(name)) throw new Error(`Invalid GitHub repository: ${name}`)
    track(repoName(name))
  }
  const branchRequests = new Map()
  for (const entry of opts.branches ?? []) {
    const [name, branch, extra] = entry.split('=')
    if (!repoName(name) || extra !== undefined || !/^[a-z\d_.\/-]{1,150}$/i.test(branch ?? '') || !await run('git', ['check-ref-format', '--branch', branch])) throw new Error('--branch expects OWNER/REPO=BRANCH.')
    const key = lower(repoName(name))
    if (!branchRequests.has(key)) branchRequests.set(key, new Set())
    branchRequests.get(key).add(branch)
    track(repoName(name))
  }

  const candidates = new Set([originRoot, ...[...names.values()].map((name) => join(workspace, name.split('/')[1]))].filter(Boolean))
  const umbrellas = []
  for (const folder of folders) {
    const path = await realpath(join(workspace, folder)).catch(() => null)
    if (!path || !contained(workspace, path)) continue
    umbrellas.push(path)
    candidates.add(path)
    const children = await readdir(path, { withFileTypes: true }).catch(() => [])
    for (const row of children.filter((row) => row.isDirectory() && slug.test(row.name)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40)) {
      candidates.add(join(path, row.name))
    }
  }
  const found = new Map()
  for (const path of candidates) {
    const root = await realpath(path).catch(() => null)
    if (!root || (root !== originRoot && !contained(workspace, root))) continue
    const local = root === originRoot ? startRepo : await localGit(root)
    if (!local) continue
    const key = lower(local.repository)
    // Another clone is not a silent replacement for the specified checkout.
    if (!found.has(key)) found.set(key, { root, ...local })
    track(local.repository)
  }
  if (names.size > 30) throw new Error('Too many repository candidates. Scope the project before reading remote evidence.')
  const repos = await Promise.all([...names.values()].map(async (name) => {
    const map = reviewed.find((c) => lower(c.nameWithOwner) === lower(name))
    const local = found.get(lower(name))
    const live = opts.github ? await liveRepo(name, [...(branchRequests.get(lower(name)) ?? [])]) : { status: 'not-requested' }
    const { root: _root, ...head } = local ?? {}
    const refs = await (local ? gitDocuments(local.root, name) : Promise.resolve([]))
    return { repository: name, membership: map ? 'reviewed' : qualifiedRefs(record).some((ref) => lower(ref) === lower(name)) ? 'catalog-provenance' : 'candidate',
      reviewedId: map?.immutableRepositoryId ?? null, roles: map?.roles ?? [], lifecycle: map?.lifecycle ?? null, association: map?.projectAssociation ?? null,
      github: live, identityConflict: live.status === 'observed' && (lower(live.repository) !== lower(name) || !!map && map.immutableRepositoryId !== live.repoId),
      local: local ? head : null, refs }
  }))
  const selected = repos.find((repo) => lower(repo.repository) === lower(primary))
  const primaryLocal = selected && found.get(lower(selected.repository))
  const packet = primaryLocal && await localJson(primaryLocal.root, '.temperance/project.json')
  const configExists = primaryLocal && await lstat(join(primaryLocal.root, '.temperance/project.json')).then(() => true, () => false)
  const board = configExists && !packet ? { status: 'invalid-temperance-binding' }
    : await readBoard({ requested: opts.board, packet, primary, repos: repos.map((row) => row.repository), name: record?.name ?? target, github: opts.github })

  const vaultRefs = new Set([...(vaultRow?.sourceRefs ?? []), ...(record?.provenance ?? [])].filter((ref) => typeof ref === 'string' && ref.startsWith('vault:')).map((ref) => ref.slice(6)))
  if (account && slug.test(account)) for (const path of ['project-brief.md', 'client-profile.md', 'contracts/README.md', 'project-links.md', 'context/README.md', 'document-inventory.md', 'onboarding/client-onboarding-flow.md']) vaultRefs.add(`60-client-ecosystem/${account}/${path}`)
  const privateSources = []
  for (const path of [...vaultRefs].filter((path) => !isAbsolute(path))) {
    const file = vault && await localRead(vault, path, 'vault')
    if (file) privateSources.push({ ref: file.ref, fingerprint: file.fingerprint })
  }
  const allowed = [...[...found.values()].map(({ repository, root }) => ({ root, ns: `repo:${repository}` })),
    ...(vault ? [{ root: vault, ns: 'vault' }] : []), { root: cambiumRoot, ns: 'cambium' }, ...umbrellas.map((root) => ({ root, ns: `workspace:${basename(root)}` }))]
  for (const path of opts.sources) {
    const file = await realpath(resolve(path)).catch(() => null)
    const scope = file && allowed.find(({ root }) => contained(root, file))
    if (!scope) throw new Error(`Explicit source must be a readable file in the selected checkout, project umbrella, or vault: ${basename(path)}`)
    const picked = relative(scope.root, file)
    if (picked.split(sep).some((part) => /^(?:\.env.*|\.git|\.local|secrets?|auth\.json)$/i.test(part))) throw new Error('Secret, private output, and Git storage files are excluded from evidence.')
    const source = await localRead(scope.root, picked, scope.ns)
    if (!source) throw new Error(`Selected source is unavailable or over the evidence size limit: ${basename(path)}`)
    if (!privateSources.some((item) => item.ref === source.ref)) privateSources.push({ ref: source.ref, fingerprint: source.fingerprint })
  }
  const identity = { status: !record ? 'unmapped' : !vaultRow ? 'workbench-only' : classAgree ? 'vault-and-workbench' : 'classification-conflict',
    workId: record?.workId ?? null, name: record?.name ?? target, account, classification, catalogDigest: PORTFOLIO_CATALOG.catalogDigest,
    vaultRecordDigest: vaultRow ? digest(JSON.stringify(vaultRow)) : null, linkedWorkIds: [...new Set([...(record?.linkedCanonicalIds ?? []), ...(vaultRow?.linkedWorkIds ?? [])])],
    tenantStatus: vaultRow?.tenantIdentity?.status ?? record?.tenantIdentity?.status ?? null, workbenchRefs: record?.provenance ?? [] }
  const workflows = await localJson(cambiumRoot, 'docs/project-management/project-intake-workflows.v1.json')
  const workflow = workflows?.workflows?.find((w) => w.id === workflows.defaultWorkflowByKind?.[classification])
  return { identity, repos, reviewSources: privateSources.sort((a, b) => a.ref.localeCompare(b.ref)), board,
    primary: selected ? { repository: selected.repository,
      status: selected.lifecycle !== 'current' ? 'not-reviewed-current' : selected.identityConflict ? 'identity-conflict'
        : selected.github.status === 'observed' && selected.github.defaultCommit && selected.github.archived === false ? 'reviewed-and-observed' : 'reviewed-local-only' } : null,
    workflow: workflow ? { id: workflow.id, stages: workflow.stages.map(({ id, label }) => ({ id, label })) } : null }
}
