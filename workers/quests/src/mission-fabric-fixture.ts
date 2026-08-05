const deepFreeze = <Value>(value: Value): Value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

export const FABRIC_SOURCE_FIXTURE = deepFreeze({
  sourceKind: 'source-facts',
  schema: 'mission-fabric-source-fixture.v1',
  tenantId: 'cambium-synthetic',
  asOf: '2026-07-28T09:00:00.000Z',
  generatedAt: '2026-07-28T09:00:01.000Z',
  nonce: 'fixture-nonce-20260728',
  coverage: ['sapling', 'program', 'mission', 'task', 'run', 'receipt', 'agent', 'skill-cluster', 'gap'],
  saplings: [{
    saplingId: 'sapling-cambium', branchId: 'branch-cambium', missionId: 'mission-fabric-foundation',
    lifecycle: 'supervised-branch', promotionState: 'supervised-branch', evidenceRef: 'evidence-sapling-001',
  }],
  programs: [{
    schema: 'company-program-packet.v1', programId: 'cambium-operating-fabric', tenantId: 'cambium-synthetic',
    title: 'Cambium Operating Fabric', programKind: 'operations', lifecycle: 'executing',
    outcomeMetric: 'Every approved mission has a bounded, evidence-linked execution path.',
    authority: { kind: 'goal-graph', namespace: 'cambium.synthetic.goal-graph', graphVersion: 1 },
    missionIds: ['mission-fabric-foundation', 'mission-fabric-proof'],
  }],
  missions: [
    { missionId: 'mission-fabric-foundation', workId: 'sapling-cambium', title: 'Freeze operating fabric contracts', lifecycle: 'executing', authorityRef: 'goal-graph:mission-fabric-foundation' },
    { missionId: 'mission-fabric-proof', workId: 'cambium-operating-fabric', title: 'Verify operating fabric evidence', lifecycle: 'approved', authorityRef: 'goal-graph:mission-fabric-proof' },
  ],
  tasks: [
    { taskId: 'task-fabric-contract', missionId: 'mission-fabric-foundation', state: 'ready', dependsOn: [], assignedAgentId: 'agent-cambium', fence: 7 },
    { taskId: 'task-fabric-proof', missionId: 'mission-fabric-proof', state: 'blocked', dependsOn: ['task-fabric-contract'], assignedAgentId: 'agent-hermes', fence: 8, blocker: 'receipt-fabric-proof' },
  ],
  runtimeRuns: [
    { runId: 'run-fabric-current', taskId: 'task-fabric-contract', state: 'succeeded', fence: 7, staleFence: false, nonce: 'run-nonce-current', executorAgentId: 'agent-cambium', receiptId: 'receipt-fabric-contract' },
    { runId: 'run-fabric-stale', taskId: 'task-fabric-contract', state: 'rejected', fence: 6, staleFence: true, nonce: 'run-nonce-stale', executorAgentId: 'agent-cambium', receiptId: 'receipt-fabric-stale' },
  ],
  receipts: [
    { receiptId: 'receipt-fabric-contract', runId: 'run-fabric-current', status: 'verified', evidenceRef: 'evidence-receipt-001', verifiedAt: '2026-07-28T09:00:02.000Z' },
    { receiptId: 'receipt-fabric-proof', runId: null, status: 'missing', evidenceRef: null, verifiedAt: null },
  ],
  agents: [
    { agentId: 'agent-cambium', state: 'available', capabilities: ['contracts', 'projection'], currentTaskId: 'task-fabric-contract', sourceFreshness: 'fresh' },
    { agentId: 'agent-hermes', state: 'unknown', capabilities: ['projection', 'verification'], currentTaskId: 'task-fabric-proof', sourceFreshness: 'unknown' },
  ],
  skillClusters: [
    { clusterId: 'cluster-fabric', state: 'active', capabilities: ['contracts', 'projection'], assignmentEvidence: 'evidence-cluster-001' },
    { clusterId: 'cluster-proof', state: 'deferred', capabilities: ['verification'], assignmentEvidence: 'evidence-cluster-002' },
  ],
  gaps: [
    { gapId: 'gap-receipt-fabric-proof', kind: 'missing-receipt', subjectId: 'task-fabric-proof', detail: 'Proof receipt has not been produced.', evidenceRef: 'evidence-gap-001' },
    { gapId: 'gap-capability-fabric-proof', kind: 'capability-gap', subjectId: 'task-fabric-proof', detail: 'No assigned agent has the receipt-reconciliation capability.', evidenceRef: 'evidence-gap-002' },
  ],
  fences: [{ taskId: 'task-fabric-contract', currentFence: 7, staleFence: 6 }],
  evidence: [
    { evidenceRef: 'evidence-sapling-001', kind: 'branch-story-arc', observedAt: '2026-07-28T09:00:00.000Z' },
    { evidenceRef: 'evidence-receipt-001', kind: 'receipt', observedAt: '2026-07-28T09:00:02.000Z' },
    { evidenceRef: 'evidence-cluster-001', kind: 'skill-registry', observedAt: '2026-07-28T09:00:01.000Z' },
    { evidenceRef: 'evidence-cluster-002', kind: 'skill-registry', observedAt: '2026-07-28T09:00:01.000Z' },
    { evidenceRef: 'evidence-gap-001', kind: 'gap-observation', observedAt: '2026-07-28T09:00:01.000Z' },
    { evidenceRef: 'evidence-gap-002', kind: 'gap-observation', observedAt: '2026-07-28T09:00:01.000Z' },
  ],
});
