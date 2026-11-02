// Native-founder launch owner contract (cambium.native-launch.v1).
//
// The Mac app asks this owner to launch one exact, already-admitted unit of
// work. Nothing here admits work: an admission row is written by a separate
// owner-approved path and this module only looks it up, revalidates it and
// reserves one durable request against it. Identity comes only from the
// injected per-request verifier. Request bodies never carry principal/tenant.
//
// Three concerns stay separate on every reply:
//   request    — transport/dispatch state of the durable request row
//   execution  — what the execution owner reported through readback
//   acceptance — semantic verdict; never evaluated by this contract
//
// Ordering invariant: the durable request is reserved (atomic current-admission
// CAS + unique scoped insert) BEFORE the execution owner is called, and only the
// caller whose insert won calls `submit`. The owner receives the durable
// requestKey as its idempotency token. A lost owner response becomes `unknown`
// and is resolved through status readback only; no path here re-dispatches.
// Exactly-once external effects additionally require an owner whose `submit`
// is idempotent on that token. This contract does not prove that.

import { sha256 } from './goal-graph/identity.ts';

export const NATIVE_LAUNCH_CONTRACT = 'cambium.native-launch.v1' as const;
export const NATIVE_LAUNCH_PATHS = {
  admissions: '/v1/native/launch/admissions',
  capability: '/v1/native/launch/capability',
  launch: '/v1/native/launch',
  status: '/v1/native/launch/status',
} as const;
export const NATIVE_LAUNCH_PLANTS = ['temperance-hands', 'hermes-remote'] as const;
export const NATIVE_LAUNCH_ACTIONS = ['launch'] as const;
export const NATIVE_LAUNCH_MAX_BODY_BYTES = 4096;
/** Hard cap on one discovery page. One extra row is read only to set `truncated`. */
export const NATIVE_LAUNCH_ADMISSION_LIST_LIMIT = 32;

export type NativeLaunchPlant = typeof NATIVE_LAUNCH_PLANTS[number];
export type NativeLaunchAction = typeof NATIVE_LAUNCH_ACTIONS[number];
export type NativeLaunchDispatch = 'reserved' | 'owner_answered' | 'owner_unknown';
export type NativeLaunchExecutionState =
  | 'unknown' | 'accepted' | 'queued' | 'running' | 'succeeded' | 'failed' | 'refused' | 'busy';
export const NATIVE_LAUNCH_TERMINAL: ReadonlySet<NativeLaunchExecutionState> =
  new Set(['succeeded', 'failed', 'refused', 'busy']);

/** Server-resolved scope. Only the injected verifier produces this. */
export interface NativeLaunchScope { tenantId: string; principalId: string }

/** The exact pinned tuple a client must echo back. */
export interface NativeLaunchCapabilityTuple {
  workId: string;
  admissionRef: string;
  graphVersion: number;
  loadoutId: string;
  inputDigest: string;
  executionPlant: NativeLaunchPlant;
  supportedAction: NativeLaunchAction;
  expiresAt: string;
}

export interface NativeLaunchAdmission extends NativeLaunchCapabilityTuple, NativeLaunchScope {
  status: 'active' | 'revoked';
}

export type NativeLaunchAdmissionHold =
  | 'admission_expired' | 'admission_revoked' | 'graph_changed' | 'admission_consumed';

export interface NativeLaunchAdmissionRead {
  admission: NativeLaunchAdmission;
  /** First reason the admission cannot back a new launch now, if any. */
  hold: NativeLaunchAdmissionHold | null;
  /** Original IDs of the request that already consumed this admission. */
  consumedBy: { requestId: string; attemptId: string } | null;
}

/**
 * One page of already-admitted units for one verified scope and work.
 * `rows` is at most `limit` (the contract cap is 32). `truncated` is true when
 * another matching row exists past that page. Ordering is admissionRef ascending.
 */
export interface NativeLaunchAdmissionList {
  rows: NativeLaunchAdmissionRead[];
  truncated: boolean;
}

export interface NativeLaunchRequestRow extends NativeLaunchScope, NativeLaunchCapabilityTuple {
  requestKey: string;
  requestId: string;
  attemptId: string;
  idempotencyNonce: string;
  requestDigest: string;
  dispatch: NativeLaunchDispatch;
  execution: NativeLaunchExecutionState;
  ownerRef: string | null;
  reservedAt: string;
  observedAt: string | null;
}

export interface NativeLaunchReservation extends NativeLaunchScope {
  requestKey: string;
  requestId: string;
  attemptId: string;
  idempotencyNonce: string;
  requestDigest: string;
  capability: NativeLaunchCapabilityTuple;
  now: string;
}

export type NativeLaunchReserveResult =
  | { status: 'reserved'; row: NativeLaunchRequestRow }
  | { status: 'duplicate'; row: NativeLaunchRequestRow }
  | { status: 'conflict'; code: 'request_changed' | 'attempt_collision' | 'nonce_collision' | 'admission_consumed' }
  | { status: 'refused'; code: 'admission_not_current' | 'pins_changed' | Exclude<NativeLaunchAdmissionHold, 'admission_consumed'> };

export interface NativeLaunchObservation {
  dispatch: Exclude<NativeLaunchDispatch, 'reserved'>;
  execution: NativeLaunchExecutionState;
  ownerRef: string | null;
  observedAt: string;
}

/**
 * Sole request authority. `reserve` MUST revalidate the current admission and
 * insert the scoped request in one atomic step (see native-launch-d1.ts).
 */
export interface NativeLaunchStore {
  readAdmission(scope: NativeLaunchScope, admissionRef: string, now: string): Promise<NativeLaunchAdmissionRead | null>;
  /**
   * Optional. Lists already-admitted units for one verified scope and work.
   * Read only: no insert, renewal, graph write, submit or claim. A store that
   * omits this method cannot serve discovery; the route returns 503.
   */
  listAdmissions?(scope: NativeLaunchScope, workId: string, now: string, limit: number): Promise<NativeLaunchAdmissionList>;
  reserve(input: NativeLaunchReservation): Promise<NativeLaunchReserveResult>;
  readRequest(scope: NativeLaunchScope, requestId: string): Promise<NativeLaunchRequestRow | null>;
  /** Terminal execution states are sticky; returns the row after the write. */
  recordObservation(scope: NativeLaunchScope, requestKey: string, observation: NativeLaunchObservation): Promise<NativeLaunchRequestRow | null>;
}

export interface NativeLaunchOwnerSubmit extends NativeLaunchScope {
  /** Durable request identity; also the owner's idempotency token. */
  requestKey: string;
  idempotencyToken: string;
  requestId: string;
  attemptId: string;
  capability: NativeLaunchCapabilityTuple;
}

export interface NativeLaunchOwnerReport {
  state: Exclude<NativeLaunchExecutionState, 'unknown'> | 'not_found';
  ownerRef?: string;
}

/** Plant-specific execution owner (Temperance Hands or Hermes remote). */
export interface NativeLaunchExecutionOwner {
  supports(plant: NativeLaunchPlant, action: NativeLaunchAction): boolean;
  submit(input: NativeLaunchOwnerSubmit): Promise<NativeLaunchOwnerReport>;
  read(input: NativeLaunchScope & { requestKey: string; executionPlant: NativeLaunchPlant }): Promise<NativeLaunchOwnerReport>;
}

export interface NativeLaunchHost {
  verify(request: Request): Promise<NativeLaunchScope | null>;
  store: NativeLaunchStore;
  owner: NativeLaunchExecutionOwner;
  now(): string;
}

const TENANT = /^[a-z][a-z0-9-]{1,63}$/;
const PRINCIPAL = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,239}$/;
const CLIENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const NONCE = /^[A-Za-z0-9_-]{22,128}$/;
const REF = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const WORK_ID = /^[a-z][a-z0-9-]*:[A-Za-z0-9._:/-]{1,200}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const OWNER_REF = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const TUPLE_KEYS = 'admissionRef,executionPlant,expiresAt,graphVersion,inputDigest,loadoutId,supportedAction,workId';
const OWNER_STATES = new Set(['accepted', 'queued', 'running', 'succeeded', 'failed', 'refused', 'busy', 'not_found']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const keysAre = (value: Record<string, unknown>, keys: string) => Object.keys(value).sort().join(',') === keys;
const isoOk = (value: unknown): value is string => {
  if (typeof value !== 'string' || !ISO.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
};

export function validScope(value: unknown): value is NativeLaunchScope {
  return isRecord(value) && keysAre(value, 'principalId,tenantId')
    && typeof value.tenantId === 'string' && TENANT.test(value.tenantId)
    && typeof value.principalId === 'string' && PRINCIPAL.test(value.principalId);
}

/** Shape check only; plant/action membership is a separate, explicit refusal. */
export function validCapabilityTuple(value: unknown): value is NativeLaunchCapabilityTuple {
  return isRecord(value) && keysAre(value, TUPLE_KEYS)
    && typeof value.workId === 'string' && WORK_ID.test(value.workId)
    && typeof value.admissionRef === 'string' && REF.test(value.admissionRef)
    && Number.isSafeInteger(value.graphVersion) && Number(value.graphVersion) >= 1
    && typeof value.loadoutId === 'string' && REF.test(value.loadoutId)
    && typeof value.inputDigest === 'string' && DIGEST.test(value.inputDigest)
    && typeof value.executionPlant === 'string' && REF.test(value.executionPlant)
    && typeof value.supportedAction === 'string' && REF.test(value.supportedAction)
    && isoOk(value.expiresAt);
}

const knownPlant = (plant: string): plant is NativeLaunchPlant => (NATIVE_LAUNCH_PLANTS as readonly string[]).includes(plant);
const knownAction = (action: string): action is NativeLaunchAction => (NATIVE_LAUNCH_ACTIONS as readonly string[]).includes(action);

/** Scoped durable identity. Same tenant+principal+requestId always maps to one key. */
export function nativeLaunchRequestKey(scope: NativeLaunchScope, requestId: string): string {
  return `nlr_${sha256({ schema: NATIVE_LAUNCH_CONTRACT, tenantId: scope.tenantId, principalId: scope.principalId, requestId })}`;
}

/** Everything the client chose except requestId; a canonical duplicate matches exactly. */
export function nativeLaunchRequestDigest(input: { attemptId: string; idempotencyNonce: string; capability: NativeLaunchCapabilityTuple }): string {
  return `sha256:${sha256({ schema: NATIVE_LAUNCH_CONTRACT, attemptId: input.attemptId, idempotencyNonce: input.idempotencyNonce, capability: input.capability })}`;
}

export function tupleOf(row: NativeLaunchCapabilityTuple): NativeLaunchCapabilityTuple {
  return { workId: row.workId, admissionRef: row.admissionRef, graphVersion: row.graphVersion, loadoutId: row.loadoutId,
    inputDigest: row.inputDigest, executionPlant: row.executionPlant, supportedAction: row.supportedAction, expiresAt: row.expiresAt };
}

/** Returns a host only when every server dependency exists; otherwise routes stay 503. */
export function createNativeLaunchHost(deps: Partial<NativeLaunchHost>): NativeLaunchHost | undefined {
  const { verify, store, owner, now } = deps;
  if (typeof verify !== 'function' || typeof now !== 'function' || !store || !owner
      || typeof store.readAdmission !== 'function' || typeof store.reserve !== 'function'
      || typeof store.readRequest !== 'function' || typeof store.recordObservation !== 'function'
      || typeof owner.supports !== 'function' || typeof owner.submit !== 'function' || typeof owner.read !== 'function') return undefined;
  return { verify, store, owner, now };
}

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const base = { contractVersion: NATIVE_LAUNCH_CONTRACT } as const;
const notEvaluated = { state: 'not_evaluated' } as const;

function ownerReport(value: unknown): NativeLaunchOwnerReport | null {
  if (!isRecord(value) || typeof value.state !== 'string' || !OWNER_STATES.has(value.state)) return null;
  if (Object.keys(value).some(key => key !== 'state' && key !== 'ownerRef')) return null;
  if (value.ownerRef !== undefined && (typeof value.ownerRef !== 'string' || !OWNER_REF.test(value.ownerRef))) return null;
  return value as unknown as NativeLaunchOwnerReport;
}

/** Public projection of a durable row. No principal/tenant echo, no owner internals. */
export function projectRequest(row: NativeLaunchRequestRow) {
  return {
    ...base,
    request: { requestId: row.requestId, attemptId: row.attemptId, requestKey: row.requestKey, dispatch: row.dispatch,
      reservedAt: row.reservedAt, capability: tupleOf(row) },
    execution: { state: row.execution, ownerRef: row.ownerRef, observedAt: row.observedAt,
      terminal: NATIVE_LAUNCH_TERMINAL.has(row.execution) },
    acceptance: notEvaluated,
    retry: NATIVE_LAUNCH_TERMINAL.has(row.execution) ? 'none' : 'status_only',
  };
}

type Parsed = { scope: NativeLaunchScope; input: Record<string, unknown> } | Response;

/** Shared transport gate: method, media type, byte bound, verified identity, then JSON. */
async function admit(request: Request, host: NativeLaunchHost | undefined, path: string): Promise<Parsed> {
  if (!host) return reply(503, { ...base, error: 'native_launch_unconfigured',
    message: 'Native launch requires a verified identity binding, the D1 request store and a configured execution owner.' });
  if (new URL(request.url).pathname !== path) return reply(404, { ...base, error: 'not_found' });
  if (request.method !== 'POST') return reply(405, { ...base, error: 'post_required' });
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply(415, { ...base, error: 'json_required' });
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > NATIVE_LAUNCH_MAX_BODY_BYTES) return reply(413, { ...base, error: 'input_too_large' });
  const text = await request.clone().text();
  if (new TextEncoder().encode(text).length > NATIVE_LAUNCH_MAX_BODY_BYTES) return reply(413, { ...base, error: 'input_too_large' });
  const scope = await host.verify(request);
  if (!validScope(scope)) return reply(401, { ...base, status: 'unauthorized' });
  let input: unknown;
  try { input = JSON.parse(text); } catch { return reply(400, { ...base, status: 'invalid', error: 'invalid_json' }); }
  if (!isRecord(input) || input.contractVersion !== NATIVE_LAUNCH_CONTRACT) return reply(400, { ...base, status: 'invalid', error: 'contract_version' });
  return { scope: { tenantId: scope.tenantId, principalId: scope.principalId }, input };
}

const unknownReply = () => reply(503, { ...base, status: 'unknown', retry: 'status_only' });

export type NativeLaunchAdmissionAvailability = 'supported' | 'unsupported' | 'unavailable';

/**
 * Current categorical availability of one admission read. Same rules as the
 * capability route: owner support, then the store hold. No work-status or
 * transport inference. `owner_does_not_support` wins over a hold.
 */
export function admissionAvailability(
  found: NativeLaunchAdmissionRead,
  owner: NativeLaunchExecutionOwner,
): { availability: NativeLaunchAdmissionAvailability; reason: string } {
  const tuple = tupleOf(found.admission);
  if (!knownPlant(tuple.executionPlant) || !knownAction(tuple.supportedAction)
      || !owner.supports(tuple.executionPlant, tuple.supportedAction)) {
    return { availability: 'unsupported', reason: 'owner_does_not_support' };
  }
  if (found.hold) return { availability: 'unavailable', reason: found.hold };
  return { availability: 'supported', reason: 'current' };
}

/**
 * POST /v1/native/launch/admissions {contractVersion, workId} — read only.
 * Lists already-admitted units for the verified scope. Never creates or renews
 * an admission, changes the graph, submits, or claims an owner job.
 */
export async function nativeLaunchAdmissionsHttp(request: Request, host?: NativeLaunchHost): Promise<Response> {
  try {
    const parsed = await admit(request, host, NATIVE_LAUNCH_PATHS.admissions);
    if (parsed instanceof Response) return parsed;
    const { scope, input } = parsed;
    if (!keysAre(input, 'contractVersion,workId') || typeof input.workId !== 'string' || !WORK_ID.test(input.workId)) {
      return reply(400, { ...base, status: 'invalid' });
    }
    const listAdmissions = host!.store.listAdmissions;
    // A store without a listing method must not look like an empty work.
    if (typeof listAdmissions !== 'function') {
      return reply(503, { ...base, error: 'native_launch_listing_unconfigured',
        message: 'Native launch admission discovery requires a store that can list the verified scope.' });
    }
    const page = await listAdmissions.call(host!.store, scope, input.workId, host!.now(), NATIVE_LAUNCH_ADMISSION_LIST_LIMIT);
    // A listing that does not return a row array and a boolean truncation is unavailable, never an empty work.
    if (!Array.isArray(page?.rows) || typeof page.truncated !== 'boolean') {
      return reply(503, { ...base, error: 'native_launch_listing_unavailable',
        message: 'Native launch admission discovery could not read a complete page.' });
    }
    const rows = page.rows;
    if (rows.length > NATIVE_LAUNCH_ADMISSION_LIST_LIMIT) return unknownReply();
    const admissions = [];
    const seen = new Set<string>();
    for (const found of rows) {
      if (!found?.admission || found.admission.workId !== input.workId
          || found.admission.tenantId !== scope.tenantId || found.admission.principalId !== scope.principalId) continue;
      if (seen.has(found.admission.admissionRef)) continue;
      seen.add(found.admission.admissionRef);
      const availability = admissionAvailability(found, host!.owner);
      admissions.push({
        admissionRef: found.admission.admissionRef,
        tuple: tupleOf(found.admission),
        availability: availability.availability,
        reason: availability.reason,
        ...(found.consumedBy ? { existingRequest: found.consumedBy } : {}),
      });
    }
    return reply(200, {
      ...base, workId: input.workId, readOnly: true, admissions, truncated: page.truncated === true,
    });
  } catch { return unknownReply(); }
}

/** POST /v1/native/launch/capability {contractVersion, admissionRef, workId} — read only. */
export async function nativeLaunchCapabilityHttp(request: Request, host?: NativeLaunchHost): Promise<Response> {
  try {
    const parsed = await admit(request, host, NATIVE_LAUNCH_PATHS.capability);
    if (parsed instanceof Response) return parsed;
    const { scope, input } = parsed;
    if (!keysAre(input, 'admissionRef,contractVersion,workId') || typeof input.admissionRef !== 'string' || !REF.test(input.admissionRef)
        || typeof input.workId !== 'string' || !WORK_ID.test(input.workId)) return reply(400, { ...base, status: 'invalid' });
    const found = await host!.store.readAdmission(scope, input.admissionRef, host!.now());
    // Foreign, missing and mismatched admissions are indistinguishable.
    if (!found || found.admission.workId !== input.workId || found.admission.tenantId !== scope.tenantId
        || found.admission.principalId !== scope.principalId) return reply(200, { ...base, capability: 'unavailable', reason: 'no_admission' });
    const tuple = tupleOf(found.admission);
    const availability = admissionAvailability(found, host!.owner);
    if (availability.availability === 'unsupported') {
      return reply(200, { ...base, capability: 'unsupported', reason: availability.reason, tuple });
    }
    if (availability.availability === 'unavailable') {
      return reply(200, { ...base, capability: 'unavailable', reason: availability.reason,
        ...(found.consumedBy ? { existingRequest: found.consumedBy } : {}) });
    }
    return reply(200, { ...base, capability: 'supported', tuple, acceptance: notEvaluated });
  } catch { return unknownReply(); }
}

/** POST /v1/native/launch — reserve durably, then call the owner exactly from the winning reservation. */
export async function nativeLaunchRequestHttp(request: Request, host?: NativeLaunchHost): Promise<Response> {
  let parsed: Parsed;
  try { parsed = await admit(request, host, NATIVE_LAUNCH_PATHS.launch); } catch { return unknownReply(); }
  if (parsed instanceof Response) return parsed;
  const { scope, input } = parsed;
  const h = host!;
  if (!keysAre(input, 'attemptId,capability,contractVersion,idempotencyNonce,requestId')
      || typeof input.requestId !== 'string' || !CLIENT_ID.test(input.requestId)
      || typeof input.attemptId !== 'string' || !CLIENT_ID.test(input.attemptId)
      || typeof input.idempotencyNonce !== 'string' || !NONCE.test(input.idempotencyNonce)
      || !validCapabilityTuple(input.capability)) return reply(400, { ...base, status: 'invalid' });
  const capability = tupleOf(input.capability as NativeLaunchCapabilityTuple);
  if (!knownPlant(capability.executionPlant) || !knownAction(capability.supportedAction)
      || !h.owner.supports(capability.executionPlant, capability.supportedAction)) {
    return reply(409, { ...base, status: 'refused', code: 'unsupported_plant_or_action', acceptance: notEvaluated });
  }
  const requestKey = nativeLaunchRequestKey(scope, input.requestId);
  const reservation: NativeLaunchReservation = {
    ...scope, requestKey, requestId: input.requestId, attemptId: input.attemptId,
    idempotencyNonce: input.idempotencyNonce, capability,
    requestDigest: nativeLaunchRequestDigest({ attemptId: input.attemptId, idempotencyNonce: input.idempotencyNonce, capability }),
    now: h.now(),
  };
  let reserved: NativeLaunchReserveResult;
  // A store failure here may or may not have committed; the owner is not called
  // and the client recovers by status, or by resending the same original IDs.
  try { reserved = await h.store.reserve(reservation); } catch { return unknownReply(); }
  if (reserved.status === 'refused' || reserved.status === 'conflict') {
    return reply(409, { ...base, status: reserved.status, code: reserved.code, acceptance: notEvaluated });
  }
  if (reserved.status === 'duplicate') return reply(200, { ...projectRequest(reserved.row), status: 'duplicate' });
  const row = reserved.row;
  if (row.requestKey !== requestKey || row.tenantId !== scope.tenantId || row.principalId !== scope.principalId) return unknownReply();
  let report: NativeLaunchOwnerReport | null = null;
  try {
    report = ownerReport(await h.owner.submit({ ...scope, requestKey, idempotencyToken: requestKey,
      requestId: row.requestId, attemptId: row.attemptId, capability: tupleOf(row) }));
  } catch { report = null; }
  // `not_found` from submit is not a meaningful acceptance; treat as unknown.
  const observation: NativeLaunchObservation = report && report.state !== 'not_found'
    ? { dispatch: 'owner_answered', execution: report.state, ownerRef: report.ownerRef ?? null, observedAt: h.now() }
    : { dispatch: 'owner_unknown', execution: 'unknown', ownerRef: null, observedAt: h.now() };
  let after: NativeLaunchRequestRow | null = null;
  try { after = await h.store.recordObservation(scope, requestKey, observation); } catch { after = null; }
  // If the observation write fails the durable row still reads `reserved`,
  // which status treats as unknown and reconciles through owner readback.
  const shown = after ?? { ...row, ...observation, dispatch: 'owner_unknown' as const, execution: 'unknown' as const };
  const code = shown.execution === 'unknown' ? 503 : shown.execution === 'busy' ? 429 : shown.execution === 'refused' ? 409 : 202;
  return reply(code, { ...projectRequest(shown), status: shown.execution === 'unknown' ? 'unknown' : 'recorded' });
}

/** POST /v1/native/launch/status {contractVersion, requestId, attemptId} — readback only, never dispatches. */
export async function nativeLaunchStatusHttp(request: Request, host?: NativeLaunchHost): Promise<Response> {
  try {
    const parsed = await admit(request, host, NATIVE_LAUNCH_PATHS.status);
    if (parsed instanceof Response) return parsed;
    const { scope, input } = parsed;
    const h = host!;
    if (!keysAre(input, 'attemptId,contractVersion,requestId') || typeof input.requestId !== 'string' || !CLIENT_ID.test(input.requestId)
        || typeof input.attemptId !== 'string' || !CLIENT_ID.test(input.attemptId)) return reply(400, { ...base, status: 'invalid' });
    const row = await h.store.readRequest(scope, input.requestId);
    // Rows are scoped by tenant+principal in the store; foreign rows read as absent.
    if (!row || row.tenantId !== scope.tenantId || row.principalId !== scope.principalId
        || row.requestKey !== nativeLaunchRequestKey(scope, input.requestId)) return reply(404, { ...base, status: 'not_found' });
    if (row.attemptId !== input.attemptId) return reply(409, { ...base, status: 'conflict', code: 'attempt_mismatch' });
    if (NATIVE_LAUNCH_TERMINAL.has(row.execution)) return reply(200, { ...projectRequest(row), status: 'observed' });
    let report: NativeLaunchOwnerReport | null = null;
    try { report = ownerReport(await h.owner.read({ ...scope, requestKey: row.requestKey, executionPlant: row.executionPlant })); }
    catch { report = null; }
    if (!report) return reply(503, { ...projectRequest(row), status: 'readback_unavailable' });
    // The owner not knowing the token proves nothing about a lost submit (it may
    // still arrive). Nothing is written and nothing is dispatched.
    if (report.state === 'not_found') return reply(200, { ...projectRequest(row), status: 'owner_not_found' });
    const observation: NativeLaunchObservation =
      { dispatch: 'owner_answered', execution: report.state, ownerRef: report.ownerRef ?? row.ownerRef, observedAt: h.now() };
    const after = await h.store.recordObservation(scope, row.requestKey, observation);
    if (!after) return unknownReply();
    return reply(200, { ...projectRequest(after), status: 'observed' });
  } catch { return unknownReply(); }
}

/** Router for the native launch paths; any other path is not this owner's. */
export async function nativeLaunchHttp(request: Request, host?: NativeLaunchHost): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === NATIVE_LAUNCH_PATHS.admissions) return nativeLaunchAdmissionsHttp(request, host);
  if (path === NATIVE_LAUNCH_PATHS.capability) return nativeLaunchCapabilityHttp(request, host);
  if (path === NATIVE_LAUNCH_PATHS.launch) return nativeLaunchRequestHttp(request, host);
  if (path === NATIVE_LAUNCH_PATHS.status) return nativeLaunchStatusHttp(request, host);
  return reply(404, { ...base, error: 'not_found' });
}
