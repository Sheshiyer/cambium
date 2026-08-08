import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  compareObservedDirectories,
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

  assert.equal(thoughtseed.folderCount, 54)
  assert.equal(thoughtseed.folders.length, 54)
  assert.deepEqual(thoughtseed.infrastructure, ['_home-cleanup-2026-08-08', 'cambium-authoritative', 'openfang', 'thoughtseed-labs', 'website'])
  assert.equal(noesis.folderCount, 30)
  assert.equal(noesis.folders.length, 30)
  assert.deepEqual(noesis.infrastructure, ['selemene-engine-worktrees'])
  assert.equal(noesis.archiveContainer, '_archive')
  assert.equal(thoughtseed.folders.some((entry: { folder: string }) => ['_home-cleanup-2026-08-08', 'cambium-authoritative', 'openfang', 'thoughtseed-labs', 'website'].includes(entry.folder)), false)
  assert.equal(thoughtseed.folders.find((entry: { folder: string }) => entry.folder === 'safvr')?.workIds[0], 'branch:safvr-landing-page')
  assert.equal(noesis.folders.some((entry: { folder: string }) => ['.agents', '_archive', 'selemene-engine-worktrees'].includes(entry.folder)), false)
})

test('snapshot uses only relative unique folders and bounded proposal kinds', async () => {
  const snapshot = await readSnapshot()
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

test('ambiguous Thoughtseed origins remain review proposals and linked dual work stays explicit', async () => {
  const snapshot = await readSnapshot()
  const thoughtseed = snapshot.portfolios.find((portfolio: { portfolioId: string }) => portfolio.portfolioId === 'thoughtseed')
  const byFolder = new Map(thoughtseed.folders.map((entry: { folder: string }) => [entry.folder, entry]))

  assert.deepEqual(['klear-karma', 'kristudios', 'panaroma-webapp'].map((folder) => byFolder.get(folder)?.proposedKind), [
    'needs-review', 'needs-review', 'needs-review',
  ])
  assert.deepEqual(byFolder.get('parkarea')?.workIds, ['branch:parkarea', 'sapling:parkarea'])
  assert.deepEqual(byFolder.get('tirak')?.workIds, ['branch:tirak', 'sapling:tirak'])
})

test('typed browser projection is generated from the reviewed snapshot', () => {
  assert.equal(existsSync(generatedModulePath), true)
  assert.equal(existsSync(workerGeneratedModulePath), true)
})

test('Worker policy projection binds the reviewed digest and exact shallow Tryambakam paths', async () => {
  const snapshot = validateSnapshot(await readSnapshot())
  const generated = renderWorkerPolicyModule(snapshot)
  assert.match(generated, new RegExp(snapshotDigest(snapshot)))
  assert.match(generated, /"astrolens": \{\n    "path": "tryambakam-noesis\/astrolens"/)
  assert.doesNotMatch(generated, /tryambakam-noesis\/astrolens\//)
  assert.doesNotMatch(generated, /Client Branch/)
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
