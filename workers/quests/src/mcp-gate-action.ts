export interface McpGateActionKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export interface McpActionIntentV1 {
  schema: 'cambium.mcp.action_intent.v1';
  tenant: string;
  actor: string;
  plugin_identity: string;
  mcp_identity: string;
  issuer: string;
  action_kind: string;
  argument_digest: string;
  action_digest: string;
  graph_version: number;
  nonce: string;
  expiry: string;
  idempotency_key: string;
  status: 'compiled_not_authorized';
  writer_authority: false;
  canonical_completion: false;
}

export interface McpGateApprovalInput {
  intent: McpActionIntentV1;
  arguments: Record<string, unknown>;
}

export interface McpGateApprovalStatusInput {
  intent: McpActionIntentV1;
}

export interface McpGatePendingActionRequest {
  schema: 'cambium.gate.action_review_request.v1';
  status: 'pending';
  request_digest: string;
  requested_at: string;
  intent: McpActionIntentV1;
  arguments: Record<string, unknown>;
}

export interface McpGateExecutionInput {
  schema: 'cambium.mcp.gate_action_request.v1';
  intent: McpActionIntentV1;
  approval_digest: string;
}

export interface McpGateRouteResult {
  status: number;
  body: Record<string, unknown>;
}

export type McpGateTargetValidation =
  | { ok: true }
  | { ok: false; status: number; error: string };

export type McpGateTargetExecution =
  | { ok: true; status: 'committed' | 'duplicate'; terminalOutcome: string }
  | { ok: false; status: number; error: string };

interface McpGateApprovalRecordV1 {
  schema: 'cambium.gate.action_approval_record.v1';
  status: 'approved' | 'committed';
  founder_id: string;
  approved_at: string;
  approval_digest: string;
  intent: McpActionIntentV1;
  arguments: Record<string, unknown>;
  receipt?: Record<string, unknown>;
}

interface McpGateActionRequestRecordV1 {
  schema: 'cambium.gate.action_review_request.v1';
  status: 'pending' | 'approved' | 'committed';
  request_digest: string;
  requested_at: string;
  intent: McpActionIntentV1;
  arguments: Record<string, unknown>;
  approval_digest?: string;
  receipt_digest?: string;
}

const INTENT_KEYS = new Set([
  'schema', 'tenant', 'actor', 'plugin_identity', 'mcp_identity', 'issuer',
  'action_kind', 'argument_digest', 'action_digest', 'graph_version', 'nonce',
  'expiry', 'idempotency_key', 'status', 'writer_authority',
  'canonical_completion',
]);
const APPROVAL_INPUT_KEYS = new Set(['intent', 'arguments']);
const STATUS_INPUT_KEYS = new Set(['intent']);
const REVIEW_APPROVAL_INPUT_KEYS = new Set(['action_digest', 'request_digest']);
const EXECUTION_INPUT_KEYS = new Set(['schema', 'intent', 'approval_digest']);
const TENANT_RE = /^[a-z][a-z0-9-]{1,63}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/;
const ACTION_RE = /^[a-z][a-z0-9._:-]{1,127}$/;
const NONCE_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,239}$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,239}$/;
const DIGEST_RE = /^sha256:[a-f0-9]{64}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_ARGUMENT_BYTES = 32_768;
const MAX_TERMINAL_OUTCOME = 128;

function route(status: number, body: Record<string, unknown>): McpGateRouteResult {
  return { status, body };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: ReadonlySet<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function canonical(value: unknown, seen = new Set<object>()): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non_finite_number');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new Error('non_json_value');
  if (seen.has(value)) throw new Error('cyclic_json');
  seen.add(value);
  const encoded = Array.isArray(value)
    ? `[${value.map((item) => canonical(item, seen)).join(',')}]`
    : `{${Object.keys(value as Record<string, unknown>).sort().map((key) => (
      `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key], seen)}`
    )).join(',')}}`;
  seen.delete(value);
  return encoded;
}

async function digest(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(canonical(value));
  const bytes = await crypto.subtle.digest('SHA-256', encoded);
  return `sha256:${[...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function exactInstant(value: unknown): number | null {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return null;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value ? epoch : null;
}

function parseIntentShape(raw: unknown): McpActionIntentV1 | null {
  if (!isRecord(raw) || !exactKeys(raw, INTENT_KEYS)) return null;
  if (raw.schema !== 'cambium.mcp.action_intent.v1'
      || raw.status !== 'compiled_not_authorized'
      || raw.writer_authority !== false
      || raw.canonical_completion !== false
      || !TENANT_RE.test(String(raw.tenant))
      || !ID_RE.test(String(raw.actor))
      || !ID_RE.test(String(raw.plugin_identity))
      || !ACTION_RE.test(String(raw.action_kind))
      || !DIGEST_RE.test(String(raw.argument_digest))
      || !DIGEST_RE.test(String(raw.action_digest))
      || !Number.isInteger(raw.graph_version)
      || Number(raw.graph_version) < 0
      || !NONCE_RE.test(String(raw.nonce))
      || exactInstant(raw.expiry) === null
      || !IDEMPOTENCY_RE.test(String(raw.idempotency_key))) return null;
  for (const field of ['mcp_identity', 'issuer'] as const) {
    try {
      const url = new URL(String(raw[field]));
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    } catch {
      return null;
    }
  }
  return raw as unknown as McpActionIntentV1;
}

async function validateIntentDigests(intent: McpActionIntentV1, args: Record<string, unknown>): Promise<boolean> {
  let encoded: string;
  try { encoded = canonical(args); } catch { return false; }
  if (new TextEncoder().encode(encoded).byteLength > MAX_ARGUMENT_BYTES) return false;
  if (await digest(args) !== intent.argument_digest) return false;
  return validateIntentIdentityDigest(intent);
}

async function validateIntentIdentityDigest(intent: McpActionIntentV1): Promise<boolean> {
  const identity = {
    schema: 'cambium.mcp.action_identity.v1',
    tenant: intent.tenant,
    actor: intent.actor,
    plugin_identity: intent.plugin_identity,
    mcp_identity: intent.mcp_identity,
    issuer: intent.issuer,
    action_kind: intent.action_kind,
    argument_digest: intent.argument_digest,
    graph_version: intent.graph_version,
    nonce: intent.nonce,
    expiry: intent.expiry,
    idempotency_key: intent.idempotency_key,
  };
  return await digest(identity) === intent.action_digest;
}

function requestKey(actionDigest: string): string {
  return `mcp-gate-request:${actionDigest.slice('sha256:'.length)}`;
}

async function requestIdempotencyKey(intent: McpActionIntentV1): Promise<string> {
  const identity = await digest({ tenant: intent.tenant, idempotency_key: intent.idempotency_key });
  return `mcp-gate-request-idem:${identity.slice('sha256:'.length)}`;
}

function approvalKey(approvalDigest: string): string {
  return `mcp-gate-action:${approvalDigest.slice('sha256:'.length)}`;
}

async function idempotencyKey(intent: McpActionIntentV1): Promise<string> {
  const identity = await digest({ tenant: intent.tenant, idempotency_key: intent.idempotency_key });
  return `mcp-gate-idem:${identity.slice('sha256:'.length)}`;
}

function parseStoredRecord(raw: string | null): McpGateApprovalRecordV1 | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)
        || value.schema !== 'cambium.gate.action_approval_record.v1'
        || (value.status !== 'approved' && value.status !== 'committed')
        || !DIGEST_RE.test(String(value.approval_digest))
        || typeof value.founder_id !== 'string'
        || !isRecord(value.arguments)
        || !parseIntentShape(value.intent)) return null;
    return value as unknown as McpGateApprovalRecordV1;
  } catch {
    return null;
  }
}

function parseStoredRequest(raw: string | null): McpGateActionRequestRecordV1 | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)
        || value.schema !== 'cambium.gate.action_review_request.v1'
        || !['pending', 'approved', 'committed'].includes(String(value.status))
        || !DIGEST_RE.test(String(value.request_digest))
        || exactInstant(value.requested_at) === null
        || !isRecord(value.arguments)
        || !parseIntentShape(value.intent)
        || (value.approval_digest !== undefined && !DIGEST_RE.test(String(value.approval_digest)))
        || (value.receipt_digest !== undefined && !DIGEST_RE.test(String(value.receipt_digest)))) return null;
    return value as unknown as McpGateActionRequestRecordV1;
  } catch {
    return null;
  }
}

async function writeRequestState(
  kv: McpGateActionKv,
  intent: McpActionIntentV1,
  status: 'approved' | 'committed',
  approvalDigest: string,
  receiptDigest?: string,
): Promise<void> {
  const key = requestKey(intent.action_digest);
  const request = parseStoredRequest(await kv.get(key));
  if (!request || canonical(request.intent) !== canonical(intent)) return;
  await kv.put(key, JSON.stringify({
    ...request,
    status,
    approval_digest: approvalDigest,
    ...(receiptDigest ? { receipt_digest: receiptDigest } : {}),
  } satisfies McpGateActionRequestRecordV1));
}

async function resolveApprovalForRequest(
  kv: McpGateActionKv,
  request: McpGateActionRequestRecordV1,
): Promise<{ approvalDigest: string; record: McpGateApprovalRecordV1 } | null> {
  let approvalDigest = request.approval_digest;
  if (!approvalDigest) {
    const raw = await kv.get(await idempotencyKey(request.intent));
    if (raw) {
      try {
        const value = JSON.parse(raw) as unknown;
        if (isRecord(value)
            && value.action_digest === request.intent.action_digest
            && DIGEST_RE.test(String(value.approval_digest))) approvalDigest = String(value.approval_digest);
      } catch {
        approvalDigest = undefined;
      }
    }
  }
  if (!approvalDigest) return null;
  const record = parseStoredRecord(await kv.get(approvalKey(approvalDigest)));
  if (!record || canonical(record.intent) !== canonical(request.intent)) return null;
  return { approvalDigest, record };
}

export async function requestMcpGateActionApproval(
  kv: McpGateActionKv,
  raw: unknown,
  options: {
    now: string;
    validateTarget: (intent: McpActionIntentV1, args: Record<string, unknown>) => Promise<McpGateTargetValidation>;
  },
): Promise<McpGateRouteResult> {
  if (!isRecord(raw) || !exactKeys(raw, APPROVAL_INPUT_KEYS) || !isRecord(raw.arguments)) {
    return route(400, { error: 'invalid_mcp_action_review_request' });
  }
  const intent = parseIntentShape(raw.intent);
  if (!intent || !await validateIntentDigests(intent, raw.arguments)) {
    return route(400, { error: 'mcp_action_intent_digest_mismatch' });
  }
  const now = exactInstant(options.now);
  const expiry = exactInstant(intent.expiry);
  if (now === null || expiry === null || expiry <= now) {
    return route(409, { error: 'mcp_action_request_expired' });
  }
  const key = requestKey(intent.action_digest);
  const existing = parseStoredRequest(await kv.get(key));
  if (existing) {
    if (canonical(existing.intent) !== canonical(intent) || canonical(existing.arguments) !== canonical(raw.arguments)) {
      return route(409, { error: 'mcp_action_request_conflict' });
    }
    const approval = await resolveApprovalForRequest(kv, existing);
    return route(200, {
      schema: 'cambium.gate.action_review_response.v1',
      status: approval?.record.status === 'committed'
        ? 'executed'
        : approval ? 'approved' : 'awaiting_founder_approval',
      duplicate: true,
      tenant: intent.tenant,
      action_digest: intent.action_digest,
      request_digest: existing.request_digest,
      approval_digest: approval?.approvalDigest ?? null,
      expiry: intent.expiry,
    });
  }
  const idemKey = await requestIdempotencyKey(intent);
  const existingIdemRaw = await kv.get(idemKey);
  if (existingIdemRaw) {
    try {
      const existingIdem = JSON.parse(existingIdemRaw) as unknown;
      if (!isRecord(existingIdem) || existingIdem.action_digest !== intent.action_digest) {
        return route(409, { error: 'mcp_action_request_idempotency_conflict' });
      }
    } catch {
      return route(409, { error: 'mcp_action_request_idempotency_conflict' });
    }
  }
  const target = await options.validateTarget(intent, raw.arguments);
  if ('error' in target) return route(target.status, { error: target.error });
  const requestCore = {
    schema: 'cambium.gate.action_review_request_identity.v1',
    intent,
    arguments: raw.arguments,
  };
  const requestDigest = await digest(requestCore);
  const record: McpGateActionRequestRecordV1 = {
    schema: 'cambium.gate.action_review_request.v1',
    status: 'pending',
    request_digest: requestDigest,
    requested_at: options.now,
    intent,
    arguments: raw.arguments,
  };
  await kv.put(key, JSON.stringify(record));
  await kv.put(idemKey, JSON.stringify({
    schema: 'cambium.gate.action_review_idempotency.v1',
    action_digest: intent.action_digest,
    request_digest: requestDigest,
  }));
  return route(200, {
    schema: 'cambium.gate.action_review_response.v1',
    status: 'awaiting_founder_approval',
    duplicate: false,
    tenant: intent.tenant,
    action_digest: intent.action_digest,
    request_digest: requestDigest,
    approval_digest: null,
    expiry: intent.expiry,
  });
}

export async function readMcpGateActionApprovalStatus(
  kv: McpGateActionKv,
  raw: unknown,
  nowIso: string,
): Promise<McpGateRouteResult> {
  if (!isRecord(raw) || !exactKeys(raw, STATUS_INPUT_KEYS)) {
    return route(400, { error: 'invalid_mcp_action_status_request' });
  }
  const intent = parseIntentShape(raw.intent);
  if (!intent || !await validateIntentIdentityDigest(intent)) {
    return route(400, { error: 'invalid_mcp_action_intent' });
  }
  const request = parseStoredRequest(await kv.get(requestKey(intent.action_digest)));
  if (!request || canonical(request.intent) !== canonical(intent)) {
    return route(404, { error: 'mcp_action_request_not_found' });
  }
  const approval = await resolveApprovalForRequest(kv, request);
  const now = exactInstant(nowIso);
  const expiry = exactInstant(intent.expiry);
  const status = approval?.record.status === 'committed'
    ? 'executed'
    : approval ? 'approved'
      : (now === null || expiry === null || expiry <= now) ? 'expired' : 'awaiting_founder_approval';
  const receipt = approval?.record.receipt;
  return route(200, {
    schema: 'cambium.gate.action_review_status.v1',
    status,
    tenant: intent.tenant,
    action_digest: intent.action_digest,
    request_digest: request.request_digest,
    approval_digest: approval?.approvalDigest ?? null,
    receipt_digest: isRecord(receipt) && DIGEST_RE.test(String(receipt.receipt_digest)) ? receipt.receipt_digest : null,
    expiry: intent.expiry,
    writer_authority: false,
    canonical_completion: false,
  });
}

export async function listPendingMcpGateActionRequests(
  kv: McpGateActionKv,
  tenant: string,
  nowIso: string,
  limit = 25,
): Promise<McpGatePendingActionRequest[]> {
  if (!TENANT_RE.test(tenant) || exactInstant(nowIso) === null) return [];
  const keys = await kv.list('mcp-gate-request:');
  const rows: McpGatePendingActionRequest[] = [];
  for (const key of keys) {
    const request = parseStoredRequest(await kv.get(key));
    if (!request || request.intent.tenant !== tenant || exactInstant(request.intent.expiry)! <= exactInstant(nowIso)!) continue;
    const status = await readMcpGateActionApprovalStatus(kv, { intent: request.intent }, nowIso);
    if (status.status !== 200 || status.body.status !== 'awaiting_founder_approval') continue;
    rows.push({
      schema: request.schema,
      status: 'pending',
      request_digest: request.request_digest,
      requested_at: request.requested_at,
      intent: request.intent,
      arguments: request.arguments,
    });
  }
  rows.sort((a, b) => b.requested_at.localeCompare(a.requested_at));
  return rows.slice(0, Math.max(1, Math.min(limit, 100)));
}

export async function approveMcpGateAction(
  kv: McpGateActionKv,
  raw: unknown,
  options: {
    founderId: string;
    now: string;
    requirePendingRequest?: boolean;
    validateTarget: (intent: McpActionIntentV1, args: Record<string, unknown>) => Promise<McpGateTargetValidation>;
  },
): Promise<McpGateRouteResult> {
  if (!isRecord(raw) || !exactKeys(raw, APPROVAL_INPUT_KEYS) || !isRecord(raw.arguments)) {
    return route(400, { error: 'invalid_mcp_action_approval_input' });
  }
  const intent = parseIntentShape(raw.intent);
  if (!intent || !await validateIntentDigests(intent, raw.arguments)) {
    return route(400, { error: 'mcp_action_intent_digest_mismatch' });
  }
  const now = exactInstant(options.now);
  const expiry = exactInstant(intent.expiry);
  if (now === null || expiry === null || expiry <= now) {
    return route(409, { error: 'mcp_action_approval_expired' });
  }
  if (!/^[0-9]{1,32}$/.test(options.founderId)) {
    return route(403, { error: 'mcp_action_founder_identity_invalid' });
  }
  const pendingRequest = parseStoredRequest(await kv.get(requestKey(intent.action_digest)));
  if (options.requirePendingRequest === true
      && (!pendingRequest
        || canonical(pendingRequest.intent) !== canonical(intent)
        || canonical(pendingRequest.arguments) !== canonical(raw.arguments))) {
    return route(404, { error: 'mcp_action_request_not_found' });
  }
  const idemKey = await idempotencyKey(intent);
  const approvalCore = {
    schema: 'cambium.gate.action_approval.v1',
    founder_id: options.founderId,
    intent,
    arguments: raw.arguments,
  };
  const approvalDigest = await digest(approvalCore);
  const directExisting = parseStoredRecord(await kv.get(approvalKey(approvalDigest)));
  if (directExisting) {
    if (canonical(directExisting.intent) !== canonical(intent)
        || canonical(directExisting.arguments) !== canonical(raw.arguments)
        || directExisting.founder_id !== options.founderId) {
      return route(409, { error: 'mcp_action_approval_conflict' });
    }
    const existingIdemRaw = await kv.get(idemKey);
    if (existingIdemRaw) {
      let existingIdem: unknown;
      try { existingIdem = JSON.parse(existingIdemRaw); } catch { existingIdem = null; }
      if (!isRecord(existingIdem)
          || existingIdem.action_digest !== intent.action_digest
          || existingIdem.approval_digest !== approvalDigest) {
        return route(409, { error: 'mcp_action_idempotency_conflict' });
      }
    } else {
      await kv.put(idemKey, JSON.stringify({
        schema: 'cambium.gate.action_idempotency.v1',
        action_digest: intent.action_digest,
        approval_digest: approvalDigest,
      }));
    }
    await writeRequestState(kv, intent, directExisting.status === 'committed' ? 'committed' : 'approved', approvalDigest,
      isRecord(directExisting.receipt) ? String(directExisting.receipt.receipt_digest ?? '') : undefined);
    return route(200, {
      schema: 'cambium.gate.action_approval_response.v1',
      status: directExisting.status === 'committed' ? 'already_executed' : 'approved_not_executed',
      duplicate: true,
      tenant: intent.tenant,
      action_digest: intent.action_digest,
      approval_digest: approvalDigest,
      expiry: intent.expiry,
    });
  }

  const existingIdemRaw = await kv.get(idemKey);
  if (existingIdemRaw) {
    let existingIdem: unknown;
    try { existingIdem = JSON.parse(existingIdemRaw); } catch { existingIdem = null; }
    if (!isRecord(existingIdem)
        || existingIdem.action_digest !== intent.action_digest
        || !DIGEST_RE.test(String(existingIdem.approval_digest))) {
      return route(409, { error: 'mcp_action_idempotency_conflict' });
    }
    return route(409, { error: 'mcp_action_idempotency_conflict' });
  }

  const target = await options.validateTarget(intent, raw.arguments);
  if ('error' in target) return route(target.status, { error: target.error });
  const record: McpGateApprovalRecordV1 = {
    schema: 'cambium.gate.action_approval_record.v1',
    status: 'approved',
    founder_id: options.founderId,
    approved_at: options.now,
    approval_digest: approvalDigest,
    intent,
    arguments: raw.arguments,
  };
  await kv.put(approvalKey(approvalDigest), JSON.stringify(record));
  await kv.put(idemKey, JSON.stringify({
    schema: 'cambium.gate.action_idempotency.v1',
    action_digest: intent.action_digest,
    approval_digest: approvalDigest,
  }));
  await writeRequestState(kv, intent, 'approved', approvalDigest);
  return route(200, {
    schema: 'cambium.gate.action_approval_response.v1',
    status: 'approved_not_executed',
    duplicate: false,
    tenant: intent.tenant,
    action_digest: intent.action_digest,
    approval_digest: approvalDigest,
    expiry: intent.expiry,
  });
}

export async function approveMcpGateActionRequest(
  kv: McpGateActionKv,
  raw: unknown,
  options: {
    founderId: string;
    now: string;
    validateTarget: (intent: McpActionIntentV1, args: Record<string, unknown>) => Promise<McpGateTargetValidation>;
  },
): Promise<McpGateRouteResult> {
  if (!isRecord(raw)
      || !exactKeys(raw, REVIEW_APPROVAL_INPUT_KEYS)
      || !DIGEST_RE.test(String(raw.action_digest))
      || !DIGEST_RE.test(String(raw.request_digest))) {
    return route(400, { error: 'invalid_mcp_action_review_approval' });
  }
  const request = parseStoredRequest(await kv.get(requestKey(String(raw.action_digest))));
  if (!request
      || request.intent.action_digest !== raw.action_digest
      || request.request_digest !== raw.request_digest) {
    return route(404, { error: 'mcp_action_request_not_found' });
  }
  return approveMcpGateAction(kv, {
    intent: request.intent,
    arguments: request.arguments,
  }, {
    ...options,
    requirePendingRequest: true,
  });
}

export async function executeMcpGateAction(
  kv: McpGateActionKv,
  raw: unknown,
  options: {
    now: string;
    executeTarget: (
      intent: McpActionIntentV1,
      args: Record<string, unknown>,
      founderId: string,
    ) => Promise<McpGateTargetExecution>;
  },
): Promise<McpGateRouteResult> {
  if (!isRecord(raw) || !exactKeys(raw, EXECUTION_INPUT_KEYS)
      || raw.schema !== 'cambium.mcp.gate_action_request.v1'
      || !DIGEST_RE.test(String(raw.approval_digest))) {
    return route(400, { error: 'invalid_mcp_gate_action_request' });
  }
  const intent = parseIntentShape(raw.intent);
  if (!intent) return route(400, { error: 'invalid_mcp_action_intent' });
  const record = parseStoredRecord(await kv.get(approvalKey(String(raw.approval_digest))));
  if (!record) return route(404, { error: 'mcp_action_approval_not_found' });
  if (record.approval_digest !== raw.approval_digest
      || canonical(record.intent) !== canonical(intent)) {
    return route(409, { error: 'mcp_action_approval_mismatch' });
  }
  if (!await validateIntentDigests(intent, record.arguments)) {
    return route(409, { error: 'mcp_action_approval_mismatch' });
  }
  if (record.status === 'committed' && isRecord(record.receipt)) {
    return route(200, {
      schema: 'cambium.gate.action_response.v1',
      status: 'duplicate',
      receipt: record.receipt,
    });
  }
  const now = exactInstant(options.now);
  const expiry = exactInstant(intent.expiry);
  if (now === null || expiry === null || expiry <= now) {
    return route(409, { error: 'mcp_action_approval_expired' });
  }

  const target = await options.executeTarget(intent, record.arguments, record.founder_id);
  if ('error' in target) return route(target.status, { error: target.error });
  if (!target.terminalOutcome
      || target.terminalOutcome.length > MAX_TERMINAL_OUTCOME
      || /[\u0000-\u001f\u007f]/.test(target.terminalOutcome)) {
    return route(503, { error: 'mcp_action_terminal_readback_invalid' });
  }
  const receiptCore = {
    schema: 'cambium.gate.action_receipt.v1',
    tenant: intent.tenant,
    actor: intent.actor,
    plugin_identity: intent.plugin_identity,
    mcp_identity: intent.mcp_identity,
    issuer: intent.issuer,
    action_kind: intent.action_kind,
    argument_digest: intent.argument_digest,
    action_digest: intent.action_digest,
    graph_version: intent.graph_version,
    nonce: intent.nonce,
    expiry: intent.expiry,
    idempotency_key: intent.idempotency_key,
    approval_digest: record.approval_digest,
    mutation_count: 1,
    terminal_outcome: target.terminalOutcome,
  };
  const receiptDigest = await digest(receiptCore);
  const receipt = {
    ...receiptCore,
    receipt_digest: receiptDigest,
    authoritative_readback: {
      schema: 'cambium.gate.authoritative_readback.v1',
      tenant: intent.tenant,
      actor: intent.actor,
      action_digest: intent.action_digest,
      graph_version: intent.graph_version,
      terminal_outcome: target.terminalOutcome,
      receipt_digest: receiptDigest,
    },
  };
  await kv.put(approvalKey(record.approval_digest), JSON.stringify({
    ...record,
    status: 'committed',
    receipt,
  } satisfies McpGateApprovalRecordV1));
  await writeRequestState(kv, intent, 'committed', record.approval_digest, receiptDigest);
  return route(200, {
    schema: 'cambium.gate.action_response.v1',
    status: target.status,
    receipt,
  });
}
