export const MINI_APP_SCENE_IDS = ['quests', 'map', 'story', 'gate', 'commands'] as const;
export type MiniAppSceneId = typeof MINI_APP_SCENE_IDS[number];

export const MINI_APP_ECOSYSTEM_TARGETS = [
  'telegram',
  'hermes',
  'paperclip',
  'cambium-worker',
  'quine',
  'operator-policy',
  'cortex',
  'r3f',
  'github',
  'vault-via-paperclip',
  'live-proof',
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
  'quest-line',
  'operator-map',
  'story-feed',
  'founder-gate',
  'command-center',
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

export type MiniAppSurfaceSection = {
  id: MiniAppSectionId;
  scene: MiniAppSceneId;
  target: MiniAppEcosystemTarget;
  interaction: MiniAppInteractionKind;
  source: string;
};

export type MiniAppMapSubsection = {
  id: MiniAppMapSubsectionId;
  target: MiniAppEcosystemTarget;
  interaction: MiniAppInteractionKind;
  source: string;
};

export const MINI_APP_SECTIONS: readonly MiniAppSurfaceSection[] = [
  { id: 'quest-line', scene: 'quests', target: 'quine', interaction: 'sheet', source: 'quest-ledger-envelope@v1' },
  { id: 'operator-map', scene: 'map', target: 'r3f', interaction: 'sheet', source: 'shared/cambium-visual-contract.ts' },
  { id: 'story-feed', scene: 'story', target: 'paperclip', interaction: 'read-only', source: 'served beats or completed quest rows' },
  { id: 'founder-gate', scene: 'gate', target: 'telegram', interaction: 'signed-action', source: 'telegram initData plus Worker gate queue' },
  { id: 'command-center', scene: 'commands', target: 'hermes', interaction: 'chat-command', source: 'curios.self command surface' },
];

export const MINI_APP_MAP_SUBSECTIONS: readonly MiniAppMapSubsection[] = [
  { id: 'tapestry', target: 'cambium-worker', interaction: 'sheet', source: 'tapestryRows visual audit' },
  { id: 'wake', target: 'quine', interaction: 'sheet', source: 'visual envelope wake steps' },
  { id: 'lanes', target: 'quine', interaction: 'sheet', source: 'visual envelope lane counts' },
  { id: 'stance', target: 'operator-policy', interaction: 'sheet', source: 'tenant stance visual envelope' },
  { id: 'policy', target: 'operator-policy', interaction: 'sheet', source: 'operator-policy contract' },
  { id: 'decision-context', target: 'operator-policy', interaction: 'sheet', source: 'decision-context@v1' },
  { id: 'live-proof', target: 'live-proof', interaction: 'external-proof', source: 'tg-live-proof-readiness audit' },
  { id: 'side-quests', target: 'quine', interaction: 'signed-action', source: 'pure-trigger-predicates and side-quest queue' },
  { id: 'coordination', target: 'paperclip', interaction: 'sheet', source: 'coordination-evidence@v1' },
  { id: 'senses', target: 'cortex', interaction: 'sheet', source: 'quest-ledger-envelope@v1 senses' },
  { id: 'stages', target: 'r3f', interaction: 'sheet', source: 'shared visual stage contract' },
  { id: 'evidence-boxes', target: 'quine', interaction: 'sheet', source: 'quest-ledger-evidence@v1' },
  { id: 'skills', target: 'github', interaction: 'signed-action', source: 'skill-registry visual envelope' },
  { id: 'companions', target: 'cortex', interaction: 'sheet', source: 'operator-npc-events@v1 and cortex memory' },
  { id: 'rails', target: 'r3f', interaction: 'read-only', source: 'shared visual rail contract' },
];
