import { normalizeGateDecision, type GateRecordedDecision } from './gate-decision.ts';
import { buildMissionDossier } from './mission-dossier.ts';
import type { GatePath } from './gate-folio.ts';
import { GATE_CHAMBER_ASSETS } from './chamber-assets.ts';

export interface DecisionChamberState {
  changeDigest:string; record:GateRecordedDecision|null; paths:readonly GatePath[];
  connection:'read'|'checking'|'held'; checking:boolean; statusMessage?:string;
}
export interface DecisionChamberModel {
  record:GateRecordedDecision|null; confirmed:boolean; conflict:boolean; title:string; outcome:string;
  meaning:string; objective:string; scope:string|null; branch:string|null; phase:string|null; organ:string|null;
  stages:Array<{name:string;observed:boolean;note:string}>;
}
/** A receipt proves a decision. Later stages require its exact independent path. */
export function buildDecisionChamber(state:DecisionChamberState):DecisionChamberModel {
  const candidate=normalizeGateDecision(state.record);
  const record=candidate?.receipt.changeDigest===state.changeDigest ? candidate : null;
  const receipt=record?.receipt;
  const context=record?.context ? buildMissionDossier(record.context) : null;
  const conflict=!!record && record.requestedDecision!==null && record.requestedDecision!==receipt?.decision;
  const path=receipt ? state.paths.find(item=>item.changeDigest===receipt.changeDigest && item.decision===receipt.decision && item.decidedAt===receipt.decidedAt) : null;
  const order=['committed','directive-queued','runner-claimed','receipt','learning'];
  const reached=path && receipt?.decision==='approved' ? order.indexOf(path.reached ?? '') : -1;
  const approved=receipt?.decision==='approved';
  return {record,confirmed:!!record,conflict,title:record?'Decision recorded.':'Decision not confirmed.',
    outcome:receipt ? (conflict?'Existing ':'') + (approved?'approval':'rejection') + ' recorded' : 'Original status required',
    meaning:!receipt ? 'Check the original decision status. Do not submit again.'
      : conflict ? 'The recorded decision is ' + receipt.decision + '. Your requested ' + record!.requestedDecision + ' decision was not recorded.'
        : approved ? 'Approval is recorded. Execution needs its own evidence.' : 'Rejection is recorded. No graph change requested.',
    objective:context?.verified && context.desiredState ? context.desiredState : 'Objective not served in this receipt',
    scope:context?.scope ?? null,branch:context?.branch ?? null,phase:context?.phase ?? null,organ:context?.organ ?? null,
    stages:[{name:'Decision',observed:!!receipt,note:receipt ? receipt.decision==='approved'?'Approval recorded':'Rejection recorded':'Not confirmed'},
      {name:'Graph',observed:reached>=0,note:receipt?.decision==='rejected'?'No change requested':reached>=0?'Commit observed':'Not observed'},
      {name:'Execution',observed:reached>=2,note:reached>=2?'Runner claim observed':'Not observed'},
      {name:'Evidence',observed:reached>=3,note:reached>=3?'Receipt stage observed':'Not observed'}]};
}
export function renderDecisionChamber(document:Document,state:DecisionChamberState,actions:{checkStatus():void;returnWorld():void;openJournal():void}):HTMLElement {
  const model=buildDecisionChamber(state);
  function el<K extends keyof HTMLElementTagNameMap>(tag:K,className:string,text?:string):HTMLElementTagNameMap[K]{const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function control(text:string,action:()=>void,className=''):HTMLButtonElement{const node=el('button','cw-chamber-action '+className,text);node.type='button';node.addEventListener('click',action);return node;}
  const root=el('section','cw-decision-chamber');root.setAttribute('aria-label','Founder Gate decision chamber');root.dataset.confirmed=String(model.confirmed);root.dataset.conflict=String(model.conflict);
  const top=el('header','cw-chamber-top');top.append(el('span','','CAMBIUM / GATE / DECISION ARCHIVE'),el('span','',model.confirmed?'CANONICAL RECORD':'STATUS REQUIRED'));root.append(top);
  const scene=el('div','cw-chamber-scene');
  const artifact=el('figure','cw-chamber-artifact');
  const dial=el('img','cw-chamber-dial');dial.src=GATE_CHAMBER_ASSETS.controlDial;dial.alt='Gate control dial · source-derived decision apparatus';dial.width=420;dial.height=420;
  const seal=el('div','cw-chamber-seal',model.confirmed ? model.record!.receipt.decision==='approved'?'✓':'×' : '?');seal.setAttribute('aria-hidden','true');
  artifact.append(dial,seal,el('figcaption','',model.confirmed?'DECISION SEAL / RECORD RETAINED':'UNSEALED / STATUS REQUIRED'));scene.append(artifact);
  const brief=el('div','cw-chamber-brief');brief.append(el('p','cw-chamber-outcome',model.outcome),el('h3','cw-chamber-title',model.title),el('p','cw-chamber-objective',model.objective),el('p','cw-chamber-meaning',model.meaning));
  if(model.record){const r=model.record.receipt;const handle=el('div','cw-chamber-handle');const packet=el('img','');packet.src=GATE_CHAMBER_ASSETS.signalPacket;packet.alt='';packet.width=48;packet.height=48;const identity=el('div','');identity.append(el('span','',model.record.receiptDigest.slice(0,16)+'…'));const time=el('time','',new Date(r.decidedAt).toISOString().replace('T',' · ').replace('.000Z',' UTC'));time.dateTime=r.decidedAt;identity.append(time);handle.append(packet,identity);brief.append(handle);}
  const context=el('dl','cw-chamber-context');for(const [label,value] of [['Goal scale',model.scope],['Branch',model.branch],['Phase',model.phase],['Organ',model.organ]]){const item=el('div','');item.append(el('dt','',label!),el('dd','',value || 'Not served'));context.append(item);}brief.append(context);
  const buttons=el('div','cw-chamber-actions');
  if(!model.confirmed){const check=control(state.checking?'Checking original status…':'Check original status',actions.checkStatus);check.disabled=state.checking;check.dataset.chamberFocus='true';buttons.append(check);}
  const trace=control('Trace decision',()=>{details.open=!details.open;trace.setAttribute('aria-expanded',String(details.open));},'cw-chamber-secondary');trace.setAttribute('aria-expanded','false');trace.setAttribute('aria-controls','cw-decision-trace');
  const leave=control('Return to world',actions.returnWorld,'cw-chamber-secondary');if(model.confirmed)leave.dataset.chamberFocus='true';buttons.append(trace,leave,control('Decision journal',actions.openJournal,'cw-chamber-secondary'));brief.append(buttons);
  const connection=el('p','cw-chamber-connection',state.connection==='held' ? 'Live Gate connection unavailable · '+(model.confirmed?'this recorded decision is retained.':'the decision remains unconfirmed.') : state.connection==='checking' ? 'Checking the Gate projection · '+(model.confirmed?'this recorded decision is retained.':'original status is required.') : model.confirmed ? 'Last Gate projection verified · later execution still needs independent evidence.' : 'Last Gate projection verified · decision remains unconfirmed. Check original status; do not submit again.');connection.dataset.connection=state.connection;brief.append(connection);
  if(state.statusMessage){const status=el('p','cw-chamber-status',state.statusMessage);status.setAttribute('role','status');brief.append(status);}scene.append(brief);root.append(scene);
  const rail=el('ol','cw-chamber-rail');rail.setAttribute('aria-label','Independently observed decision path');for(const stage of model.stages){const item=el('li','');item.dataset.observed=String(stage.observed);item.append(el('strong','',stage.name),el('span','',stage.note));rail.append(item);}root.append(rail);
  const details=el('details','cw-chamber-disclosure');details.id='cw-decision-trace';details.dataset.cwDisclosure='trace:'+state.changeDigest;details.append(el('summary','','Trace observed stages'));
  details.addEventListener('toggle',()=>trace.setAttribute('aria-expanded',String(details.open)));
  const path=el('ol','cw-chamber-trace');for(const stage of model.stages){const item=el('li','');item.append(el('strong','',stage.observed?'Observed':'Not observed'),el('span','',stage.name+' · '+stage.note));path.append(item);}details.append(path,el('p','cw-chamber-footnote','Only a matching change digest, recorded decision and decision time can connect this receipt to a served path. Unmarked stages are not execution or delivery proof.'));root.append(details);
  const raw=el('details','cw-chamber-disclosure');raw.dataset.cwDisclosure='record:'+state.changeDigest;raw.append(el('summary','',model.confirmed?'Inspect immutable record':'Inspect unconfirmed status'));raw.append(el('pre','',JSON.stringify(model.record ? {schema:model.record.schema,canonicalReadback:true,receiptDigest:model.record.receiptDigest,requestedDecision:model.record.requestedDecision,receipt:model.record.receipt} : {changeDigest:state.changeDigest,status:'unconfirmed',receipt:null,nextAction:'Read original status; do not resubmit'},null,2)));root.append(raw);
  if(model.record?.context?.canonicalReview){const review=el('details','cw-chamber-disclosure');review.dataset.cwDisclosure='canonical:'+state.changeDigest;review.append(el('summary','','Complete reviewed proposal & source lineage'),el('pre','',model.record.context.canonicalReview));root.append(review);}
  return root;
}
