// D1 adapter tests for native founder sessions. Uses in-memory node:sqlite with
// the real 0100 migration. No real D1 is reached.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { cleanupExpiredNativeSessions, d1NativeConsentIntentStore, d1NativeSessionStore } from './native-session-d1.ts';
import {
  NATIVE_CODE_TTL_MS,
  NATIVE_CONSENT_COOKIE,
  NATIVE_SESSION_CONTRACT,
  NATIVE_SESSION_PATHS,
  createNativeSessionHost,
  nativeSessionHttp,
  nativeCredentialDigest,
  standardNativeRandom,
  type NativeSessionDeps,
} from './native-session.ts';
import type { GoalGraphD1DatabaseLike, GoalGraphD1StatementLike } from './goal-graph-store.ts';

const ORIGIN = 'https://cambium.test';
const CLIENT_ID = 'space.thoughtseed.cambium.native.dev';
const REDIRECT = 'space.thoughtseed.cambium.native.dev://oauth/callback';
const STATE = 'abcdefghijklmnopqrstuvwx';
const NOW = '2026-11-02T00:30:00.000Z';
// RFC 7636 Appendix B vector.
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
  db.db.exec(await readFile(new URL('../migrations/0101_native_consent.sql', import.meta.url), 'utf8'));
  const clock = { now: NOW };
  const who = { founder: 'founder-1' as string | null, role: 'founder' as string | null, tenants: ['tenant-alpha'] as string[] | null };
  const deps: NativeSessionDeps = {
    verifyBrowserFounder: async () => who.founder,
    currentRole: async () => who.role,
    enrolledTenants: async () => who.tenants,
    clients: [{ clientId: CLIENT_ID, redirectUri: REDIRECT }],
    store: d1NativeSessionStore(db),
    consent: d1NativeConsentIntentStore(db),
    now: () => clock.now,
    randomBytes: standardNativeRandom,
    ownerOrigin: ORIGIN,
    ...overrides,
  };
  const host = createNativeSessionHost(deps)!;
  assert.ok(host);
  return { db, clock, who, host, deps };
}

const dump = (db: SqliteD1) => JSON.stringify(['native_authorization_codes', 'native_sessions']
  .map(table => db.db.prepare(`SELECT * FROM ${table}`).all()));

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

const authorize = (host: ReturnType<typeof createNativeSessionHost>, extra?: Record<string, string | undefined>) =>
  nativeSessionHttp(new Request(authorizeUrl(extra)), host);

function exchangeRequest(body: unknown, init: { method?: string; contentType?: string; raw?: string } = {}) {
  return new Request(`${ORIGIN}/v1/native/session/exchange`, {
    method: init.method ?? 'POST',
    headers: { 'content-type': init.contentType ?? 'application/json' },
    body: init.method === 'GET' ? undefined : (init.raw ?? JSON.stringify(body)),
  });
}

const exchangeBody = (code: string, extra: Record<string, unknown> = {}) => ({
  contractVersion: NATIVE_SESSION_CONTRACT, clientId: CLIENT_ID, code, codeVerifier: VERIFIER, redirectUri: REDIRECT, ...extra,
});

async function codeFrom(form: Response, host: ReturnType<typeof createNativeSessionHost>) {
  assert.equal(form.status, 200);
  const html = await form.clone().text();
  const field = (name: string) => {
    const match = new RegExp(`name="${name}" value="([^"]*)"`).exec(html);
    assert.ok(match, name);
    return match[1];
  };
  const cookie = new RegExp(`${NATIVE_CONSENT_COOKIE}=([^;]+)`).exec(form.headers.get('set-cookie') ?? '');
  assert.ok(cookie);
  const body = new URLSearchParams({
    intent: field('intent'), csrf: field('csrf'), client_id: field('client_id'), redirect_uri: field('redirect_uri'),
    code_challenge: field('code_challenge'), state: field('state'), tenant: field('tenant'), decision: 'allow',
  });
  const res = await nativeSessionHttp(new Request(`${ORIGIN}${NATIVE_SESSION_PATHS.authorize}?${new URLSearchParams({
    client_id: field('client_id'), redirect_uri: field('redirect_uri'), code_challenge: field('code_challenge'),
    code_challenge_method: 'S256', state: field('state'), tenant: field('tenant'),
  })}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: `${NATIVE_CONSENT_COOKIE}=${cookie[1]}` }, body: body.toString() }), host);
  assert.equal(res!.status, 302);
  const location = res!.headers.get('location');
  assert.ok(location);
  return new URL(location).searchParams.get('code')!;
}

async function issueCode(h: Awaited<ReturnType<typeof harness>>) {
  return codeFrom((await authorize(h.host))!, h.host);
}

const bearer = (token: string) => new Request(`${ORIGIN}/v1/native/session`, { headers: { authorization: `Bearer ${token}` } });

test('D1 exchange grants exactly one session for a code under parallel exchange', async () => {
  const h = await harness();
  const code = await issueCode(h);
  const results = await Promise.all([0, 1, 2, 3].map(() => nativeSessionHttp(exchangeRequest(exchangeBody(code)), h.host)));
  const statuses = results.map(r => r!.status).sort();
  assert.deepEqual(statuses, [200, 400, 400, 400]);
  const count = h.db.db.prepare('SELECT COUNT(*) AS n FROM native_sessions').get() as { n: number };
  assert.equal(count.n, 1);
});

test('D1 replay after a successful exchange issues no second session', async () => {
  const h = await harness();
  const code = await issueCode(h);
  assert.equal((await nativeSessionHttp(exchangeRequest(exchangeBody(code)), h.host))!.status, 200);
  const replay = await nativeSessionHttp(exchangeRequest(exchangeBody(code)), h.host);
  assert.equal(replay!.status, 400);
  assert.equal(((await replay!.json()) as { error: string }).error, 'invalid_grant');
  assert.equal((h.db.db.prepare('SELECT COUNT(*) AS n FROM native_sessions').get() as { n: number }).n, 1);
});

test('D1 grant refuses an expired code even if the peek accepted it', async () => {
  const h = await harness();
  const store = d1NativeSessionStore(h.db);
  const code = await issueCode(h);
  const digest = nativeCredentialDigest(code);
  const granted = await store.grant({
    codeDigest: digest, clientId: CLIENT_ID, redirectUri: REDIRECT, codeChallenge: CHALLENGE,
    founderId: 'founder-1', tenantId: 'tenant-alpha', tokenDigest: 'a'.repeat(64),
    now: new Date(Date.parse(NOW) + NATIVE_CODE_TTL_MS).toISOString(),
    expiresAt: '2026-11-02T00:45:00.000Z',
  });
  assert.equal(granted, false);
  assert.equal((h.db.db.prepare('SELECT COUNT(*) AS n FROM native_sessions').get() as { n: number }).n, 0);
});

test('D1 grant refuses a second session that reuses the same code', async () => {
  const h = await harness();
  const store = d1NativeSessionStore(h.db);
  const code = await issueCode(h);
  const input = {
    codeDigest: nativeCredentialDigest(code), clientId: CLIENT_ID, redirectUri: REDIRECT, codeChallenge: CHALLENGE,
    founderId: 'founder-1', tenantId: 'tenant-alpha', now: NOW, expiresAt: '2026-11-02T00:45:00.000Z',
  };
  assert.equal(await store.grant({ ...input, tokenDigest: 'b'.repeat(64) }), true);
  assert.equal(await store.grant({ ...input, tokenDigest: 'c'.repeat(64) }), false);
});

test('D1 stores only digests and never the raw code or token', async () => {
  const h = await harness();
  const code = await issueCode(h);
  const response = await nativeSessionHttp(exchangeRequest(exchangeBody(code)), h.host);
  const body = (await response!.json()) as { token: string };
  const stored = dump(h.db);
  assert.equal(stored.includes(code), false);
  assert.equal(stored.includes(body.token), false);
  assert.equal(stored.includes(nativeCredentialDigest(body.token)), true);
  assert.equal(stored.includes(VERIFIER), false);
});

test('D1 schema has no plaintext credential column', async () => {
  const h = await harness();
  const columns = h.db.db.prepare("SELECT name FROM pragma_table_info('native_sessions') UNION ALL SELECT name FROM pragma_table_info('native_authorization_codes')").all() as Array<{ name: string }>;
  const names = columns.map(c => c.name);
  assert.equal(names.some(n => /^(code|token|secret|verifier|plaintext)$/.test(n)), false);
  assert.ok(names.includes('token_digest') && names.includes('code_digest'));
});

test('D1 cleanup removes only expired hashed metadata and validates its cutoff', async () => {
  const h = await harness();
  const code = await issueCode(h);
  await nativeSessionHttp(exchangeRequest(exchangeBody(code)), h.host);
  const before = await cleanupExpiredNativeSessions(h.db, NOW);
  assert.deepEqual(before, { sessions: 0, codes: 0 });
  const later = await cleanupExpiredNativeSessions(h.db, '2026-11-02T02:00:00.000Z');
  assert.deepEqual(later, { sessions: 1, codes: 1 });
  await assert.rejects(cleanupExpiredNativeSessions(h.db, 'not-a-date'), /cutoff_invalid/);
  // Shape-valid but impossible instants refuse with the categorical error, never a RangeError.
  for (const bad of ['2026-13-01T00:00:00.000Z', '2026-11-02T25:00:00.000Z', '2026-02-30T00:00:00.000Z']) {
    await assert.rejects(cleanupExpiredNativeSessions(h.db, bad), /cutoff_invalid/, bad);
  }
});

test('D1 revoke returns true once for one token and leaves other sessions valid', async () => {
  const h = await harness();
  const store = d1NativeSessionStore(h.db);
  const first = await issueCode(h);
  const second = await issueCode(h);
  const a = (await (await nativeSessionHttp(exchangeRequest(exchangeBody(first)), h.host))!.json()) as { token: string };
  const b = (await (await nativeSessionHttp(exchangeRequest(exchangeBody(second)), h.host))!.json()) as { token: string };
  assert.equal(await store.revoke(nativeCredentialDigest(a.token), NOW), true);
  assert.equal(await store.revoke(nativeCredentialDigest(a.token), NOW), false);
  assert.equal(await store.readSession(nativeCredentialDigest(b.token), NOW) !== null, true);
});
