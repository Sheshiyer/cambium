import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createFieldAtlasFounderFixture} from './field-atlas-founder-fixture.mjs';
import {join} from 'node:path';
import {FIELD_ATLAS_ROOT,FIELD_ATLAS_CAPTURE_STEPS,FIELD_ATLAS_CHECK_KEYS,FIELD_ATLAS_PAGE_DIGEST,FIELD_ATLAS_STEP_DIGEST,fieldAtlasSourceBindings,fieldAtlasBoundAssertion,fieldAtlasSourceIdentity,prepareFieldAtlasDirectory,validateFieldAtlasCapture} from './capture-field-atlas.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
  const pngs=new Map(FIELD_ATLAS_CAPTURE_STEPS.map(step=>{
    const bytes=Buffer.alloc(45);Buffer.from('89504e470d0a1a0a','hex').copy(bytes);bytes.writeUInt32BE(13,8);bytes.write('IHDR',12);bytes.writeUInt32BE(step.viewport.width*2,16);bytes.writeUInt32BE(step.viewport.height*2,20);bytes.write('IEND',37);return [step.path,bytes];
  }));
  const owner=step=>{if(!step.fixture)return null;const f=createFieldAtlasFounderFixture({now:Date.parse('2026-11-04T00:00:00Z')});f.select(step.fixture);const r=f.snapshot();Object.assign(r,{envelopeReads:1,sessionReads:1,graphReads:1,proposalReads:step.fixture==='empty'?0:1});r.methodCounts={envelopeGET:1,sessionGET:1,graphGET:1,proposalPOST:r.proposalReads,deniedDecisionPOST:0,deniedRenewalPOST:0};return r;};
  return {pngs,readPng:path=>pngs.get(path),manifest:{schema:'cambium.field-atlas-viewport-source.v1',pageSourceSha256:FIELD_ATLAS_PAGE_DIGEST,captureStepSha256:FIELD_ATLAS_STEP_DIGEST,sourceBindings:fieldAtlasSourceBindings(),sourceBaseCommit:'a'.repeat(40),workingTreeModified:false,
    canonicalAcceptance:false,liveAcceptance:false,physicalDevice:false,trustedTouchAcceptance:false,releaseReady:false,mockGatePostCount:0,evidenceScope:'local-source-fixture',
    proofs:FIELD_ATLAS_CAPTURE_STEPS.map(step=>({path:step.path,state:step.state,viewport:step.viewport,stepSha256:hash(JSON.stringify(step)),assertionSha256:hash(fieldAtlasBoundAssertion(step,owner(step)?.reviewSha256 ?? null)),sha256:hash(pngs.get(step.path)),width:step.viewport.width*2,height:step.viewport.height*2,bytes:45,fixtureReceipt:owner(step),requestPosts:step.fixture && step.fixture!=='empty'?1:0,
      diagnostics:{uncaughtErrors:0,consoleErrors:0,failedRequests:0,badResponses:0,warnings:0},capture:{ok:true,renderedReviewSha256:step.behaviorKeys.includes('exactCanonicalReview')?owner(step).reviewSha256:null,checks:Object.fromEntries(FIELD_ATLAS_CHECK_KEYS.map(key=>[key,true])),behaviorChecks:Object.fromEntries(step.behaviorKeys.map(key=>[key,true]))}}))}};
}
test('current field capture validator binds source, exact coverage and image bytes without accepting canonical/live proof',()=>{
  const {readPng,manifest}=fixture();assert.deepEqual(validateFieldAtlasCapture(manifest,readPng),[]);
  for(const mutate of [m=>m.pageSourceSha256='a'.repeat(64),m=>m.captureStepSha256='b'.repeat(64),m=>m.sourceBindings[0].sha256='c'.repeat(64),m=>delete m.sourceBindings,m=>m.proofs.pop(),m=>m.proofs=null,m=>m.proofs[0]=null,m=>m.canonicalAcceptance=true,m=>m.physicalDevice=true,m=>m.releaseReady=true,m=>m.trustedTouchAcceptance=true,m=>m.proofs[0].diagnostics.consoleErrors=1,m=>delete m.proofs[0].diagnostics,m=>m.proofs.at(-1).fixtureReceipt.decisionPosts=1,m=>m.proofs.at(-1).fixtureReceipt.methodCounts.proposalPOST=99,m=>m.proofs.at(-1).fixtureReceipt.inputSha256='f'.repeat(64),m=>m.proofs.at(-1).capture.behaviorChecks={},m=>m.proofs.find(p=>p.state==='gate-reviewed').capture.renderedReviewSha256='0'.repeat(64),m=>m.proofs[0].capture.checks={},m=>m.proofs[0].capture.checks.canvas=false]){
    const copy=structuredClone(manifest);mutate(copy);assert.ok(validateFieldAtlasCapture(copy,readPng).length);
  }
  assert.ok(validateFieldAtlasCapture(manifest,()=>Buffer.from('changed')).length);
  const badSize=structuredClone(manifest);badSize.proofs[0].width=1;assert.ok(validateFieldAtlasCapture(badSize,readPng).length);
  const wrongPixels=Buffer.from(readPng(manifest.proofs[0].path));wrongPixels.writeUInt32BE(1,16);const changed=structuredClone(manifest);changed.proofs[0].sha256=hash(wrongPixels);assert.ok(validateFieldAtlasCapture(changed,()=>wrongPixels).length);
  assert.deepEqual(validateFieldAtlasCapture(manifest),['PNG artifact reader is required']);
});
test('unsupported capture paths never reach an artifact reader',()=>{
  const {manifest}=fixture();manifest.proofs[0].path='../outside.png';let outside=false;
  const errors=validateFieldAtlasCapture(manifest,path=>{if(path.startsWith('..'))outside=true;return Buffer.from('test');});
  assert.ok(errors.length);assert.equal(outside,false);
});
test('capture source identity belongs to its module checkout when invoked from another directory',()=>{
  const foreign=mkdtempSync(join(tmpdir(),'field-atlas-foreign-'));
  try {
    const expected=fieldAtlasSourceIdentity();
    const script=`import {fieldAtlasSourceIdentity,FIELD_ATLAS_ROOT} from ${JSON.stringify(new URL('./capture-field-atlas.mjs',import.meta.url).href)}; console.log(JSON.stringify({identity:fieldAtlasSourceIdentity(),root:FIELD_ATLAS_ROOT}));`;
    const actual=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:foreign,encoding:'utf8'}));
    assert.deepEqual(actual,{identity:expected,root:FIELD_ATLAS_ROOT});
    assert.deepEqual(readdirSync(foreign),[]);
  } finally {rmSync(foreign,{recursive:true,force:true});}
});
test('capture output refuses symlink and non-directory roots before creating artifacts',()=>{
  const root=mkdtempSync(join(tmpdir(),'field-atlas-root-'));
  const outside=mkdtempSync(join(tmpdir(),'field-atlas-outside-'));
  try {
    const artifactRoot=join(root,'.artifacts');
    symlinkSync(outside,artifactRoot,'dir');
    assert.throws(()=>prepareFieldAtlasDirectory(root),/owned directory/);
    assert.deepEqual(readdirSync(outside),[]);
    rmSync(artifactRoot);writeFileSync(artifactRoot,'retained');
    assert.throws(()=>prepareFieldAtlasDirectory(root),/owned directory/);
    assert.equal(readFileSync(artifactRoot,'utf8'),'retained');
    rmSync(artifactRoot);
    const created=prepareFieldAtlasDirectory(root);
    assert.equal(created.startsWith(join(realpathSync(root),'.artifacts','field-atlas-current-')),true);
    assert.deepEqual(readdirSync(created),[]);
  } finally {rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});
