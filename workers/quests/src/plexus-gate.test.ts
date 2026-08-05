// cambium-quests · Plexus Access gate tests (node:test).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign, createHash } from 'node:crypto';
import { handle } from './handler.ts';
import type { KvLike, SimpleRequest } from './handler.ts';
import { resolvePlexusPrincipal } from './lib/plexus-principal.ts';

const TEAM_DOMAIN = 'red-queen-4dfa.cloudflareaccess.com';
const AUD = '5695e8409cd4e838eaaef4de4995541dae4f31a2773945ea67f136800977c200';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
const KID = 'test-kid-1';

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function signJwt(payload: Record<string, unknown>, kid: string | undefined = KID): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createSign('RSA-SHA256').update(`${header}.${body}`).sign(privateKey, 'base64url');
  return `${header}.${body}.${sig}`;
}

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: `https://${TEAM_DOMAIN}`,
    aud: AUD,
    email: 'shesh@thoughtseed.space',
    exp: Math.floor(Date.now() / 1000) + 600,
    ...overrides,
  };
}

function fakeKv(): KvLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(k) { return store.get(k) ?? null; },
    async put(k, v) { store.set(k, v); },
    async list(prefix) { return [...store.keys()].filter((k) => k.startsWith(prefix)); },
  };
}

function jwksFetch(whoamiStatus = 200, whoamiBody: unknown = {}): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/cdn-cgi/access/certs')) {
      return new Response(JSON.stringify({ keys: [{ ...jwk, kid: KID }] }), { status: 200 });
    }
    if (url.includes('/v1/whoami')) {
      return new Response(JSON.stringify(whoamiBody), {
        status: whoamiStatus,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
}

const questEnvelope = JSON.stringify({
  schema: 'quest-envelope-v1',
  derivedAt: '2026-07-27T00:00:00Z',
  source: 'test',
  tenant: 'cambium',
  ledger: { quests: [] },
});

function questReq(headers: Record<string, string> = {}): SimpleRequest {
  return { method: 'GET', path: '/api/quests/cambium', headers };
}

test('plexus resolver · enveloped inactive admin whoami floors to consultant', async () => {
  const kv = fakeKv();
  const jwt = signJwt(validPayload());
  const res = await resolvePlexusPrincipal(
    { 'cf-access-jwt-assertion': jwt },
    { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    kv,
    jwksFetch(200, {
      ok: true,
      data: {
        email: 'shesh@thoughtseed.space',
        role: 'admin',
        isActive: false,
        identityId: 'pid_admin_inactive_shesh',
      },
    }),
  );
  assert.equal(res.kind, 'principal');
  if (res.kind === 'principal') assert.equal(res.principal.role, 'consultant');
});

test('plexus resolver · active admin whoami → founder', async () => {
  const kv = fakeKv();
  const jwt = signJwt(validPayload());
  const res = await resolvePlexusPrincipal(
    { 'cf-access-jwt-assertion': jwt },
    { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    kv,
    jwksFetch(200, {
      email: 'shesh@thoughtseed.space',
      role: 'admin',
      isActive: true,
      identityId: 'pid_admin_shesh',
    }),
  );
  assert.equal(res.kind, 'principal');
  if (res.kind === 'principal') assert.equal(res.principal.role, 'founder');
});

test('plexus resolver · canonical ok true object data active admin → founder', async () => {
  const kv = fakeKv();
  const jwt = signJwt(validPayload({ email: 'Founder@Thoughtseed.Space' }));
  const res = await resolvePlexusPrincipal(
    { 'cf-access-jwt-assertion': jwt },
    { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    kv,
    jwksFetch(200, {
      ok: true,
      data: {
        email: ' founder@thoughtseed.space ',
        role: 'admin',
        identityId: 'pid_admin_founder',
      },
    }),
  );
  assert.equal(res.kind, 'principal');
  if (res.kind === 'principal') assert.equal(res.principal.role, 'founder');
});

test('plexus resolver · legacy flat active admin compatibility is preserved', async () => {
  const kv = fakeKv();
  const jwt = signJwt(validPayload());
  const res = await resolvePlexusPrincipal(
    { 'cf-access-jwt-assertion': jwt },
    { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    kv,
    jwksFetch(200, {
      email: 'shesh@thoughtseed.space',
      role: 'admin',
      identityId: 'pid_admin_flat_compat',
    }),
  );
  assert.equal(res.kind, 'principal');
  if (res.kind === 'principal') assert.equal(res.principal.role, 'founder');
});

test('plexus resolver · enveloped employee whoami → team, never founder', async () => {
  const kv = fakeKv();
  const jwt = signJwt(validPayload({ email: 'dev@thoughtseed.space' }));
  const res = await resolvePlexusPrincipal(
    { 'cf-access-jwt-assertion': jwt },
    { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    kv,
    jwksFetch(200, {
      ok: true,
      data: { email: 'dev@thoughtseed.space', role: 'employee', identityId: 'pid_dev' },
    }),
  );
  assert.equal(res.kind, 'principal');
  if (res.kind === 'principal') assert.equal(res.principal.role, 'team');
});

test('plexus resolver · whoami 404 (unregistered) floors to consultant', async () => {
  const kv = fakeKv();
  const jwt = signJwt(validPayload({ email: 'stranger@example.com' }));
  const res = await resolvePlexusPrincipal(
    { 'cf-access-jwt-assertion': jwt },
    { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    kv,
    jwksFetch(404, { code: 'identity_not_registered' }),
  );
  assert.equal(res.kind, 'principal');
  if (res.kind === 'principal') assert.equal(res.principal.role, 'consultant');
});

test('plexus resolver · whoami 5xx fails closed to consultant, never founder', async () => {
  const kv = fakeKv();
  const jwt = signJwt(validPayload());
  const res = await resolvePlexusPrincipal(
    { 'cf-access-jwt-assertion': jwt },
    { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    kv,
    jwksFetch(500, { error: 'boom' }),
  );
  assert.equal(res.kind, 'principal');
  if (res.kind === 'principal') assert.equal(res.principal.role, 'consultant');
});

test('plexus resolver · malformed, canonical-invalid, mismatched, and inactive payloads fail closed', async () => {
  const cases: Array<{ name: string; body: unknown }> = [
    { name: 'non-object payload', body: 'not-an-object' },
    { name: 'null payload', body: null },
    { name: 'canonical ok false', body: { ok: false, data: { email: 'shesh@thoughtseed.space', role: 'admin', isActive: true } } },
    { name: 'canonical ok non-boolean truthy', body: { ok: 1, data: { email: 'shesh@thoughtseed.space', role: 'admin', isActive: true } } },
    { name: 'canonical missing data', body: { ok: true } },
    { name: 'canonical null data', body: { ok: true, data: null } },
    { name: 'canonical array data', body: { ok: true, data: [] } },
    { name: 'canonical scalar data', body: { ok: true, data: 'not-an-object' } },
    { name: 'canonical empty data', body: { ok: true, data: {} } },
    { name: 'nested canonical envelope', body: { ok: true, data: { ok: true, data: { email: 'shesh@thoughtseed.space', role: 'admin' } } } },
    { name: 'missing session email', body: { email: '   ', role: 'admin', isActive: true } },
    { name: 'non-email session identity', body: { email: 'not-an-email', role: 'admin' } },
    { name: 'mismatched session email', body: { email: 'other@thoughtseed.space', role: 'admin', isActive: true } },
    { name: 'plus alias mismatch', body: { email: 'shesh+alias@thoughtseed.space', role: 'admin' } },
    { name: 'dot alias mismatch', body: { email: 'shesh.iyer@thoughtseed.space', role: 'admin' } },
    { name: 'inactive admin', body: { email: 'shesh@thoughtseed.space', role: 'admin', isActive: false } },
    { name: 'malformed active flag', body: { email: 'shesh@thoughtseed.space', role: 'admin', isActive: 'false' } },
  ];

  for (const { name, body } of cases) {
    const kv = fakeKv();
    const jwt = signJwt(validPayload());
    const res = await resolvePlexusPrincipal(
      { 'cf-access-jwt-assertion': jwt },
      { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
      kv,
      jwksFetch(200, body),
    );
    assert.equal(res.kind, 'principal', name);
    if (res.kind === 'principal') {
      assert.equal(res.principal.role, 'consultant', name);
    }
  }
});

test('plexus resolver · missing JWT → unauthenticated', async () => {
  const kv = fakeKv();
  const res = await resolvePlexusPrincipal(
    {},
    { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    kv,
    jwksFetch(),
  );
  assert.equal(res.kind, 'unauthenticated');
});

test('plexus resolver · expired JWT → unauthenticated', async () => {
  const kv = fakeKv();
  const jwt = signJwt(validPayload({ exp: Math.floor(Date.now() / 1000) - 10 }));
  const res = await resolvePlexusPrincipal(
    { 'cf-access-jwt-assertion': jwt },
    { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    kv,
    jwksFetch(),
  );
  assert.equal(res.kind, 'unauthenticated');
});

test('plexus resolver · wrong AUD → unauthenticated', async () => {
  const kv = fakeKv();
  const jwt = signJwt(validPayload({ aud: 'wrong-aud-value' }));
  const res = await resolvePlexusPrincipal(
    { 'cf-access-jwt-assertion': jwt },
    { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    kv,
    jwksFetch(),
  );
  assert.equal(res.kind, 'unauthenticated');
});

test('plexus resolver · tampered signature → unauthenticated', async () => {
  const kv = fakeKv();
  const jwt = signJwt(validPayload());
  const [h, b] = jwt.split('.');
  const forged = `${h}.${b}.${b64url('forged-signature-bytes')}`;
  const res = await resolvePlexusPrincipal(
    { 'cf-access-jwt-assertion': forged },
    { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    kv,
    jwksFetch(200, { email: 'shesh@thoughtseed.space', role: 'admin' }),
  );
  assert.equal(res.kind, 'unauthenticated');
});

test('plexus resolver · env unset → unconfigured (dev founder fallback path)', async () => {
  const kv = fakeKv();
  const res = await resolvePlexusPrincipal(
    {},
    { teamDomain: undefined, aud: undefined },
    kv,
    jwksFetch(),
  );
  assert.equal(res.kind, 'unconfigured');
});

test('plexus resolver · whoami verdict cached in KV for repeat calls', async () => {
  const kv = fakeKv();
  const jwt = signJwt(validPayload());
  let whoamiCalls = 0;
  const countingFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/cdn-cgi/access/certs')) {
      return new Response(JSON.stringify({ keys: [{ ...jwk, kid: KID }] }), { status: 200 });
    }
    if (url.includes('/v1/whoami')) {
      whoamiCalls += 1;
      return new Response(JSON.stringify({ email: 'shesh@thoughtseed.space', role: 'admin', identityId: 'pid_admin_shesh' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('nf', { status: 404 });
  }) as typeof fetch;

  const cfg = { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' };
  const r1 = await resolvePlexusPrincipal({ 'cf-access-jwt-assertion': jwt }, cfg, kv, countingFetch);
  const r2 = await resolvePlexusPrincipal({ 'cf-access-jwt-assertion': jwt }, cfg, kv, countingFetch);
  assert.equal(r1.kind, 'principal');
  assert.equal(r2.kind, 'principal');
  assert.equal(whoamiCalls, 1, 'second call must hit the KV cache');
  const cacheKey = `plexus:whoami:${createHash('sha256').update(jwt).digest('hex')}`;
  assert.ok(kv.store.has(cacheKey), 'cache key present');
  const cached = JSON.parse(kv.store.get(cacheKey) ?? '{}') as Record<string, unknown>;
  assert.equal(cached.version, 2, 'cache payload carries the resolver schema version');
  assert.equal(cached.accessEmail, 'shesh@thoughtseed.space', 'cache payload binds the verified Access email');
});

test('plexus resolver · pre-repair unbound founder cache is ignored', async () => {
  const kv = fakeKv();
  const jwt = signJwt(validPayload());
  const oldCacheKey = `plexus:whoami:${createHash('sha256').update(jwt).digest('hex')}`;
  await kv.put(oldCacheKey, JSON.stringify({
    cachedAt: Date.now(),
    principal: { id: 'pid_cached_founder', tenant: '*', role: 'founder', allow: [], createdBy: 'plexus' },
  }));
  let whoamiCalls = 0;
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/cdn-cgi/access/certs')) {
      return new Response(JSON.stringify({ keys: [{ ...jwk, kid: KID }] }), { status: 200 });
    }
    if (url.includes('/v1/whoami')) {
      whoamiCalls += 1;
      return new Response(JSON.stringify({
        ok: true,
        data: {
          email: 'intruder@thoughtseed.space',
          role: 'admin',
          isActive: true,
          identityId: 'pid_intruder',
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('nf', { status: 404 });
  }) as typeof fetch;

  const res = await resolvePlexusPrincipal(
    { 'cf-access-jwt-assertion': jwt },
    { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    kv,
    fetchImpl,
  );

  assert.equal(whoamiCalls, 1, 'live whoami must run instead of trusting the old founder cache');
  assert.equal(res.kind, 'principal');
  if (res.kind === 'principal') {
    assert.equal(res.principal.role, 'consultant');
  }
});

test('plexus resolver · cache bound to another Access email is ignored', async () => {
  const kv = fakeKv();
  const jwt = signJwt(validPayload());
  const cacheKey = `plexus:whoami:${createHash('sha256').update(jwt).digest('hex')}`;
  await kv.put(cacheKey, JSON.stringify({
    version: 2,
    accessEmail: 'other@thoughtseed.space',
    cachedAt: Date.now(),
    principal: { id: 'pid_cached_founder', tenant: '*', role: 'founder', allow: [], createdBy: 'plexus' },
  }));
  let whoamiCalls = 0;
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/cdn-cgi/access/certs')) {
      return new Response(JSON.stringify({ keys: [{ ...jwk, kid: KID }] }), { status: 200 });
    }
    if (url.includes('/v1/whoami')) {
      whoamiCalls += 1;
      return new Response(JSON.stringify({ ok: false }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('nf', { status: 404 });
  }) as typeof fetch;

  const res = await resolvePlexusPrincipal(
    { 'cf-access-jwt-assertion': jwt },
    { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    kv,
    fetchImpl,
  );

  assert.equal(whoamiCalls, 1, 'email-mismatched cache must not suppress live whoami');
  assert.equal(res.kind, 'principal');
  if (res.kind === 'principal') assert.equal(res.principal.role, 'consultant');
});

test('handler gate · missing JWT with plexus configured → 401 access_identity_required', async () => {
  const kv = fakeKv();
  await kv.put('ledger:cambium', questEnvelope);
  const res = await handle(questReq(), {
    kv,
    plexus: { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
  });
  assert.equal(res.status, 401);
  const body = JSON.parse(String(res.body));
  assert.equal(body.error, 'access_identity_required');
});

test('handler gate · plexus unset (dev) → no principal → public body (pre-existing behavior)', async () => {
  const kv = fakeKv();
  await kv.put('ledger:cambium', questEnvelope);
  const res = await handle(questReq(), { kv });
  assert.equal(res.status, 200);
  const body = JSON.parse(String(res.body));
  assert.equal(body.tenant, 'cambium', 'public envelope served');
  assert.equal(body.surface, undefined, 'no surface scope without a principal');
});
