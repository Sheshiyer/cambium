import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createTraveler, TRAVELER_DESIGNS, type TravelerDesignId } from './character.ts';

function fixture() {
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const rig = createTraveler({ trackGeometry: geometry => geometries.push(geometry), trackMaterial: material => materials.push(material) });
  return { rig, geometries, materials, dispose: () => { rig.dispose(); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); } };
}
function geometryDigest(root: THREE.Group): string {
  const hash = createHash('sha256');
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const name of ['position', 'normal', 'color']) {
      const attribute = object.geometry.getAttribute(name);
      if (attribute) hash.update(Buffer.from(attribute.array.buffer));
    }
  });
  return hash.digest('hex');
}
function actualBounds(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  let footprint = 0, triangles = 0, meshes = 0;
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const vertices = object.geometry.getAttribute('position');
    triangles += (object.geometry.index?.count ?? vertices.count) / 3; meshes++;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    for (let index = 0; index < vertices.count; index++) {
      point.fromBufferAttribute(vertices, index).applyMatrix4(object.matrixWorld);
      assert.ok([point.x, point.y, point.z].every(Number.isFinite));
      bounds.expandByPoint(point); footprint = Math.max(footprint, Math.hypot(point.x, point.z) * 2);
    }
  });
  return { bounds, footprint, triangles, meshes, geometries: geometries.size, materials: materials.size };
}

test('all original cosmetic designs satisfy actual mesh, triangle, material and physical bounds', () => {
  const f = fixture();
  try {
    assert.deepEqual(TRAVELER_DESIGNS.map(design => design.id), ['courier', 'cartographer', 'gardener']);
    let maximumHeight = 0, maximumFootprint = 0;
    for (const design of TRAVELER_DESIGNS) {
      f.rig.setDesign(design.id);
      const actual = actualBounds(f.rig.root);
      assert.ok(actual.meshes <= 12 && actual.geometries <= 12 && actual.materials <= 8);
      assert.ok(actual.triangles < 6000 && actual.triangles > 2000);
      assert.ok(actual.bounds.max.y <= 1.8 && actual.bounds.min.y >= 0);
      assert.ok(actual.footprint < .8);
      assert.equal(f.rig.metrics.drawCalls, actual.meshes);
      assert.equal(f.rig.metrics.triangles, actual.triangles);
      assert.equal(f.rig.metrics.geometryBuffers, actual.geometries);
      assert.equal(f.rig.metrics.materials, actual.materials);
      maximumHeight = Math.max(maximumHeight, actual.bounds.max.y); maximumFootprint = Math.max(maximumFootprint, actual.footprint);
    }
    assert.equal(f.rig.metrics.height, maximumHeight); assert.equal(f.rig.metrics.footprint, maximumFootprint);
    assert.ok(f.rig.metrics.variantBytes < 1_100_000);
  } finally { f.dispose(); }
});

test('repeated switching reuses every GPU resource and attribute buffer while designs remain distinct and reversible', () => {
  const f = fixture();
  try {
    const geometryIds = f.geometries.map(geometry => geometry.uuid), materialIds = f.materials.map(material => material.uuid);
    const arrays = f.geometries.flatMap(geometry => Object.values(geometry.attributes).map(attribute => attribute.array));
    const originals = new Map<TravelerDesignId, string>();
    for (const design of TRAVELER_DESIGNS) { f.rig.setDesign(design.id); originals.set(design.id, geometryDigest(f.rig.root)); }
    assert.equal(new Set(originals.values()).size, 3);
    for (let round = 0; round < 60; round++) for (const design of TRAVELER_DESIGNS) {
      f.rig.setDesign(design.id); assert.equal(f.rig.getDesign(), design.id); assert.equal(geometryDigest(f.rig.root), originals.get(design.id));
    }
    assert.deepEqual(f.geometries.map(geometry => geometry.uuid), geometryIds);
    assert.deepEqual(f.materials.map(material => material.uuid), materialIds);
    const after = f.geometries.flatMap(geometry => Object.values(geometry.attributes).map(attribute => attribute.array));
    after.forEach((array, index) => assert.equal(array, arrays[index]));
    assert.throws(() => f.rig.setDesign('unknown' as TravelerDesignId), /Unknown traveler design/);
    assert.equal(f.rig.getDesign(), 'gardener');
  } finally { f.dispose(); }
});

test('distance-driven articulated gait is finite, bounded and stops without changing world transforms or design', () => {
  const f = fixture();
  try {
    f.rig.root.position.set(13, 0, -9); f.rig.root.rotation.y = .9;
    const worldPosition = f.rig.root.position.clone(), worldRotation = f.rig.root.rotation.clone();
    for (let step = 0; step < 160; step++) f.rig.pose(step % 9 === 0 ? 1e100 : .028, true, false);
    const leftLeg = f.rig.root.getObjectByName('traveler-leftThigh')!;
    assert.ok(Math.abs(leftLeg.rotation.x) > .001 && Math.abs(leftLeg.rotation.x) <= .32);
    assert.deepEqual(f.rig.root.position, worldPosition); assert.deepEqual(f.rig.root.rotation.toArray(), worldRotation.toArray());
    for (const delta of [NaN, Infinity, -1, 0]) {
      f.rig.pose(delta, true, false);
      f.rig.root.traverse(object => {
        if (object.name.startsWith('traveler-') && object instanceof THREE.Group) assert.deepEqual(object.rotation.toArray().slice(0, 3), [0, 0, 0]);
      });
    }
    f.rig.pose(.04, true, false); f.rig.pose(.04, false, false);
    assert.equal(leftLeg.rotation.x, 0); assert.equal(f.rig.getDesign(), 'courier');
  } finally { f.dispose(); }
});

test('reduced motion omits secondary sway while retaining user-driven movement and every pose stays within its clearance envelope', () => {
  const f = fixture();
  try {
    for (const design of TRAVELER_DESIGNS) {
      f.rig.setDesign(design.id);
      for (let step = 0; step < 40; step++) {
        f.rig.pose(.035, true, step % 2 === 0);
        const actual = actualBounds(f.rig.root);
        assert.ok(actual.bounds.max.y < 1.8, `pose height ${actual.bounds.max.y}`);
        assert.ok(actual.footprint < .8, `pose footprint ${actual.footprint}`);
        assert.ok(actual.bounds.min.y >= -.001, `feet below floor ${actual.bounds.min.y}`);
      }
    }
    f.rig.pose(.05, true, true);
    assert.equal(f.rig.root.getObjectByName('traveler-body')!.rotation.z, 0);
    assert.equal(f.rig.root.getObjectByName('traveler-head')!.rotation.y, 0);
    f.rig.resetPose(); f.rig.root.updateMatrixWorld(true);
    const before = f.rig.root.children.map(object => object.matrix.clone());
    f.rig.pose(0, false, true); f.rig.root.updateMatrixWorld(true);
    f.rig.root.children.forEach((object, index) => assert.deepEqual(object.matrix, before[index]));
  } finally { f.dispose(); }
});

test('rig cleanup releases scene ownership once and leaves tracked GPU disposal to its renderer', () => {
  const f = fixture(), scene = new THREE.Scene(); scene.add(f.rig.root);
  let geometryDisposals = 0, materialDisposals = 0;
  f.geometries.forEach(geometry => geometry.addEventListener('dispose', () => { geometryDisposals++; }));
  f.materials.forEach(material => material.addEventListener('dispose', () => { materialDisposals++; }));
  f.rig.dispose(); f.rig.dispose(); f.rig.pose(.2, true, false); f.rig.resetPose();
  assert.equal(f.rig.root.parent, null); assert.equal(f.rig.root.children.length, 0);
  assert.equal(geometryDisposals, 0); assert.equal(materialDisposals, 0);
  assert.throws(() => f.rig.setDesign('courier'), /disposed/);
  f.geometries.forEach(geometry => geometry.dispose()); f.materials.forEach(material => material.dispose());
  assert.equal(geometryDisposals, f.geometries.length); assert.equal(materialDisposals, f.materials.length);
});
