import type { GoalGraphD1DatabaseLike } from './goal-graph-store.ts';
import type { NativeLaunchExecutionOwner, NativeLaunchScope } from './native-launch.ts';
import type { BridgeExecutionAttestation, BridgeExecutionStoreLike, BridgeStoreLike } from './handler.ts';
import { CURRENT_DIRECTION_ADMISSION_SQL, d1DirectionAdmissionStore } from './direction-execution-d1.ts';
import { parseCambiumPatchInput, parseCambiumPatchResult, patchDigest, type CambiumPatchPolicy } from '../../../shared/cambium-patch-contract.ts';

/** Existing bridge queue and execution ledger; no new runner, queue or inference transport. */
export function createDirectionExecutionOwner(args: {
  db: GoalGraphD1DatabaseLike; policy: CambiumPatchPolicy; runnerMemberId: string;
  bridge: BridgeStoreLike; executions: BridgeExecutionStoreLike; now(): string;
}): NativeLaunchExecutionOwner {
  const admissions = d1DirectionAdmissionStore(args.db);
  async function request(scope: NativeLaunchScope, key: string) {
    return args.db.prepare(`SELECT admission_ref, request_id, attempt_id FROM native_launch_requests
      WHERE tenant_id = ? AND principal_id = ? AND request_key = ?`)
      .bind(scope.tenantId, scope.principalId, key).first<{admission_ref: string; request_id: string; attempt_id: string}>();
  }
  async function read(scope: NativeLaunchScope, key: string) {
    const row = await request(scope, key);
    const record = row && await admissions.read(scope, row.admission_ref);
    if (!record) return { state: 'not_found' as const };
    const review = record.review;
    const stored = await args.bridge.getDirective(review.runnerMemberId, review.directiveId);
    if (!stored) return { state: 'not_found' as const };
    const payload = stored.payload as Record<string, unknown> | undefined;
    if (stored.idempotencyKey !== review.idempotencyKey || payload?.command !== 'cambium.patch.verify'
      || patchDigest(payload.input) !== review.inputDigest) throw Error('coding_directive_conflict');
    const terminal = await args.executions.readTerminalAttestation?.(review.runnerMemberId, review.directiveId);
    if (terminal) {
      const result = verifiedDirectionResult(terminal, review);
      if (terminal.status === 'failed') return {state: 'failed' as const, ownerRef: review.directiveId};
      if (!result) throw Error('coding_result_invalid');
      return {state: result.status === 'result-ready' ? 'succeeded' as const : 'failed' as const, ownerRef: review.directiveId};
    }
    const progress = await args.executions.readDirectiveProgress?.(review.runnerMemberId, review.directiveId);
    return {state: progress?.claimed ? 'running' as const : 'queued' as const, ownerRef: review.directiveId};
  }
  return {
    supports: (plant, action) => plant === 'hermes-remote' && action === 'launch',
    async submit(input) {
      const record = await admissions.read(input, input.capability.admissionRef);
      if (!record || record.review.runnerMemberId !== args.runnerMemberId
        || patchDigest(record.review.policy) !== patchDigest(args.policy)
        || !parseCambiumPatchInput(record.review.input, args.policy)
        || input.idempotencyToken !== input.requestKey) return {state:'refused'};
      const review = record.review, now = args.now();
      const directive = { id: review.directiveId, memberId: review.runnerMemberId,
        idempotencyKey: review.idempotencyKey, enqueuedAt: now,
        payload: { type:'native_execution', schema:'thoughtseed.hermes.native_execution.v1',
          target:{memberId:review.runnerMemberId}, command:'cambium.patch.verify', input:review.input } };
      // Recheck the actual reservation and current source/policy pins in the queue INSERT itself.
      await args.db.prepare(`INSERT INTO bridge_directives (member_id, id, directive_json, delivered, enqueued_at, delivered_at)
        SELECT ?, ?, ?, 0, ?, NULL FROM native_launch_admissions a
        JOIN native_launch_requests r ON r.tenant_id = a.tenant_id AND r.admission_ref = a.admission_ref
        JOIN goal_graph_heads h ON h.tenant_id = a.tenant_id
        WHERE a.tenant_id = ? AND a.principal_id = ? AND a.admission_ref = ?
          AND a.status = 'active' AND a.expires_at > ? AND h.graph_version = a.graph_version
          AND r.request_key = ? AND r.request_id = ? AND r.attempt_id = ?
          AND r.input_digest = ? AND r.execution_plant = 'hermes-remote' AND r.supported_action = 'launch'
          AND ${CURRENT_DIRECTION_ADMISSION_SQL}
        ON CONFLICT(member_id,id) DO NOTHING`).bind(review.runnerMemberId, review.directiveId, JSON.stringify(directive), now,
          input.tenantId, input.principalId, record.admissionRef, now, input.requestKey, input.requestId, input.attemptId,
          review.inputDigest, patchDigest(args.policy)).run();
      return read(input, input.requestKey);
    },
    async read(input) { return read(input, input.requestKey); },
  };
}
export function verifiedDirectionResult(attestation: BridgeExecutionAttestation, review: import('./direction-execution-review.ts').DirectionExecutionReview) {
  if (attestation.command !== 'cambium.patch.verify' || attestation.status !== 'executed'
    || attestation.directiveId !== review.directiveId || attestation.idempotencyKey !== review.idempotencyKey
    || attestation.inputDigest !== review.inputDigest) return null;
  const result = parseCambiumPatchResult(attestation.cambiumPatchResult, review.input, review.policy, attestation.executionId);
  return result && patchDigest(result) === attestation.outputDigest ? result : null;
}
