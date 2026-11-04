import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {directionExecutionD1Fixture} from './__fixtures__/direction-execution-d1.ts';
import {createDirectionExecutionOwner} from './direction-execution-owner.ts';
import {d1BridgeStore,d1BridgeExecutionStore} from './index.ts';
import {nativeLaunchRequestKey,nativeLaunchRequestDigest} from './native-launch.ts';
async function setup() {
 const h=await directionExecutionD1Fixture();
 h.db.exec(readFileSync(new URL('../migrations/0001_fabric_tenant_bridge.sql',import.meta.url),'utf8'));
 h.db.exec(readFileSync(new URL('../migrations/0003_bridge_execution_proof.sql',import.meta.url),'utf8'));
 const admitted=await h.store.admit(h.args);assert.ok(admitted.record);
 const a=(await h.launch.readAdmission(h.args.scope,admitted.record.admissionRef,h.f.now))!.admission;
 const {tenantId,principalId,status,...capability}=a;
 const requestId='pilot-request',attemptId='pilot-attempt',idempotencyNonce='pilot-nonce';
 const input={...h.args.scope,requestKey:nativeLaunchRequestKey(h.args.scope,requestId),requestId,attemptId,capability};
 const owner=createDirectionExecutionOwner({db:h.d1,policy:h.f.policy,runnerMemberId:h.f.runnerMemberId,bridge:d1BridgeStore(h.d1),executions:d1BridgeExecutionStore(h.d1),now:()=>h.f.now});
 const reserve=()=>h.launch.reserve({...input,idempotencyNonce,requestDigest:nativeLaunchRequestDigest({attemptId,idempotencyNonce,capability}),now:h.f.now});
 return {...h,owner,input:{...input,idempotencyToken:input.requestKey},reserve};
}
test('queue submission requires a real reservation and stays one immutable directive on duplicate submit/read',async()=>{
 const h=await setup();assert.equal((await h.owner.submit(h.input)).state,'not_found');
 assert.equal((await h.reserve()).status,'reserved');
 assert.equal((await h.owner.submit(h.input)).state,'queued');
 assert.equal((await h.owner.submit(h.input)).state,'queued');
 assert.equal((await h.owner.read({...h.args.scope,requestKey:h.input.requestKey,executionPlant:'hermes-remote'})).state,'queued');
 assert.equal(h.db.prepare('SELECT count(*) n FROM bridge_directives').get().n,1);
 assert.equal((await h.owner.read({...h.args.scope,principalId:'foreign',requestKey:h.input.requestKey,executionPlant:'hermes-remote'})).state,'not_found');h.db.close();
});
test('changed source or reservation identity cannot enqueue after reservation',async()=>{
 for (const mutation of ["UPDATE shared_signals SET revision=4","UPDATE shared_directions SET revision=2"]){
 const h=await setup();await h.reserve();h.db.exec(mutation);
 assert.equal((await h.owner.submit(h.input)).state,'not_found');assert.equal(h.db.prepare('SELECT count(*) n FROM bridge_directives').get().n,0);h.db.close();
 }
 const h=await setup();await h.reserve();assert.equal((await h.owner.submit({...h.input,attemptId:'other'})).state,'not_found');h.db.close();
});
