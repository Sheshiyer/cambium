import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.ts';
import { recallOperatorMemory } from './semantic-recall.ts';

const ROUTE_TOKEN = 'test-route-token';

async function call(env, args) {
  const response = await worker.fetch(new Request('https://example.invalid/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${ROUTE_TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'semantic_recall', arguments: args } }),
  }), { ...env, CONTEXT_ROUTE_TOKEN: ROUTE_TOKEN });
  return response.json();
}

test('operator recall uses the producer-compatible NIM vector, not Taste embeddings', async (t) => {
  let embedded = 0, queried = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    embedded++;
    assert.equal(String(url), 'https://integrate.api.nvidia.com/v1/embeddings');
    assert.deepEqual(JSON.parse(init.body), {model:'nvidia/nemotron-3-embed-1b',input:['fixture memory'],input_type:'query',encoding_format:'float'});
    return Response.json({data:[{embedding:Array(2048).fill(0.1)}]});
  });
  const env = {
    CONTEXT_ALLOWED_TENANTS:'thoughtseed', NVIDIA_API_KEY:'test-only-key',
    CORTEX_EMBED_MODEL:'nvidia/nemotron-3-embed-1b',
    AI:{run:async()=>({data:[Array(768).fill(1)]})}, TASTE_CORTEX:{},
    CAMBIUM_CORTEX:{query:async (v, options)=>{
      queried++; assert.equal(v.length,1024);
      assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-6);
      assert.deepEqual(options.filter,{tenant:{$eq:'thoughtseed'},kind:{$eq:'decision'}});
      return {matches:[{id:'fixture-record',score:0.9,metadata:{tenant:'thoughtseed',kind:'decision',source:'fixture',path:'evidence/fixture.md',payload:'private-body'}}]};
    }},
  };
  const result = await call(env,{tenant:'thoughtseed',query:'fixture memory',kind:'decision'});
  assert.equal(result.error,undefined);
  assert.equal(result.result.isError,undefined);
  assert.equal(embedded,1); assert.equal(queried,1);
  assert.ok(result.result.content[0].text.includes('fixture-record'));
  assert.ok(!result.result.content[0].text.includes('private-body'));
});

test('operator recall refuses tenant/input/config errors before network and filters metadata', async (t) => {
  let network=0;
  t.mock.method(globalThis,'fetch',async()=>{network++;return Response.json({data:[{embedding:Array(2048).fill(.1)}]});});
  const env={CONTEXT_ALLOWED_TENANTS:'thoughtseed',NVIDIA_API_KEY:'test-only',CORTEX_EMBED_MODEL:'nvidia/nemotron-3-embed-1b',CAMBIUM_CORTEX:{query:async()=>({matches:[
    {id:'wrong',score:1,metadata:{tenant:'other',kind:'decision',payload:'secret'}},
    {id:'right',score:.9,metadata:{tenant:'thoughtseed',kind:'decision',source:'fixture',path:'safe.md',token:'secret',payload:'private',summary:'unreviewed text'}}
  ]})}};
  const base={tenant:'thoughtseed',query:'bounded',kind:'decision'};
  for (const args of [{...base,tenant:'other'},{...base,top_k:0},{...base,top_k:1.5},{...base,query:''},{...base,kind:'admin'}]) {
    const r=await recallOperatorMemory(env as any,args);assert.equal(r.isError,true);
  }
  const noConfig=await recallOperatorMemory({...env,CORTEX_EMBED_MODEL:undefined} as any,base);
  assert.equal(noConfig.isError,true);assert.equal(network,0);
  const r=await recallOperatorMemory(env as any,base);const text=r.content[0].text;
  assert.ok(text.includes('right'));assert.ok(!text.includes('wrong'));assert.ok(!text.includes('private'));assert.ok(!text.includes('unreviewed'));assert.ok(!text.includes('secret'));
});

test('operator recall rejects malformed vectors and redacts provider failures',async(t)=>{
  let queries=0;
  const env={CONTEXT_ALLOWED_TENANTS:'thoughtseed',NVIDIA_API_KEY:'test-only',CORTEX_EMBED_MODEL:'nvidia/nemotron-3-embed-1b',CAMBIUM_CORTEX:{query:async()=>{queries++;return {matches:[]};}}};
  const args={tenant:'thoughtseed',query:'bounded'};
  for (const vector of [Array(1024).fill(.1),Array(2048).fill(0),[1,null]]) {
    const mock=t.mock.method(globalThis,'fetch',async()=>Response.json({data:[{embedding:vector}]}));
    const r=await recallOperatorMemory(env as any,args);assert.equal(r.isError,true);mock.mock.restore();
  }
  t.mock.method(globalThis,'fetch',async()=>{throw new Error('Bearer private-key');});
  const r=await recallOperatorMemory(env as any,args);assert.equal(r.isError,true);assert.ok(!JSON.stringify(r).includes('private-key'));assert.equal(queries,0);
});

test('MCP fetch refuses missing route credential before tool dispatch', async () => {
  const env = {
    CONTEXT_ALLOWED_TENANTS: 'thoughtseed',
    NVIDIA_API_KEY: 'test-only-key',
    CORTEX_EMBED_MODEL: 'nvidia/nemotron-3-embed-1b',
    CONTEXT_ROUTE_TOKEN: ROUTE_TOKEN,
    AI: { run: async () => ({ data: [Array(768).fill(1)] }) },
    TASTE_CORTEX: {},
    CAMBIUM_CORTEX: { query: async () => { throw new Error('should not query'); } },
  };
  const denied = await worker.fetch(new Request('https://example.invalid/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'semantic_recall', arguments: { tenant: 'thoughtseed', query: 'x' } } }),
  }), env);
  assert.equal(denied.status, 401);
  const health = await worker.fetch(new Request('https://example.invalid/health'), env);
  assert.equal(health.status, 200);
});
