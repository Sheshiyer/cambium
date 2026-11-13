import test from 'node:test';
import assert from 'node:assert/strict';
import { createDepartmentReader } from './department-reader.ts';
import { compileDepartmentPilot } from '../../../../shared/department-pilot/pilot.ts';
import { readDepartmentSources } from '../../../../shared/department-pilot/readers.ts';
const fixture=()=>({schema:'cambium.founder.bookkeeping-graph.v1',origin:'d1',tenantId:'cambium',canonicalReadback:true,writerAuthority:false,executionGranted:false,head:{graphVersion:11,graphDigest:'a'.repeat(64)},rootId:'company',servedAt:'2026-11-03T16:00:00Z',decisions:[],edges:[{kind:'contains',fromId:'company',toId:'a'}],nodes:[{nodeId:'a',parentNodeId:'company',tenantId:'cambium',namespace:'founder-bookkeeping',workObjectId:'sapling:lumen-bar',pinnedLoadoutId:null,metadata:{facet:'task',stage:'website',approved:true},status:'active',waitCondition:null,reviewAt:null,desiredState:'Outcome',currentState:'Pending',sourceRef:'fixture:graph',owner:'founder',nextAction:null}]});
test('legacy authenticated response retains IDs/root and explicitly holds missing readers',()=>{
 const f=fixture(),before=JSON.stringify(f),r=createDepartmentReader(f),p=compileDepartmentPilot(r.input);assert.equal(JSON.stringify(f),before);assert.equal(p.products[0].nodes[0].parentNodeId,'company');assert.equal(p.products[0].nodes[0].gap,null);assert.equal(p.products[0].daily.length,0);assert.equal(r.observations?.length,0);assert.match(r.readerStatus!.join(' '),/unavailable/);
});
test('source pack is head-bound and duplicate owner revisions fail closed',async()=>{
 const f=fixture();const source=await readDepartmentSources({tenantId:'cambium',headDigest:f.head.graphDigest,observedAt:f.servedAt,nodes:f.nodes as any});
 assert.equal(createDepartmentReader({...f,departmentSources:source}).readerStatus?.length,14);
 assert.throws(()=>createDepartmentReader({...f,departmentSources:{...source,headDigest:'b'.repeat(64)}}));
 const duplicate=structuredClone(source);duplicate.gsd[1]=duplicate.gsd[0];assert.throws(()=>createDepartmentReader({...f,departmentSources:duplicate}));
 const crossed=structuredClone(source);crossed.gsd[1]={productId:'temperance',state:'available',taskIds:['a'],sourceRef:'fixture:wrong-product',reason:'test'};assert.throws(()=>createDepartmentReader({...f,departmentSources:crossed}));
});
