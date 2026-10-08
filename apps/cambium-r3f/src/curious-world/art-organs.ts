import * as THREE from 'three';
import { WORLD_LANDMARKS, type WorldLandmark } from './world-model.ts';
import { bowl, box, carve, cylinder, globe, radialPoints, sector, tube, type ArtBuilder, type Surface, type V3 } from './art-geometry.ts';

function shell(height: number, width: number, lean: number) {
  const vertices: number[] = [];
  for (let i = 0; i < 14; i++) {
    const row = (t: number, side: number): V3 => [lean * t + side * width * Math.sin(Math.PI * (.09 + t * .9)),
      .22 + t * height, .19 * Math.sin(t * Math.PI)];
    const a = row(i / 14, -1), b = row(i / 14, 1), c = row((i + 1) / 14, -1), d = row((i + 1) / 14, 1);
    for (const p of [a, b, c, b, d, c, c, b, a, c, d, b]) vertices.push(...p);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); return geometry;
}
export function buildArchitecture(art: ArtBuilder) {
  for (const landmark of WORLD_LANDMARKS) buildLandmark(landmark, art);
}
export function buildLandmark(l: WorldLandmark, art: ArtBuilder) {
  const origin: V3 = [l.x, 0, l.z];
  let abovePedestal = false;
  const add = (g: THREE.BufferGeometry, m: Surface, p: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) => {
    const pose = new THREE.Object3D(); pose.position.set(...p); pose.scale.set(...scale); pose.rotation.set(...rotation); pose.updateMatrix(); g.applyMatrix4(pose.matrix);
    if (abovePedestal && l.kind !== 'desk') {
      const relief = ({ hands: 1.85, will: 1.8, taste: 1.65, cortex: 1.7, nutrix: 1.5, circulator: 1.8 } as Record<string, number>)[l.id] ?? 1;
      g.scale(1, relief, 1); g.translate(0, -.19, 0); g.scale(1, 1.5, 1); g.translate(0, .19, 0);
    }
    const vertices = g.getAttribute('position'); let footprint = 0;
    for (let i = 0; i < vertices.count; i++) footprint = Math.max(footprint, Math.hypot(vertices.getX(i), vertices.getZ(i)));
    if (footprint > l.radius - .012) { const fit = (l.radius - .012) / footprint; g.scale(fit, 1, fit); }
    art.add(g, m, origin);
  };
  const seam = (r: number, y: number, m: Surface = 'copper') => add(tube(radialPoints(r, 1, 28, .025).map(([x, z]) => [x, y, z] as V3), .012, true, 32), m);
  add(carve(radialPoints(.69, l.id.length, 24, .05), .15, .015), 'basalt'); seam(.68, .19);
  abovePedestal = true;
  if (l.kind === 'desk') {
    add(carve([[-.48, -.3], [.48, -.28], [.55, .23], [-.5, .3]], .11, .81), 'stone');
    add(box(.14, .63, .43), 'basalt', [-.28, .49, 0]); add(box(.14, .63, .43), 'basalt', [.28, .49, 0]);
    add(box(.72, .035, .43), 'copper', [0, .965, 0], [-.16, 0, 0]);
    for (let i = 0; i < 5; i++) add(box(.47 - i * .035, .009, .008), 'mint', [0, .992, -.12 + i * .05], [-.16, 0, 0]);
    add(globe(.085), 'acid', [.32, 1.02, .13]); return;
  }
  switch (l.id) {
    case 'genesis':
      for (let level = 0; level < 4; level++) { add(carve(radialPoints(.46 - level * .06, level + 2, 18, .1), .12, .17 + level * .12), 'stone'); seam(.43 - level * .06, .3 + level * .12); }
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3;
        add(bowl(.15, .12, 14), 'copper', [Math.cos(a) * .48, .21, Math.sin(a) * .48]);
        add(tube([[0, .22, 0], [Math.cos(a) * .25, .225, Math.sin(a) * .25], [Math.cos(a) * .48, .25, Math.sin(a) * .48]], .012, false, 8), 'mint'); }
      add(new THREE.OctahedronGeometry(.28), 'acid', [0, 1.35, 0], [0, .2, 0], [1, 3, 1]);
      for (const side of [-1, 1]) add(new THREE.OctahedronGeometry(.13), 'acid', [side * .25, .93, .11], [0, .5, side * -.24], [1, 2.7, 1]); break;
    case 'taste':
      for (const side of [-1, 1]) for (let level = 0; level < 4; level++) {
        add(sector(.55 - level * .075, .075, side > 0 ? -.95 : Math.PI - .95, 1.9, .11, .2 + level * .14), level === 3 ? 'limestone' : 'stone', [side * .08, 0, 0]); }
      add(globe(.16, 1), 'patina', [0, .82, 0]);
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; add(globe(.043), 'acid', [Math.cos(a) * .13, .87 + Math.sin(a) * .13, -.1]); }
      add(tube([[-.48, .55, 0], [0, .82, 0], [.48, .55, 0]], .009, false, 12), 'copper'); break;
    case 'hands':
      for (let level = 0; level < 4; level++) add(carve([[-.65, -.19], [-.45, -.55], [0, -.29], [.45, -.55], [.65, -.19], [.45, .53], [.17, .46], [.15, .05], [-.15, .05], [-.17, .46], [-.45, .53]], .13, .17 + level * .13), level % 2 ? 'stone' : 'basalt');
      add(globe(.2, 1), 'patina', [0, .91, -.25]);
      for (const side of [-1, 1]) add(cylinder(.12, .22, 12), 'copper', [side * .59, .43, 0], [0, 0, Math.PI / 2]);
      add(tube([[-.48, .72, .31], [0, .76, -.2], [.48, .72, .31]], .02, false, 18), 'mint'); break;
    case 'will':
      for (let level = 0; level < 3; level++) add(carve([[-.67, -.3], [-.37, -.62], [.14, -.55], [.59, -.35], [.65, .47], [.38, .5], [.18, .07], [-.15, .03], [-.4, .54], [-.65, .4]], .13, .2 + level * .13), level % 2 ? 'stone' : 'basalt');
      add(cylinder(.26, .24, 16), 'copper', [-.27, .77, -.21]); seam(.24, .91, 'mint');
      for (const side of [-1, 1]) add(tube([[-.27, .85, -.21], [side * .15, .62, 0], [side * .51, .64, .42]], .015, false, 12), 'acid'); break;
    case 'cortex': {
      const spiral: V3[] = [];
      for (let i = 0; i < 100; i++) { const a = i / 99 * Math.PI * 5.5, r = .12 + i / 99 * .52; spiral.push([Math.cos(a) * r, .35 + i / 99 * .62, Math.sin(a) * r]); }
      add(tube(spiral, .075, false, 96), 'stone'); add(tube(spiral.map(([x, y, z]) => [x, y + .076, z]), .012, false, 96), 'copper');
      add(globe(.15, 1), 'patina', [0, .52, 0]); add(new THREE.OctahedronGeometry(.075), 'mint', [0, .76, 0]); break;
    }
    case 'vestibule':
      add(sector(.65, .18, .38, Math.PI * 1.75, .17, .2), 'stone');
      add(sector(.61, .045, .38, Math.PI * 1.75, .055, .38), 'copper');
      add(tube([[-.55, .4, 0], [-.45, 1.05, 0], [0, 1.4, 0], [.45, 1.05, 0], [.55, .4, 0]], .12, false, 26), 'basalt');
      add(globe(.095), 'acid', [0, .4, .44]); break;
    case 'adytum':
      add(shell(2.8, .28, .19), 'basalt', [-.2, 0, 0], [0, -.4, -.07]);
      add(shell(2.95, .28, -.19), 'stone', [.2, 0, -.06], [0, .4, .07]);
      for (const side of [-1, 1]) add(tube([[side * .37, .2, .1], [side * .43, 1.15, .09], [side * .2, 2.23, .02], [0, 3.1, .02]], .012, false, 24), 'copper');
      add(bowl(.25, .18), 'patina', [0, .8, .03]); add(globe(.09), 'acid', [0, 1.12, .03]); break;
    case 'nutrix':
      add(bowl(.31, .36), 'stone', [0, .21, -.3]); add(bowl(.34, .16), 'stone', [0, .21, .3]);
      add(globe(.23, 1), 'patina', [0, .66, -.3]);
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5;
        add(tube([[Math.cos(a) * .2, .55, -.3 + Math.sin(a) * .2], [Math.cos(a) * .14, .88, -.3 + Math.sin(a) * .14], [0, .92, -.3]], .014, false, 12), 'copper');
        add(globe(.035), 'acid', [Math.cos(a) * .14, .31, .3 + Math.sin(a) * .14]); } break;
    case 'auspex':
      add(carve([[-.6, -.32], [-.42, -.58], [.39, -.52], [.65, .14], [.28, .57], [-.47, .45]], .21, .19), 'stone');
      add(bowl(.4, .27), 'basalt', [0, .77, 0], [.8, 0, .18]);
      add(new THREE.TorusGeometry(.4, .025, 5, 28), 'copper', [0, 1.01, .16], [1.05, 0, .18]);
      add(globe(.12, 1), 'patina', [0, .6, .05]); add(cylinder(.045, 1.25, 8), 'copper', [-.41, .82, -.25]); break;
    case 'circulator':
      add(sector(.64, .17, 0, Math.PI * 2, .25, .21), 'stone'); seam(.58, .48, 'mint');
      for (let i = 0; i < 3; i++) { const a = Math.PI * .6 + i * .72; add(bowl(.15, .23), 'copper', [Math.cos(a) * .48, .44, Math.sin(a) * .48]); }
      add(globe(.19, 1), 'patina', [.46, .51, -.27]); add(globe(.043), 'acid', [.49, .6, -.4]); break;
    case 'praeceptor':
      add(cylinder(.22, .21, 16), 'stone', [-.4, .3, 0]);
      for (let i = 0; i < 3; i++) { const z = (i - 1) * .39;
        add(carve([[-.45, -.1], [.42, z - .09], [.6, z], [.42, z + .09], [-.45, .1]], .09, .21), 'stone');
        add(bowl(.1, .06), 'copper', [.48, .31, z]); }
      add(globe(.07), 'acid', [-.4, .47, 0]); add(shell(1.65, .28, 0), 'basalt', [.25, .15, -.32], [0, .7, 0]); break;
    default: buildSystem(l, add); break;
  }
}
function buildSystem(l: WorldLandmark, add: (g: THREE.BufferGeometry, m: Surface, p?: V3, r?: V3, s?: V3) => void) {
  if (['access', 'gate', 'curious'].includes(l.id)) {
    add(tube([[-.5, .2, 0], [-.45, 1.2, 0], [0, 1.65, 0], [.45, 1.2, 0], [.5, .2, 0]], .12, false, 24), 'stone');
    add(tube([[-.5, .2, .13], [-.45, 1.2, .13], [0, 1.65, .13], [.45, 1.2, .13], [.5, .2, .13]], .018, false, 24), 'copper');
    add(globe(.1), 'mint', [0, 1.45, 0]);
  } else if (l.id === 'hermes') {
    for (const side of [-1, 1]) {
      add(tube([[side * .48, .2, 0], [side * .52, 1.3, .06], [side * .19, 2.25, .05], [0, 2.42, .04]], .085, false, 22), side > 0 ? 'stone' : 'basalt');
      add(tube([[side * .48, .2, .09], [side * .52, 1.3, .15], [side * .19, 2.25, .14], [0, 2.42, .13]], .012, false, 22), 'copper');
    }
    add(cylinder(.028, 1.25, 7), 'copper', [0, 2.13, .08]);
    add(new THREE.OctahedronGeometry(.15), 'mint', [0, 2.84, .08], [0, .6, 0], [1, 1.45, 1]);
    add(carve([[-.28, -.18], [.28, -.18], [.23, .2], [-.23, .2]], .13, .6), 'patina');
  } else if (l.id === 'omniroute') {
    add(cylinder(.25, 1.65, 10), 'basalt', [0, 1.02, 0]);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, x = Math.cos(a), z = Math.sin(a);
      add(tube([[0, 1.25, 0], [x * .37, 1.48, z * .37], [x * .48, 2.04, z * .48]], .06, false, 12), 'copper');
      add(new THREE.OctahedronGeometry(.09), i % 2 ? 'mint' : 'patina', [x * .48, 2.04, z * .48]);
    }
    add(globe(.2, 1), 'acid', [0, 1.93, 0]);
    add(sector(.32, .045, 0, Math.PI * 2, .08, .69), 'patina');
  } else if (l.id === 'broker') {
    add(carve([[-.3, -.21], [.34, -.24], [.19, .29], [-.23, .28]], 1.48, .19), 'basalt');
    add(tube([[-.59, 1.98, 0], [0, 2.06, 0], [.59, 2.17, 0]], .052, false, 14), 'copper');
    for (const side of [-1, 1]) {
      add(cylinder(.012, .51, 5), 'copper', [side * .49, 1.79 + side * .06, 0]);
      add(bowl(.17, .12, 14), 'patina', [side * .49, 1.48 + side * .06, 0]);
      add(globe(.068), side > 0 ? 'mint' : 'acid', [side * .49, 1.6 + side * .06, 0]);
    }
    add(new THREE.OctahedronGeometry(.09), 'mint', [0, 2.18, 0]);
  } else if (l.id === 'plexus') {
    add(shell(1.65, .27, .14), 'stone', [-.21, 0, 0]);
    add(shell(1.4, .23, -.14), 'basalt', [.21, 0, 0]);
    for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(.26 + i * .06, .013, 5, 20), i % 2 ? 'mint' : 'copper', [0, .65 + i * .3, .08], [.7, i * .3, 0]);
  } else if (['vault', 'd1', 'github', 'proof'].includes(l.id)) {
    add(carve([[-.47, -.38], [.37, -.49], [.53, .28], [.18, .47], [-.48, .29]], 1.23, .2), 'basalt');
    for (let i = 0; i < 5; i++) add(box(.75, .045, .48), i === 2 ? 'patina' : 'copper', [0, .38 + i * .21, .1], [0, -.12 + i * .04, 0]);
    add(globe(.075), 'mint', [0, 1.55, 0]);
  } else {
    add(shell(1.8, .43, 0), 'stone', [0, 0, 0], [0, .22, 0]);
    add(box(.57, .95, .035), 'patina', [0, .87, .17], [0, .22, 0]);
    add(tube([[-.36, .19, .11], [-.27, 1.37, .11], [0, 1.9, .11], [.27, 1.37, .11], [.36, .19, .11]], .012, false, 24), 'copper');
  }
}
