export const preview = ['http:','https:'].includes(location.protocol) && new URLSearchParams(location.search).get('preview')==='1';
if(preview){const runtime=await import('./preview-runtime.js');await runtime.bootstrap();}
export const hosted=['http:','https:'].includes(location.protocol)&&!preview;
if(hosted){await(await import('./host-runtime.js')).bootstrap();}
if(!globalThis.chrome?.runtime?.id)throw new Error('Open Library from its Chrome toolbar button.');
export async function request(type,payload={}){
 const message={type,...payload};let reply;
 if(type.startsWith('companion:'))reply=await chrome.runtime.sendMessage(message);
 else if(hosted&&['lib:group','lib:prepare-personal','lib:sync'].includes(type))reply=await chrome.runtime.sendMessage(message);
 else if(hosted&&type==='lib:prepare-shared')return {found:0,added:0};
 else if(hosted&&type.startsWith('lib:'))reply=await(await import('./library-service.js')).runLibraryRequest(message);
 else reply=await chrome.runtime.sendMessage(message);
 if(reply?.error)throw Error(reply.error);if(reply==null&&type!=='lib:organ-placement')throw Error('Library service unavailable. Reload the companion and reopen Library.');return reply;
}
export function openUrl(url){return request('open',{url});}
export function subscribe(listener){const fn=(changes,area)=>{if(area!=='local')return;if(Object.keys(changes).some(k=>['items','libSettings','archived','libraryTrash','fieldTheoryImport','quietMode','libraryTheme','libraryExperience','personalCollection','sharedReferenceImport','fitIndex','fitFeedback','agentHandoffs','fieldReportContext','organPlacements'].includes(k)||k.startsWith('lastSync_')))listener(changes);};chrome.storage.onChanged.addListener(fn);return()=>chrome.storage.onChanged.removeListener(fn);}
export async function localSettings(){return chrome.storage.local.get(['autoArchive','quietMode','archived','fieldTheoryImport','libraryTrash','libraryTheme','libraryExperience','personalCollection','sharedReferenceImport','organPlacements']);}
export async function setLocalSettings(patch){await chrome.storage.local.set(patch);}
export async function snapshotInfo(){
 if(preview)return {format:'field-theory-library-v1',generatedAt:Date.now(),items:[],counts:{x:12,github:10,reddit:8},preview:true};
 const response=await fetch(chrome.runtime.getURL('field-theory-library.json'),{cache:'no-store'});
 if(!response.ok)throw new Error('Field Theory snapshot is not available yet. You can still import a JSON export.');
 const data=await response.json();if(data.format!=='field-theory-library-v1')throw new Error('Field Theory snapshot format is not recognized.');return data;
}
export async function importSnapshot(){const snapshot=await snapshotInfo();if(preview)return request('lib:import-field',{snapshot:{...snapshot,items:[]}});return request('lib:import-field',{snapshot});}
export async function previewReset(){if(preview)await chrome.runtime.sendMessage({type:'preview:reset'});}
