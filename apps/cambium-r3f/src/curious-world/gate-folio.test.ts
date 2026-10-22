import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HELD_GATE, gateActionState, gateAdmissionSummary, gateCountLabel, gateInspectRows, normalizeGateSnapshot,
} from './gate-folio.ts';

const DIGEST = '2967cf5be0c5128b850e0fb69e402340589ee0ad4b61c0284acdb07d02d7e5cf';
const ADMISSION = [
  ['executionAdmissionClusterId', 'cluster:relovo-source-verification'],
  ['executionAdmissionDirectiveId', 'directive:relovo-source-audit-001'],
  ['executionAdmissionDispatchDigest', `sha256:${'7'.repeat(64)}`],
  ['executionAdmissionIdempotencyKey', 'directive:relovo-source-audit-001'],
  ['executionAdmissionMemberId', 'shesh'],
  ['executionAdmissionSchema', 'cambium.goal-graph.execution-admission.v1'],
].map(([key, value]) => ({ key, value }));

function proposal(overrides: Record<string, unknown> = {}, inspect: Record<string, unknown> | null = {}) {
  return {
    changeDigest: DIGEST, nodeId: 'goal_b1236e2a', title: 'Goal proposal · Relovo', summary: 'awaiting founder signature',
    sourceRef: 'telegram:cambium:-100:830', receivedAt: '2026-10-22T09:50:07.000Z', approvalExpiresAt: '2026-10-22T10:05:07.000Z',
    consequence: 'commits on signature', reversibility: 'reversible until signed', expired: false,
    canApprove: true, canReject: true, blockedReason: '', signing: false,
    inspect: inspect && {
      changeDigest: DIGEST, nodeId: 'goal_b1236e2a', workObjectId: 'branch:relovo', workObjectKind: 'branch',
      pinnedLoadoutId: 'loadout:relovo-source-audit', executionAdmission: ADMISSION, admissionState: 'exact',
      consistent: true, issues: [], ...inspect,
    },
    ...overrides,
  };
}
const snapshot = (proposals: unknown[], overrides: Record<string, unknown> = {}) =>
  normalizeGateSnapshot({ state: 'read', signer: 'telegram', label: 'Founder signing ready', proposals, ...overrides });

test('gate folio shows the full change digest, the three anchors and every admission key before signing', () => {
  const [item] = snapshot([proposal()]).proposals;
  const rows = gateInspectRows(item);
  assert.deepEqual(rows.slice(0, 5), [
    { label: 'Change digest', value: DIGEST },
    { label: 'Goal node', value: 'goal_b1236e2a' },
    { label: 'workObjectId', value: 'branch:relovo' },
    { label: 'workObjectKind', value: 'branch' },
    { label: 'pinnedLoadoutId', value: 'loadout:relovo-source-audit' },
  ]);
  assert.deepEqual(rows.slice(5), ADMISSION.map(({ key, value }) => ({ label: key, value })));
  assert.equal(gateAdmissionSummary(item.inspect), 'Exact execution admission · 6 keys');
});

test('gate folio holds closed on malformed snapshots and foreign rows', () => {
  for (const bad of [null, 'read', {}, { proposals: 'none' }]) assert.equal(normalizeGateSnapshot(bad), HELD_GATE);
  const filtered = snapshot([proposal(), proposal({ changeDigest: 'short' }), 'row', null]);
  assert.equal(filtered.proposals.length, 1);
  const item = snapshot([proposal({}, { executionAdmission: [{ key: 'priority', value: 'normal' }, ...ADMISSION] })]).proposals[0];
  assert.equal(item.inspect?.executionAdmission.length, 6, 'only executionAdmission* keys are ever displayed');
});

test('signing needs a Telegram signer, a verified read, a consistent Inspect and an open window', () => {
  const ready = snapshot([proposal()]);
  assert.deepEqual(gateActionState(ready, ready.proposals[0], 'approve-goal-graph'), { enabled: true, reason: '' });
  assert.equal(gateActionState(ready, ready.proposals[0], 'reject-goal-graph').enabled, true);

  const browser = snapshot([proposal()], { signer: 'none' });
  for (const kind of ['approve-goal-graph', 'reject-goal-graph'] as const) {
    const state = gateActionState(browser, browser.proposals[0], kind);
    assert.equal(state.enabled, false);
    assert.match(state.reason, /Open Curious inside Telegram to sign/);
  }
  for (const [label, candidate] of [
    ['checking', snapshot([proposal()], { state: 'checking' })],
    ['held', snapshot([proposal()], { state: 'unknown' })],
    ['no inspect', snapshot([proposal({}, null)])],
    ['inconsistent', snapshot([proposal({}, { consistent: false })])],
    ['issues', snapshot([proposal({}, { issues: ['pinnedLoadoutId differs'] })])],
    ['wrong digest', snapshot([proposal({}, { changeDigest: 'f'.repeat(64) })])],
    ['in flight', snapshot([proposal({ signing: true })])],
    ['host closed', snapshot([proposal({ canApprove: false, canReject: false, blockedReason: 'closed by host' })])],
  ] as const) {
    assert.equal(gateActionState(candidate, candidate.proposals[0], 'approve-goal-graph').enabled, false, label);
    assert.equal(gateActionState(candidate, candidate.proposals[0], 'reject-goal-graph').enabled, false, label);
  }
  const expired = snapshot([proposal({ expired: true, canApprove: true })]);
  assert.equal(gateActionState(expired, expired.proposals[0], 'approve-goal-graph').enabled, false, 'an expired window never approves');
  assert.equal(gateActionState(expired, expired.proposals[0], 'reject-goal-graph').enabled, true);
});

test('gate counts describe the verified read only', () => {
  assert.equal(gateCountLabel(snapshot([])), 'no pending proposals');
  assert.equal(gateCountLabel(snapshot([proposal()])), '1 pending proposal');
  assert.equal(gateCountLabel(snapshot([proposal(), proposal({ changeDigest: 'a'.repeat(64) })])), '2 pending proposals');
  assert.equal(gateCountLabel(HELD_GATE), 'Gate read held');
  assert.equal(gateCountLabel(snapshot([], { state: 'checking' })), 'checking the Gate');
  assert.equal(gateAdmissionSummary(null), 'Founder Inspect not served. Signing stays closed.');
});
