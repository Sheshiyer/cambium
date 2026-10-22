import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { CLIENT_CURIOUS_GATE_BRIDGE } from './page/client/curious-gate-bridge.ts';
import { PAGE } from './page/index.ts';
import { CURIOUS_WORLD_PAGE } from './page/components/curious-world.ts';

const UNREADABLE = '__unreadable_body__';
const DIGEST = '2967cf5be0c5128b850e0fb69e402340589ee0ad4b61c0284acdb07d02d7e5cf';
const INIT_DATA = 'query_id=AAE-test&user=%7B%22id%22%3A424242%7D&auth_date=1783632000&hash=secret-signature';
const ADMISSION = [
  { key: 'executionAdmissionClusterId', value: 'cluster:relovo-source-verification' },
  { key: 'executionAdmissionDirectiveId', value: 'directive:relovo-source-audit-001' },
  { key: 'executionAdmissionDispatchDigest', value: `sha256:${'7'.repeat(64)}` },
  { key: 'executionAdmissionIdempotencyKey', value: 'directive:relovo-source-audit-001' },
  { key: 'executionAdmissionMemberId', value: 'shesh' },
  { key: 'executionAdmissionSchema', value: 'cambium.goal-graph.execution-admission.v1' },
];

function row(overrides: Record<string, unknown> = {}, inspect: Record<string, unknown> | null = {}) {
  return {
    schema: 'cambium.goal-graph-gate-row.v1', kind: 'goal-graph-intake', id: `goal-graph-intake:${DIGEST}`,
    tenantId: 'cambium', status: 'pending', changeDigest: DIGEST, nodeId: 'goal_b1236e2a',
    title: 'Goal proposal · run the admitted Relovo source audit', summary: 'Telegram goal proposal awaiting founder signature',
    source: 'telegram-goal-graph-intake@v1', sourceRef: 'telegram:cambium:-100:830',
    consequence: 'founder signature commits this Telegram goal proposal to the goal graph; no graph write happens before approval',
    reversibility: 'reversible until signed', receivedAt: '2026-10-22T09:50:07.000Z',
    approvalNonce: `goal-graph-approval:cambium:${DIGEST}`, approvalExpiresAt: new Date(Date.now() + 600_000).toISOString(),
    expectedHeadVersion: 4, fence: 5,
    ...(inspect ? {
      founderInspect: {
        schema: 'cambium.goal-graph-founder-inspect.v1', changeDigest: DIGEST, nodeId: 'goal_b1236e2a',
        workObjectId: 'branch:relovo', workObjectKind: 'branch', pinnedLoadoutId: 'loadout:relovo-source-audit',
        executionAdmission: ADMISSION, admissionState: 'exact', consistent: true, issues: [], ...inspect,
      },
    } : {}),
    ...overrides,
  };
}

function envelope(rows: unknown[], list: Record<string, unknown> = {}) {
  return {
    schema: 1, tenant: 'cambium', derivedAt: new Date().toISOString(), ledger: { rows: [] },
    goalGraphIntake: { schema: 'cambium.goal-graph-gate-row-list.v1', ok: true, tenantId: 'cambium', count: rows.length, rows, ...list },
  };
}

function harness(options: { initData?: string; respond?: (body: Record<string, unknown>) => unknown } = {}) {
  const requests: Array<{ url: string; init: { method?: string; body?: string } }> = [];
  let refreshes = 0;
  const context = vm.createContext({
    TENANT: 'cambium',
    initData: options.initData ?? INIT_DATA,
    refresh: () => { refreshes += 1; },
    fetch: async (url: string, init: { method?: string; body?: string }) => {
      requests.push({ url, init });
      const reply = options.respond ? options.respond(JSON.parse(String(init.body))) : { status: 200, body: { ok: true, committed: true, duplicate: false } };
      if (reply instanceof Error) throw reply;
      const { status, body } = reply as { status: number; body: unknown };
      return { ok: status >= 200 && status < 300, status, json: async () => { if (body === UNREADABLE) throw new SyntaxError('unreadable'); return body; } };
    },
  });
  vm.runInContext(CLIENT_CURIOUS_GATE_BRIDGE, context);
  const run = (code: string) => vm.runInContext(code, context);
  return {
    run,
    requests,
    refreshes: () => refreshes,
    quest: (env: unknown, revision = 1) => run(`CuriousGateBridge.quest(${JSON.stringify(env)}, ${revision})`),
    get: () => JSON.parse(run('JSON.stringify(CuriousGateBridge.get())')),
    sign: async (kind: string, digest = DIGEST) => JSON.parse(JSON.stringify(await run(`CuriousGateBridge.sign(${JSON.stringify(kind)}, ${JSON.stringify(digest)})`))),
  };
}

test('world gate · a Telegram founder read exposes the full digest, anchors and every admission key', () => {
  const h = harness();
  h.quest(envelope([row()]));
  const snapshot = h.get();
  assert.equal(snapshot.state, 'read');
  assert.equal(snapshot.signer, 'telegram');
  assert.equal(snapshot.label, 'Founder signing ready');
  const [proposal] = snapshot.proposals;
  assert.equal(proposal.changeDigest, DIGEST);
  assert.equal(proposal.inspect.changeDigest, DIGEST);
  assert.equal(proposal.inspect.workObjectId, 'branch:relovo');
  assert.equal(proposal.inspect.workObjectKind, 'branch');
  assert.equal(proposal.inspect.pinnedLoadoutId, 'loadout:relovo-source-audit');
  assert.deepEqual(proposal.inspect.executionAdmission, ADMISSION);
  assert.equal(proposal.canApprove, true);
  assert.equal(proposal.canReject, true);
  // The world never receives credentials or replay material.
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /secret-signature|query_id|approvalNonce|goal-graph-approval:/);
  assert.deepEqual(Object.keys(snapshot).sort(), ['label', 'proposals', 'signer', 'state']);
});

test('world gate · outside Telegram every proposal is read-only and sign never reaches the network', async () => {
  const h = harness({ initData: '' });
  h.quest(envelope([row()]));
  const snapshot = h.get();
  assert.equal(snapshot.signer, 'none');
  assert.equal(snapshot.label, 'Read-only · open in Telegram to sign');
  assert.equal(snapshot.proposals[0].canApprove, false);
  assert.equal(snapshot.proposals[0].canReject, false);
  assert.match(snapshot.proposals[0].blockedReason, /Open Curious inside Telegram to sign/);
  for (const kind of ['approve-goal-graph', 'reject-goal-graph']) {
    const result = await h.sign(kind);
    assert.equal(result.ok, false);
    assert.equal(result.outcome, 'blocked');
  }
  assert.equal(h.requests.length, 0);
});

test('world gate · missing, inconsistent or tampered Inspect keeps signing closed', async () => {
  const cases: Array<[string, unknown]> = [
    ['missing', row({}, null)],
    ['inconsistent', row({}, { consistent: false, issues: ['pinnedLoadoutId differs between the change set and the stored node'] })],
    ['issues', row({}, { issues: ['too many admission keys to inspect'] })],
    ['wrong digest', row({}, { changeDigest: 'f'.repeat(64) })],
    ['foreign key', row({}, { executionAdmission: [{ key: 'priority', value: 'normal' }] })],
    ['object value', row({}, { pinnedLoadoutId: { nested: true } })],
  ];
  for (const [label, candidate] of cases) {
    const h = harness();
    h.quest(envelope([candidate]));
    const [proposal] = h.get().proposals;
    assert.equal(proposal.canApprove, false, label);
    assert.equal(proposal.canReject, false, label);
    assert.equal((await h.sign('approve-goal-graph')).outcome, 'blocked', label);
    assert.equal(h.requests.length, 0, label);
  }
  const notFounder = harness();
  notFounder.quest(envelope([row({}, null)]));
  assert.equal(notFounder.get().label, 'Read-only · this Telegram account is not a verified founder');
});

test('world gate · only pending Telegram proposals for this tenant are listed; malformed lists hold', () => {
  const h = harness();
  h.quest(envelope([
    row(),
    row({ tenantId: 'other' }),
    row({ status: 'committed' }),
    row({ source: 'fitcheck-founder-outcome@v1' }),
    row({ changeDigest: 'not-a-digest' }),
    row({ approvalExpiresAt: 'never' }),
    row({ approvalNonce: '' }),
  ]));
  assert.equal(h.get().proposals.length, 1);
  for (const bad of [envelope([row()], { tenantId: 'other' }), envelope([row()], { schema: 'unknown' }), { ...envelope([row()]), tenant: 'other' }]) {
    const held = harness();
    held.quest(bad);
    assert.equal(held.get().state, 'held');
    assert.equal(held.get().proposals.length, 0);
  }
  const empty = harness();
  empty.quest({ schema: 1, tenant: 'cambium', derivedAt: new Date().toISOString(), ledger: { rows: [] } });
  assert.equal(empty.get().state, 'read');
  assert.deepEqual(empty.get().proposals, []);
});

test('world gate · read lifecycle holds, checks and ignores older revisions', () => {
  const h = harness();
  h.quest(envelope([row()]), 2);
  h.run('CuriousGateBridge.pending(3)');
  assert.equal(h.get().state, 'checking');
  assert.equal(h.get().proposals[0].canApprove, false, 'no signing while a read is in flight');
  h.run('CuriousGateBridge.hold("auth", 3)');
  assert.equal(h.get().state, 'held');
  assert.equal(h.get().proposals.length, 0);
  h.quest(envelope([row()]), 1);
  assert.equal(h.get().state, 'held', 'an older read never revives a held gate');
  h.run('var seen=[];var off=CuriousGateBridge.subscribe(s=>seen.push(s.state));CuriousGateBridge.pending(4);off();CuriousGateBridge.hold("offline",5)');
  assert.equal(h.run('JSON.stringify(seen)'), '["held","checking"]');
});

test('world gate · approve posts the existing /api/gate contract with Telegram initData and the served descriptor', async () => {
  const h = harness();
  const listed = row();
  h.quest(envelope([listed]));
  const result = await h.sign('approve-goal-graph');
  assert.deepEqual(result, { ok: true, outcome: 'committed', message: 'Approved · committed to the goal graph.' });
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, '/api/gate/cambium');
  assert.equal(h.requests[0].init.method, 'POST');
  const payload = JSON.parse(String(h.requests[0].init.body));
  assert.equal(payload.kind, 'approve-goal-graph');
  assert.equal(payload.subject, DIGEST);
  assert.equal(payload.initData, INIT_DATA);
  assert.equal(payload.nonce, listed.approvalNonce);
  assert.equal(payload.expiresAt, listed.approvalExpiresAt);
  assert.equal(payload.idempotencyKey, `approve-goal-graph:cambium:${DIGEST}`);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(h.refreshes(), 1);
});

test('world gate · reject signs the same route and an expired window still allows only rejection', async () => {
  const h = harness({ respond: (body) => ({ status: 200, body: { ok: true, rejected: body.kind === 'reject-goal-graph', committed: false, duplicate: false } }) });
  h.quest(envelope([row({ approvalExpiresAt: new Date(Date.now() - 1000).toISOString() })]));
  const [proposal] = h.get().proposals;
  assert.equal(proposal.expired, true);
  assert.equal(proposal.canApprove, false);
  assert.equal(proposal.canReject, true);
  assert.equal((await h.sign('approve-goal-graph')).outcome, 'blocked');
  assert.equal(h.requests.length, 0);
  const rejected = await h.sign('reject-goal-graph');
  assert.equal(rejected.outcome, 'rejected');
  assert.equal(JSON.parse(String(h.requests[0].init.body)).kind, 'reject-goal-graph');
});

test('world gate · only readable refusals and the auth gate claim no write; everything else is unconfirmed and read back', async () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const refusal = harness({ respond: () => ({ status: 409, body: { ok: false, error: 'goal_graph_stale_head' } }) });
  refusal.quest(envelope([row()]));
  assert.deepEqual(await refusal.sign('approve-goal-graph'), { ok: false, outcome: 'refused', message: 'Refused · no write · goal_graph_stale_head.' });
  await tick();
  assert.equal(refusal.refreshes(), 1, 'even a refusal is read back');

  const auth = harness({ respond: () => ({ status: 401, body: { error: 'not a founder' } }) });
  auth.quest(envelope([row()]));
  assert.equal((await auth.sign('reject-goal-graph')).outcome, 'auth');

  const uncertain: Array<[string, () => unknown, RegExp]> = [
    ['reconciliation', () => ({ status: 503, body: { error: 'goal_graph_commit_reconciliation_required' } }), /may already hold this approval/],
    ['server error', () => ({ status: 503, body: { error: 'goal_graph_commit_unavailable' } }), /Outcome unconfirmed/],
    ['unreadable 200', () => ({ status: 200, body: UNREADABLE }), /Outcome unconfirmed/],
    ['unreadable 409', () => ({ status: 409, body: UNREADABLE }), /Outcome unconfirmed/],
    ['receipt-less 200', () => ({ status: 200, body: { ok: true } }), /Outcome unconfirmed/],
    ['dropped response', () => new Error('offline'), /Network failure · the outcome is unconfirmed/],
  ];
  for (const [label, respond, message] of uncertain) {
    const h = harness({ respond });
    h.quest(envelope([row()]));
    const result = await h.sign('approve-goal-graph');
    assert.equal(result.ok, false, label);
    assert.equal(result.outcome, 'uncertain', label);
    assert.match(result.message, message, label);
    assert.doesNotMatch(result.message, /no write/, `${label} never claims no write`);
    await tick();
    assert.equal(h.refreshes(), 1, `${label} is read back`);
  }

  const twice = harness();
  twice.quest(envelope([row()]));
  const first = twice.sign('approve-goal-graph');
  assert.equal(twice.get().proposals[0].signing, true);
  assert.equal((await twice.sign('reject-goal-graph')).outcome, 'blocked');
  await first;
  assert.equal(twice.requests.length, 1);
  assert.equal((await twice.sign('promote-skill')).outcome, 'blocked');
});

test('world gate · the page owns the bridge and the world host passes only gate accessors', () => {
  assert.ok(PAGE.includes('const CuriousGateBridge = (() => {'));
  assert.ok(PAGE.indexOf('const CuriousGateBridge') < PAGE.indexOf('CuriousGateBridge.quest(env'));
  assert.match(CURIOUS_WORLD_PAGE, /getGateState:\(\) => CuriousGateBridge\.get\(\)/);
  assert.match(CURIOUS_WORLD_PAGE, /signGate:\(kind, changeDigest\) => CuriousGateBridge\.sign\(kind, changeDigest\)/);
  const host = CURIOUS_WORLD_PAGE.slice(CURIOUS_WORLD_PAGE.lastIndexOf('<script>'));
  assert.match(host, /CuriousGateBridge/);
  assert.doesNotMatch(host, /initData|fetch\(/, 'the world host never handles credentials or the network');
});
