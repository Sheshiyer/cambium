import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOperationalWorkIntent, OPERATIONAL_WORK_SCHEMA } from './operational-work-intake.ts';
import { makeGoalGraphHead } from './goal-graph/compiler.ts';
import { GOAL_GRAPH_LOADOUT_AUTHORITY } from './goal-graph-loadout-registry.ts';
import { buildDirectionExecutionProposal, directionExecutionTaskReview, directionExecutionIdentity, DIRECTION_EXECUTION_INTENT } from './direction-execution-review.ts';
import { patchDigest, CAMBIUM_PATCH_PATHS, CAMBIUM_PATCH_TEST, CAMBIUM_PATCH_LIMITS, parseCambiumPatchInput } from '../../../shared/cambium-patch-contract.ts';
import { CAMBIUM_CODE_PILOT_BASE, CAMBIUM_CODE_PILOT_PATCH_DIGEST, CAMBIUM_CODE_PILOT_PATCH_BASE64 } from './cambium-code-pilot-input.ts';
import { directionExecutionFixture as fixture } from './__fixtures__/direction-execution.ts';

test('actual proposed code input is bounded and compiles only an execution child',()=>{
 const f=fixture(),r=buildDirectionExecutionProposal(f);assert.ok(parseCambiumPatchInput(r.review.input,f.policy));
 assert.equal(r.changeSet.nodesToCreate.length,1);assert.equal(r.changeSet.nodesToUpdate.length,0);assert.equal(r.changeSet.nodesToRemove.length,0);
 assert.equal(r.node.parentNodeId,f.nodes[0].nodeId);assert.equal(r.review.input.approvedGraphVersion,2);assert.equal(r.node.metadata.executionAdmissionDispatchDigest,r.review.inputDigest);
 assert.deepEqual(f.nodes[0].metadata,{operationalWorkSchema:OPERATIONAL_WORK_SCHEMA,workName:'Cambium'});
 assert.equal(directionExecutionTaskReview({directionExecution:r.review,node:r.node,changeSet:r.changeSet,changeDigest:r.changeSet.changeDigest,tenantId:'cambium'}),r.review);
});
test('review refuses stale scope, direction, signal, graph, policy and unregistered loadout',()=>{
 for(const mutate of [
  f=>{f.scope.principal='another'},f=>{f.request.directionRevision=2},f=>{f.signals[0].revision=4},f=>{f.signals[0].projectIds=[]},
  f=>{f.request.expectedHeadDigest='b'.repeat(64)},f=>{f.direction.workNodeId='unmapped'},f=>{f.nodes[0].status='paused'},
  f=>{f.request.policyDigest='sha256:'+'b'.repeat(64)},f=>{f.policy.modelPool='noesis-a'},f=>{f.patchBase64='bad'},
  f=>{f.loadoutAuthority={resolve:()=>null}},f=>{f.runnerMemberId='../escape'},f=>{f.now='invalid'},
 ]){const f=fixture();mutate(f);assert.throws(()=>buildDirectionExecutionProposal(f));}
});
test('operation identity is stable for exact replay and binds every client pin',()=>{
 const f=fixture(),original=directionExecutionIdentity(f.scope,f.direction.id,f.request);
 assert.deepEqual(original,directionExecutionIdentity(f.scope,f.direction.id,f.request));
 assert.notEqual(original.contentDigest,directionExecutionIdentity(f.scope,f.direction.id,{...f.request,directionRevision:2}).contentDigest);
});
test('canonical task refuses substitution of input, policy, direction and graph pins',()=>{
 for(const mutate of [r=>{r.review.input.baseCommit='b'.repeat(40)},r=>{r.review.direction.title='substituted'},r=>{r.review.policy.acceptance='accepted'},r=>{r.node.parentNodeId='different'},r=>{r.node.owner='different'}]){
  const r=buildDirectionExecutionProposal(fixture());mutate(r);assert.equal(directionExecutionTaskReview({directionExecution:r.review,node:r.node,changeSet:r.changeSet,changeDigest:r.changeSet.changeDigest,tenantId:'cambium'}),null);
 }
});

test('fresh review preserves an older draft-origin head and explicitly pins the current Work snapshot',()=>{
 const f=fixture();f.direction.graphHeadDigest='b'.repeat(64);const r=buildDirectionExecutionProposal(f);
 assert.equal(r.review.direction.graphHeadDigest,'b'.repeat(64));assert.equal(r.review.sourceHead.graphDigest,f.head.graphDigest);assert.deepEqual(r.review.work,f.nodes[0]);
});
