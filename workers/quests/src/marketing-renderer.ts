// One fixed-tenant, review-only marketing renderer. The caller supplies bounded
// public-business facts; every provider routing field is owned by this module.

export const MARKETING_CREATE_TENANT_ID = 'thoughtseed' as const;
export const MARKETING_CREATE_ADAPTER_ID = 'founder-article-nvidia@1.0.0' as const;
export const MARKETING_CREATE_CATALOG_DIGEST = 'ae1d60e951f6d6c18041581ddb018b53b162ebfb49bf9370f3185c38e03fc12f' as const;
export const MARKETING_CREATE_EXPECTED_ACTIVATION = `${MARKETING_CREATE_ADAPTER_ID}:${MARKETING_CREATE_CATALOG_DIGEST}` as const;
export const MARKETING_CREATE_RECIPE_ID = 'founder-article-draft@1.0.0' as const;
export const MARKETING_CREATE_PROVIDER_ID = 'nvidia' as const;
export const MARKETING_CREATE_PROVIDER_URL = 'https://integrate.api.nvidia.com/v1/chat/completions' as const;
export const MARKETING_CREATE_MODEL = 'meta/llama-3.1-70b-instruct' as const;
export const MARKETING_CREATE_SECRET_BINDING = 'NVIDIA_MARKETING_CREATE_API_KEY' as const;
export const MARKETING_PROMPT_TEMPLATE_ID = 'thoughtseed-founder-article@1.0.0' as const;
export const MARKETING_PROMPT_TEMPLATE_DIGEST = 'd1d1db81ae9b1eaeb9ba3f799a9a7fdeb61e87bc2805fdab4b29761274963a80' as const;

export const MARKETING_PROMPT_TEMPLATE = "You are Thoughtseed's fixed founder-article drafting renderer. Use only the supplied verified public-business facts. Do not invent claims, testimonials, rankings, metrics, or legal promises. Return exactly one JSON object with keys title and body. The body must be review-only plain Markdown, include no publishing or sending instructions, and stay under 9,000 characters." as const;

export const MARKETING_CREATE_GENERATION = Object.freeze({
  stream: false,
  temperature: 0.2,
  maxTokens: 1800,
});

export const MARKETING_CREATE_TIMEOUT_MS = 30_000;
export const MARKETING_CREATE_MAX_RESPONSE_BYTES = 65_536;
const MARKETING_CREATE_LEASE_MS = 60_000;
const MAX_PREPARE_TTL_MS = 24 * 60 * 60 * 1000;

const DIGEST_RE = /^[a-f0-9]{64}$/;
const OPAQUE_ID_RE = /^[a-z0-9][a-z0-9._:@-]{2,127}$/;
const PREPARE_ID_RE = /^[a-z0-9][a-z0-9._:-]{2,127}$/;
const IDEMPOTENCY_KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/;
const PRODUCT_PACKET_ID_RE = /^[a-z0-9][a-z0-9._:@-]{2,127}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const TEXT_ENCODER = new TextEncoder();

export interface MarketingBriefFact {
  claimId: string;
  text: string;
  sourceDigest: string;
}

export interface MarketingPrepareInput {
  requestId: string;
  idempotencyKey: string;
  actorId: string;
  budgetReservationId: string;
  expiresAt: string;
  brief: {
    briefId: string;
    objective: string;
    audience: string;
    callToAction: string;
    productPacketId: string;
    productPacketDigest: string;
    evidenceSnapshotDigest: string;
    seedDigest: string;
    facts: MarketingBriefFact[];
  };
}

export interface MarketingRenderAction {
  schema: 'thoughtseed.marketing-render-action.v1';
  tenantId: typeof MARKETING_CREATE_TENANT_ID;
  requestId: string;
  adapterId: typeof MARKETING_CREATE_ADAPTER_ID;
  adapterCatalogDigest: string;
  recipeId: typeof MARKETING_CREATE_RECIPE_ID;
  providerId: typeof MARKETING_CREATE_PROVIDER_ID;
  providerUrl: typeof MARKETING_CREATE_PROVIDER_URL;
  model: typeof MARKETING_CREATE_MODEL;
  generation: typeof MARKETING_CREATE_GENERATION;
  promptTemplateId: typeof MARKETING_PROMPT_TEMPLATE_ID;
  promptTemplateDigest: typeof MARKETING_PROMPT_TEMPLATE_DIGEST;
  inputDigest: string;
  evidenceSnapshotDigest: string;
  productPacketDigest: string;
  budgetReservationId: string;
  actorId: string;
  idempotencyKey: string;
  expiresAt: string;
  credentialDescriptor: {
    kind: 'cloudflare_worker_secret';
    binding: typeof MARKETING_CREATE_SECRET_BINDING;
  };
}

export interface MarketingPreparedRender {
  schema: 'thoughtseed.marketing-render-prepared.v1';
  requestId: string;
  tenantId: typeof MARKETING_CREATE_TENANT_ID;
  adapterId: typeof MARKETING_CREATE_ADAPTER_ID;
  adapterCatalogDigest: string;
  idempotencyKey: string;
  actorId: string;
  budgetReservationId: string;
  expiresAt: string;
  input: MarketingPrepareInput;
  inputDigest: string;
  action: MarketingRenderAction;
  actionDigest: string;
  requestDigest: string;
  status: 'prepared';
  preparedAt: string;
}

export interface MarketingApprovalDecision {
  schema_version: 'approval_decision@1.0.0';
  tenant: {
    tenant_id: typeof MARKETING_CREATE_TENANT_ID;
    purpose: 'marketing_create_render';
    data_classification: 'public_business';
    processing_region: 'global';
    retention_days: 30;
  };
  record_id: string;
  action_request_id: string;
  action_digest: string;
  approver_id: string;
  scope: 'exact_action';
  decision: 'approved' | 'rejected';
  decided_at: string;
  expires_at: string;
}

export interface MarketingAssetDraft {
  schema_version: 'asset_draft@1.0.0';
  tenant: MarketingApprovalDecision['tenant'];
  record_id: string;
  brief_id: string;
  recipe_id: typeof MARKETING_CREATE_RECIPE_ID;
  title: string;
  body: string;
  claim_ids: string[];
  evidence_snapshot_digest: string;
  rights_state: 'review_required';
  status: 'draft';
  created_at: string;
  content_digest: string;
}

export interface MarketingOperatorReceipt {
  schema_version: 'operator_receipt@1.0.0';
  tenant: MarketingApprovalDecision['tenant'];
  record_id: string;
  task_id: string;
  state: 'awaiting_human_approval';
  artifact_count: 1;
  next_action: 'review';
  replayed: boolean;
  redaction_applied: true;
  updated_at: string;
}

export interface MarketingRenderClaimInput {
  requestId: string;
  requestDigest: string;
  actionDigest: string;
  approvalDecisionId: string;
  claimId: string;
  claimedAt: string;
  leaseExpiresAt: string;
}

export type MarketingRenderClaimResult =
  | { status: 'claimed'; requestId: string; claimId: string; fencingToken: number; leaseExpiresAt: string }
  | { status: 'busy'; retryAfterMs: number }
  | { status: 'terminal'; outcome: 'succeeded'; artifact: MarketingAssetDraft; receipt: MarketingOperatorReceipt }
  | { status: 'terminal'; outcome: 'failed'; code: string }
  | { status: 'reconciliation_required'; state: 'invoking' | 'indeterminate' }
  | { status: 'conflict'; code: string };

export interface MarketingRenderStoreLike {
  prepare(record: MarketingPreparedRender): Promise<
    | { status: 'prepared'; record: MarketingPreparedRender }
    | { status: 'duplicate'; record: MarketingPreparedRender }
    | { status: 'conflict' }
  >;
  getPrepared(requestId: string): Promise<MarketingPreparedRender | null>;
  approvePrepared(input: {
    requestId: string;
    founderId: string;
    decidedAt: string;
    approvalDecisionId: string;
  }): Promise<
    | { status: 'approved'; approval: MarketingApprovalDecision }
    | { status: 'duplicate'; approval: MarketingApprovalDecision }
    | { status: 'not_found' | 'conflict' }
  >;
  getApproval(approvalDecisionId: string): Promise<MarketingApprovalDecision | null>;
  claim(input: MarketingRenderClaimInput): Promise<MarketingRenderClaimResult>;
  beginInvocation(input: {
    requestId: string;
    claimId: string;
    fencingToken: number;
    observedAt: string;
  }): Promise<'confirmed' | 'reconciliation_required'>;
  complete(input: {
    requestId: string;
    claimId: string;
    fencingToken: number;
    artifact: MarketingAssetDraft;
    receipt: MarketingOperatorReceipt;
    artifactDigest: string;
    providerUsageTokens: number | null;
    recordedAt: string;
  }): Promise<'recorded' | 'reconciliation_required'>;
  fail(input: {
    requestId: string;
    claimId: string;
    fencingToken: number;
    errorCode: string;
    recordedAt: string;
  }): Promise<'recorded' | 'reconciliation_required'>;
  markIndeterminate(input: {
    requestId: string;
    claimId: string;
    fencingToken: number;
    errorCode: string;
    recordedAt: string;
  }): Promise<'recorded' | 'reconciliation_required'>;
}

export type MarketingRenderExecutionResult =
  | {
    status: 'succeeded';
    replayed: boolean;
    adapterId: typeof MARKETING_CREATE_ADAPTER_ID;
    artifactDigest: string;
    publishEligible: false;
    externalAction: 'none';
    artifact: MarketingAssetDraft;
    receipt: MarketingOperatorReceipt;
  }
  | { status: 'busy'; retryAfterMs: number }
  | { status: 'failed'; code: string }
  | { status: 'conflict'; code: string }
  | { status: 'reconciliation_required'; code: string };

export interface MarketingRendererExecutionDeps {
  store: MarketingRenderStoreLike;
  activation?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  now?: () => string;
  uuid?: () => string;
}

export class MarketingRendererError extends Error {
  code: string;

  constructor(code: string, message = code) {
    super(message);
    this.name = 'MarketingRendererError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function ownKeysExactly(value: Record<string, unknown>, allowed: readonly string[]): string | null {
  const allowedSet = new Set(allowed);
  return Object.keys(value).find((key) => !allowedSet.has(key)) ?? null;
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

function opaqueId(value: unknown): string | null {
  const text = boundedText(value, 128);
  return text && OPAQUE_ID_RE.test(text) ? text : null;
}

function prepareId(value: unknown): string | null {
  const text = boundedText(value, 128);
  return text && PREPARE_ID_RE.test(text) ? text : null;
}

function idempotencyKey(value: unknown): string | null {
  return typeof value === 'string' && IDEMPOTENCY_KEY_RE.test(value) ? value : null;
}

function productPacketId(value: unknown): string | null {
  const text = boundedText(value, 128);
  return text && PRODUCT_PACKET_ID_RE.test(text) ? text : null;
}

function digest(value: unknown): string | null {
  return typeof value === 'string' && DIGEST_RE.test(value) ? value : null;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !ISO_RE.test(value) || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

export function canonicalMarketingJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalMarketingJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalMarketingJson(record[key])}`).join(',')}}`;
}

export async function sha256MarketingHex(value: string): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', TEXT_ENCODER.encode(value) as unknown as BufferSource);
  return [...new Uint8Array(result)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function parseMarketingPrepareInput(raw: unknown):
  | { ok: true; value: MarketingPrepareInput }
  | { ok: false; code: 'invalid_prepare_input'; reason: string } {
  if (!isRecord(raw)) return { ok: false, code: 'invalid_prepare_input', reason: 'body must be an object' };
  const topFields = ['requestId', 'idempotencyKey', 'actorId', 'budgetReservationId', 'expiresAt', 'brief'];
  const extra = ownKeysExactly(raw, topFields);
  if (extra) return { ok: false, code: 'invalid_prepare_input', reason: `unknown field: ${extra}` };
  if (topFields.some((field) => !(field in raw))) {
    return { ok: false, code: 'invalid_prepare_input', reason: 'prepare input is missing required fields' };
  }
  if (!isRecord(raw.brief)) return { ok: false, code: 'invalid_prepare_input', reason: 'brief must be an object' };
  const briefFields = [
    'briefId',
    'objective',
    'audience',
    'callToAction',
    'productPacketId',
    'productPacketDigest',
    'evidenceSnapshotDigest',
    'seedDigest',
    'facts',
  ];
  const briefExtra = ownKeysExactly(raw.brief, briefFields);
  if (briefExtra) return { ok: false, code: 'invalid_prepare_input', reason: `unknown brief field: ${briefExtra}` };
  if (briefFields.some((field) => !(field in raw.brief))) {
    return { ok: false, code: 'invalid_prepare_input', reason: 'brief is missing required fields' };
  }
  if (!Array.isArray(raw.brief.facts) || raw.brief.facts.length < 1 || raw.brief.facts.length > 16) {
    return { ok: false, code: 'invalid_prepare_input', reason: 'brief facts must contain 1-16 items' };
  }
  const facts: MarketingBriefFact[] = [];
  const claimIds = new Set<string>();
  for (const fact of raw.brief.facts) {
    if (!isRecord(fact)) return { ok: false, code: 'invalid_prepare_input', reason: 'brief fact must be an object' };
    const factExtra = ownKeysExactly(fact, ['claimId', 'text', 'sourceDigest']);
    if (factExtra) return { ok: false, code: 'invalid_prepare_input', reason: `unknown fact field: ${factExtra}` };
    const claimId = prepareId(fact.claimId);
    const text = boundedText(fact.text, 1000);
    const sourceDigest = digest(fact.sourceDigest);
    if (!claimId || !text || !sourceDigest) {
      return { ok: false, code: 'invalid_prepare_input', reason: 'brief fact is invalid' };
    }
    if (claimIds.has(claimId)) return { ok: false, code: 'invalid_prepare_input', reason: 'brief claim ids must be unique' };
    claimIds.add(claimId);
    facts.push({ claimId, text, sourceDigest });
  }
  const requestId = prepareId(raw.requestId);
  const parsedIdempotencyKey = idempotencyKey(raw.idempotencyKey);
  const actorId = prepareId(raw.actorId);
  const budgetReservationId = prepareId(raw.budgetReservationId);
  const expiresAt = isoTimestamp(raw.expiresAt);
  const briefId = prepareId(raw.brief.briefId);
  const objective = boundedText(raw.brief.objective, 512);
  const audience = boundedText(raw.brief.audience, 256);
  const callToAction = boundedText(raw.brief.callToAction, 256);
  const parsedProductPacketId = productPacketId(raw.brief.productPacketId);
  const productPacketDigest = digest(raw.brief.productPacketDigest);
  const evidenceSnapshotDigest = digest(raw.brief.evidenceSnapshotDigest);
  const seedDigest = digest(raw.brief.seedDigest);
  if (!requestId || !parsedIdempotencyKey || !actorId || !budgetReservationId || !expiresAt
      || !briefId || !objective || !audience || !callToAction || !parsedProductPacketId
      || !productPacketDigest || !evidenceSnapshotDigest || !seedDigest) {
    return { ok: false, code: 'invalid_prepare_input', reason: 'prepare input contains invalid values' };
  }
  return {
    ok: true,
    value: {
      requestId,
      idempotencyKey: parsedIdempotencyKey,
      actorId,
      budgetReservationId,
      expiresAt,
      brief: {
        briefId,
        objective,
        audience,
        callToAction,
        productPacketId: parsedProductPacketId,
        productPacketDigest,
        evidenceSnapshotDigest,
        seedDigest,
        facts,
      },
    },
  };
}

export function parseMarketingExecuteInput(raw: unknown):
  | { ok: true; value: { approvalDecisionId: string } }
  | { ok: false; code: 'invalid_execute_input'; reason: string } {
  if (!isRecord(raw)) return { ok: false, code: 'invalid_execute_input', reason: 'body must be an object' };
  const extra = ownKeysExactly(raw, ['approvalDecisionId']);
  if (extra) return { ok: false, code: 'invalid_execute_input', reason: `unknown field: ${extra}` };
  const approvalDecisionId = opaqueId(raw.approvalDecisionId);
  if (!approvalDecisionId) return { ok: false, code: 'invalid_execute_input', reason: 'approvalDecisionId is invalid' };
  return { ok: true, value: { approvalDecisionId } };
}

export async function prepareMarketingRender(
  raw: unknown,
  deps: { now?: () => string },
): Promise<MarketingPreparedRender> {
  const parsed = parseMarketingPrepareInput(raw);
  if (!parsed.ok) throw new MarketingRendererError(parsed.code, parsed.reason);
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const expiresMs = Date.parse(parsed.value.expiresAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs) || expiresMs <= nowMs || expiresMs - nowMs > MAX_PREPARE_TTL_MS) {
    throw new MarketingRendererError('prepare_expiry_invalid');
  }
  const inputDigest = await sha256MarketingHex(canonicalMarketingJson(parsed.value.brief));
  const action: MarketingRenderAction = {
    schema: 'thoughtseed.marketing-render-action.v1',
    tenantId: MARKETING_CREATE_TENANT_ID,
    requestId: parsed.value.requestId,
    adapterId: MARKETING_CREATE_ADAPTER_ID,
    adapterCatalogDigest: MARKETING_CREATE_CATALOG_DIGEST,
    recipeId: MARKETING_CREATE_RECIPE_ID,
    providerId: MARKETING_CREATE_PROVIDER_ID,
    providerUrl: MARKETING_CREATE_PROVIDER_URL,
    model: MARKETING_CREATE_MODEL,
    generation: MARKETING_CREATE_GENERATION,
    promptTemplateId: MARKETING_PROMPT_TEMPLATE_ID,
    promptTemplateDigest: MARKETING_PROMPT_TEMPLATE_DIGEST,
    inputDigest,
    evidenceSnapshotDigest: parsed.value.brief.evidenceSnapshotDigest,
    productPacketDigest: parsed.value.brief.productPacketDigest,
    budgetReservationId: parsed.value.budgetReservationId,
    actorId: parsed.value.actorId,
    idempotencyKey: parsed.value.idempotencyKey,
    expiresAt: parsed.value.expiresAt,
    credentialDescriptor: {
      kind: 'cloudflare_worker_secret',
      binding: MARKETING_CREATE_SECRET_BINDING,
    },
  };
  const actionDigest = await sha256MarketingHex(canonicalMarketingJson(action));
  const requestDigest = await sha256MarketingHex(canonicalMarketingJson({ action, input: parsed.value }));
  return {
    schema: 'thoughtseed.marketing-render-prepared.v1',
    requestId: parsed.value.requestId,
    tenantId: MARKETING_CREATE_TENANT_ID,
    adapterId: MARKETING_CREATE_ADAPTER_ID,
    adapterCatalogDigest: MARKETING_CREATE_CATALOG_DIGEST,
    idempotencyKey: parsed.value.idempotencyKey,
    actorId: parsed.value.actorId,
    budgetReservationId: parsed.value.budgetReservationId,
    expiresAt: parsed.value.expiresAt,
    input: parsed.value,
    inputDigest,
    action,
    actionDigest,
    requestDigest,
    status: 'prepared',
    preparedAt: now,
  };
}

export function validateMarketingApproval(
  prepared: MarketingPreparedRender,
  approval: MarketingApprovalDecision,
  now: string,
): string | null {
  if (approval.schema_version !== 'approval_decision@1.0.0'
      || approval.tenant?.tenant_id !== MARKETING_CREATE_TENANT_ID
      || approval.tenant?.purpose !== 'marketing_create_render'
      || approval.tenant?.data_classification !== 'public_business') return 'approval_contract_invalid';
  if (approval.action_request_id !== prepared.requestId) return 'approval_request_mismatch';
  if (approval.action_digest !== prepared.actionDigest) return 'approval_action_digest_mismatch';
  if (!OPAQUE_ID_RE.test(approval.approver_id) || !approval.approver_id.startsWith('telegram-founder-')) return 'approval_approver_invalid';
  if (approval.scope !== 'exact_action') return 'approval_scope_invalid';
  if (approval.decision !== 'approved') return 'approval_rejected';
  const nowMs = Date.parse(now);
  const decidedMs = Date.parse(approval.decided_at);
  const approvalExpiresMs = Date.parse(approval.expires_at);
  if (!Number.isFinite(nowMs) || !Number.isFinite(decidedMs) || decidedMs > nowMs) return 'approval_time_invalid';
  if (!Number.isFinite(approvalExpiresMs) || approvalExpiresMs <= nowMs) return 'approval_expired';
  if (approvalExpiresMs > Date.parse(prepared.expiresAt)) return 'approval_expiry_exceeds_action';
  return null;
}

function tenantEnvelope(): MarketingApprovalDecision['tenant'] {
  return {
    tenant_id: MARKETING_CREATE_TENANT_ID,
    purpose: 'marketing_create_render',
    data_classification: 'public_business',
    processing_region: 'global',
    retention_days: 30,
  };
}

function successEnvelope(
  artifact: MarketingAssetDraft,
  receipt: MarketingOperatorReceipt,
  replayed: boolean,
): MarketingRenderExecutionResult {
  return {
    status: 'succeeded',
    replayed,
    adapterId: MARKETING_CREATE_ADAPTER_ID,
    artifactDigest: artifact.content_digest,
    publishEligible: false,
    externalAction: 'none',
    artifact,
    receipt: { ...receipt, replayed },
  };
}

async function readBoundedResponse(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MARKETING_CREATE_MAX_RESPONSE_BYTES) {
    throw new MarketingRendererError('provider_response_too_large');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > MARKETING_CREATE_MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new MarketingRendererError('provider_response_too_large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function normalizedProviderDraft(raw: string): { title: string; body: string; usageTokens: number | null } | null {
  try {
    const response = JSON.parse(raw);
    const content = response?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length === 0 || content.length > 12_000) return null;
    const parsed = JSON.parse(content);
    if (!isRecord(parsed) || ownKeysExactly(parsed, ['title', 'body'])) return null;
    const title = boundedText(parsed.title, 256);
    const body = boundedText(parsed.body, 9_000);
    if (!title || !body) return null;
    const usageTokens = Number.isInteger(response?.usage?.total_tokens)
      && response.usage.total_tokens >= 0
      && response.usage.total_tokens <= 1_000_000
      ? response.usage.total_tokens
      : null;
    return { title, body, usageTokens };
  } catch {
    return null;
  }
}

async function recordFailure(
  store: MarketingRenderStoreLike,
  claim: Extract<MarketingRenderClaimResult, { status: 'claimed' }>,
  code: string,
  now: string,
): Promise<MarketingRenderExecutionResult> {
  const recorded = await store.fail({
    requestId: claim.requestId,
    claimId: claim.claimId,
    fencingToken: claim.fencingToken,
    errorCode: code,
    recordedAt: now,
  });
  return recorded === 'recorded'
    ? { status: 'failed', code }
    : { status: 'reconciliation_required', code: 'failure_persistence_ambiguous' };
}

export async function executeMarketingRender(
  requestId: string,
  approvalDecisionId: string,
  deps: MarketingRendererExecutionDeps,
): Promise<MarketingRenderExecutionResult> {
  if (!deps.activation || deps.activation !== MARKETING_CREATE_EXPECTED_ACTIVATION) {
    throw new MarketingRendererError('renderer_disabled');
  }
  const apiKey = deps.apiKey?.trim();
  if (!apiKey) throw new MarketingRendererError('renderer_secret_missing');
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const prepared = await deps.store.getPrepared(requestId);
  if (!prepared) throw new MarketingRendererError('render_request_not_found');
  if (prepared.tenantId !== MARKETING_CREATE_TENANT_ID
      || prepared.adapterId !== MARKETING_CREATE_ADAPTER_ID
      || prepared.adapterCatalogDigest !== MARKETING_CREATE_CATALOG_DIGEST
      || prepared.action.adapterCatalogDigest !== MARKETING_CREATE_CATALOG_DIGEST
      || prepared.actionDigest !== await sha256MarketingHex(canonicalMarketingJson(prepared.action))
      || prepared.requestDigest !== await sha256MarketingHex(canonicalMarketingJson({ action: prepared.action, input: prepared.input }))) {
    throw new MarketingRendererError('render_contract_mismatch');
  }
  if (Date.parse(prepared.expiresAt) <= Date.parse(now)) throw new MarketingRendererError('render_request_expired');
  const approval = await deps.store.getApproval(approvalDecisionId);
  if (!approval) throw new MarketingRendererError('approval_not_found');
  const approvalError = validateMarketingApproval(prepared, approval, now);
  if (approvalError) throw new MarketingRendererError(approvalError);

  const claimId = (deps.uuid ?? (() => crypto.randomUUID()))();
  const leaseExpiresAt = new Date(Date.parse(now) + MARKETING_CREATE_LEASE_MS).toISOString();
  const claim = await deps.store.claim({
    requestId,
    requestDigest: prepared.requestDigest,
    actionDigest: prepared.actionDigest,
    approvalDecisionId,
    claimId,
    claimedAt: now,
    leaseExpiresAt,
  });
  if (claim.status === 'busy') return claim;
  if (claim.status === 'conflict') return { status: 'conflict', code: claim.code };
  if (claim.status === 'reconciliation_required') {
    return { status: 'reconciliation_required', code: claim.state };
  }
  if (claim.status === 'terminal') {
    return claim.outcome === 'succeeded'
      ? successEnvelope(claim.artifact, claim.receipt, true)
      : { status: 'failed', code: claim.code };
  }

  const invoking = await deps.store.beginInvocation({
    requestId: claim.requestId,
    claimId: claim.claimId,
    fencingToken: claim.fencingToken,
    observedAt: now,
  });
  if (invoking !== 'confirmed') {
    return { status: 'reconciliation_required', code: 'invoking_not_confirmed' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MARKETING_CREATE_TIMEOUT_MS);
  let response: Response;
  try {
    const fetchImpl = deps.fetchImpl ?? fetch;
    response = await fetchImpl(MARKETING_CREATE_PROVIDER_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MARKETING_CREATE_MODEL,
        stream: MARKETING_CREATE_GENERATION.stream,
        temperature: MARKETING_CREATE_GENERATION.temperature,
        max_tokens: MARKETING_CREATE_GENERATION.maxTokens,
        messages: [
          { role: 'system', content: MARKETING_PROMPT_TEMPLATE },
          {
            role: 'user',
            content: JSON.stringify({
              objective: prepared.input.brief.objective,
              audience: prepared.input.brief.audience,
              callToAction: prepared.input.brief.callToAction,
              verifiedFacts: prepared.input.brief.facts,
            }),
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    const errorCode = controller.signal.aborted
      ? 'provider_timeout_indeterminate'
      : 'provider_outcome_indeterminate';
    await deps.store.markIndeterminate({
      requestId: claim.requestId,
      claimId: claim.claimId,
      fencingToken: claim.fencingToken,
      errorCode,
      recordedAt: now,
    });
    return { status: 'reconciliation_required', code: errorCode };
  }
  if (!response.ok) {
    clearTimeout(timer);
    const code = response.status >= 500 ? 'provider_http_5xx' : 'provider_http_4xx';
    return recordFailure(deps.store, claim, code, now);
  }

  let raw: string;
  try {
    raw = await readBoundedResponse(response);
  } catch (error) {
    const code = controller.signal.aborted
      ? 'provider_response_timeout'
      : error instanceof MarketingRendererError
        ? error.code
        : 'provider_response_invalid';
    return recordFailure(deps.store, claim, code, now);
  } finally {
    clearTimeout(timer);
  }
  const normalized = normalizedProviderDraft(raw);
  if (!normalized) return recordFailure(deps.store, claim, 'provider_response_invalid', now);

  const suffix = (await sha256MarketingHex(prepared.requestId)).slice(0, 24);
  const artifactWithoutDigest = {
    schema_version: 'asset_draft@1.0.0' as const,
    tenant: tenantEnvelope(),
    record_id: `asset-draft-${suffix}`,
    brief_id: prepared.input.brief.briefId,
    recipe_id: MARKETING_CREATE_RECIPE_ID,
    title: normalized.title,
    body: normalized.body,
    claim_ids: prepared.input.brief.facts.map(({ claimId }) => claimId),
    evidence_snapshot_digest: prepared.input.brief.evidenceSnapshotDigest,
    rights_state: 'review_required' as const,
    status: 'draft' as const,
    created_at: now,
  };
  const contentDigest = await sha256MarketingHex(canonicalMarketingJson(artifactWithoutDigest));
  const artifact: MarketingAssetDraft = { ...artifactWithoutDigest, content_digest: contentDigest };
  const receipt: MarketingOperatorReceipt = {
    schema_version: 'operator_receipt@1.0.0',
    tenant: tenantEnvelope(),
    record_id: `operator-receipt-${suffix}`,
    task_id: prepared.requestId,
    state: 'awaiting_human_approval',
    artifact_count: 1,
    next_action: 'review',
    replayed: false,
    redaction_applied: true,
    updated_at: now,
  };
  const recorded = await deps.store.complete({
    requestId: claim.requestId,
    claimId: claim.claimId,
    fencingToken: claim.fencingToken,
    artifact,
    receipt,
    artifactDigest: contentDigest,
    providerUsageTokens: normalized.usageTokens,
    recordedAt: now,
  });
  return recorded === 'recorded'
    ? successEnvelope(artifact, receipt, false)
    : { status: 'reconciliation_required', code: 'completion_persistence_ambiguous' };
}
