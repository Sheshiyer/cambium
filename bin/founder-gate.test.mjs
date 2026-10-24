import test from 'node:test';
import assert from 'node:assert/strict';
import {createFounderClient,confirmation} from './founder-gate.mjs';
const digest='a'.repeat(64),expiry='2026-10-24T12:00:00.000Z';
const row={changeDigest:digest,tenantId:'thoughtseed',status:'pending',source:'telegram-goal-graph-intake@v1',graphVersion:2,expectedHeadVersion:1,fence:1,approvalNonce:'nonce-proposal',approvalExpiresAt:expiry,summary:'Update root',consequence:'Commit reviewed graph',reversibility:'Supersede later',founderInspect:{consistent:true,changeDigest:digest}};
const envelope={schema:1,tenant:'thoughtseed',goalGraphIntake:{rows:[row]}};
function setup(handler){let posts=0;const client=createFounderClient({origin:'https://example.invalid',tenant:'thoughtseed',accessJwt:'synthetic.test.session',now:()=>Date.parse('2026-10-24T11:00:00.000Z'),fetchImpl:async(url,init)=>{assert.equal(init.redirect,'error');assert.equal(init.headers.cookie,'CF_Authorization=synthetic.test.session');assert.equal(init.headers.origin,'https://example.invalid');assert.equal(init.headers['x-cambium-founder-web'],'1');if(init.method==='POST')posts++;return handler(url,init);}});return {client,posts:()=>posts};}
const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
const expected={version:2,expiry,confirmation:confirmation(row,'approve')};
test('CLI reads founder proposal and sends exact existing Gate tuple once',async()=>{
 const {client,posts}=setup((url,init)=>{if(init.method==='GET')return json(envelope);const body=JSON.parse(init.body);assert.equal(url.pathname,'/founder/api/gate/thoughtseed');assert.equal(body.nonce,row.approvalNonce);assert.equal(body.expectedHeadVersion,1);assert.equal(body.fence,1);assert.equal(body.idempotencyKey,`approve-goal-graph:thoughtseed:${digest}`);assert.equal(body.founderId,undefined);return json({ok:true,committed:true,approvalDigest:'receipt',tenantId:'thoughtseed',changeDigest:digest,approvalNonce:row.approvalNonce});});
 assert.equal((await client.proposal(digest)).changeDigest,digest);assert.equal((await client.decide(digest,'approve',expected)).status,'approved');assert.equal(posts(),1);
});
test('CLI changed version/expiry and broad direction send no decision',async()=>{
 const {client,posts}=setup(()=>json(envelope));
 for(const change of [{version:3},{expiry:'changed'},{confirmation:'go ahead'}])await assert.rejects(client.decide(digest,'approve',{...expected,...change}));assert.equal(posts(),0);
});
test('CLI refuses expired or non-founder projection',async()=>{
 for(const changed of [{approvalExpiresAt:'2026-10-24T10:00:00.000Z'},{founderInspect:null}]){const candidate={...row,...changed};const {client,posts}=setup(()=>json({...envelope,goalGraphIntake:{rows:[candidate]}}));await assert.rejects(client.decide(digest,'approve',{...expected,expiry:candidate.approvalExpiresAt,confirmation:confirmation(candidate,'approve')}));assert.equal(posts(),0);}
});
test('CLI lost response reads status and remains unknown without authoritative receipt; never resubmits',async()=>{
 const {client,posts}=setup((url,init)=>{if(init.method==='POST')throw Error('lost response');return json({...envelope,goalGraphDecisions:{rows:[{changeDigest:digest,decision:'approved'}]}});});
 const result=await client.decide(digest,'approve',expected);assert.equal(result.status,'unknown');assert.equal(result.observed.status,'approved');assert.equal(result.observed.canonicalReadback,false);assert.equal(posts(),1);
});
test('CLI rejects redirects, missing session and tenant drift',async()=>{
 assert.throws(()=>createFounderClient({origin:'http://example.invalid',tenant:'thoughtseed',accessJwt:'synthetic'}));
 assert.throws(()=>createFounderClient({origin:'https://example.invalid',tenant:'thoughtseed'}));
 const {client}=setup(()=>json({...envelope,tenant:'other'}));await assert.rejects(client.proposal(digest));
});
test('CLI reject uses the same founder gate with rejection tuple',async()=>{
 const {client,posts}=setup((url,init)=>{if(init.method==='GET')return json(envelope);assert.equal(JSON.parse(init.body).kind,'reject-goal-graph');return json({ok:true,rejected:true,tenantId:'thoughtseed',changeDigest:digest,approvalNonce:row.approvalNonce});});
 assert.equal((await client.decide(digest,'reject',{...expected,confirmation:confirmation(row,'reject')})).status,'rejected');assert.equal(posts(),1);
});

test('CLI refuses mismatched success response as uncertain',async()=>{
 const {client,posts}=setup((url,init)=>json(init.method==='GET'?envelope:{ok:true,committed:true,tenantId:'other',changeDigest:digest,approvalNonce:row.approvalNonce}));
 assert.equal((await client.decide(digest,'approve',expected)).status,'unknown');assert.equal(posts(),1);
});
test('CLI read and status never POST',async()=>{
 const {client,posts}=setup(()=>json(envelope));await client.proposal(digest);await client.status(digest);assert.equal(posts(),0);
});

test('every reviewed tuple and inspect drift blocks approval before POST',async()=>{
 for(const change of [{approvalNonce:'changed-nonce'},{expectedHeadVersion:2},{fence:2},{founderInspect:{...row.founderInspect,workObjectId:'changed'}},{summary:'Changed summary'},{consequence:'Changed consequence'},{reversibility:'Changed reversibility'}]){
 const {client,posts}=setup(()=>json({...envelope,goalGraphIntake:{rows:[{...row,...change}]}}));
 await assert.rejects(client.decide(digest,'approve',expected));assert.equal(posts(),0);
 }
});
test('reject acknowledgement with missing or mismatched nonce stays unknown',async()=>{
 for(const nonce of [undefined,'wrong-nonce']){
 const {client,posts}=setup((url,init)=>json(init.method==='GET'?envelope:{ok:true,rejected:true,tenantId:'thoughtseed',changeDigest:digest,approvalNonce:nonce}));
 assert.equal((await client.decide(digest,'reject',{...expected,confirmation:confirmation(row,'reject')})).status,'unknown');assert.equal(posts(),1);
 }
});
