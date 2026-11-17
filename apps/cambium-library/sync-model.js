export const SCHEMA='field-report-library-sync.v1';
export const MAPS=['items','organPlacements','fitFeedback','libraryRemoved','bookmarkBindings','agentHandoffs'];
export const META=['fieldTheoryImport','personalCollection','sharedReferenceImport','libraryTheme','libraryExperience','quietMode'];
export const equal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
export const keyFor=(namespace,id)=>JSON.stringify([namespace,id]);
export function recordsFromStorage(s){
 const out={};
 for(const ns of MAPS)for(const [id,value] of Object.entries(s[ns]||{}))out[keyFor(ns,id)]=value&&typeof value==='object'&&!Array.isArray(value)?value:{value};
 for(const e of s.libraryTrash||[])out[keyFor('libraryTrash',e.item.id)]=e;
 for(const k of META)if(k in s)out[keyFor('meta',k)]={value:s[k]};
 return out;
}
export function storageFromRecords(records){
 const out=Object.fromEntries(MAPS.map(k=>[k,{}]));out.libraryTrash=[];
 for(const [key,record] of Object.entries(records)){if(record.deleted||record.data?._absent)continue;const [ns,id]=JSON.parse(key),v=record.data;
 if(MAPS.includes(ns))out[ns][id]=ns==='libraryRemoved'?v.value:v;
 else if(ns==='libraryTrash')out.libraryTrash.push(v);
 else if(ns==='meta'&&META.includes(id))out[id]=v.value;
 }out.libraryTrash.sort((a,b)=>b.removedAt-a.removedAt);return out;
}
export function diffRecord(before={},after={},revisions={}){const patch={},base={};for(const k of new Set([...Object.keys(before),...Object.keys(after)]))if(!equal(before[k],after[k])){patch[k]=after[k]??null;base[k]=revisions[k]||0;}return{patch,base};}
export function mergeOperation(record,op){
 const data={...(record?.data||{})},fields={...(record?.fields||{})},revision=(record?.revision||0)+1,conflicts={};
 for(const [key,value]of Object.entries(op.patch)){
 if((fields[key]||0)!==(op.base[key]||0)&&!equal(data[key],value)){conflicts[key]={local:value,remote:data[key]??null,revision:fields[key]||0};continue;}
 if(!equal(data[key],value)){if(value===null)delete data[key];else data[key]=value;fields[key]=revision;}
 }if(op.patch._absent===true&&Object.keys(conflicts).length){data._absent=record?.data?._absent;fields._absent=record?.fields?._absent||0;conflicts._absent={local:true,remote:record?.data?._absent??null,revision:fields._absent};}
 if(record?.data?._absent&&op.patch._absent!==true&&Object.keys(op.patch).some(k=>k!=='_absent'))conflicts._absent={local:null,remote:true,revision:record.fields._absent||0};
 return{record:{key:op.key,data,fields,revision},conflicts};
}
export function validateOperation(op){
 if(!op||typeof op.id!=='string'||op.id.length>180||!op.id||typeof op.key!=='string'||op.key.length>400)throw Error('Invalid operation');
 const [ns,id]=JSON.parse(op.key);if(![...MAPS,'libraryTrash','meta'].includes(ns)||typeof id!=='string'||!id||id.length>220)throw Error('Unknown record');
 if(ns==='meta'&&!META.includes(id))throw Error('Unknown preference');
 if(!op.patch||Array.isArray(op.patch)||typeof op.patch!=='object'||Object.keys(op.patch).length>80)throw Error('Invalid fields');
 for(const [k,v]of Object.entries(op.patch)){if(['__proto__','constructor','prototype'].includes(k)||/api.?key|token|secret|password/i.test(k)||k.length>100)throw Error('Forbidden field');if(!Number.isSafeInteger(op.base?.[k]??0)||(op.base?.[k]??0)<0)throw Error('Invalid revision');if(JSON.stringify(v).length>50000)throw Error('Field too large');}
 if(ns==='items'&&op.patch.url!=null){const u=new URL(op.patch.url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid URL');}
 return op;
}
