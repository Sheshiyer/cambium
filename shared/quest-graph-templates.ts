/**
 * Quest graph templates — arcs I–VII as Goal Graph *templates*.
 *
 * NOT live writes. Templates may be compiled into admission proposals only after
 * founder Gate + D1 CAS. Mirrors QUESTLOG.md arcs I–VII and operator quest fold ids.
 *
 * Schema: cambium.quest-graph-templates.v1
 */

export const QUEST_GRAPH_TEMPLATES_SCHEMA = 'cambium.quest-graph-templates.v1' as const;

export type QuestArcRoman = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII';
export type TemplateForm = 'loop' | 'graph';
export type TemplateNodeKind =
  | 'quest-arc'
  | 'onboarding'
  | 'organ'
  | 'gate'
  | 'evidence'
  | 'tenant';

export interface QuestTemplateNode {
  nodeId: string;
  kind: TemplateNodeKind;
  specialty: string;
  title: string;
  /** Machine-checkable exit predicate description (not executable SQL). */
  exitPredicate: string;
  layer: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
}

export interface QuestTemplateEdge {
  from: string;
  to: string;
  relation: 'requires' | 'reveals' | 'feeds';
}

export interface QuestArcTemplate {
  arc: QuestArcRoman;
  questId: string;
  title: string;
  form: TemplateForm;
  narration: string;
  reveals: string;
  /** Matches bin/operator/quests/quests.ts doneWhen evidence shape (descriptive). */
  doneWhenSummary: string;
  nodes: QuestTemplateNode[];
  edges: QuestTemplateEdge[];
  /** Template may become D1 nodes only when this gate is satisfied. */
  admissionGate: string;
  writesGoalGraph: false;
}

/** Founder tutorial arcs I–VII only (QUESTLOG classic line). */
export const QUEST_ARC_TEMPLATES: QuestArcTemplate[] = [
  {
    arc: 'I',
    questId: 'the-calling',
    title: 'The Calling',
    form: 'loop',
    narration: 'Play the first session — 20 interactions, all 8 drives, the noesis beats.',
    reveals: 'the onboarding organ (Octalysis tutorial)',
    doneWhenSummary: 'stepIndex>=20 · drives>=8 · noesis>=3',
    admissionGate: 'onboarding session evidence present; no D1 required',
    writesGoalGraph: false,
    nodes: [
      {
        nodeId: 'q-i-session',
        kind: 'onboarding',
        specialty: 'octalysis-tutorial',
        title: 'First session 20/20',
        exitPredicate: 'onboarding.stepIndex >= 20 && drivesActivated.length >= 8 && noesisMoments >= 3',
        layer: 'L4',
      },
    ],
    edges: [],
  },
  {
    arc: 'II',
    questId: 'first-mint',
    title: 'First Mint',
    form: 'loop',
    narration: 'Claim a real brand-DNA — seed, positioning, and a one-word CTA.',
    reveals: 'genesis output + world-state mutability',
    doneWhenSummary: 'seed · positioning · cta placeholder-free',
    admissionGate: 'world artifacts claimed; genesis organ complete for tenant',
    writesGoalGraph: false,
    nodes: [
      {
        nodeId: 'q-ii-genesis',
        kind: 'organ',
        specialty: 'genesis',
        title: 'Brand DNA claim',
        exitPredicate: 'artifacts.seed && artifacts.positioning && artifacts.cta without placeholders',
        layer: 'L4',
      },
    ],
    edges: [{ from: 'q-i-session', to: 'q-ii-genesis', relation: 'requires' }],
  },
  {
    arc: 'III',
    questId: 'taste-resonance',
    title: 'Taste & Resonance',
    form: 'loop',
    narration: 'Let the ICP push back — meso moves are the market talking.',
    reveals: 'the ICP-NPC + the meso lane',
    doneWhenSummary: 'meso log count >= 3',
    admissionGate: 'first mint complete; meso lane exercised',
    writesGoalGraph: false,
    nodes: [
      {
        nodeId: 'q-iii-meso',
        kind: 'organ',
        specialty: 'taste-meso',
        title: 'Meso pushback ×3',
        exitPredicate: 'count(world.log, "meso") >= 3',
        layer: 'L4',
      },
    ],
    edges: [{ from: 'q-ii-genesis', to: 'q-iii-meso', relation: 'requires' }],
  },
  {
    arc: 'IV',
    questId: 'the-loop',
    title: 'The Loop',
    form: 'loop',
    narration: 'Exercise micro, meso, and macro through the gate.',
    reveals: 'micro / meso / macro + the evidence gate',
    doneWhenSummary: 'micro>=1 · meso>=1 · macro>=1',
    admissionGate: 'taste resonance complete',
    writesGoalGraph: false,
    nodes: [
      {
        nodeId: 'q-iv-micro',
        kind: 'organ',
        specialty: 'micro-tweak',
        title: 'Micro tick',
        exitPredicate: 'count(world.log, "micro") >= 1',
        layer: 'L4',
      },
      {
        nodeId: 'q-iv-meso',
        kind: 'organ',
        specialty: 'meso-reroll',
        title: 'Meso tick',
        exitPredicate: 'count(world.log, "meso") >= 1',
        layer: 'L4',
      },
      {
        nodeId: 'q-iv-macro',
        kind: 'gate',
        specialty: 'macro-gate',
        title: 'Macro setpoint via gate',
        exitPredicate: 'count(world.log, "macro") >= 1',
        layer: 'L3',
      },
    ],
    edges: [
      { from: 'q-iii-meso', to: 'q-iv-micro', relation: 'requires' },
      { from: 'q-iv-micro', to: 'q-iv-meso', relation: 'feeds' },
      { from: 'q-iv-meso', to: 'q-iv-macro', relation: 'feeds' },
    ],
  },
  {
    arc: 'V',
    questId: 'viability',
    title: 'Viability',
    form: 'loop',
    narration: 'Face the board — solvency and mission-coherence swept.',
    reveals: 'the heartbeat + viability margins',
    doneWhenSummary: 'heartbeat or viability log >= 1',
    admissionGate: 'the loop complete',
    writesGoalGraph: false,
    nodes: [
      {
        nodeId: 'q-v-heartbeat',
        kind: 'evidence',
        specialty: 'viability-sweep',
        title: 'Heartbeat / viability sweep',
        exitPredicate: 'count(log, "heartbeat"|"viability") >= 1',
        layer: 'L2',
      },
    ],
    edges: [{ from: 'q-iv-macro', to: 'q-v-heartbeat', relation: 'requires' }],
  },
  {
    arc: 'VI',
    questId: 'memory',
    title: 'Memory',
    form: 'loop',
    narration: 'The cortex holds this venture across runs.',
    reveals: 'the cortex (semantic memory)',
    doneWhenSummary: 'cortexCount >= 1',
    admissionGate: 'viability complete; cortex reachable',
    writesGoalGraph: false,
    nodes: [
      {
        nodeId: 'q-vi-cortex',
        kind: 'evidence',
        specialty: 'cortex-memory',
        title: 'Cortex record ≥1',
        exitPredicate: 'cortexCount >= 1',
        layer: 'L2',
      },
    ],
    edges: [{ from: 'q-v-heartbeat', to: 'q-vi-cortex', relation: 'requires' }],
  },
  {
    arc: 'VII',
    questId: 'many-gardens',
    title: 'Many Gardens',
    form: 'graph',
    narration: 'One operator, many ventures — isolated worlds.',
    reveals: 'multi-tenancy + the isolation suite',
    doneWhenSummary: 'tenants > 1 && isolationSuite === true',
    admissionGate: 'memory complete; isolation suite green; multi-tenant provision approved',
    writesGoalGraph: false,
    nodes: [
      {
        nodeId: 'q-vii-tenant-a',
        kind: 'tenant',
        specialty: 'tenant-isolation',
        title: 'Tenant garden A',
        exitPredicate: 'tenant world exists',
        layer: 'L5',
      },
      {
        nodeId: 'q-vii-tenant-b',
        kind: 'tenant',
        specialty: 'tenant-isolation',
        title: 'Tenant garden B',
        exitPredicate: 'second tenant world exists',
        layer: 'L5',
      },
      {
        nodeId: 'q-vii-isolation-suite',
        kind: 'evidence',
        specialty: 'isolation-tests',
        title: 'Isolation suite green',
        exitPredicate: 'isolationSuite === true',
        layer: 'L3',
      },
    ],
    edges: [
      { from: 'q-vi-cortex', to: 'q-vii-tenant-a', relation: 'requires' },
      { from: 'q-vii-tenant-a', to: 'q-vii-tenant-b', relation: 'feeds' },
      { from: 'q-vii-tenant-b', to: 'q-vii-isolation-suite', relation: 'requires' },
    ],
  },
];

/** Cross-arc dependency spine (questId order). */
export const QUEST_ARC_SPINE: Array<{ from: string; to: string }> = [
  { from: 'the-calling', to: 'first-mint' },
  { from: 'first-mint', to: 'taste-resonance' },
  { from: 'taste-resonance', to: 'the-loop' },
  { from: 'the-loop', to: 'viability' },
  { from: 'viability', to: 'memory' },
  { from: 'memory', to: 'many-gardens' },
];

/**
 * Compile templates into a D1-shaped *proposal payload* only.
 * Does not open a connection or perform CAS.
 */
export function compileQuestGraphAdmissionProposal(opts: {
  tenant: string;
  arcs?: QuestArcRoman[];
  actor: string;
  sourceRef: string;
}): {
  schema: 'cambium.quest-graph-admission-proposal.v1';
  writesGoalGraph: false;
  requires: ['founder-gate', 'd1-cas'];
  tenant: string;
  actor: string;
  sourceRef: string;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  note: string;
} {
  const want = new Set(opts.arcs ?? (['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as QuestArcRoman[]));
  const arcs = QUEST_ARC_TEMPLATES.filter((a) => want.has(a.arc));
  const nodes = arcs.flatMap((a) =>
    a.nodes.map((n) => ({
      templateNodeId: n.nodeId,
      questId: a.questId,
      arc: a.arc,
      kind: n.kind,
      specialty: n.specialty,
      title: n.title,
      exitPredicate: n.exitPredicate,
      layer: n.layer,
      status: 'template-only',
    })),
  );
  const edges = arcs.flatMap((a) =>
    a.edges.map((e) => ({
      from: e.from,
      to: e.to,
      relation: e.relation,
      questId: a.questId,
    })),
  );
  for (const s of QUEST_ARC_SPINE) {
    edges.push({ from: s.from, to: s.to, relation: 'requires', questId: 'spine' });
  }
  return {
    schema: 'cambium.quest-graph-admission-proposal.v1',
    writesGoalGraph: false,
    requires: ['founder-gate', 'd1-cas'],
    tenant: opts.tenant,
    actor: opts.actor,
    sourceRef: opts.sourceRef,
    nodes,
    edges,
    note: 'Proposal only. Goal Graph admission requires founder Gate and version-bound CAS. Templates never auto-write.',
  };
}

export function questGraphTemplatesManifest() {
  return {
    schema: QUEST_GRAPH_TEMPLATES_SCHEMA,
    version: 1,
    writesGoalGraph: false,
    source: 'QUESTLOG.md arcs I–VII + bin/operator/quests/quests.ts ids',
    doctrine: 'docs/architecture/loops-to-graphs.md',
    arcs: QUEST_ARC_TEMPLATES.map((a) => ({
      arc: a.arc,
      questId: a.questId,
      title: a.title,
      form: a.form,
      nodeCount: a.nodes.length,
      edgeCount: a.edges.length,
      admissionGate: a.admissionGate,
    })),
    spine: QUEST_ARC_SPINE,
  };
}
