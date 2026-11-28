import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { handle } from './handler.ts';
import { d1SharedSignalStore } from './shared-signals-d1.ts';
import { d1SharedDirectionStore } from './shared-directions-d1.ts';
import { parseOperationalWorkIntent, OPERATIONAL_WORK_SCHEMA } from './operational-work-intake.ts';
import { makeGoalGraphHead } from './goal-graph/compiler.ts';
const now='2026-11-04T00:00:00.000Z';
const token='cns1_0123456789abcdef0123456789abcdef0123456789a';
function setup(){
 const db=new DatabaseSync(':memory:');for(const name of ['0102_shared_signals.sql','0103_shared_directions.sql'])db.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 const d1:any={prepare(sql:string){const s=db.prepare(sql);let args:any[]=[];return{bind(...v:any[]){args=v;return this;},async first(){return s.get(...args)??null;},async all(){return{results:s.all(...args)};},async run(){return{meta:{changes:Number(s.run(...args).changes)}};}};}};
 const compiled=parseOperationalWorkIntent({schema:OPERATIONAL_WORK_SCHEMA,version:1,tenantId:'cambium',clientRequestId:'work-1',expectedHeadDigest:null,goals:[{namespace:'founder-operational-work',externalId:'cambium-work',parentNodeId:null,scope:'meso',desiredState:'Deliver verified Cambium changes.',currentState:'Inbox connected.',owner:'founder',proofRequired:true,status:'active',metadata:{},workObjectId:'sapling:cambium',workObjectKind:'sapling'}]},'access:fixture',{now,graphVersion:1});
 assert.ok(compiled.accepted);if(!compiled.accepted)throw Error('fixture compile');
 let nodes=compiled.nodes;let head=makeGoalGraphHead('cambium',nodes,1,now);let principal='founder-1';let authorized=true;
 const host:any={deps:{ownerOrigin:'https://cambium.test',now:()=>now,store:{readSession:async()=>({founderId:principal,tenantId:'cambium',clientId:'client-1',expiresAt:'2026-11-05T00:00:00.000Z'})},currentRole:async()=>authorized?'founder':null,enrolledTenants:async()=>['cambium']},client:()=>({})};
 const deps:any={kv:{},nativeSessionHost:host,sharedSignalStore:d1SharedSignalStore(d1),sharedDirectionStore:d1SharedDirectionStore(d1),goalGraphStore:{readHead:async()=>head,readNodes:async()=>nodes},now:()=>now};
 const call=(method:string,path:string,payload?:any,extra:Record<string,string>={})=>handle({method,path,headers:{host:'cambium.test',authorization:`Bearer ${token}`,...extra},...(payload?{body:JSON.stringify(payload)}:{})},deps);
 return{db,deps,call,head,node:compiled.node,other(){principal='other';},revoke(){authorized=false;},retire(){nodes=nodes.map(node=>({...node,status:'retired' as const}));head=makeGoalGraphHead('cambium',nodes,2,now);}};
}
const parse=(r:any)=>JSON.parse(r.body);
async function signal(h:ReturnType<typeof setup>){const r=await h.call('POST','/v1/signals/cambium',{schema:'cambium.signal-capture.v1',operationId:'capture',title:'Observation',body:'Evidence',source:{system:'cambium-native',recordId:'source-1',version:'1',reference:null,observedAt:now},projectIds:['sapling:cambium']});assert.equal(r.status,201,r.body);return parse(r).signal;}
function create(h:ReturnType<typeof setup>,s:any){return{schema:'cambium.direction-create.v1',operationId:'draft-1',draft:{title:'Next step',body:'Improve the Inbox.',workObjectId:'sapling:cambium',workNodeId:h.node.nodeId,graphHeadDigest:h.head.graphDigest,signalPins:[{id:s.id,revision:s.revision}]}};}
test('direction route pins actual Work and source revisions, shares immutable replay and isolates scopes',async()=>{
 const h=setup();const s=await signal(h);const input=create(h,s);
 const list=parse(await h.call('GET','/v1/directions/cambium'));assert.equal(list.workContext.workNodeId,h.node.nodeId);
 for(const patch of [{graphHeadDigest:'a'.repeat(64)},{workNodeId:'catalog-only'},{signalPins:[{id:s.id,revision:2}]}])assert.equal((await h.call('POST','/v1/directions/cambium',{...input,draft:{...input.draft,...patch}})).status,409);
 const saved=await h.call('POST','/v1/directions/cambium',input);assert.equal(saved.status,201,saved.body);const id=parse(saved).direction.id;
 assert.equal(parse(await h.call('GET',`/v1/directions/cambium/${id}`)).direction.revision,1);
 h.retire();assert.equal(parse(await h.call('POST','/v1/directions/cambium',input)).replayed,true);
 assert.equal((await h.call('POST','/v1/directions/cambium',{...input,draft:{...input.draft,title:'Changed'}})).status,409);
 assert.equal(parse(await h.call('GET','/v1/directions/cambium')).workContext,null);
 h.other();assert.equal((await h.call('GET',`/v1/directions/cambium/${id}`)).status,404);assert.deepEqual(parse(await h.call('GET','/v1/directions/cambium')).directions,[]);
 assert.equal((await h.call('GET','/v1/directions/other')).status,403);
 assert.equal((await h.call('GET','/v1/directions/cambium',undefined,{cookie:'incompatible'})).status,400);
});
test('direction writes reverify membership and refuse authorisation changes without storage effects',async()=>{
 const h=setup();const s=await signal(h);let count=0;
 h.deps.nativeSessionHost.deps.currentRole=async()=>++count===1?'founder':null;
 assert.equal((await h.call('POST','/v1/directions/cambium',create(h,s))).status,403);
 assert.equal((h.db.prepare('SELECT count(*) n FROM shared_directions').get() as any).n,0);
 assert.equal((h.db.prepare('SELECT count(*) n FROM shared_direction_operations').get() as any).n,0);
});
