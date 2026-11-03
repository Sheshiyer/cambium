import assert from 'node:assert/strict';
import test from 'node:test';

import worker from './index.ts';
import { nativeCredentialDigest } from './native-session.ts';

const OWNER_ORIGIN = 'https://cambium.example';
const CLIENT_ID = 'space.thoughtseed.cambium.native.dev';
const REDIRECT_URI = 'space.thoughtseed.cambium.native.dev://oauth/callback';
const TOKEN = `cns1_${'A'.repeat(43)}`;
const FOUNDER_ID = 'pid_admin_thoughtseed_labs';

/** Minimal D1 surface for the production composition read path. */
function sessionDb() {
  return {
    prepare(sql: string) {
      return {
        bind(..._values: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes('FROM native_sessions')) {
                return {
                  founder_id: FOUNDER_ID,
                  tenant_id: 'cambium',
                  client_id: CLIENT_ID,
                  expires_at: '2099-01-01T00:00:00.000Z',
                } as T;
              }
              return null;
            },
            async all<T>() { return { results: [] as T[] }; },
            async run() { return { meta: { changes: 0 } }; },
          };
        },
      };
    },
  };
}

function env() {
  return {
    QUESTS: {
      async get() { return null; },
      async put() {},
      async list() { return { keys: [] }; },
    },
    BRIDGE_DB: sessionDb(),
    PLEXUS_NATIVE_IDENTITY_URL: 'https://teamforge.example/v1/native/identity',
    PLEXUS_NATIVE_IDENTITY_TOKEN: 'dedicated-token',
    PLEXUS_NATIVE_IDENTITY_TENANT: 'cambium',
    TF_ACCESS_TEAM_DOMAIN: 'red-queen-4dfa.cloudflareaccess.com',
    TF_ACCESS_AUD: 'access-audience',
    PLEXUS_WHOAMI_URL: 'https://teamforge.example/v1/whoami',
    NATIVE_SESSION_OWNER_ORIGIN: OWNER_ORIGIN,
    NATIVE_SESSION_CLIENTS_JSON: JSON.stringify([{ clientId: CLIENT_ID, redirectUri: REDIRECT_URI }]),
    MISSION_FABRIC_TENANTS: 'cambium',
  };
}

test('Worker entrypoint composes the live native session authority seam', async () => {
  const runtime = globalThis as typeof globalThis & { fetch: typeof fetch };
  const previousFetch = runtime.fetch;
  const calls: string[] = [];
  runtime.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    assert.match(url, /^https:\/\/teamforge\.example\/v1\/native\/identity\//);
    return new Response(JSON.stringify({ ok: true, data: {
      contractVersion: 'plexus.native-identity.v1',
      identityId: FOUNDER_ID,
      tenantId: 'cambium',
      workspaceId: 'ws_thoughtseed',
      role: 'admin',
      active: true,
      enrolled: true,
    } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const response = await worker.fetch(new Request(`${OWNER_ORIGIN}/v1/native/session`, {
      headers: { authorization: `Bearer ${TOKEN}`, host: 'cambium.example' },
    }), env() as never, {} as never);
    if (response.status !== 200) assert.fail(await response.text());
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.contractVersion, 'cambium.native-session.v1');
    assert.equal(body.founderId, FOUNDER_ID);
    assert.equal(body.tenantId, 'cambium');
    assert.equal(body.role, 'founder');
    assert.equal(body.enrolled, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /tenant_id=cambium$/);
    assert.equal(nativeCredentialDigest(TOKEN).length, 64);
  } finally {
    runtime.fetch = previousFetch;
  }
});
