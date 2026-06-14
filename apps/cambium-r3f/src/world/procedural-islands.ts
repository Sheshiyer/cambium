import * as THREE from 'three';
import type { IslandSilhouette, SceneNode } from '../scene/types';

interface IslandProfile {
  segments: number;
  radiusX: number;
  radiusZ: number;
  height: number;
  topScale: number;
  crag: number;
  seed: number;
}

export const proceduralIslandProfiles: Record<IslandSilhouette, IslandProfile> = {
  'seed-crystal': { segments: 11, radiusX: 1.12, radiusZ: 0.82, height: 0.58, topScale: 0.58, crag: 0.22, seed: 1.7 },
  'taste-knot': { segments: 23, radiusX: 1.22, radiusZ: 1.04, height: 0.46, topScale: 0.72, crag: 0.14, seed: 3.2 },
  'forge-anvil': { segments: 14, radiusX: 1.34, radiusZ: 0.92, height: 0.62, topScale: 0.66, crag: 0.18, seed: 5.1 },
  'ops-loop': { segments: 19, radiusX: 1.18, radiusZ: 1.0, height: 0.52, topScale: 0.62, crag: 0.16, seed: 7.4 },
  'memory-orbit': { segments: 27, radiusX: 1.32, radiusZ: 1.08, height: 0.7, topScale: 0.7, crag: 0.12, seed: 9.9 },
};

function radialNoise(angle: number, seed: number) {
  return (
    Math.sin(angle * 3 + seed) * 0.5
    + Math.cos(angle * 5 - seed * 0.6) * 0.32
    + Math.sin(angle * 11 + seed * 1.7) * 0.18
  );
}

export function createProceduralIslandGeometry(node: Pick<SceneNode, 'silhouette' | 'height'>) {
  const profile = proceduralIslandProfiles[node.silhouette];
  const positions: number[] = [];
  const indices: number[] = [];
  const topCenter = 0;
  const bottomCenter = 1;

  positions.push(0, profile.height + node.height * 0.42, 0);
  positions.push(0, -0.08, 0);

  const topStart = 2;
  const bottomStart = topStart + profile.segments;

  for (let index = 0; index < profile.segments; index += 1) {
    const angle = (index / profile.segments) * Math.PI * 2;
    const wobble = 1 + radialNoise(angle, profile.seed) * profile.crag;
    const topWobble = 1 + radialNoise(angle + 0.4, profile.seed * 1.3) * profile.crag * 0.72;
    const ridge = Math.max(0, radialNoise(angle + 0.2, profile.seed * 0.8)) * 0.08;
    positions.push(
      Math.cos(angle) * profile.radiusX * profile.topScale * topWobble,
      profile.height + node.height * 0.32 + ridge,
      Math.sin(angle) * profile.radiusZ * profile.topScale * topWobble,
    );
    positions.push(
      Math.cos(angle) * profile.radiusX * wobble,
      -0.08 - Math.abs(radialNoise(angle, profile.seed * 0.4)) * 0.06,
      Math.sin(angle) * profile.radiusZ * wobble,
    );
  }

  for (let index = 0; index < profile.segments; index += 1) {
    const next = (index + 1) % profile.segments;
    const topA = topStart + index * 2;
    const bottomA = topA + 1;
    const topB = topStart + next * 2;
    const bottomB = topB + 1;

    indices.push(topCenter, topA, topB);
    indices.push(bottomCenter, bottomB, bottomA);
    indices.push(topA, bottomA, topB);
    indices.push(topB, bottomA, bottomB);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
