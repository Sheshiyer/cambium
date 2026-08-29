import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, type KvLike } from './handler.ts';

function fakeKv(initial: Record<string, string> = {}): KvLike {
  const store = new Map(Object.entries(initial));
  return {
    async get(key) { return store.get(key) ?? null; },
    async put(key, value) { store.set(key, value); },
    async list(prefix) { return [...store.keys()].filter((key) => key.startsWith(prefix)); },
  };
}

function request(method: string, path: string, authorization?: string) {
  return { method, path, headers: authorization ? { authorization } : {} };
}

const hostileEnvelope = JSON.stringify({
  schema: 1,
  tenant: 'cambium',
  derivedAt: '2026-08-11T10:00:00.000Z',
  source: 'Bearer source-secret',
  ledger: {
    completed: 6,
    total: 7,
    current: { arc: 'VII', title: 'Private founder quest', token: 'raw-secret' },
    rows: [{ title: 'Hidden quest title', evidence: 'query_id=private' }],
  },
  actionRequests: { rows: [{ id: 'private-action-request' }] },
  telegram: { chatId: '-1002691202808', initData: 'private-init-data' },
});

test('Hermes quest summary fails closed without configured BRIDGE_TOKEN', async () => {
  const response = await handle(
    request('GET', '/v1/bridge/quests/cambium/summary'),
    { kv: fakeKv({ 'ledger:cambium': hostileEnvelope }) },
  );
  assert.equal(response.status, 503);
});

test('Hermes quest summary rejects missing and incorrect bearer tokens', async () => {
  const deps = { kv: fakeKv({ 'ledger:cambium': hostileEnvelope }), bridgeToken: 'bridge-secret' };
  const missing = await handle(request('GET', '/v1/bridge/quests/cambium/summary'), deps);
  const incorrect = await handle(request('GET', '/v1/bridge/quests/cambium/summary', 'Bearer wrong'), deps);
  assert.equal(missing.status, 401);
  assert.equal(incorrect.status, 401);
});

test('Hermes quest summary is GET-only and requires an exact valid tenant route', async () => {
  const deps = { kv: fakeKv(), bridgeToken: 'bridge-secret' };
  const post = await handle(request('POST', '/v1/bridge/quests/cambium/summary', 'Bearer bridge-secret'), deps);
  const malformed = await handle(request('GET', '/v1/bridge/quests/Cambium/summary', 'Bearer bridge-secret'), deps);
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET');
  assert.equal(malformed.status, 400);
});

test('Hermes quest summary returns only bounded digest fields and redacts source details', async () => {
  const response = await handle(
    request('GET', '/v1/bridge/quests/cambium/summary', 'Bearer bridge-secret'),
    {
      kv: fakeKv({ 'ledger:cambium': hostileEnvelope }),
      bridgeToken: 'bridge-secret',
      now: () => '2026-08-11T12:00:00.000Z',
    },
  );
  assert.equal(response.status, 200);
  const payload = JSON.parse(String(response.body));
  assert.deepEqual(Object.keys(payload), ['schema', 'tenant', 'freshness', 'counts', 'status']);
  assert.deepEqual(payload, {
    schema: 'cambium.hermes.quest-summary.v1',
    tenant: 'cambium',
    freshness: {
      state: 'fresh',
      derivedAt: '2026-08-11T10:00:00.000Z',
      ageSeconds: 7200,
    },
    counts: { completed: 6, total: 7, remaining: 1 },
    status: 'active',
  });
  assert.doesNotMatch(String(response.body), /Bearer|secret|query_id|telegram|action-request|quest title/i);
});

test('Hermes quest summary reports stale completed ledgers without leaking rows', async () => {
  const completed = JSON.stringify({
    schema: 1,
    tenant: 'cambium',
    derivedAt: '2026-08-10T00:00:00.000Z',
    source: 'push',
    ledger: { completed: 99, total: 7, current: null, rows: [{ evidence: 'private' }] },
  });
  const response = await handle(
    request('GET', '/v1/bridge/quests/cambium/summary', 'Bearer bridge-secret'),
    {
      kv: fakeKv({ 'ledger:cambium': completed }),
      bridgeToken: 'bridge-secret',
      now: () => '2026-08-11T12:00:00.000Z',
    },
  );
  assert.equal(response.status, 200);
  const payload = JSON.parse(String(response.body));
  assert.equal(payload.freshness.state, 'stale');
  assert.deepEqual(payload.counts, { completed: 7, total: 7, remaining: 0 });
  assert.equal(payload.status, 'complete');
});

test('BRIDGE_TOKEN does not authorize the existing human quest route', async () => {
  const response = await handle(
    request('GET', '/api/quests/cambium', 'Bearer bridge-secret'),
    {
      kv: fakeKv({ 'ledger:cambium': hostileEnvelope }),
      bridgeToken: 'bridge-secret',
      plexus: { teamDomain: 'thoughtseed', aud: 'access-audience' },
    },
  );
  assert.equal(response.status, 401);
  assert.match(String(response.body), /access_identity_required/);
});

test('Hermes quest summary returns no ledger existence details before authorization', async () => {
  const unauthorized = await handle(
    request('GET', '/v1/bridge/quests/cambium/summary', 'Bearer wrong'),
    { kv: fakeKv(), bridgeToken: 'bridge-secret' },
  );
  const authorized = await handle(
    request('GET', '/v1/bridge/quests/cambium/summary', 'Bearer bridge-secret'),
    { kv: fakeKv(), bridgeToken: 'bridge-secret' },
  );
  assert.equal(unauthorized.status, 401);
  assert.equal(authorized.status, 404);
  assert.doesNotMatch(String(unauthorized.body), /ledger|unavailable/);
});
