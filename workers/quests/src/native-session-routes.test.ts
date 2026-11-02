// Complete end-to-end route tests for native session exchange, scope read, Mission Fabric,
// founder gate, and launch verification through handler dispatch.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { handle, type HandlerDeps, type SimpleRequest } from './handler.ts';
import { d1NativeSessionStore } from './native-session-d1.ts';
import {
  NATIVE_SESSION_CONTRACT,
  NATIVE_SESSION_PATHS,
  createNativeSessionHost,
  type NativeSessionDeps,
} from './native-session.ts';
import { d1GoalGraphStore } from './goal-graph-store.ts';
import { d1BranchMapReceiptStore } from './branch-map-receipt-store.ts';

const ORIGIN = 'https://cambium.test';
const CLIENT_ID = 'space.thoughtseed.cambium.native.dev';
const REDIRECT = 'space.thoughtseed.cambium.native.dev://oauth/callback';
const NOW = '2026-11-02T00:30:00.000Z';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

class GoalGraphBatchSqliteD1 {
  readonly db: DatabaseSync;
  constructor(db: DatabaseSync) { this.db = db; }
  prepare(sql: string) {
    const st = this.db.prepare(sql);
    let values: unknown[] = [];
    return {
      bind(...next: unknown[]) { values = next; return this; },
      first: async <T>() => (st.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: st.all(...values) as T[] }),
      run: async () => ({ meta: { changes: Number(st.run(...values).changes) } }),
    };
  }
  async batch(statements: any[]) {
    this.db.exec('BEGIN');
    try {
      const results = [];
      for (const st of statements) results.push(await st.run());
      this.db.exec('COMMIT');
      return results;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
}

function req(method: string, path: string, headers: Record<string, string> = {}, body?: string): SimpleRequest {
  return { method, path, headers: { host: 'cambium.test', ...headers }, body };
}

test('all four unbound native session routes return 503 native_session_unconfigured', async () => {
  for (const path of Object.values(NATIVE_SESSION_PATHS)) {
    const res = await handle(req('GET', path), { kv: { get: async () => null, put: async () => {} } as any });
    assert.equal(res.status, 503, path);
    const parsed = JSON.parse(res.body as string);
    assert.equal(parsed.error, 'native_session_unconfigured');
    assert.equal(parsed.contractVersion, NATIVE_SESSION_CONTRACT);
  }
});

function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(dir).filter(name => name.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(file, dir), 'utf8'));
  return db;
}

async function nativeSessionHarness() {
  const db = migratedDb();
  const d1 = new GoalGraphBatchSqliteD1(db);
  const sessionStore = d1NativeSessionStore(d1);
  const sessionDeps: NativeSessionDeps = {
    verifyBrowserFounder: async () => 'founder-1',
    currentRole: async () => 'founder',
    enrolledTenants: async () => ['cambium'],
    clients: [{ clientId: CLIENT_ID, redirectUri: REDIRECT }],
    store: sessionStore,
    now: () => NOW,
    randomBytes: len => crypto.getRandomValues(new Uint8Array(len)),
    ownerOrigin: ORIGIN,
  };
  const nativeSessionHost = createNativeSessionHost(sessionDeps);
  const kvStore = new Map<string, string>();
  const goalGraphStore = d1GoalGraphStore(d1);
  const branchMapReceiptStore = d1BranchMapReceiptStore(d1);

  const deps: HandlerDeps = {
    bridgeToken: 'bridge',
    uuid: () => 'goal-intake-uuid',
    kv: {
      async get(key: string) {
        if (kvStore.has(key)) return kvStore.get(key)!;
        if (key === 'ledger:cambium') {
          return JSON.stringify({
            schema: 'quest-ledger-envelope.v1',
            derivedAt: NOW,
            tenant: 'cambium',
            branchStories: [],
            companyPrograms: [],
            fabricFacts: { fences: [], sourceKind: 'quest-execution-facts.v1', tenantId: 'cambium', tasks: [], runs: [], receipts: [], agents: [], skillClusters: [], taskClusterAssignments: [], gaps: [] },
            ledger: { rows: [], completed: 0, total: 0, current: null },
          });
        }
        return null;
      },
      async put(key: string, value: string) { kvStore.set(key, value); },
      async list(prefix: string) { return [...kvStore.keys()].filter(key => key.startsWith(prefix)); },
    },
    goalGraphStore,
    branchMapReceiptStore,
    missionFabricTenants: ['cambium'],
    nativeSessionHost,
    now: () => NOW,
  };

  return { deps, db, sessionStore, sessionDeps };
}

test('complete signin exchange -> scope -> Mission Fabric / Founder Gate / logout', async () => {
  const { deps } = await nativeSessionHarness();

  // 1. Authorize GET -> 302 with code
  const authRes = await handle(req('GET', `${NATIVE_SESSION_PATHS.authorize}?client_id=${CLIENT_ID}&code_challenge=${CHALLENGE}&code_challenge_method=S256&redirect_uri=${encodeURIComponent(REDIRECT)}&state=abcdefghijklmnopqrstuvwx`), {
    ...deps,
    nativeSessionHost: createNativeSessionHost({
      ...deps.nativeSessionHost!.deps,
      verifyBrowserFounder: async () => 'founder-1',
    }),
  });
  assert.equal(authRes.status, 302);
  const loc = authRes.headers.location;
  assert.ok(loc);
  const code = new URL(loc, ORIGIN).searchParams.get('code');
  assert.ok(code);

  // 2. Exchange POST -> 200 with token
  const exRes = await handle(req('POST', NATIVE_SESSION_PATHS.exchange, { 'content-type': 'application/json', origin: ORIGIN }, JSON.stringify({
    contractVersion: NATIVE_SESSION_CONTRACT,
    clientId: CLIENT_ID,
    code,
    codeVerifier: VERIFIER,
    redirectUri: REDIRECT,
  })), deps);
  assert.equal(exRes.status, 200, exRes.body);
  const exBody = JSON.parse(exRes.body as string);
  assert.equal(exBody.contractVersion, NATIVE_SESSION_CONTRACT);
  assert.ok(exBody.token.startsWith('cns1_'));
  const token = exBody.token;

  // 3. Read session GET -> 200 with scope
  const sessionRes = await handle(req('GET', NATIVE_SESSION_PATHS.session, { authorization: `Bearer ${token}` }), deps);
  assert.equal(sessionRes.status, 200, sessionRes.body);
  const sessionBody = JSON.parse(sessionRes.body as string);
  assert.equal(sessionBody.founderId, 'founder-1');
  assert.equal(sessionBody.tenantId, 'cambium');

  // 4. Mission Fabric GET exact tenant with native token -> 404 (graph not found, but authenticated successfully!)
  const mfRes = await handle(req('GET', '/v1/mission-fabric/cambium', { authorization: `Bearer ${token}` }), deps);
  assert.equal(mfRes.status, 404);
  assert.equal(JSON.parse(mfRes.body as string).error, 'mission fabric graph not found');

  // 5. Wrong tenant Mission Fabric request -> 403
  const wrongMf = await handle(req('GET', '/v1/mission-fabric/other', { authorization: `Bearer ${token}` }), deps);
  assert.equal(wrongMf.status, 403);

  // 6. Logout POST -> 200
  const logoutRes = await handle(req('POST', NATIVE_SESSION_PATHS.logout, { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: ORIGIN }, '{}'), deps);
  assert.equal(logoutRes.status, 200, logoutRes.body);
  assert.equal(JSON.parse(logoutRes.body as string).revoked, true);

  // 7. Revoked token reuse -> 401
  const reusedRes = await handle(req('GET', NATIVE_SESSION_PATHS.session, { authorization: `Bearer ${token}` }), deps);
  assert.equal(reusedRes.status, 401);
});

test('attacker combining native with browser / Telegram header aliases is refused', async () => {
  const { deps } = await nativeSessionHarness();
  const res = await handle(req('GET', NATIVE_SESSION_PATHS.session, {
    authorization: 'Bearer cns1_0123456789abcdef0123456789abcdef0123456789ab',
    'x-telegram-init-data': 'query_id=AAtest',
  }), deps);
  assert.equal(res.status, 400);
  assert.equal(JSON.parse(res.body as string).error, 'mixed_credentials');
});

test('unsupported routes with native token early-refuse without global auth elevation', async () => {
  const { deps } = await nativeSessionHarness();
  const res = await handle(req('GET', '/healthz', {
    authorization: 'Bearer cns1_0123456789abcdef0123456789abcdef0123456789ab',
  }), deps);
  assert.equal(res.status, 403);
  assert.equal(JSON.parse(res.body as string).error, 'native_route_unsupported');
});

async function nativeToken(deps: HandlerDeps): Promise<string> {
  const auth = await handle(req('GET', `${NATIVE_SESSION_PATHS.authorize}?client_id=${CLIENT_ID}&code_challenge=${CHALLENGE}&code_challenge_method=S256&redirect_uri=${encodeURIComponent(REDIRECT)}&state=abcdefghijklmnopqrstuvwx`), deps);
  const code = new URL(auth.headers.location, ORIGIN).searchParams.get('code')!;
  const ex = await handle(req('POST', NATIVE_SESSION_PATHS.exchange, { 'content-type': 'application/json', origin: ORIGIN },
    JSON.stringify({ contractVersion: NATIVE_SESSION_CONTRACT, clientId: CLIENT_ID, code, codeVerifier: VERIFIER, redirectUri: REDIRECT })), deps);
  assert.equal(ex.status, 200, ex.body);
  return JSON.parse(ex.body as string).token;
}

test('authorize 302 carries no-store and no-referrer headers and an exact Location', async () => {
  const { deps } = await nativeSessionHarness();
  const res = await handle(req('GET', `${NATIVE_SESSION_PATHS.authorize}?client_id=${CLIENT_ID}&code_challenge=${CHALLENGE}&code_challenge_method=S256&redirect_uri=${encodeURIComponent(REDIRECT)}&state=abcdefghijklmnopqrstuvwx`), deps);
  assert.equal(res.status, 302);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
  assert.match(res.headers.location, /^space\.thoughtseed\.cambium\.native\.dev:\/\/oauth\/callback\?code=cnc1_/);
});

test('a host that is not the reviewed owner origin is refused before any session lookup', async () => {
  const { deps } = await nativeSessionHarness();
  const token = await nativeToken(deps);
  const res = await handle({ ...req('GET', NATIVE_SESSION_PATHS.session, { authorization: `Bearer ${token}` }), headers: { host: 'attacker.invalid', authorization: `Bearer ${token}` } }, deps);
  assert.equal(res.status, 400);
  assert.equal(JSON.parse(res.body as string).error, 'invalid_request');
  const forged = await handle({ ...req('GET', NATIVE_SESSION_PATHS.session, { authorization: `Bearer ${token}` }), headers: { host: 'cambium.test', origin: 'https://attacker.invalid', authorization: `Bearer ${token}` } }, deps);
  assert.equal(forged.status, 200, 'Origin never decides identity; the reviewed host does');
});

test('native founder gate refuses a proposal from another tenant and never falls back to browser identity', async () => {
  const { deps } = await nativeSessionHarness();
  const token = await nativeToken(deps);
  const foreign = await handle(req('POST', '/v1/founder/status', {
    authorization: `Bearer ${token}`, 'content-type': 'application/json',
  }, JSON.stringify({ proposalId: `other-tenant:sha256:${'a'.repeat(64)}`, version: 1, changeDigest: `sha256:${'a'.repeat(64)}`,
    nonce: 'nonce_abcdefghijklmnopqrstuv', expiresAt: NOW, decision: 'approved', confirmation: 'x' })), deps);
  assert.equal(foreign.status, 401);
  assert.equal(JSON.parse(foreign.body as string).status, 'unauthorized');
  const mixed = await handle(req('POST', '/v1/founder/status', {
    authorization: `Bearer ${token}`, 'content-type': 'application/json', 'cf-access-jwt-assertion': 'jwt',
  }, '{}'), deps);
  assert.equal(mixed.status, 400);
  assert.equal(JSON.parse(mixed.body as string).error, 'mixed_credentials');
});

test('native founder gate is unbound without a session host and never reaches the browser gate', async () => {
  const { deps } = await nativeSessionHarness();
  const token = await nativeToken(deps);
  const res = await handle(req('POST', '/v1/founder/proposal', {
    authorization: `Bearer ${token}`, 'content-type': 'application/json',
  }, JSON.stringify({ proposalId: 'cambium:sha256:' + 'a'.repeat(64) })), { ...deps, nativeSessionHost: undefined });
  assert.equal(res.status, 503);
  assert.equal(JSON.parse(res.body as string).error, 'native_session_unconfigured');
});

test('native bearer on launch verifies the exact session principal and refuses after logout', async () => {
  const { deps } = await nativeSessionHarness();
  const token = await nativeToken(deps);
  const seen: Array<{ tenantId: string; principalId: string }> = [];
  const launch = {
    verify: async () => null,
    now: () => NOW,
    store: {
      readAdmission: async (scope: { tenantId: string; principalId: string }) => { seen.push(scope); return null; },
      reserve: async () => { throw new Error('not reached'); },
      readRequest: async () => null,
      recordObservation: async () => null,
    },
    owner: { supports: () => true, submit: async () => { throw new Error('not reached'); }, read: async () => ({ state: 'not_found' as const }) },
  };
  const launchDeps = { ...deps, nativeLaunchHost: launch as any };
  const path = '/v1/native/launch/capability';
  const body = JSON.stringify({ contractVersion: 'cambium.native-launch.v1', workId: 'sapling:cambium', admissionRef: 'adm-1' });
  const ok = await handle(req('POST', path, { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body), launchDeps);
  assert.equal(ok.status, 200, ok.body);
  assert.deepEqual(seen, [{ tenantId: 'cambium', principalId: 'founder-1' }]);
  await handle(req('POST', NATIVE_SESSION_PATHS.logout, { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, '{}'), deps);
  const after = await handle(req('POST', path, { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body), launchDeps);
  assert.equal(after.status, 401);
  assert.equal(seen.length, 1, 'a revoked native bearer never reaches the admission store');
});

test('mission fabric refuses a native token for a different tenant path', async () => {
  const { deps } = await nativeSessionHarness();
  const token = await nativeToken(deps);
  const res = await handle(req('GET', '/v1/mission-fabric/other-tenant', { authorization: `Bearer ${token}` }), deps);
  assert.equal(res.status, 403);
});

test('native session approves one exact founder proposal with channel native, then Mission Fabric serves 200', async () => {
  const { deps, db, sessionDeps } = await nativeSessionHarness();
  const intake = await handle(req('POST', '/v1/bridge/goal-graph-intake', { authorization: 'Bearer bridge' }, JSON.stringify({
    schema: 'cambium.telegram.goal-graph-intent.v1', version: 1, tenantId: 'cambium',
    source: { kind: 'telegram', chatId: '-100555000111', messageId: '4242', updateId: '90001' },
    goal: { desiredState: 'publish the approved launch note' },
  })), { ...deps, now: () => '2026-07-24T00:00:00.000Z' });
  assert.equal(intake.status, 200, intake.body);
  const changeDigest = JSON.parse(intake.body as string).changeDigest as string;
  const proposalId = `cambium:${changeDigest}`;
  const clock = '2026-07-24T00:00:00.000Z';
  const early = { ...deps, now: () => clock, nativeSessionHost: createNativeSessionHost({ ...sessionDeps, now: () => clock })! };
  const token = await nativeToken(early);
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const review = await handle(req('POST', '/v1/founder/proposal', headers, JSON.stringify({ proposalId })), early);
  assert.equal(review.status, 200, review.body);
  const body = JSON.parse(review.body as string);
  const p = body.proposal;
  const input = { proposalId, version: p.version, changeDigest: p.changeDigest, nonce: p.nonce, expiresAt: p.expiresAt,
    decision: 'approved', confirmation: body.approveConfirmation };
  assert.equal((db.prepare('SELECT count(*) n FROM goal_graph_approvals').get() as any).n, 0);
  const decided = await handle(req('POST', '/v1/founder/decision', headers, JSON.stringify(input)), early);
  assert.equal(decided.status, 200, decided.body);
  assert.equal(JSON.parse(decided.body as string).receipt.channel, 'native');
  assert.equal((db.prepare('SELECT count(*) n FROM goal_graph_approvals').get() as any).n, 1);
  const status = await handle(req('POST', '/v1/founder/status', headers, JSON.stringify(input)), early);
  assert.equal(JSON.parse(status.body as string).receiptDigest, JSON.parse(decided.body as string).receiptDigest);
  // Mission Fabric exact tenant now has a Goal Graph head to serve, read-only, founder view.
  const mf = await handle(req('GET', '/v1/mission-fabric/cambium', { authorization: `Bearer ${token}` }), early);
  assert.equal(mf.status, 200, mf.body);
  const projection = JSON.parse(mf.body as string);
  assert.equal(projection.projection?.readOnly ?? projection.readOnly, true);
  assert.equal((db.prepare('SELECT count(*) n FROM goal_graph_approvals').get() as any).n, 1, 'reads never write');
});

test('a revoked native session cannot write a founder decision even after proposal review', async () => {
  const { deps, db, sessionDeps } = await nativeSessionHarness();
  const clock = '2026-07-24T00:00:00.000Z';
  const intake = await handle(req('POST', '/v1/bridge/goal-graph-intake', { authorization: 'Bearer bridge' }, JSON.stringify({
    schema: 'cambium.telegram.goal-graph-intent.v1', version: 1, tenantId: 'cambium',
    source: { kind: 'telegram', chatId: '-100555000111', messageId: '4242', updateId: '90001' },
    goal: { desiredState: 'publish the approved launch note' },
  })), { ...deps, now: () => clock });
  const proposalId = `cambium:${JSON.parse(intake.body as string).changeDigest}`;
  const live = { ...deps, now: () => clock, nativeSessionHost: createNativeSessionHost({ ...sessionDeps, now: () => clock })! };
  const token = await nativeToken(live);
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const body = JSON.parse((await handle(req('POST', '/v1/founder/proposal', headers, JSON.stringify({ proposalId })), live)).body as string);
  const p = body.proposal;
  await handle(req('POST', NATIVE_SESSION_PATHS.logout, headers, '{}'), live);
  const decided = await handle(req('POST', '/v1/founder/decision', headers, JSON.stringify({ proposalId, version: p.version,
    changeDigest: p.changeDigest, nonce: p.nonce, expiresAt: p.expiresAt, decision: 'approved', confirmation: body.approveConfirmation })), live);
  assert.equal(decided.status, 401, decided.body);
  assert.equal((db.prepare('SELECT count(*) n FROM goal_graph_approvals').get() as any).n, 0);
});

test('expired, wrong-client and unenrolled native sessions are refused on composed routes', async () => {
  const { deps, sessionDeps } = await nativeSessionHarness();
  const token = await nativeToken(deps);
  const later = { ...deps, nativeSessionHost: createNativeSessionHost({ ...sessionDeps, now: () => '2026-11-02T01:00:00.000Z' })! };
  assert.equal((await handle(req('GET', '/v1/mission-fabric/cambium', { authorization: `Bearer ${token}` }), later)).status, 401);
  const wrongClient = { ...deps, nativeSessionHost: createNativeSessionHost({ ...sessionDeps,
    clients: [{ clientId: 'space.thoughtseed.cambium.native.other', redirectUri: REDIRECT }] })! };
  assert.equal((await handle(req('GET', NATIVE_SESSION_PATHS.session, { authorization: `Bearer ${token}` }), wrongClient)).status, 401);
  const demoted = { ...deps, nativeSessionHost: createNativeSessionHost({ ...sessionDeps, enrolledTenants: async () => ['other'] })! };
  assert.equal((await handle(req('GET', '/v1/mission-fabric/cambium', { authorization: `Bearer ${token}` }), demoted)).status, 403);
});

test('web CSRF and Telegram paths are unchanged when no native credential is present', async () => {
  const { deps } = await nativeSessionHarness();
  const noAuth = await handle(req('POST', '/v1/founder/status', { 'content-type': 'application/json' }, '{}'), deps);
  assert.equal(noAuth.status, 503, 'no browser host configured keeps the existing closed answer');
  assert.equal(JSON.parse(noAuth.body as string).error, 'founder_host_unconfigured');
  const ordinaryBearer = await handle(req('GET', '/v1/mission-fabric/cambium', { authorization: 'Bearer ordinary' }), deps);
  assert.equal(ordinaryBearer.status, 503, 'non-native bearer still takes the existing Telegram path');
  assert.equal(JSON.parse(ordinaryBearer.body as string).error, 'telegram auth is not configured');
});
