import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { handle } from './handler.ts';
import { d1BridgeStore, d1BridgeExecutionStore } from './index.ts';
import { d1GrowthStore, GROWTH_REFS, parseGrowthInput, parseGrowthPolicy, parseGrowthRequest } from './growth-workflow.ts';
import { GROWTH_CONTEXT_PROJECTION } from './growth-context-projection.ts';
const canonical = (value: any):string => JSON.stringify(value, (_k,v)=>v && typeof v==='object' && !Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const digest = (v: unknown) => `sha256:${createHash('sha256').update(canonical(v)).digest('hex')}`;
function setup() {
  const db = new DatabaseSync(':memory:');
  const dir = new URL('../migrations/',import.meta.url);
  for (const file of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(file,dir),'utf8'));
  const d1 = {prepare(sql:string) {const statement=db.prepare(sql);let values:unknown[]=[];
    return {bind(...v:unknown[]) {values=v;return this;},async first() {return statement.get(...values as any[])??null;},async all(){return {results:statement.all(...values as any[])};},async run(){return {meta:{changes:Number(statement.run(...values as any[]).changes)}};}};}};
  const kv = new Map<string,string>();
  function seed(memberId:string,tenantId:string,token:string,status='active') {
    const tokenHash=createHash('sha256').update(token).digest('hex');kv.set(`memtok:${tokenHash}`,memberId);
    kv.set(`member:${memberId}`,JSON.stringify({tenantId,tokenHash,status,tokenExp:Date.now()+3600000}));
  }
  seed('runner','org-a','runner-token');
  seed('employee-a','org-a','employee-a-token');seed('employee-b','org-a','employee-b-token');seed('employee-c','org-b','employee-c-token');
  const deps: Parameters<typeof handle>[1] = {kv:{async get(k){return kv.get(k)??null;},async put(k,v){kv.set(k,v);},async list(p){return [...kv.keys()].filter(k=>k.startsWith(p));}},bridgeToken:'admin',
    bridgeStore:d1BridgeStore(d1 as any),executionStore:d1BridgeExecutionStore(d1 as any),growthStore:d1GrowthStore(d1 as any),growthPolicy:{tenantIds:['org-a'],runnerMemberId:'runner'},
    now:()=> '2026-10-23T12:00:00.000Z',uuid:()=>crypto.randomUUID()};
  const call=async(method:string,path:string,token='employee-a-token',body?:unknown)=> {const r=await handle({method,path,headers:{authorization:`Bearer ${token}`},...(body!==undefined?{body:JSON.stringify(body)}:{})},deps);return {status:r.status,body:JSON.parse(r.body)};};
  return {db,deps,call,seed,kv};
}
const request={requestId:'test-brief-1',scope:'org-growth',role:'synthesist',objective:'Draft an internal launch brief using the growth playbooks.',contextRefs:[...GROWTH_REFS]};
test('growth policy is explicit and request contract rejects spoofed identity, project IDs and unsafe context paths',()=>{
  assert.equal(parseGrowthPolicy(undefined,'runner'),undefined);
  assert.equal(parseGrowthPolicy('["org-a"]','runner')?.runnerMemberId,'runner');
  assert.equal(parseGrowthPolicy('["../tenant"]','runner'),undefined);
  assert.ok(parseGrowthRequest(request));
  for (const bad of [{...request,memberId:'employee-b'},{...request,tenantId:'org-b'},{...request,projectId:'private-client'},{...request,contextRefs:['../../finance.md']},{...request,role:'root'},{...request,objective:'x'.repeat(4001)}]) assert.equal(parseGrowthRequest(bad),null);
});
test('growth context requires active member and explicit tenant policy; projection has verifiable excerpt digests',async(t)=>{
  const h=setup();t.after(()=>h.db.close());
  assert.equal((await h.call('GET','/v1/bridge/growth/context','admin')).status,403);
  assert.equal((await h.call('GET','/v1/bridge/growth/context','employee-c-token')).status,403);
  h.seed('employee-a','org-a','employee-a-token','revoked');assert.equal((await h.call('GET','/v1/bridge/growth/context')).status,401);
  h.seed('employee-a','org-a','employee-a-token');
  const ctx=await h.call('GET','/v1/bridge/growth/context');assert.equal(ctx.status,200);assert.equal(ctx.body.scope,'org-growth');
  for(const doc of ctx.body.documents) assert.equal(doc.excerptDigest,`sha256:${createHash('sha256').update(doc.excerpt).digest('hex')}`);
  delete h.deps.growthPolicy;assert.equal((await h.call('GET','/v1/bridge/growth/context')).status,503);
});
test('growth submission durably queues one runner directive, replays exactly, conflicts on changed intent and hides cross-member result',async(t)=>{
  const h=setup();t.after(()=>h.db.close());
  const first=await h.call('POST','/v1/bridge/growth/requests',undefined,request);assert.equal(first.status,200,JSON.stringify(first.body));
  const id=first.body.request.id;assert.match(id,/^growth_[a-f0-9]{32}$/);
  const again=await h.call('POST','/v1/bridge/growth/requests',undefined,request);assert.equal(again.body.duplicate,true);
  const changed=await h.call('POST','/v1/bridge/growth/requests',undefined,{...request,objective:'Changed intent'});assert.equal(changed.status,409);
  assert.equal(Number((h.db.prepare('SELECT COUNT(*) AS n FROM bridge_growth_requests').get() as any).n),1);
  assert.equal((await h.call('GET',`/v1/bridge/growth/requests/${id}`,'employee-b-token')).status,404);
  const directive=await h.deps.bridgeStore!.getDirective('runner',`${id}-draft`);assert.equal((directive!.payload as any).command,'growth.request.draft');
  const input=(directive!.payload as any).input;assert.equal(input.memberId,'employee-a');assert.equal(input.tenantId,'org-a');assert.equal(input.contextSourceCommit,GROWTH_CONTEXT_PROJECTION.sourceCommit);assert.ok(parseGrowthInput(input));
});
test('growth full D1 lifecycle fences tampered output, records bounded draft and repairs result projection on outcome replay',async(t)=>{
  const h=setup();t.after(()=>h.db.close());
  const first=await h.call('POST','/v1/bridge/growth/requests',undefined,request);const id=first.body.request.id;
  const priorProjection = structuredClone(GROWTH_CONTEXT_PROJECTION);
  (GROWTH_CONTEXT_PROJECTION as any).projectionDigest=`sha256:${'c'.repeat(64)}`;
  (GROWTH_CONTEXT_PROJECTION as any).sourceCommit='d'.repeat(40);
  (GROWTH_CONTEXT_PROJECTION.documents[0] as any).sourceDigest=`sha256:${'b'.repeat(64)}`;
  t.after(()=>{Object.assign(GROWTH_CONTEXT_PROJECTION,priorProjection);});
  const upgradeReplay=await h.call('POST','/v1/bridge/growth/requests',undefined,request);assert.equal(upgradeReplay.status,200);assert.equal(upgradeReplay.body.duplicate,true);assert.equal(upgradeReplay.body.request.contextProjectionDigest,priorProjection.projectionDigest);
  const directiveId=`${id}-draft`;const directive=await h.deps.bridgeStore!.getDirective('runner',directiveId);const input=(directive!.payload as any).input;
  const executionId=`exec_${digest({memberId:'runner',directiveId,idempotencyKey:id}).slice(7,39)}`;
  const claimBody={schema:'thoughtseed.hermes.execution_claim.v1',memberId:'runner',directiveId,idempotencyKey:id,executionId,runnerId:'hermes-ec2',hostIdentity:'host-1'};
  assert.equal((await h.call('POST','/v1/bridge/executions/claim',undefined,claimBody)).status,403);
  const claim=await h.call('POST','/v1/bridge/executions/claim','admin',claimBody);assert.equal(claim.status,200,JSON.stringify(claim.body));
  assert.equal((await h.call('GET',`/v1/bridge/growth/requests/${id}`)).body.request.status,'running');
  const growthResult={schema:'thoughtseed.growth.result.v1',requestId:request.requestId,role:request.role,content:'Internal launch draft for employee review.',sources:priorProjection.documents.map(d=>({path:d.path,digest:d.sourceDigest})),approvalState:'draft',externalAction:'none'};
  const att:any={schema:'thoughtseed.hermes.execution_attestation.v1',executionId,directiveId,idempotencyKey:id,runnerId:'hermes-ec2',hostIdentity:'host-1',command:'growth.request.draft',status:'executed',exitCode:0,inputDigest:digest(input),outputDigest:digest(growthResult),growthResult,startedAt:'2026-10-23T12:00:00.000Z',finishedAt:'2026-10-23T12:00:00.000Z'};
  att.id=`att_${digest(att).slice(7,39)}`;
  const outcome={schema:'thoughtseed.hermes.execution_outcome.v1',memberId:'runner',directiveId,idempotencyKey:id,executionId,runnerId:'hermes-ec2',claimId:claim.body.claimId,fencingToken:claim.body.fencingToken,attempt:claim.body.attempt,status:'executed',attestation:att};
  const bad=structuredClone(outcome);bad.attestation.growthResult.content='Tampered draft';assert.equal((await h.call('POST','/v1/bridge/executions/outcome','admin',bad)).status,409);
  const stale={...outcome,fencingToken:'fence_wrong'};assert.equal((await h.call('POST','/v1/bridge/executions/outcome','admin',stale)).status,409);
  const done=await h.call('POST','/v1/bridge/executions/outcome','admin',outcome);assert.equal(done.status,200,JSON.stringify(done.body));
  let status=await h.call('GET',`/v1/bridge/growth/requests/${id}`);assert.equal(status.body.request.status,'draft_ready');assert.equal(status.body.request.result.content,growthResult.content);
  h.db.prepare("UPDATE bridge_growth_requests SET status='running',result_json=NULL WHERE id=?").run(id);
  const repairedRead=await h.call('GET',`/v1/bridge/growth/requests/${id}`);assert.equal(repairedRead.body.request.status,'draft_ready');assert.equal(repairedRead.body.request.result.content,growthResult.content);
  const replay=await h.call('POST','/v1/bridge/executions/outcome','admin',outcome);assert.equal(replay.status,200);assert.equal(replay.body.duplicate,true);
  status=await h.call('GET',`/v1/bridge/growth/requests/${id}`);assert.equal(status.body.request.status,'draft_ready');
  const terminal=await h.call('POST','/v1/bridge/executions/claim','admin',claimBody);assert.equal(terminal.status,200);assert.equal(terminal.body.status,'terminal');assert.equal(terminal.body.outcome.attestation.growthResult.content,growthResult.content);
});

test('growth D1 admission bounds concurrent pending requests without breaking exact replay',async(t)=>{
 const h=setup();t.after(()=>h.db.close());
 const results=await Promise.all(Array.from({length:15},(_,i)=>h.call('POST','/v1/bridge/growth/requests',undefined,{...request,requestId:`bounded-${i}`})));
 assert.equal(results.filter(r=>r.status===200).length,10);assert.equal(results.filter(r=>r.status===429).length,5);
 const replay=await h.call('POST','/v1/bridge/growth/requests',undefined,{...request,requestId:'bounded-0'});
 assert.equal(replay.status,200);assert.equal(replay.body.duplicate,true);
});
test('growth admission refuses an absent or foreign organization runner binding',async(t)=>{
 const h=setup();t.after(()=>h.db.close());
 h.seed('runner','org-b','runner-token');
 assert.equal((await h.call('POST','/v1/bridge/growth/requests',undefined,request)).status,503);
 assert.equal(Number((h.db.prepare('SELECT COUNT(*) AS n FROM bridge_growth_requests').get() as any).n),0);
});

test('growth configured daily cap counts completed requests and rejects invalid quota configuration',async(t)=>{
 const h=setup();t.after(()=>h.db.close());h.deps.growthPolicy!.maxPending=2;h.deps.growthPolicy!.maxDaily=3;
 assert.equal(parseGrowthPolicy('["org-a"]','runner','11','50'),undefined);assert.equal(parseGrowthPolicy('["org-a"]','runner','2','51'),undefined);
 assert.equal((await h.call('POST','/v1/bridge/growth/requests',undefined,{...request,requestId:'daily-0'})).status,200);
 assert.equal((await h.call('POST','/v1/bridge/growth/requests',undefined,{...request,requestId:'daily-1'})).status,200);
 assert.equal((await h.call('POST','/v1/bridge/growth/requests',undefined,{...request,requestId:'daily-2'})).status,429);
 h.db.prepare("UPDATE bridge_growth_requests SET status='draft_ready'").run();
 assert.equal((await h.call('POST','/v1/bridge/growth/requests',undefined,{...request,requestId:'daily-2'})).status,200);
 assert.equal((await h.call('POST','/v1/bridge/growth/requests',undefined,{...request,requestId:'daily-3'})).status,429);
});
