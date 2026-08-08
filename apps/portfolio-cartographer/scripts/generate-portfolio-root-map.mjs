import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultSnapshotPath = path.resolve(appRoot, '../../docs/project-management/portfolio-roots.v1.json')
const defaultGeneratedPath = path.join(appRoot, 'src/portfolio-root-map.generated.ts')
const defaultWorkerGeneratedPath = path.resolve(appRoot, '../../workers/quests/src/portfolio-root-map.generated.ts')
const allowedKinds = new Set(['client-branch', 'sapling', 'internal-program', 'needs-review', 'project'])

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
      if (!entry || typeof entry.folder !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(entry.folder)) throw new TypeError(`unsafe relative folder in ${portfolio.portfolioId}`)
      if (folders.has(entry.folder)) throw new TypeError(`duplicate folder ${entry.folder}`)
      folders.add(entry.folder)
      if (!allowedKinds.has(entry.proposedKind)) throw new TypeError(`unsupported proposal kind ${entry.proposedKind}`)
      if (!Array.isArray(entry.workIds) || !entry.workIds.every((workId) => typeof workId === 'string' && workId.length <= 128)) throw new TypeError(`invalid workIds for ${entry.folder}`)
      if (entry.accountId !== null && (typeof entry.accountId !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(entry.accountId))) throw new TypeError(`invalid accountId for ${entry.folder}`)
    }
  }
  const thoughtseed = snapshot.portfolios[0]
  if (thoughtseed.folderCount !== 54) throw new TypeError('Thoughtseed folder count must remain 54')
  if (JSON.stringify(thoughtseed.infrastructure) !== JSON.stringify(['_home-cleanup-2026-08-08', 'cambium-authoritative', 'openfang', 'thoughtseed-labs', 'website'])) throw new TypeError('Thoughtseed infrastructure exclusions drifted')
  const noesis = snapshot.portfolios[1]
  if (noesis.folderCount !== 30) throw new TypeError('Tryambakam-Noesis folder count must remain 30')
  if (JSON.stringify(noesis.infrastructure) !== JSON.stringify(['selemene-engine-worktrees'])) throw new TypeError('Tryambakam-Noesis infrastructure exclusions drifted')
  if (noesis.archiveContainer !== '_archive') throw new TypeError('Tryambakam-Noesis archive container drifted')
  return snapshot
}

export function expectedDirectoryNames(portfolio) {
  const expected = portfolio.folders.map((entry) => entry.folder)
  if (portfolio.infrastructure) expected.push(...portfolio.infrastructure)
  if (portfolio.archiveContainer) expected.push(portfolio.archiveContainer)
  return expected.sort((left, right) => left.localeCompare(right))
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
      lines.push(`## ${kind === 'client-branch' ? 'Client Branch folders' : heading(kind)}`, '', '| Folder | Client / WorkObject evidence | Status |', '|---|---|---|')
      for (const entry of entries) {
        const evidence = entry.accountId ? `client:${entry.accountId}` : entry.workIds.join(', ') || 'unmapped'
        lines.push(`| \`${entry.folder}\` | ${evidence} | ${entry.status} |`)
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
    pathGrammar: `<projects-root>/${portfolio.portfolioId}/<repository>`,
    folders: portfolio.folders,
    infrastructure: portfolio.infrastructure ?? [],
    archiveContainer: portfolio.archiveContainer ?? null,
    archivedProjects: portfolio.archivedProjects ?? [],
    missingClientAccounts: portfolio.missingClientAccounts ?? [],
  }, null, 2)}\n`
}

export function renderGeneratedModule(snapshot) {
  const digest = snapshotDigest(snapshot)
  return [
    '// Generated by scripts/generate-portfolio-root-map.mjs. Do not edit.',
    `export const PORTFOLIO_ROOT_MAP_DIGEST = ${JSON.stringify(digest)} as const;`,
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
  }]))
  return [
    '// Generated by apps/portfolio-cartographer/scripts/generate-portfolio-root-map.mjs. Do not edit.',
    `export const PORTFOLIO_ROOT_MAP_DIGEST = ${JSON.stringify(digest)} as const;`,
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
  await writeFile(workerOutputPath, renderWorkerPolicyModule(snapshot), 'utf8')
  return { digest: snapshotDigest(snapshot), outputPath, workerOutputPath, snapshot }
}

export async function writeRootHeaders({ snapshot, projectsRoot, write = false }) {
  if (!path.isAbsolute(projectsRoot)) throw new TypeError('projectsRoot must be absolute')
  const digest = snapshotDigest(snapshot)
  const plans = []
  for (const portfolio of snapshot.portfolios) {
    const portfolioRoot = path.join(projectsRoot, portfolio.portfolioId)
    const stat = await lstat(portfolioRoot)
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new TypeError(`${portfolio.portfolioId} root must be a real directory`)
    const entries = await readdir(portfolioRoot, { withFileTypes: true })
    const observed = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    const comparison = compareObservedDirectories(portfolio, observed)
    if (!comparison.ok) throw new TypeError(`${portfolio.portfolioId} folder drift: missing=${comparison.missing.join(',')} unexpected=${comparison.unexpected.join(',')}`)
    const outputs = [
      { path: path.join(portfolioRoot, 'PORTFOLIO.md'), content: renderPortfolioMarkdown(portfolio, digest) },
      { path: path.join(portfolioRoot, 'portfolio-map.v1.json'), content: renderPortfolioJson(portfolio, digest) },
    ]
    plans.push({ portfolioId: portfolio.portfolioId, observed: observed.length, outputs: outputs.map((output) => output.path) })
    if (write) for (const output of outputs) await writeFile(output.path, output.content, 'utf8')
  }
  return { digest, write, plans }
}

function parseArgs(argv) {
  const projectsRootIndex = argv.indexOf('--projects-root')
  return {
    projectsRoot: projectsRootIndex >= 0 ? argv[projectsRootIndex + 1] : null,
    write: argv.includes('--write-headers'),
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  const result = await generateBrowserModule()
  if (args.projectsRoot) {
    const headers = await writeRootHeaders({ snapshot: result.snapshot, projectsRoot: args.projectsRoot, write: args.write })
    console.log(JSON.stringify(headers, null, 2))
  } else {
    console.log(`portfolio root map ok · sha256 ${result.digest}`)
  }
}
