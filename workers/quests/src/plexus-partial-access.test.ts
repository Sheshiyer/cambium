// cambium-quests · a half-configured Access gate fails closed (node:test).
//
// TF_ACCESS_TEAM_DOMAIN and TF_ACCESS_AUD together switch the Plexus/Access
// gate on. Either one alone must not switch it off: every Plexus route refuses
// (503) and none of them falls back to a caller-chosen, dev or anonymous
// principal, or to the public envelope.

import assert from 'node:assert/strict';
import test from 'node:test';

import { handle } from './handler.ts';
import type { GateConfig, HandlerDeps, KvLike, SimpleRequest, SimpleResponse } from './handler.ts';
import type { PlexusGateConfig } from './lib/plexus-principal.ts';
import worker from './index.ts';

const TEAM_DOMAIN = 'team.cloudflareaccess.com';
const AUD = 'aud-1';
const OWNER_ORIGIN = 'https://cambium.example';
const NATIVE_CLIENT_ID = 'space.thoughtseed.cambium.native.dev';
const FOUNDER_BINDINGS = JSON.stringify([{ founderId: 'access:pid_admin_example', tenantId: 'cambium' }]);
const PROPOSAL_ID = `cambium:${'a'.repeat(64)}`;

const FORGED_FOUNDER = JSON.stringify({
  id: 'forged-founder', tenant: '*', role: 'founder', allow: [], createdBy: 'caller',
});
// Shaped like an Access assertion. With the gate half-set it must never be
// verified, so no JWKS or whoami request may leave the Worker.
const ACCESS_ASSERTION = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImsxIn0.eyJlbWFpbCI6ImZvdW5kZXJAZXhhbXBsZS5jb20ifQ.c2ln';

const ENVELOPE = JSON.stringify({
  schema: 'quest-envelope-v1',
  derivedAt: '2026-11-28T00:00:00Z',
  source: 'test',
  tenant: 'cambium',
  ledger: { quests: [] },
});

const ACCESS_ALONE = [
  { name: 'TF_ACCESS_TEAM_DOMAIN alone', env: { TF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN } },
  { name: 'TF_ACCESS_AUD alone', env: { TF_ACCESS_AUD: AUD } },
] as const;

type Expected = { status: 503; error: string };

interface Probe {
  label: string;
  method: 'GET' | 'POST';
  path: string;
  headers?: Record<string, string>;
  body?: string;
  expect: Expected;
}

const FOUNDER_WEB = { 'x-cambium-founder-web': '1' };
const JSON_BODY = { 'content-type': 'application/json' };

/** Every route that consumes deps.plexus, plus the founder decision host built from it. */
const PLEXUS_ROUTES: Probe[] = [
  { label: 'quests GET with x-principal', method: 'GET', path: '/api/quests/cambium',
    headers: { 'x-principal': FORGED_FOUNDER }, expect: { status: 503, error: 'plexus_gate_misconfigured' } },
  { label: 'quests GET with ?principal=', method: 'GET', path: `/api/quests/cambium?principal=${encodeURIComponent(FORGED_FOUNDER)}`,
    expect: { status: 503, error: 'plexus_gate_misconfigured' } },
  { label: 'quests GET with an Access assertion', method: 'GET', path: '/api/quests/cambium',
    headers: { 'cf-access-jwt-assertion': ACCESS_ASSERTION }, expect: { status: 503, error: 'plexus_gate_misconfigured' } },
  { label: 'founder-web quests GET', method: 'GET', path: '/founder/api/quests/cambium',
    headers: { ...FOUNDER_WEB, 'x-principal': FORGED_FOUNDER }, expect: { status: 503, error: 'plexus_gate_misconfigured' } },
  { label: 'mission fabric GET', method: 'GET', path: '/v1/mission-fabric/cambium',
    headers: { 'cf-access-jwt-assertion': ACCESS_ASSERTION }, expect: { status: 503, error: 'plexus_gate_misconfigured' } },
  { label: 'portfolio actions POST', method: 'POST', path: '/v1/admin/portfolio/actions',
    headers: JSON_BODY, body: '{}', expect: { status: 503, error: 'portfolio action authentication is not configured' } },
  { label: 'portfolio actions POST with an Access assertion', method: 'POST', path: '/v1/admin/portfolio/actions',
    headers: { ...JSON_BODY, 'cf-access-jwt-assertion': ACCESS_ASSERTION }, body: '{}',
    expect: { status: 503, error: 'portfolio action authentication is not configured' } },
  { label: 'portfolio descriptions GET', method: 'GET', path: '/v1/admin/portfolio/descriptions',
    expect: { status: 503, error: 'founder access required' } },
  { label: 'founder session GET', method: 'GET', path: '/v1/founder/session',
    headers: FOUNDER_WEB, expect: { status: 503, error: 'founder_host_unconfigured' } },
  { label: 'founder graph GET', method: 'GET', path: '/v1/founder/graph',
    headers: FOUNDER_WEB, expect: { status: 503, error: 'founder_identity_required' } },
  { label: 'founder intake POST', method: 'POST', path: '/v1/founder/intake',
    headers: { ...FOUNDER_WEB, ...JSON_BODY }, body: '{}', expect: { status: 503, error: 'founder_identity_required' } },
  { label: 'founder growth page GET', method: 'GET', path: '/founder/growth',
    expect: { status: 503, error: 'founder_identity_required' } },
  { label: 'founder-web Gate POST', method: 'POST', path: '/founder/api/gate/cambium',
    headers: { ...FOUNDER_WEB, ...JSON_BODY }, body: JSON.stringify({ kind: 'approve-goal-graph', subject: PROPOSAL_ID }),
    expect: { status: 503, error: 'founder web gate is not configured' } },
  { label: 'founder proposal POST', method: 'POST', path: '/v1/founder/proposal',
    headers: { ...FOUNDER_WEB, ...JSON_BODY }, body: JSON.stringify({ proposalId: PROPOSAL_ID }),
    expect: { status: 503, error: 'founder_host_unconfigured' } },
  { label: 'growth approval status POST', method: 'POST', path: '/v1/founder/growth/status',
    headers: { ...FOUNDER_WEB, ...JSON_BODY }, body: JSON.stringify({ proposalId: PROPOSAL_ID }),
    expect: { status: 503, error: 'founder_host_unconfigured' } },
];

function responseError(status: number, text: string): string | undefined {
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    return typeof parsed.error === 'string' ? parsed.error : undefined;
  } catch {
    return undefined;
  }
}

/** A refusal: the expected status and error, with no surface and no caller-chosen identity in the body. */
function assertRefused(probe: Probe, status: number, text: string, context: string): void {
  assert.equal(status, probe.expect.status, `${context} · ${probe.label}: ${text.slice(0, 200)}`);
  assert.notEqual(text, ENVELOPE, `${context} · ${probe.label} must not serve the public envelope`);
  assert.doesNotMatch(text, /forged-founder|anonymous-founder|"surface"/, `${context} · ${probe.label}`);
  if (probe.path === '/admin/portfolio/web') return;
  assert.equal(responseError(status, text), probe.expect.error, `${context} · ${probe.label}`);
}

// ---------------------------------------------------------------------------
// Handler: deps.plexus exactly as index.ts now builds it from one Access var.
// ---------------------------------------------------------------------------

function fakeKv(): KvLike {
  const rows = new Map<string, string>([['ledger:cambium', ENVELOPE]]);
  return {
    async get(key) { return rows.get(key) ?? null; },
    async put(key, value) { rows.set(key, value); },
    async list(prefix) { return [...rows.keys()].filter((key) => key.startsWith(prefix)); },
  };
}

const TELEGRAM_GATE: GateConfig = { botId: '1234567890', pubKeyHex: 'a'.repeat(64), founderIds: ['111'] };

function handlerDeps(plexus: PlexusGateConfig | undefined, accessCalls: string[]): HandlerDeps {
  const refuseWrite = async () => { throw new Error('a refused request must never write'); };
  return {
    kv: fakeKv(),
    plexus,
    // Defence in depth: even a dev flag beside a half gate never yields a caller principal.
    devSurfacePrincipal: true,
    plexusFetchImpl: (async (input: RequestInfo | URL) => {
      accessCalls.push(String(input));
      throw new Error('no Access lookup expected');
    }) as typeof fetch,
    gate: TELEGRAM_GATE,
    missionFabricTenants: ['cambium'],
    founderGateBindingsJson: FOUNDER_BINDINGS,
    // reject + readDecisionReceipt are what createFounderAccessHost needs to bind a host.
    goalGraphStore: {
      async readHead() { return null; },
      async readNodes() { return []; },
      commit: refuseWrite,
      reject: refuseWrite,
      async readDecisionReceipt() { return null; },
    },
    branchMapReceiptStore: {
      recordReceipt: refuseWrite,
      async listReceipts() { return []; },
    },
  } as unknown as HandlerDeps;
}

function simple(probe: Probe): SimpleRequest {
  return { method: probe.method, path: probe.path, headers: { ...(probe.headers ?? {}) }, body: probe.body };
}

const bodyText = (res: SimpleResponse): string => String(res.body ?? '');

for (const access of ACCESS_ALONE) {
  const plexus: PlexusGateConfig = {
    teamDomain: (access.env as { TF_ACCESS_TEAM_DOMAIN?: string }).TF_ACCESS_TEAM_DOMAIN,
    aud: (access.env as { TF_ACCESS_AUD?: string }).TF_ACCESS_AUD,
    whoamiUrl: undefined,
  };

  test(`partial Access · handler · ${access.name}: every Plexus route refuses`, async () => {
    const accessCalls: string[] = [];
    const deps = handlerDeps(plexus, accessCalls);
    for (const probe of PLEXUS_ROUTES) {
      const res = await handle(simple(probe), deps);
      assertRefused(probe, res.status, bodyText(res), access.name);
    }
    const portfolio = await handle({ method: 'GET', path: '/admin/portfolio/web', headers: {} }, deps);
    assert.equal(portfolio.status, 503, `${access.name} · portfolio web`);
    assert.doesNotMatch(bodyText(portfolio), /data-bundled="portfolio-cartographer"/);
    assert.deepEqual(accessCalls, [], 'no JWKS or whoami lookup with a half-configured gate');
  });
}

test('partial Access · handler · a complete gate still binds the founder host (401 without identity)', async () => {
  const accessCalls: string[] = [];
  const deps = handlerDeps({ teamDomain: TEAM_DOMAIN, aud: AUD }, accessCalls);
  const res = await handle(simple(PLEXUS_ROUTES.find((probe) => probe.path === '/v1/founder/proposal')!), deps);
  assert.equal(res.status, 401, bodyText(res));
  assert.equal(JSON.parse(bodyText(res)).status, 'unauthorized');
});

// ---------------------------------------------------------------------------
// Worker entrypoint: the real env → deps composition in index.ts.
// ---------------------------------------------------------------------------

/** Minimal D1 surface: construction only. A refused request never reaches a query. */
function bridgeDb() {
  return {
    prepare() {
      return {
        bind() {
          return {
            async first() { throw new Error('a refused request must not read D1'); },
            async all() { throw new Error('a refused request must not read D1'); },
            async run() { throw new Error('a refused request must not write D1'); },
          };
        },
      };
    },
  };
}

function workerEnv(access: Record<string, string>) {
  const rows = new Map<string, string>([['ledger:cambium', ENVELOPE]]);
  return {
    QUESTS: {
      async get(key: string) { return rows.get(key) ?? null; },
      async put(key: string, value: string) { rows.set(key, value); },
      async list({ prefix }: { prefix: string }) {
        return { keys: [...rows.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })) };
      },
    },
    BRIDGE_DB: bridgeDb(),
    // The dev flag is set on purpose: an Access var alone must still disable it.
    CAMBIUM_DEV_SURFACE_PRINCIPAL: '1',
    GATE_BOT_ID: TELEGRAM_GATE.botId,
    GATE_FOUNDER_IDS: TELEGRAM_GATE.founderIds.join(','),
    MISSION_FABRIC_TENANTS: 'cambium',
    FOUNDER_GATE_BINDINGS_JSON: FOUNDER_BINDINGS,
    PLEXUS_NATIVE_IDENTITY_URL: 'https://teamforge.example/v1/native/identity',
    PLEXUS_NATIVE_IDENTITY_TOKEN: 'dedicated-token',
    PLEXUS_NATIVE_IDENTITY_TENANT: 'cambium',
    PLEXUS_WHOAMI_URL: 'https://teamforge.example/v1/whoami',
    NATIVE_SESSION_OWNER_ORIGIN: OWNER_ORIGIN,
    NATIVE_SESSION_CLIENTS_JSON: JSON.stringify([{ clientId: NATIVE_CLIENT_ID, redirectUri: `${NATIVE_CLIENT_ID}://oauth/callback` }]),
    ...access,
  };
}

async function workerFetch(origin: string, probe: Probe, env: Record<string, unknown>) {
  const response = await worker.fetch(new Request(`${origin}${probe.path}`, {
    method: probe.method,
    headers: probe.headers ?? {},
    ...(probe.body !== undefined ? { body: probe.body } : {}),
  }), env as never);
  return { status: response.status, text: await response.text() };
}

async function withNoNetwork<T>(run: (calls: string[]) => Promise<T>): Promise<T> {
  const runtime = globalThis as typeof globalThis & { fetch: typeof fetch };
  const previousFetch = runtime.fetch;
  const calls: string[] = [];
  runtime.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    throw new Error('no network expected with a half-configured Access gate');
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    runtime.fetch = previousFetch;
  }
}

for (const access of ACCESS_ALONE) {
  test(`partial Access · Worker entrypoint · ${access.name}: every Plexus route refuses`, async () => {
    await withNoNetwork(async (calls) => {
      const env = workerEnv(access.env);
      // Loopback is the only host where the dev flag could ever apply; the
      // deployed host is where a half-set env would actually ship.
      for (const origin of ['http://localhost:8787', 'https://curious.thoughtseed.space']) {
        for (const probe of PLEXUS_ROUTES) {
          const res = await workerFetch(origin, probe, env);
          assertRefused(probe, res.status, res.text, `${access.name} @ ${origin}`);
        }
        const portfolio = await workerFetch(origin, {
          label: 'portfolio web GET', method: 'GET', path: '/admin/portfolio/web', expect: { status: 503, error: '' },
        }, env);
        assert.equal(portfolio.status, 503, `${access.name} @ ${origin} · portfolio web`);
        assert.doesNotMatch(portfolio.text, /data-bundled="portfolio-cartographer"/);
      }
      // The native session host needs the complete Access gate too.
      const native = await workerFetch(OWNER_ORIGIN, {
        label: 'native session GET', method: 'GET', path: '/v1/native/session',
        headers: { authorization: `Bearer cns1_${'A'.repeat(43)}`, host: 'cambium.example' },
        expect: { status: 503, error: 'native_session_unconfigured' },
      }, env);
      assert.equal(native.status, 503, native.text);
      assert.equal(responseError(native.status, native.text), 'native_session_unconfigured');
      assert.deepEqual(calls, [], 'no JWKS, whoami or native identity request leaves the Worker');
    });
  });
}

test('partial Access · Worker entrypoint · contrast: no Access keeps the public envelope, both vars bind the gate', async () => {
  await withNoNetwork(async () => {
    const questRead: Probe = { label: 'quests GET', method: 'GET', path: '/api/quests/cambium',
      headers: { 'x-principal': FORGED_FOUNDER }, expect: { status: 503, error: '' } };
    const deployedNoAccess = await workerFetch('https://curious.thoughtseed.space', questRead, workerEnv({}));
    assert.equal(deployedNoAccess.status, 200);
    assert.equal(deployedNoAccess.text, ENVELOPE, 'no Access at all: public envelope, caller principal ignored');

    const complete = workerEnv({ TF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, TF_ACCESS_AUD: AUD });
    const gated = await workerFetch('https://curious.thoughtseed.space', questRead, complete);
    assert.equal(gated.status, 401);
    assert.equal(responseError(gated.status, gated.text), 'access_identity_required');

    const proposal = await workerFetch('https://curious.thoughtseed.space',
      PLEXUS_ROUTES.find((probe) => probe.path === '/v1/founder/proposal')!, complete);
    assert.equal(proposal.status, 401, proposal.text);
  });
});
