import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFounderGraph, founderProductNodes } from './founder-graph.ts';

function fixture() {
  return { schema:'cambium.founder.bookkeeping-graph.v1', origin:'d1', tenantId:'cambium', canonicalReadback:true,
    writerAuthority:false, executionGranted:false, head:{graphVersion:7,graphDigest:'sha256:'+'a'.repeat(64)},
    rootId:'actual-root', servedAt:'2026-11-03T00:00:00Z', evidenceTrust:'operator observations', decisions:[],
    nodes:[{nodeId:'lumen',parentNodeId:'actual-root',tenantId:'cambium',namespace:'founder-bookkeeping',workObjectId:'sapling:lumen-bar',pinnedLoadoutId:null},
      {nodeId:'temperance',parentNodeId:'actual-root',tenantId:'cambium',namespace:'founder-bookkeeping',workObjectId:'program:temperance-hermes',pinnedLoadoutId:null}],
    edges:[{kind:'contains',fromId:'actual-root',toId:'lumen'},{kind:'contains',fromId:'actual-root',toId:'temperance'}] };
}
test('canonical graph preserves actual data and product filtering changes projection only', () => {
  const data=fixture(); const normalized=normalizeFounderGraph(data);
  assert.equal(normalized,data); assert.equal(founderProductNodes(normalized,'sapling:lumen-bar').length,1);
  assert.equal(founderProductNodes(normalized,'program:temperance-hermes')[0].nodeId,'temperance');
  assert.equal(data.nodes.length,2); assert.equal(data.edges.length,2);
});
test('canonical graph refuses projection data, foreign tenant and authority grants', () => {
  for (const change of [{origin:'local'},{canonicalReadback:false},{tenantId:'other'},{writerAuthority:true},{executionGranted:true}]) {
    assert.throws(()=>normalizeFounderGraph({...fixture(),...change}));
  }
});
test('canonical graph refuses duplicate, dangling and cyclic containment', () => {
  const duplicate=fixture(); duplicate.nodes[1].nodeId='lumen'; assert.throws(()=>normalizeFounderGraph(duplicate));
  const missing=fixture(); missing.nodes[0].parentNodeId='missing'; assert.throws(()=>normalizeFounderGraph(missing));
  const cyclic=fixture(); cyclic.nodes[0].parentNodeId='temperance';cyclic.nodes[1].parentNodeId='lumen';assert.throws(()=>normalizeFounderGraph(cyclic));
});
test('canonical graph refuses misleading containment links and noncanonical decisions', () => {
  const edge=fixture();edge.edges[0].fromId='temperance';assert.throws(()=>normalizeFounderGraph(edge));
  assert.throws(()=>normalizeFounderGraph({...fixture(),decisions:[{kind:'platform-published',canonicalReadback:true,decision:'approved'}]}));
});
