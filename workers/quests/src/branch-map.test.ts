import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BRANCH_MAP_PROJECTION_SCHEMA,
  BRANCH_MAP_PROJECTION_VERSION,
  buildBranchMapProjection,
  branchMapInputFromPackets,
  canonicalizeBranchMapProjection,
  projectionDigest,
  validateBranchMapLineage,
  validateBranchMapReceipt,
} from './branch-map.ts';
import type { GoalGraphNode } from './goal-graph/types.ts';

const baseNode = (nodeId: string, status: GoalGraphNode['status'] = 'active'): GoalGraphNode => ({
  nodeId,
  tenantId: 'tenant-alpha',
  namespace: 'branch-a',
  externalId: nodeId,
  parentNodeId: null,
  scope: 'macro',
  desiredState: `desired-${nodeId}`,
  currentState: 'draft',
  owner: 'founder',
  nextAction: null,
  waitCondition: null,
  proofRequired: true,
  reviewAt: null,
  status,
  sourceRef: `telegram:tenant-alpha:${nodeId}`,
  sourceDigest: `sha256:${nodeId}`,
  graphVersion: 4,
  metadata: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const receipt = (node: GoalGraphNode, status: 'verified' | 'pending' = 'verified') => ({
  receiptId: `receipt-${node.nodeId}`,
  tenantId: node.tenantId,
  branchId: node.namespace,
  organId: 'organ-hands',
  organName: 'Hands',
  fromNodeId: null,
  toNodeId: node.nodeId,
  observedAt: '2026-01-02T00:00:00.000Z',
  evidenceRefs: [`evidence:${node.nodeId}`],
  sourceRef: node.sourceRef,
  sourceDigest: node.sourceDigest,
  graphVersion: node.graphVersion,
  status,
});

const lineage = (node: GoalGraphNode) => ({
  nodeId: node.nodeId,
  tenantId: node.tenantId,
  branchId: node.namespace,
  parentNodeId: null,
  rootNodeId: node.nodeId,
  sourceRef: node.sourceRef,
  sourceDigest: node.sourceDigest,
});

function input(overrides: Record<string, unknown> = {}) {
  const one = baseNode('node-1');
  const two = baseNode('node-2', 'draft');
  return {
    tenantId: 'tenant-alpha',
    graphVersion: 4,
    graphDigest: 'sha256:graph-revision',
    generatedAt: '2026-01-03T00:00:00.000Z',
    sourceRef: 'goal-graph:test-fixture',
    nodes: [two, one],
    branches: [{ branchId: 'branch-a', label: 'A branch', nodeIds: ['node-2', 'node-1'] }],
    receipts: [receipt(two), receipt(one)],
    lineage: [lineage(two), lineage(one)],
    ...overrides,
  };
}

test('projection is versioned, read-only, deterministic, and sorted', () => {
  const original = input();
  const first = buildBranchMapProjection(original);
  const second = buildBranchMapProjection({ ...original, nodes: [...original.nodes].reverse(), receipts: [...original.receipts].reverse(), lineage: [...original.lineage].reverse() });
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  if (!first.accepted || !second.accepted) return;
  assert.equal(first.projection.schema, BRANCH_MAP_PROJECTION_SCHEMA);
  assert.equal(first.projection.version, BRANCH_MAP_PROJECTION_VERSION);
  assert.equal(first.projection.versionLabel, 'goal-graph-branch-map@1.0.0');
  assert.equal(first.projection.projectionDigest, second.projection.projectionDigest);
  assert.equal(canonicalizeBranchMapProjection(first.projection), canonicalizeBranchMapProjection(second.projection));
  assert.equal(first.projection.projectionDigest, projectionDigest(first.projection));
  assert.deepEqual(first.projection.nodes.map((node) => node.nodeId), ['node-1', 'node-2']);
  assert.deepEqual(first.projection.branches.map((branch) => branch.branchId), ['branch-a']);
  assert.deepEqual(first.projection.branches[0].nodeIds, ['node-1', 'node-2']);
  // The source objects retain their exact ordering and status after projection.
  assert.deepEqual(original.nodes.map((node) => node.nodeId), ['node-2', 'node-1']);
  assert.equal(original.nodes[0].status, 'draft');
});

test('campaign and wiki overlays remain separate from authoritative node status', () => {
  const result = buildBranchMapProjection(input({
    campaignOverlays: [{ overlayId: 'campaign-1', branchId: 'branch-a', label: 'Campaign says paused', status: 'claimed-paused', sourceRef: 'telegram:founder-claim', observedAt: null, freshness: 'unverified' }],
    wikiOverlays: [{ overlayId: 'wiki-1', branchId: 'branch-a', label: 'Wiki is still pending', status: 'pending', sourceRef: 'wiki:branch-a', observedAt: '2026-01-02T00:00:00.000Z', freshness: 'fresh' }],
  }));
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.equal(result.projection.nodes.find((node) => node.nodeId === 'node-1')?.authoritativeStatus, 'active');
  assert.equal(result.projection.branches[0].authoritativeStatus, 'active');
  assert.equal(result.projection.overlays.campaigns[0].status, 'claimed-paused');
  assert.equal(result.projection.overlays.wiki[0].status, 'pending');
  assert.ok(result.projection.gaps.some((gap) => gap.kind === 'pending' && gap.code === 'pending_overlay'));
});

test('receipt and lineage validation preserves explicit unknown and pending gaps', () => {
  const one = baseNode('node-1');
  const malformedReceipt = { ...receipt(one), tenantId: 'tenant-other' };
  assert.equal(validateBranchMapReceipt(malformedReceipt, 'tenant-alpha', 4).valid, false);
  assert.equal(validateBranchMapLineage({ ...lineage(one), tenantId: 'tenant-other' }, 'tenant-alpha').valid, false);

  const result = buildBranchMapProjection(input({ receipts: [receipt(one, 'pending')], lineage: [] }));
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.ok(result.projection.gaps.some((gap) => gap.kind === 'pending' && gap.code === 'pending_receipt'));
  assert.ok(result.projection.gaps.some((gap) => gap.kind === 'pending' && gap.code === 'missing_receipt'));
  assert.ok(result.projection.gaps.some((gap) => gap.kind === 'unknown' && gap.code === 'missing_lineage'));
});

test('receipt transition cycles and dangling endpoints remain explicit gaps', () => {
  const one = baseNode('node-1');
  const two = baseNode('node-2');
      const cycleOne = { ...receipt(one), receiptId: 'cycle-one', fromNodeId: 'node-2' };
  const cycleTwo = { ...receipt(two), receiptId: 'cycle-two', fromNodeId: 'node-1' };
  const dangling = { ...receipt(two), receiptId: 'dangling', fromNodeId: 'missing-node', toNodeId: 'node-2' };
  const result = buildBranchMapProjection(input({ nodes: [one, two], receipts: [cycleOne, cycleTwo, dangling], lineage: [lineage(one), lineage(two)] }));
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.ok(result.projection.gaps.some((gap) => gap.code === 'invalid_receipt' && /cycle/i.test(gap.detail)));
  assert.ok(result.projection.gaps.some((gap) => gap.code === 'unknown_node' && /source node/i.test(gap.detail)));
});

test('strict envelope and cross-branch references fail closed or become visible gaps', () => {
  const unknown = buildBranchMapProjection({ ...input(), extra: true });
  assert.equal(unknown.accepted, false);
  if (!unknown.accepted) assert.match(unknown.errors.join(' '), /extra is not allowed/);

  const invalidNode = buildBranchMapProjection({ ...input(), nodes: [{ ...baseNode('node-1'), provider: 'must-not-appear' }] });
  assert.equal(invalidNode.accepted, false);

  const wrongBranchReceipt = buildBranchMapProjection(input({
    receipts: [{ ...receipt(baseNode('node-1')), branchId: 'other-branch' }],
  }));
  assert.equal(wrongBranchReceipt.accepted, true);
  if (wrongBranchReceipt.accepted) assert.ok(wrongBranchReceipt.projection.gaps.some((gap) => gap.code === 'invalid_receipt' && /branch/.test(gap.detail)));

  const unknownBranch = buildBranchMapProjection(input({
    campaignOverlays: [{ overlayId: 'campaign-unknown', branchId: 'missing-branch', label: 'gap', status: 'unknown', sourceRef: 'campaign:missing', observedAt: null, freshness: 'unverified' }],
  }));
  assert.equal(unknownBranch.accepted, true);
  if (!unknownBranch.accepted) return;
  assert.ok(unknownBranch.projection.gaps.some((gap) => gap.code === 'unknown_overlay' && gap.branchId === 'missing-branch'));
});

test('packet organ routing compiles into stable branch nodes without inventing receipts', () => {
  const packetInput = branchMapInputFromPackets({
    tenantId: 'tenant-alpha',
    graphVersion: 5,
    graphDigest: 'sha256:packets',
    generatedAt: '2026-01-03T00:00:00.000Z',
    sourceRef: 'docs/plans/product-branches/index.md',
    packets: [
      {
        branchId: 'fitcheck',
        label: 'Fitcheck',
        branchKind: 'product',
        promotionState: 'supervised-branch',
        currentGate: 'first merchant proof',
        sourceRef: 'docs/plans/product-branches/fitcheck.md',
        sourceDigest: 'sha256:fitcheck',
        organRouting: [{ organ: 'Genesis', currentGate: 'brand proof' }, { organ: 'Hands', proofPath: 'QA receipt' }],
      },
      {
        branchId: 'iverif',
        label: 'IVerif',
        branchKind: 'product',
        promotionState: 'proof-only',
        currentGate: 'claim proof separation',
        sourceRef: 'docs/plans/product-branches/iverif.md',
        sourceDigest: 'sha256:iverif',
        organRouting: [{ organ: 'Genesis', currentGate: 'packet only' }],
      },
    ],
  });
  const result = buildBranchMapProjection(packetInput);
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.deepEqual(result.projection.branches.map((branch) => branch.branchId), ['fitcheck', 'iverif']);
  assert.ok(result.projection.nodes.some((node) => node.nodeId === 'branch:fitcheck:organ:genesis'));
  assert.equal(result.projection.nodes.find((node) => node.nodeId === 'branch:iverif')?.authoritativeStatus, 'draft');
  assert.ok(result.projection.gaps.some((gap) => gap.code === 'missing_receipt' && gap.kind === 'pending'));
});
