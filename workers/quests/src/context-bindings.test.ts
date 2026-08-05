import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.ts';
import {
  DEFAULT_ROUTINE_CONTEXT_SLICES,
  createProviderEmbedder,
  createRoutineContext,
  createSemanticRecall,
  parseRoutineAllowlistJson,
  summarizeMarkdown,
  type R2BucketLike,
  type VectorizeIndexLike,
} from './context-bindings.ts';
import {
  CONTEXT_PROJECTION_KEY,
  CONTEXT_PROJECTION_SCHEMA,
  contentDigestForMarkdown,
} from './context-projections.ts';

const fakeWorkerEnv = (overrides: Record<string, unknown> = {}) => ({
  QUESTS: {
    get: async () => null,
    put: async () => {},
    list: async () => ({ keys: [] }),
  },
  ...overrides,
});

const FIXTURE_PRODUCED_AT = new Date(Date.now() - 2 * 60 * 60 * 1000);
const FIXTURE_EXPIRES_AT = new Date(FIXTURE_PRODUCED_AT.getTime() + 12 * 60 * 60 * 1000);

async function projectionEnvelope(overrides: Record<string, unknown> = {}) {
  const markdown = typeof overrides.markdown === 'string'
    ? overrides.markdown
    : '# Daily Standup\nBounded evidence';
  return {
    schema: CONTEXT_PROJECTION_SCHEMA,
    key: CONTEXT_PROJECTION_KEY,
    tenantId: 'cambium',
    routine: 'daily-standup-digest',
    generation: 1,
    producedAt: FIXTURE_PRODUCED_AT.toISOString(),
    expiresAt: FIXTURE_EXPIRES_AT.toISOString(),
    sourceRevision: 'git:abc123',
    contentDigest: await contentDigestForMarkdown(markdown),
    markdown,
    ...overrides,
  };
}

test('worker adapter serves the mini app shell when root URL carries Telegram query params', async () => {
  const response = await worker.fetch(
    new Request('https://worker.test/?tenant=cambium&scene=map'),
    fakeWorkerEnv() as any,
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  const html = await response.text();
  assert.match(html, /START_SCENE/);
  assert.match(html, /renderBranches/);
});

test('routine adapter validates and summarizes the exact current projection envelope', async () => {
  const calls: string[] = [];
  const stored = await projectionEnvelope({
    markdown: '# Daily Standup\nAlice shipped bounded context. token=super-secret',
    contentDigest: await contentDigestForMarkdown('# Daily Standup\nAlice shipped bounded context. token=super-secret'),
    producedAt: '2026-07-28T08:00:00.000Z',
    expiresAt: '2026-07-28T20:00:00.000Z',
  });
  const routineContext = createRoutineContext({
    bucket: {
      async get(key) {
        calls.push(key);
        return { key, text: async () => JSON.stringify(stored) };
      },
    },
    now: () => new Date('2026-07-28T10:00:00.000Z'),
  });

  const snapshot = await routineContext.getSnapshot({
    tenant: 'cambium',
    routine: 'daily-standup-digest',
  });

  assert.deepEqual(calls, [CONTEXT_PROJECTION_KEY]);
  assert.equal(snapshot.metadata?.bucket, 'thoughtseed-context-projections');
  assert.equal(snapshot.sections.length, 1);
  const section = snapshot.sections[0] as any;
  assert.equal(section.signalState, 'current');
  assert.equal(section.items[0].title, 'Daily Standup');
  assert.match(section.items[0].summary, /Alice shipped bounded context/);
  assert.doesNotMatch(section.items[0].summary, /super-secret|markdown|contentDigest/);
  assert.equal(section.items[0].sourceKey, CONTEXT_PROJECTION_KEY);
  assert.equal(section.items[0].observedAt, '2026-07-28T08:00:00.000Z');
  assert.equal(section.items[0].ageSeconds, 7_200);
});

test('routine adapter marks an expired projection stale without returning markdown', async () => {
  const stored = await projectionEnvelope({
    markdown: '# Daily Standup\nExpired evidence must not surface.',
    contentDigest: await contentDigestForMarkdown('# Daily Standup\nExpired evidence must not surface.'),
    producedAt: '2026-07-28T08:00:00.000Z',
    expiresAt: '2026-07-28T20:00:00.000Z',
  });
  const routineContext = createRoutineContext({
    bucket: {
      get: async (key) => ({ key, text: async () => JSON.stringify(stored) }),
    },
    now: () => new Date('2026-07-28T20:00:00.001Z'),
  });

  const snapshot = await routineContext.getSnapshot({
    tenant: 'cambium',
    routine: 'daily-standup-digest',
  });
  const section = snapshot.sections[0] as any;

  assert.equal(section.signalState, 'stale');
  assert.equal(section.items[0].signalState, 'stale');
  assert.equal(section.items[0].sourceKey, CONTEXT_PROJECTION_KEY);
  assert.doesNotMatch(JSON.stringify(section), /Expired evidence must not surface/);
});

test('routine adapter reports blocked-no-signal when projection binding is missing', async () => {
  const routineContext = createRoutineContext();
  const snapshot = await routineContext.getSnapshot({
    tenant: 'cambium',
    routine: 'daily-standup-digest',
  });

  assert.equal(snapshot.sections.length, 1);
  const section = snapshot.sections[0] as any;
  assert.equal(section.signalState, 'blocked-no-signal');
  assert.equal(section.items[0].signalState, 'blocked-no-signal');
  assert.match(section.items[0].summary, /projection bucket binding is unavailable/i);
});

test('worker routine reads only CONTEXT_PROJECTIONS and never THOUGHTSEED_VAULT', async () => {
  const projectionCalls: string[] = [];
  let vaultCalled = false;
  const stored = await projectionEnvelope();
  const response = await worker.fetch(new Request(
    'https://worker.local/v1/context/routine-snapshot?tenant=cambium&routine=daily-standup-digest',
    { headers: { authorization: 'Bearer context-token' } },
  ), fakeWorkerEnv({
    CONTEXT_ROUTE_TOKEN: 'context-token',
    CONTEXT_ALLOWED_TENANTS: 'cambium',
    CONTEXT_PROJECTIONS: {
      get: async (key: string) => {
        projectionCalls.push(key);
        return { key, text: async () => JSON.stringify(stored) };
      },
    },
    THOUGHTSEED_VAULT: {
      get: async () => {
        vaultCalled = true;
        throw new Error('routine context must not read backup/business storage');
      },
    },
  }) as any);

  assert.equal(response.status, 200);
  assert.deepEqual(projectionCalls, [CONTEXT_PROJECTION_KEY]);
  assert.equal(vaultCalled, false);
  const payload = await response.json() as any;
  assert.equal(payload.sections[0].signalState, 'current');
});

test('worker projection write persists through CONTEXT_PROJECTIONS with its dedicated token', async () => {
  let write: { key: string; value: Uint8Array; options: unknown } | undefined;
  const body = await projectionEnvelope();
  const response = await worker.fetch(new Request('https://worker.local/v1/context/projections', {
    method: 'POST',
    headers: {
      authorization: 'Bearer projection-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  }), fakeWorkerEnv({
    CONTEXT_PROJECTION_WRITE_TOKEN: 'projection-token',
    CONTEXT_PROJECTIONS: {
      get: async () => null,
      put: async (key: string, value: Uint8Array, options: unknown) => {
        write = { key, value, options };
        return { key, text: async () => new TextDecoder().decode(value) };
      },
    },
  }) as any);

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(write?.key, CONTEXT_PROJECTION_KEY);
  assert.equal(new TextDecoder().decode(write?.value), JSON.stringify(body));
  assert.doesNotMatch(await response.text(), /markdown|bucket|metadata|Bounded evidence/i);
});

test('routine adapter reads only explicit safe exact keys and blocks raw non-envelope objects', async () => {
  const calls: string[] = [];
  const objects = new Map([
    ['routines/daily/standups/2026-06-25.md', '# Standup 2026-06-25\n\n- Alice shipped bounded context.\n- token=super-secret'],
  ]);
  const bucket: R2BucketLike = {
    async get(key) {
      calls.push(key);
      const text = objects.get(key);
      return text ? { key, text: async () => text } : null;
    },
  };
  const routineContext = createRoutineContext({
    bucket,
    allowlist: {
      'daily-standup-digest': [{
        id: 'standups',
        title: 'Standups',
        keys: [
          'routines/daily/standups/2026-06-25.md',
          'routines/daily/standups/',
          '../vault/root.md',
        ],
      }],
    },
  });

  const snapshot = await routineContext.getSnapshot({ tenant: 'cambium', routine: 'daily-standup-digest' });

  assert.deepEqual(calls, ['routines/daily/standups/2026-06-25.md']);
  assert.equal(snapshot.sections.length, 1);
  const section = snapshot.sections[0] as any;
  assert.equal(section.items.length, 1);
  assert.equal(section.items[0].signalState, 'blocked-no-signal');
  assert.match(section.items[0].summary, /not a valid context projection envelope/);
  assert.doesNotMatch(section.items[0].summary, /#|super-secret/);
  assert.equal(section.items[0].sourceKey, undefined);
});

test('default slice reads only the frozen key and reports a missing projection', async () => {
  const calls: string[] = [];
  const bucket: R2BucketLike = {
    async get(key) {
      calls.push(key);
      return null;
    },
  };
  const routineContext = createRoutineContext({ bucket, allowlist: DEFAULT_ROUTINE_CONTEXT_SLICES });

  const snapshot = await routineContext.getSnapshot({ tenant: 'cambium', routine: 'daily-standup-digest' });

  assert.deepEqual(calls, [CONTEXT_PROJECTION_KEY]);
  assert.equal(snapshot.sections.length, 1);
  const summaries = JSON.stringify(snapshot.sections);
  assert.match(summaries, /Blocked\/no-signal/);
  assert.match(summaries, /1 of 1 exact allowlisted R2 objects are missing/);
  assert.doesNotMatch(summaries, /sourceKey/);
});

test('unsafe and broad allowlist keys are skipped and do not call R2', async () => {
  let called = false;
  const bucket: R2BucketLike = {
    async get() {
      called = true;
      return null;
    },
  };
  const parsed = parseRoutineAllowlistJson(JSON.stringify({
    'weekly-client-report': [{
      id: 'client-contracts',
      title: 'Client contracts',
      keys: [
        'clients/contracts/',
        'clients/contracts/*',
        '/clients/contracts/acme.md',
        'clients/../contracts/acme.md',
        'clients/contracts/acme draft.md',
      ],
    }],
  }));
  const routineContext = createRoutineContext({ bucket, allowlist: parsed });

  const snapshot = await routineContext.getSnapshot({ tenant: 'cambium', routine: 'weekly-client-report' });

  assert.equal(called, false);
  assert.match(JSON.stringify(snapshot.sections), /Blocked\/no-signal/);
});

test('routine adapter caps sections before any R2 reads', async () => {
  const slices = Array.from({ length: 10 }, (_, index) => ({
    id: `slice-${index}`,
    title: `Slice ${index}`,
    keys: [`reports/slice-${index}.md`],
  }));
  const parsed = parseRoutineAllowlistJson(JSON.stringify({ 'weekly-client-report': slices }));
  assert.equal(parsed?.['weekly-client-report']?.length, 8);

  const calls: string[] = [];
  const routineContext = createRoutineContext({
    bucket: {
      async get(key) {
        calls.push(key);
        return { key, text: async () => '# Bounded\n\nSummary.' };
      },
    },
    allowlist: { 'weekly-client-report': slices },
  });

  const snapshot = await routineContext.getSnapshot({ tenant: 'cambium', routine: 'weekly-client-report' });

  assert.equal(snapshot.sections.length, 8);
  assert.deepEqual(calls, Array.from({ length: 8 }, (_, index) => `reports/slice-${index}.md`));
});

test('routine allowlist preserves accepted 300-character keys and rejects longer keys before R2', async () => {
  const acceptedKey = `${'a'.repeat(297)}.md`;
  const rejectedKey = `${'b'.repeat(298)}.md`;
  assert.equal(acceptedKey.length, 300);
  assert.equal(rejectedKey.length, 301);

  const calls: string[] = [];
  const allowlist = parseRoutineAllowlistJson(JSON.stringify({
    'weekly-client-report': [{
      id: 'client-report-sources',
      title: 'Client report sources',
      keys: [acceptedKey, rejectedKey],
    }],
  }));
  const routineContext = createRoutineContext({
    allowlist,
    bucket: {
      get: async (key: string) => {
        calls.push(key);
        return { key, text: async () => '# Weekly\n\nBounded summary.' };
      },
    },
  });

  const snapshot = await routineContext.getSnapshot({
    tenant: 'cambium',
    routine: 'weekly-client-report',
  });
  assert.deepEqual(calls, [acceptedKey]);
  const section = snapshot.sections[0] as any;
  assert.equal(section.exactKeyCount, 1);
  assert.equal(section.items[0].signalState, 'blocked-no-signal');
  assert.equal(section.items[0].sourceKey, undefined);
});

test('routine adapter reports invalid and missing projection objects without leaking their bodies', async () => {
  const calls: string[] = [];
  const textCalls: string[] = [];
  const objects = new Map<string, { markdown: string; uploaded: Date }>([
    ['reports/client-a/weekly.md', {
      markdown: '# Client A\n\nDelivery is on track. token=do-not-return',
      uploaded: new Date('2026-07-14T18:00:00.000Z'),
    }],
    ['reports/client-b/weekly.md', {
      markdown: '# Client B stale-body-must-not-be-read\n\nAwaiting an approved decision.',
      uploaded: new Date('2026-07-10T00:00:00.000Z'),
    }],
  ]);
  const bucket: R2BucketLike = {
    async get(key) {
      calls.push(key);
      const object = objects.get(key);
      return object ? {
        key,
        uploaded: object.uploaded,
        text: async () => {
          textCalls.push(key);
          return object.markdown;
        },
      } : null;
    },
  };
  const routineContext = createRoutineContext({
    bucket,
    now: () => new Date('2026-07-15T00:00:00.000Z'),
    allowlist: {
      'weekly-client-report': [{
        id: 'client-report-sources',
        title: 'Client report sources',
        maxAgeSeconds: 86_400,
        keys: [
          'reports/client-a/weekly.md',
          'reports/client-b/weekly.md',
          'reports/client-c/weekly.md',
        ],
      }],
    },
  });

  const snapshot = await routineContext.getSnapshot({ tenant: 'cambium', routine: 'weekly-client-report' });

  assert.deepEqual(calls, [
    'reports/client-a/weekly.md',
    'reports/client-b/weekly.md',
    'reports/client-c/weekly.md',
  ]);
  assert.deepEqual(textCalls, ['reports/client-a/weekly.md', 'reports/client-b/weekly.md']);
  const section = snapshot.sections[0] as any;
  assert.equal(section.signalState, 'mixed');
  assert.equal(section.exactKeyCount, 3);
  assert.equal(section.resolvedKeyCount, 0);
  assert.equal(section.staleKeyCount, 0);
  assert.equal(section.missingKeyCount, 1);
  assert.equal(section.staleAfterSeconds, 86_400);
  assert.equal(section.items[0].signalState, 'blocked-no-signal');
  assert.equal(section.items[1].signalState, 'blocked-no-signal');
  assert.equal(section.items[2].signalState, 'missing');
  assert.match(section.items[2].summary, /1 of 3 exact allowlisted R2 objects are missing/);
  assert.doesNotMatch(JSON.stringify(section), /do-not-return|stale-body-must-not-be-read|Awaiting an approved decision|rawBody|fullMarkdown/);
});

test('routine adapter treats malformed raw objects as blocked-no-signal', async () => {
  const routineContext = createRoutineContext({
    bucket: {
      get: async (key) => ({ key, text: async () => '# Weekly\n\nBounded summary.' }),
    },
    allowlist: {
      'weekly-client-report': [{
        id: 'client-report-sources',
        title: 'Client report sources',
        keys: ['reports/client-a/weekly.md'],
      }],
    },
  });

  const snapshot = await routineContext.getSnapshot({ tenant: 'cambium', routine: 'weekly-client-report' });
  const section = snapshot.sections[0] as any;

  assert.equal(section.signalState, 'blocked-no-signal');
  assert.equal(section.items[0].signalState, 'blocked-no-signal');
  assert.equal(section.staleAfterSeconds, undefined);
  assert.equal(section.items[0].observedAt, undefined);
});

test('semantic recall embeds query and sends tenant and kind filters to Vectorize', async () => {
  const embedded: string[] = [];
  let queryCall: any;
  const vectorIndex: VectorizeIndexLike = {
    async query(vector, options) {
      queryCall = { vector, options };
      return {
        matches: [{
          id: 'memory-1',
          score: 0.91,
          metadata: {
            tenant: 'cambium',
            kind: 'decision',
            ts: 1710000000,
            payload: JSON.stringify({ title: 'Decision', summary: 'Use exact R2 keys only.', raw: 'do not leak' }),
          },
          values: [99],
        }],
      };
    },
  };
  const recall = createSemanticRecall({
    embed: async (query) => {
      embedded.push(query);
      return [0.1, 0.2, 0.3];
    },
    vectorIndex,
  });

  const result = await recall.recall({ tenant: 'cambium', query: 'standup blockers', kind: 'decision', topK: 4 }) as any;

  assert.deepEqual(embedded, ['standup blockers']);
  assert.deepEqual(queryCall.vector, [0.1, 0.2, 0.3]);
  assert.equal(queryCall.options.topK, 4);
  assert.equal(queryCall.options.returnMetadata, 'all');
  assert.equal(queryCall.options.returnValues, false);
  assert.deepEqual(queryCall.options.filter, { tenant: 'cambium', kind: 'decision' });
  assert.equal(result.hits[0].kind, 'decision');
  assert.equal(result.hits[0].payload.summary, 'Use exact R2 keys only.');
  assert.doesNotMatch(JSON.stringify(result.hits[0]), /do not leak|99/);
});

test('semantic recall requires kind before embedding or querying Vectorize', async () => {
  let embedded = false;
  let queried = false;
  const vectorIndex: VectorizeIndexLike = {
    async query() {
      queried = true;
      return { matches: [] };
    },
  };
  const recall = createSemanticRecall({
    embed: async () => {
      embedded = true;
      return [1, 2, 3];
    },
    vectorIndex,
  });

  const result = await recall.recall({ tenant: 'cambium', query: 'memory', topK: 1 }) as any;

  assert.equal(embedded, false);
  assert.equal(queried, false);
  assert.deepEqual(result.hits, []);
  assert.equal(result.metadata.index, 'cambium-cortex');
});

test('semantic recall returns no-signal metadata on provider failures', async () => {
  let queried = false;
  const recall = createSemanticRecall({
    embed: async () => {
      throw new Error('provider rejected query');
    },
    vectorIndex: {
      async query() {
        queried = true;
        return { matches: [] };
      },
    },
  });

  const result = await recall.recall({ tenant: 'cambium', query: 'memory', kind: 'decision', topK: 3 }) as any;

  assert.equal(queried, false);
  assert.deepEqual(result.hits, []);
  assert.equal(result.metadata.provider, 'cloudflare-vectorize');
  assert.equal(result.metadata.mode, 'provider-error');
});

test('semantic recall returns adapter metadata without raw vectors or payload dumps', async () => {
  const vectorIndex: VectorizeIndexLike = {
    async query() {
      return {
        matches: [{
          id: 'memory-2',
          score: 0.8,
          metadata: {
            kind: 'memory',
            payload_json: JSON.stringify({ summary: 'Cortex memory summary.', vector: [1, 2], fullText: 'raw payload dump' }),
          },
          vector: [1, 2, 3],
        }],
      };
    },
  };
  const recall = createSemanticRecall({ embed: async () => [1, 2, 3], vectorIndex });

  const result = await recall.recall({ tenant: 'cambium', query: 'memory', kind: 'memory', topK: 1 }) as any;

  assert.equal(result.metadata.index, 'cambium-cortex');
  assert.equal(result.metadata.source, 'cambium-cortex');
  assert.equal(result.metadata.provider, 'cloudflare-vectorize');
  assert.equal(result.hits[0].payload.summary, 'Cortex memory summary.');
  assert.doesNotMatch(JSON.stringify(result), /raw payload dump|"vector"|\[1,2,3]/);
});

test('provider embedder posts to /embeddings with existing provider key and parses embedding', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const embed = createProviderEmbedder({
    provider: {
      apiKey: 'provider-key',
      baseUrl: 'https://integrate.api.nvidia.com/v1/',
    },
    model: 'nvidia/nv-embedqa-e5-v5',
    fetchImpl: async (url, init) => {
      requestUrl = String(url);
      requestInit = init;
      return new Response(JSON.stringify({ data: [{ embedding: [0.4, 0.5, 0.6] }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.ok(embed);
  const embedding = await embed('bounded context query');

  assert.equal(requestUrl, 'https://integrate.api.nvidia.com/v1/embeddings');
  assert.equal(requestInit?.method, 'POST');
  assert.equal((requestInit?.headers as Record<string, string>).authorization, 'Bearer provider-key');
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    model: 'nvidia/nv-embedqa-e5-v5',
    input: ['bounded context query'],
    input_type: 'query',
    encoding_format: 'float',
  });
  assert.deepEqual(embedding, [0.4, 0.5, 0.6]);
});

test('summarizeMarkdown returns bounded plain text', () => {
  const summary = summarizeMarkdown('# Title\n\n```ts\nsecret\n```\n\n[Read this](https://example.com) '.repeat(40));
  assert.ok(summary.length <= 500);
  assert.match(summary, /Title/);
  assert.doesNotMatch(summary, /```|https:\/\/example.com/);
});

test('worker runtime preserves query params for routine snapshots', async () => {
  const calls: string[] = [];
  const stored = await projectionEnvelope();
  const response = await worker.fetch(new Request('https://worker.local/v1/context/routine-snapshot?tenant=cambium&routine=daily-standup-digest', {
    headers: { authorization: 'Bearer context-token' },
  }), fakeWorkerEnv({
    CONTEXT_ROUTE_TOKEN: 'context-token',
    CONTEXT_ALLOWED_TENANTS: 'cambium',
    CONTEXT_PROJECTIONS: {
      get: async (key: string) => {
        calls.push(key);
        return { text: async () => JSON.stringify(stored) };
      },
    },
  }) as any);

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [CONTEXT_PROJECTION_KEY]);
  const payload = await response.json() as any;
  assert.equal(payload.routine, 'daily-standup-digest');
  assert.equal(payload.sections[0].items[0].summary, 'Daily Standup Bounded evidence');
});

test('worker rejects unauthenticated weekly report before any projection read', async () => {
  let called = false;
  const response = await worker.fetch(new Request('https://worker.local/v1/context/routine-snapshot?tenant=cambium&routine=weekly-client-report'), fakeWorkerEnv({
    CONTEXT_ROUTE_TOKEN: 'context-token',
    CONTEXT_ALLOWED_TENANTS: 'cambium',
    CONTEXT_ROUTINE_ALLOWLIST_JSON: JSON.stringify({
      'weekly-client-report': [{
        id: 'client-report-sources',
        title: 'Client report sources',
        maxAgeSeconds: 86_400,
        keys: ['reports/client-a/weekly.md'],
      }],
    }),
    CONTEXT_PROJECTIONS: {
      get: async () => {
        called = true;
        return { text: async () => '# Must not be read' };
      },
    },
  }) as any);

  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test('weekly-only runtime configuration preserves daily standup blocked defaults', async () => {
  let called = false;
  const response = await worker.fetch(new Request('https://worker.local/v1/context/routine-snapshot?tenant=cambium&routine=daily-standup-digest', {
    headers: { authorization: 'Bearer context-token' },
  }), fakeWorkerEnv({
    CONTEXT_ROUTE_TOKEN: 'context-token',
    CONTEXT_ALLOWED_TENANTS: 'cambium',
    CONTEXT_ROUTINE_ALLOWLIST_JSON: JSON.stringify({
      'weekly-client-report': [{
        id: 'client-report-sources',
        title: 'Client report sources',
        maxAgeSeconds: 86_400,
        keys: ['reports/client-a/weekly.md'],
      }],
    }),
    THOUGHTSEED_VAULT: {
      get: async () => {
        called = true;
        return { text: async () => '# Must not be read by daily defaults' };
      },
    },
  }) as any);

  assert.equal(response.status, 200);
  assert.equal(called, false);
  const payload = await response.json() as any;
  assert.equal(payload.routine, 'daily-standup-digest');
  assert.equal(payload.sections.length, 1);
  assert.equal(payload.sections[0].signalState, 'blocked-no-signal');
});

test('worker runtime exposes explicit blocked-no-signal without projection binding', async () => {
  const health = await worker.fetch(new Request('https://worker.local/v1/context/health', {
    headers: { authorization: 'Bearer context-token' },
  }), fakeWorkerEnv({
    CONTEXT_ROUTE_TOKEN: 'context-token',
    CONTEXT_ALLOWED_TENANTS: 'cambium',
  }) as any);

  assert.equal(health.status, 200);
  const healthPayload = await health.json() as any;
  assert.equal(healthPayload.capabilities.routineSnapshot, true);

  const snapshot = await worker.fetch(new Request('https://worker.local/v1/context/routine-snapshot?tenant=cambium&routine=daily-standup-digest', {
    headers: { authorization: 'Bearer context-token' },
  }), fakeWorkerEnv({
    CONTEXT_ROUTE_TOKEN: 'context-token',
    CONTEXT_ALLOWED_TENANTS: 'cambium',
  }) as any);

  assert.equal(snapshot.status, 200);
  const snapshotPayload = await snapshot.json() as any;
  assert.equal(snapshotPayload.sections[0].signalState, 'blocked-no-signal');
  assert.match(snapshotPayload.sections[0].items[0].summary, /projection bucket binding is unavailable/i);
});

test('worker runtime fails closed without explicit context tenant policy', async () => {
  let called = false;
  const response = await worker.fetch(new Request('https://worker.local/v1/context/routine-snapshot?tenant=cambium&routine=daily-standup-digest', {
    headers: { authorization: 'Bearer context-token' },
  }), fakeWorkerEnv({
    CONTEXT_ROUTE_TOKEN: 'context-token',
    CONTEXT_PROJECTIONS: {
      get: async () => {
        called = true;
        return { text: async () => '# Should not be read' };
      },
    },
    CONTEXT_ROUTINE_ALLOWLIST_JSON: JSON.stringify({
      'daily-standup-digest': [{
        id: 'standups',
        title: 'Standups',
        keys: ['routines/daily/standups/2026-06-25.md'],
      }],
    }),
  }) as any);

  assert.equal(response.status, 403);
  assert.equal(called, false);
  assert.match(await response.text(), /tenant is not authorized/);
});
