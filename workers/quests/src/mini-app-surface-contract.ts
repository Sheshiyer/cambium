export const MINI_APP_SCENE_IDS = ['mission', 'gate', 'tools', 'story', 'inspect'] as const;
export type MiniAppSceneId = typeof MINI_APP_SCENE_IDS[number];

export const MINI_APP_ECOSYSTEM_TARGETS = [
  'telegram',
  'hermes',
  'paperclip',
  'cambium-worker',
  'quine',
  'quest-ledger',
  'operator-policy',
  'operator-skills',
  'operator-narrative',
  'cortex',
  'r3f',
  'github',
  'skills',
  'gtm',
  'distribution',
  'vault-via-paperclip',
  'live-proof',
  'product-branches',
] as const;
export type MiniAppEcosystemTarget = typeof MINI_APP_ECOSYSTEM_TARGETS[number];

export const MINI_APP_INTERACTION_KINDS = [
  'sheet',
  'signed-action',
  'chat-command',
  'read-only',
  'external-proof',
] as const;
export type MiniAppInteractionKind = typeof MINI_APP_INTERACTION_KINDS[number];

export const MINI_APP_SECTION_IDS = [
  'mission-control',
  'founder-gate',
  'operator-toolbelt',
  'story-feed',
  'inspect',
] as const;
export type MiniAppSectionId = typeof MINI_APP_SECTION_IDS[number];

export const MINI_APP_MAP_SUBSECTION_IDS = [
  'tapestry',
  'wake',
  'lanes',
  'stance',
  'policy',
  'decision-context',
  'live-proof',
  'branches',
  'branch-arcs',
  'branch-missions',
  'branch-kpis',
  'branch-gates',
  'branch-proof',
  'side-quests',
  'coordination',
  'senses',
  'stages',
  'evidence-boxes',
  'skills',
  'companions',
  'rails',
] as const;
export type MiniAppMapSubsectionId = typeof MINI_APP_MAP_SUBSECTION_IDS[number];

export type MiniAppInteractionControl = {
  id: string;
  interaction: MiniAppInteractionKind;
  source: string;
  target?: MiniAppEcosystemTarget;
};

export type MiniAppInteractionProfile = {
  primary: MiniAppInteractionKind;
  secondary?: readonly MiniAppInteractionKind[];
  controls?: readonly MiniAppInteractionControl[];
};

export type MiniAppSurfaceSection = {
  id: MiniAppSectionId;
  scene: MiniAppSceneId;
  target: MiniAppEcosystemTarget;
  interactions: MiniAppInteractionProfile;
  source: string;
};

export type MiniAppMapSubsection = {
  id: MiniAppMapSubsectionId;
  target: MiniAppEcosystemTarget;
  interactions: MiniAppInteractionProfile;
  source: string;
};

export const MINI_APP_SECTIONS: readonly MiniAppSurfaceSection[] = [
  { id: 'mission-control', scene: 'mission', target: 'product-branches', interactions: { primary: 'sheet' }, source: 'product-branch-packets@v1 plus quest-ledger-envelope@v1' },
  { id: 'founder-gate', scene: 'gate', target: 'telegram', interactions: { primary: 'signed-action' }, source: 'telegram initData plus Worker gate queue' },
  {
    id: 'operator-toolbelt',
    scene: 'tools',
    target: 'hermes',
    interactions: {
      primary: 'sheet',
      secondary: ['chat-command', 'read-only'],
      controls: [
        { id: 'live-command-sheet', interaction: 'sheet', source: 'paperclipCommandsData' },
        { id: 'typed-chat-action', interaction: 'chat-command', source: 'curios.self-chat-command' },
        { id: 'command-reference', interaction: 'read-only', source: 'curios.self-command-reference' },
      ],
    },
    source: 'paperclipCommandsData plus curios.self command reference/action surface',
  },
  {
    id: 'story-feed',
    scene: 'story',
    target: 'operator-narrative',
    interactions: {
      primary: 'sheet',
      secondary: ['read-only'],
      controls: [
        { id: 'heartbeat-story-beat', interaction: 'sheet', source: 'world.log', target: 'quine' },
        { id: 'paperclip-story-beat', interaction: 'sheet', source: 'paperclipActivityBeats', target: 'paperclip' },
        { id: 'forge-story-beat', interaction: 'sheet', source: 'deviations', target: 'operator-skills' },
        { id: 'noesis-story-beat', interaction: 'sheet', source: 'operator-narrative', target: 'operator-narrative' },
        { id: 'quest-story-fallback', interaction: 'sheet', source: 'quest-ledger', target: 'quest-ledger' },
      ],
    },
    source: 'served beats or complete quest rows',
  },
  { id: 'inspect', scene: 'inspect', target: 'cambium-worker', interactions: { primary: 'sheet' }, source: 'shared/cambium-visual-contract.ts and served visual envelope proofs' },
];

export const MINI_APP_MAP_SUBSECTIONS: readonly MiniAppMapSubsection[] = [
  { id: 'tapestry', target: 'cambium-worker', interactions: { primary: 'sheet' }, source: 'tapestryRows visual audit' },
  { id: 'wake', target: 'quine', interactions: { primary: 'sheet' }, source: 'visual envelope wake steps' },
  { id: 'lanes', target: 'quine', interactions: { primary: 'sheet' }, source: 'visual envelope lane counts' },
  { id: 'stance', target: 'operator-policy', interactions: { primary: 'sheet' }, source: 'tenant stance visual envelope' },
  { id: 'policy', target: 'operator-policy', interactions: { primary: 'sheet' }, source: 'operator-policy contract' },
  { id: 'decision-context', target: 'operator-policy', interactions: { primary: 'sheet' }, source: 'decision-context@v1' },
  { id: 'live-proof', target: 'live-proof', interactions: { primary: 'external-proof' }, source: 'tg-live-proof-readiness audit' },
  { id: 'branches', target: 'product-branches', interactions: { primary: 'sheet' }, source: 'product-branch-packets@v1 branch stories' },
  { id: 'branch-arcs', target: 'product-branches', interactions: { primary: 'sheet' }, source: 'BranchStoryArc arc metadata' },
  { id: 'branch-missions', target: 'product-branches', interactions: { primary: 'sheet' }, source: 'BranchStoryArc mission queue' },
  { id: 'branch-kpis', target: 'product-branches', interactions: { primary: 'sheet' }, source: 'BranchStoryArc KPI controls' },
  { id: 'branch-gates', target: 'product-branches', interactions: { primary: 'sheet' }, source: 'BranchStoryArc gate ledger' },
  { id: 'branch-proof', target: 'product-branches', interactions: { primary: 'external-proof' }, source: 'BranchStoryArc proof foldback' },
  {
    id: 'side-quests',
    target: 'quine',
    interactions: {
      primary: 'sheet',
      controls: [
        { id: 'queue-side-quest', interaction: 'signed-action', source: 'side-quest queue action' },
      ],
    },
    source: 'pure-trigger-predicates and side-quest queue',
  },
  { id: 'coordination', target: 'paperclip', interactions: { primary: 'sheet' }, source: 'coordination-evidence@v1' },
  { id: 'senses', target: 'cortex', interactions: { primary: 'sheet' }, source: 'quest-ledger-envelope@v1 senses' },
  { id: 'stages', target: 'r3f', interactions: { primary: 'sheet' }, source: 'shared visual stage contract' },
  { id: 'evidence-boxes', target: 'quine', interactions: { primary: 'sheet' }, source: 'quest-ledger-evidence@v1' },
  {
    id: 'skills',
    target: 'skills',
    interactions: {
      primary: 'sheet',
      controls: [
        { id: 'promote-skill-review', interaction: 'signed-action', source: 'skill promotion review queue', target: 'skills' },
      ],
    },
    source: 'skill-registry visual envelope',
  },
  { id: 'companions', target: 'cortex', interactions: { primary: 'sheet' }, source: 'operator-npc-events@v1 and cortex memory' },
  { id: 'rails', target: 'r3f', interactions: { primary: 'sheet' }, source: 'shared visual rail contract' },
];
