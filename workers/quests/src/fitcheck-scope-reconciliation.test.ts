import test from 'node:test';
import assert from 'node:assert/strict';
import POLICY from '../../../docs/project-management/fitcheck-scope-reconciliation.v1.json' with { type: 'json' };
import { FITCHECK_SCOPE_SCHEMA, compileFitcheckScope, parseFitcheckScopeBoundary, fitcheckScopeTaskMatches, fitcheckReferencesClear } from './fitcheck-scope-reconciliation.ts';
import { makeGoalGraphHead } from './goal-graph/compiler.ts';
import { GOAL_GRAPH_LOADOUT_AUTHORITY } from './goal-graph-loadout-registry.ts';
import { handle } from './handler.ts';
const NOW='2026-11-04T12:00:00.000Z';
function fixture() {
 const removed=structuredClone(POLICY.removedNode) as any, retained=structuredClone(POLICY.retainedNode) as any;
 const root={...retained,nodeId:retained.parentNodeId,namespace:'root',externalId:'root',parentNodeId:null,scope:'macro',workObjectId:null,workObjectKind:null,pinnedLoadoutId:null};
 const nodes=[root,retained,removed],head=makeGoalGraphHead('cambium',nodes,18,NOW);
 const context={currentNodes:nodes,actualHead:head,loadoutAuthority:GOAL_GRAPH_LOADOUT_AUTHORITY,now:NOW};
 const compiled=compileFitcheckScope(context,head.graphDigest);assert.equal(compiled.compile.status,'compiled');if(compiled.compile.status!=='compiled')throw Error('fixture');
 const raw={schema:FITCHECK_SCOPE_SCHEMA,version:1,tenantId:'cambium',expectedHeadDigest:head.graphDigest,changeDigest:compiled.compile.changeSet.changeDigest};
 const entries=new Map<string,string>();let commits=0,clear=true;
 const deps:any={kv:{get:async(k:string)=>entries.get(k)??null,put:async(k:string,v:string)=>{entries.set(k,v)},list:async(p:string)=>[...entries.keys()].filter(k=>k.startsWith(p))},bridgeToken:'admin-fixture',assignmentToken:'assignment-fixture',now:()=>NOW,fitcheckReferenceReadback:async()=>clear,goalGraphStore:{readHead:async()=>head,readNodes:async()=>nodes,commit:async()=>{commits++;throw Error('commit forbidden')}}};
 const submit=(body:unknown=raw,token='admin-fixture')=>handle({method:'POST',path:'/v1/bridge/goal-graph-intake',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(body)},deps);
 return{removed,retained,context,compiled,raw,entries,deps,submit,commits:()=>commits,setClear(v:boolean){clear=v}};
}
test('Fitcheck canonical intake is closed, admin-only and pending-only with stable replay',async()=>{
 const h=fixture();assert.equal(parseFitcheckScopeBoundary({...h.raw,changeSet:{}}).accepted,false);
 assert.equal((await h.submit(h.raw,'wrong')).status,401);
 assert.equal((await h.submit(h.raw,'assignment-fixture')).status,403);
 const r=await h.submit();assert.equal(r.status,200,r.body);const receipt=JSON.parse(r.body);assert.equal(receipt.accepted,true);
 const key=`goal-graph-intake-task:cambium:${h.raw.changeDigest}`;const task=JSON.parse(h.entries.get(key)!);
 assert.equal(task.status,'pending');assert.equal(task.changeSet.nodesToCreate.length,1);assert.equal(task.changeSet.nodesToRemove.length,1);assert.equal(task.changeSet.nodesToUpdate.length,0);
 assert.equal(task.node.reviewAt,null);assert.equal(task.node.status,'blocked');assert.equal(task.node.metadata.preflightSha256,undefined);assert.ok(task.node.metadata.identityReconciliation.historicalPreflightSha256);
 const expiry=task.approvalExpiresAt;assert.equal((await h.submit()).status,200);assert.equal(JSON.parse(h.entries.get(key)!).approvalExpiresAt,expiry);assert.equal(h.commits(),0);
 assert.equal(fitcheckScopeTaskMatches(task,h.context),true);
 task.changeSet.nodesToCreate[0].reviewAt='2026-11-05T00:00:00.000Z';assert.equal(fitcheckScopeTaskMatches(task,h.context),false);
});
test('Fitcheck sources, head and live reference fences cannot be bypassed',async()=>{
 const h=fixture();h.setClear(false);assert.equal((await h.submit()).status,503);assert.equal(h.entries.size,0);h.setClear(true);
 assert.equal(JSON.parse((await h.submit({...h.raw,changeDigest:'a'.repeat(64)})).body).accepted,false);
 assert.equal((await h.submit({...h.raw,expectedHeadDigest:'b'.repeat(64)})).status,409);
 h.context.currentNodes[2].status='active';assert.throws(()=>compileFitcheckScope(h.context,h.context.actualHead.graphDigest));assert.equal(h.commits(),0);
});
test('reference readback fails closed on positive references, unavailable reads and absent rows',async()=>{
 const db=(v:any)=>({prepare:()=>({bind:()=>({first:async()=>v})})});
 assert.equal(await fitcheckReferencesClear(db({refs:0})),true);assert.equal(await fitcheckReferencesClear(db({refs:1})),false);assert.equal(await fitcheckReferencesClear(db(null)),false);
 assert.equal(await fitcheckReferencesClear({prepare(){throw Error('unavailable')}}),false);
});
