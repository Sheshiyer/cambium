import assert from 'node:assert/strict';
import test from 'node:test';
import { FABRIC_SOURCE_FIXTURE } from './mission-fabric-fixture.ts';
import {
  buildMissionFabricProjection,
  projectionDigest,
  MISSION_FABRIC_CAPS,
  type MissionFabricSource,
} from './mission-fabric.ts';

const COMPILER_CLOCK = { now: () => '2026-07-28T12:00:00.000Z' };

function cloneSource(): MissionFabricSource {
  return structuredClone(FABRIC_SOURCE_FIXTURE) as MissionFabricSource;
}

function reverseSourceCollections(source: MissionFabricSource): MissionFabricSource {
  const reversed = structuredClone(source) as Record<string, unknown>;
  for (const [key, value] of Object.entries(reversed)) {
    if (Array.isArray(value)) reversed[key] = [...value].reverse();
  }
  return reversed as unknown as MissionFabricSource;
}

test('compiles identical source facts to an identical digest', () => {
  const a = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: COMPILER_CLOCK });
  const b = buildMissionFabricProjection(structuredClone(FABRIC_SOURCE_FIXTURE) as MissionFabricSource, { clock: COMPILER_CLOCK });
  assert.deepEqual(a, b);
  assert.equal(projectionDigest(a), projectionDigest(b));
});

test('never accepts a projection as an authority source', () => {
  assert.throws(
    () => buildMissionFabricProjection({ ...cloneSource(), sourceKind: 'projection' } as MissionFabricSource, { clock: COMPILER_CLOCK }),
    /projection.*authority/i,
  );
});

test('sorts nodes and edges before digesting', () => {
  const shuffled = reverseSourceCollections(FABRIC_SOURCE_FIXTURE as MissionFabricSource);
  assert.equal(
    projectionDigest(buildMissionFabricProjection(shuffled, { clock: COMPILER_CLOCK })),
    projectionDigest(buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: COMPILER_CLOCK })),
  );
});

test('preserves the exact v1 public shape and frozen edge vocabulary', () => {
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: COMPILER_CLOCK });
  assert.equal(projection.schema, 'cambium.mission-fabric-projection.v1');
  assert.equal(projection.projectionVersion, 1);
  assert.equal(projection.tenantId, 'cambium-synthetic');
  assert.equal(projection.graphVersion, 1);
  assert.equal(projection.sourceOfTruth, 'd1-goal-graph');
  assert.equal(projection.readOnly, true);
  assert.equal(typeof projection.graphDigest, 'string');
  assert.match(projection.graphDigest, /^sha256:[0-9a-f]{64}$/);
  assert.ok(Array.isArray(projection.nodes));
  assert.ok(Array.isArray(projection.edges));
  assert.ok(Array.isArray(projection.gaps));
  const allowedEdges = new Set([
    'contains', 'depends-on', 'assigned-to', 'requires-cluster', 'pins-loadout',
    'executes', 'produces', 'proves', 'informs-next-intent',
  ]);
  assert.ok(projection.edges.length > 0);
  for (const edge of projection.edges) assert.ok(allowedEdges.has(edge.kind), `unexpected edge kind ${edge.kind}`);
  const allowedNodes = new Set(['work', 'mission', 'task', 'agent', 'skill-cluster', 'run', 'receipt']);
  for (const node of projection.nodes) assert.ok(allowedNodes.has(node.kind), `unexpected node kind ${node.kind}`);
});

test('asOf is the newest authoritative input timestamp', () => {
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: COMPILER_CLOCK });
  assert.equal(projection.asOf, '2026-07-28T09:00:02.000Z');
});

test('generatedAt comes only from the injected compiler clock', () => {
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, {
    clock: { now: () => '2030-01-01T00:00:00.000Z' },
  });
  assert.equal(projection.generatedAt, '2030-01-01T00:00:00.000Z');
  assert.equal(projection.asOf, '2026-07-28T09:00:02.000Z');
});

test('graphDigest excludes volatile envelope fields', () => {
  const a = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: { now: () => '2030-01-01T00:00:00.000Z' } });
  const b = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: COMPILER_CLOCK });
  assert.notEqual(a.generatedAt, b.generatedAt);
  assert.equal(a.graphDigest, b.graphDigest);
});

test('does not mutate frozen source facts', () => {
  const before = JSON.stringify(FABRIC_SOURCE_FIXTURE);
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: COMPILER_CLOCK });
  assert.equal(JSON.stringify(FABRIC_SOURCE_FIXTURE), before);
  assert.notEqual(projection.nodes[0], (FABRIC_SOURCE_FIXTURE as { saplings: unknown[] }).saplings[0]);
});

test('rejects wrong tenant sources', () => {
  const foreign = { ...cloneSource(), tenantId: 'tenant-foreign' };
  assert.throws(
    () => buildMissionFabricProjection(foreign, { clock: COMPILER_CLOCK, tenantId: 'cambium-synthetic' }),
    /tenant/i,
  );
});

test('rejects stale fence runs in favor of the highest valid fence', () => {
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: COMPILER_CLOCK });
  const runIds = projection.nodes.filter((node) => node.kind === 'run').map((node) => (node.value as { runId: string }).runId);
  assert.deepEqual(runIds, ['run-fabric-current']);
  const staleGap = projection.gaps.find((gap) => gap.kind === 'stale-fence');
  assert.ok(staleGap, 'expected a stale-fence gap for the rejected run');
  assert.equal(staleGap.subjectId, 'run-fabric-stale');
});

test('records node overflow as a deterministic projection-truncated gap', () => {
  const oversized = cloneSource();
  for (let index = 0; index < MISSION_FABRIC_CAPS.MAX_NODES; index += 1) {
    oversized.tasks.push({
      taskId: `task-overflow-${String(index).padStart(4, '0')}`,
      missionId: 'mission-fabric-foundation',
      state: 'queued',
      dependsOn: [],
      assignedAgentId: null,
      fence: 1,
    });
  }
  for (let index = 0; index < 4; index += 1) {
    oversized.evidence.push({ evidenceRef: `evidence-node-overflow-${index}`, kind: 'gap-observation', observedAt: '2026-07-28T09:00:03.000Z' });
  }
  const a = buildMissionFabricProjection(oversized, { clock: COMPILER_CLOCK });
  const b = buildMissionFabricProjection(structuredClone(oversized), { clock: COMPILER_CLOCK });
  assert.deepEqual(a, b);
  assert.ok(a.nodes.length <= MISSION_FABRIC_CAPS.MAX_NODES);
  const truncation = a.gaps.find((gap) => gap.kind === 'projection-truncated' && /nodes/i.test(gap.detail));
  assert.ok(truncation, 'expected a projection-truncated gap for nodes');
});

test('records edge overflow as a projection-truncated gap', () => {
  const oversized = cloneSource();
  for (let index = 0; index < MISSION_FABRIC_CAPS.MAX_EDGES; index += 1) {
    oversized.tasks.push({
      taskId: `task-edge-overflow-${String(index).padStart(4, '0')}`,
      missionId: 'mission-fabric-foundation',
      state: 'queued',
      dependsOn: ['task-fabric-contract'],
      assignedAgentId: 'agent-cambium',
      fence: 1,
    });
  }
  const projection = buildMissionFabricProjection(oversized, { clock: COMPILER_CLOCK });
  assert.ok(projection.edges.length <= MISSION_FABRIC_CAPS.MAX_EDGES);
  assert.ok(projection.gaps.some((gap) => gap.kind === 'projection-truncated' && /edges/i.test(gap.detail)));
});

test('caps evidence references per node and records truncation', () => {
  const oversized = cloneSource();
  for (let index = 0; index < MISSION_FABRIC_CAPS.MAX_EVIDENCE_REFS_PER_NODE - 2; index += 1) {
    oversized.evidence.push({ evidenceRef: `evidence-extra-${String(index).padStart(3, '0')}`, kind: 'gap-observation', observedAt: '2026-07-28T08:00:00.000Z' });
  }
  oversized.gaps.push({
    gapId: 'gap-evidence-overflow',
    kind: 'capability-gap',
    subjectId: 'task-fabric-proof',
    detail: 'Overflow evidence probe.',
    evidenceRef: oversized.evidence.map((entry) => entry.evidenceRef).join(','),
  });
  const projection = buildMissionFabricProjection(oversized, { clock: COMPILER_CLOCK });
  assert.ok(
    projection.gaps.every((gap) => gap.evidenceRef === null || gap.evidenceRef.split(',').length <= MISSION_FABRIC_CAPS.MAX_EVIDENCE_REFS_PER_NODE),
    'expected evidence references per node to be capped',
  );
  assert.ok(projection.gaps.some((gap) => gap.kind === 'projection-truncated' && /evidence/i.test(gap.detail)));
});

test('truncates display strings at 512 characters', () => {
  const longDetail = 'x'.repeat(MISSION_FABRIC_CAPS.MAX_DISPLAY_CHARS * 2);
  const oversized = cloneSource();
  oversized.gaps.push({ gapId: 'gap-long-detail', kind: 'missing-receipt', subjectId: 'task-fabric-proof', detail: longDetail, evidenceRef: null });
  const projection = buildMissionFabricProjection(oversized, { clock: COMPILER_CLOCK });
  for (const gap of projection.gaps) {
    assert.ok(gap.detail.length <= MISSION_FABRIC_CAPS.MAX_DISPLAY_CHARS, `gap detail exceeds cap: ${gap.detail.length}`);
  }
  assert.ok(projection.gaps.some((gap) => gap.kind === 'projection-truncated' && /display/i.test(gap.detail)));
});

test('digest is stable when recomputed from viewer-redacted content', () => {
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: COMPILER_CLOCK });
  const recomputed = projectionDigest(projection);
  assert.equal(recomputed, projection.graphDigest);
  const redacted = {
    ...projection,
    nodes: projection.nodes.filter((node) => node.kind !== 'agent'),
    edges: projection.edges.filter((edge) => edge.kind !== 'assigned-to'),
  };
  const redactedDigest = projectionDigest(redacted);
  assert.notEqual(redactedDigest, projection.graphDigest);
  assert.equal(redactedDigest, projectionDigest({ ...redacted }));
});

test('never maps a task blocker into FabricTask.proofRequirement', () => {
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: COMPILER_CLOCK });
  const blocked = projection.nodes.find(
    (node) => node.kind === 'task' && node.value.taskId === 'task-fabric-proof',
  );
  assert.ok(blocked && blocked.kind === 'task', 'expected the blocked fixture task to be projected');
  assert.equal(blocked.value.proofRequirement, '', 'source has no proof-requirement field, so the projection must emit the honest empty value instead of inventing blocker semantics');
});

test('never emits a vocabulary edge without an authoritative typed join', () => {
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: COMPILER_CLOCK });
  for (const edge of projection.edges) {
    assert.notEqual(edge.fromId, edge.toId, `self-edge ${edge.kind}:${edge.fromId} is never legitimate`);
  }
  assert.equal(
    projection.edges.filter((edge) => edge.kind === 'requires-cluster').length,
    0,
    'requires-cluster edges need an authoritative task-to-cluster assignment; none exists in the Task 3 source vocabulary',
  );
  assert.equal(
    projection.edges.filter((edge) => edge.kind === 'pins-loadout').length,
    0,
    'pins-loadout edges belong to Task 4 adapters and must not be fabricated',
  );
  assert.equal(
    projection.edges.filter((edge) => edge.kind === 'informs-next-intent').length,
    0,
    'informs-next-intent edges belong to Task 4 adapters and must not be fabricated',
  );
});

test('rejects malformed asOf source timestamps instead of comparing them lexicographically', () => {
  const malformed = cloneSource();
  malformed.asOf = '2026-07-28 09:00:00';
  assert.throws(
    () => buildMissionFabricProjection(malformed, { clock: COMPILER_CLOCK }),
    /asOf.*ISO-8601 UTC/i,
  );
  const offset = cloneSource();
  offset.asOf = '2026-07-28T09:00:00+05:30';
  assert.throws(
    () => buildMissionFabricProjection(offset, { clock: COMPILER_CLOCK }),
    /asOf.*ISO-8601 UTC/i,
  );
  const badReceipt = cloneSource();
  badReceipt.receipts[0] = { ...badReceipt.receipts[0], verifiedAt: 'not-a-timestamp' };
  assert.throws(
    () => buildMissionFabricProjection(badReceipt, { clock: COMPILER_CLOCK }),
    /asOf.*ISO-8601 UTC/i,
  );
  const badEvidence = cloneSource();
  badEvidence.evidence[0] = { ...badEvidence.evidence[0], observedAt: '2026-07-28T09:00:00' };
  assert.throws(
    () => buildMissionFabricProjection(badEvidence, { clock: COMPILER_CLOCK }),
    /asOf.*ISO-8601 UTC/i,
  );
});

test('rejects a non-canonical generatedAt from the injected compiler clock', () => {
  assert.throws(
    () => buildMissionFabricProjection(cloneSource(), { clock: { now: () => '2026-07-28T12:00:00' } }),
    /generatedAt.*ISO-8601 UTC/i,
  );
  assert.throws(
    () => buildMissionFabricProjection(cloneSource(), { clock: { now: () => 'July 28, 2026' } }),
    /generatedAt.*ISO-8601 UTC/i,
  );
});

// ---------------------------------------------------------------------------
// Task 4 — source adapters, reconciliation, and viewer redaction
// ---------------------------------------------------------------------------

import {
  adaptBranchStories,
  adaptCompanyPrograms,
  adaptGoalGraph,
  adaptQuestExecutionFacts,
  redactMissionFabricProjection,
} from './mission-fabric.ts';

function branchStoryArc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    branchId: 'branch-acme',
    branchKind: 'client',
    productId: 'product-acme-website',
    name: 'Acme Corp Website',
    role: 'client-delivery',
    arcId: 'arc-x',
    arcTitle: 'The Brief',
    vision: { statement: 'A public site for Acme Corp.' },
    icp: { primary: 'acme-buyer' },
    kpis: [],
    questline: [],
    missions: [],
    loops: [],
    gates: [],
    proofPaths: [],
    promotion: { state: 'proof-only', currentGate: 'gate-brief', rule: 'proof ladder' },
    controls: {
      productSeed: {},
      organRouting: [{ organ: 'web', owner: 'studio', input: 'brief', output: 'site', proofPath: 'proof/web', currentGate: 'gate-brief' }],
      variableContractPayloads: [],
      adapterServiceMap: [],
      evidenceLedger: [],
      approvals: [],
      autonomyBoundary: 'founder-gate',
      dispatchHints: [],
      loops: [],
      policySignals: [],
      ui: { headline: 'h', currentFrontier: 'f', missionVerb: 'build', narrativeVoice: 'v', blockedCopy: 'b' },
    },
    source: { tenant: 'cambium-synthetic', schema: 'branch-packet.v1', indexFile: 'index.json', packetFile: 'branch-acme.json' },
    gaps: [],
    ...overrides,
  };
}

function questFacts(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceKind: 'quest-execution-facts.v1',
    tenantId: 'cambium-synthetic',
    tasks: [{ taskId: 'task-alpha', missionId: 'mission-one', fence: 4 }],
    fences: [{ taskId: 'task-alpha', currentFence: 4 }],
    runs: [
      {
        runId: 'run-alpha', taskId: 'task-alpha', executorAgentId: 'agent-cambium', loadoutId: 'loadout-a1',
        state: 'succeeded', fence: 4, nonce: 'nonce-alpha', nonceExpiresAt: '2026-07-29T00:00:00.000Z',
        receiptId: 'receipt-alpha', startedAt: '2026-07-28T09:00:00.000Z', terminalAt: '2026-07-28T09:05:00.000Z',
      },
    ],
    receipts: [
      {
        receiptId: 'receipt-alpha', runId: 'run-alpha', taskId: 'task-alpha', status: 'verified',
        evidenceRef: 'evidence-receipt-alpha', verifiedAt: '2026-07-28T09:05:00.000Z', durable: true,
      },
    ],
    agents: [
      { agentId: 'agent-cambium', state: 'available', capabilities: ['contracts'], currentTaskId: 'task-alpha', sourceRef: 'quest:agent-cambium' },
    ],
    skillClusters: [
      { clusterId: 'cluster-contracts', state: 'active', capabilities: ['contracts'], eligibleAgentIds: ['agent-cambium'], sourceRef: 'quest:cluster-contracts' },
    ],
    taskClusterAssignments: [{ taskId: 'task-alpha', clusterId: 'cluster-contracts' }],
    ...overrides,
  };
}

function workNodes(nodes: readonly { kind: string; value: unknown }[]): Array<Record<string, unknown>> {
  return nodes.filter((node) => node.kind === 'work').map((node) => node.value as Record<string, unknown>);
}

test('adaptBranchStories maps a product branch to a sapling with promotion metadata', () => {
  const nodes = adaptBranchStories([branchStoryArc({ branchKind: 'product', branchId: 'branch-product', promotion: { state: 'supervised-branch', currentGate: 'gate-mvp', rule: 'proof ladder' } })]);
  const work = workNodes(nodes as readonly { kind: string; value: unknown }[]);
  assert.equal(work.length, 1);
  assert.equal(work[0].kind, 'sapling');
  assert.equal(work[0].branchKind, 'product');
  assert.equal(work[0].branchId, 'branch-product');
  assert.equal(work[0].promotionState, 'supervised-branch');
  assert.equal(work[0].currentGate, 'gate-mvp');
  assert.deepEqual(work[0].organRoute, ['web']);
});

test('adaptBranchStories maps a client branch to a client program and never to a sapling', () => {
  const nodes = adaptBranchStories([branchStoryArc({})]);
  const work = workNodes(nodes as readonly { kind: string; value: unknown }[]);
  assert.equal(work.length, 1);
  assert.equal(work[0].kind, 'program');
  assert.equal(work[0].programKind, 'client');
  assert.equal('promotionState' in work[0], false);
  assert.equal('branchId' in work[0], false);
});

test('adaptBranchStories maps internal-service only through an explicit capability|operations mapping', () => {
  const mapped = adaptBranchStories([branchStoryArc({
    branchKind: 'internal-service',
    branchId: 'branch-mailroom',
    controls: {
      productSeed: {},
      organRouting: [],
      variableContractPayloads: [],
      adapterServiceMap: [{ providerRoute: 'ops/mailroom', inputs: 'in', outputs: 'out', failureModes: 'none', tenantMapping: 'operations', privacyBoundary: 'internal' }],
      evidenceLedger: [],
      approvals: [],
      autonomyBoundary: 'founder-gate',
      dispatchHints: [],
      loops: [],
      policySignals: [],
      ui: { headline: 'h', currentFrontier: 'f', missionVerb: 'run', narrativeVoice: 'v', blockedCopy: 'b' },
    },
  })]);
  const mappedWork = workNodes(mapped as readonly { kind: string; value: unknown }[]);
  assert.equal(mappedWork.length, 1);
  assert.equal(mappedWork[0].kind, 'program');
  assert.equal(mappedWork[0].programKind, 'operations');

  const unmapped = adaptBranchStories([branchStoryArc({ branchKind: 'internal-service', branchId: 'branch-mystery' })]);
  const unmappedWork = workNodes(unmapped as readonly { kind: string; value: unknown }[]);
  assert.equal(unmappedWork.length, 0, 'an unmapped internal-service branch must become a gap, never a fabricated program');
  const gaps = (unmapped as readonly { kind: string; value?: unknown; gapId?: string; gapKind?: string }[]).filter((entry) => entry.kind === 'gap');
  assert.equal(gaps.length, 1);
  assert.match(String(gaps[0].gapId), /branch-mystery/);
});

test('adaptCompanyPrograms maps all four program kinds to ProgramWork', () => {
  const packet = (programId: string, programKind: string): Record<string, unknown> => ({
    schema: 'company-program-packet.v1',
    programId,
    tenantId: 'cambium-synthetic',
    title: `Program ${programId}`,
    programKind,
    lifecycle: 'executing',
    outcomeMetric: 'outcome',
    authority: { kind: 'goal-graph', namespace: 'cambium.synthetic.goal-graph', graphVersion: 1 },
    missionIds: ['mission-one'],
  });
  const nodes = adaptCompanyPrograms(['company', 'client', 'capability', 'operations'].map((kind) => packet(`program-${kind}`, kind)));
  const work = workNodes(nodes as readonly { kind: string; value: unknown }[]);
  assert.deepEqual(
    work.map((value) => value.programKind).sort(),
    ['capability', 'client', 'company', 'operations'],
  );
  for (const value of work) assert.equal(value.kind, 'program');
});

test('adaptCompanyPrograms emits a typed gap for a missing source and never fabricates a node', () => {
  const nodes = adaptCompanyPrograms(null);
  const work = workNodes(nodes as readonly { kind: string; value: unknown }[]);
  assert.equal(work.length, 0);
  const gaps = (nodes as readonly { kind: string; gapKind?: string }[]).filter((entry) => entry.kind === 'gap');
  assert.equal(gaps.length, 1);
  assert.match(String(gaps[0].gapKind), /missing|absent|unavailable/i);
});

test('adaptQuestExecutionFacts keeps the highest valid fence and rejects the stale-fence run', () => {
  const facts = questFacts({
    runs: [
      {
        runId: 'run-current', taskId: 'task-alpha', executorAgentId: 'agent-cambium', loadoutId: 'loadout-a1',
        state: 'succeeded', fence: 4, nonce: 'nonce-current', nonceExpiresAt: '2026-07-29T00:00:00.000Z',
        receiptId: 'receipt-alpha', startedAt: '2026-07-28T09:00:00.000Z', terminalAt: '2026-07-28T09:05:00.000Z',
      },
      {
        runId: 'run-stale', taskId: 'task-alpha', executorAgentId: 'agent-cambium', loadoutId: 'loadout-a1',
        state: 'rejected', fence: 3, nonce: 'nonce-stale', nonceExpiresAt: '2026-07-29T00:00:00.000Z',
        receiptId: 'receipt-stale', startedAt: '2026-07-28T08:00:00.000Z', terminalAt: null,
      },
    ],
  });
  const result = adaptQuestExecutionFacts(facts, { now: '2026-07-28T12:00:00.000Z' });
  const runIds = result.nodes.filter((node) => node.kind === 'run').map((node) => (node.value as { runId: string }).runId);
  assert.deepEqual(runIds, ['run-current']);
  const staleGap = result.gaps.find((gap) => gap.kind === 'stale-fence');
  assert.ok(staleGap, 'expected a stale-fence gap for the rejected run');
  assert.equal(staleGap.subjectId, 'run-stale');
});

test('adaptQuestExecutionFacts rejects runs whose nonce or proof metadata is expired', () => {
  const facts = questFacts({
    runs: [
      {
        runId: 'run-expired', taskId: 'task-alpha', executorAgentId: 'agent-cambium', loadoutId: 'loadout-a1',
        state: 'succeeded', fence: 4, nonce: 'nonce-expired', nonceExpiresAt: '2026-07-01T00:00:00.000Z',
        receiptId: 'receipt-alpha', startedAt: '2026-07-28T09:00:00.000Z', terminalAt: '2026-07-28T09:05:00.000Z',
      },
    ],
  });
  const result = adaptQuestExecutionFacts(facts, { now: '2026-07-28T12:00:00.000Z' });
  const runIds = result.nodes.filter((node) => node.kind === 'run').map((node) => (node.value as { runId: string }).runId);
  assert.deepEqual(runIds, []);
  const expiredGap = result.gaps.find((gap) => /expired/i.test(gap.kind));
  assert.ok(expiredGap, 'expected an expired nonce/proof gap for the rejected run');
  assert.equal(expiredGap.subjectId, 'run-expired');
});

test('adaptQuestExecutionFacts joins agents and skills only from explicit quest IDs, never titles', () => {
  const facts = questFacts({
    agents: [
      { agentId: 'agent-cambium', state: 'available', capabilities: ['contracts'], currentTaskId: 'task-alpha', sourceRef: 'quest:agent-cambium' },
      { agentId: 'agent-decoy', state: 'available', capabilities: ['contracts'], currentTaskId: null, sourceRef: 'quest:agent-decoy' },
    ],
    taskClusterAssignments: [{ taskId: 'task-alpha', clusterId: 'cluster-contracts' }],
  });
  const result = adaptQuestExecutionFacts(facts);
  const assignmentEdges = result.edges.filter((edge) => edge.kind === 'assigned-to');
  assert.deepEqual(assignmentEdges, [{ kind: 'assigned-to', fromId: 'task-alpha', toId: 'agent-cambium' }]);
  const clusterEdges = result.edges.filter((edge) => edge.kind === 'requires-cluster');
  assert.deepEqual(clusterEdges, [{ kind: 'requires-cluster', fromId: 'task-alpha', toId: 'cluster-contracts' }]);
  for (const edge of result.edges) {
    assert.notEqual(edge.toId, 'agent-decoy', 'relations must come from explicit IDs, never capability or title similarity');
  }
  const cluster = result.nodes.find((node) => node.kind === 'skill-cluster');
  assert.ok(cluster && cluster.kind === 'skill-cluster');
  assert.deepEqual(cluster.value.eligibleAgentIds, ['agent-cambium']);
});

test('adaptQuestExecutionFacts links task to run to a durable receipt ID', () => {
  const result = adaptQuestExecutionFacts(questFacts(), { now: '2026-07-28T12:00:00.000Z' });
  const receiptNodes = result.nodes.filter((node) => node.kind === 'receipt');
  assert.deepEqual(receiptNodes.map((node) => (node.value as { receiptId: string }).receiptId), ['receipt-alpha']);
  const produces = result.edges.filter((edge) => edge.kind === 'produces');
  assert.deepEqual(produces, [{ kind: 'produces', fromId: 'run-alpha', toId: 'receipt-alpha' }]);
  const proves = result.edges.filter((edge) => edge.kind === 'proves');
  assert.deepEqual(proves, [{ kind: 'proves', fromId: 'receipt-alpha', toId: 'task-alpha' }]);
  const receipt = receiptNodes[0].value as { receiptId: string; runId: string; taskId: string; status: string };
  assert.equal(receipt.runId, 'run-alpha');
  assert.equal(receipt.taskId, 'task-alpha');
  assert.equal(receipt.status, 'complete');
});

test('adaptQuestExecutionFacts rejects projection-shaped and wrong-tenant input', () => {
  assert.throws(
    () => adaptQuestExecutionFacts({ ...questFacts(), sourceKind: 'projection' }),
    /projection/i,
  );
  assert.throws(
    () => adaptQuestExecutionFacts(questFacts({ tenantId: 'tenant-foreign' }), { tenantId: 'cambium-synthetic' }),
    /tenant/i,
  );
});

test('adaptGoalGraph adapts goal graph nodes into fabric tasks without creating goals', () => {
  const goalNode = {
    nodeId: 'goal-node-1',
    tenantId: 'cambium-synthetic',
    namespace: 'cambium.synthetic.goal-graph',
    externalId: 'task-alpha',
    parentNodeId: null,
    scope: 'micro',
    desiredState: 'ship the contract',
    currentState: 'contract drafted',
    owner: 'founder',
    nextAction: 'review',
    waitCondition: null,
    proofRequired: true,
    reviewAt: null,
    status: 'active',
    sourceRef: 'goal-graph:goal-node-1',
    sourceDigest: 'sha256:abc',
    graphVersion: 3,
    metadata: {},
    createdAt: '2026-07-28T09:00:00.000Z',
    updatedAt: '2026-07-28T09:00:00.000Z',
  };
  const nodes = adaptGoalGraph({ tenantId: 'cambium-synthetic', graphVersion: 3, nodes: [goalNode] });
  assert.ok(nodes.length >= 1, 'expected at least one fabric node from the goal graph');
  const taskNode = nodes.find((node) => node.kind === 'task');
  assert.ok(taskNode && taskNode.kind === 'task');
  assert.equal(taskNode.value.taskId, 'task-alpha');
  assert.equal(taskNode.value.desiredState, 'ship the contract');
  assert.equal(taskNode.value.proofRequirement === 'review', false, 'nextAction must not be repurposed as proof');
});

test('redactMissionFabricProjection hides private client labels and raw evidence for unauthorized viewers', () => {
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: COMPILER_CLOCK });
  const withClient = {
    ...projection,
    nodes: [
      ...projection.nodes,
      ...adaptBranchStories([branchStoryArc({})]),
    ] as typeof projection.nodes,
  };
  const founder = redactMissionFabricProjection(withClient, { role: 'founder', tenantId: 'cambium-synthetic' });
  const clientWork = founder.nodes.find((node) => node.kind === 'work' && node.value.kind === 'program' && node.value.programKind === 'client');
  assert.ok(clientWork && clientWork.kind === 'work' && clientWork.value.kind === 'program');
  assert.equal(clientWork.value.name, 'Acme Corp Website');

  const unauthorized = redactMissionFabricProjection(withClient, { role: 'viewer', tenantId: 'cambium-synthetic' });
  const redactedWork = unauthorized.nodes.find((node) => node.kind === 'work' && node.value.kind === 'program' && node.value.programKind === 'client');
  assert.ok(redactedWork && redactedWork.kind === 'work' && redactedWork.value.kind === 'program');
  assert.doesNotMatch(redactedWork.value.name, /Acme/, 'private client label must be redacted for unauthorized viewers');
  for (const node of unauthorized.nodes) {
    assert.doesNotMatch(JSON.stringify(node), /evidence-receipt-001|evidence-sapling-001/, 'raw evidence references must be redacted for unauthorized viewers');
  }
  assert.equal(unauthorized.graphVersion, withClient.graphVersion);
  assert.equal(unauthorized.asOf, withClient.asOf);
});

test('redactMissionFabricProjection recomputes a stable graphDigest per fixed viewer', () => {
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: COMPILER_CLOCK });
  const viewer = { role: 'viewer' as const, tenantId: 'cambium-synthetic' };
  const first = redactMissionFabricProjection(projection, viewer);
  const second = redactMissionFabricProjection(projection, viewer);
  assert.notEqual(first.graphDigest, projection.graphDigest, 'a redacted graph must not reuse the unredacted digest');
  assert.equal(first.graphDigest, second.graphDigest, 'digest must be stable for the same fixed viewer');
  assert.equal(first.graphDigest, projectionDigest(first), 'stored digest must equal recomputation over redacted canonical content');
  const founder = redactMissionFabricProjection(projection, { role: 'founder', tenantId: 'cambium-synthetic' });
  assert.equal(founder.graphDigest, projection.graphDigest, 'an authorized viewer sees the unredacted digest');
});

// ---------------------------------------------------------------------------
// Review Round 1 — hardening regressions
// ---------------------------------------------------------------------------

test('adaptQuestExecutionFacts projects a malformed non-null terminalAt as null with a typed gap, never an empty string', () => {
  const facts = questFacts({
    runs: [
      {
        runId: 'run-bad-terminal', taskId: 'task-alpha', executorAgentId: 'agent-cambium', loadoutId: 'loadout-a1',
        state: 'succeeded', fence: 4, nonce: 'nonce-alpha', nonceExpiresAt: '2026-07-29T00:00:00.000Z',
        receiptId: 'receipt-alpha', startedAt: '2026-07-28T09:00:00.000Z', terminalAt: 'not-a-timestamp',
      },
    ],
  });
  const result = adaptQuestExecutionFacts(facts, { now: '2026-07-28T12:00:00.000Z' });
  const runNode = result.nodes.find((node) => node.kind === 'run' && node.value.runId === 'run-bad-terminal');
  assert.ok(runNode && runNode.kind === 'run', 'expected the run to be projected');
  assert.equal(runNode.value.terminalAt, null, 'a malformed non-null terminalAt must project null, never an empty string');
  const gap = result.gaps.find((entry) => entry.kind === 'invalid-timestamp' && entry.subjectId === 'run-bad-terminal');
  assert.ok(gap, 'expected an invalid-timestamp gap identifying the run');
  assert.match(gap.detail, /not-a-timestamp/, 'the gap must identify the invalid timestamp value');
});

test('adaptQuestExecutionFacts rejects junk run rows missing runId or taskId into deterministic typed gaps', () => {
  const facts = questFacts({
    runs: [
      {
        taskId: 'task-alpha', executorAgentId: 'agent-cambium', loadoutId: 'loadout-a1',
        state: 'succeeded', fence: 4, nonce: 'nonce-alpha', receiptId: 'receipt-alpha',
        startedAt: '2026-07-28T09:00:00.000Z', terminalAt: null,
      },
      {
        runId: 'run-no-task', executorAgentId: 'agent-cambium', loadoutId: 'loadout-a1',
        state: 'succeeded', fence: 4, nonce: 'nonce-beta', receiptId: 'receipt-beta',
        startedAt: '2026-07-28T09:00:00.000Z', terminalAt: null,
      },
    ],
  });
  const result = adaptQuestExecutionFacts(facts);
  assert.equal(result.nodes.filter((node) => node.kind === 'run').length, 0, 'junk runs must never produce empty FabricRun nodes');
  const junkGaps = result.gaps.filter((gap) => gap.kind === 'invalid-run');
  assert.equal(junkGaps.length, 2, 'each junk run row must produce its own deterministic typed gap');
  assert.match(junkGaps.map((gap) => gap.detail).join(' '), /runId/, 'the gap must identify the missing identity field');
  const rerun = adaptQuestExecutionFacts(structuredClone(facts));
  assert.deepEqual(rerun.gaps, result.gaps, 'gap IDs for junk rows must be deterministic');
});

test('adaptQuestExecutionFacts fails closed when an authoritative fence exists but the run fence is missing or non-finite', () => {
  const malformedFence = questFacts({
    runs: [
      {
        runId: 'run-nan-fence', taskId: 'task-alpha', executorAgentId: 'agent-cambium', loadoutId: 'loadout-a1',
        state: 'succeeded', fence: Number.NaN, nonce: 'nonce-alpha', receiptId: 'receipt-alpha',
        startedAt: '2026-07-28T09:00:00.000Z', terminalAt: null,
      },
      {
        runId: 'run-no-fence', taskId: 'task-alpha', executorAgentId: 'agent-cambium', loadoutId: 'loadout-a1',
        state: 'succeeded', nonce: 'nonce-beta', receiptId: 'receipt-beta',
        startedAt: '2026-07-28T09:00:00.000Z', terminalAt: null,
      },
    ],
  });
  const result = adaptQuestExecutionFacts(malformedFence);
  assert.equal(result.nodes.filter((node) => node.kind === 'run').length, 0, 'a run with an unverifiable fence against an authoritative fence must be rejected');
  const fenceGaps = result.gaps.filter((gap) => gap.kind === 'unverifiable-fence');
  assert.equal(fenceGaps.length, 2);
  assert.deepEqual(fenceGaps.map((gap) => gap.subjectId).sort(), ['run-nan-fence', 'run-no-fence']);
});

test('adaptQuestExecutionFacts accepts a finite fence run without authoritative fences when no expiry metadata is present', () => {
  const facts = questFacts({ fences: [] });
  for (const run of facts.runs as Array<Record<string, unknown>>) {
    delete run.nonceExpiresAt;
  }
  const result = adaptQuestExecutionFacts(facts);
  assert.equal(result.nodes.filter((node) => node.kind === 'run').length, 1);
  assert.equal(result.gaps.some((gap) => gap.kind === 'unverifiable-fence'), false);
});

test('adaptQuestExecutionFacts rejects expiry-metadata runs when no clock is provided', () => {
  const result = adaptQuestExecutionFacts(questFacts());
  assert.equal(result.nodes.filter((node) => node.kind === 'run').length, 0, 'freshness cannot be verified without a clock; the run must be rejected');
  const gap = result.gaps.find((entry) => entry.kind === 'unverifiable-clock');
  assert.ok(gap, 'expected a typed unverifiable-clock gap');
  assert.equal(gap.subjectId, 'run-alpha');
  const withClock = adaptQuestExecutionFacts(questFacts(), { now: '2026-07-28T12:00:00.000Z' });
  assert.equal(withClock.nodes.filter((node) => node.kind === 'run').length, 1, 'the same run is accepted when a clock is provided');
});

test('adaptQuestExecutionFacts bounds nodes, edges, and gaps with visible projection-truncated gaps', () => {
  const tasks = [];
  const runs = [];
  const receipts = [];
  for (let index = 0; index < 600; index += 1) {
    const taskId = `task-cap-${String(index).padStart(4, '0')}`;
    const runId = `run-cap-${String(index).padStart(4, '0')}`;
    const receiptId = `receipt-cap-${String(index).padStart(4, '0')}`;
    tasks.push({ taskId, missionId: 'mission-one', fence: 1 });
    runs.push({
      runId, taskId, executorAgentId: '', loadoutId: `loadout-${index}`,
      state: 'succeeded', fence: 1, nonce: `nonce-${index}`, receiptId,
      startedAt: '2026-07-28T09:00:00.000Z', terminalAt: null,
    });
    receipts.push({ receiptId, runId, taskId, status: 'verified', evidenceRef: null, verifiedAt: null, durable: true });
  }
  const facts = questFacts({ tasks, runs, receipts, agents: [], skillClusters: [], taskClusterAssignments: [], fences: [] });
  const result = adaptQuestExecutionFacts(facts);
  assert.ok(result.nodes.length <= MISSION_FABRIC_CAPS.MAX_NODES, `nodes must be capped at ${MISSION_FABRIC_CAPS.MAX_NODES}`);
  assert.ok(result.edges.length <= MISSION_FABRIC_CAPS.MAX_EDGES, `edges must be capped at ${MISSION_FABRIC_CAPS.MAX_EDGES}`);
  assert.ok(result.gaps.length <= MISSION_FABRIC_CAPS.MAX_GAPS, `gaps must be capped at ${MISSION_FABRIC_CAPS.MAX_GAPS}`);
  const truncation = result.gaps.filter((gap) => gap.kind === 'projection-truncated');
  assert.ok(truncation.length >= 1, 'overflow must be visible via projection-truncated gaps, never silent');
  const rerun = adaptQuestExecutionFacts(structuredClone(facts));
  assert.deepEqual(rerun, result, 'overflow must be deterministic');
});

test('adaptQuestExecutionFacts fails closed when the truncation gap record itself cannot fit', () => {
  const gapsInput = [];
  for (let index = 0; index < 200; index += 1) {
    gapsInput.push({ gapId: `gap-flood-${String(index).padStart(4, '0')}`, kind: 'capability-gap', subjectId: 'task-alpha', detail: 'flood', evidenceRef: null });
  }
  const facts = questFacts({ gaps: gapsInput });
  assert.throws(
    () => adaptQuestExecutionFacts(facts),
    /gaps exceed the cap/i,
    'when even the gap record cannot fit, the adapter must fail closed like the compiler',
  );
});

test('redactMissionFabricProjection redacts skill-cluster sourceRef and evidence pointers for unauthorized viewers', () => {
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: COMPILER_CLOCK });
  const founder = redactMissionFabricProjection(projection, { role: 'founder', tenantId: 'cambium-synthetic' });
  const founderCluster = founder.nodes.find((node) => node.kind === 'skill-cluster');
  assert.ok(founderCluster && founderCluster.kind === 'skill-cluster');
  assert.equal(founderCluster.value.sourceRef, 'evidence-cluster-001', 'authorized viewers keep the raw cluster sourceRef');

  const unauthorized = redactMissionFabricProjection(projection, { role: 'viewer', tenantId: 'cambium-synthetic' });
  for (const node of unauthorized.nodes) {
    const serialized = JSON.stringify(node);
    assert.doesNotMatch(serialized, /evidence-cluster-001|evidence-cluster-002/, 'skill-cluster sourceRef/evidence pointers must be redacted');
    assert.doesNotMatch(serialized, /evidence-receipt-001|evidence-sapling-001/, 'raw evidence pointers must be redacted');
  }
  for (const gap of unauthorized.gaps) {
    assert.equal(gap.evidenceRef, null, 'gap evidence pointers must be redacted');
  }
  assert.equal(unauthorized.graphDigest, projectionDigest(unauthorized), 'post-redaction digest must stay stable');
});
