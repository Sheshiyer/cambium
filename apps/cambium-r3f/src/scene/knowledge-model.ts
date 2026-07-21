export interface KnowledgeRow {
  id: string;
  label: string;
  value: string;
  tone?: string;
}

export interface KnowledgeSection {
  id: string;
  kicker: string;
  title: string;
  rows: readonly KnowledgeRow[];
}

export const KNOWLEDGE_SECTIONS: readonly KnowledgeSection[] = [
  {
    id: 'boot',
    kicker: 'RUN THE APP',
    title: 'Boot',
    rows: [
      { id: 'boot-dev', label: 'VISUAL ENGINE', value: 'npm run r3f:dev', tone: 'signal' },
      { id: 'boot-tenant', label: 'DEMO TENANT', value: 'npm run demo:tenant -- --tenant demo-org --force', tone: 'mist' },
      { id: 'boot-quests', label: 'DEMO QUESTS', value: 'npm run demo:quests -- --tenant demo-org', tone: 'mist' },
      { id: 'boot-tapestry', label: 'TAPESTRY', value: 'npm run tapestry:snapshot -- --tenant demo-org --out /tmp/demo-org.tapestry.json', tone: 'depth' },
      { id: 'boot-tests', label: 'VERIFY', value: 'npm test', tone: 'signal' },
    ],
  },
  {
    id: 'modes',
    kicker: 'HUD MODES',
    title: 'Modes',
    rows: [
      { id: 'mode-map', label: 'MAP', value: 'constellation overview — hubs are organs, chains are dependencies', tone: 'signal' },
      { id: 'mode-sheets', label: 'SHEETS', value: 'all 21 map subsections as readable sheets', tone: 'mist' },
      { id: 'mode-workforce', label: 'WORKFORCE', value: 'team + consultant sharing (identity wiring in plan C4)', tone: 'depth' },
    ],
  },
  {
    id: 'map',
    kicker: 'READ THE MAP',
    title: 'Constellation',
    rows: [
      { id: 'map-hubs', label: 'HUBS', value: 'organs — genesis star, taste capsule, build triangle, ops slab, cortex wheel', tone: 'signal' },
      { id: 'map-dendrites', label: 'DENDRITES', value: 'jobs, skills, and clusters branching from each organ', tone: 'mist' },
      { id: 'map-center', label: 'CENTER', value: 'cortex — shared memory feeding every organ', tone: 'depth' },
      { id: 'map-chains', label: 'CHAIN EDGES', value: 'dependencies — click a hub to zoom to its island', tone: 'mist' },
    ],
  },
  {
    id: 'settings',
    kicker: 'MAKE IT YOURS',
    title: 'Settings',
    rows: [
      { id: 'set-motion', label: 'REDUCED MOTION', value: 'system follows your OS; on/off overrides', tone: 'mist' },
      { id: 'set-camera', label: 'DEFAULT CAMERA', value: 'overview ring, node zoom, or flat top-down', tone: 'mist' },
      { id: 'set-tenant', label: 'TENANT', value: 'which venture slug this view reads', tone: 'depth' },
      { id: 'set-worker', label: 'WORKER URL', value: 'quests worker base for live envelopes', tone: 'signal' },
    ],
  },
  {
    id: 'docs',
    kicker: 'GO DEEPER',
    title: 'Docs',
    rows: [
      { id: 'doc-readme', label: 'START', value: 'README.md', tone: 'signal' },
      { id: 'doc-plans', label: 'ACTIVE PLANS', value: 'docs/plans/README.md', tone: 'mist' },
      { id: 'doc-adopters', label: 'RUN GUIDES', value: 'docs/adopters/', tone: 'mist' },
      { id: 'doc-arch', label: 'ARCHITECTURE', value: 'ARCHITECTURE.md', tone: 'depth' },
    ],
  },
];
