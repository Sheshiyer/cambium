import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {readPlanningOwner,growthMeasurement,bindOwnerReaders,type EditorialEvidence} from './department-owner-readers.ts';
import {KPI_DEFINITIONS} from '../../../shared/department-pilot/catalog.ts';
import { observeKpi } from '../../../shared/department-pilot/pilot.ts';
import {readDepartmentSources} from '../../../shared/department-pilot/readers.ts';
const now='2026-11-04T00:00:00Z';
const definition=KPI_DEFINITIONS.find(d=>d.productId==='lumenbar'&&d.departmentId==='growth')!;
const published={observedAt:'2026-11-03T09:13:03Z',publicUrl:'https://example.test/receipt',receiptDigest:'a'.repeat(64),observationDigest:'b'.repeat(64),trust:'operator-observed; not independently authenticated'};
const evidence=():EditorialEvidence=>({schema:'cambium.editorial-kpi-source-read.v1',queueDigest:'q',approvalDigest:'a',consumerDigest:'c',items:[
 {id:'launch-lumenbar-x-v5a',status:'published',scheduled_for:'2026-11-03T13:45:00+05:30',publication:published},
 {id:'launch-lumenbar-redditProfile-v5a',status:'published',scheduled_for:'2026-11-03T14:15:00+05:30',publication:published},
 {id:'launch-lumenbar-sideproject-v5a',status:'approved',scheduled_for:'2026-11-04T14:45:00+05:30',publication:null},
] as EditorialEvidence['items']});
test('read actual planning files but never turn draft/cached approvals into admitted work',async()=>{
 const root=await mkdtemp(join(tmpdir(),'owner-reader-'));
 try {
  execFileSync('git',['init','-q',root]);execFileSync('git',['-C',root,'-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','--allow-empty','-qm','fixture']);
  let read=await readPlanningOwner(root,'lumenbar');assert.equal(read.hold.state,'unavailable');assert.ok(read.files.every(f=>f.digest===null));
  await mkdir(join(root,'.planning'));await writeFile(join(root,'ISA.md'),'Fixture acceptance criteria');await writeFile(join(root,'.planning/ORCHESTRATION.json'),JSON.stringify({state:'draft',approval:{approved:true}}));
  read=await readPlanningOwner(root,'lumenbar');assert.equal(read.hold.state,'held');assert.match(read.hold.reason,/mapping/);
  const result=await readDepartmentSources({tenantId:'cambium',headDigest:'f'.repeat(64),observedAt:now,nodes:[]},bindOwnerReaders([read],evidence()));
  assert.equal(result.gsd[0].state,'held');assert.equal(result.gsd[0].taskIds.length,0);assert.equal(result.executionGranted,false);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('measure only the due, approved complete product cohort with attributable native evidence',()=>{
 const value=growthMeasurement(definition,evidence(),now,'2026-11')!;assert.deepEqual([value[0].observation.numerator,value[0].observation.denominator],[2,2]);
 assert.match(value[0].observation.sourceRef,/operator-observed/);
 const stale=evidence();stale.items[0].publication={...published,observedAt:'2026-11-01T00:00:00Z'};assert.equal(growthMeasurement(definition,stale,now,'2026-11'),null);
 assert.equal(growthMeasurement(definition,evidence(),'2026-11-04T12:00:00Z','2026-11'),null);
 assert.equal(growthMeasurement(definition,evidence(),now,'2026-10'),null);
 const duplicate=evidence();duplicate.items[2]=duplicate.items[1];assert.throws(()=>growthMeasurement(definition,duplicate,now,'2026-11'),/cohort/);
 const missing=evidence();missing.items[0].publication=null;assert.equal(growthMeasurement(definition,missing,now,'2026-11'),null);
});

test('aggregate freshness cannot outlive the oldest native readback',()=>{
 const e=evidence();e.items[0].publication={...published,observedAt:'2026-11-03T00:01:00Z'};
 const value=growthMeasurement(definition,e,now,'2026-11')![0].observation;
 assert.equal(value.observedAt,'2026-11-03T00:01:00.000Z');
 assert.equal(observeKpi(definition,value,'2026-11-04T02:00:00Z','2026-11').state,'stale');
});
