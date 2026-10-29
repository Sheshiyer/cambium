// LONG 07 — SURFACES (bars 33–36, f5760–6479)
// Three four-second stops: Mission Control with callouts on its sections,
// the Organ Console views with labelled blueprint cards, and a slow pan
// across the design-system board. The iris into the resolve closes it.
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import type { Act, Ctx } from '../../../engine.ts';
import { e, ease, inOut, lerp, range } from '../../../lib/ease.ts';
import { PaintSprite, TextSprite } from '../../../lib/text.ts';
import { TextBlock } from '../../../lib/textblock.ts';
import { Stroke } from '../../../lib/shapes.ts';
import { makeSpecimen, type Specimen } from '../../../layers/specimen.ts';
import { makeTopo, type Topo } from '../../../layers/topo.ts';
import { D0 } from '../../../acts/act1-ignite.ts';
import { phoneBezel } from '../../../acts/act5-surfaces.ts';
import { L } from '../timeline.ts';

const A0 = L.surfaces[0];

interface Plane {
  mesh: Specimen;
  base: Vector3;
  rot: [number, number, number];
  wipe?: [number, number];
}

// Mission Control sections, as fractions of screen height (0060 screenshot)
const CALLOUTS = [
  { label: 'NEXT MISSION', sub: 'owner · gate · dispatch', v: 0.3 },
  { label: 'STATE STACK', sub: 'selected · blocked · proof · locked', v: 0.59 },
  { label: 'PROOF NEEDED', sub: 'deploy · capture · receipt', v: 0.79 },
];

export class LongSurfaces implements Act {
  id = 'l-surfaces';
  scene = new Scene();
  ui = new Scene();
  camera = new PerspectiveCamera(35, 16 / 9, 10, 40000);
  private topo!: Topo;
  private planes: Plane[] = [];
  private bezel!: PaintSprite;
  private bezel2!: PaintSprite;
  private cards: { mesh: Specimen; label: TextSprite; x: number; y: number; z: number; t: number }[] = [];
  private callouts: { line: Stroke; label: TextSprite; sub: TextSprite; v: number }[] = [];
  private caps: { block: TextBlock; in: number; out: number }[] = [];
  private tmp = new Vector3();

  init(ctx: Ctx) {
    this.topo = makeTopo({ w: 2400, h: 1400 });
    this.topo.position.set(0, 0, -D0);
    this.topo.material.uniforms.uAlpha.value = 0.12;
    this.topo.material.uniforms.uRippleR.value = -1e4;
    this.camera.add(this.topo);
    this.scene.add(this.camera);

    const add = (key: string, w: number, h: number, pos: [number, number, number], rot: [number, number, number], wipe?: [number, number]) => {
      const m = makeSpecimen(ctx.tex[key], w, h);
      const u = m.material.uniforms;
      u.uGrade.value = 0;
      u.uBright.value = 1;
      u.uFromTop.value = 1;
      this.scene.add(m);
      this.planes.push({ mesh: m, base: new Vector3(...pos), rot, wipe });
    };
    this.bezel = new PaintSprite(472, 952, (c) => phoneBezel(c, 472, 952));
    this.bezel.mesh.position.set(160, 0, -2);
    this.bezel2 = new PaintSprite(452, 950, (c) => phoneBezel(c, 452, 950));
    this.bezel.mesh.renderOrder = 4;
    this.bezel2.mesh.renderOrder = 4;
    this.scene.add(this.bezel.mesh, this.bezel2.mesh);
    add('s:mission', 430, 910, [160, 0, 0], [0, 0, 0], [6, 60]);
    add('s:commands', 410, 888, [720, -30, -520], [0, -0.42, 0], [24, 70]);
    add('s:work', 900, 600, [-500, 40, -2600], [0, 0.3, 0], [250, 290]);
    add('s:receipts', 900, 600, [520, 40, -2700], [0, -0.3, 0], [262, 302]);
    (['f:identity-seam', 'f:receipt-strata', 'f:typed-handoff'] as const).forEach((k, i) => {
      const m = makeSpecimen(ctx.tex[k], 230, 230);
      m.material.uniforms.uGrade.value = 0;
      m.material.uniforms.uBright.value = 1;
      this.scene.add(m);
      const label = new TextSprite(['IDENTITY SEAM', 'RECEIPT STRATA', 'TYPED HANDOFF'][i], { font: 'mono', size: 14, tracking: 0.18, color: 'signal', align: 'center' });
      this.ui.add(label.mesh);
      this.cards.push({ mesh: m, label, x: 10, y: -150, z: -2050 + i * 4, t: 330 + i * 45 });
    });
    add('s:design-system', 2700, 1800, [0, 0, -6200], [0, 0, 0], [490, 530]);

    for (const c of CALLOUTS) {
      const line = new Stroke([[0, 0, 0], [-90, 0, 0], [-120, 0, 0]], { width: 1.25, color: 'mist', opacity: 0.7 });
      const label = new TextSprite(c.label, { font: 'mono', size: 15, tracking: 0.16, color: 'signal', align: 'right' });
      const sub = new TextSprite(c.sub, { font: 'mono', size: 13, tracking: 0.04, color: 'mist', align: 'right' });
      this.ui.add(line.mesh, label.mesh, sub.mesh);
      this.callouts.push({ line, label, sub, v: c.v });
    }

    const scrim = new PaintSprite(1100, 560, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 820);
      g.addColorStop(0, 'rgba(0,39,43,0.92)');
      g.addColorStop(0.55, 'rgba(0,39,43,0.6)');
      g.addColorStop(1, 'rgba(0,39,43,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 1100, 560);
    });
    scrim.mesh.position.set(-960 + 550, 540 - 280, 0);
    scrim.mesh.renderOrder = 1;
    this.ui.add(scrim.mesh);
    const cap = (inT: number, outT: number, build: (b: TextBlock) => TextBlock) =>
      this.caps.push({ block: build(new TextBlock(this.ui, -864, 396)), in: A0 + inT, out: A0 + outT });
    cap(10, 226, (b) => b.kicker('07 · SURFACE 01 · TELEGRAM MINI APP').title(['MISSION CONTROL'], 76).gap(4)
      .body(['The founder sees the next mission, its gate', 'and the proof still needed — in one view.'], 19));
    cap(250, 466, (b) => b.kicker('SURFACE 02 · ORGAN CONSOLE').title(['WORK · RECEIPTS'], 76).gap(4)
      .body(['Owner-segregated views: the work shoreline,', 'receipt strata and typed handoffs.'], 19));
    cap(490, 716, (b) => b.kicker('SURFACE 03 · v1.0.0').title(['ONE DESIGN SYSTEM'], 76).gap(4)
      .body(['Tokens, glyphs, states and panels —', 'organic systems, precise data.'], 19));
  }

  update(f: number) {
    const t = f - A0;
    // dolly: hold on the phones, fly to the views, fly to the board, pan it
    const z0 = lerp(1500, 1950, ease(range(t, 0, 220)));
    const z1 = lerp(z0, -860, inOut(range(t, 226, 262)));
    const z2 = lerp(z1, -1150, range(t, 262, 470));
    const z3 = lerp(z2, -6200 + 1250, inOut(range(t, 470, 512)));
    const z = lerp(z3, -6200 + 2150, ease(range(t, 512, 720)));
    const pan = lerp(-520, 520, inOut(range(t, 500, 720))) * (1 - ease(range(t, 690, 720)) * 0);
    const x = Math.sin(t / 70) * 30 + (t < 470 ? lerp(0, 60, inOut(range(t, 226, 262))) : pan * range(t, 470, 512));
    const y = t < 470 ? lerp(0, 40, inOut(range(t, 226, 262))) : lerp(40, 120, inOut(range(t, 500, 720)));
    this.camera.position.set(x, y, z);
    this.camera.lookAt(x * 0.6, y * 0.4, z - 1000);
    this.camera.rotation.z = Math.sin(t / 90) * 0.008;
    this.camera.updateMatrixWorld();
    this.topo.material.uniforms.uTime.value = 12.2 + (f / 60) * 0.03;

    for (const p of this.planes) {
      p.mesh.position.copy(p.base);
      p.mesh.rotation.set(...p.rot);
      const u = p.mesh.material.uniforms;
      u.uWipe.value = p.wipe ? ease(range(t, p.wipe[0], p.wipe[1])) : 1;
      const d = this.camera.position.distanceTo(p.mesh.position);
      u.uDim.value = Math.min(0.8, Math.max(0, (d - 2400) / 3200));
      p.mesh.visible = p.mesh.position.z < this.camera.position.z - 40;
    }
    this.bezel.mesh.visible = this.bezel.mesh.position.z < z - 40;
    this.bezel.opacity(e(t, 0, 10));
    this.bezel2.mesh.position.set(720, -30, -522);
    this.bezel2.mesh.rotation.set(0, -0.42, 0);
    this.bezel2.opacity(e(t, 18, 30));

    // callouts: leader from the phone's left edge to a right-aligned label
    const cOn = (k: number) => e(t, 70 + k * 30, 100 + k * 30) * (1 - e(t, 214, 228));
    this.callouts.forEach((c, k) => {
      const p = this.tmp.set(160 - 215, 455 - c.v * 910, 0).project(this.camera);
      const px = p.x * 960;
      const py = p.y * 540;
      const on = cOn(k);
      c.line.mesh.position.set(px - 6, py, 0);
      c.line.draw(on).opacity(0.7 * on);
      c.label.at(px - 140, py + 10).reveal(on).opacity(on);
      c.sub.at(px - 140, py - 14).reveal(on).opacity(on * 0.8);
    });

    for (const c of this.cards) {
      const fin = inOut(range(t, c.t, c.t + 14));
      const fout = inOut(range(t, c.t + 34, c.t + 48));
      c.mesh.position.set(c.x, c.y, c.z);
      c.mesh.rotation.set(0.08, (1 - fin) * (Math.PI / 2) - fout * (Math.PI / 2), 0);
      c.mesh.visible = fin > 0 && fout < 1;
      const p = this.tmp.set(c.x, c.y + 140, c.z).project(this.camera);
      const on = fin * (1 - fout);
      c.label.at(p.x * 960, p.y * 540).reveal(on).opacity(on);
    }

    for (const c of this.caps) c.block.update(f, c.in, c.out, 14);
  }
}
