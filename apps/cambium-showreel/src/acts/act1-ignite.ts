// ACT 1 — IGNITE (f0–119)
// A single signal packet ignites in the void; the contour field ripples out of
// it; the packet fissions into five that trace dotted (pending) routes and
// leave them solid chartreuse (settled).
import { Color, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { Act, Ctx } from '../engine.ts';
import { bump, e, ease, easeIn, expoOut, lerp, pop, range } from '../lib/ease.ts';
import { Ring } from '../lib/ring.ts';
import { mulberry32 } from '../lib/rng.ts';
import { DotField, Stroke, smoothPath, type V3 } from '../lib/shapes.ts';
import { TextSprite } from '../lib/text.ts';
import { makeTopo, type Topo } from '../layers/topo.ts';
import { COL } from '../tokens.ts';

export const D0 = 1712.6; // camera distance where 1 world unit = 1 px at z=0 (fov 35)

const ANGLES = [-162, -104, -24, 36, 118];

export class IgniteAct implements Act {
  id = 'ignite';
  scene = new Scene();
  ui = new Scene();
  camera = new PerspectiveCamera(35, 16 / 9, 10, 20000);
  private topo!: Topo;
  private core!: DotField;
  private packets!: DotField;
  private sparks!: DotField;
  private dust!: DotField;
  private rings: Ring[] = [];
  private routes: Stroke[] = [];
  private traces: Stroke[] = [];
  // secondary branches: the vascular network cambium grows
  private branches: { route: Stroke; trace: Stroke; f0: number; at: Vector3 }[] = [];
  private nodes!: DotField;
  private flare!: DotField;
  private spark: { a: number; d: number; s: number; c: Color }[] = [];
  private dustPts: { p: Vector3; s: number; a: number }[] = [];
  private note!: TextSprite;
  private note2!: TextSprite;
  private leader!: Stroke;
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
      // two branches per rail, alternating sides, spawned as the head passes
      const h0 = 60 + i * 4;
      [0.3, 0.55].forEach((ub, b) => {
        const P = trace.pointAt(ub).clone();
        const Q = trace.pointAt(ub + 0.01).clone();
        const ta = Math.atan2(Q.y - P.y, Q.x - P.x);
        const side = (i + b) % 2 ? 1 : -1;
        const a0 = ta + side * (0.62 + b * 0.18);
        const len = 520 + b * 240;
        const bc: V3[] = [
          [P.x, P.y, 0],
          [P.x + Math.cos(a0) * len * 0.3, P.y + Math.sin(a0) * len * 0.3, 0],
          [P.x + Math.cos(a0 - side * 0.3) * len * 0.65, P.y + Math.sin(a0 - side * 0.3) * len * 0.65, 0],
          [P.x + Math.cos(a0 - side * 0.5) * len, P.y + Math.sin(a0 - side * 0.5) * len, 0],
        ];
        const bp = smoothPath(bc, 90);
        const br = new Stroke(bp, { width: 2.6, color: 'mist', dash: 10, dotted: true, opacity: 0.4 });
        const bt = new Stroke(bp, { width: 2, color: 'signal' });
        bt.u.uHead.value = 1;
        const f0 = h0 + 54 * Math.pow(ub, 1 / 1.35);
        this.branches.push({ route: br, trace: bt, f0, at: P });
        this.scene.add(br.mesh, bt.mesh);
      });
    });

    const persp = 1080 / (2 * Math.tan((35 * Math.PI) / 360));
    this.core = new DotField(4, { perspective: persp, core: 0.5, halo: 0.34 });
    this.packets = new DotField(64, { perspective: persp, core: 0.46, halo: 0.3 });
    this.sparks = new DotField(96, { perspective: persp, core: 0.6, halo: 0.2 });
    this.dust = new DotField(320, { perspective: persp, core: 0.7, halo: 0.0 });
    this.nodes = new DotField(16, { perspective: persp, core: 0.55, halo: 0.2 });
    this.flare = new DotField(2, { perspective: persp, core: 0.08, halo: 0.34 });
    this.scene.add(this.dust.points, this.sparks.points, this.nodes.points, this.packets.points, this.flare.points, this.core.points);

    const rnd = mulberry32(7);
    for (let i = 0; i < 72; i++) {
      this.spark.push({
        a: rnd() * Math.PI * 2,
        d: 160 + rnd() * 520,
        s: 2.5 + rnd() * 4,
        c: rnd() < 0.35 ? COL.signal : COL.mist,
      });
    }
    for (let i = 0; i < 300; i++) {
      this.dustPts.push({
        p: new Vector3((rnd() - 0.5) * 3000, (rnd() - 0.5) * 1800, -900 + rnd() * 1300),
        s: 2 + rnd() * 3.5,
        a: 0.08 + rnd() * 0.3,
      });
    }

    this.leader = new Stroke(
      [
        [14, 14, 0],
        [70, 70, 0],
        [250, 70, 0],
      ],
      { width: 1.25, color: 'mist', opacity: 0.6 },
    );
    this.note = new TextSprite('SEED PACKET', { font: 'mono', size: 15, tracking: 0.14, color: 'paper' });
    this.note2 = new TextSprite('ID 00/17 · TYPE GENESIS · STATUS ACTIVE', { font: 'mono', size: 12, tracking: 0.1, color: 'mist' });
    this.scene.add(this.leader.mesh, this.note.mesh, this.note2.mesh);
  }

  update(f: number) {
    // camera: slow dolly in, then a committed push into the cut
    const push = ease(range(f, 0, 116)) * 0.12 + easeIn(range(f, 96, 124)) * 0.2;
    this.camera.position.set(Math.sin(f / 60) * 18, Math.cos(f / 80) * 10 - 8, D0 * (1 - push));
    this.camera.lookAt(0, 0, 0);
    this.camera.rotation.z = Math.sin(f / 70) * 0.006;

    // contour field ripples out of the ignition
    const rip = expoOut(range(f, 8, 104));
    const u = this.topo.material.uniforms;
    u.uTime.value = 2.4 + f / 60 * 0.05;
    u.uRippleR.value = rip * 1900;
    u.uRippleW.value = 70 + rip * 60;
    u.uReveal.value = f < 8 ? 0 : rip * 1900;
    u.uRevealSoft.value = 420;

    // ignition rings
    this.rings.forEach((r, k) => {
      const t = range(f, 6 + k * 7, 70 + k * 12);
      const rad = 8 + expoOut(t) * (420 + k * 260);
      r.radius(rad, k === 0 ? 2.5 : 1.5).arc(1).opacity((1 - t) * (k === 0 ? 0.85 : 0.4));
      r.mesh.position.z = 1;
    });

    // core packet: pop + glyphBreathe
    const ign = pop(range(f, 4, 24));
    const breathe = 1 + 0.035 * Math.sin((f / 60) * ((Math.PI * 2) / 3.4) * 3);
    const fiss = range(f, 56, 66);
    const coreSize = (ign * 34 + bump(f, 4, 16) * 26) * breathe * lerp(1, 0.55, fiss);
    this.core.begin().push(0, 0, 2, coreSize, COL.signal, f < 4 ? 0 : 1).end();
    // ignition flare: a wide, low-alpha tinted bloom inside the brand cap (<= .35)
    const fl = range(f, 4, 40);
    this.flare.begin().push(0, 0, 1, 40 + expoOut(fl) * 70, COL.signal, f < 4 ? 0 : (1 - fl) * 0.5).end();

    // sparks burst
    this.sparks.begin();
    const st = range(f, 6, 58);
    if (st > 0 && st < 1) {
      for (const s of this.spark) {
        const d = expoOut(st) * s.d;
        this.sparks.push(Math.cos(s.a) * d, Math.sin(s.a) * d, 2, s.s * (1 - st * 0.6), s.c, (1 - st) * 0.9);
      }
    }
    this.sparks.end();

    // fission: pending routes appear dotted, packets trace them solid
    this.packets.begin();
    this.routes.forEach((route, i) => {
      const s0 = 50 + i * 2;
      route.draw(ease(range(f, s0, s0 + 22))).opacity(0.42 * (1 - range(f, 104, 120) * 0.4));
      const h0 = 60 + i * 4;
      const head = Math.pow(range(f, h0, h0 + 54), 1.35);
      const trace = this.traces[i];
      trace.draw(head).opacity(head > 0 ? 1 : 0);
      if (head > 0 && head < 1) {
        // packet + ghosted positions (motion shown with ghosts, never blur)
        for (let g = 0; g < 4; g++) {
          const uu = head - g * 0.018;
          if (uu <= 0) continue;
          trace.pointAt(uu, this.tmp);
          this.packets.push(this.tmp.x, this.tmp.y, 3, g === 0 ? 17 : 12 - g * 2, g === 0 ? COL.signal : COL.mist, g === 0 ? 1 : 0.42 - g * 0.1);
        }
      }
    });
    // branches: pending dotted route, then a settled trace with its packet
    this.nodes.begin();
    for (const b of this.branches) {
      const on = range(f, b.f0 - 2, b.f0 + 8);
      b.route.draw(ease(range(f, b.f0 - 2, b.f0 + 14))).opacity(0.34 * on);
      const head = Math.pow(range(f, b.f0 + 2, b.f0 + 44), 1.2);
      b.trace.draw(head).opacity(head > 0 ? 0.85 : 0);
      if (head > 0 && head < 1) {
        for (let g = 0; g < 3; g++) {
          const uu = head - g * 0.03;
          if (uu <= 0) continue;
          b.trace.pointAt(uu, this.tmp);
          this.packets.push(this.tmp.x, this.tmp.y, 3, g === 0 ? 12 : 9 - g * 2, g === 0 ? COL.signal : COL.mist, g === 0 ? 0.95 : 0.4 - g * 0.12);
        }
      }
      if (on > 0) this.nodes.push(b.at.x, b.at.y, 2, 10 * pop(on), COL.mist, 0.85);
    }
    this.nodes.end();
    this.packets.end();

    // parallax dust
    this.dust.begin();
    for (const d of this.dustPts) {
      this.dust.push(d.p.x + Math.sin(f / 90 + d.p.z) * 8, d.p.y + f * 0.25, d.p.z, d.s, COL.mist, d.a * e(f, 0, 30));
    }
    this.dust.end();

    // annotation: board-style node callout
    const nIn = e(f, 18, 34);
    const nOut = 1 - e(f, 54, 62);
    this.leader.draw(nIn).opacity(0.6 * nOut);
    this.note.at(86, 92, 1).reveal(e(f, 24, 40)).opacity(nOut);
    this.note2.at(86, 52, 1).reveal(e(f, 28, 46)).opacity(nOut * 0.8);
  }
}
