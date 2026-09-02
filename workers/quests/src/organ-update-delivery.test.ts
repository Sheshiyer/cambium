import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ORGAN_UPDATE_DELIVERY_SCHEMA,
  ORGAN_UPDATE_PLAN,
  ORGAN_UPDATE_SIGNAL_SCHEMA,
  ORGAN_UPDATE_SUMMARY,
  compileOrganUpdateDelivery,
  normalizeOrganUpdateSignal,
  validateOrganUpdateDelivery,
} from './organ-update-delivery.ts';

const DIGEST = `sha256:${'a'.repeat(64)}`;
const ROUTES = [
  ['genesis', 'brand-intake', 'inbox', 5],
  ['taste', 'qa', 'digests', 3],
  ['hands', 'verification', 'dev', 4],
  ['will', 'approved-business', 'clients', 9],
  ['cortex', 'learning', 'agent_ops', 7],
] as const;

function signal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: ORGAN_UPDATE_SIGNAL_SCHEMA,
    tenantId: 'cambium',
    workObjectId: 'sapling:cambium',
    organ: 'hands',
    trigger: 'build',
    status: 'complete',
    audience: 'internal',
    summary: 'Verified implementation receipt is ready for review.',
    observedAt: '2026-07-29T10:00:00.000Z',
    proof: { ref: 'receipt:build-001', digest: DIGEST },
    ...overrides,
  };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(',')}}`;
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

test('plan publishes exactly five deterministic event-driven workflows', () => {
  assert.equal(ORGAN_UPDATE_PLAN.schema, 'cambium.organ-update-plan.v1');
  assert.equal(ORGAN_UPDATE_PLAN.workflows.length, 5);
  assert.deepEqual(ORGAN_UPDATE_PLAN.workflows.map((row) => row.name), [
    'Genesis', 'Taste', 'Hands', 'Will', 'Cortex',
  ]);
  assert.equal(new Set(ORGAN_UPDATE_PLAN.workflows.map((row) => row.defaultTopic.topicKey)).size, 5);
  assert.ok(ORGAN_UPDATE_PLAN.workflows.every((row) => row.escalationTopic.topicKey === 'alerts'));
  assert.ok(ORGAN_UPDATE_PLAN.workflows.every((row) => row.triggers.length > 0 && row.stages.length > 0 && row.skillHints.length > 0));
  assert.equal(ORGAN_UPDATE_PLAN.eventDriven, true);
  assert.equal(ORGAN_UPDATE_PLAN.scheduleArmed, false);
  const { planDigest, ...body } = ORGAN_UPDATE_PLAN;
  assert.equal(planDigest, digest(body));
  assert.deepEqual(ORGAN_UPDATE_SUMMARY, {
    schema: 'cambium.organ-update-delivery-summary.v1',
    version: 1,
    readOnly: true,
    eventDriven: true,
    scheduleArmed: false,
    workflowCount: 5,
    defaultTopicCount: 5,
    escalationTopicCount: 1,
    approvalRequiredWorkflowCount: 1,
    planDigest,
  });
});

for (const [organ, trigger, topicKey, threadId] of ROUTES) {
  test(`${organ} compiles to the pinned ${topicKey} route`, () => {
    const delivery = compileOrganUpdateDelivery(signal({ organ, trigger }));
    assert.equal(delivery.schema, ORGAN_UPDATE_DELIVERY_SCHEMA);
    assert.equal(delivery.organ, organ);
    assert.equal(delivery.route.topicKey, topicKey);
    assert.equal(delivery.route.threadId, threadId);
    assert.equal(delivery.message.format, 'plain-text');
    assert.equal(delivery.message.byteLength, new TextEncoder().encode(delivery.message.text).byteLength);
    assert.equal(delivery.eventDriven, true);
    assert.equal(delivery.scheduleArmed, false);
    assert.match(delivery.deliveryId, /^organ-update_[0-9a-f]{32}$/);
    const { deliveryDigest, ...withoutDigest } = delivery;
    assert.equal(deliveryDigest, digest(withoutDigest));
  });
}

for (const status of ['blocked', 'failed', 'drifted'] as const) {
  test(`${status} overrides every workflow destination to Alerts only`, () => {
    for (const [organ, trigger] of ROUTES) {
      const delivery = compileOrganUpdateDelivery(signal({ organ, trigger, status }));
      assert.equal(delivery.route.topicKey, 'alerts');
      assert.equal(delivery.route.threadId, 8);
    }
  });
}

test('equal canonical signals produce equal delivery identities and digests', () => {
  const first = compileOrganUpdateDelivery(signal());
  const second = compileOrganUpdateDelivery({
    ...signal(),
    summary: '  Verified   implementation receipt is ready for review.  ',
  });
  assert.equal(first.deliveryId, second.deliveryId);
  assert.equal(first.deliveryDigest, second.deliveryDigest);
  assert.deepEqual(first, second);
  assert.equal(validateOrganUpdateDelivery(first), true);
  assert.equal(validateOrganUpdateDelivery({ ...first, deliveryDigest: `sha256:${'f'.repeat(64)}` }), false);
  assert.equal(validateOrganUpdateDelivery({ ...first, route: { ...first.route, threadId: 2 } }), false);
});

test('changing proof, workflow, route-driving status, or message changes the digest', () => {
  const baseline = compileOrganUpdateDelivery(signal());
  const candidates = [
    compileOrganUpdateDelivery(signal({ proof: { ref: 'receipt:build-002', digest: DIGEST } })),
    compileOrganUpdateDelivery(signal({ organ: 'taste', trigger: 'qa' })),
    compileOrganUpdateDelivery(signal({ status: 'blocked' })),
    compileOrganUpdateDelivery(signal({ summary: 'Different verified summary.' })),
  ];
  for (const candidate of candidates) assert.notEqual(candidate.deliveryDigest, baseline.deliveryDigest);
});

test('Will client delivery requires a separate Gate approval reference', () => {
  assert.throws(
    () => compileOrganUpdateDelivery(signal({
      organ: 'will',
      trigger: 'client-delivery',
      audience: 'client',
    })),
    /approvalRef/,
  );
  const approved = compileOrganUpdateDelivery(signal({
    organ: 'will',
    trigger: 'client-delivery',
    audience: 'client',
    approvalRef: 'gate:approval-001',
  }));
  assert.equal(approved.requiresApproval, true);
  assert.equal(approved.approvalRef, 'gate:approval-001');
});

test('unknown or cross-organ values fail closed', () => {
  const invalid = [
    signal({ schema: 'cambium.organ-update-signal.v0' }),
    signal({ organ: 'unknown' }),
    signal({ organ: 'genesis', trigger: 'build' }),
    signal({ status: 'sent' }),
    signal({ audience: 'public' }),
    signal({ audience: 'client' }),
    signal({ observedAt: 'yesterday' }),
    signal({ proof: { ref: 'receipt:build-001', digest: 'sha256:bad' } }),
    signal({ proof: { ref: 'token=secret', digest: DIGEST } }),
    signal({ summary: 'Bearer secret' }),
    { ...signal(), unexpected: true },
  ];
  for (const value of invalid) assert.throws(() => normalizeOrganUpdateSignal(value));
});

test('compiler contains no Telegram sender, bot endpoint, or recurring scheduler', () => {
  const source = readFileSync(new URL('./organ-update-delivery.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /api\.telegram\.org|sendMessage\s*\(|setInterval\s*\(|scheduled\s*\(/);
  assert.doesNotMatch(source, /BOT_TOKEN|TELEGRAM_BOT_TOKEN/);
});
