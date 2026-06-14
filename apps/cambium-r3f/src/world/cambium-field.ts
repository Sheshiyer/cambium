import * as THREE from 'three';
import type { CameraMode } from '../scene/types.ts';

export const cambiumFieldProfile = {
  id: 'cambium-field',
  width: 15.8,
  depth: 10.6,
  columns: 58,
  rows: 38,
  checkerboard: false,
  contourCount: 12,
  seamCount: 9,
  symmetry: 'organ-radial',
  role: 'living-fractal-substrate',
} as const;

export interface FieldContourPath {
  id: string;
  points: THREE.Vector3[];
  opacity: number;
}

function fieldHeight(x: number, z: number, flat: boolean) {
  if (flat) return 0;
  const radial = Math.sqrt((x / 7.5) ** 2 + (z / 5.1) ** 2);
  const lowWave = Math.sin(x * 0.82 + z * 0.34) * 0.035;
  const crossWave = Math.cos(z * 1.12 - x * 0.18) * 0.026;
  const basin = Math.max(0, 1 - radial) * 0.055;
  return lowWave + crossWave + basin;
}

export function createCambiumFieldGeometry(mode: CameraMode) {
  const flat = mode === 'flat';
  const { width, depth, columns, rows } = cambiumFieldProfile;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= rows; row += 1) {
    const z = -depth / 2 + (row / rows) * depth;
    for (let column = 0; column <= columns; column += 1) {
      const x = -width / 2 + (column / columns) * width;
      const y = fieldHeight(x, z, flat);
      const radial = Math.min(1, Math.sqrt((x / (width / 2)) ** 2 + (z / (depth / 2)) ** 2));
      positions.push(x, y, z);
      colors.push(0.02 + radial * 0.02, 0.14 + radial * 0.05, 0.14 + radial * 0.04);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const c = a + columns + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createCambiumFieldContours(mode: CameraMode): FieldContourPath[] {
  const flat = mode === 'flat';
  return Array.from({ length: cambiumFieldProfile.contourCount }).map((_, index) => {
    const radiusX = 1.15 + index * 0.54;
    const radiusZ = 0.72 + index * 0.36;
    const phase = index * 0.41;
    const points = Array.from({ length: 156 }).map((__, pointIndex) => {
      const angle = (pointIndex / 155) * Math.PI * 2;
      const wobble = 1 + Math.sin(angle * 3 + phase) * 0.055 + Math.cos(angle * 7 - phase) * 0.028;
      const x = Math.cos(angle) * radiusX * wobble;
      const z = Math.sin(angle) * radiusZ * wobble - 0.24;
      return new THREE.Vector3(x, 0.042 + index * 0.002 + fieldHeight(x, z, flat), z);
    });

    return {
      id: `field-contour-${index}`,
      points,
      opacity: 0.08 + index * 0.012,
    };
  });
}

export function createCambiumFieldSeams(mode: CameraMode): FieldContourPath[] {
  const flat = mode === 'flat';
  return Array.from({ length: cambiumFieldProfile.seamCount }).map((_, index) => {
    const angle = (index / cambiumFieldProfile.seamCount) * Math.PI * 2 + 0.16;
    const points = Array.from({ length: 42 }).map((__, pointIndex) => {
      const t = pointIndex / 41;
      const radius = 0.6 + t * 6.2;
      const bend = Math.sin(t * Math.PI * 2 + index) * 0.18;
      const x = Math.cos(angle + bend * 0.08) * radius;
      const z = Math.sin(angle - bend * 0.08) * radius * 0.62 - 0.2;
      return new THREE.Vector3(x, 0.054 + fieldHeight(x, z, flat), z);
    });

    return {
      id: `field-seam-${index}`,
      points,
      opacity: index % 3 === 0 ? 0.26 : 0.14,
    };
  });
}
