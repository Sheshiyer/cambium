import * as THREE from 'three';
import type { SceneNode, SceneRail, VisualizationLayer } from '../scene/types.ts';

export type LivingFlowAssetId = 'signal-packet' | 'emitter-node' | 'process-beacon' | 'visualization-lens';

export interface LivingFlowAsset {
  id: LivingFlowAssetId;
  role: 'rail-packet' | 'background-emitter' | 'current-position' | 'visual-overlay';
  sourcePlate: string;
  integrationMode: 'procedural-scene-mesh';
  promotedRuntimeAsset: false;
}

export const livingFlowAssets: readonly LivingFlowAsset[] = [
  {
    id: 'signal-packet',
    role: 'rail-packet',
    sourcePlate: 'docs/plans/assets/cambium-r3f-game-engine-realignment/image-source-pass/source-plates/signal-packet.png',
    integrationMode: 'procedural-scene-mesh',
    promotedRuntimeAsset: false,
  },
  {
    id: 'emitter-node',
    role: 'background-emitter',
    sourcePlate: 'docs/plans/assets/cambium-r3f-game-engine-realignment/image-source-pass/source-plates/emitter-node.png',
    integrationMode: 'procedural-scene-mesh',
    promotedRuntimeAsset: false,
  },
  {
    id: 'process-beacon',
    role: 'current-position',
    sourcePlate: 'docs/plans/assets/cambium-r3f-game-engine-realignment/image-source-pass/source-plates/process-beacon.png',
    integrationMode: 'procedural-scene-mesh',
    promotedRuntimeAsset: false,
  },
  {
    id: 'visualization-lens',
    role: 'visual-overlay',
    sourcePlate: 'docs/plans/assets/cambium-r3f-game-engine-realignment/image-source-pass/source-plates/visualization-lens.png',
    integrationMode: 'procedural-scene-mesh',
    promotedRuntimeAsset: false,
  },
];

export interface IslandPort {
  id: string;
  nodeId: string;
  railId: string;
  kind: 'input' | 'output' | 'memory';
  position: [number, number, number];
  rotationY: number;
}

export interface RailPacketMarker {
  id: string;
  railId: string;
  lane: SceneRail['lane'];
  t: number;
  position: [number, number, number];
  size: number;
}

export interface VisualizationOverlaySpec {
  id: string;
  layerId: string;
  role: 'flow-map' | 'signal-density' | 'process-heat' | 'dependency-graph' | 'runner-status' | 'emitter-status';
  anchor: [number, number, number];
  scale: number;
}

function nodeById(nodes: readonly SceneNode[]) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function portForNode(node: SceneNode, other: SceneNode, rail: SceneRail, kind: IslandPort['kind']): IslandPort {
  const angle = Math.atan2(other.z - node.z, other.x - node.x);
  const radius = node.worldScale * 0.92;
  const x = node.x + Math.cos(angle) * radius;
  const z = node.z + Math.sin(angle) * radius;

  return {
    id: `${rail.id}-${node.id}-${kind}`,
    nodeId: node.id,
    railId: rail.id,
    kind,
    position: [x, 0.28, z],
    rotationY: -angle,
  };
}

export function createIslandPorts(nodes: readonly SceneNode[], rails: readonly SceneRail[]) {
  const lookup = nodeById(nodes);
  const ports: IslandPort[] = [];

  for (const rail of rails) {
    const from = lookup.get(rail.from);
    const to = lookup.get(rail.to);
    if (!from || !to) continue;
    const fromKind: IslandPort['kind'] = rail.lane === 'background-emitter' ? 'memory' : 'output';
    const toKind: IslandPort['kind'] = rail.lane === 'background-emitter' ? 'memory' : 'input';
    ports.push(portForNode(from, to, rail, fromKind));
    ports.push(portForNode(to, from, rail, toKind));
  }

  return ports;
}

export function createRailPacketMarkers(nodes: readonly SceneNode[], rail: SceneRail) {
  const lookup = nodeById(nodes);
  const from = lookup.get(rail.from);
  const to = lookup.get(rail.to);
  if (!from || !to) return [];

  return Array.from({ length: rail.packetCount + 1 }).map((_, index): RailPacketMarker => {
    const t = (index + 1) / (rail.packetCount + 2);
    const arc = Math.sin(t * Math.PI);
    return {
      id: `${rail.id}-packet-${index}`,
      railId: rail.id,
      lane: rail.lane,
      t,
      position: [
        THREE.MathUtils.lerp(from.x, to.x, t),
        0.38 + arc * 0.18 + index * 0.012,
        THREE.MathUtils.lerp(from.z, to.z, t),
      ],
      size: rail.lane === 'background-emitter' ? 0.045 : 0.066,
    };
  });
}

export function activeProcessNode(nodes: readonly SceneNode[]) {
  return nodes.find((node) => node.selected) ?? nodes.find((node) => node.state === 'active') ?? nodes[0];
}

export function createVisualizationOverlaySpecs(layers: readonly VisualizationLayer[]) {
  const roles: VisualizationOverlaySpec['role'][] = [
    'flow-map',
    'signal-density',
    'process-heat',
    'dependency-graph',
    'runner-status',
    'emitter-status',
  ];

  return layers.map((layer, index): VisualizationOverlaySpec => ({
    id: `${layer.id}-overlay`,
    layerId: layer.id,
    role: roles[index] ?? 'flow-map',
    anchor: [-4.1 + index * 1.62, 0.54, 2.22 + Math.sin(index * 1.4) * 0.36],
    scale: 0.72 + index * 0.06,
  }));
}
