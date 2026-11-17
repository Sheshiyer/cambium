// Local, bounded reference-to-project suggestions. Never edits Field Report.
import {getLibrary} from './library.js';
import {safeUrl} from './library-model.js';
import {suggestedOrgan} from './organ-atlas.js';
export const MATCHING_VERSION='kimi-project-review.v2';

const STOP=new Set('the and for with from this that your into what when where have will tool tools saved reference candidate github https http www com org dev app docs source project labs repository only reviewed review possible potential could should would been being are has was were not its their our use used using based metadata content linked page claim claims material starting point inspect understand beyond existing current now new also such these those one all more than can may does each through without same other first latest dated observed observation evidence verified verification publication approval status summary'.split(' '));
const TERMS=value=>new Set(String(value||'').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(t=>!STOP.has(t))||[]);
const AFFINITY={
  taste:['brandmint','cambium','synchronocities'],
  will:['cambium','brandmint'],
  hands:['skill-clusters','agentfount','temperance','plexus','raycast'],
  cortex:['cambium','skill-clusters','antahkarana','why'],
  signals:[]
};
const organOf=item=>suggestedOrgan(item).organ;
const itemTerms=item=>TERMS([item.title,item.summary,item.potentialUse,item.category,(item.tags||[]).filter(t=>!t.startsWith('cambium:')).join(' '),new URL(item.url).pathname].join(' '));
const recordTerms=record=>TERMS([record.id,record.name,record.summary,record.repository].join(' '));
export function suggestProjectFits(item,context,feedback={},limit=3){
 if(!safeUrl(item?.url)||!Array.isArray(context?.products))return [];
 const assessment=item.projectAssessment;
 const fits=['kimi-project-review.v1','kimi-project-review.v2'].includes(assessment?.version)?assessment.fits||[]:[];
 const products=new Map(context.products.map(p=>[p.id,p]));
 const accepted=Object.values(feedback).filter(f=>f.itemId===item.id&&f.decision==='fits');
 const ids=[...new Set([...fits.map(f=>f.productId),...accepted.map(f=>f.productId)])];
 return ids.map(id=>{
  const p=products.get(id),f=fits.find(f=>f.productId===id),decision=feedback[item.id+'|'+id]?.decision;
  if(!p||decision==='not-now')return null;
  return {productId:id,name:p.name,brand:p.brand,score:decision==='fits'?10:f?.confidence==='supported'?4:2,
   decision:decision||null,confidence:decision==='fits'?'confirmed':'tentative',matchingVersion:assessment?.version||MATCHING_VERSION,
   reason:decision==='fits'?'Accepted by you'+(f?' · '+f.reason:''):f.reason+' · Possible use: '+f.proposedUse+' · Limits: '+f.uncertainty,
   evidence:f?{save:f.saveEvidence,project:f.projectEvidence,reviewedAt:assessment.reviewedAt,contextObservedAt:assessment.contextObservedAt}:null,
   href:context.site+'/details.html?record='+encodeURIComponent('product:'+id)+'&page=work'};
 }).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,limit);
}
export async function refreshProjectFitIndex(){
 const response=await fetch(chrome.runtime.getURL('field-report-projects.json'));
 if(!response.ok)throw Error('Field Report context snapshot unavailable');
 const {fieldReportContext}=await chrome.storage.local.get('fieldReportContext');const context=fieldReportContext||await response.json();
 if(context.schema!=='field-report-product-context.v1'||!Array.isArray(context.products)||context.products.length>30)throw Error('Invalid Field Report context');
 const lib=await getLibrary(),{fitFeedback={}}=await chrome.storage.local.get('fitFeedback');
 const items={};
 for(const item of Object.values(lib.items))if(safeUrl(item?.url))items[item.id]=suggestProjectFits(item,context,fitFeedback);
 const index={schema:'field-report-project-fit.v1',generatedAt:Date.now(),sourceCommit:context.sourceCommit,sourceObservedAt:context.observedAt,status:'proposal-only',itemCount:Object.keys(items).length,items};
 await chrome.storage.local.set({fitIndex:index});
 return index;
}
async function applyFitFeedback(itemId,productId,decision){
 if(!['fits','not-now','clear'].includes(decision))throw Error('Unknown fit response');
 const {fieldReportContext}=await chrome.storage.local.get('fieldReportContext');const context=fieldReportContext||await (await fetch(chrome.runtime.getURL('field-report-projects.json'))).json();
 if(!context.products?.some(product=>product.id===productId))throw Error('Unknown Field Report product');
 const lib=await getLibrary(),item=lib.items[itemId];
 if(!item)throw Error('Reference no longer available');
 const {fitFeedback={}}=await chrome.storage.local.get('fitFeedback');
 const key=itemId+'|'+productId;
 if(decision==='clear')delete fitFeedback[key];
 else fitFeedback[key]={itemId,productId,decision,tags:[...itemTerms(item)].slice(0,30),at:Date.now()};
 await chrome.storage.local.set({fitFeedback});
 return refreshProjectFitIndex();
}

export async function projectReviewQueue(){
 const {fieldReportContext,fitFeedback={},agentHandoffs={},libraryRemoved={}}=await chrome.storage.local.get(['fieldReportContext','fitFeedback','agentHandoffs','libraryRemoved']);
 const context=fieldReportContext||await(await fetch(chrome.runtime.getURL('field-report-projects.json'))).json();
 if(context.schema!=='field-report-product-context.v1'||!Array.isArray(context.products)||context.products.length>30)throw Error('Invalid project context.');
 const lib=await getLibrary(),items=Object.fromEntries(Object.entries(lib.items).filter(([id])=>!libraryRemoved[id]));return {serviceVersion:'0.6.2',suppressedCount:Object.keys(lib.items).length-Object.keys(items).length,projects:context.products,items,feedback:fitFeedback,handoffs:agentHandoffs,observedAt:context.observedAt};
}
async function applyBulkProjectReviews(entries){
 const {validateReviewBatch}=await import('./review-queue-model.js');
 const {projects,items,feedback}=await projectReviewQueue();validateReviewBatch(entries,items,projects,feedback);
 const now=Date.now(),undo=[];
 for(const e of entries){const key=e.itemId+'|'+e.productId,prior=feedback[key];undo.push({itemId:e.itemId,productId:e.productId,decision:prior?.decision||'clear',expectedDecision:e.decision==='clear'?null:e.decision,expectedAt:e.decision==='clear'?null:now});
  if(e.decision==='clear')delete feedback[key];else feedback[key]={itemId:e.itemId,productId:e.productId,decision:e.decision,tags:[...itemTerms(items[e.itemId])].slice(0,30),at:now,assessmentFingerprint:items[e.itemId].projectAssessment?.fingerprint||null};
 }
 await chrome.storage.local.set({fitFeedback:feedback});return {changed:entries.length,undo};
}
async function storeProjectHandoff(selection,options){
 const {projectReviewRows,buildProjectHandoff,projectHandoffContext}=await import('./review-queue-model.js');
 if(!Array.isArray(selection)||!selection.length||selection.length>12||new Set(selection.map(e=>e.key)).size!==selection.length)throw Error('Select 1–12 distinct references for one handoff.');
 if(options?.goal!==undefined&&typeof options.goal!=='string'||options?.mode!==undefined&&(typeof options.mode!=='string'||options.mode.length>200))throw Error('Invalid handoff task.');
 if(typeof options?.agent!=='string'||!options.agent.trim()||options.agent.length>100||String(options.goal||'').length>2000)throw Error('Choose an agent and a concise outcome.');
 if(options.handoffId&&!/^[a-f0-9-]{36}$/i.test(options.handoffId))throw Error('Invalid handoff operation ID.');
 const data=await projectReviewQueue(),id=options.handoffId||crypto.randomUUID();
 const requestSignature=JSON.stringify({selection,agent:options.agent,goal:options.goal||'',mode:options.mode||'Research and synthesize'});
 if(requestSignature.length>12000)throw Error('Invalid handoff selection.');
 if(data.handoffs[id]){if(data.handoffs[id].requestSignature!==requestSignature)throw Error('This handoff request already saved a different packet. Open Prepared handoffs or start a new handoff.');return data.handoffs[id];}
 const all=projectReviewRows(data.items,data.projects,data.feedback);
 const rows=selection.map(e=>{const row=all.find(r=>r.key===e.key);if(!row||row.assessmentFingerprint!==e.assessmentFingerprint||row.decision!==e.decision||row.reviewAt!==e.reviewAt)throw Error('The handoff selection changed; refresh and review it.');return row;});
 const packet=buildProjectHandoff(rows,options);
 if(options.previewPacket!==undefined&&packet!==options.previewPacket)throw Error('Packet context changed. Refresh the queue and inspect a new preview before saving.');
 const context=projectHandoffContext(rows);
 const handoff={context,authority:'proposal only',id,schema:'field-report-agent-handoff.v1',status:'prepared',projectId:rows[0].projectId,projectName:rows[0].project.name,agent:options.agent,goal:options.goal||'',mode:options.mode||'Research and synthesize',createdAt:Date.now(),itemIds:rows.map(r=>r.itemId),requestSignature,packet};
 await chrome.storage.local.set({agentHandoffs:{...data.handoffs,[id]:handoff}});return handoff;
}

const fitLock=(name,fn)=>globalThis.navigator?.locks?.request?globalThis.navigator.locks.request(name,fn):fn();
export const bulkProjectReviews=entries=>fitLock('field-report-fit-feedback',()=>applyBulkProjectReviews(entries));
export const prepareProjectHandoff=(selection,options)=>fitLock('field-report-agent-handoffs',()=>storeProjectHandoff(selection,options));

export const recordFitFeedback=(itemId,productId,decision)=>fitLock('field-report-fit-feedback',()=>applyFitFeedback(itemId,productId,decision));
