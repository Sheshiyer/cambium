import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TELEGRAM_GOAL_GRAPH_INTENT_SCHEMA,
  TELEGRAM_GOAL_GRAPH_INTENT_VERSION,
  parseTelegramGoalGraphIntent,
} from './goal-graph-intake.ts';

const minimal = {
  schema: TELEGRAM_GOAL_GRAPH_INTENT_SCHEMA,
  version: TELEGRAM_GOAL_GRAPH_INTENT_VERSION,
  tenantId: 'tenant-alpha',
  source: { kind: 'telegram', chatId: '-100123', messageId: '42', updateId: '9001' },
  goal: { desiredState: 'publish the approved launch note' },
};

test('minimal Telegram intent is accepted, compiled, and provenance-bound', () => {
  const result = parseTelegramGoalGraphIntent(minimal);
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.equal(result.compile.status, 'compiled');
  assert.equal(result.node.tenantId, 'tenant-alpha');
  assert.equal(result.sourceRef, 'telegram:tenant-alpha:-100123:42');
  assert.equal(result.node.sourceRef, result.sourceRef);
  assert.equal(result.node.sourceDigest, result.contentDigest);
  assert.equal(result.compile.changeSet.sourceRef, result.sourceRef);
  assert.equal(result.compile.changeSet.sourceDigest, result.contentDigest);
  assert.equal(result.compile.changeSet.nodesToCreate.length, 1);
});

test('repeat delivery has byte-stable canonical form, digest, node, and idempotency key', () => {
  const first = parseTelegramGoalGraphIntent(minimal);
  const second = parseTelegramGoalGraphIntent(JSON.parse(JSON.stringify(minimal)));
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  if (!first.accepted || !second.accepted) return;
  assert.equal(first.canonical, second.canonical);
  assert.equal(first.contentDigest, second.contentDigest);
  assert.equal(first.idempotencyKey, second.idempotencyKey);
  assert.deepEqual(first.node, second.node);
  assert.equal(first.canonical, '{"goal":{"currentState":"unknown","desiredState":"publish the approved launch note","externalId":null,"metadata":{},"namespace":"telegram","nextAction":null,"owner":"founder","parentNodeId":null,"proofRequired":false,"reviewAt":null,"scope":"macro","status":"draft","waitCondition":null},"schema":"cambium.telegram.goal-graph-intent.v1","source":{"chatId":"-100123","kind":"telegram","messageId":"42","updateId":"9001"},"tenantId":"tenant-alpha","version":1}');
  assert.equal(first.contentDigest, 'sha256:cb32bfc5cd647200a584be1a149a309a84dc79e46afceebaee6d3cc35b0c493c');
});

test('governed operational anchors compile only with exact loadout authority', () => {
  const anchored = {
    ...minimal,
    goal: {
      ...minimal.goal,
      externalId: 'task-fitcheck-launch',
      workObjectId: 'sapling:fitcheck',
      workObjectKind: 'sapling',
      pinnedLoadoutId: 'loadout:fitcheck-launch',
    },
  };
  const loadoutAuthority = {
    resolve(loadoutId: string) {
      return loadoutId === 'loadout:fitcheck-launch' ? {
        loadoutId,
        eligibleWorkObjectIds: ['sapling:fitcheck'],
        authorizedClusterIds: ['cluster:fitcheck-no-spend'],
        authorityDigest: `sha256:${'a'.repeat(64)}`,
        sourceRef: 'test:loadout-registry',
      } : null;
    },
  };
  const accepted = parseTelegramGoalGraphIntent(anchored, { loadoutAuthority });
  assert.equal(accepted.accepted, true);
  if (accepted.accepted) {
    assert.equal(accepted.node.workObjectId, 'sapling:fitcheck');
    assert.equal(accepted.node.pinnedLoadoutId, 'loadout:fitcheck-launch');
    assert.equal(accepted.compile.status, 'compiled');
  }
  assert.equal(parseTelegramGoalGraphIntent(anchored).accepted, false);
  assert.equal(parseTelegramGoalGraphIntent({ ...anchored, goal: { ...anchored.goal, pinnedLoadoutId: undefined } }).accepted, false);
});

test('every malformed value returns an explicit rejection and never throws', () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  const malformed: unknown[] = [null, undefined, [], 4, cyclic,
    { schema: TELEGRAM_GOAL_GRAPH_INTENT_SCHEMA, version: 1, tenantId: 't', source: {}, goal: {} },
    { schema: TELEGRAM_GOAL_GRAPH_INTENT_SCHEMA, version: 1, tenantId: 't', source: { chatId: 'c', messageId: 'm' }, goal: { desiredState: '' } },
  ];
  for (const input of malformed) {
    assert.doesNotThrow(() => parseTelegramGoalGraphIntent(input));
    const result = parseTelegramGoalGraphIntent(input);
    assert.equal(result.accepted, false);
    assert.equal(result.rejected, true);
    assert.equal(result.status, 'rejected');
    assert.ok(result.errors.length > 0);
  }
});

test('provider, model, routing, credential, unbounded, and projection-shaped input is rejected', () => {
  const forbidden = ['provider', 'model', 'routing', 'credential', 'projection'];
  for (const key of forbidden) {
    const input = { ...minimal, goal: { ...minimal.goal, metadata: { [key]: 'must not cross boundary' } } };
    const result = parseTelegramGoalGraphIntent(input);
    assert.equal(result.accepted, false, key);
    assert.equal(result.code, key === 'projection' ? 'forbidden_key' : 'forbidden_key');
  }
  const oversized = { ...minimal, goal: { ...minimal.goal, desiredState: 'x'.repeat(20_000) } };
  assert.equal(parseTelegramGoalGraphIntent(oversized).accepted, false);
  assert.equal(parseTelegramGoalGraphIntent(oversized).code, 'bounds_exceeded');
  const projection = { schema: 'cambium.goal-graph-projection.v1', origin: 'd1', graph_version: 1, graph_digest: 'x', tenant: 't', source_ref: 'r', payload: {} };
  assert.equal(parseTelegramGoalGraphIntent(projection).accepted, false);
  assert.equal(parseTelegramGoalGraphIntent(projection).code, 'projection_input');
});

test('unknown fields are fail-closed and tenant/source changes alter identity', () => {
  const unknown = parseTelegramGoalGraphIntent({ ...minimal, unexpected: true });
  assert.equal(unknown.accepted, false);
  assert.equal(unknown.code, 'unknown_key');

  const otherTenant = parseTelegramGoalGraphIntent({ ...minimal, tenantId: 'tenant-beta' });
  const otherSource = parseTelegramGoalGraphIntent({ ...minimal, source: { ...minimal.source, messageId: '43' } });
  const original = parseTelegramGoalGraphIntent(minimal);
  assert.equal(original.accepted, true);
  assert.equal(otherTenant.accepted, true);
  assert.equal(otherSource.accepted, true);
  if (!original.accepted || !otherTenant.accepted || !otherSource.accepted) return;
  assert.notEqual(otherTenant.node.tenantId, original.node.tenantId);
  assert.notEqual(otherTenant.contentDigest, original.contentDigest);
  assert.notEqual(otherSource.sourceRef, original.sourceRef);
  assert.notEqual(otherSource.idempotencyKey, original.idempotencyKey);
});
