import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOUNDER_BOOKKEEPING_SCHEMA, parseFounderBookkeepingBoundary, parseFounderBookkeepingIntent } from './native-goal-intake.ts';
import { resolveNodeId } from './goal-graph/identity.ts';
import { makeGoalGraphHead } from './goal-graph/compiler.ts';

const founder = 'access:fixture-founder';
const now = '2026-11-03T01:00:00.000Z';
const goal = { namespace: 'founder-bookkeeping', externalId: 'lumen-lifecycle', parentNodeId: null,
  scope: 'meso', desiredState: 'Track LumenBar launch evidence.', currentState: 'Video and site verified; copy revision held.',
  owner: 'founder', status: 'paused', metadata: { completedSource: true, publicPostsObserved: 0 },
  workObjectId: 'sapling:lumen-bar', workObjectKind: 'sapling' };
function input() { return { schema: FOUNDER_BOOKKEEPING_SCHEMA, version: 1, tenantId: 'cambium', clientRequestId: 'launch-evidence-001', goals: [structuredClone(goal)] }; }
const context = { currentNodes: [], actualHead: null, expectedHeadDigest: null, graphVersion: 1, now };

test('founder bookkeeping authentic provenance compiles null-loadout anchored history without Telegram IDs', () => {
  const raw = input();
  const parent = resolveNodeId({ tenantId: 'cambium', namespace: goal.namespace, externalId: goal.externalId, sourceRef: '', sourceDigest: '' });
  raw.goals.push({ ...goal, externalId: 'temperance-lifecycle', parentNodeId: parent as any,
    workObjectId: 'program:temperance-hermes', workObjectKind: 'program' });
  const result = parseFounderBookkeepingIntent(raw, founder, context);
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.equal(result.nodes.length, 2);
  assert.equal(result.compile.status, 'compiled');
  assert.ok(result.nodes.every(node => node.pinnedLoadoutId === null));
  assert.match(result.sourceRef, /^founder-web:cambium:/);
  assert.doesNotMatch(JSON.stringify(result), /telegram:|chatId|messageId|fixture-founder/);
  const replay = parseFounderBookkeepingBoundary(raw, founder);
  assert.ok(replay.accepted);
  if (replay.accepted) assert.equal(result.idempotencyKey, replay.idempotencyKey);
});

test('bookkeeping replay identity detects changed content and cannot borrow another founder identity', () => {
  const raw = input();
  const first = parseFounderBookkeepingBoundary(raw, founder);
  raw.goals[0].currentState = 'Four Reddit runs paused; X removal pending.';
  const second = parseFounderBookkeepingBoundary(raw, founder);
  const other = parseFounderBookkeepingBoundary(raw, 'access:other-founder');
  assert.ok(first.accepted && second.accepted && other.accepted);
  if (!first.accepted || !second.accepted || !other.accepted) return;
  assert.equal(first.idempotencyKey, second.idempotencyKey);
  assert.notEqual(first.contentDigest, second.contentDigest);
  assert.notEqual(second.sourceRef, other.sourceRef);
});

test('bookkeeping upserts preserve unrelated graph nodes and stale head refuses compilation', () => {
  const original = input();
  const parent = resolveNodeId({ tenantId: 'cambium', namespace: goal.namespace, externalId: goal.externalId, sourceRef: '', sourceDigest: '' });
  original.goals.push({ ...goal, externalId: 'unrelated-old-proof', parentNodeId: parent as any });
  const first = parseFounderBookkeepingIntent(original, founder, context);
  assert.ok(first.accepted); if (!first.accepted) return;
  const head = makeGoalGraphHead('cambium', first.nodes, 1, now);
  const raw = input(); raw.clientRequestId = 'launch-evidence-002'; raw.goals[0].currentState = 'Voice revision held; schedules cancelled.';
  const result = parseFounderBookkeepingIntent(raw, founder, { ...context, currentNodes: first.nodes, actualHead: head, expectedHeadDigest: head.graphDigest, graphVersion: 2 });
  assert.ok(result.accepted && result.compile.status === 'compiled');
  if (!result.accepted || result.compile.status !== 'compiled') return;
  assert.equal(result.compile.changeSet.nodesToRemove.length, 0);
  assert.equal(result.compile.changeSet.nodesToUpdate.length, 1);
  const stale = parseFounderBookkeepingIntent(raw, founder, { ...context, actualHead: head });
  assert.ok(stale.accepted && stale.compile.status === 'stale');
});

test('bookkeeping rejects authority grants, private transport, unsupported identities and unbounded input', () => {
  const variants = [
    { ...input(), source: { kind: 'telegram', chatId: 'fake', messageId: 'fake' } },
    { ...input(), tenantId: 'other' },
    { ...input(), goals: [] },
    { ...input(), goals: Array.from({ length: 33 }, () => goal) },
    { ...input(), goals: [{ ...goal, workObjectId: 'sapling:fitcheck' }] },
    { ...input(), goals: [{ ...goal, namespace: 'telegram' }] },
    { ...input(), goals: [{ ...goal, pinnedLoadoutId: 'loadout:fitcheck-launch' }] },
    { ...input(), goals: [{ ...goal, metadata: { executionAdmission: 'yes' } }] },
    { ...input(), goals: [{ ...goal, currentState: '/Users/fixture/private-source' }] },
    { ...input(), goals: [{ ...goal, metadata: { model: 'candidate' } }] },
    { ...input(), goals: [goal, goal] },
    { ...input(), goals: [{ ...goal, desiredState: 'x'.repeat(513) }] },
    { schema: 'cambium.goal-graph-projection.v1', origin: 'd1', payload: input() },
  ];
  for (const raw of variants) assert.equal(parseFounderBookkeepingBoundary(raw, founder).accepted, false);
  assert.equal(parseFounderBookkeepingBoundary(input(), 'client-claimed-founder').accepted, false);
  assert.equal(parseFounderBookkeepingBoundary(null, founder).accepted, false);
});
