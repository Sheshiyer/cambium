import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGateDecision } from './gate-decision.ts';
const changeDigest='a'.repeat(64), expiresAt='2026-10-26T00:00:00Z';
function fixture(){
 const receipt={proposalId:`cambium:${changeDigest}`,tenantId:'cambium',version:1,changeDigest,nonce:'nonce',expiresAt,founderId:'founder',decision:'approved',decidedAt:'2026-10-25T00:00:00Z',channel:'curious'};
 const context={changeDigest,nodeId:'goal',approvalExpiresAt:expiresAt,canApprove:true,canonicalReview:JSON.stringify({...receipt,review:{tenantId:'cambium',nodeId:'goal',changeDigest,approvalNonce:'nonce',approvalExpiresAt:expiresAt,founderInspect:{consistent:true,nodeId:'goal',changeDigest},largeDelta:'x'.repeat(5000)}})};
 return {schema:'cambium.gate-recorded-decision.v1',canonicalReadback:true,receiptDigest:'b'.repeat(64),requestedDecision:'approved',receipt,context};
}
test('typed receipt accepts complete large reviewed context, locks actions and preserves opposite outcome',()=>{
 const f=fixture();f.receipt.decision='rejected';const d=normalizeGateDecision(f)!;assert.ok(d);assert.equal(d.receipt.decision,'rejected');assert.equal(d.requestedDecision,'approved');assert.equal(d.context?.canApprove,false);assert.equal(f.context.canApprove,true);
});
test('text and malformed typed data cannot seal a record',()=>{
 assert.equal(normalizeGateDecision('Canonical receipt approved'),null);
 for(const mutate of [(f:any)=>f.canonicalReadback=false,(f:any)=>f.receipt.changeDigest='c'.repeat(64),(f:any)=>f.requestedDecision=['approved'],(f:any)=>f.receipt.decision=['approved'],(f:any)=>f.receipt.channel=['curious'],(f:any)=>f.context.nodeId='other',(f:any)=>f.receipt.version=2]){const f=fixture();mutate(f);assert.equal(normalizeGateDecision(f),null);}
});
test('valid receipt may have unserved objective; context must be explicit null',()=>{
 const f=fixture();Object.assign(f,{context:null});assert.ok(normalizeGateDecision(f));Object.assign(f,{context:undefined});assert.equal(normalizeGateDecision(f),null);
});
test('historical read preserves absent requested intent',()=>{const f=fixture();Object.assign(f,{requestedDecision:null});f.receipt.decision='rejected';const d=normalizeGateDecision(f)!;assert.equal(d.requestedDecision,null);assert.equal(d.receipt.decision,'rejected');});
