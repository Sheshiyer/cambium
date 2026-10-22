import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { REVIEWED_ROOT_MAP_DIGEST } from '../../../scripts/portfolio-foundation-pins.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultSnapshotPath = path.resolve(appRoot, '../../docs/project-management/portfolio-roots.v1.json')
const defaultGeneratedPath = path.join(appRoot, 'src/portfolio-root-map.generated.ts')
const defaultWorkerGeneratedPath = path.resolve(appRoot, '../../workers/quests/src/portfolio-root-map.generated.ts')
const allowedKinds = new Set(['client-branch', 'sapling', 'internal-program', 'needs-review', 'project'])
const safeFolder = (value) => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9_.-]+$/.test(value) && value !== '.' && value !== '..'

function validateSourceRefs(refs) {
  if (!Array.isArray(refs) || refs.length === 0 || refs.length > 4 || new Set(refs).size !== refs.length || !refs.every((ref) => {
    if (typeof ref !== 'string' || ref.length > 256 || !/^(repo|local|history|git):[A-Za-z0-9._/-]+(?:#[A-Za-z0-9._/-]+)?$/.test(ref)) return false
    const relative = ref.slice(ref.indexOf(':') + 1).split('#')[0]
    return !relative.startsWith('/') && relative.split('/').every((part) => part && part !== '.' && part !== '..')
  })) throw new TypeError('invalid portable census source references')
}

// These optional rows describe physical provenance, never WorkObject admission.
// A historical name cannot suppress a missing current folder or an extra folder.
export function validatePortfolioCensusEvidence(portfolio) {
  if (Object.hasOwn(portfolio, 'censusObservedAt') && (typeof portfolio.censusObservedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(portfolio.censusObservedAt) ||
    !Number.isFinite(Date.parse(portfolio.censusObservedAt)) || new Date(portfolio.censusObservedAt).toISOString() !== portfolio.censusObservedAt.replace('Z', '.000Z'))) throw new TypeError('invalid portfolio census observation time')
  const ordinary = new Set(portfolio.folders.map((entry) => entry.folder))
  const infrastructure = new Set(portfolio.infrastructure)
  if (Object.hasOwn(portfolio, 'infrastructureEvidence')) {
    if (!Array.isArray(portfolio.infrastructureEvidence) || portfolio.infrastructureEvidence.length > 256) throw new TypeError('invalid infrastructure census evidence')
    const seen = new Set()
    for (const row of portfolio.infrastructureEvidence) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some((key) => !['folder', 'kind', 'sourceRefs'].includes(key)) ||
        !infrastructure.has(row.folder) || seen.has(row.folder) || !['linked-worktree', 'retained-artifact'].includes(row.kind)) throw new TypeError('invalid infrastructure census evidence row')
      validateSourceRefs(row.sourceRefs)
      seen.add(row.folder)
    }
  }
  if (Object.hasOwn(portfolio, 'historicalFolders')) {
    if (!Array.isArray(portfolio.historicalFolders) || portfolio.historicalFolders.length > 128) throw new TypeError('invalid historical census folders')
    const seen = new Set()
    for (const row of portfolio.historicalFolders) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some((key) => !['folder', 'disposition', 'currentFolder', 'sourceRefs'].includes(key)) ||
        !safeFolder(row.folder) || !safeFolder(row.currentFolder) || seen.has(row.folder) || ordinary.has(row.folder) || infrastructure.has(row.folder) || !ordinary.has(row.currentFolder) ||
        !['replaced-checkout', 'retired-worktree'].includes(row.disposition)) throw new TypeError('invalid historical census folder disposition')
      validateSourceRefs(row.sourceRefs)
      seen.add(row.folder)
    }
  }
  for (const entry of portfolio.folders) {
    if (Object.hasOwn(entry, 'sourceRefs')) validateSourceRefs(entry.sourceRefs)
    if (!Object.hasOwn(entry, 'referenceKind')) continue
    if (entry.referenceKind === 'platform-companion') {
      if (entry.proposedKind !== 'internal-program' || entry.status !== 'mapping-proposal' || entry.accountId !== null || !entry.workIds.length) throw new TypeError('invalid platform companion census row')
    } else if (['external-adapter', 'identity-intake'].includes(entry.referenceKind)) {
      const expectedStatus = entry.referenceKind === 'external-adapter' ? 'reference-unresolved' : 'identity-unresolved'
      if (entry.proposedKind !== 'needs-review' || entry.status !== expectedStatus || entry.accountId !== null || entry.workIds.length !== 0 || Object.hasOwn(entry, 'identityStatus')) throw new TypeError('unresolved census reference cannot grant identity')
    } else throw new TypeError('invalid census reference kind')
    validateSourceRefs(entry.sourceRefs)
  }
  return portfolio
}

function isDisplayName(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128 && !/[\x00-\x1f\x7f|`<>]/.test(value)
}

// Nested evidence describes an existing repository beneath a shallow folder.
// It inherits that folder's client and can only reference its existing work IDs.
function validateFolderMetadata(entry) {
  if (Object.hasOwn(entry, 'displayName') && !isDisplayName(entry.displayName)) throw new TypeError(`invalid display name for ${entry.folder}`)
  if (['ownership', 'relationship', 'relatedWorkId', 'identityStatus'].some((key) => Object.hasOwn(entry, key))) {
    const partner = entry.ownership === 'partner' && entry.relationship === 'personal-affiliated' && !Object.hasOwn(entry, 'relatedWorkId') && entry.identityStatus === 'reviewed-local-node'
    const organ = entry.ownership === 'thoughtseed' && entry.relationship === 'modular-organ-of' && entry.relatedWorkId === 'sapling:cambium' && !entry.workIds.includes('sapling:cambium') && (!Object.hasOwn(entry, 'identityStatus') || entry.identityStatus === 'reviewed-local-node')
    if ((!partner && !organ) || entry.accountId !== null) throw new TypeError(`invalid ownership metadata for ${entry.folder}`)
  }
  if (!Object.hasOwn(entry, 'nestedRepositories')) return
  if (!Array.isArray(entry.nestedRepositories) || entry.nestedRepositories.length > 128) throw new TypeError(`invalid nested repository evidence for ${entry.folder}`)
  const paths = new Set()
  for (const repository of entry.nestedRepositories) {
    if (!repository || typeof repository !== 'object' || Array.isArray(repository) ||
      Object.keys(repository).some((key) => !['relativePath', 'displayName', 'workIds'].includes(key)) ||
      typeof repository.relativePath !== 'string' || repository.relativePath.length > 256 ||
      !repository.relativePath.split('/').every((segment) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment)) ||
      paths.has(repository.relativePath) || !isDisplayName(repository.displayName) ||
      !Array.isArray(repository.workIds) || repository.workIds.length === 0 ||
      new Set(repository.workIds).size !== repository.workIds.length ||
      !repository.workIds.every((workId) => entry.workIds.includes(workId))) {
      throw new TypeError(`invalid nested repository evidence for ${entry.folder}`)
    }
    paths.add(repository.relativePath)
  }
}

export function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]))
}

export function snapshotDigest(snapshot) {
  return createHash('sha256').update(JSON.stringify(stableJson(snapshot))).digest('hex')
}

export function validateSnapshot(snapshot) {
  if (snapshot?.schema !== 'thoughtseed.portfolio-root-map.v1') throw new TypeError('unsupported portfolio root map schema')
  if (snapshot.authority !== 'proposal-only') throw new TypeError('portfolio root map must remain proposal-only')
  if (snapshot.pathGrammar !== '<projects-root>/<portfolio>/<repository>') throw new TypeError('portfolio root map must preserve the shallow path grammar')
  if (!Array.isArray(snapshot.portfolios) || snapshot.portfolios.length !== 2) throw new TypeError('portfolio root map requires exactly two portfolios')
  const ids = snapshot.portfolios.map((portfolio) => portfolio.portfolioId)
  if (ids.join(',') !== 'thoughtseed,tryambakam-noesis') throw new TypeError('portfolio root order or identity drift')
  for (const portfolio of snapshot.portfolios) {
    if (!Array.isArray(portfolio.folders) || portfolio.folders.length !== portfolio.folderCount) throw new TypeError(`${portfolio.portfolioId} folder count drift`)
    const folders = new Set()
    for (const entry of portfolio.folders) {
      if (!entry || typeof entry.folder !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(entry.folder)) throw new TypeError(`unsafe relative folder in ${portfolio.portfolioId}`)
      if (folders.has(entry.folder)) throw new TypeError(`duplicate folder ${entry.folder}`)
      folders.add(entry.folder)
      if (!allowedKinds.has(entry.proposedKind)) throw new TypeError(`unsupported proposal kind ${entry.proposedKind}`)
      if (!Array.isArray(entry.workIds) || !entry.workIds.every((workId) => typeof workId === 'string' && workId.length <= 128)) throw new TypeError(`invalid workIds for ${entry.folder}`)
      if (entry.accountId !== null && (typeof entry.accountId !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(entry.accountId))) throw new TypeError(`invalid accountId for ${entry.folder}`)
      validateFolderMetadata(entry)
    }
    const infrastructure = new Set()
    if (!Array.isArray(portfolio.infrastructure)) throw new TypeError(`invalid infrastructure in ${portfolio.portfolioId}`)
    for (const folder of portfolio.infrastructure) {
      if (typeof folder !== 'string' || folder.length > 128 || !/^[A-Za-z0-9_.-]+$/.test(folder) || folder === '.' || folder === '..') throw new TypeError(`unsafe relative infrastructure folder in ${portfolio.portfolioId}`)
      if (infrastructure.has(folder)) throw new TypeError(`duplicate infrastructure folder ${folder}`)
      if (folders.has(folder)) throw new TypeError(`infrastructure folder overlaps ordinary folder ${folder}`)
      infrastructure.add(folder)
    }
    // Absence preserves legacy snapshots; a present field must be wholly valid.
    if (Object.hasOwn(portfolio, 'infrastructureWorkMappings')) {
      const mappings = portfolio.infrastructureWorkMappings
      if (!Array.isArray(mappings) || mappings.length > 256) throw new TypeError(`invalid infrastructure mappings in ${portfolio.portfolioId}`)
      const mappedFolders = new Set()
      for (const mapping of mappings) {
        if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping) ||
          Object.keys(mapping).some((key) => key !== 'folder' && key !== 'workIds') ||
          !infrastructure.has(mapping.folder)) throw new TypeError('infrastructure mapping must name an existing infrastructure folder')
        if (mappedFolders.has(mapping.folder)) throw new TypeError(`duplicate infrastructure mapping for ${mapping.folder}`)
        mappedFolders.add(mapping.folder)
        const workIds = mapping.workIds
        if (!Array.isArray(workIds) || workIds.length === 0 || workIds.length > 128 ||
          new Set(workIds).size !== workIds.length ||
          !workIds.every((workId) => typeof workId === 'string' && workId.length <= 128 && /^(sapling|branch|program):[A-Za-z0-9][A-Za-z0-9._-]*$/.test(workId))) {
          throw new TypeError(`invalid infrastructure mapping workIds for ${mapping.folder}`)
        }
      }
    }
    validatePortfolioCensusEvidence(portfolio)
  }
  const noesis = snapshot.portfolios[1]
  if (JSON.stringify(noesis.infrastructure) !== JSON.stringify(['_portfolio-audit', 'antahkarana-recovery-20260831-pzm8eM'])) throw new TypeError('Tryambakam-Noesis infrastructure exclusions drifted')
  if (noesis.archiveContainer !== '_archive') throw new TypeError('Tryambakam-Noesis archive container drifted')
  return snapshot
}

export const SKILL_NEST = 'skills'

export function expectedDirectoryNames(portfolio) {
  const expected = portfolio.folders.map((entry) => entry.folder)
  if (portfolio.infrastructure) expected.push(...portfolio.infrastructure)
  if (portfolio.archiveContainer) expected.push(portfolio.archiveContainer)
  return expected.sort((left, right) => left.localeCompare(right))
}

export async function observePortfolioFolders(workingRoot, expectedNames = []) {
  if (!path.isAbsolute(workingRoot)) throw new TypeError('workingRoot must be absolute')
  const expected = new Set(expectedNames)
  const entries = await readdir(workingRoot, { withFileTypes: true })
  const observed = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    observed.push(entry.name)
  }
  try {
    const nested = await readdir(path.join(workingRoot, SKILL_NEST), { withFileTypes: true })
    for (const entry of nested) {
      if (!entry.isDirectory()) continue
      if (!expected.has(entry.name)) continue
      if (observed.includes(entry.name)) continue
      observed.push(entry.name)
    }
  } catch (error) {
    if (error && error.code !== 'ENOENT') throw error
  }
  return observed.sort((left, right) => left.localeCompare(right))
}

export function compareObservedDirectories(portfolio, observed) {
  const expected = expectedDirectoryNames(portfolio)
  const actual = [...observed].sort((left, right) => left.localeCompare(right))
  const missing = expected.filter((folder) => !actual.includes(folder))
  const unexpected = actual.filter((folder) => !expected.includes(folder))
  return { ok: missing.length === 0 && unexpected.length === 0, expected, actual, missing, unexpected }
}

function heading(value) {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

export function renderPortfolioMarkdown(portfolio, digest) {
  const lines = [
    `# ${portfolio.label} Portfolio`,
    '',
    '> Generated proposal header. Folder names are evidence inputs, not canonical repository or WorkObject identity.',
    '',
    `- Schema: \`thoughtseed.portfolio-root-header.v1\``,
    `- Snapshot digest: \`${digest}\``,
    `- Path grammar: \`<projects-root>/${portfolio.portfolioId}/<repository>\``,
    `- Mapped shallow folders: ${portfolio.folderCount}`,
    '',
  ]
  if (portfolio.portfolioId === 'thoughtseed') {
    for (const kind of ['client-branch', 'sapling', 'internal-program', 'needs-review']) {
      const entries = portfolio.folders.filter((entry) => entry.proposedKind === kind)
      lines.push(`## ${kind === 'client-branch' ? 'Client Branch folders' : heading(kind)}`, '', '| Folder | Product / display name | Client / WorkObject evidence | Status |', '|---|---|---|---|')
      for (const entry of entries) {
        const evidence = entry.accountId ? `client:${entry.accountId}` : entry.workIds.join(', ') || 'unmapped'
        lines.push(`| \`${entry.folder}\` | ${entry.displayName ?? '—'} | ${evidence} | ${entry.status} |`)
      }
      lines.push('')
    }
    lines.push('## Client families without a destination folder', '')
    for (const accountId of portfolio.missingClientAccounts) lines.push(`- \`client:${accountId}\``)
    lines.push('')
    lines.push('## Portfolio infrastructure', '')
    for (const folder of portfolio.infrastructure) {
      if (folder === 'thoughtseed-labs') {
        lines.push(`- \`${folder}\` — R2-synced vault copy; context source, not a WorkObject folder`)
      } else {
        lines.push(`- \`${folder}\` — explicit local infrastructure/exclusion; not a WorkObject folder`)
      }
    }
    lines.push('')
  } else {
    lines.push('## Projects', '', '| Project folder | Intake status |', '|---|---|')
    for (const entry of portfolio.folders) lines.push(`| \`${entry.folder}\` | ${entry.status} |`)
    lines.push('', '## Archived projects', '')
    for (const folder of portfolio.archivedProjects) lines.push(`- \`${portfolio.archiveContainer}/${folder}\``)
    lines.push('', '## Portfolio infrastructure', '')
    for (const folder of portfolio.infrastructure) lines.push(`- \`${folder}\``)
    lines.push('')
  }
  const nestedParents = portfolio.folders.filter((entry) => entry.nestedRepositories?.length)
  if (nestedParents.length) {
    lines.push('## Nested repository evidence', '',
      'Nested repository evidence inherits the existing parent client and WorkObject relationships; it does not add shallow folders or new WorkObjects.', '',
      '| Relative repository path | Product / display name | Parent client | Existing WorkObject evidence |', '|---|---|---|---|')
    for (const entry of nestedParents) {
      for (const repository of entry.nestedRepositories) {
        lines.push(`| \`${entry.folder}/${repository.relativePath}\` | ${repository.displayName} | ${entry.accountId ? `client:${entry.accountId}` : '—'} | ${repository.workIds.join(', ')} |`)
      }
    }
    lines.push('')
  }
  if (portfolio.infrastructureWorkMappings?.length) {
    lines.push('## Infrastructure WorkObject evidence', '',
      'These relations preserve infrastructure exclusions and do not create WorkObject folders.', '',
      '| Infrastructure folder | WorkObject evidence |', '|---|---|')
    for (const mapping of portfolio.infrastructureWorkMappings) {
      lines.push(`| \`${mapping.folder}\` | ${mapping.workIds.join(', ')} |`)
    }
    lines.push('')
  }
  const ownedEntries = portfolio.folders.filter((entry) => entry.ownership)
  if (ownedEntries.length) {
    lines.push('## Reviewed ownership and modular nodes', '',
      'Ownership and affiliation are reviewed mapping declarations. A reviewed-local-node preserves a distinct identity pending canonical registry promotion; it does not issue a canonical WorkObject or change the reviewed foundation. Portfolio placement does not imply client ownership.', '',
      '| Folder | Mapping identity | Ownership | Relationship | Related identity | Identity status |', '|---|---|---|---|---|---|')
    for (const entry of ownedEntries) lines.push(`| \`${entry.folder}\` | ${entry.workIds.join(', ')} | ${entry.ownership} | ${entry.relationship} | ${entry.relatedWorkId ?? '—'} | ${entry.identityStatus ?? 'existing-mapping-reference'} |`)
    lines.push('')
  }
  if (portfolio.infrastructureEvidence?.length) {
    lines.push('## Physical infrastructure provenance', '', '| Folder | Physical role | Source references |', '|---|---|---|')
    for (const row of portfolio.infrastructureEvidence) lines.push(`| \`${row.folder}\` | ${row.kind} | ${row.sourceRefs.join(', ')} |`)
    lines.push('')
  }
  if (portfolio.historicalFolders?.length) {
    lines.push('## Historical folder dispositions', '', 'Historical paths are retained evidence. Only the named current checkout is expected physically; a missing current checkout still blocks the census.', '', '| Historical folder | Disposition | Current folder | Source references |', '|---|---|---|---|')
    for (const row of portfolio.historicalFolders) lines.push(`| \`${row.folder}\` | ${row.disposition} | \`${row.currentFolder}\` | ${row.sourceRefs.join(', ')} |`)
    lines.push('')
  }
  lines.push('No repository directory was moved or nested by this header.', '')
  return lines.join('\n')
}

export function renderPortfolioJson(portfolio, digest) {
  return `${JSON.stringify({
    schema: 'thoughtseed.portfolio-root-header.v1',
    snapshotDigest: digest,
    authority: 'proposal-only',
    portfolioId: portfolio.portfolioId,
    itemLabel: portfolio.itemLabel,
    ...(Object.hasOwn(portfolio, 'censusObservedAt') ? { censusObservedAt: portfolio.censusObservedAt } : {}),
    pathGrammar: `<projects-root>/${portfolio.portfolioId}/<repository>`,
    folders: portfolio.folders,
    infrastructure: portfolio.infrastructure ?? [],
    ...(Object.hasOwn(portfolio, 'infrastructureWorkMappings') ? { infrastructureWorkMappings: portfolio.infrastructureWorkMappings } : {}),
    ...(Object.hasOwn(portfolio, 'infrastructureEvidence') ? { infrastructureEvidence: portfolio.infrastructureEvidence } : {}),
    ...(Object.hasOwn(portfolio, 'historicalFolders') ? { historicalFolders: portfolio.historicalFolders } : {}),
    archiveContainer: portfolio.archiveContainer ?? null,
    archivedProjects: portfolio.archivedProjects ?? [],
    missingClientAccounts: portfolio.missingClientAccounts ?? [],
  }, null, 2)}\n`
}

export function renderGeneratedModule(snapshot) {
  const digest = snapshotDigest(snapshot)
  return [
    '// Generated by scripts/generate-portfolio-root-map.mjs. Do not edit.',
    '// The proposal census can advance independently; admin actions stay bound to the reviewed execution pin.',
    `export const PORTFOLIO_ROOT_MAP_DIGEST = ${JSON.stringify(digest)} as const;`,
    `export const REVIEWED_PORTFOLIO_ROOT_MAP_DIGEST = ${JSON.stringify(REVIEWED_ROOT_MAP_DIGEST)} as const;`,
    `export const PORTFOLIO_ROOTS = ${JSON.stringify(snapshot.portfolios, null, 2)} as const;`,
    '',
  ].join('\n')
}

export function renderWorkerPolicyModule(snapshot) {
  const digest = snapshotDigest(snapshot)
  const noesis = snapshot.portfolios.find((portfolio) => portfolio.portfolioId === 'tryambakam-noesis')
  const projects = Object.fromEntries(noesis.folders.map((entry) => [entry.folder, {
    path: `tryambakam-noesis/${entry.folder}`,
    status: entry.status,
    ...(entry.ownership ? { ownership: entry.ownership, relationship: entry.relationship } : {}),
  }]))
  return [
    '// Generated by apps/portfolio-cartographer/scripts/generate-portfolio-root-map.mjs. Do not edit.',
    `export const PORTFOLIO_ROOT_MAP_DIGEST = ${JSON.stringify(digest)} as const;`,
    `export const REVIEWED_PORTFOLIO_ROOT_MAP_DIGEST = ${JSON.stringify(REVIEWED_ROOT_MAP_DIGEST)} as const;`,
    `export const TRYAMBAKAM_PROJECTS = ${JSON.stringify(projects, null, 2)} as const;`,
    '',
  ].join('\n')
}

export async function loadSnapshot(snapshotPath = defaultSnapshotPath) {
  return validateSnapshot(JSON.parse(await readFile(snapshotPath, 'utf8')))
}

export async function generateBrowserModule({
  snapshotPath = defaultSnapshotPath,
  outputPath = defaultGeneratedPath,
  workerOutputPath = defaultWorkerGeneratedPath,
} = {}) {
  const snapshot = await loadSnapshot(snapshotPath)
  const generated = renderGeneratedModule(snapshot)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, generated, 'utf8')
  await mkdir(path.dirname(workerOutputPath), { recursive: true })
  // Both runtimes consume the same generated authority. Keeping the complete
  // module byte-identical proves mirror parity instead of inferring it from a
  // shared digest embedded in intentionally different source projections.
  await writeFile(workerOutputPath, generated, 'utf8')
  return { digest: snapshotDigest(snapshot), outputPath, workerOutputPath, snapshot }
}

export async function writeRootHeaders({ snapshot, projectsRoot, write = false, portfolioIds = null }) {
  if (!path.isAbsolute(projectsRoot)) throw new TypeError('projectsRoot must be absolute')
  const requestedPortfolioIds = portfolioIds ? new Set(portfolioIds) : null
  const portfolios = requestedPortfolioIds
    ? snapshot.portfolios.filter((portfolio) => requestedPortfolioIds.has(portfolio.portfolioId))
    : snapshot.portfolios
  if (requestedPortfolioIds && portfolios.length !== requestedPortfolioIds.size) throw new TypeError('unknown portfolio id')
  const digest = snapshotDigest(snapshot)
  const plans = []
  const plannedWrites = []
  for (const portfolio of portfolios) {
    const portfolioRoot = path.join(projectsRoot, portfolio.portfolioId)
    const stat = await lstat(portfolioRoot)
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new TypeError(`${portfolio.portfolioId} root must be a real directory`)
    const observed = await observePortfolioFolders(portfolioRoot, expectedDirectoryNames(portfolio))
    const comparison = compareObservedDirectories(portfolio, observed)
    if (!comparison.ok) throw new TypeError(`${portfolio.portfolioId} folder drift: missing=${comparison.missing.join(',')} unexpected=${comparison.unexpected.join(',')}`)
    const outputs = [
      { path: path.join(portfolioRoot, 'PORTFOLIO.md'), content: renderPortfolioMarkdown(portfolio, digest) },
      { path: path.join(portfolioRoot, 'portfolio-map.v1.json'), content: renderPortfolioJson(portfolio, digest) },
    ]
    plans.push({ portfolioId: portfolio.portfolioId, observed: observed.length, outputs: outputs.map((output) => output.path) })
    plannedWrites.push(...outputs)
  }
  if (write) for (const output of plannedWrites) await writeFile(output.path, output.content, 'utf8')
  return { digest, write, plans }
}

function parseArgs(argv) {
  const projectsRootIndex = argv.indexOf('--projects-root')
  const portfolioIndex = argv.indexOf('--portfolio')
  return {
    projectsRoot: projectsRootIndex >= 0 ? argv[projectsRootIndex + 1] : null,
    portfolioIds: portfolioIndex >= 0 ? [argv[portfolioIndex + 1]] : null,
    write: argv.includes('--write-headers'),
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  const result = await generateBrowserModule()
  if (args.projectsRoot) {
    const headers = await writeRootHeaders({ snapshot: result.snapshot, projectsRoot: args.projectsRoot, write: args.write, portfolioIds: args.portfolioIds })
    console.log(JSON.stringify(headers, null, 2))
  } else {
    console.log(`portfolio root map ok · sha256 ${result.digest}`)
  }
}
