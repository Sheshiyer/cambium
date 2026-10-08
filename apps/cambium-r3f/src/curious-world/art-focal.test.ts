import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { buildFocalGeology, SCENIC_FOCALS } from './art-focal.ts';
import { DISTRICTS, PATHS, HUB_RADIUS, PLAYER_RADIUS } from './world-model.ts';
import type { ArtBuilder, Surface } from './art-geometry.ts';

function build() {
  const records: Array<{ geometry: THREE.BufferGeometry; surface: Surface }> = [];
  const art: ArtBuilder = {
    add(geometry, surface, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
      const object = new THREE.Object3D(); object.position.set(...position); object.scale.set(...scale);
      object.rotation.set(...rotation); object.updateMatrix(); geometry.applyMatrix4(object.matrix);
      records.push({ geometry, surface });
    },
  };
  buildFocalGeology(art);
  return { records, dispose: () => records.forEach(record => record.geometry.dispose()) };
}
function pathDistance(x: number, z: number, path: typeof PATHS[number]): number {
  const dx = path.b.x - path.a.x, dz = path.b.z - path.a.z;
  const t = Math.max(0, Math.min(1, ((x - path.a.x) * dx + (z - path.a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - path.a.x - dx * t, z - path.a.z - dz * t);
}

test('actual scenic geometry preserves hub, district floors and complete player-clear walking paths', () => {
  const built = build();
  try {
    assert.equal(SCENIC_FOCALS.length, 2);
    for (const focal of SCENIC_FOCALS) {
      const radius = focal.radius + PLAYER_RADIUS;
      assert.ok(Math.hypot(focal.x, focal.z) > HUB_RADIUS + radius, 'whole declared footprint clears the hub');
      for (const district of DISTRICTS) assert.ok(Math.hypot(focal.x - district.x, focal.z - district.z) > district.radius + radius);
      for (const path of PATHS) assert.ok(pathDistance(focal.x, focal.z, path) > path.width / 2 + radius, 'whole footprint clears paths, including face interiors');
    }
    for (const { geometry } of built.records) {
      const positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        assert.ok([x, y, z].every(Number.isFinite));
        const focal = SCENIC_FOCALS.reduce((a, b) => Math.hypot(x - a.x, z - a.z) < Math.hypot(x - b.x, z - b.z) ? a : b);
        if (y <= 3) assert.ok(Math.hypot(x - focal.x, z - focal.z) <= focal.radius + .0001, 'solid lower footprint matches declaration');
        assert.ok(Math.hypot(x, z) > HUB_RADIUS + PLAYER_RADIUS, 'hub is untouched');
        for (const district of DISTRICTS) assert.ok(Math.hypot(x - district.x, z - district.z) > district.radius + PLAYER_RADIUS, district.id);
        for (const path of PATHS) assert.ok(pathDistance(x, z, path) > path.width / 2 + PLAYER_RADIUS, path.id);
      }
    }
  } finally { built.dispose(); }
});

test('actual mineral bounds produce asymmetric tall sculptural silhouettes within the triangle budget', () => {
  const built = build();
  try {
    let triangles = 0;
    const bounds = SCENIC_FOCALS.map(() => new THREE.Box3());
    for (const { geometry, surface } of built.records) {
      triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
      assert.ok(['basalt', 'stone', 'copper', 'mint', 'patina'].includes(surface));
      geometry.computeBoundingBox();
      const index = geometry.boundingBox!.getCenter(new THREE.Vector3()).x > 0 ? 0 : 1;
      bounds[index].union(geometry.boundingBox!);
    }
    assert.ok(triangles > 1000 && triangles <= 2500, `actual triangles ${triangles}`);
    assert.ok(bounds[0].max.y > 6.4 && bounds[0].max.y < 6.5);
    assert.ok(bounds[1].max.y > 5.75 && bounds[1].max.y < 5.9);
    assert.ok(bounds.every(bound => bound.min.y <= -5 && bound.getSize(new THREE.Vector3()).x < 4.2));
    assert.notEqual(bounds[0].max.y, bounds[1].max.y);
  } finally { built.dispose(); }
});

test('built scenic buffers and material selections are deterministic and include actual open cavities', () => {
  const first = build(), second = build();
  try {
    const digest = (records: typeof first.records) => {
      const hash = createHash('sha256');
      for (const { geometry, surface } of records) {
        hash.update(surface); hash.update(Buffer.from(geometry.getAttribute('position').array.buffer));
        if (geometry.index) hash.update(Buffer.from(geometry.index.array.buffer));
      }
      return hash.digest('hex');
    };
    assert.equal(digest(first.records), digest(second.records));
    const lowerShell = first.records[1].geometry.getAttribute('position');
    const focal = SCENIC_FOCALS[0];
    let innerVertices = 0, outerVertices = 0;
    for (let i = 0; i < lowerShell.count; i++) {
      const radius = Math.hypot(lowerShell.getX(i) - focal.x, lowerShell.getZ(i) - focal.z);
      if (radius < .8) innerVertices++;
      if (radius > 1.8) outerVertices++;
    }
    assert.ok(innerVertices > 20 && outerVertices > 20, 'separate inner and outer faces form the carved shell');
  } finally { first.dispose(); second.dispose(); }
});
