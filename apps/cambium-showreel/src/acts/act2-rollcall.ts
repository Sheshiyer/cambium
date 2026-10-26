// ACT 2 — ROLL-CALL (f120–299)
// One organ per beat. Genesis is the real GLB turntable; Taste, Build, Ops and
// Cortex are matted specimen plates. Each beat stacks a pop entrance, a giant
// counter-sliding name, the line-art glyph drawing on, an orbitSweep halo
// (split so its back half passes behind the object) and mono metadata.
// From f270 all five snap into the atlas-style strip.
import { Group, Mesh, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { Act, Ctx } from '../engine.ts';
import { clamp01, e, ease, inOut, lerp, pop, range } from '../lib/ease.ts';
import { Ring } from '../lib/ring.ts';
import { DotField, Stroke } from '../lib/shapes.ts';
import { PaintSprite, TextSprite } from '../lib/text.ts';
import { glyph } from '../layers/glyphs.ts';
import { lightIsland } from '../layers/islands.ts';
import { makeSpecimen, type Specimen } from '../layers/specimen.ts';
import { makeTopo, type Topo } from '../layers/topo.ts';
import { BEAT, ORGANS, ROLLCALL_START, ROLLCALL_STRIP, type OrganId } from '../timeline.ts';
import { COL, HEX } from '../tokens.ts';
import { D0 } from './act1-ignite.ts';

const STRIP_X = (i: number) => (i - 2) * 352;
const STRIP_Y = 40;
const HERO = 760; // plate size in px for the hero beat
const CELL = 300;

interface OrganRig {
  id: OrganId;
  plate?: Specimen;
  island?: Group;
  word: TextSprite;
  glyph: Stroke[];
  idx: TextSprite;
  name: TextSprite;
  meta: TextSprite;
  role: TextSprite;
  stripLabel: TextSprite;
  stripNum: TextSprite;
  frame: PaintSprite;
}

export class RollcallAct implements Act {
  id = 'rollcall';
  scene = new Scene();
  ui = new Scene();
  camera = new PerspectiveCamera(35, 16 / 9, 10, 20000);
  private topo!: Topo;
  private organs: OrganRig[] = [];
  private back!: Ring;
  private front!: Ring;
  private trackBack!: Ring;
  private trackFront!: Ring;
  private halo = new Group();
  private headDot!: DotField;
  private index: TextSprite[] = [];
  private indexTick!: Stroke;
  private islandScene = new Scene();

  async init(ctx: Ctx) {
    this.topo = makeTopo({ w: 6000, h: 3600 });
    this.scene.add(this.topo);
    const island = (ctx.assets.island as Group).clone();
    lightIsland(this.scene, ctx.renderer);
    void this.islandScene;

    // halo: a ring lying on a tilted plane; back half renders before the object
    this.trackBack = new Ring({ r: 470, w: 3.2, color: 'mist', dash: 120, dotted: true, opacity: 0.34 });
    this.trackFront = new Ring({ r: 470, w: 3.2, color: 'mist', dash: 120, dotted: true, opacity: 0.34 });
    this.back = new Ring({ r: 470, w: 3, color: 'signal' });
    this.front = new Ring({ r: 470, w: 3, color: 'signal' });
    this.back.u.uHead.value = 1;
    this.front.u.uHead.value = 1;
    this.trackBack.clip(0.75, 0.25);
    this.back.clip(0.75, 0.25);
    this.trackFront.clip(0.25, 0.75);
    this.front.clip(0.25, 0.75);
    this.trackBack.mesh.renderOrder = 2;
    this.back.mesh.renderOrder = 2;
    this.trackFront.mesh.renderOrder = 8;
    this.front.mesh.renderOrder = 8;
    this.halo.add(this.trackBack.mesh, this.back.mesh, this.trackFront.mesh, this.front.mesh);
    this.halo.rotation.x = -1.18;
    this.scene.add(this.halo);
    const persp = 1080 / (2 * Math.tan((35 * Math.PI) / 360));
    this.headDot = new DotField(8, { perspective: persp, core: 0.5, halo: 0.32 });
    this.headDot.points.renderOrder = 9;
    this.scene.add(this.headDot.points);

    for (const o of ORGANS) {
      const rig: OrganRig = {
        id: o.id,
        word: new TextSprite(o.label, { font: 'display', size: 560, tracking: -0.01, color: 'mist', align: 'center', oversample: 1 }),
        glyph: glyph(o.id).map((pts) => new Stroke(pts.map(([x, y]) => [x * 54, y * 54, 0]), { width: 2, color: 'mist' })),
        idx: new TextSprite(`0${ORGANS.indexOf(o) + 1}`, { font: 'display', size: 150, color: 'signal' }),
        name: new TextSprite(o.label, { font: 'display', size: 96, tracking: 0.01, color: 'paper' }),
        meta: new TextSprite(`ID 0${ORGANS.indexOf(o) + 1}/17 · TYPE ORGAN · STATUS ACTIVE`, { font: 'mono', size: 15, tracking: 0.12, color: 'mist' }),
        role: new TextSprite(o.role, { font: 'mono', size: 15, tracking: 0.08, color: 'signal' }),
        stripLabel: new TextSprite(o.label, { font: 'display', size: 34, tracking: 0.06, color: 'paper', align: 'center' }),
        stripNum: new TextSprite(`0${ORGANS.indexOf(o) + 1}`, { font: 'mono', size: 13, tracking: 0.14, color: 'mist', align: 'center' }),
        frame: new PaintSprite(CELL + 24, CELL + 72, (c) => {
          c.strokeStyle = HEX.mist;
          c.globalAlpha = 0.22;
          c.lineWidth = 1;
          const r = 8;
          const w = CELL + 23;
          const h = CELL + 71;
          c.beginPath();
          c.roundRect(0.5, 0.5, w, h, r);
          c.stroke();
          c.globalAlpha = 0.5;
          c.fillStyle = HEX.signal;
          c.fillRect(0.5 + 12, 0.5, 24, 2);
        }),
      };
      if (o.id === 'genesis') {
        rig.island = island;
        this.scene.add(island);
      } else {
        rig.plate = makeSpecimen(ctx.tex[`m:${o.id}`], HERO);
        this.scene.add(rig.plate);
      }
      rig.word.mesh.renderOrder = 1;
      this.scene.add(rig.word.mesh);
      for (const s of rig.glyph) this.ui.add(s.mesh);
      this.ui.add(rig.idx.mesh, rig.name.mesh, rig.meta.mesh, rig.role.mesh, rig.stripLabel.mesh, rig.stripNum.mesh, rig.frame.mesh);
      this.organs.push(rig);
    }
    ORGANS.forEach((o, i) => {
      const t = new TextSprite(`0${i + 1} ${o.label}`, { font: 'mono', size: 13, tracking: 0.14, color: 'mist' });
      this.index.push(t);
      this.ui.add(t.mesh);
    });
    this.indexTick = new Stroke([[0, 0, 0], [18, 0, 0]], { width: 2, color: 'signal' });
    this.ui.add(this.indexTick.mesh);
  }

  update(f: number, variant: number) {
    const strip = f >= ROLLCALL_STRIP;
    const cur = strip ? 4 : Math.min(4, variant);
    const t0 = ROLLCALL_START + cur * BEAT;
    const t = f - t0; // local beat time (may be slightly negative/over during wipes)
    const st = range(f, ROLLCALL_STRIP, ROLLCALL_STRIP + 20); // strip progress

    this.camera.position.set(0, 0, D0);
    this.camera.lookAt(0, 0, 0);
    const u = this.topo.material.uniforms;
    u.uTime.value = 5.1 + f / 60 * 0.05 + cur * 0.9;
    u.uAlpha.value = 0.16;
    u.uRippleR.value = -1e4;
    u.uRippleW.value = 1;

    // ---- halo (orbitSweep) around the hero object
    const sweep = ease(range(t, 2, 26));
    const haloOn = (1 - st) * clamp01((t + 4) / 4);
    const haloR = 470 * lerp(1.08, 1, ease(range(t, 0, 16)));
    for (const r of [this.trackBack, this.trackFront]) r.radius(haloR, 3.2).arc(1).opacity(0.34 * haloOn);
    for (const r of [this.back, this.front]) r.radius(haloR, 3).arc(sweep).opacity(haloOn);
    this.halo.position.set(0, -150, 0);
    this.halo.rotation.z = -t * 0.004;
    // head dot rides the leading edge of the arc
    this.headDot.begin();
    if (sweep > 0.002 && haloOn > 0) {
      const a = sweep * Math.PI * 2;
      this.halo.updateMatrixWorld();
      const p = new Vector3(Math.sin(a) * haloR, Math.cos(a) * haloR, 0).applyMatrix4(this.halo.matrixWorld);
      this.headDot.push(p.x, p.y, p.z, 15, COL.signal, haloOn);
      if (sweep >= 0.999) {
        // complete: glow dots at top & bottom (motion spec, strip 3 F3)
        for (const ang of [0, Math.PI]) {
          const q = p.set(Math.sin(ang) * haloR, Math.cos(ang) * haloR, 0).applyMatrix4(this.halo.matrixWorld);
          this.headDot.push(q.x, q.y, q.z, 11, COL.signal, haloOn * 0.9);
        }
      }
    }
    this.headDot.end();

    // ---- organs
    this.organs.forEach((o, i) => {
      const isCur = i === cur && !strip;
      // strip entrance: current shrinks into its cell, others pop in staggered
      const k = i === 4 ? ease(range(f, ROLLCALL_STRIP, ROLLCALL_STRIP + 16)) : pop(range(f, ROLLCALL_STRIP + 4 + i * 2, ROLLCALL_STRIP + 18 + i * 2));
      const inStrip = strip ? k : 0;
      const ent = pop(range(t, 0, 16));
      const heroScale = lerp(1.2, 1, ent) * (1 + 0.035 * range(t, 0, 34));
      const vis = strip ? (i === 4 ? 1 : clamp01(k * 3)) : isCur ? 1 : 0;
      const sx = strip ? lerp(i === 4 ? 0 : STRIP_X(i), STRIP_X(i), i === 4 ? k : 1) : 0;
      const sy = strip ? lerp(i === 4 ? -30 : STRIP_Y, STRIP_Y, i === 4 ? k : 1) : lerp(-60, -30, ent);
      const size = strip ? lerp(i === 4 ? HERO : CELL * 0.4, CELL, i === 4 ? k : inStrip) : HERO * heroScale;
      const drift = strip ? 0 : Math.sin((t + i * 13) / 22) * 0.012;

      if (o.plate) {
        const m = o.plate.material.uniforms;
        o.plate.visible = vis > 0.001;
        o.plate.position.set(sx, sy, 0);
        o.plate.scale.setScalar(size / HERO);
        o.plate.rotation.set(0, strip ? 0 : lerp(0.16, -0.08, inOut(range(t, 0, 34))), drift);
        m.uOpacity.value = vis;
        m.uWipe.value = strip && i !== 4 ? 1 : 1;
        m.uDim.value = 0;
      }
      if (o.island) {
        o.island.visible = vis > 0.001;
        const s = size * (strip ? 0.86 : 0.7);
        o.island.scale.setScalar(s);
        o.island.position.set(sx, sy + (strip ? 0 : 40), 0);
        o.island.rotation.set(lerp(0.52, 0.46, range(t, 0, 30)), lerp(-0.9, 0.15, inOut(range(t, -2, 34))) + (strip ? 0.6 : 0), 0);
      }

      // giant counter-sliding name behind the object
      const wOn = isCur ? clamp01((t + 2) / 5) * (1 - range(t, 28, 34)) : 0;
      o.word.at(lerp(160, -160, range(t, -4, 34)), 30, -40).opacity(wOn * 0.024);

      // glyph line-art (top-left), draws on
      o.glyph.forEach((s, gi) => {
        s.mesh.position.set(-800, 300, 0);
        s.draw(isCur ? ease(range(t, 2 + gi * 3, 18 + gi * 3)) : 0).opacity(isCur ? 0.8 : 0);
      });

      // mono metadata block (bottom-left)
      const on = isCur ? 1 : 0;
      o.idx.at(-864, -300).rise(on ? -(1 - ease(range(t, 0, 10))) : 0).opacity(on);
      o.name.at(-700, -312).reveal(ease(range(t, 3, 14))).opacity(on);
      o.meta.at(-864, -388).reveal(ease(range(t, 6, 20))).opacity(on * 0.75);
      o.role.at(-864, -416).reveal(ease(range(t, 9, 24))).opacity(on);

      // strip labels + cell frames
      const lab = strip ? e(f, ROLLCALL_STRIP + 8 + i * 2, ROLLCALL_STRIP + 20 + i * 2) : 0;
      o.stripLabel.at(STRIP_X(i), STRIP_Y - CELL / 2 - 26).reveal(lab).opacity(lab > 0 ? 1 : 0);
      o.stripNum.at(STRIP_X(i), STRIP_Y + CELL / 2 + 6).reveal(lab).opacity(lab > 0 ? 0.7 : 0);
      o.frame.mesh.position.set(STRIP_X(i), STRIP_Y - 24, 0);
      o.frame.reveal(strip ? e(f, ROLLCALL_STRIP + 2 + i * 2, ROLLCALL_STRIP + 16 + i * 2) : 0).opacity(strip ? 1 : 0);
    });

    // right-hand organ index
    this.index.forEach((s, i) => {
      const active = i === cur;
      s.color(active ? 'signal' : 'mist').at(760, 120 - i * 28).opacity(strip ? 1 - st : active ? 1 : 0.32);
    });
    this.indexTick.mesh.position.set(734, 125 - cur * 28, 0);
    this.indexTick.draw(1).opacity(strip ? 1 - st : 1);
  }
}
