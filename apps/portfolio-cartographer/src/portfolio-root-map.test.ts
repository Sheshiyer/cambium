import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  compareObservedDirectories,
  renderGeneratedModule,
  renderPortfolioJson,
  renderPortfolioMarkdown,
  renderWorkerPolicyModule,
  snapshotDigest,
  validateSnapshot,
  writeRootHeaders,
} from '../scripts/generate-portfolio-root-map.mjs'
import { REVIEWED_ROOT_MAP_DIGEST } from '../../../scripts/portfolio-foundation-pins.mjs'

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

test('snapshot preserves internally consistent shallow portfolio counts and exclusions', async () => {
  const snapshot = await readSnapshot()
  const thoughtseed = snapshot.portfolios.find((portfolio: { portfolioId: string }) => portfolio.portfolioId === 'thoughtseed')
  const noesis = snapshot.portfolios.find((portfolio: { portfolioId: string }) => portfolio.portfolioId === 'tryambakam-noesis')

  assert.equal(thoughtseed.folderCount, thoughtseed.folders.length)
  for (const folder of ['_physical-relocation-archive-2026-08-08', 'openfang', 'scroll-world', 'thoughtseed-labs', 'website', '.codex-data', '.grok-worktrees', '.superpowers', '.superset-worktrees', 'omniroute-governed', 'temperance_engine-phase-01']) assert.ok(thoughtseed.infrastructure.includes(folder))
  assert.equal(thoughtseed.infrastructure.length, 31)
  assert.equal(thoughtseed.infrastructureEvidence.length, 20)
  assert.equal(thoughtseed.infrastructureEvidence.filter((row: { kind: string }) => row.kind === 'linked-worktree').length, 11)
  assert.equal(thoughtseed.infrastructureEvidence.filter((row: { kind: string }) => row.kind === 'retained-artifact').length, 9)
  assert.equal(snapshot.capturedAt, '2026-09-08T10:04:53Z')
  assert.match(thoughtseed.censusObservedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  assert.equal(Object.hasOwn(noesis, 'censusObservedAt'), false)
  assert.equal(noesis.folderCount, noesis.folders.length)
  assert.deepEqual(noesis.infrastructure, ['_portfolio-audit', 'antahkarana-recovery-20260831-pzm8eM'])
  assert.equal(noesis.archiveContainer, '_archive')
  assert.equal(thoughtseed.folders.some((entry: { folder: string }) => thoughtseed.infrastructure.includes(entry.folder)), false)
  assert.equal(thoughtseed.folders.find((entry: { folder: string }) => entry.folder === 'safvr')?.workIds[0], 'branch:safvr-landing-page')
  assert.equal(noesis.folders.some((entry: { folder: string }) => ['.agents', '_archive', ...noesis.infrastructure].includes(entry.folder)), false)
})

test('Tryambakam root reconciliation preserves active projects and distinct archived copies', async () => {
  const snapshot = await readSnapshot()
  const noesis = snapshot.portfolios[1]
  assert.equal(noesis.folderCount, 35)
  const byFolder = new Map(noesis.folders.map((entry: { folder: string }) => [entry.folder, entry]))
  const additions = {
    '10869-space-v1': 'sapling:10869-space',
    'FMRL-reactnative': 'sapling:fmrl',
    'noesismirror-web': 'sapling:tryambakam',
    'sankalpa': 'sapling:sankalpa',
    'somaticcanticles-aleph': 'branch:somatic-canticles',
    'spatial-anubis-noesis': 'sapling:tryambakam',
  }
  for (const [folder, workId] of Object.entries(additions)) {
    assert.deepEqual(byFolder.get(folder), {
      folder, proposedKind: 'project', accountId: null, workIds: [workId], status: 'mapping-proposal',
    })
  }
  for (const absent of ['selemene-gw', 'serpentine-raising', 'twc-shell']) assert.equal(byFolder.has(absent), false)
  assert.deepEqual(noesis.archivedProjects, ['noesismirror-web', 'spatial-anubis-noesis', 'witness-agents-intro-web'])
  assert.equal(noesis.archiveContainer, '_archive')
  assert.equal(noesis.infrastructure.includes('selemene-engine-worktrees'), false)
  assert.equal(noesis.infrastructureWorkMappings?.some(({ folder }) => noesis.infrastructure.includes(folder)) ?? false, false)
  const comparison = compareObservedDirectories(noesis, [
    ...noesis.folders.map(({ folder }) => folder), ...noesis.infrastructure, noesis.archiveContainer,
  ])
  assert.equal(comparison.expected.length, 38)
  assert.equal(comparison.ok, true)
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

test('review holds and linked dual work stay explicit', async () => {
  const snapshot = await readSnapshot()
  const thoughtseed = snapshot.portfolios.find((portfolio: { portfolioId: string }) => portfolio.portfolioId === 'thoughtseed')
  const byFolder = new Map(thoughtseed.folders.map((entry: { folder: string }) => [entry.folder, entry]))

  assert.deepEqual(['klear-karma', 'kristudios', 'panaroma-webapp'].map((folder) => byFolder.get(folder)?.proposedKind), [
    'client-branch', 'client-branch', 'needs-review',
  ])
  assert.deepEqual(byFolder.get('klear-karma')?.workIds, ['branch:klear-karma'])
  assert.deepEqual(byFolder.get('meristem')?.workIds, ['program:meristem-brand-system'])
  assert.equal(byFolder.get('meristem')?.status, 'mapping-proposal')
  assert.deepEqual(byFolder.get('session-atlas')?.workIds, ['program:session-atlas'])
  assert.equal(byFolder.get('session-atlas')?.proposedKind, 'internal-program')
  assert.equal(byFolder.get('session-atlas')?.status, 'mapping-proposal')
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
  assert.equal(noesisJson.folders.length, snapshot.portfolios[1].folderCount)
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


test('safe reconciliations retain infrastructure and existing WorkObject relationships', async () => {
  const snapshot = await readSnapshot()
  const [thoughtseed, noesis] = snapshot.portfolios
  assert.deepEqual(thoughtseed.infrastructureWorkMappings, [
    { folder: 'thoughtseed-labs', workIds: ['program:thoughtseed-vault'] },
  ])
  assert.equal(thoughtseed.folders.some(({ folder }) => folder === 'thoughtseed-labs'), false)
  assert.deepEqual(thoughtseed.folders.find(({ folder }) => folder === 'thoughtseed-organ-console'), {
    folder: 'thoughtseed-organ-console', proposedKind: 'internal-program', accountId: null,
    workIds: ['program:thoughtseed-organ-console'], status: 'mapping-proposal',
  })
  assert.deepEqual(thoughtseed.folders.find(({ folder }) => folder === 'cambium-showcase-ui-rebuild'), {
    folder: 'cambium-showcase-ui-rebuild', displayName: 'Cambium Website', proposedKind: 'sapling', accountId: null,
    workIds: ['sapling:cambium'], status: 'mapping-proposal',
    sourceRefs: ['local:cambium-showcase-ui-rebuild/package.json#name', 'local:.cambium-recovery-20261004/cleanup-receipt.json#activeCheckout'],
  })
  assert.deepEqual(thoughtseed.folders.find(({ folder }) => folder === 'codigo'), {
    folder: 'codigo', displayName: 'Codigo', proposedKind: 'client-branch', accountId: 'codigo-olimpo',
    nestedRepositories: [{ relativePath: 'research/Decodik', displayName: 'Decodik', workIds: ['branch:codigo-olimpo', 'branch:codigo-olimpo-creator-platform'] }],
    workIds: ['branch:codigo-olimpo', 'branch:codigo-olimpo-creator-platform'], status: 'mapping-proposal',
  })
  for (const folder of ['cambium-showcase-ui-rebuild', 'codigo']) {
    assert.equal(thoughtseed.infrastructure.includes(folder), false)
  }
  const relations = {
    '10869x77': 'sapling:tryambakam',
    'Selemene-engine': 'sapling:selemene',
    'somatic-canticles-mobile-app': 'branch:somatic-canticles',
    'tryambakam-space': 'sapling:tryambakam',
    'urania-137': 'sapling:selemene',
    'witness-agents': 'sapling:selemene',
  }
  for (const [folder, workId] of Object.entries(relations)) {
    const entry = noesis.folders.find((candidate) => candidate.folder === folder)
    assert.deepEqual(entry?.workIds, [workId], folder)
    assert.equal(entry?.status, 'mapping-proposal', folder)
  }
  for (const folder of ['selemene-engine']) {
    assert.equal(noesis.folders.some((entry) => entry.folder === folder), false)
  }
})

test('folderCount validation derives from each portfolio instead of frozen counts', async () => {
  const snapshot = await readSnapshot()
  for (const portfolio of snapshot.portfolios) {
    for (const folder of ['synthetic-program', 'another-synthetic-program']) {
      portfolio.folders.push({ folder, proposedKind: 'internal-program', accountId: null, workIds: [], status: 'awaiting-ingestion' })
    }
    portfolio.folderCount = portfolio.folders.length
    assert.equal(validateSnapshot(snapshot), snapshot)
    portfolio.folderCount -= 1
    assert.throws(() => validateSnapshot(snapshot), new RegExp(`${portfolio.portfolioId} folder count drift`))
    portfolio.folderCount += 1
  }
})

test('infrastructure mappings remain optional and round-trip through JSON and generated projections', async () => {
  const snapshot = await readSnapshot()
  const thoughtseed = snapshot.portfolios[0]
  thoughtseed.infrastructureWorkMappings = [{ folder: 'thoughtseed-labs', workIds: ['program:thoughtseed-vault'] }]
  const digest = snapshotDigest(snapshot)
  assert.deepEqual(JSON.parse(renderPortfolioJson(thoughtseed, digest)).infrastructureWorkMappings, thoughtseed.infrastructureWorkMappings)
  assert.match(renderGeneratedModule(snapshot), /"infrastructureWorkMappings"/)
  assert.match(renderPortfolioMarkdown(thoughtseed, digest), /thoughtseed-labs.*program:thoughtseed-vault/)
  delete thoughtseed.infrastructureWorkMappings
  assert.equal(validateSnapshot(snapshot), snapshot)
  assert.equal(Object.hasOwn(thoughtseed, 'infrastructureWorkMappings'), false)
  assert.equal(Object.hasOwn(JSON.parse(renderPortfolioJson(thoughtseed, snapshotDigest(snapshot))), 'infrastructureWorkMappings'), false)
  assert.doesNotMatch(renderPortfolioMarkdown(thoughtseed, snapshotDigest(snapshot)), /Infrastructure WorkObject evidence/)
})

test('infrastructure mapping validation rejects malformed, duplicate, unknown, and overlapping relations', async () => {
  const source = await readSnapshot()
  const invalidMappings = [
    null, {}, [null],
    [{ folder: 'not-infrastructure', workIds: ['program:thoughtseed-vault'] }],
    [{ folder: 'thoughtseed-labs', workIds: ['program:thoughtseed-vault'], note: 'not-a-contract-field' }],
    [{ folder: 'thoughtseed-labs', workIds: ['program:thoughtseed-vault'] }, { folder: 'thoughtseed-labs', workIds: ['program:thoughtseed-vault'] }],
    ...[null, [], [''], ['program:'], ['not-canonical'], [1], ['program:one', 'program:one'], ['program:' + 'a'.repeat(121)], Array.from({ length: 129 }, (_, index) => `program:synthetic-${index}`)].map((workIds) => [{ folder: 'thoughtseed-labs', workIds }]),
  ]
  for (const infrastructureWorkMappings of invalidMappings) {
    const snapshot = structuredClone(source)
    snapshot.portfolios[0].infrastructureWorkMappings = infrastructureWorkMappings
    assert.throws(() => validateSnapshot(snapshot), /infrastructure.*mapping|mapping.*infrastructure/i)
  }
  const overlap = structuredClone(source)
  const folder = overlap.portfolios[0].folders[0].folder
  overlap.portfolios[0].infrastructure.push(folder)
  overlap.portfolios[0].infrastructureWorkMappings = [{ folder, workIds: ['program:thoughtseed-vault'] }]
  assert.throws(() => validateSnapshot(overlap), /overlap/)
})

test('both generated root maps exactly match the source and include the verified Temperance relationship', async () => {
  const expected = renderGeneratedModule(validateSnapshot(await readSnapshot()))
  assert.equal(await readFile(generatedModulePath, 'utf8'), expected)
  assert.equal(await readFile(workerGeneratedModulePath, 'utf8'), expected)
  assert.match(expected, new RegExp(`^export const REVIEWED_PORTFOLIO_ROOT_MAP_DIGEST = "${REVIEWED_ROOT_MAP_DIGEST}"`, 'm'))
  assert.doesNotMatch(expected, new RegExp(`^export const PORTFOLIO_ROOT_MAP_DIGEST = "${REVIEWED_ROOT_MAP_DIGEST}"`, 'm'))
  assert.match(expected, /"folder": "temperance_engine"/)
})

test('verified runtime, company website, and Selemene consumers retain exact WorkObject relationships', async () => {
  const snapshot = await readSnapshot()
  for (const [portfolioId, folder, proposedKind, workId] of [
    ['thoughtseed', 'temperance_engine', 'internal-program', 'program:temperance-hermes'],
    ['thoughtseed', 'thoughtseedlabs-website', 'internal-program', 'program:company-website'],
    ['tryambakam-noesis', 'antahkarana', 'project', 'sapling:selemene'],
    ['tryambakam-noesis', 'noesis-raycast', 'project', 'sapling:selemene'],
  ]) {
    const portfolio = snapshot.portfolios.find((candidate) => candidate.portfolioId === portfolioId)
    assert.deepEqual(portfolio.folders.find((entry) => entry.folder === folder), {
      folder, proposedKind, accountId: null, workIds: [workId], status: 'mapping-proposal',
    })
  }
})

test('the original twelve-directory Thoughtseed census and Cambium Website worktree are fully classified', async () => {
  const thoughtseed = (await readSnapshot()).portfolios[0]
  const census = ['.codex-data', '.grok-worktrees', '.superpowers', '.superset-worktrees',
    'cambium-showcase-ui-rebuild', 'cambium-website-semantics', 'cambium-telegram-showcase', 'codigo', 'omniroute-governed',
    'temperance_engine', 'temperance_engine-phase-01', 'thoughtseed-organ-console', 'thoughtseedlabs-website']
  const classified = new Set([...thoughtseed.folders.map(({ folder }) => folder), ...thoughtseed.infrastructure, ...thoughtseed.historicalFolders.map(({ folder }) => folder)])
  assert.deepEqual(census.filter((folder) => !classified.has(folder)), [])
  assert.equal(thoughtseed.infrastructure.includes('cambium-website-semantics'), false)
  assert.equal(thoughtseed.historicalFolders.some(({ folder }) => folder === 'cambium-website-semantics'), true)
  assert.equal(thoughtseed.folders.some(({ folder }) => folder === 'cambium-website-semantics'), false)
  assert.equal(thoughtseed.folderCount, 71)
  assert.equal(classified.size, 104)
})


test('infrastructure mappings accept bounded IDs and safe hidden folders in either portfolio', async () => {
  const snapshot = await readSnapshot()
  const noesis = snapshot.portfolios[1]
  noesis.infrastructureWorkMappings = [{ folder: '_portfolio-audit', workIds: ['program:example.v1_name', 'sapling:' + 'a'.repeat(120)] }]
  assert.equal(validateSnapshot(snapshot), snapshot)
  assert.match(renderPortfolioMarkdown(noesis, snapshotDigest(snapshot)), /_portfolio-audit.*program:example.v1_name/)
  const thoughtseed = snapshot.portfolios[0]
  thoughtseed.infrastructureWorkMappings = [{ folder: '.codex-data', workIds: ['program:example'] }]
  assert.equal(validateSnapshot(snapshot), snapshot)
  for (const folder of ['.', '..', '../escape', '/absolute', 'a/b']) {
    const invalid = structuredClone(snapshot)
    invalid.portfolios[0].infrastructure.push(folder)
    invalid.portfolios[0].infrastructureWorkMappings = [{ folder, workIds: ['program:example'] }]
    assert.throws(() => validateSnapshot(invalid), /unsafe.*infrastructure/)
  }
})


test('infrastructure mapping limits accept boundary sizes and reject one extra entry', async () => {
  const snapshot = await readSnapshot()
  const thoughtseed = snapshot.portfolios[0]
  const mappings = Array.from({ length: 256 }, (_, index) => ({
    folder: `synthetic-infrastructure-${index}`,
    workIds: Array.from({ length: 128 }, (_, workIndex) => `program:synthetic-${workIndex}`),
  }))
  thoughtseed.infrastructure.push(...mappings.map(({ folder }) => folder))
  thoughtseed.infrastructureWorkMappings = mappings
  assert.equal(validateSnapshot(snapshot), snapshot)
  const extra = { folder: 'synthetic-infrastructure-extra', workIds: ['program:synthetic'] }
  thoughtseed.infrastructure.push(extra.folder)
  thoughtseed.infrastructureWorkMappings.push(extra)
  assert.throws(() => validateSnapshot(snapshot), /invalid infrastructure mappings/)
})


test('infrastructure folder identifiers accept 128 characters and reject 129', async () => {
  const snapshot = await readSnapshot()
  const thoughtseed = snapshot.portfolios[0]
  const folder = 'a'.repeat(128)
  thoughtseed.infrastructure.push(folder)
  thoughtseed.infrastructureWorkMappings = [{ folder, workIds: ['program:synthetic'] }]
  assert.equal(validateSnapshot(snapshot), snapshot)
  thoughtseed.infrastructure.push(folder + 'a')
  thoughtseed.infrastructureWorkMappings = [{ folder: folder + 'a', workIds: ['program:synthetic'] }]
  assert.throws(() => validateSnapshot(snapshot), /unsafe relative infrastructure folder/)
})


test('display names and nested Codigo evidence render without changing folder or WorkObject identity', async () => {
  const snapshot = validateSnapshot(await readSnapshot())
  const thoughtseed = snapshot.portfolios[0]
  const markdown = renderPortfolioMarkdown(thoughtseed, snapshotDigest(snapshot))
  assert.match(markdown, /\| `cambium-showcase-ui-rebuild` \| Cambium Website \| sapling:cambium \| mapping-proposal \|/)
  assert.match(markdown, /\| `codigo\/research\/Decodik` \| Decodik \| client:codigo-olimpo \| branch:codigo-olimpo, branch:codigo-olimpo-creator-platform \|/)
  assert.match(markdown, /Nested repository evidence.*existing parent.*WorkObject/s)
  const json = JSON.parse(renderPortfolioJson(thoughtseed, snapshotDigest(snapshot)))
  assert.equal(json.authority, 'proposal-only')
  assert.deepEqual(json.folders, thoughtseed.folders)
  assert.equal(thoughtseed.folders.some(({ folder }) => /decodik/i.test(folder)), false)
  const expected = thoughtseed.folders.map(({ folder }) => folder).concat(thoughtseed.infrastructure)
  assert.equal(compareObservedDirectories(thoughtseed, expected).ok, true)
})

test('optional display and nested evidence preserve legacy snapshots and reject unsafe or invented identities', async () => {
  const snapshot = await readSnapshot()
  const codigo = snapshot.portfolios[0].folders.find(({ folder }) => folder === 'codigo')
  delete codigo.displayName
  delete codigo.nestedRepositories
  assert.equal(validateSnapshot(snapshot), snapshot)
  for (const displayName of ['', 'a'.repeat(129), 'Name|row', 'Name\nrow', 'Name`code', '<script>', null]) {
    codigo.displayName = displayName
    assert.throws(() => validateSnapshot(snapshot), /display name/)
  }
  delete codigo.displayName
  const valid = { relativePath: 'research/Decodik', displayName: 'Decodik', workIds: ['branch:codigo-olimpo'] }
  for (const relativePath of ['../Decodik', '/research/Decodik', 'research/../Decodik', 'research//Decodik', 'research\\Decodik', '.', 'research/Decodik/']) {
    codigo.nestedRepositories = [{ ...valid, relativePath }]
    assert.throws(() => validateSnapshot(snapshot), /nested repository/)
  }
  for (const nestedRepositories of [null, [valid, valid], [{ ...valid, workIds: ['branch:decodik'] }], [{ ...valid, workIds: [] }], [{ ...valid, workIds: ['branch:codigo-olimpo', 'branch:codigo-olimpo'] }], [{ ...valid, displayName: 'bad|name' }], [{ ...valid, accountId: 'invented' }]]) {
    codigo.nestedRepositories = nestedRepositories
    assert.throws(() => validateSnapshot(snapshot), /nested repository/)
  }
})


test('root JSON and Markdown preserve reviewed modular-node and partner ownership semantics', async () => {
  const snapshot = await readSnapshot()
  const digest = snapshotDigest(snapshot)
  const thoughtseed = snapshot.portfolios[0]
  const noesis = snapshot.portfolios[1]
  const markdown = renderPortfolioMarkdown(thoughtseed, digest)
  assert.match(markdown, /session-atlas.*program:session-atlas.*thoughtseed.*modular-organ-of.*sapling:cambium.*reviewed-local-node/)
  assert.match(markdown, /meristem.*program:meristem-brand-system.*modular-organ-of.*sapling:cambium/)
  assert.match(markdown, /pending canonical registry promotion/)
  assert.match(renderPortfolioMarkdown(noesis, digest), /synchronocities-blog.*program:synchronocities-blog.*partner.*personal-affiliated/)
  const entry = JSON.parse(renderPortfolioJson(noesis, digest)).folders.find((row: { folder: string }) => row.folder === 'synchronocities-blog')
  assert.equal(entry.ownership, 'partner')
  assert.equal(entry.accountId, null)
  assert.match(renderWorkerPolicyModule(snapshot), /personal-affiliated/)
  for (const mutate of [
    (f: any) => { f.accountId = 'invented-client' },
    (f: any) => { f.relationship = 'client' },
    (f: any) => { f.relatedWorkId = 'sapling:other' },
  ]) {
    const changed = structuredClone(snapshot)
    mutate(changed.portfolios[0].folders.find((row: { folder: string }) => row.folder === 'session-atlas'))
    assert.throws(() => validateSnapshot(changed), /ownership metadata/)
  }
})

test('historical Website paths retain provenance without suppressing physical drift', async () => {
  const snapshot = validateSnapshot(await readSnapshot())
  const thoughtseed = snapshot.portfolios[0]
  const exact = thoughtseed.folders.map(({ folder }) => folder).concat(thoughtseed.infrastructure)
  const stale = exact.filter((folder) => folder !== 'cambium-showcase-ui-rebuild').concat('cambium-telegram-showcase')
  assert.deepEqual(compareObservedDirectories(thoughtseed, stale).missing, ['cambium-showcase-ui-rebuild'])
  assert.deepEqual(compareObservedDirectories(thoughtseed, stale).unexpected, ['cambium-telegram-showcase'])
  const json = JSON.parse(renderPortfolioJson(thoughtseed, snapshotDigest(snapshot)))
  assert.deepEqual(json.historicalFolders, thoughtseed.historicalFolders)
  assert.deepEqual(json.infrastructureEvidence, thoughtseed.infrastructureEvidence)
  assert.equal(json.censusObservedAt, thoughtseed.censusObservedAt)
  assert.match(renderPortfolioMarkdown(thoughtseed, snapshotDigest(snapshot)), /cambium-telegram-showcase.*replaced-checkout.*cambium-showcase-ui-rebuild/)
  for (const patch of [
    { folder: '../escape' }, { folder: '.worktrees' }, { folder: 'cambium' },
    { currentFolder: '../escape' }, { currentFolder: 'missing-current' }, { currentFolder: '.worktrees' },
    { disposition: 'ignore-if-missing' }, { sourceRefs: [] }, { sourceRefs: ['local:../private/receipt.json'] },
    { sourceRefs: ['local:/absolute/receipt.json'] }, { sourceRefs: ['https://unreviewed.invalid'] },
    { extra: 'not-a-contract-field' },
  ]) {
    const changed = structuredClone(snapshot)
    Object.assign(changed.portfolios[0].historicalFolders[0], patch)
    assert.throws(() => validateSnapshot(changed), /historical census|portable census/)
  }
  const duplicate = structuredClone(snapshot)
  duplicate.portfolios[0].historicalFolders.push(duplicate.portfolios[0].historicalFolders[0])
  assert.throws(() => validateSnapshot(duplicate), /historical census/)
})

test('physical evidence rows reject wildcard exclusions and unowned infrastructure', async () => {
  const snapshot = await readSnapshot()
  for (const patch of [{ folder: 'not-infrastructure' }, { folder: 'cambium-*' }, { kind: 'ignore-anything' }, { sourceRefs: [] }, { workIds: ['program:invented'] }]) {
    const changed = structuredClone(snapshot)
    Object.assign(changed.portfolios[0].infrastructureEvidence[0], patch)
    assert.throws(() => validateSnapshot(changed), /infrastructure census|portable census/)
  }
  const duplicate = structuredClone(snapshot)
  duplicate.portfolios[0].infrastructureEvidence.push(duplicate.portfolios[0].infrastructureEvidence[0])
  assert.throws(() => validateSnapshot(duplicate), /infrastructure census/)
  for (const censusObservedAt of [null, 'yesterday', '2026-02-30T01:00:00Z']) {
    const changed = structuredClone(snapshot)
    changed.portfolios[0].censusObservedAt = censusObservedAt
    assert.throws(() => validateSnapshot(changed), /census observation time/)
  }
})

test('external references and new identity intake stay held with empty WorkObject IDs', async () => {
  const snapshot = validateSnapshot(await readSnapshot())
  const thoughtseed = snapshot.portfolios[0]
  for (const name of ['autosocial', 'mcp-obsidian-slice-b-20261001', 'factor', 'fieldwork', 'moodboard-ai-agent', 'skills-india-govt']) {
    const entry = thoughtseed.folders.find(({ folder }) => folder === name)
    assert.equal(entry.proposedKind, 'needs-review')
    assert.equal(entry.accountId, null)
    assert.deepEqual(entry.workIds, [])
    for (const patch of [{ workIds: ['sapling:invented'] }, { accountId: 'invented-client' }, { status: 'mapping-proposal' }]) {
      const changed = structuredClone(snapshot)
      Object.assign(changed.portfolios[0].folders.find(({ folder }) => folder === name), patch)
      assert.throws(() => validateSnapshot(changed), /unresolved census reference cannot grant identity/)
    }
  }
  for (const name of ['snow-gloves-ops', 'snow-gloves-wiki']) assert.deepEqual(thoughtseed.folders.find(({ folder }) => folder === name).workIds, ['program:snow-gloves-os'])
})
