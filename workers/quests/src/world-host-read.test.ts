import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { WORLD_HOST_CLIENT } from './page/world-host.ts';
function harness() {
 let clock=0;let next=0;const timers=new Map<number,{at:number;fn:()=>void}>();const events=new Map<string,(event:any)=>void>();
 let finish!:(response:any)=>void;let aborted=0;
 const requests:{url:string;credentials:string}[]=[];
 const scope=vm.createContext({URLSearchParams,AbortController,DOMException,console,location:{search:'',pathname:'/founder',hash:''},
   window:{addEventListener:(name:string,fn:any)=>events.set(name,fn)},
   setTimeout:(fn:()=>void,ms:number)=>{const id=++next;timers.set(id,{at:clock+ms,fn});return id;},clearTimeout:(id:number)=>timers.delete(id),
   fetch:(url:string,options:any)=>{requests.push({url,credentials:options.credentials});return new Promise((resolve,reject)=>{
     finish=resolve;options.signal.addEventListener('abort',()=>{aborted++;reject(new DOMException('Read canceled','AbortError'));});
   });},
 });
 vm.runInContext(WORLD_HOST_CLIENT.replace(/^<script>\s*/,'').replace(/<\/script>\s*$/,''),scope);
 const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 return{requests,aborted:()=>aborted,get:()=>JSON.parse(vm.runInContext('JSON.stringify(CuriousGateBridge.get())',scope)),
   advance(ms:number){const target=clock+ms;for(;;){const due=[...timers.entries()].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;clock=due[1].at;timers.delete(due[0]);due[1].fn();}clock=target;},
   async complete(){finish({status:200,ok:true,json:async()=>({schema:1,tenant:'cambium',derivedAt:new Date().toISOString(),ledger:{rows:[]}})});await flush();},
   async hide(){events.get('pagehide')?.({});await flush();},flush};
}
test('founder read accepts a delayed authenticated envelope without canceling it after ten seconds',async()=>{
 const h=harness();assert.deepEqual(h.requests,[{url:'/founder/api/quests/cambium',credentials:'same-origin'}]);
 h.advance(12000);await h.flush();assert.equal(h.aborted(),0,'a slow founder read must remain eligible');
 await h.complete();assert.equal(h.get().state,'read');assert.equal(h.get().signer,'access');
});
test('founder read remains bounded and late or page-hidden responses cannot publish success',async()=>{
 const timed=harness();timed.advance(31000);await timed.flush();assert.equal(timed.aborted(),1);await timed.complete();assert.equal(timed.get().state,'held');
 const hidden=harness();await hidden.hide();assert.equal(hidden.aborted(),1);await hidden.complete();assert.notEqual(hidden.get().state,'read');
});
