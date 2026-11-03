import { CLAIM_POLICY, CLAIM_POLICY_DIGEST, CLAIM_ACCEPTANCE_SCHEMA, claimDigest, type ClaimProofInput, parseClaimProofInput } from '../../../shared/iverif-claim-proof.ts';
import { buildNode, sha256 } from './goal-graph/identity.ts';
import { compileGoalGraph } from './goal-graph/compiler.ts';
import type { TelegramGoalGraphCompileContext, TelegramGoalGraphRejected } from './goal-graph-intake.ts';
import type { SharedDirection } from './shared-directions.ts';
import type { HandlerDeps } from './handler.ts';
import { isOperationalWorkSource } from './operational-work-intake.ts';
import { makeGoalGraphHead } from './goal-graph/compiler.ts';
import type { GoalGraphNode } from './goal-graph/types.ts';

export const DIRECTION_EXECUTION_SCHEMA = 'cambium.founder.direction-execution-intent.v1';
const reject = (message: string): TelegramGoalGraphRejected => ({accepted:false,rejected:true,status:'rejected',code:'malformed_input',errors:[message]});
export function parseDirectionExecutionBoundary(raw: unknown, founderId: string) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return reject('execution intent required');
  const r = raw as Record<string, unknown>;
  if (Object.keys(r).sort().join(',') !== 'clientRequestId,expectedHeadDigest,input,memberId,parentNodeId,schema,tenantId,version'
      || r.schema !== DIRECTION_EXECUTION_SCHEMA || r.version !== 1 || r.tenantId !== 'cambium'
      || !/^access:[^\s\x00-\x1f]{1,249}$/.test(founderId)
      || typeof r.clientRequestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(r.clientRequestId)
      || typeof r.memberId !== 'string' || !/^[a-z][a-z0-9-]{1,63}$/.test(r.memberId)
      || typeof r.parentNodeId !== 'string' || !/^goal_[a-f0-9]{64}$/.test(r.parentNodeId)
      || typeof r.expectedHeadDigest !== 'string' || !/^[a-f0-9]{64}$/.test(r.expectedHeadDigest)) return reject('exact server-prepared execution intent required');
  const input = parseClaimProofInput(r.input);
  if (!input || input.graphHeadDigest !== r.expectedHeadDigest || input.workNodeId !== r.parentNodeId) return reject('claim-proof input pins differ');
  const value = {schema:DIRECTION_EXECUTION_SCHEMA,version:1,tenantId:'cambium',clientRequestId:r.clientRequestId,
    expectedHeadDigest:r.expectedHeadDigest,parentNodeId:r.parentNodeId,memberId:r.memberId,input,
    source:{kind:'founder-direction-execution',founderDigest:sha256(founderId)}};
  const contentDigest = claimDigest(value);
  return {accepted:true as const,rejected:false as const,status:'accepted' as const,value,canonical:JSON.stringify(value),contentDigest,sourceDigest:contentDigest,
    sourceRef:`founder-direction-execution:cambium:${sha256(founderId)}:${r.clientRequestId}`,
    idempotencyKey:`founder-direction-execution:v1:cambium:${sha256(founderId)}:${r.clientRequestId}`};
}
export function parseDirectionExecutionIntent(raw: unknown, founderId: string, context: TelegramGoalGraphCompileContext) {
  const boundary = parseDirectionExecutionBoundary(raw,founderId);
  if (!boundary.accepted) return boundary;
  const input=boundary.value.input;
  const work=(context.currentNodes??[]).find(node=>node.nodeId===input.workNodeId);
  if (!work || !isOperationalWorkSource(work) || work.workObjectId!=='sapling:iverif' || work.status==='retired') return reject('approved IVerif Work join required');
  const node=buildNode({tenantId:'cambium',namespace:'founder-direction-execution',externalId:input.taskId,parentNodeId:input.workNodeId,
    scope:'micro',desiredState:'Produce the source-linked IVerif claim-evidence table for founder review.',currentState:'Approved task; separate execution admission required.',
    owner:boundary.value.memberId,nextAction:'Request the governed one-attempt Hermes admission.',waitCondition:null,proofRequired:true,reviewAt:null,status:'active',
    metadata:{directionExecutionSchema:DIRECTION_EXECUTION_SCHEMA,directionId:input.directionId,directionRevision:input.directionRevision,
      directionDigest:input.directionDigest,claimProofInput:JSON.stringify(input),policyDigest:CLAIM_POLICY_DIGEST,
      expectedArtifacts:CLAIM_POLICY.outputs.join(','),modelPool:CLAIM_POLICY.modelPool,timeoutMs:CLAIM_POLICY.timeoutMs,attempts:1,automaticRetries:false,
      executionAdmissionSchema:'cambium.goal-graph.execution-admission.v1',executionAdmissionMemberId:boundary.value.memberId,
      executionAdmissionDirectiveId:`claim-proof-${claimDigest(input).slice(7,39)}`,executionAdmissionIdempotencyKey:`claim-proof:${claimDigest(input).slice(7)}`,
      executionAdmissionClusterId:CLAIM_POLICY.clusterId,executionAdmissionDispatchDigest:claimDigest(input)},
    workObjectId:'sapling:iverif',workObjectKind:'sapling',pinnedLoadoutId:CLAIM_POLICY.loadoutId,
    sourceRef:boundary.sourceRef,sourceDigest:boundary.sourceDigest,graphVersion:context.graphVersion??1,now:context.now});
  const current=context.currentNodes??[],prior=current.find(row=>row.nodeId===node.nodeId);
  if (prior && (prior.sourceRef!==node.sourceRef || prior.sourceDigest!==node.sourceDigest)) return reject('execution identity already belongs to another input');
  if (prior) node.createdAt=prior.createdAt;
  const compile=compileGoalGraph({tenantId:'cambium',expectedHeadDigest:boundary.value.expectedHeadDigest,actualHead:context.actualHead??null,
    currentNodes:current,proposedNodes:[...current.filter(row=>row.nodeId!==node.nodeId),node],graphVersion:context.graphVersion??1,
    sourceRef:boundary.sourceRef,sourceDigest:boundary.sourceDigest,now:context.now,loadoutAuthority:context.loadoutAuthority});
  return {...boundary,node,nodes:[node],compile};
}

export async function readPinnedDirection(deps: HandlerDeps, scope: {tenantId:string;principal:string}, id:string, revision:number) {
  if (!deps.sharedDirectionStore || !deps.sharedSignalStore || !deps.goalGraphStore) throw new Error('direction_sources_unavailable');
  const direction=await deps.sharedDirectionStore.read(scope,id);
  if (!direction || direction.revision!==revision || direction.workObjectId!=='sapling:iverif') throw new Error('direction_changed');
  for (const pin of direction.signalPins) {
    const signal=await deps.sharedSignalStore.read(scope,pin.id);
    if (!signal || signal.revision!==pin.revision || !signal.projectIds.includes(direction.workObjectId)) throw new Error('signal_changed');
  }
  const head=await deps.goalGraphStore.readHead(scope.tenantId),nodes=await deps.goalGraphStore.readNodes(scope.tenantId),again=await deps.goalGraphStore.readHead(scope.tenantId);
  if (!head || !again || head.graphDigest!==again.graphDigest || head.graphVersion!==again.graphVersion
      || makeGoalGraphHead(scope.tenantId,nodes,head.graphVersion,head.committedAt).graphDigest!==head.graphDigest) throw new Error('graph_read_unconfirmed');
  const work=nodes.find(node=>node.nodeId===direction.workNodeId);
  if (!work || !isOperationalWorkSource(work) || work.status==='retired' || work.workObjectId!==direction.workObjectId) throw new Error('work_join_required');
  return {direction,head,nodes,work};
}
export function claimInputForDirection(direction: SharedDirection): ClaimProofInput {
  const taskId=`iverif-claim-proof:${direction.id}:${direction.revision}`;
  return {schema:'cambium.iverif.claim-proof-input.v1',workObjectId:'sapling:iverif',taskId,goalId:direction.workNodeId,
    workNodeId:direction.workNodeId,graphHeadDigest:direction.graphHeadDigest,directionId:direction.id,directionRevision:direction.revision,
    directionDigest:claimDigest(direction),sourceManifestDigest:CLAIM_POLICY.sourceManifestDigest,policyDigest:CLAIM_POLICY_DIGEST,modelPool:'noesis-free'};
}
export function claimInputFromNode(node: GoalGraphNode): ClaimProofInput | null {
  if (node.namespace!=='founder-direction-execution' || node.workObjectId!=='sapling:iverif' || node.pinnedLoadoutId!==CLAIM_POLICY.loadoutId
      || node.metadata.directionExecutionSchema!==DIRECTION_EXECUTION_SCHEMA || typeof node.metadata.claimProofInput!=='string') return null;
  try {return parseClaimProofInput(JSON.parse(node.metadata.claimProofInput));}catch{return null;}
}

/** Founder semantic review is a proof leaf, never a second execution grant. */
export function parseClaimAcceptanceBoundary(raw:unknown, founderId:string) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return reject('acceptance intent required');
  const r=raw as Record<string,unknown>;
  if(Object.keys(r).sort().join(',')!=='admissionRef,artifactDigest,clientRequestId,executionNodeId,expectedHeadDigest,input,schema,tenantId,version'
      ||r.schema!==CLAIM_ACCEPTANCE_SCHEMA||r.version!==1||r.tenantId!=='cambium'||!/^access:[^\s\x00-\x1f]{1,249}$/.test(founderId)
      ||typeof r.clientRequestId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(r.clientRequestId)
      ||typeof r.executionNodeId!=='string'||!/^goal_[a-f0-9]{64}$/.test(r.executionNodeId)
      ||r.admissionRef!==`claim-admission:${r.executionNodeId}`
      ||typeof r.expectedHeadDigest!=='string'||!/^[a-f0-9]{64}$/.test(r.expectedHeadDigest)
      ||typeof r.artifactDigest!=='string'||!/^sha256:[a-f0-9]{64}$/.test(r.artifactDigest))return reject('exact acceptance pins required');
  const input=parseClaimProofInput(r.input);if(!input)return reject('claim input required');
  const value={schema:CLAIM_ACCEPTANCE_SCHEMA,version:1,tenantId:'cambium',clientRequestId:r.clientRequestId,expectedHeadDigest:r.expectedHeadDigest,
    executionNodeId:r.executionNodeId,admissionRef:r.admissionRef,artifactDigest:r.artifactDigest,input,source:{kind:'founder-claim-acceptance',founderDigest:sha256(founderId)}};
  const contentDigest=claimDigest(value);
  return {accepted:true as const,rejected:false as const,status:'accepted' as const,value,canonical:JSON.stringify(value),contentDigest,sourceDigest:contentDigest,
    sourceRef:`founder-claim-acceptance:cambium:${sha256(founderId)}:${r.clientRequestId}`,
    idempotencyKey:`founder-claim-acceptance:v1:cambium:${sha256(founderId)}:${r.clientRequestId}`};
}
export function parseClaimAcceptanceIntent(raw:unknown,founderId:string,context:TelegramGoalGraphCompileContext) {
  const boundary=parseClaimAcceptanceBoundary(raw,founderId);if(!boundary.accepted)return boundary;
  const value=boundary.value,current=context.currentNodes??[],execution=current.find(node=>node.nodeId===value.executionNodeId);
  if(!execution||claimDigest(claimInputFromNode(execution))!==claimDigest(value.input))return reject('original execution source required');
  const node=buildNode({tenantId:'cambium',namespace:'founder-claim-acceptance',externalId:`claim-acceptance:${value.input.taskId}:${value.artifactDigest.slice(7)}`,
    parentNodeId:execution.nodeId,scope:'proof',desiredState:'Accept the exact source-linked claim-evidence inventory as the completed internal task.',
    currentState:'Founder semantic acceptance recorded; trusted owner attestation remains required.',owner:'founder',nextAction:'Verify the existing acceptance owner receipt for this artifact.',
    waitCondition:'Matching owner signature and immutable artifact readback.',proofRequired:true,reviewAt:null,status:'active',
    metadata:{claimAcceptanceSchema:CLAIM_ACCEPTANCE_SCHEMA,artifactDigest:value.artifactDigest,inputDigest:claimDigest(value.input),taskId:value.input.taskId,
      executionNodeId:execution.nodeId,policyDigest:CLAIM_POLICY_DIGEST,productPromotion:false},
    workObjectId:'sapling:iverif',workObjectKind:'sapling',pinnedLoadoutId:null,sourceRef:boundary.sourceRef,sourceDigest:boundary.sourceDigest,graphVersion:context.graphVersion??1,now:context.now});
  const prior=current.find(row=>row.nodeId===node.nodeId);if(prior){if(prior.sourceDigest!==node.sourceDigest)return reject('acceptance identity conflict');node.createdAt=prior.createdAt;}
  const compile=compileGoalGraph({tenantId:'cambium',expectedHeadDigest:value.expectedHeadDigest,actualHead:context.actualHead??null,currentNodes:current,
    proposedNodes:[...current.filter(row=>row.nodeId!==node.nodeId),node],graphVersion:context.graphVersion??1,sourceRef:boundary.sourceRef,sourceDigest:boundary.sourceDigest,now:context.now,loadoutAuthority:context.loadoutAuthority});
  return {...boundary,node,nodes:[node],compile};
}
