import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNode } from './goal-graph/identity.ts';
import { compileGoalGraph, makeGoalGraphHead } from './goal-graph/compiler.ts';
import { renewFounderProposal } from './founder-renewal.ts';
import type { GoalGraphNode } from './goal-graph/types.ts';

const NOW = '2026-10-25T00:00:00.000Z', EXPIRES = '2026-10-25T00:15:00.000Z';
function node(id: string, parentNodeId: string | null = null): GoalGraphNode {
  return buildNode({ tenantId: 'cambium', namespace: 'manual', externalId: id, parentNodeId,
    scope: parentNodeId ? 'micro' : 'macro', desiredState: id, currentState: 'draft', owner: 'founder',
    nextAction: 'review', waitCondition: null, proofRequired: true, reviewAt: null, status: 'active',
    sourceRef: 'test:real-source-fixture', sourceDigest: 'a'.repeat(64), graphVersion: 1, metadata: {}, now: NOW });
}
function fixture(current: 'unrelated' | 'conflict' | 'applied') {
  const root = node('root'), target = node('pending child', root.nodeId), other = node('other child', root.nodeId);
  const initialHead = makeGoalGraphHead('cambium', [root], 1, NOW);
  const original = compileGoalGraph({ tenantId: 'cambium', expectedHeadDigest: initialHead.graphDigest, actualHead: initialHead,
    currentNodes: [root], proposedNodes: [root, target], graphVersion: 2, sourceRef: 'telegram:original-fixture', sourceDigest: 'b'.repeat(64), now: NOW });
  assert.equal(original.status, 'compiled'); if (original.status !== 'compiled') throw Error('fixture');
  const nodes = current === 'unrelated' ? [root, other] : [root, { ...target, ...(current === 'conflict' ? { desiredState: 'concurrent conflicting edit' } : {}) }];
  const head = makeGoalGraphHead('cambium', nodes, 2, NOW);
  let writes = 0;
  const p = { id: `cambium:${original.changeSet.changeDigest}`, tenantId: 'cambium', founderId: 'access:test', version: 1,
    nonce: 'original-nonce', expiresAt: EXPIRES, summary: 'review target', changeSet: original.changeSet };
  const input = { proposalId: p.id, version: p.version, nonce: p.nonce, expiresAt: p.expiresAt, changeDigest: p.changeSet.changeDigest };
  let saved: Record<string, unknown> | null = null;
  const deps = { context: { tenantId: 'cambium', founderId: 'access:test', channel: 'curious' as const }, input, proposal: p,
    task: { status: 'stale', nodeId: target.nodeId }, now: () => EXPIRES,
    store: { readDecisionReceipt: async () => null, readHead: async () => head, readNodes: async () => nodes,
      commit: async () => { throw Error('must never write D1'); }, reject: async () => { throw Error('must never reject'); } },
    persist: async (input: { task: Record<string, unknown> }) => { writes++; saved = input.task; return { kind: 'ready', task: input.task, duplicate: false }; },
  };
  return { deps, target, head, saved: () => saved, writes: () => writes };
}
test('renewal rebases exact pending delta onto current head while preserving unrelated nodes', async () => {
  const h = fixture('unrelated');
  const result = await renewFounderProposal(h.deps);
  assert.equal(result.status, 'renewed');
  const task = h.saved() as any;
  assert.equal(task.expectedHeadDigest, h.head.graphDigest);
  assert.equal(task.graphVersion, 3);
  assert.deepEqual(task.changeSet.nodesToRemove, []);
  assert.deepEqual(task.changeSet.nodesToUpdate, []);
  assert.equal(task.changeSet.nodesToCreate.length, 1);
  assert.equal(task.changeSet.nodesToCreate[0].nodeId, h.target.nodeId);
  assert.equal(task.changeSet.nodesToCreate[0].desiredState, h.target.desiredState);
  assert.match(task.sourceRef, /^founder-renewal:/);
  assert.equal(h.writes(), 1);
});
test('renewal refuses conflicting existing target edits and does not persist a proposal', async () => {
  const h = fixture('conflict');
  assert.equal((await renewFounderProposal(h.deps)).status, 'conflict');
  assert.equal(h.writes(), 0);
});
test('renewal reports already applied intended state without another pending revision', async () => {
  const h = fixture('applied');
  assert.equal((await renewFounderProposal(h.deps)).status, 'already_applied');
  assert.equal(h.writes(), 0);
});
test('renewal refuses a head that moves while reading its current nodes', async () => {
  const h = fixture('unrelated'); let reads = 0;
  h.deps.store.readHead = async () => ({ ...h.head, graphDigest: ++reads === 1 ? h.head.graphDigest : 'changed' });
  assert.equal((await renewFounderProposal(h.deps)).status, 'unknown');
  assert.equal(h.writes(), 0);
});
