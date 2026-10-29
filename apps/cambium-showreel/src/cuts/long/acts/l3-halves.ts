// LONG 03 — TWO HALVES (bars 7–8, f1080–1439)
// README: the composition layer mints and ships the business (Genesis ->
// Taste -> Hands -> Will); the operator runs it as an infinite game.
// Left: the organ chain with a packet crossing it. Right: an infinite loop
// whose six stages light as the packet passes.
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import type { Act, Ctx } from '../../../engine.ts';
import { ease, range } from '../../../lib/ease.ts';
import { DotField, Stroke, type V3 } from '../../../lib/shapes.ts';
import { TextSprite } from '../../../lib/text.ts';
import { TextBlock } from '../../../lib/textblock.ts';
import { glyph } from '../../../layers/glyphs.ts';
import { makeTopo, type Topo } from '../../../layers/topo.ts';
import { COL } from '../../../tokens.ts';
import { D0 } from '../../../acts/act1-ignite.ts';
import { L } from '../timeline.ts';

const A0 = L.halves[0];
const CHAIN = ['genesis', 'taste', 'build', 'ops'] as const;
const CHAIN_X = [-760, -590, -420, -250];
const CY = 190;
const LOOP_X = 470;
const STAGES = ['INGEST', 'ROUTE', 'ACT', 'VIABILITY', 'LEARN', 'PERSIST'];

export class LongHalves implements Act {
  id = 'l-halves';
  scene = new Scene();
  ui = new Scene();
  camera = new PerspectiveCamera(35, 16 / 9, 10, 20000);
  private topo!: Topo;
  private divider!: Stroke;
  private glyphs: Stroke[][] = [];
  private rail!: Stroke;
  private railTrack!: Stroke;
  private loopTrack!: Stroke;
  private loopTrace!: Stroke;
  private dots!: DotField;
  private stages: TextSprite[] = [];
  private left!: TextBlock;
  private right!: TextBlock;
  private tmp = new Vector3();

  init(_ctx: Ctx) {
    this.topo = makeTopo({ w: 6000, h: 3600 });
    this.topo.material.uniforms.uAlpha.value = 0.1;
    this.topo.material.uniforms.uRippleR.value = -1e4;
    this.scene.add(this.topo);
    this.camera.position.set(0, 0, D0);

    this.divider = new Stroke([[0, 380, 0], [0, -380, 0]], { width: 1.2, color: 'mist', dash: 9, dotted: true, opacity: 0.5 });
    this.ui.add(this.divider.mesh);

    // composition layer: organ chain
    CHAIN.forEach((id, i) => {
      const strokes = glyph(id).map((pts) => {
        const s = new Stroke(pts.map(([x, y]) => [CHAIN_X[i] + x * 46, CY + y * 46, 0] as V3), { width: 2, color: i === 0 ? 'signal' : 'mist' });
        this.ui.add(s.mesh);
        return s;
      });
      this.glyphs.push(strokes);
    });
    const railPts: V3[] = [];
    for (let k = 0; k <= 80; k++) {
      const x = CHAIN_X[0] + (k / 80) * (CHAIN_X[3] - CHAIN_X[0]);
      railPts.push([x, CY - 86 + Math.sin((k / 80) * Math.PI * 3) * 8, 0]);
    }
    this.railTrack = new Stroke(railPts, { width: 2.6, color: 'mist', dash: 10, dotted: true, opacity: 0.45 });
    this.rail = new Stroke(railPts, { width: 2.4, color: 'signal' });
    this.rail.u.uHead.value = 1;
    this.ui.add(this.railTrack.mesh, this.rail.mesh);

    // operator: lemniscate (the infinite game)
    const loop: V3[] = [];
    for (let k = 0; k <= 240; k++) {
      const a = (k / 240) * Math.PI * 2;
      const d = 1 + Math.sin(a) ** 2;
      loop.push([LOOP_X + (250 * Math.cos(a)) / d, CY + (250 * Math.sin(a) * Math.cos(a)) / d, 0]);
    }
    this.loopTrack = new Stroke(loop, { width: 3, color: 'mist', dash: 12, dotted: true, opacity: 0.45 });
    this.loopTrace = new Stroke(loop, { width: 3, color: 'signal' });
    this.loopTrace.u.uHead.value = 1;
    this.ui.add(this.loopTrack.mesh, this.loopTrace.mesh);
    this.dots = new DotField(32, { core: 0.48, halo: 0.3 });
    this.ui.add(this.dots.points);
    const stageW = 116;
    STAGES.forEach((s, i) => {
      const t = new TextSprite(s, { font: 'mono', size: 13, tracking: 0.16, color: 'mist', align: 'center' });
      t.at(LOOP_X - (stageW * 5) / 2 + i * stageW, CY - 125);
      this.stages.push(t);
      this.ui.add(t.mesh);
    });

    this.left = new TextBlock(this.ui, -864, 20)
      .kicker('01 · THE COMPOSITION LAYER')
      .title(['MINTS AND SHIPS', 'THE BUSINESS.'], 76)
      .gap(6)
      .body(['Genesis → Taste → Hands → Will, one', 'contract-driven pipeline: idea → brand', 'system → on-brand surfaces → go-to-market.'], 19);
    this.right = new TextBlock(this.ui, 96, 20)
      .kicker('02 · THE OPERATOR')
      .title(['RUNS IT AS AN', 'INFINITE GAME.'], 76)
      .gap(6)
      .body(['An event-sourced wake loop that gates real', 'changes, guards solvency and remembers', 'across runs through a shared cortex.'], 19);
  }

  update(f: number) {
    const t = f - A0;
    this.camera.position.set(Math.sin(t / 90) * 8, 0, D0);
    this.camera.lookAt(0, 0, 0);
    this.topo.material.uniforms.uTime.value = 6.3 + (f / 60) * 0.03;
    const out = 1 - ease(range(t, 336, 354));

    this.divider.draw(ease(range(t, 4, 50))).opacity(0.5 * out);

    // left: glyphs draw on in chain order, then a packet crosses the chain
    this.glyphs.forEach((strokes, i) => {
      for (const s of strokes) s.draw(ease(range(t, 20 + i * 14, 56 + i * 14))).opacity(out * (i === 0 ? 1 : 0.85));
    });
    this.railTrack.draw(ease(range(t, 30, 90))).opacity(0.45 * out);
    const crossing = ((t - 80) / 150) % 1;
    const cross = t < 80 ? 0 : crossing;
    this.rail.draw(t < 80 ? 0 : Math.min(1, (t - 80) / 150)).opacity(out);

    // right: the loop draws, then a settled trace chases a packet forever
    this.loopTrack.draw(ease(range(t, 180, 240))).opacity(0.45 * out);
    const lp = t < 200 ? -1 : ((t - 200) / 170) % 1;
    if (lp >= 0) this.loopTrace.draw(lp, Math.max(0, lp - 0.3)).opacity(out);
    else this.loopTrace.draw(0).opacity(0);

    this.dots.begin();
    if (t >= 80) {
      for (let g = 0; g < 3; g++) {
        const uu = cross - g * 0.02;
        if (uu <= 0) continue;
        this.rail.pointAt(uu, this.tmp);
        this.dots.push(this.tmp.x, this.tmp.y, 0, g ? 11 - g * 2 : 16, g ? COL.mist : COL.signal, out * (g ? 0.42 - g * 0.12 : 1));
      }
    }
    if (lp >= 0) {
      for (let g = 0; g < 3; g++) {
        const uu = lp - g * 0.012;
        if (uu <= 0) continue;
        this.loopTrace.pointAt(uu, this.tmp);
        this.dots.push(this.tmp.x, this.tmp.y, 0, g ? 11 - g * 2 : 16, g ? COL.mist : COL.signal, out * (g ? 0.42 - g * 0.12 : 1));
      }
    }
    this.dots.end();
    const stage = lp >= 0 ? Math.floor(lp * 6) % 6 : -1;
    this.stages.forEach((s, i) => {
      const k = ease(range(t, 220 + i * 6, 240 + i * 6));
      s.color(i === stage ? 'signal' : 'mist').reveal(k).opacity(out * (i === stage ? 1 : 0.55));
    });

    this.left.update(f, A0 + 40, A0 + 336, 14);
    this.right.update(f, A0 + 200, A0 + 336, 14);
  }
}
