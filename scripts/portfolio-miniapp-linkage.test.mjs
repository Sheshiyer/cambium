import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const subjectUrl = new URL('./portfolio-miniapp-linkage.mjs', import.meta.url)
const loadSubject = () => import(subjectUrl)

const catalog = Object.freeze({
  schema: 'cambium.portfolio-catalog.v1',
  version: 1,
  status: 'proposed-read-only',
  readOnly: true,
  classificationDigest: 'classification-local',
  catalogDigest: 'sha256:local',
  summary: Object.freeze({
    total: 3,
    saplings: 1,
    clientBranches: 1,
    internalPrograms: 1,
  }),
  records: Object.freeze([
    Object.freeze({ workId: 'program:internal', kind: 'program', classification: 'internal-program' }),
    Object.freeze({ workId: 'branch:klear-karma', kind: 'client-branch', classification: 'client-branch' }),
    Object.freeze({ workId: 'sapling:fitcheck', kind: 'sapling', classification: 'sapling' }),
  ]),
  operationalGaps: Object.freeze([
    Object.freeze({
      workId: 'branch:klear-karma',
      gapKind: 'mission-data-needed',
      missingFields: Object.freeze(['owner', 'nextAction', 'goalGraphRef']),
    }),
  ]),
})

const branchStories = Object.freeze([
  Object.freeze({ productId: 'fitcheck', canonicalWorkId: 'sapling:fitcheck' }),
  Object.freeze({ productId: 'client-delivery' }),
])

test('work-object comparison sorts exact drift and exposes kind-set changes', async () => {
  const { compareWorkObjectSets } = await loadSubject()

  assert.deepEqual(compareWorkObjectSets(
    ['sapling:klear-karma', 'sapling:parkarea', 'branch:parkarea'],
    ['branch:klear-karma', 'branch:parkarea', 'branch:safvr-landing-page'],
  ), {
    onlyLeft: ['sapling:klear-karma', 'sapling:parkarea'],
    onlyRight: ['branch:klear-karma', 'branch:safvr-landing-page'],
    kindSetDifferences: [
      { slug: 'klear-karma', leftKinds: ['sapling'], rightKinds: ['branch'] },
      { slug: 'parkarea', leftKinds: ['branch', 'sapling'], rightKinds: ['branch'] },
      { slug: 'safvr-landing-page', leftKinds: [], rightKinds: ['branch'] },
    ],
  })
})

test('report keeps catalog visibility separate from explicit Mission packets', async () => {
  const { buildPortfolioMiniappLinkageReport } = await loadSubject()

  const report = buildPortfolioMiniappLinkageReport({
    catalog,
    branchStories,
    mirrors: { catalogData: true, catalogModule: true, rootMap: true },
    pins: {
      reviewedRootMapDigest: 'root-current',
      currentRootMapDigest: 'root-current',
      reviewedCatalogDigest: 'sha256:local',
      currentCatalogDigest: 'sha256:local',
      reviewedClassificationDigest: 'classification-local',
      currentClassificationDigest: 'classification-local',
    },
  })

  assert.equal(report.schema, 'cambium.portfolio-miniapp-linkage.v1')
  assert.equal(report.catalogVisibility.recordCount, 3)
  assert.deepEqual(report.missionAdmission.canonicalPacketWorkIds, ['sapling:fitcheck'])
  assert.deepEqual(report.missionAdmission.templatePacketIds, ['client-delivery'])
  assert.deepEqual(report.missionAdmission.catalogWorkIdsWithoutPackets, [
    'branch:klear-karma',
    'program:internal',
  ])
  assert.equal(report.missionAdmission.policy, 'explicit-packet-and-goal-graph-admission-only')
  assert.equal(report.operatingCoverage.totalWorkObjects, 3)
  assert.equal(report.operatingCoverage.packetBackedStoryArcs, 1)
  assert.equal(report.operatingCoverage.explicitStoryArcGaps, 2)
  assert.equal(report.operatingCoverage.rows.find((row) => row.workId === 'branch:klear-karma').miniApp.mission, 'explicit-gap')
  assert.deepEqual(report.operatingCoverage.rows.find((row) => row.workId === 'branch:klear-karma').missionData, {
    state: 'mission-data-needed',
    missingFields: ['goalGraphRef', 'nextAction', 'owner'],
  })
  assert.deepEqual(report.operatingCoverage.rows.find((row) => row.workId === 'sapling:fitcheck').missionData, {
    state: 'catalog-fields-present',
    missingFields: [],
  })
  assert.equal(report.operatingCoverage.missionDataGaps, 1)
  assert.equal(report.status, 'aligned')
})

test('working-root assimilation exposes exact mappings and explicit held folders without inventing admission', async () => {
  const { buildPortfolioMiniappLinkageReport } = await loadSubject()
  const rootMap = {
    schema: 'thoughtseed.portfolio-root-map.v1',
    portfolios: [{
      portfolioId: 'thoughtseed',
      folderCount: 3,
      infrastructure: ['scroll-world'],
      folders: [
        { folder: 'fitcheck-landing', proposedKind: 'sapling', status: 'mapping-proposal', workIds: ['sapling:fitcheck'] },
        { folder: 'klear-karma', proposedKind: 'client-branch', status: 'mapping-proposal', workIds: ['branch:klear-karma'] },
        { folder: 'session-atlas', proposedKind: 'internal-program', status: 'awaiting-ingestion', workIds: [] },
      ],
    }],
  }
  const report = buildPortfolioMiniappLinkageReport({
    catalog,
    branchStories,
    rootMap,
    observedFolders: ['fitcheck-landing', 'klear-karma', 'scroll-world', 'session-atlas'],
    organPlan: { workflows: [{ organ: 'hands' }, { organ: 'cortex' }], activeDeliveries: [] },
    mirrors: { catalogData: true, catalogModule: true, rootMap: true },
    pins: {
      reviewedRootMapDigest: 'root-current',
      currentRootMapDigest: 'root-current',
      reviewedCatalogDigest: 'sha256:local',
      currentCatalogDigest: 'sha256:local',
      reviewedClassificationDigest: 'classification-local',
      currentClassificationDigest: 'classification-local',
    },
  })

  assert.equal(report.status, 'aligned')
  assert.equal(report.filesystemAssimilation.observedCount, 4)
  assert.deepEqual(report.filesystemAssimilation.missingFolders, [])
  assert.deepEqual(report.filesystemAssimilation.unexpectedFolders, [])
  assert.deepEqual(report.filesystemAssimilation.unresolvedFolders.map((entry) => entry.folder), ['session-atlas'])
  assert.deepEqual(report.operatingCoverage.organWorkflowIds, ['cortex', 'hands'])
  assert.equal(report.operatingCoverage.rows.find((row) => row.workId === 'program:internal').filesystem.state, 'explicit-folderless-gap')
})

test('working-root drift and unknown mapped WorkObjects block a candidate', async () => {
  const { buildPortfolioMiniappLinkageReport } = await loadSubject()
  const report = buildPortfolioMiniappLinkageReport({
    catalog,
    branchStories,
    rootMap: {
      schema: 'thoughtseed.portfolio-root-map.v1',
      portfolios: [{
        portfolioId: 'thoughtseed',
        folderCount: 1,
        infrastructure: [],
        folders: [{ folder: 'unknown', proposedKind: 'sapling', status: 'mapping-proposal', workIds: ['sapling:unknown'] }],
      }],
    },
    observedFolders: ['extra'],
    mirrors: { catalogData: true, catalogModule: true, rootMap: true },
    pins: {
      reviewedRootMapDigest: 'root-current',
      currentRootMapDigest: 'root-current',
      reviewedCatalogDigest: 'sha256:local',
      currentCatalogDigest: 'sha256:local',
      reviewedClassificationDigest: 'classification-local',
      currentClassificationDigest: 'classification-local',
    },
  })

  assert.deepEqual(report.releaseBlockers, [
    'unknown-root-map-work-id:sapling:unknown',
    'missing-working-folder:unknown',
    'unmapped-working-folder:extra',
  ])
  assert.equal(report.status, 'blocked')
})

test('report preserves dated live and vault drift without leaking source paths', async () => {
  const { buildPortfolioMiniappLinkageReport } = await loadSubject()
  const vaultRegistry = Object.freeze({
    schema: 'thoughtseed.work-object-registry.v1',
    generatedAt: '2026-08-07T00:00:00Z',
    classificationDigest: 'classification-vault',
    workObjects: Object.freeze([
      Object.freeze({ workId: 'sapling:fitcheck' }),
      Object.freeze({ workId: 'sapling:klear-karma' }),
    ]),
  })
  const liveSnapshot = Object.freeze({
    schema: 'cambium.portfolio-workbench-observation.v1',
    observedAt: '2026-08-12T06:00:00Z',
    workIds: Object.freeze([
      'sapling:fitcheck',
      'sapling:klear-karma',
      'program:internal',
    ]),
  })
  const before = JSON.stringify({ catalog, branchStories, vaultRegistry, liveSnapshot })

  const report = buildPortfolioMiniappLinkageReport({
    catalog,
    branchStories,
    mirrors: { catalogData: true, catalogModule: true, rootMap: true },
    pins: {
      reviewedRootMapDigest: 'root-current',
      currentRootMapDigest: 'root-current',
      reviewedCatalogDigest: 'sha256:local',
      currentCatalogDigest: 'sha256:local',
      reviewedClassificationDigest: 'classification-local',
      currentClassificationDigest: 'classification-local',
    },
    vaultRegistry,
    liveSnapshot,
    sourceLabels: {
      vault: '/Volumes/private/vault/00-meta/work-object-registry.v1.json',
      live: '/Users/private/live.json',
    },
  })

  assert.equal(report.status, 'drift-observed')
  assert.equal(report.observations.vault.recordCount, 2)
  assert.deepEqual(report.observations.vault.diff.onlyLeft, ['sapling:klear-karma'])
  assert.deepEqual(report.observations.vault.diff.onlyRight, [
    'branch:klear-karma',
    'program:internal',
  ])
  assert.equal(report.observations.live.recordCount, 3)
  assert.deepEqual(report.observations.live.diff.onlyLeft, ['sapling:klear-karma'])
  assert.deepEqual(report.observations.live.diff.onlyRight, ['branch:klear-karma'])
  assert.doesNotMatch(JSON.stringify(report), /\/Volumes\/|\/Users\//)
  assert.equal(JSON.stringify({ catalog, branchStories, vaultRegistry, liveSnapshot }), before)
})

test('missing canonical packet identity and mirror or pin drift block release without mutating sources', async () => {
  const { buildPortfolioMiniappLinkageReport } = await loadSubject()
  const report = buildPortfolioMiniappLinkageReport({
    catalog,
    branchStories: [
      ...branchStories,
      { productId: 'unknown', canonicalWorkId: 'sapling:missing' },
    ],
    mirrors: { catalogData: false, catalogModule: true, rootMap: true },
    pins: {
      reviewedRootMapDigest: 'root-reviewed',
      currentRootMapDigest: 'root-current',
      reviewedCatalogDigest: 'sha256:reviewed',
      currentCatalogDigest: 'sha256:local',
      reviewedClassificationDigest: 'classification-local',
      currentClassificationDigest: 'classification-local',
    },
  })

  assert.equal(report.status, 'blocked')
  assert.deepEqual(report.missionAdmission.packetWorkIdsMissingFromCatalog, ['sapling:missing'])
  assert.deepEqual(report.releaseBlockers, [
    'catalog-data-mirror-drift',
    'portfolio-catalog-pin-drift',
    'portfolio-root-map-pin-drift',
    'unknown-packet-work-id:sapling:missing',
  ])
  assert.deepEqual(report.mutationsPerformed, [])
})

test('strict repository audit requires an observed working-root census', () => {
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    'scripts/audit-portfolio-miniapp-linkage.ts',
    '--strict',
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /strict_projects_root_required/)
})

test('repository audit composes real catalog, packet, mirror, pin, live, and offline-vault evidence', async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'cambium-linkage-'))
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }))
  const livePath = join(fixtureRoot, 'live.json')
  const vaultPath = join(fixtureRoot, 'vault.json')
  await writeFile(livePath, JSON.stringify({
    schema: 'cambium.portfolio-workbench-observation.v1',
    observedAt: '2026-08-12T06:00:00Z',
    workIds: ['sapling:fitcheck', 'sapling:live-only'],
  }))
  await writeFile(vaultPath, JSON.stringify({
    schema: 'thoughtseed.work-object-registry.v1',
    generatedAt: '2026-08-07T00:00:00Z',
    workObjects: [{ workId: 'sapling:fitcheck' }, { workId: 'sapling:vault-only' }],
  }))

  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    'scripts/audit-portfolio-miniapp-linkage.ts',
    '--live-snapshot', livePath,
    '--vault-registry', vaultPath,
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.status, 'drift-observed')
  assert.equal(report.catalogVisibility.recordCount, 72)
  assert.deepEqual(report.missionAdmission.canonicalPacketWorkIds, [
    'program:snow-gloves-os',
    'sapling:dlock',
    'sapling:fitcheck',
    'sapling:iverif',
    'sapling:vantyx',
  ])
  assert.deepEqual(report.missionAdmission.templatePacketIds, [])
  assert.equal(report.observations.live.recordCount, 2)
  assert.equal(report.observations.vault.recordCount, 2)
  assert.deepEqual(report.releaseBlockers, [])
  assert.doesNotMatch(result.stdout, /\/Volumes\/|\/Users\//)
  assert.deepEqual(report.mutationsPerformed, [])
})

test('repository audit writes one deterministic browser-safe linkage manifest', async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'cambium-linkage-manifest-'))
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }))
  const manifestPath = join(fixtureRoot, 'portfolio-linkage.generated.ts')

  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    'scripts/audit-portfolio-miniapp-linkage.ts',
    '--write-app-manifest', manifestPath,
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr)
  const manifestSource = await import('node:fs/promises').then(({ readFile }) => readFile(manifestPath, 'utf8')).catch(() => '')
  assert.match(manifestSource, /Generated by scripts\/audit-portfolio-miniapp-linkage\.ts/)
  assert.match(manifestSource, /"totalWorkObjects": 72/)
  assert.match(manifestSource, /"packetBackedStoryArcs": 5/)
  assert.match(manifestSource, /"missionDataGaps": 48/)
  assert.match(manifestSource, /"workId": "program:temperance-hermes"/)
  assert.match(manifestSource, /"telegramTransport": "hermes-only"/)
  assert.doesNotMatch(manifestSource, /\/Volumes\/|\/Users\//)
})
