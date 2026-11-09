/** One reviewed identity repair through the existing pending-proposal owner. No D1 writer. */
import POLICY from '../../../docs/project-management/fitcheck-scope-reconciliation.v1.json' with { type: 'json' };
import { compileGoalGraph, makeGoalGraphHead } from './goal-graph/compiler.ts';
import { sha256 } from './goal-graph/identity.ts';
import type { GoalGraphNode } from './goal-graph/types.ts';
import type { TelegramGoalGraphCompileContext } from './goal-graph-intake.ts';
export const FITCHECK_SCOPE_SCHEMA = 'cambium.fitcheck.scope-reconciliation.v1';
const policy = POLICY as unknown as { removedNode: GoalGraphNode; retainedNode: GoalGraphNode; newNode: GoalGraphNode; sourceRef: string; sourceDigest: string };
const reject = (message: string) => ({ accepted: false as const, rejected: true as const, status: 'rejected' as const, code: 'malformed_input' as const, errors: [message] });
export function parseFitcheckScopeBoundary(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reject('exact reconciliation descriptor required');
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).sort().join(',') !== 'changeDigest,expectedHeadDigest,schema,tenantId,version'
      || raw.schema !== FITCHECK_SCOPE_SCHEMA || raw.version !== 1 || raw.tenantId !== 'cambium'
      || !/^[a-f0-9]{64}$/.test(String(raw.changeDigest)) || !/^[a-f0-9]{64}$/.test(String(raw.expectedHeadDigest))) return reject('unsupported reconciliation descriptor');
  const value = raw as { schema: string; version: number; tenantId: string; changeDigest: string; expectedHeadDigest: string };
  return { accepted: true as const, value, idempotencyKey: `fitcheck-scope-reconciliation:v1:cambium:${value.changeDigest}`,
    contentDigest: sha256(value), sourceRef: policy.sourceRef, sourceDigest: policy.sourceDigest };
}
export function compileFitcheckScope(context: TelegramGoalGraphCompileContext, expectedHeadDigest: string) {
  const nodes = context.currentNodes ?? [], head = context.actualHead;
  if (!head || makeGoalGraphHead('cambium', nodes, head.graphVersion, head.committedAt).graphDigest !== head.graphDigest
      || sha256(nodes.find(n => n.nodeId === policy.removedNode.nodeId)) !== sha256(policy.removedNode)
      || sha256(nodes.find(n => n.nodeId === policy.retainedNode.nodeId)) !== sha256(policy.retainedNode)
      || nodes.some(n => n.parentNodeId === policy.removedNode.nodeId || n.nodeId === policy.newNode.nodeId)) throw Error('reconciliation sources changed');
  const node = { ...policy.newNode, graphVersion: head.graphVersion + 1 };
  const compile = compileGoalGraph({ tenantId: 'cambium', actualHead: head, expectedHeadDigest, currentNodes: nodes,
    proposedNodes: [...nodes.filter(n => n.nodeId !== policy.removedNode.nodeId), node], graphVersion: head.graphVersion + 1,
    sourceRef: policy.sourceRef, sourceDigest: policy.sourceDigest, now: context.now, loadoutAuthority: context.loadoutAuthority });
  return { node, compile };
}
export function parseFitcheckScopeIntent(input: unknown, context: TelegramGoalGraphCompileContext) {
  const boundary = parseFitcheckScopeBoundary(input); if (!boundary.accepted) return boundary;
  try {
    const result = compileFitcheckScope(context, boundary.value.expectedHeadDigest);
    if (result.compile.status === 'compiled' && result.compile.changeSet.changeDigest !== boundary.value.changeDigest) return reject('reviewed change digest differs');
    return { ...boundary, ...result };
  } catch { return reject('reconciliation source or identity differs'); }
}
export function isFitcheckScopeTask(task: Record<string, unknown>): boolean {
  const node = task.node as GoalGraphNode | undefined;
  const intent = task.intent as Record<string, unknown> | undefined;
  const changes = task.changeSet as { nodesToCreate?: GoalGraphNode[] } | undefined;
  return intent?.schema === FITCHECK_SCOPE_SCHEMA || node?.nodeId === policy.newNode.nodeId
    || changes?.nodesToCreate?.some(n => n.nodeId === policy.newNode.nodeId) === true;
}
export function fitcheckScopeTaskMatches(task: Record<string, unknown>, context: TelegramGoalGraphCompileContext): boolean {
  try {
    const cs = task.changeSet as any, head = context.actualHead;
    if (!head || cs?.expectedHeadDigest !== head.graphDigest || cs.graphVersion !== head.graphVersion + 1) return false;
    compileFitcheckScope(context, head.graphDigest);
    if (cs.nodesToCreate?.length !== 1 || cs.nodesToRemove?.length !== 1 || cs.nodesToUpdate?.length !== 0
        || sha256(cs.nodesToRemove[0]) !== sha256(policy.removedNode)) return false;
    if (cs.nodesToCreate[0].graphVersion !== cs.graphVersion) return false;
    if (!task.renewal && (cs.sourceRef !== policy.sourceRef || cs.sourceDigest !== policy.sourceDigest
        || cs.nodesToCreate[0].sourceRef !== policy.sourceRef || cs.nodesToCreate[0].sourceDigest !== policy.sourceDigest)) return false;
    const core = (n: GoalGraphNode) => { const { sourceRef, sourceDigest, graphVersion, createdAt, updatedAt, ...v } = n; return v; };
    return sha256(core(cs.nodesToCreate[0])) === sha256(core(policy.newNode));
  } catch { return false; }
}
export async function fitcheckReferencesClear(db: { prepare(sql: string): any }): Promise<boolean> {
  try {
    const row = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM bridge_executions WHERE instr(attestation_json,?)>0 OR instr(attestation_json,'task-fitcheck-launch')>0) +
      (SELECT COUNT(*) FROM bridge_directives WHERE instr(directive_json,?)>0 OR instr(directive_json,'task-fitcheck-launch')>0) +
      (SELECT COUNT(*) FROM native_launch_admissions WHERE tenant_id='cambium' AND work_id='sapling:fitcheck') +
      (SELECT COUNT(*) FROM native_launch_requests WHERE tenant_id='cambium' AND work_id='sapling:fitcheck') +
      (SELECT COUNT(*) FROM goal_graph_nodes WHERE parent_node_id=?) AS refs`)
      .bind(policy.removedNode.nodeId, policy.removedNode.nodeId, policy.removedNode.nodeId).first();
    return row?.refs === 0;
  } catch { return false; }
}
