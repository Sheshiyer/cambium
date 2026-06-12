import type { EngineControl, IslandBiome, IslandSilhouette, VisualizationLayer } from '../scene/types';

export interface IslandDefinition {
  id: string;
  biome: IslandBiome;
  silhouette: IslandSilhouette;
  worldScale: number;
  cameraTarget: { x: number; y: number; z: number; zoom: number };
  coolshape: {
    shapeType: 'star' | 'flower' | 'ellipse' | 'wheel' | 'moon' | 'misc' | 'triangle' | 'polygon' | 'rectangle';
    index: number;
  };
  materialRole: 'origin' | 'taste' | 'artifact' | 'operator' | 'memory';
}

export const islandDefinitions: Record<string, IslandDefinition> = {
  genesis: {
    id: 'genesis',
    biome: 'seed',
    silhouette: 'seed-crystal',
    worldScale: 1.08,
    cameraTarget: { x: -4.8, y: 0.9, z: -1.2, zoom: 104 },
    coolshape: { shapeType: 'triangle', index: 6 },
    materialRole: 'origin',
  },
  taste: {
    id: 'taste',
    biome: 'resonance',
    silhouette: 'taste-knot',
    worldScale: 1.2,
    cameraTarget: { x: -2.1, y: 1.05, z: 1.2, zoom: 110 },
    coolshape: { shapeType: 'flower', index: 9 },
    materialRole: 'taste',
  },
  build: {
    id: 'build',
    biome: 'forge',
    silhouette: 'forge-anvil',
    worldScale: 1.14,
    cameraTarget: { x: 1.4, y: 0.95, z: 1.05, zoom: 108 },
    coolshape: { shapeType: 'polygon', index: 4 },
    materialRole: 'artifact',
  },
  ops: {
    id: 'ops',
    biome: 'loop',
    silhouette: 'ops-loop',
    worldScale: 1.12,
    cameraTarget: { x: 4.4, y: 0.9, z: -1.15, zoom: 106 },
    coolshape: { shapeType: 'wheel', index: 5 },
    materialRole: 'operator',
  },
  cortex: {
    id: 'cortex',
    biome: 'memory',
    silhouette: 'memory-orbit',
    worldScale: 1.26,
    cameraTarget: { x: 0.1, y: 1.12, z: -3.25, zoom: 112 },
    coolshape: { shapeType: 'moon', index: 11 },
    materialRole: 'memory',
  },
};

export const engineControls: EngineControl[] = [
  { id: 'quality', label: 'Renderer quality', value: 'desktop high', kind: 'quality' },
  { id: 'materials', label: 'Material preset', value: 'Cambium tactical', kind: 'material' },
  { id: 'emitters', label: 'Emitter density', value: 'live packets', kind: 'emitter' },
  { id: 'camera', label: 'Camera rig', value: 'overview / node / flat', kind: 'camera' },
  { id: 'motion', label: 'Reduced motion', value: 'media-query gated', kind: 'accessibility' },
];

export const visualizationLayers: VisualizationLayer[] = [
  { id: 'flow', label: 'FLOW MAP', value: 'runner handoffs', tone: 'signal' },
  { id: 'density', label: 'SIGNAL DENSITY', value: 'packet volume', tone: 'mist' },
  { id: 'heat', label: 'PROCESS HEAT', value: 'active frontier', tone: 'signal' },
  { id: 'deps', label: 'DEPENDENCY GRAPH', value: 'organ contract edges', tone: 'depth' },
  { id: 'runner', label: 'RUNNER STATUS', value: 'quest loop', tone: 'mist' },
  { id: 'emitters', label: 'BACKGROUND EMITTERS', value: 'memory feeds', tone: 'signal' },
];

export function islandDefinitionFor(id: string): IslandDefinition {
  return islandDefinitions[id] ?? islandDefinitions.genesis;
}
