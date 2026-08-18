import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  compareObservedDirectories,
  expectedDirectoryNames,
  observePortfolioFolders,
  renderPortfolioJson,
  renderPortfolioMarkdown,
  renderWorkerPolicyModule,
  snapshotDigest,
  validateSnapshot,
  writeRootHeaders,
} from '../scripts/generate-portfolio-root-map.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const snapshotPath = path.resolve(appRoot, '../../docs/project-management/portfolio-roots.v1.json')
const generatedModulePath = path.resolve(appRoot, 'src/portfolio-root-map.generated.ts')
const workerGeneratedModulePath = path.resolve(appRoot, '../../workers/quests/src/portfolio-root-map.generated.ts')

async function readSnapshot() {
  return JSON.parse(await readFile(snapshotPath, 'utf8'))
}

test('portfolio root snapshot exists before folder ingestion is rendered', async () => {
  assert.equal(existsSync(snapshotPath), true)
  const snapshot = await readSnapshot()
  assert.equal(snapshot.schema, 'thoughtseed.portfolio-root-map.v1')
})

test('snapshot freezes the observed shallow portfolio counts and exclusions', async () => {
  const snapshot = await readSnapshot()
  const thoughtseed = snapshot.portfolios.find((portfolio: { portfolioId: string }) => portfolio.portfolioId === 'thoughtseed')
  const noesis = snapshot.portfolios.find((portfolio: { portfolioId: string }) => portfolio.portfolioId === 'tryambakam-noesis')

  assert.equal(thoughtseed.folderCount, 58)
  assert.deepEqual(
    thoughtseed.folders.find((folder) => folder.folder === 'temperance_engine')?.workIds,
    ['program:temperance-hermes'],
  )
  assert.equal(thoughtseed.folders.length, 58)
  assert.deepEqual(thoughtseed.infrastructure, ['_physical-relocation-archive-2026-08-08', 'openfang', 'scroll-world', 'thoughtseed-labs', 'website'])
  assert.equal(noesis.folderCount, 30)
  assert.equal(noesis.folders.length, 30)
  assert.deepEqual(noesis.infrastructure, ['selemene-engine-worktrees'])
  assert.equal(noesis.archiveContainer, '_archive')
  assert.equal(thoughtseed.folders.some((entry: { folder: string }) => ['_physical-relocation-archive-2026-08-08', 'openfang', 'scroll-world', 'thoughtseed-labs', 'website'].includes(entry.folder)), false)
  assert.equal(thoughtseed.folders.find((entry: { folder: string }) => entry.folder === 'safvr')?.workIds[0], 'branch:safvr-landing-page')
  assert.equal(noesis.folders.some((entry: { folder: string }) => ['.agents', '_archive', 'selemene-engine-worktrees'].includes(entry.folder)), false)
})

test('snapshot uses only relative unique folders and bounded proposal kinds', async () => {
  const snapshot = await readSnapshot()
  assert.doesNotThrow(() => validateSnapshot(snapshot))
  const allowedKinds = new Set(['client-branch', 'sapling', 'internal-program', 'needs-review', 'project'])
  for (const portfolio of snapshot.portfolios) {
    const folders = portfolio.folders.map((entry: { folder: string }) => entry.folder)
    assert.equal(new Set(folders).size, folders.length)
    for (const entry of portfolio.folders) {
      assert.equal(entry.folder.includes('/'), false)
      assert.equal(entry.folder.startsWith('.'), false)
      assert.equal(allowedKinds.has(entry.proposedKind), true)
    }
  }
})

test('review holds and linked dual work stay explicit', async () => {
  const snapshot = await readSnapshot()
  const thoughtseed = snapshot.portfolios.find((portfolio: { portfolioId: string }) => portfolio.portfolioId === 'thoughtseed')
  const byFolder = new Map(thoughtseed.folders.map((entry: { folder: string }) => [entry.folder, entry]))

  assert.deepEqual(['klear-karma', 'kristudios', 'panaroma-webapp'].map((folder) => byFolder.get(folder)?.proposedKind), [
    'client-branch', 'client-branch', 'needs-review',
  ])
  assert.deepEqual(byFolder.get('klear-karma')?.workIds, ['branch:klear-karma'])
  assert.deepEqual(byFolder.get('meristem')?.workIds, ['program:meristem-brand-system'])
  assert.equal(byFolder.get('meristem')?.status, 'awaiting-ingestion')
  assert.deepEqual(byFolder.get('session-atlas')?.workIds, [])
  assert.equal(byFolder.get('session-atlas')?.proposedKind, 'internal-program')
  assert.equal(byFolder.get('session-atlas')?.status, 'awaiting-ingestion')
  assert.deepEqual(byFolder.get('kristudios')?.workIds, ['branch:kristudios'])
  assert.equal(byFolder.get('virtualtryon-3d')?.proposedKind, 'needs-review')
  assert.deepEqual(byFolder.get('virtualtryon-3d')?.workIds, [])
  assert.equal(byFolder.get('virtualtryon-3d')?.status, 'empty-hold')
  assert.deepEqual(byFolder.get('parkarea')?.workIds, ['branch:parkarea'])
  assert.deepEqual(byFolder.get('tirak')?.workIds, ['branch:tirak'])
})

test('typed browser projection is generated from the reviewed snapshot', () => {
  assert.equal(existsSync(generatedModulePath), true)
  assert.equal(existsSync(workerGeneratedModulePath), true)
})

test('App and Worker generated root maps are byte-identical', async () => {
  const [appGenerated, workerGenerated] = await Promise.all([
    readFile(generatedModulePath, 'utf8'),
    readFile(workerGeneratedModulePath, 'utf8'),
  ])
  assert.equal(workerGenerated, appGenerated)
})

test('Worker policy projection binds the reviewed digest and exact shallow Tryambakam paths', async () => {
  const snapshot = validateSnapshot(await readSnapshot())
  const generated = renderWorkerPolicyModule(snapshot)
  assert.match(generated, new RegExp(snapshotDigest(snapshot)))
  assert.match(generated, /"astrolens": \{\n    "path": "tryambakam-noesis\/astrolens"/)
  assert.doesNotMatch(generated, /tryambakam-noesis\/astrolens\//)
  assert.doesNotMatch(generated, /Client Branch/)
})

test('skills nest remaps catalogued shallow names without admitting uncatalogued siblings', async (t) => {
  const workingRoot = await mkdtemp(path.join(os.tmpdir(), 'portfolio-skills-nest-'))
  t.after(() => rm(workingRoot, { recursive: true, force: true }))
  await mkdir(path.join(workingRoot, 'cambium'))
  await mkdir(path.join(workingRoot, 'skills', 'motionsites-skills'), { recursive: true })
  await mkdir(path.join(workingRoot, 'skills', 'professional-headshot-suite'))
  await mkdir(path.join(workingRoot, 'skills', 'readme-skill'))
  await mkdir(path.join(workingRoot, 'skills', 'scroll-world'))
  await mkdir(path.join(workingRoot, 'skills', 'explee-skills'))

  const observed = await observePortfolioFolders(workingRoot, [
    'cambium',
    'motionsites-skills',
    'professional-headshot-suite',
    'readme-skill',
    'scroll-world',
  ])

  assert.deepEqual(observed, [
    'cambium',
    'motionsites-skills',
    'professional-headshot-suite',
    'readme-skill',
    'scroll-world',
    'skills',
  ])
  assert.equal(observed.includes('explee-skills'), false)
})

test('header writer accepts catalogued folders resolved from the skills nest', async (t) => {
  const snapshot = validateSnapshot(await readSnapshot())
  const projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'portfolio-skills-headers-'))
  t.after(() => rm(projectsRoot, { recursive: true, force: true }))
  const thoughtseed = snapshot.portfolios[0]
  const thoughtseedRoot = path.join(projectsRoot, 'thoughtseed')
  await mkdir(thoughtseedRoot, { recursive: true })
  const remapped = new Set(['motionsites-skills', 'professional-headshot-suite', 'readme-skill', 'scroll-world'])
  await mkdir(path.join(thoughtseedRoot, 'skills'), { recursive: true })
  for (const name of expectedDirectoryNames(thoughtseed)) {
    if (name === 'skills') continue
    if (remapped.has(name)) {
      await mkdir(path.join(thoughtseedRoot, 'skills', name), { recursive: true })
      continue
    }
    await mkdir(path.join(thoughtseedRoot, name))
  }
  await mkdir(path.join(thoughtseedRoot, 'skills', 'explee-skills'), { recursive: true })

  const written = await writeRootHeaders({ snapshot, projectsRoot, write: true, portfolioIds: ['thoughtseed'] })
  assert.deepEqual(written.plans.map(({ portfolioId }) => portfolioId), ['thoughtseed'])
  assert.equal(existsSync(path.join(thoughtseedRoot, 'PORTFOLIO.md')), true)
})

test('root comparison fails closed on missing or unexpected shallow folders', async () => {
  const snapshot = validateSnapshot(await readSnapshot())
  const thoughtseed = snapshot.portfolios[0]
  const exact = [
    ...thoughtseed.folders.map((entry: { folder: string }) => entry.folder),
    ...thoughtseed.infrastructure,
  ]

  assert.equal(compareObservedDirectories(thoughtseed, exact).ok, true)
  assert.deepEqual(compareObservedDirectories(thoughtseed, exact.slice(1)).missing, ['Airdronauts'])
  assert.deepEqual(compareObservedDirectories(thoughtseed, [...exact, 'unexpected-folder']).unexpected, ['unexpected-folder'])
})

test('root headers use portfolio-specific grammar and relative proposal evidence', async () => {
  const snapshot = validateSnapshot(await readSnapshot())
  const digest = snapshotDigest(snapshot)
  const thoughtseedMarkdown = renderPortfolioMarkdown(snapshot.portfolios[0], digest)
  const noesisMarkdown = renderPortfolioMarkdown(snapshot.portfolios[1], digest)
  const noesisJson = JSON.parse(renderPortfolioJson(snapshot.portfolios[1], digest))

  assert.match(thoughtseedMarkdown, /## Client Branch folders/)
  assert.match(thoughtseedMarkdown, /client:heyzack/)
  assert.match(thoughtseedMarkdown, /thoughtseed-labs.*R2-synced vault copy/)
  assert.match(noesisMarkdown, /# Tryambakam · Noesis Portfolio/)
  assert.match(noesisMarkdown, /## Projects/)
  assert.doesNotMatch(noesisMarkdown, /Client Branch/)
  assert.equal(noesisJson.itemLabel, 'Project')
  assert.equal(noesisJson.folders.length, 30)
  assert.equal(JSON.stringify(noesisJson).includes('/Volumes/'), false)
})

test('root header writer is dry-run by default and writes only two files per portfolio', async (t) => {
  const snapshot = validateSnapshot(await readSnapshot())
  const projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'portfolio-root-map-'))
  t.after(() => rm(projectsRoot, { recursive: true, force: true }))
  const directoryStats = new Map<string, { ino: number }>()
  for (const portfolio of snapshot.portfolios) {
    const portfolioRoot = path.join(projectsRoot, portfolio.portfolioId)
    await mkdir(portfolioRoot, { recursive: true })
    const names = [
      ...portfolio.folders.map((entry: { folder: string }) => entry.folder),
      ...(portfolio.infrastructure ?? []),
      ...(portfolio.archiveContainer ? [portfolio.archiveContainer] : []),
    ]
    for (const name of names) {
      const directory = path.join(portfolioRoot, name)
      await mkdir(directory)
      directoryStats.set(directory, await stat(directory))
    }
  }

  const dryRun = await writeRootHeaders({ snapshot, projectsRoot })
  assert.equal(dryRun.write, false)
  assert.equal(existsSync(path.join(projectsRoot, 'thoughtseed/PORTFOLIO.md')), false)

  const written = await writeRootHeaders({ snapshot, projectsRoot, write: true })
  assert.equal(written.plans.length, 2)
  for (const portfolio of snapshot.portfolios) {
    const portfolioRoot = path.join(projectsRoot, portfolio.portfolioId)
    assert.equal(existsSync(path.join(portfolioRoot, 'PORTFOLIO.md')), true)
    assert.equal(existsSync(path.join(portfolioRoot, 'portfolio-map.v1.json')), true)
  }
  for (const [directory, before] of directoryStats) assert.equal((await stat(directory)).ino, before.ino)
})

test('root header writer refuses directory drift before writing either header', async (t) => {
  const snapshot = validateSnapshot(await readSnapshot())
  const projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'portfolio-root-drift-'))
  t.after(() => rm(projectsRoot, { recursive: true, force: true }))
  for (const portfolio of snapshot.portfolios) {
    const portfolioRoot = path.join(projectsRoot, portfolio.portfolioId)
    await mkdir(portfolioRoot, { recursive: true })
    for (const name of [
      ...portfolio.folders.map((entry: { folder: string }) => entry.folder),
      ...(portfolio.infrastructure ?? []),
      ...(portfolio.archiveContainer ? [portfolio.archiveContainer] : []),
    ]) await mkdir(path.join(portfolioRoot, name))
  }
  await mkdir(path.join(projectsRoot, 'thoughtseed/unexpected-folder'))

  await assert.rejects(() => writeRootHeaders({ snapshot, projectsRoot, write: true }), /folder drift/)
  assert.equal(existsSync(path.join(projectsRoot, 'thoughtseed/PORTFOLIO.md')), false)
  assert.equal(existsSync(path.join(projectsRoot, 'tryambakam-noesis/PORTFOLIO.md')), false)
})

test('root header writer validates every selected portfolio before writing any header', async (t) => {
  const snapshot = validateSnapshot(await readSnapshot())
  const projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'portfolio-root-late-drift-'))
  t.after(() => rm(projectsRoot, { recursive: true, force: true }))
  for (const portfolio of snapshot.portfolios) {
    const portfolioRoot = path.join(projectsRoot, portfolio.portfolioId)
    await mkdir(portfolioRoot, { recursive: true })
    for (const name of [
      ...portfolio.folders.map((entry: { folder: string }) => entry.folder),
      ...(portfolio.infrastructure ?? []),
      ...(portfolio.archiveContainer ? [portfolio.archiveContainer] : []),
    ]) await mkdir(path.join(portfolioRoot, name))
  }
  await mkdir(path.join(projectsRoot, 'tryambakam-noesis/unexpected-folder'))

  await assert.rejects(() => writeRootHeaders({ snapshot, projectsRoot, write: true }), /folder drift/)
  assert.equal(existsSync(path.join(projectsRoot, 'thoughtseed/PORTFOLIO.md')), false)
  assert.equal(existsSync(path.join(projectsRoot, 'tryambakam-noesis/PORTFOLIO.md')), false)
})

test('root header writer can scope a physical apply to one exact portfolio', async (t) => {
  const snapshot = validateSnapshot(await readSnapshot())
  const projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'portfolio-root-scoped-'))
  t.after(() => rm(projectsRoot, { recursive: true, force: true }))
  const thoughtseed = snapshot.portfolios.find((portfolio: { portfolioId: string }) => portfolio.portfolioId === 'thoughtseed')
  const thoughtseedRoot = path.join(projectsRoot, 'thoughtseed')
  await mkdir(thoughtseedRoot, { recursive: true })
  for (const name of [
    ...thoughtseed.folders.map((entry: { folder: string }) => entry.folder),
    ...(thoughtseed.infrastructure ?? []),
  ]) await mkdir(path.join(thoughtseedRoot, name))

  const written = await writeRootHeaders({ snapshot, projectsRoot, write: true, portfolioIds: ['thoughtseed'] })
  assert.deepEqual(written.plans.map(({ portfolioId }) => portfolioId), ['thoughtseed'])
  assert.equal(existsSync(path.join(thoughtseedRoot, 'PORTFOLIO.md')), true)
  assert.equal(existsSync(path.join(projectsRoot, 'tryambakam-noesis/PORTFOLIO.md')), false)
})
