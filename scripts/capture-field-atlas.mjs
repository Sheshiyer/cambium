import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE } from '../workers/quests/src/page.ts';
import { withServer, captureViewportProof } from '../workers/quests/src/visual-viewport-proof.mjs';
import {createFieldAtlasFounderFixture,fieldAtlasFixtureInputDigest,fieldAtlasFixtureReviewDigest} from './field-atlas-founder-fixture.mjs';
import {createFieldAtlasOperationalFixture} from './field-atlas-operational-fixture.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const FIELD_ATLAS_ROOT = realpathSync(fileURLToPath(new URL('..',import.meta.url)));
const sourcePaths = ['scripts/capture-field-atlas.mjs','scripts/field-atlas-viewport-contract.mjs',
  'scripts/field-atlas-founder-fixture.mjs',
  'scripts/field-atlas-operational-fixture.mjs','docs/visual/viewport-owner-bindings.md',
  'scripts/check-field-atlas-proof.mjs','scripts/drift-audit.mjs','scripts/verify-release.mjs','package.json',
  'docs/visual/field-atlas-viewport-contract.v1.json','workers/quests/src/visual-viewport-proof.mjs',
  'workers/quests/src/page.ts','workers/quests/src/page/index.ts','workers/quests/src/page/world-host.ts',
  'workers/quests/src/page/components/curious-world.ts','workers/quests/src/page/components/curious-world.generated.ts',
  'workers/quests/src/page/client/curious-read-bridge.ts','workers/quests/src/page/client/curious-gate-bridge.ts',
  'workers/quests/src/page/client/curious-department-bridge.ts','apps/cambium-r3f/src/curious-world/index.ts','apps/cambium-r3f/src/curious-world/styles.css'];
export const fieldAtlasSourceBindings = () => sourcePaths.map(path => ({path,sha256:hash(readFileSync(new URL(`../${path}`,import.meta.url)))}));
export function fieldAtlasSourceIdentity() {
  const git = args => execFileSync('git',args,{cwd:FIELD_ATLAS_ROOT,encoding:'utf8',timeout:3000,env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0'}}).trim();
  return {sourceBaseCommit:git(['rev-parse','HEAD']),workingTreeModified:git(['status','--porcelain']).length>0};
}
export function prepareFieldAtlasDirectory(root = FIELD_ATLAS_ROOT) {
  const base = join(realpathSync(root),'.artifacts');
  try {
    const entry = lstatSync(base);
    if (entry.isSymbolicLink() || !entry.isDirectory()) throw new Error('Field atlas artifact root must be an owned directory');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  mkdirSync(base,{recursive:true});
  if (realpathSync(base) !== base) throw new Error('Field atlas artifact root must be an owned directory');
  return mkdtempSync(join(base,'field-atlas-current-'));
}
export const FIELD_ATLAS_PAGE_DIGEST = hash(PAGE);
export const FIELD_ATLAS_CHECK_KEYS = ['canvas','rendererAvailable','sourceEvidence','viewport','contained',
  'headerContained','headerSeparated','headerTextInside','touchTargets','accessibleControls','state','stateVisible','operationalBoundary','retiredSurfaceAbsent'];

// Serialized into the real PAGE's browser context. It observes layout and state;
// no DOM click, mock result or change in authority is performed by this function.
export async function observeFieldAtlasViewport({state,width,height,ownerFixture=false},expectedReviewSha256=null) {
  const root=document.querySelector('#curious-world'), canvas=root?.querySelector('canvas');
  const dialog=root?.querySelector('dialog.cw-dialog'), intro=root?.querySelector('.cw-intro');
  const header=root?.querySelector('.cw-top'), status=root?.querySelector('.cw-read');
  const wordmark=root?.querySelector('.cw-wordmark');
  const controls=[...root?.querySelectorAll('.cw-top-actions .cw-button') || []];
  const rect=node=>node?.getBoundingClientRect();
  const inside=(a,b)=>!!a && !!b && a.left>=b.left-.5 && a.right<=b.right+.5 && a.top>=b.top-.5 && a.bottom<=b.bottom+.5;
  const separated=(a,b)=>!!a && !!b && (a.right<=b.left || b.right<=a.left || a.bottom<=b.top || b.bottom<=a.top);
  const visibleTextRects=node=>{
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT), result=[];
    let text;while((text=walker.nextNode())){
      if(!text.textContent.trim())continue;
      const range=document.createRange();range.selectNodeContents(text);
      result.push(...[...range.getClientRects()].filter(r=>r.width>0 && r.height>0));
    }
    return result;
  };
  const body=rect(dialog?.open ? dialog : root), h=rect(header), s=rect(status), w=rect(wordmark);
  const viewport={left:0,top:0,right:innerWidth,bottom:innerHeight};
  const paintedText=node=>{
    const clip=rect(dialog?.querySelector('.cw-dialog-body'));
    if(!node || !clip || getComputedStyle(node).visibility!=='visible' || getComputedStyle(node).opacity==='0')return false;
    const lines=visibleTextRects(node);
    return lines.length>0 && lines.every(line=>{
      const hit=document.elementFromPoint((line.left+line.right)/2,(line.top+line.bottom)/2);
      return inside(line,clip) && inside(line,viewport) && !!hit && (hit===node || node.contains(hit));
    });
  };
  const labels=['Open product departments',/^Choose your traveler\. Current traveler: .+\.$/,'Open district chart and local passport'];
  const dialogControls=dialog?.open ? [...dialog.querySelectorAll('button,summary,select,input:not([type="hidden"]),textarea,a[href]')].filter(c=>rect(c).width>0 && rect(c).height>0) : [];
  let stateOk=false;
  const behaviorChecks={};
  let renderedReviewSha256=null;
  if(state==='entry')stateOk=intro?.hidden===false && !dialog?.open;
  else if(state==='world' || state==='gate-close'){
    stateOk=root?.dataset.walking==='true' && intro?.hidden===true && !dialog?.open;
    if(state==='gate-close')behaviorChecks.inspectionCloseRestoresWorld=stateOk && document.activeElement===root.querySelector('.cw-map-button');
  }
  else if(dialog?.open && root?.dataset.walking==='true'){
    const title=dialog.querySelector('.cw-dialog-title')?.textContent;
    if(state==='chart' || state==='local-visit' || state==='local-visit-read'){
      stateOk=title==='The field chart' && dialog.querySelectorAll('[data-cw-action="travel"]').length===8 && dialog.textContent.includes('visits do not advance real work');
      if(state==='local-visit' || state==='local-visit-read')behaviorChecks.localVisitIsSeparate=stateOk && Number(root.dataset.localDistrictVisits)>0 && dialog.querySelector('[data-cw-action="travel"][data-visited="true"]')!==null && status.textContent.includes('Source');
    }
    else if(state==='departments')stateOk=title==='Product departments' && dialog.textContent.includes('Department source reader unavailable');
    else if(state==='courier')stateOk=title==='Your traveling companions' && dialog.querySelectorAll('[data-cw-action="traveler"]').length===3 && dialog.textContent.includes('Cosmetic companions for local exploration');
    else if(state==='directory')stateOk=title==='The source directory' && dialog.querySelectorAll('[data-cw-action="inspect"]').length===30;
    else if(state==='gate-held')stateOk=!!dialog.querySelector('.cw-gate-empty') && dialog.textContent.includes('Gate read is held') && !dialog.querySelector('[data-cw-action="gate-sign"]:not([disabled])');
    else if(state==='source-folio')stateOk=!!dialog.querySelector('.cw-provenance') && dialog.textContent.includes('Source reference') && title.toLowerCase().includes('cortex');
    else if(state==='gate-empty'){
      stateOk=!!dialog.querySelector('.cw-gate-empty') && dialog.textContent.includes('No goal proposals are waiting for a founder decision.');
      behaviorChecks.verifiedEmptyQueue=stateOk && dialog.querySelector('.cw-gate-mode')?.dataset.signer==='access' && !dialog.querySelector('[data-cw-action="gate-open"]');
    }else if(state==='gate-back'){
      stateOk=dialog.querySelectorAll('[data-cw-action="gate-open"]').length===1;
      behaviorChecks.inspectionBackReturnsQueue=stateOk && !dialog.querySelector('.cw-gate-full-review');
    }else if(['gate-reviewed','gate-preflight'].includes(state)){
      const full=dialog.querySelector('.cw-gate-full-review');let record=null;
      try{record=JSON.parse(full?.textContent || 'null');}catch{}
      const digest='6'.repeat(64),back=dialog.querySelector('[data-cw-action="inspect"][data-cw-target="gate"]');
      stateOk=!!full && record?.changeDigest===digest && record.review?.changeDigest===digest && record.review.changeSet?.changeDigest===digest;
      if(record){
        const canonical=item=>Array.isArray(item) ? '['+item.map(canonical).join(',')+']' : item && typeof item==='object' ? '{'+Object.keys(item).sort().map(key=>JSON.stringify(key)+':'+canonical(item[key])).join(',')+'}' : JSON.stringify(item);
        const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(record)));
        renderedReviewSha256=[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
      }
      behaviorChecks.exactCanonicalReview=stateOk && full.closest('details')?.open===true && record.proposalId==='cambium:'+digest && record.version===1 && renderedReviewSha256===expectedReviewSha256;
      behaviorChecks.exactBranchGate=stateOk && record.review.founderInspect?.workObjectId==='branch:fitcheck' && dialog.textContent.includes('Fitcheck');
      behaviorChecks.consequenceAndReversal=dialog.querySelector('.cw-gate-consequence')?.textContent===record?.review?.consequence && dialog.querySelector('.cw-gate-reversibility')?.textContent===record?.review?.reversibility;
      behaviorChecks.inspectionBackAndClose=!!back && !!root.querySelector('.cw-close') && [back,root.querySelector('.cw-close')].every(c=>rect(c).height>=44);
      if(state==='gate-preflight'){
        const confirm=dialog.querySelector('[data-cw-action="gate-sign"][data-cw-target="approve-goal-graph"]');
        const cancel=dialog.querySelector('[data-cw-action="gate-cancel"]');
        behaviorChecks.separateApprovalConfirmation=!!confirm && !confirm.disabled && confirm.textContent==='Confirm approval' && dialog.querySelector('.cw-gate-confirm-line')?.textContent.includes(digest)===true;
        behaviorChecks.cancelReachable=!!cancel && rect(cancel).height>=44 && rect(confirm).height>=44;
      }
    }
  }
  const checks={
    canvas:!!canvas && canvas.width>0 && canvas.height>0,
    rendererAvailable:document.getElementById('curious-world-fallback')?.hidden===true,
    sourceEvidence:root?.dataset.evidence==='source',
    viewport:innerWidth===width && innerHeight===height,
    contained:inside(body,viewport) && document.documentElement.scrollWidth<=innerWidth+1 && (!dialog?.open || dialog.scrollWidth<=dialog.clientWidth+1),
    headerContained:inside(h,viewport) && controls.every(c=>inside(rect(c),h)),
    headerSeparated:controls.every(c=>separated(rect(c),s) && separated(rect(c),w)) && controls.every((c,i)=>controls.slice(i+1).every(next=>separated(rect(c),rect(next)))),
    headerTextInside:controls.every(c=>visibleTextRects(c).every(r=>inside(r,rect(c)))),
    touchTargets:controls.length===3 && [...controls,...dialogControls].every(c=>rect(c).width>=44 && rect(c).height>=44),
    accessibleControls:controls.length===3 && controls.every((c,i)=>(typeof labels[i]==='string' ? c.getAttribute('aria-label')===labels[i] : labels[i].test(c.getAttribute('aria-label') || '')) && c.querySelector('svg[aria-hidden="true"]')),
    state:stateOk,
    stateVisible:['gate-held','gate-empty'].includes(state) ? paintedText(dialog?.querySelector('.cw-gate-empty'))
      : state==='gate-back' ? paintedText(dialog?.querySelector('.cw-gate-row')) : true,
    operationalBoundary:ownerFixture ? !root.querySelector('.cw-decision-chamber[data-confirmed="true"]')
      && (state==='gate-preflight' || !root.querySelector('[data-cw-action="gate-sign"]:not([disabled])'))
      : status?.textContent.includes('Source')===true && !root?.querySelector('[data-cw-action="gate-sign"]:not([disabled])'),
    retiredSurfaceAbsent:!document.querySelector('[data-component="MissionControlShell"],#operating-fabric,[data-component="RootNav"]'),
  };
  return {ok:[...Object.values(checks),...Object.values(behaviorChecks)].every(v=>v===true),checks,behaviorChecks,renderedReviewSha256};
}
const pointer=selector=>({kind:'pointer',selector,waitFor:`document.querySelector(${JSON.stringify(selector)})`});
const begin=pointer('.cw-begin'), chart=pointer('.cw-map-button');
const states=[
  ...[320,390,430,600,601,1280].map(width=>['entry',width]),
  ...[320,390,430,1280].map(width=>['world',width]),
  ...[320,390,430,1280].map(width=>['chart',width]),
  ...[320,390,430,1280].map(width=>['departments',width]),
  ...['courier','directory','gate-held','source-folio'].flatMap(state=>[320,390].map(width=>[state,width])),
  ...[320,390].map(width=>['local-visit',width]),
  ...[320,390].map(width=>['local-visit-read',width]),
  ...[320,390].map(width=>['gate-empty',width]),
  ...['gate-reviewed','gate-preflight','gate-back','gate-close'].flatMap(state=>[320,390,430].map(width=>[state,width])),
  ...['gate-reviewed','gate-preflight','gate-back','gate-close'].map(state=>[state,430,844]),
];
export const FIELD_ATLAS_CAPTURE_STEPS=states.map(([state,width,originalHeight])=>{
  const height=originalHeight ?? (width===430 ? 932 : width>=600 ? 900 : 844);
  const inputSteps=state==='entry' ? [] : [begin];
  const ownerFixture=['local-visit-read','gate-empty','gate-reviewed','gate-preflight','gate-back','gate-close'].includes(state);
  if(state==='departments')inputSteps.push(pointer('.cw-departments-button'));
  else if(state==='courier')inputSteps.push(pointer('.cw-traveler-button'));
  else if(!['entry','world'].includes(state)){
    inputSteps.push(chart);
    if(state==='gate-held' || ownerFixture && state!=='local-visit-read')inputSteps.push(pointer('[data-cw-action="inspect"][data-cw-target="gate"]'));
    else if(state==='directory' || state==='source-folio')inputSteps.push(pointer('[data-cw-action="directory"]'));
    if(state==='source-folio')inputSteps.push(pointer('[data-cw-action="inspect"][data-cw-target="cortex"]'));
  }
  if(ownerFixture && !['gate-empty','local-visit-read'].includes(state)){
    inputSteps.push(pointer('[data-cw-action="gate-open"]'),
      pointer('[data-cw-disclosure^="canonical:"] > summary'));
    if(state==='gate-preflight')inputSteps.push({kind:'pointer',selector:'[data-cw-action="gate-confirm"][data-cw-target="approve-goal-graph"]',waitFor:'document.querySelector(\'[data-cw-action="gate-confirm"][data-cw-target="approve-goal-graph"]\')?.disabled === false'});
    if(state==='gate-back' || state==='gate-close')inputSteps.push(pointer('[data-cw-action="inspect"][data-cw-target="gate"]'));
    if(state==='gate-close')inputSteps.push(pointer('.cw-close'));
  }
  if(state==='local-visit' || state==='local-visit-read')inputSteps.push(pointer('[data-cw-action="travel"]'),{...chart,waitFor:"Number(document.querySelector('#curious-world')?.dataset.localDistrictVisits)>0"});
  if(['gate-held','gate-empty','gate-back'].includes(state)){
    const selector=state==='gate-back' ? '.cw-gate-row' : '.cw-gate-empty';
    inputSteps.push({kind:'scroll',selector,waitFor:`document.querySelector(${JSON.stringify(selector)})`});
  }
  const behaviorKeys=state.startsWith('local-visit') ? ['localVisitIsSeparate'] : state==='gate-empty' ? ['verifiedEmptyQueue'] : state==='gate-back' ? ['inspectionBackReturnsQueue'] : state==='gate-close' ? ['inspectionCloseRestoresWorld']
    : ['gate-reviewed','gate-preflight'].includes(state) ? ['exactCanonicalReview','exactBranchGate','consequenceAndReversal','inspectionBackAndClose',...(state==='gate-preflight'?['separateApprovalConfirmation','cancelReachable']:[])] : [];
  return {path:`field-atlas-${state}-${width}${originalHeight ? 'x'+height : ''}.png`,state,viewport:{width,height},webgl:true,diagnostics:true,
    fixture:ownerFixture ? ['gate-empty','local-visit-read'].includes(state) ? 'empty' : 'pending' : null,behaviorKeys,
    desktopPageBrowser:width>=1000,exactViewport:width<1000,inputSteps,
    waitFor:"document.querySelector('#curious-world canvas') && document.getElementById('curious-world-fallback').hidden",
    assertExpression:`(${observeFieldAtlasViewport.toString()})(${JSON.stringify({state,width,height,ownerFixture})},"__FIELD_ATLAS_EXPECTED_REVIEW_SHA256__")`};
});
export const FIELD_ATLAS_STEP_DIGEST=hash(JSON.stringify(FIELD_ATLAS_CAPTURE_STEPS));
export function fieldAtlasBoundAssertion(step,reviewSha256){
  if(reviewSha256!==null && !/^[a-f0-9]{64}$/.test(reviewSha256 || ''))throw new Error('Expected review fingerprint is invalid');
  return step.assertExpression.replace('"__FIELD_ATLAS_EXPECTED_REVIEW_SHA256__"',JSON.stringify(reviewSha256));
}
const frame=(state,width,checks)=>({path:`field-atlas-${state}-${width}.png`,checks});
export const FIELD_ATLAS_BEHAVIOR_EQUIVALENTS={
  'branch-gate-review-fitcheck-v1':{legacyPaths:['sheet-mission-review-gate-mobile.png'],proofs:[frame('gate-reviewed',390,['exactCanonicalReview','exactBranchGate','inspectionBackAndClose'])],rationale:'The current mission dossier identifies the exact Fitcheck branch from canonical Inspect and exposes its complete Gate review in the contained dialog.'},
  'local-visits-not-work-v1':{legacyPaths:['inspect-no-fake-progress-mobile.png'],proofs:['local-visit','local-visit-read'].flatMap(state=>[320,390].map(w=>frame(state,w,['localVisitIsSeparate']))),rationale:'A real local visit updates only the exploration passport in both unavailable and available source-read contexts; the scoped source label and explicit no-real-work message remain, with zero action requests.'},
  'verified-empty-queue-v1':{legacyPaths:['gate-empty-mobile.png'],proofs:[320,390].map(w=>frame('gate-empty',w,['verifiedEmptyQueue'])),rationale:'Existing founder read renders an explicitly empty pending queue; unavailable guest read is not treated as empty.'},
  'complete-consequence-review-v1':{legacyPaths:['gate-consequence-mobile.png'],proofs:[320,390,430].map(w=>frame('gate-reviewed',w,['exactCanonicalReview','consequenceAndReversal'])),rationale:'Existing canonical proposal seam supplies the complete exact change, consequence and reversal before approval.'},
  'explicit-approve-preflight-v1':{legacyPaths:['sheet-gate-approve-preflight-mobile.png'],proofs:[frame('gate-preflight',390,['exactCanonicalReview','separateApprovalConfirmation','cancelReachable'])],rationale:'Approve opens a separate exact-digest confirmation and reachable cancellation after complete review; no signature is submitted.'},
  ...Object.fromEntries([320,390,430].map(w=>[`mission-gate-review-${w}-v1`,{legacyPaths:[`operating-fabric-gate-sheet-${w}-mobile.png`],proofs:[frame('gate-preflight',w,['exactCanonicalReview','separateApprovalConfirmation','cancelReachable'])],rationale:'Current mission dossier reached through the existing chart/Gate/proposal path retains exact-width review, confirmation and cancellation.'}])),
  ...Object.fromEntries([320,390,430].map(w=>[`mission-inspection-return-${w}-v1`,{legacyPaths:[`operating-fabric-inspect-sheet-${w}-mobile.png`],proofs:[frame('gate-reviewed',w,['exactCanonicalReview','inspectionBackAndClose']),frame('gate-back',w,['inspectionBackReturnsQueue']),frame('gate-close',w,['inspectionCloseRestoresWorld'])],rationale:'Current mission inspection includes exact full review, back to the pending queue and close to the world with original opener focus at the original width.'}]))
};

export function validateFieldAtlasGeometry(geometry,step,png){
  const errors=[],fail=()=>errors.push('Observed viewport/crop/PNG binding is invalid');
  if(!geometry || geometry.schema!=='cambium.viewport-capture-geometry.v1' || !Buffer.isBuffer(png) || png.length<24)return ['Observed viewport/crop/PNG binding is missing'];
  const c=geometry.cssViewport,v=geometry.visualViewport,d=geometry.deviceScaleFactor;
  if(!c || c.width!==step.viewport.width || c.height!==step.viewport.height || c.scrollX!==0 || c.scrollY!==0 || d!==2 || !v || ![v.width,v.height,v.offsetLeft,v.offsetTop,v.scale].every(Number.isFinite) || Math.abs(v.width-c.width)>.5 || Math.abs(v.height-c.height)>.5 || v.offsetLeft!==0 || v.offsetTop!==0 || v.scale!==1)fail();
  let size=step.viewport;
  if(step.clipSelector){
    const r=geometry.observedClip,k=geometry.clip;
    if(!r || !k || r.selector!==step.clipSelector || k.selector!==step.clipSelector || geometry.clipVisible!==true || ![r.x,r.y,r.width,r.height,k.x,k.y,k.width,k.height].every(Number.isFinite) || r.x<0 || r.y<0 || r.width<=0 || r.height<=0 || r.x+r.width>step.viewport.width || r.y+r.height>step.viewport.height){fail();}
    else{
      const x=Math.floor(r.x*d),y=Math.floor(r.y*d),expected={x:x/d,y:y/d,width:(Math.ceil((r.x+r.width)*d)-x)/d,height:(Math.ceil((r.y+r.height)*d)-y)/d};
      if(Object.keys(expected).some(key=>Math.abs(expected[key]-k[key])>1e-6))fail();
      size=k;
    }
  }else if(geometry.observedClip!==null || geometry.clip!==null || geometry.clipVisible!==null)fail();
  const p=geometry.png;
  if(!p || p.width!==Math.round(size.width*d) || p.height!==Math.round(size.height*d) || p.width!==png.readUInt32BE(16) || p.height!==png.readUInt32BE(20) || p.bytes!==png.length || p.sha256!==hash(png))fail();
  return errors;
}

export function validateFieldAtlasCapture(manifest,readPng){
  const errors=[];
  if(typeof readPng!=='function')return ['PNG artifact reader is required'];
  if(manifest?.schema!=='cambium.field-atlas-viewport-source.v1' || manifest.pageSourceSha256!==FIELD_ATLAS_PAGE_DIGEST || manifest.captureStepSha256!==FIELD_ATLAS_STEP_DIGEST)errors.push('Capture source or instruction binding is stale');
  if(JSON.stringify(manifest?.sourceBindings)!==JSON.stringify(fieldAtlasSourceBindings()))errors.push('Capture helper source binding is stale');
  if(manifest?.canonicalAcceptance!==false || manifest.liveAcceptance!==false || manifest.physicalDevice!==false || manifest.trustedTouchAcceptance!==false || manifest.releaseReady!==false || manifest.mockGatePostCount!==0 || manifest.evidenceScope!=='local-source-fixture')errors.push('Capture authority/scope is invalid');
  if(!/^[a-f0-9]{40}$/.test(manifest?.sourceBaseCommit || '') || typeof manifest.workingTreeModified!=='boolean')errors.push('Capture source revision is unconfirmed');
  const proofs=manifest?.proofs ?? [];
  if(!Array.isArray(proofs))return [...errors,'Capture rows must be an array'];
  if(JSON.stringify(proofs.map(row=>row?.path))!==JSON.stringify(FIELD_ATLAS_CAPTURE_STEPS.map(row=>row.path)))errors.push('Capture coverage/order is incomplete');
  for(const [index,proof] of proofs.entries()){
    const step=FIELD_ATLAS_CAPTURE_STEPS[index];
    if(!step || proof?.path!==step.path){errors.push('Capture path is outside the supported steps');continue;}
    if(proof.state!==step.state || proof.stepSha256!==hash(JSON.stringify(step)) || JSON.stringify(proof.viewport)!==JSON.stringify(step.viewport)
      || proof.capture?.ok!==true || !proof.capture.checks || JSON.stringify(Object.keys(proof.capture.checks).sort())!==JSON.stringify([...FIELD_ATLAS_CHECK_KEYS].sort())
      || Object.values(proof.capture.checks).some(v=>v!==true))errors.push(`Browser observation is unconfirmed for ${proof.path}`);
    if(!proof.capture?.behaviorChecks || JSON.stringify(Object.keys(proof.capture.behaviorChecks).sort())!==JSON.stringify([...step.behaviorKeys].sort()) || Object.values(proof.capture.behaviorChecks).some(v=>v!==true))errors.push(`Behavior observation is unconfirmed for ${proof.path}`);
    if(step.fixture){
      const fixture=proof.fixtureReceipt;let inputMatches=false;
      try{inputMatches=fixture?.inputSha256===fieldAtlasFixtureInputDigest(step.fixture,fixture.observedAt) && fixture.reviewSha256===fieldAtlasFixtureReviewDigest(step.fixture,fixture.observedAt);}catch{}
      if(!fixture || fixture.name!==step.fixture || fixture.authority!=='synthetic-local-founder-read-fixture' || !inputMatches
        || fixture.decisionPosts!==0 || fixture.renewalPosts!==0 || fixture.unexpectedRequests!==0 || !Number.isSafeInteger(fixture.envelopeReads) || fixture.envelopeReads<1 || !Number.isSafeInteger(fixture.sessionReads) || fixture.sessionReads<1
        || !Number.isSafeInteger(fixture.graphReads) || fixture.graphReads<1 || !Number.isSafeInteger(fixture.proposalReads) || (step.fixture==='empty' ? fixture.proposalReads!==0 : fixture.proposalReads<1 || fixture.proposalReads>4)
        || JSON.stringify(fixture.methodCounts)!==JSON.stringify({envelopeGET:fixture.envelopeReads,sessionGET:fixture.sessionReads,graphGET:fixture.graphReads,proposalPOST:fixture.proposalReads,deniedDecisionPOST:0,deniedRenewalPOST:0}))errors.push(`Local owner fixture binding is unconfirmed for ${proof.path}`);
    }else if(proof.fixtureReceipt!==null)errors.push(`Unexpected owner fixture for ${proof.path}`);
    let idleOperational=false;
    try{
      const r=proof.operationalFixtureReceipt,fixture=createFieldAtlasOperationalFixture({now:Date.parse(r?.ownerRead?.observedAt)});
      idleOperational=JSON.stringify(r)===JSON.stringify(fixture.snapshot());
    }catch{}
    if(!idleOperational)errors.push(`Operational fixture must remain idle for ${proof.path}`);
    let assertionMatches=false;
    try{assertionMatches=proof.assertionSha256===hash(fieldAtlasBoundAssertion(step,proof.fixtureReceipt?.reviewSha256 ?? null));}catch{}
    if(!assertionMatches)errors.push(`Executed assertion binding is invalid for ${proof.path}`);
    if(step.behaviorKeys.includes('exactCanonicalReview') && proof.capture.renderedReviewSha256!==proof.fixtureReceipt?.reviewSha256)errors.push(`Complete rendered review does not match owner input for ${proof.path}`);
    if(!Number.isSafeInteger(proof.requestPosts) || proof.requestPosts!==(proof.fixtureReceipt?.proposalReads ?? 0))errors.push(`Unexpected POST requests for ${proof.path}`);
    const diagnostics=proof.diagnostics;
    if(!diagnostics || ['uncaughtErrors','consoleErrors','failedRequests','badResponses'].some(k=>diagnostics[k]!==0) || !Number.isSafeInteger(diagnostics.warnings) || diagnostics.warnings<0)errors.push(`Browser diagnostics are unconfirmed for ${proof.path}`);
    const png=readPng(proof.path);
    errors.push(...validateFieldAtlasGeometry(proof.geometry,step,png).map(message=>`${message} for ${proof.path}`));
    if(!/^[a-f0-9]{64}$/.test(proof.sha256) || hash(png)!==proof.sha256)errors.push(`PNG binding is invalid for ${proof.path}`);
    if(png.length<45 || png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || png.subarray(12,16).toString()!=='IHDR'
      || proof.width!==png.readUInt32BE(16) || proof.height!==png.readUInt32BE(20) || proof.bytes!==png.length)errors.push(`PNG viewport is invalid for ${proof.path}`);
  }
  return errors;
}

export async function captureFieldAtlas(){
  const directory=prepareFieldAtlasDirectory(),sourceIdentity=fieldAtlasSourceIdentity(),startedBindings=fieldAtlasSourceBindings();
  const proofs=[];let mockGatePostCount=0;
  const localFounderFixture=createFieldAtlasFounderFixture();
  const localOperationalFixture=createFieldAtlasOperationalFixture();
  await withServer(async(origin,metrics)=>{
    for(const step of FIELD_ATLAS_CAPTURE_STEPS){
      const postsBefore=metrics.postCount();
      localFounderFixture.select(step.fixture);
      const assertion=fieldAtlasBoundAssertion(step,localFounderFixture.snapshot()?.reviewSha256 ?? null);
      const route=step.fixture ? `/founder?tenant=cambium&atlas-fixture=${step.fixture}` : '/?tenant=cambium';
      const file=join(directory,step.path),observed=await captureViewportProof(origin+route,file,{...step,captureGeometry:true,assertExpression:assertion}),bytes=readFileSync(file);
      proofs.push({path:step.path,state:step.state,viewport:step.viewport,stepSha256:hash(JSON.stringify(step)),assertionSha256:hash(assertion),capture:observed.assertion,
        geometry:observed.geometry,diagnostics:observed.diagnostics,fixtureReceipt:metrics.founderFixture(),operationalFixtureReceipt:metrics.operationalFixture(),requestPosts:metrics.postCount()-postsBefore,browser:observed.browser,browserMode:observed.browserMode,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bytes:bytes.length,sha256:hash(bytes)});
      console.log(`captured ${step.path}`);
    }
    mockGatePostCount=metrics.gatePostCount();
  },{localFounderFixture,localOperationalFixture});
  const manifest={schema:'cambium.field-atlas-viewport-source.v1',observedAt:new Date().toISOString(),...sourceIdentity,sourceBindings:startedBindings,
    pageSourceSha256:FIELD_ATLAS_PAGE_DIGEST,captureStepSha256:FIELD_ATLAS_STEP_DIGEST,evidenceScope:'local-source-fixture',renderer:'local software WebGL',
    canonicalAcceptance:false,liveAcceptance:false,physicalDevice:false,trustedTouchAcceptance:false,releaseReady:false,mockGatePostCount,proofs};
  const errors=validateFieldAtlasCapture(manifest,p=>readFileSync(join(directory,p)));
  if(JSON.stringify(sourceIdentity)!==JSON.stringify(fieldAtlasSourceIdentity()) || JSON.stringify(startedBindings)!==JSON.stringify(fieldAtlasSourceBindings()))errors.push('Capture source changed while reading');
  if(errors.length)throw new Error(errors.join('\n'));
  writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return {directory,manifest};
}
async function main(){
  if(process.argv.length>3 || process.argv[2] && process.argv[2]!=='--write-canonical')throw new Error('Only --write-canonical is supported');
  const {directory,manifest}=await captureFieldAtlas();
  if(process.argv[2]==='--write-canonical'){
    const {publishFieldAtlasSourceProof}=await import('./field-atlas-viewport-contract.mjs');
    publishFieldAtlasSourceProof(directory,manifest);
  }
  console.log(JSON.stringify({directory,proofs:manifest.proofs.length,pageSourceSha256:manifest.pageSourceSha256,canonicalAcceptance:false}));
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  // Finish module evaluation before publication imports the contract, which
  // imports these capture exports. Top-level await here would deadlock that
  // cycle after the browser run had already completed.
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
