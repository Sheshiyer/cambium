import assert from 'node:assert/strict';
import { parseOperationalWorkIntent, OPERATIONAL_WORK_SCHEMA } from '../operational-work-intake.ts';
import { makeGoalGraphHead } from '../goal-graph/compiler.ts';
import { GOAL_GRAPH_LOADOUT_AUTHORITY } from '../goal-graph-loadout-registry.ts';
import { buildDirectionExecutionProposal, directionExecutionTaskReview, directionExecutionIdentity, DIRECTION_EXECUTION_INTENT } from '../direction-execution-review.ts';
import { patchDigest, CAMBIUM_PATCH_PATHS, CAMBIUM_PATCH_TEST, CAMBIUM_PATCH_LIMITS, parseCambiumPatchInput } from '../../../../shared/cambium-patch-contract.ts';
import { CAMBIUM_CODE_PILOT_BASE, CAMBIUM_CODE_PILOT_PATCH_DIGEST, CAMBIUM_CODE_PILOT_PATCH_BASE64 } from '../cambium-code-pilot-input.ts';
const now='2026-11-04T00:00:00.000Z';
export function directionExecutionFixture(){
 const result=parseOperationalWorkIntent({schema:OPERATIONAL_WORK_SCHEMA,version:1,tenantId:'cambium',clientRequestId:'work-1',expectedHeadDigest:null,goals:[{namespace:'founder-operational-work',externalId:'cambium-work',parentNodeId:null,scope:'meso',desiredState:'Coordinate Cambium',currentState:'Inbox live',owner:'founder',nextAction:'Review direction',proofRequired:true,status:'active',metadata:{},workObjectId:'sapling:cambium',workObjectKind:'sapling'}]},'access:fixture',{currentNodes:[],actualHead:null,graphVersion:1,now});assert.ok(result.accepted);if(!result.accepted)throw Error();
 const nodes=[result.node],head=makeGoalGraphHead('cambium',nodes,1,now),scope={tenantId:'cambium',principal:'fixture-founder'};
 const policy={schema:'thoughtseed.cambium.patch.policy.v1',id:'cambium.shared-signal-title.v1',version:1,workObjectId:'sapling:cambium',baseCommit:CAMBIUM_CODE_PILOT_BASE,patchDigest:CAMBIUM_CODE_PILOT_PATCH_DIGEST,allowedPaths:[...CAMBIUM_PATCH_PATHS],testCommand:[...CAMBIUM_PATCH_TEST],image:'node@sha256:'+'0'.repeat(64),modelPool:'noesis-free',acceptance:'review-required',externalActions:'none',limits:{...CAMBIUM_PATCH_LIMITS}};
 const direction={...scope,id:'direction-1',title:'Reject blank signal titles',body:'Verify the bounded title patch.',workObjectId:'sapling:cambium',workNodeId:result.node.nodeId,graphHeadDigest:head.graphDigest,signalPins:[{id:'signal-1',revision:3}],revision:1,createdAt:now,updatedAt:now};
 const signals=[{...scope,id:'signal-1',title:'Observation',body:'Source',projectIds:['sapling:cambium'],revision:3,createdAt:now,updatedAt:now,source:{system:'cambium-native',recordId:'fixture-1',observedAt:now,reference:null}}];
 return{scope,direction,signals,head,nodes,policy,request:{schema:DIRECTION_EXECUTION_INTENT,operationId:'operation-1',directionRevision:1,expectedHeadDigest:head.graphDigest,policyDigest:patchDigest(policy)},patchBase64:CAMBIUM_CODE_PILOT_PATCH_BASE64,runnerMemberId:'runner-fixture',now,loadoutAuthority:GOAL_GRAPH_LOADOUT_AUTHORITY};
}
