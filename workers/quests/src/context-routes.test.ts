import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleContextRoute } from './context-routes.ts';

const req = (method: string, path: string, body?: unknown, token?: string) => ({
  method,
  path,
  headers: token ? { authorization: `Bearer ${token}` } : {},
  body: body === undefined ? undefined : JSON.stringify(body),
});

const allowCambium = { allowedTenants: ['cambium'] };

test('context health requires the configured context token', async () => {
  const r = await handleContextRoute(req('GET', '/v1/context/health'), {
    token: 'context-token',
    now: () => '2026-06-25T12:00:00.000Z',
  });
  assert.equal(r.status, 401);
});

test('context health returns bounded capability flags', async () => {
  const r = await handleContextRoute(req('GET', '/v1/context/health', undefined, 'context-token'), {
    token: 'context-token',
    now: () => '2026-06-25T12:00:00.000Z',
    routineContext: { getSnapshot: async () => ({ sections: [] }) },
    semanticRecall: { recall: async () => [] },
  });
  assert.equal(r.status, 200);
  const payload = JSON.parse(r.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.schema, 'thoughtseed.context-health.v1');
  assert.equal(payload.capabilities.routineSnapshot, true);
  assert.equal(payload.capabilities.semanticRecall, true);
});

test('semantic recall rejects missing tenant and query', async () => {
  const r = await handleContextRoute(req('POST', '/v1/context/semantic-recall', {}, 'context-token'), {
    token: 'context-token',
    now: () => '2026-06-25T12:00:00.000Z',
    semanticRecall: { recall: async () => [] },
  });
  assert.equal(r.status, 400);
  assert.match(r.body, /tenant/);
});

test('semantic recall rejects a valid tenant with missing query', async () => {
  const r = await handleContextRoute(req('POST', '/v1/context/semantic-recall', {
    tenant: 'cambium',
    query: '   ',
  }, 'context-token'), {
    token: 'context-token',
    now: () => '2026-06-25T12:00:00.000Z',
    semanticRecall: { recall: async () => [] },
  });
  assert.equal(r.status, 400);
  assert.match(r.body, /query/);
});

test('semantic recall returns bounded hits without vectors or raw payload', async () => {
  const r = await handleContextRoute(req('POST', '/v1/context/semantic-recall', {
    tenant: 'cambium',
    query: 'standup blockers',
    kind: 'decision',
    topK: 3,
  }, 'context-token'), {
    token: 'context-token',
    ...allowCambium,
    now: () => '2026-06-25T12:00:00.000Z',
    semanticRecall: {
      recall: async () => [{
        id: 'cambium:v1:memory-1',
        kind: 'decision',
        score: 0.91,
        ts: 1710000000,
        payload: {
          summary: 'Bounded operator summary.',
          raw: 'Bearer forbidden-secret',
          vector: [0.1, 0.2],
        },
      }],
    },
  });
  assert.equal(r.status, 200);
  assert.match(r.body, /semantic-provider/);
  assert.match(r.body, /Bounded operator summary/);
  assert.doesNotMatch(r.body, /cambium-cortex|cloudflare|r2|vault|forbidden-secret|0.1|0.2|witness-wisdom-corpus/i);
});

test('semantic recall caps returned hits to requested topK', async () => {
  const r = await handleContextRoute(req('POST', '/v1/context/semantic-recall', {
    tenant: 'cambium',
    query: 'standup blockers',
    topK: 3,
  }, 'context-token'), {
    token: 'context-token',
    ...allowCambium,
    now: () => '2026-06-25T12:00:00.000Z',
    semanticRecall: {
      recall: async () => Array.from({ length: 6 }, (_, index) => ({
        id: `cambium:v1:memory-${index}`,
        kind: 'decision',
        score: 1 - index / 10,
        payload: index === 0
          ? { detail: 'Bearer recall-secret' }
          : { summary: `Bounded summary ${index}` },
      })),
    },
  });
  assert.equal(r.status, 200);
  const payload = JSON.parse(r.body);
  assert.equal(payload.hits.length, 3);
  assert.deepEqual(payload.hits.map((hit: { id: string }) => hit.id), [
    'cambium:v1:memory-0',
    'cambium:v1:memory-1',
    'cambium:v1:memory-2',
  ]);
  assert.doesNotMatch(r.body, /recall-secret|memory-3|memory-4|memory-5/);
});

test('semantic recall emits provider identity only from supplied metadata', async () => {
  const r = await handleContextRoute(req('POST', '/v1/context/semantic-recall', {
    tenant: 'cambium',
    query: 'standup blockers',
    kind: 'decision',
  }, 'context-token'), {
    token: 'context-token',
    ...allowCambium,
    now: () => '2026-06-25T12:00:00.000Z',
    semanticRecall: {
      recall: async () => ({
        metadata: { index: 'cambium-cortex', source: 'cloudflare-vectorize' },
        hits: [{
          id: 'cambium:v1:memory-1',
          kind: 'decision',
          score: 0.91,
          payload: { summary: 'Bounded operator summary.' },
        }],
      }),
    },
  });
  assert.equal(r.status, 200);
  assert.match(r.body, /cambium-cortex/);
  assert.match(r.body, /cloudflare-vectorize/);
});

test('semantic recall rejects tenants without an explicit policy before provider calls', async () => {
  let called = false;
  const r = await handleContextRoute(req('POST', '/v1/context/semantic-recall', {
    tenant: 'cambium',
    query: 'standup blockers',
    kind: 'decision',
  }, 'context-token'), {
    token: 'context-token',
    now: () => '2026-06-25T12:00:00.000Z',
    semanticRecall: { recall: async () => { called = true; return []; } },
  });
  assert.equal(r.status, 403);
  assert.equal(called, false);
  assert.match(r.body, /tenant/);
});

test('semantic recall rejects unauthorized tenants before provider calls', async () => {
  let called = false;
  const r = await handleContextRoute(req('POST', '/v1/context/semantic-recall', {
    tenant: 'cambium',
    query: 'standup blockers',
    kind: 'decision',
  }, 'context-token'), {
    token: 'context-token',
    allowedTenants: ['other-tenant'],
    now: () => '2026-06-25T12:00:00.000Z',
    semanticRecall: { recall: async () => { called = true; return []; } },
  });
  assert.equal(r.status, 403);
  assert.equal(called, false);
  assert.match(r.body, /tenant/);
});

test('semantic recall rejects oversized or unknown inputs before provider calls', async () => {
  const cases = [
    { body: { tenant: 'cambium', query: 'ok', padding: 'x'.repeat(5000) }, error: /body/ },
    { body: { tenant: 'cambium', query: 'x'.repeat(501) }, error: /query/ },
    { body: { tenant: 'cambium', query: 'ok', kind: 12 }, error: /kind/ },
    { body: { tenant: 'cambium', query: 'ok', kind: 'unknown-kind' }, error: /kind/ },
    { body: { tenant: 'cambium', query: 'ok', kind: 'x'.repeat(41) }, error: /kind/ },
  ];

  for (const entry of cases) {
    let called = false;
    const r = await handleContextRoute(req('POST', '/v1/context/semantic-recall', entry.body, 'context-token'), {
      token: 'context-token',
      now: () => '2026-06-25T12:00:00.000Z',
      semanticRecall: { recall: async () => { called = true; return []; } },
    });
    assert.equal(r.status, 400);
    assert.equal(called, false);
    assert.match(r.body, entry.error);
  }
});

test('routine snapshot returns allowlisted sections only', async () => {
  const r = await handleContextRoute(req('GET', '/v1/context/routine-snapshot?tenant=cambium&routine=daily-standup-digest', undefined, 'context-token'), {
    token: 'context-token',
    ...allowCambium,
    now: () => '2026-06-25T12:00:00.000Z',
    routineContext: {
      getSnapshot: async () => ({
        sections: [{
          id: 'heartbeats',
          title: 'Recent heartbeats',
          items: [{ title: 'Engineer', summary: 'No blocker.', sourceKey: '20-operations/heartbeats/engineer/latest.md' }],
        }],
      }),
    },
  });
  assert.equal(r.status, 200);
  assert.match(r.body, /thoughtseed.routine-context.v1/);
  assert.match(r.body, /Recent heartbeats/);
  assert.match(r.body, /routine-context-provider/);
  assert.match(r.body, /"rawObjects":true/);
  assert.doesNotMatch(r.body, /cloudflare-r2-d1-kv-vectorize|thoughtseed-vault|Bearer forbidden-secret|full markdown body/i);
});

test('routine snapshot caps sections and items while stripping extra fields', async () => {
  const r = await handleContextRoute(req('GET', '/v1/context/routine-snapshot?tenant=cambium&routine=daily-standup-digest', undefined, 'context-token'), {
    token: 'context-token',
    ...allowCambium,
    now: () => '2026-06-25T12:00:00.000Z',
    routineContext: {
      getSnapshot: async () => ({
        sections: Array.from({ length: 10 }, (_, sectionIndex) => ({
          id: sectionIndex,
          title: `Section ${sectionIndex}`,
          extraSectionField: 'do not leak this section field',
          items: Array.from({ length: 10 }, (_, itemIndex) => ({
            title: itemIndex,
            summary: itemIndex === 0 ? 'Bearer routine-token token=abc123' : `Summary ${itemIndex}`,
            sourceKey: itemIndex,
            rawMarkdown: 'full markdown body',
            arbitrary: { nested: 'payload' },
          })),
        })),
      }),
    },
  });
  assert.equal(r.status, 200);
  const payload = JSON.parse(r.body);
  assert.equal(payload.sections.length, 8);
  assert.equal(payload.sections[0].items.length, 8);
  assert.equal(typeof payload.sections[0].items[0].title, 'string');
  assert.equal(typeof payload.sections[0].items[0].summary, 'string');
  assert.equal(typeof payload.sections[0].items[0].sourceKey, 'string');
  assert.deepEqual(Object.keys(payload.sections[0].items[0]).sort(), ['sourceKey', 'summary', 'title']);
  assert.doesNotMatch(r.body, /do not leak|full markdown body|routine-token|abc123|Section 8|Summary 8/);
});

test('routine snapshot emits Cloudflare source claims only from supplied metadata', async () => {
  const r = await handleContextRoute(req('GET', '/v1/context/routine-snapshot?tenant=cambium&routine=daily-standup-digest', undefined, 'context-token'), {
    token: 'context-token',
    ...allowCambium,
    now: () => '2026-06-25T12:00:00.000Z',
    routineContext: {
      getSnapshot: async () => ({
        metadata: {
          plane: 'cloudflare-r2-d1-kv-vectorize',
          bucket: 'thoughtseed-vault',
          mode: 'allowlisted-slices',
        },
        sections: [],
      }),
    },
  });
  assert.equal(r.status, 200);
  assert.match(r.body, /cloudflare-r2-d1-kv-vectorize/);
  assert.match(r.body, /thoughtseed-vault/);
});

test('routine snapshot rejects tenants without an explicit policy before provider calls', async () => {
  let called = false;
  const r = await handleContextRoute(req('GET', '/v1/context/routine-snapshot?tenant=cambium&routine=daily-standup-digest', undefined, 'context-token'), {
    token: 'context-token',
    now: () => '2026-06-25T12:00:00.000Z',
    routineContext: { getSnapshot: async () => { called = true; return { sections: [] }; } },
  });
  assert.equal(r.status, 403);
  assert.equal(called, false);
  assert.match(r.body, /tenant/);
});

test('routine snapshot rejects unauthorized tenants before provider calls', async () => {
  let called = false;
  const r = await handleContextRoute(req('GET', '/v1/context/routine-snapshot?tenant=cambium&routine=daily-standup-digest', undefined, 'context-token'), {
    token: 'context-token',
    allowedTenants: ['other-tenant'],
    now: () => '2026-06-25T12:00:00.000Z',
    routineContext: { getSnapshot: async () => { called = true; return { sections: [] }; } },
  });
  assert.equal(r.status, 403);
  assert.equal(called, false);
  assert.match(r.body, /tenant/);
});
