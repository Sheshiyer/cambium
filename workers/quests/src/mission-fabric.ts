import { createHash } from 'node:crypto';

export const MISSION_FABRIC_CAPS = {
  MAX_NODES: 512,
  MAX_EDGES: 1024,
  MAX_GAPS: 128,
  MAX_EVIDENCE_REFS_PER_NODE: 32,
  MAX_DISPLAY_CHARS: 512,
} as const;

export interface WorkObjectBase {
  workId: string;
  tenantId: string;
  name: string;
  desiredState: string;
  currentState: string;
  status: 'draft' | 'ready' | 'active' | 'blocked' | 'paused' | 'complete' | 'retired';
  ownerId: string;
  nextAction: string | null;
  proofRequired: boolean;
  reviewAt: string | null;
  sourceRef: string;
  sourceDigest: string;
}

export interface SaplingWork extends WorkObjectBase {
  kind: 'sapling';
  branchId: string;
  branchKind: 'product';
  promotionState: 'proof-only' | 'supervised-branch' | 'autonomous-branch';
  currentGate: string;
  organRoute: string[];
}

export interface ProgramWork extends WorkObjectBase {
  kind: 'program';
  programKind: 'company' | 'client' | 'capability' | 'operations';
  lifecycle: 'proposed' | 'approved' | 'executing' | 'verifying' | 'complete' | 'retired';
  outcomeMetric: string;
}

export interface FabricMission {
  missionId: string;
  workId: string;
  title: string;
  objective: string;
  status: 'queued' | 'ready' | 'active' | 'blocked' | 'complete';
  gateId: string | null;
  proofRequirement: string;
  taskIds: string[];
  sourceRef: string;
}

export interface FabricTask {
  taskId: string;
  missionId: string;
  desiredState: string;
  status: 'queued' | 'ready' | 'leased' | 'running' | 'blocked' | 'verifying' | 'complete' | 'failed';
  dependencyIds: string[];
  assignedAgentId: string | null;
  requiredClusterIds: string[];
  pinnedLoadoutId: string | null;
  leaseId: string | null;
  proofRequirement: string;
  latestReceiptId: string | null;
}

export interface FabricAgent {
  agentId: string;
  role: string;
  runtime: 'codex' | 'hermes' | 'paperclip' | 'human' | 'other';
  status: 'offline' | 'available' | 'assigned' | 'running' | 'blocked';
  activeTaskIds: string[];
  permissionProfile: string;
  lastSeenAt: string;
  sourceRef: string;
}

export interface FabricSkillCluster {
  clusterId: string;
  name: string;
  status: 'inactive' | 'available' | 'active' | 'degraded';
  skillIds: string[];
  eligibleAgentIds: string[];
  successRate: number | null;
  sourceRef: string;
}

export interface FabricRun {
  runId: string;
  taskId: string;
  agentId: string;
  loadoutId: string;
  startedAt: string;
  terminalAt: string | null;
  status: 'invoking' | 'running' | 'reconciliation-required' | 'complete' | 'failed';
}

export interface FabricReceipt {
  receiptId: string;
  runId: string;
  taskId: string;
  graphVersion: number;
  status: 'complete' | 'failed' | 'stopped' | 'reconciliation-required';
  inputDigest: string;
  outputDigest: string | null;
  evidenceRefs: string[];
  approvalRef: string | null;
  createdAt: string;
}

export type FabricNode =
  | { kind: 'work'; value: SaplingWork | ProgramWork }
  | { kind: 'mission'; value: FabricMission }
  | { kind: 'task'; value: FabricTask }
  | { kind: 'agent'; value: FabricAgent }
  | { kind: 'skill-cluster'; value: FabricSkillCluster }
  | { kind: 'run'; value: FabricRun }
  | { kind: 'receipt'; value: FabricReceipt };

export type FabricEdgeKind =
  | 'contains'
  | 'depends-on'
  | 'assigned-to'
  | 'requires-cluster'
  | 'pins-loadout'
  | 'executes'
  | 'produces'
  | 'proves'
  | 'informs-next-intent';

export interface FabricEdge {
  kind: FabricEdgeKind;
  fromId: string;
  toId: string;
}

export interface FabricGap {
  gapId: string;
  kind: string;
  subjectId: string | null;
  detail: string;
  evidenceRef: string | null;
}

export interface MissionFabricProjectionV1 {
  schema: 'cambium.mission-fabric-projection.v1';
  projectionVersion: 1;
  tenantId: string;
  graphVersion: number;
  graphDigest: string;
  generatedAt: string;
  asOf: string;
  sourceOfTruth: 'd1-goal-graph';
  readOnly: true;
  nodes: readonly FabricNode[];
  edges: readonly FabricEdge[];
  gaps: readonly FabricGap[];
}

export type FabricWorkNode = Extract<FabricNode, { kind: 'work' }>;

export interface MissionFabricCompilerClock {
  now(): string;
}

export interface MissionFabricCompilerOptions {
  clock: MissionFabricCompilerClock;
  tenantId?: string;
}

interface SourceSapling {
  saplingId: string;
  branchId: string;
  missionId: string;
  lifecycle: string;
  promotionState: string;
  evidenceRef: string;
}

interface SourceProgram {
  programId: string;
  tenantId: string;
  title: string;
  programKind: string;
  lifecycle: string;
  outcomeMetric: string;
  authority: { kind: string; namespace: string; graphVersion: number };
  missionIds: string[];
}

interface SourceMission {
  missionId: string;
  workId: string;
  title: string;
  lifecycle: string;
  authorityRef: string;
}

interface SourceTask {
  taskId: string;
  missionId: string;
  state: string;
  dependsOn: string[];
  assignedAgentId: string | null;
  fence: number;
  blocker?: string;
}

interface SourceRun {
  runId: string;
  taskId: string;
  state: string;
  fence: number;
  staleFence: boolean;
  nonce: string;
  executorAgentId: string;
  receiptId: string;
}

interface SourceReceipt {
  receiptId: string;
  runId: string | null;
  status: string;
  evidenceRef: string | null;
  verifiedAt: string | null;
}

interface SourceAgent {
  agentId: string;
  state: string;
  capabilities: string[];
  currentTaskId: string | null;
  sourceFreshness: string;
}

interface SourceSkillCluster {
  clusterId: string;
  state: string;
  capabilities: string[];
  assignmentEvidence: string;
}

interface SourceGap {
  gapId: string;
  kind: string;
  subjectId: string;
  detail: string;
  evidenceRef: string | null;
}

interface SourceFence {
  taskId: string;
  currentFence: number;
  staleFence: number;
}

interface SourceEvidence {
  evidenceRef: string;
  kind: string;
  observedAt: string;
}

export interface MissionFabricSource {
  sourceKind: string;
  tenantId: string;
  asOf: string;
  saplings: SourceSapling[];
  programs: SourceProgram[];
  missions: SourceMission[];
  tasks: SourceTask[];
  runtimeRuns: SourceRun[];
  receipts: SourceReceipt[];
  agents: SourceAgent[];
  skillClusters: SourceSkillCluster[];
  gaps: SourceGap[];
  fences: SourceFence[];
  evidence: SourceEvidence[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function assertCanonicalUtcTimestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || !CANONICAL_UTC_TIMESTAMP.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a canonical ISO-8601 UTC timestamp (for example 2026-07-28T09:00:00.000Z); received ${JSON.stringify(value)}`);
  }
  return value;
}

function stableJson(value: unknown, seen = new Set<object>()): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('non-finite number is not serializable');
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') throw new Error('value is not serializable');
    return JSON.stringify(value);
  }
  if (seen.has(value)) throw new Error('cyclic value is not serializable');
  seen.add(value);
  const output = Array.isArray(value)
    ? `[${value.map((item) => stableJson(item, seen)).join(',')}]`
    : `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key], seen)}`).join(',')}}`;
  seen.delete(value);
  return output;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function canonicalizeGraphContent(content: {
  projectionVersion: number;
  tenantId: string;
  graphVersion: number;
  sourceOfTruth: string;
  readOnly: boolean;
  nodes: readonly FabricNode[];
  edges: readonly FabricEdge[];
  gaps: readonly FabricGap[];
}): string {
  return stableJson({
    projectionVersion: content.projectionVersion,
    tenantId: content.tenantId,
    graphVersion: content.graphVersion,
    sourceOfTruth: content.sourceOfTruth,
    readOnly: content.readOnly,
    nodes: content.nodes,
    edges: content.edges,
    gaps: content.gaps,
  });
}

export function projectionDigest(projection: Pick<MissionFabricProjectionV1, 'projectionVersion' | 'tenantId' | 'graphVersion' | 'sourceOfTruth' | 'readOnly' | 'nodes' | 'edges' | 'gaps'>): string {
  return `sha256:${sha256(canonicalizeGraphContent(projection))}`;
}

function nodeIdentity(node: FabricNode): string {
  const value = node.value as Record<string, unknown>;
  const id = (value.workId ?? value.missionId ?? value.taskId ?? value.agentId ?? value.clusterId ?? value.runId ?? value.receiptId) as string;
  return `${node.kind}:${id}`;
}

function truncateDisplay(value: string, truncatedKinds: Set<string>): string {
  if (value.length <= MISSION_FABRIC_CAPS.MAX_DISPLAY_CHARS) return value;
  truncatedKinds.add('display-strings');
  return `${value.slice(0, MISSION_FABRIC_CAPS.MAX_DISPLAY_CHARS - 12)}…[truncated]`;
}

function capEvidenceRefs(refs: string[], truncatedKinds: Set<string>): string[] {
  if (refs.length <= MISSION_FABRIC_CAPS.MAX_EVIDENCE_REFS_PER_NODE) return refs;
  truncatedKinds.add('evidence-references');
  return refs.slice(0, MISSION_FABRIC_CAPS.MAX_EVIDENCE_REFS_PER_NODE);
}

const PROGRAM_KINDS = new Set(['company', 'client', 'capability', 'operations']);
const WORK_ACTIVE_STATES = new Set(['active', 'blocked', 'ready', 'executing', 'approved']);

export function buildMissionFabricProjection(source: unknown, options: MissionFabricCompilerOptions): MissionFabricProjectionV1 {
  if (!isRecord(source)) throw new Error('mission fabric source must be an object');
  if (source.sourceKind === 'projection') {
    throw new Error('projection input is rejected: a projection is never an authority source for the mission fabric compiler');
  }
  if (typeof source.sourceKind !== 'string' || source.sourceKind.length === 0) {
    throw new Error('mission fabric source must declare a sourceKind');
  }
  const facts = source as unknown as MissionFabricSource;
  const tenantId = options.tenantId ?? facts.tenantId;
  if (facts.tenantId !== tenantId) {
    throw new Error(`tenant mismatch: source tenant ${facts.tenantId} does not match requested tenant ${tenantId}`);
  }
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new Error('mission fabric source must declare a tenantId');
  }
  const generatedAt = options.clock.now();
  if (typeof generatedAt !== 'string' || generatedAt.trim().length === 0) {
    throw new Error('compiler clock must return a generatedAt timestamp');
  }
  assertCanonicalUtcTimestamp(generatedAt, 'generatedAt');

  const truncations = new Map<string, number>();
  const truncatedKinds = new Set<string>();
  const noteTruncation = (material: string, dropped: number): void => {
    if (dropped > 0) truncations.set(material, (truncations.get(material) ?? 0) + dropped);
  };

  const nodes: FabricNode[] = [];
  const edges: FabricEdge[] = [];
  const gaps: FabricGap[] = [];
  const pushEdge = (kind: FabricEdgeKind, fromId: string, toId: string): void => {
    edges.push({ kind, fromId, toId });
  };

  let graphVersion = 0;
  for (const program of facts.programs ?? []) {
    if (program.authority && typeof program.authority.graphVersion === 'number') {
      graphVersion = Math.max(graphVersion, program.authority.graphVersion);
    }
  }

  const missionIds = new Set((facts.missions ?? []).map((mission) => mission.missionId));
  const taskIds = new Set((facts.tasks ?? []).map((task) => task.taskId));
  const agentIds = new Set((facts.agents ?? []).map((agent) => agent.agentId));

  for (const sapling of facts.saplings ?? []) {
    const work: SaplingWork = {
      kind: 'sapling',
      workId: sapling.saplingId,
      tenantId,
      name: truncateDisplay(sapling.branchId, truncatedKinds),
      desiredState: sapling.lifecycle,
      currentState: sapling.lifecycle,
      status: WORK_ACTIVE_STATES.has(sapling.lifecycle) ? 'active' : 'draft',
      ownerId: 'founder',
      nextAction: null,
      proofRequired: true,
      reviewAt: null,
      sourceRef: `sapling:${sapling.saplingId}`,
      sourceDigest: `sha256:${sha256(sapling.evidenceRef)}`,
      branchId: sapling.branchId,
      branchKind: 'product',
      promotionState: sapling.promotionState as SaplingWork['promotionState'],
      currentGate: sapling.missionId,
      organRoute: [],
    };
    nodes.push({ kind: 'work', value: work });
  }

  for (const program of facts.programs ?? []) {
    const programKind = PROGRAM_KINDS.has(program.programKind) ? program.programKind : 'operations';
    const work: ProgramWork = {
      kind: 'program',
      workId: program.programId,
      tenantId,
      name: truncateDisplay(program.title, truncatedKinds),
      desiredState: program.outcomeMetric,
      currentState: program.lifecycle,
      status: WORK_ACTIVE_STATES.has(program.lifecycle) ? 'active' : 'draft',
      ownerId: 'founder',
      nextAction: null,
      proofRequired: true,
      reviewAt: null,
      sourceRef: `program:${program.programId}`,
      sourceDigest: `sha256:${sha256(program.authority?.namespace ?? program.programId)}`,
      programKind: programKind as ProgramWork['programKind'],
      lifecycle: program.lifecycle as ProgramWork['lifecycle'],
      outcomeMetric: truncateDisplay(program.outcomeMetric, truncatedKinds),
    };
    nodes.push({ kind: 'work', value: work });
  }

  for (const mission of facts.missions ?? []) {
    const taskRefs = (facts.tasks ?? []).filter((task) => task.missionId === mission.missionId).map((task) => task.taskId).sort(compare);
    const node: FabricMission = {
      missionId: mission.missionId,
      workId: mission.workId,
      title: truncateDisplay(mission.title, truncatedKinds),
      objective: mission.authorityRef,
      status: mission.lifecycle === 'executing' ? 'active' : mission.lifecycle === 'approved' ? 'ready' : 'queued',
      gateId: null,
      proofRequirement: mission.authorityRef,
      taskIds: capEvidenceRefs(taskRefs, truncatedKinds),
      sourceRef: mission.authorityRef,
    };
    nodes.push({ kind: 'mission', value: node });
    pushEdge('contains', mission.workId, mission.missionId);
  }

  for (const task of facts.tasks ?? []) {
    const node: FabricTask = {
      taskId: task.taskId,
      missionId: task.missionId,
      desiredState: task.state,
      status: task.state as FabricTask['status'],
      dependencyIds: capEvidenceRefs([...task.dependsOn].sort(compare), truncatedKinds),
      assignedAgentId: task.assignedAgentId,
      requiredClusterIds: [],
      pinnedLoadoutId: null,
      leaseId: null,
      proofRequirement: '',
      latestReceiptId: null,
    };
    nodes.push({ kind: 'task', value: node });
    pushEdge('contains', task.missionId, task.taskId);
    for (const dependency of [...task.dependsOn].sort(compare)) {
      if (taskIds.has(dependency)) pushEdge('depends-on', task.taskId, dependency);
    }
    if (task.assignedAgentId !== null) {
      if (agentIds.has(task.assignedAgentId)) pushEdge('assigned-to', task.taskId, task.assignedAgentId);
    }
  }

  for (const agent of facts.agents ?? []) {
    const node: FabricAgent = {
      agentId: agent.agentId,
      role: agent.agentId,
      runtime: 'other',
      status: agent.state === 'available' ? 'available' : 'offline',
      activeTaskIds: agent.currentTaskId ? [agent.currentTaskId] : [],
      permissionProfile: agent.sourceFreshness,
      lastSeenAt: facts.asOf,
      sourceRef: `agent:${agent.agentId}`,
    };
    nodes.push({ kind: 'agent', value: node });
  }

  for (const cluster of facts.skillClusters ?? []) {
    const node: FabricSkillCluster = {
      clusterId: cluster.clusterId,
      name: cluster.clusterId,
      status: cluster.state === 'active' ? 'active' : 'inactive',
      skillIds: capEvidenceRefs([...cluster.capabilities].sort(compare), truncatedKinds),
      eligibleAgentIds: [],
      successRate: null,
      sourceRef: cluster.assignmentEvidence,
    };
    nodes.push({ kind: 'skill-cluster', value: node });
  }

  const fences = new Map((facts.fences ?? []).map((fence) => [fence.taskId, fence.currentFence]));
  const acceptedRuns: SourceRun[] = [];
  for (const run of [...(facts.runtimeRuns ?? [])].sort((a, b) => compare(a.runId, b.runId))) {
    const currentFence = fences.get(run.taskId);
    const stale = run.staleFence === true || (currentFence !== undefined && run.fence < currentFence);
    if (stale) {
      gaps.push({
        gapId: `gap-stale-fence-${run.runId}`,
        kind: 'stale-fence',
        subjectId: run.runId,
        detail: truncateDisplay(`Run ${run.runId} was rejected: fence ${run.fence} is below the authoritative fence ${currentFence ?? run.fence} for ${run.taskId}.`, truncatedKinds),
        evidenceRef: null,
      });
      continue;
    }
    acceptedRuns.push(run);
  }

  const receiptById = new Map((facts.receipts ?? []).map((receipt) => [receipt.receiptId, receipt]));
  const acceptedRunIds = new Set(acceptedRuns.map((run) => run.runId));

  for (const run of acceptedRuns) {
    const receipt = receiptById.get(run.receiptId);
    const node: FabricRun = {
      runId: run.runId,
      taskId: run.taskId,
      agentId: run.executorAgentId,
      loadoutId: `loadout:${run.nonce}`,
      startedAt: facts.asOf,
      terminalAt: receipt?.verifiedAt ?? null,
      status: run.state === 'succeeded' ? 'complete' : 'failed',
    };
    nodes.push({ kind: 'run', value: node });
    pushEdge('executes', run.executorAgentId, run.runId);
    pushEdge('produces', run.runId, run.receiptId);
  }

  for (const receipt of facts.receipts ?? []) {
    const linkedRun = receipt.runId !== null && acceptedRunIds.has(receipt.runId) ? receipt.runId : null;
    const taskId = linkedRun !== null
      ? (acceptedRuns.find((run) => run.runId === linkedRun)?.taskId ?? '')
      : '';
    const node: FabricReceipt = {
      receiptId: receipt.receiptId,
      runId: linkedRun ?? '',
      taskId,
      graphVersion,
      status: receipt.status === 'verified' ? 'complete' : 'reconciliation-required',
      inputDigest: `sha256:${sha256(receipt.receiptId)}`,
      outputDigest: receipt.evidenceRef !== null ? `sha256:${sha256(receipt.evidenceRef)}` : null,
      evidenceRefs: capEvidenceRefs(receipt.evidenceRef !== null ? [receipt.evidenceRef] : [], truncatedKinds),
      approvalRef: null,
      createdAt: receipt.verifiedAt ?? facts.asOf,
    };
    nodes.push({ kind: 'receipt', value: node });
    if (receipt.runId !== null && linkedRun === null) {
      gaps.push({
        gapId: `gap-dangling-receipt-${receipt.receiptId}`,
        kind: 'missing-receipt',
        subjectId: receipt.receiptId,
        detail: truncateDisplay(`Receipt ${receipt.receiptId} references run ${receipt.runId}, which is not part of the accepted run set.`, truncatedKinds),
        evidenceRef: receipt.evidenceRef,
      });
    }
    if (linkedRun !== null) pushEdge('proves', receipt.receiptId, taskId);
  }

  for (const gap of facts.gaps ?? []) {
    const detail = truncateDisplay(gap.detail, truncatedKinds);
    const refs = gap.evidenceRef !== null ? capEvidenceRefs(gap.evidenceRef.split(','), truncatedKinds) : null;
    gaps.push({
      gapId: gap.gapId,
      kind: gap.kind,
      subjectId: gap.subjectId ?? null,
      detail,
      evidenceRef: refs !== null ? refs.join(',') : null,
    });
  }

  const sortedNodes = [...nodes].sort((a, b) => compare(nodeIdentity(a), nodeIdentity(b)));
  const sortedEdges = [...edges].sort((a, b) => compare(`${a.kind}:${a.fromId}:${a.toId}`, `${b.kind}:${b.fromId}:${b.toId}`));
  const sortedGaps = [...gaps].sort((a, b) => compare(a.gapId, b.gapId));

  noteTruncation('nodes', sortedNodes.length - Math.min(sortedNodes.length, MISSION_FABRIC_CAPS.MAX_NODES));
  noteTruncation('edges', sortedEdges.length - Math.min(sortedEdges.length, MISSION_FABRIC_CAPS.MAX_EDGES));
  const boundedNodes = sortedNodes.slice(0, MISSION_FABRIC_CAPS.MAX_NODES);
  const boundedEdges = sortedEdges.slice(0, MISSION_FABRIC_CAPS.MAX_EDGES);

  for (const [material, dropped] of [...truncations.entries()].sort((a, b) => compare(a[0], b[0]))) {
    sortedGaps.push({
      gapId: `gap-projection-truncated-${material}`,
      kind: 'projection-truncated',
      subjectId: null,
      detail: `${material} exceeded the projection cap; ${dropped} entr${dropped === 1 ? 'y was' : 'ies were'} omitted deterministically.`,
      evidenceRef: null,
    });
  }
  for (const kind of [...truncatedKinds].sort(compare)) {
    sortedGaps.push({
      gapId: `gap-projection-truncated-${kind}`,
      kind: 'projection-truncated',
      subjectId: null,
      detail: `${kind} exceeded the per-node or display cap and was truncated deterministically.`,
      evidenceRef: null,
    });
  }
  sortedGaps.sort((a, b) => compare(a.gapId, b.gapId));
  if (sortedGaps.length > MISSION_FABRIC_CAPS.MAX_GAPS) {
    throw new Error(`mission fabric gaps exceed the cap of ${MISSION_FABRIC_CAPS.MAX_GAPS}; failing closed instead of dropping gap records`);
  }

  const graphContent = {
    projectionVersion: 1 as const,
    tenantId,
    graphVersion,
    sourceOfTruth: 'd1-goal-graph' as const,
    readOnly: true as const,
    nodes: boundedNodes,
    edges: boundedEdges,
    gaps: sortedGaps,
  };

  const asOfCandidates: string[] = [];
  if (typeof facts.asOf === 'string' && facts.asOf.length > 0) {
    asOfCandidates.push(assertCanonicalUtcTimestamp(facts.asOf, 'asOf candidate facts.asOf'));
  }
  for (const receipt of facts.receipts ?? []) {
    if (receipt.verifiedAt !== null) {
      asOfCandidates.push(assertCanonicalUtcTimestamp(receipt.verifiedAt, `asOf candidate receipt ${receipt.receiptId}.verifiedAt`));
    }
  }
  for (const entry of facts.evidence ?? []) {
    if (typeof entry.observedAt === 'string') {
      asOfCandidates.push(assertCanonicalUtcTimestamp(entry.observedAt, `asOf candidate evidence ${entry.evidenceRef}.observedAt`));
    }
  }
  const asOf = asOfCandidates.sort(compare).at(-1) ?? generatedAt;

  return {
    schema: 'cambium.mission-fabric-projection.v1',
    projectionVersion: 1,
    tenantId,
    graphVersion,
    graphDigest: projectionDigest(graphContent),
    generatedAt,
    asOf,
    sourceOfTruth: 'd1-goal-graph',
    readOnly: true,
    nodes: boundedNodes,
    edges: boundedEdges,
    gaps: sortedGaps,
  };
}
