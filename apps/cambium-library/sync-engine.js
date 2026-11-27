import {SCHEMA,recordsFromStorage,storageFromRecords,diffRecord,equal} from './sync-model.js';
export async function database(name='field-report-library-v1'){
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const tx=(mode,fn)=>new Promise((resolve,reject)=>{const t=db.transaction('state',mode),r=fn(t.objectStore('state'));let value;r.onsuccess=()=>value=r.result;t.oncomplete=()=>resolve(value);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});
 return{get:key=>tx('readonly',s=>s.get(key)),set:(key,value)=>tx('readwrite',s=>s.put(value,key))};
}
export async function createSyncEngine(storage,onStatus=()=>{},dbName='field-report-library-v1'){
 const db=await database(dbName),state=await db.get('sync')||{records:{},observed:{},pending:[],conflicts:{},cursor:0,lastSync:null};let queue=Promise.resolve(),applying=false;
 const serial=fn=>{const run=async()=>{const execute=async()=>{const fresh=await db.get('sync');if(fresh)Object.assign(state,fresh);return fn();};return globalThis.navigator?.locks?.request?globalThis.navigator.locks.request('field-report-sync:'+dbName,execute):execute();};const p=queue.then(run,run);queue=p.catch(()=>{});return p;};
 const status=()=>({pending:state.pending.length,conflicts:state.conflicts,lastSync:state.lastSync,error:state.error||null,count:Object.keys(state.observed).filter(k=>JSON.parse(k)[0]==='items').length});
 const persist=async()=>{await db.set('sync',state);onStatus(status());};
 async function capture(){
 const data=await storage.get(null),now=recordsFromStorage(data);
 if(!await db.get('migration-backup'))await db.set('migration-backup',{at:Date.now(),data:structuredClone(now)});
 for(const key of new Set([...Object.keys(state.observed),...Object.keys(now)])){
 const before=state.observed[key]||{},after=now[key]?{...now[key]}:{_absent:true};if(now[key])after._absent=null;
 const prior={...before,_absent:state.observed[key]?null:true};const {patch,base}=diffRecord(prior,after,state.records[key]?.fields);
 if(!Object.keys(patch).length)continue;
 const pending=state.pending.find(p=>p.key===key&&!p.sent);
 if(pending){Object.assign(pending.patch,patch);for(const k of Object.keys(patch))if(!(k in pending.base))pending.base[k]=base[k];}
 else state.pending.push({id:crypto.randomUUID(),key,patch,base});
 }
 state.observed=now;await persist();
 }
 function materialize(){const records=structuredClone(state.records);
 for(const op of state.pending){const r=records[op.key]||={key:op.key,data:{},fields:{},revision:0};for(const[k,v]of Object.entries(op.patch))if(v===null)delete r.data[k];else r.data[k]=v;}
 for(const c of Object.values(state.conflicts)){const r=records[c.key]||={key:c.key,data:{},fields:{},revision:0};for(const[k,v]of Object.entries(c.fields))if(v.local===null)delete r.data[k];else r.data[k]=v.local;}
 return records;
 }
 async function applyStorage(){const records=materialize();for(const r of Object.values(records))r.deleted=!!r.data._absent;const values=storageFromRecords(records);for(const items of Object.values(values))if(items&&typeof items==='object'&&!Array.isArray(items))for(const item of Object.values(items))if(item&&typeof item==='object')delete item._absent;
 applying=true;try{await storage.set(values);state.observed=recordsFromStorage(await storage.get(null));}finally{applying=false;}}
 async function sync(send){return serial(async()=>{await capture();try{
 if(!state.bootstrapComplete){
  let bootstrapMore=true;while(bootstrapMore){const page=await send({schema:SCHEMA,cursor:state.cursor,operations:[]});if(page.schema!==SCHEMA)throw Error('Unexpected sync response');if(page.context)await storage.set({fieldReportContext:page.context});for(const c of page.changes)state.records[c.record.key]=c.record;state.cursor=page.cursor;bootstrapMore=page.hasMore;}
  const backup=(await db.get('migration-backup'))?.data||{};
  for(const op of state.pending)for(const field of Object.keys(op.patch)){const remote=state.records[op.key];if(remote&&(op.base[field]||0)===0&&(equal(remote.data[field],backup[op.key]?.[field])||equal(remote.data[field],op.patch[field])))op.base[field]=remote.fields[field]||0;}
  state.bootstrapComplete=true;await persist();
 }
 let more=true,rounds=0;
 while(more&&rounds++<250){
 const batch=state.pending.slice(0,10);for(const p of batch)p.sent=true;await persist();
 const operations=batch.map(({sent,...op})=>op),answer=await send({schema:SCHEMA,cursor:state.cursor,operations});
 if(answer?.schema!==SCHEMA||!Array.isArray(answer.receipts)||!Array.isArray(answer.changes))throw Error('Unexpected sync response');
 if(answer.context)await storage.set({fieldReportContext:answer.context});
 // Capture edits made while awaiting the server before applying its result.
 await capture();
 for(const receipt of answer.receipts){const op=state.pending.find(p=>p.id===receipt.id);if(!op)continue;
 if(Object.keys(receipt.conflicts||{}).length)state.conflicts[receipt.id]={id:receipt.id,key:op.key,fields:receipt.conflicts,at:Date.now()};
 state.pending=state.pending.filter(p=>p.id!==receipt.id);
 if((state.records[op.key]?.revision||0)<=receipt.record.revision)state.records[op.key]=receipt.record;
 // Later local edits to acknowledged fields are causally newer, not competing edits.
 for(const p of state.pending.filter(p=>p.key===op.key&&!p.sent))for(const k of Object.keys(p.patch))if(k in op.patch&&!receipt.conflicts?.[k])p.base[k]=receipt.record.fields[k]||0;
 }
 for(const change of answer.changes)if((state.records[change.record.key]?.revision||0)<=change.record.revision)state.records[change.record.key]=change.record;
 state.cursor=answer.cursor;await applyStorage();await persist();more=answer.hasMore||state.pending.length>0;
 }
 state.lastSync=Date.now();state.error=null;await persist();return status();
 }catch(e){state.error=e.message;await persist();throw e;}});}
 return{sync,status,capture:()=>applying?Promise.resolve():serial(capture),backup:()=>db.get('migration-backup'),resolve:(id,choice)=>serial(async()=>{
 const c=state.conflicts[id];if(!c)throw Error('Conflict already resolved');if(!['local','remote'].includes(choice))throw Error('Unknown resolution');
 const patch={},base={};for(const[k,v]of Object.entries(c.fields)){patch[k]=choice==='local'?v.local:(state.records[c.key]?.data[k]??null);base[k]=state.records[c.key]?.fields[k]||0;}
 await db.set('resolved:'+id,{...c,choice,resolvedAt:Date.now()});delete state.conflicts[id];state.pending.push({id:crypto.randomUUID(),key:c.key,patch,base});await applyStorage();await persist();return status();})};
}
