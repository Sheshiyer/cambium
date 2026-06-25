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
}

export interface RoutineContextSection {
  id: string;
  title: string;
  items: RoutineContextItem[];
}

export interface RoutineContextLike {
  getSnapshot(input: { tenant: string; routine: string }): Promise<{ sections: unknown[]; metadata?: ContextProviderMetadata }>;
}

export interface ContextRouteDeps {
  token?: string;
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
const MAX_QUERY_LENGTH = 500;
const MAX_KIND_LENGTH = 40;
const MAX_ROUTINE_SECTIONS = 8;
const MAX_ROUTINE_ITEMS = 8;
const MAX_TITLE_LENGTH = 160;
const MAX_SUMMARY_LENGTH = 500;
const MAX_SOURCE_KEY_LENGTH = 300;
const MAX_METADATA_LENGTH = 120;

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

function boundedRoutineItem(value: unknown): RoutineContextItem {
  const item = isRecord(value) ? value : {};
  return {
    title: safeString(item.title, MAX_TITLE_LENGTH),
    summary: safeString(item.summary, MAX_SUMMARY_LENGTH),
    sourceKey: safeString(item.sourceKey, MAX_SOURCE_KEY_LENGTH),
  };
}

function boundedRoutineSection(value: unknown): RoutineContextSection {
  const section = isRecord(value) ? value : {};
  const items = Array.isArray(section.items) ? section.items : [];
  return {
    id: safeString(section.id, MAX_TITLE_LENGTH),
    title: safeString(section.title, MAX_TITLE_LENGTH),
    items: items.slice(0, MAX_ROUTINE_ITEMS).map(boundedRoutineItem),
  };
}

function semanticRecallResult(value: SemanticRecallHit[] | SemanticRecallResult): SemanticRecallResult {
  return Array.isArray(value) ? { hits: value } : value;
}

export async function handleContextRoute(req: SimpleRequest, deps: ContextRouteDeps): Promise<SimpleResponse> {
  if (!req.path.startsWith('/v1/context/')) return json(404, { error: `no context route for ${req.method} ${req.path}` });
  if (!deps.token) return json(503, { error: 'context route token not configured' });
  if (!authorized(req, deps.token)) return json(401, { error: 'bad or missing context route credential' });

  const generatedAt = deps.now ? deps.now() : new Date().toISOString();
  const url = new URL(`https://worker.local${req.path}`);

  if (req.method === 'GET' && url.pathname === '/v1/context/health') {
    return json(200, {
      ok: true,
      schema: 'thoughtseed.context-health.v1',
      generatedAt,
      capabilities: {
        routineSnapshot: Boolean(deps.routineContext),
        semanticRecall: Boolean(deps.semanticRecall),
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
