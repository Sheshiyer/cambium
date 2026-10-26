import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { reviewConfirmation } from '../../../bin/founder-gate.mjs';
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

function harness(options: { initData?: string; founderWeb?: boolean; session?: Record<string,unknown>; respond?: (body: Record<string, unknown>, url: string) => unknown } = {}) {
  const requests: Array<{ url: string; init: { method?: string; body?: string; credentials?: string; headers?: Record<string, string> } }> = [];
  let refreshes = 0;
  const context = vm.createContext({
    crypto:webcrypto, TextEncoder, Uint8Array,
    TENANT: 'cambium',
    initData: options.initData ?? INIT_DATA,
    FOUNDER_WEB: options.founderWeb === true,
    API_BASE: options.founderWeb === true ? '/founder' : '',
    refresh: () => { refreshes += 1; },
    fetch: async (url: string, init: { method?: string; body?: string; credentials?: string; headers?: Record<string, string> }) => {
      requests.push({ url, init });
      const reply = url.endsWith('/session') ? {status:200,body:options.session ?? {founderId:'founder:opaque',enrolled:true,canonicalReady:true,tenantIds:['cambium'],writerAuthority:false}} : options.respond ? options.respond(JSON.parse(String(init.body)), url) : { status: 200, body: { ok: true, committed: true, duplicate: false } };
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
    review: async (digest = DIGEST) => JSON.parse(JSON.stringify(await run(`CuriousGateBridge.review(${JSON.stringify(digest)})`))),
    readDecision: async (digest = DIGEST) => JSON.parse(JSON.stringify(await run(`CuriousGateBridge.readDecision(${JSON.stringify(digest)})`))),
    renew: async (digest = DIGEST) => JSON.parse(JSON.stringify(await run(`CuriousGateBridge.renew(${JSON.stringify(digest)})`))),
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
  assert.deepEqual(Object.keys(snapshot).sort(), ['decisions', 'label', 'paths', 'proposals', 'signer', 'state']);
});

test('world gate · outside Telegram every proposal is read-only and sign never reaches the network', async () => {
  const h = harness({ initData: '' });
  h.quest(envelope([row()]));
  const snapshot = h.get();
  assert.equal(snapshot.signer, 'none');
  assert.equal(snapshot.label, 'Read-only · sign in at /founder to sign');
  assert.equal(snapshot.proposals[0].canApprove, false);
  assert.equal(snapshot.proposals[0].canReject, false);
  assert.match(snapshot.proposals[0].blockedReason, /Sign in at \/founder, or open Curious inside Telegram, to sign/);
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

test('world gate · expiry disables both decisions without network writes', async () => {
  const h = harness();
  h.quest(envelope([row({ approvalExpiresAt: new Date(Date.now() - 1000).toISOString() })]));
  const [proposal] = h.get().proposals;
  assert.equal(proposal.expired, true);
  assert.equal(proposal.canApprove, false);
  assert.equal(proposal.canReject, false);
  for (const kind of ['approve-goal-graph','reject-goal-graph']) assert.equal((await h.sign(kind)).outcome,'blocked');
  assert.equal(h.requests.length,0);
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

function canonicalFixture(listed = row()) {
  const review = {...listed, graphVersion:5, fence:5, expectedHeadVersion:4,
    changeSet:{tenantId:'cambium',changeDigest:listed.changeDigest,graphVersion:5,nodesToCreate:[{id:'goal',title:'Complete long title',description:'x'.repeat(1000)}],nodesToUpdate:[],nodesToRemove:[]}};
  const p = {proposalId:`cambium:${listed.changeDigest}`,tenantId:'cambium',version:1,changeDigest:listed.changeDigest,
    nonce:listed.approvalNonce,expiresAt:listed.approvalExpiresAt,
    summary:`${listed.summary} Consequence: ${listed.consequence} Reversibility: ${listed.reversibility}`,review};
  return {status:'review',writerAuthority:false,proposal:p,approveConfirmation:reviewConfirmation(p,'approved'),rejectConfirmation:reviewConfirmation(p,'rejected')};
}
function settled(input: Record<string,unknown>, overrides = {}) {
  return {status:input.decision,canonicalReadback:true,writerAuthority:false,receiptDigest:'a'.repeat(64),
    receipt:{...input,tenantId:'cambium',founderId:'founder:opaque',decidedAt:new Date().toISOString(),channel:'curious'},...overrides};
}
test('world gate · Access requires a complete independently bound review, then uses canonical seven-field tuple', async () => {
  const listed = row({version:1}); const full = canonicalFixture(listed);
  const h = harness({initData:'',founderWeb:true,respond:(body,url) => ({status:200,body:url.endsWith('/proposal') ? full : settled(body)})});
  h.quest(envelope([listed]));
  assert.equal((await h.sign('approve-goal-graph')).outcome,'blocked');
  assert.equal(h.requests.length,0);
  assert.equal((await h.review()).ok,true);
  assert.ok(h.get().proposals[0].canonicalReview.includes('x'.repeat(1000)));
  assert.equal(h.get().proposals[0].canApprove,true);
  assert.equal((await h.sign('approve-goal-graph')).outcome,'approved');
  const request = h.requests.find(item => item.url.endsWith('/decision'))!;
  assert.equal(request.url,'/v1/founder/decision');
  assert.deepEqual(Object.keys(JSON.parse(request.init.body!)).sort(),['changeDigest','confirmation','decision','expiresAt','nonce','proposalId','version']);
  assert.equal(request.init.headers?.['x-cambium-founder-web'],'1');
});
test('world gate · tampered review or refreshed fence cannot authorize a decision', async () => {
  const listed = row({version:1}); const full = canonicalFixture(listed);
  const h = harness({initData:'',founderWeb:true,respond:() => ({status:200,body:full})});
  h.quest(envelope([listed])); await h.review();
  full.proposal.review.changeSet.nodesToCreate[0].description = 'changed';
  assert.equal((await h.sign('approve-goal-graph')).outcome,'blocked');
  assert.ok(!h.requests.some(item => item.url.endsWith('/decision')));
});
test('world gate · lost decision response performs one status read of the original tuple and never resubmits', async () => {
  const listed=row({version:1}); const full=canonicalFixture(listed);
  const h=harness({initData:'',founderWeb:true,respond:(body,url) => url.endsWith('/decision') ? new Error('dropped') : {status:200,body:url.endsWith('/proposal') ? full : settled(body)}});
  h.quest(envelope([listed])); await h.review();
  assert.equal((await h.sign('approve-goal-graph')).ok,true);
  assert.equal(h.requests.filter(item => item.url.endsWith('/decision')).length,1);
  assert.equal(h.requests.filter(item => item.url.endsWith('/status')).length,1);
  assert.equal(h.requests.find(item=>item.url.endsWith('/decision'))!.init.body,h.requests.find(item=>item.url.endsWith('/status'))!.init.body);
});
test('world gate · receipt mismatch and failed status hold subsequent decisions', async () => {
  const listed=row({version:1}); const full=canonicalFixture(listed);
  const h=harness({initData:'',founderWeb:true,respond:(body,url)=>({status:200,body:url.endsWith('/proposal')?full:settled({...body,nonce:'wrong'})})});
  h.quest(envelope([listed])); await h.review();
  assert.equal((await h.sign('approve-goal-graph')).outcome,'uncertain');
  await h.review();
  assert.equal((await h.sign('approve-goal-graph')).outcome,'blocked');
  assert.equal(h.requests.filter(item=>item.url.endsWith('/decision')).length,1);
});
test('world gate · expired renewal fetches the new complete review before enabling a fresh decision', async () => {
  const old=row({version:1,canRenew:true,approvalExpiresAt:new Date(Date.now()-1000).toISOString()});
  const fresh=row({version:1,changeDigest:'b'.repeat(64),source:'founder-proposal-renewal@v1',approvalNonce:'fresh-nonce'});
  fresh.founderInspect!.changeDigest=fresh.changeDigest;
  const newer=canonicalFixture(fresh);
  const h=harness({initData:'',founderWeb:true,respond:(body,url)=>({status:200,body:url.endsWith('/renew')
    ? {status:'renewed',writerAuthority:false,proposalId:newer.proposal.proposalId,changeDigest:fresh.changeDigest,version:1,expiresAt:fresh.approvalExpiresAt}
    : url.endsWith('/proposal') ? body.proposalId===newer.proposal.proposalId ? newer : canonicalFixture(old) : settled(body)})});
  h.quest(envelope([old]));
  assert.equal(h.get().proposals[0].canRenew,true);
  assert.equal(h.get().proposals[0].canReject,false);
  const outcome=await h.renew(); assert.equal(outcome.ok,true);
  assert.equal(h.get().proposals[0].changeDigest,fresh.changeDigest);
  assert.ok(h.get().proposals[0].canonicalReview);
  assert.equal((await h.sign('approve-goal-graph',fresh.changeDigest)).ok,true);
  const renewal=JSON.parse(h.requests.find(item=>item.url.endsWith('/renew'))!.init.body!);
  assert.deepEqual(Object.keys(renewal).sort(),['changeDigest','expiresAt','nonce','proposalId','version']);
});
test('world gate · enrollment failure is actionable and review never writes', async () => {
  for (const status of [401,403,503]) {
    const h=harness({initData:'',founderWeb:true,respond:()=>({status,body:{status:'unknown'}})});
    h.quest(envelope([row()]));
    const outcome=await h.review(); assert.equal(outcome.ok,false); assert.match(outcome.message,/founder|Founder/);
    assert.ok(h.requests.every(item=>item.url.endsWith('/proposal') || item.url.endsWith('/session')));
  }
});

test('world gate · placement and decision paths pass through sanitized; unknown places and stages never reach the world', () => {
  const h = harness();
  const env = {
    ...envelope([row({ placement: { landmarkId: 'hands', districtId: 'plant' } }), row({ changeDigest: 'b'.repeat(64), placement: { landmarkId: 'vault' } })]),
    goalGraphDecisions: { schema: 'cambium.goal-graph-path.v1', ok: true, tenantId: 'cambium', rows: [
      { changeDigest: 'c'.repeat(64), title: 'Goal proposal · Relovo', decision: 'approved', decidedAt: '2026-10-23T12:00:00Z', reached: 'directive-queued', placement: { landmarkId: 'hands' } },
      { changeDigest: 'd'.repeat(64), title: 'x', decision: 'approved', reached: 'teleported' },
      { changeDigest: 'e'.repeat(64), title: 'y', decision: 'maybe', reached: null },
      { changeDigest: 'f'.repeat(64), title: 'z', decision: 'approved', reached: 'committed', memberId: 'shesh', directiveId: 'directive:x' },
    ] },
  };
  h.quest(env);
  const snapshot = h.get();
  assert.deepEqual(snapshot.proposals.map((item: { placement: unknown }) => item.placement), [
    { landmarkId: 'hands', districtId: 'plant' }, { landmarkId: 'gate', districtId: 'purpose' },
  ]);
  assert.deepEqual(snapshot.paths.map((item: { changeDigest: string; reached: string }) => [item.changeDigest[0], item.reached]), [['c', 'directive-queued'], ['f', 'committed']]);
  assert.doesNotMatch(JSON.stringify(snapshot.paths), /shesh|directive:x/, 'only the sanitized path fields reach the world');

  const wrongTenant = harness();
  wrongTenant.quest({ ...env, goalGraphDecisions: { ...env.goalGraphDecisions, tenantId: 'other' } });
  assert.deepEqual(wrongTenant.get().paths, []);
  h.run('CuriousGateBridge.hold("auth", 2)');
  assert.deepEqual(h.get().paths, [], 'a held read drops paths');
});

test('world gate · session exposes the verified opaque identity without enrolling or admitting wildcard tenants', async () => {
  for (const session of [
    {founderId:'founder:target',enrolled:false,canonicalReady:false,tenantIds:[],writerAuthority:false},
    {founderId:'founder:target',enrolled:true,canonicalReady:true,tenantIds:['*'],writerAuthority:false},
  ]) {
    const h=harness({initData:'',founderWeb:true,session}); h.quest(envelope([row()]));
    assert.equal((await h.review()).ok,false);
    assert.match(h.get().label,/founder:target/);
    assert.equal(h.get().proposals[0].canApprove,false);
    assert.ok(h.requests.every(item=>item.url.endsWith('/session')));
  }
});
test('world gate · unreadable and 5xx decisions use one canonical status and explicit duplicate receipts', async () => {
  for (const failure of [{status:200,body:UNREADABLE},{status:503,body:{status:'unknown'}}]) {
    const listed=row({version:1}); const full=canonicalFixture(listed);
    const h=harness({initData:'',founderWeb:true,respond:(body,url)=>url.endsWith('/decision') ? failure : {status:200,body:url.endsWith('/proposal') ? full : settled(body,{duplicate:true})}});
    h.quest(envelope([listed])); await h.review();
    const outcome=await h.sign('approve-goal-graph'); assert.equal(outcome.ok,true);
    assert.equal(outcome.decision.receipt.founderId,'founder:opaque');
    assert.equal(h.requests.filter(item=>item.url.endsWith('/status')).length,1);
    assert.equal(h.requests.filter(item=>item.url.endsWith('/decision')).length,1);
  }
});

test('world gate · only explicitly supported stale revisions can read and renew; fresh pending review enables decisions', async () => {
  const stale=row({status:'stale',version:1,renewOnly:true,canRenew:true});
  const fresh=row({version:1,changeDigest:'c'.repeat(64),source:'founder-proposal-renewal@v1',approvalNonce:'renewed-stale-nonce'});
  fresh.founderInspect!.changeDigest=fresh.changeDigest;
  const newer=canonicalFixture(fresh);
  const h=harness({initData:'',founderWeb:true,respond:(body,url)=>({status:200,body:url.endsWith('/renew')
    ? {status:'renewed',writerAuthority:false,proposalId:newer.proposal.proposalId,changeDigest:fresh.changeDigest,version:1,expiresAt:fresh.approvalExpiresAt}
    : url.endsWith('/proposal') ? body.proposalId===newer.proposal.proposalId ? newer : canonicalFixture(stale) : settled(body)})});
  h.quest(envelope([stale]));
  assert.equal(h.get().proposals.length,1);
  assert.equal(h.get().proposals[0].expired,false);
  assert.equal((await h.review()).ok,true);
  assert.ok(h.get().proposals[0].canonicalReview);
  assert.equal(h.get().proposals[0].renewOnly,true);
  for (const kind of ['approve-goal-graph','reject-goal-graph']) assert.equal((await h.sign(kind)).outcome,'blocked');
  assert.equal(h.get().proposals[0].canRenew,true);
  assert.equal(h.requests.filter(item=>item.url.endsWith('/decision')).length,0);
  const renewed=await h.renew(); assert.equal(renewed.ok,true);
  assert.equal(h.get().proposals[0].renewOnly,false);
  assert.equal(h.get().proposals[0].canApprove,true);
  assert.equal((await h.sign('approve-goal-graph',fresh.changeDigest)).ok,true);
  for (const malformed of [row({status:'stale'}),row({status:'stale',canRenew:true}),row({status:'stale',renewOnly:true}),row({status:'committed',canRenew:true,renewOnly:true})]) {
    h.quest(envelope([malformed]),2);
    assert.equal(h.get().proposals.length,0);
  }
});

test('world gate · closed renewal reasons are actionable and never approve, invent a receipt, or retry', async () => {
  const expected = {
    already_applied:/already present in the goal graph/,
    already_decided:/inspect its canonical receipt/,
    not_renewable:/does not currently qualify for renewal/,
    conflict:/proposal state conflicts/,
    changed:/proposal changed since this review/,
  };
  for (const [status,message] of Object.entries(expected)) {
    const old=row({version:1,canRenew:true,approvalExpiresAt:new Date(Date.now()-1000).toISOString()});
    const h=harness({initData:'',founderWeb:true,respond:(_body,url)=>url.endsWith('/renew')
      ? {status:409,body:{status,writerAuthority:false}} : {status:200,body:canonicalFixture(old)}});
    h.quest(envelope([old]));
    const outcome=await h.renew();
    assert.equal(outcome.ok,false,status);
    assert.equal(outcome.outcome,'blocked',status);
    assert.match(outcome.message,new RegExp(status));
    assert.match(outcome.message,message);
    assert.equal(h.requests.filter(item=>item.url.endsWith('/renew')).length,1);
    assert.equal(h.requests.filter(item=>item.url.endsWith('/decision')).length,0);
    assert.equal(h.requests.filter(item=>item.url.endsWith('/status')).length,0);
    assert.equal(h.get().proposals[0].canApprove,false);
    assert.equal(h.get().proposals[0].canReject,false);
    assert.equal(h.get().proposals[0].canonicalReview,null);
    assert.equal('receipt' in outcome,false);
  }
});
test('world gate · unknown renewal status stays held without claiming success', async () => {
  const old=row({version:1,canRenew:true,approvalExpiresAt:new Date(Date.now()-1000).toISOString()});
  const h=harness({initData:'',founderWeb:true,respond:(_body,url)=>url.endsWith('/renew')
    ? {status:409,body:{status:'unexpected',writerAuthority:false}} : {status:200,body:canonicalFixture(old)}});
  h.quest(envelope([old]));
  const outcome=await h.renew(); assert.equal(outcome.ok,false); assert.equal(outcome.outcome,'blocked');
  assert.match(outcome.message,/Renewal was not confirmed/);
  assert.equal(h.requests.filter(item=>item.url.endsWith('/renew')).length,1);
  assert.equal(h.requests.filter(item=>item.url.endsWith('/decision')).length,0);
});

test('world gate · a just-renewed canonical revision survives lagging lists but canonical settlement removes it', async () => {
  const old=row({version:1,canRenew:true,approvalExpiresAt:new Date(Date.now()-1000).toISOString()});
  const fresh=row({version:2,changeDigest:'d'.repeat(64),source:'founder-proposal-renewal@v1',approvalNonce:'lag-safe-nonce'});
  fresh.founderInspect!.changeDigest=fresh.changeDigest;
  const newer=canonicalFixture(fresh); newer.proposal.version=2;
  newer.approveConfirmation=reviewConfirmation(newer.proposal,'approved'); newer.rejectConfirmation=reviewConfirmation(newer.proposal,'rejected');
  const h=harness({initData:'',founderWeb:true,respond:(body,url)=>({status:200,body:url.endsWith('/renew')
    ? {status:'renewed',writerAuthority:false,proposalId:newer.proposal.proposalId,changeDigest:fresh.changeDigest,version:2,expiresAt:fresh.approvalExpiresAt}
    : url.endsWith('/proposal') ? body.proposalId===newer.proposal.proposalId ? newer : canonicalFixture(old) : settled(body)})});
  h.quest(envelope([old])); assert.equal((await h.renew()).ok,true);
  h.quest(envelope([old]),2);
  assert.equal(h.get().proposals.length,1); assert.equal(h.get().proposals[0].changeDigest,fresh.changeDigest);
  assert.ok(h.get().proposals[0].canonicalReview); assert.equal(h.get().proposals[0].canApprove,true);
  assert.equal(h.requests.filter(item=>item.url.endsWith('/decision')).length,0);
  assert.equal((await h.review(fresh.changeDigest)).ok,true);
  assert.equal((await h.sign('approve-goal-graph',fresh.changeDigest)).ok,true);
  assert.equal(h.requests.filter(item=>item.url.endsWith('/decision')).length,1);
  assert.equal(h.get().proposals.length,0);
  h.quest(envelope([fresh]),3);
  assert.equal(h.get().proposals.length,0,'a lagging pending list cannot resurrect a canonical receipt settlement');
});
test('world gate · changed projected tuple invalidates the retained renewed review before any decision', async () => {
  const old=row({version:1,canRenew:true,approvalExpiresAt:new Date(Date.now()-1000).toISOString()});
  const fresh=row({version:1,changeDigest:'e'.repeat(64),source:'founder-proposal-renewal@v1',approvalNonce:'tuple-original'});
  fresh.founderInspect!.changeDigest=fresh.changeDigest; const newer=canonicalFixture(fresh);
  const h=harness({initData:'',founderWeb:true,respond:(body,url)=>({status:200,body:url.endsWith('/renew')
    ? {status:'renewed',writerAuthority:false,proposalId:newer.proposal.proposalId,changeDigest:fresh.changeDigest,version:1,expiresAt:fresh.approvalExpiresAt}
    : url.endsWith('/proposal') ? body.proposalId===newer.proposal.proposalId ? newer : canonicalFixture(old) : settled(body)})});
  h.quest(envelope([old])); await h.renew();
  h.quest(envelope([{...fresh,approvalNonce:'tuple-changed'}]),2);
  assert.equal(h.get().proposals[0].canonicalReview,null);
  assert.equal(h.get().proposals[0].canApprove,false);
  assert.equal((await h.sign('approve-goal-graph',fresh.changeDigest)).outcome,'blocked');
  assert.equal(h.requests.filter(item=>item.url.endsWith('/decision')).length,0);
  h.quest(envelope([old]),3);
  assert.ok(!h.get().proposals.some((item:{changeDigest:string})=>item.changeDigest===fresh.changeDigest),'invalidated canonical overlay is not restored later');
});

test('world gate · recorded context survives held queue and reopen reads original receipt tuple only',async()=>{
 const listed=row({version:1}),full=canonicalFixture(listed);let drift=false;
 const h=harness({initData:'',founderWeb:true,respond:(body,url)=>({status:200,body:url.endsWith('/proposal') ? (drift ? {...full,proposal:{...full.proposal,nonce:'changed'}} : full) : settled(body)})});
 h.quest(envelope([listed]));await h.review();const outcome=await h.sign('approve-goal-graph');assert.ok(outcome.decision);
 const original=h.requests.find(r=>r.url.endsWith('/decision'))!;
 h.run('CuriousGateBridge.hold("unavailable",2)');assert.equal(h.get().state,'held');assert.equal(h.get().decisions.length,1);assert.equal(h.get().decisions[0].context.changeDigest,DIGEST);
 drift=true;const before=h.requests.length;const reopened=await h.readDecision();assert.equal(reopened.decision.receipt.nonce,listed.approvalNonce);
 const newRequests=h.requests.slice(before);assert.equal(newRequests.filter(r=>r.url.endsWith('/proposal')||r.url.endsWith('/decision')).length,0);
 const status=JSON.parse(newRequests.find(r=>r.url.endsWith('/status'))!.init.body!);const old=JSON.parse(original.init.body!);assert.deepEqual(Object.keys(status).sort(),['changeDigest','confirmation','decision','expiresAt','nonce','proposalId','version']);for(const key of ['proposalId','version','changeDigest','nonce','expiresAt'])assert.equal(status[key],old[key]);
});
test('world gate · uncertain recovery retains original request despite missing or changed queue',async()=>{
 const listed=row({version:1}),full=canonicalFixture(listed);let available=false;
 const h=harness({initData:'',founderWeb:true,respond:(body,url)=>url.endsWith('/proposal') ? {status:200,body:full} : !available ? new Error('dropped') : {status:200,body:settled(body)}});
 h.quest(envelope([listed]));await h.review();assert.equal((await h.sign('reject-goal-graph')).outcome,'uncertain');
 const submitted=h.requests.find(r=>r.url.endsWith('/decision'))!.init.body;
 h.quest(envelope([row({approvalNonce:'changed',version:2})]),2);available=true;const before=h.requests.length;const recovered=await h.readDecision();
 assert.equal(recovered.decision.requestedDecision,'rejected');assert.equal(h.requests.slice(before).find(r=>r.url.endsWith('/status'))!.init.body,submitted);assert.equal(h.requests.filter(r=>r.url.endsWith('/decision')).length,1);
});
test('world gate · opposite decision is structured conflict; historical rejection has no fabricated request',async()=>{
 const listed=row({version:1}),full=canonicalFixture(listed);
 const respond=(body:Record<string,unknown>,url:string)=>({status:200,body:url.endsWith('/proposal') ? full : settled(body,{status:'conflict',receipt:{...(settled(body).receipt),decision:'rejected'}})});
 const h=harness({initData:'',founderWeb:true,respond});h.quest(envelope([listed]));await h.review();const conflict=await h.sign('approve-goal-graph');assert.equal(conflict.decision.requestedDecision,'approved');assert.equal(conflict.decision.receipt.decision,'rejected');assert.equal(conflict.ok,false);
 const historical=harness({initData:'',founderWeb:true,respond});const record=await historical.readDecision();assert.equal(record.decision.requestedDecision,null);assert.equal(record.decision.receipt.decision,'rejected');assert.equal(historical.requests.filter(r=>r.url.endsWith('/decision')).length,0);
});
test('world gate · success-looking text cannot record a canonical decision',async()=>{
 const listed=row({version:1}),full=canonicalFixture(listed);const h=harness({initData:'',founderWeb:true,respond:(_body,url)=>({status:200,body:url.endsWith('/proposal')?full:{message:'Canonical receipt approved',writerAuthority:false,canonicalReadback:true}})});
 h.quest(envelope([listed]));await h.review();assert.equal((await h.sign('approve-goal-graph')).outcome,'uncertain');assert.deepEqual(h.get().decisions,[]);
});
test('world gate · archived read requires enrolled current founder and tenant before any proposal or status',async()=>{
 for(const session of [{founderId:'founder',enrolled:false,canonicalReady:true,tenantIds:['cambium'],writerAuthority:false},{founderId:'founder',enrolled:true,canonicalReady:true,tenantIds:['other'],writerAuthority:false}]){
 const h=harness({initData:'',founderWeb:true,session});assert.equal((await h.readDecision()).outcome,'uncertain');assert.equal(h.requests.length,1);assert.ok(h.requests[0].url.endsWith('/session'));assert.deepEqual(h.get().decisions,[]);
 }
});
