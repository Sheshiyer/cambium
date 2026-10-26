// ACT 3 — CONSTELLATION (f300–509)
// The strip falls onto a 2.5D contour plane. Cortex is the hub feeding every
// island; Genesis -> Taste -> Build -> Ops is the settled chain. Packets drift
// along the rails. OPS gets selected (orbitSweep + node-view panel), BUILD
// raises warningAttention (persistent peach, never pulsing) and resolves.
import { DoubleSide, Group, Mesh, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial, Vector3 } from 'three';
import type { Act, Ctx } from '../engine.ts';
import { clamp01, e, ease, inOut, lerp, pop, range } from '../lib/ease.ts';
import { Ring } from '../lib/ring.ts';
import { mulberry32 } from '../lib/rng.ts';
import { DotField, Stroke, smoothPath, type V3 } from '../lib/shapes.ts';
import { PaintSprite, TextSprite } from '../lib/text.ts';
import { lightIsland } from '../layers/islands.ts';
import { makeSpecimen, type Specimen } from '../layers/specimen.ts';
import { makeTopo, type Topo } from '../layers/topo.ts';
import { ORGANS, TEMPERANCE, type OrganId } from '../timeline.ts';
import { COL, FONT, HEX } from '../tokens.ts';

const A0 = 300;
export const polar = (deg: number, r: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
};
export const POS: Record<OrganId, [number, number]> = {
  cortex: [0, 0],
  genesis: polar(-118, 640),
  taste: polar(-48, 660),
  build: polar(42, 660),
  ops: polar(116, 640),
};
const STRIP_X = (i: number) => (i - 2) * 352;
const TEMP_R = 1180;
const TEMP_ANG = [-160, -84, -16, 64, 142, 196];
const FOV = 32;

interface Node {
  id: OrganId;
  plate?: Specimen;
  island?: Group;
  label: TextSprite;
  leader: Stroke;
  size: number;
}

export class ConstellationAct implements Act {
  id = 'constellation';
  scene = new Scene();
  ui = new Scene();
  camera = new PerspectiveCamera(FOV, 16 / 9, 10, 30000);
  private topo!: Topo;
  private nodes: Node[] = [];
  private spokes: Stroke[] = [];
  private chain: Stroke[] = [];
  private chainBed: Stroke[] = [];
  private outer!: Ring;
  private temps: { plate: Mesh; ring: Ring; label: TextSprite; pos: Vector3 }[] = [];
  private packets!: DotField;
  private packetSpec: { rail: Stroke; phase: number; speed: number; chain: boolean }[] = [];
  private selTrack!: Ring;
  private sel!: Ring;
  private selDots!: DotField;
  private nine!: TextSprite;
  private warnRing!: Ring;
  private warnIcon!: Stroke[];
  private check!: Stroke;
  private gate!: PaintSprite;
  private flow!: TextSprite;
  private panel!: PaintSprite;
  private panelBar!: Stroke;
  private panelSel!: Stroke;
  private panelWarn!: PaintSprite;
  private tmp = new Vector3();
  private tmp2 = new Vector3();

  async init(ctx: Ctx) {
    this.topo = makeTopo({ w: 12000, h: 12000 });
    this.topo.rotation.x = -Math.PI / 2;
    const tu = this.topo.material.uniforms;
    tu.uCell.value = 12;
    tu.uDotR.value = 2.1;
    tu.uFreq.value = 1 / 1500;
    tu.uLevels.value = 7;
    tu.uAlpha.value = 0.17;
    tu.uGridSize.value = 128;
    this.scene.add(this.topo);
    lightIsland(this.scene, ctx.renderer);

    const persp = 1080 / (2 * Math.tan((FOV * Math.PI) / 360));
    const gN: V3 = [0, 1, 0];
    const ground = (x: number, z: number, y = 2): V3 => [x, y, z];

    // spokes: cortex feeds every island (dotted = in transit)
    for (const o of ORGANS) {
      if (o.id === 'cortex') continue;
      const [x, z] = POS[o.id];
      const len = Math.hypot(x, z);
      const nx = x / len;
      const nz = z / len;
      const side = 70;
      const pts = smoothPath(
        [
          ground(nx * 150, nz * 150),
          ground(nx * len * 0.5 - nz * side, nz * len * 0.5 + nx * side),
          ground(x - nx * 150, z - nz * 150),
        ],
        90,
      );
      const s = new Stroke(pts, { width: 7, color: 'mist', dash: 26, dotted: true, normal: gN, opacity: 0.6 });
      s.mesh.renderOrder = 2;
      this.spokes.push(s);
      this.scene.add(s.mesh);
    }
    // chain: settled solid signal on a darker bed
    const order: OrganId[] = ['genesis', 'taste', 'build', 'ops'];
    for (let i = 0; i < 3; i++) {
      const [ax, az] = POS[order[i]];
      const [bx, bz] = POS[order[i + 1]];
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const ml = Math.hypot(mx, mz);
      const bulge = 1.32;
      const pts = smoothPath(
        [
          ground(ax + (bx - ax) * 0.16, az + (bz - az) * 0.16),
          ground((mx / ml) * ml * bulge, (mz / ml) * ml * bulge),
          ground(bx - (bx - ax) * 0.16, bz - (bz - az) * 0.16),
        ],
        120,
      );
      const bed = new Stroke(pts, { width: 26, color: 'ink', normal: gN, opacity: 0.75 });
      bed.mesh.renderOrder = 1;
      const s = new Stroke(pts, { width: 6, color: 'signal', normal: gN });
      s.u.uHead.value = 1;
      s.mesh.renderOrder = 2;
      this.chainBed.push(bed);
      this.chain.push(s);
      this.scene.add(bed.mesh, s.mesh);
    }
    this.outer = new Ring({ r: TEMP_R, w: 6, color: 'mist', dash: 220, dotted: true, opacity: 0.3 });
    this.outer.mesh.rotation.x = -Math.PI / 2;
    this.outer.mesh.position.y = 1;
    this.outer.mesh.renderOrder = 1;
    this.scene.add(this.outer.mesh);

    // organ nodes
    for (const o of ORGANS) {
      const size = o.id === 'cortex' ? 400 : 310;
      const n: Node = {
        id: o.id,
        size,
        label: new TextSprite(o.label, { font: 'display', size: 30, tracking: 0.06, color: 'paper' }),
        leader: new Stroke([[0, 0, 0], [26, 30, 0], [96, 30, 0]], { width: 1.25, color: 'mist', opacity: 0.7 }),
      };
      if (o.id === 'genesis') {
        n.island = (ctx.assets.island as Group).clone();
        n.island.traverse((m: any) => {
          if (m.isMesh) m.renderOrder = 4;
        });
        this.scene.add(n.island);
      } else {
        n.plate = makeSpecimen(ctx.tex[`m:${o.id}`], size);
        this.scene.add(n.plate);
      }
      this.ui.add(n.label.mesh, n.leader.mesh);
      this.nodes.push(n);
    }
    // Temperance organs: circle-masked lens nodes on the outer ring
    const lensFrag = /* glsl */ `
      uniform sampler2D map; uniform float uOpacity; varying vec2 vUv;
      void main(){ vec2 p = vUv*2.0-1.0; float r = length(p); float aa = fwidth(r)*1.5;
        float a = (1.0 - smoothstep(0.92-aa, 0.92, r)) * uOpacity; if (a<=0.002) discard;
        vec3 c = texture2D(map, (p*0.62)*0.5+0.5).rgb * 0.92; gl_FragColor = vec4(c*a, a); }`;
    TEMPERANCE.forEach((name, i) => {
      const key = `o:${name.toLowerCase()}`;
      const mat = new ShaderMaterial({
        uniforms: { map: { value: ctx.tex[key] }, uOpacity: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: lensFrag,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
      });
      mat.blending = 5;
      mat.blendSrc = 201;
      mat.blendDst = 205;
      const plate = new Mesh(new PlaneGeometry(170, 170), mat);
      plate.renderOrder = 3;
      const ring = new Ring({ r: 80, w: 2, color: 'mist', opacity: 0.5 });
      ring.mesh.renderOrder = 3;
      const [x, z] = polar(TEMP_ANG[i], TEMP_R);
      const label = new TextSprite(name, { font: 'mono', size: 12, tracking: 0.16, color: 'mist', align: 'center' });
      this.scene.add(plate, ring.mesh);
      this.ui.add(label.mesh);
      this.temps.push({ plate, ring, label, pos: new Vector3(x, 90, z) });
    });

    // packets on every rail
    this.packets = new DotField(900, { perspective: persp, core: 0.46, halo: 0.3 });
    this.packets.points.renderOrder = 3;
    this.scene.add(this.packets.points);
    const rnd = mulberry32(31);
    for (const s of this.chain) for (let k = 0; k < 26; k++) this.packetSpec.push({ rail: s, phase: rnd(), speed: 0.0055 + rnd() * 0.003, chain: true });
    for (const s of this.spokes) for (let k = 0; k < 14; k++) this.packetSpec.push({ rail: s, phase: rnd(), speed: 0.007 + rnd() * 0.004, chain: false });

    // selection on OPS
    const [ox, oz] = POS.ops;
    this.selTrack = new Ring({ r: 210, w: 5, color: 'mist', dash: 64, dotted: true, opacity: 0.4 });
    this.sel = new Ring({ r: 210, w: 6, color: 'signal' });
    this.sel.u.uHead.value = 1;
    for (const r of [this.selTrack, this.sel]) {
      r.mesh.rotation.x = -Math.PI / 2;
      r.mesh.position.set(ox, 3, oz);
      r.mesh.renderOrder = 3;
      this.scene.add(r.mesh);
    }
    this.selDots = new DotField(8, { perspective: persp, core: 0.5, halo: 0.32 });
    this.selDots.points.renderOrder = 7;
    this.scene.add(this.selDots.points);
    this.nine = new TextSprite('9/17', { font: 'display', size: 72, color: 'signal', align: 'right' });
    this.ui.add(this.nine.mesh);

    // warning on BUILD
    const [bx, bz] = POS.build;
    this.warnRing = new Ring({ r: 230, w: 6, color: 'warning' });
    this.warnRing.mesh.rotation.x = -Math.PI / 2;
    this.warnRing.mesh.position.set(bx, 3, bz);
    this.warnRing.mesh.renderOrder = 3;
    this.scene.add(this.warnRing.mesh);
    const T = 22;
    this.warnIcon = [
      new Stroke([[0, T, 0], [T * 0.92, -T * 0.6, 0], [-T * 0.92, -T * 0.6, 0], [0, T, 0]], { width: 2.5, color: 'warning' }),
      new Stroke([[0, 7, 0], [0, -6, 0]], { width: 2.5, color: 'warning' }),
      new Stroke([[0, -10, 0], [0, -12.5, 0]], { width: 3, color: 'warning' }),
    ];
    this.check = new Stroke([[-14, 0, 0], [-4, -10, 0], [16, 12, 0]], { width: 3, color: 'signal' });
    this.gate = new PaintSprite(168, 40, (c) => {
      c.fillStyle = HEX.warning;
      c.beginPath();
      c.roundRect(0, 0, 168, 40, 8);
      c.fill();
      c.fillStyle = HEX.ink;
      c.font = `700 22px "${FONT.display}"`;
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      (c as any).letterSpacing = '1px';
      c.fillText('REVIEW GATE', 84, 22);
    });
    this.ui.add(...this.warnIcon.map((s) => s.mesh), this.check.mesh, this.gate.mesh);

    this.flow = new TextSprite('GENESIS → TASTE → BUILD → OPS · CORTEX FEEDS EVERY ISLAND', {
      font: 'mono', size: 15, tracking: 0.12, color: 'mist',
    });
    this.ui.add(this.flow.mesh);

    // node-view panel (design-system board §5)
    const PW = 440;
    const PH = 600;
    this.panel = new PaintSprite(PW, PH, (c) => drawPanel(c, PW, PH));
    this.panelBar = new Stroke([[0, 0, 0], [PW - 56, 0, 0]], { width: 4, color: 'signal' });
    this.panelSel = new Stroke(roundRectPts(PW - 40, 34, 6), { width: 1.5, color: 'signal' });
    this.panelWarn = new PaintSprite(96, 22, (c) => {
      c.strokeStyle = HEX.warning;
      c.lineWidth = 1.5;
      c.beginPath();
      c.roundRect(1, 1, 94, 20, 4);
      c.stroke();
      c.fillStyle = HEX.warning;
      c.font = `500 11px "${FONT.mono}"`;
      (c as any).letterSpacing = '1.5px';
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      c.fillText('REVIEW', 48, 12);
    });
    this.ui.add(this.panel.mesh, this.panelBar.mesh, this.panelSel.mesh, this.panelWarn.mesh);
  }

  private project(v: Vector3) {
    this.tmp2.copy(v).project(this.camera);
    return { x: this.tmp2.x * 960, y: this.tmp2.y * 540, z: this.tmp2.z };
  }

  update(f: number) {
    const t = f - A0;
    // ---------------------------------------------------------------- camera
    const fall = inOut(range(t, 0, 44));
    const rise = inOut(range(t, 182, 212));
    const phi = lerp(lerp(89.2, 38, fall), 84, rise) * (Math.PI / 180);
    const theta = (lerp(0, -7, fall) + 12 * inOut(range(t, 30, 200)) - 4) * (Math.PI / 180);
    const selFocus = ease(range(t, 96, 130)) * (1 - ease(range(t, 176, 204)));
    const R = lerp(lerp(1883, 3050, fall), 1700, rise) - 650 * selFocus;
    const [ox, oz] = POS.ops;
    const tx = lerp(0, ox * 0.92 + 120, selFocus);
    const tz = lerp(-40 * (1 - fall) + 40 * fall, oz * 0.92, selFocus);
    this.camera.position.set(tx + R * Math.cos(phi) * Math.sin(theta), R * Math.sin(phi), tz + R * Math.cos(phi) * Math.cos(theta));
    this.camera.up.set(0, 1, 0);
    if (phi > 1.5) this.camera.up.set(-Math.sin(theta), 0, -Math.cos(theta));
    this.camera.lookAt(tx, 0, tz);
    this.camera.updateMatrixWorld();

    const tu = this.topo.material.uniforms;
    tu.uTime.value = 7.3 + f / 60 * 0.04;
    tu.uRippleR.value = lerp(0, 2600, ease(range(t, 0, 60)));
    tu.uRippleW.value = 160;
    tu.uGrid.value = 0.16 * rise;

    // ---------------------------------------------------------------- nodes
    const settle = ease(range(t, 2, 40));
    const fadeOut = 1 - ease(range(t, 190, 210));
    this.nodes.forEach((n, i) => {
      const [px, pz] = POS[n.id];
      const k = ease(range(t, 2 + i * 3, 40 + i * 3));
      const x = lerp(STRIP_X(i), px, k);
      const z = lerp(-40, pz, k);
      const size = lerp(300, n.size, k);
      const warn = n.id === 'build' ? range(t, 152, 160) * (1 - range(t, 192, 200)) : 0;
      if (n.plate) {
        n.plate.position.set(x, size * 0.12 * k, z);
        n.plate.quaternion.copy(this.camera.quaternion);
        n.plate.scale.setScalar(size / n.size);
        const m = n.plate.material.uniforms;
        m.uOpacity.value = fadeOut;
        (m.uTint.value as any).setRGB(1, 1, 1).lerp(COL.warning, warn * 0.0);
      }
      if (n.island) {
        const s = size * 0.86;
        n.island.scale.setScalar(s);
        n.island.position.set(x, s * 0.12 * k, z);
        n.island.rotation.set(0, lerp(0.6, -0.4, range(t, 0, 210)), 0);
        n.island.scale.multiplyScalar(Math.max(0.001, fadeOut));
        n.island.visible = fadeOut > 0.01;
      }
      // labels
      const top = this.tmp.set(x, size * (n.island ? 0.22 : 0.42) * k + 10, z);
      const p = this.project(top);
      const lOn = e(t, 34 + i * 4, 50 + i * 4) * fadeOut;
      const isWarn = n.id === 'build' && warn > 0.5;
      n.label.color(isWarn ? 'warning' : n.id === 'ops' && t > 100 ? 'signal' : 'paper');
      n.label.at(p.x + 104, p.y + 30).reveal(lOn).opacity(lOn > 0 ? 1 : 0);
      n.leader.mesh.position.set(p.x, p.y, 0);
      n.leader.draw(lOn).opacity(0.7 * fadeOut);
    });

    // ---------------------------------------------------------------- rails
    this.spokes.forEach((s, i) => {
      s.draw(ease(range(t, 24 + i * 3, 56 + i * 3))).opacity(0.55 * fadeOut);
      s.u.uOffset.value = -f * 2.2;
    });
    this.chain.forEach((s, i) => {
      const d = ease(range(t, 36 + i * 8, 64 + i * 8));
      s.draw(d).opacity(fadeOut);
      this.chainBed[i].draw(d).opacity(0.75 * fadeOut);
    });
    this.outer.arc(ease(range(t, 30, 90))).opacity(0.3 * fadeOut);
    this.outer.mesh.rotation.z = f * 0.0008;
    this.temps.forEach((tp, i) => {
      const on = e(t, 50 + i * 5, 70 + i * 5) * fadeOut;
      tp.plate.position.copy(tp.pos);
      tp.plate.quaternion.copy(this.camera.quaternion);
      tp.plate.scale.setScalar(lerp(0.4, 1, pop(range(t, 50 + i * 5, 70 + i * 5))));
      (tp.plate.material as any).uniforms.uOpacity.value = on;
      tp.plate.visible = on > 0.01;
      tp.ring.mesh.position.copy(tp.pos);
      tp.ring.mesh.quaternion.copy(this.camera.quaternion);
      tp.ring.arc(ease(range(t, 54 + i * 5, 80 + i * 5))).opacity(0.5 * on);
      const p = this.project(this.tmp.copy(tp.pos).setY(-10));
      tp.label.at(p.x, p.y - 70).reveal(on).opacity(on * 0.8);
    });

    // packets (packetDrift) with ghosted trails
    this.packets.begin();
    const flowOn = range(t, 40, 70) * fadeOut;
    if (flowOn > 0) {
      for (const pk of this.packetSpec) {
        const head = (pk.phase + f * pk.speed) % 1;
        const vis = pk.rail.u.uEnd.value as number;
        if (head > vis) continue;
        const ghosts = pk.chain ? 3 : 1;
        for (let g = 0; g < ghosts; g++) {
          const uu = head - g * 0.012;
          if (uu < 0) continue;
          pk.rail.pointAt(uu, this.tmp);
          const edge = Math.min(1, uu * 8, (1 - uu) * 8);
          const a = (g === 0 ? 1 : 0.4 - g * 0.12) * flowOn * edge;
          this.packets.push(this.tmp.x, 6, this.tmp.z, pk.chain ? (g === 0 ? 15 : 11) : 10, pk.chain ? COL.signal : COL.mist, pk.chain ? a : a * 0.7);
        }
      }
    }
    this.packets.end();

    // ---------------------------------------------------------------- select OPS
    const sOn = (1 - ease(range(t, 182, 200)));
    const sweep = ease(range(t, 100, 128));
    this.selTrack.arc(t >= 98 ? 1 : 0).opacity(0.4 * sOn);
    this.sel.arc(sweep).opacity(sOn);
    this.selDots.begin();
    if (sweep > 0) {
      const ang = sweep * Math.PI * 2;
      const R0 = 210;
      this.selDots.push(ox + Math.sin(ang) * R0, 4, oz - Math.cos(ang) * R0, 18, COL.signal, sOn);
      if (sweep >= 0.999) {
        this.selDots.push(ox, 4, oz - R0, 13, COL.signal, sOn);
        this.selDots.push(ox, 4, oz + R0, 13, COL.signal, sOn);
      }
    }
    this.selDots.end();
    const np = this.project(this.tmp.set(ox - 250, 0, oz + 40));
    const nOn = e(t, 112, 126) * sOn;
    this.nine.at(np.x, np.y).reveal(nOn).opacity(nOn > 0 ? 1 : 0);

    // ---------------------------------------------------------------- warn BUILD
    const [bx, bz] = POS.build;
    const wIn = ease(range(t, 152, 162));
    const wOut = ease(range(t, 192, 200));
    const resolved = range(t, 192, 200);
    this.warnRing.arc(1).opacity(wIn * (1 - wOut) * fadeOut);
    this.warnRing.color('warning');
    const bn = this.nodes[2];
    const bl = this.project(this.tmp.set(bx, bn.size * 0.42 + 10, bz));
    const wp = { x: bl.x + 104 + bn.label.width + 10, y: bl.y + 30 };
    this.warnIcon.forEach((s) => {
      s.mesh.position.set(wp.x, wp.y + 4, 0);
      s.draw(wIn).opacity((1 - wOut) * fadeOut);
    });
    this.check.mesh.position.set(wp.x, wp.y + 2, 0);
    this.check.draw(ease(range(t, 194, 204))).opacity(resolved * fadeOut);
    this.gate.mesh.position.set(wp.x + 124, wp.y + 2, 0);
    this.gate.reveal(ease(range(t, 158, 168))).opacity((1 - wOut) * fadeOut);

    // ---------------------------------------------------------------- copy
    this.flow.at(-904, 400).reveal(e(t, 46, 80)).opacity(0.85 * fadeOut * (1 - ease(range(t, 92, 108))));

    // ---------------------------------------------------------------- panel
    const pIn = ease(range(t, 104, 128));
    const pOut = ease(range(t, 180, 198));
    const PX = 904 - 220 + (1 - pIn) * 520 + pOut * 520;
    const PY = -30;
    this.panel.mesh.position.set(PX, PY, 0);
    this.panel.reveal(ease(range(t, 110, 140))).opacity(pIn > 0 ? 1 : 0);
    // progress bar 9/17
    this.panelBar.mesh.position.set(PX - 220 + 28, PY + 300 - 214, 0);
    this.panelBar.draw((9 / 17) * ease(range(t, 128, 150))).opacity(pIn);
    // selected row (OPS = row 4)
    this.panelSel.mesh.position.set(PX, PY + 300 - rowY(3), 0);
    this.panelSel.draw(ease(range(t, 136, 156))).opacity(pIn * (1 - pOut));
    this.panelWarn.mesh.position.set(PX + 220 - 20 - 48, PY + 300 - rowY(2), 0);
    this.panelWarn.opacity(wIn * (1 - wOut) * (1 - pOut));
    void clamp01;
    void settle;
  }
}

// ---------------------------------------------------------------- panel art
const ROWS = [
  ['01', 'GENESIS', 'ACTIVE'],
  ['02', 'TASTE', 'ACTIVE'],
  ['03', 'BUILD', 'ACTIVE'],
  ['04', 'OPS', 'ACTIVE'],
  ['05', 'CORTEX', 'ACTIVE'],
  ['06', 'ARC X', 'STALE'],
];
export const rowY = (i: number) => 328 + i * 40;

export function roundRectPts(w: number, h: number, r: number): V3[] {
  const out: V3[] = [];
  const c: [number, number, number][] = [
    [w / 2 - r, h / 2 - r, Math.PI / 2],
    [w / 2 - r, -h / 2 + r, 0],
    [-w / 2 + r, -h / 2 + r, -Math.PI / 2],
    [-w / 2 + r, h / 2 - r, Math.PI],
  ];
  for (const [cx, cy, a0] of c) for (let i = 0; i <= 6; i++) {
    const a = a0 - (i / 6) * (Math.PI / 2);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0]);
  }
  out.push(out[0]);
  return out;
}

export function drawPanel(c: CanvasRenderingContext2D, W: number, H: number) {
  const mono = (s: number, w = 500) => `${w} ${s}px "${FONT.mono}"`;
  c.fillStyle = 'rgba(1,47,52,0.92)';
  c.strokeStyle = 'rgba(214,255,246,0.26)';
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(0.5, 0.5, W - 1, H - 1, 8);
  c.fill();
  c.stroke();
  c.fillStyle = HEX.mist;
  c.globalAlpha = 0.62;
  c.font = mono(12);
  (c as any).letterSpacing = '1.5px';
  c.fillText('NODE VIEW (SELECTED)', 24, 34);
  c.fillText('×', W - 34, 34);
  c.globalAlpha = 1;
  c.fillStyle = HEX.paper;
  c.font = `700 56px "${FONT.display}"`;
  (c as any).letterSpacing = '1px';
  c.fillText('OPS', 24, 104);
  // ACTIVE chip
  c.strokeStyle = HEX.signal;
  c.beginPath();
  c.roundRect(120, 66, 84, 26, 4);
  c.stroke();
  c.fillStyle = HEX.signal;
  c.font = mono(12);
  (c as any).letterSpacing = '1.5px';
  c.fillText('ACTIVE', 136, 84);
  const kv = [
    ['TYPE', 'WILL · OPS'],
    ['STATUS', 'ACTIVE'],
    ['PROGRESS', '9/17'],
  ];
  kv.forEach(([k, v], i) => {
    c.globalAlpha = 0.62;
    c.fillStyle = HEX.mist;
    c.fillText(k, 24, 146 + i * 26);
    c.globalAlpha = 1;
    c.fillStyle = i === 1 ? HEX.signal : HEX.paper;
    c.fillText(v, 160, 146 + i * 26);
  });
  // progress track
  c.globalAlpha = 0.18;
  c.fillStyle = HEX.mist;
  c.fillRect(28, 212, W - 56, 4);
  c.globalAlpha = 0.26;
  c.fillRect(24, 250, W - 48, 1);
  c.globalAlpha = 0.62;
  c.fillStyle = HEX.mist;
  c.fillText('NODES', 24, 290);
  c.fillText('9 / 17', W - 92, 290);
  ROWS.forEach(([n, name, st], i) => {
    const y = rowY(i);
    c.globalAlpha = 0.5;
    c.fillStyle = HEX.mist;
    c.fillText(n, 34, y + 5);
    c.globalAlpha = 1;
    c.fillStyle = HEX.paper;
    c.font = `700 20px "${FONT.display}"`;
    (c as any).letterSpacing = '1.5px';
    c.fillText(name, 74, y + 7);
    c.font = mono(11);
    (c as any).letterSpacing = '1.5px';
    c.fillStyle = st === 'STALE' ? HEX.mist : HEX.signal;
    c.globalAlpha = st === 'STALE' ? 0.5 : 0.9;
    c.fillText(st, W - 92, y + 5);
    c.globalAlpha = 0.12;
    c.fillStyle = HEX.mist;
    c.fillRect(24, y + 20, W - 48, 1);
  });
  c.globalAlpha = 0.62;
  c.fillStyle = HEX.mist;
  c.font = mono(11);
  c.fillText('IN 1,248   OUT 943   DROP 12   LAT 46ms', 24, H - 24);
}
