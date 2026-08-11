import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CORTEX_INGESTION_RECEIPT_SCHEMA,
  CORTEX_INGESTION_SCHEMA,
  CortexIngestionValidationError,
  CortexIngestionProviderError,
  chunkMarkdown,
  ingestCortexContent,
  type CortexIngestionInput,
} from './cortex-ingestion.ts';
import type { EmbedQuery, VectorizeIndexLike, VectorizeUpsertVector } from './context-bindings.ts';

// ---------------------------------------------------------------------------
// chunkMarkdown
// ---------------------------------------------------------------------------

test('chunkMarkdown splits content on ## and ### headings', () => {
  const content = `# Pre-title\n\nPreamble text here with enough length to pass the minimum chunk threshold of forty characters.\n\n## Section One\n\nContent for section one that also has sufficient length to be kept after cleaning.\n\n### Subsection A\n\nSubsection content which is nicely padded out beyond the smallest chunk size.\n\n## Section Two\n\nFinal section text that is long enough to not be dropped by the minimum chunk filter.`;
  const chunks = chunkMarkdown(content);
  assert.ok(chunks.length >= 3, `expected at least 3 chunks, got ${chunks.length}`);
  const sections = chunks.map((c) => c.section);
  assert.ok(sections.includes('Section One'), 'should include Section One');
  assert.ok(sections.includes('Subsection A'), 'should include Subsection A');
  assert.ok(sections.includes('Section Two'), 'should include Section Two');
});

test('chunkMarkdown returns empty array for empty content', () => {
  assert.deepEqual(chunkMarkdown(''), []);
  assert.deepEqual(chunkMarkdown('   \n\n  '), []);
});

test('chunkMarkdown with no headings returns single preamble chunk', () => {
  const chunks = chunkMarkdown('Just some plain text with no headings at all.\n\nMore text.');
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].section, 'preamble');
});

test('chunkMarkdown skips extremely short chunks after cleaning', () => {
  const content = `## Head\nThis chunk is well over the minimum length threshold so it stays.\n## Tiny\nx`;
  const chunks = chunkMarkdown(content);
  // The "Tiny / x" chunk is too short after cleaning (< 40 chars) and is dropped
  const texts = chunks.map((c) => c.text);
  assert.ok(texts.some((t) => t.includes('well over the minimum')), 'should keep the long chunk');
  assert.ok(!texts.some((t) => t === 'x' || t.includes('\nx')), 'should drop the tiny chunk');
});

test('chunkMarkdown handles code blocks and inline code gracefully', () => {
  const content = '## Code\n\n```\nconst x = 1;\n```\n\nSome text with `inline` code.';
  const chunks = chunkMarkdown(content);
  assert.ok(chunks.length >= 1);
  assert.ok(chunks[0].text.includes('Some text'), 'should preserve readable text around code');
});

// ---------------------------------------------------------------------------
// ingestCortexContent — validation
// ---------------------------------------------------------------------------

const EMBED_IDENTITY = new Float32Array(768).fill(0.01);

function fakeEmbed(): EmbedQuery {
  return async (_text: string): Promise<number[]> => {
    return Array.from(EMBED_IDENTITY);
  };
}

function fakeVectorizeIndex(opts?: { failUpsert?: boolean; capturedVectors?: VectorizeUpsertVector[] }): VectorizeIndexLike {
  return {
    query: async () => ({ matches: [] }),
    upsert: async (vectors) => {
      if (opts?.failUpsert) throw new Error('upsert unavailable');
      opts?.capturedVectors?.push(...vectors);
      return { ids: vectors.map((v) => v.id), count: vectors.length };
    },
  };
}

const VALID_INPUT: CortexIngestionInput = {
  schema: CORTEX_INGESTION_SCHEMA,
  tenant: 'cambium',
  kind: 'memory',
  source: 'teamforge',
  path: 'Sheshiyer/thoughtseed-labs/blob/main/ARCHITECTURE.md',
  commit: 'abc123',
  content: '## Overview\nThis is a knowledge document with useful architectural information for the service.\n\n## Details\nMore content here for embedding into the vector database for later semantic retrieval.',
  idempotencyKey: 'ingest_abc123_arch',
};

test('ingestCortexContent validates schema', async () => {
  await assert.rejects(
    ingestCortexContent({ ...VALID_INPUT, schema: 'wrong' }, { embed: fakeEmbed(), vectorIndex: fakeVectorizeIndex() }),
    CortexIngestionValidationError,
  );
});

test('ingestCortexContent validates tenant', async () => {
  await assert.rejects(
    ingestCortexContent({ ...VALID_INPUT, tenant: '' }, { embed: fakeEmbed(), vectorIndex: fakeVectorizeIndex() }),
    CortexIngestionValidationError,
  );
});

test('ingestCortexContent validates kind against allowed set', async () => {
  await assert.rejects(
    ingestCortexContent({ ...VALID_INPUT, kind: 'invalid-kind' }, { embed: fakeEmbed(), vectorIndex: fakeVectorizeIndex() }),
    CortexIngestionValidationError,
  );
});

test('ingestCortexContent requires content to be a string', async () => {
  const input = { ...VALID_INPUT, content: 123 as unknown as string };
  await assert.rejects(
    ingestCortexContent(input, { embed: fakeEmbed(), vectorIndex: fakeVectorizeIndex() }),
    CortexIngestionValidationError,
  );
});

test('ingestCortexContent rejects oversized content', async () => {
  const hugeContent = 'x'.repeat(600_000);
  await assert.rejects(
    ingestCortexContent({ ...VALID_INPUT, content: hugeContent }, { embed: fakeEmbed(), vectorIndex: fakeVectorizeIndex() }),
    CortexIngestionValidationError,
  );
});

// ---------------------------------------------------------------------------
// ingestCortexContent — successful path
// ---------------------------------------------------------------------------

test('ingestCortexContent returns empty receipt for empty content', async () => {
  const receipt = await ingestCortexContent(
    { ...VALID_INPUT, content: '' },
    { embed: fakeEmbed(), vectorIndex: fakeVectorizeIndex() },
  );
  assert.equal(receipt.schema, CORTEX_INGESTION_RECEIPT_SCHEMA);
  assert.equal(receipt.status, 'empty');
  assert.equal(receipt.chunkCount, 0);
  assert.deepEqual(receipt.vectorIds, []);
});

test('ingestCortexContent chunks, embeds, and upserts', async () => {
  const capturedVectors: VectorizeUpsertVector[] = [];
  const receipt = await ingestCortexContent(
    VALID_INPUT,
    { embed: fakeEmbed(), vectorIndex: fakeVectorizeIndex({ capturedVectors }) },
  );
  assert.equal(receipt.schema, CORTEX_INGESTION_RECEIPT_SCHEMA);
  assert.equal(receipt.status, 'ingested');
  assert.equal(receipt.tenant, 'cambium');
  assert.equal(receipt.kind, 'memory');
  assert.equal(receipt.source, 'teamforge');
  assert.equal(receipt.path, VALID_INPUT.path);
  assert.ok(receipt.chunkCount > 0, 'should have at least one chunk');
  assert.equal(receipt.vectorIds.length, capturedVectors.length);
  assert.ok(receipt.ingestedAt, 'should have an ingestedAt timestamp');

  // Each vector should carry metadata
  for (const vector of capturedVectors) {
    const m = vector.metadata as Record<string, unknown>;
    assert.equal(m.tenant, 'cambium');
    assert.equal(m.kind, 'memory');
    assert.equal(m.source, 'teamforge');
    assert.equal(m.commit, 'abc123');
    assert.ok(typeof m.chunk === 'number');
    assert.ok(typeof m.totalChunks === 'number');
    assert.ok(typeof m.section === 'string');
    assert.ok(typeof m.contentDigest === 'string');
    assert.ok(typeof m.ingestedAt === 'string');
  }
});

test('ingestCortexContent is idempotent via vector IDs', async () => {
  const capturedFirst: VectorizeUpsertVector[] = [];
  const capturedSecond: VectorizeUpsertVector[] = [];

  const receipt1 = await ingestCortexContent(
    VALID_INPUT,
    { embed: fakeEmbed(), vectorIndex: fakeVectorizeIndex({ capturedVectors: capturedFirst }) },
  );
  const receipt2 = await ingestCortexContent(
    VALID_INPUT,
    { embed: fakeEmbed(), vectorIndex: fakeVectorizeIndex({ capturedVectors: capturedSecond }) },
  );

  // Same input should produce same vector IDs
  assert.deepEqual(receipt1.vectorIds, receipt2.vectorIds);
  assert.equal(receipt1.inputDigest, receipt2.inputDigest);
});

test('ingestCortexContent handles commit being optional', async () => {
  const { commit: _, ...inputWithoutCommit } = VALID_INPUT;
  const capturedVectors: VectorizeUpsertVector[] = [];
  const receipt = await ingestCortexContent(
    inputWithoutCommit,
    { embed: fakeEmbed(), vectorIndex: fakeVectorizeIndex({ capturedVectors }) },
  );
  assert.equal(receipt.status, 'ingested');
  for (const vector of capturedVectors) {
    const m = vector.metadata as Record<string, unknown>;
    assert.ok(!('commit' in m), 'commit should be absent when not provided');
  }
});

// ---------------------------------------------------------------------------
// ingestCortexContent — error paths
// ---------------------------------------------------------------------------

test('ingestCortexContent throws when vector index lacks upsert', async () => {
  const indexWithoutUpsert: VectorizeIndexLike = {
    query: fakeVectorizeIndex().query,
  };
  await assert.rejects(
    ingestCortexContent(VALID_INPUT, { embed: fakeEmbed(), vectorIndex: indexWithoutUpsert }),
    CortexIngestionProviderError,
  );
});

test('ingestCortexContent throws on embedding failure', async () => {
  const badEmbed: EmbedQuery = async () => {
    throw new Error('embedding provider unreachable');
  };
  await assert.rejects(
    ingestCortexContent(VALID_INPUT, { embed: badEmbed, vectorIndex: fakeVectorizeIndex() }),
    CortexIngestionProviderError,
  );
});

test('ingestCortexContent throws on Vectorize upsert failure', async () => {
  await assert.rejects(
    ingestCortexContent(VALID_INPUT, {
      embed: fakeEmbed(),
      vectorIndex: fakeVectorizeIndex({ failUpsert: true }),
    }),
    CortexIngestionProviderError,
  );
});

// ---------------------------------------------------------------------------
// CortexVectorMetadata shape integrity
// ---------------------------------------------------------------------------

test('vector metadata includes all required fields', async () => {
  const capturedVectors: VectorizeUpsertVector[] = [];
  await ingestCortexContent(
    VALID_INPUT,
    { embed: fakeEmbed(), vectorIndex: fakeVectorizeIndex({ capturedVectors }) },
  );

  for (const vector of capturedVectors) {
    const m = vector.metadata as Record<string, unknown>;
    const requiredFields = ['tenant', 'kind', 'source', 'path', 'chunk', 'totalChunks', 'section', 'contentDigest', 'ingestedAt'];
    for (const field of requiredFields) {
      assert.ok(m[field] !== undefined, `vector ${vector.id} missing required field: ${field}`);
    }
    assert.equal(m.tenant, 'cambium');
    assert.equal(m.kind, 'memory');
    assert.equal(m.source, 'teamforge');
  }
});

// ---------------------------------------------------------------------------
// Receipt shape
// ---------------------------------------------------------------------------

test('ingestion receipt carries full identity', async () => {
  const receipt = await ingestCortexContent(
    VALID_INPUT,
    { embed: fakeEmbed(), vectorIndex: fakeVectorizeIndex() },
  );
  assert.equal(receipt.schema, CORTEX_INGESTION_RECEIPT_SCHEMA);
  assert.equal(receipt.idempotencyKey, VALID_INPUT.idempotencyKey);
  assert.match(receipt.inputDigest, /^sha256:[0-9a-f]{64}$/);
  assert.ok(receipt.vectorIds.every((id) => /^cortex:[0-9a-f]+:\d{3}:\d+$/.test(id)), 'vector IDs have stable format');
});
