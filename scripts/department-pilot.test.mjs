import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cli = new URL('./department-pilot.mjs', import.meta.url).pathname;
const now = '2026-11-03T16:00:00Z';
const node = (id) => ({ nodeId: id, tenantId: 'cambium', namespace: 'founder-bookkeeping', workObjectId: 'sapling:lumen-bar',
  parentNodeId: 'company', pinnedLoadoutId: null, metadata: { facet: 'task', stage: 'website', prerequisiteIds: '' },
  status: 'active', waitCondition: null, reviewAt: null, desiredState: 'Reviewed outcome', currentState: 'Awaiting review',
  sourceRef: 'fixture:owner', owner: 'founder', nextAction: null });

test('department pilot CLI forwards the served root so an eligible root-linked task reaches daily work', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'department-pilot-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const graph = { schema: 'cambium.founder.bookkeeping-graph.v1', tenantId: 'cambium', servedAt: now,
    head: { graphDigest: 'a'.repeat(64) }, rootId: 'company', nodes: [node('a')] };
  writeFileSync(join(dir, 'graph.json'), JSON.stringify(graph));
  writeFileSync(join(dir, 'eligibility.json'), JSON.stringify({ sourceRef: 'fixture:gsd-owner', taskIds: ['a'] }));
  const out = join(dir, 'packet.json');
  execFileSync(process.execPath, [cli, '--graph', join(dir, 'graph.json'), '--out', out, '--now', now,
    '--eligibility', join(dir, 'eligibility.json')], { stdio: 'pipe' });
  const packet = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(packet.input.graph.rootId, 'company');
  const product = packet.projection.products.find((p) => p.nodes.some((n) => n.nodeId === 'a'));
  assert.deepEqual(product.daily.map((n) => n.nodeId), ['a']);
  assert.equal(packet.projection.executionGranted, false);
});
