import {safeUrl} from './library-model.js';
import {buildHandoff,handoffUrl} from './handoff.js';
export function projectReviewRows(items,projects,feedback={}){
 const products=new Map(projects.map(p=>[p.id,p])),rows=[];
 for(const item of Object.values(items||{})){
  if(!safeUrl(item?.url))continue;
  const assessment=item.projectAssessment,proposals=['kimi-project-review.v1','kimi-project-review.v2'].includes(assessment?.version)?assessment.fits||[]:[];
  const ids=new Set([...proposals.map(f=>f.productId),...Object.values(feedback).filter(f=>f.itemId===item.id).map(f=>f.productId)]);
  for(const projectId of ids){const project=products.get(projectId);if(!project)continue;const fit=proposals.find(f=>f.productId===projectId),review=feedback[item.id+'|'+projectId];
   rows.push({key:item.id+'|'+projectId,itemId:item.id,projectId,title:item.title||item.url,url:item.url,source:item.source,coverage:item.contentCoverage||'Saved metadata',item,project,fit:fit||null,
    decision:review?.decision||null,reviewAt:review?.at||null,status:review?.decision==='fits'?'accepted':review?.decision==='not-now'?'rejected':'pending',assessmentFingerprint:assessment?.fingerprint||null,assessment:assessment||null});
  }
 }
 return rows.sort((a,b)=>(b.fit?.confidence==='supported')-(a.fit?.confidence==='supported')||a.title.localeCompare(b.title)||a.key.localeCompare(b.key));
}
export function validateReviewBatch(entries,items,projects,feedback={}){
 if(!Array.isArray(entries)||!entries.length||entries.length>100)throw Error('Select 1–100 project matches.');
 const ids=new Set(),products=new Set(projects.map(p=>p.id));
 for(const e of entries){const key=e.itemId+'|'+e.productId,item=items[e.itemId],old=feedback[key];
  if(ids.has(key)||!Object.hasOwn(items,e.itemId)||!safeUrl(item?.url)||!products.has(e.productId)||!['fits','not-now','clear'].includes(e.decision))throw Error('Invalid project review selection.');ids.add(key);
  if((old?.decision||null)!==(e.expectedDecision??null)||(old?.at||null)!==(e.expectedAt??null))throw Error('A selected decision changed elsewhere. Refresh the queue before applying.');
  if(e.assessmentFingerprint!==undefined&&item.projectAssessment?.fingerprint!==e.assessmentFingerprint)throw Error('A selected Kimi assessment changed. Refresh and inspect its new evidence.');
  if(e.assessmentFingerprint!==undefined&&e.decision!=='clear'&&!old&&!item.projectAssessment?.fits?.some(f=>f.productId===e.productId))throw Error('This project suggestion is no longer available.');
 }
 return entries;
}
export function buildProjectHandoff(rows,{agent,goal='',mode='Research and synthesize'}={}){
 if(!rows.length||rows.length>12||new Set(rows.map(r=>r.projectId)).size!==1)throw Error('Choose 1–12 references for one project per handoff.');
 const project=rows[0].project,clean=v=>String(v??'').replace(/[\r\n]+/g,' ').slice(0,2200);
 const base=buildHandoff(rows.map(r=>({...r.item,contentCoverage:r.assessment?.sourceEvidence?.coverage||r.item.contentCoverage})),{agent,goal,mode});
 const packet=[base,'','## Project context',`Project: ${clean(project.name)} (${clean(project.id)})`,`Repository: ${clean(project.repository||'Not recorded')}`,`Context excerpt: ${clean(project.summary)}`,`Project gate: ${clean(project.gate||'Not recorded')}`,'Authority: prepared reference packet; acceptance indicates relevance, not permission to execute or publish.','',...rows.flatMap(r=>[
  `### Evidence for ${clean(r.title)}`,`Library reference ID: ${clean(r.itemId)}`,`Your decision: ${r.status}`,`Kimi reviewed: ${clean(r.assessment?.reviewedAt||'No assessment')}`,
  `Context observed: ${clean(r.assessment?.contextObservedAt||'Not recorded')}`,`Assessment version: ${clean(r.assessment?.version||'Not recorded')}`,`Assessment fingerprint: ${clean(r.assessmentFingerprint||'Not recorded')}`,`Project context hash: ${clean(r.assessment?.contextHash||'Not recorded')}`,
  `Reference role: ${clean(r.fit?.fitType||'Not recorded')}`,`Preference examples: ${clean((r.fit?.preferenceBasis||[]).join(', ')||'None cited')}`,`Fit rationale: ${clean(r.fit?.reason||'User-reviewed connection; no current Kimi proposal')}`,`Save passage: ${clean(r.fit?.saveEvidence||'Not recorded')}`,`Project passage: ${clean(r.fit?.projectEvidence||'Not recorded')}`,`Proposed use: ${clean(r.fit?.proposedUse||'Not recorded')}`,`Uncertainty: ${clean(r.fit?.uncertainty||'No current Kimi evidence')}`,
  `Source provenance: ${handoffUrl(r.assessment?.sourceEvidence?.url||r.url)}`,`Source coverage: ${clean(r.assessment?.sourceEvidence?.coverage||r.coverage)}`,`Project evidence source: ${handoffUrl(r.assessment?.projectEvidenceSources?.[r.projectId]?.url||'')||'Field Report project-context snapshot'}`,''])].join('\n');
 if(JSON.stringify(packet).length>48000)throw Error('Packet exceeds the private sync limit; select fewer references.');
 return packet;
}

export function projectHandoffContext(rows){
 const p=rows[0]?.project;
 if(!p)throw Error('Select a project reference.');
 const context={authority:'proposal only',project:{id:p.id,name:p.name,repository:p.repository||null,summary:String(p.summary||'').slice(0,4000),gate:p.gate||null,observedAt:p.observedAt||null},references:rows.map(r=>({itemId:r.itemId,title:r.title,url:handoffUrl(r.url),source:r.source,notes:r.item.note||'',workingSet:r.item.collection||'',decision:r.status,assessmentVersion:r.assessment?.version||null,assessmentFingerprint:r.assessmentFingerprint,contextHash:r.assessment?.contextHash||null,contextObservedAt:r.assessment?.contextObservedAt||null,reviewedAt:r.assessment?.reviewedAt||null,fitType:r.fit?.fitType||null,preferenceBasis:r.fit?.preferenceBasis||[],rationale:r.fit?.reason||null,savePassage:r.fit?.saveEvidence||null,projectPassage:r.fit?.projectEvidence||null,proposedUse:r.fit?.proposedUse||null,uncertainty:r.fit?.uncertainty||null,sourceCoverage:r.assessment?.sourceEvidence?.coverage||r.coverage,sourceUrl:handoffUrl(r.assessment?.sourceEvidence?.url||r.url),projectEvidenceUrl:handoffUrl(r.assessment?.projectEvidenceSources?.[r.projectId]?.url||'')}))};
 if(JSON.stringify(context).length>48000)throw Error('Structured handoff exceeds the private sync limit; select fewer references.');
 return context;
}
