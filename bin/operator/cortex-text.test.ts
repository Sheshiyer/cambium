import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createCortexTextHttpStore,
  recallCortexText,
  type CortexTextRequest,
  type CortexTextScope,
} from './cortex-text.ts';

const scope: CortexTextScope = {
  tenantId: 'tenant-synthetic',
  projectId: 'project-synthetic',
  sourcePlane: 'plane-synthetic',
  audience: 'workspace',
};
const endpoint = 'https://recall.synthetic.test';
const token = 'synthetic-token-0001';
const HASH = 'ab'.repeat(32);
const query = { query: 'synthetic question' };

type Call = { url: string; init: RequestInit };

function recorder(respond: () => Response) {
  const calls: Call[] = [];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return respond();
  }) as unknown as typeof globalThis.fetch;
  return { calls, fetch };
}

function envelope(overrides: Record<string, unknown> = {}): Response {
  const payload = {
    schema: 'cortex.text-recall.v1',
    availability: 'available',
    scope,
    authorityTier: 'projection',
    effectsAuthorized: false,
    retrievedAt: '2025-01-01T00:00:00.000Z',
    items: [
      { id: 'doc-1', text: 'alpha', citations: [{ uri: 'vault://synthetic/alpha#L1', sha256: HASH }], rank: 7 },
      { id: 'doc-2', text: 'beta', citations: [{ uri: 'vault://synthetic/beta', sha256: HASH }], rank: 3 },
    ],
    ...overrides,
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function storeWith(respond: () => Response) {
  const net = recorder(respond);
  const store = createCortexTextHttpStore({ endpoint, token, scope, fetch: net.fetch });
  return { net, store };
}

test('member audience requires memberId', () => {
  assert.throws(() => createCortexTextHttpStore({ endpoint, token, scope: { ...scope, audience: 'member' } }));
  assert.throws(() => createCortexTextHttpStore({ endpoint, token, scope: { ...scope, memberId: 'member-1' } }));
  createCortexTextHttpStore({ endpoint, token, scope: { ...scope, audience: 'member', memberId: 'member-1' } });
});

test('scope mismatch and member injection are denied with zero network', async () => {
  const { net, store } = storeWith(() => envelope());
  const tenant = await store.recall({ ...scope, tenantId: 'other-tenant', ...query });
  const escalation = await store.recall({ ...scope, audience: 'founder', ...query });
  const injected = await store.recall({ ...scope, audience: 'member', memberId: 'member-1', ...query });
  assert.equal(tenant.availability, 'denied');
  assert.equal(escalation.availability, 'denied');
  assert.equal(injected.availability, 'denied');
  assert.equal(net.calls.length, 0);
});

test('closed request keys are enforced before network', async () => {
  const { net, store } = storeWith(() => envelope());
  const request = { ...scope, ...query, extra: 'x' };
  const result = await store.recall(request as CortexTextRequest);
  assert.equal(result.availability, 'denied');
  assert.equal(net.calls.length, 0);
});

test('bearer header is sent, redirects refused, token never echoed', async () => {
  const { net, store } = storeWith(() => envelope());
  const result = await store.recall({ ...scope, ...query });
  const call = net.calls[0];
  const headers = call.init.headers as Record<string, string>;
  assert.equal(call.url, `${endpoint}/v1/recall`);
  assert.equal(headers.authorization, `Bearer ${token}`);
  assert.equal(call.init.redirect, 'error');
  assert.equal(result.availability, 'available');
  assert.ok(!JSON.stringify(result).includes(token));
});

test('redirect refusal or network failure is unavailable', async () => {
  const fetch = (async () => {
    throw new TypeError('redirect mode is set to error');
  }) as unknown as typeof globalThis.fetch;
  const store = createCortexTextHttpStore({ endpoint, token, scope, fetch });
  const result = await store.recall({ ...scope, ...query });
  assert.equal(result.availability, 'unavailable');
  assert.equal(result.items.length, 0);
});

test('hostile response cannot return the configured bearer in text, ids or citations', async () => {
  for (const field of ['text', 'id', 'uri']) {
    const item = { id: 'synthetic-card', text: 'safe text', citations: [{ uri: 'vault://synthetic/safe', sha256: HASH }], rank: 1 };
    if (field === 'uri') item.citations[0].uri = `vault://synthetic/${token}`;
    else item[field as 'text' | 'id'] = token;
    const { store } = storeWith(() => envelope({ items: [item] }));
    const result = await store.recall({ ...scope, ...query });
    assert.equal(result.availability, 'unavailable');
    assert.ok(!JSON.stringify(result).includes(token));
  }
  const { store, net } = storeWith(() => envelope());
  assert.equal((await store.recall({ ...scope, query: token })).availability, 'denied');
  assert.equal(net.calls.length, 0);
});

test('unavailable, empty, and malformed states are distinct', async () => {
  const empty = storeWith(() => envelope({ availability: 'empty', items: [] })).store;
  const down = storeWith(() => new Response('upstream secret detail', { status: 503 })).store;
  const garbled = storeWith(() => new Response('not json', { status: 200 })).store;
  const e = await empty.recall({ ...scope, ...query });
  const u = await down.recall({ ...scope, ...query });
  const m = await garbled.recall({ ...scope, ...query });
  assert.equal(e.availability, 'empty');
  assert.equal(u.availability, 'unavailable');
  assert.equal(m.availability, 'unavailable');
  assert.equal(u.items.length, 0);
  assert.ok(!JSON.stringify(u).includes('upstream secret'));
});

test('altered response scope or authority is denied', async () => {
  const cases: Array<() => Response> = [
    () => envelope({ scope: { ...scope, tenantId: 'other-tenant' } }),
    () => envelope({ authorityTier: 'authoritative' }),
    () => envelope({ effectsAuthorized: true }),
  ];
  for (const respond of cases) {
    const { store } = storeWith(respond);
    const result = await store.recall({ ...scope, ...query });
    assert.equal(result.availability, 'denied');
    assert.equal(result.items.length, 0);
  }
});

test('invalid citations are never returned as available', async () => {
  const bad = () =>
    envelope({
      items: [{ id: 'x', text: 't', citations: [{ uri: 'corpus/x', sha256: 'NOT-HEX' }], rank: 1 }],
    });
  const { store } = storeWith(bad);
  const result = await store.recall({ ...scope, ...query });
  assert.notEqual(result.availability, 'available');
  assert.equal(result.items.length, 0);
});

test('provider rank and order are preserved', async () => {
  const { store } = storeWith(() => envelope());
  const result = await store.recall({ ...scope, ...query });
  assert.deepEqual(
    result.items.map((item) => item.id),
    ['doc-1', 'doc-2'],
  );
  assert.deepEqual(
    result.items.map((item) => item.rank),
    [7, 3],
  );
});

test('items are capped at eight', async () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ id: `doc-${i}`, text: 't', citations: [{ uri: 'vault://synthetic/item', sha256: HASH }], rank: i + 1 }));
  const { store } = storeWith(() => envelope({ items }));
  const result = await store.recall({ ...scope, ...query, limit: 8 });
  assert.equal(result.items.length, 8);
});

test('direct store uses the same two-card 1200-character defaults as orchestration', async () => {
  const {store,net}=storeWith(()=>envelope());
  await store.recall({...scope,...query});
  const body=JSON.parse(String(net.calls[0].init.body));
  assert.equal(body.limit,2);assert.equal(body.maxCharacters,1200);
});

test('streamed response over 128KiB is rejected as unavailable', async () => {
  const chunk = new TextEncoder().encode('x'.repeat(64 * 1024));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(chunk);
      controller.enqueue(chunk);
      controller.enqueue(chunk);
      controller.close();
    },
  });
  const { store } = storeWith(() => new Response(stream, { status: 200 }));
  const result = await store.recall({ ...scope, ...query });
  assert.equal(result.availability, 'unavailable');
  assert.equal(result.items.length, 0);
});

test('recallCortexText refuses tenant mismatch without network', async () => {
  const { net, store } = storeWith(() => envelope());
  const result = await recallCortexText(store, scope, 'other-tenant', 'q');
  assert.equal(result.availability, 'denied');
  assert.equal(net.calls.length, 0);
});

test('recallCortexText uses bounded defaults', async () => {
  const { net, store } = storeWith(() => envelope());
  const result = await recallCortexText(store, scope, scope.tenantId, 'q');
  const sent = JSON.parse(String(net.calls[0].init.body));
  assert.equal(sent.limit, 2);
  assert.equal(sent.maxCharacters, 1200);
  assert.equal(result.availability, 'available');
  assert.ok(result.items.length <= 2);
});

test('empty citations and fractional ranks cannot establish source-backed context', async () => {
  for (const item of [
    { id: 'fake', text: 'synthetic', citations: [], rank: 1 },
    { id: 'fake', text: 'synthetic', citations: [{ uri: 'vault://synthetic/x', sha256: HASH }], rank: 0.5 },
  ]) {
    const { store } = storeWith(() => envelope({ items: [item] }));
    assert.equal((await store.recall({ ...scope, ...query })).availability, 'unavailable');
  }
});

test('helper rejects authority escalation even from an injected text store', async () => {
  const original = await (await envelope().json());
  const injected = { recall: async () => ({ ...original, authorityTier: 'truth', effectsAuthorized: true }) };
  const result = await recallCortexText(injected, scope, scope.tenantId, 'synthetic');
  assert.equal(result.availability, 'denied');
  assert.equal(result.items.length, 0);
});

test('growth recall probe: a cited labs-context card stays advisory with uri and sha256 citations', async () => {
  const growthScope: CortexTextScope = {
    tenantId: 'cambium',
    projectId: 'sapling:cambium',
    sourcePlane: 'labs-context',
    audience: 'workspace',
  };
  const card = {
    id: 'growth-card-week1-spine',
    text: 'Week-1 spine: identity in front of Curious walk.',
    citations: [{ uri: 'vault://thoughtseed-labs/20-operations/growth/department/02-copywriter/spines/week-1.md#L1', sha256: HASH }],
    rank: 1,
  };
  const requests: CortexTextRequest[] = [];
  const fixture = {
    async recall(request: CortexTextRequest) {
      requests.push(request);
      return {
        schema: 'cortex.text-recall.v1' as const,
        availability: 'available' as const,
        scope: growthScope,
        authorityTier: 'projection' as const,
        effectsAuthorized: false as const,
        retrievedAt: '2026-10-27T00:00:00.000Z',
        items: [card],
      };
    },
  };
  const result = await recallCortexText(fixture, growthScope, 'cambium', 'week-1 spine');
  assert.equal(requests.length, 1);
  assert.deepEqual(
    { tenantId: requests[0].tenantId, projectId: requests[0].projectId, sourcePlane: requests[0].sourcePlane },
    { tenantId: 'cambium', projectId: 'sapling:cambium', sourcePlane: 'labs-context' },
  );
  assert.equal(result.schema, 'cortex.text-recall.v1');
  assert.equal(result.availability, 'available');
  assert.equal(result.authorityTier, 'projection');
  assert.equal(result.effectsAuthorized, false);
  assert.deepEqual(result.scope, growthScope);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, card.id);
  for (const citation of result.items[0].citations) {
    assert.match(citation.uri, /^vault:\/\//);
    assert.match(citation.sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(Object.keys(citation).sort(), ['sha256', 'uri']);
  }
});
