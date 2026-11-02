// D1 request authority for the native launch owner contract.
//
// Reservation is ONE conditional INSERT ... SELECT. Its WHERE clause is the
// current-admission compare-and-swap: the row is written only if, at the moment
// of the write, the scoped admission is active, unexpired, carries exactly the
// client's pins, and the tenant Goal Graph head still sits at the pinned
// graphVersion. The unique indexes from 0099 make concurrent writers collide:
// one admission backs at most one request, and requestId/attemptId/nonce are
// unique per principal. The adapter never decides by a prior read; the reads
// after a non-winning insert only classify the refusal for the caller.
//
// External dispatch never happens inside a D1 statement or batch. Crash
// windows (see NATIVE-LAUNCH-CONTRACT.md): after reserve but before submit, and
// after submit but before recordObservation. Both leave a durable `reserved`
// row that status reconciles through owner readback; neither re-dispatches.

import type { GoalGraphD1DatabaseLike } from './goal-graph-store.ts';
import type {
  NativeLaunchAdmission,
  NativeLaunchAdmissionHold,
  NativeLaunchAdmissionRead,
  NativeLaunchCapabilityTuple,
  NativeLaunchObservation,
  NativeLaunchRequestRow,
  NativeLaunchReservation,
  NativeLaunchReserveResult,
  NativeLaunchScope,
  NativeLaunchStore,
} from './native-launch.ts';

type Row = Record<string, unknown>;

const REQUEST_COLUMNS = `request_key, tenant_id, principal_id, request_id, attempt_id, idempotency_nonce,
  request_digest, work_id, admission_ref, graph_version, loadout_id, input_digest, execution_plant,
  supported_action, expires_at, dispatch, execution, owner_ref, reserved_at, observed_at`;

function admissionOf(row: Row): NativeLaunchAdmission {
  return {
    tenantId: String(row.tenant_id), principalId: String(row.principal_id), admissionRef: String(row.admission_ref),
    workId: String(row.work_id), graphVersion: Number(row.graph_version), loadoutId: String(row.loadout_id),
    inputDigest: String(row.input_digest), executionPlant: row.execution_plant as NativeLaunchAdmission['executionPlant'],
    supportedAction: row.supported_action as NativeLaunchAdmission['supportedAction'], expiresAt: String(row.expires_at),
    status: row.status === 'active' ? 'active' : 'revoked',
  };
}

function requestOf(row: Row): NativeLaunchRequestRow {
  return {
    requestKey: String(row.request_key), tenantId: String(row.tenant_id), principalId: String(row.principal_id),
    requestId: String(row.request_id), attemptId: String(row.attempt_id), idempotencyNonce: String(row.idempotency_nonce),
    requestDigest: String(row.request_digest), workId: String(row.work_id), admissionRef: String(row.admission_ref),
    graphVersion: Number(row.graph_version), loadoutId: String(row.loadout_id), inputDigest: String(row.input_digest),
    executionPlant: row.execution_plant as NativeLaunchRequestRow['executionPlant'],
    supportedAction: row.supported_action as NativeLaunchRequestRow['supportedAction'], expiresAt: String(row.expires_at),
    dispatch: row.dispatch as NativeLaunchRequestRow['dispatch'], execution: row.execution as NativeLaunchRequestRow['execution'],
    ownerRef: row.owner_ref == null ? null : String(row.owner_ref), reservedAt: String(row.reserved_at),
    observedAt: row.observed_at == null ? null : String(row.observed_at),
  };
}

const samePins = (a: NativeLaunchCapabilityTuple, b: NativeLaunchCapabilityTuple) =>
  a.workId === b.workId && a.admissionRef === b.admissionRef && a.graphVersion === b.graphVersion
  && a.loadoutId === b.loadoutId && a.inputDigest === b.inputDigest && a.executionPlant === b.executionPlant
  && a.supportedAction === b.supportedAction && a.expiresAt === b.expiresAt;

const isUniqueViolation = (error: unknown) => /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(String((error as Error)?.message ?? error));

export function d1NativeLaunchStore(db: GoalGraphD1DatabaseLike): NativeLaunchStore {
  async function readScoped(scope: NativeLaunchScope, where: string, ...values: unknown[]) {
    const row = await db.prepare(`SELECT ${REQUEST_COLUMNS} FROM native_launch_requests
      WHERE tenant_id = ? AND principal_id = ? AND ${where} LIMIT 1`).bind(scope.tenantId, scope.principalId, ...values).first<Row>();
    return row ? requestOf(row) : null;
  }

  async function readAdmission(scope: NativeLaunchScope, admissionRef: string, now: string): Promise<NativeLaunchAdmissionRead | null> {
    const row = await db.prepare(`
      SELECT a.*, h.graph_version AS head_version
      FROM native_launch_admissions a
      LEFT JOIN goal_graph_heads h ON h.tenant_id = a.tenant_id
      WHERE a.tenant_id = ? AND a.admission_ref = ? AND a.principal_id = ?
    `).bind(scope.tenantId, admissionRef, scope.principalId).first<Row>();
    if (!row) return null;
    const admission = admissionOf(row);
    const consumed = await readScoped(scope, 'admission_ref = ?', admissionRef);
    let hold: NativeLaunchAdmissionHold | null = null;
    if (admission.status !== 'active') hold = 'admission_revoked';
    else if (!(admission.expiresAt > now)) hold = 'admission_expired';
    else if (row.head_version == null || Number(row.head_version) !== admission.graphVersion) hold = 'graph_changed';
    else if (consumed) hold = 'admission_consumed';
    return { admission, hold, consumedBy: consumed ? { requestId: consumed.requestId, attemptId: consumed.attemptId } : null };
  }

  async function classify(input: NativeLaunchReservation): Promise<NativeLaunchReserveResult> {
    const same = await readScoped(input, 'request_id = ?', input.requestId);
    if (same) {
      return same.requestKey === input.requestKey && same.requestDigest === input.requestDigest
        ? { status: 'duplicate', row: same } : { status: 'conflict', code: 'request_changed' };
    }
    if (await readScoped(input, 'admission_ref = ?', input.capability.admissionRef)) return { status: 'conflict', code: 'admission_consumed' };
    if (await readScoped(input, 'attempt_id = ?', input.attemptId)) return { status: 'conflict', code: 'attempt_collision' };
    if (await readScoped(input, 'idempotency_nonce = ?', input.idempotencyNonce)) return { status: 'conflict', code: 'nonce_collision' };
    const current = await readAdmission(input, input.capability.admissionRef, input.now);
    if (!current) return { status: 'refused', code: 'admission_not_current' };
    if (current.hold === 'admission_consumed') return { status: 'conflict', code: 'admission_consumed' };
    if (current.hold) return { status: 'refused', code: current.hold };
    if (!samePins(current.admission, input.capability)) return { status: 'refused', code: 'pins_changed' };
    // The CAS lost to a change between the insert and these reads.
    return { status: 'refused', code: 'admission_not_current' };
  }

  return {
    readAdmission,

    async reserve(input) {
      const c = input.capability;
      let changes = 0;
      try {
        const result = await db.prepare(`
          INSERT INTO native_launch_requests (${REQUEST_COLUMNS})
          SELECT ?, a.tenant_id, a.principal_id, ?, ?, ?, ?, a.work_id, a.admission_ref, a.graph_version,
            a.loadout_id, a.input_digest, a.execution_plant, a.supported_action, a.expires_at,
            'reserved', 'unknown', NULL, ?, NULL
          FROM native_launch_admissions a
          JOIN goal_graph_heads h ON h.tenant_id = a.tenant_id AND h.graph_version = a.graph_version
          WHERE a.tenant_id = ? AND a.principal_id = ? AND a.admission_ref = ? AND a.status = 'active'
            AND a.expires_at > ? AND a.work_id = ? AND a.graph_version = ? AND a.loadout_id = ?
            AND a.input_digest = ? AND a.execution_plant = ? AND a.supported_action = ? AND a.expires_at = ?
        `).bind(
          input.requestKey, input.requestId, input.attemptId, input.idempotencyNonce, input.requestDigest, input.now,
          input.tenantId, input.principalId, c.admissionRef, input.now, c.workId, c.graphVersion, c.loadoutId,
          c.inputDigest, c.executionPlant, c.supportedAction, c.expiresAt,
        ).run();
        changes = Number(result.meta?.changes ?? 0);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
      if (changes === 1) {
        const row = await readScoped(input, 'request_key = ?', input.requestKey);
        if (!row) throw new Error('native_launch_reservation_unreadable');
        return { status: 'reserved', row };
      }
      return classify(input);
    },

    async readRequest(scope, requestId) {
      return readScoped(scope, 'request_id = ?', requestId);
    },

    async recordObservation(scope, requestKey, observation: NativeLaunchObservation) {
      await db.prepare(`
        UPDATE native_launch_requests SET
          dispatch = CASE WHEN dispatch = 'owner_answered' THEN dispatch ELSE ? END,
          execution = CASE WHEN execution IN ('succeeded','failed','refused','busy') OR ? = 'unknown' THEN execution ELSE ? END,
          owner_ref = COALESCE(owner_ref, ?),
          observed_at = ?
        WHERE tenant_id = ? AND principal_id = ? AND request_key = ?
      `).bind(observation.dispatch, observation.execution, observation.execution, observation.ownerRef,
        observation.observedAt, scope.tenantId, scope.principalId, requestKey).run();
      return readScoped(scope, 'request_key = ?', requestKey);
    },
  };
}
