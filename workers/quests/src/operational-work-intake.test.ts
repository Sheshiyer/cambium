import test from 'node:test';
import assert from 'node:assert/strict';
import { OPERATIONAL_WORK_SCHEMA, parseOperationalWorkBoundary, parseOperationalWorkIntent, adaptOperationalWorkSources } from './operational-work-intake.ts';
import { makeGoalGraphHead } from './goal-graph/compiler.ts';
const now = '2026-11-04T00:00:00.000Z';
const context = { currentNodes: [], actualHead: null, expectedHeadDigest: null, graphVersion: 1, now };
const founder = 'access:fixture-founder';
function input() { return { schema: OPERATIONAL_WORK_SCHEMA, version: 1, tenantId: 'cambium', clientRequestId: 'work-1', expectedHeadDigest: null as string | null,
  goals: [{ namespace: 'founder-operational-work', externalId: 'cambium-work', parentNodeId: null, scope: 'meso',
    desiredState: 'Coordinate approved Cambium work and verify its result.', currentState: 'Inbox connected; execution awaiting admission.', owner: 'founder',
    nextAction: 'Draft a direction from the selected signal.', proofRequired: true, status: 'active', metadata: {}, workObjectId: 'sapling:cambium', workObjectKind: 'sapling' }] }; }
test('operational Work source compiles an exact anchored source without execution authority', () => {
  const result = parseOperationalWorkIntent(input(), founder, context);
  assert.ok(result.accepted); if (!result.accepted) return;
  assert.equal(result.compile.status, 'compiled'); assert.equal(result.node.pinnedLoadoutId, null);
  assert.equal(adaptOperationalWorkSources(result.nodes).length, 1);
  const work = adaptOperationalWorkSources(result.nodes)[0];
  assert.ok(work.kind === 'work' && work.value.workId === 'sapling:cambium');
  assert.doesNotMatch(JSON.stringify(result), /fixture-founder|admissionRef|executionGranted/);
  assert.deepEqual(adaptOperationalWorkSources([]), []);
  assert.deepEqual(adaptOperationalWorkSources([{...result.node, namespace:'founder-bookkeeping'}]), []);
  assert.deepEqual(adaptOperationalWorkSources([{...result.node, sourceRef:'catalog:cambium'}]), []);
  assert.deepEqual(adaptOperationalWorkSources([...result.nodes,...result.nodes]), []);
});
test('Work source cannot replace another namespace, grant a loadout, widen projects or hide private material', () => {
  for (const patch of [{workObjectId:'sapling:other'}, {pinnedLoadoutId:'loadout:any'}, {proofRequired:false}, {namespace:'founder-bookkeeping'},
    {metadata:{executionAdmission:'yes'}}, {currentState:['','Users','fixture','private'].join('/')}, {externalId:'another'}, {desiredState:'x'.repeat(513)}]) {
    const raw=input(); Object.assign(raw.goals[0], patch); assert.equal(parseOperationalWorkBoundary(raw,founder).accepted,false);
  }
  for (const raw of [{...input(),unknown:true},{...input(),tenantId:'other'},{...input(),expectedHeadDigest:'bad'}, {...input(),goals:[]}]) assert.equal(parseOperationalWorkBoundary(raw,founder).accepted,false);
  assert.equal(parseOperationalWorkBoundary(input(),'unverified').accepted,false);
});
test('exact observed head, coherent graph and root bind the reviewed source', () => {
  const first=parseOperationalWorkIntent(input(),founder,context); assert.ok(first.accepted); if(!first.accepted)return;
  const root={...first.node,namespace:'existing',externalId:'root',nodeId:'existing-root',workObjectId:null,workObjectKind:null,metadata:{},sourceRef:'existing:root'};
  const head=makeGoalGraphHead('cambium',[root],1,now);
  const raw=input(); raw.goals[0].parentNodeId=root.nodeId as any; raw.expectedHeadDigest=head.graphDigest;
  const second=parseOperationalWorkIntent(raw,founder,{...context,currentNodes:[root],actualHead:head,graphVersion:2});
  assert.ok(second.accepted&&second.compile.status==='compiled');
  if(second.accepted&&second.compile.status==='compiled') { assert.equal(second.compile.changeSet.nodesToRemove.length,0); assert.equal(second.compile.changeSet.nodesToCreate.length,1); }
  raw.expectedHeadDigest='a'.repeat(64);
  const stale=parseOperationalWorkIntent(raw,founder,{...context,currentNodes:[root],actualHead:head}); assert.ok(stale.accepted&&stale.compile.status==='stale');
  raw.expectedHeadDigest=head.graphDigest;raw.goals[0].parentNodeId=null;
  assert.equal(parseOperationalWorkIntent(raw,founder,{...context,currentNodes:[root],actualHead:head}).accepted,false);
  assert.equal(parseOperationalWorkIntent(raw,founder,{...context,currentNodes:[],actualHead:head}).accepted,false);
});

test('an operational tenant root can be updated without a self-parent or root replacement',()=>{
 const raw=input();const initial=parseOperationalWorkIntent(raw,founder,context);assert.ok(initial.accepted);if(!initial.accepted)return;
 const head=makeGoalGraphHead('cambium',initial.nodes,1,now);
 raw.clientRequestId='work-2';raw.expectedHeadDigest=head.graphDigest;raw.goals[0].currentState='Direction drafts verified.';
 const next=parseOperationalWorkIntent(raw,founder,{...context,currentNodes:initial.nodes,actualHead:head,graphVersion:2});
 assert.ok(next.accepted&&next.compile.status==='compiled');
 if(next.accepted&&next.compile.status==='compiled'){assert.equal(next.node.parentNodeId,null);assert.equal(next.compile.changeSet.nodesToUpdate.length,1);assert.equal(next.compile.changeSet.nodesToRemove.length,0);}
 raw.goals[0].parentNodeId=initial.node.nodeId as any;
 assert.equal(parseOperationalWorkIntent(raw,founder,{...context,currentNodes:initial.nodes,actualHead:head,graphVersion:2}).accepted,false);
});
