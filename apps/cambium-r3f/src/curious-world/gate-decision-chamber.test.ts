import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionChamber, renderDecisionChamber, type DecisionChamberState } from './gate-decision-chamber.ts';
import type { GateRecordedDecision } from './gate-decision.ts';
import type { GatePath } from './gate-folio.ts';
const digest='a'.repeat(64),at='2026-10-25T11:04:51Z';
function recorded(decision:'approved'|'rejected'='approved',requested:GateRecordedDecision['requestedDecision']=decision):GateRecordedDecision {
 return {schema:'cambium.gate-recorded-decision.v1',canonicalReadback:true,receiptDigest:'b'.repeat(64),requestedDecision:requested,context:null,
  receipt:{proposalId:'cambium:'+digest,tenantId:'cambium',version:2,changeDigest:digest,nonce:'receipt-original',expiresAt:'2026-10-25T10:00:00Z',founderId:'founder:fixture',decision,decidedAt:at,channel:'curious'}};
}
const state=(record:GateRecordedDecision|null=recorded(),paths:GatePath[]=[]):DecisionChamberState=>({changeDigest:digest,record,paths,connection:'read',checking:false});
const path=(overrides:Partial<GatePath>={}):GatePath=>({changeDigest:digest,title:'Proof path',decision:'approved',decidedAt:at,reached:'receipt',placement:{landmarkId:'gate',districtId:'purpose'},...overrides});
test('receipt proves only decision without an exact independent path, including while disconnected',()=>{
 for(const connection of ['read','held','checking'] as const){const view=buildDecisionChamber({...state(),connection});assert.equal(view.confirmed,true);assert.deepEqual(view.stages.map(item=>item.observed),[true,false,false,false]);assert.equal(view.objective,'Objective not served in this receipt');}
});
test('stage evidence requires the same digest, actual outcome and decision time',()=>{
 for(const wrong of [path({changeDigest:'c'.repeat(64)}),path({decision:'rejected'}),path({decidedAt:'2026-10-25T11:04:52Z'})])assert.deepEqual(buildDecisionChamber(state(recorded(),[wrong])).stages.map(item=>item.observed),[true,false,false,false]);
 assert.deepEqual(buildDecisionChamber(state(recorded(),[path()])).stages.map(item=>item.observed),[true,true,true,true]);
 assert.deepEqual(buildDecisionChamber(state(recorded(),[path({reached:'directive-queued'})])).stages.map(item=>item.observed),[true,true,false,false]);
});
test('historical rejection has no invented request and opposite recorded outcome is explicit conflict',()=>{
 const history=buildDecisionChamber(state(recorded('rejected',null),[path({decision:'rejected'})]));assert.equal(history.conflict,false);assert.match(history.meaning,/No graph change requested/);assert.deepEqual(history.stages.map(item=>item.observed),[true,false,false,false]);
 const conflict=buildDecisionChamber(state(recorded('rejected','approved')));assert.equal(conflict.conflict,true);assert.match(conflict.meaning,/recorded decision is rejected/);assert.match(conflict.meaning,/requested approved decision was not recorded/);
});
test('unknown or malformed typed data receives no seal and no inferred mission or stage',()=>{
 for(const candidate of [null,{...recorded(),canonicalReadback:false},{...recorded(),receipt:{...recorded().receipt,changeDigest:'c'.repeat(64)}}]){
  const model=buildDecisionChamber(state(candidate as GateRecordedDecision|null,[path()]));assert.equal(model.confirmed,false);assert.ok(model.stages.every(stage=>!stage.observed));assert.match(model.meaning,/Do not submit again/);assert.equal(model.scope,null);
 }
});
test('projection title never substitutes for an unserved canonical objective',()=>{
 const r=recorded();r.context={changeDigest:digest,nodeId:'goal',approvalExpiresAt:r.receipt.expiresAt,title:'Unverified projection objective',canonicalReview:JSON.stringify({proposalId:r.receipt.proposalId,version:r.receipt.version,changeDigest:digest,nonce:r.receipt.nonce,expiresAt:r.receipt.expiresAt,review:{nodeId:'goal',tenantId:'cambium'}})} as GateRecordedDecision['context'];
 assert.equal(buildDecisionChamber(state(r)).objective,'Objective not served in this receipt');
});
class Node {
 className='';textContent='';dataset:Record<string,string>={};attributes:Record<string,string>={};children:Node[]=[];listeners:Record<string,()=>void>={};open=false;disabled=false;type='';id='';
 readonly tag:string;constructor(tag:string){this.tag=tag;}
 append(...nodes:Node[]){this.children.push(...nodes);}setAttribute(key:string,value:string){this.attributes[key]=value;}addEventListener(name:string,handler:()=>void){this.listeners[name]=handler;}
 all():Node[]{return [this,...this.children.flatMap(node=>node.all())];}
}
const document={createElement:(tag:string)=>new Node(tag)} as unknown as Document;
test('rendered recorded chamber offers trace, return and journal, exposes full receipt, and never offers another decision',()=>{
 let returned=0,journal=0,checks=0;
 for(const actual of ['approved','rejected'] as const){
  const root=renderDecisionChamber(document,{...state(recorded(actual)),connection:'held'},{checkStatus(){checks++;},returnWorld(){returned++;},openJournal(){journal++;}}) as unknown as Node;
  const nodes=root.all(),buttons=nodes.filter(node=>node.tag==='button');
  assert.equal(root.dataset.confirmed,'true');assert.deepEqual(buttons.map(node=>node.textContent),['Trace decision','Return to world','Decision journal']);
  assert.ok(nodes.some(node=>node.textContent.includes('recorded decision is retained')));
  const raw=nodes.filter(node=>node.tag==='pre').map(node=>node.textContent).join('');assert.ok(raw.includes('receipt-original'));assert.ok(raw.includes('founder:fixture'));
  buttons[0].listeners.click();assert.equal(nodes.find(node=>node.id==='cw-decision-trace')!.open,true);assert.equal(buttons[0].attributes['aria-expanded'],'true');
  buttons[1].listeners.click();buttons[2].listeners.click();
 }
 assert.equal(returned,2);assert.equal(journal,2);assert.equal(checks,0);
});
test('unknown chamber has only an explicit original-status read and no retry or signing control',()=>{
 let checked=0;const root=renderDecisionChamber(document,state(null),{checkStatus(){checked++;},returnWorld(){},openJournal(){}}) as unknown as Node;
 const nodes=root.all(),buttons=nodes.filter(node=>node.tag==='button');assert.equal(root.dataset.confirmed,'false');assert.equal(buttons[0].textContent,'Check original status');buttons[0].listeners.click();assert.equal(checked,1);
 assert.ok(!buttons.some(node=>/approve|reject|renew|resubmit/i.test(node.textContent)));
 const checking=renderDecisionChamber(document,{...state(null),checking:true},{checkStatus(){checked++;},returnWorld(){},openJournal(){}}) as unknown as Node;
 assert.equal(checking.all().find(node=>node.tag==='button')!.disabled,true);
});

test('successful pending status stays unconfirmed with a verified connection and status-only controls',()=>{
 let checks=0;const root=renderDecisionChamber(document,{...state(null),connection:'read',statusMessage:'Canonical status read is pending. No recorded decision is available yet; keep checking the original status.'},{checkStatus(){checks++;},returnWorld(){},openJournal(){}}) as unknown as Node;
 const nodes=root.all(),connection=nodes.find(node=>node.className==='cw-chamber-connection')!;
 assert.equal(root.dataset.confirmed,'false');assert.equal(connection.dataset.connection,'read');
 assert.match(connection.textContent,/projection verified.*decision remains unconfirmed/);
 assert.ok(!nodes.some(node=>/connection unavailable|review again before deciding/i.test(node.textContent)));
 assert.ok(nodes.some(node=>node.textContent.includes('Canonical status read is pending')));
 const buttons=nodes.filter(node=>node.tag==='button');assert.equal(buttons[0].textContent,'Check original status');buttons[0].listeners.click();assert.equal(checks,1);
 assert.ok(!buttons.some(node=>/approve|reject|renew|resubmit/i.test(node.textContent)));
 assert.ok(nodes.filter(node=>node.tag==='li' && 'observed' in node.dataset).every(node=>node.dataset.observed==='false'));
});
