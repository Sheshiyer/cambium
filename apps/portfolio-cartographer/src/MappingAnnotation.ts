import {createElement as h,useEffect,useState} from 'react';
type Note=Readonly<{workId:string;label:string;description:string;relation:string;relatedWorkIds:readonly string[];repositoryIds:readonly string[];sourceRefs:readonly string[];caveat:string}>;
const keys=['workId','label','description','relation','relatedWorkIds','repositoryIds','sourceRefs','caveat'];
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=1200&&!/[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]|javascript:|data:/i.test(v);
function plain(v:unknown):v is Record<string,unknown>{return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));}
function dense(v:unknown):v is unknown[]{return Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>d&&Object.hasOwn(d,'value'));}
export function annotationDTOs(v:unknown):readonly Note[]|null{
 try{
 if(!plain(v)||Reflect.ownKeys(v).length!==2||v.schema!=='cambium.mapping-annotation-dtos.v1'||!dense(v.notes)||v.notes.length!==4)return null;
 const result:Note[]=[];const seen=new Set<string>();
 for(const n of v.notes){
 if(!plain(n)||Reflect.ownKeys(n).length!==keys.length||!Reflect.ownKeys(n).every(k=>typeof k==='string'&&keys.includes(k))||!text(n.workId)||seen.has(n.workId)||!text(n.label)||!text(n.description)||!text(n.relation)||!text(n.caveat))return null;
 const arrays:Record<string,readonly string[]>={};
 for(const key of ['relatedWorkIds','repositoryIds','sourceRefs']){const a=n[key];if(!dense(a)||!a.length||a.length>8||!a.every(text)||new Set(a).size!==a.length)return null;arrays[key]=Object.freeze([...a] as string[]);}
 seen.add(n.workId);result.push(Object.freeze({workId:n.workId,label:n.label,description:n.description,relation:n.relation,caveat:n.caveat,relatedWorkIds:arrays.relatedWorkIds,repositoryIds:arrays.repositoryIds,sourceRefs:arrays.sourceRefs}));
 }
 return Object.freeze(result);
 }catch{return null;}
}
export function MappingAnnotationView({note}:{note:Note|null}){
 if(!note)return null;
 return h('section',{className:'drawer-section','aria-label':'Descriptive mapping annotation'},h('h3',null,note.label),h('p',null,note.description),h('p',null,note.caveat),h('p',null,'Related records: '+note.relatedWorkIds.join(', ')),h('p',null,'Repository identities: '+note.repositoryIds.join(', ')));
}
export function MappingAnnotation({workId}:{workId:string}){
 const [notes,setNotes]=useState<readonly Note[]|null>(null);
 useEffect(()=>{const controller=new AbortController();fetch('/v1/admin/portfolio/annotations',{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async r=>r.status===200?annotationDTOs(await r.json()):null).then(v=>{if(!controller.signal.aborted)setNotes(v)}).catch(()=>{});return()=>controller.abort();},[]);
 return h(MappingAnnotationView,{note:notes?.find(n=>n.workId===workId)??null});
}
