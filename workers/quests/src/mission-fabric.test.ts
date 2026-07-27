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
