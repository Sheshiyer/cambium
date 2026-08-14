import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveFounderOutcomeTransition,
  parseFounderOutcomeIntent,
  type FounderObservedOutcome,
} from './founder-outcome-intake.ts';

function validFounderOutcome(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    schema: 'cambium.founder-outcome-intent.v1',
    tenantId: 'cambium',
    workObjectId: 'sapling:fitcheck',
    branchId: 'fitcheck',
    missionId: 'fitcheck-shopify-qa',
    questId: 'fitcheck-shopify-widget-qa',
    outcome: 'passed',
    screenshotRef: 'https://evidence.example.com/fitcheck/screenshots/launch-proof-001',
    widgetEventRef: 'receipt:fitcheck-widget-event-001',
    note: 'Founder validated the live storefront widget.',
    clientRequestId: 'fitcheck-founder-outcome-001',
    ...overrides,
  };
}

function assertRejected(input: unknown, expectedCode?: string): void {
  assert.doesNotThrow(() => parseFounderOutcomeIntent(input));
  const result = parseFounderOutcomeIntent(input);
  assert.equal(result.accepted, false);
  assert.equal(result.rejected, true);
  assert.equal(result.status, 'rejected');
  assert.ok(result.errors.length > 0);
  if (expectedCode) assert.equal(result.code, expectedCode);
}

test('accepts the exact Fitcheck proof-reference envelope', () => {
  const parsed = parseFounderOutcomeIntent(validFounderOutcome());
  assert.equal(parsed.accepted, true);
  if (!parsed.accepted) return;
  assert.equal(parsed.value.questId, 'fitcheck-shopify-widget-qa');
  assert.equal(parsed.value.note, 'Founder validated the live storefront widget.');
  assert.equal(parsed.canonical, '{"branchId":"fitcheck","clientRequestId":"fitcheck-founder-outcome-001","missionId":"fitcheck-shopify-qa","note":"Founder validated the live storefront widget.","outcome":"passed","questId":"fitcheck-shopify-widget-qa","schema":"cambium.founder-outcome-intent.v1","screenshotRef":"https://evidence.example.com/fitcheck/screenshots/launch-proof-001","tenantId":"cambium","widgetEventRef":"receipt:fitcheck-widget-event-001","workObjectId":"sapling:fitcheck"}');
  assert.match(parsed.contentDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(
    parsed.idempotencyKey,
    'founder-outcome:v1:cambium:sapling:fitcheck:fitcheck-shopify-widget-qa:fitcheck-founder-outcome-001',
  );
  assert.equal(
    parsed.replayKey,
    'founder-outcome:v1:cambium:fitcheck-founder-outcome-001:sha256:e384bdbfa9f8c6aee5a3ceeaf34c03b9282d6827825fde13837f3c25e08cb4f0',
  );
});

test('accepted envelopes normalize benign surrounding whitespace and remain byte-stable', () => {
  const first = parseFounderOutcomeIntent(validFounderOutcome());
  const second = parseFounderOutcomeIntent(validFounderOutcome({
    tenantId: '  cambium  ',
    workObjectId: '\nsapling:fitcheck\t',
    branchId: ' fitcheck ',
    missionId: ' fitcheck-shopify-qa ',
    questId: '\tfitcheck-shopify-widget-qa\t',
    outcome: ' passed ',
    screenshotRef: ' https://evidence.example.com/fitcheck/screenshots/launch-proof-001 ',
    widgetEventRef: ' receipt:fitcheck-widget-event-001 ',
    note: ' Founder validated the live storefront widget. ',
    clientRequestId: ' fitcheck-founder-outcome-001 ',
  }));
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  if (!first.accepted || !second.accepted) return;
  assert.equal(first.canonical, second.canonical);
  assert.equal(first.contentDigest, second.contentDigest);
  assert.equal(first.idempotencyKey, second.idempotencyKey);
  assert.equal(first.replayKey, second.replayKey);
  assert.deepEqual(first.value, second.value);
});

test('rejects identity drift for every fixed pilot field', () => {
  const drifts: Array<[string, unknown]> = [
    ['schema', 'cambium.founder-outcome-intent.v2'],
    ['tenantId', 'tenant-beta'],
    ['workObjectId', 'sapling:other'],
    ['branchId', 'other-branch'],
    ['missionId', 'other-mission'],
    ['questId', 'other-quest'],
  ];
  for (const [field, value] of drifts) {
    const result = parseFounderOutcomeIntent(validFounderOutcome({ [field]: value }));
    assert.equal(result.accepted, false, field);
    assert.equal(result.code, 'identity_mismatch', field);
  }
});

test('rejects unknown root keys and forbidden initData at the boundary', () => {
  assertRejected({ ...validFounderOutcome(), extra: true }, 'unknown_key');
  const forbidden = parseFounderOutcomeIntent({
    ...validFounderOutcome(),
    initData: 'query_id=AAE7&auth_date=1720000000&hash=deadbeef',
  });
  assert.equal(forbidden.accepted, false);
  assert.equal(forbidden.code, 'forbidden_key');
  assert.match(forbidden.errors.join(' '), /initData/i);
});

test('deriveFounderOutcomeTransition maps every allowed outcome to the exact server-owned transition', () => {
  const cases: Array<[FounderObservedOutcome, string, boolean]> = [
    ['passed', 'active', false],
    ['failed', 'blocked', true],
    ['blocked', 'blocked', true],
    ['needs-review', 'paused', true],
  ];
  for (const [outcome, status, proofRequired] of cases) {
    const parsed = parseFounderOutcomeIntent(validFounderOutcome({ outcome }));
    assert.equal(parsed.accepted, true, outcome);
    if (!parsed.accepted) continue;
    const transition = deriveFounderOutcomeTransition(parsed.value, 'goal_parent_fitcheck_anchor');
    assert.equal(transition.tenantId, 'cambium');
    assert.equal(transition.namespace, 'fitcheck-founder-outcome');
    assert.equal(transition.scope, 'proof');
    assert.equal(transition.workObjectId, 'sapling:fitcheck');
    assert.equal(transition.workObjectKind, 'sapling');
    assert.equal(transition.branchId, 'fitcheck');
    assert.equal(transition.missionId, 'fitcheck-shopify-qa');
    assert.equal(transition.questId, 'fitcheck-shopify-widget-qa');
    assert.equal(transition.pinnedLoadoutId, 'loadout:fitcheck-launch');
    assert.equal(transition.parentNodeId, 'goal_parent_fitcheck_anchor');
    assert.equal(
      transition.externalId,
      `founder-outcome:fitcheck-shopify-widget-qa:${parsed.value.clientRequestId}:${parsed.contentDigest}`,
    );
    assert.equal(transition.desiredState, 'Record the founder-observed Fitcheck Shopify QA outcome.');
    assert.equal(transition.nextAction, 'Review the founder-submitted evidence candidate in Gate.');
    assert.equal(transition.waitCondition, 'Await founder-approved Goal Graph commit.');
    assert.equal(transition.status, status);
    assert.equal(transition.proofRequired, proofRequired);
    assert.equal(transition.outcome, outcome);
    assert.equal(transition.metadata.screenshotRef, parsed.value.screenshotRef);
    assert.equal(transition.metadata.widgetEventRef, parsed.value.widgetEventRef);
    assert.equal(transition.metadata.clientRequestId, parsed.value.clientRequestId);
  }
});

test('rejects missing values, unsafe types, and clearly oversized payloads', () => {
  assertRejected(validFounderOutcome({ screenshotRef: undefined }), 'malformed_input');
  assertRejected(validFounderOutcome({ widgetEventRef: null }), 'malformed_input');
  assertRejected(validFounderOutcome({ outcome: 'unknown' }), 'malformed_input');
  assertRejected(validFounderOutcome({ note: 42 }), 'malformed_input');
  assertRejected(validFounderOutcome({ clientRequestId: false }), 'malformed_input');
  assertRejected(validFounderOutcome({ note: 'x'.repeat(5000) }), 'bounds_exceeded');
  assertRejected(validFounderOutcome({ screenshotRef: `https://evidence.example.com/${'x'.repeat(5000)}` }), 'bounds_exceeded');
  assertRejected(validFounderOutcome({ clientRequestId: `fitcheck-${'x'.repeat(5000)}` }), 'bounds_exceeded');
});

test('accepts only bounded HTTPS pointers and conservative opaque receipt references', () => {
  const httpsAccepted = parseFounderOutcomeIntent(validFounderOutcome({
    screenshotRef: 'https://evidence.example.com/fitcheck/screenshots/proof?id=launch-001&view=full',
    widgetEventRef: 'event:fitcheck_widget_launch_001',
  }));
  assert.equal(httpsAccepted.accepted, true);

  const acceptedOpaque = parseFounderOutcomeIntent(validFounderOutcome({
    screenshotRef: 'receipt:fitcheck-screenshot-001',
    widgetEventRef: 'receipt:fitcheck-widget-event-001',
  }));
  assert.equal(acceptedOpaque.accepted, true);

  const rejectedRefs = [
    validFounderOutcome({ screenshotRef: 'https://user:pass@evidence.example.com/proof' }),
    validFounderOutcome({ screenshotRef: 'https://evidence.example.com/proof?token=secret' }),
    validFounderOutcome({ screenshotRef: 'https://evidence.example.com/proof?X-Amz-Signature=deadbeef' }),
    validFounderOutcome({ screenshotRef: 'data:image/png;base64,abc' }),
    validFounderOutcome({ screenshotRef: 'javascript:alert(1)' }),
    validFounderOutcome({ screenshotRef: 'file:///tmp/proof.png' }),
    validFounderOutcome({ screenshotRef: '/private/tmp/cambium-fitcheck-founder-outcome.XNGhSF/proof.png' }),
    validFounderOutcome({ screenshotRef: '../proof.png' }),
    validFounderOutcome({ screenshotRef: 'receipt:fitcheck proof' }),
    validFounderOutcome({ screenshotRef: 'receipt:fitcheck-proof?token=secret' }),
  ];
  for (const input of rejectedRefs) assertRejected(input, 'unsafe_reference');
});

test('proof slots enforce distinct screenshot and widget-event reference grammars', () => {
  const acceptedHttps = parseFounderOutcomeIntent(validFounderOutcome({
    screenshotRef: 'https://evidence.example.com/fitcheck/screenshots/launch-proof-001',
    widgetEventRef: 'https://evidence.example.com/fitcheck/widget-events/launch-001',
  }));
  assert.equal(acceptedHttps.accepted, true);

  const invalidSlots = [
    validFounderOutcome({ screenshotRef: 'receipt:fitcheck-widget-event-001' }),
    validFounderOutcome({ widgetEventRef: 'receipt:fitcheck-screenshot-001' }),
    validFounderOutcome({ screenshotRef: 'receipt:fitcheck-screenshot-001', widgetEventRef: 'receipt:fitcheck-screenshot-001' }),
    validFounderOutcome({ screenshotRef: 'https://evidence.example.com/fitcheck/widget-events/launch-001' }),
    validFounderOutcome({ widgetEventRef: 'https://evidence.example.com/fitcheck/screenshots/launch-proof-001' }),
    validFounderOutcome({ screenshotRef: 'https://evidence.example.com/fitcheck/widget-events/screenshot-proof-001' }),
    validFounderOutcome({ widgetEventRef: 'https://evidence.example.com/fitcheck/screenshots/widget-event-001' }),
  ];
  for (const input of invalidSlots) assertRejected(input, 'unsafe_reference');
});

test('transition identity binds the canonical candidate, not only the replay request id', () => {
  const first = parseFounderOutcomeIntent(validFounderOutcome());
  const changed = parseFounderOutcomeIntent(validFounderOutcome({
    screenshotRef: 'https://evidence.example.com/fitcheck/screenshots/launch-proof-002',
  }));
  const replay = parseFounderOutcomeIntent(validFounderOutcome());
  assert.equal(first.accepted, true);
  assert.equal(changed.accepted, true);
  assert.equal(replay.accepted, true);
  if (!first.accepted || !changed.accepted || !replay.accepted) return;
  const firstTransition = deriveFounderOutcomeTransition(first.value, 'goal_parent_fitcheck_anchor');
  const changedTransition = deriveFounderOutcomeTransition(changed.value, 'goal_parent_fitcheck_anchor');
  const replayTransition = deriveFounderOutcomeTransition(replay.value, 'goal_parent_fitcheck_anchor');
  assert.notEqual(first.contentDigest, changed.contentDigest);
  assert.notEqual(firstTransition.externalId, changedTransition.externalId);
  assert.equal(firstTransition.externalId, replayTransition.externalId);
  assert.match(firstTransition.externalId, new RegExp(`${first.contentDigest}$`));
});

test('references and notes reject secret material, raw Telegram data, raw JSON payloads, and local machine paths', () => {
  const hostileInputs = [
    validFounderOutcome({ screenshotRef: 'query_id=AAE7&user=%7B%22id%22%3A1%7D&auth_date=1720000000&hash=deadbeef' }),
    validFounderOutcome({ screenshotRef: '{"event":"widget.click","payload":{"approved":true}}' }),
    validFounderOutcome({ screenshotRef: 'Bearer abc.def.ghi' }),
    validFounderOutcome({ widgetEventRef: 'secret:launch-evidence' }),
    validFounderOutcome({ note: 'Paste from /Users/example/Desktop/fitcheck-proof.png after review.' }),
    validFounderOutcome({ note: 'initData=query_id=AAE7&hash=deadbeef' }),
    validFounderOutcome({ note: '{"event":"raw"}' }),
    validFounderOutcome({ note: 'token=secret-launch-proof' }),
    validFounderOutcome({ note: 'C:\\Users\\founder\\fitcheck-proof.png' }),
  ];
  for (const input of hostileInputs) {
    const result = parseFounderOutcomeIntent(input);
    assert.equal(result.accepted, false);
    assert.match(result.code, /unsafe_reference|unsafe_note/);
  }
});

test('references reject percent-encoded raw payloads and local-machine path material', () => {
  const hostileInputs = [
    validFounderOutcome({ screenshotRef: 'https://evidence.example.com/fitcheck/screenshots/%2Fprivate%2Ftmp%2Fproof.png' }),
    validFounderOutcome({ screenshotRef: 'https://evidence.example.com/fitcheck/screenshots/%7B%22event%22%3A%22raw%22%7D' }),
    validFounderOutcome({ screenshotRef: 'https://evidence.example.com/fitcheck/screenshots/C%3A%5CUsers%5Cfounder%5Cproof.png' }),
    validFounderOutcome({ widgetEventRef: 'https://evidence.example.com/fitcheck/widget-events/%257B%2522event%2522%253A%2522raw%2522%257D' }),
  ];
  for (const input of hostileInputs) assertRejected(input, 'unsafe_reference');
});

test('deriveFounderOutcomeTransition rejects invalid parent node identities', () => {
  const parsed = parseFounderOutcomeIntent(validFounderOutcome());
  assert.equal(parsed.accepted, true);
  if (!parsed.accepted) return;
  const invalidParents = ['', '   ', '../parent', 'parent\nnode', `goal_${'x'.repeat(5000)}`];
  for (const parentNodeId of invalidParents) {
    assert.throws(
      () => deriveFounderOutcomeTransition(parsed.value, parentNodeId),
      /parentNodeId/i,
    );
  }
});

test('parsing never mutates the supplied input object', () => {
  const input = validFounderOutcome({
    screenshotRef: '  https://evidence.example.com/fitcheck/screenshots/launch-proof-001  ',
    note: '  Founder validated the live storefront widget.  ',
  });
  const before = JSON.parse(JSON.stringify(input));
  const result = parseFounderOutcomeIntent(input);
  assert.equal(result.accepted, true);
  assert.deepEqual(input, before);
});

test('malformed, cyclic, and non-serializable values are rejected without throwing', () => {
  const cyclic: Record<string, unknown> = validFounderOutcome();
  cyclic.self = cyclic;
  const malformed: unknown[] = [
    null,
    undefined,
    [],
    42,
    true,
    cyclic,
    { schema: 'cambium.founder-outcome-intent.v1' },
    validFounderOutcome({ note: Symbol('note') }),
    validFounderOutcome({ clientRequestId: 1n }),
    validFounderOutcome({ screenshotRef: { href: 'https://evidence.example.com/proof' } }),
  ];
  for (const value of malformed) {
    assert.doesNotThrow(() => parseFounderOutcomeIntent(value));
    const result = parseFounderOutcomeIntent(value);
    assert.equal(result.accepted, false);
    assert.equal(result.rejected, true);
    assert.ok(result.errors.length > 0);
  }
});
