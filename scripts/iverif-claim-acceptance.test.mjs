import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { CLAIM_POLICY, CLAIM_POLICY_DIGEST, CLAIM_SOURCE, CLAIM_ARTIFACT_INPUT_PATH, CLAIM_FOUNDER_INPUT_PATH, claimDigest, parseClaimProofInput, validateClaimArtifact } from '../shared/iverif-claim-proof.ts';

const available=[CLAIM_ARTIFACT_INPUT_PATH,CLAIM_FOUNDER_INPUT_PATH,'.local/iverif-acceptance/input.json'].every(existsSync);
const load=path=>JSON.parse(readFileSync(path,'utf8'));
test('claim acceptance · immutable input, source and artifact pins agree',{skip:!available},()=>{
  const input=load('.local/iverif-acceptance/input.json'),artifact=load(CLAIM_ARTIFACT_INPUT_PATH);
  assert.ok(parseClaimProofInput(input));assert.ok(validateClaimArtifact(artifact,input));
  assert.equal(artifact.policyDigest,CLAIM_POLICY_DIGEST);assert.equal(artifact.sourceManifestDigest,CLAIM_POLICY.sourceManifestDigest);
});
test('claim acceptance · founder proof names this exact task, input and artifact',{skip:!available},()=>{
  const input=load('.local/iverif-acceptance/input.json'),artifact=load(CLAIM_ARTIFACT_INPUT_PATH),proof=load(CLAIM_FOUNDER_INPUT_PATH);
  assert.equal(proof.schema,'cambium.iverif.founder-acceptance-proof.v1');assert.equal(proof.decision,'approved');assert.equal(proof.tenantId,'cambium');
  assert.equal(proof.taskId,input.taskId);assert.equal(proof.goalId,input.goalId);assert.equal(proof.inputDigest,claimDigest(input));assert.equal(proof.artifactDigest,claimDigest(artifact));
  assert.match(proof.proposalId,/^cambium:(?:sha256:)?[a-f0-9]{64}$/);assert.match(proof.founderDigest,/^sha256:[a-f0-9]{64}$/);
});
test('claim acceptance · every pinned source inventory is represented once',{skip:!available},()=>{
  const rows=JSON.parse(load(CLAIM_ARTIFACT_INPUT_PATH).files['claims.json']);
  assert.equal(rows.length,CLAIM_SOURCE.files.reduce((n,file)=>n+file.inventoryCount,0));
  assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
});
test('claim acceptance · source assertions never become verified product claims',{skip:!available},()=>{
  const rows=JSON.parse(load(CLAIM_ARTIFACT_INPUT_PATH).files['claims.json']);assert.ok(rows.length>0);
  assert.ok(rows.every(row=>['blocked','pending','no-signal'].includes(row.classification)));
  assert.ok(rows.some(row=>row.classification==='blocked'));
});
test('claim acceptance · tampered text, classifications and citations fail',{skip:!available},()=>{
  const input=load('.local/iverif-acceptance/input.json'),original=load(CLAIM_ARTIFACT_INPUT_PATH);
  for(const change of [row=>row.classification='verified',row=>row.claim+=' fabricated',row=>row.sourceLine++]) {
    const artifact=structuredClone(original),rows=JSON.parse(artifact.files['claims.json']);change(rows[0]);artifact.files['claims.json']=JSON.stringify(rows);
    assert.equal(validateClaimArtifact(artifact,input),false);
  }
});
