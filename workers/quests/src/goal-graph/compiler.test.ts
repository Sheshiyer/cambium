import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNode, resolveNodeId, validateNodeSet } from './identity.ts';
import { classifyMigration, compileGoalGraph, makeGoalGraphHead } from './compiler.ts';
import type { GoalGraphNode } from './types.ts';

const base = {
  tenantId: 'tenant-alpha', namespace: 'manual', externalId: 'root', parentNodeId: null,
  scope: 'macro' as const, desiredState: 'operate', currentState: 'draft', owner: 'founder',
  nextAction: null, waitCondition: null, proofRequired: true, reviewAt: null, status: 'active' as const,
  sourceRef: 'vault:goal/root', sourceDigest: 'sha256:root', graphVersion: 1, metadata: {},
};

function node(overrides: Partial<GoalGraphNode> = {}): GoalGraphNode {
  return buildNode({ ...base, ...overrides, now: '2026-07-23T00:00:00.000Z' });
}

test('stable identity is deterministic for external and provenance fallback identities', () => {
  assert.equal(resolveNodeId({ tenantId: 't', namespace: 'n', externalId: 'x', sourceRef: 'a', sourceDigest: 'd' }), resolveNodeId({ tenantId: 't', namespace: 'n', externalId: 'x', sourceRef: 'other', sourceDigest: 'other' }));
  assert.equal(resolveNodeId({ tenantId: 't', namespace: 'n', externalId: null, sourceRef: 'a', sourceDigest: 'd' }), resolveNodeId({ tenantId: 't', namespace: 'n', externalId: null, sourceRef: 'a', sourceDigest: 'd' }));
  assert.notEqual(resolveNodeId({ tenantId: 't', namespace: 'n', externalId: null, sourceRef: 'a', sourceDigest: 'd' }), resolveNodeId({ tenantId: 't', namespace: 'n', externalId: null, sourceRef: 'b', sourceDigest: 'd' }));
});

test('identity validation rejects collisions, cross-tenant parents, and multiple roots', () => {
  const root = node();
  assert.equal(validateNodeSet([root, { ...root, desiredState: 'different' }]).valid, false);
  assert.equal(validateNodeSet([root, node({ externalId: 'second' })]).valid, false);
  assert.equal(validateNodeSet([root, node({ externalId: 'child', parentNodeId: 'missing' })]).valid, false);
});

test('unchanged replay is a deterministic no-op', () => {
  const root = node();
  const head = makeGoalGraphHead('tenant-alpha', [root], 1, root.createdAt);
  const input = { tenantId: 'tenant-alpha', expectedHeadDigest: head.graphDigest, actualHead: head, currentNodes: [root], proposedNodes: [root], graphVersion: 1, sourceRef: 'vault:goal/root', sourceDigest: 'sha256:root', now: root.createdAt };
  const first = compileGoalGraph(input);
  const second = compileGoalGraph(input);
  assert.equal(first.status, 'compiled');
  assert.equal(second.status, 'compiled');
  assert.deepEqual(first, second);
  assert.equal(first.changeSet.isNoop, true);
});

test('stale expected head is rejected without compiling a proposal', () => {
  const root = node();
  const head = makeGoalGraphHead('tenant-alpha', [root], 2, root.createdAt);
  const result = compileGoalGraph({ tenantId: 'tenant-alpha', expectedHeadDigest: 'stale', actualHead: head, currentNodes: [root], proposedNodes: [root], graphVersion: 3, sourceRef: 'vault:goal/root', sourceDigest: 'sha256:root', now: root.createdAt });
  assert.deepEqual(result, { status: 'stale', expectedHeadDigest: 'stale', actualHeadDigest: head.graphDigest });
});

test('migration classes are explicit and deterministic', () => {
  assert.equal(classifyMigration(['a'], ['a']), 'unchanged');
  assert.equal(classifyMigration(['a'], ['b']), 'replaced');
  assert.equal(classifyMigration(['a'], []), 'retired');
  assert.equal(classifyMigration(['a'], ['b', 'c']), 'split');
  assert.equal(classifyMigration(['a', 'b'], ['c']), 'merged');
});
