import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDepartmentPilot, classifyPilotChange, observeKpi, prepareTasteContext, learningCandidate } from './pilot.ts';
import { DEPARTMENTS, KPI_DEFINITIONS } from './catalog.ts';
import type { PilotInput } from './pilot.ts';
const now = '2026-11-03T10:30:00Z';
const node = (id: string, work = 'sapling:lumen-bar', stage = 'website', parent: string | null = null) => ({
  nodeId: id, tenantId: 'cambium', namespace: 'founder-bookkeeping', externalId: null,
  parentNodeId: parent, workObjectId: work, scope: 'micro' as const, desiredState: 'Improve the launch surface',
  currentState: 'Review due', owner: 'founder', nextAction: 'Review exact copy', waitCondition: null,
  proofRequired: true, reviewAt: null, status: 'active' as const, sourceRef: 'fixture:approved-work',
  sourceDigest: 'sha256:' + 'a'.repeat(64), graphVersion: 11, metadata: { stage, facet: 'task', dueFor: '2026-11-03T14:15:00+05:30' },
  createdAt: now, updatedAt: now,
});
function input(): PilotInput { return { tenantId: 'cambium', now, graph: { tenantId: 'cambium', headDigest: 'a'.repeat(64), observedAt: now, nodes: [node('one'), node('two', 'program:temperance-hermes', 'unknown')] }, expectedHeadDigest: 'a'.repeat(64), eligibility: { sourceRef: 'fixture:GSD', taskIds: ['one'] } }; }
test('reuses org roles and preserves identities, containment and product isolation', () => {
  const a = input(); a.graph.nodes.push(node('child', 'sapling:lumen-bar', '', 'one'));
  const before = JSON.stringify(a); const p = compileDepartmentPilot(a);
  assert.equal(JSON.stringify(a), before);
  assert.deepEqual(p.products[0].nodes.map(n => n.nodeId), ['child', 'one']);
  assert.equal(p.products[0].nodes[0].parentNodeId, 'one');
  assert.equal(p.products[0].nodes[0].binding?.departmentId, 'growth');
  assert.equal(p.products[0].nodes[0].binding?.inheritedFrom, 'one');
  assert.equal(p.products[0].nodes[0].binding?.roleId, 'tssynthesist');
  assert.equal(p.products[1].nodes[0].binding, null);
  assert.equal(p.products[0].nodes[0].runtimeAssignment, 'unverified');
  assert.deepEqual(p.products[0].nodes[0].binding?.skillRefs.map(s=>s.id), ['copywriting','copy-editing']);
  assert.match(p.products[0].nodes[0].binding!.skillRefs[0].digest,/^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(compileDepartmentPilot(a), p);
});
test('daily selection uses explicit eligibility, not due dates or metadata approval; monthly retains dates', () => {
  const a=input(); a.graph.nodes.push(node('unadmitted')); a.graph.nodes[0].metadata.approved = true;
  const p=compileDepartmentPilot(a); assert.deepEqual(p.products[0].daily.map(n=>n.nodeId),['one']);
  assert.equal(p.products[0].monthly.length,2); assert.equal(p.products[0].monthly[0].dueAt,'2026-11-03T14:15:00+05:30');
  assert.equal(p.executionGranted,false); assert.equal(p.missionCurrency,'review-required');
});
test('duplicate identities, wrong tenants, cycles and cross-product parents cannot leak bindings', () => {
  const a=input(); a.graph.nodes.push(node('one')); assert.throws(()=>compileDepartmentPilot(a),/duplicate/i);
  const b=input(); b.graph.nodes[0].tenantId='other'; assert.throws(()=>compileDepartmentPilot(b),/tenant/i);
  const c=input(); c.graph.nodes[0].parentNodeId='two'; c.graph.nodes[0].metadata.stage='';
  assert.equal(compileDepartmentPilot(c).products[0].nodes[0].binding,null);
  const d=input(); d.graph.nodes[0].parentNodeId='one'; assert.throws(()=>compileDepartmentPilot(d),/cycle/i);
});
test('stale or changed head suppresses daily recommendation and invalid clocks reject', () => {
  const a=input(); a.expectedHeadDigest='b'.repeat(64); assert.equal(compileDepartmentPilot(a).products[0].daily.length,0);
  const b=input(); b.graph.observedAt='2026-11-01T00:00:00Z'; assert.equal(compileDepartmentPilot(b).fresh,false);
  const c=input(); c.now='garbage'; assert.throws(()=>compileDepartmentPilot(c),/time/i);
});
test('KPI definition/cohort/denominator/freshness are checked, targets stay unset',()=>{
  const d=KPI_DEFINITIONS[0];
  const o={definitionId:d.id,version:d.version,productId:d.productId,cohort:d.cohort,window:'2026-11',observedAt:now,sourceRef:'fixture:receipts',numerator:2,denominator:4};
  assert.equal(observeKpi(d,o,now,'2026-11').value,0.5);
  assert.equal(observeKpi(d,{...o,denominator:0},now,'2026-11').value,null);
  assert.equal(observeKpi(d,{...o,cohort:'other'},now,'2026-11').state,'unavailable');
  assert.equal(observeKpi(d,{...o,productId:'temperance'},now,'2026-11').value,null);
  assert.equal(observeKpi(d,{...o,observedAt:'2026-10-01T00:00:00Z'},now,'2026-11').state,'stale');
  assert.equal(observeKpi(d,o,now,'2026-10').value,null);
  assert.equal(observeKpi(d,null,now,'2026-11').value,null);
  assert.equal(d.target,null);
});
test('policy classifier never mistakes source recomputation for write authority',()=>{
  assert.equal(classifyPilotChange('refresh-view').disposition,'automatic-read-only');
  for(const kind of ['mission','target','budget','publish','launch-slot','skill-promotion','graph-write','unknown']) {
    assert.equal(classifyPilotChange(kind).disposition,'hitl');
    assert.equal(classifyPilotChange(kind).executionGranted,false);
  }
});
test('Taste reuses structured composer and learning remains a Cortex candidate',()=>{
  const context=prepareTasteContext('Review a launch headline','copy',[]);
  assert.equal(context.state,'unavailable'); assert.equal(context.lineage.length,0);
  const supplied=prepareTasteContext('Review a launch headline','copy',[{id:'example',score:0.9,category:'copy',slug:'example',author:'Example author',title:'Example',body:'A concise headline',source:'taste'}]);
  assert.equal(supplied.lineage[0].slug,'example'); assert.equal('paste_ready_prompt' in supplied,false);
  const candidate=learningCandidate({productId:'lumenbar',departmentId:'growth',hypothesis:'A clearer headline improves comprehension',evidenceRefs:['fixture:study'],evaluationRef:'fixture:rubric',rollbackRef:'fixture:prior'});
  assert.equal(candidate.state,'candidate'); assert.equal(candidate.memoryWriteGranted,false);
  assert.equal(DEPARTMENTS.growth.desks.length,6);
});
test('invalid source dates and broken ancestry hold daily selection visibly',()=>{
  const a=input(); a.graph.nodes[0].metadata.dueFor='2026-12-01';
  const p=compileDepartmentPilot(a);assert.equal(p.products[0].daily.length,0);assert.match(p.products[0].nodes[0].gap!,/Invalid source date/);
  for (const malformed of [20261201, {}, false, '2026-02-30T10:00:00Z']) {
    const c=input(); c.graph.nodes[0].metadata.dueFor=malformed as never;
    const r=compileDepartmentPilot(c); assert.equal(r.products[0].daily.length,0); assert.match(r.products[0].nodes[0].gap!,/Invalid source date/);
  }
  const b=input();b.graph.nodes[0].parentNodeId='absent';
  const q=compileDepartmentPilot(b);assert.equal(q.products[0].daily.length,0);assert.match(q.products[0].nodes[0].gap!,/Ancestor missing/);
});
test('malformed measurement provenance stays unavailable instead of throwing',()=>{
  const d=KPI_DEFINITIONS[0];
  const o={definitionId:d.id,version:d.version,productId:d.productId,cohort:d.cohort,window:'2026-11',observedAt:now,numerator:2,denominator:4};
  assert.equal(observeKpi(d,o as never,now,'2026-11').state,'unavailable');
});
test('daily ceiling follows the supplied cross-product GSD order',()=>{
  const a=input();a.graph.nodes=[];a.eligibility!.taskIds=[];
  for(let i=0;i<8;i++){ a.graph.nodes.push(node(`l${i}`));a.graph.nodes.push(node(`t${i}`,'program:temperance-hermes','website')); a.eligibility!.taskIds.push(`t${i}`,`l${i}`); }
  const p=compileDepartmentPilot(a);assert.equal(p.products.flatMap(p=>p.daily).length,10);
  assert.equal(p.products[0].daily.length,5);assert.equal(p.products[1].daily.length,5);
  assert.deepEqual(p.products[1].daily.map(n=>n.nodeId),['t0','t1','t2','t3','t4']);
});

test('a definition cannot be silently rewritten without a reviewed source version',()=>{
  const d=KPI_DEFINITIONS[0];
  assert.throws(()=>{(d as {formula:string}).formula='A changed denominator';},TypeError);
  const o={definitionId:d.id,version:2,productId:d.productId,cohort:d.cohort,window:'2026-11',observedAt:now,sourceRef:'fixture:receipts',numerator:2,denominator:4};
  assert.equal(observeKpi(d,o,now,'2026-11').state,'unavailable');
});
