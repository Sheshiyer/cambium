import {createElement as h,useEffect,useState} from 'react'
export type DescriptionRow=Readonly<{id:string;name:string;description:string;lifecycle:string;date:string;confidence:string;relationships:readonly string[];sources:readonly string[]}>
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'))
const exact=(v:Record<string,unknown>,keys:string[])=>Reflect.ownKeys(v).length===keys.length&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&keys.includes(k))
const dense=(v:unknown):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>d&&Object.hasOwn(d,'value'))
const date=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s
const safe=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=800&&!/[<>\u0000-\u001f\u007f]|javascript:|data:/i.test(v)
export function descriptionRows(value:unknown):readonly DescriptionRow[]|null {
 try {
 if(!plain(value)||!exact(value,['schema','status','audience','authority','records'])||value.schema!=='cambium.descriptive-mapping.proposal.v1'||value.status!=='proposal-only'||value.audience!=='founder-private'||value.authority!=='display-only'||!dense(value.records)||!value.records.length||value.records.length>200)return null
 const seen=new Set<string>();const rows:DescriptionRow[]=[]
 for(const r of value.records){
 if(!plain(r)||!exact(r,['repositoryId','repositoryName','kind','workObjectId','relationships','lifecycle','description','sources','confidence','observedOn','runtimeVerification','actionability'])||r.kind!=='repository-reference'||r.workObjectId!==null||r.actionability!=='none'||r.runtimeVerification!=='not-established'||!safe(r.repositoryId)||seen.has(r.repositoryId)||!safe(r.repositoryName)||!safe(r.description)||!date(r.observedOn)||!plain(r.lifecycle)||!safe(r.lifecycle.value)||!safe(r.lifecycle.scope)||!dense(r.sources)||!r.sources.length)return null
 if(!safe(r.confidence)||!['direct-source','user-confirmed','reported','uncertain'].includes(String(r.confidence))||!dense(r.relationships)||r.relationships.length>8||r.sources.length>8)return null
 if(!exact(r.lifecycle,['value','scope','basis'])||!['active','paused','closed','completed','retired','archived','reusable-research','unknown'].includes(String(r.lifecycle.value))||!['repository-work','parent-product','client-engagement','unassigned'].includes(String(r.lifecycle.scope))||!['user-confirmed','reported','not-established'].includes(String(r.lifecycle.basis)))return null
 if(r.lifecycle.value==='unknown'&&(r.lifecycle.scope!=='unassigned'||r.lifecycle.basis!=='not-established'))return null
 if(r.lifecycle.value!=='unknown'&&r.lifecycle.basis==='not-established')return null
 const relationships:string[]=[]
 for(const x of r.relationships){if(!plain(x)||!exact(x,['targetWorkObjectId','relation','basis'])||!safe(x.targetWorkObjectId)||!safe(x.relation)||!['user-confirmed','source-supported','reported'].includes(String(x.basis))||!['component','historical-reference','asset-source','planned-integration','consolidation-target','ecosystem-mapping','separate-associated-project'].includes(String(x.relation)))return null;relationships.push(x.relation+' → '+x.targetWorkObjectId+' ('+x.basis+')')}
 if(new Set(relationships).size!==relationships.length)return null
 const sources:string[]=[]
 for(const s of r.sources){if(!plain(s)||!exact(s,['ref','sha256','locator','on','basis'])||!safe(s.ref)||!safe(s.locator)||!date(s.on)||!['user-confirmation','repository-metadata','source-inspection','third-party-report'].includes(String(s.basis))||typeof s.sha256!=='string'||!/^[a-f0-9]{64}$/.test(s.sha256))return null;sources.push(s.ref+' · '+s.locator+' · '+s.on+' · '+s.sha256)}
 if(new Set(sources).size!==sources.length)return null
 seen.add(r.repositoryId)
 rows.push(Object.freeze({id:r.repositoryId,name:r.repositoryName,description:r.description,lifecycle:r.lifecycle.value+' ('+r.lifecycle.scope+')',date:r.observedOn,confidence:r.confidence,relationships:Object.freeze(relationships),sources:Object.freeze(sources)}))
 }
 return Object.freeze(rows)
 } catch{return null}
}

export function DescriptiveMappingView({rows}:{rows:readonly DescriptionRow[]}) {
 return h('section',{'aria-label':'Founder descriptive repository references'},
 h('h2',null,'Repository mapping notes'),
 h('p',null,'Reference only. No action, admission, default or runtime acceptance is granted. Dated cohort; ecosystem coverage is incomplete.'),
 ...rows.map(r=>h('article',{key:r.id},h('h3',null,r.name),h('p',null,r.id),h('p',null,r.description),h('p',null,'Lifecycle: '+r.lifecycle+' · observed '+r.date),
 h('p',null,'Evidence qualification: '+r.confidence),h('p',null,r.relationships.length?r.relationships.join('; '):'Relationship not specified; no membership inferred.'),h('details',null,h('summary',null,'Source provenance'),...r.sources.map(s=>h('p',{key:s},s))))))
}
export function DescriptiveMappings(){
 const [rows,setRows]=useState<readonly DescriptionRow[]|null>(null)
 useEffect(()=>{const controller=new AbortController();fetch('/v1/admin/portfolio/descriptions',{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async response=>{if(response.status!==200)return null;return descriptionRows(await response.json())}).then(value=>{if(!controller.signal.aborted)setRows(value)}).catch(()=>{});return()=>controller.abort()},[])
 return rows?h(DescriptiveMappingView,{rows}):h('section',{'aria-label':'Descriptive repository reference status'},h('p',null,'Descriptive mapping evidence unavailable or access not verified. Existing actions and records are unchanged.'))
}
