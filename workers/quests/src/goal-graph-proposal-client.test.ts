// Phase H · goal-graph proposal client tests.
//
// Verifies CAS + fail-closed approval against the REAL compiler. No D1, no
// network, no writes: the store is an in-memory spy that records whether
// commit() was ever called. The core guarantee under test is that commit()
// is NEVER reached without an explicit opt-in AND a matching founder approval.
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildNode } from './goal-graph/identity.ts';
import { makeGoalGraphHead } from './goal-graph/compiler.ts';
import type { GoalGraphNode } from './goal-graph/types.ts';
import type {
  GoalGraphApproval,
  GoalGraphCommitInput,
  GoalGraphCommitResult,
  GoalGraphStoreLike,
} from './goal-graph-store.ts';
import { proposeGoalGraph } from './goal-graph-proposal-client.ts';

const TENANT = 'tenant-alpha';
const NOW = '2026-07-23T00:00:00.000Z';
const EXPIRES = '2026-07-23T01:00:00.000Z';

function node(externalId: string, overrides: Partial<GoalGraphNode> = {}): GoalGraphNode {
  return buildNode({
    tenantId: TENANT,
    namespace: 'manual',
    externalId,
    parentNodeId: null,
    scope: 'macro',
    desiredState: `operate ${externalId}`,
    currentState: 'draft',
    owner: 'founder',
    nextAction: 'review',
    waitCondition: null,
    proofRequired: true,
    reviewAt: null,
    status: 'active',
    sourceRef: `test:${externalId}`,
    sourceDigest: `sha256:${'1'.repeat(64)}`,
    graphVersion: 1,
    metadata: {},
    now: NOW,
    ...overrides,
  });
}

/** In-memory store spy. Records commit calls; performs no persistence. */
function spyStore(result: GoalGraphCommitResult) {
  const calls: GoalGraphCommitInput[] = [];
  const store: GoalGraphStoreLike = {
    async readHead() {
      return null;
    },
    async readNodes() {
      return [];
    },
    async commit(input) {
      calls.push(input);
      return result;
    },
  };
  return { store, calls };
}

const baseProposal = (proposedNodes: readonly GoalGraphNode[]) => ({
  tenantId: TENANT,
  actualHead: null,
  currentNodes: [] as GoalGraphNode[],
  proposedNodes,
  graphVersion: 1,
  sourceRef: 'vault:goal/root',
  sourceDigest: `sha256:${'2'.repeat(64)}`,
  now: NOW,
});

test('propose-only (no commit flag) compiles but never touches the store', async () => {
  const { store, calls } = spyStore({ status: 'committed', replayed: false, changeDigest: 'x', head: {} as never });
  const res = await proposeGoalGraph(baseProposal([node('root')]), { store });
  assert.equal(res.status, 'needs-approval');
  assert.equal(calls.length, 0, 'commit must not be called without opt-in');
});

test('CAS miss: stale expectedHeadDigest vs fresh actualHead -> stale, no store call', async () => {
  const { store, calls } = spyStore({ status: 'committed', replayed: false, changeDigest: 'x', head: {} as never });
  const root = node('root');
  // The caller built its proposal against an OLD head digest...
  const staleBaseline = `sha256:${'9'.repeat(64)}`;
  // ...but the freshly-read head has since moved to a different digest.
  const freshHead = makeGoalGraphHead(TENANT, [root], 1, NOW, 'd1:goal-graph:1');
  const stale = await proposeGoalGraph(
    {
      ...baseProposal([node('root'), node('added')]),
      expectedHeadDigest: staleBaseline,
      actualHead: freshHead,
      currentNodes: [root],
    },
    { commit: true, store },
  );
  assert.equal(stale.status, 'stale');
  if (stale.status === 'stale') {
    assert.equal(stale.expectedHeadDigest, staleBaseline);
    assert.equal(stale.actualHeadDigest, freshHead.graphDigest);
  }
  assert.equal(calls.length, 0, 'a stale (CAS-miss) proposal must not reach the store');
});

test('noop: matching head with no delta returns noop, never commits', async () => {
  const { store, calls } = spyStore({ status: 'committed', replayed: false, changeDigest: 'x', head: {} as never });
  const root = node('root');
  const head = makeGoalGraphHead(TENANT, [root], 0, NOW, 'd1:goal-graph:0');
  const res = await proposeGoalGraph(
    { ...baseProposal([root]), actualHead: head, currentNodes: [root] },
    { commit: true, store },
  );
  assert.equal(res.status, 'noop');
  assert.equal(calls.length, 0);
});

test('commit requested WITHOUT approval fails closed (needs-approval, no store call)', async () => {
  const { store, calls } = spyStore({ status: 'committed', replayed: false, changeDigest: 'x', head: {} as never });
  const res = await proposeGoalGraph(baseProposal([node('root')]), { commit: true, store });
  assert.equal(res.status, 'needs-approval');
  if (res.status === 'needs-approval') assert.match(res.reason, /founder approval required/);
  assert.equal(calls.length, 0);
});

test('commit with a NON-matching approval digest fails closed', async () => {
  const { store, calls } = spyStore({ status: 'committed', replayed: false, changeDigest: 'x', head: {} as never });
  const approval: GoalGraphApproval = {
    tenantId: TENANT,
    changeDigest: 'sha256:wrong-digest',
    intentVersion: 1,
    approverId: 'founder',
    decision: 'approved',
    expiresAt: EXPIRES,
    nonce: 'n1',
  };
  const res = await proposeGoalGraph(baseProposal([node('root')]), { commit: true, store, approval });
  assert.equal(res.status, 'needs-approval');
  if (res.status === 'needs-approval') assert.match(res.reason, /changeDigest/);
  assert.equal(calls.length, 0, 'mismatched approval must not reach the store');
});

test('commit with a rejected decision fails closed', async () => {
  const { store, calls } = spyStore({ status: 'committed', replayed: false, changeDigest: 'x', head: {} as never });
  // Compile once to learn the real changeDigest, then attach a 'rejected' decision.
  const compiled = await proposeGoalGraph(baseProposal([node('root')]), {});
  assert.equal(compiled.status, 'needs-approval');
  const digest = compiled.status === 'needs-approval' ? compiled.changeSet.changeDigest : '';
  const approval: GoalGraphApproval = {
    tenantId: TENANT, changeDigest: digest, intentVersion: 1, approverId: 'founder',
    decision: 'rejected', expiresAt: EXPIRES, nonce: 'n1',
  };
  const res = await proposeGoalGraph(baseProposal([node('root')]), { commit: true, store, approval });
  assert.equal(res.status, 'needs-approval');
  if (res.status === 'needs-approval') assert.match(res.reason, /not 'approved'/);
  assert.equal(calls.length, 0);
});

test('commit with a MATCHING founder approval reaches the store exactly once', async () => {
  const committed: GoalGraphCommitResult = {
    status: 'committed', replayed: false, changeDigest: 'set-by-store', head: {} as never,
  };
  const { store, calls } = spyStore(committed);
  // Learn the real changeDigest from a propose-only pass.
  const pre = await proposeGoalGraph(baseProposal([node('root')]), {});
  assert.equal(pre.status, 'needs-approval');
  const digest = pre.status === 'needs-approval' ? pre.changeSet.changeDigest : '';
  const approval: GoalGraphApproval = {
    tenantId: TENANT, changeDigest: digest, intentVersion: 1, approverId: 'founder',
    decision: 'approved', expiresAt: EXPIRES, nonce: 'n1',
  };
  const res = await proposeGoalGraph(baseProposal([node('root')]), { commit: true, store, approval });
  assert.equal(res.status, 'committed');
  assert.equal(calls.length, 1, 'store.commit called exactly once');
  assert.equal(calls[0].tenantId, TENANT);
  assert.equal(calls[0].changeSet.changeDigest, digest);
  assert.equal(calls[0].approval.decision, 'approved');
});

test('commit requested without a store fails closed even with an approval', async () => {
  const pre = await proposeGoalGraph(baseProposal([node('root')]), {});
  const digest = pre.status === 'needs-approval' ? pre.changeSet.changeDigest : '';
  const approval: GoalGraphApproval = {
    tenantId: TENANT, changeDigest: digest, intentVersion: 1, approverId: 'founder',
    decision: 'approved', expiresAt: EXPIRES, nonce: 'n1',
  };
  const res = await proposeGoalGraph(baseProposal([node('root')]), { commit: true, approval });
  assert.equal(res.status, 'needs-approval');
  if (res.status === 'needs-approval') assert.match(res.reason, /no store/);
});
