import * as THREE from 'three';
import type { WorldPath, District } from './world-model.ts';

export type V3 = [number, number, number];
export type Surface = 'basalt' | 'stone' | 'moss' | 'copper' | 'patina' | 'limestone' | 'mint' | 'acid' | 'bark' | 'water';
export interface ArtBuilder {
  add(geometry: THREE.BufferGeometry, surface: Surface, position?: V3, scale?: V3, rotation?: V3, shadow?: boolean): void;
}
export const seedValue = (seed: number, index: number) => {
  const value = Math.sin(seed * 127.1 + index * 311.7) * 43758.5453123;
  return value - Math.floor(value);
};
export function visibleBridgeSpans(path: WorldPath, floors: readonly Pick<District, 'x' | 'z' | 'radius'>[]) {
  const dx = path.b.x - path.a.x, dz = path.b.z - path.a.z, length = Math.hypot(dx, dz);
  if (!length) return [] as Array<[number, number]>;
  const ux = dx / length, uz = dz / length, hidden: Array<[number, number]> = [];
  for (const floor of floors) {
    const fx = floor.x - path.a.x, fz = floor.z - path.a.z;
    const along = fx * ux + fz * uz, across = Math.abs(fx * uz - fz * ux), r = floor.radius * Math.cos(Math.PI / 32);
    if (across + path.width / 2 >= r) continue;
    const chord = Math.sqrt(r * r - (across + path.width / 2) ** 2);
    const from = Math.max(0, along - chord), to = Math.min(length, along + chord);
    if (to > from) hidden.push([from, to]);
  }
  hidden.sort((a, b) => a[0] - b[0]);
  let cursor = 0;
  const result: Array<[number, number]> = [];
  for (const [from, to] of hidden) { if (from > cursor + .001) result.push([cursor, from]); cursor = Math.max(cursor, to); }
  if (cursor < length - .001) result.push([cursor, length]);
  return result;
}
export function carve(points: Array<[number, number]>, height: number, base = 0) {
  const shape = new THREE.Shape(); points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, steps: 1, bevelEnabled: true,
    bevelThickness: .018, bevelSize: .012, bevelSegments: 1, curveSegments: 16 });
  g.rotateX(-Math.PI / 2); g.translate(0, base, 0); return g;
}
export function radialPoints(radius: number, seed: number, count = 32, variation = .1): Array<[number, number]> {
  return Array.from({ length: count }, (_, i) => {
    const a = i * Math.PI * 2 / count, r = radius * (1 + seedValue(seed, i) * variation);
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}
export function sector(radius: number, width: number, start: number, sweep: number, height: number, base = 0) {
  const steps = Math.max(12, Math.round(sweep * 10)), points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) { const a = start + sweep * i / steps; points.push([Math.cos(a) * radius, Math.sin(a) * radius]); }
  for (let i = steps; i >= 0; i--) { const a = start + sweep * i / steps; points.push([Math.cos(a) * (radius - width), Math.sin(a) * (radius - width)]); }
  return carve(points, height, base);
}
export function tube(points: V3[], radius: number, closed = false, segments = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'centripetal');
  return new THREE.TubeGeometry(curve, segments, radius, 5, closed);
}
export const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
export const cylinder = (r: number, height: number, segments = 12, top = r) => new THREE.CylinderGeometry(top, r, height, segments);
export const globe = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);
export const bowl = (r: number, height: number, segments = 20) => new THREE.LatheGeometry([
  new THREE.Vector2(0, 0), new THREE.Vector2(r * .38, .04), new THREE.Vector2(r * .65, height * .35),
  new THREE.Vector2(r * .88, height * .8), new THREE.Vector2(r, height), new THREE.Vector2(r * .89, height + .035),
  new THREE.Vector2(r * .72, height * .78), new THREE.Vector2(r * .5, height * .38), new THREE.Vector2(0, .06),
], segments);

/** Merge original static meshes by material; no per-object renderer calls or leaked temporary GPU buffers. */
export function createArtBuilder(scene: THREE.Scene, material: (surface: Surface) => THREE.Material,
  track: (g: THREE.BufferGeometry) => void): ArtBuilder & { flush(): void } {
  const batches = new Map<string, { surface: Surface; shadow: boolean; items: THREE.BufferGeometry[] }>();
  return {
    add(g, surface, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], shadow = true) {
      const mesh = new THREE.Object3D(); mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(...rotation); mesh.updateMatrix();
      const flat = g.index ? g.toNonIndexed() : g; if (flat !== g) g.dispose();
      flat.applyMatrix4(mesh.matrix); flat.computeVertexNormals();
      const count = flat.getAttribute('position').count;
      if (!flat.getAttribute('uv')) {
        const positions = flat.getAttribute('position'), uv = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) { uv[i * 2] = positions.getX(i) * .18; uv[i * 2 + 1] = positions.getZ(i) * .18; }
        flat.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      }
      const key = `${surface}:${shadow}`;
      if (!batches.has(key)) batches.set(key, { surface, shadow, items: [] }); batches.get(key)!.items.push(flat);
    },
    flush() {
      for (const batch of batches.values()) {
        const count = batch.items.reduce((n, g) => n + g.getAttribute('position').count, 0), merged = new THREE.BufferGeometry();
        for (const [name, width] of [['position', 3], ['normal', 3], ['uv', 2]] as const) {
          const data = new Float32Array(count * width); let offset = 0;
          for (const g of batch.items) { const a = g.getAttribute(name); data.set(a.array as Float32Array, offset); offset += a.array.length; }
          merged.setAttribute(name, new THREE.BufferAttribute(data, width));
        }
        batch.items.forEach(g => g.dispose()); merged.computeBoundingSphere(); track(merged);
        const mesh = new THREE.Mesh(merged, material(batch.surface)); mesh.castShadow = batch.shadow; mesh.receiveShadow = true; scene.add(mesh);
      }
      batches.clear();
    },
  };
}
