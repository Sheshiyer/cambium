// LONG 01 — IGNITE (bars 1–4, f0–719)
// The seed packet ignites, contours ripple out, and the definition of the word
// lands; then the packet fissions into the branching network while the claim
// "this is that layer for business" rises over it.
import { Color, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { Act, Ctx } from '../../../engine.ts';
import { bump, e, ease, easeIn, expoOut, lerp, pop, range } from '../../../lib/ease.ts';
import { Ring } from '../../../lib/ring.ts';
import { mulberry32 } from '../../../lib/rng.ts';
import { DotField, Stroke, smoothPath, type V3 } from '../../../lib/shapes.ts';
import { TextSprite } from '../../../lib/text.ts';
import { TextBlock } from '../../../lib/textblock.ts';
import { makeTopo, type Topo } from '../../../layers/topo.ts';
import { COL } from '../../../tokens.ts';
import { D0 } from '../../../acts/act1-ignite.ts';

const ANGLES = [-162, -104, -24, 36, 118];
const FS = 330; // fission
const HEAD = 210; // frames for a packet to cross the frame

export class LongIgnite implements Act {
  id = 'l-ignite';
  scene = new Scene();
  ui = new Scene();
  camera = new PerspectiveCamera(35, 16 / 9, 10, 20000);
  private topo!: Topo;
  private core!: DotField;
  private packets!: DotField;
  private sparks!: DotField;
  private dust!: DotField;
  private nodes!: DotField;
  private rings: Ring[] = [];
  private routes: Stroke[] = [];
  private traces: Stroke[] = [];
  private branches: { route: Stroke; trace: Stroke; f0: number; at: Vector3 }[] = [];
  private spark: { a: number; d: number; s: number; c: Color }[] = [];
  private dustPts: { p: Vector3; s: number; a: number }[] = [];
  private note!: TextSprite;
  private note2!: TextSprite;
  private leader!: Stroke;
  private define!: TextBlock;
  private claim!: TextBlock;
  private tmp = new Vector3();

  init(_ctx: Ctx) {
    this.topo = makeTopo({ w: 6000, h: 3600 });
    this.scene.add(this.topo);
    for (let k = 0; k < 3; k++) {
      const r = new Ring({ r: 10, w: k === 0 ? 2.5 : 1.5, color: k === 0 ? 'signal' : 'mist' });
      this.rings.push(r);
      this.scene.add(r.mesh);
    }
    ANGLES.forEach((deg, i) => {
      const a = (deg * Math.PI) / 180;
      const bend = (i % 2 ? 1 : -1) * 0.38;
      const ctrl: V3[] = [
        [0, 0, 0],
        [Math.cos(a + bend) * 200, Math.sin(a + bend) * 200, 0],
        [Math.cos(a - bend * 0.6) * 620, Math.sin(a - bend * 0.6) * 620, 0],
        [Math.cos(a + bend * 0.2) * 1150, Math.sin(a + bend * 0.2) * 1150, 0],
        [Math.cos(a) * 1900, Math.sin(a) * 1900, 0],
      ];
      const pts = smoothPath(ctrl, 220);
      const route = new Stroke(pts, { width: 3.2, color: 'mist', dash: 11, dotted: true, opacity: 0.5 });
      const trace = new Stroke(pts, { width: 3, color: 'signal' });
      trace.u.uHead.value = 1;
      this.routes.push(route);
      this.traces.push(trace);
      this.scene.add(route.mesh, trace.mesh);
      const h0 = FS + 20 + i * 14;
      [0.3, 0.55].forEach((ub, b) => {
        const P = trace.pointAt(ub).clone();
        const Q = trace.pointAt(ub + 0.01).clone();
        const ta = Math.atan2(Q.y - P.y, Q.x - P.x);
        const side = (i + b) % 2 ? 1 : -1;
        const a0 = ta + side * (0.62 + b * 0.18);
        const len = 520 + b * 240;
        const bp = smoothPath(
          [
            [P.x, P.y, 0],
            [P.x + Math.cos(a0) * len * 0.3, P.y + Math.sin(a0) * len * 0.3, 0],
            [P.x + Math.cos(a0 - side * 0.3) * len * 0.65, P.y + Math.sin(a0 - side * 0.3) * len * 0.65, 0],
            [P.x + Math.cos(a0 - side * 0.5) * len, P.y + Math.sin(a0 - side * 0.5) * len, 0],
          ],
          90,
        );
        const br = new Stroke(bp, { width: 2.6, color: 'mist', dash: 10, dotted: true, opacity: 0.4 });
        const bt = new Stroke(bp, { width: 2, color: 'signal' });
        bt.u.uHead.value = 1;
        this.branches.push({ route: br, trace: bt, f0: h0 + HEAD * Math.pow(ub, 1 / 1.3), at: P });
        this.scene.add(br.mesh, bt.mesh);
      });
    });

    const persp = 1080 / (2 * Math.tan((35 * Math.PI) / 360));
    this.core = new DotField(4, { perspective: persp, core: 0.5, halo: 0.34 });
    this.packets = new DotField(64, { perspective: persp, core: 0.46, halo: 0.3 });
    this.sparks = new DotField(96, { perspective: persp, core: 0.6, halo: 0.2 });
    this.dust = new DotField(320, { perspective: persp, core: 0.7, halo: 0.0 });
    this.nodes = new DotField(16, { perspective: persp, core: 0.55, halo: 0.2 });
    this.scene.add(this.dust.points, this.sparks.points, this.nodes.points, this.packets.points, this.core.points);
    const rnd = mulberry32(7);
    for (let i = 0; i < 72; i++) {
      this.spark.push({ a: rnd() * Math.PI * 2, d: 160 + rnd() * 520, s: 2.5 + rnd() * 4, c: rnd() < 0.35 ? COL.signal : COL.mist });
    }
    for (let i = 0; i < 300; i++) {
      this.dustPts.push({ p: new Vector3((rnd() - 0.5) * 3000, (rnd() - 0.5) * 1800, -900 + rnd() * 1300), s: 2 + rnd() * 3.5, a: 0.08 + rnd() * 0.3 });
    }

    this.leader = new Stroke([[14, 14, 0], [70, 70, 0], [250, 70, 0]], { width: 1.25, color: 'mist', opacity: 0.6 });
    this.note = new TextSprite('SEED PACKET', { font: 'mono', size: 15, tracking: 0.14, color: 'paper' });
    this.note2 = new TextSprite('ID 00/17 · TYPE GENESIS · STATUS ACTIVE', { font: 'mono', size: 12, tracking: 0.1, color: 'mist' });
    this.scene.add(this.leader.mesh, this.note.mesh, this.note2.mesh);

    // README: "In a tree, the cambium is the thin living layer where all growth happens."
    this.define = new TextBlock(this.ui, 0, -250, { align: 'center' })
      .kicker('CAMBIUM · NOUN · BOTANY', 'signal', 15)
      .gap(6)
      .body(['In a tree, the cambium is the thin living layer', 'where all growth happens.'], 30, 'paper', 0.95);
    this.claim = new TextBlock(this.ui, -864, 250)
      .rule(64)
      .kicker('THE GROWTH LAYER')
      .title(['THIS IS THAT LAYER', 'FOR BUSINESS.'], 128);
  }

  update(f: number) {
    const push = ease(range(f, 0, 700)) * 0.14 + easeIn(range(f, 640, 734)) * 0.18;
    this.camera.position.set(Math.sin(f / 120) * 22, Math.cos(f / 160) * 12 - 8, D0 * (1 - push));
    this.camera.lookAt(0, 0, 0);
    this.camera.rotation.z = Math.sin(f / 140) * 0.006;

    const rip = expoOut(range(f, 30, 330));
    const u = this.topo.material.uniforms;
    u.uTime.value = 2.4 + (f / 60) * 0.035;
    u.uRippleR.value = rip * 1900;
    u.uRippleW.value = 70 + rip * 70;
    u.uReveal.value = f < 30 ? 0 : rip * 1900;
    u.uRevealSoft.value = 420;

    this.rings.forEach((r, k) => {
      const t = range(f, 24 + k * 16, 170 + k * 26);
      r.radius(8 + expoOut(t) * (420 + k * 260), k === 0 ? 2.5 : 1.5).arc(1).opacity((1 - t) * (k === 0 ? 0.85 : 0.4));
      r.mesh.position.z = 1;
    });

    // core packet: slow pop, glyphBreathe while it waits to divide
    const ign = pop(range(f, 20, 64));
    const breathe = 1 + 0.035 * Math.sin((f / 60) * ((Math.PI * 2) / 3.4) * 2);
    const fiss = range(f, FS - 10, FS + 20);
    const coreSize = (ign * 34 + bump(f, 20, 50) * 26) * breathe * lerp(1, 0.55, fiss);
    this.core.begin().push(0, 0, 2, coreSize, COL.signal, f < 20 ? 0 : 1).end();

    this.sparks.begin();
    const st = range(f, 24, 150);
    if (st > 0 && st < 1) {
      for (const s of this.spark) {
        const d = expoOut(st) * s.d;
        this.sparks.push(Math.cos(s.a) * d, Math.sin(s.a) * d, 2, s.s * (1 - st * 0.6), s.c, (1 - st) * 0.9);
      }
    }
    this.sparks.end();

    this.packets.begin();
    this.routes.forEach((route, i) => {
      const s0 = FS - 20 + i * 6;
      route.draw(ease(range(f, s0, s0 + 60))).opacity(0.42 * (1 - range(f, 660, 720) * 0.4));
      const h0 = FS + 20 + i * 14;
      const head = Math.pow(range(f, h0, h0 + HEAD), 1.3);
      const trace = this.traces[i];
      trace.draw(head).opacity(head > 0 ? 1 : 0);
      if (head > 0 && head < 1) {
        for (let g = 0; g < 4; g++) {
          const uu = head - g * 0.012;
          if (uu <= 0) continue;
          trace.pointAt(uu, this.tmp);
          this.packets.push(this.tmp.x, this.tmp.y, 3, g === 0 ? 17 : 12 - g * 2, g === 0 ? COL.signal : COL.mist, g === 0 ? 1 : 0.42 - g * 0.1);
        }
      }
    });
    this.nodes.begin();
    for (const b of this.branches) {
      const on = range(f, b.f0 - 4, b.f0 + 16);
      b.route.draw(ease(range(f, b.f0 - 4, b.f0 + 40))).opacity(0.34 * on);
      const head = Math.pow(range(f, b.f0 + 6, b.f0 + 150), 1.2);
      b.trace.draw(head).opacity(head > 0 ? 0.85 : 0);
      if (head > 0 && head < 1) {
        for (let g = 0; g < 3; g++) {
          const uu = head - g * 0.02;
          if (uu <= 0) continue;
          b.trace.pointAt(uu, this.tmp);
          this.packets.push(this.tmp.x, this.tmp.y, 3, g === 0 ? 12 : 9 - g * 2, g === 0 ? COL.signal : COL.mist, g === 0 ? 0.95 : 0.4 - g * 0.12);
        }
      }
      if (on > 0) this.nodes.push(b.at.x, b.at.y, 2, 10 * pop(on), COL.mist, 0.85);
    }
    this.nodes.end();
    this.packets.end();

    this.dust.begin();
    for (const d of this.dustPts) {
      this.dust.push(d.p.x + Math.sin(f / 150 + d.p.z) * 10, d.p.y + f * 0.12, d.p.z, d.s, COL.mist, d.a * e(f, 0, 90));
    }
    this.dust.end();

    const nIn = e(f, 70, 100);
    const nOut = 1 - e(f, 290, 310);
    this.leader.draw(nIn).opacity(0.6 * nOut);
    this.note.at(86, 92, 1).reveal(e(f, 78, 104)).opacity(nOut);
    this.note2.at(86, 52, 1).reveal(e(f, 84, 112)).opacity(nOut * 0.8);

    this.define.update(f, 105, 315, 22);
    this.claim.update(f, 450, 690, 22);
  }
}
