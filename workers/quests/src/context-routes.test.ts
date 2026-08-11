import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleContextRoute } from './context-routes.ts';
import {
  CONTEXT_PROJECTION_KEY,
  CONTEXT_PROJECTION_RECEIPT_SCHEMA,
  CONTEXT_PROJECTION_SCHEMA,
} from './context-projections.ts';
import { CORTEX_INGESTION_SCHEMA } from './cortex-ingestion.ts';

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
  assert.equal(payload.capabilities.cortexIngestion, false);
});

const cortexBody = {
  schema: CORTEX_INGESTION_SCHEMA,
  tenant: 'cambium',
  kind: 'memory',
  source: 'hermes',
  path: 'handoffs/cambium.md',
  content: '## Cambium\nThis content is intentionally long enough to produce one deterministic Cortex vector.',
  idempotencyKey: 'cambium_handoff_1',
};

const cortexDeps = () => ({
  embed: async () => [0.1, 0.2, 0.3],
  vectorIndex: {
    query: async () => ({ matches: [] }),
    upsert: async (vectors: Array<{ id: string }>) => ({ ids: vectors.map((vector) => vector.id) }),
  },
});

test('cortex ingestion requires its dedicated configured token', async () => {
  const missing = await handleContextRoute(req('POST', '/v1/context/cortex-ingest', cortexBody), {});
  assert.equal(missing.status, 503);

  const unauthorized = await handleContextRoute(req('POST', '/v1/context/cortex-ingest', cortexBody, 'context-token'), {
    cortexIngestionToken: 'cortex-token',
    cortexIngestionDeps: cortexDeps(),
  });
  assert.equal(unauthorized.status, 401);
});

test('cortex ingestion fails closed when provider dependencies are absent', async () => {
  const response = await handleContextRoute(req('POST', '/v1/context/cortex-ingest', cortexBody, 'cortex-token'), {
    cortexIngestionToken: 'cortex-token',
  });
  assert.equal(response.status, 503);
});

test('cortex ingestion rejects malformed JSON and invalid inputs', async () => {
  const malformed = await handleContextRoute({
    method: 'POST',
    path: '/v1/context/cortex-ingest',
    headers: { authorization: 'Bearer cortex-token' },
    body: '{',
  }, {
    cortexIngestionToken: 'cortex-token',
    cortexIngestionDeps: cortexDeps(),
  });
  assert.equal(malformed.status, 400);

  const invalid = await handleContextRoute(req('POST', '/v1/context/cortex-ingest', { ...cortexBody, tenant: '' }, 'cortex-token'), {
    cortexIngestionToken: 'cortex-token',
    cortexIngestionDeps: cortexDeps(),
  });
  assert.equal(invalid.status, 400);
});

test('cortex ingestion returns only its bounded receipt', async () => {
  const response = await handleContextRoute(req('POST', '/v1/context/cortex-ingest', cortexBody, 'cortex-token'), {
    cortexIngestionToken: 'cortex-token',
    cortexIngestionDeps: cortexDeps(),
  });
  assert.equal(response.status, 201);
  const payload = JSON.parse(response.body);
  assert.equal(payload.tenant, 'cambium');
  assert.equal(payload.status, 'ingested');
  assert.ok(Array.isArray(payload.vectorIds));
  assert.equal('content' in payload, false);
});

test('cortex ingestion maps provider failures to 502', async () => {
  const response = await handleContextRoute(req('POST', '/v1/context/cortex-ingest', cortexBody, 'cortex-token'), {
    cortexIngestionToken: 'cortex-token',
    cortexIngestionDeps: {
      ...cortexDeps(),
      embed: async () => { throw new Error('provider unavailable'); },
    },
  });
  assert.equal(response.status, 502);
});

test('context health reports configured Cortex ingestion capability', async () => {
  const response = await handleContextRoute(req('GET', '/v1/context/health', undefined, 'context-token'), {
    token: 'context-token',
    cortexIngestionToken: 'cortex-token',
    cortexIngestionDeps: cortexDeps(),
  });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).capabilities.cortexIngestion, true);
});

test('projection writes are retired before any store call', async () => {
  let called = false;
  const projectionStore = {
    put: async () => {
      called = true;
      throw new Error('must not be called');
    },
  };
  const body = {
    schema: CONTEXT_PROJECTION_SCHEMA,
    key: CONTEXT_PROJECTION_KEY,
    tenantId: 'cambium',
    routine: 'daily-standup-digest',
    generation: 1,
    producedAt: '2026-07-28T08:00:00.000Z',
    expiresAt: '2026-07-28T20:00:00.000Z',
    sourceRevision: 'git:abc123',
    contentDigest: 'sha256:7d696bb44566df0ffec55bce3a17117aa397f923f92e26b91c0695f9fc9fd8e4',
    markdown: '# Daily Standup\nBounded evidence',
  };

  const missingConfig = await handleContextRoute(req('POST', '/v1/context/projections', body), {
    token: 'context-token',
    projectionStore,
  });
  assert.equal(missingConfig.status, 410);
  assert.equal(missingConfig.headers['cache-control'], 'no-store');
  assert.equal(called, false);

  const readToken = await handleContextRoute(req('POST', '/v1/context/projections', body, 'context-token'), {
    token: 'context-token',
    projectionWriteToken: 'projection-token',
    projectionStore,
  });
  assert.equal(readToken.status, 410);
  assert.equal(readToken.headers['cache-control'], 'no-store');
  assert.equal(called, false);
});

test('retired projection write never calls the legacy store', async () => {
  let stored: unknown;
  const body = {
    schema: CONTEXT_PROJECTION_SCHEMA,
    key: CONTEXT_PROJECTION_KEY,
    tenantId: 'cambium',
    routine: 'daily-standup-digest',
    generation: 2,
    producedAt: '2026-07-28T08:00:00.000Z',
    expiresAt: '2026-07-28T20:00:00.000Z',
    sourceRevision: 'git:def456',
    contentDigest: 'sha256:7d696bb44566df0ffec55bce3a17117aa397f923f92e26b91c0695f9fc9fd8e4',
    markdown: '# Daily Standup\nBounded evidence',
  };
  const r = await handleContextRoute(req('POST', '/v1/context/projections', body, 'projection-token'), {
    projectionWriteToken: 'projection-token',
    projectionStore: {
      put: async (value) => {
        stored = value;
        return {
          schema: CONTEXT_PROJECTION_RECEIPT_SCHEMA,
          key: CONTEXT_PROJECTION_KEY,
          generation: 2,
          contentDigest: body.contentDigest,
          producedAt: body.producedAt,
          expiresAt: body.expiresAt,
        };
      },
    },
  });

  assert.equal(r.status, 410);
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.equal(stored, undefined);
  assert.match(r.body, /retired/i);
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

test('routine snapshot returns only bounded key counts and freshness fields', async () => {
  const r = await handleContextRoute(req('GET', '/v1/context/routine-snapshot?tenant=cambium&routine=weekly-client-report', undefined, 'context-token'), {
    token: 'context-token',
    ...allowCambium,
    now: () => '2026-07-15T00:00:00.000Z',
    routineContext: {
      getSnapshot: async () => ({
        sections: [{
          id: 'client-report-sources',
          title: 'Client report sources',
          signalState: 'mixed',
          exactKeyCount: 3,
          resolvedKeyCount: 2,
          staleKeyCount: 1,
          missingKeyCount: 1,
          staleAfterSeconds: 86400,
          rawObjects: ['must not leak'],
          items: [{
            title: 'Client A',
            summary: 'Bounded summary.',
            sourceKey: 'reports/client-a/weekly.md',
            signalState: 'current',
            observedAt: '2026-07-14T18:00:00.000Z',
            ageSeconds: 21600,
            rawMarkdown: 'must not leak',
          }],
        }],
      }),
    },
  });

  assert.equal(r.status, 200);
  const payload = JSON.parse(r.body);
  assert.deepEqual(payload.sections[0], {
    id: 'client-report-sources',
    title: 'Client report sources',
    items: [{
      title: 'Client A',
      summary: 'Bounded summary.',
      sourceKey: 'reports/client-a/weekly.md',
      signalState: 'current',
      observedAt: '2026-07-14T18:00:00.000Z',
      ageSeconds: 21600,
    }],
    signalState: 'mixed',
    exactKeyCount: 3,
    resolvedKeyCount: 2,
    staleKeyCount: 1,
    missingKeyCount: 1,
    staleAfterSeconds: 86400,
  });
  assert.equal(payload.omitted.rawObjects, true);
  assert.doesNotMatch(r.body, /must not leak|rawMarkdown/);
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
