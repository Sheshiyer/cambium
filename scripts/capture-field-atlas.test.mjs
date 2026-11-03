import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FIELD_ATLAS_ROOT,FIELD_ATLAS_CAPTURE_STEPS,FIELD_ATLAS_PAGE_DIGEST,FIELD_ATLAS_STEP_DIGEST,fieldAtlasSourceBindings,fieldAtlasSourceIdentity,prepareFieldAtlasDirectory,validateFieldAtlasCapture} from './capture-field-atlas.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
  const bytes=Buffer.from('synthetic PNG-binding unit fixture');
  return {bytes,manifest:{schema:'cambium.field-atlas-capture-proposal.v1',pageSourceSha256:FIELD_ATLAS_PAGE_DIGEST,captureStepSha256:FIELD_ATLAS_STEP_DIGEST,sourceBindings:fieldAtlasSourceBindings(),
    canonicalAcceptance:false,liveAcceptance:false,physicalDevice:false,mockGatePostCount:0,evidenceScope:'local-source-fixture',
    proofs:FIELD_ATLAS_CAPTURE_STEPS.map(step=>({path:step.path,state:step.state,viewport:step.viewport,stepSha256:hash(JSON.stringify(step)),sha256:hash(bytes),
      capture:{ok:true,checks:Object.fromEntries(['canvas','rendererAvailable','sourceEvidence','viewport','contained','state',...(step.state==='departments'?['ownerHold']:[])].map(key=>[key,true]))}}))}};
}
test('current field capture validator binds source, exact coverage and image bytes without accepting canonical/live proof',()=>{
  const {bytes,manifest}=fixture();assert.deepEqual(validateFieldAtlasCapture(manifest,()=>bytes),[]);
  for(const mutate of [m=>m.pageSourceSha256='a'.repeat(64),m=>m.captureStepSha256='b'.repeat(64),m=>m.sourceBindings[0].sha256='c'.repeat(64),m=>delete m.sourceBindings,m=>m.proofs.pop(),m=>m.proofs=null,m=>m.proofs[0]=null,m=>m.canonicalAcceptance=true,m=>m.physicalDevice=true,m=>m.proofs[0].capture.checks={},m=>m.proofs[0].capture.checks.canvas=false]){
    const copy=structuredClone(manifest);mutate(copy);assert.ok(validateFieldAtlasCapture(copy,()=>bytes).length);
  }
  assert.ok(validateFieldAtlasCapture(manifest,()=>Buffer.from('changed')).length);
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
