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

const fakeWorkerEnv = (overrides: Record<string, unknown> = {}) => ({
  QUESTS: {
    get: async () => null,
    put: async () => {},
    list: async () => ({ keys: [] }),
  },
  ...overrides,
});

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

test('routine adapter reads only explicit safe exact keys and summarizes markdown', async () => {
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
  assert.equal(section.items[0].title, 'Standup 2026-06-25');
  assert.match(section.items[0].summary, /Alice shipped bounded context/);
  assert.doesNotMatch(section.items[0].summary, /#|super-secret/);
  assert.equal(section.items[0].sourceKey, 'routines/daily/standups/2026-06-25.md');
});

test('default blocked slices do not call R2 and produce blocked no-signal summaries', async () => {
  let called = false;
  const bucket: R2BucketLike = {
    async get() {
      called = true;
      return null;
    },
  };
  const routineContext = createRoutineContext({ bucket, allowlist: DEFAULT_ROUTINE_CONTEXT_SLICES });

  const snapshot = await routineContext.getSnapshot({ tenant: 'cambium', routine: 'daily-standup-digest' });

  assert.equal(called, false);
  assert.equal(snapshot.sections.length, 2);
  const summaries = JSON.stringify(snapshot.sections);
  assert.match(summaries, /Blocked\/no-signal/);
  assert.match(summaries, /R2 routine object keys are not verified/);
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

test('worker preserves accepted 300-character source keys and rejects longer keys before R2', async () => {
  const acceptedKey = `${'a'.repeat(297)}.md`;
  const rejectedKey = `${'b'.repeat(298)}.md`;
  assert.equal(acceptedKey.length, 300);
  assert.equal(rejectedKey.length, 301);

  const calls: string[] = [];
  const response = await worker.fetch(new Request('https://worker.local/v1/context/routine-snapshot?tenant=cambium&routine=weekly-client-report', {
    headers: { authorization: 'Bearer context-token' },
  }), fakeWorkerEnv({
    CONTEXT_ROUTE_TOKEN: 'context-token',
    CONTEXT_ALLOWED_TENANTS: 'cambium',
    CONTEXT_ROUTINE_ALLOWLIST_JSON: JSON.stringify({
      'weekly-client-report': [{
        id: 'client-report-sources',
        title: 'Client report sources',
        keys: [acceptedKey, rejectedKey],
      }],
    }),
    THOUGHTSEED_VAULT: {
      get: async (key: string) => {
        calls.push(key);
        return { key, text: async () => '# Weekly\n\nBounded summary.' };
      },
    },
  }) as any);

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [acceptedKey]);
  const payload = await response.json() as any;
  assert.equal(payload.sections[0].exactKeyCount, 1);
  assert.equal(payload.sections[0].items[0].sourceKey, acceptedKey);
  assert.equal(payload.sections[0].items[0].sourceKey.length, 300);
});

test('weekly report reads only configured exact keys and reports current, stale, and missing counts', async () => {
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
  assert.deepEqual(textCalls, ['reports/client-a/weekly.md']);
  const section = snapshot.sections[0] as any;
  assert.equal(section.signalState, 'mixed');
  assert.equal(section.exactKeyCount, 3);
  assert.equal(section.resolvedKeyCount, 2);
  assert.equal(section.staleKeyCount, 1);
  assert.equal(section.missingKeyCount, 1);
  assert.equal(section.staleAfterSeconds, 86_400);
  assert.equal(section.items[0].signalState, 'current');
  assert.equal(section.items[0].observedAt, '2026-07-14T18:00:00.000Z');
  assert.equal(section.items[0].ageSeconds, 21_600);
  assert.equal(section.items[1].signalState, 'stale');
  assert.equal(section.items[1].sourceKey, 'reports/client-b/weekly.md');
  assert.match(section.items[1].summary, /^Blocked\/no-signal:/);
  assert.equal(section.items[2].signalState, 'missing');
  assert.match(section.items[2].summary, /1 of 3 exact allowlisted R2 objects are missing/);
  assert.doesNotMatch(JSON.stringify(section), /do-not-return|stale-body-must-not-be-read|Awaiting an approved decision|rawBody|fullMarkdown/);
});

test('weekly report treats unverified freshness as explicit unknown instead of current', async () => {
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

  assert.equal(section.signalState, 'freshness-unknown');
  assert.equal(section.items[0].signalState, 'freshness-unknown');
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
  const response = await worker.fetch(new Request('https://worker.local/v1/context/routine-snapshot?tenant=cambium&routine=daily-standup-digest', {
    headers: { authorization: 'Bearer context-token' },
  }), fakeWorkerEnv({
    CONTEXT_ROUTE_TOKEN: 'context-token',
    CONTEXT_ALLOWED_TENANTS: 'cambium',
    CONTEXT_ROUTINE_ALLOWLIST_JSON: JSON.stringify({
      'daily-standup-digest': [{
        id: 'standups',
        title: 'Standups',
        keys: ['routines/daily/standups/2026-06-25.md'],
      }],
    }),
    THOUGHTSEED_VAULT: {
      get: async (key: string) => {
        calls.push(key);
        return { text: async () => '# Standup\nReady for Hermes.' };
      },
    },
  }) as any);

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ['routines/daily/standups/2026-06-25.md']);
  const payload = await response.json() as any;
  assert.equal(payload.routine, 'daily-standup-digest');
  assert.equal(payload.sections[0].items[0].summary, 'Standup Ready for Hermes.');
});

test('worker rejects unauthenticated weekly report before any R2 read', async () => {
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
    THOUGHTSEED_VAULT: {
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
  assert.equal(payload.sections.length, 2);
  assert.equal(payload.sections[0].signalState, 'blocked-no-signal');
});

test('worker runtime does not expose routine context without R2 binding', async () => {
  const health = await worker.fetch(new Request('https://worker.local/v1/context/health', {
    headers: { authorization: 'Bearer context-token' },
  }), fakeWorkerEnv({
    CONTEXT_ROUTE_TOKEN: 'context-token',
    CONTEXT_ALLOWED_TENANTS: 'cambium',
  }) as any);

  assert.equal(health.status, 200);
  const healthPayload = await health.json() as any;
  assert.equal(healthPayload.capabilities.routineSnapshot, false);

  const snapshot = await worker.fetch(new Request('https://worker.local/v1/context/routine-snapshot?tenant=cambium&routine=daily-standup-digest', {
    headers: { authorization: 'Bearer context-token' },
  }), fakeWorkerEnv({
    CONTEXT_ROUTE_TOKEN: 'context-token',
    CONTEXT_ALLOWED_TENANTS: 'cambium',
  }) as any);

  assert.equal(snapshot.status, 503);
  assert.match(await snapshot.text(), /routine context not configured/);
});

test('worker runtime fails closed without explicit context tenant policy', async () => {
  let called = false;
  const response = await worker.fetch(new Request('https://worker.local/v1/context/routine-snapshot?tenant=cambium&routine=daily-standup-digest', {
    headers: { authorization: 'Bearer context-token' },
  }), fakeWorkerEnv({
    CONTEXT_ROUTE_TOKEN: 'context-token',
    THOUGHTSEED_VAULT: {
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
