import assert from 'node:assert/strict';
import test from 'node:test';
import { makeGoalGraphHead } from './goal-graph/compiler.ts';
import { buildNode } from './goal-graph/identity.ts';
import type { GoalGraphHead, GoalGraphNode } from './goal-graph/types.ts';
import { PORTFOLIO_CATALOG } from './portfolio-catalog.ts';
import { resolvePlexusWorkReference } from './plexus-work-reference.ts';
import type { PlexusWorkReferenceInput } from './plexus-work-reference.ts';

const NOW = '2026-09-05T12:00:00.000Z';
const EXPIRES = '2026-09-05T12:05:00.000Z';
const WORK = 'sapling:cambium';
const TENANT = 'cambium';

function node(overrides: Partial<GoalGraphNode> = {}): GoalGraphNode {
  return buildNode({
    tenantId: TENANT, namespace: 'manual', externalId: 'root', parentNodeId: null,
    workObjectId: WORK, workObjectKind: 'sapling', pinnedLoadoutId: null,
    scope: 'macro', desiredState: 'PRIVATE_GOAL_BODY', currentState: 'PRIVATE_CURRENT_BODY',
    owner: 'PRIVATE_OWNER', nextAction: 'PRIVATE_NEXT_ACTION', waitCondition: null,
    proofRequired: true, reviewAt: null, status: 'active', sourceRef: 'private:source',
    sourceDigest: 'private:source-digest', graphVersion: 1, metadata: { secret: 'PRIVATE_METADATA' },
    now: NOW, ...overrides,
  });
}

function harness(initialNodes = [node()]) {
  const state = {
    nodes: initialNodes,
    head: makeGoalGraphHead(TENANT, initialNodes, 2, NOW, 'private:head-source', 'private:head-digest') as GoalGraphHead | null,
  };
  const calls: string[] = [];
  const store = {
    async readHead(tenant: string) { calls.push(`head:${tenant}`); return state.head; },
    async readNodes(tenant: string) { calls.push(`nodes:${tenant}`); return state.nodes; },
  };
  Object.defineProperty(store, 'commit', { get() { throw new Error('writer must never be accessed'); } });
  const input: PlexusWorkReferenceInput = {
    request: {
      tenantId: TENANT, workObjectId: WORK, workObjectKind: 'sapling', nodeId: initialNodes[0].nodeId,
      expectedGraphDigest: state.head!.graphDigest, expectedGraphVersion: state.head!.graphVersion,
    },
    principal: { id: 'member-1', tenant: TENANT, role: 'team', allow: [], createdBy: 'trusted-test-adapter' },
    resourceGrant: {
      schema: 'plexus.work-reference-resource-grant.v1', principalId: 'member-1', tenantId: TENANT,
      workObjectIds: [WORK], expiresAt: EXPIRES,
    },
    store, clock: () => NOW,
  };
  function refreshHead() {
    state.head = makeGoalGraphHead(TENANT, state.nodes, 2, NOW, 'private:head-source', 'private:head-digest');
    input.request.expectedGraphDigest = state.head.graphDigest;
  }
  return { state, calls, store, input, refreshHead };
}

async function rejected(input: PlexusWorkReferenceInput, code: string) {
  assert.deepEqual(await resolvePlexusWorkReference(input), { status: 'rejected', code });
}

test('active committed reference emits only the versioned bounded receipt for team and founder', async () => {
  for (const role of ['team', 'founder'] as const) {
    const h = harness();
    h.input.principal.role = role;
    assert.deepEqual(await resolvePlexusWorkReference(h.input), {
      schema: 'plexus.work-reference.v1', status: 'graph-reference-verified', tenantId: TENANT,
      workObjectId: WORK, workObjectKind: 'sapling', nodeId: h.state.nodes[0].nodeId,
      graphDigest: h.state.head!.graphDigest, graphVersion: 2, checkedAt: NOW,
    });
    assert.deepEqual(h.calls, [`head:${TENANT}`, `nodes:${TENANT}`, `head:${TENANT}`]);
  }
});

test('catalog classifies client programs as branches and internal programs as programs, not admission', async () => {
  for (const [prefix, kind] of [['branch:', 'branch'], ['program:', 'program']] as const) {
    const work = PORTFOLIO_CATALOG.records.find((entry) => entry.workId.startsWith(prefix))!.workId;
    const h = harness([node({ workObjectId: work, workObjectKind: kind })]);
    h.input.request.workObjectId = work;
    h.input.request.workObjectKind = kind;
    h.input.resourceGrant.workObjectIds = [work];
    assert.equal((await resolvePlexusWorkReference(h.input)).status, 'graph-reference-verified');
  }
});

test('explicit node ID disambiguates legitimate multiple goals for one WorkObject', async () => {
  const root = node();
  const child = node({ externalId: 'child', parentNodeId: root.nodeId, scope: 'meso' });
  const h = harness([child, root]);
  assert.equal((await resolvePlexusWorkReference(h.input)).status, 'graph-reference-verified');
});

test('malformed requests and aliases fail before reading the graph', async () => {
  const cases = [
    { tenantId: '*' }, { tenantId: 'other tenant' }, { workObjectId: 'cambium' },
    { workObjectId: 'sapling:Cambium' }, { workObjectId: 'sapling:cambium ' },
    { workObjectKind: 'branch' }, { nodeId: '../ node' }, { nodeId: '' },
    { expectedGraphDigest: `sha256:${'a'.repeat(64)}` }, { expectedGraphDigest: '' },
    { expectedGraphVersion: 0 }, { expectedGraphVersion: NaN }, { expectedGraphVersion: 1.5 },
  ];
  for (const patch of cases) {
    const h = harness();
    Object.assign(h.input.request, patch);
    await rejected(h.input, 'invalid_request');
    assert.deepEqual(h.calls, []);
  }
  await rejected(null as unknown as PlexusWorkReferenceInput, 'invalid_request');
});

test('unknown canonical-looking IDs cannot become known by appearing in a graph and grant', async () => {
  const unknown = 'sapling:not-in-the-catalog';
  const h = harness([node({ workObjectId: unknown })]);
  h.input.request.workObjectId = unknown;
  h.input.resourceGrant.workObjectIds = [unknown];
  await rejected(h.input, 'unknown_work_object');
  assert.deepEqual(h.calls, []);
});

test('wildcard, cross-tenant, consultant, expired and malformed principals are denied before store access', async () => {
  for (const patch of [
    { tenant: '*' }, { tenant: 'other' }, { role: 'consultant' }, { role: 'admin' }, { id: '' },
    { createdBy: '' }, { allow: null }, { allow: [3] }, { expiresAt: NOW },
    { expiresAt: '2026-09-05T11:59:59Z' }, { expiresAt: 'not-a-time' },
    { expiresAt: '2026-02-30T00:00:00.000Z' },
  ]) {
    const h = harness();
    Object.assign(h.input.principal, patch);
    await rejected(h.input, 'principal_denied');
    assert.deepEqual(h.calls, []);
  }
});

test('principal optional expiry supports canonical second precision and denies equality', async () => {
  const h = harness();
  h.input.principal.expiresAt = '2026-09-05T12:00:01Z';
  assert.equal((await resolvePlexusWorkReference(h.input)).status, 'graph-reference-verified');
  h.input.principal.expiresAt = '2026-09-05T12:00:00Z';
  await rejected(h.input, 'principal_denied');
});

test('server resource grant must exactly bind actor, tenant, scope, schema and live expiry', async () => {
  for (const patch of [
    { schema: 'other' }, { principalId: 'member-2' }, { tenantId: '*' }, { tenantId: 'other' },
    { expiresAt: undefined }, { expiresAt: NOW }, { expiresAt: 'invalid' },
    { workObjectIds: [] }, { workObjectIds: ['*'] }, { workObjectIds: [WORK, WORK] },
    { workObjectIds: ['sapling:another-project'] }, { workObjectIds: [WORK, 7] },
  ]) {
    const h = harness();
    Object.assign(h.input.resourceGrant, patch);
    h.input.principal.allow = [WORK]; // UI subsections never substitute for resource scope.
    await rejected(h.input, 'resource_denied');
    assert.deepEqual(h.calls, []);
  }
  const h = harness();
  h.input.resourceGrant = null as unknown as PlexusWorkReferenceInput['resourceGrant'];
  await rejected(h.input, 'resource_denied');
});

test('grant and principal expiry are rechecked after the asynchronous reads', async () => {
  for (const expiry of ['grant', 'principal']) {
    const h = harness();
    if (expiry === 'principal') h.input.principal.expiresAt = EXPIRES;
    if (expiry === 'principal') h.input.resourceGrant.expiresAt = '2026-09-05T12:10:00Z';
    let reads = 0;
    h.input.clock = () => reads++ === 0 ? NOW : EXPIRES;
    await rejected(h.input, expiry === 'grant' ? 'resource_denied' : 'principal_denied');
  }
});

test('invalid, throwing and backwards clocks fail closed', async () => {
  for (const clock of [() => 'not-time', () => { throw Error('clock'); }, () => '2026-02-30T00:00:00Z']) {
    const h = harness();
    h.input.clock = clock;
    await rejected(h.input, 'clock_invalid');
    assert.deepEqual(h.calls, []);
  }
  const h = harness();
  let reads = 0;
  h.input.clock = () => reads++ === 0 ? NOW : '2026-09-05T11:59:59Z';
  await rejected(h.input, 'clock_invalid');
});

test('missing stores and read failures yield bounded errors without leaking diagnostics', async () => {
  const h = harness();
  h.input.store = null;
  await rejected(h.input, 'store_unavailable');
  for (const operation of ['readHead', 'readNodes'] as const) {
    const h = harness();
    h.store[operation] = async () => { throw Error('SECRET_CONNECTION_BODY'); };
    await rejected(h.input, 'store_unavailable');
  }
  const missing = harness();
  missing.state.head = null;
  await rejected(missing.input, 'graph_missing');
});

test('stale expected digest or version stops after the first head read', async () => {
  for (const patch of [{ expectedGraphDigest: '0'.repeat(64) }, { expectedGraphVersion: 1 }]) {
    const h = harness();
    Object.assign(h.input.request, patch);
    await rejected(h.input, 'stale_graph');
    assert.deepEqual(h.calls, [`head:${TENANT}`]);
  }
});

test('malformed or cross-tenant committed heads fail closed', async () => {
  for (const patch of [
    { tenantId: 'other' }, { graphVersion: 0 }, { graphDigest: 'bad' },
    { nodeIds: [] }, { nodeIds: ['bad id'] }, { committedAt: 'invalid' },
    { committedAt: EXPIRES }, { sourceRef: 42 },
  ]) {
    const h = harness();
    Object.assign(h.state.head!, patch);
    await rejected(h.input, 'graph_invalid');
  }
});

test('head changes around node reads reject even when an object was mutated in place', async () => {
  for (const field of ['graphVersion', 'graphDigest', 'committedAt', 'sourceRef', 'sourceDigest', 'nodeIds']) {
    const h = harness();
    h.store.readNodes = async () => {
      Object.assign(h.state.head!, {
        [field]: field === 'graphVersion' ? 3 : field === 'graphDigest' ? '1'.repeat(64)
          : field === 'committedAt' ? '2026-09-05T11:59:59Z'
            : field === 'nodeIds' ? ['another-node'] : 'changed',
      });
      return h.state.nodes;
    };
    await rejected(h.input, 'graph_changed');
  }
});

test('head disappearance or final read failure cannot verify an earlier head', async () => {
  const h = harness();
  h.store.readNodes = async () => { h.state.head = null; return h.state.nodes; };
  await rejected(h.input, 'graph_invalid');
  const failed = harness();
  let reads = 0;
  failed.store.readHead = async () => {
    if (reads++) throw Error('private error');
    return failed.state.head;
  };
  await rejected(failed.input, 'store_unavailable');
});

test('recomputed canonical head detects altered bodies and inconsistent node inventories', async () => {
  for (const mutate of [
    (h: ReturnType<typeof harness>) => { h.state.nodes[0].desiredState = 'tampered'; },
    (h: ReturnType<typeof harness>) => { h.state.head!.nodeIds = ['different-node']; },
    (h: ReturnType<typeof harness>) => { h.state.nodes = []; },
    (h: ReturnType<typeof harness>) => { h.state.nodes[0].tenantId = 'other'; },
    (h: ReturnType<typeof harness>) => { h.state.nodes[0].graphVersion = 3; },
  ]) {
    const h = harness();
    mutate(h);
    await rejected(h.input, 'graph_invalid');
  }
});

test('exact duplicate or conflicting node IDs reject rather than collapsing matches', async () => {
  for (const changed of [false, true]) {
    const first = node();
    const second = { ...first, desiredState: changed ? 'conflict' : first.desiredState };
    const h = harness([first, second]);
    await rejected(h.input, 'graph_invalid');
  }
});

test('malformed nodes and operational anchor pairs reject even with a recomputed head', async () => {
  for (const patch of [
    { nodeId: 'bad id' }, { namespace: '' }, { metadata: null }, { metadata: new Date(NOW) },
    { metadata: { invalid: NaN } }, { owner: 12 },
    { proofRequired: 'true' }, { status: 'admitted' }, { status: ['active'] },
    { scope: 'unknown' }, { scope: ['macro'] },
    { createdAt: 'bad' }, { updatedAt: EXPIRES }, { reviewAt: 'bad' },
    { workObjectId: 'cambium' }, { workObjectKind: 'branch' }, { workObjectKind: null },
    { pinnedLoadoutId: 'bad loadout' }, { pinnedLoadoutId: 'x'.repeat(129) }, { graphVersion: 0 },
  ]) {
    const h = harness();
    Object.assign(h.state.nodes[0], patch);
    h.refreshHead();
    await rejected(h.input, 'graph_invalid');
  }
});

test('missing parents, multiple roots and cycles are inconsistent graph references', async () => {
  const root = node();
  for (const extra of [
    node({ externalId: 'orphan', parentNodeId: 'absent' }),
    node({ externalId: 'second-root' }),
  ]) {
    const h = harness([root, extra]);
    await rejected(h.input, 'graph_invalid');
  }
  const a = node({ externalId: 'a', parentNodeId: root.nodeId });
  const b = node({ externalId: 'b', parentNodeId: a.nodeId });
  a.parentNodeId = b.nodeId;
  await rejected(harness([root, a, b]).input, 'graph_invalid');
});

test('missing or mismatched requested nodes do not authorize another node by WorkObject alone', async () => {
  const h = harness();
  h.input.request.nodeId = 'absent-node';
  await rejected(h.input, 'node_missing');
  const unanchored = harness([node({ workObjectId: null, workObjectKind: null })]);
  await rejected(unanchored.input, 'node_mismatch');
  const other = harness([node({ workObjectId: 'program:cambium-operating-fabric', workObjectKind: 'program' })]);
  await rejected(other.input, 'node_mismatch');
});

test('only active target nodes qualify; draft, blocked, paused and retired remain unverified', async () => {
  for (const status of ['draft', 'blocked', 'paused', 'retired'] as const) {
    const h = harness([node({ status })]);
    await rejected(h.input, 'node_inactive');
  }
});

test('unrelated inactive nodes and pinned loadouts do not imply or require execution authority', async () => {
  const root = node({ pinnedLoadoutId: 'loadout:cambium' });
  const child = node({ externalId: 'child', parentNodeId: root.nodeId, status: 'retired' });
  const h = harness([root, child]);
  const result = await resolvePlexusWorkReference(h.input);
  assert.equal(result.status, 'graph-reference-verified');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|private:|loadout|admitted|executable|token|allow|grant|metadata|owner/);
});

test('each call reads live state; no network, writer, or cached receipt is used', async () => {
  const h = harness();
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls++; throw Error('no network'); };
  try {
    assert.equal((await resolvePlexusWorkReference(h.input)).status, 'graph-reference-verified');
    const previousDigest = h.input.request.expectedGraphDigest;
    h.state.nodes[0].status = 'retired';
    h.refreshHead();
    h.input.request.expectedGraphDigest = previousDigest;
    await rejected(h.input, 'stale_graph'); // Identical request cannot reuse its earlier success.
    h.input.request.expectedGraphDigest = h.state.head!.graphDigest;
    await rejected(h.input, 'node_inactive');
    assert.equal(h.calls.length, 7);
    assert.equal(networkCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('async input mutation cannot replace the validated actor, grant or target', async () => {
  const h = harness();
  h.store.readNodes = async () => {
    h.input.request.tenantId = 'other';
    h.input.request.workObjectId = 'sapling:other';
    h.input.principal.id = 'other-member';
    h.input.resourceGrant.workObjectIds = ['sapling:other'];
    return h.state.nodes;
  };
  const result = await resolvePlexusWorkReference(h.input);
  assert.equal(result.status, 'graph-reference-verified');
  if (result.status === 'graph-reference-verified') {
    assert.equal(result.tenantId, TENANT);
    assert.equal(result.workObjectId, WORK);
  }
  assert.deepEqual(h.calls, [`head:${TENANT}`, `head:${TENANT}`]);
});
