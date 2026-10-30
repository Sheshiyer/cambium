// LONG 02 — TITLE (bars 5–6, f720–1079)
// Stacked lockup: the favicon mark builds from an orbitSweep, CAMBIUM rises
// letter by letter, and the README promise lands one line per beat.
import { Color, DoubleSide, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, Shape, ShapeGeometry } from 'three';
import type { Act, Ctx } from '../../../engine.ts';
import { ease, lerp, pop, range } from '../../../lib/ease.ts';
import { Ring } from '../../../lib/ring.ts';
import { DotField, Stroke } from '../../../lib/shapes.ts';
import { TextSprite } from '../../../lib/text.ts';
import { TextBlock } from '../../../lib/textblock.ts';
import { makeTopo, type Topo } from '../../../layers/topo.ts';
import { COL, FAVICON } from '../../../tokens.ts';
import { D0 } from '../../../acts/act1-ignite.ts';
import { L } from '../timeline.ts';

const A0 = L.title[0];
const MARK = 210;
const K = MARK / 64;
const MY = 300; // mark centre
const WY = 0; // wordmark centre

export function favShape(pts: [number, number][], k: number, color: Color, opacity = 1) {
  const s = new Shape(pts.map(([x, y]) => ({ x: (x - 32) * k, y: (32 - y) * k }) as any));
  const m = new Mesh(
    new ShapeGeometry(s),
    new MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, side: DoubleSide }),
  );
  m.renderOrder = 7;
  return m;
}

export class LongTitle implements Act {
  id = 'l-title';
  scene = new Scene();
  ui = new Scene();
  camera = new PerspectiveCamera(35, 16 / 9, 10, 20000);
  private topo!: Topo;
  private ring!: Ring;
  private track!: Ring;
  private flag!: Mesh<ShapeGeometry, MeshBasicMaterial>;
  private facet!: Mesh<ShapeGeometry, MeshBasicMaterial>;
  private orbit!: DotField;
  private letters: TextSprite[] = [];
  private letterX: number[] = [];
  private eyebrow!: TextSprite;
  private rule!: Stroke;
  private promise!: TextBlock;

  init(_ctx: Ctx) {
    this.topo = makeTopo({ w: 6000, h: 3600 });
    this.topo.material.uniforms.uAlpha.value = 0.14;
    this.scene.add(this.topo);
    this.camera.position.set(0, 0, D0);

    const r = FAVICON.ring;
    this.track = new Ring({ r: r.r * K, w: r.stroke * K * 0.7, color: 'mist', dash: 48, dotted: true, opacity: 0.3 });
    this.ring = new Ring({ r: r.r * K, w: r.stroke * K, color: 'mist' });
    this.ring.u.uHead.value = 1;
    this.ring.u.uHeadColor.value = COL.signal.clone();
    for (const m of [this.track.mesh, this.ring.mesh]) m.position.set(0, MY, 0);
    this.flag = favShape(FAVICON.flag, K, COL.signal);
    this.facet = favShape(FAVICON.facet, K, COL.mist, FAVICON.facetOpacity);
    this.facet.renderOrder = 8;
    this.orbit = new DotField(8, { core: 0.5, halo: 0.3 });
    this.scene.add(this.track.mesh, this.ring.mesh, this.flag, this.facet, this.orbit.points);

    // centred wordmark, one sprite per letter
    const sprites = [...'CAMBIUM'].map((ch) => new TextSprite(ch, { font: 'display', size: 250, color: 'signal', oversample: 1.5 }));
    const adv = sprites.map((s) => s.width - s.pad * 2 + 6);
    const total = adv.reduce((a, b) => a + b, 0) - 6;
    let x = -total / 2;
    sprites.forEach((s, i) => {
      this.letters.push(s);
      this.letterX.push(x);
      x += adv[i];
      this.scene.add(s.mesh);
    });
    this.eyebrow = new TextSprite('THE COMPANY COMPILER', { font: 'mono', size: 18, tracking: 0.32, color: 'mist', align: 'center' });
    this.rule = new Stroke([[-total / 2, 0, 0], [total / 2, 0, 0]], { width: 1.5, color: 'signal' });
    this.scene.add(this.eyebrow.mesh, this.rule.mesh);
    this.promise = new TextBlock(this.ui, 0, -150, { align: 'center' })
      .body(['AN IDEA GOES IN.', 'A SELF-RUNNING, ON-BRAND BUSINESS COMES OUT.'], 30, 'paper', 1);
  }

  update(f: number) {
    const t = f - A0;
    this.camera.position.set(0, 0, D0 * lerp(1.05, 0.98, ease(range(t, 0, 360))));
    this.camera.lookAt(0, 0, 0);
    const tu = this.topo.material.uniforms;
    tu.uTime.value = 4.2 + (f / 60) * 0.035;
    tu.uRippleC.value.set(0, MY);
    tu.uRippleR.value = ease(range(t, 10, 200)) * 2200;
    tu.uRippleW.value = 90;

    const sw = ease(range(t, 10, 70));
    const rr = lerp(330, FAVICON.ring.r * K, ease(range(t, 10, 80)));
    this.ring.radius(rr, FAVICON.ring.stroke * K).arc(sw).opacity(lerp(1, FAVICON.ring.opacity, range(t, 70, 90)));
    this.track.radius(rr, FAVICON.ring.stroke * K * 0.7).arc(1).opacity(0.3 * (1 - range(t, 66, 80)));

    const breathe = 1 + 0.018 * Math.sin((t / 60) * Math.PI * 2 * 0.45) * range(t, 100, 130);
    const fl = pop(range(t, 50, 80));
    const sy = Math.max(0.001, fl) * breathe;
    this.flag.scale.set(breathe, sy, 1);
    this.flag.position.set(0, MY + 22 * K * (1 - sy), 0);
    this.flag.material.opacity = Math.min(1, fl * 3);
    this.flag.visible = fl > 0.001;
    const fc = pop(range(t, 66, 90));
    this.facet.position.set((1 - fc) * 50, MY - (1 - fc) * 50, 0);
    this.facet.scale.setScalar(breathe);
    this.facet.material.opacity = FAVICON.facetOpacity * Math.min(1, fc);
    this.facet.visible = fc > 0.001;

    // three packets orbit the ring once it settles (packetDrift with ghosts)
    this.orbit.begin();
    const on = range(t, 90, 110) * (1 - range(t, 330, 350));
    const R0 = FAVICON.ring.r * K;
    for (let k = 0; k < 3; k++) {
      for (let g = 0; g < 2; g++) {
        const a = (t - g * 3) / 60 * 0.9 + (k * Math.PI * 2) / 3;
        this.orbit.push(Math.sin(a) * R0, MY + Math.cos(a) * R0, 1, g ? 9 : 13, g ? COL.mist : COL.signal, on * (g ? 0.4 : 1));
      }
    }
    this.orbit.end();

    const track = 1 - ease(range(t, 80, 200));
    const out = 1 - ease(range(t, 336, 354));
    this.letters.forEach((l, i) => {
      const k = ease(range(t, 80 + i * 6, 104 + i * 6));
      const spread = (i - 3) * 26 * track;
      l.at(this.letterX[i] + spread, WY).rise(-(1 - k)).opacity(k > 0 ? out : 0);
    });
    this.rule.mesh.position.set(0, WY - 116, 0);
    this.rule.draw(ease(range(t, 140, 200))).opacity(0.7 * out);
    this.eyebrow.at(0, WY + 142).reveal(ease(range(t, 130, 160))).opacity(0.85 * out);
    this.promise.update(f, A0 + 180, A0 + 336, 45);
  }
}
