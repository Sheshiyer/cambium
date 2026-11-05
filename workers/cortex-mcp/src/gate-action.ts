export interface GateActionBinding {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

export interface GateActionIdentity {
  actor: string;
  plugin_identity: string;
  mcp_identity: string;
  issuer: string;
}

export interface GateActionCompileInput {
  tenant: string;
  action_kind: string;
  arguments: Record<string, unknown>;
  graph_version: number;
  nonce: string;
  expiry: string;
  idempotency_key: string;
}

export interface GateActionExecuteInput extends GateActionCompileInput {
  approval_digest: string;
}

export class GateActionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GateActionError";
    this.code = code;
  }
}

const COMPILE_KEYS = new Set([
  "tenant",
  "action_kind",
  "arguments",
  "graph_version",
  "nonce",
  "expiry",
  "idempotency_key",
]);
const EXECUTE_KEYS = new Set([...COMPILE_KEYS, "approval_digest"]);
const RESPONSE_KEYS = new Set(["schema", "status", "receipt"]);
const RECEIPT_KEYS = new Set([
  "schema",
  "tenant",
  "actor",
  "plugin_identity",
  "mcp_identity",
  "issuer",
  "action_kind",
  "argument_digest",
  "action_digest",
  "graph_version",
  "nonce",
  "expiry",
  "idempotency_key",
  "approval_digest",
  "mutation_count",
  "terminal_outcome",
  "receipt_digest",
  "authoritative_readback",
]);
const READBACK_KEYS = new Set([
  "schema",
  "tenant",
  "actor",
  "action_digest",
  "graph_version",
  "terminal_outcome",
  "receipt_digest",
]);
const REVIEW_RESPONSE_KEYS = new Set([
  "schema", "status", "duplicate", "tenant", "action_digest", "request_digest",
  "approval_digest", "expiry",
]);
const REVIEW_STATUS_KEYS = new Set([
  "schema", "status", "tenant", "action_digest", "request_digest", "approval_digest",
  "receipt_digest", "expiry", "writer_authority", "canonical_completion",
]);

const TENANT_RE = /^[a-z][a-z0-9-]{1,63}$/;
const CANONICAL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/;
const ACTION_KIND_RE = /^[a-z][a-z0-9._:-]{1,127}$/;
const NONCE_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,679}$/;
const DIGEST_RE = /^sha256:[a-f0-9]{64}$/;
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SENSITIVE_FIELD_RE = /(api[_-]?key|secret|token|password|credential|bearer|prompt(_body)?|response(_body)?|native[_-]?session|session[_-]?id|absolute[_-]?path|home[_-]?dir|env[_-]?file)/i;
const SECRET_VALUE_RE = new RegExp(
  "(?:" + ["s", "k", "-"].join("") + "[a-z0-9-]{6,}|xox[abpsr]-[a-z0-9-]{10,}|(?:github_pat|gh[pousr])_[a-z0-9_]{20,}|(?:" + ["B", "earer"].join("") + "|Basic)\\s+\\S+)",
  "i",
);
const MACHINE_PATH_RE = /(?:file:\/\/\/|(?:^|[^A-Za-z0-9/])\/\/[A-Za-z0-9._-]+\/\S+|(?:^|[^A-Za-z0-9/])\/(?:Users|home|Volumes|private|var|tmp|etc|opt|srv|root|mnt|data|workspace)(?:\/\S*|\b)|(?:^|[^A-Za-z0-9/])\/(?!\/)[^\s/]+\/\S+|(?:^|[^A-Za-z0-9])[A-Za-z]:\\\S+|\\\\[^\\\s]+\\\S+)/i;
const MAX_ARGUMENT_BYTES = 32_768;
const MAX_RESPONSE_BYTES = 131_072;
const MAX_APPROVAL_WINDOW_MS = 15 * 60_000;
const DEFAULT_GATE_TIMEOUT_MS = 5_000;

function fail(code: string, message: string): never {
  throw new GateActionError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: ReadonlySet<string>): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.size && actual.every((key) => keys.has(key));
}

function canonicalize(value: unknown, seen = new Set<object>()): string {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("bad_arguments", "action arguments contain a non-finite number");
    return JSON.stringify(value);
  }
  if (typeof value !== "object") fail("bad_arguments", "action arguments must be JSON values");
  if (seen.has(value)) fail("bad_arguments", "action arguments must not contain cycles");
  seen.add(value);
  let result: string;
  if (Array.isArray(value)) {
    result = `[${value.map((item) => canonicalize(item, seen)).join(",")}]`;
  } else {
    const record = value as Record<string, unknown>;
    result = `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key], seen)}`).join(",")}}`;
  }
  seen.delete(value);
  return result;
}

async function digestCanonicalJson(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalize(value)));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function scanSensitive(value: unknown, path: string): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    if (SECRET_VALUE_RE.test(value) || MACHINE_PATH_RE.test(value)) {
      fail("sensitive_content", `sensitive content rejected at ${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanSensitive(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_FIELD_RE.test(key)) fail("sensitive_content", `sensitive field rejected at ${path}.${key}`);
      scanSensitive(item, `${path}.${key}`);
    }
  }
}

function exactTimestamp(value: unknown, field: string): number {
  if (typeof value !== "string" || !ISO_UTC_RE.test(value)) fail("bad_expiry", `${field} must be strict UTC ISO`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    fail("bad_expiry", `${field} must be an exact calendar instant`);
  }
  return parsed;
}

function validateIdentity(identity: GateActionIdentity): void {
  if (!isRecord(identity) || !hasExactKeys(identity, new Set(["actor", "plugin_identity", "mcp_identity", "issuer"]))) {
    fail("identity_unavailable", "server-derived action identity is incomplete");
  }
  if (!CANONICAL_ID_RE.test(identity.actor) || !CANONICAL_ID_RE.test(identity.plugin_identity)) {
    fail("identity_unavailable", "server-derived action identity is invalid");
  }
  for (const [field, value] of [["mcp_identity", identity.mcp_identity], ["issuer", identity.issuer]] as const) {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      fail("identity_unavailable", `${field} is not an absolute URL`);
    }
    if (parsed!.protocol !== "https:" || parsed!.username || parsed!.password || parsed!.hash || parsed!.search) {
      fail("identity_unavailable", `${field} is not a canonical HTTPS identity`);
    }
  }
  // URL identities are validated structurally above. Running the generic
  // machine-path detector over an https URL would misclassify its path.
  scanSensitive(identity.actor, "identity.actor");
  scanSensitive(identity.plugin_identity, "identity.plugin_identity");
}

function validateCompileInput(raw: unknown, expectedKeys = COMPILE_KEYS): GateActionCompileInput {
  if (!isRecord(raw) || !hasExactKeys(raw, expectedKeys)) fail("bad_input", "action input has an unexpected shape");
  if (!TENANT_RE.test(String(raw.tenant))) fail("bad_tenant", "tenant must be a lowercase slug");
  if (!ACTION_KIND_RE.test(String(raw.action_kind))) fail("bad_action_kind", "action_kind must be a bounded canonical identifier");
  if (!isRecord(raw.arguments)) fail("bad_arguments", "arguments must be an object");
  if (!Number.isInteger(raw.graph_version) || Number(raw.graph_version) < 0) {
    fail("bad_graph_version", "graph_version must be a non-negative integer");
  }
  if (!NONCE_RE.test(String(raw.nonce))) fail("bad_nonce", "nonce must be a bounded canonical identifier");
  if (!IDEMPOTENCY_RE.test(String(raw.idempotency_key))) {
    fail("bad_idempotency_key", "idempotency_key must be a bounded canonical identifier");
  }
  const canonicalArguments = canonicalize(raw.arguments);
  if (new TextEncoder().encode(canonicalArguments).byteLength > MAX_ARGUMENT_BYTES) {
    fail("arguments_too_large", "action arguments exceed the canonical size bound");
  }
  scanSensitive(raw, "input");
  return raw as unknown as GateActionCompileInput;
}

async function deriveActionIntent(
  input: GateActionCompileInput,
  identity: GateActionIdentity,
) {
  const argumentDigest = await digestCanonicalJson(input.arguments);
  const tuple = {
    schema: "cambium.mcp.action_identity.v1",
    tenant: input.tenant,
    actor: identity.actor,
    plugin_identity: identity.plugin_identity,
    mcp_identity: identity.mcp_identity,
    issuer: identity.issuer,
    action_kind: input.action_kind,
    argument_digest: argumentDigest,
    graph_version: input.graph_version,
    nonce: input.nonce,
    expiry: input.expiry,
    idempotency_key: input.idempotency_key,
  };
  return {
    ...tuple,
    schema: "cambium.mcp.action_intent.v1" as const,
    action_digest: await digestCanonicalJson(tuple),
    status: "compiled_not_authorized" as const,
    writer_authority: false as const,
    canonical_completion: false as const,
  };
}

export async function compileActionIntent(
  rawInput: GateActionCompileInput,
  identity: GateActionIdentity,
  nowEpochMs = Date.now(),
  options?: { allowExpired?: boolean },
) {
  validateIdentity(identity);
  const input = validateCompileInput(rawInput);
  const expiryEpochMs = exactTimestamp(input.expiry, "expiry");
  if (expiryEpochMs <= nowEpochMs && options?.allowExpired !== true) {
    fail("approval_expired", "approval tuple has expired");
  }
  if (expiryEpochMs - nowEpochMs > MAX_APPROVAL_WINDOW_MS) {
    fail("approval_window_too_long", "approval tuple exceeds the maximum validity window");
  }
  return deriveActionIntent(input, identity);
}

async function readBoundedResponse(response: Response, timeout: Promise<never>): Promise<string> {
  const length = response.headers.get("content-length");
  if (length !== null && (!Number.isFinite(Number(length)) || Number(length) > MAX_RESPONSE_BYTES)) {
    fail("response_too_large", "Gate response exceeds the transport bound");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await Promise.race([reader.read(), timeout]);
      if (part.done) break;
      if (!part.value) continue;
      total += part.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        void reader.cancel("response_too_large").catch(() => undefined);
        fail("response_too_large", "Gate response exceeds the transport bound");
      }
      chunks.push(part.value);
    }
  } catch (error) {
    void reader.cancel("read_failed").catch(() => undefined);
    throw error;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function postGate(
  binding: GateActionBinding,
  path: string,
  body: unknown,
  gateTimeoutMs: number,
  gateAuthorization?: string,
): Promise<unknown> {
  if (!binding || typeof binding.fetch !== "function") fail("gate_unavailable", "Gate adapter binding is unavailable");
  if (!Number.isInteger(gateTimeoutMs) || gateTimeoutMs < 1 || gateTimeoutMs > 30_000) {
    fail("gate_timeout", "Gate timeout is outside the allowed bound");
  }
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new GateActionError("gate_timeout", "Gate adapter timed out"));
    }, gateTimeoutMs);
  });
  let response: Response;
  let raw: string;
  try {
    response = await Promise.race([
      binding.fetch(`https://cambium-gate.internal${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(gateAuthorization ? { Authorization: `Bearer ${gateAuthorization}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }),
      timeout,
    ]);
    if (response.status === 409) fail("idempotency_conflict", "Gate rejected a conflicting or expired request");
    if (response.status === 404) fail("approval_request_not_found", "Gate approval request was not found");
    if (!response.ok) fail("gate_unavailable", "Gate rejected the action request");
    raw = await readBoundedResponse(response, timeout);
  } catch (error) {
    if (error instanceof GateActionError) throw error;
    fail("gate_unavailable", "Gate adapter is unavailable");
  } finally {
    clearTimeout(timeoutHandle!);
  }
  try {
    return JSON.parse(raw);
  } catch {
    fail("malformed_receipt", "Gate returned malformed JSON");
  }
}

function validateReviewIdentity(source: Record<string, unknown>, intent: Awaited<ReturnType<typeof compileActionIntent>>): void {
  if (source.tenant !== intent.tenant
      || source.action_digest !== intent.action_digest
      || source.expiry !== intent.expiry
      || !DIGEST_RE.test(String(source.request_digest))
      || (source.approval_digest !== null && !DIGEST_RE.test(String(source.approval_digest)))) {
    fail("readback_mismatch", "Gate review response does not match the compiled action");
  }
}

export async function requestActionApproval(
  binding: GateActionBinding,
  rawInput: GateActionCompileInput,
  identity: GateActionIdentity,
  nowEpochMs = Date.now(),
  gateTimeoutMs = DEFAULT_GATE_TIMEOUT_MS,
  gateAuthorization?: string,
) {
  const input = validateCompileInput(rawInput);
  const intent = await compileActionIntent(input, identity, nowEpochMs);
  const source = await postGate(binding, "/mcp/actions/request-approval", {
    intent,
    arguments: input.arguments,
  }, gateTimeoutMs, gateAuthorization);
  if (!isRecord(source)
      || !hasExactKeys(source, REVIEW_RESPONSE_KEYS)
      || source.schema !== "cambium.gate.action_review_response.v1"
      || !["awaiting_founder_approval", "approved", "executed"].includes(String(source.status))
      || typeof source.duplicate !== "boolean") {
    fail("malformed_receipt", "Gate review response has an unexpected shape");
  }
  validateReviewIdentity(source, intent);
  return {
    schema: "cambium.mcp.action_review_request.v1" as const,
    status: source.status as "awaiting_founder_approval" | "approved" | "executed",
    duplicate: source.duplicate as boolean,
    tenant: source.tenant as string,
    action_digest: source.action_digest as string,
    request_digest: source.request_digest as string,
    approval_digest: source.approval_digest as string | null,
    expiry: source.expiry as string,
    writer_authority: false as const,
    canonical_completion: false as const,
  };
}

export async function readActionApprovalStatus(
  binding: GateActionBinding,
  rawInput: GateActionCompileInput,
  identity: GateActionIdentity,
  nowEpochMs = Date.now(),
  gateTimeoutMs = DEFAULT_GATE_TIMEOUT_MS,
  gateAuthorization?: string,
) {
  validateIdentity(identity);
  const input = validateCompileInput(rawInput);
  const expiryEpochMs = exactTimestamp(input.expiry, "expiry");
  if (expiryEpochMs - nowEpochMs > MAX_APPROVAL_WINDOW_MS) {
    fail("approval_window_too_long", "approval tuple exceeds the maximum validity window");
  }
  const intent = await deriveActionIntent(input, identity);
  const source = await postGate(binding, "/mcp/actions/approval-status", { intent }, gateTimeoutMs, gateAuthorization);
  if (!isRecord(source)
      || !hasExactKeys(source, REVIEW_STATUS_KEYS)
      || source.schema !== "cambium.gate.action_review_status.v1"
      || !["awaiting_founder_approval", "approved", "executed", "expired"].includes(String(source.status))
      || source.writer_authority !== false
      || source.canonical_completion !== false
      || (source.receipt_digest !== null && !DIGEST_RE.test(String(source.receipt_digest)))) {
    fail("malformed_receipt", "Gate review status has an unexpected shape");
  }
  validateReviewIdentity(source, intent);
  return source as {
    schema: "cambium.gate.action_review_status.v1";
    status: "awaiting_founder_approval" | "approved" | "executed" | "expired";
    tenant: string;
    action_digest: string;
    request_digest: string;
    approval_digest: string | null;
    receipt_digest: string | null;
    expiry: string;
    writer_authority: false;
    canonical_completion: false;
  };
}

function validateReceiptShape(source: unknown): asserts source is Record<string, unknown> {
  if (!isRecord(source) || !hasExactKeys(source, RESPONSE_KEYS)) fail("malformed_receipt", "Gate response has an unexpected shape");
  if (source.schema !== "cambium.gate.action_response.v1" || !["committed", "duplicate"].includes(String(source.status))) {
    fail("malformed_receipt", "Gate response schema or status is invalid");
  }
  if (!isRecord(source.receipt) || !hasExactKeys(source.receipt, RECEIPT_KEYS)) {
    fail("malformed_receipt", "Gate receipt has an unexpected shape");
  }
  const readback = source.receipt.authoritative_readback;
  if (!isRecord(readback) || !hasExactKeys(readback, READBACK_KEYS)) {
    fail("malformed_receipt", "Gate readback has an unexpected shape");
  }
  if (source.receipt.schema !== "cambium.gate.action_receipt.v1"
      || readback.schema !== "cambium.gate.authoritative_readback.v1") {
    fail("malformed_receipt", "Gate receipt schemas are invalid");
  }
}

export async function executeApprovedAction(
  binding: GateActionBinding,
  rawInput: GateActionExecuteInput,
  identity: GateActionIdentity,
  nowEpochMs = Date.now(),
  gateTimeoutMs = DEFAULT_GATE_TIMEOUT_MS,
  gateAuthorization?: string,
) {
  const input = validateCompileInput(rawInput, EXECUTE_KEYS) as GateActionExecuteInput;
  if (!DIGEST_RE.test(String(input.approval_digest))) fail("bad_approval_digest", "approval_digest must be canonical SHA-256");
  const intent = await compileActionIntent({
    tenant: input.tenant,
    action_kind: input.action_kind,
    arguments: input.arguments,
    graph_version: input.graph_version,
    nonce: input.nonce,
    expiry: input.expiry,
    idempotency_key: input.idempotency_key,
  }, identity, nowEpochMs, { allowExpired: true });
  const requestBody = {
    schema: "cambium.mcp.gate_action_request.v1",
    intent,
    approval_digest: input.approval_digest,
  };

  const source = await postGate(binding, "/mcp/actions/execute", requestBody, gateTimeoutMs, gateAuthorization);
  validateReceiptShape(source);
  const receipt = source.receipt as Record<string, unknown>;
  const readback = receipt.authoritative_readback as Record<string, unknown>;
  const expected = {
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
    approval_digest: input.approval_digest,
  };
  const receiptMatches = Object.entries(expected).every(([key, value]) => receipt[key] === value);
  const receiptDigest = receipt.receipt_digest;
  const terminalOutcome = receipt.terminal_outcome;
  if (typeof terminalOutcome === "string") {
    scanSensitive(terminalOutcome, "gate_response.receipt.terminal_outcome");
  }
  const readbackMatches = readback.tenant === expected.tenant
    && readback.actor === expected.actor
    && readback.action_digest === expected.action_digest
    && readback.graph_version === expected.graph_version
    && readback.terminal_outcome === terminalOutcome
    && readback.receipt_digest === receiptDigest;
  if (!receiptMatches
      || receipt.mutation_count !== 1
      || typeof terminalOutcome !== "string"
      || terminalOutcome.length < 1
      || terminalOutcome.length > 128
      || !DIGEST_RE.test(String(receiptDigest))
      || !readbackMatches) {
    fail("readback_mismatch", "Gate receipt does not match authoritative readback");
  }

  return {
    schema: "cambium.mcp.action_receipt.v1" as const,
    status: source.status as "committed" | "duplicate",
    ...expected,
    mutation_count: 1 as const,
    terminal_outcome: terminalOutcome,
    receipt_digest: receiptDigest,
    authoritative_readback: readback,
    execution_authority: "cambium-gate" as const,
    writer_authority: false as const,
    canonical_completion: true as const,
  };
}
