import {database,createSyncEngine} from './sync-engine.js';
const EXTENSION='lfgnnbljadlghpdmbhnomnlnnjjdjiid';
let port,engine,heartbeat;const waits=new Map(),listeners=new Set(),db=await database('field-report-library-host');
let values=await db.get('storage')||{};let writes=Promise.resolve();
const local={async get(keys){values=await db.get('storage')||{};if(keys==null)return structuredClone(values);if(typeof keys==='string')keys=[keys];return Object.fromEntries(keys.filter(k=>k in values).map(k=>[k,structuredClone(values[k])]));},set(patch){const run=async()=>{values=await db.get('storage')||{};const changes={};for(const[k,v]of Object.entries(patch)){if(JSON.stringify(values[k])===JSON.stringify(v))continue;changes[k]={oldValue:values[k],newValue:v};values[k]=structuredClone(v);}await db.set('storage',values);if(Object.keys(changes).length)for(const fn of listeners)fn(changes,'local');};const locked=()=>navigator.locks.request('field-report-host-storage',run);const p=writes.then(locked,locked);writes=p.catch(()=>{});return p;}};
const browserRuntime=globalThis.chrome?.runtime;
async function sendSync(payload){const r=await fetch('/api/library/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw Error(r.status===401||r.status===403?'Sign in to Field Report to sync':'Library sync failed ('+r.status+')');return r.json();}
export function connected(){return!!port;}
export function command(action,payload={}){if(!port)return Promise.reject(Error('Connect the Chrome companion in this profile first'));return new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timer=setTimeout(()=>{waits.delete(id);reject(Error('Companion did not respond'));},45000);waits.set(id,{resolve,reject,timer});port.postMessage({kind:'command',id,action,payload});});}
export function connect(){if(port)return;try{if(!browserRuntime?.connect)throw Error('Open Field Report in Chrome with the companion enabled');port=browserRuntime.connect(EXTENSION,{name:'field-report-library-v1'});
 port.onDisconnect.addListener(()=>{port=null;clearInterval(heartbeat);for(const w of waits.values()){clearTimeout(w.timer);w.reject(Error('Chrome companion disconnected'));}waits.clear();globalThis.dispatchEvent(new Event('library-sync-status'));});
 port.onMessage.addListener(async msg=>{
 if(msg.kind==='sync')try{const result=await sendSync(msg.payload);port?.postMessage({kind:'sync-result',id:msg.id,result});scheduleSync();}catch(e){port?.postMessage({kind:'sync-result',id:msg.id,error:e.message});}
 if(msg.kind==='updated')scheduleSync();
 if(msg.kind==='command-result'){const w=waits.get(msg.id);if(w){waits.delete(msg.id);clearTimeout(w.timer);msg.error?w.reject(Error(msg.error)):w.resolve(msg.result);}}
 if(msg.kind==='ready'){clearInterval(heartbeat);heartbeat=setInterval(()=>port?.postMessage({kind:'ping'}),20000);globalThis.dispatchEvent(new Event('library-sync-status'));scheduleSync();}
 });}catch(e){port=null;throw e;}}
let timer;function scheduleSync(){clearTimeout(timer);timer=setTimeout(()=>engine?.sync(sendSync).catch(()=>{}),300);}
export async function bootstrap(){
 globalThis.chrome={...(globalThis.chrome||{}),storage:{local,onChanged:{addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)}},runtime:{id:'field-report-host',getURL:path=>new URL(path,location.origin+'/library/').href,sendMessage:async msg=>{
 if(msg.type==='open'){window.open(msg.url,'_blank','noopener');return true;}
 if(msg.type==='companion:connect'){connect();return{opened:true};}
 if(msg.type==='companion:status')return{...engine.status(),connected:connected()};
 if(msg.type==='companion:sync')return engine.sync(sendSync);
 if(msg.type==='companion:resolve')return engine.resolve(msg.id,msg.choice);
 if(msg.type==='companion:backup')return engine.backup();
 if(msg.type==='companion:bookmarks'){await engine.sync(sendSync);return command('bookmarks',msg.payload);}
 if(msg.type==='lib:group'){await engine.sync(sendSync);return command('group',{ids:msg.ids,name:msg.name});}
 if(msg.type==='lib:prepare-personal'||msg.type==='lib:sync')throw Error('Use Field Theory imports or the connected Chrome companion for source sync');
 throw Error('This action requires the Chrome companion');
 }},tabs:{getCurrent:async()=>undefined}};
 engine=await createSyncEngine(local,()=>globalThis.dispatchEvent(new Event('library-sync-status')));
 listeners.add(changes=>{if(Object.keys(changes).some(k=>['items','organPlacements','fitFeedback','libraryRemoved','libraryTrash','bookmarkBindings','agentHandoffs'].includes(k)))scheduleSync();});
 await engine.capture();scheduleSync();
 if(new URLSearchParams(location.search).has('connect'))try{connect();}catch(e){globalThis.libraryConnectionError=e.message;}
 window.addEventListener('online',scheduleSync);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleSync();});
}
