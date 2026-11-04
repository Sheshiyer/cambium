import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {directionExecutionD1Fixture} from './__fixtures__/direction-execution-d1.ts';
import {createDirectionExecutionOwner,composeDirectionExecutionHost} from './direction-execution-owner.ts';
import type {NativeLaunchHost} from './native-launch.ts';
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

test('combined native host selects only the original scoped reservation owner and never falls through',async()=>{
 const h=await setup();await h.reserve();
 h.db.exec(`INSERT INTO native_launch_admissions
   SELECT tenant_id,'iv-admission',principal_id,'sapling:iverif',graph_version,loadout_id,input_digest,
     execution_plant,supported_action,expires_at,status,recorded_at FROM native_launch_admissions;
   INSERT INTO native_launch_requests
   SELECT 'iv-key',tenant_id,principal_id,'iv-request','iv-attempt','iv-nonce',request_digest,
     'sapling:iverif','iv-admission',graph_version,loadout_id,input_digest,execution_plant,supported_action,
     expires_at,dispatch,execution,owner_ref,reserved_at,observed_at FROM native_launch_requests;`);
 const calls:string[]=[];
 const host=(name:string):NativeLaunchHost=>({verify:async()=>null,store:h.launch,now:()=>h.f.now,owner:{
  supports:()=>true,submit:async()=>{calls.push(name+':submit');return{state:'queued'}},
  read:async()=>{calls.push(name+':read');return{state:'running'}}}});
 const pilot=host('cambium'),existing=host('iverif'),combined=composeDirectionExecutionHost(h.d1,pilot,existing);
 assert.equal((await combined.owner.submit(h.input)).state,'queued');
 const iv={...h.input,requestKey:'iv-key',requestId:'iv-request',attemptId:'iv-attempt',idempotencyToken:'iv-key',
   capability:{...h.input.capability,workId:'sapling:iverif',admissionRef:'iv-admission'}};
 assert.equal((await combined.owner.submit(iv)).state,'queued');
 assert.equal((await combined.owner.submit({...h.input,capability:iv.capability})).state,'refused');
 assert.equal((await combined.owner.submit({...h.input,idempotencyToken:'other'})).state,'refused');
 assert.equal((await combined.owner.submit({...iv,principalId:'foreign'})).state,'refused');
 assert.equal((await combined.owner.read({...h.args.scope,requestKey:'iv-key',executionPlant:'hermes-remote'})).state,'running');
 assert.equal((await combined.owner.read({...h.args.scope,requestKey:h.input.requestKey,executionPlant:'hermes-remote'})).state,'running');
 assert.equal((await combined.owner.read({...h.args.scope,requestKey:'missing',executionPlant:'hermes-remote'})).state,'not_found');
 pilot.owner.submit=async()=>{throw Error('selected_owner_failed')};
 await assert.rejects(combined.owner.submit(h.input),/selected_owner_failed/);
 assert.deepEqual(calls,['cambium:submit','iverif:submit','iverif:read','cambium:read']);
 h.db.close();
});
