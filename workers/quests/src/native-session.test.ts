// Native founder session source tests. Synthetic Access/role/enrollment
// callbacks and local node:sqlite only. No live browser grant, no real D1.

import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { d1NativeSessionStore } from './native-session-d1.ts';
import {
  NATIVE_CODE_PREFIX,
  NATIVE_CODE_TTL_MS,
  NATIVE_SESSION_CONTRACT,
  NATIVE_SESSION_MAX_BODY_BYTES,
  NATIVE_SESSION_TTL_MS,
  NATIVE_TOKEN_PREFIX,
  createNativeSessionHost,
  nativeCredentialDigest,
  nativeSessionHttp,
  resolveNativeSession,
  s256Challenge,
  standardNativeRandom,
  validNativeRedirect,
  type NativeSessionDeps,
  type NativeSessionHost,
} from './native-session.ts';
import type { GoalGraphD1DatabaseLike, GoalGraphD1StatementLike } from './goal-graph-store.ts';

const ORIGIN = 'https://cambium.test';
const CLIENT_ID = 'space.thoughtseed.cambium.native.dev';
const REDIRECT = 'space.thoughtseed.cambium.native.dev://oauth/callback';
const STATE = 'abcdefghijklmnopqrstuvwx';
const NOW = '2026-11-02T00:30:00.000Z';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

class SqliteD1 implements GoalGraphD1DatabaseLike {
  readonly db = new DatabaseSync(':memory:');
  prepare(sql: string): GoalGraphD1StatementLike {
    const statement = this.db.prepare(sql);
    let values: unknown[] = [];
    const api: GoalGraphD1StatementLike = {
      bind: (...next: unknown[]) => { values = next; return api; },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: statement.all(...values) as T[] }),
      run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
    };
    return api;
  }
}

async function harness(overrides: Partial<NativeSessionDeps> = {}) {
  const db = new SqliteD1();
  db.db.exec(await readFile(new URL('../migrations/0100_native_sessions.sql', import.meta.url), 'utf8'));
  const clock = { now: NOW };
  const who = { founder: 'founder-1' as string | null, role: 'founder' as string | null, tenants: ['tenant-alpha'] as string[] | null,
    onEnrollment: undefined as (() => unknown) | undefined, browserCalls: 0 };
  const deps: NativeSessionDeps = {
    verifyBrowserFounder: async () => { who.browserCalls += 1; return who.founder; },
    currentRole: async () => who.role,
    enrolledTenants: async () => { await who.onEnrollment?.(); return who.tenants; },
    clients: [{ clientId: CLIENT_ID, redirectUri: REDIRECT }],
    store: d1NativeSessionStore(db),
    now: () => clock.now,
    randomBytes: standardNativeRandom,
    ownerOrigin: ORIGIN,
    ...overrides,
  };
  const host = createNativeSessionHost(deps)!;
  assert.ok(host);
  return { db, clock, who, host, deps };
}
type Harness = Awaited<ReturnType<typeof harness>>;

function authorizeUrl(extra: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID, redirect_uri: REDIRECT, code_challenge: CHALLENGE,
    code_challenge_method: 'S256', state: STATE,
  });
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) params.delete(key); else params.set(key, value);
  }
  return `${ORIGIN}/v1/native/session/authorize?${params}`;
}

const authorize = (host: NativeSessionHost | undefined, extra?: Record<string, string | undefined>) =>
  nativeSessionHttp(new Request(authorizeUrl(extra)), host);

const exchangeBody = (code: string, extra: Record<string, unknown> = {}) => ({
  contractVersion: NATIVE_SESSION_CONTRACT, clientId: CLIENT_ID, code, codeVerifier: VERIFIER, redirectUri: REDIRECT, ...extra,
});

function exchange(host: NativeSessionHost | undefined, body: unknown,
  init: { method?: string; contentType?: string; raw?: string; headers?: Record<string, string> } = {}) {
  return nativeSessionHttp(new Request(`${ORIGIN}/v1/native/session/exchange`, {
    method: init.method ?? 'POST',
    headers: { 'content-type': init.contentType ?? 'application/json', ...init.headers },
    body: init.method === 'GET' ? undefined : (init.raw ?? JSON.stringify(body)),
  }), host);
}

const sessionRead = (host: NativeSessionHost | undefined, token: string) => nativeSessionHttp(new Request(`${ORIGIN}/v1/native/session`, {
  headers: { authorization: `Bearer ${token}` },
}), host);

const logout = (host: NativeSessionHost | undefined, token: string, body: unknown = {}) => nativeSessionHttp(new Request(`${ORIGIN}/v1/native/session/logout`, {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body),
}), host);

async function codeOf(response: Response | null) {
  assert.ok(response);
  assert.equal(response.status, 302);
  return new URL(response.headers.get('location')!).searchParams.get('code')!;
}

async function sessionFor(h: Harness) {
  const code = await codeOf(await authorize(h.host));
  const response = await exchange(h.host, exchangeBody(code));
  assert.equal(response!.status, 200);
  return (await response!.json()) as { token: string; expiresAt: string; founderId: string; tenantId: string };
}

async function errorOf(response: Response | null) {
  assert.ok(response);
  const text = await response.text();
  assert.equal(text.includes('cns1_') || text.includes('cnc1_') || text.includes('http'), false, 'error body leaks credential or URL');
  return { status: response.status, body: JSON.parse(text) as { contractVersion: string; error: string } };
}

const dump = (db: SqliteD1) => JSON.stringify(['native_authorization_codes', 'native_sessions']
  .map(table => db.db.prepare(`SELECT * FROM ${table}`).all()));

// ── Contract primitives ─────────────────────────────────────────────────────

test('S256 challenge matches the RFC 7636 Appendix B vector', () => {
  assert.equal(s256Challenge(VERIFIER), CHALLENGE);
  assert.equal(s256Challenge(VERIFIER).length, 43);
});

test('dev redirect accepts only the exact reversed-domain host/path form', () => {
  assert.equal(validNativeRedirect(REDIRECT), true);
  assert.equal(validNativeRedirect('space.thoughtseed.cambium.native.dev://oauth/callback'), true);
  for (const bad of [
    'https://cambium.test/cb',
    'space.thoughtseed.cambium.native.dev:/oauth/callback',
    'space.thoughtseed.cambium.native.dev:///oauth/callback',
    'space.thoughtseed.cambium.native.dev://oauth/callback?x=1',
    'space.thoughtseed.cambium.native.dev://oauth/callback#frag',
    'space.thoughtseed.cambium.native.dev://user@oauth/callback',
    'space.thoughtseed.cambium.native.dev://user:pw@oauth/callback',
    'space.thoughtseed.cambium.native.dev://oauth:8080/callback',
    'space.thoughtseed.cambium.native.dev://oauth/%63allback',
    'space.thoughtseed.cambium.native.dev://oauth/../callback',
    'space.thoughtseed.cambium.native.dev://oauth/./callback',
    'space.thoughtseed.cambium.native.dev://oauth',
    'space.thoughtseed.cambium.native.dev://oauth/',
    'space.thoughtseed.cambium.native.dev://oauth//callback',
    'space.thoughtseed:' + '//oauth/callback',
    'com.example.app://oauth/callback',
    'javascript://oauth/callback',
    `space.thoughtseed.cambium.native.dev://oauth/${'a'.repeat(300)}`,
  ]) assert.equal(validNativeRedirect(bad), false, bad);
  assert.equal(validNativeRedirect(undefined), false);
});

// ── Missing dependencies ────────────────────────────────────────────────────

test('missing or invalid owner bindings make the factory undefined and every route 503', async () => {
  const h = await harness();
  const good = h.deps;
  const broken: Array<Partial<NativeSessionDeps>> = [
    { verifyBrowserFounder: undefined as unknown as NativeSessionDeps['verifyBrowserFounder'] },
    { currentRole: undefined as unknown as NativeSessionDeps['currentRole'] },
    { enrolledTenants: undefined as unknown as NativeSessionDeps['enrolledTenants'] },
    { now: undefined as unknown as NativeSessionDeps['now'] },
    { randomBytes: undefined as unknown as NativeSessionDeps['randomBytes'] },
    { store: undefined as unknown as NativeSessionDeps['store'] },
    { clients: [] },
    { clients: [{ clientId: CLIENT_ID, redirectUri: 'https://cambium.test/cb' }] },
    { ownerOrigin: 'http://cambium.test' },
    { ownerOrigin: 'https://user:pw@cambium.test' },
  ];
  for (const change of broken) {
    assert.equal(createNativeSessionHost({ ...good, ...change }), undefined);
  }
  assert.equal(createNativeSessionHost(undefined), undefined);
  const undefinedHost = createNativeSessionHost({ ...good, currentRole: undefined as unknown as NativeSessionDeps['currentRole'] });
  assert.equal((await errorOf(await authorize(undefinedHost))).status, 503);
  assert.equal((await errorOf(await exchange(undefinedHost, exchangeBody('cnc1_x')))).status, 503);
  assert.equal((await errorOf(await sessionRead(undefinedHost, 'cns1_' + 'a'.repeat(43)))).status, 503);
  assert.equal((await errorOf(await logout(undefinedHost, 'cns1_' + 'a'.repeat(43)))).status, 503);
});

test('missing dependencies perform no database writes', async () => {
  const h = await harness();
  const host = createNativeSessionHost({ ...h.deps, currentRole: undefined as unknown as NativeSessionDeps['currentRole'] });
  await authorize(host);
  assert.equal(dump(h.db), '[[],[]]');
});

// ── Authorize ───────────────────────────────────────────────────────────────

test('authorize returns 302 with exact callback code and state, no-store headers, and a hashed code', async () => {
  const h = await harness();
  const response = await authorize(h.host);
  assert.equal(response!.status, 302);
  assert.equal(response!.headers.get('cache-control'), 'no-store');
  assert.equal(response!.headers.get('referrer-policy'), 'no-referrer');
  const location = new URL(response!.headers.get('location')!);
  assert.equal(`${location.protocol}//${location.host}${location.pathname}`, REDIRECT);
  assert.equal(location.searchParams.get('state'), STATE);
  const code = location.searchParams.get('code')!;
  assert.match(code, /^cnc1_[A-Za-z0-9_-]{43}$/);
  assert.equal(dump(h.db).includes(code), false);
});

test('authorize accepts a single tenant automatically and rejects foreign and ambiguous selections', async () => {
  const h = await harness();
  assert.equal((await authorize(h.host, { tenant: 'tenant-alpha' }))!.status, 302);
  assert.equal((await errorOf(await authorize(h.host, { tenant: 'tenant-zeta' }))).status, 403);
  h.who.tenants = ['tenant-alpha', 'tenant-beta'];
  const ambiguous = await errorOf(await authorize(h.host));
  assert.equal(ambiguous.status, 409);
  assert.equal(ambiguous.body.error, 'tenant_selection_required');
  assert.equal((await authorize(h.host, { tenant: 'tenant-beta' }))!.status, 302);
});

test('authorize returns 403 for unknown tenants, empty enrollment and non-founder roles', async () => {
  const h = await harness();
  h.who.tenants = [];
  assert.equal((await errorOf(await authorize(h.host))).status, 403);
  h.who.tenants = ['tenant-alpha'];
  h.who.role = 'member';
  assert.equal((await errorOf(await authorize(h.host))).status, 403);
});

test('authorize rejects bad shapes, unregistered callbacks and unverified browsers before any write', async () => {
  const h = await harness();
  const cases: Array<[Record<string, string | undefined>, number, string]> = [
    [{ code_challenge_method: 'plain' }, 400, 'invalid_request'],
    [{ code_challenge: CHALLENGE.slice(0, 42) }, 400, 'invalid_request'],
    [{ state: 'short' }, 400, 'invalid_request'],
    [{ state: 'bad state with spaces!!' }, 400, 'invalid_request'],
    [{ tenant: 'Tenant_Alpha' }, 400, 'invalid_request'],
    [{ redirect_uri: 'space.thoughtseed.cambium.native.dev://oauth/other' }, 400, 'invalid_client'],
    [{ redirect_uri: 'space.thoughtseed.cambium.native.dev:/oauth/callback' }, 400, 'invalid_client'],
    [{ redirect_uri: `${REDIRECT}?x=1` }, 400, 'invalid_client'],
    [{ client_id: 'space.thoughtseed.unknown.client' }, 400, 'invalid_client'],
    [{ extra: 'value' }, 400, 'invalid_request'],
    [{ state: undefined }, 400, 'invalid_request'],
  ];
  for (const [extra, status, error] of cases) {
    const body = await errorOf(await authorize(h.host, extra));
    assert.equal(body.status, status, JSON.stringify(extra));
    assert.equal(body.body.error, error, JSON.stringify(extra));
  }
  h.who.founder = null;
  assert.equal((await errorOf(await authorize(h.host))).status, 401);
  assert.equal(dump(h.db), '[[],[]]');
});

test('authorize refuses duplicate parameters, userinfo callbacks and the wrong method', async () => {
  const h = await harness();
  assert.equal((await errorOf(await nativeSessionHttp(new Request(`${authorizeUrl()}&state=${STATE}`), h.host))).status, 400);
  assert.equal((await errorOf(await nativeSessionHttp(new Request(`${authorizeUrl()}#frag`), h.host))).status, 400);
  assert.equal((await errorOf(await nativeSessionHttp(new Request(authorizeUrl(), { method: 'POST' }), h.host))).status, 405);
  assert.equal(validNativeRedirect('space.thoughtseed.cambium.native.dev://user@oauth/callback'), false);
  assert.equal(dump(h.db), '[[],[]]');
});

// ── Exchange ────────────────────────────────────────────────────────────────

test('full authorize, exchange, session read, and logout with the exact contract shapes', async () => {
  const h = await harness();
  const session = await sessionFor(h);
  assert.match(session.token, /^cns1_[A-Za-z0-9_-]{43}$/);
  assert.equal(session.token.startsWith(NATIVE_TOKEN_PREFIX), true);
  assert.equal(Date.parse(session.expiresAt) - Date.parse(NOW), NATIVE_SESSION_TTL_MS);
  assert.deepEqual(Object.keys(session).sort(),
    ['clientId', 'contractVersion', 'enrolled', 'expiresAt', 'founderId', 'role', 'tenantId', 'token', 'tokenType']);

  const read = await sessionRead(h.host, session.token);
  assert.equal(read!.status, 200);
  const readBody = (await read!.json()) as Record<string, unknown>;
  assert.equal(readBody.token, undefined);
  assert.equal(readBody.founderId, 'founder-1');
  assert.equal(readBody.tenantId, 'tenant-alpha');
  assert.equal(readBody.role, 'founder');
  assert.equal(readBody.enrolled, true);

  const out = await logout(h.host, session.token);
  assert.equal(out!.status, 200);
  assert.deepEqual(await out!.json(), { contractVersion: NATIVE_SESSION_CONTRACT, revoked: true });
  assert.equal((await errorOf(await sessionRead(h.host, session.token))).status, 401);
});

test('exchange with the wrong verifier, client, redirect, or shape issues nothing', async () => {
  const h = await harness();
  const code = await codeOf(await authorize(h.host));
  const wrongVerifier = 'x'.repeat(43);
  assert.equal((await errorOf(await exchange(h.host, exchangeBody(code, { codeVerifier: wrongVerifier })))).body.error, 'invalid_grant');
  assert.equal((await errorOf(await exchange(h.host, exchangeBody(code, { clientId: 'space.thoughtseed.other.app' })))).body.error, 'invalid_client');
  assert.equal((await errorOf(await exchange(h.host, exchangeBody(code, { redirectUri: 'space.thoughtseed.cambium.native.dev://oauth/x' })))).body.error, 'invalid_client');
  assert.equal((await errorOf(await exchange(h.host, exchangeBody(code, { codeVerifier: 'short' })))).body.error, 'invalid_request');
  assert.equal((await errorOf(await exchange(h.host, exchangeBody('cnc1_bad')))).body.error, 'invalid_grant');
  assert.equal((await errorOf(await exchange(h.host, exchangeBody(code, { extra: 1 })))).body.error, 'invalid_request');
  assert.equal((await errorOf(await exchange(h.host, exchangeBody(code, { contractVersion: 'v0' })))).body.error, 'invalid_request');
  assert.equal((h.db.db.prepare('SELECT COUNT(*) AS n FROM native_sessions').get() as { n: number }).n, 0);
  // The correct verifier still works after failed attempts (no burn of the code by wrong verifiers).
  assert.equal((await exchange(h.host, exchangeBody(code)))!.status, 200);
});

test('expiry is re-checked after awaits; the code expires at its exact TTL', async () => {
  const h = await harness();
  const code = await codeOf(await authorize(h.host));
  // Advance the clock during the enrollment lookup, after the first peek.
  h.who.onEnrollment = () => { h.clock.now = new Date(Date.parse(NOW) + NATIVE_CODE_TTL_MS).toISOString(); };
  assert.equal((await errorOf(await exchange(h.host, exchangeBody(code)))).body.error, 'invalid_grant');
  assert.equal((h.db.db.prepare('SELECT COUNT(*) AS n FROM native_sessions').get() as { n: number }).n, 0);
});

test('a code one millisecond before its TTL still exchanges; at the TTL it does not', async () => {
  const h = await harness();
  const early = await codeOf(await authorize(h.host));
  const late = await codeOf(await authorize(h.host));
  h.clock.now = new Date(Date.parse(NOW) + NATIVE_CODE_TTL_MS - 1).toISOString();
  assert.equal((await exchange(h.host, exchangeBody(early)))!.status, 200);
  h.clock.now = new Date(Date.parse(NOW) + NATIVE_CODE_TTL_MS).toISOString();
  assert.equal((await errorOf(await exchange(h.host, exchangeBody(late)))).body.error, 'invalid_grant');
});

test('exchange rechecks the current founder role and enrollment rather than the stored code alone', async () => {
  const h = await harness();
  const code = await codeOf(await authorize(h.host));
  h.who.role = 'member';
  assert.equal((await errorOf(await exchange(h.host, exchangeBody(code)))).status, 403);
  h.who.role = 'founder';
  h.who.tenants = [];
  assert.equal((await errorOf(await exchange(h.host, exchangeBody(code)))).status, 403);
  assert.equal((h.db.db.prepare('SELECT COUNT(*) AS n FROM native_sessions').get() as { n: number }).n, 0);
});

test('exchange rejects GET, wrong content type, oversized and malformed bodies', async () => {
  const h = await harness();
  assert.equal((await errorOf(await exchange(h.host, undefined, { method: 'GET' }))).status, 405);
  assert.equal((await errorOf(await exchange(h.host, exchangeBody('cnc1_x'), { contentType: 'text/plain' }))).status, 415);
  const big = JSON.stringify({ ...exchangeBody('cnc1_x'), pad: 'x'.repeat(NATIVE_SESSION_MAX_BODY_BYTES) });
  assert.equal((await errorOf(await exchange(h.host, undefined, { raw: big }))).status, 413);
  assert.equal((await errorOf(await exchange(h.host, undefined, { raw: '[1]' }))).status, 400);
  assert.equal((await errorOf(await exchange(h.host, undefined, { raw: '{not json' }))).status, 400);
  assert.equal((await errorOf(await exchange(h.host, undefined, { raw: '\xff\xfe' }))).status, 400);
});

test('exchange answers store failure with a bounded 503 and never grants a second session', async () => {
  const h = await harness();
  const code = await codeOf(await authorize(h.host));
  const failing: NativeSessionDeps = { ...h.deps, store: {
    ...h.deps.store,
    async grant() { throw new Error('D1_ERROR: simulated outage with cns1_secret'); },
  } };
  const host = createNativeSessionHost(failing)!;
  const body = await errorOf(await exchange(host, exchangeBody(code)));
  assert.equal(body.status, 503);
  assert.equal(body.body.error, 'native_session_unavailable');
  assert.equal((h.db.db.prepare('SELECT COUNT(*) AS n FROM native_sessions').get() as { n: number }).n, 0);
  // Retrying the same exchange with the real store is still a single-use code attempt.
  const retry = await exchange(h.host, exchangeBody(code));
  assert.equal(retry!.status, 200);
  assert.equal((await exchange(h.host, exchangeBody(code)))!.status, 400);
});

test('a grant that lands before its response is lost cannot be repeated by resending the exchange', async () => {
  const h = await harness();
  const code = await codeOf(await authorize(h.host));
  const real = h.deps.store;
  const host = createNativeSessionHost({ ...h.deps, store: {
    ...real,
    async grant(input) { await real.grant(input); throw new Error('network reset after commit'); },
  } })!;
  assert.equal((await errorOf(await exchange(host, exchangeBody(code)))).status, 503);
  assert.equal((await errorOf(await exchange(h.host, exchangeBody(code)))).body.error, 'invalid_grant');
  assert.equal((h.db.db.prepare('SELECT COUNT(*) AS n FROM native_sessions').get() as { n: number }).n, 1);
});

test('saveCode failure during authorize fails bounded and leaves no code behind', async () => {
  const h = await harness({ store: { ...d1NativeSessionStore(new SqliteD1()), async saveCode() { throw new Error('boom cnc1_leak'); } } as NativeSessionDeps['store'] });
  const body = await errorOf(await authorize(h.host));
  assert.equal(body.status, 503);
  assert.equal(dump(h.db), '[[],[]]');
});

test('bad clock or randomness source fails closed before any write', async () => {
  const h = await harness();
  const badClock = createNativeSessionHost({ ...h.deps, now: () => '2026-11-02 00:30:00' })!;
  assert.equal((await errorOf(await authorize(badClock))).status, 503);
  const shortRandom = createNativeSessionHost({ ...h.deps, randomBytes: () => new Uint8Array(16) })!;
  assert.equal((await errorOf(await authorize(shortRandom))).status, 503);
  assert.equal(dump(h.db), '[[],[]]');
});

// ── Session resolution ──────────────────────────────────────────────────────

test('expired native sessions are refused at the exact expiry instant', async () => {
  const h = await harness();
  const session = await sessionFor(h);
  h.clock.now = session.expiresAt;
  assert.equal((await errorOf(await sessionRead(h.host, session.token))).status, 401);
});

test('a role or enrollment change revokes a live native session on the next resolution', async () => {
  const h = await harness();
  const session = await sessionFor(h);
  h.who.tenants = [];
  assert.equal((await errorOf(await sessionRead(h.host, session.token))).status, 403);
  h.who.tenants = ['tenant-alpha'];
  h.who.role = 'member';
  assert.equal((await errorOf(await sessionRead(h.host, session.token))).status, 403);
});

test('invalid native credentials are refused without browser fallback', async () => {
  const h = await harness();
  const forged = 'cns1_' + 'a'.repeat(43);
  assert.equal((await errorOf(await sessionRead(h.host, forged))).status, 401);
  assert.equal((await errorOf(await sessionRead(h.host, 'cns1_short'))).status, 401);
  const session = await sessionFor(h);
  const mixed = await resolveNativeSession(new Request(`${ORIGIN}/v1/native/session`, {
    headers: { authorization: `Bearer ${session.token}`, 'cf-access-jwt-assertion': 'jwt' },
  }), h.host);
  assert.equal(mixed.kind, 'refused');
  assert.equal((await errorOf(mixed.kind === 'refused' ? mixed.response : null)).body.error, 'mixed_credentials');
  const cookie = await resolveNativeSession(new Request(`${ORIGIN}/v1/native/session`, {
    headers: { authorization: `Bearer ${session.token}`, cookie: 'CF_Authorization=abc' },
  }), h.host);
  assert.equal(cookie.kind, 'refused');
});

test('ordinary bearer tokens and absent credentials are not reinterpreted as native', async () => {
  const h = await harness();
  assert.equal((await resolveNativeSession(new Request(`${ORIGIN}/v1/native/session`, {
    headers: { authorization: ['Bearer', 'web-session-token'].join(' ') },
  }), h.host)).kind, 'absent');
  assert.equal((await resolveNativeSession(new Request(`${ORIGIN}/v1/native/session`), h.host)).kind, 'absent');
  assert.equal((await errorOf(await nativeSessionHttp(new Request(`${ORIGIN}/v1/native/session`), h.host))).status, 401);
});

test('native bearer with no host configured is refused as unconfigured, not treated as absent', async () => {
  const token = `${NATIVE_TOKEN_PREFIX}${'a'.repeat(43)}`;
  const resolved = await resolveNativeSession(new Request(`${ORIGIN}/v1/native/session`, {
    headers: { authorization: `Bearer ${token}` },
  }), undefined);
  assert.equal(resolved.kind, 'refused');
});

test('logout revokes only the exact token and rejects bodies other than an empty object', async () => {
  const h = await harness();
  const first = await sessionFor(h);
  const second = await sessionFor(h);
  assert.equal((await errorOf(await logout(h.host, first.token, { x: 1 }))).status, 400);
  assert.equal((await logout(h.host, first.token))!.status, 200);
  assert.equal((await errorOf(await logout(h.host, first.token))).status, 401);
  assert.equal((await sessionRead(h.host, second.token))!.status, 200);
});

// ── Review corrections: barriers, shapes, impossible dates, exchange credentials ─

const sessionCount = (h: Harness) => (h.db.db.prepare('SELECT COUNT(*) AS n FROM native_sessions').get() as { n: number }).n;

test('a session revoked during the awaited role/enrollment lookup is refused', async () => {
  const h = await harness();
  const session = await sessionFor(h);
  h.who.onEnrollment = async () => { await h.deps.store.revoke(nativeCredentialDigest(session.token), h.clock.now); };
  assert.equal((await errorOf(await sessionRead(h.host, session.token))).status, 401);
});

test('a session that expires during the awaited lookup is refused', async () => {
  const h = await harness();
  const session = await sessionFor(h);
  h.who.onEnrollment = () => { h.clock.now = session.expiresAt; };
  assert.equal((await errorOf(await sessionRead(h.host, session.token))).status, 401);
});

test('a code consumed by another exchange during the awaited lookup grants nothing', async () => {
  const h = await harness();
  const code = await codeOf(await authorize(h.host));
  // Another exchange wins while this one awaits enrollment.
  h.who.onEnrollment = async () => {
    h.who.onEnrollment = undefined;
    assert.equal((await exchange(h.host, exchangeBody(code)))!.status, 200);
  };
  assert.equal((await errorOf(await exchange(h.host, exchangeBody(code)))).body.error, 'invalid_grant');
  assert.equal(sessionCount(h), 1);
});

test('impossible but shape-valid dates refuse categorically and never throw', async () => {
  const h = await harness();
  for (const bad of ['2026-13-01T00:00:00.000Z', '2026-11-02T25:00:00.000Z', '2026-02-30T00:00:00.000Z', '2026-11-02T24:00:00.000Z']) {
    const host = createNativeSessionHost({ ...h.deps, now: () => bad })!;
    assert.equal((await errorOf(await authorize(host))).status, 503, bad);
    assert.equal((await errorOf(await exchange(host, exchangeBody(`cnc1_${'A'.repeat(43)}`)))).status, 503, bad);
    assert.equal((await errorOf(await sessionRead(host, `cns1_${'A'.repeat(43)}`))).status, 503, bad);
  }
  assert.equal(dump(h.db), '[[],[]]');

  const session = await sessionFor(h);
  const corruptRow = createNativeSessionHost({ ...h.deps, store: {
    ...h.deps.store,
    async readSession() { return { founderId: 'founder-1', tenantId: 'tenant-alpha', clientId: CLIENT_ID, expiresAt: '2026-11-02T25:00:00.000Z' }; },
  } })!;
  assert.equal((await errorOf(await sessionRead(corruptRow, session.token))).status, 401);

  const code = await codeOf(await authorize(h.host));
  const corruptPending = createNativeSessionHost({ ...h.deps, store: {
    ...h.deps.store,
    async peekCode() { return { founderId: 'founder-1', tenantId: 'tenant-alpha', expiresAt: '2026-13-01T00:00:00.000Z' }; },
  } })!;
  assert.equal((await errorOf(await exchange(corruptPending, exchangeBody(code)))).body.error, 'invalid_grant');
});

test('malformed founder, tenant or client shapes in stored rows are refused before use', async () => {
  const h = await harness();
  const session = await sessionFor(h);
  let roleLookups = 0;
  const counting = { ...h.deps, currentRole: async (id: string) => { roleLookups += 1; return h.deps.currentRole(id); } };
  const rows = [
    { founderId: '', tenantId: 'tenant-alpha', clientId: CLIENT_ID },
    { founderId: 'founder 1', tenantId: 'tenant-alpha', clientId: CLIENT_ID },
    { founderId: 'founder-1', tenantId: 'Tenant_Alpha', clientId: CLIENT_ID },
    { founderId: 'founder-1', tenantId: 'tenant-alpha', clientId: 'bad id' },
    { founderId: 42, tenantId: 'tenant-alpha', clientId: CLIENT_ID },
  ];
  for (const row of rows) {
    const host = createNativeSessionHost({ ...counting, store: {
      ...h.deps.store,
      async readSession() { return { ...row, expiresAt: session.expiresAt } as never; },
    } })!;
    assert.equal((await errorOf(await sessionRead(host, session.token))).status, 401, JSON.stringify(row));
  }
  const code = await codeOf(await authorize(h.host));
  for (const pending of [{ founderId: 'founder 1', tenantId: 'tenant-alpha' }, { founderId: 'founder-1', tenantId: 'x' }]) {
    const host = createNativeSessionHost({ ...counting, store: {
      ...h.deps.store,
      async peekCode() { return { ...pending, expiresAt: '2026-11-02T00:31:00.000Z' }; },
    } })!;
    assert.equal((await errorOf(await exchange(host, exchangeBody(code)))).body.error, 'invalid_grant', JSON.stringify(pending));
  }
  assert.equal(roleLookups, 0);
});

test('exchange refuses browser credentials and Authorization without calling the browser verifier', async () => {
  const h = await harness();
  const code = await codeOf(await authorize(h.host));
  const before = h.who.browserCalls;
  const bearer = ['Bearer', `${NATIVE_TOKEN_PREFIX}${'A'.repeat(43)}`].join(' ');
  for (const headers of [
    { cookie: 'CF_Authorization=synthetic' },
    { cookie: 'other=1; CF_Authorization=synthetic' },
    { 'cf-access-jwt-assertion': 'synthetic.jwt.value' },
    { 'x-telegram-init-data': 'synthetic' },
    { authorization: bearer },
    { authorization: ['Bearer', 'web-session-token'].join(' ') },
    { authorization: 'Basic c3ludGhldGlj' },
  ]) {
    const body = await errorOf(await exchange(h.host, exchangeBody(code), { headers }));
    assert.equal(body.status, 400, JSON.stringify(headers));
    assert.equal(body.body.error, 'mixed_credentials', JSON.stringify(headers));
  }
  assert.equal(h.who.browserCalls, before);
  assert.equal(sessionCount(h), 0);
  // A plain unauthenticated exchange still works with the same unused code.
  assert.equal((await exchange(h.host, exchangeBody(code)))!.status, 200);
  assert.equal(h.who.browserCalls, before);
});

// ── Wire fixture (generated from the real handlers) ─────────────────────────

const FIXTURE_URL = new URL('./fixtures/native-session-wire.v1.json', import.meta.url);
const FIXTURE_NOW = '2026-11-02T00:30:00.123Z';

/** Drives authorize → exchange → read → logout with deterministic synthetic randomness. */
async function generateWire() {
  let draws = 0;
  // Synthetic only: first draw (code) is all 0x00, second (token) all 0x01.
  const h = await harness({ randomBytes: (length: number) => new Uint8Array(length).fill(draws++) });
  h.clock.now = FIXTURE_NOW;
  h.who.founder = 'founder-synth-1';
  const query = Object.fromEntries(new URL(authorizeUrl()).searchParams);
  const authorized = await authorize(h.host);
  assert.equal(authorized!.status, 302);
  const location = authorized!.headers.get('location')!;
  const code = new URL(location).searchParams.get('code')!;
  const exchangeRequest = exchangeBody(code);
  const exchanged = await exchange(h.host, exchangeRequest);
  assert.equal(exchanged!.status, 200);
  const exchangeResponse = (await exchanged!.json()) as Record<string, unknown>;
  const read = await sessionRead(h.host, String(exchangeResponse.token));
  assert.equal(read!.status, 200);
  const out = await logout(h.host, String(exchangeResponse.token));
  assert.equal(out!.status, 200);
  return {
    contractVersion: NATIVE_SESSION_CONTRACT,
    synthetic: 'Deterministic synthetic values for wire tests. Not real credentials.',
    clientId: CLIENT_ID,
    redirectUri: REDIRECT,
    authorizeQuery: query,
    authorizeResponseLocation: location,
    exchangeRequest,
    exchangeResponse,
    sessionReadResponse: await read!.json(),
    logoutResponse: await out!.json(),
  };
}

test('native identity wire fixture equals real handler output', async () => {
  const generated = await generateWire();
  if (process.env.NATIVE_SESSION_WRITE_FIXTURE === '1') {
    await writeFile(FIXTURE_URL, `${JSON.stringify(generated, null, 2)}\n`);
  }
  const fixture = JSON.parse(await readFile(FIXTURE_URL, 'utf8'));
  assert.deepEqual(fixture, generated);
  // Representative properties the Swift client relies on.
  assert.equal(fixture.redirectUri, 'space.thoughtseed.cambium.native.dev://oauth/callback');
  assert.equal(String(fixture.authorizeResponseLocation).startsWith(`${REDIRECT}?code=cnc1_`), true);
  assert.equal(fixture.exchangeResponse.expiresAt, '2026-11-02T00:45:00.123Z');
  assert.match(fixture.exchangeResponse.token, /^cns1_[A-Za-z0-9_-]{43}$/);
  const raw = await readFile(FIXTURE_URL, 'utf8');
  assert.equal(/authorization|Bearer cns1_/i.test(raw), false, 'fixture must not carry an Authorization header value');
});

test('non-canonical contract values and wrong methods on session routes return bounded errors', async () => {
  const h = await harness();
  assert.equal((await errorOf(await nativeSessionHttp(new Request(`${ORIGIN}/v1/native/session`, { method: 'POST' }), h.host))).status, 405);
  assert.equal((await errorOf(await nativeSessionHttp(new Request(`${ORIGIN}/v1/native/session/logout`, { method: 'GET' }), h.host))).status, 405);
  assert.equal(await nativeSessionHttp(new Request(`${ORIGIN}/v1/other`), h.host), null);
  assert.equal(NATIVE_CODE_PREFIX !== NATIVE_TOKEN_PREFIX, true);
});


// ── Post-await expiry barriers: the clock moves after the store call returns ─

const at = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

test('final session read that returns after expiry is refused', async () => {
  const h = await harness();
  const session = await sessionFor(h);
  let reads = 0;
  const real = h.deps.store;
  const host = createNativeSessionHost({ ...h.deps, store: {
    ...real,
    async readSession(digest, now) {
      const row = await real.readSession(digest, now);
      if (++reads === 2) h.clock.now = session.expiresAt; // expires while the final read awaits
      return row;
    },
  } })!;
  assert.equal((await errorOf(await sessionRead(host, session.token))).status, 401);
  assert.equal(reads, 2);
});

test('final session read that returns before expiry is still accepted', async () => {
  const h = await harness();
  const session = await sessionFor(h);
  h.clock.now = at(session.expiresAt, -1);
  assert.equal((await sessionRead(h.host, session.token))!.status, 200);
});

test('bad clock after the final session read refuses categorically', async () => {
  const h = await harness();
  const session = await sessionFor(h);
  const real = h.deps.store;
  let reads = 0;
  const host = createNativeSessionHost({ ...h.deps, store: {
    ...real,
    async readSession(digest, now) {
      const row = await real.readSession(digest, now);
      if (++reads === 2) h.clock.now = 'not-a-date';
      return row;
    },
  } })!;
  const body = await errorOf(await sessionRead(host, session.token));
  assert.equal(body.status, 503);
  assert.equal(body.body.error, 'native_session_unavailable');
  assert.equal(reads, 2);
});

test('code that expires while the second peek awaits is not granted', async () => {
  const h = await harness();
  const code = await codeOf(await authorize(h.host));
  const real = h.deps.store;
  let peeks = 0;
  let grants = 0;
  const host = createNativeSessionHost({ ...h.deps, store: {
    ...real,
    async peekCode(match) {
      const row = await real.peekCode(match);
      if (++peeks === 2) h.clock.now = at(NOW, NATIVE_CODE_TTL_MS);
      return row;
    },
    async grant(input) { grants += 1; return real.grant(input); },
  } })!;
  assert.equal((await errorOf(await exchange(host, exchangeBody(code)))).body.error, 'invalid_grant');
  assert.equal(grants, 0);
  assert.equal(sessionCount(h), 0);
});

test('grant timestamp and session lifetime use the clock read after the second peek', async () => {
  const h = await harness();
  const code = await codeOf(await authorize(h.host));
  const real = h.deps.store;
  const later = at(NOW, 5_000);
  let seen: { now: string; expiresAt: string } | undefined;
  let peeks = 0;
  const host = createNativeSessionHost({ ...h.deps, store: {
    ...real,
    async peekCode(match) {
      const row = await real.peekCode(match);
      if (++peeks === 2) h.clock.now = later; // advances while the second peek awaits
      return row;
    },
    async grant(input) { seen = { now: input.now, expiresAt: input.expiresAt }; return real.grant(input); },
  } })!;
  const response = await exchange(host, exchangeBody(code));
  assert.equal(response!.status, 200);
  assert.deepEqual(seen, { now: later, expiresAt: at(later, NATIVE_SESSION_TTL_MS) });
});

test('session that lapses while grant awaits returns categorical restart and no token', async () => {
  const h = await harness();
  const code = await codeOf(await authorize(h.host));
  const real = h.deps.store;
  let grants = 0;
  const host = createNativeSessionHost({ ...h.deps, store: {
    ...real,
    async grant(input) {
      grants += 1;
      const ok = await real.grant(input);
      h.clock.now = input.expiresAt; // session lifetime elapsed during the grant await
      return ok;
    },
  } })!;
  const response = await exchange(host, exchangeBody(code));
  const text = await response!.text();
  assert.equal(response!.status, 503);
  assert.equal(text.includes('cns1_'), false);
  assert.deepEqual(JSON.parse(text), { contractVersion: NATIVE_SESSION_CONTRACT, error: 'native_session_unavailable', retry: 'restart_authorization' });
  assert.equal(grants, 1);
  // The code is spent; a resend mints no second session.
  assert.equal((await errorOf(await exchange(h.host, exchangeBody(code)))).body.error, 'invalid_grant');
  assert.equal(sessionCount(h), 1);
});

test('invalid clock after the grant await returns categorical unavailable and no token', async () => {
  const h = await harness();
  const code = await codeOf(await authorize(h.host));
  const real = h.deps.store;
  const host = createNativeSessionHost({ ...h.deps, store: {
    ...real,
    async grant(input) {
      const ok = await real.grant(input);
      h.clock.now = 'not-a-date';
      return ok;
    },
  } })!;
  const response = await exchange(host, exchangeBody(code));
  const text = await response!.text();
  assert.equal(response!.status, 503);
  assert.equal(text.includes('cns1_'), false);
  assert.equal(JSON.parse(text).error, 'native_session_unavailable');
  assert.equal(sessionCount(h), 1);
});
