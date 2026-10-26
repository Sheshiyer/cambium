import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleContextRoute} from './context-routes.ts';
import {createHermesReceiptIngestion,HERMES_RECEIPTS_V2_ROUTE,HERMES_RECEIPTS_V2_SPACE,isHermesTerminalReceipt,createHermesReceiptAuthorizer} from './hermes-receipts-v2.ts';
import type {VectorizeUpsertVector} from './context-bindings.ts';
const execution='exec_'+'a'.repeat(32);
const receipt={schema:'thoughtseed.cortex-ingestion.v1',tenant:'cambium',kind:'evidence',source:'hermes-runner',path:`executions/${execution}`,content:'## Hermes terminal execution\n\nThis redacted terminal execution receipt records stable input and output digests for the internal draft.',idempotencyKey:`hermes:${execution}`};
function harness(options:{dimensions?:number;providerStatus?:number;zero?:boolean;wrongModel?:boolean;wrongShape?:boolean;nonfinite?:boolean;overflow?:boolean;readback?:'missing'|'wrong-space'|'error'|'zero'|'different'|'typed'}={}) {
 const requests:Array<Record<string,unknown>>=[];const stored=new Map<string,VectorizeUpsertVector>();let writes=0,reads=0,legacyWrites=0;
 const vectorIndex={async query(){return {matches:[]};},async upsert(vectors:VectorizeUpsertVector[]) {writes++;for(const vector of vectors)stored.set(vector.id,structuredClone(vector));return {count:vectors.length};},async getByIds(ids:string[]) {reads++;if(options.readback==='error')throw new Error('unavailable');if(options.readback==='missing')return [];return ids.map(id=>{const v=structuredClone(stored.get(id)!);if(options.readback==='wrong-space')v.metadata!.embeddingSpace='different-space';if(options.readback==='zero')v.values=Array(768).fill(0);if(options.readback==='different')v.values=Array(768).fill(0.5);if(options.readback==='typed')v.values=new Float32Array(v.values);return v;});}};
 const deps=createHermesReceiptIngestion({enabled:'true',ai:{async run(model,input){requests.push({model,...input});if(options.providerStatus)throw new Error('provider unavailable');return {shape:options.wrongShape?[2,768]:[1,options.dimensions??768],...(options.wrongModel?{model:'different-model'}:{}),data:[Array(options.dimensions??768).fill(options.nonfinite?null:options.overflow?1e100:options.zero?0:0.25)]};}},vectorIndex});
 return {deps,requests,stored,get counts(){return {writes,reads,legacyWrites};},legacy:{async embed(){return [1,2];},vectorIndex:{async upsert(){legacyWrites++;return {};}}}};
}
async function call(body:unknown,deps:ReturnType<typeof harness>['deps'],legacy?:ReturnType<typeof harness>['legacy'],token='cortex-token',route=HERMES_RECEIPTS_V2_ROUTE) {
 const response=await handleContextRoute({method:'POST',path:route,headers:{authorization:`Bearer ${token}`},body:JSON.stringify(body)},{cortexIngestionToken:'cortex-token',hermesReceiptIngestionDeps:deps,cortexIngestionDeps:legacy,authorizeHermesReceipt:async()=>true});
 return {status:response!.status,body:JSON.parse(response!.body)};
}
test('Hermes receipt v2 is explicit, strict and fails closed without its separate configured index',async()=>{
 const h=harness();assert.ok(isHermesTerminalReceipt(receipt));
 for(const bad of [{...receipt,tenant:'other-org'},{...receipt,kind:'note'},{...receipt,source:'employee-chat'},{...receipt,path:'private/vault.md'},{...receipt,idempotencyKey:'wrong'}])assert.equal(isHermesTerminalReceipt(bad),false);
 assert.equal(createHermesReceiptIngestion({enabled:'false',vectorIndex:{async query(){return {};},async upsert(){return {};}}}),undefined);
 assert.equal((await call(receipt,undefined,h.legacy)).status,503);assert.equal(h.counts.legacyWrites,0);
 assert.equal((await call(receipt,h.deps,h.legacy,'wrong')).status,401);
 for(const bad of [{...receipt,tenant:'other-org'},{...receipt,kind:'note'},{...receipt,source:'employee-chat'},{...receipt,path:'private/vault.md'},{...receipt,idempotencyKey:'wrong'}])assert.equal((await call(bad,h.deps,h.legacy)).status,400);
 assert.equal(h.counts.writes,0);assert.equal(h.counts.legacyWrites,0);
});
test('Hermes receipt v2 pins supported model/passages/dimensions and requires independent exact vector readback',async()=>{
 const h=harness();const response=await call(receipt,h.deps,h.legacy);assert.equal(response.status,201);assert.equal(response.body.status,'ingested');assert.deepEqual(response.body.embeddingSpace,HERMES_RECEIPTS_V2_SPACE);assert.equal(h.counts.reads,1);assert.equal(h.counts.legacyWrites,0);
 assert.equal(h.requests[0].model,'@cf/baai/bge-base-en-v1.5');assert.equal((h.requests[0].text as string[]).length,1);
 for(const vector of h.stored.values()){assert.equal(vector.values.length,768);assert.equal(vector.metadata!.embeddingSpace,HERMES_RECEIPTS_V2_SPACE.id);assert.equal(vector.metadata!.embeddingModel,HERMES_RECEIPTS_V2_SPACE.model);}
 const replay=await call(receipt,h.deps,h.legacy);assert.equal(replay.status,201);assert.deepEqual(replay.body.vectorIds,response.body.vectorIds);assert.equal(h.stored.size,response.body.vectorIds.length);
});
test('Hermes receipt v2 rejects wrong dimensions and provider failure without fallback or vector writes',async()=>{
 for(const options of [{dimensions:1024},{providerStatus:410},{zero:true},{wrongModel:true},{wrongShape:true},{nonfinite:true},{overflow:true}]){const h=harness(options);const response=await call(receipt,h.deps,h.legacy);assert.equal(response.status,502);assert.equal(h.counts.writes,0);assert.equal(h.counts.reads,0);assert.equal(h.counts.legacyWrites,0);}
});
test('Hermes receipt v2 preserves ACK hold on delayed, mismatched or unavailable Vectorize readback',async()=>{
 for(const readback of ['missing','wrong-space','error','zero','different'] as const){const h=harness({readback});const response=await call(receipt,h.deps,h.legacy);assert.equal(response.status,502);assert.equal(response.body.status,undefined);assert.equal(h.counts.writes,1);assert.equal(h.counts.reads,1);assert.equal(h.counts.legacyWrites,0);}
});
test('Legacy Cortex ingestion remains on its original dependencies and receives no v2 metadata',async()=>{
 const h=harness();const response=await call({...receipt,source:'existing-writer',path:'legacy-evidence'},h.deps,h.legacy,'cortex-token','/v1/context/cortex-ingest');assert.equal(response.status,201);assert.equal(response.body.embeddingSpace,undefined);assert.equal(h.counts.legacyWrites,1);assert.equal(h.counts.writes,0);assert.equal(h.requests.length,0);
});

test('Hermes v2 D1 authority pins original runner and exact redacted terminal growth receipt before embedding',async()=>{
 const attestation={id:'att_test',command:'growth.request.draft',executionId:execution,directiveId:'directive-1',runnerId:'hermes-ec2-runner-01',inputDigest:'sha256:'+ 'b'.repeat(64),status:'executed',finishedAt:'2026-10-24T00:00:00.000Z',outputDigest:'sha256:'+'c'.repeat(64)};
 const directive={tenantId:'cambium',payload:{command:'growth.request.draft',target:{memberId:'hermes-runner'},input:{tenantId:'cambium'}}};
 const row:any={member_id:'hermes-runner',runner_id:attestation.runnerId,directive_id:attestation.directiveId,execution_id:execution,terminal:1,outcome_status:'executed',input_digest:attestation.inputDigest,attestation_json:JSON.stringify(attestation),directive_json:JSON.stringify(directive)};
 const bindings:unknown[][]=[];const authorizer=createHermesReceiptAuthorizer({prepare(sql){assert.match(sql,/JOIN bridge_directives/);return {bind(...args:unknown[]){bindings.push(args);return this;},async first(){return structuredClone(row) as any;},async all(){return {};},async run(){return {};}};}});
 const content=['## Hermes terminal execution',`Directive ${attestation.directiveId} reached terminal status executed.`,`Execution ${execution} was recorded by runner ${attestation.runnerId}.`,`Attestation ${attestation.id} finished at ${attestation.finishedAt}.`,`Input digest ${attestation.inputDigest}.`,`Output digest ${attestation.outputDigest}.`].join('\n\n');
 assert.equal(await authorizer({...receipt,content}),true);assert.deepEqual(bindings[0],[execution,'hermes-runner','hermes-ec2-runner-01']);
 assert.equal(await authorizer({...receipt,content:content+' private body'}),false);
 for(const [field,value] of [['member_id','other-member'],['runner_id','other-runner'],['terminal',0],['outcome_status','retryable']] as const){const previous=row[field];row[field]=value;assert.equal(await authorizer({...receipt,content}),false);row[field]=previous;}
 directive.payload.input.tenantId='other-org';row.directive_json=JSON.stringify(directive);assert.equal(await authorizer({...receipt,content}),false);
 const h=harness();const response=await handleContextRoute({method:'POST',path:HERMES_RECEIPTS_V2_ROUTE,headers:{authorization:'Bearer fixture'},body:JSON.stringify(receipt)},{cortexIngestionToken:'fixture',hermesReceiptIngestionDeps:h.deps,authorizeHermesReceipt:async()=>false});assert.equal(response!.status,403);assert.equal(h.requests.length,0);assert.equal(h.counts.writes,0);
});

test('Hermes v2 readback accepts Cloudflare Float32 vector values with matching float32 quantization',async()=>{
 const h=harness({readback:'typed'});const response=await call(receipt,h.deps,h.legacy);assert.equal(response.status,201);assert.equal(h.counts.reads,1);
});
