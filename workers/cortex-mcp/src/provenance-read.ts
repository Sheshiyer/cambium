export interface ProvenanceReaderBinding {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

export const INFINITE_GAME_NODE_KINDS = [
  "vision",
  "mission",
  "isa_criterion",
  "gsd_task",
  "d1_task",
  "run",
  "receipt",
  "cortex_learning",
] as const;

export type InfiniteGameNodeKind = typeof INFINITE_GAME_NODE_KINDS[number];

export interface InfiniteGameReadInput {
  tenant: string;
  node_kind: InfiniteGameNodeKind;
  node_id: string;
  graph_version?: string;
  max_bytes?: number;
}

export class ProvenanceReadError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ProvenanceReadError";
    this.code = code;
  }
}

const DIGEST_RE = /^sha256:[a-f0-9]{64}$/;
const TENANT_RE = /^[a-z][a-z0-9-]{1,63}$/;
const NODE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/;
const GRAPH_VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SOURCE_VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/;
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SOURCE_REFERENCE_RE = /^(repo:[A-Za-z0-9][A-Za-z0-9._/-]{0,511}|d1:[A-Za-z0-9][A-Za-z0-9._:-]{0,255}|run:[A-Za-z0-9][A-Za-z0-9._:-]{0,255}|receipt:sha256:[a-f0-9]{64}|cortex:[A-Za-z0-9][A-Za-z0-9._:-]{0,255})$/;
const SENSITIVE_FIELD_RE = /(api[_-]?key|secret|token|password|credential|bearer|prompt(_body)?|response(_body)?|native[_-]?session|session[_-]?id|absolute[_-]?path|home[_-]?dir|env[_-]?file)/i;
const SECRET_VALUE_RE = new RegExp(
  "(?:" + ["s", "k", "-"].join("") + "[a-z0-9-]{6,}|xox[abpsr]-[a-z0-9-]{10,}|(?:github_pat|gh[pousr])_[a-z0-9_]{20,}|(?:" + ["B", "earer"].join("") + "|Basic)\\s+\\S+)",
  "i"
);
const MACHINE_PATH_RE = /(?:file:\/\/\/|(?:^|[^A-Za-z0-9/])\/\/[A-Za-z0-9._-]+\/\S+|(?:^|[^A-Za-z0-9/])\/(?:Users|home|Volumes|private|var|tmp|etc|opt|srv|root|mnt|data|workspace)(?:\/\S*|\b)|(?:^|[^A-Za-z0-9/])\/(?!\/)[^\s/]+\/\S+|(?:^|[^A-Za-z0-9])[A-Za-z]:\\\S+|\\\\[^\\\s]+\\\S+)/i;
const MAX_BODY_BYTES = 65_536;
const MAX_UPSTREAM_BYTES = 131_072;
const DEFAULT_READER_TIMEOUT_MS = 5_000;
const MAX_OBSERVATION_AGE_MS = 24 * 60 * 60 * 1_000;
const MAX_FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1_000;

const AUTHORITY_BY_KIND: Record<InfiniteGameNodeKind, ReadonlySet<string>> = {
  vision: new Set(["vision"]),
  mission: new Set(["mission"]),
  isa_criterion: new Set(["isa"]),
  gsd_task: new Set(["gsd"]),
  d1_task: new Set(["d1"]),
  run: new Set(["d1", "hermes"]),
  receipt: new Set(["d1", "hermes", "cambium_gate"]),
  cortex_learning: new Set(["cortex"]),
};

const REFERENCE_SCHEMES_BY_AUTHORITY: Record<string, ReadonlySet<string>> = {
  vision: new Set(["repo"]),
  mission: new Set(["repo"]),
  isa: new Set(["repo"]),
  gsd: new Set(["repo"]),
  d1: new Set(["d1", "receipt"]),
  hermes: new Set(["run", "receipt"]),
  cambium_gate: new Set(["receipt"]),
  cortex: new Set(["cortex"]),
};

const SOURCE_RECORD_KEYS = new Set([
  "schema",
  "tenant",
  "node_kind",
  "node_id",
  "source_authority",
  "source_reference",
  "source_version",
  "graph_version",
  "observed_at",
  "stale_after",
  "content_digest",
  "omissions",
  "body",
]);

function fail(code: string, message: string): never {
  throw new ProvenanceReadError(code, message);
}

function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("malformed_source", "non-finite number in source body");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
  }
  fail("malformed_source", `unsupported source value: ${typeof value}`);
}

export async function digestCanonicalJson(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function validateReadInput(input: InfiniteGameReadInput): Required<Omit<InfiniteGameReadInput, "graph_version">> & { graph_version?: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("bad_input", "read input must be an object");
  }
  const allowed = new Set(["tenant", "node_kind", "node_id", "graph_version", "max_bytes"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) fail("bad_input", "read input contains unknown fields");
  if (!TENANT_RE.test(input.tenant)) fail("bad_tenant", "tenant must be a lowercase slug");
  if (!(INFINITE_GAME_NODE_KINDS as readonly string[]).includes(input.node_kind)) fail("bad_node_kind", "node_kind is not supported");
  if (!NODE_ID_RE.test(input.node_id) || input.node_id.includes("..") || input.node_id.includes("//")) {
    fail("bad_node_id", "node_id must be a bounded canonical identifier");
  }
  if (input.graph_version !== undefined && !GRAPH_VERSION_RE.test(input.graph_version)) {
    fail("bad_graph_version", "graph_version must be a bounded canonical identifier");
  }
  const maxBytes = input.max_bytes ?? 16_384;
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_BODY_BYTES) {
    fail("bad_max_bytes", `max_bytes must be an integer from 1 to ${MAX_BODY_BYTES}`);
  }
  return { ...input, max_bytes: maxBytes };
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

function parseTimestamp(value: unknown, field: string): number {
  if (typeof value !== "string" || !ISO_UTC_RE.test(value)) fail("bad_freshness", `${field} must be strict UTC ISO`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail("bad_freshness", `${field} must be a valid instant`);
  if (new Date(parsed).toISOString() !== value) fail("bad_freshness", `${field} must be an exact calendar instant`);
  return parsed;
}

async function readBoundedResponse(
  response: Response,
  timeout: Promise<never>
): Promise<string> {
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null) {
    const declaredLength = Number(lengthHeader);
    if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_UPSTREAM_BYTES) {
      fail("response_too_large", "provenance reader response exceeds the transport bound");
    }
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await Promise.race([reader.read(), timeout]);
      if (result.done) break;
      if (!result.value) continue;
      total += result.value.byteLength;
      if (total > MAX_UPSTREAM_BYTES) {
        void reader.cancel("response_too_large").catch(() => undefined);
        fail("response_too_large", "provenance reader response exceeds the transport bound");
      }
      chunks.push(result.value);
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
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
}

function validateSourceReference(value: unknown): asserts value is string {
  if (typeof value !== "string" || !SOURCE_REFERENCE_RE.test(value) || value.includes("..") || value.includes("//")) {
    fail("bad_source_reference", "source_reference must be a canonical repository or authority identifier");
  }
}

function validateOmissions(value: unknown): Array<{ field: string; reason: string }> {
  if (!Array.isArray(value) || value.length > 32) fail("malformed_source", "omissions must be a bounded array");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail("malformed_source", `omissions[${index}] must be an object`);
    const record = entry as Record<string, unknown>;
    if (Object.keys(record).some((key) => !["field", "reason"].includes(key))) fail("malformed_source", `omissions[${index}] has unknown fields`);
    if (typeof record.field !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(record.field)) {
      fail("malformed_source", `omissions[${index}].field is invalid`);
    }
    if (SENSITIVE_FIELD_RE.test(record.field)) fail("sensitive_content", `sensitive omission field rejected at omissions[${index}]`);
    if (typeof record.reason !== "string" || record.reason.length < 1 || record.reason.length > 160) {
      fail("malformed_source", `omissions[${index}].reason is invalid`);
    }
    scanSensitive(record.reason, `omissions[${index}].reason`);
    return { field: record.field, reason: record.reason };
  });
}

export async function readInfiniteGameNode(
  binding: ProvenanceReaderBinding,
  rawInput: InfiniteGameReadInput,
  nowEpochMs = Date.now(),
  readerTimeoutMs = DEFAULT_READER_TIMEOUT_MS
) {
  if (!binding || typeof binding.fetch !== "function") fail("read_plane_unavailable", "provenance reader binding is unavailable");
  const input = validateReadInput(rawInput);
  if (!Number.isInteger(readerTimeoutMs) || readerTimeoutMs < 1 || readerTimeoutMs > 30_000) {
    fail("reader_timeout", "reader timeout is outside the allowed bound");
  }

  let response: Response;
  let timeoutHandle: ReturnType<typeof setTimeout>;
  const controller = new AbortController();
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new ProvenanceReadError("reader_timeout", "provenance reader timed out"));
    }, readerTimeoutMs);
  });
  let raw: string;
  try {
    response = await Promise.race([
      binding.fetch("https://cambium-provenance.internal/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      }),
      timeout,
    ]);
    if (!response.ok) fail("reader_unavailable", "provenance reader rejected the request");
    raw = await readBoundedResponse(response, timeout);
  } catch (error) {
    if (error instanceof ProvenanceReadError) throw error;
    fail("reader_unavailable", "provenance reader is unavailable");
  } finally {
    clearTimeout(timeoutHandle!);
  }
  let source: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    source = parsed;
  } catch {
    fail("malformed_source", "provenance reader returned malformed JSON");
  }
  if (Object.keys(source).length !== SOURCE_RECORD_KEYS.size || Object.keys(source).some((key) => !SOURCE_RECORD_KEYS.has(key))) {
    fail("malformed_source", "provenance source has an unexpected shape");
  }
  if (source.schema !== "cambium.provenance_source.v1") fail("malformed_source", "provenance source schema is unsupported");
  if (source.tenant !== input.tenant) fail("cross_tenant", "provenance source tenant does not match the authorized request");
  if (source.node_kind !== input.node_kind || source.node_id !== input.node_id) {
    fail("identity_mismatch", "provenance source identity does not match the request");
  }
  if (typeof source.source_authority !== "string" || !AUTHORITY_BY_KIND[input.node_kind].has(source.source_authority)) {
    fail("authority_mismatch", "source authority cannot own the requested node kind");
  }
  validateSourceReference(source.source_reference);
  const referenceScheme = source.source_reference.split(":", 1)[0];
  if (!REFERENCE_SCHEMES_BY_AUTHORITY[source.source_authority].has(referenceScheme)) {
    fail("bad_source_reference", "source_reference scheme does not match source authority");
  }
  if (typeof source.source_version !== "string" || !SOURCE_VERSION_RE.test(source.source_version) || source.source_version.includes("..")) {
    fail("malformed_source", "source_version must be a bounded canonical identifier");
  }
  if (source.graph_version !== null && source.graph_version !== undefined && (typeof source.graph_version !== "string" || !GRAPH_VERSION_RE.test(source.graph_version))) {
    fail("malformed_source", "graph_version must be null or a canonical identifier");
  }
  if (input.graph_version !== undefined && source.graph_version !== input.graph_version) {
    fail("graph_version_mismatch", "source graph version does not match the requested version");
  }

  const observedAt = parseTimestamp(source.observed_at, "observed_at");
  const staleAfter = parseTimestamp(source.stale_after, "stale_after");
  if (observedAt > nowEpochMs) fail("future_source", "source observation is in the future");
  if (nowEpochMs - observedAt > MAX_OBSERVATION_AGE_MS) fail("stale_observation", "source observation is too old");
  if (staleAfter <= observedAt) fail("bad_freshness", "stale_after must be later than observed_at");
  if (staleAfter - observedAt > MAX_FRESHNESS_WINDOW_MS) {
    fail("freshness_window_too_long", "source freshness window exceeds policy");
  }
  if (staleAfter <= nowEpochMs) fail("stale_source", "source evidence is stale");

  if (!source.body || typeof source.body !== "object" || Array.isArray(source.body)) {
    fail("malformed_source", "source body must be an object");
  }
  scanSensitive(source.body, "body");
  const bodyBytes = new TextEncoder().encode(canonicalize(source.body)).byteLength;
  if (bodyBytes > input.max_bytes) fail("body_too_large", "source body exceeds max_bytes");
  if (typeof source.content_digest !== "string" || !DIGEST_RE.test(source.content_digest)) {
    fail("malformed_source", "content_digest must be a canonical SHA-256 digest");
  }
  const computedDigest = await digestCanonicalJson(source.body);
  if (computedDigest !== source.content_digest) fail("digest_mismatch", "source body digest does not match content_digest");
  const omissions = validateOmissions(source.omissions);

  const envelope = {
    schema: "cambium.mcp.read_envelope.v1",
    tenant: input.tenant,
    node_kind: input.node_kind,
    node_id: input.node_id,
    source_authority: source.source_authority,
    source_reference: source.source_reference,
    source_version: source.source_version,
    graph_version: source.graph_version ?? null,
    content_digest: source.content_digest,
    freshness: {
      observed_at: source.observed_at,
      stale_after: source.stale_after,
      status: "fresh",
    },
    omissions,
    body: source.body,
    writer_authority: false,
    canonical_completion: false,
  };
  scanSensitive(envelope, "envelope");
  return envelope;
}
