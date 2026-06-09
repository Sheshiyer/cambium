// Cambium operator · Vectorize cortex store (M2 / B3, issue #17) — hermetic (injected fetch, no network).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vectorizeCortex } from './vectorize-cortex.ts';

function fakeCloudflare(captured: { url: string; init: any }[]) {
  return async (u: any, init: any) => {
    const url = String(u);
    captured.push({ url, init });
    if (url.endsWith('/indexes/cambium-cortex')) return { ok: true, json: async () => ({ result: { name: 'cambium-cortex', dimensions: 1024 } }) } as any;
    if (url.endsWith('/upsert')) return { ok: true, json: async () => ({ result: { mutationId: 'm' } }) } as any;
    if (url.endsWith('/query')) return {
      ok: true,
      json: async () => ({ result: { matches: [
        { id: 't:v1:m1', score: 0.97, metadata: { kind: 'decision', tenant: 't', ts: 1, payload: JSON.stringify({ eventKind: 'redirect', action: 'meso · reroll' }) } },
      ] } }),
    } as any;
    if (url.endsWith('/info')) return { ok: true, json: async () => ({ result: { vectorCount: 42 } }) } as any;
    return { ok: false, status: 404, text: async () => 'not found' } as any;
  };
}

test('vectorize · init verifies the index; ready() gates fail-closed', async () => {
  const cap: { url: string; init: any }[] = [];
  const store = vectorizeCortex({ accountId: 'acc', apiToken: 'tok', fetchImpl: fakeCloudflare(cap) });
  assert.equal(store.ready(), false);
  await store.init();
  assert.equal(store.ready(), true);
  assert.ok(cap[0].url.endsWith('/indexes/cambium-cortex'));
  assert.match(cap[0].init.headers.Authorization, /Bearer tok/);
});

test('vectorize · fail-closed without account/token', async () => {
  const store = vectorizeCortex({ accountId: '', apiToken: '', fetchImpl: (async () => ({ ok: true, json: async () => ({}) })) as any });
  await assert.rejects(() => store.init(), /missing/);
  assert.equal(store.ready(), false);
});

test('vectorize · upsert posts NDJSON with the vector + stringified payload metadata', async () => {
  const cap: { url: string; init: any }[] = [];
  const store = vectorizeCortex({ accountId: 'acc', apiToken: 'tok', fetchImpl: fakeCloudflare(cap) });
  await store.init();
  await store.upsert({ id: 't:v1:m1', kind: 'decision', tenant: 't', vector: [0.1, 0.2, 0.3], payload: { eventKind: 'redirect', action: 'meso · reroll' }, ts: 1 });
  const c = cap.find((x) => x.url.endsWith('/upsert'))!;
  assert.match(c.init.headers['Content-Type'], /ndjson/);
  const body = JSON.parse(c.init.body);
  assert.deepEqual(body.values, [0.1, 0.2, 0.3]);
  assert.equal(body.metadata.tenant, 't');
  assert.match(body.metadata.payload, /reroll/);
});

test('vectorize · search maps matches → ScoredRecord with the tenant/kind filter', async () => {
  const cap: { url: string; init: any }[] = [];
  const store = vectorizeCortex({ accountId: 'acc', apiToken: 'tok', fetchImpl: fakeCloudflare(cap) });
  await store.init();
  const hits = await store.search([0.1, 0.2, 0.3], 5, { tenant: 't', kind: 'decision' });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].record.id, 't:v1:m1');
  assert.equal(hits[0].score, 0.97);
  assert.equal(hits[0].record.payload.action, 'meso · reroll');
  const q = cap.find((x) => x.url.endsWith('/query'))!;
  const body = JSON.parse(q.init.body);
  assert.equal(body.topK, 5);
  assert.deepEqual(body.filter.tenant, { $eq: 't' });
  assert.deepEqual(body.filter.kind, { $eq: 'decision' });
});

test('vectorize · count reads the index vectorCount', async () => {
  const store = vectorizeCortex({ accountId: 'acc', apiToken: 'tok', fetchImpl: fakeCloudflare([]) });
  await store.init();
  assert.equal(await store.count(), 42);
});
