import test from 'node:test';import assert from 'node:assert/strict';
import {createFieldAtlasFounderFixture,fieldAtlasFixtureInputDigest,fieldAtlasReviewFingerprint,fieldAtlasDisplayedReview} from './field-atlas-founder-fixture.mjs';
import {withServer} from '../workers/quests/src/visual-viewport-proof.mjs';
const headers={'x-cambium-founder-web':'1','content-type':'application/json'};
test('synthetic founder fixture uses existing exact methods/read identities and binds input/counters',async()=>{
  const fixture=createFieldAtlasFounderFixture();
  await withServer(async origin=>{
    await fetch(origin+'/founder?tenant=cambium&atlas-fixture=pending');
    const env=await(await fetch(origin+'/founder/api/quests/cambium')).json();
    assert.equal((await fetch(origin+'/v1/founder/session',{headers})).status,200);
    assert.equal((await fetch(origin+'/v1/founder/graph',{headers})).status,200);
    const review=await(await fetch(origin+'/v1/founder/proposal',{method:'POST',headers,body:JSON.stringify({proposalId:env.goalGraphIntake.rows[0].proposalId})})).json();
    assert.equal(review.writerAuthority,false);assert.equal(review.proposal.review.changeDigest,env.goalGraphIntake.rows[0].changeDigest);
    const observed=fixture.snapshot();assert.equal(observed.inputSha256,fieldAtlasFixtureInputDigest('pending',observed.observedAt));
    const displayed=fieldAtlasDisplayedReview(review.proposal);assert.equal(review.proposal.tenantId,'cambium');assert.equal(Object.hasOwn(displayed,'tenantId'),false);assert.equal(displayed.review.tenantId,'cambium');
    assert.equal(observed.reviewSha256,fieldAtlasReviewFingerprint(displayed));assert.notEqual(observed.reviewSha256,fieldAtlasReviewFingerprint(review.proposal));
    assert.deepEqual(observed.methodCounts,{envelopeGET:1,sessionGET:1,graphGET:1,proposalPOST:1,deniedDecisionPOST:0,deniedRenewalPOST:0});assert.equal(observed.unexpectedRequests,0);
  },{localFounderFixture:fixture});
});
test('fixture rejects wrong methods/tenant/proposal identity and cannot become a decision or renewal writer',async()=>{
  const fixture=createFieldAtlasFounderFixture();
  await withServer(async origin=>{
    await fetch(origin+'/founder?tenant=cambium&atlas-fixture=pending');
    for(const [path,init,status] of [
      ['/founder/api/quests/cambium',{method:'POST'},405],['/founder/api/quests/other',{},404],
      ['/v1/founder/session',{},403],['/v1/founder/session',{method:'POST',headers},405],
      ['/v1/founder/graph?tenant=other',{headers},403],['/v1/founder/proposal',{headers},405],
      ['/v1/founder/proposal',{method:'POST',headers,body:JSON.stringify({proposalId:'other'})},400],
      ['/v1/founder/decision',{method:'POST',headers,body:'{}'},403],['/v1/founder/renew',{method:'POST',headers,body:'{}'},403],
    ])assert.equal((await fetch(origin+path,init)).status,status,path);
    const observed=fixture.snapshot();assert.equal(observed.unexpectedRequests,7);assert.equal(observed.decisionPosts,1);assert.equal(observed.renewalPosts,1);
  },{localFounderFixture:fixture});
});

test('whole displayed proposal fingerprint detects missing change arrays and altered reviewed context',()=>{
  const p={proposalId:'synthetic',version:1,changeDigest:'6'.repeat(64),nonce:'synthetic',expiresAt:'2026-11-04T00:00:00Z',summary:'synthetic source fixture',review:{changeDigest:'6'.repeat(64),changeSet:{nodesToCreate:[{id:'goal'}],nodesToUpdate:[],nodesToRemove:[]},consequence:'synthetic',reversibility:'synthetic'}};
  const expected=fieldAtlasReviewFingerprint(p);
  for(const key of ['nodesToCreate','nodesToUpdate','nodesToRemove']){const changed=structuredClone(p);delete changed.review.changeSet[key];assert.notEqual(fieldAtlasReviewFingerprint(changed),expected);}
  const changed=structuredClone(p);changed.review.reversibility='changed';assert.notEqual(fieldAtlasReviewFingerprint(changed),expected);
  const ordered={summary:p.summary,review:p.review,nonce:p.nonce,version:p.version,expiresAt:p.expiresAt,changeDigest:p.changeDigest,proposalId:p.proposalId};assert.equal(fieldAtlasReviewFingerprint(ordered),expected);
});
