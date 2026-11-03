import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,chmodSync,rmSync,mkdirSync,symlinkSync,linkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FIELD_ATLAS_ROOT} from './capture-field-atlas.mjs';
import {validateRetainedAssertions,retainedBehaviorHolds,qualifyFieldAtlasViewport,retainedBehaviorCoverage,readOwnedProofFile,verifyCapturedSourceCommit} from './field-atlas-viewport-contract.mjs';
const contract=()=>JSON.parse(readFileSync(new URL('../docs/visual/field-atlas-viewport-contract.v1.json',import.meta.url)));
const legacy=readFileSync(new URL('../docs/plans/assets/tg-miniapp-viewport-proof/manifest.json',import.meta.url));
const png=path=>readFileSync(new URL('../docs/plans/assets/tg-miniapp-viewport-proof/'+path,import.meta.url));

test('current contract retains every original identity, step and image, including43required behavior intents',()=>{
  assert.deepEqual(validateRetainedAssertions(contract(),legacy,png),[]);
  assert.equal(retainedBehaviorHolds(contract()).length,43);
});
test('retained obligations cannot be dropped, retired, rebound or satisfied by metadata',()=>{
  for(const mutate of [c=>c.assertions.pop(),c=>c.assertions[0].required=false,c=>c.assertions[5].required=true,c=>c.assertions[0].legacyPath='../escape.png',c=>c.assertions[0].legacyStepSha256='a'.repeat(64),c=>c.assertions[0].currentBehaviorProof={complete:true},c=>c.assertions[0].currentBehaviorProof='__proto__',c=>c.assertions[0].currentBehaviorProof='verified-empty-queue-v1',c=>c.assertions[0].behaviorIntent='',c=>c.assertions[0].partialSourceFrames=['unbound.png']]){
    const copy=contract();mutate(copy);assert.ok(validateRetainedAssertions(copy,legacy,png).length);
  }
  assert.ok(validateRetainedAssertions(contract(),Buffer.from('changed'),png).length);
  assert.ok(validateRetainedAssertions(contract(),legacy,()=>Buffer.from('changed')).length);
});
test('fresh current3Dsource pixels do not qualify missing operational behaviors',()=>{
  const report=qualifyFieldAtlasViewport();
  assert.equal(report.sourceProofOk,true,report.sourceFailures.join('\n'));
  assert.equal(report.ok,false);assert.equal(report.retainedRequired,43);assert.equal(report.currentCompleteBehaviorProofs,11);assert.equal(report.held.length,32);assert.equal(report.qualified.length,11);
  assert.ok(report.held.every(row=>row.status==='required-unqualified'));
});
test('release entrypoint stops at strict retained qualification before later checks',()=>{
  const root=mkdtempSync(join(tmpdir(),'field-atlas-release-gate-')),npm=join(root,'npm'),log=join(root,'calls.jsonl');
  try{
    writeFileSync(npm,`#!${process.execPath}\nconst fs=require('node:fs');const a=process.argv.slice(2);fs.appendFileSync(process.env.FIELD_ATLAS_GATE_LOG,JSON.stringify(a)+'\\n');process.exit(a.join(' ')==='run proof:field-atlas:check'?1:0);\n`);chmodSync(npm,0o700);
    const result=spawnSync(process.execPath,['scripts/verify-release.mjs'],{cwd:FIELD_ATLAS_ROOT,env:{...process.env,PATH:root+':'+process.env.PATH,FIELD_ATLAS_GATE_LOG:log},encoding:'utf8'});
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.deepEqual(readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line)),[['run','retired-runtime:check'],['run','drift:audit'],['run','proof:field-atlas:check']]);
    assert.match(result.stderr,/Release verification failed at: current3D viewport and retained operational assertions/);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('registered equivalents lose qualification when exact behavior or fixture evidence is changed',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../docs/plans/assets/field-atlas-viewport-proof/manifest.json',import.meta.url)));
  assert.equal(retainedBehaviorCoverage(contract(),manifest).filter(r=>r.status==='qualified-local-browser').length,11);
  const altered=structuredClone(manifest);altered.proofs.find(p=>p.state==='gate-preflight' && p.viewport.width===390).capture.behaviorChecks.separateApprovalConfirmation=false;
  assert.equal(retainedBehaviorCoverage(contract(),altered).filter(r=>r.status==='qualified-local-browser').length,9);
  const wrongFixture=structuredClone(manifest);wrongFixture.proofs.find(p=>p.state==='gate-reviewed' && p.viewport.width===320).fixtureReceipt.inputSha256='f'.repeat(64);
  assert.ok(retainedBehaviorCoverage(contract(),wrongFixture).filter(r=>r.status==='qualified-local-browser').length<11);
});
test('artifact readers reject unsupported paths before reading files',()=>{
  assert.throws(()=>readOwnedProofFile(FIELD_ATLAS_ROOT,'../outside','manifest.json'),/Unsupported/);
  assert.throws(()=>readOwnedProofFile(FIELD_ATLAS_ROOT,'docs/plans/assets/field-atlas-viewport-proof','../outside.png'),/Unsupported/);
});
test('unavailable source commit fails once without lazy network fetch',()=>{
  const start=Date.now();const errors=verifyCapturedSourceCommit({sourceBaseCommit:'f'.repeat(40),sourceBindings:JSON.parse(readFileSync(new URL('../docs/plans/assets/field-atlas-viewport-proof/manifest.json',import.meta.url))).sourceBindings});
  assert.deepEqual(errors,['Recorded source commit is unavailable locally']);assert.ok(Date.now()-start<4000);
});

test('canonical readers refuse linked directories, symlinked files and hardlinks before reading bytes',()=>{
  const root=mkdtempSync(join(tmpdir(),'field-atlas-owned-read-')),directory='docs/plans/assets/field-atlas-viewport-proof',full=join(root,directory),outside=join(root,'outside');
  try{
    mkdirSync(full,{recursive:true});mkdirSync(outside);const input=join(outside,'frame.png');writeFileSync(input,'synthetic sentinel');const target=join(full,'frame.png');
    symlinkSync(input,target);assert.throws(()=>readOwnedProofFile(root,directory,'frame.png'),/owned regular/);rmSync(target);
    linkSync(input,target);assert.throws(()=>readOwnedProofFile(root,directory,'frame.png'),/owned regular/);rmSync(target);
    writeFileSync(target,'owned');assert.equal(readOwnedProofFile(root,directory,'frame.png').toString(),'owned');rmSync(full,{recursive:true});
    symlinkSync(outside,full,'dir');assert.throws(()=>readOwnedProofFile(root,directory,'frame.png'),/owned directory/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
