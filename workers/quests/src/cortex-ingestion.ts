import type { EmbedQuery, VectorizeIndexLike, VectorizeUpsertVector } from './context-bindings.ts';

export const CORTEX_INGESTION_SCHEMA = 'thoughtseed.cortex-ingestion.v1' as const;
export const CORTEX_INGESTION_RECEIPT_SCHEMA = 'thoughtseed.cortex-ingestion-receipt.v1' as const;

const TEXT = new TextEncoder();
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,159}$/;
const VALID_TENANT = /^[a-z0-9][a-z0-9_-]{1,79}$/;
const VALID_KINDS = new Set([
  'decision', 'evidence', 'handoff', 'heartbeat', 'memory', 'note', 'routine', 'standup', 'task',
]);
const SHA256_REF = /^sha256:[0-9a-f]{64}$/;
const MAX_CONTENT_BYTES = 512 * 1024; // 512KB
const MAX_CHUNK_LENGTH = 4000; // rough character bound per chunk
const MIN_CHUNK_LENGTH = 40; // skip chunks shorter than this after cleaning

export interface CortexIngestionInput {
  schema: typeof CORTEX_INGESTION_SCHEMA;
  tenant: string;
  kind: string;
  source: string;
  path: string;
  commit?: string;
  content: string;
  idempotencyKey: string;
}

export interface CortexVectorMetadata {
  tenant: string;
  kind: string;
  source: string;
  path: string;
  chunk: number;
  totalChunks: number;
  section: string;
  commit?: string;
  contentDigest: string;
  ingestedAt: string;
}

export interface CortexEmbeddingSpace {
  id: string; provider: string; model: string; dimensions: number; index: string; metric: 'cosine';
}

export interface CortexIngestionReceipt {
  schema: typeof CORTEX_INGESTION_RECEIPT_SCHEMA;
  inputDigest: string;
  idempotencyKey: string;
  tenant: string;
  kind: string;
  source: string;
  path: string;
  chunkCount: number;
  vectorIds: string[];
  ingestedAt: string;
  status: 'ingested' | 'empty';
  embeddingSpace?: CortexEmbeddingSpace;
}

export class CortexIngestionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CortexIngestionValidationError';
  }
}

export class CortexIngestionProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CortexIngestionProviderError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) {
    throw new CortexIngestionValidationError(`${field} is invalid`);
  }
  return value;
}

function digest(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SHA256_REF.test(value)) {
    throw new CortexIngestionValidationError(`${field} is invalid`);
  }
  return value;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
  );
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

async function sha256(value: string): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', TEXT.encode(value) as unknown as BufferSource);
  return [...new Uint8Array(result)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function vectorId(inputDigest: string, chunk: number, total: number): string {
  // Stable, deterministic ID from the content digest + chunk index
  return `cortex:${inputDigest.slice(0, 16)}:${chunk.toString().padStart(3, '0')}:${total}`;
}

/** Strip code blocks, images, link URLs, and HTML tags for embedding. */
function cleanChunkForEmbedding(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → text
    .replace(/<\/?[^>]+>/g, ' ') // HTML tags
    .replace(/\|/g, ' ') // table pipes
    .replace(/^#{1,6}\s*/gm, '') // heading markers
    .replace(/^[\s>*-]+/gm, ' ') // blockquotes, list markers
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split content by markdown headings (## or ###) into chunks.
 * The heading text becomes the `section` metadata.
 * Content before the first heading gets section: 'preamble'.
 */
export function chunkMarkdown(content: string): Array<{ section: string; text: string }> {
  const trimmed = content.trim();
  if (!trimmed) return [];

  // Split on ## or ### headings
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const sections: Array<{ section: string; text: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(trimmed)) !== null) {
    const headingText = match[2].trim();
    // Grab content from the previous split point to this heading
    if (lastIndex === 0) {
      // Content before the first heading
      const preamble = trimmed.slice(0, match.index).trim();
      if (preamble) {
        sections.push({ section: 'preamble', text: preamble });
      }
    } else {
      const sectionText = trimmed.slice(lastIndex, match.index).trim();
      if (sectionText) {
        sections.push({ section: sections[sections.length - 1]?.section ?? 'preamble', text: sectionText });
      }
    }
    lastIndex = match.index;
    // Update the last section's name to this heading for the NEXT content block
    if (sections.length && sections[sections.length - 1].section === (headingText)) {
      // Same heading — extend it
    }
    sections.push({ section: headingText, text: '' });
  }

  // Final chunk after the last heading
  if (lastIndex > 0) {
    const finalText = trimmed.slice(lastIndex).trim();
    if (finalText) {
      sections[sections.length - 1].text = finalText;
    }
  } else if (trimmed) {
    // No headings at all — single chunk
    sections.push({ section: 'preamble', text: trimmed });
  }

  // Merge adjacent chunks with the same section heading
  const merged: Array<{ section: string; text: string }> = [];
  for (const s of sections) {
    if (!s.text) continue;
    const last = merged[merged.length - 1];
    if (last && last.section === s.section) {
      last.text += '\n\n' + s.text;
    } else {
      merged.push({ ...s });
    }
  }

  // Further split large chunks
  const result: Array<{ section: string; text: string }> = [];
  for (const s of merged) {
    const cleaned = cleanChunkForEmbedding(s.text);
    if (cleaned.length <= MAX_CHUNK_LENGTH) {
      if (cleaned.length >= MIN_CHUNK_LENGTH || s.text.length >= MIN_CHUNK_LENGTH) {
        result.push({ section: s.section, text: s.text });
      }
    } else {
      // Split long chunks on paragraph boundaries
      const paragraphs = s.text.split(/\n\n+/);
      let current = '';
      for (const para of paragraphs) {
        if ((current + '\n\n' + para).length > MAX_CHUNK_LENGTH && current) {
          if (cleanChunkForEmbedding(current).length >= MIN_CHUNK_LENGTH) {
            result.push({ section: s.section, text: current.trim() });
          }
          current = para;
        } else {
          current = current ? current + '\n\n' + para : para;
        }
      }
      if (current && cleanChunkForEmbedding(current).length >= MIN_CHUNK_LENGTH) {
        result.push({ section: s.section, text: current.trim() });
      }
    }
  }

  return result;
}

function validateInput(raw: unknown): CortexIngestionInput {
  if (!isRecord(raw)) throw new CortexIngestionValidationError('ingestion input must be an object');

  if (raw.schema !== CORTEX_INGESTION_SCHEMA) {
    throw new CortexIngestionValidationError('ingestion schema is invalid');
  }

  const tenant = safeText(raw.tenant, 'tenant');
  if (!VALID_TENANT.test(tenant)) {
    throw new CortexIngestionValidationError('tenant is invalid');
  }

  if (typeof raw.kind !== 'string' || !VALID_KINDS.has(raw.kind)) {
    throw new CortexIngestionValidationError('kind is invalid or not in the allowed set');
  }
  const kind = raw.kind;

  const source = safeText(raw.source, 'source');
  const path = safeText(raw.path, 'path');

  let commit: string | undefined;
  if (raw.commit !== undefined) {
    commit = safeText(raw.commit, 'commit');
  }

  if (typeof raw.content !== 'string') {
    throw new CortexIngestionValidationError('content must be a string');
  }
  if (new TextEncoder().encode(raw.content).byteLength > MAX_CONTENT_BYTES) {
    throw new CortexIngestionValidationError('content exceeds maximum byte length');
  }

  const idempotencyKey = safeText(raw.idempotencyKey, 'idempotencyKey');

  return {
    schema: CORTEX_INGESTION_SCHEMA,
    tenant,
    kind,
    source,
    path,
    ...(commit ? { commit } : {}),
    content: raw.content,
    idempotencyKey,
  };
}

export interface CortexIngestionDeps {
  embed: EmbedQuery;
  vectorIndex: VectorizeIndexLike;
  now?: () => string;
  embeddingSpace?: CortexEmbeddingSpace;
  verifyWrite?: boolean;
}

export async function ingestCortexContent(
  raw: unknown,
  deps: CortexIngestionDeps,
): Promise<CortexIngestionReceipt> {
  const input = validateInput(raw);

  if (!deps.vectorIndex.upsert) {
    throw new CortexIngestionProviderError('Vectorize index does not support upsert');
  }

  const inputDigestHex = await sha256(canonicalJson({
    schema: input.schema,
    tenant: input.tenant,
    kind: input.kind,
    source: input.source,
    path: input.path,
    ...(input.commit ? { commit: input.commit } : {}),
    content: input.content,
    idempotencyKey: input.idempotencyKey,
  }));
  const inputDigest = `sha256:${inputDigestHex}`;
  const now = deps.now ? deps.now() : new Date().toISOString();

  // Chunk the markdown
  const chunks = chunkMarkdown(input.content);

  if (!chunks.length) {
    return {
      schema: CORTEX_INGESTION_RECEIPT_SCHEMA,
      inputDigest,
      idempotencyKey: input.idempotencyKey,
      tenant: input.tenant,
      kind: input.kind,
      source: input.source,
      path: input.path,
      chunkCount: 0,
      vectorIds: [],
      ingestedAt: now,
      status: 'empty',
      ...(deps.embeddingSpace ? {embeddingSpace:deps.embeddingSpace} : {}),
    };
  }

  // Embed and prepare vectors
  const vectors: VectorizeUpsertVector[] = [];
  const vectorIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const cleanText = cleanChunkForEmbedding(chunk.text);

    if (cleanText.length < MIN_CHUNK_LENGTH) continue;

    const contentDigestHex = await sha256(cleanText);
    const contentDigest = `sha256:${contentDigestHex}`;
    const id = vectorId(inputDigestHex, i, chunks.length);

    let embedding: number[];
    try {
      embedding = await deps.embed(cleanText);
    } catch (error) {
      throw new CortexIngestionProviderError(
        `embedding failed for chunk ${i}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (deps.embeddingSpace && embedding.length !== deps.embeddingSpace.dimensions) {
      throw new CortexIngestionProviderError('embedding space dimensions mismatch');
    }
    const metadata: CortexVectorMetadata & Record<string,unknown> = {
      tenant: input.tenant,
      kind: input.kind,
      source: input.source,
      path: input.path,
      chunk: i,
      totalChunks: chunks.length,
      section: chunk.section,
      ...(input.commit ? { commit: input.commit } : {}),
      contentDigest,
      ingestedAt: now,
      ...(deps.embeddingSpace ? {embeddingSpace:deps.embeddingSpace.id,embeddingProvider:deps.embeddingSpace.provider,embeddingModel:deps.embeddingSpace.model,embeddingDimensions:deps.embeddingSpace.dimensions,embeddingIndex:deps.embeddingSpace.index} : {}),
    };

    vectors.push({ id, values: embedding, metadata: metadata as unknown as Record<string, string | number | boolean | null | Record<string, unknown> | unknown[]> });
    vectorIds.push(id);
  }

  if (!vectors.length) {
    return {
      schema: CORTEX_INGESTION_RECEIPT_SCHEMA,
      inputDigest,
      idempotencyKey: input.idempotencyKey,
      tenant: input.tenant,
      kind: input.kind,
      source: input.source,
      path: input.path,
      chunkCount: chunks.length,
      vectorIds: [],
      ingestedAt: now,
      status: 'empty',
      ...(deps.embeddingSpace ? {embeddingSpace:deps.embeddingSpace} : {}),
    };
  }

  // Upsert into Vectorize — idempotent by vector ID
  try {
    await deps.vectorIndex.upsert(vectors, { allowDuplicates: false });
  } catch (error) {
    throw new CortexIngestionProviderError(
      `Vectorize upsert failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (deps.verifyWrite) {
    if (!deps.vectorIndex.getByIds || !deps.embeddingSpace) throw new CortexIngestionProviderError('Vectorize readback is not configured');
    let stored;
    try { stored = await deps.vectorIndex.getByIds(vectorIds); }
    catch { throw new CortexIngestionProviderError('Vectorize readback unavailable'); }
    if (stored.length !== vectors.length || new Set(stored.map(vector=>vector.id)).size !== vectors.length
      || !vectors.every(vector=>stored.some(actual=>actual.id===vector.id
        && (Array.isArray(actual.values) || actual.values instanceof Float32Array || actual.values instanceof Float64Array) && actual.values.length===deps.embeddingSpace!.dimensions
        && actual.values.every(value=>typeof value==='number' && Number.isFinite(value) && Number.isFinite(Math.fround(value)))
        && actual.values.some(value=>Math.fround(value)!==0)
        && actual.values.every((value,index)=>Math.fround(value)===Math.fround(vector.values[index]))
        && ['tenant','kind','source','path','contentDigest','embeddingSpace','embeddingProvider','embeddingModel','embeddingDimensions','embeddingIndex'].every(key=>actual.metadata?.[key]===vector.metadata?.[key])))) {
      // Vectorize is eventually consistent. Preserve the runner hold until the exact
      // stable content/space metadata can be read, without claiming indexing early.
      throw new CortexIngestionProviderError('Vectorize receipt readback pending or mismatched');
    }
  }

  return {
    schema: CORTEX_INGESTION_RECEIPT_SCHEMA,
    inputDigest,
    idempotencyKey: input.idempotencyKey,
    tenant: input.tenant,
    kind: input.kind,
    source: input.source,
    path: input.path,
    chunkCount: chunks.length,
    vectorIds,
    ingestedAt: now,
    status: 'ingested',
    ...(deps.embeddingSpace ? {embeddingSpace:deps.embeddingSpace} : {}),
  };
}
