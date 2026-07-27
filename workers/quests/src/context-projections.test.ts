import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTEXT_PROJECTION_KEY,
  CONTEXT_PROJECTION_RECEIPT_SCHEMA,
  CONTEXT_PROJECTION_SCHEMA,
  MAX_CONTEXT_PROJECTION_MARKDOWN_BYTES,
  MAX_CONTEXT_PROJECTION_SOURCE_REVISION_LENGTH,
  contentDigestForMarkdown,
  createContextProjectionStore,
  validateContextProjection,
} from './context-projections.ts';

const GOLDEN_MARKDOWN = '# Daily Standup\nBounded evidence';
const GOLDEN_DIGEST = 'sha256:7d696bb44566df0ffec55bce3a17117aa397f923f92e26b91c0695f9fc9fd8e4';

async function envelope(overrides: Record<string, unknown> = {}) {
  const markdown = typeof overrides.markdown === 'string' ? overrides.markdown : GOLDEN_MARKDOWN;
  return {
    schema: CONTEXT_PROJECTION_SCHEMA,
    key: CONTEXT_PROJECTION_KEY,
    tenantId: 'cambium',
    routine: 'daily-standup-digest',
    generation: 1,
    producedAt: '2026-07-28T08:00:00.000Z',
    expiresAt: '2026-07-28T20:00:00.000Z',
    sourceRevision: 'git:abc123',
    contentDigest: await contentDigestForMarkdown(markdown),
    markdown,
    ...overrides,
  };
}

test('golden markdown hashes its exact 32 UTF-8 bytes', async () => {
  assert.equal(new TextEncoder().encode(GOLDEN_MARKDOWN).byteLength, 32);
  assert.equal(await contentDigestForMarkdown(GOLDEN_MARKDOWN), GOLDEN_DIGEST);
  assert.notEqual(await contentDigestForMarkdown(`${GOLDEN_MARKDOWN}\n`), GOLDEN_DIGEST);
  assert.notEqual(await contentDigestForMarkdown(GOLDEN_MARKDOWN.replace('\n', '\r\n')), GOLDEN_DIGEST);
});

test('validator accepts only the frozen v1 envelope and preserves markdown bytes', async () => {
  const input = await envelope();
  const validated = await validateContextProjection(input);

  assert.deepEqual(validated, input);
  assert.equal(validated.markdown, GOLDEN_MARKDOWN);
  assert.equal(validated.contentDigest, GOLDEN_DIGEST);
});

test('validator compares valid RFC3339 instants across offsets and two-digit years', async () => {
  const validated = await validateContextProjection(await envelope({
    producedAt: '0099-12-31T23:30:00-01:00',
    expiresAt: '0100-01-01T02:00:00+01:00',
  }));

  assert.equal(validated.producedAt, '0099-12-31T23:30:00-01:00');
  assert.equal(validated.expiresAt, '0100-01-01T02:00:00+01:00');
});

test('validator rejects malformed, mismatched, unsafe, unbounded, or expired envelope fields', async () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['schema', { schema: 'thoughtseed.context-projection.v2' }],
    ['key', { key: '/context/v1/daily-standup-digest/standups/latest.json' }],
    ['key', { key: 'context/v1/daily-standup-digest/standups/../latest.json' }],
    ['tenant', { tenantId: 'other' }],
    ['routine', { routine: 'weekly-client-report' }],
    ['generation', { generation: 0 }],
    ['generation', { generation: 1.5 }],
    ['generation', { generation: Number.MAX_SAFE_INTEGER + 1 }],
    ['producedAt', { producedAt: '2026-07-28 08:00:00Z' }],
    ['producedAt', { producedAt: '2026-02-30T08:00:00Z' }],
    ['expiresAt', { expiresAt: '2026-07-28T08:00:00.000Z' }],
    ['expiresAt', { expiresAt: '2026-07-28T07:59:59.999Z' }],
    ['sourceRevision', { sourceRevision: '' }],
    ['sourceRevision', { sourceRevision: 'x'.repeat(MAX_CONTEXT_PROJECTION_SOURCE_REVISION_LENGTH + 1) }],
    ['contentDigest', { contentDigest: `sha256:${'A'.repeat(64)}` }],
    ['contentDigest', { contentDigest: `sha256:${'0'.repeat(64)}` }],
    ['markdown', {
      markdown: 'a'.repeat(MAX_CONTEXT_PROJECTION_MARKDOWN_BYTES + 1),
      contentDigest: await contentDigestForMarkdown('a'.repeat(MAX_CONTEXT_PROJECTION_MARKDOWN_BYTES + 1)),
    }],
    ['fields', { extraSecret: 'must-not-be-stored' }],
  ];

  for (const [field, overrides] of cases) {
    await assert.rejects(
      validateContextProjection(await envelope(overrides)),
      new RegExp(field, 'i'),
      field,
    );
  }
});

test('projection store writes canonical JSON with application/json and returns a bounded receipt', async () => {
  let write: {
    key: string;
    value: Uint8Array;
    options: unknown;
  } | undefined;
  const store = createContextProjectionStore({
    bucket: {
      get: async () => null,
      put: async (key, value, options) => {
        write = { key, value, options };
        return { key, text: async () => new TextDecoder().decode(value) };
      },
    },
  });
  const input = await envelope();

  const receipt = await store.put(input);

  assert.deepEqual(receipt, {
    schema: CONTEXT_PROJECTION_RECEIPT_SCHEMA,
    key: CONTEXT_PROJECTION_KEY,
    generation: 1,
    contentDigest: GOLDEN_DIGEST,
    producedAt: '2026-07-28T08:00:00.000Z',
    expiresAt: '2026-07-28T20:00:00.000Z',
  });
  assert.deepEqual(Object.keys(receipt), [
    'schema',
    'key',
    'generation',
    'contentDigest',
    'producedAt',
    'expiresAt',
  ]);
  assert.equal('markdown' in receipt, false);
  assert.equal(write?.key, CONTEXT_PROJECTION_KEY);
  assert.equal(new TextDecoder().decode(write?.value), JSON.stringify(input));
  assert.deepEqual(write?.options, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'application/json' },
  });
});

test('projection store validates existing objects and enforces strictly increasing generations', async () => {
  const current = await envelope({ generation: 4 });
  let writes = 0;
  const store = createContextProjectionStore({
    bucket: {
      get: async () => ({ key: CONTEXT_PROJECTION_KEY, text: async () => JSON.stringify(current) }),
      put: async () => {
        writes += 1;
        return { text: async () => '' };
      },
    },
  });

  await assert.rejects(store.put(await envelope({ generation: 4 })), /generation/i);
  await assert.rejects(store.put(await envelope({ generation: 3 })), /generation/i);
  assert.equal(writes, 0);

  const receipt = await store.put(await envelope({ generation: 5 }));
  assert.equal(receipt.generation, 5);
  assert.equal(writes, 1);
});

test('projection store fails closed when an existing object is malformed', async () => {
  let writes = 0;
  const store = createContextProjectionStore({
    bucket: {
      get: async () => ({ key: CONTEXT_PROJECTION_KEY, text: async () => '{"schema":"corrupt"}' }),
      put: async () => {
        writes += 1;
        return { text: async () => '' };
      },
    },
  });

  await assert.rejects(store.put(await envelope({ generation: 2 })), /existing context projection/i);
  assert.equal(writes, 0);
});

test('projection store uses R2 preconditions and rejects a concurrent non-monotonic winner', async () => {
  const concurrentWinner = await envelope({ generation: 2 });
  let reads = 0;
  let writes = 0;
  let writeOptions: unknown;
  const store = createContextProjectionStore({
    bucket: {
      get: async () => {
        reads += 1;
        return reads === 1
          ? null
          : {
              key: CONTEXT_PROJECTION_KEY,
              etag: 'winner-etag',
              text: async () => JSON.stringify(concurrentWinner),
            };
      },
      put: async (_key, _value, options) => {
        writes += 1;
        writeOptions = options;
        return null;
      },
    },
  });

  await assert.rejects(store.put(await envelope({ generation: 2 })), /generation/i);
  assert.equal(reads, 2);
  assert.equal(writes, 1);
  assert.deepEqual(writeOptions, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'application/json' },
  });
});
