import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { compileGoalGraph } from './goal-graph/compiler.ts';
import { buildNode } from './goal-graph/identity.ts';
import {
  canonicalizeGoalGraphApproval,
  d1GoalGraphStore,
  goalGraphApprovalDigest,
} from './goal-graph-store.ts';
import type { GoalGraphD1DatabaseLike, GoalGraphD1StatementLike, GoalGraphApproval } from './goal-graph-store.ts';
import type { GoalGraphNode } from './goal-graph/types.ts';

const TENANT = 'tenant-alpha';
const NOW = '2026-07-23T00:00:00.000Z';
const EXPIRES = '2026-07-23T01:00:00.000Z';

class SqliteD1 implements GoalGraphD1DatabaseLike {
  readonly db = new DatabaseSync(':memory:');

  prepare(sql: string): GoalGraphD1StatementLike {
    const statement = this.db.prepare(sql);
    let values: unknown[] = [];
    const api: GoalGraphD1StatementLike = {
      bind: (...next: unknown[]) => {
        values = next;
        return api;
      },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: statement.all(...values) as T[] }),
      run: async () => {
        const result = statement.run(...values);
        return { meta: { changes: Number(result.changes) } };
      },
    };
    return api;
  }

  async batch(statements: GoalGraphD1StatementLike[]): Promise<unknown[]> {
    this.db.exec('BEGIN');
    try {
      const results: unknown[] = [];
      for (const statement of statements) results.push(await statement.run());
      this.db.exec('COMMIT');
      return results;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

async function harness() {
  const db = new SqliteD1();
  db.db.exec(await readFile(new URL('../migrations/0007_goal_graph.sql', import.meta.url), 'utf8'));
  db.db.exec(await readFile(new URL('../migrations/0009_goal_graph_operational_anchors.sql', import.meta.url), 'utf8'));
  return { db, store: d1GoalGraphStore(db) };
}

function rootNode(overrides: Partial<GoalGraphNode> = {}): GoalGraphNode {
  return buildNode({
    tenantId: TENANT,
    namespace: 'manual',
    externalId: 'root',
    parentNodeId: null,
    scope: 'macro',
    desiredState: 'operate Cambium',
    currentState: 'draft',
    owner: 'founder',
    nextAction: 'review',
    waitCondition: null,
    proofRequired: true,
    reviewAt: null,
    status: 'active',
    sourceRef: 'test:root',
    sourceDigest: `sha256:${'1'.repeat(64)}`,
    graphVersion: 1,
    metadata: {},
    now: NOW,
    ...overrides,
  });
}

function proposal(nodes: readonly GoalGraphNode[], expectedHeadDigest: string | null, graphVersion: number, sourceRef = 'test:proposal') {
  const result = compileGoalGraph({
    tenantId: TENANT,
    expectedHeadDigest,
    actualHead: expectedHeadDigest ? { tenantId: TENANT, graphVersion: graphVersion - 1, graphDigest: expectedHeadDigest, nodeIds: nodes.map((node) => node.nodeId), sourceRef: null, sourceDigest: null, committedAt: NOW } : null,
    currentNodes: nodes,
    proposedNodes: nodes,
    graphVersion,
    sourceRef,
    sourceDigest: `sha256:${'2'.repeat(64)}`,
    now: NOW,
  });
  assert.equal(result.status, 'compiled');
  if (result.status !== 'compiled') throw new Error('proposal did not compile');
  return result.changeSet;
}

function approval(changeDigest: string, overrides: Partial<GoalGraphApproval> = {}): GoalGraphApproval {
  const value = {
    tenantId: TENANT,
    changeDigest,
    intentVersion: 1,
    approverId: 'founder',
    decision: 'approved' as const,
    expiresAt: EXPIRES,
    nonce: `nonce-${changeDigest.slice(0, 8)}`,
    ...overrides,
  };
  return {
    ...value,
    canonical: canonicalizeGoalGraphApproval(value),
    approvalDigest: goalGraphApprovalDigest(value),
  };
}

test('approved CAS commit persists one revision and reads it back', async () => {
  const { db, store } = await harness();
  const root = rootNode();
  const changeSet = proposal([], null, 1);
  // The compiler needs the proposed root separately for the initial revision.
  const initial = compileGoalGraph({
    tenantId: TENANT, expectedHeadDigest: null, actualHead: null, currentNodes: [],
    proposedNodes: [root], graphVersion: 1, sourceRef: 'test:root', sourceDigest: root.sourceDigest, now: NOW,
  });
  assert.equal(initial.status, 'compiled');
  if (initial.status !== 'compiled') return;
  const result = await store.commit({ tenantId: TENANT, changeSet: initial.changeSet, approval: approval(initial.changeSet.changeDigest), now: NOW });
  assert.equal(result.status, 'committed');
  if (result.status !== 'committed') return;
  assert.equal(result.head.graphVersion, 1);
  assert.equal((await store.readNodes(TENANT)).length, 1);
  assert.equal((await store.readNodes(TENANT))[0].nodeId, root.nodeId);
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM goal_graph_approvals').get().count, 1);
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM goal_graph_events').get().count, 1);
  void changeSet;
});

test('approved CAS commit persists exact WorkObject and loadout anchors', async () => {
  const { store } = await harness();
  const root = rootNode({
    workObjectId: 'sapling:cambium',
    workObjectKind: 'sapling',
    pinnedLoadoutId: 'loadout:cambium-runtime',
  });
  const compiled = compileGoalGraph({ tenantId: TENANT, expectedHeadDigest: null, actualHead: null, currentNodes: [], proposedNodes: [root], graphVersion: 1, sourceRef: 'test:anchor', sourceDigest: root.sourceDigest, now: NOW });
  assert.equal(compiled.status, 'compiled');
  if (compiled.status !== 'compiled') return;
  assert.equal((await store.commit({ tenantId: TENANT, changeSet: compiled.changeSet, approval: approval(compiled.changeSet.changeDigest), now: NOW })).status, 'committed');
  const [stored] = await store.readNodes(TENANT);
  assert.equal(stored.workObjectId, 'sapling:cambium');
  assert.equal(stored.workObjectKind, 'sapling');
  assert.equal(stored.pinnedLoadoutId, 'loadout:cambium-runtime');
});

test('replaying the same approved change is a durable duplicate', async () => {
  const { store } = await harness();
  const root = rootNode();
  const compiled = compileGoalGraph({ tenantId: TENANT, expectedHeadDigest: null, actualHead: null, currentNodes: [], proposedNodes: [root], graphVersion: 1, sourceRef: 'test:root', sourceDigest: root.sourceDigest, now: NOW });
  assert.equal(compiled.status, 'compiled');
  if (compiled.status !== 'compiled') return;
  const input = { tenantId: TENANT, changeSet: compiled.changeSet, approval: approval(compiled.changeSet.changeDigest), now: NOW };
  assert.equal((await store.commit(input)).status, 'committed');
  const replay = await store.commit(input);
  assert.equal(replay.status, 'duplicate');
  if (replay.status === 'duplicate') assert.equal(replay.replayed, true);
});

test('stale CAS and bootstrap races leave every authority table unchanged', async () => {
  const { db, store } = await harness();
  const firstRoot = rootNode();
  const first = compileGoalGraph({ tenantId: TENANT, expectedHeadDigest: null, actualHead: null, currentNodes: [], proposedNodes: [firstRoot], graphVersion: 1, sourceRef: 'test:first', sourceDigest: firstRoot.sourceDigest, now: NOW });
  assert.equal(first.status, 'compiled');
  if (first.status !== 'compiled') return;
  assert.equal((await store.commit({ tenantId: TENANT, changeSet: first.changeSet, approval: approval(first.changeSet.changeDigest), now: NOW })).status, 'committed');
  const before = db.db.prepare('SELECT (SELECT count(*) FROM goal_graph_heads) AS heads, (SELECT count(*) FROM goal_graph_nodes) AS nodes, (SELECT count(*) FROM goal_graph_approvals) AS approvals, (SELECT count(*) FROM goal_graph_events) AS events').get();
  const child = rootNode({ externalId: 'child', parentNodeId: firstRoot.nodeId, desiredState: 'ship' });
  const stale = compileGoalGraph({ tenantId: TENANT, expectedHeadDigest: null, actualHead: null, currentNodes: [firstRoot], proposedNodes: [firstRoot, child], graphVersion: 2, sourceRef: 'test:stale', sourceDigest: child.sourceDigest, now: NOW });
  assert.equal(stale.status, 'compiled');
  if (stale.status !== 'compiled') return;
  const result = await store.commit({ tenantId: TENANT, changeSet: stale.changeSet, approval: approval(stale.changeSet.changeDigest), now: NOW });
  assert.equal(result.status, 'stale');
  const after = db.db.prepare('SELECT (SELECT count(*) FROM goal_graph_heads) AS heads, (SELECT count(*) FROM goal_graph_nodes) AS nodes, (SELECT count(*) FROM goal_graph_approvals) AS approvals, (SELECT count(*) FROM goal_graph_events) AS events').get();
  assert.deepEqual(after, before);
});

test('approval binding rejects wrong tenant, digest, expiry, or approval digest', async () => {
  const { store } = await harness();
  const root = rootNode();
  const compiled = compileGoalGraph({ tenantId: TENANT, expectedHeadDigest: null, actualHead: null, currentNodes: [], proposedNodes: [root], graphVersion: 1, sourceRef: 'test:root', sourceDigest: root.sourceDigest, now: NOW });
  assert.equal(compiled.status, 'compiled');
  if (compiled.status !== 'compiled') return;
  const changeSet = compiled.changeSet;
  assert.equal((await store.commit({ tenantId: TENANT, changeSet, approval: approval(changeSet.changeDigest, { tenantId: 'other-tenant' }), now: NOW })).code, 'approval_tenant_mismatch');
  assert.equal((await store.commit({ tenantId: TENANT, changeSet, approval: approval(changeSet.changeDigest, { changeDigest: `sha256:${'a'.repeat(64)}` }), now: NOW })).code, 'approval_digest_mismatch');
  assert.equal((await store.commit({ tenantId: TENANT, changeSet, approval: approval(changeSet.changeDigest, { expiresAt: '2026-07-22T23:00:00.000Z' }), now: NOW })).code, 'approval_expired');
  const invalid = approval(changeSet.changeDigest);
  invalid.approvalDigest = `sha256:${'f'.repeat(64)}`;
  assert.equal((await store.commit({ tenantId: TENANT, changeSet, approval: invalid, now: NOW })).code, 'approval_digest_invalid');
});

test('store fails closed without a D1 batch primitive', async () => {
  const { store, db } = await harness();
  const root = rootNode();
  const compiled = compileGoalGraph({ tenantId: TENANT, expectedHeadDigest: null, actualHead: null, currentNodes: [], proposedNodes: [root], graphVersion: 1, sourceRef: 'test:root', sourceDigest: root.sourceDigest, now: NOW });
  assert.equal(compiled.status, 'compiled');
  if (compiled.status !== 'compiled') return;
  const noBatch = { prepare: db.prepare.bind(db) };
  const result = await d1GoalGraphStore(noBatch).commit({ tenantId: TENANT, changeSet: compiled.changeSet, approval: approval(compiled.changeSet.changeDigest), now: NOW });
  assert.deepEqual(result, { status: 'unavailable', replayed: false, changeDigest: compiled.changeSet.changeDigest, code: 'batch_required' });
});

test('approval records are immutable at the database boundary', async () => {
  const { db, store } = await harness();
  const root = rootNode();
  const compiled = compileGoalGraph({ tenantId: TENANT, expectedHeadDigest: null, actualHead: null, currentNodes: [], proposedNodes: [root], graphVersion: 1, sourceRef: 'test:root', sourceDigest: root.sourceDigest, now: NOW });
  assert.equal(compiled.status, 'compiled');
  if (compiled.status !== 'compiled') return;
  const result = await store.commit({ tenantId: TENANT, changeSet: compiled.changeSet, approval: approval(compiled.changeSet.changeDigest), now: NOW });
  assert.equal(result.status, 'committed');
  assert.throws(() => db.db.prepare('UPDATE goal_graph_approvals SET approver_id = ?').run('attacker'), /immutable/);
  assert.throws(() => db.db.prepare('DELETE FROM goal_graph_approvals').run(), /immutable/);
});
