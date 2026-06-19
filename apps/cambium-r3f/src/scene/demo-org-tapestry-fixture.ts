import type { TapestrySnapshot } from './tapestry-snapshot-scene.ts';

export const demoOrgTapestrySnapshot = {
  schema: 'cambium.fractal-tapestry.snapshot.v1',
  generatedAt: '2026-06-19T00:00:00.000Z',
  standalone: true,
  tenant: {
    id: 'demo-org',
    label: 'Demo Grove',
    vision: 'Turn a clear founder promise into a living operating map.',
    mission: 'ship useful, on-brand work with synthetic demo evidence only',
  },
  recursion: ['skill', 'cluster', 'organ', 'venture', 'company', 'portfolio'],
  field: {
    id: 'cambium-field',
    role: 'living-fractal-substrate',
    symmetry: 'organ-radial',
  },
  nodes: [
    { id: 'genesis', organ: 'genesis', title: 'Genesis', status: 'complete', x: -4.8, z: -1.2 },
    { id: 'taste', organ: 'taste', title: 'Taste', status: 'active', x: -2.1, z: 1.2 },
    { id: 'build', organ: 'hands', title: 'Build', status: 'complete', x: 1.4, z: 1.05 },
    { id: 'ops', organ: 'will', title: 'Ops', status: 'active', x: 4.4, z: -1.15 },
    {
      id: 'cortex',
      organ: 'cortex',
      title: 'Cortex',
      status: 'memory',
      x: 0.1,
      z: -3.25,
      inputs: ['semantic_memory', 'structural_memory'],
      outputs: ['genesis', 'taste', 'build', 'ops'],
    },
  ],
  rails: [
    { id: 'genesis-to-taste', from: 'genesis', to: 'taste', lane: 'handoff' },
    { id: 'taste-to-build', from: 'taste', to: 'build', lane: 'handoff' },
    { id: 'build-to-ops', from: 'build', to: 'ops', lane: 'runner' },
    { id: 'cortex-to-genesis', from: 'cortex', to: 'genesis', lane: 'memory' },
    { id: 'cortex-to-taste', from: 'cortex', to: 'taste', lane: 'memory' },
    { id: 'cortex-to-build', from: 'cortex', to: 'build', lane: 'memory' },
    { id: 'cortex-to-ops', from: 'cortex', to: 'ops', lane: 'memory' },
  ],
  telemetry: {
    worldVersion: 4,
    completedQuestCount: 3,
    totalQuestCount: 4,
    onboardingSteps: 20,
    projectArchived: false,
    source: 'synthetic-demo-fixture',
  },
  artifacts: {
    seed: 'A portable operating layer for a founder-led team.',
    positioning: 'A neutral company compiler that turns intent into coordinated work.',
    cta: 'begin',
  },
  quests: [
    { id: 'the-calling', arc: 'I', status: 'complete', evidence: '20/20 synthetic onboarding steps' },
    { id: 'the-brief', arc: 'X', status: 'complete', evidence: 'brief accepted · contract signed · deposit received' },
    { id: 'the-gate', arc: 'XIV', status: 'complete', evidence: '1 synthetic approval through abstract gate' },
    { id: 'the-archive', arc: 'XVII', status: 'active', evidence: 'lessons minted · archive pending' },
  ],
} as const satisfies TapestrySnapshot & {
  generatedAt: string;
  field: { id: string; role: string; symmetry: string };
  artifacts: { seed: string; positioning: string; cta: string };
};
