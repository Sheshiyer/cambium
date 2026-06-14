import { sourceContract } from '../generated/source-contract.ts';
import { engineControls, islandDefinitionFor, visualizationLayers } from '../world/island-registry.ts';
import { cambiumQaPolicy } from './desktop-qa-policy.ts';
import { defaultScreenId, routeDrafts } from './route-registry.ts';
import type { CameraMode, CambiumSceneModel, EmitterLane, SceneNode, SceneRail, SceneReference, ScreenId, ScreenSpec } from './types.ts';
import { visualTokens } from './visual-tokens.ts';

type PipelineStage = (typeof sourceContract.pipeline.stages)[number];

const layout: Record<string, { x: number; z: number; height: number }> = {
  genesis: { x: -4.8, z: -1.2, height: 0.72 },
  taste: { x: -2.1, z: 1.2, height: 0.94 },
  build: { x: 1.4, z: 1.05, height: 0.82 },
  ops: { x: 4.4, z: -1.15, height: 0.78 },
  cortex: { x: 0.1, z: -3.25, height: 1.05 },
};

const referenceByScreen = new Map(
  (sourceContract.referenceFreeze.screenReferences as readonly SceneReference[]).map((reference) => [
    reference.screen,
    reference,
  ]),
);

function stageState(id: string, selectedNode?: string) {
  if (id === selectedNode) return 'active' as const;
  if (id === 'cortex') return 'memory' as const;
  if (id === 'taste') return 'active' as const;
  if (id === 'genesis') return 'complete' as const;
  return 'pending' as const;
}

function referenceForStage(stageId: string): SceneReference | undefined {
  const screenId = stageId === 'cortex' ? 'island-cortex' : `island-${stageId}`;
  return referenceByScreen.get(screenId);
}

function stageNode(stage: PipelineStage, selectedNode?: string): SceneNode {
  const geometry = layout[stage.id] ?? { x: 0, z: 0, height: 0.62 };
  const glyph = visualTokens.glyphs[stage.id as keyof typeof visualTokens.glyphs] ?? visualTokens.glyphs.genesis;
  const island = islandDefinitionFor(stage.id);

  return {
    id: stage.id,
    organ: stage.organ,
    title: stage.title,
    state: stageState(stage.id, selectedNode),
    ...geometry,
    ring: stage.id === selectedNode || stage.id === 'taste' ? 'breathing' : 'solid',
    glyph: glyph.glyph,
    coolshapeIntent: glyph.coolshapeIntent,
    coolshape: island.coolshape,
    biome: island.biome,
    silhouette: island.silhouette,
    worldScale: island.worldScale,
    cameraTarget: island.cameraTarget,
    selected: stage.id === selectedNode,
    inputs: stage.requires ?? [],
    outputs: stage.produces ?? [],
    reference: referenceForStage(stage.id),
  };
}

function cortexNode(selectedNode?: string): SceneNode {
  const cortex = sourceContract.pipeline.crosscutting[0];
  const geometry = layout.cortex;
  const glyph = visualTokens.glyphs.cortex;
  const island = islandDefinitionFor('cortex');

  return {
    id: cortex?.id ?? 'cortex',
    organ: cortex?.organ ?? 'cortex',
    title: cortex?.title ?? 'Aesthetic memory',
    state: 'memory',
    ...geometry,
    ring: selectedNode === 'cortex' ? 'breathing' : 'dashed',
    glyph: glyph.glyph,
    coolshapeIntent: glyph.coolshapeIntent,
    coolshape: island.coolshape,
    biome: island.biome,
    silhouette: island.silhouette,
    worldScale: island.worldScale,
    cameraTarget: island.cameraTarget,
    selected: selectedNode === 'cortex',
    inputs: ['semantic_memory', 'structural_memory'],
    outputs: cortex?.feeds ?? ['genesis', 'taste', 'build', 'ops'],
    reference: referenceForStage('cortex'),
  };
}

function buildRails(nodes: SceneNode[]): SceneRail[] {
  const ids = new Set(nodes.map((node) => node.id));
  const rails: Array<Omit<SceneRail, 'lane'>> = [
    { id: 'genesis-to-taste', from: 'genesis', to: 'taste', packetCount: 3, tone: 'primary' },
    { id: 'taste-to-build', from: 'taste', to: 'build', packetCount: 4, tone: 'primary' },
    { id: 'build-to-ops', from: 'build', to: 'ops', packetCount: 3, tone: 'secondary' },
    { id: 'cortex-to-genesis', from: 'cortex', to: 'genesis', packetCount: 2, tone: 'memory' },
    { id: 'cortex-to-taste', from: 'cortex', to: 'taste', packetCount: 2, tone: 'memory' },
    { id: 'cortex-to-build', from: 'cortex', to: 'build', packetCount: 2, tone: 'memory' },
    { id: 'cortex-to-ops', from: 'cortex', to: 'ops', packetCount: 2, tone: 'memory' },
  ];

  return rails
    .map((rail) => ({
      ...rail,
      lane: rail.tone === 'memory' ? 'background-emitter' as const : rail.id === 'build-to-ops' ? 'runner' as const : 'handoff' as const,
    }))
    .filter((rail) => ids.has(rail.from) && ids.has(rail.to));
}

function buildEmitterLanes(rails: SceneRail[]): EmitterLane[] {
  return rails.map((rail) => ({
    id: `${rail.id}-emitter`,
    from: rail.from,
    to: rail.to,
    label: rail.lane === 'background-emitter' ? 'MEMORY FEED' : rail.lane === 'runner' ? 'RUNNER LOOP' : 'HANDOFF',
    cadence: rail.lane === 'background-emitter' ? 'ambient' : 'pulse',
    intensity: rail.packetCount / 4,
  }));
}

function buildScreens(): ScreenSpec[] {
  return routeDrafts.map((route) => ({
    ...route,
    reference: referenceByScreen.get(route.id),
  }));
}

export function buildCambiumScene(activeScreenId: ScreenId = defaultScreenId, cameraMode?: CameraMode): CambiumSceneModel {
  const screens = buildScreens();
  const activeScreen = screens.find((screen) => screen.id === activeScreenId) ?? screens[0];
  const nodes = [...sourceContract.pipeline.stages.map((stage) => stageNode(stage, activeScreen.focusNode)), cortexNode(activeScreen.focusNode)];
  const rails = buildRails(nodes);
  const references = sourceContract.referenceFreeze.screenReferences as readonly SceneReference[];

  return {
    nodes,
    rails,
    emitterLanes: buildEmitterLanes(rails),
    engineControls,
    visualizationLayers,
    references: [...references],
    screens,
    activeScreen,
    cameraMode: cameraMode ?? activeScreen.defaultCamera,
    telemetry: {
      progressLabel: sourceContract.questSummary.label,
      completedQuests: sourceContract.questSummary.completed,
      totalQuests: sourceContract.questSummary.total,
      activeArc: sourceContract.questSummary.activeArc,
      activeQuestId: sourceContract.questSummary.activeQuestId,
      freshness: 'live',
      derivedAtLabel: 'source-backed static contract',
    },
    qaPolicy: cambiumQaPolicy,
    acceptanceChecks: sourceContract.acceptanceChecks,
    interactionPlan: sourceContract.interactionPlan,
  };
}
