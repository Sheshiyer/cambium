import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMissionDossier } from './mission-dossier.ts';
import type { GateProposal } from './gate-folio.ts';
const digest = 'a'.repeat(64);
function fixture(kind = 'create', metadata: Record<string, unknown> = {}) {
  const node = {nodeId:'goal:one',tenantId:'tenant:one',scope:'micro',owner:'Founder',currentState:'Needs review',desiredState:'Evidence reviewed',nextAction:'Inspect evidence',waitCondition:null,proofRequired:true,workObjectId:'branch:relovo',workObjectKind:'branch',pinnedLoadoutId:'loadout:source-audit',metadata};
  const changeSet = {tenantId:node.tenantId,graphVersion:1,changeDigest:digest,nodesToCreate:kind === 'create' ? [node] : [],nodesToUpdate:kind === 'update' ? [{nodeId:node.nodeId,before:{...node,currentState:'Earlier'},after:node}] : [],nodesToRemove:kind === 'remove' ? [node] : []};
  const review = {graphVersion:1,fence:1,expectedHeadVersion:0,founderInspect:{changeDigest:digest,nodeId:node.nodeId,consistent:true,issues:[],workObjectId:node.workObjectId,workObjectKind:node.workObjectKind,pinnedLoadoutId:node.pinnedLoadoutId},schema:'cambium.goal-graph-gate-row.v1',kind:'goal-graph-intake',status:'pending',approvalNonce:'nonce',approvalExpiresAt:'2026-10-26T00:00:00Z',changeDigest:digest,nodeId:node.nodeId,tenantId:node.tenantId,sourceRef:'founder-renewal:original',changeSet};
  const proposal: GateProposal = {changeDigest:digest,nodeId:node.nodeId,title:'Untrusted title',summary:'Untrusted summary',sourceRef:'projection:other',canonicalReview:JSON.stringify({proposalId:`tenant:one:${digest}`,version:1,nonce:'nonce',expiresAt:'2026-10-26T00:00:00Z',changeDigest:digest,review}),receivedAt:'',approvalExpiresAt:'2026-10-26T00:00:00Z',consequence:'',reversibility:'',inspect:{changeDigest:digest,nodeId:node.nodeId,workObjectId:node.workObjectId,workObjectKind:node.workObjectKind,pinnedLoadoutId:node.pinnedLoadoutId,executionAdmission:[],admissionState:'exact',consistent:true,issues:[]},expired:false,canApprove:true,canReject:true,blockedReason:'',signing:false,placement:{landmarkId:'hands',districtId:'plant'}};
  return {proposal,review,node,save:()=>{proposal.canonicalReview=JSON.stringify({proposalId:`tenant:one:${digest}`,version:1,nonce:'nonce',expiresAt:'2026-10-26T00:00:00Z',changeDigest:digest,review});}};
}
test('canonical subject provides objective, evidence, labels and separate IDs without inventing hierarchy',()=>{
 const {proposal}=fixture(); const d=buildMissionDossier(proposal);
 assert.equal(d.verified,true);assert.equal(d.scope,'micro');assert.equal(d.desiredState,'Evidence reviewed');assert.equal(d.currentState,'Needs review');assert.equal(d.proofRequired,true);
 assert.equal(d.phase,null);assert.equal(d.branch,null);assert.equal(d.organ,null);
 assert.deepEqual(d.workObject,{id:'branch:relovo',kind:'branch',label:'Relovo'});assert.deepEqual(d.loadout,{id:'loadout:source-audit',label:'Source Audit'});
 assert.equal(d.sourceRef,'founder-renewal:original');assert.deepEqual(d.diff,{created:1,updated:0,removed:0});
});
test('explicit canonical metadata is the only hierarchy source',()=>{
 const {proposal}=fixture('update',{phase:'Audit',branch:'Source quality',organ:'Evidence desk',workObjectLabel:'Relovo delivery',loadoutLabel:'Source inspection'});
 const d=buildMissionDossier(proposal);assert.equal(d.phase,'Audit');assert.equal(d.branch,'Source quality');assert.equal(d.organ,'Evidence desk');assert.equal(d.workObject.label,'Relovo delivery');assert.equal(d.loadout.label,'Source inspection');assert.deepEqual(d.diff,{created:0,updated:1,removed:0});
});
test('removed subject remains a reviewed delta, with no runtime progress claim',()=>{
 const {proposal}=fixture('remove');const d=buildMissionDossier(proposal);assert.equal(d.verified,true);assert.deepEqual(d.diff,{created:0,updated:0,removed:1});assert.equal('progress' in d,false);
});
for (const issue of ['wrapper digest','review digest','subject','tenant','duplicate subject','inspect anchor','inspect node','invalid scope','invalid proof','malformed update'] as const) test(`fails closed for ${issue}`,()=>{
 const f=fixture();
 switch(issue){
 case 'wrapper digest': f.proposal.changeDigest='b'.repeat(64);break;
 case 'review digest':f.review.changeDigest='b'.repeat(64);f.save();break;
 case 'subject':f.review.nodeId='other';f.save();break;
 case 'tenant':f.node.tenantId='other';f.save();break;
 case 'duplicate subject':f.review.changeSet.nodesToCreate.push(f.node);f.save();break;
 case 'inspect anchor':f.proposal.inspect!.workObjectId='branch:other';break;
 case 'inspect node':f.proposal.inspect!.nodeId='other';break;
 case 'invalid scope':f.node.scope='fiction';f.save();break;
 case 'invalid proof':Object.assign(f.node,{proofRequired:'yes'});f.save();break;
 case 'malformed update':Object.assign(f.review.changeSet,{nodesToUpdate:[{nodeId:'x',after:{nodeId:'x'}}]});f.save();break;
 }
 const d=buildMissionDossier(f.proposal);assert.equal(d.verified,false);assert.equal(d.desiredState,null);assert.equal(d.diff,null);assert.equal(d.workObject.id,null);
});
test('unreviewed, malformed and oversized review never fall back to projection claims',()=>{
 for(const canonicalReview of [null,'not json','[]','x'.repeat(1_000_001)]){const {proposal}=fixture();proposal.canonicalReview=canonicalReview;assert.equal(buildMissionDossier(proposal).verified,false);}
});

test('full available review tuple and canonical Inspect must agree',()=>{
 for(const mutate of [
  (p:any)=>{p.proposalId='other';},(p:any)=>{p.version=0;},
  (p:any)=>{p.nonce='other';},(p:any)=>{p.expiresAt='2026-10-27T00:00:00Z';},
  (p:any)=>{p.review.graphVersion=2;},(p:any)=>{p.review.fence=2;},
  (p:any)=>{p.review.expectedHeadVersion=5;},
  (p:any)=>{p.review.founderInspect.nodeId='other';},
  (p:any)=>{p.review.founderInspect.workObjectId='branch:other';},
  (p:any)=>{p.review.founderInspect.consistent=false;},
 ]){const {proposal}=fixture();const p=JSON.parse(proposal.canonicalReview!);mutate(p);proposal.canonicalReview=JSON.stringify(p);assert.equal(buildMissionDossier(proposal).verified,false);}
});

test('ancillary delta counts require nonempty IDs and matching tenants throughout',()=>{
 for(const change of [
  {nodesToUpdate:[{before:{},after:{}}]},
  {nodesToUpdate:[{nodeId:'',before:{nodeId:'',tenantId:'tenant:one'},after:{nodeId:'',tenantId:'tenant:one'}}]},
  {nodesToUpdate:[{nodeId:'other',before:{nodeId:'other',tenantId:'tenant:other'},after:{nodeId:'other',tenantId:'tenant:one'}}]},
  {nodesToUpdate:[{nodeId:'other',before:{nodeId:'other',tenantId:'tenant:one'},after:{nodeId:'other',tenantId:'tenant:other'}}]},
  {nodesToRemove:[{nodeId:'other',tenantId:'tenant:other'}]},
 ]){const f=fixture();Object.assign(f.review.changeSet,change);f.save();const d=buildMissionDossier(f.proposal);assert.equal(d.verified,false);assert.equal(d.diff,null);}
 const f=fixture();f.review.changeSet.nodesToCreate.push({...f.node,nodeId:'other',tenantId:'tenant:other'});f.save();assert.equal(buildMissionDossier(f.proposal).verified,false);
});
