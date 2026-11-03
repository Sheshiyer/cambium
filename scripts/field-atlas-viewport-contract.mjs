import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFileSync,existsSync,lstatSync,readFileSync,readdirSync,renameSync,writeFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {FIELD_ATLAS_ROOT,FIELD_ATLAS_CAPTURE_STEPS,FIELD_ATLAS_BEHAVIOR_EQUIVALENTS,fieldAtlasSourceIdentity,fieldAtlasSourceBindings,prepareFieldAtlasDirectory,validateFieldAtlasCapture} from './capture-field-atlas.mjs';
import {VIEWPORT_PROOF_CAPTURE_STEPS,viewportCaptureStepDigest} from '../workers/quests/src/visual-viewport-proof.mjs';

export const FIELD_ATLAS_PROOF_DIRECTORY='docs/plans/assets/field-atlas-viewport-proof';
export const FIELD_ATLAS_CONTRACT_PATH='docs/visual/field-atlas-viewport-contract.v1.json';
const LEGACY_DIRECTORY='docs/plans/assets/tg-miniapp-viewport-proof';
const LEGACY_MANIFEST_SHA256='50f83cb7ac13501f073ec60dce1287e18dcc69787e70d8e7cfeb64136bf1f722';
const LEGACY_INTENT_BINDING_SHA256='d9961849f4bb059c9f292dd81d98b286ec67c241870e6e073cbe453003d97ad1';
const RETIRED_GALLERY=new Set(['component-glyph-state-board-mobile.png','component-mission-components-mobile.png','component-motion-legend-mobile.png','component-legend-mobile.png']);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const registered=id=>typeof id==='string' && Object.hasOwn(FIELD_ATLAS_BEHAVIOR_EQUIVALENTS,id) ? FIELD_ATLAS_BEHAVIOR_EQUIVALENTS[id] : null;

export function validateRetainedAssertions(contract,legacyBytes,readLegacyPng){
  const errors=[];
  if(hash(legacyBytes)!==LEGACY_MANIFEST_SHA256)return ['Historical viewport manifest bytes changed'];
  if(typeof readLegacyPng!=='function')return ['Historical PNG reader is required'];
  const legacy=JSON.parse(String(legacyBytes));
  if(contract?.schema!=='cambium.field-atlas-viewport-contract.v1' || contract.planningBaseline!==95 || contract.deploymentApproved!==false || contract.trafficApproved!==false)errors.push('Viewport contract scope or held authority is invalid');
  if(contract?.legacy?.manifestPath!==`${LEGACY_DIRECTORY}/manifest.json` || contract.legacy.manifestSha256!==LEGACY_MANIFEST_SHA256 || contract.legacy.total!==47 || contract.legacy.retiredGalleryCount!==4 || contract.legacy.retainedBehaviorCount!==43)errors.push('Historical assertion census changed');
  if(!Array.isArray(contract?.assertions) || contract.assertions.length!==47)return [...errors,'All47 original assertion identities are required'];
  const definitions=contract.assertions.map(r=>[r?.ordinal,r?.legacyPath,r?.legacyStepSha256,r?.legacyPngSha256,r?.legacyIntent,r?.required,r?.behaviorIntent]);
  if(hash(JSON.stringify(definitions))!==LEGACY_INTENT_BINDING_SHA256)errors.push('Original retained behavior definitions changed');
  const frames=new Set(FIELD_ATLAS_CAPTURE_STEPS.map(step=>step.path));
  for(const [i,proof] of legacy.proofs.entries()){
    const row=contract.assertions[i],step=VIEWPORT_PROOF_CAPTURE_STEPS.find(step=>step.path===proof.path),retired=RETIRED_GALLERY.has(proof.path);
    if(!row || row.ordinal!==i+1 || row.legacyPath!==proof.path || row.legacyPngSha256!==proof.sha256 || !step || row.legacyStepSha256!==viewportCaptureStepDigest(step) || row.legacyIntent!==proof.intent){errors.push(`Original assertion binding changed at row${i+1}`);continue;}
    if(row.required!==!retired)errors.push(`Retained behavior cannot be retired: ${proof.path}`);
    if(typeof row.behaviorIntent!=='string' || !row.behaviorIntent.trim() || !Array.isArray(row.partialSourceFrames) || row.partialSourceFrames.some(path=>!frames.has(path)))errors.push(`Retained intent/source references are invalid for ${proof.path}`);
    if(!retired && row.currentBehaviorProof===null && (typeof row.remainingRequirement!=='string' || !row.remainingRequirement.trim()))errors.push(`Required coverage gap is missing for ${proof.path}`);
    const equivalent=registered(row.currentBehaviorProof);
    if(row.currentBehaviorProof!==null && (retired || !equivalent?.legacyPaths.includes(proof.path)))errors.push(`No complete current behavior equivalent is registered for ${proof.path}`);
    if(hash(readLegacyPng(proof.path))!==proof.sha256)errors.push(`Historical PNG bytes changed for ${proof.path}`);
  }
  return errors;
}
export function retainedBehaviorCoverage(contract,manifest){
  const proofs=new Map((manifest?.proofs || []).map(row=>[row.path,row]));
  return (contract.assertions || []).filter(row=>row.required).map(row=>{
    const equivalent=registered(row.currentBehaviorProof);
    const matches=equivalent?.legacyPaths.includes(row.legacyPath) && equivalent.proofs.every(required=>{
      const proof=proofs.get(required.path),step=FIELD_ATLAS_CAPTURE_STEPS.find(s=>s.path===required.path);
      return proof && step && proof.stepSha256===viewportCaptureStepDigest(step) && proof.capture?.ok===true && required.checks.every(key=>proof.capture.behaviorChecks?.[key]===true)
        && (!required.checks.includes('exactCanonicalReview') || proof.capture.renderedReviewSha256===proof.fixtureReceipt?.reviewSha256)
        && (step.fixture ? proof.fixtureReceipt?.name===step.fixture && proof.fixtureReceipt.authority==='synthetic-local-founder-read-fixture' : proof.fixtureReceipt===null && proof.requestPosts===0);
    });
    const inputs=new Map();
    for(const required of equivalent?.proofs || []){
      const proof=proofs.get(required.path),step=FIELD_ATLAS_CAPTURE_STEPS.find(s=>s.path===required.path),family=step?.fixture || 'guest';
      const values=inputs.get(family) || [];values.push(proof?.fixtureReceipt?.inputSha256 ?? (proof?.fixtureReceipt===null ? manifest?.pageSourceSha256 : null));inputs.set(family,values);
    }
    const qualified=!!matches && inputs.size>0 && [...inputs.values()].every(values=>values.every(value=>typeof value==='string' && value===values[0]));
    return {legacyPath:row.legacyPath,behaviorIntent:row.behaviorIntent,equivalence:row.currentBehaviorProof,
      proofPaths:equivalent?.proofs.map(p=>p.path) || [],partialSourceFrames:row.partialSourceFrames,
      remainingRequirement:qualified ? null : row.remainingRequirement || 'Registered current journey has not passed its exact source, fixture and browser assertions.',
      status:qualified ? 'qualified-local-browser' : 'required-unqualified'};
  });
}
export function retainedBehaviorHolds(contract,manifest){
  return retainedBehaviorCoverage(contract,manifest).filter(row=>row.status!=='qualified-local-browser');
}
export function verifyCapturedSourceCommit(manifest){
  const errors=[];
  if(!/^[a-f0-9]{40}$/.test(manifest?.sourceBaseCommit || '') || !Array.isArray(manifest?.sourceBindings))return ['Recorded source commit is invalid'];
  if(JSON.stringify(manifest.sourceBindings)!==JSON.stringify(fieldAtlasSourceBindings()))return ['Recorded source bindings are invalid'];
  const options={cwd:FIELD_ATLAS_ROOT,stdio:['ignore','pipe','ignore'],maxBuffer:4_000_000,timeout:2000,killSignal:'SIGKILL',env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0'}};
  try{execFileSync('git',['cat-file','-e',`${manifest.sourceBaseCommit}^{commit}`],options);}catch{return ['Recorded source commit is unavailable locally'];}
  const deadline=Date.now()+5000;
  for(const binding of manifest.sourceBindings){
    if(Date.now()>deadline){errors.push('Recorded source verification exceeded its local deadline');break;}
    try{
      const bytes=execFileSync('git',['show',`${manifest.sourceBaseCommit}:${binding.path}`],options);
      if(hash(bytes)!==binding.sha256)errors.push(`Recorded source commit differs for ${binding.path}`);
    }catch{errors.push(`Recorded source commit is unavailable for ${binding.path}`);}
  }
  return errors;
}
export function auditFieldAtlasSourceProof(root=FIELD_ATLAS_ROOT){
  const contract=JSON.parse(readFileSync(join(root,FIELD_ATLAS_CONTRACT_PATH),'utf8'));
  const legacyBytes=readOwnedProofFile(root,LEGACY_DIRECTORY,'manifest.json');
  const failures=validateRetainedAssertions(contract,legacyBytes,path=>readOwnedProofFile(root,LEGACY_DIRECTORY,path));
  const directory=join(root,FIELD_ATLAS_PROOF_DIRECTORY);
  try{
    const manifest=JSON.parse(String(readOwnedProofFile(root,FIELD_ATLAS_PROOF_DIRECTORY,'manifest.json')));
    if(manifest.workingTreeModified!==false)failures.push('Canonical source proof was captured from a dirty tree');
    failures.push(...validateFieldAtlasCapture(manifest,path=>readOwnedProofFile(root,FIELD_ATLAS_PROOF_DIRECTORY,path)));
    failures.push(...verifyCapturedSourceCommit(manifest));
    const expected=['manifest.json',...FIELD_ATLAS_CAPTURE_STEPS.map(step=>step.path)].sort();
    if(JSON.stringify(readdirSync(directory).sort())!==JSON.stringify(expected))failures.push('Current3D source artifact set is incomplete or contains unbound files');
    return {ok:failures.length===0,failures,contract,manifest};
  }catch(error){failures.push(`Current3D source proof is unavailable: ${error.code || error.name}`);return {ok:false,failures,contract,manifest:null};}
}
export function qualifyFieldAtlasViewport(root=FIELD_ATLAS_ROOT){
  const source=auditFieldAtlasSourceProof(root),coverage=retainedBehaviorCoverage(source.contract,source.ok ? source.manifest : null),held=coverage.filter(row=>row.status!=='qualified-local-browser'),qualified=coverage.filter(row=>row.status==='qualified-local-browser');
  return {schema:'cambium.field-atlas-viewport-qualification.v1',ok:source.ok && held.length===0,sourceProofOk:source.ok,
    sourceFailures:source.failures,currentSourceFrames:source.manifest?.proofs.length ?? 0,retiredGalleryCount:4,retainedRequired:43,
    currentCompleteBehaviorProofs:qualified.length,qualified,held,liveAcceptance:false,physicalDevice:false,planningBaseline:95,deploymentApproved:false,trafficApproved:false};
}
function ownedDirectory(path){const info=lstatSync(path);if(info.isSymbolicLink() || !info.isDirectory())throw new Error('Canonical viewport path must be an owned directory');}
export function readOwnedProofFile(root,directory,name){
  if(![LEGACY_DIRECTORY,FIELD_ATLAS_PROOF_DIRECTORY].includes(directory) || !/^[a-z0-9][a-z0-9.-]*$/i.test(name))throw new Error('Unsupported viewport artifact path');
  let parent=root;ownedDirectory(parent);
  for(const part of directory.split('/')){parent=join(parent,part);ownedDirectory(parent);}
  const path=join(parent,name),info=lstatSync(path);
  if(info.isSymbolicLink() || !info.isFile() || info.nlink!==1)throw new Error('Viewport proof must be an owned regular file');
  return readFileSync(path);
}
export function publishFieldAtlasSourceProof(directory,manifest){
  const errors=validateFieldAtlasCapture(manifest,path=>readFileSync(join(directory,path)));
  errors.push(...verifyCapturedSourceCommit(manifest));
  if(manifest?.workingTreeModified!==false)errors.push('Canonical source proof requires a clean source capture');
  const current=fieldAtlasSourceIdentity();
  if(current.workingTreeModified || current.sourceBaseCommit!==manifest?.sourceBaseCommit)errors.push('Canonical publication requires the unchanged current clean capture identity');
  const contract=JSON.parse(readFileSync(join(FIELD_ATLAS_ROOT,FIELD_ATLAS_CONTRACT_PATH),'utf8'));
  errors.push(...validateRetainedAssertions(contract,readFileSync(join(FIELD_ATLAS_ROOT,LEGACY_DIRECTORY,'manifest.json')),path=>readFileSync(join(FIELD_ATLAS_ROOT,LEGACY_DIRECTORY,path))));
  if(errors.length)throw new Error(errors.join('\n'));
  let parent=FIELD_ATLAS_ROOT;
  for(const part of ['docs','plans','assets']){parent=join(parent,part);ownedDirectory(parent);}
  const target=join(FIELD_ATLAS_ROOT,FIELD_ATLAS_PROOF_DIRECTORY);
  let targetExists=false;
  try{ownedDirectory(target);targetExists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  const stage=prepareFieldAtlasDirectory();
  for(const step of FIELD_ATLAS_CAPTURE_STEPS){
    const path=join(directory,step.path),info=lstatSync(path);
    if(info.isSymbolicLink() || !info.isFile() || info.nlink!==1)throw new Error('Capture input must be an owned regular PNG');
    copyFileSync(path,join(stage,step.path));
  }
  writeFileSync(join(stage,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const staged=validateFieldAtlasCapture(manifest,path=>readFileSync(join(stage,path)));if(staged.length)throw new Error(staged.join('\n'));
  const beforeRename=fieldAtlasSourceIdentity();
  if(beforeRename.workingTreeModified || beforeRename.sourceBaseCommit!==manifest.sourceBaseCommit)throw new Error('Capture source identity changed before publication');
  let backup=null;
  if(targetExists){backup=join(prepareFieldAtlasDirectory(),'previous');renameSync(target,backup);}
  try{renameSync(stage,target);}catch(error){if(backup && !existsSync(target))renameSync(backup,target);throw error;}
  return {directory:relative(FIELD_ATLAS_ROOT,target),previous:backup ? relative(FIELD_ATLAS_ROOT,backup) : null,
    sourceProof:true,retainedBehaviorQualification:false,heldRequiredBehaviors:retainedBehaviorHolds(contract,manifest).length};
}
