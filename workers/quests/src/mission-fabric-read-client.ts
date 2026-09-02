// Phase G · live Cambium reads — Mission Fabric projection read client.
//
// Reads-only client for the authenticated, bounded, read-only operating-fabric
// composition route:
//
//   GET /v1/mission-fabric/{tenant}  ->  MissionFabricProjectionV1
//
// Design invariants (per the Phase G plan, verified against the live Worker
// contract in mission-fabric.ts and wrangler.labs.jsonc):
//
//   * Feature-flagged. When CAMBIUM_LIVE_READS is not enabled the client never
//     performs network I/O; it returns a bounded "gap result" so callers keep
//     running against fixtures.
//   * Graceful degradation. Any transport failure, auth failure (401/403),
//     non-200, malformed body, tenant mismatch, cap violation, or digest
//     mismatch resolves to a gap result — never a thrown error or a crash.
//   * Integrity-checked. The response projection's stable content is re-hashed
//     with the Worker's own projectionDigest() and compared to graphDigest.
//   * Bounded. Node/edge/gap counts are checked against MISSION_FABRIC_CAPS.
//
// This module performs NO writes. The D1 Goal Graph write/CAS path (Phase H)
// and execution foldback (Phase I) are deliberately out of scope here.

import {
  MISSION_FABRIC_CAPS,
  projectionDigest,
  type MissionFabricProjectionV1,
} from './mission-fabric.ts';

/** Minimal fetch surface so tests can inject a fake without a network. */
export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  },
) => Promise<{
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

/**
 * How the client authenticates the read hop. The live founder/viewer
 * mission-fabric route is guarded by Cloudflare Access
 * (`cf-access-jwt-assertion`); a server-to-server bridge hop may instead carry
 * a service token via the two `cf-access-client-*` headers. The client is
 * agnostic: it forwards whatever headers the caller supplies.
 */
export interface MissionFabricAuth {
  /** Extra request headers (e.g. Cloudflare Access service-token pair). */
  headers?: Record<string, string>;
}

export interface MissionFabricReadConfig {
  /** e.g. "https://curious.thoughtseed.space" (thoughtseed-labs profile). */
  baseUrl: string;
  /** Tenant path segment for /v1/mission-fabric/{tenant}. */
  tenantId: string;
  /** Master feature flag. When false/undefined the client stays offline. */
  liveReads: boolean;
  auth?: MissionFabricAuth;
  /** Injected fetch (defaults to global fetch when live). */
  fetchImpl?: FetchLike;
  /** Per-request timeout in ms. Defaults to 10_000. */
  timeoutMs?: number;
}

export type GapReason =
  | 'live-reads-disabled'
  | 'transport-error'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'bad-status'
  | 'malformed-body'
  | 'schema-mismatch'
  | 'tenant-mismatch'
  | 'cap-exceeded'
  | 'digest-mismatch';

export interface MissionFabricGapResult {
  ok: false;
  kind: 'gap';
  reason: GapReason;
  detail: string;
  tenantId: string;
  /** HTTP status when a response was received. */
  status?: number;
}

export interface MissionFabricOkResult {
  ok: true;
  kind: 'projection';
  tenantId: string;
  graphVersion: number;
  graphDigest: string;
  projection: MissionFabricProjectionV1;
}

export type MissionFabricReadResult = MissionFabricOkResult | MissionFabricGapResult;

function gap(
  tenantId: string,
  reason: GapReason,
  detail: string,
  status?: number,
): MissionFabricGapResult {
  return { ok: false, kind: 'gap', reason, detail, tenantId, status };
}

/** Build the canonical read URL. Tenant is path-encoded. */
export function missionFabricUrl(baseUrl: string, tenantId: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/v1/mission-fabric/${encodeURIComponent(tenantId)}`;
}

/**
 * Validate an already-parsed value as a MissionFabricProjectionV1 with the
 * live caps and digest. Pure (no I/O), so it is reused for both the network
 * path and any local/fixture verification. Returns an ok result or a gap.
 */
export function verifyMissionFabricProjection(
  tenantId: string,
  body: unknown,
): MissionFabricReadResult {
  if (body === null || typeof body !== 'object') {
    return gap(tenantId, 'malformed-body', 'response body is not an object');
  }
  const record = body as Record<string, unknown>;

  // The Worker may wrap the projection ({ projection: {...} }) or return it
  // at top level. Accept either shape.
  const candidate = (
    'schema' in record ? record : (record as { projection?: unknown }).projection
  ) as Record<string, unknown> | undefined;

  if (!candidate || typeof candidate !== 'object') {
    return gap(tenantId, 'malformed-body', 'no projection object in response');
  }

  if (candidate.schema !== 'cambium.mission-fabric-projection.v1') {
    return gap(
      tenantId,
      'schema-mismatch',
      `unexpected schema: ${String(candidate.schema)}`,
    );
  }
  if (candidate.projectionVersion !== 1) {
    return gap(
      tenantId,
      'schema-mismatch',
      `unexpected projectionVersion: ${String(candidate.projectionVersion)}`,
    );
  }
  if (candidate.sourceOfTruth !== 'd1-goal-graph' || candidate.readOnly !== true) {
    return gap(
      tenantId,
      'schema-mismatch',
      'projection is not a read-only d1-goal-graph projection',
    );
  }
  if (candidate.tenantId !== tenantId) {
    return gap(
      tenantId,
      'tenant-mismatch',
      `projection tenant ${String(candidate.tenantId)} != requested ${tenantId}`,
    );
  }

  const nodes = candidate.nodes;
  const edges = candidate.edges;
  const gaps = candidate.gaps;
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(gaps)) {
    return gap(tenantId, 'malformed-body', 'nodes/edges/gaps must be arrays');
  }
  if (nodes.length > MISSION_FABRIC_CAPS.MAX_NODES) {
    return gap(tenantId, 'cap-exceeded', `nodes ${nodes.length} > ${MISSION_FABRIC_CAPS.MAX_NODES}`);
  }
  if (edges.length > MISSION_FABRIC_CAPS.MAX_EDGES) {
    return gap(tenantId, 'cap-exceeded', `edges ${edges.length} > ${MISSION_FABRIC_CAPS.MAX_EDGES}`);
  }
  if (gaps.length > MISSION_FABRIC_CAPS.MAX_GAPS) {
    return gap(tenantId, 'cap-exceeded', `gaps ${gaps.length} > ${MISSION_FABRIC_CAPS.MAX_GAPS}`);
  }

  const projection = candidate as unknown as MissionFabricProjectionV1;

  // Re-hash the stable content with the Worker's own digest and compare to the
  // advertised graphDigest. This is the integrity gate: a projection that does
  // not hash to its own claimed digest is not trustworthy.
  const recomputed = projectionDigest(projection);
  if (recomputed !== projection.graphDigest) {
    return gap(
      tenantId,
      'digest-mismatch',
      `recomputed ${recomputed} != advertised ${projection.graphDigest}`,
    );
  }

  return {
    ok: true,
    kind: 'projection',
    tenantId,
    graphVersion: projection.graphVersion,
    graphDigest: projection.graphDigest,
    projection,
  };
}

/**
 * Read the Mission Fabric projection for a tenant. Never throws: every failure
 * mode resolves to a gap result so callers degrade gracefully to fixtures.
 */
export async function readMissionFabric(
  config: MissionFabricReadConfig,
): Promise<MissionFabricReadResult> {
  const { tenantId } = config;

  if (!config.liveReads) {
    return gap(tenantId, 'live-reads-disabled', 'CAMBIUM_LIVE_READS is not enabled');
  }

  const fetchImpl = config.fetchImpl ?? (globalThis.fetch as unknown as FetchLike | undefined);
  if (typeof fetchImpl !== 'function') {
    return gap(tenantId, 'transport-error', 'no fetch implementation available');
  }

  const url = missionFabricUrl(config.baseUrl, tenantId);
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...(config.auth?.headers ?? {}),
  };

  const timeoutMs = config.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(url, { method: 'GET', headers, signal: controller.signal });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return gap(
      tenantId,
      aborted ? 'timeout' : 'transport-error',
      aborted ? `request exceeded ${timeoutMs}ms` : `fetch failed: ${describeError(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    return gap(tenantId, 'unauthorized', 'authentication required or invalid', 401);
  }
  if (response.status === 403) {
    return gap(tenantId, 'forbidden', 'not authorized for this tenant', 403);
  }
  if (response.status === 404) {
    return gap(tenantId, 'not-found', 'tenant or route not found', 404);
  }
  if (response.status !== 200) {
    return gap(tenantId, 'bad-status', `unexpected status ${response.status}`, response.status);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    return gap(tenantId, 'malformed-body', `invalid JSON: ${describeError(err)}`, 200);
  }

  const verified = verifyMissionFabricProjection(tenantId, body);
  if (!verified.ok) {
    return { ...verified, status: 200 };
  }
  return verified;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
