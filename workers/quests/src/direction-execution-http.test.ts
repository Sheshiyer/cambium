import {readFileSync} from 'node:fs';
import {d1BridgeStore,d1BridgeExecutionStore} from './index.ts';
import {createDirectionExecutionOwner} from './direction-execution-owner.ts';
import {nativeLaunchRequestKey,nativeLaunchRequestDigest} from './native-launch.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from './handler.ts';
import { directionExecutionD1Fixture } from './__fixtures__/direction-execution-d1.ts';
import { d1SharedDirectionStore } from './shared-directions-d1.ts';
import { d1SharedSignalStore } from './shared-signals-d1.ts';
import { patchDigest } from '../../../shared/cambium-patch-contract.ts';
async function setup(approved=false){
 const h=await directionExecutionD1Fixture(approved),kvRows=new Map<string,string>();let principal=h.f.scope.principal,authorized=true;
 const host:any={deps:{ownerOrigin:'https://cambium.test',now:()=>h.f.now,store:{readSession:async()=>({founderId:principal,tenantId:'cambium',clientId:'client-fixture',expiresAt:'2026-11-05T00:00:00.000Z'})},currentRole:async()=>authorized?'founder':null,enrolledTenants:async()=>['cambium']},client:()=>({})};
 const deps:any={kv:{get:async(k:string)=>kvRows.get(k)??null,put:async(k:string,v:string)=>{kvRows.set(k,v)},list:async(p:string)=>[...kvRows.keys()].filter(k=>k.startsWith(p))},nativeSessionHost:host,
  sharedSignalStore:d1SharedSignalStore(h.d1),sharedDirectionStore:d1SharedDirectionStore(h.d1),goalGraphStore:h.graph,now:()=>h.f.now,
  cambiumPilot:{policy:h.f.policy,runnerMemberId:h.f.runnerMemberId,admissions:h.store},nativeLaunchHost:{store:h.launch,owner:{supports:()=>true}}};
 const call=(method:string,path:string,payload?:unknown,headers={})=>handle({method,path,headers:{host:'cambium.test',authorization:'Bearer '+'cns1_'+'0'.repeat(43),'content-type':'application/json',...headers},...(payload?{body:JSON.stringify(payload)}:{})},deps);
 return{...h,deps,call,kvRows,revoke(){authorized=false},other(){principal='other-founder'}};
}
const body=(r:any)=>JSON.parse(r.body);
test('real handler prepares a complete canonical native review, commits through sole writer and explicitly derives admission',async()=>{
 const h=await setup();try{
  const preview=await h.call('GET','/v1/directions/cambium/direction-1/execution-review');assert.equal(preview.status,200,preview.body);assert.equal(body(preview).executionGranted,false);
  const request={schema:'cambium.direction-execution-intent.v1',operationId:'prepare-1',directionRevision:1,expectedHeadDigest:body(preview).expectedHeadDigest,policyDigest:body(preview).policyDigest};
  const prepared=await h.call('POST','/v1/directions/cambium/direction-1/proposal',request);assert.equal(prepared.status,200,prepared.body);const p=body(prepared);assert.equal(p.writerAuthority,false);assert.equal((await h.graph.readHead('cambium'))?.graphVersion,1);
  const reviewed=await h.call('POST','/v1/founder/proposal',{proposalId:p.proposalId});assert.equal(reviewed.status,200,reviewed.body);const r=body(reviewed);assert.equal(r.proposal.review.directionExecution.input.policyDigest,request.policyDigest);assert.equal(r.proposal.review.changeSet.nodesToCreate.length,1);
  const tuple={...r.proposal};delete tuple.tenantId;delete tuple.summary;delete tuple.review;
  const signed=await h.call('POST','/v1/founder/decision',{...tuple,decision:'approved',confirmation:r.approveConfirmation});assert.equal(signed.status,200,signed.body);assert.equal(body(signed).status,'approved');assert.equal(h.db.prepare('SELECT count(*) n FROM native_launch_admissions').get().n,0);
  const admitted=await h.call('POST','/v1/direction-executions/cambium/admit',{schema:'cambium.direction-admit.v1',proposalId:p.proposalId});assert.equal(admitted.status,200,admitted.body);assert.equal(body(admitted).launched,false);assert.equal(h.db.prepare('SELECT count(*) n FROM native_launch_admissions').get().n,1);
  const replay=await h.call('POST','/v1/directions/cambium/direction-1/proposal',request);assert.equal(body(replay).proposalId,p.proposalId);assert.equal(body(replay).duplicate,true);
  assert.equal((await h.call('POST','/v1/directions/cambium/direction-1/proposal',{...request,directionRevision:2})).status,409);
 }finally{h.db.close()}
});
test('unconfigured, foreign, mixed credentials and source changes do not prepare or admit work',async()=>{
 const h=await setup();try{
  assert.equal((await h.call('GET','/v1/directions/other/direction-1/execution-review')).status,403);
  assert.equal((await h.call('GET','/v1/directions/cambium/direction-1/execution-review',undefined,{cookie:'mixed'})).status,400);
  h.other();assert.equal((await h.call('GET','/v1/directions/cambium/direction-1/execution-review')).status,404);
  h.revoke();assert.equal((await h.call('GET','/v1/directions/cambium/direction-1/execution-review')).status,403);
  assert.equal(h.kvRows.size,0);
 }finally{h.db.close()}
 const q=await setup();try{q.deps.cambiumPilot=undefined;assert.equal((await q.call('GET','/v1/directions/cambium/direction-1/execution-review')).status,503);assert.equal(q.kvRows.size,0)}finally{q.db.close()}
});
test('coding pilot uses original reserved request, verifies terminal output and reads results after policy withdrawal without redispatch',async()=>{
 const h=await setup(true);try{
 for(const file of ['0001_fabric_tenant_bridge.sql','0003_bridge_execution_proof.sql'])h.db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 h.deps.bridgeStore=d1BridgeStore(h.d1);h.deps.executionStore=d1BridgeExecutionStore(h.d1);h.deps.directionAdmissionStore=h.store;h.deps.bridgeToken='bridge-test';
 const admitted=await h.store.admit(h.args);assert.ok(admitted.record);const review=admitted.record.review;
 const {tenantId,principalId,status,...capability}=(await h.launch.readAdmission(h.args.scope,admitted.record.admissionRef,h.f.now))!.admission;
 const requestId='real-fixture-request',attemptId='real-fixture-attempt',idempotencyNonce='fixture-nonce';
 const requestKey=nativeLaunchRequestKey(h.args.scope,requestId);
 const reserved=await h.launch.reserve({...h.args.scope,requestKey,requestId,attemptId,idempotencyNonce,capability,requestDigest:nativeLaunchRequestDigest({attemptId,idempotencyNonce,capability}),now:h.f.now});assert.equal(reserved.status,'reserved');
 const owner=createDirectionExecutionOwner({db:h.d1,policy:h.f.policy,runnerMemberId:h.f.runnerMemberId,bridge:h.deps.bridgeStore,executions:h.deps.executionStore,now:()=>h.f.now});
 assert.equal((await owner.submit({...h.args.scope,requestKey,requestId,attemptId,capability,idempotencyToken:requestKey})).state,'queued');
 const directiveId=review.directiveId,memberId=review.runnerMemberId,idempotencyKey=review.idempotencyKey;
 const executionId='exec_'+patchDigest({memberId,directiveId,idempotencyKey}).slice(7,39),runnerId='runner-test',hostIdentity='host-test';
 const bridge=(path:string,payload:unknown)=>h.call('POST',path,payload,{authorization:'Bearer bridge-test'});
 const claim=await bridge('/v1/bridge/executions/claim',{schema:'thoughtseed.hermes.execution_claim.v1',memberId,directiveId,idempotencyKey,executionId,runnerId,hostIdentity});assert.equal(claim.status,200,claim.body);const c=body(claim);
 const result={schema:'thoughtseed.cambium.patch.result.v1',taskId:review.input.taskId,directionId:review.direction.id,directionRevision:review.direction.revision,executionId,inputDigest:review.inputDigest,policyDigest:patchDigest(review.policy),baseCommit:review.input.baseCommit,patchDigest:review.input.patchDigest,image:review.policy.image,baselineExitCode:1,candidateExitCode:0,diffBase64:review.input.patchBase64,baselineLog:'synthetic baseline failure',candidateLog:'synthetic candidate pass',status:'result-ready',acceptance:'review-required',externalActions:'none'};
 function outcome(r:any){const core={schema:'thoughtseed.hermes.execution_attestation.v1',executionId,directiveId,idempotencyKey,runnerId,hostIdentity,command:'cambium.patch.verify',status:'executed',exitCode:0,inputDigest:review.inputDigest,outputDigest:patchDigest(r),cambiumPatchResult:r,startedAt:h.f.now,finishedAt:h.f.now};return{schema:'thoughtseed.hermes.execution_outcome.v1',memberId,directiveId,idempotencyKey,executionId,runnerId,claimId:c.claimId,fencingToken:c.fencingToken,attempt:c.attempt,status:'executed',attestation:{...core,id:'att_'+patchDigest(core).slice(7,39)}};}
 assert.equal((await bridge('/v1/bridge/executions/outcome',outcome({...result,policyDigest:'sha256:'+'f'.repeat(64)}))).status,409);
 assert.equal((await bridge('/v1/bridge/executions/outcome',outcome(result))).status,200);
 h.deps.cambiumPilot=undefined; // Withdrawal cannot erase already completed evidence.
 const read=await h.call('GET','/v1/direction-executions/cambium/'+requestId+'/result');assert.equal(read.status,200,read.body);assert.deepEqual(body(read).result,result);assert.equal(body(read).acceptance,'review-required');
 assert.equal((await owner.read({...h.args.scope,requestKey,executionPlant:'hermes-remote'})).state,'succeeded');
 const replay=await bridge('/v1/bridge/executions/claim',{schema:'thoughtseed.hermes.execution_claim.v1',memberId,directiveId,idempotencyKey,executionId,runnerId,hostIdentity});assert.equal(body(replay).status,'terminal');assert.deepEqual(body(replay).outcome.attestation.cambiumPatchResult,result);
 assert.equal((await bridge('/v1/bridge/ack',{memberId,ids:[directiveId]})).status,200);
 assert.equal(h.db.prepare('SELECT count(*) n FROM bridge_directives').get().n,1);
 h.other();assert.equal((await h.call('GET','/v1/direction-executions/cambium/'+requestId+'/result')).status,404);
 }finally{h.db.close()}
});
