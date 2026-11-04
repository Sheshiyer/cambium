import type { GoalGraphD1DatabaseLike } from './goal-graph-store.ts';
import type { NativeLaunchScope } from './native-launch.ts';
import { sha256 } from './goal-graph/identity.ts';
import { patchDigest } from '../../../shared/cambium-patch-contract.ts';
import { CAMBIUM_PATCH_LOADOUT, directionExecutionTaskReview, type DirectionExecutionReview } from './direction-execution-review.ts';

/** Fixed owner SQL, reused at admission and the actual native reservation. Alias a is native_launch_admissions. */
export const CURRENT_DIRECTION_ADMISSION_SQL = `EXISTS (
 SELECT 1 FROM native_direction_admissions d
 JOIN shared_directions sd ON sd.tenant_id = d.tenant_id AND sd.principal_id = d.principal_id
   AND sd.direction_id = d.direction_id AND sd.revision = d.direction_revision
 JOIN goal_graph_nodes n ON n.tenant_id = d.tenant_id AND n.node_id = d.execution_node_id
 JOIN goal_graph_nodes w ON w.tenant_id = d.tenant_id AND w.node_id = n.parent_node_id
 WHERE d.tenant_id = a.tenant_id AND d.admission_ref = a.admission_ref AND d.principal_id = a.principal_id
   AND d.work_id = a.work_id AND d.graph_version = a.graph_version AND d.input_digest = a.input_digest
   AND d.loadout_id = a.loadout_id AND d.expires_at = a.expires_at AND d.policy_digest = ?
   AND sd.document = json_extract(d.review_document, '$.direction')
   AND n.graph_version = a.graph_version AND n.status = 'active' AND n.proof_required = 1
   AND n.namespace = 'founder-direction-execution' AND n.pinned_loadout_id = a.loadout_id
   AND n.work_object_id = a.work_id AND n.work_object_kind = 'sapling'
   AND json_extract(n.metadata_json, '$.executionReviewDigest') = d.review_digest
   AND json_extract(n.metadata_json, '$.executionInputDigest') = a.input_digest
   AND w.namespace = 'founder-operational-work' AND w.external_id = 'cambium-work'
   AND w.work_object_id = a.work_id AND w.status = 'active' AND w.proof_required = 1
   AND w.pinned_loadout_id IS NULL
   AND json_extract(w.metadata_json, '$.operationalWorkSchema') = 'cambium.founder.operational-work-intent.v1'
   AND NOT EXISTS (
     SELECT 1 FROM json_each(d.review_document, '$.direction.signalPins') pin
     LEFT JOIN shared_signals s ON s.tenant_id = d.tenant_id AND s.principal_id = d.principal_id
       AND s.signal_id = json_extract(pin.value, '$.id')
     WHERE s.revision IS NOT json_extract(pin.value, '$.revision')
       OR NOT EXISTS (SELECT 1 FROM json_each(s.document, '$.projectIds') project WHERE project.value = a.work_id)
   )
)`;
export interface DirectionAdmissionRecord {
  admissionRef: string; proposalDigest: string; executionNodeId: string;
  graphVersion: number; expiresAt: string; review: DirectionExecutionReview;
}
export function d1DirectionAdmissionStore(db: GoalGraphD1DatabaseLike) {
  const read = async (scope: NativeLaunchScope, admissionRef: string): Promise<DirectionAdmissionRecord | null> => {
    const row = await db.prepare(`SELECT admission_ref, proposal_digest, execution_node_id, graph_version, expires_at, review_document
      FROM native_direction_admissions WHERE tenant_id = ? AND principal_id = ? AND admission_ref = ?`)
      .bind(scope.tenantId, scope.principalId, admissionRef).first<Record<string, unknown>>();
    return row ? { admissionRef: String(row.admission_ref), proposalDigest: String(row.proposal_digest), executionNodeId: String(row.execution_node_id),
      graphVersion: Number(row.graph_version), expiresAt: String(row.expires_at), review: JSON.parse(String(row.review_document)) } : null;
  };
  return {
    read,
    async readByRequest(scope: NativeLaunchScope, requestId: string) {
      const row = await db.prepare(`SELECT admission_ref, attempt_id FROM native_launch_requests
        WHERE tenant_id = ? AND principal_id = ? AND request_id = ?`)
        .bind(scope.tenantId, scope.principalId, requestId).first<{admission_ref: string; attempt_id: string}>();
      const record = row && await read(scope, row.admission_ref);
      return record ? { record, requestId, attemptId: row!.attempt_id } : null;
    },
    async readByDirective(memberId: string, directiveId: string): Promise<DirectionAdmissionRecord | null> {
      const rows = (await db.prepare(`SELECT tenant_id, principal_id, admission_ref FROM native_direction_admissions
        WHERE json_extract(review_document, '$.runnerMemberId') = ?
          AND json_extract(review_document, '$.directiveId') = ? LIMIT 2`).bind(memberId, directiveId)
        .all<{ tenant_id: string; principal_id: string; admission_ref: string }>()).results ?? [];
      if (rows.length !== 1) return null;
      return read({ tenantId: rows[0].tenant_id, principalId: rows[0].principal_id }, rows[0].admission_ref);
    },
    /** No client-supplied capability. D1 decision, exact current sources and head gate ONE insert. */
    async admit(args: { scope: NativeLaunchScope; task: Record<string, unknown>; expectedHeadDigest: string; policyDigest: string; now: string;
      authorize(): Promise<boolean> }) {
      const review = directionExecutionTaskReview(args.task);
      if (!review || review.tenantId !== args.scope.tenantId || review.principal !== args.scope.principalId
          || patchDigest(review.policy) !== args.policyDigest || !/^[a-f0-9]{64}$/.test(args.expectedHeadDigest)) throw Error('admission_review_invalid');
      const node = args.task.node as { nodeId: string };
      const digest = String(args.task.changeDigest);
      const nonce = args.task.approvalNonce;
      if (typeof nonce !== 'string' || !nonce || nonce.length > 256 || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(args.now)
          || !Number.isFinite(Date.parse(args.now)) || new Date(args.now).toISOString() !== args.now) throw Error('admission_request_invalid');
      const admissionRef = `nda_${sha256({ ...args.scope, changeDigest: digest })}`;
      const existing = await read(args.scope, admissionRef);
      if (existing) return { status: 'existing' as const, record: existing };
      const expiresAt = new Date(Date.parse(args.now) + 15 * 60_000).toISOString();
      if (!await args.authorize()) throw Error('authorization_changed');
      // The same predicate used by reserve is expressed below before a exists;
      // candidate supplies only server-derived values. Approval itself stays in the sole graph writer.
      const result = await db.prepare(`
        INSERT INTO native_direction_admissions (
          tenant_id, admission_ref, principal_id, work_id, graph_version, loadout_id, input_digest,
          expires_at, recorded_at, proposal_digest, execution_node_id, direction_id, direction_revision,
          policy_digest, review_digest, review_document
        ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        FROM goal_graph_heads h
        JOIN goal_graph_approvals approval ON approval.tenant_id = h.tenant_id
        JOIN goal_graph_nodes n ON n.tenant_id = h.tenant_id AND n.node_id = ?
        JOIN goal_graph_nodes w ON w.tenant_id = h.tenant_id AND w.node_id = n.parent_node_id
        JOIN shared_directions sd ON sd.tenant_id = h.tenant_id AND sd.principal_id = ? AND sd.direction_id = ?
        WHERE h.tenant_id = ? AND h.graph_version = ? AND h.graph_digest = ?
          AND approval.change_digest = ? AND approval.nonce = ? AND approval.decision = 'approved'
          AND approval.approver_id = ? AND approval.intent_version = ?
          AND n.namespace = 'founder-direction-execution' AND n.graph_version = h.graph_version AND n.status = 'active'
          AND n.work_object_id = 'sapling:cambium' AND n.pinned_loadout_id = ? AND n.proof_required = 1
          AND json_extract(n.metadata_json, '$.executionReviewDigest') = ?
          AND json_extract(n.metadata_json, '$.executionInputDigest') = ?
          AND w.namespace = 'founder-operational-work' AND w.external_id = 'cambium-work'
          AND w.node_id = ? AND w.work_object_id = 'sapling:cambium' AND w.status = 'active' AND w.proof_required = 1
          AND w.pinned_loadout_id IS NULL
          AND json_extract(w.metadata_json, '$.operationalWorkSchema') = 'cambium.founder.operational-work-intent.v1'
          AND sd.revision = ? AND sd.document = ?
          AND NOT EXISTS (
            SELECT 1 FROM json_each(?, '$.direction.signalPins') pin
            LEFT JOIN shared_signals s ON s.tenant_id = h.tenant_id AND s.principal_id = ? AND s.signal_id = json_extract(pin.value, '$.id')
            WHERE s.revision IS NOT json_extract(pin.value, '$.revision')
              OR NOT EXISTS (SELECT 1 FROM json_each(s.document, '$.projectIds') project WHERE project.value = 'sapling:cambium')
          )
        ON CONFLICT (tenant_id, admission_ref) DO NOTHING
      `).bind(args.scope.tenantId, admissionRef, args.scope.principalId, 'sapling:cambium', review.input.approvedGraphVersion,
        CAMBIUM_PATCH_LOADOUT, review.inputDigest, expiresAt, args.now, digest, node.nodeId, review.direction.id, review.direction.revision,
        args.policyDigest, patchDigest(review), JSON.stringify(review),
        node.nodeId, args.scope.principalId, review.direction.id, args.scope.tenantId, review.input.approvedGraphVersion,
        args.expectedHeadDigest, digest, nonce, args.scope.principalId, args.task.intentVersion,
        CAMBIUM_PATCH_LOADOUT, patchDigest(review), review.inputDigest, review.input.workNodeId,
        review.direction.revision, JSON.stringify(review.direction), JSON.stringify(review), args.scope.principalId).run();
      const record = await read(args.scope, admissionRef);
      return record ? { status: Number(result.meta?.changes ?? 0) ? 'admitted' as const : 'existing' as const, record }
        : { status: 'refused' as const, record: null };
    },
  };
}
