import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createFieldAtlasFounderFixture} from './field-atlas-founder-fixture.mjs';
import {createFieldAtlasOperationalFixture} from './field-atlas-operational-fixture.mjs';
import {join} from 'node:path';
import {FIELD_ATLAS_ROOT,FIELD_ATLAS_CAPTURE_STEPS,FIELD_ATLAS_CHECK_KEYS,FIELD_ATLAS_PAGE_DIGEST,FIELD_ATLAS_STEP_DIGEST,fieldAtlasSourceBindings,fieldAtlasBoundAssertion,fieldAtlasSourceIdentity,prepareFieldAtlasDirectory,validateFieldAtlasCapture,validateFieldAtlasGeometry} from './capture-field-atlas.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
  const pngs=new Map(FIELD_ATLAS_CAPTURE_STEPS.map(step=>{
    const bytes=Buffer.alloc(45);Buffer.from('89504e470d0a1a0a','hex').copy(bytes);bytes.writeUInt32BE(13,8);bytes.write('IHDR',12);bytes.writeUInt32BE(step.viewport.width*2,16);bytes.writeUInt32BE(step.viewport.height*2,20);bytes.write('IEND',37);return [step.path,bytes];
  }));
  const owner=step=>{if(!step.fixture)return null;const f=createFieldAtlasFounderFixture({now:Date.parse('2026-11-04T00:00:00Z')});f.select(step.fixture);const r=f.snapshot();Object.assign(r,{envelopeReads:1,sessionReads:1,graphReads:1,proposalReads:step.fixture==='empty'?0:1});r.methodCounts={envelopeGET:1,sessionGET:1,graphGET:1,proposalPOST:r.proposalReads,deniedDecisionPOST:0,deniedRenewalPOST:0};return r;};
  const operational=createFieldAtlasOperationalFixture({now:Date.parse('2026-11-04T00:00:00Z')}).snapshot();
  const geometry=step=>({schema:'cambium.viewport-capture-geometry.v1',cssViewport:{...step.viewport,scrollX:0,scrollY:0},visualViewport:{...step.viewport,offsetLeft:0,offsetTop:0,scale:1},deviceScaleFactor:2,observedClip:null,clip:null,clipVisible:null,
    png:{width:step.viewport.width*2,height:step.viewport.height*2,bytes:45,sha256:hash(pngs.get(step.path))}});
  return {pngs,readPng:path=>pngs.get(path),manifest:{schema:'cambium.field-atlas-viewport-source.v1',pageSourceSha256:FIELD_ATLAS_PAGE_DIGEST,captureStepSha256:FIELD_ATLAS_STEP_DIGEST,sourceBindings:fieldAtlasSourceBindings(),sourceBaseCommit:'a'.repeat(40),workingTreeModified:false,
    canonicalAcceptance:false,liveAcceptance:false,physicalDevice:false,trustedTouchAcceptance:false,releaseReady:false,mockGatePostCount:0,evidenceScope:'local-source-fixture',
    proofs:FIELD_ATLAS_CAPTURE_STEPS.map(step=>({path:step.path,state:step.state,viewport:step.viewport,stepSha256:hash(JSON.stringify(step)),assertionSha256:hash(fieldAtlasBoundAssertion(step,owner(step)?.reviewSha256 ?? null)),sha256:hash(pngs.get(step.path)),width:step.viewport.width*2,height:step.viewport.height*2,bytes:45,fixtureReceipt:owner(step),requestPosts:step.fixture && step.fixture!=='empty'?1:0,
      geometry:geometry(step),operationalFixtureReceipt:structuredClone(operational),diagnostics:{uncaughtErrors:0,consoleErrors:0,failedRequests:0,badResponses:0,warnings:0},capture:{ok:true,renderedReviewSha256:step.behaviorKeys.includes('exactCanonicalReview')?owner(step).reviewSha256:null,checks:Object.fromEntries(FIELD_ATLAS_CHECK_KEYS.map(key=>[key,true])),behaviorChecks:Object.fromEntries(step.behaviorKeys.map(key=>[key,true]))}}))}};
}
test('current field capture validator binds source, exact coverage and image bytes without accepting canonical/live proof',()=>{
  const {readPng,manifest}=fixture();assert.deepEqual(validateFieldAtlasCapture(manifest,readPng),[]);
  for(const mutate of [m=>m.pageSourceSha256='a'.repeat(64),m=>m.captureStepSha256='b'.repeat(64),m=>m.sourceBindings[0].sha256='c'.repeat(64),m=>delete m.sourceBindings,m=>m.proofs.pop(),m=>m.proofs=null,m=>m.proofs[0]=null,m=>m.canonicalAcceptance=true,m=>m.physicalDevice=true,m=>m.releaseReady=true,m=>m.trustedTouchAcceptance=true,m=>m.proofs[0].diagnostics.consoleErrors=1,m=>delete m.proofs[0].diagnostics,m=>m.proofs.at(-1).fixtureReceipt.decisionPosts=1,m=>m.proofs.at(-1).fixtureReceipt.methodCounts.proposalPOST=99,m=>m.proofs.at(-1).fixtureReceipt.inputSha256='f'.repeat(64),m=>m.proofs.at(-1).capture.behaviorChecks={},m=>m.proofs.find(p=>p.state==='gate-reviewed').capture.renderedReviewSha256='0'.repeat(64),m=>m.proofs[0].capture.checks={},m=>m.proofs[0].capture.checks.canvas=false,m=>m.proofs.find(p=>p.state==='gate-empty').capture.checks.stateVisible=false]){
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
test('viewport and idle operational receipts cannot waive full-frame or no-effect checks',()=>{
  const {manifest,readPng}=fixture();
  for(const mutate of [p=>delete p.geometry,p=>p.geometry.cssViewport.height--,p=>p.geometry.visualViewport.scale=2,p=>p.geometry.visualViewport.offsetTop=1,p=>p.geometry.deviceScaleFactor=1,p=>p.geometry.clip={x:0,y:0,width:1,height:1},p=>p.geometry.png.sha256='0'.repeat(64),p=>p.geometry.png.width=1,p=>delete p.operationalFixtureReceipt,p=>p.operationalFixtureReceipt.requests=1,p=>p.operationalFixtureReceipt.gatePosts=1,p=>p.operationalFixtureReceipt.acceptedPosts=1,p=>p.operationalFixtureReceipt.ownerRead.version=2]){
    const copy=structuredClone(manifest);mutate(copy.proofs[0]);assert.ok(validateFieldAtlasCapture(copy,readPng).length);
  }
});
test('strict crop binds observed modal bounds, physical pixels and unchanged viewport independently',()=>{
  const png=Buffer.alloc(45);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(600,16);png.writeUInt32BE(1200,20);
  const step={viewport:{width:390,height:844},clipSelector:'.cw-dialog'};
  const geometry={schema:'cambium.viewport-capture-geometry.v1',cssViewport:{width:390,height:844,scrollX:0,scrollY:0},visualViewport:{width:390,height:844,offsetLeft:0,offsetTop:0,scale:1},deviceScaleFactor:2,
    observedClip:{selector:'.cw-dialog',x:10,y:20,width:300,height:600},clip:{selector:'.cw-dialog',x:10,y:20,width:300,height:600},clipVisible:true,png:{width:600,height:1200,bytes:45,sha256:hash(png)}};
  assert.deepEqual(validateFieldAtlasGeometry(geometry,step,png),[]);
  for(const mutate of [g=>g.observedClip.x=-1,g=>g.observedClip.height=900,g=>g.observedClip.selector='.wrong',g=>g.clip.x=11,g=>g.clip.width=299,g=>g.clipVisible=false,g=>g.png.height--,g=>g.png.bytes++,g=>g.png.sha256='0'.repeat(64),g=>g.cssViewport.height=900,g=>g.visualViewport.offsetTop=10]){
    const copy=structuredClone(geometry);mutate(copy);assert.ok(validateFieldAtlasGeometry(copy,step,png).length);
  }
  const wrong=Buffer.from(png);wrong.writeUInt32BE(598,16);const rehashed=structuredClone(geometry);rehashed.png.width=598;rehashed.png.sha256=hash(wrong);
  assert.ok(validateFieldAtlasGeometry(rehashed,step,wrong).length);
  assert.ok(validateFieldAtlasGeometry(geometry,{viewport:step.viewport},png).length);
});
test('matrix retains all44 prior definitions and exactly four original-height supplements',()=>{
  const frozen=JSON.parse(readFileSync(new URL('../.planning/viewport-proof-20261104/remaining-behaviors/coverage.json',import.meta.url)));
  assert.equal(FIELD_ATLAS_CAPTURE_STEPS.length,48);
  assert.deepEqual(FIELD_ATLAS_CAPTURE_STEPS.slice(0,44).map(s=>({path:s.path,state:s.state,viewport:s.viewport})),frozen.baselineCurrentCaptureCases.map(({path,state,viewport})=>({path,state,viewport})));
  assert.deepEqual(FIELD_ATLAS_CAPTURE_STEPS.slice(44).map(({path,state,viewport})=>({path,state,viewport})),frozen.supplementalCases.map(({path,state,viewport})=>({path,state,viewport})));
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
test('actual CLI publication glue finishes module evaluation before a publisher imports capture exports',()=>{
  const root=mkdtempSync(join(tmpdir(),'field-atlas-cli-cycle-'));
  try{
    const source=readFileSync(new URL('./capture-field-atlas.mjs',import.meta.url),'utf8');
    const start=source.indexOf('async function main(){');assert.ok(start>=0);
    // Execute the actual CLI glue with only the slow browser capture stubbed.
    // The publisher imports back into capture, exactly as the real contract does.
    writeFileSync(join(root,'capture-field-atlas.mjs'),`import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';export async function captureFieldAtlas(){return {directory:'synthetic',manifest:{proofs:[],pageSourceSha256:'synthetic'}};}\n`+source.slice(start));
    writeFileSync(join(root,'field-atlas-viewport-contract.mjs'),`import {captureFieldAtlas} from './capture-field-atlas.mjs';import {writeFileSync} from 'node:fs';export function publishFieldAtlasSourceProof(){if(typeof captureFieldAtlas!=='function')throw Error('missing capture export');writeFileSync(new URL('./published.json',import.meta.url),'{}');}`);
    const result=execFileSync(process.execPath,[join(realpathSync(root),'capture-field-atlas.mjs'),'--write-canonical'],{cwd:root,encoding:'utf8',timeout:5000,killSignal:'SIGKILL'});
    assert.deepEqual(JSON.parse(readFileSync(join(root,'published.json'),'utf8')),{});assert.match(result,/"proofs":0/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
