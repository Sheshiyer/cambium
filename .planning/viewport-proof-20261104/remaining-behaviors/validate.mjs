// Manual, read-only validation of this finite proposal; never a runtime admission.
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {VIEWPORT_PROOF_CAPTURE_STEPS,viewportCaptureStepDigest} from '../../../workers/quests/src/visual-viewport-proof.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),dir=fileURLToPath(new URL('./',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=p=>readFileSync(join(root,p));
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const baseline='e6b28642eb79d6668c336b59cf745c5ab9581749';
const git=p=>execFileSync('git',['show',`${baseline}:${p}`],{cwd:root,encoding:'utf8',timeout:3000,env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0'}});
const original=JSON.parse(git('docs/visual/field-atlas-viewport-contract.v1.json'));
const plan=json(join(dir,'coverage.json'));
const validPath=p=>typeof p==='string' && p.length>0 && !p.startsWith('/') && !p.includes('\\') && !p.split('/').includes('..');
const errors=[];
function checkData(p){
 const e=[];
 if(p.schema!=='cambium.viewport-gap-plan.v1'||p.sourceBaseline!==baseline||p.planningBaseline!==95||p.status!=='proposed-for-human-review')e.push('proposal identity/baseline changed');
 if(p.executionAuthorized!==false||p.deploymentApproved!==false||p.trafficApproved!==false||p.acceptedPlanDigest!==null||p.isaAcceptanceRef!==null||p.canonicalMapping!==null||JSON.stringify(p.admittedTasks)!=='[]')e.push('held authority changed');
 const retained=original.assertions.filter(a=>a.required),qualified=retained.filter(a=>a.currentBehaviorProof),gaps=retained.filter(a=>!a.currentBehaviorProof);
 if(p.retained?.length!==43||retained.length!==43||qualified.length!==11||gaps.length!==32)e.push('43=11+32 conservation failed');
 for(const a of retained){const row=p.retained?.find(r=>r.legacyOrdinal===a.ordinal);
  if(!row||row.legacyPath!==a.legacyPath||row.required!==true||row.behaviorIntent!==a.behaviorIntent||row.originalStepSha256!==a.legacyStepSha256||row.originalPngSha256!==a.legacyPngSha256||row.baselineEquivalence!==a.currentBehaviorProof||row.isaRequirement!==`FA-VPG-${String(a.ordinal).padStart(2,'0')}`||row.baselineStatus!==(a.currentBehaviorProof?'qualified-local-browser':'required-unqualified')||row.implementationComplete!==false||row.futureAcceptance!=='unchecked')e.push(`retained identity/state changed: ${a.ordinal}`);
  if(row && (!!row.proposedNewCapture!==!a.currentBehaviorProof||!row.originalSource?.fullStepMustBeCompared))e.push(`complete-step or gap coverage changed: ${a.ordinal}`);
  const step=VIEWPORT_PROOF_CAPTURE_STEPS.find(s=>s.path===a.legacyPath),viewport=step?.viewport||{width:390,height:844};
  if(!step||viewportCaptureStepDigest(step)!==a.legacyStepSha256||JSON.stringify(row?.originalViewport)!==JSON.stringify(viewport))e.push('original step/viewport mismatch: '+a.ordinal);
  if(row?.proposedNewCapture){const capture=row.proposedNewCapture,clip=step?.clipSelector||null;
   if(capture.captureMode!==(clip?'clipped-dialog':'full-viewport')||capture.originalClipSelector!==clip||capture.clipReceiptRequired!==!!clip)e.push('original clipping contract changed: '+a.ordinal);
  }
 }
 if(new Set(p.retained?.map(r=>r.legacyOrdinal)).size!==43||new Set(p.retained?.map(r=>r.isaRequirement)).size!==43)e.push('duplicate retained requirement');
 if(JSON.stringify(p.retired?.map(a=>[a.legacyOrdinal,a.legacyPath,a.required,a.legacyStepSha256,a.legacyPngSha256]))!==JSON.stringify(original.assertions.filter(a=>!a.required).map(a=>[a.ordinal,a.legacyPath,false,a.legacyStepSha256,a.legacyPngSha256])))e.push('four retirements changed');
 const packages=p.packages||[];
 if(packages.length!==10)e.push('ten finite packages required');
 const assigned=packages.flatMap(x=>x.gapOrdinals||[]),expected=gaps.map(a=>a.ordinal).sort((a,b)=>a-b);
 if(JSON.stringify([...assigned].sort((a,b)=>a-b))!==JSON.stringify(expected)||new Set(assigned).size!==32)e.push('each32 gap must have exactly one owner');
 for(const [i,pack] of packages.entries()){
  const id=`VPG-${String(i+1).padStart(2,'0')}`;
  if(pack.id!==id||pack.wave!==i+1||pack.status!=='proposed-not-admitted'||pack.executionAuthorized!==false||JSON.stringify(pack.dependsOn)!==JSON.stringify(i?[`VPG-${String(i).padStart(2,'0')}`]:[]))e.push('sequential dependency/authority changed: '+id);
  const owned=p.retained.filter(a=>a.ownerPlan===id).map(a=>a.isaRequirement);if(i===0)owned.push('FA-VPG-G01');if(i===9)owned.push('FA-VPG-G02');
  if(JSON.stringify([...owned].sort())!==JSON.stringify([...(pack.requirements||[])].sort())||pack.gapOrdinals.some(n=>!p.retained.some(a=>a.legacyOrdinal===n&&a.ownerPlan===id)))e.push('package requirement/row ownership changed: '+id);
 }
 const current=JSON.parse(git('docs/plans/assets/field-atlas-viewport-proof/manifest.json'));
 if(p.baselineCurrentCaptureCases?.length!==44||JSON.stringify(p.baselineCurrentCaptureCases)!==JSON.stringify(current.proofs.map(a=>({path:a.path,state:a.state,viewport:a.viewport,sha256:a.sha256}))))e.push('44 current proof cases changed');
 const added=p.retained.filter(a=>a.proposedNewCapture).map(a=>a.proposedNewCapture),supplement=p.supplementalCases||[],cases=[...(p.baselineCurrentCaptureCases||[]),...added,...supplement];
 if(cases.length!==80||new Set(cases.map(a=>a.path)).size!==80||supplement.length!==4||JSON.stringify(p.scope)!==JSON.stringify({retained:43,baselineQualified:11,remainingGaps:32,retiredGallery:4,originalHistory:47,plannedPackages:10,targetSourceCaptureCases:80,protectedExistingSourceCaptureCases:44,supplementalOriginalHeightCases:4,newGapCases:32,finalTargetQualified:43,finalTargetHeld:0}))e.push('finite80 case matrix changed');
 if(supplement.some(a=>a.viewport?.width!==430||a.viewport?.height!==844||a.preserveExisting430x932Frames!==true)||new Set(supplement.map(a=>a.state)).size!==4)e.push('supplemental original height coverage changed');
 for(const a of p.retained.filter(a=>a.proposedNewCapture))if(JSON.stringify(a.originalViewport)!==JSON.stringify(a.proposedNewCapture.viewport)||!validPath(a.proposedNewCapture.path))e.push('original gap viewport changed: '+a.legacyOrdinal);
 return e;
}
errors.push(...checkData(plan));
const isa=read('ISA.md').toString(),marker='## Viewport behavior gap proposal — 2026-11-04',end='<!-- cambium:viewport-gap-proposal:end -->',tail=isa.split(marker)[1],section=tail?.slice(0,tail.indexOf(end)+end.length);
if(!section)errors.push('proposed ISA section missing');
for(const id of ['FA-VPG-G01','FA-VPG-G02',...plan.retained.map(a=>a.isaRequirement)])if((section?.match(new RegExp('^- \\[ \\] '+id+':','gm'))||[]).length!==1)errors.push('ISA criterion must exist once and stay unchecked: '+id);
for(const pack of plan.packages){
 const p=join(dir,pack.planFile);if(!existsSync(p)){errors.push('missing plan '+pack.id);continue;}
 const text=readFileSync(p,'utf8'),fm=text.match(/^---\n([\s\S]*?)\n---/m)?.[1]||'';
 const scalar=k=>fm.match(new RegExp('^'+k+':\\s*(.+)$','m'))?.[1].trim();
 const list=k=>{try{return JSON.parse(scalar(k));}catch{return null;}};
 if(scalar('status')!=='proposed'||scalar('execution_authorized')!=='false'||scalar('autonomous')!=='false'||scalar('phase')!=='viewport-behavior-gaps-v1'||scalar('plan')!==pack.id||Number(scalar('wave'))!==pack.wave||JSON.stringify(list('depends_on'))!==JSON.stringify(pack.dependsOn)||JSON.stringify([...(list('requirements')||[])].sort())!==JSON.stringify([...pack.requirements].sort())||!list('files_modified')?.length)errors.push('GSD frontmatter mismatch '+pack.id);
 for(const tag of ['objective','tasks','verification','success_criteria','threat_model'])if(!text.includes('<'+tag+'>'))errors.push('missing '+tag+' '+pack.id);
 const tasks=[...text.matchAll(/<task\b[^>]*>[\s\S]*?<\/task>/g)].map(m=>m[0]);if(tasks.length<2||tasks.length>3)errors.push('plan needs2–3 bounded tasks '+pack.id);
 for(const [i,task]of tasks.entries()){if(!task.includes(`id="${pack.id}-T${i+1}"`))errors.push('unique ordered task ID missing '+pack.id);for(const tag of ['name','files','read_first','action','verify','acceptance_criteria','done'])if(!task.includes('<'+tag+'>'))errors.push('task missing '+tag+' '+pack.id);}
 if(/\/(?:Users|Volumes)\//.test(text))errors.push('machine path in plan '+pack.id);
}
for(const name of ['README.md','ROADMAP.md','VALIDATION.md','TRACEABILITY.md','PATTERNS.md','CONTEXT.md'])if(!existsSync(join(dir,name)))errors.push('missing packet '+name);
const proposalPath=join(dir,'PROPOSAL.json');
if(!existsSync(proposalPath))errors.push('proposal manifest missing');else{
 const proposal=json(proposalPath);if(proposal.acceptedPlanDigest!==null||proposal.executionAuthorized!==false||proposal.deploymentApproved!==false||proposal.trafficApproved!==false||proposal.planningBaseline!==95)errors.push('proposal receipt widened authority');
 for(const input of proposal.contentFiles||[])if(!validPath(input.path)||hash(read(input.path))!==input.sha256)errors.push('proposal content hash mismatch '+input.path);
 if(proposal.isaSectionSha256!==hash(Buffer.from(marker+section)))errors.push('proposal ISA section hash mismatch');
 if(proposal.contentDigest!==hash(JSON.stringify({files:proposal.contentFiles,isaSectionSha256:proposal.isaSectionSha256})))errors.push('proposal content digest mismatch');
}
const flags=process.argv.slice(2);if(flags.some(a=>!['--frozen-inputs','--negative-controls'].includes(a)))errors.push('unsupported validator option');
if(flags.includes('--frozen-inputs'))for(const input of plan.baselineInputs)if(!validPath(input.path)||hash(read(input.path))!==input.sha256)errors.push('frozen baseline drift '+input.path);
let rejected=0;
if(flags.includes('--negative-controls'))for(const mutate of [p=>p.retained.pop(),p=>p.retained[0].baselineStatus='qualified-local-browser',p=>p.retained[0].originalStepSha256='0'.repeat(64),p=>p.packages[1].gapOrdinals.pop(),p=>p.packages[1].dependsOn=['VPG-10'],p=>p.executionAuthorized=true,p=>p.deploymentApproved=true,p=>p.trafficApproved=true,p=>p.planningBaseline=93,p=>p.supplementalCases.pop()]){const copy=structuredClone(plan);mutate(copy);if(checkData(copy).length)rejected++;else errors.push('negative control accepted');}
console.log(JSON.stringify({schema:'cambium.viewport-gap-plan-validation.v1',ok:errors.length===0,retained:plan.retained.length,gapRows:plan.retained.filter(a=>a.proposedNewCapture).length,protectedRows:plan.retained.filter(a=>!a.proposedNewCapture).length,packages:plan.packages.length,targetSourceCases:80,negativeControlsRejected:rejected,planningBaseline:95,executionAuthorized:false,deploymentApproved:false,trafficApproved:false,failures:errors},null,2));
process.exitCode=errors.length?1:0;
