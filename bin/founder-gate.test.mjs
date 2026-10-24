import test from 'node:test';
import assert from 'node:assert/strict';
import {createFounderClient} from './founder-gate.mjs';

const confirmation=(row,decision)=>`${decision} reviewed ${JSON.stringify(row)}`;
const digest='a'.repeat(64), expiry='2026-10-24T12:00:00.000Z';
const row={changeDigest:digest,tenantId:'thoughtseed',status:'pending',source:'telegram-goal-graph-intake@v1',graphVersion:2,expectedHeadVersion:1,fence:2,approvalNonce:'nonce-proposal',approvalExpiresAt:expiry,summary:'Update root',consequence:'Commit reviewed graph',reversibility:'Supersede later',founderInspect:{consistent:true,changeDigest:digest}};
function review(changes={}) {
 const current={...row,...changes};
 return {status:'review',writerAuthority:false,proposal:{proposalId:`thoughtseed:${digest}`,version:1,changeDigest:digest,nonce:current.approvalNonce,expiresAt:current.approvalExpiresAt,tenantId:'thoughtseed',summary:current.summary,review:current},approveConfirmation:confirmation(current,'approve'),rejectConfirmation:confirmation(current,'reject')};
}
const envelope=review();
const expected={version:1,expiry,confirmation:envelope.approveConfirmation};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
function receipt(input,decision=input.decision,changes={}) {
 return {status:decision,receiptDigest:'b'.repeat(64),writerAuthority:false,receipt:{proposalId:input.proposalId,version:input.version,changeDigest:input.changeDigest,tenantId:'thoughtseed',founderId:'access:founder-test',nonce:input.nonce,expiresAt:input.expiresAt,decision,decidedAt:'2026-10-24T11:00:00.000Z',channel:'curious',...changes}};
}
function setup(handler) {
 const calls=[];
 const client=createFounderClient({origin:'https://example.invalid',tenant:'thoughtseed',accessJwt:'synthetic.test.session',now:()=>Date.parse('2026-10-24T11:00:00.000Z'),fetchImpl:async(url,init)=>{
  assert.equal(init.method,'POST');assert.equal(init.redirect,'error');assert.equal(init.headers.cookie,'CF_Authorization=synthetic.test.session');assert.equal(init.headers.origin,'https://example.invalid');assert.equal(init.headers['x-cambium-founder-web'],'1');
  const input=JSON.parse(init.body);calls.push({path:url.pathname,input});
  return url.pathname==='/v1/founder/proposal'?json(await (handler?.review?.(input) ?? envelope)):handler(url.pathname,input);
 }});
 return {client,calls,decisions:()=>calls.filter(c=>c.path==='/v1/founder/decision')};
}

test('CLI reads one server-owned proposal and sends one exact canonical decision tuple',async()=>{
 const {client,calls,decisions}=setup((path,input)=>{assert.equal(path,'/v1/founder/decision');assert.deepEqual(input,{proposalId:`thoughtseed:${digest}`,version:1,changeDigest:digest,nonce:row.approvalNonce,expiresAt:expiry,decision:'approved',confirmation:expected.confirmation});return json(receipt(input));});
 const p=await client.proposal(digest);assert.equal(p.approveConfirmation,envelope.approveConfirmation);
 const result=await client.decide(digest,'approve',expected);assert.equal(result.status,'approved');assert.equal(result.canonicalReadback,true);assert.equal(decisions().length,1);
 assert.deepEqual(calls[0].input,{proposalId:`thoughtseed:${digest}`});
});
test('CLI rejects changed version, expiry and broad direction without deciding',async()=>{
 const {client,decisions}=setup(()=>{throw Error('must not decide');});
 for(const change of [{version:2},{expiry:'changed'},{confirmation:'go ahead'}])await assert.rejects(client.decide(digest,'approve',{...expected,...change}));
 assert.equal(decisions().length,0);
});
test('complete reviewed row changes require fresh informed confirmation',async()=>{
 for(const change of [{approvalNonce:'changed-nonce'},{expectedHeadVersion:2},{fence:3},{founderInspect:{...row.founderInspect,workObjectId:'changed'}},{summary:'Changed summary'},{consequence:'Changed consequence'},{reversibility:'Changed reversibility'}]) {
  const handler=()=>{throw Error('must not decide');};handler.review=()=>review(change);
  const {client,decisions}=setup(handler);await assert.rejects(client.decide(digest,'approve',expected));assert.equal(decisions().length,0);
 }
});
test('CLI refuses expired proposal and inconsistent founder Inspect',async()=>{
 for(const change of [{approvalExpiresAt:'2026-10-24T10:00:00.000Z'},{founderInspect:null},{founderInspect:{consistent:false,changeDigest:digest}}]){
  const data=review(change),handler=()=>{throw Error('must not decide');};handler.review=()=>data;
  const {client,decisions}=setup(handler);await assert.rejects(client.decide(digest,'approve',{version:1,expiry:data.proposal.expiresAt,confirmation:data.approveConfirmation}));assert.equal(decisions().length,0);
 }
});
test('lost response settles from canonical readback of original tuple without another decision',async()=>{
 let original;
 const {client,calls,decisions}=setup((path,input)=>{if(path==='/v1/founder/decision'){original=input;throw Error('response lost');}assert.equal(path,'/v1/founder/status');assert.deepEqual(input,original);return json(receipt(input));});
 const result=await client.decide(digest,'approve',expected);assert.equal(result.status,'approved');assert.equal(result.canonicalReadback,true);assert.equal(decisions().length,1);assert.equal(calls.length,3);
});
test('HTTP503 decision settles only through one status read',async()=>{
 const {client,decisions,calls}=setup((path,input)=>path.endsWith('/decision')?json({status:'unknown',retry:'status_only'},503):json(receipt(input)));
 assert.equal((await client.decide(digest,'approve',expected)).status,'approved');assert.equal(decisions().length,1);assert.equal(calls.filter(c=>c.path.endsWith('/status')).length,1);
});
test('pending, malformed or unavailable recovery remains unknown and never resubmits',async()=>{
 for(const result of [()=>json({status:'pending',writerAuthority:false}),()=>json({status:'approved',projection:{decision:'approved'},canonicalReadback:false}),()=>json({},503),()=>{throw Error('read unavailable');}]){
  const {client,decisions,calls}=setup((path,input)=>{if(path.endsWith('/decision'))throw Error('lost response');return result(input);});
  const outcome=await client.decide(digest,'approve',expected);assert.equal(outcome.status,'unknown');assert.equal(outcome.retry,'status_only');assert.equal(decisions().length,1);assert.equal(calls.length,3);
 }
});
test('receipt binding drift cannot settle either acknowledgement or recovery',async()=>{
 for(const change of [{proposalId:'other'}, {tenantId:'other'}, {version:2}, {changeDigest:'c'.repeat(64)}, {nonce:'other'}, {expiresAt:'changed'}, {founderId:''}, {channel:'unknown'}, {decidedAt:'invalid'}, {decision:'pending'}]){
  const {client,decisions}=setup((path,input)=>json(receipt(input,input.decision,change)));
  assert.equal((await client.decide(digest,'approve',expected)).status,'unknown');assert.equal(decisions().length,1);
 }
 for(const change of [{receiptDigest:null},{receiptDigest:'invalid'},{writerAuthority:true},{status:'rejected'}]){
  const {client}=setup((path,input)=>json({...receipt(input),...change}));assert.equal((await client.decide(digest,'approve',expected)).status,'unknown');
 }
});
test('status reads another channel canonical rejection without a decision',async()=>{
 const {client,decisions,calls}=setup((path,input)=>{assert.equal(path,'/v1/founder/status');return json(receipt(input,'rejected',{channel:'telegram'}));});
 const result=await client.status(digest);assert.equal(result.status,'rejected');assert.equal(result.receipt.channel,'telegram');assert.equal(result.canonicalReadback,true);assert.equal(decisions().length,0);assert.equal(calls.length,2);
});
test('opposite decision conflict carries the original canonical receipt',async()=>{
 const {client,decisions}=setup((path,input)=>json({...receipt(input,'rejected'),status:'conflict'},409));
 assert.equal((await client.decide(digest,'approve',expected)).status,'conflict');assert.equal(decisions().length,1);
});
test('CLI rejection uses one canonical tuple and one authenticated session',async()=>{
 const {client,decisions}=setup((path,input)=>{assert.equal(input.decision,'rejected');return json(receipt(input));});
 assert.equal((await client.decide(digest,'reject',{...expected,confirmation:envelope.rejectConfirmation})).status,'rejected');assert.equal(decisions().length,1);
});
test('CLI rejects invalid origin, missing session, invalid digest and tenant drift',async()=>{
 for(const origin of ['http://example.invalid','https://user:pass@example.invalid','https://example.invalid/path','https://example.invalid/?q=1','https://example.invalid/#hash'])assert.throws(()=>createFounderClient({origin,tenant:'thoughtseed',accessJwt:'synthetic.test.session'}));
 assert.throws(()=>createFounderClient({origin:'https://example.invalid',tenant:'thoughtseed'}));
 const handler=()=>{throw Error('must not decide');};handler.review=()=>({...envelope,proposal:{...envelope.proposal,tenantId:'other'}});
 const {client,calls}=setup(handler);await assert.rejects(client.proposal(digest));const count=calls.length;await assert.rejects(client.proposal('../other'));assert.equal(calls.length,count);
});
test('read is authority-free and does not submit a business decision',async()=>{
 const {client,calls,decisions}=setup(()=>{throw Error('must not decide');});await client.proposal(digest);assert.equal(calls.length,1);assert.equal(decisions().length,0);
});
