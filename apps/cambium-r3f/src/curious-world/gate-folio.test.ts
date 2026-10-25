import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HELD_GATE, GATE_EXPIRING_MS, gateActionState, gateAdmissionSummary, gateBeacons, gateCountLabel, gateGroups, gateInspectRows,
  gateProposalsAt, gateTrail, normalizeGateSnapshot,
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

test('signing needs a Telegram or founder Access signer, a verified read, a consistent Inspect and an open window', () => {
  const ready = snapshot([proposal()]);
  assert.deepEqual(gateActionState(ready, ready.proposals[0], 'approve-goal-graph'), { enabled: true, reason: '' });
  assert.equal(gateActionState(ready, ready.proposals[0], 'reject-goal-graph').enabled, true);

  const browser = snapshot([proposal()], { signer: 'none' });
  for (const kind of ['approve-goal-graph', 'reject-goal-graph'] as const) {
    const state = gateActionState(browser, browser.proposals[0], kind);
    assert.equal(state.enabled, false);
    assert.match(state.reason, /Sign in at \/founder, or open Curious inside Telegram, to sign/);
  }
  const web = snapshot([proposal({canonicalReview:'complete canonical review'})], { signer: 'access' });
  assert.equal(web.signer, 'access');
  assert.deepEqual(gateActionState(web, web.proposals[0], 'approve-goal-graph'), { enabled: true, reason: '' });
  assert.equal(gateActionState(web, web.proposals[0], 'reject-goal-graph').enabled, true);
  const forged = snapshot([proposal()], { signer: 'cookie' });
  assert.equal(forged.signer, 'none', 'an unknown signer holds the Gate read-only');
  assert.equal(gateActionState(forged, forged.proposals[0], 'approve-goal-graph').enabled, false);
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
  assert.equal(gateActionState(expired, expired.proposals[0], 'reject-goal-graph').enabled, false);
});

test('gate counts describe the verified read only', () => {
  assert.equal(gateCountLabel(snapshot([])), 'no pending proposals');
  assert.equal(gateCountLabel(snapshot([proposal()])), '1 pending proposal');
  assert.equal(gateCountLabel(snapshot([proposal(), proposal({ changeDigest: 'a'.repeat(64) })])), '2 pending proposals');
  assert.equal(gateCountLabel(HELD_GATE), 'Gate read held');
  assert.equal(gateCountLabel(snapshot([], { state: 'checking' })), 'checking the Gate');
  assert.equal(gateAdmissionSummary(null), 'Founder Inspect not served. Signing stays closed.');
});

const D = (n: number) => String(n).repeat(64).slice(0, 64).replace(/[^0-9a-f]/g, 'a');

test('placement is display-only and only the three reviewed landmarks are accepted; anything else stays at the Gate', () => {
  const view = snapshot([
    proposal({ changeDigest: D(1), placement: { landmarkId: 'hands' } }),
    proposal({ changeDigest: D(2), placement: { landmarkId: 'launch-lead' } }),
    proposal({ changeDigest: D(3), placement: { landmarkId: 'auspex' } }),
    proposal({ changeDigest: D(4) }),
  ]);
  assert.deepEqual(view.proposals.map(item => item.placement), [
    { landmarkId: 'hands', districtId: 'plant' },
    { landmarkId: 'launch-lead', districtId: 'growth' },
    { landmarkId: 'gate', districtId: 'purpose' },
    { landmarkId: 'gate', districtId: 'purpose' },
  ]);
  assert.equal(gateProposalsAt(view, 'hands').length, 1);
  assert.deepEqual(gateGroups(view).map(group => [group.landmarkId, group.proposals.length]), [['gate', 2], ['hands', 1], ['launch-lead', 1]]);
  assert.deepEqual(gateProposalsAt(snapshot([proposal({ placement: { landmarkId: 'hands' } })], { state: 'held' }), 'hands'), []);
});

test('beacons show the most urgent state per landmark: signing > expiring > pending > expired', () => {
  const now = Date.parse('2026-10-23T12:00:00.000Z');
  const at = (ms: number) => new Date(now + ms).toISOString();
  const view = snapshot([
    proposal({ changeDigest: D(1), placement: { landmarkId: 'hands' }, approvalExpiresAt: at(10 * 60_000) }),
    proposal({ changeDigest: D(2), placement: { landmarkId: 'hands' }, approvalExpiresAt: at(GATE_EXPIRING_MS - 1000) }),
    proposal({ changeDigest: D(3), placement: { landmarkId: 'launch-lead' }, approvalExpiresAt: at(-1000), expired: true }),
    proposal({ changeDigest: D(4), approvalExpiresAt: at(60 * 60_000), signing: true }),
  ]);
  assert.deepEqual(gateBeacons(view, now).sort((a, b) => a.landmarkId.localeCompare(b.landmarkId)), [
    { landmarkId: 'gate', state: 'signing', count: 1 },
    { landmarkId: 'hands', state: 'expiring', count: 2 },
    { landmarkId: 'launch-lead', state: 'expired', count: 1 },
  ]);
  assert.deepEqual(gateBeacons(snapshot([proposal()], { state: 'checking' }), now), []);
});

test('the trail lights only proven stages of the latest decision; a rejection lights Gate to D1 only', () => {
  const path = (reached: string | null, decision = 'approved') => ({ changeDigest: D(5), title: 'Goal proposal · Relovo', decision, decidedAt: '2026-10-23T12:00:00Z', reached, placement: { landmarkId: 'hands' } });
  assert.deepEqual(gateTrail(snapshot([], { paths: [path('directive-queued')] })).map(item => `${item.stage}:${item.from}>${item.to}`),
    ['committed:gate>d1', 'directive-queued:d1>hermes']);
  assert.deepEqual(gateTrail(snapshot([], { paths: [path('receipt')] })).map(item => item.stage), ['committed', 'directive-queued', 'runner-claimed', 'receipt']);
  assert.deepEqual(gateTrail(snapshot([], { paths: [path(null, 'rejected')] })).map(item => `${item.stage}:${item.from}>${item.to}`), ['rejected:gate>d1']);
  assert.deepEqual(gateTrail(snapshot([], { paths: [path('teleported')] })), [], 'an unknown stage is dropped, never lit');
  assert.deepEqual(gateTrail(snapshot([], { state: 'held', paths: [path('receipt')] })), [], 'a held read lights nothing');
});

test('an expired proposal holds both decisions and explains renewal', () => {
  const view = snapshot([proposal({ expired: true, canApprove: true })]);
  const approve = gateActionState(view, view.proposals[0], 'approve-goal-graph');
  assert.equal(approve.enabled, false);
  assert.match(approve.reason, /Renew and review/);
  assert.equal(gateActionState(view, view.proposals[0], 'reject-goal-graph').enabled, false);
});

test('the world source has no way back to the retired 2D desk', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8');
  assert.equal(source.match(/'2D desk'|'Mission desk|openWorkbench\(|'workbench'/)?.[0] ?? null, null, 'no 2D desk control or workbench link');
  assert.equal(source.match(/else exit\(\)/)?.[0] ?? null, null, 'Escape never leaves the world');
});

 test('Access full review is never truncated and an absent review holds both decisions', () => {
  const complete = JSON.stringify({lineage:{sourceRef:'original'},changeSet:{nodesToCreate:[{description:'x'.repeat(10000)}]}});
  const view=snapshot([proposal({canonicalReview:complete,canRenew:true})],{signer:'access'});
  assert.equal(view.proposals[0].canonicalReview,complete);
  assert.equal(view.proposals[0].canRenew,true);
  const absent=snapshot([proposal()],{signer:'access'});
  assert.equal(absent.proposals[0].canApprove,false);
  assert.equal(absent.proposals[0].canReject,false);
  assert.equal(snapshot([proposal({canRenew:true})]).proposals[0].canRenew,false,'Telegram cannot renew through canonical Access route');
});

test('stale renew-only snapshots cannot sign even when host action flags are true', () => {
  const view=snapshot([proposal({renewOnly:true,canRenew:true,canonicalReview:'full stale review'})],{signer:'access'});
  assert.equal(view.proposals[0].canRenew,true);
  assert.equal(view.proposals[0].canApprove,false);
  assert.equal(view.proposals[0].canReject,false);
  for (const kind of ['approve-goal-graph','reject-goal-graph'] as const) assert.match(gateActionState(view,view.proposals[0],kind).reason,/stale/);
});
