import {createSyncEngine} from './sync-engine.js';
import {bookmarkAction,reconcileBookmarks} from './bookmark-companion.js';
import {runLibraryRequest} from './library-service.js';
export const SITE='https://field-report.witnessalchemist.chatgpt.site';
const enginePromise=createSyncEngine(chrome.storage.local,s=>chrome.storage.local.set({librarySyncStatus:s}));
let port=null,timer,running=null;const waiting=new Map();
function send(payload){if(!port)return Promise.reject(Error('Open your connected Field Report tab to sync'));return new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timeout=setTimeout(()=>{waiting.delete(id);reject(Error('Field Report connection timed out'));},45000);waiting.set(id,{resolve,reject,timeout});port.postMessage({kind:'sync',id,payload});});}
function sync(){if(running)return running;if(!port)return Promise.resolve();running=enginePromise.then(e=>e.sync(send)).finally(()=>{running=null;});return running;}
function kick(){sync().catch(()=>{});}

chrome.runtime.onConnectExternal.addListener(p=>{
 let origin;try{origin=new URL(p.sender?.url).origin;}catch{}if(origin!==SITE||p.name!=='field-report-library-v1'){p.disconnect();return;}
 port?.disconnect();port=p;p.onDisconnect.addListener(()=>{if(port===p)port=null;for(const w of waiting.values()){clearTimeout(w.timeout);w.reject(Error('Field Report disconnected; changes remain queued'));}waiting.clear();chrome.storage.local.set({libraryConnected:false});});
 let ticks=0;p.onMessage.addListener(async msg=>{
 if(msg.kind==='ping'){p.postMessage({kind:'pong'});if(++ticks%3===0)sync().then(()=>p.postMessage({kind:'updated'})).catch(()=>{});return;}
 if(msg.kind==='sync-result'){const w=waiting.get(msg.id);if(w){clearTimeout(w.timeout);waiting.delete(msg.id);msg.error?w.reject(Error(msg.error)):w.resolve(msg.result);}return;}
 if(msg.kind==='command'&&typeof msg.id==='string')try{
 let result;if(msg.action==='bookmarks')result=await bookmarkAction(msg.payload||{});
 else if(msg.action==='group'){await sync();result=await runLibraryRequest({type:'lib:group',ids:(msg.payload?.ids||[]).slice(0,12),name:msg.payload?.name},{tab:p.sender.tab});}
 else if(msg.action==='status')result={...(await enginePromise).status(),connected:true};else throw Error('Unsupported companion capability');
 p.postMessage({kind:'command-result',id:msg.id,result});
 }catch(e){p.postMessage({kind:'command-result',id:msg.id,error:e.message});}
 });
 chrome.storage.local.set({libraryConnected:true});p.postMessage({kind:'ready',version:1,capabilities:['bookmarks','group','sync']});kick();
});
chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!Object.keys(changes).some(k=>['items','organPlacements','fitFeedback','libraryRemoved','libraryTrash','bookmarkBindings','agentHandoffs','fieldTheoryImport'].includes(k)))return;clearTimeout(timer);timer=setTimeout(async()=>{await(await enginePromise).capture();kick();},250);});
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(!msg.type?.startsWith('companion:'))return false;
 if(!sender.url?.startsWith(chrome.runtime.getURL(''))){reply({error:'Extension page required'});return false;}
 (async()=>{const engine=await enginePromise;
 switch(msg.type){case 'companion:connect':{const tabs=await chrome.tabs.query({url:SITE+'/*'});const tab=tabs[0];if(tab)await chrome.tabs.update(tab.id,{url:SITE+'/library/library.html?connect=1',active:true});else await chrome.tabs.create({url:SITE+'/library/library.html?connect=1'});return{opened:true};}
 case 'companion:status':return{...engine.status(),connected:!!port};
 case 'companion:sync':if(!port)throw Error('Connect Field Report first');await sync();return engine.status();
 case 'companion:resolve':return engine.resolve(msg.id,msg.choice);
 case 'companion:backup':return engine.backup();
 case 'companion:bookmarks':return bookmarkAction(msg.payload||{});
 default:throw Error('Unsupported companion action');}
 })().then(reply,e=>reply({error:e.message}));return true;
});
let bookmarksTimer;for(const event of ['onCreated','onChanged','onMoved','onRemoved','onImportEnded'])chrome.bookmarks[event]?.addListener(()=>{clearTimeout(bookmarksTimer);bookmarksTimer=setTimeout(()=>reconcileBookmarks().catch(e=>chrome.storage.local.set({bookmarkSyncError:e.message})),500);});
enginePromise.then(e=>e.capture()).then(()=>reconcileBookmarks()).catch(e=>chrome.storage.local.set({bookmarkSyncError:e.message}));
chrome.alarms.create('field-report-reconcile',{periodInMinutes:15});chrome.alarms.onAlarm.addListener(a=>{if(a.name==='field-report-reconcile')reconcileBookmarks().then(sync).catch(()=>{});});
