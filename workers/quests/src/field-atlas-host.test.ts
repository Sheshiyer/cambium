import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { PAGE } from './page/index.ts';
import { RETIRED_PAGE } from './page/retired.ts';
import { WORLD_HOST_CLIENT } from './page/world-host.ts';
import { CLIENT_CURIOUS_GATE_BRIDGE } from './page/client/curious-gate-bridge.ts';
import { CLIENT_CURIOUS_READ_BRIDGE } from './page/client/curious-read-bridge.ts';
import { CURIOUS_WORLD_PAGE } from './page/components/curious-world.ts';
import { injectInitialQuestHydration } from './page/initial-hydration.ts';

const source = WORLD_HOST_CLIENT.slice('<script>'.length, -'</script>'.length);
const envelope = (extra = {}) => ({schema:1, tenant:'cambium', derivedAt:new Date().toISOString(), ledger:{rows:[]}, ...extra});
const scripts = (html:string) => [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(s=>s.trim());
function harness(options:{path?:string; search?:string; hash?:string; initData?:string; sdkInitData?:string; fetch?: (url:string,init:any)=>Promise<any>; initial?:unknown} = {}) {
  const calls:Array<{url:string;init:any}> = [];
  const events = new Map<string,Function>();
  let sdkLoads = 0; let telegramStarts = 0; let scope:any;
  scope = vm.createContext({console, URLSearchParams, AbortController, setTimeout, clearTimeout,
    location:{pathname:options.path ?? '/founder',search:options.search ?? '',hash:options.hash ?? ''},
    window:{addEventListener:(name:string,fn:Function)=>events.set(name,fn), ...(options.initData ? {Telegram:{WebApp:{initData:options.initData,ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){}}}} : {})},
    document:{createElement(){return {src:'',onload:null,onerror:null,remove(){}};},head:{append(sdk:any){sdkLoads++; if(options.sdkInitData){scope.window.Telegram={WebApp:{initData:options.sdkInitData,ready(){telegramStarts++;},expand(){}}}; sdk.onload();}else sdk.onerror();}}},
    fetch:async (url:string,init:any)=>{calls.push({url,init});return options.fetch ? options.fetch(url,init) : {status:200,ok:true,json:async()=>envelope()};},
    __CAMBIUM_INITIAL_QUEST_ENVELOPE__:options.initial,
  });
  const page = options.initial ? injectInitialQuestHydration(WORLD_HOST_CLIENT) : WORLD_HOST_CLIENT;
  vm.runInContext(scripts(page)[0],scope);
  return {scope,calls,events,sdkLoads:()=>sdkLoads,telegramStarts:()=>telegramStarts,run:(code:string)=>vm.runInContext(code,scope), state:()=>JSON.parse(vm.runInContext('JSON.stringify({read:CuriousReadBridge.get(),gate:CuriousGateBridge.get()})',scope))};
}
const tick = () => new Promise(resolve=>setImmediate(resolve));

test('serving entrypoint excludes retired module imports and stays smaller than the frozen desk document',()=>{
  const entry=readFileSync(new URL('./page/index.ts',import.meta.url),'utf8');
  assert.doesNotMatch(entry.split('\n').filter(line=>line.startsWith('import')).join('\n'),/retired|LEGACY_PAGE|operating-fabric|scaffold|scene-engine/i);
  for(const marker of ['MissionControlShell','RootNav','data-root-scene','id="operating-fabric"','curious-world-launch']) assert.ok(!PAGE.includes(marker),marker);
  assert.ok(Buffer.byteLength(PAGE)<Buffer.byteLength(RETIRED_PAGE));
  assert.equal(PAGE.split(CLIENT_CURIOUS_READ_BRIDGE).length,2);
  assert.equal(PAGE.split(CLIENT_CURIOUS_GATE_BRIDGE).length,2);
});
test('world boots for historical query flags and retains all existing in-world Gate bridge methods',()=>{
  assert.doesNotMatch(scripts(CURIOUS_WORLD_PAGE).at(-1)!,/query\.has|SCENE_PARAM|openWorkbench|MissionControlShell|operating-fabric|world.*0/);
  assert.match(CURIOUS_WORLD_PAGE,/\n  enter\(\);/);
  for(const method of ['getReadState','subscribeRead','getGateState','subscribeGate','readDecision','reviewGate','renewGate','signGate']) assert.ok(CURIOUS_WORLD_PAGE.includes(method),method);
  for(const component of ['gate-folio.ts','mission-dossier.ts']) assert.ok(readFileSync(new URL('../../../apps/cambium-r3f/src/curious-world/'+component,import.meta.url),'utf8').length>1000);
});
test('founder route retains same-origin scoped read and requires no rendering of retired controls',async()=>{
  const h=harness({search:'?world=0&scene=gate'});await tick();
  assert.equal(h.calls.filter(c=>c.url.includes('/api/quests/'))[0].url,'/founder/api/quests/cambium');
  assert.equal(h.calls.filter(c=>c.url.includes('/api/quests/'))[0].init.credentials,'same-origin');
  assert.equal(h.state().read.state,'read');assert.equal(h.state().gate.signer,'access');
  assert.equal(h.calls.filter(c=>c.init.method==='POST').length,0);
});
test('Telegram tenant reads keep runtime initData confined to the original request header',async()=>{
  const h=harness({path:'/',search:'?tenant=acme',initData:'synthetic-auth',fetch:async()=>({ok:true,status:200,json:async()=>envelope({tenant:'acme'})})});await tick();
  assert.equal(h.calls.filter(c=>c.url.includes('/api/quests/'))[0].url,'/api/quests/acme');assert.equal(h.calls.filter(c=>c.url.includes('/api/quests/'))[0].init.headers['x-telegram-init-data'],'synthetic-auth');
  assert.deepEqual(Object.keys(h.state().read).sort(),['label','state']);
  assert.equal(h.state().gate.signer,'telegram');
});
test('untrusted, cross-tenant, stale and future reads hold both bridges without publishing old success',async()=>{
  for(const env of [envelope({tenant:'other'}),envelope({schema:2}),envelope({ledger:{}}),envelope({derivedAt:'invalid'}),envelope({derivedAt:new Date(Date.now()+120000).toISOString()}),envelope({derivedAt:'2020-01-01T00:00:00Z'})]) {
    const h=harness({fetch:async()=>({status:200,ok:true,json:async()=>env})});await tick();
    assert.equal(h.state().read.state,'held');assert.equal(h.state().gate.state,'held');assert.equal(h.state().gate.proposals.length,0);
  }
});
test('transport auth, missing, service and network errors remain truthful and never become a decision',async()=>{
  for(const status of [401,403,404,500,409]) {
    const h=harness({fetch:async()=>({status,ok:false})});await tick();
    assert.equal(h.state().read.state,status===401||status===403?'auth':'held');assert.equal(h.state().gate.state,'held');
    assert.equal(h.calls.filter(c=>c.init.method==='POST').length,0);
  }
  const h=harness({fetch:async()=>{throw new Error('offline');}});await tick();assert.equal(h.state().read.state,'held');
});
test('initial hydration paints through the same bridges then checks the network without replaying work',async()=>{
  const h=harness({initial:envelope()});assert.equal(h.run('__CAMBIUM_INITIAL_QUEST_ENVELOPE__'),undefined);await tick();
  assert.equal(h.state().read.state,'read');assert.equal(h.calls.filter(c=>c.url.includes('/api/quests/')).length,1);
  assert.equal(h.calls.filter(c=>c.init.method==='POST').length,0);
});
test('pagehide aborts owned reads and prevents late completion from restoring read or Gate state',async()=>{
  let release!:(v:any)=>void;
  const h=harness({fetch:()=>new Promise(resolve=>{release=resolve;})});
  h.events.get('pagehide')!();assert.equal(h.calls.filter(c=>c.url.includes('/api/quests/'))[0].init.signal.aborted,true);
  release({ok:true,status:200,json:async()=>envelope()});await tick();
  assert.equal(h.state().read.state,'source');assert.equal(h.state().gate.state,'checking');
});

function worldHarness(mode:'ready'|'throw'|'callback' = 'ready', search = '') {
  const nodes = new Map<string,any>();
  for(const id of ['curious-world','curious-world-retry','curious-world-fallback']) nodes.set(id,{hidden:id.endsWith('fallback'),focusCount:0,handlers:new Map<string,Function>(),focus(){this.focusCount++;},replaceChildren(){},addEventListener(name:string,fn:Function){this.handlers.set(name,fn);}});
  let calls = 0; let disposals = 0; let options:any; const events = new Map<string,Function>();
  const scope = vm.createContext({
    location:{search}, URLSearchParams,
    document:{getElementById:(id:string)=>nodes.get(id)},window:{addEventListener:(name:string,fn:Function)=>events.set(name,fn)},
    CuriousReadBridge:{get:()=>({state:'source'}),subscribe:()=>()=>{}},CuriousGateBridge:{get:()=>({state:'held'}),subscribe:()=>()=>{}},
    CuriousPocketWorld:{mountCuriousWorld(_root:any,bridge:any){calls++;options=bridge; if(calls===1 && mode==='throw') throw new Error('WebGL unavailable'); if(calls===1 && mode==='callback') bridge.onExit('WebGL unavailable'); return {focus(){},dispose(){disposals++;}};}},
  });
  vm.runInContext(scripts(CURIOUS_WORLD_PAGE).at(-1)!,scope);
  return {nodes,events,calls:()=>calls,disposals:()=>disposals,options:()=>options,retry:()=>nodes.get('curious-world-retry').handlers.get('click')()};
}
test('historical 2D query parameters cannot opt out of mounting the sole world surface',()=>{
  for(const query of ['', '?world=0', '?scene=mission', '?scene=gate&s=4']) assert.equal(worldHarness('ready',query).calls(),1);
});
test('both throwing and synchronous renderer failures show retry and never reveal a retired desk',()=>{
  for(const mode of ['throw','callback'] as const) {
    const h=worldHarness(mode);assert.equal(h.calls(),1);assert.equal(h.nodes.get('curious-world-fallback').hidden,false);assert.equal(h.nodes.get('curious-world').hidden,true);
    h.retry();assert.equal(h.calls(),2);assert.equal(h.nodes.get('curious-world-fallback').hidden,true);assert.equal(h.nodes.get('curious-world').hidden,false);
    assert.equal(h.options().openWorkbench,undefined);
  }
});

test('restoring a cached page remounts the world and refreshes the same scoped read',async()=>{
  const world=worldHarness();world.events.get('pagehide')!();assert.equal(world.disposals(),1);
  world.events.get('pageshow')!({persisted:true});assert.equal(world.calls(),2);
  const host=harness();await tick();host.events.get('pagehide')!();
  host.events.get('pageshow')!({persisted:true});await tick();assert.equal(host.calls.filter(c=>c.url.includes('/api/quests/')).length,2);assert.equal(host.state().read.state,'read');
});

test('ordinary web and founder sessions never load or initialize the Telegram SDK',async()=>{
  for(const path of ['/', '/founder']) {
    const h=harness({path});await tick();assert.equal(h.sdkLoads(),0);assert.equal(h.telegramStarts(),0);
    assert.equal(h.state().gate.signer,path==='/founder'?'access':'none');
  }
  const founder=harness({path:'/founder',initData:'synthetic-telegram-data',hash:'#tgWebAppData=synthetic'});await tick();
  assert.equal(founder.sdkLoads(),0);assert.equal(founder.state().gate.signer,'access');assert.equal(founder.calls.filter(c=>c.url.includes('/api/quests/'))[0].init.headers['x-telegram-init-data'],undefined);
  assert.doesNotMatch(PAGE,/<script\s+src="https:\/\/telegram\.org/);
  assert.doesNotMatch(WORLD_HOST_CLIENT,/setHeaderColor|setBackgroundColor/);
});
test('only a Telegram launch context may load the optional adapter before its authenticated 3D read',async()=>{
  const h=harness({path:'/',hash:'#tgWebAppData=synthetic',sdkInitData:'synthetic-runtime-auth'});await tick();
  assert.equal(h.sdkLoads(),1);assert.equal(h.telegramStarts(),1);assert.equal(h.calls.filter(c=>c.url.includes('/api/quests/'))[0].init.headers['x-telegram-init-data'],'synthetic-runtime-auth');assert.equal(h.state().gate.signer,'telegram');
  const failed=harness({path:'/',hash:'#tgWebAppData=synthetic'});await tick();assert.equal(failed.sdkLoads(),1);assert.equal(failed.calls.length,0);assert.equal(failed.state().read.state,'auth');assert.equal(failed.state().gate.state,'held');
});
