import { DESCRIPTION_PINS } from './portfolio-descriptions.data.ts';
const pin: {repositories:Record<string,string>;workObjects:readonly string[];memberships:Record<string,string[]>;sources:Record<string,string>} = DESCRIPTION_PINS;
const own=(v: any,keys: string[])=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&Reflect.ownKeys(v).every((k: any)=>typeof k==='string'&&keys.includes(k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const dense=(a: any)=>Array.isArray(a)&&Object.getPrototypeOf(a)===Array.prototype&&Reflect.ownKeys(a).length===a.length+1&&Array.from({length:a.length},(_,i)=>Object.getOwnPropertyDescriptor(a,String(i))).every((d: any)=>d&&Object.hasOwn(d,'value'));
const text=(s: any)=>typeof s==='string'&&s.length>0&&s.length<=800&&!/[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]|javascript:|data:|https?:|file:|\/Users\/|\/Volumes\//i.test(s);
const date=(s: any)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const unique=(a: any[])=>new Set(a).size===a.length;
export function validate(v: any): boolean{
 try {
 if(!own(v,['schema','status','audience','authority','records'])||v.schema!=='cambium.descriptive-mapping.proposal.v1'||v.status!=='proposal-only'||v.audience!=='founder-private'||v.authority!=='display-only'||!dense(v.records)||!v.records.length||v.records.length>200)return false;
 const seen=new Set();
 for(const r of v.records){
 if(!own(r,['repositoryId','repositoryName','kind','workObjectId','relationships','lifecycle','description','sources','confidence','observedOn','runtimeVerification','actionability'])||!Object.hasOwn(pin.repositories,r.repositoryId)||r.repositoryName!==pin.repositories[r.repositoryId]||seen.has(r.repositoryId))return false;
 seen.add(r.repositoryId);
 if(!['repository-reference','existing-workobject-note'].includes(r.kind)||r.actionability!=='none'||r.runtimeVerification!=='not-established'||!text(r.description)||!date(r.observedOn)||!['direct-source','user-confirmed','reported','uncertain'].includes(r.confidence))return false;
 if(r.kind==='repository-reference'&&r.workObjectId!==null)return false;
 if(r.kind==='existing-workobject-note'&&(!pin.workObjects.includes(r.workObjectId)||!pin.memberships[r.repositoryId]?.includes(r.workObjectId)))return false;
 if(!dense(r.relationships)||r.relationships.length>8)return false;
 const relKeys=[];
 for(const x of r.relationships){
 if(!own(x,['targetWorkObjectId','relation','basis'])||!pin.workObjects.includes(x.targetWorkObjectId)||!['component','historical-reference','asset-source','planned-integration','consolidation-target','ecosystem-mapping','separate-associated-project'].includes(x.relation)||!['user-confirmed','source-supported','reported'].includes(x.basis))return false;
 relKeys.push(x.targetWorkObjectId+':'+x.relation);
 }
 if(!unique(relKeys))return false;
 if(!own(r.lifecycle,['value','scope','basis'])||!['active','paused','closed','completed','retired','archived','reusable-research','unknown'].includes(r.lifecycle.value)||!['repository-work','parent-product','client-engagement','unassigned'].includes(r.lifecycle.scope)||!['user-confirmed','reported','not-established'].includes(r.lifecycle.basis))return false;
 if(r.lifecycle.value==='unknown'&&(r.lifecycle.scope!=='unassigned'||r.lifecycle.basis!=='not-established'))return false;
 if(r.lifecycle.value!=='unknown'&&r.lifecycle.basis==='not-established')return false;
 if(!dense(r.sources)||!r.sources.length||r.sources.length>8)return false;
 const sourceKeys=[];
 for(const s of r.sources){
 if(!own(s,['ref','sha256','locator','on','basis'])||!Object.hasOwn(pin.sources,s.ref)||s.sha256!==pin.sources[s.ref]||!text(s.locator)||!date(s.on)||!['user-confirmation','repository-metadata','source-inspection','third-party-report'].includes(s.basis))return false;
 sourceKeys.push(s.ref+':'+s.locator);
 }
 if(!unique(sourceKeys))return false;
 }
 return true;
 }catch{return false;}
}

export function descriptionResponse(value: unknown): string | null {
 if (!validate(value)) return null;
 // JSON roundtrip returns only validated, plain data. No transport/action object reuse.
 return JSON.stringify(value);
}
