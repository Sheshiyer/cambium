import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { directionExecutionFixture } from './__fixtures__/direction-execution.ts';
import { buildDirectionExecutionProposal } from './direction-execution-review.ts';
import { d1GoalGraphStore, goalGraphApprovalDigest } from './goal-graph-store.ts';
import { compileGoalGraph } from './goal-graph/compiler.ts';
import { d1SharedDirectionStore } from './shared-directions-d1.ts';
import { d1DirectionAdmissionStore } from './direction-execution-d1.ts';
import { d1NativeLaunchStore } from './native-launch-d1.ts';
import { nativeLaunchRequestDigest, nativeLaunchRequestKey } from './native-launch.ts';
import { patchDigest } from '../../../shared/cambium-patch-contract.ts';
import { directionExecutionD1Fixture as setup } from './__fixtures__/direction-execution-d1.ts';

test('only an actual sole-writer approval can atomically derive one scoped native capability',async()=>{
 const h=await setup(),r=await h.store.admit(h.args);assert.equal(r.status,'admitted');assert.ok(r.record);
 assert.equal(h.db.prepare('SELECT count(*) n FROM native_launch_admissions').get().n,1);
 const capability=await h.launch.readAdmission(h.args.scope,r.record.admissionRef,h.f.now);assert.equal(capability?.hold,null);
 assert.equal((await h.store.admit(h.args)).status,'existing');assert.equal(h.db.prepare('SELECT count(*) n FROM native_launch_admissions').get().n,1);
 assert.throws(()=>h.db.prepare("UPDATE native_direction_admissions SET policy_digest='changed'").run(),/immutable/);
 assert.equal(await h.store.read({...h.args.scope,principalId:'foreign'},r.record.admissionRef),null);
 const legacy=d1NativeLaunchStore(h.d1);assert.equal((await legacy.readAdmission(h.args.scope,r.record.admissionRef,h.f.now))?.hold,'graph_changed');
 h.db.close();
});
test('missing approval, changed policy, scope or revoked authorization creates no admission',async()=>{
 const h=await setup(false);assert.equal((await h.store.admit(h.args)).status,'refused');assert.equal(h.db.prepare('SELECT count(*) n FROM native_launch_admissions').get().n,0);h.db.close();
 const a=await setup();for(const change of [{policyDigest:'sha256:'+'f'.repeat(64)},{scope:{...a.args.scope,principalId:'foreign'}},{authorize:async()=>false}])await assert.rejects(a.store.admit({...a.args,...change}));assert.equal(a.db.prepare('SELECT count(*) n FROM native_launch_admissions').get().n,0);a.db.close();
});
test('the insert itself refuses a signal revision race after all prior reads',async()=>{
 const h=await setup();h.setRace(()=>h.db.prepare('UPDATE shared_signals SET revision=4').run());assert.equal((await h.store.admit(h.args)).status,'refused');assert.equal(h.db.prepare('SELECT count(*) n FROM native_launch_admissions').get().n,0);h.db.close();
});
test('actual native reservation rechecks direction and signal pins after admission',async()=>{
 for(const mutation of ['UPDATE shared_signals SET revision=4','UPDATE shared_directions SET revision=2']){
  const h=await setup(),r=await h.store.admit(h.args);assert.ok(r.record);const found=await h.launch.readAdmission(h.args.scope,r.record.admissionRef,h.f.now);assert.ok(found);const {tenantId,principalId,status,...capability}=found.admission;
  h.db.exec(mutation);const requestId='request-1',attemptId='attempt-1',idempotencyNonce='nonce-1';
  const result=await h.launch.reserve({...h.args.scope,requestKey:nativeLaunchRequestKey(h.args.scope,requestId),requestId,attemptId,idempotencyNonce,capability,requestDigest:nativeLaunchRequestDigest({attemptId,idempotencyNonce,capability}),now:h.f.now});assert.equal(result.status,'refused');assert.equal(h.db.prepare('SELECT count(*) n FROM native_launch_requests').get().n,0);h.db.close();
 }
});

test('the sole graph writer atomically refuses a changed direction source at founder approval',async()=>{
 const h=await setup(false),task=h.args.task;
 h.setDecisionRace(()=>h.db.prepare('UPDATE shared_signals SET revision=4').run());
 const core={tenantId:'cambium',changeDigest:task.changeDigest,intentVersion:1,approverId:h.args.scope.principalId,expiresAt:'2026-11-04T01:00:00.000Z',nonce:task.approvalNonce};
 const result=await h.graph.commit({tenantId:'cambium',changeSet:task.changeSet,approval:{...core,decision:'approved',approvalDigest:goalGraphApprovalDigest(core)},now:h.f.now});
 assert.notEqual(result.status,'committed');assert.equal((await h.graph.readHead('cambium'))?.graphVersion,1);
 assert.equal(h.db.prepare('SELECT count(*) n FROM goal_graph_approvals WHERE change_digest=?').get(task.changeDigest).n,0);h.db.close();
});
