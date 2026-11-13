import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedGsdSelection, readDepartmentSources, type AcceptedGsdScope } from './readers.ts';
import { compileDepartmentPilot } from './pilot.ts';
import { KPI_DEFINITIONS } from './catalog.ts';
const now='2026-11-03T16:00:00Z', head='a'.repeat(64);
const node=(id:string,work='sapling:lumen-bar')=>({nodeId:id,tenantId:'cambium',namespace:'founder-bookkeeping',workObjectId:work,parentNodeId:'company',pinnedLoadoutId:null,metadata:{facet:'task',stage:'website',prerequisiteIds:''},status:'active',waitCondition:null,reviewAt:null,desiredState:'Reviewed outcome',currentState:'Awaiting review',sourceRef:'fixture:owner',owner:'founder',nextAction:null});
const scope=()=>({tenantId:'cambium',headDigest:head,observedAt:now,nodes:[node('a'),node('b'),node('t','program:temperance-hermes')] as any});
const accepted=():AcceptedGsdScope=>({tenantId:'cambium',workObjectId:'sapling:lumen-bar',headDigest:head,observedAt:now,expiresAt:'2026-11-04T00:00:00Z',sourceRef:'fixture:gsd-owner',isaAcceptanceRef:'ISA.md#accepted',planRef:'.planning/phases/01/01-PLAN.md',planDigest:head,tasks:[{nodeId:'b',sequence:2,state:'pending',dependsOn:[{nodeId:'a',satisfied:false,evidenceRef:''}]},{nodeId:'a',sequence:1,state:'pending',dependsOn:[]}]});
test('missing owner readers expose both products and all measurements as unavailable',async()=>{
 const result=await readDepartmentSources(scope());assert.equal(result.gsd.length,2);assert.ok(result.gsd.every(r=>r.state==='unavailable'&&r.taskIds.length===0));assert.equal(result.kpis.length,12);assert.ok(result.kpis.every(r=>r.state==='unavailable'&&r.observation===null));assert.equal(result.executionGranted,false);
});
test('accepted owner order and dependency satisfaction select display candidates only',()=>{
 const s=scope(),r=accepted();assert.deepEqual(acceptedGsdSelection(s,'sapling:lumen-bar',r),['a']);
 r.tasks[0].dependsOn[0]={nodeId:'a',satisfied:true,evidenceRef:'fixture:semantic-acceptance'};assert.deepEqual(acceptedGsdSelection(s,'sapling:lumen-bar',r),['a','b']);
 const p=compileDepartmentPilot({tenantId:s.tenantId,now,expectedHeadDigest:head,graph:{...s,rootId:'company'},eligibility:{sourceRef:r.sourceRef,taskIds:['a','b']}});
 assert.deepEqual(p.products[0].daily.map(n=>n.nodeId),['a','b']);assert.equal(p.executionGranted,false);assert.ok(p.products[0].nodes.every(n=>n.parentNodeId==='company'));
});
test('owner data refuses stale scope, expired approval, wrong product, duplicates, cycles and omitted prerequisites',()=>{
 for(const patch of [{tenantId:'other'},{headDigest:'b'.repeat(64)},{expiresAt:now},{observedAt:'2026-11-01T00:00:00Z'},{isaAcceptanceRef:''},{planDigest:'bad'}])assert.throws(()=>acceptedGsdSelection(scope(),'sapling:lumen-bar',{...accepted(),...patch}));
 let r=accepted();r.tasks[0].nodeId='t';assert.throws(()=>acceptedGsdSelection(scope(),'sapling:lumen-bar',r));
 r=accepted();r.tasks[0].sequence=1;assert.throws(()=>acceptedGsdSelection(scope(),'sapling:lumen-bar',r));
 r=accepted();r.tasks[1].dependsOn=[{nodeId:'b',satisfied:false,evidenceRef:''}];assert.throws(()=>acceptedGsdSelection(scope(),'sapling:lumen-bar',r));
 const s=scope();s.nodes[0].metadata.prerequisiteIds='required';assert.throws(()=>acceptedGsdSelection(s,'sapling:lumen-bar',accepted()));
});
test('KPI read-through binds immutable formula, product, cohort, denominator, window and single revision',async()=>{
 const d=KPI_DEFINITIONS[0], o={definitionId:d.id,version:d.version,productId:d.productId,cohort:d.cohort,window:'2026-11',observedAt:now,sourceRef:'fixture:measurement-owner',numerator:2,denominator:4};
 const read=async(definition:any,observations:any[])=> (await readDepartmentSources(scope(),{readKpi:async(_s,k)=>k.id===d.id?observations.map(observation=>({definition,observation})):null})).kpis[0];
 assert.equal((await read(d,[o])).state,'observed');
 for(const bad of [{...o,denominator:0},{...o,productId:'temperance'},{...o,cohort:'other'},{...o,window:'2026-10'},{...o,sourceRef:''}])assert.equal((await read(d,[bad])).state,'unavailable');
 assert.equal((await read({...d,formula:'changed'},[o])).state,'unavailable');assert.equal((await read(d,[o,o])).state,'unavailable');
 assert.equal((await read(d,[{...o,observedAt:'2026-10-01T00:00:00Z'}])).state,'stale');
});
test('a failed owner does not fabricate progress or erase other source availability',async()=>{
 const result=await readDepartmentSources(scope(),{readAcceptedGsd:async(_s,w)=>{if(w==='sapling:lumen-bar')return accepted();throw new Error('held')},readKpi:async()=>{throw new Error('unavailable')}});
 assert.equal(result.gsd[0].state,'available');assert.deepEqual(result.gsd[0].taskIds,['a']);assert.equal(result.gsd[1].state,'held');assert.ok(result.kpis.every(r=>r.observation===null));
});
