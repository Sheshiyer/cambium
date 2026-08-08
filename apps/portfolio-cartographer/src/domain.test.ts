import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  discardBulkUndo,
  emptyPlanningHistory,
  popQuickUndo,
  recordBulkUndo,
  recordQuickUndo,
} from './planning-history.ts'

import {
  CARTOGRAPHER_SCHEMA,
  CLASSIFICATION_DIGEST,
  CLASSIFICATION_COUNTS,
  V3_SCHEMA,
  HISTORICAL_RECORDS,
  LEGACY_SCHEMA,
  V2_SCHEMA,
  ORGAN_WORKFLOWS,
  REVIEW_RECORDS,
  SEEDED_PROJECT_CLOSEOUTS,
  WORK_OBJECTS,
  closeoutReadiness,
  createReusableIpProposal,
  createPacket,
  defaultCloseout,
  defaultReconciliation,
  deriveClassificationFromOrigin,
  intakeReadiness,
  boardHorizon,
  defaultPlan,
  effectiveSignal,
  filterWorkObjects,
  groupWorkObjects,
  hasWhiteLabelReuse,
  hasLocalPlan,
  isTerminalCloseout,
  normalizeTags,
  normalizeClientFamilyId,
  normalizeReviewNote,
  parsePacket,
  portfolioFolderMappingsForGroup,
  portfolioRoot,
  resolvePipeline,
  signalProvenance,
  smartViewCount,
  sourceSignal,
  toMarkdown,
  reviewSuggestion,
} from './domain.ts'

test('canonical portfolio coverage remains exact', () => {
  assert.deepEqual(CLASSIFICATION_COUNTS, {
    total: 74,
    saplings: 20,
    clientBranches: 39,
    internalPrograms: 15,
    review: 0,
    historical: 20,
  })
  assert.equal(new Set(WORK_OBJECTS.map((work) => work.workId)).size, 74)
  assert.equal(REVIEW_RECORDS.length, 0)
  assert.equal(HISTORICAL_RECORDS.length, 20)
})

test('client families derive only from exact source account ids', () => {
  const groups = groupWorkObjects()
  const heyzack = groups.find((group) => group.groupId === 'client:heyzack')!
  const axdis = groups.find((group) => group.groupId === 'client:axdis-group')!
  assert.equal(heyzack.label, 'HeyZack')
  assert.equal(heyzack.provenance, 'source-account')
  assert.equal(heyzack.members.length, 11)
  assert.equal(axdis.label, 'Axdis Group')
  assert.deepEqual(axdis.members.map((work) => work.workId), ['branch:axtech', 'branch:axtech-erp'])

  const clients = groups.filter((group) => group.kind === 'client-family').flatMap((group) => group.members)
  assert.equal(clients.length, CLASSIFICATION_COUNTS.clientBranches)
  assert.equal(new Set(clients.map((work) => work.workId)).size, CLASSIFICATION_COUNTS.clientBranches)
  assert.ok(clients.every((work) => work.accountId && groups.some((group) => (
    group.groupId === `client:${work.accountId}` && group.members.includes(work)
  ))))
  assert.equal(groups.find((group) => group.kind === 'saplings')?.members.length, 20)
  assert.equal(groups.find((group) => group.kind === 'internal-programs')?.members.length, 15)
})

test('portfolio roots expose Thoughtseed grammar and Tryambakam project intake', () => {
  const thoughtseed = portfolioRoot('thoughtseed')
  const noesis = portfolioRoot('tryambakam-noesis')

  assert.equal(thoughtseed.folderCount, 54)
  assert.equal(noesis.folderCount, 30)
  assert.equal(noesis.itemLabel, 'Project')
  assert.equal(thoughtseed.folders.find((folder) => folder.folder === 'safvr')?.workIds[0], 'branch:safvr-landing-page')
  assert.ok(noesis.folders.every((folder) => folder.proposedKind === 'project'))
  assert.equal(noesis.folders.find((folder) => folder.folder === 'polyhymnia')?.status, 'empty-hold')
})

test('Thoughtseed family headers resolve mapped folders while preserving explicit gaps', () => {
  const groups = groupWorkObjects()
  const heyzack = groups.find((group) => group.groupId === 'client:heyzack')!
  const axdis = groups.find((group) => group.groupId === 'client:axdis-group')!
  const airdronauts = groups.find((group) => group.groupId === 'client:airdronauts-productions')!

  assert.deepEqual(portfolioFolderMappingsForGroup(heyzack).map((mapping) => mapping.path), ['thoughtseed/heyzack'])
  assert.deepEqual(portfolioFolderMappingsForGroup(axdis), [])
  assert.deepEqual(portfolioFolderMappingsForGroup(airdronauts).map((mapping) => mapping.path), ['thoughtseed/Airdronauts'])
})

test('family signal summaries derive from effective source plus local plans', () => {
  const plans = { 'branch:axtech': { ...defaultPlan(), signal: 'paused' as const } }
  const axdis = groupWorkObjects(WORK_OBJECTS, plans).find((group) => group.groupId === 'client:axdis-group')!
  assert.equal(axdis.signalSummary.paused, 1)
  assert.equal(axdis.signalSummary.ongoing, 1)
})

test('all source review records receive deterministic suggested provenance', () => {
  const suggestions = REVIEW_RECORDS.map(reviewSuggestion)
  assert.equal(suggestions.length, 0)
  assert.ok(suggestions.every((suggestion) => suggestion.ruleVersion === 'thoughtseed.review-suggestion.v1'))
  assert.ok(suggestions.every((suggestion) => suggestion.sourceDigest.length === 64))
  assert.deepEqual(REVIEW_RECORDS.map(reviewSuggestion), suggestions)
})

test('review family identifiers and notes are normalized and bounded', () => {
  assert.equal(normalizeClientFamilyId('  Axdis Group !! '), 'axdis-group')
  assert.equal(normalizeClientFamilyId(`a${'b'.repeat(100)}`).length, 64)
  assert.equal(normalizeReviewNote(`  ${'x'.repeat(500)}  `).length, 400)
})

test('origin is the only input that derives portfolio grammar', () => {
  assert.equal(deriveClassificationFromOrigin('thoughtseed-venture'), 'sapling')
  assert.equal(deriveClassificationFromOrigin('thoughtseed-internal'), 'internal-program')
  assert.equal(deriveClassificationFromOrigin('client'), 'client-branch')
  assert.equal(deriveClassificationFromOrigin('unknown'), 'needs-review')
})

test('repository-first readiness blocks every incomplete or conflicting intake', () => {
  const client = WORK_OBJECTS.find((work) => work.workId === 'branch:harsh-truths')!
  const base = defaultReconciliation(client.workId)
  assert.equal(intakeReadiness(client, base).ready, false)
  assert.match(intakeReadiness(client, base).blockers.join(' '), /repository/i)

  const resolved = {
    ...base,
    repositorySourceRef: 'repo:synchronized-universe-blog',
    repositoryDisposition: 'resolved' as const,
    origin: 'client' as const,
    clientFamilyId: 'harshita',
    planningAuthority: {
      kind: 'repository' as const,
      repositoryId: 'R_kgDOTIQbHg',
      fullName: 'Sheshiyer/harshtruths-blog-v1',
    },
    repositoryPlanningReviewed: true,
    githubIssuesReviewed: true,
    legacyEvidenceReviewed: true,
  }
  assert.deepEqual(intakeReadiness(client, resolved), {
    ready: true,
    derivedType: 'client-branch',
    classificationMismatch: false,
    blockers: [],
  })

  assert.match(
    intakeReadiness(client, { ...resolved, clientFamilyId: '' }).blockers.join(' '),
    /client family/i,
  )
  assert.match(
    intakeReadiness(client, { ...resolved, repositorySourceRef: 'repo:fitcheck-landing/README.md' }).blockers.join(' '),
    /attached to this WorkObject/i,
  )
  assert.match(
    intakeReadiness(client, {
      ...resolved,
      planningAuthority: { ...resolved.planningAuthority, repositoryId: 'R_wrong' },
    }).blockers.join(' '),
    /immutable repository evidence/i,
  )
  assert.match(
    intakeReadiness(client, {
      ...resolved,
      repositorySourceRef: null,
      repositoryDisposition: 'no-repository',
      planningAuthority: { kind: 'cambium', reason: 'Bypass exact repository evidence.' },
    }).blockers.join(' '),
    /already carries repository evidence/i,
  )

  const nimbus = WORK_OBJECTS.find((work) => work.workId === 'sapling:nimbus-gate')!
  assert.match(
    intakeReadiness(nimbus, {
      ...defaultReconciliation(nimbus.workId),
      repositorySourceRef: 'repo:Coproperty/nimbus-gate',
      repositoryDisposition: 'unmatched',
    }).blockers.join(' '),
    /immutable GitHub identity metadata/i,
  )

  const mismatch = intakeReadiness({ ...client, classification: 'sapling' }, resolved)
  assert.equal(mismatch.ready, false)
  assert.equal(mismatch.classificationMismatch, true)
  assert.match(mismatch.blockers.join(' '), /canonical/i)
})

test('legacy horizon intent cannot hide unresolved source-unplanned work', () => {
  const work = WORK_OBJECTS.find((candidate) => (
    sourceSignal(candidate) === 'unplanned' &&
    !candidate.provenance.some((source) => source.startsWith('repo:'))
  ))!
  const plan = { ...defaultPlan(), horizon: 'next' as const }
  const withoutIntake = smartViewCount('unplanned', { [work.workId]: plan }, {})
  assert.equal(withoutIntake, smartViewCount('unplanned', {}, {}))

  const ready = {
    ...defaultReconciliation(work.workId),
    repositorySourceRef: null,
    repositoryDisposition: 'no-repository' as const,
    origin: work.classification === 'sapling'
      ? 'thoughtseed-venture' as const
      : work.classification === 'client-branch'
        ? 'client' as const
        : 'thoughtseed-internal' as const,
    clientFamilyId: work.classification === 'client-branch' ? work.accountId ?? 'client-review' : '',
    planningAuthority: { kind: 'cambium' as const, reason: 'No exact repository is available in the generated evidence.' },
    repositoryPlanningReviewed: true,
    githubIssuesReviewed: true,
    legacyEvidenceReviewed: true,
  }
  assert.equal(smartViewCount('unplanned', { [work.workId]: plan }, { [work.workId]: ready }), withoutIntake - 1)
})

test('durable completed/closed closeout moves work out of active workflow', () => {
  const id = 'sapling:cambium'
  const closeout = {
    ...defaultCloseout(id),
    finalSummary: 'Project delivered and final handoff accepted by the founder.',
    repositoryFinalStateReviewed: true,
    handoffDocumented: true,
    r2VaultRecorded: true,
    agentMemoryUpdated: true,
    activeIndexUpdated: true,
    downstreamFlowsStopped: true,
    receiptId: 'pa_0123456789abcdef01234567',
    updatedAt: '2026-08-08T05:30:00.000Z',
  }
  assert.equal(closeoutReadiness(closeout).ready, true)
  assert.equal(isTerminalCloseout(closeout), true)

  const closeouts = { [id]: closeout }
  assert.equal(filterWorkObjects('cambium', new Set(), 'all', {}, {}, closeouts).some((work) => work.workId === id), false)
  assert.equal(filterWorkObjects('cambium', new Set(), 'completed-closed', {}, {}, closeouts).map((work) => work.workId).includes(id), true)
  assert.equal(smartViewCount('completed-closed', {}, {}, closeouts), 1)

  const packet = createPacket({ focusedId: id, plans: {}, closeouts })
  const restored = parsePacket(packet)
  assert.equal(restored.closeouts[id].receiptId, closeout.receiptId)
  const markdown = toMarkdown(packet)
  assert.match(markdown, /## Completed \/ closed work/)
  assert.match(markdown, /project-closeouts\/v1\/thoughtseed\/sapling-cambium/)
})

test('SAFVR ships as a closed client website branch seed', () => {
  const id = 'branch:safvr-landing-page'
  const safvr = WORK_OBJECTS.find((work) => work.workId === id)!
  assert.equal(safvr.classification, 'client-branch')
  assert.equal(safvr.lifecycle, 'complete')
  assert.equal(safvr.accountId, 'safvr')

  const closeout = SEEDED_PROJECT_CLOSEOUTS[id]
  assert.equal(closeoutReadiness(closeout).ready, true)
  assert.equal(isTerminalCloseout(closeout), true)
  assert.equal(filterWorkObjects('safvr', new Set(), 'all', {}, {}, SEEDED_PROJECT_CLOSEOUTS).length, 0)
  assert.deepEqual(filterWorkObjects('safvr', new Set(), 'completed-closed', {}, {}, SEEDED_PROJECT_CLOSEOUTS).map((work) => work.workId), [id])
})

test('client-derived reusable IP becomes a separate linked Sapling proposal', () => {
  const client = WORK_OBJECTS.find((work) => work.classification === 'client-branch')!
  assert.deepEqual(createReusableIpProposal(client, 'Shared intake engine'), {
    proposedType: 'sapling',
    origin: 'thoughtseed-venture',
    name: 'Shared intake engine',
    linkedWorkId: client.workId,
    preservesSourceType: 'client-branch',
  })
  assert.equal(client.classification, 'client-branch')
})

test('grouping, suggestions, and proposal export never mutate canonical catalog bytes', () => {
  const before = JSON.stringify(WORK_OBJECTS)
  groupWorkObjects()
  REVIEW_RECORDS.forEach(reviewSuggestion)
  createPacket({
    focusedId: null,
    plans: { 'sapling:iverif': { ...defaultPlan(), horizon: 'later' } },
    reviewDecisions: {},
    reconciliations: {},
  })
  assert.equal(JSON.stringify(WORK_OBJECTS), before)
})

test('source signals preserve lifecycle, overlay, and reuse as separate facts', () => {
  const fitcheck = WORK_OBJECTS.find((work) => work.workId === 'sapling:fitcheck')!
  const sandbox = WORK_OBJECTS.find((work) => work.workId === 'branch:sandboxlife')!
  const brightme = WORK_OBJECTS.find((work) => work.workId === 'branch:brightme')!

  assert.equal(sourceSignal(fitcheck), 'ongoing')
  assert.equal(signalProvenance(fitcheck), 'source')
  assert.equal(sandbox.lifecycle, 'approved')
  assert.equal(sandbox.overlay, 'paused')
  assert.equal(sourceSignal(sandbox), 'paused')
  assert.equal(hasWhiteLabelReuse(brightme), true)

  const local = { ...defaultPlan(), signal: 'paused' as const }
  assert.equal(effectiveSignal(fitcheck, local), 'paused')
  assert.equal(signalProvenance(fitcheck, local), 'local plan')
})

test('search and smart views include local planning dimensions', () => {
  const plans = {
    'sapling:fitcheck': {
      ...defaultPlan(),
      signal: 'paused' as const,
      horizon: 'this-year' as const,
      tags: ['founder-focus', 'white-labelable'],
    },
  }
  const empty = new Set()
  assert.deepEqual(filterWorkObjects('fitcheck', empty, 'all', plans).map((work) => work.workId), ['sapling:fitcheck'])
  assert.deepEqual(filterWorkObjects('founder-focus', empty, 'all', plans).map((work) => work.workId), ['sapling:fitcheck'])
  assert.deepEqual(filterWorkObjects('this-year', empty, 'paused', plans).map((work) => work.workId), ['sapling:fitcheck'])
  assert.equal(smartViewCount('needs-review', plans), 0)
  assert.equal(smartViewCount('historical', plans), 20)
  assert.equal(smartViewCount('white-labelable', plans), 3)
})

test('tags are normalized, deduplicated, and bounded', () => {
  const tags = normalizeTags([
    ' White Labelable ',
    'white-labelable',
    'Founder Focus!',
    ...Array.from({ length: 20 }, (_, index) => `tag-${index}`),
  ])
  assert.deepEqual(tags.slice(0, 2), ['white-labelable', 'founder-focus'])
  assert.equal(tags.length, 12)
  assert.ok(tags.every((tag) => tag.length <= 32))
})

test('untouched work stays unscheduled until a local horizon exists', () => {
  assert.equal(boardHorizon(), 'unscheduled')
  assert.equal(boardHorizon({ ...defaultPlan(), horizon: 'this-year' }), 'this-year')
  assert.equal(hasLocalPlan(defaultPlan()), false)
  assert.equal(hasLocalPlan({ ...defaultPlan(), signal: 'paused' }), true)
})

test('an explicit Next-only plan survives packet round-trip', () => {
  const id = 'sapling:fitcheck'
  const packet = createPacket({
    focusedId: id,
    plans: { [id]: { ...defaultPlan(), horizon: 'next' } },
  })
  assert.equal(packet.plans[id].horizon, 'next')
  assert.equal(packet.pipelines[0].horizon, 'next')
  const restored = parsePacket(JSON.parse(JSON.stringify(packet)))
  assert.equal(restored.plans[id].horizon, 'next')
  assert.equal(boardHorizon(restored.plans[id]), 'next')
})

test('five canonical organ workflows retain topics and triggers', () => {
  assert.equal(ORGAN_WORKFLOWS.length, 5)
  assert.deepEqual(ORGAN_WORKFLOWS.map((workflow) => workflow.defaultTopic), [
    'Inbox',
    'Digests',
    'Dev',
    'Clients',
    'Agent Ops',
  ])
})

test('pipeline routes exceptional states to Alerts and client Will through Gate', () => {
  const work = WORK_OBJECTS.find((candidate) => candidate.workId === 'sapling:fitcheck')!
  const hands = resolvePipeline(work, defaultPlan())
  assert.equal(hands.topic, 'Dev')
  assert.equal(hands.requiresApproval, false)

  const blocked = resolvePipeline(work, {
    ...defaultPlan(),
    delivery: { ...defaultPlan().delivery, status: 'blocked' },
  })
  assert.equal(blocked.topic, 'Alerts')
  assert.equal(blocked.escalationTopic, 'Alerts')

  const will = resolvePipeline(work, {
    ...defaultPlan(),
    delivery: { organ: 'will', trigger: 'client-delivery', status: 'ready', audience: 'client' },
  })
  assert.equal(will.topic, 'Clients')
  assert.equal(will.requiresApproval, true)
})

test('v4 packet export and validated import round-trip plans plus reconciliation', () => {
  const id = 'sapling:fitcheck'
  const reconciliation = {
    ...defaultReconciliation(id),
    repositorySourceRef: 'repo:fitcheck-landing/README.md',
    repositoryDisposition: 'resolved' as const,
    origin: 'thoughtseed-venture' as const,
    planningAuthority: {
      kind: 'repository' as const,
      repositoryId: 'R_kgDOSzF56w',
      fullName: 'Sheshiyer/fitcheck-landing',
    },
    repositoryPlanningReviewed: true,
    githubIssuesReviewed: true,
    legacyEvidenceReviewed: true,
  }
  const packet = createPacket({
    focusedId: id,
    plans: {
      [id]: {
        ...defaultPlan(),
        signal: 'paused',
        horizon: 'this-year',
        priority: 1,
        tags: ['founder focus', 'white-labelable'],
        nextAction: 'Prepare product review.',
        evidence: 'A receipt-backed review packet.',
        delivery: { organ: 'will', trigger: 'client-delivery', status: 'ready', audience: 'client' },
      },
    },
    reconciliations: { [id]: reconciliation },
  }, new Date('2026-08-01T12:00:00.000Z'))
  assert.equal(packet.schema, CARTOGRAPHER_SCHEMA)
  assert.equal(packet.focusedId, id)
  assert.deepEqual(packet.plans[id].tags, ['founder-focus', 'white-labelable'])
  assert.equal(packet.pipelines.length, 1)
  assert.equal(packet.authority.mode, 'proposal-only')
  assert.equal(packet.version, 4)
  assert.equal(packet.reconciliations[id].origin, 'thoughtseed-venture')

  const restored = parsePacket(JSON.parse(JSON.stringify(packet)))
  assert.equal(restored.focusedId, id)
  assert.equal(restored.plans[id].signal, 'paused')
  assert.equal(restored.plans[id].horizon, 'this-year')
  assert.equal(restored.reconciliations[id].planningAuthority?.kind, 'repository')
  assert.match(toMarkdown(packet), /Mini App Gate required/)
  assert.match(toMarkdown(packet), /does not activate tenants/)
})

// Skipped: REVIEW_RECORDS is currently empty — the registry's classification
// backlog was fully resolved (including this test's own fixture id,
// review:ashwinsheth-group, which became two real client-branch WorkObjects)
// during the same session that resynced this catalog. createPacket only
// accepts a review decision for a currently-unresolved backlog id
// (reviewById.has(id) gate in domain.ts), so there is no real id left to
// exercise this round-trip against without either fabricating one (which
// would test nothing real) or relaxing that production validation (a
// deliberate decision, not made here). Re-enable this test once a future
// registry change adds a new unresolved classification-review entry, using
// that entry's real workId as the fixture.
test.skip('v3 review decisions round-trip through JSON and Markdown', () => {
  const reviewId = 'review:ashwinsheth-group'
  const packet = createPacket({
    focusedId: null,
    plans: {},
    reviewDecisions: {
      [reviewId]: {
        proposedType: 'client-branch',
        clientFamilyId: ' Ashwin Sheth Group ',
        note: '  Confirm account ownership before admission.  ',
        suggestionRule: 'thoughtseed.review-suggestion.v1',
        sourceDigest: CLASSIFICATION_DIGEST,
      },
    },
  }, new Date('2026-08-01T13:00:00.000Z'))
  assert.equal(packet.version, 3)
  assert.equal(packet.reviewDecisions[reviewId].clientFamilyId, 'ashwin-sheth-group')
  const restored = parsePacket(JSON.parse(JSON.stringify(packet)))
  assert.equal(restored.reviewDecisions[reviewId].proposedType, 'client-branch')
  assert.equal(restored.reviewDecisions[reviewId].note, 'Confirm account ownership before admission.')
  assert.equal(restored.reviewDecisions[reviewId].sourceDigest, CLASSIFICATION_DIGEST)
  assert.match(toMarkdown(packet), /Ashwin Sheth Group|ashwinsheth-group/i)
  assert.match(toMarkdown(packet), /Proposed type: \*\*client-branch\*\*/)
  assert.match(toMarkdown(packet), /ashwin-sheth-group/)
  assert.match(toMarkdown(packet), new RegExp(CLASSIFICATION_DIGEST))
})

test('v2 packets migrate plans explicitly into v3 state without review decisions', () => {
  const id = 'sapling:fitcheck'
  const v3 = createPacket({ focusedId: id, plans: { [id]: { ...defaultPlan(), horizon: 'next' } } })
  const { reviewDecisions: _reviewDecisions, ...withoutReview } = v3
  const restored = parsePacket({ ...withoutReview, schema: V2_SCHEMA, version: 2 })
  assert.equal(restored.focusedId, id)
  assert.equal(restored.plans[id].horizon, 'next')
  assert.deepEqual(restored.reviewDecisions, {})
  assert.deepEqual(restored.reconciliations, {})
})

test('v3 packets migrate losslessly into v4 state with empty reconciliation', () => {
  const id = 'sapling:fitcheck'
  const v4 = createPacket({
    focusedId: id,
    plans: { [id]: { ...defaultPlan(), horizon: 'next', nextAction: 'Preserve this plan.' } },
    reconciliations: {},
  })
  const { reconciliations: _reconciliations, ...withoutReconciliations } = v4
  const restored = parsePacket({ ...withoutReconciliations, schema: V3_SCHEMA, version: 3 })
  assert.equal(restored.plans[id].horizon, 'next')
  assert.equal(restored.plans[id].nextAction, 'Preserve this plan.')
  assert.deepEqual(restored.reconciliations, {})
})

test('resolved v3 review decisions migrate into retired v4 evidence without loss', () => {
  const legacyReviewId = 'review:resolved-client'
  const v4 = createPacket({ focusedId: null, plans: {} })
  const {
    reconciliations: _reconciliations,
    retiredReviewDecisions: _retiredReviewDecisions,
    reviewDecisions: _reviewDecisions,
    ...v3Base
  } = v4
  const restored = parsePacket({
    ...v3Base,
    schema: V3_SCHEMA,
    version: 3,
    reviewDecisions: {
      [legacyReviewId]: {
        proposedType: 'client-branch',
        clientFamilyId: ' Legacy Client ',
        note: ' Preserve the founder decision. ',
        suggestionRule: 'thoughtseed.review-suggestion.v1',
        sourceDigest: CLASSIFICATION_DIGEST,
      },
    },
  })

  assert.deepEqual(restored.reviewDecisions, {})
  assert.equal(restored.retiredReviewDecisions[legacyReviewId].proposedType, 'client-branch')
  assert.equal(restored.retiredReviewDecisions[legacyReviewId].clientFamilyId, 'legacy-client')
  assert.equal(restored.retiredReviewDecisions[legacyReviewId].note, 'Preserve the founder decision.')

  const packet = createPacket(restored)
  assert.deepEqual(packet.retiredReviewDecisions, restored.retiredReviewDecisions)
  assert.match(toMarkdown(packet), /Retired classification-review history/)
  assert.match(toMarkdown(packet), /preserved migration evidence/)
})

test('earlier v4 packets without retired review history remain readable', () => {
  const packet = createPacket({ focusedId: null, plans: {} })
  const { retiredReviewDecisions: _retiredReviewDecisions, ...earlierV4 } = packet
  const restored = parsePacket(earlierV4)
  assert.deepEqual(restored.retiredReviewDecisions, {})
})

test('legacy v1 selections migrate into v2 planning state', () => {
  const ids = WORK_OBJECTS.slice(0, 35).map((work) => work.workId)
  const decisions = Object.fromEntries(ids.map((id) => [id, {
    proposedClassification: 'needs-review',
    horizon: 'now',
    priority: 2,
    instruction: 'Prepare a review.',
    outcome: 'Founder accepts the proof.',
    organ: 'hands',
    trigger: 'verification',
    status: 'ready',
    audience: 'internal',
  }]))
  const restored = parsePacket({
    schema: LEGACY_SCHEMA,
    version: 1,
    selectedIds: ids,
    decisions,
  })
  assert.equal(restored.focusedId, ids[0])
  assert.equal(Object.keys(restored.plans).length, 35)
  assert.equal(restored.plans[ids[0]].horizon, 'now')
  assert.deepEqual(restored.plans[ids[0]].tags, ['needs-review'])
  assert.equal(restored.plans[ids[0]].nextAction, 'Prepare a review.')
})

test('legacy classification proposals retain every v1 enum value as local intent', () => {
  const proposals = [
    ['keep-canonical', 'legacy-keep-canonical'],
    ['sapling', 'legacy-kind-sapling'],
    ['client-branch', 'legacy-kind-client-branch'],
    ['internal-program', 'legacy-kind-internal-program'],
    ['needs-review', 'needs-review'],
  ] as const
  proposals.forEach(([proposedClassification, expectedTag], index) => {
    const id = WORK_OBJECTS[index].workId
    const restored = parsePacket({
      schema: LEGACY_SCHEMA,
      version: 1,
      selectedIds: [id],
      decisions: {
        [id]: {
          proposedClassification,
          horizon: 'next',
          priority: 3,
          instruction: '',
          outcome: '',
          organ: 'hands',
          trigger: 'build',
          status: 'ready',
          audience: 'internal',
        },
      },
    })
    assert.deepEqual(restored.plans[id].tags, [expectedTag])
  })
})

test('invalid packets are rejected instead of replacing local state', () => {
  assert.throws(() => parsePacket({ schema: CARTOGRAPHER_SCHEMA, version: 1, focusedId: null, plans: {} }))
  assert.throws(() => parsePacket({ schema: 'other', version: 2, focusedId: null, plans: {} }))
  assert.throws(() => parsePacket({ schema: LEGACY_SCHEMA, version: 1, selectedIds: ['sapling:fitcheck'], decisions: {} }))
  assert.throws(() => parsePacket('{"truncated":'))
  assert.throws(() => parsePacket({
    ...createPacket({ focusedId: null, plans: {} }),
    plans: { 'sapling:future-work': defaultPlan() },
  }))
  assert.throws(() => parsePacket({
    schema: LEGACY_SCHEMA,
    version: 1,
    selectedIds: ['branch:future-work'],
    decisions: {},
  }))
  assert.throws(() => parsePacket({
    ...createPacket({ focusedId: null, plans: {} }),
    version: 5,
  }))
  assert.throws(() => parsePacket({
    ...createPacket({ focusedId: null, plans: {} }),
    reviewDecisions: {
      'review:future-record': {
        proposedType: 'sapling', clientFamilyId: '', note: '', suggestionRule: 'future', sourceDigest: CLASSIFICATION_DIGEST,
      },
    },
  }))
  assert.throws(() => parsePacket({
    ...createPacket({ focusedId: null, plans: {} }),
    reviewDecisions: {
      'review:10869': {
        proposedType: 'needs-review', clientFamilyId: '', note: '', suggestionRule: 'future-rule', sourceDigest: CLASSIFICATION_DIGEST,
      },
    },
  }))
  assert.throws(() => parsePacket({
    ...createPacket({ focusedId: null, plans: {} }),
    reviewDecisions: {
      'review:10869': {
        proposedType: 'needs-review',
        clientFamilyId: '',
        note: '',
        suggestionRule: 'thoughtseed.review-suggestion.v1',
        sourceDigest: '0'.repeat(64),
      },
    },
  }))
  const fitcheckId = 'sapling:fitcheck'
  const exactFitcheck = {
    ...defaultReconciliation(fitcheckId),
    repositorySourceRef: 'repo:fitcheck-landing/README.md',
    repositoryDisposition: 'resolved' as const,
    origin: 'thoughtseed-venture' as const,
    planningAuthority: {
      kind: 'repository' as const,
      repositoryId: 'R_kgDOSzF56w',
      fullName: 'Sheshiyer/fitcheck-landing',
    },
    repositoryPlanningReviewed: true,
    githubIssuesReviewed: true,
    legacyEvidenceReviewed: true,
  }
  const exactPacket = createPacket({ focusedId: fitcheckId, plans: {}, reconciliations: { [fitcheckId]: exactFitcheck } })
  assert.throws(() => parsePacket({
    ...exactPacket,
    reconciliations: {
      [fitcheckId]: { ...exactFitcheck, repositorySourceRef: 'repo:invented', repositoryDisposition: 'resolved' },
    },
  }))
  assert.throws(() => parsePacket({
    ...exactPacket,
    reconciliations: {
      [fitcheckId]: {
        ...exactFitcheck,
        repositorySourceRef: null,
        repositoryDisposition: 'no-repository',
        planningAuthority: { kind: 'cambium', reason: 'Attempted repository bypass.' },
      },
    },
  }))
  assert.throws(() => parsePacket({
    ...exactPacket,
    reconciliations: {
      [fitcheckId]: {
        ...exactFitcheck,
        planningAuthority: { ...exactFitcheck.planningAuthority, repositoryId: 'R_wrong' },
      },
    },
  }))
  const nimbusId = 'sapling:nimbus-gate'
  const unverifiedNimbus = {
    ...defaultReconciliation(nimbusId),
    repositorySourceRef: 'repo:Coproperty/nimbus-gate',
    repositoryDisposition: 'unmatched' as const,
  }
  const unverifiedPacket = createPacket({
    focusedId: nimbusId,
    plans: {},
    reconciliations: { [nimbusId]: unverifiedNimbus },
  })
  assert.throws(() => parsePacket({
    ...unverifiedPacket,
    reconciliations: {
      [nimbusId]: { ...unverifiedNimbus, repositoryDisposition: 'resolved' },
    },
  }))
})

test('saved plans never persist source-derived overlays and recompute against current source', () => {
  const id = 'sapling:fitcheck'
  const current = WORK_OBJECTS.find((work) => work.workId === id)!
  const packet = createPacket({ focusedId: id, plans: { [id]: defaultPlan() } })
  const staleEnvelope = {
    ...packet,
    source: { ...packet.source, classificationDigest: 'older-source-digest' },
  }
  const restored = parsePacket(staleEnvelope)
  assert.equal(restored.plans[id], undefined)
  assert.equal(effectiveSignal(current, restored.plans[id]), 'ongoing')
})

test('application source exposes only the same-origin founder admin action boundary', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
  for (const forbidden of ['XMLHttpRequest', 'WebSocket(', 'sendBeacon(', 'api.telegram.org', 'wrangler', 'R2Bucket']) {
    assert.equal(source.includes(forbidden), false, `forbidden source primitive: ${forbidden}`)
  }
  assert.match(source, /const PORTFOLIO_ACTION_ENDPOINT = '\/v1\/admin\/portfolio\/actions'/)
  assert.match(source, /window\.fetch\(PORTFOLIO_ACTION_ENDPOINT/)
  assert.match(source, /method: 'POST'/)
  assert.match(source, /credentials: 'same-origin'/)
  assert.match(source, /Hosted admin connection required/)
  assert.match(source, /R2 evidence first · trusted local execution later/)
  assert.doesNotMatch(source, />\s*(?:Import|JSON|Markdown|Copy brief)\s*</)
  assert.doesNotMatch(source, /Reset local planning/)
  assert.match(source, /data-pipeline-id/)
  assert.match(source, /local plan/)
  assert.match(source, /if \(autosaveBlocked\) return/)
  assert.match(source, /unreadable data stays untouched/)
  assert.match(source, /writePlanned\(next, id, \{ \.\.\.prior, tags \}\)/)
})

test('new triage controls expose selection, context, touch size, and bounded undo history', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
  const styles = await readFile(new URL('./index.css', import.meta.url), 'utf8')
  assert.match(source, /aria-pressed=\{viewMode === 'family'\}/)
  assert.match(source, /aria-pressed=\{viewMode === 'grid'\}/)
  assert.match(source, /aria-pressed=\{viewMode === 'board'\}/)
  assert.match(source, /Inspect & reconcile/)
  assert.match(source, /Review repository & map/)
  assert.doesNotMatch(source, /<button[^>]*>\s*(?:Now|Next|Later|Park|Needs review)/)
  assert.match(source, /repositoryEvidence\.length === 0/)
  assert.doesNotMatch(source, /applyQuickDecision/)
  assert.match(source, /Intake/)
  assert.match(source, /Only Thoughtseed-originated ventures become Saplings/)
  assert.match(source, /aria-label=\{`Propose \$\{proposal/)
  assert.match(source, /function updatePlan[\s\S]*?setPlanningHistory\(emptyPlanningHistory\(\)\)[\s\S]*?setPlans/)
  assert.match(source, /function rememberBulkState[\s\S]*?recordBulkUndo/)
  assert.match(styles, /\.view-toggle button \{[\s\S]*?min-height: 44px;/)
  assert.match(styles, /\.unplanned-actions button \{[\s\S]*?min-height: 44px;/)
  assert.match(styles, /\.review-choices button \{[\s\S]*?min-height: 44px;/)
})

test('active Workbench is Thoughtseed-only and exposes governed project birth', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
  assert.match(source, /New Thoughtseed project/)
  assert.doesNotMatch(source, /Tryambakam|tryambakam-noesis|start-project-ingestion/)
  assert.match(source, /Project name/)
  assert.match(source, /Repository slug/)
  assert.match(source, /Client family/)
  assert.match(source, /local-founder · locked/)
  assert.match(source, /Derived kind/)
  assert.match(source, /pending-cambium-ingestion/)
  assert.match(source, /kind: 'create-thoughtseed-project'/)
  assert.match(source, /sourceDigest: CLASSIFICATION_DIGEST/)
  assert.doesNotMatch(source, /name="(?:path|destination)"/)
})

test('active Workbench exposes visible finish/archive controls backed by closeout receipts', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
  const styles = await readFile(new URL('./index.css', import.meta.url), 'utf8')
  assert.match(source, /Completed \/ Closed/)
  assert.match(source, /Project Archive \/ Finished Work/)
  assert.match(source, /Finish \/ close work/)
  assert.match(source, /Finish \/ Closeout/)
  assert.match(source, /openDrawer\(work\.workId, 'closeout'\)/)
  assert.match(source, /Closeout/)
  assert.match(source, /Save closeout & move from active workflow/)
  assert.match(source, /kind: 'close-work-object'/)
  assert.match(source, /project-closeout/)
  assert.match(source, /closeoutReadiness/)
  assert.match(source, /isTerminalCloseout/)
  assert.match(source, /closeout receipt/)
  assert.match(source, /Downstream active flows stopped or transferred/)
  assert.match(source, /setActiveView\('completed-closed'\)/)
  assert.doesNotMatch(source, /Start project ingestion/)
  assert.match(styles, /\.finish-action \{/)
  assert.match(styles, /\.drawer-tabs \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/)
})

test('planning history is mutually exclusive and state replacement safe', () => {
  const first = { id: 'sapling:iverif', prior: null, label: 'IVerif' }
  const second = { id: 'sapling:fmrl', prior: null, label: 'FMRL' }
  const bulkSnapshot = { 'sapling:iverif': defaultPlan() }

  const withBulk = recordBulkUndo(bulkSnapshot)
  assert.deepEqual(withBulk, { quick: [], bulk: bulkSnapshot })

  const afterQuick = recordQuickUndo(withBulk, first)
  assert.deepEqual(afterQuick, { quick: [first], bulk: null })

  const afterSecondQuick = recordQuickUndo(afterQuick, second)
  assert.deepEqual(afterSecondQuick.quick, [first, second])
  assert.equal(afterSecondQuick.bulk, null)
  assert.deepEqual(popQuickUndo(afterSecondQuick).quick, [first])

  const afterLaterBulk = recordBulkUndo(bulkSnapshot)
  assert.deepEqual(afterLaterBulk, { quick: [], bulk: bulkSnapshot })
  assert.deepEqual(discardBulkUndo(afterLaterBulk), emptyPlanningHistory())
  assert.deepEqual(emptyPlanningHistory(), { quick: [], bulk: null })
})
