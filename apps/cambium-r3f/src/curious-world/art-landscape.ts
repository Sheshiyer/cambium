import * as THREE from 'three';
import { DISTRICTS, WORLD_LANDMARKS, PATHS, HUB_RADIUS, type Vec2 } from './world-model.ts';
import { box, carve, cylinder, globe, radialPoints, seedValue, tube, visibleBridgeSpans, type ArtBuilder, type V3 } from './art-geometry.ts';

const pointDistance = (p: Vec2, a: Vec2, b: Vec2) => {
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length)) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};
export function botanicalClearance(point: Vec2, radius = .2) {
  return PATHS.every(path => pointDistance(point, path.a, path.b) > path.width / 2 + .6 + radius)
    && WORLD_LANDMARKS.every(item => Math.hypot(point.x - item.x, point.z - item.z) > item.radius + 1 + radius);
}
function leafBlade(width: number, height: number) {
  const outline = [[0, 0, 0], [-width, height * .36, .03], [-width * .62, height * .76, .09],
    [0, height, .16], [width * .62, height * .76, .09], [width, height * .36, .03]];
  const positions: number[] = [];
  for (let i = 1; i < outline.length - 1; i++) for (const index of [0, i, i + 1, 0, i + 1, i]) positions.push(...outline[index]);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}
export function buildLandscape(art: ArtBuilder) {
  const floors = [{ id: 'hub', x: 0, z: 0, radius: HUB_RADIUS }, ...DISTRICTS];
  for (let i = 0; i < floors.length; i++) {
    const f = floors[i], origin: V3 = [f.x, 0, f.z];
    // The top encloses the entire unchanged circular walking floor. The visible shore is fractured outside it.
    art.add(carve(radialPoints(f.radius + .06, i + 1, 48, .07), .18, -.198), i % 3 === 0 ? 'basalt' : 'stone', origin);
    for (let layer = 0; layer < 4; layer++) {
      const r = f.radius * (1.06 - layer * .05), bottom = -.2 - (layer + 1) * 1.3;
      art.add(carve(radialPoints(r, i * 9 + layer + 3, 32, .085), 1.29, bottom), layer % 2 ? 'basalt' : 'stone', origin);
      const contour = radialPoints(r, i * 9 + layer + 3, 32, .085).map(([x, z]) => [x, bottom + 1.292, z] as V3);
      art.add(tube(contour, .012, true, 32), 'patina', origin, [1, 1, 1], [0, 0, 0], false);
    }
    for (let j = 0; j < 30; j++) {
      const a = j * 2.399 + i, r = f.radius * (.85 + seedValue(i + 8, j) * .17);
      art.add(globe(.35 + seedValue(i + 19, j) * .36), j % 3 ? 'basalt' : 'moss',
        [f.x + Math.cos(a) * r, -.3 - seedValue(i + 28, j) * 1.6, f.z + Math.sin(a) * r],
        [1.5, 1.3, .75], [seedValue(i, j), a, .2]);
    }
    for (let j = 0; j < 85; j++) {
      const a = j * 2.399 + i * .41, r = 1.6 + Math.sqrt(seedValue(i + 2, j)) * (f.radius - 1.9);
      const x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
      if (!botanicalClearance({ x, z })) continue;
      const s = .25 + seedValue(i + 31, j) * .23;
      art.add(globe(s), 'moss', [x, .035, z], [1.7, .2, 1.1], [0, a, 0], false);
      for (let leaf = 0; leaf < 5; leaf++) {
        const angle = a + leaf * 1.256;
        art.add(leafBlade(.085, .45 + leaf * .05), leaf === 1 ? 'patina' : 'moss',
          [x + Math.cos(angle) * .09, .015, z + Math.sin(angle) * .09], [1, 1, 1], [.68, angle, 0], false);
      }
      if (j % 11 === 0) {
        art.add(cylinder(.012, .3, 4), 'bark', [x, .16, z], undefined, undefined, false);
        art.add(globe(.07), i % 2 ? 'limestone' : 'acid', [x, .34, z], [1.4, .5, 1.4], undefined, false);
      }
    }
    // Rigid stems lie beyond the entire player floor footprint, away from bridge mouths.
    for (let j = 0; j < 14; j++) {
      const a = j * 2.399 + i * .8, x = f.x + Math.cos(a) * (f.radius + .24), z = f.z + Math.sin(a) * (f.radius + .24);
      if (!botanicalClearance({ x, z }, .7)
        || WORLD_LANDMARKS.some(l => Math.hypot(x - l.x, z - l.z) < l.radius + 3)) continue;
      const h = 1.8 + seedValue(i + 51, j) * 2, outward = new THREE.Vector2(Math.cos(a), Math.sin(a));
      const tangent = new THREE.Vector2(-outward.y, outward.x), lean = .16 + seedValue(i + 61, j) * .28;
      art.add(tube([[0, -.22, 0], [outward.x * lean * .35, h * .43, outward.y * lean * .35],
        [outward.x * lean, h * .93, outward.y * lean]], .05, false, 6), 'bark', [x, 0, z]);
      // Separate crooked boughs and pointed leaf fans leave air and sightlines through the canopy.
      for (let branch = 0; branch < 3; branch++) {
        const side = branch % 2 ? -1 : 1, spread = .24 + seedValue(j + 13, branch) * .34;
        const bx = outward.x * (.3 + branch * .16) + tangent.x * spread * side;
        const bz = outward.y * (.3 + branch * .16) + tangent.y * spread * side;
        const by = h * (.57 + branch * .16);
        art.add(tube([[outward.x * lean * .45, h * .44, outward.y * lean * .45],
          [bx * .6, by * .84, bz * .6], [bx, by, bz]], .028, false, 3), 'bark', [x, 0, z]);
        for (let leaf = 0; leaf < 3; leaf++) {
          const turn = a + side * (.4 + leaf * .48), length = .72 + seedValue(j + branch + 81, leaf) * .55;
          art.add(leafBlade(.15 + leaf * .025, length), 'moss',
            [x + bx, by, z + bz], [1, 1, 1], [.65 + leaf * .17, -turn, side * .23]);
        }
      }
    }
  }
  for (const path of PATHS) {
    const dx = path.b.x - path.a.x, dz = path.b.z - path.a.z, length = Math.hypot(dx, dz), ux = dx / length, uz = dz / length;
    const angle = Math.atan2(dx, dz);
    for (const [from, to] of visibleBridgeSpans(path, floors)) {
      const span = to - from, middle = (from + to) / 2, x = path.a.x + ux * middle, z = path.a.z + uz * middle;
      art.add(box(path.width, .18, span), 'basalt', [x, -.23, z], undefined, [0, angle, 0]);
      const count = Math.ceil(span / .64), step = span / count;
      for (let slat = 0; slat < count; slat++) {
        const along = from + step * (slat + .5), px = path.a.x + ux * along, pz = path.a.z + uz * along;
        art.add(box(path.width, .1, step - .022), slat % 6 ? 'patina' : 'copper', [px, -.12, pz], undefined, [0, angle, 0]);
        for (const side of [-1, 1]) art.add(cylinder(.035, .026, 6), 'copper',
          [px + uz * (path.width / 2 - .16) * side, -.056, pz - ux * (path.width / 2 - .16) * side], undefined, undefined, false);
      }
      for (const side of [-1, 1]) {
        const offset = side * (path.width / 2 + .1), nx = uz * offset, nz = -ux * offset;
        art.add(tube([[path.a.x + ux * from + nx, -2, path.a.z + uz * from + nz],
          [x + nx, -.3, z + nz], [path.a.x + ux * to + nx, -2, path.a.z + uz * to + nz]], .13, false, 18), 'copper');
        art.add(box(.055, .065, span), 'copper', [x + nx, .83, z + nz], undefined, [0, angle, 0]);
        for (let post = 0; post <= Math.floor(span / 1.8); post++) {
          const along = from + span * post / Math.max(1, Math.floor(span / 1.8));
          art.add(cylinder(.035, .88, 6), 'copper', [path.a.x + ux * along + nx, .38, path.a.z + uz * along + nz]);
        }
      }
    }
    // Physical inlays stop short of each path endpoint, leaving all intersecting centers clear.
    const spans = visibleBridgeSpans(path, floors), hidden: Array<readonly [number, number]> = [];
    let cursor = 0;
    for (const [from, to] of spans) { if (from > cursor) hidden.push([cursor, from]); cursor = to; }
    if (cursor < length) hidden.push([cursor, length]);
    for (const [from, to] of hidden) {
      const start = Math.max(from, 1.05), end = Math.min(to, length - 1.05);
      if (end <= start) continue;
      const middle = (start + end) / 2;
      art.add(box(.018, .012, end - start), 'patina', [path.a.x + ux * middle, .022, path.a.z + uz * middle],
        undefined, [0, angle, 0], false);
    }
  }
  // Calm depth contours are static artwork; they do not indicate system traffic.
  for (const f of floors) for (let ring = 0; ring < 3; ring++) {
    const points = radialPoints(f.radius + .8 + ring * .6, ring + 18, 40, .012).map(([x, z]) => [x, -4.96 + ring * .006, z] as V3);
    art.add(tube(points, .025 - ring * .005, true, 36), 'patina', [f.x, 0, f.z], undefined, undefined, false);
  }
}
