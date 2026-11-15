import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { handleCortexProvenanceRead } from './cortex-provenance-reader.ts';
import { handle } from './handler.ts';
import { readInfiniteGameNode } from '../../cortex-mcp/src/provenance-read.ts';
import type { GoalGraphNode, GoalGraphHead } from './goal-graph/types.ts';
const now = Date.parse('2026-11-04T00:00:00.000Z');
const node = {
  nodeId:'goal_real', tenantId:'cambium', status:'active', graphVersion:2,
  sourceDigest:`sha256:${'a'.repeat(64)}`, desiredState:'private launch prose',
  owner:'founder/codex', sourceRef:'repo:private/path', metadata:{ secret: 'not-for-cortex' },
} as GoalGraphNode;
const head = {tenantId:'cambium',graphVersion:2,graphDigest:'b'.repeat(64),nodeIds:[node.nodeId]} as GoalGraphHead;
const input = {tenant:'cambium',node_kind:'d1_task',node_id:node.nodeId};
const request = (body: unknown) => new Request('https://cambium-provenance.internal/read',{method:'POST',body:JSON.stringify(body)});
const store = {readHead:async()=>head,readNodes:async()=>[node]};
const allowed = new Set(['cambium']);
test('real D1 identity projection satisfies Cortex closed envelope without arbitrary details',async()=>{
 const binding={fetch:async(_url: unknown, init?: RequestInit)=>handleCortexProvenanceRead(new Request('https://cambium-provenance.internal/read',init),store,allowed,now)};
 const result=await readInfiniteGameNode(binding,input as never,now);
 assert.equal(result.source_authority,'d1');assert.equal(result.node_id,node.nodeId);
 assert.deepEqual(Object.keys(result.body).sort(),['graph_digest','graph_version','node_id','source_digest','status']);
 assert.doesNotMatch(JSON.stringify(result), /private launch prose|founder\/codex|repo:private|not-for-cortex/);
});
test('unauthorized callers and the public router never reach D1', async () => {
  let reads = 0;
  const closed = { readHead: async () => { reads += 1; return head; }, readNodes: async () => { reads += 1; return [node]; } };
  const denied = await handleCortexProvenanceRead(request(input), closed, new Set(), now);
  assert.equal(denied.status, 403);
  assert.equal(JSON.parse(await denied.text()).error, 'unauthorized_tenant');
  const missing = await handleCortexProvenanceRead(new Request('https://cambium-provenance.internal/read'), closed, allowed, now);
  assert.equal(missing.status, 404);
  assert.equal(reads, 0);
  const publicRoute = await handle({
    method: 'POST', path: '/read', headers: {},
    body: JSON.stringify(input),
  }, { kv: { get: async () => null, put: async () => {}, list: async () => [] } });
  assert.notEqual(publicRoute.status, 200);
  assert.doesNotMatch(publicRoute.body, /cambium\.provenance_source\.v1|source_digest|private launch prose/);
});
test('labs entry keeps the existing worker public and the reader on a named class', () => {
  const entry = readFileSync(new URL('./cortex-services.ts', import.meta.url), 'utf8');
  const labs = readFileSync(new URL('../wrangler.labs.jsonc', import.meta.url), 'utf8');
  assert.match(entry, /export default quests/);
  assert.match(entry, /export class CortexProvenanceReader extends WorkerEntrypoint/);
  assert.match(labs, /"main": "src\/cortex-services.ts"/);
  assert.doesNotMatch(labs, /MCP_PROVENANCE_READER/);
});
test('denies cross tenant, unsupported repo authority, stale graph and missing nodes',async()=>{
 for(const [body,status] of [[{...input,tenant:'other'},403],[{...input,node_kind:'mission'},422],[{...input,graph_version:'1'},409],[{...input,node_id:'goal_missing'},404],[{...input,extra:true},400],[{...input,max_bytes:2},413]] as const)
  assert.equal((await handleCortexProvenanceRead(request(body),store,allowed,now)).status,status);
});
test('fails closed on changed head, unavailable D1 and oversized streamed input',async()=>{
 let reads=0;assert.equal((await handleCortexProvenanceRead(request(input),{...store,readHead:async()=>++reads===1?head:{...head,graphVersion:3}},allowed,now)).status,409);
 assert.equal((await handleCortexProvenanceRead(request(input),{...store,readNodes:async()=>{throw new Error('D1 unavailable');}},allowed,now)).status,503);
 assert.equal((await handleCortexProvenanceRead(request({...input,padding:'x'.repeat(4096)}),store,allowed,now)).status,413);
});
