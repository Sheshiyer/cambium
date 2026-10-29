// LONG 05 — ONE GOVERNED FLOW (bars 21–28, f3600–5039)
// The constellation at reading pace. A six-step ladder (field guide 10:
// observe, identify, admit, execute, verify, deliver) advances along the
// bottom while the camera visits each idea: the hub, the Temperance ring,
// the OPS node view, BUILD's blocked proof and its resolution.
import { DoubleSide, Group, Mesh, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial, Vector3 } from 'three';
import type { Act, Ctx } from '../../../engine.ts';
import { e, ease, inOut, lerp, pop, range } from '../../../lib/ease.ts';
import { Ring } from '../../../lib/ring.ts';
import { mulberry32 } from '../../../lib/rng.ts';
import { DotField, Stroke, smoothPath, type V3 } from '../../../lib/shapes.ts';
import { PaintSprite, TextSprite } from '../../../lib/text.ts';
import { TextBlock } from '../../../lib/textblock.ts';
import { lightIsland } from '../../../layers/islands.ts';
import { makeSpecimen, type Specimen } from '../../../layers/specimen.ts';
import { makeTopo, type Topo } from '../../../layers/topo.ts';
import { ORGANS, TEMPERANCE, type OrganId } from '../../../timeline.ts';
import { COL, FONT, HEX } from '../../../tokens.ts';
import { POS, drawPanel, polar, roundRectPts, rowY } from '../../../acts/act3-constellation.ts';
import { L } from '../timeline.ts';

const A0 = L.flow[0];
const STRIP_X = (i: number) => (i - 2) * 352;
const TEMP_R = 1000;
const TEMP_ANG = [-150, -90, -30, 30, 90, 150]; // evenly spaced, 60° apart
const TEMP_ROLE = ['ORIENTS', 'SUGGESTS', 'LEARNS', 'READS HEALTH', 'DIGESTS', 'PROPOSES'];
const FOV = 32;

const STEPS = [
  ['OBSERVE', 'Vestibule orients; Cortex retrieves.'],
  ['IDENTIFY', 'A falsifiable change, with an owner.'],
  ['ADMIT', 'A signed gate admits and pins the work.'],
  ['EXECUTE', 'Genesis · Taste · Hands · Will, in scope.'],
  ['VERIFY', 'Structure and meaning, before consequence.'],
  ['DELIVER', 'Release within scope — or hold.'],
];
const STEP_T = [60, 290, 520, 750, 980, 1210, 1440];
const LADDER_Y = -350;
const LX = (i: number) => -650 + i * 260;

interface Node {
  id: OrganId;
  plate?: Specimen;
  island?: Group;
  label: TextSprite;
  leader: Stroke;
  size: number;
}

export class LongFlow implements Act {
  id = 'l-flow';
  scene = new Scene();
  ui = new Scene();
  camera = new PerspectiveCamera(FOV, 16 / 9, 10, 30000);
  private topo!: Topo;
  private nodes: Node[] = [];
  private spokes: Stroke[] = [];
  private chain: Stroke[] = [];
  private chainBed: Stroke[] = [];
  private outer!: Ring;
  private temps: { plate: Mesh; ring: Ring; label: TextSprite; role: TextSprite; pos: Vector3 }[] = [];
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
  private panel!: PaintSprite;
  private panelBar!: Stroke;
  private panelSel!: Stroke;
  private panelWarn!: PaintSprite;
  private caps: { block: TextBlock; in: number; out: number }[] = [];
  private scrim!: PaintSprite;
  private capScrim!: PaintSprite;
  private ladderRail!: Stroke;
  private ladderTrace!: Stroke;
  private ladderNodes: { pend: Ring; done: Ring; label: TextSprite; desc: TextSprite }[] = [];
  private ladderDots!: DotField;
  private tmp = new Vector3();
  private tmp2 = new Vector3();
  private capOn = 0;

  /** labels that land in the caption zone give way while a caption is up */
  private clear(x: number, y: number) {
    const inside = x < -180 && y > 60 ? 1 : 0;
    return 1 - inside * this.capOn;
  }

  async init(ctx: Ctx) {
    this.topo = makeTopo({ w: 14000, h: 14000 });
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

    for (const o of ORGANS) {
      if (o.id === 'cortex') continue;
      const [x, z] = POS[o.id];
      const len = Math.hypot(x, z);
      const nx = x / len;
      const nz = z / len;
      const pts = smoothPath([ground(nx * 150, nz * 150), ground(nx * len * 0.5 - nz * 70, nz * len * 0.5 + nx * 70), ground(x - nx * 150, z - nz * 150)], 90);
      const s = new Stroke(pts, { width: 7, color: 'mist', dash: 26, dotted: true, normal: gN, opacity: 0.6 });
      s.mesh.renderOrder = 2;
      this.spokes.push(s);
      this.scene.add(s.mesh);
    }
    const order: OrganId[] = ['genesis', 'taste', 'build', 'ops'];
    for (let i = 0; i < 3; i++) {
      const [ax, az] = POS[order[i]];
      const [bx, bz] = POS[order[i + 1]];
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const pts = smoothPath([ground(ax + (bx - ax) * 0.16, az + (bz - az) * 0.16), ground(mx * 1.32, mz * 1.32), ground(bx - (bx - ax) * 0.16, bz - (bz - az) * 0.16)], 120);
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
        this.scene.add(n.island);
      } else {
        n.plate = makeSpecimen(ctx.tex[`m:${o.id}`], size);
        this.scene.add(n.plate);
      }
      this.ui.add(n.label.mesh, n.leader.mesh);
      this.nodes.push(n);
    }
    const lensFrag = /* glsl */ `
      uniform sampler2D map; uniform float uOpacity; varying vec2 vUv;
      void main(){ vec2 p = vUv*2.0-1.0; float r = length(p); float aa = fwidth(r)*1.5;
        float a = (1.0 - smoothstep(0.92-aa, 0.92, r)) * uOpacity; if (a<=0.002) discard;
        vec3 c = texture2D(map, (p*0.62)*0.5+0.5).rgb * 0.92; gl_FragColor = vec4(c*a, a); }`;
    TEMPERANCE.forEach((name, i) => {
      const mat = new ShaderMaterial({
        uniforms: { map: { value: ctx.tex[`o:${name.toLowerCase()}`] }, uOpacity: { value: 1 } },
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
      const plate = new Mesh(new PlaneGeometry(190, 190), mat);
      plate.renderOrder = 3;
      const ring = new Ring({ r: 90, w: 2, color: 'mist', opacity: 0.5 });
      ring.mesh.renderOrder = 3;
      const [x, z] = polar(TEMP_ANG[i], TEMP_R);
      const label = new TextSprite(name, { font: 'mono', size: 13, tracking: 0.16, color: 'paper', align: 'center' });
      const role = new TextSprite(TEMP_ROLE[i], { font: 'mono', size: 11, tracking: 0.16, color: 'signal', align: 'center' });
      this.scene.add(plate, ring.mesh);
      this.ui.add(label.mesh, role.mesh);
      this.temps.push({ plate, ring, label, role, pos: new Vector3(x, 100, z) });
    });

    this.packets = new DotField(900, { perspective: persp, core: 0.46, halo: 0.3 });
    this.packets.points.renderOrder = 3;
    this.scene.add(this.packets.points);
    const rnd = mulberry32(31);
    for (const s of this.chain) for (let k = 0; k < 26; k++) this.packetSpec.push({ rail: s, phase: rnd(), speed: 0.004 + rnd() * 0.002, chain: true });
    for (const s of this.spokes) for (let k = 0; k < 14; k++) this.packetSpec.push({ rail: s, phase: rnd(), speed: 0.005 + rnd() * 0.003, chain: false });

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

    // soft ink scrim keeps top-left captions legible over the map
    this.capScrim = new PaintSprite(1200, 620, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 900);
      g.addColorStop(0, 'rgba(0,39,43,0.95)');
      g.addColorStop(0.5, 'rgba(0,39,43,0.75)');
      g.addColorStop(1, 'rgba(0,39,43,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 1200, 620);
    });
    this.capScrim.mesh.position.set(-960 + 600, 540 - 310, 0);
    this.capScrim.mesh.renderOrder = 1;
    this.ui.add(this.capScrim.mesh);

    // captions (top-left), one idea at a time
    const cap = (inT: number, outT: number, build: (b: TextBlock) => TextBlock) =>
      this.caps.push({ block: build(new TextBlock(this.ui, -864, 396)), in: A0 + inT, out: A0 + outT });
    cap(60, 330, (b) => b.kicker('05 · ONE GOVERNED FLOW').title(['FOLLOW ONE SIGNAL', 'THROUGH THE SYSTEM.'], 60).gap(4)
      .body(['Cortex preserves and retrieves venture evidence', 'for every island, without rewriting intent.'], 19));
    cap(400, 700, (b) => b.kicker('TEMPERANCE · SIX COGNITIVE ORGANS').title(['SIX ORGANS THINK', 'AROUND THE WORK.'], 60).gap(4)
      .body(['Vestibule orients · Adytum suggests · Nutrix learns', 'Auspex reads health · Circulator digests · Praeceptor proposes'], 17));
    cap(760, 1066, (b) => b.kicker('NODE VIEW · OPS (WILL)').title(['ARC X · 9/17'], 60).gap(4)
      .body(['Will turns approved intent into accountable', 'operations — approval precedes outreach.'], 19));
    cap(1100, 1290, (b) => b.kicker('warningAttention', 'warning').title(['PROOF BLOCKED.'], 60).gap(4)
      .body(['The path fails closed when evidence is missing;', 'a reviewer opens the gate, not an animation.'], 19));
    cap(1310, 1420, (b) => b.kicker('RESOLVED').title(['PROOF COMPLETE.'], 60).gap(4)
      .body(['Evidence that can be checked, reproduced', 'and attributed.'], 19));

    // flow ladder
    this.scrim = new PaintSprite(1920, 300, (c) => {
      const g = c.createLinearGradient(0, 300, 0, 0);
      g.addColorStop(0, 'rgba(0,39,43,0.92)');
      g.addColorStop(0.55, 'rgba(0,39,43,0.7)');
      g.addColorStop(1, 'rgba(0,39,43,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 1920, 300);
    });
    this.scrim.mesh.position.set(0, -540 + 150, 0);
    this.scrim.mesh.renderOrder = 1;
    this.ui.add(this.scrim.mesh);
    const railPts: V3[] = [[LX(0), LADDER_Y, 0], [LX(5), LADDER_Y, 0]];
    this.ladderRail = new Stroke(railPts, { width: 2, color: 'mist', dash: 9, dotted: true, opacity: 0.45 });
    this.ladderTrace = new Stroke(railPts, { width: 2, color: 'signal' });
    this.ui.add(this.ladderRail.mesh, this.ladderTrace.mesh);
    STEPS.forEach(([name, desc], i) => {
      const pend = new Ring({ r: 10, w: 2.5, color: 'mist', dash: 10, dotted: true, opacity: 0.6 });
      const done = new Ring({ r: 10, w: 2.5, color: 'signal' });
      for (const r of [pend, done]) r.mesh.position.set(LX(i), LADDER_Y, 0);
      const label = new TextSprite(`0${i + 1} ${name}`, { font: 'mono', size: 13, tracking: 0.16, color: 'mist', align: 'center' });
      const d = new TextSprite(desc, { font: 'mono', size: 14, tracking: 0.02, color: 'paper', align: 'center' });
      label.at(LX(i), LADDER_Y - 30);
      d.at(LX(i), LADDER_Y - 58);
      this.ui.add(pend.mesh, done.mesh, label.mesh, d.mesh);
      this.ladderNodes.push({ pend, done, label, desc: d });
    });
    this.ladderDots = new DotField(8, { core: 0.5, halo: 0.3 });
    this.ui.add(this.ladderDots.points);
  }

  private project(v: Vector3) {
    this.tmp2.copy(v).project(this.camera);
    return { x: this.tmp2.x * 960, y: this.tmp2.y * 540 };
  }

  update(f: number) {
    const t = f - A0;
    this.capOn = 0;
    for (const c of this.caps) this.capOn = Math.max(this.capOn, e(f, c.in - 12, c.in + 8) * (1 - e(f, c.out, c.out + 20)));
    const fall = inOut(range(t, 0, 120));
    const ringView = inOut(range(t, 360, 460)) * (1 - inOut(range(t, 680, 780)));
    const selFocus = ease(range(t, 720, 820)) * (1 - ease(range(t, 1290, 1380)));
    const rise = inOut(range(t, 1380, 1440));
    const phi = (lerp(lerp(lerp(89.2, 38, fall), 54, ringView), 84, rise) * Math.PI) / 180;
    const theta = ((lerp(0, -7, fall) + 12 * inOut(range(t, 30, 1300)) - 4 + 18 * ringView) * Math.PI) / 180;
    const R = lerp(lerp(lerp(1883, 3150, fall), 5200, ringView), 1700, rise) - 700 * selFocus;
    const [ox, oz] = POS.ops;
    // the wide view sits right of centre so the top-left captions stay clear
    const tx = lerp(-330 * fall * (1 - ringView) - 420 * ringView, ox * 0.92 + 120, selFocus);
    const tz = lerp(-40 * (1 - fall) + 240 * fall * (1 - ringView) + 60 * ringView, oz * 0.92 + 60, selFocus);
    this.camera.position.set(tx + R * Math.cos(phi) * Math.sin(theta), R * Math.sin(phi), tz + R * Math.cos(phi) * Math.cos(theta));
    this.camera.up.set(0, 1, 0);
    if (phi > 1.5) this.camera.up.set(-Math.sin(theta), 0, -Math.cos(theta));
    this.camera.lookAt(tx, 0, tz);
    this.camera.updateMatrixWorld();

    const tu = this.topo.material.uniforms;
    tu.uTime.value = 7.3 + (f / 60) * 0.03;
    tu.uRippleR.value = lerp(0, 2600, ease(range(t, 0, 120)));
    tu.uRippleW.value = 160;
    tu.uGrid.value = 0.16 * rise;

    const fadeOut = 1 - ease(range(t, 1400, 1430));
    this.nodes.forEach((n, i) => {
      const [px, pz] = POS[n.id];
      const k = ease(range(t, 2 + i * 6, 100 + i * 6));
      const x = lerp(STRIP_X(i), px, k);
      const z = lerp(-40, pz, k);
      const size = lerp(300, n.size, k);
      if (n.plate) {
        n.plate.position.set(x, size * 0.12 * k, z);
        n.plate.quaternion.copy(this.camera.quaternion);
        n.plate.scale.setScalar(size / n.size);
        n.plate.material.uniforms.uOpacity.value = fadeOut;
      }
      if (n.island) {
        const s = size * 0.86 * Math.max(0.001, fadeOut);
        n.island.scale.setScalar(s);
        n.island.position.set(x, s * 0.12 * k, z);
        n.island.rotation.set(0, lerp(0.6, -0.9, range(t, 0, 1440)), 0);
        n.island.visible = fadeOut > 0.01;
      }
      const p = this.project(this.tmp.set(x, size * (n.island ? 0.22 : 0.42) * k + 10, z));
      const lOn = e(t, 90 + i * 8, 120 + i * 8) * fadeOut;
      const isWarn = n.id === 'build' && range(t, 1100, 1110) > 0.5 && t < 1300;
      n.label.color(isWarn ? 'warning' : n.id === 'ops' && t > 760 ? 'signal' : 'paper');
      const give = this.clear(p.x + 140, p.y + 30);
      n.label.at(p.x + 104, p.y + 30).reveal(lOn).opacity(lOn > 0 ? (1 - ringView * 0.75) * give : 0);
      n.leader.mesh.position.set(p.x, p.y, 0);
      n.leader.draw(lOn).opacity(0.7 * fadeOut * (1 - ringView * 0.75) * give);
    });

    this.spokes.forEach((s, i) => {
      s.draw(ease(range(t, 60 + i * 8, 160 + i * 8))).opacity(0.55 * fadeOut);
      s.u.uOffset.value = -f * 1.6;
    });
    this.chain.forEach((s, i) => {
      const d = ease(range(t, 90 + i * 20, 180 + i * 20));
      s.draw(d).opacity(fadeOut);
      this.chainBed[i].draw(d).opacity(0.75 * fadeOut);
    });
    this.outer.arc(ease(range(t, 360, 520))).opacity((0.3 + 0.2 * ringView) * fadeOut);
    this.outer.mesh.rotation.z = f * 0.0005;
    this.temps.forEach((tp, i) => {
      const on = e(t, 380 + i * 20, 420 + i * 20) * fadeOut;
      tp.plate.position.copy(tp.pos);
      tp.plate.quaternion.copy(this.camera.quaternion);
      tp.plate.scale.setScalar(lerp(0.4, 1, pop(range(t, 380 + i * 20, 420 + i * 20))));
      (tp.plate.material as ShaderMaterial).uniforms.uOpacity.value = on;
      tp.plate.visible = on > 0.01;
      tp.ring.mesh.position.copy(tp.pos);
      tp.ring.mesh.quaternion.copy(this.camera.quaternion);
      tp.ring.arc(ease(range(t, 390 + i * 20, 440 + i * 20))).opacity(0.5 * on);
      // labels sit on the outward side of the ring, away from the hub
      const p = this.project(this.tmp.copy(tp.pos));
      const hub = this.project(this.tmp.set(0, 100, 0));
      const dx = p.x - hub.x;
      const dy = p.y - hub.y;
      const dl = Math.hypot(dx, dy) || 1;
      const lx = p.x + (dx / dl) * 110;
      const ly = p.y + (dy / dl) * 92;
      const lab = e(t, 400 + i * 20, 430 + i * 20) * fadeOut;
      const give = this.clear(lx, ly);
      tp.label.at(lx, ly + 10).reveal(lab).opacity(lab * give);
      tp.role.at(lx, ly - 12).reveal(lab).opacity(lab * (0.5 + 0.5 * ringView) * give);
    });

    this.packets.begin();
    const flowOn = range(t, 120, 180) * fadeOut;
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

    // select OPS
    const sOn = 1 - ease(range(t, 1290, 1320));
    const sweep = ease(range(t, 760, 860));
    this.selTrack.arc(t >= 750 ? 1 : 0).opacity(0.4 * sOn);
    this.sel.arc(sweep).opacity(sOn);
    this.selDots.begin();
    if (sweep > 0) {
      const ang = sweep * Math.PI * 2;
      this.selDots.push(ox + Math.sin(ang) * 210, 4, oz - Math.cos(ang) * 210, 18, COL.signal, sOn);
      if (sweep >= 0.999) {
        this.selDots.push(ox, 4, oz - 210, 13, COL.signal, sOn);
        this.selDots.push(ox, 4, oz + 210, 13, COL.signal, sOn);
      }
    }
    this.selDots.end();
    const np = this.project(this.tmp.set(ox - 250, 0, oz + 40));
    const nOn = e(t, 850, 880) * sOn;
    this.nine.at(np.x, np.y).reveal(nOn).opacity(nOn > 0 ? 1 : 0);

    // warningAttention on BUILD, resolved on the next bar
    const [bx, bz] = POS.build;
    const wIn = ease(range(t, 1100, 1130));
    const wOut = ease(range(t, 1295, 1315));
    this.warnRing.arc(1).opacity(wIn * (1 - wOut) * fadeOut);
    const bn = this.nodes[2];
    const bl = this.project(this.tmp.set(bx, bn.size * 0.42 + 10, bz));
    const wp = { x: bl.x + 104 + bn.label.width + 10, y: bl.y + 30 };
    this.warnIcon.forEach((s) => {
      s.mesh.position.set(wp.x, wp.y + 4, 0);
      s.draw(wIn).opacity((1 - wOut) * fadeOut);
    });
    this.check.mesh.position.set(wp.x, wp.y + 2, 0);
    this.check.draw(ease(range(t, 1305, 1325))).opacity(range(t, 1300, 1310) * fadeOut);
    this.gate.mesh.position.set(wp.x + 124, wp.y + 2, 0);
    this.gate.reveal(ease(range(t, 1120, 1140))).opacity((1 - wOut) * fadeOut);

    // node-view panel
    const pIn = ease(range(t, 780, 830));
    const pOut = ease(range(t, 1290, 1330));
    const PX = 904 - 220 + (1 - pIn) * 520 + pOut * 520;
    const PY = 30;
    this.panel.mesh.position.set(PX, PY, 0);
    this.panel.reveal(ease(range(t, 790, 860))).opacity(pIn > 0 ? 1 : 0);
    this.panelBar.mesh.position.set(PX - 220 + 28, PY + 300 - 214, 0);
    this.panelBar.draw((9 / 17) * ease(range(t, 850, 910))).opacity(pIn);
    this.panelSel.mesh.position.set(PX, PY + 300 - rowY(3), 0);
    this.panelSel.draw(ease(range(t, 880, 930))).opacity(pIn * (1 - pOut));
    this.panelWarn.mesh.position.set(PX + 220 - 20 - 48, PY + 300 - rowY(2), 0);
    this.panelWarn.opacity(wIn * (1 - wOut) * (1 - pOut));

    for (const c of this.caps) c.block.update(f, c.in, c.out, 14);
    this.capScrim.opacity(this.capOn);

    // ladder
    const lOn = e(t, 30, 70) * (1 - e(t, 1404, 1428)) * (1 - 0.65 * ringView);
    this.scrim.opacity(lOn);
    this.ladderRail.draw(ease(range(t, 30, 90))).opacity(0.45 * lOn);
    let step = -1;
    for (let i = 0; i < 6; i++) if (t >= STEP_T[i]) step = i;
    const span = LX(5) - LX(0);
    const seg = (i: number) => (LX(i) - LX(0)) / span;
    // the ladder packet travels to the next step in the last 40 frames of each window
    let head = 0;
    if (step >= 0) {
      const next = Math.min(5, step + 1);
      const mv = ease(range(t, STEP_T[step + 1] - 40, STEP_T[step + 1]));
      head = lerp(seg(step), seg(next), step < 5 ? mv : 0);
    }
    this.ladderTrace.draw(step >= 0 ? Math.max(0.0001, head) : 0).opacity(lOn);
    this.ladderDots.begin();
    if (step >= 0) {
      for (let g = 0; g < 3; g++) {
        const x = LX(0) + (head - g * 0.012) * span;
        if (x < LX(0)) continue;
        this.ladderDots.push(x, LADDER_Y, 0, g ? 10 - g * 2 : 15, g ? COL.mist : COL.signal, lOn * (g ? 0.4 - g * 0.12 : 1));
      }
    }
    this.ladderDots.end();
    this.ladderNodes.forEach((n, i) => {
      const reached = step >= i;
      const active = step === i;
      const pop0 = pop(range(t, STEP_T[i] - 4, STEP_T[i] + 20));
      n.pend.arc(1).opacity(lOn * (reached ? 0 : 0.6));
      n.done.arc(reached ? 1 : 0).opacity(lOn);
      n.done.mesh.scale.setScalar(reached ? Math.max(0.001, pop0) * (active ? 1.25 : 1) : 0.001);
      n.label.color(active ? 'signal' : 'mist').reveal(e(t, 40 + i * 8, 70 + i * 8)).opacity(lOn * (active ? 1 : reached ? 0.7 : 0.45));
      const dOn = active ? ease(range(t, STEP_T[i] + 6, STEP_T[i] + 30)) * (1 - ease(range(t, STEP_T[i + 1] - 24, STEP_T[i + 1] - 4))) : 0;
      n.desc.reveal(dOn).opacity(lOn * (dOn > 0 ? 1 : 0));
    });
  }
}
