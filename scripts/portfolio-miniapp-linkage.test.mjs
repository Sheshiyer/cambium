import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { PORTFOLIO_DISPLAY_PROPOSAL, PORTFOLIO_DISPLAY_PROPOSAL_PROGRAMS } from '../shared/portfolio-catalog-display-proposal.ts'
import { expectedDirectoryNames } from '../apps/portfolio-cartographer/scripts/generate-portfolio-root-map.mjs'

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

function linkageInput(rootMap) {
  return {
    catalog, branchStories, rootMap,
    mirrors: { catalogData: true, catalogModule: true, rootMap: true },
    pins: {
      reviewedRootMapDigest: 'root-reviewed', currentRootMapDigest: 'root-proposal',
      reviewedCatalogDigest: 'sha256:local', currentCatalogDigest: 'sha256:local',
      reviewedClassificationDigest: 'classification-local', currentClassificationDigest: 'classification-local',
    },
  }
}

test('only the exact frozen display selection is held without action admission', async () => {
  const { buildPortfolioMiniappLinkageReport } = await loadSubject()
  const workIds = ['branch:codigo-olimpo', 'branch:codigo-olimpo-creator-platform', 'program:thoughtseed-organ-console']
  const rootMap = {
    schema: 'thoughtseed.portfolio-root-map.v1',
    portfolios: [{ portfolioId: 'thoughtseed', folderCount: 1, infrastructure: [],
      folders: [{ folder: 'display-proposals', proposedKind: 'needs-review', status: 'mapping-proposal', workIds }] }],
  }
  const report = buildPortfolioMiniappLinkageReport(linkageInput(rootMap))
  assert.equal(report.status, 'aligned')
  assert.deepEqual(report.filesystemAssimilation.heldProposalIdentities.map((row) => row.workId), workIds)
  assert.deepEqual(report.catalogVisibility.workIds, ['branch:klear-karma', 'program:internal', 'sapling:fitcheck'])
  assert.equal(report.rootMapAuthority.proposalMatchesApprovedExecution, false)
  assert.deepEqual(report.missionAdmission.canonicalPacketWorkIds, ['sapling:fitcheck'])
  for (const workId of ['branch:codigo-olimpo-spoof', 'program:thoughtseed-organ-console-spoof', 'program:unknown']) {
    const changed = structuredClone(rootMap)
    changed.portfolios[0].folders[0].workIds.push(workId)
    assert.deepEqual(buildPortfolioMiniappLinkageReport(linkageInput(changed)).releaseBlockers, [`unknown-root-map-work-id:${workId}`])
    changed.portfolios[0].folders[0].identityStatus = 'reviewed-local-node'
    assert.throws(() => buildPortfolioMiniappLinkageReport(linkageInput(changed)), /held_identity_unreviewed/)
  }
})

test('caller display lists and schema or digest overrides cannot extend the trusted source', async () => {
  const { buildPortfolioMiniappLinkageReport } = await loadSubject()
  for (const override of [
    { displayProposalWorkIds: ['program:unreviewed'] },
    { displayProposal: { ...PORTFOLIO_DISPLAY_PROPOSAL } },
    { displayProposal: { ...PORTFOLIO_DISPLAY_PROPOSAL, schema: 'unreviewed' } },
    { displayProposal: { ...PORTFOLIO_DISPLAY_PROPOSAL, selectionDigest: 'sha256:unreviewed' } },
    { displayCatalog: { workIds: ['program:unreviewed'] } },
    { displaySelectionDigest: PORTFOLIO_DISPLAY_PROPOSAL.selectionDigest },
  ]) assert.throws(() => buildPortfolioMiniappLinkageReport({ ...linkageInput(), ...override }), /display_proposal_override_forbidden/)
  const originalId = PORTFOLIO_DISPLAY_PROPOSAL_PROGRAMS[0][0]
  try {
    PORTFOLIO_DISPLAY_PROPOSAL_PROGRAMS[0][0] = 'branch:unreviewed'
    assert.throws(() => buildPortfolioMiniappLinkageReport(linkageInput()), /reviewed_display_proposal_source_drift/)
  } finally {
    PORTFOLIO_DISPLAY_PROPOSAL_PROGRAMS[0][0] = originalId
  }
  assert.equal(buildPortfolioMiniappLinkageReport(linkageInput()).status, 'aligned')
})

test('unresolved reference rows reject WorkObject and account promotion', async () => {
  const { buildPortfolioMiniappLinkageReport } = await loadSubject()
  const rootMap = {
    schema: 'thoughtseed.portfolio-root-map.v1',
    portfolios: [{ portfolioId: 'thoughtseed', folderCount: 1, infrastructure: [], folders: [{
      folder: 'external-reference', proposedKind: 'needs-review', workIds: [], accountId: null,
      status: 'reference-unresolved', referenceKind: 'external-adapter', sourceRefs: ['repo:example/reference'],
    }] }],
  }
  const report = buildPortfolioMiniappLinkageReport(linkageInput(rootMap))
  assert.equal(report.filesystemAssimilation.unresolvedFolders[0].admission, 'none')
  assert.equal(report.filesystemAssimilation.unresolvedFolders[0].executionAuthority, 'none')
  for (const patch of [{ workIds: ['program:internal'] }, { accountId: 'invented-account' }, { identityStatus: 'reviewed-local-node' }, { status: 'mapping-proposal' }]) {
    const changed = structuredClone(rootMap)
    Object.assign(changed.portfolios[0].folders[0], patch)
    assert.throws(() => buildPortfolioMiniappLinkageReport(linkageInput(changed)), /unresolved census reference cannot grant identity/)
  }
})

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

test('reviewed local proposal identities render without becoming catalog or action authority', async () => {
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
        folders: [{
          folder: 'session-atlas',
          proposedKind: 'internal-program',
          status: 'mapping-proposal',
          identityStatus: 'reviewed-local-node',
          workIds: ['program:session-atlas'],
          accountId: null,
          ownership: 'thoughtseed',
          relationship: 'modular-organ-of',
          relatedWorkId: 'sapling:cambium',
        }],
      }],
    },
    observedFolders: ['session-atlas'],
    mirrors: { catalogData: true, catalogModule: true, rootMap: true },
    pins: {
      reviewedRootMapDigest: 'root-reviewed',
      currentRootMapDigest: 'root-proposal',
      reviewedCatalogDigest: 'sha256:local',
      currentCatalogDigest: 'sha256:local',
      reviewedClassificationDigest: 'classification-local',
      currentClassificationDigest: 'classification-local',
    },
  })

  assert.equal(report.status, 'aligned')
  assert.deepEqual(report.filesystemAssimilation.heldProposalIdentities, [{
    workId: 'program:session-atlas',
    folders: ['session-atlas'],
    admission: 'proposal-only-not-catalog-admitted',
    executionAuthority: 'none',
  }])
  assert.deepEqual(report.filesystemAssimilation.unclassifiedMappedWorkIds, [])
  assert.equal(report.catalogVisibility.workIds.includes('program:session-atlas'), false)
  assert.deepEqual(report.rootMapAuthority, {
    approvedExecutionDigest: 'root-reviewed',
    currentProposalDigest: 'root-proposal',
    proposalMatchesApprovedExecution: false,
    proposalAuthority: 'render-only-census-evidence',
    actionAuthority: 'approved-execution-foundation-only',
  })
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

test('missing canonical packet identity and catalog drift block release while proposal drift stays visible', async () => {
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
    'unknown-packet-work-id:sapling:missing',
  ])
  assert.equal(report.rootMapAuthority.proposalMatchesApprovedExecution, false)
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

test('strict repository census passes exact current folders and rejects extras and missing destinations', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'cambium-current-census-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const snapshot = JSON.parse(await readFile(new URL('../docs/project-management/portfolio-roots.v1.json', import.meta.url), 'utf8'))
  const thoughtseed = snapshot.portfolios[0]
  await Promise.all(expectedDirectoryNames(thoughtseed).map((folder) => mkdir(join(root, folder))))
  const audit = () => spawnSync(process.execPath, ['scripts/audit-portfolio-miniapp-linkage.ts', '--strict', '--projects-root', root], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
  })
  const exact = audit()
  assert.equal(exact.status, 0, exact.stderr)
  const report = JSON.parse(exact.stdout)
  assert.equal(report.status, 'aligned')
  assert.equal(report.catalogVisibility.recordCount, 72)
  assert.equal(report.filesystemAssimilation.infrastructureEvidence.length, 20)
  assert.deepEqual(report.filesystemAssimilation.unresolvedFolders.filter((row) => row.referenceKind === 'identity-intake').map((row) => row.folder), ['factor', 'fieldwork', 'moodboard-ai-agent', 'skills-india-govt'])
  await mkdir(join(root, 'unmapped-new-folder'))
  const extra = audit()
  assert.equal(extra.status, 1)
  assert.ok(JSON.parse(extra.stdout).releaseBlockers.includes('unmapped-working-folder:unmapped-new-folder'))
  await rm(join(root, 'unmapped-new-folder'), { recursive: true })
  await rm(join(root, 'cambium-showcase-ui-rebuild'), { recursive: true })
  await mkdir(join(root, 'cambium-telegram-showcase'))
  const stale = audit()
  assert.equal(stale.status, 1)
  assert.deepEqual(JSON.parse(stale.stdout).releaseBlockers, ['missing-working-folder:cambium-showcase-ui-rebuild', 'unmapped-working-folder:cambium-telegram-showcase'])
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
  assert.deepEqual(report.filesystemAssimilation.heldProposalIdentities, ['branch:codigo-olimpo', 'branch:codigo-olimpo-creator-platform'].map((workId) => ({
    workId, folders: ['codigo'], admission: 'proposal-only-not-catalog-admitted', executionAuthority: 'none',
  })).concat([{
    workId: 'program:session-atlas',
    folders: ['session-atlas'],
    admission: 'proposal-only-not-catalog-admitted',
    executionAuthority: 'none',
  }, {
    workId: 'program:thoughtseed-organ-console',
    folders: ['thoughtseed-organ-console'],
    admission: 'proposal-only-not-catalog-admitted',
    executionAuthority: 'none',
  }]))
  for (const workId of report.filesystemAssimilation.reviewedDisplayProposal.workIds) {
    assert.equal(report.catalogVisibility.workIds.includes(workId), false)
    assert.equal(report.missionAdmission.canonicalPacketWorkIds.includes(workId), false)
    assert.equal(report.operatingCoverage.rows.some((row) => row.workId === workId), false)
  }
  assert.equal(report.filesystemAssimilation.reviewedDisplayProposal.actionAuthority, 'none')
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
