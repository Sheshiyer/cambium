export const CAMBIUM_VISUAL_STAGES = [
  { id: 'genesis', glyph: 'GE', title: 'GENESIS', detail: 'brand DNA, brief, scaffold', arcs: ['I', 'II', 'X', 'XI'] },
  { id: 'taste', glyph: 'TA', title: 'TASTE', detail: 'ICP resonance, references, acceptance', arcs: ['III'] },
  { id: 'build', glyph: 'BU', title: 'BUILD', detail: 'commits, review, ship gate', arcs: ['XII', 'XIII', 'XIV'] },
  { id: 'ops', glyph: 'OP', title: 'OPS', detail: 'loop, viability, launch, handoff', arcs: ['IV', 'V', 'IX', 'XV', 'XVI', 'XVII'] },
  { id: 'cortex', glyph: 'CX', title: 'CORTEX', detail: 'memory, tenants, live org recall', arcs: ['VI', 'VII', 'VIII'] },
] as const;

export const CAMBIUM_VISUAL_RAILS = [
  { id: 'genesis-to-taste', from: 'genesis', to: 'taste', label: 'intake -> resonance', lane: 'handoff' },
  { id: 'taste-to-build', from: 'taste', to: 'build', label: 'taste gate -> artifact', lane: 'handoff' },
  { id: 'build-to-ops', from: 'build', to: 'ops', label: 'ship gate -> live loop', lane: 'runner' },
  { id: 'cortex-to-genesis', from: 'cortex', to: 'genesis', label: 'memory feed -> genesis', lane: 'background-emitter' },
  { id: 'cortex-to-taste', from: 'cortex', to: 'taste', label: 'memory feed -> taste', lane: 'background-emitter' },
  { id: 'cortex-to-build', from: 'cortex', to: 'build', label: 'memory feed -> build', lane: 'background-emitter' },
  { id: 'cortex-to-ops', from: 'cortex', to: 'ops', label: 'memory feed -> ops', lane: 'background-emitter' },
] as const;

export const CAMBIUM_WAKE_STEPS = [
  { id: 'ingest', label: 'INGEST', missing: 'missing source' },
  { id: 'route', label: 'ROUTE', missing: 'missing active route' },
  { id: 'act', label: 'ACT', missing: 'no available quest rows' },
  { id: 'viability', label: 'VIABILITY', missing: 'awaiting signal' },
  { id: 'learn', label: 'LEARN', missing: 'awaiting signal' },
  { id: 'persist', label: 'PERSIST', missing: 'missing derivedAt' },
] as const;

export const CAMBIUM_SENSES = [
  { id: 'signal', title: 'SIGNAL', empty: 'frontier complete' },
  { id: 'memory', title: 'MEMORY', empty: 'no cortex rows' },
  { id: 'risk', title: 'RISK', empty: 'no locked traces' },
  { id: 'drift', title: 'DRIFT', empty: 'fresh ledger' },
] as const;

export const CAMBIUM_LANES = [
  { id: 'micro', title: 'MICRO', empty: 'no micro moves' },
  { id: 'meso', title: 'MESO', empty: 'no meso moves' },
  { id: 'macro', title: 'MACRO', empty: 'no macro moves' },
  { id: 'noesis', title: 'NOESIS', empty: 'no noesis moves' },
] as const;

export type CambiumVisualStage = (typeof CAMBIUM_VISUAL_STAGES)[number];
export type CambiumVisualRail = (typeof CAMBIUM_VISUAL_RAILS)[number];
export type CambiumWakeStepId = (typeof CAMBIUM_WAKE_STEPS)[number]['id'];
export type CambiumSenseId = (typeof CAMBIUM_SENSES)[number]['id'];
export type CambiumLaneId = (typeof CAMBIUM_LANES)[number]['id'];
