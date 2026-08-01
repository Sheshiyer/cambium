import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  CARTOGRAPHER_SCHEMA,
  CLASSIFICATION_COUNTS,
  HISTORICAL_RECORDS,
  LEGACY_SCHEMA,
  ORGAN_WORKFLOWS,
  REVIEW_RECORDS,
  WORK_OBJECTS,
  createPacket,
  boardHorizon,
  defaultPlan,
  effectiveSignal,
  filterWorkObjects,
  hasWhiteLabelReuse,
  hasLocalPlan,
  normalizeTags,
  parsePacket,
  resolvePipeline,
  signalProvenance,
  smartViewCount,
  sourceSignal,
  toMarkdown,
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

test('v2 packet export and validated import round-trip plans', () => {
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
