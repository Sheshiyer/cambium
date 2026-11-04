import { sha256, buildNode } from './goal-graph/identity.ts';
import { compileGoalGraph, makeGoalGraphHead } from './goal-graph/compiler.ts';
import type { GoalGraphHead, GoalGraphNode, GoalGraphLoadoutAuthority } from './goal-graph/types.ts';
import { validateDirectionDraft, type SharedDirection } from './shared-directions.ts';
import type { Signal } from './shared-signals.ts';
import { isOperationalWorkSource } from './operational-work-intake.ts';
import { executionAdmissionMetadata } from './terminal-admission.ts';
import { parseCambiumPatchPolicy, parseCambiumPatchInput, patchDigest, type CambiumPatchPolicy, type CambiumPatchInput } from '../../../shared/cambium-patch-contract.ts';

export const DIRECTION_EXECUTION_SCHEMA = 'cambium.direction-execution-review.v1';
export const DIRECTION_EXECUTION_INTENT = 'cambium.direction-execution-intent.v1';
export const DIRECTION_EXECUTION_NAMESPACE = 'founder-direction-execution';
export const CAMBIUM_PATCH_LOADOUT = 'loadout:cambium-patch-pilot';
export const CAMBIUM_PATCH_CLUSTER = 'cluster:cambium-patch-verification';

export interface DirectionExecutionRequest {
  schema: 'cambium.direction-execution-intent.v1';
  operationId: string;
  directionRevision: number;
  expectedHeadDigest: string;
  policyDigest: string;
}
export interface DirectionExecutionReview {
  schema: typeof DIRECTION_EXECUTION_SCHEMA;
  tenantId: string;
  principal: string;
  direction: SharedDirection;
  work: GoalGraphNode;
  sourceHead: { graphVersion: number; graphDigest: string };
  policy: CambiumPatchPolicy;
  input: CambiumPatchInput;
  inputDigest: string;
  runnerMemberId: string;
  directiveId: string;
  idempotencyKey: string;
  loadoutId: typeof CAMBIUM_PATCH_LOADOUT;
  clusterId: typeof CAMBIUM_PATCH_CLUSTER;
}
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DIGEST = /^[a-f0-9]{64}$/;
export function validDirectionExecutionRequest(raw: unknown): raw is DirectionExecutionRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const value = raw as DirectionExecutionRequest;
  return Object.keys(value).sort().join(',') === 'directionRevision,expectedHeadDigest,operationId,policyDigest,schema'
    && value.schema === DIRECTION_EXECUTION_INTENT && typeof value.operationId === 'string' && ID.test(value.operationId)
    && Number.isSafeInteger(value.directionRevision) && value.directionRevision > 0
    && typeof value.expectedHeadDigest === 'string' && DIGEST.test(value.expectedHeadDigest)
    && typeof value.policyDigest === 'string' && /^sha256:[a-f0-9]{64}$/.test(value.policyDigest);
}

/** Request identity is available before reading mutable sources, for exact replay. */
export function directionExecutionIdentity(scope: { tenantId: string; principal: string }, directionId: string, request: DirectionExecutionRequest) {
  if (scope.tenantId !== 'cambium' || !scope.principal || !ID.test(directionId) || !validDirectionExecutionRequest(request)) throw Error('invalid_direction_execution_request');
  const owner = sha256(scope.principal);
  return {
    idempotencyKey: `direction-execution:v1:cambium:${owner}:${request.operationId}`,
    contentDigest: `sha256:${sha256({ ...scope, directionId, request })}`,
    sourceRef: `founder-direction-execution:cambium:${owner}:${request.operationId}`,
  };
}

/** Compile one execution child through the existing sole graph writer; never mutate Work. */
export function buildDirectionExecutionProposal(args: {
  scope: { tenantId: string; principal: string };
  request: DirectionExecutionRequest;
  direction: SharedDirection;
  signals: readonly Signal[];
  head: GoalGraphHead;
  nodes: readonly GoalGraphNode[];
  policy: unknown;
  patchBase64: string;
  runnerMemberId: string;
  now: string;
  loadoutAuthority: GoalGraphLoadoutAuthority;
}) {
  const { scope, request, direction, head, nodes } = args;
  const identity = directionExecutionIdentity(scope, direction.id, request);
  const policy = parseCambiumPatchPolicy(args.policy);
  if (!policy || patchDigest(policy) !== request.policyDigest || !ID.test(args.runnerMemberId)) throw Error('execution_policy_unavailable');
  const { title, body, workObjectId, workNodeId, graphHeadDigest, signalPins } = direction;
  if (!validateDirectionDraft({ title, body, workObjectId, workNodeId, graphHeadDigest, signalPins })) throw Error('direction_invalid');
  if (direction.tenantId !== scope.tenantId || direction.principal !== scope.principal) throw Error('direction_scope_changed');
  if (direction.revision !== request.directionRevision) throw Error('direction_changed');
  if (head.tenantId !== scope.tenantId || head.graphDigest !== request.expectedHeadDigest
      || makeGoalGraphHead(scope.tenantId, nodes, head.graphVersion, head.committedAt).graphDigest !== head.graphDigest) throw Error('graph_changed');
  // Keep the draft's origin head as provenance. Every new human review pins
  // the freshly read target Work and current head; it does not edit the draft.
  const work = nodes.find(row => row.nodeId === direction.workNodeId);
  if (!work || !isOperationalWorkSource(work) || work.status !== 'active' || direction.workObjectId !== work.workObjectId) throw Error('work_join_changed');
  if (new Set(args.signals.map(row => row.id)).size !== args.signals.length || args.signals.length !== direction.signalPins.length) throw Error('signal_set_changed');
  for (const pin of direction.signalPins) {
    const signal = args.signals.find(row => row.id === pin.id);
    if (!signal || signal.tenantId !== scope.tenantId || signal.principal !== scope.principal || signal.revision !== pin.revision
        || !signal.projectIds.includes(direction.workObjectId)) throw Error('signal_changed');
  }
  const timestamp = Date.parse(args.now);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== args.now) throw Error('clock_unavailable');
  const taskId = `cambium-pilot-${sha256({ direction, head: head.graphDigest, policy: request.policyDigest, runner: args.runnerMemberId }).slice(0, 32)}`;
  const rawInput: CambiumPatchInput = {
    schema: 'thoughtseed.cambium.patch.verify_input.v1', taskId, workObjectId: 'sapling:cambium',
    directionId: direction.id, directionRevision: direction.revision, directionDigest: patchDigest(direction),
    workNodeId: work.nodeId, approvedGraphVersion: head.graphVersion + 1,
    baseCommit: policy.baseCommit, patchBase64: args.patchBase64, patchDigest: policy.patchDigest,
    policyId: policy.id, policyDigest: patchDigest(policy),
  };
  const input = parseCambiumPatchInput(rawInput, policy);
  if (!input) throw Error('execution_artifact_invalid');
  const review: DirectionExecutionReview = {
    schema: DIRECTION_EXECUTION_SCHEMA, ...scope, direction, work,
    sourceHead: { graphVersion: head.graphVersion, graphDigest: head.graphDigest },
    policy, input, inputDigest: patchDigest(input), runnerMemberId: args.runnerMemberId,
    directiveId: taskId, idempotencyKey: `native-cambium:${taskId}`,
    loadoutId: CAMBIUM_PATCH_LOADOUT, clusterId: CAMBIUM_PATCH_CLUSTER,
  };
  const { now: _now, ...node } = buildNode({
    tenantId: scope.tenantId, namespace: DIRECTION_EXECUTION_NAMESPACE, externalId: taskId,
    parentNodeId: work.nodeId, workObjectId: 'sapling:cambium', workObjectKind: 'sapling', pinnedLoadoutId: CAMBIUM_PATCH_LOADOUT,
    scope: 'micro', desiredState: direction.title, currentState: 'Reviewed execution input; awaiting founder decision and governed launch admission.',
    owner: scope.principal, nextAction: 'Verify the pinned Cambium patch on hosted Hermes.', waitCondition: null,
    proofRequired: true, reviewAt: null, status: 'active', sourceRef: identity.sourceRef, sourceDigest: identity.contentDigest,
    graphVersion: head.graphVersion + 1, now: args.now,
    metadata: {
      directionExecutionSchema: DIRECTION_EXECUTION_SCHEMA, directionId: direction.id, directionRevision: direction.revision,
      directionDigest: patchDigest(direction), executionReviewDigest: patchDigest(review),
      executionInputDigest: review.inputDigest, executionPolicyDigest: patchDigest(policy), artifactPatchDigest: policy.patchDigest,
      ...executionAdmissionMetadata({ schema: 'cambium.goal-graph.execution-admission.v1', memberId: review.runnerMemberId,
        directiveId: review.directiveId, idempotencyKey: review.idempotencyKey, clusterId: review.clusterId, dispatchDigest: review.inputDigest }),
    },
  });
  if (nodes.some(row => row.nodeId === node.nodeId)) throw Error('execution_already_proposed');
  const compiled = compileGoalGraph({ tenantId: scope.tenantId, expectedHeadDigest: head.graphDigest, actualHead: head,
    currentNodes: nodes, proposedNodes: [...nodes, node], graphVersion: head.graphVersion + 1,
    sourceRef: identity.sourceRef, sourceDigest: identity.contentDigest, now: args.now, loadoutAuthority: args.loadoutAuthority,
    sourceFence: { schema: 'cambium.goal-graph.direction-source-fence.v1', principalId: scope.principal,
      directionId: direction.id, directionRevision: direction.revision, document: JSON.stringify(direction), signalPins: direction.signalPins } });
  if (compiled.status !== 'compiled') throw Error('graph_changed');
  return { ...identity, review, node, changeSet: compiled.changeSet };
}

/** Canonical review must carry exactly the manifest whose digest the graph signs. */
export function directionExecutionTaskReview(task: Record<string, unknown>): DirectionExecutionReview | null {
  try {
  const review = task.directionExecution as DirectionExecutionReview | undefined;
  const node = task.node as GoalGraphNode | undefined;
  const change = task.changeSet as import('./goal-graph/types.ts').GoalChangeSet | undefined;
  if (!review || review.schema !== DIRECTION_EXECUTION_SCHEMA || !node || node.namespace !== DIRECTION_EXECUTION_NAMESPACE
      || !change || change.nodesToCreate.length !== 1 || change.nodesToUpdate.length || change.nodesToRemove.length
      || patchDigest(change.nodesToCreate[0]) !== patchDigest(node) || change.expectedHeadDigest !== review.sourceHead.graphDigest
      || change.graphVersion !== review.sourceHead.graphVersion + 1 || change.graphVersion !== node.graphVersion
      || node.metadata.executionReviewDigest !== patchDigest(review) || node.metadata.executionInputDigest !== patchDigest(review.input)
      || review.inputDigest !== patchDigest(review.input) || node.workObjectId !== review.input.workObjectId
      || node.graphVersion !== review.input.approvedGraphVersion || review.tenantId !== task.tenantId
      || node.owner !== review.principal || node.parentNodeId !== review.input.workNodeId
      || node.pinnedLoadoutId !== CAMBIUM_PATCH_LOADOUT || !parseCambiumPatchInput(review.input, review.policy)) return null;
  const { changeDigest, isNoop: _noop, ...digestInput } = change;
  const fence = change.sourceFence;
  if (sha256(digestInput) !== changeDigest.replace(/^sha256:/, '') || task.changeDigest !== changeDigest
      || !fence || fence.schema !== 'cambium.goal-graph.direction-source-fence.v1' || fence.principalId !== review.principal
      || fence.directionId !== review.direction.id || fence.directionRevision !== review.direction.revision
      || fence.document !== JSON.stringify(review.direction) || patchDigest(fence.signalPins) !== patchDigest(review.direction.signalPins)
      || review.input.directionId !== review.direction.id || review.input.directionRevision !== review.direction.revision
      || review.input.directionDigest !== patchDigest(review.direction) || review.direction.principal !== review.principal
      || review.direction.tenantId !== review.tenantId || review.direction.workNodeId !== review.input.workNodeId
      || review.work.nodeId !== review.input.workNodeId || review.work.workObjectId !== review.direction.workObjectId
      || !isOperationalWorkSource(review.work) || review.work.status !== 'active') return null;
  const expected = executionAdmissionMetadata({ schema: 'cambium.goal-graph.execution-admission.v1', memberId: review.runnerMemberId,
    directiveId: review.directiveId, idempotencyKey: review.idempotencyKey, clusterId: review.clusterId, dispatchDigest: review.inputDigest });
  if (Object.entries(expected).some(([key, value]) => node.metadata[key] !== value)) return null;
  return review;
  } catch { return null; }
}
