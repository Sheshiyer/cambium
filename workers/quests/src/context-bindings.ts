import type {
  ContextProviderMetadata,
  RoutineContextLike,
  RoutineContextSection,
  SemanticRecallHit,
  SemanticRecallLike,
  SemanticRecallResult,
} from './context-routes.ts';

export interface R2ObjectLike {
  key?: string;
  text(): Promise<string>;
}

export interface R2BucketLike {
  get(key: string): Promise<R2ObjectLike | null>;
}

export type VectorizeMetadataValue = string | number | boolean | null | Record<string, unknown> | unknown[];

export interface VectorizeMatchLike {
  id: string;
  score: number;
  metadata?: Record<string, VectorizeMetadataValue>;
  values?: unknown;
  vector?: unknown;
}

export interface VectorizeQueryResultLike {
  matches?: VectorizeMatchLike[];
}

export interface VectorizeIndexLike {
  query(vector: number[] | Float32Array | Float64Array, options: {
    topK: number;
    returnMetadata: 'all' | 'indexed' | boolean;
    returnValues?: boolean;
    filter: Record<string, unknown>;
  }): Promise<VectorizeQueryResultLike>;
}

export interface RoutineSlice {
  id: string;
  title: string;
  keys?: string[];
  reason?: string;
}

export type RoutineContextAllowlist = Record<string, RoutineSlice[]>;

export interface CreateRoutineContextArgs {
  bucket?: R2BucketLike;
  allowlist?: RoutineContextAllowlist;
  metadata?: ContextProviderMetadata;
}

export type EmbedQuery = (text: string) => Promise<number[]>;

export interface CreateSemanticRecallArgs {
  embed: EmbedQuery;
  vectorIndex: VectorizeIndexLike;
  metadata?: ContextProviderMetadata;
}

export interface EmbeddingProviderConfigLike {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

export interface CreateProviderEmbedderArgs {
  provider?: EmbeddingProviderConfigLike;
  model?: string;
  fetchImpl?: typeof fetch;
}

const MAX_ROUTINE_ITEMS_PER_SECTION = 8;
const MAX_SUMMARY_LENGTH = 500;
const MAX_TITLE_LENGTH = 160;
const MAX_KEY_LENGTH = 512;
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._/@:=+-]{0,511}$/;

const DEFAULT_NO_SIGNAL_REASON = 'R2 routine object keys are not verified for this candidate slice yet.';

export const DEFAULT_ROUTINE_CONTEXT_SLICES: RoutineContextAllowlist = {
  'daily-standup-digest': [
    {
      id: 'heartbeats',
      title: 'Heartbeat candidates',
      reason: DEFAULT_NO_SIGNAL_REASON,
    },
    {
      id: 'standups',
      title: 'Standup candidates',
      reason: DEFAULT_NO_SIGNAL_REASON,
    },
  ],
  'weekly-client-report': [
    {
      id: 'client-contracts',
      title: 'Client contract candidates',
      reason: DEFAULT_NO_SIGNAL_REASON,
    },
  ],
};

function safeString(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\b(secret|token|api[_-]?key)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function summarizeMarkdown(text: string): string {
  const withoutFrontmatter = text.replace(/^---\s*[\s\S]*?\s*---\s*/, '');
  const cleaned = withoutFrontmatter
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[\s>*-]+/gm, '')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\|/g, ' ');
  const summary = safeString(cleaned, MAX_SUMMARY_LENGTH);
  return summary || 'No readable markdown summary.';
}

export function isSafeRoutineObjectKey(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  if (!key || key.length > MAX_KEY_LENGTH) return false;
  if (key.startsWith('/') || key.endsWith('/')) return false;
  if (key.includes('..') || key.includes('//') || key.includes('\\')) return false;
  if (/[*?#\s]/.test(key)) return false;
  return SAFE_KEY.test(key);
}

function firstMarkdownTitle(markdown: string, key: string): string {
  const heading = markdown.match(/^#{1,6}\s+(.+)$/m)?.[1];
  if (heading) return safeString(heading, MAX_TITLE_LENGTH);
  const filename = key.split('/').pop() || key;
  return safeString(filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), MAX_TITLE_LENGTH);
}

function noSignalItem(slice: RoutineSlice, reason?: string) {
  return {
    title: `No verified ${safeString(slice.title || slice.id, MAX_TITLE_LENGTH)} signal`,
    summary: `Blocked/no-signal: ${safeString(reason ?? slice.reason ?? DEFAULT_NO_SIGNAL_REASON, MAX_SUMMARY_LENGTH)}`,
  };
}

function sanitizeSlice(value: unknown): RoutineSlice | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = safeString(record.id, MAX_TITLE_LENGTH);
  const title = safeString(record.title ?? id, MAX_TITLE_LENGTH);
  if (!id || !title) return null;
  const rawKeys = Array.isArray(record.keys) ? record.keys : [];
  const keys = rawKeys.filter(isSafeRoutineObjectKey);
  return {
    id,
    title,
    ...(keys.length ? { keys } : {}),
    ...(typeof record.reason === 'string' ? { reason: safeString(record.reason, MAX_SUMMARY_LENGTH) } : {}),
  };
}

export function parseRoutineAllowlistJson(raw: string | null | undefined): RoutineContextAllowlist | undefined {
  if (!raw?.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  const allowlist: RoutineContextAllowlist = {};
  for (const [routine, slices] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^[a-z0-9][a-z0-9_-]{1,119}$/.test(routine)) continue;
    if (!Array.isArray(slices)) continue;
    const safeSlices = slices.map(sanitizeSlice).filter((slice): slice is RoutineSlice => Boolean(slice));
    if (safeSlices.length) allowlist[routine] = safeSlices;
  }
  return Object.keys(allowlist).length ? allowlist : undefined;
}

export function createRoutineContext({
  bucket,
  allowlist = DEFAULT_ROUTINE_CONTEXT_SLICES,
  metadata,
}: CreateRoutineContextArgs): RoutineContextLike {
  const providerMetadata: ContextProviderMetadata = {
    provider: 'cloudflare-r2',
    source: 'r2-binding',
    bucket: 'thoughtseed-vault',
    plane: 'cloudflare-source-plane',
    mode: 'allowlisted-exact-keys',
    ...metadata,
  };

  return {
    async getSnapshot({ routine }) {
      const slices = allowlist[routine] ?? [];
      const sections: RoutineContextSection[] = [];

      for (const slice of slices) {
        const safeKeys = [...new Set(slice.keys ?? [])].filter(isSafeRoutineObjectKey);
        if (!safeKeys.length || !bucket) {
          sections.push({
            id: safeString(slice.id, MAX_TITLE_LENGTH),
            title: safeString(slice.title, MAX_TITLE_LENGTH),
            items: [noSignalItem(slice, bucket ? undefined : 'R2 bucket binding is unavailable.')],
          });
          continue;
        }

        const items = [];
        for (const key of safeKeys.slice(0, MAX_ROUTINE_ITEMS_PER_SECTION)) {
          const object = await bucket.get(key);
          if (!object) continue;
          const markdown = await object.text();
          items.push({
            title: firstMarkdownTitle(markdown, key),
            summary: summarizeMarkdown(markdown),
            sourceKey: key,
          });
        }

        sections.push({
          id: safeString(slice.id, MAX_TITLE_LENGTH),
          title: safeString(slice.title, MAX_TITLE_LENGTH),
          items: items.length ? items : [noSignalItem(slice, 'No allowlisted R2 objects produced a readable signal.')],
        });
      }

      return { sections, metadata: providerMetadata };
    },
  };
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberFromMetadata(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }
  return undefined;
}

function payloadFromMetadata(metadata: Record<string, unknown>): Record<string, unknown> | undefined {
  const parsedPayload = parseRecord(metadata.payload ?? metadata.payload_json ?? metadata.payloadJson);
  const title = safeString(parsedPayload.title ?? metadata.title, MAX_TITLE_LENGTH);
  const summary = safeString(parsedPayload.summary ?? metadata.summary ?? parsedPayload.detail ?? metadata.detail, MAX_SUMMARY_LENGTH);
  const detail = safeString(parsedPayload.detail ?? metadata.detail, MAX_SUMMARY_LENGTH);
  const payload: Record<string, unknown> = {};
  if (title) payload.title = title;
  if (summary) payload.summary = summary;
  if (detail && detail !== summary) payload.detail = detail;
  return Object.keys(payload).length ? payload : undefined;
}

export function createSemanticRecall({
  embed,
  vectorIndex,
  metadata,
}: CreateSemanticRecallArgs): SemanticRecallLike {
  const providerMetadata: ContextProviderMetadata = {
    provider: 'cloudflare-vectorize',
    source: 'cambium-cortex',
    index: 'cambium-cortex',
    plane: 'cloudflare-source-plane',
    payloadType: 'summary',
    ...metadata,
  };

  return {
    async recall(input): Promise<SemanticRecallResult> {
      if (!input.kind) return { hits: [], metadata: providerMetadata };
      try {
        const vector = await embed(input.query);
        const filter: Record<string, unknown> = { tenant: input.tenant };
        filter.kind = input.kind;
        const result = await vectorIndex.query(vector, {
          topK: input.topK,
          returnMetadata: 'all',
          returnValues: false,
          filter,
        });
        const hits: SemanticRecallHit[] = (result.matches ?? []).slice(0, input.topK).map((match) => {
          const matchMetadata = parseRecord(match.metadata);
          const kind = safeString(matchMetadata.kind ?? input.kind ?? 'memory', 40) || 'memory';
          return {
            id: safeString(match.id, MAX_KEY_LENGTH),
            kind,
            score: Number.isFinite(match.score) ? match.score : 0,
            ts: numberFromMetadata(matchMetadata.ts ?? matchMetadata.timestamp ?? matchMetadata.createdAt),
            payload: payloadFromMetadata(matchMetadata),
          };
        });
        return { hits, metadata: providerMetadata };
      } catch {
        return {
          hits: [],
          metadata: {
            ...providerMetadata,
            mode: 'provider-error',
          },
        };
      }
    },
  };
}

export function createProviderEmbedder({
  provider,
  model,
  fetchImpl,
}: CreateProviderEmbedderArgs): EmbedQuery | undefined {
  const selectedModel = model || provider?.defaultModel;
  if (!provider?.apiKey || !provider.baseUrl || !selectedModel) return undefined;
  const baseUrl = provider.baseUrl.replace(/\/+$/, '');
  const f = fetchImpl ?? fetch;
  return async (text: string): Promise<number[]> => {
    const response = await f(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${provider.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        input: [text],
        input_type: 'query',
        encoding_format: 'float',
      }),
    });
    if (!response.ok) throw new Error(`embedding provider returned ${response.status}`);
    const body = await response.json() as { data?: Array<{ embedding?: unknown }> };
    const embedding = body.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || !embedding.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      throw new Error('embedding provider returned no numeric embedding');
    }
    return embedding;
  };
}
