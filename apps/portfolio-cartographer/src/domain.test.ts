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
  HISTORICAL_RECORDS,
  LEGACY_SCHEMA,
  V2_SCHEMA,
  ORGAN_WORKFLOWS,
  REVIEW_RECORDS,
  WORK_OBJECTS,
  applyUnplannedDecision,
  createPacket,
  boardHorizon,
  defaultPlan,
  effectiveSignal,
  filterWorkObjects,
  groupWorkObjects,
  hasWhiteLabelReuse,
  hasLocalPlan,
  normalizeTags,
  normalizeClientFamilyId,
  normalizeReviewNote,
  parsePacket,
  resolvePipeline,
  signalProvenance,
  smartViewCount,
  sourceSignal,
  toMarkdown,
  reviewSuggestion,
} from './domain.ts'

test('canonical portfolio coverage remains exact', () => {
  assert.deepEqual(CLASSIFICATION_COUNTS, {
    total: 54,
    saplings: 12,
    clientBranches: 28,
    internalPrograms: 14,
    review: 16,
    historical: 19,
  })
  assert.equal(new Set(WORK_OBJECTS.map((work) => work.workId)).size, 54)
  assert.equal(REVIEW_RECORDS.length, 16)
  assert.equal(HISTORICAL_RECORDS.length, 19)
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
  assert.equal(groups.find((group) => group.kind === 'saplings')?.members.length, 12)
  assert.equal(groups.find((group) => group.kind === 'internal-programs')?.members.length, 14)
})

test('family signal summaries derive from effective source plus local plans', () => {
  const plans = { 'branch:axtech': { ...defaultPlan(), signal: 'paused' as const } }
  const axdis = groupWorkObjects(WORK_OBJECTS, plans).find((group) => group.groupId === 'client:axdis-group')!
  assert.equal(axdis.signalSummary.paused, 1)
  assert.equal(axdis.signalSummary.ongoing, 1)
})

test('all source review records receive deterministic suggested provenance', () => {
  const suggestions = REVIEW_RECORDS.map(reviewSuggestion)
  assert.equal(suggestions.length, 16)
  assert.ok(suggestions.every((suggestion) => suggestion.ruleVersion === 'thoughtseed.review-suggestion.v1'))
  assert.ok(suggestions.every((suggestion) => suggestion.sourceDigest.length === 64))
  assert.deepEqual(REVIEW_RECORDS.map(reviewSuggestion), suggestions)
})

test('review family identifiers and notes are normalized and bounded', () => {
  assert.equal(normalizeClientFamilyId('  Axdis Group !! '), 'axdis-group')
  assert.equal(normalizeClientFamilyId(`a${'b'.repeat(100)}`).length, 64)
  assert.equal(normalizeReviewNote(`  ${'x'.repeat(500)}  `).length, 400)
})

test('unplanned one-tap decisions preserve the planning-state grammar', () => {
  const base = defaultPlan()
  assert.deepEqual(
    { signal: applyUnplannedDecision(base, 'now').signal, horizon: applyUnplannedDecision(base, 'now').horizon },
    { signal: 'ongoing', horizon: 'now' },
  )
  assert.deepEqual(
    { signal: applyUnplannedDecision(base, 'next').signal, horizon: applyUnplannedDecision(base, 'next').horizon },
    { signal: null, horizon: 'next' },
  )
  assert.deepEqual(
    { signal: applyUnplannedDecision(base, 'later').signal, horizon: applyUnplannedDecision(base, 'later').horizon },
    { signal: null, horizon: 'later' },
  )
  assert.deepEqual(
    { signal: applyUnplannedDecision(base, 'park').signal, horizon: applyUnplannedDecision(base, 'park').horizon },
    { signal: 'paused', horizon: 'park' },
  )
  assert.deepEqual(applyUnplannedDecision(base, 'needs-review').tags, ['needs-review'])
})

test('one-tap decisions resolve the computed Unplanned queue without rewriting source truth', () => {
  const source = WORK_OBJECTS.find((work) => work.workId === 'sapling:iverif')
  assert.ok(source)
  const before = smartViewCount('unplanned', {})

  for (const decision of ['now', 'next', 'later', 'park', 'needs-review'] as const) {
    const plan = applyUnplannedDecision(defaultPlan(), decision)
    assert.equal(smartViewCount('unplanned', { [source.workId]: plan }), before - 1, decision)
  }

  assert.equal(sourceSignal(source), 'unplanned')
})

test('grouping, suggestions, and proposal export never mutate canonical catalog bytes', () => {
  const before = JSON.stringify(WORK_OBJECTS)
  groupWorkObjects()
  REVIEW_RECORDS.forEach(reviewSuggestion)
  createPacket({
    focusedId: null,
    plans: { 'sapling:iverif': applyUnplannedDecision(defaultPlan(), 'later') },
    reviewDecisions: {},
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
  assert.equal(smartViewCount('needs-review', plans), 16)
  assert.equal(smartViewCount('historical', plans), 19)
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

test('v3 packet export and validated import round-trip plans', () => {
  const id = 'sapling:fitcheck'
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
  }, new Date('2026-08-01T12:00:00.000Z'))
  assert.equal(packet.schema, CARTOGRAPHER_SCHEMA)
  assert.equal(packet.focusedId, id)
  assert.deepEqual(packet.plans[id].tags, ['founder-focus', 'white-labelable'])
  assert.equal(packet.pipelines.length, 1)
  assert.equal(packet.authority.mode, 'proposal-only')

  const restored = parsePacket(JSON.parse(JSON.stringify(packet)))
  assert.equal(restored.focusedId, id)
  assert.equal(restored.plans[id].signal, 'paused')
  assert.equal(restored.plans[id].horizon, 'this-year')
  assert.match(toMarkdown(packet), /Mini App Gate required/)
  assert.match(toMarkdown(packet), /does not activate tenants/)
})

test('v3 review decisions round-trip through JSON and Markdown', () => {
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
    version: 4,
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

test('application source has no network or runtime mutation primitives', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket(', 'sendBeacon(', 'api.telegram.org', 'wrangler']) {
    assert.equal(source.includes(forbidden), false, `forbidden source primitive: ${forbidden}`)
  }
  assert.match(source, /data-pipeline-id/)
  assert.match(source, /local plan/)
  assert.match(source, /if \(autosaveBlocked\) return/)
  assert.match(source, /unreadable local data stays untouched/)
  assert.match(source, /writePlanned\(next, id, \{ \.\.\.prior, tags \}\)/)
})

test('new triage controls expose selection, context, touch size, and bounded undo history', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
  const styles = await readFile(new URL('./index.css', import.meta.url), 'utf8')
  assert.match(source, /aria-pressed=\{viewMode === 'family'\}/)
  assert.match(source, /aria-pressed=\{viewMode === 'grid'\}/)
  assert.match(source, /aria-pressed=\{viewMode === 'board'\}/)
  assert.match(source, /aria-label=\{`Plan \$\{work\.name\}:/)
  assert.match(source, /aria-label=\{`Propose \$\{proposal/)
  assert.match(source, /function updatePlan[\s\S]*?setPlanningHistory\(emptyPlanningHistory\(\)\)[\s\S]*?setPlans/)
  assert.match(source, /function applyQuickDecision[\s\S]*?recordQuickUndo/)
  assert.match(source, /function rememberBulkState[\s\S]*?recordBulkUndo/)
  assert.match(styles, /\.view-toggle button \{[\s\S]*?min-height: 44px;/)
  assert.match(styles, /\.unplanned-actions button \{[\s\S]*?min-height: 44px;/)
  assert.match(styles, /\.review-choices button \{[\s\S]*?min-height: 44px;/)
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
