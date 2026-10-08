import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { DISTRICTS, WORLD_LANDMARKS, PATHS, HUB_RADIUS } from './world-model.ts';
import { createArtBuilder, radialPoints, seedValue, visibleBridgeSpans, type ArtBuilder, type Surface, type V3 } from './art-geometry.ts';
import { buildLandscape } from './art-landscape.ts';
import { buildArchitecture, buildLandmark } from './art-organs.ts';
import { buildFocalGeology } from './art-focal.ts';

const floors = [{ x: 0, z: 0, radius: HUB_RADIUS }, ...DISTRICTS];
const near = (a: number, b: number, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function posed(g: THREE.BufferGeometry, p: V3 = [0, 0, 0], s: V3 = [1, 1, 1], r: V3 = [0, 0, 0]) {
  const object = new THREE.Object3D(); object.position.set(...p); object.scale.set(...s); object.rotation.set(...r); object.updateMatrix();
  g.applyMatrix4(object.matrix); return g;
}
function geometryHash(build: (art: ArtBuilder) => void) {
  const hash = createHash('sha256'); let triangles = 0, geometries = 0;
  build({ add(g, surface, p, s, r) {
    const flat = g.index ? g.toNonIndexed() : g; if (flat !== g) g.dispose(); posed(flat, p, s, r);
    const position = flat.getAttribute('position'); triangles += position.count / 3; geometries++;
    hash.update(surface); hash.update(Buffer.from(position.array.buffer, position.array.byteOffset, position.array.byteLength)); flat.dispose();
  } });
  return { hash: hash.digest('hex'), triangles, geometries };
}

test('seeded original terrain and architecture reproduce identical vertex buffers', () => {
  const first = geometryHash(art => { buildLandscape(art); buildArchitecture(art); });
  const second = geometryHash(art => { buildLandscape(art); buildArchitecture(art); });
  assert.deepEqual(first, second); assert.ok(first.triangles > 15000 && first.triangles < 140000, String(first.triangles));
  assert.ok(first.geometries > 500);
  assert.notDeepEqual(radialPoints(8, 1), radialPoints(8, 2));
  for (let i = 0; i < 100; i++) { const value = seedValue(9, i); assert.ok(value >= 0 && value < 1); near(value, seedValue(9, i)); }
});

test('clipped bridge decks leave distinct visible intervals and remain below every island floor', () => {
  for (const path of PATHS) {
    const dx = path.b.x - path.a.x, dz = path.b.z - path.a.z, length = Math.hypot(dx, dz), ux = dx / length, uz = dz / length;
    const spans = visibleBridgeSpans(path, floors); assert.ok(spans.length > 0, path.id);
    let priorEnd = 0;
    for (const [from, to] of spans) {
      assert.ok(from >= priorEnd && to > from && to <= length, path.id); priorEnd = to;
      // Each visible deck cross section has at least one point outside all enclosing floor discs.
      for (let t = from + .02; t < to - .02; t += .4) {
        const offsets = [-path.width / 2, 0, path.width / 2];
        assert.ok(offsets.some(offset => {
          const point = { x: path.a.x + ux * t + uz * offset, z: path.a.z + uz * t - ux * offset };
          return floors.every(f => Math.hypot(point.x - f.x, point.z - f.z) >= f.radius * Math.cos(Math.PI / 32) - 1e-6);
        }), `deck is fully hidden at ${path.id}/${t}`);
      }
    }
    // Island centers never receive visible deck tops or caps.
    assert.ok(!spans.some(([a, b]) => a < .1 && b > .1));
    assert.ok(!spans.some(([a, b]) => a < length - .1 && b > length - .1));
  }
  let deckCount = 0;
  buildLandscape({ add(g, material, p = [0, 0, 0], s, r) {
    if (g.type === 'BoxGeometry' && p[1] < 0) {
      posed(g, p, s, r); g.computeBoundingBox(); assert.ok(g.boundingBox!.max.y <= -.0699); deckCount++;
    }
    g.dispose();
  } });
  assert.ok(deckCount > 100);
});

test('actual faceted floor caps stay at zero and cover the unchanged circular collision floors', () => {
  let caps = 0;
  buildLandscape({ add(g, material, p = [0, 0, 0]) {
    if (g.type === 'ExtrudeGeometry') {
      g.computeBoundingBox();
      if (Math.abs(g.boundingBox!.max.y) < 1e-5) {
        const f = floors.find(f => f.x === p[0] && f.z === p[2]); assert.ok(f); caps++;
        const positions = g.getAttribute('position'), outline = new Map<string, [number, number]>();
        for (let i = 0; i < positions.count; i++) if (Math.abs(positions.getY(i)) < 1e-5) {
          const x = positions.getX(i), z = positions.getZ(i); outline.set(`${x.toFixed(5)},${z.toFixed(5)}`, [x, z]);
        }
        const points = [...outline.values()].sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
        assert.equal(points.length, 48);
        for (let i = 0; i < points.length; i++) {
          const [x1, z1] = points[i], [x2, z2] = points[(i + 1) % points.length];
          const dx = x2 - x1, dz = z2 - z1;
          const t = Math.max(0, Math.min(1, -(x1 * dx + z1 * dz) / (dx * dx + dz * dz)));
          const edgeDistance = Math.hypot(x1 + dx * t, z1 + dz * t);
          assert.ok(edgeDistance >= f.radius, `${f.radius} collision floor protrudes past actual facet ${edgeDistance}`);
        }
        near(g.boundingBox!.max.y, 0); assert.ok(g.boundingBox!.min.y < -.18);
      }
    }
    g.dispose();
  } });
  assert.equal(caps, 9);
});

test('actual source landmark geometry stays inside its collider footprint and every organ has a unique silhouette', () => {
  const hashes = new Map<string, string>();
  for (const landmark of WORLD_LANDMARKS) {
    let count = 0, maxHeight = 0;
    buildLandmark(landmark, { add(g) {
      const position = g.getAttribute('position');
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
        if (y < 1.8) assert.ok(Math.hypot(x, z) <= landmark.radius + .001, `${landmark.id} has uncollided solid vertex`);
        assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)); maxHeight = Math.max(maxHeight, y);
      }
      count += position.count; g.dispose();
    } });
    assert.ok(count > 100); assert.ok(maxHeight >= .8 && maxHeight <= 5, `${landmark.id}/${maxHeight}`);
    if (landmark.kind === 'organ') assert.ok(maxHeight >= 1.7, `${landmark.id} has insufficient visible hero relief: ${maxHeight}`);
    if (landmark.kind === 'organ' || ['hermes', 'omniroute', 'broker'].includes(landmark.id)) {
      const result = geometryHash(art => buildLandmark(landmark, art)); hashes.set(landmark.id, result.hash);
    }
  }
  assert.equal(hashes.size, 14); assert.equal(new Set(hashes.values()).size, 14);
});

test('material batches flush once, own merged buffers, and release every submitted temporary geometry', () => {
  const scene = new THREE.Scene(), materials = new Map<Surface, THREE.Material>(), tracked: THREE.BufferGeometry[] = [];
  const material = (surface: Surface) => {
    if (!materials.has(surface)) materials.set(surface, new THREE.MeshStandardMaterial()); return materials.get(surface)!;
  };
  const builder = createArtBuilder(scene, material, g => tracked.push(g));
  const indexed = new THREE.BoxGeometry(1, 1, 1), unindexed = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  let originalDisposed = 0, submittedDisposed = 0;
  indexed.addEventListener('dispose', () => originalDisposed++); unindexed.addEventListener('dispose', () => submittedDisposed++);
  builder.add(indexed, 'basalt', [2, 0, 0]); builder.add(unindexed, 'basalt', [4, 0, 0]);
  builder.add(new THREE.BoxGeometry(1, 1, 1), 'copper', [6, 0, 0], undefined, undefined, false);
  assert.equal(originalDisposed, 1); assert.equal(submittedDisposed, 0);
  builder.flush(); assert.equal(submittedDisposed, 1); assert.equal(scene.children.length, 2); assert.equal(tracked.length, 2);
  builder.flush(); assert.equal(scene.children.length, 2); assert.equal(tracked.length, 2);
  assert.equal(tracked.reduce((total, g) => total + g.getAttribute('position').count / 3, 0), 36);
  tracked.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); scene.clear();
});

test('the complete original static world stays within the geometry and material call budgets', () => {
  const scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial(), geometries: THREE.BufferGeometry[] = [];
  const builder = createArtBuilder(scene, () => material, g => geometries.push(g));
  buildLandscape(builder); buildArchitecture(builder); buildFocalGeology(builder); builder.flush();
  const triangles = geometries.reduce((total, g) => total + g.getAttribute('position').count / 3, 0);
  assert.ok(triangles < 140000, String(triangles)); assert.ok(scene.children.length <= 20, String(scene.children.length));
  geometries.forEach(g => g.dispose()); material.dispose(); scene.clear();
});
