import {
  CONTEXT_PROJECTION_RECEIPT_SCHEMA,
  ContextProjectionGenerationError,
  ContextProjectionStorageError,
  ContextProjectionValidationError,
  type ContextProjectionStoreLike,
} from './context-projections.ts';
import {
  CORTEX_INGESTION_RECEIPT_SCHEMA,
  CortexIngestionProviderError,
  CortexIngestionValidationError,
  ingestCortexContent,
  type CortexIngestionDeps,
} from './cortex-ingestion.ts';

export interface SimpleRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
}

export interface SimpleResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface SemanticRecallHit {
  id: string;
  kind: string;
  score: number;
  ts?: number;
  payload?: Record<string, unknown>;
}

export interface ContextProviderMetadata {
  provider?: unknown;
  source?: unknown;
  index?: unknown;
  plane?: unknown;
  bucket?: unknown;
  mode?: unknown;
  payloadType?: unknown;
}

export interface SemanticRecallResult {
  hits: SemanticRecallHit[];
  metadata?: ContextProviderMetadata;
}

export interface SemanticRecallLike {
  recall(input: { tenant: string; query: string; kind?: string; topK: number }): Promise<SemanticRecallHit[] | SemanticRecallResult>;
}

export interface RoutineContextItem {
  title: string;
  summary: string;
  sourceKey?: string;
  signalState?: 'current' | 'stale' | 'freshness-unknown' | 'missing' | 'blocked-no-signal';
  observedAt?: string;
  ageSeconds?: number;
}

export interface RoutineContextSection {
  id: string;
  title: string;
  items: RoutineContextItem[];
  signalState?: 'current' | 'stale' | 'freshness-unknown' | 'no-signal' | 'blocked-no-signal' | 'mixed';
  exactKeyCount?: number;
  resolvedKeyCount?: number;
  staleKeyCount?: number;
  missingKeyCount?: number;
  staleAfterSeconds?: number;
}

export interface RoutineContextLike {
  getSnapshot(input: { tenant: string; routine: string }): Promise<{ sections: unknown[]; metadata?: ContextProviderMetadata }>;
}

export interface ContextRouteDeps {
  token?: string;
  projectionWriteToken?: string;
  projectionStore?: ContextProjectionStoreLike;
  cortexIngestionToken?: string;
  cortexIngestionDeps?: CortexIngestionDeps;
  semanticRecall?: SemanticRecallLike;
  routineContext?: RoutineContextLike;
  allowedTenants?: string[];
  authorizeTenant?: (tenant: string, route: 'semantic-recall' | 'routine-snapshot') => boolean | Promise<boolean>;
  now?: () => string;
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const VALID_TENANT = /^[a-z0-9][a-z0-9_-]{1,79}$/;
const VALID_ROUTINE = /^[a-z0-9][a-z0-9_-]{1,119}$/;
const VALID_SEMANTIC_KINDS = new Set(['decision', 'evidence', 'handoff', 'heartbeat', 'memory', 'note', 'routine', 'standup', 'task']);
const MAX_BODY_LENGTH = 4096;
const MAX_PROJECTION_BODY_BYTES = 40 * 1024;
const MAX_QUERY_LENGTH = 500;
const MAX_KIND_LENGTH = 40;
const MAX_ROUTINE_SECTIONS = 8;
const MAX_ROUTINE_ITEMS = 8;
const MAX_TITLE_LENGTH = 160;
const MAX_SUMMARY_LENGTH = 500;
const MAX_SOURCE_KEY_LENGTH = 300;
const MAX_METADATA_LENGTH = 120;
const MAX_STALE_AFTER_SECONDS = 90 * 24 * 60 * 60;
const ROUTINE_ITEM_STATES = new Set(['current', 'stale', 'freshness-unknown', 'missing', 'blocked-no-signal']);
const ROUTINE_SECTION_STATES = new Set(['current', 'stale', 'freshness-unknown', 'no-signal', 'blocked-no-signal', 'mixed']);

function json(status: number, value: unknown): SimpleResponse {
  return { status, headers: { ...JSON_HEADERS }, body: JSON.stringify(value) };
}

function authorized(req: SimpleRequest, token?: string): boolean {
  return Boolean(token) && req.headers.authorization === `Bearer ${token}`;
}

async function tenantAuthorized(deps: ContextRouteDeps, tenant: string, route: 'semantic-recall' | 'routine-snapshot'): Promise<boolean> {
  if (deps.authorizeTenant) return Boolean(await deps.authorizeTenant(tenant, route));
  return Boolean(deps.allowedTenants?.includes(tenant));
}

function redactObviousSecrets(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\b(secret|token|api[_-]?key)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[redacted]');
}

function safeString(value: unknown, maxLength: number): string {
  return redactObviousSecrets(String(value ?? '')).slice(0, maxLength);
}

function safeSummary(payload: Record<string, unknown> | undefined): string {
  const raw = payload?.summary ?? payload?.title ?? payload?.detail ?? '';
  return safeString(raw, MAX_SUMMARY_LENGTH);
}

function safeMetadataValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const safe = safeString(value, MAX_METADATA_LENGTH);
  return safe ? safe : undefined;
}

function safeProviderMetadata(metadata: ContextProviderMetadata | undefined, fallbackProvider: string): Record<string, string> {
  const provider = safeMetadataValue(metadata?.provider ?? metadata?.source) ?? fallbackProvider;
  const source = safeMetadataValue(metadata?.source);
  const index = safeMetadataValue(metadata?.index);
  const plane = safeMetadataValue(metadata?.plane);
  const bucket = safeMetadataValue(metadata?.bucket);
  const mode = safeMetadataValue(metadata?.mode);
  return {
    provider,
    ...(source ? { source } : {}),
    ...(index ? { index } : {}),
    ...(plane ? { plane } : {}),
    ...(bucket ? { bucket } : {}),
    ...(mode ? { mode } : {}),
  };
}

function semanticProviderLabel(metadata: Record<string, string>): string {
  return metadata.source ?? metadata.index ?? metadata.provider ?? 'semantic-provider';
}

function semanticPayloadType(metadata: ContextProviderMetadata | undefined): string {
  return safeMetadataValue(metadata?.payloadType) ?? 'summary';
}

function boundedHit(hit: SemanticRecallHit, providerSource: string, payloadType: string): Record<string, unknown> {
  return {
    id: String(hit.id),
    kind: String(hit.kind),
    score: Number(hit.score),
    ts: hit.ts ?? null,
    summary: safeSummary(hit.payload),
    provenance: { source: providerSource, payloadType },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeEnum(value: unknown, allowed: Set<string>): string | undefined {
  return typeof value === 'string' && allowed.has(value) ? value : undefined;
}

function safeInteger(value: unknown, max: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max
    ? value
    : undefined;
}

function safeIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function boundedRoutineItem(value: unknown): RoutineContextItem {
  const item = isRecord(value) ? value : {};
  const sourceKey = safeString(item.sourceKey, MAX_SOURCE_KEY_LENGTH);
  const signalState = safeEnum(item.signalState, ROUTINE_ITEM_STATES) as RoutineContextItem['signalState'];
  const observedAt = safeIsoTimestamp(item.observedAt);
  const ageSeconds = safeInteger(item.ageSeconds, Number.MAX_SAFE_INTEGER);
  return {
    title: safeString(item.title, MAX_TITLE_LENGTH),
    summary: safeString(item.summary, MAX_SUMMARY_LENGTH),
    ...(sourceKey ? { sourceKey } : {}),
    ...(signalState ? { signalState } : {}),
    ...(observedAt ? { observedAt } : {}),
    ...(ageSeconds !== undefined ? { ageSeconds } : {}),
  };
}

function boundedRoutineSection(value: unknown): RoutineContextSection {
  const section = isRecord(value) ? value : {};
  const items = Array.isArray(section.items) ? section.items : [];
  const signalState = safeEnum(section.signalState, ROUTINE_SECTION_STATES) as RoutineContextSection['signalState'];
  const exactKeyCount = safeInteger(section.exactKeyCount, MAX_ROUTINE_ITEMS);
  const resolvedKeyCount = safeInteger(section.resolvedKeyCount, MAX_ROUTINE_ITEMS);
  const staleKeyCount = safeInteger(section.staleKeyCount, MAX_ROUTINE_ITEMS);
  const missingKeyCount = safeInteger(section.missingKeyCount, MAX_ROUTINE_ITEMS);
  const staleAfterSeconds = safeInteger(section.staleAfterSeconds, MAX_STALE_AFTER_SECONDS);
  return {
    id: safeString(section.id, MAX_TITLE_LENGTH),
    title: safeString(section.title, MAX_TITLE_LENGTH),
    items: items.slice(0, MAX_ROUTINE_ITEMS).map(boundedRoutineItem),
    ...(signalState ? { signalState } : {}),
    ...(exactKeyCount !== undefined ? { exactKeyCount } : {}),
    ...(resolvedKeyCount !== undefined ? { resolvedKeyCount } : {}),
    ...(staleKeyCount !== undefined ? { staleKeyCount } : {}),
    ...(missingKeyCount !== undefined ? { missingKeyCount } : {}),
    ...(staleAfterSeconds !== undefined ? { staleAfterSeconds } : {}),
  };
}

function semanticRecallResult(value: SemanticRecallHit[] | SemanticRecallResult): SemanticRecallResult {
  return Array.isArray(value) ? { hits: value } : value;
}

export async function handleContextRoute(req: SimpleRequest, deps: ContextRouteDeps): Promise<SimpleResponse> {
  if (!req.path.startsWith('/v1/context/')) return json(404, { error: `no context route for ${req.method} ${req.path}` });
  const url = new URL(`https://worker.local${req.path}`);

  if (req.method === 'POST' && url.pathname === '/v1/context/projections') {
    if (!deps.projectionWriteToken) {
      return json(503, { error: 'context projection write token not configured' });
    }
    if (!authorized(req, deps.projectionWriteToken)) {
      return json(401, { error: 'bad or missing context projection write credential' });
    }
    if (!deps.projectionStore) {
      return json(503, { error: 'context projection store not configured' });
    }
    const rawBody = req.body ?? '';
    if (new TextEncoder().encode(rawBody).byteLength > MAX_PROJECTION_BODY_BYTES) {
      return json(400, { error: 'projection body is too large' });
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json(400, { error: 'projection body is not JSON' });
    }
    try {
      const receipt = await deps.projectionStore.put(body);
      return json(201, {
        schema: CONTEXT_PROJECTION_RECEIPT_SCHEMA,
        key: receipt.key,
        generation: receipt.generation,
        contentDigest: receipt.contentDigest,
        producedAt: receipt.producedAt,
        expiresAt: receipt.expiresAt,
      });
    } catch (error) {
      if (error instanceof ContextProjectionValidationError) {
        return json(400, { error: error.message });
      }
      if (error instanceof ContextProjectionGenerationError) {
        return json(409, { error: error.message });
      }
      if (error instanceof ContextProjectionStorageError) {
        return json(503, { error: error.message });
      }
      return json(503, { error: 'context projection write failed' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/v1/context/cortex-ingest') {
    if (!deps.cortexIngestionToken) {
      return json(503, { error: 'cortex ingestion token not configured' });
    }
    if (!authorized(req, deps.cortexIngestionToken)) {
      return json(401, { error: 'bad or missing cortex ingestion credential' });
    }
    if (!deps.cortexIngestionDeps?.embed || !deps.cortexIngestionDeps?.vectorIndex) {
      return json(503, { error: 'cortex ingestion dependencies not configured' });
    }
    const rawBody = req.body ?? '';
    if (new TextEncoder().encode(rawBody).byteLength > MAX_PROJECTION_BODY_BYTES) {
      return json(400, { error: 'ingestion body is too large' });
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json(400, { error: 'ingestion body is not JSON' });
    }
    try {
      const receipt = await ingestCortexContent(body, deps.cortexIngestionDeps);
      return json(receipt.status === 'empty' ? 200 : 201, {
        schema: CORTEX_INGESTION_RECEIPT_SCHEMA,
        inputDigest: receipt.inputDigest,
        idempotencyKey: receipt.idempotencyKey,
        tenant: receipt.tenant,
        kind: receipt.kind,
        source: receipt.source,
        path: receipt.path,
        chunkCount: receipt.chunkCount,
        vectorIds: receipt.vectorIds,
        ingestedAt: receipt.ingestedAt,
        status: receipt.status,
      });
    } catch (error) {
      if (error instanceof CortexIngestionValidationError) {
        return json(400, { error: error.message });
      }
      if (error instanceof CortexIngestionProviderError) {
        return json(502, { error: error.message });
      }
      return json(503, { error: 'cortex ingestion failed' });
    }
  }

  if (!deps.token) return json(503, { error: 'context route token not configured' });
  if (!authorized(req, deps.token)) return json(401, { error: 'bad or missing context route credential' });

  const generatedAt = deps.now ? deps.now() : new Date().toISOString();

  if (req.method === 'GET' && url.pathname === '/v1/context/health') {
    return json(200, {
      ok: true,
      schema: 'thoughtseed.context-health.v1',
      generatedAt,
      capabilities: {
        routineSnapshot: Boolean(deps.routineContext),
        semanticRecall: Boolean(deps.semanticRecall),
        projectionWrite: Boolean(deps.projectionWriteToken && deps.projectionStore),
        cortexIngestion: Boolean(deps.cortexIngestionToken && deps.cortexIngestionDeps?.embed && deps.cortexIngestionDeps?.vectorIndex),
      },
    });
  }

  if (req.method === 'POST' && url.pathname === '/v1/context/semantic-recall') {
    if (!deps.semanticRecall) return json(503, { error: 'semantic recall not configured' });
    if ((req.body ?? '').length > MAX_BODY_LENGTH) return json(400, { error: 'body is too large' });
    let body: Record<string, unknown>;
    try { body = JSON.parse(req.body ?? '{}'); } catch { return json(400, { error: 'body is not JSON' }); }
    const tenant = typeof body.tenant === 'string' ? body.tenant : '';
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (body.kind !== undefined && typeof body.kind !== 'string') return json(400, { error: 'kind must be a string' });
    const rawKind = typeof body.kind === 'string' ? body.kind.trim() : '';
    const kind = rawKind || undefined;
    const topK = Math.min(Math.max(Number(body.topK ?? 5) || 5, 1), 8);
    if (!VALID_TENANT.test(tenant)) return json(400, { error: 'tenant is required' });
    if (!query) return json(400, { error: 'query is required' });
    if (query.length > MAX_QUERY_LENGTH) return json(400, { error: 'query is too long' });
    if (kind && kind.length > MAX_KIND_LENGTH) return json(400, { error: 'kind is too long' });
    if (kind && !VALID_SEMANTIC_KINDS.has(kind)) return json(400, { error: 'kind is not allowed' });
    if (!(await tenantAuthorized(deps, tenant, 'semantic-recall'))) return json(403, { error: 'tenant is not authorized' });

    const result = semanticRecallResult(await deps.semanticRecall.recall({ tenant, query, kind, topK }));
    const metadata = safeProviderMetadata(result.metadata, 'semantic-provider');
    const providerSource = semanticProviderLabel(metadata);
    const payloadType = semanticPayloadType(result.metadata);
    return json(200, {
      ok: true,
      schema: 'thoughtseed.semantic-recall.v1',
      tenant,
      provider: metadata.provider,
      ...(metadata.index ? { index: metadata.index } : {}),
      ...(metadata.mode ? { mode: metadata.mode } : {}),
      query: { kind: kind ?? null, topK },
      hits: result.hits.slice(0, topK).map((hit) => boundedHit(hit, providerSource, payloadType)),
      omitted: { rawVectors: true, rawPayload: true },
    });
  }

  if (req.method === 'GET' && url.pathname === '/v1/context/routine-snapshot') {
    if (!deps.routineContext) return json(503, { error: 'routine context not configured' });
    const tenant = url.searchParams.get('tenant') ?? '';
    const routine = url.searchParams.get('routine') ?? '';
    if (!VALID_TENANT.test(tenant)) return json(400, { error: 'tenant is required' });
    if (!VALID_ROUTINE.test(routine)) return json(400, { error: 'routine is required' });
    if (!(await tenantAuthorized(deps, tenant, 'routine-snapshot'))) return json(403, { error: 'tenant is not authorized' });

    const snapshot = await deps.routineContext.getSnapshot({ tenant, routine });
    const sections = Array.isArray(snapshot.sections) ? snapshot.sections : [];
    const source = safeProviderMetadata(snapshot.metadata, 'routine-context-provider');
    return json(200, {
      ok: true,
      schema: 'thoughtseed.routine-context.v1',
      tenant,
      routine,
      generatedAt,
      source,
      sections: sections.slice(0, MAX_ROUTINE_SECTIONS).map(boundedRoutineSection),
      omitted: { rawObjects: true, fullVault: true },
    });
  }

  return json(404, { error: `no context route for ${req.method} ${url.pathname}` });
}
