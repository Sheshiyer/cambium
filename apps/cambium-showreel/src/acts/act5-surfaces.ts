// ACT 5 — SURFACES (f630–749)
// A z-space dolly with three eased stops through the product surfaces:
// Telegram Mini App (Mission Control + Commands), the Organ Console views
// with paper blueprint cards flipping past, then a pull-back reveal of the
// Cambium Design System board. The iris into Act 6 collapses it to a point.
import { Mesh, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { Act, Ctx } from '../engine.ts';
import { e, ease, inOut, lerp, range } from '../lib/ease.ts';
import { PaintSprite, TextSprite } from '../lib/text.ts';
import { Stroke } from '../lib/shapes.ts';
import { makeSpecimen, type Specimen } from '../layers/specimen.ts';
import { makeTopo, type Topo } from '../layers/topo.ts';
import { HEX } from '../tokens.ts';
import { D0 } from './act1-ignite.ts';

const A0 = 630;

interface Plane {
  mesh: Specimen;
  base: Vector3;
  rot: [number, number, number];
  wipe?: [number, number];
}

const STOPS = [
  { kicker: 'SURFACE 01 · TELEGRAM MINI APP', title: 'MISSION CONTROL', at: 0 },
  { kicker: 'SURFACE 02 · ORGAN CONSOLE', title: 'WORK · RECEIPTS', at: 40 },
  { kicker: 'SURFACE 03 · v1.0.0', title: 'DESIGN SYSTEM', at: 78 },
];

export class SurfacesAct implements Act {
  id = 'surfaces';
  scene = new Scene();
  ui = new Scene();
  camera = new PerspectiveCamera(35, 16 / 9, 10, 40000);
  private topo!: Topo;
  private planes: Plane[] = [];
  private bezel!: PaintSprite;
  private bezel2!: PaintSprite;
  private cards: { mesh: Specimen; x: number; y: number; z: number; t: number }[] = [];
  private kickers: TextSprite[] = [];
  private titles: TextSprite[] = [];
  private rule!: Stroke;
  private tmp = new Vector3();

  init(ctx: Ctx) {
    // contour backdrop rides with the camera so it always fills the frame
    this.topo = makeTopo({ w: 2400, h: 1400 });
    this.topo.position.set(0, 0, -D0);
    this.topo.material.uniforms.uAlpha.value = 0.12;
    this.camera.add(this.topo);
    this.scene.add(this.camera);

    const add = (key: string, w: number, h: number, pos: [number, number, number], rot: [number, number, number], wipe?: [number, number], fromTop = true) => {
      const m = makeSpecimen(ctx.tex[key], w, h);
      const u = m.material.uniforms;
      u.uGrade.value = 0;
      u.uBright.value = 1;
      u.uFromTop.value = fromTop ? 1 : 0;
      this.scene.add(m);
      const p: Plane = { mesh: m, base: new Vector3(...pos), rot, wipe };
      this.planes.push(p);
      return p;
    };

    // stop 1 — phones
    this.bezel = new PaintSprite(472, 952, (c) => phoneBezel(c, 472, 952));
    this.bezel.mesh.position.set(0, 0, -2);
    this.bezel2 = new PaintSprite(452, 950, (c) => phoneBezel(c, 452, 950));
    this.bezel.mesh.renderOrder = 4;
    this.bezel2.mesh.renderOrder = 4;
    this.scene.add(this.bezel.mesh, this.bezel2.mesh);
    add('s:mission', 430, 910, [0, 0, 0], [0, 0, 0], [2, 30]);
    add('s:commands', 410, 888, [600, -30, -520], [0, -0.42, 0], [10, 34]);

    // stop 2 — Organ Console views
    add('s:work', 900, 600, [-500, 40, -2600], [0, 0.3, 0], [38, 58]);
    add('s:receipts', 900, 600, [520, 40, -2700], [0, -0.3, 0], [44, 64]);

    // blueprint cards (paper line art) flip past in the foreground
    (['f:identity-seam', 'f:receipt-strata', 'f:typed-handoff'] as const).forEach((k, i) => {
      const m = makeSpecimen(ctx.tex[k], 230, 230);
      m.material.uniforms.uGrade.value = 0;
      m.material.uniforms.uBright.value = 1;
      this.scene.add(m);
      this.cards.push({ mesh: m, x: 10, y: -150, z: -2050 + i * 4, t: 46 + i * 8 });
    });

    // stop 3 — design system board
    add('s:design-system', 2700, 1800, [0, 0, -6200], [0, 0, 0], [80, 102]);

    // scrim keeps the stop titles legible over busy surfaces
    const scrim = new PaintSprite(1100, 520, (c) => {
      const g = c.createRadialGradient(0, 520, 0, 0, 520, 760);
      g.addColorStop(0, 'rgba(0,39,43,0.92)');
      g.addColorStop(0.55, 'rgba(0,39,43,0.6)');
      g.addColorStop(1, 'rgba(0,39,43,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 1100, 520);
    });
    scrim.mesh.position.set(-960 + 550, -540 + 260, 0);
    scrim.mesh.renderOrder = 1;
    this.ui.add(scrim.mesh);

    for (const s of STOPS) {
      const k = new TextSprite(s.kicker, { font: 'mono', size: 15, tracking: 0.16, color: 'signal' });
      const t = new TextSprite(s.title, { font: 'display', size: 84, tracking: 0.01, color: 'paper' });
      this.kickers.push(k);
      this.titles.push(t);
      this.ui.add(k.mesh, t.mesh);
    }
    this.rule = new Stroke([[0, 0, 0], [64, 0, 0]], { width: 3, color: 'signal' });
    this.ui.add(this.rule.mesh);
  }

  update(f: number) {
    const t = f - A0;
    // ---------------------------------------------------------------- dolly
    const z0 = lerp(980, 1780, ease(range(t, 0, 34)));
    const z1 = lerp(z0, -860, inOut(range(t, 34, 54)));
    const z2 = lerp(z1, -1060, range(t, 54, 76));
    const z3 = lerp(z2, -6200 + 1420, inOut(range(t, 74, 96)));
    const z = lerp(z3, -6200 + 2350, ease(range(t, 96, 124)));
    const x = Math.sin(t / 26) * 40 + lerp(0, 60, inOut(range(t, 34, 54))) * (1 - range(t, 74, 96));
    const y = lerp(0, 40, inOut(range(t, 34, 54))) * (1 - range(t, 74, 96));
    this.camera.position.set(x, y, z);
    this.camera.lookAt(x * 0.6, y * 0.4, z - 1000);
    this.camera.rotation.z = Math.sin(t / 40) * 0.01;
    this.camera.updateMatrixWorld();
    this.topo.material.uniforms.uTime.value = 12.2 + f / 60 * 0.05;
    this.topo.material.uniforms.uRippleR.value = -1e4;

    for (const p of this.planes) {
      p.mesh.position.copy(p.base);
      p.mesh.rotation.set(...p.rot);
      const u = p.mesh.material.uniforms;
      u.uWipe.value = p.wipe ? ease(range(t, p.wipe[0], p.wipe[1])) : 1;
      const d = this.camera.position.distanceTo(p.mesh.position);
      u.uDim.value = Math.min(0.8, Math.max(0, (d - 2400) / 3200));
      u.uOpacity.value = 1;
      p.mesh.visible = p.mesh.position.z < this.camera.position.z - 40;
    }
    this.bezel.mesh.visible = this.bezel.mesh.position.z < z - 40;
    this.bezel.opacity(e(t, 0, 6));
    this.bezel2.mesh.position.set(600, -30, -522);
    this.bezel2.mesh.rotation.set(0, -0.42, 0);
    this.bezel2.opacity(e(t, 8, 14));

    // blueprint flips: rotate in from edge-on, hold, rotate out
    for (const c of this.cards) {
      const fin = inOut(range(t, c.t, c.t + 8));
      const fout = inOut(range(t, c.t + 8, c.t + 16));
      c.mesh.position.set(c.x, c.y, c.z);
      c.mesh.rotation.set(0.08, (1 - fin) * (Math.PI / 2) - fout * (Math.PI / 2), 0);
      c.mesh.visible = fin > 0 && fout < 1;
    }

    // ---------------------------------------------------------------- copy
    STOPS.forEach((s, i) => {
      const end = i < 2 ? STOPS[i + 1].at - 4 : 200;
      const on = e(t, s.at + 4, s.at + 16) * (1 - e(t, end - 6, end));
      this.kickers[i].at(-864, -300).reveal(e(t, s.at + 4, s.at + 18)).opacity(on);
      this.titles[i].at(-864, -366).rise(-(1 - ease(range(t, s.at + 6, s.at + 18)))).opacity(on);
    });
    this.rule.mesh.position.set(-864, -250, 0);
    this.rule.draw(e(t, 2, 14)).opacity(1);
  }
}

export function phoneBezel(c: CanvasRenderingContext2D, w: number, h: number) {
  c.fillStyle = '#021a1d';
  c.beginPath();
  c.roundRect(0, 0, w, h, 44);
  c.fill();
  c.strokeStyle = HEX.mist;
  c.globalAlpha = 0.34;
  c.lineWidth = 1.5;
  c.beginPath();
  c.roundRect(1, 1, w - 2, h - 2, 43);
  c.stroke();
  c.globalAlpha = 0.6;
  c.fillStyle = '#000';
  c.beginPath();
  c.roundRect(w / 2 - 56, 14, 112, 26, 13);
  c.fill();
}

export type { Mesh };
