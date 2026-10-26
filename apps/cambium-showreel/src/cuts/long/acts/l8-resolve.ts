// LONG 08 — RESOLVE (bars 37–40, f6480–7199)
// Packets fall back into one point, the orbitSweep contracts into the
// favicon ring, the mark builds, CAMBIUM lands on bar 38, the tagline
// decodes and the README promise closes it. The final second holds still.
import { Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, ShapeGeometry } from 'three';
import type { Act, Ctx } from '../../../engine.ts';
import { e, ease, expoIn, lerp, pop, range } from '../../../lib/ease.ts';
import { Ring } from '../../../lib/ring.ts';
import { hash3, mulberry32 } from '../../../lib/rng.ts';
import { DotField, Stroke, smoothPath, type V3 } from '../../../lib/shapes.ts';
import { TextSprite } from '../../../lib/text.ts';
import { makeTopo, type Topo } from '../../../layers/topo.ts';
import { COL, FAVICON } from '../../../tokens.ts';
import { D0 } from '../../../acts/act1-ignite.ts';
import { favShape } from './l2-title.ts';
import { L, L_TOTAL, bar } from '../timeline.ts';

const A0 = L.resolve[0];
const B38 = bar(38) - A0; // 180: the wordmark lands on the downbeat
const MARK = 300;
const K = MARK / 64;
const MX = -488;
const MY = 60;
const WORD_X = -262;
const TAG = 'ORGANIC SYSTEMS. PRECISE DATA.';
const PROMISE = 'An idea goes in. A self-running, on-brand business comes out.';
const GLYPHS = '0123456789/·:+-ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export class LongResolve implements Act {
  id = 'l-resolve';
  scene = new Scene();
  ui = new Scene();
  camera = new PerspectiveCamera(35, 16 / 9, 10, 20000);
  private topo!: Topo;
  private incoming!: DotField;
  private paths: Stroke[] = [];
  private core!: DotField;
  private ring!: Ring;
  private ringTrack!: Ring;
  private flag!: Mesh<ShapeGeometry, MeshBasicMaterial>;
  private facet!: Mesh<ShapeGeometry, MeshBasicMaterial>;
  private letters: TextSprite[] = [];
  private letterX: number[] = [];
  private eyebrow!: TextSprite;
  private tag!: TextSprite;
  private promise!: TextSprite;
  private rule!: Stroke;
  private foot!: Stroke;
  private footL!: TextSprite;
  private footR!: TextSprite;
  private miniTrack!: Ring;
  private mini!: Ring;
  private miniCheck!: Stroke;

  init(_ctx: Ctx) {
    this.topo = makeTopo({ w: 6000, h: 3600 });
    this.scene.add(this.topo);
    this.camera.position.set(0, 0, D0);
    const rnd = mulberry32(99);
    for (let i = 0; i < 52; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 1300 + rnd() * 500;
      const bend = (rnd() - 0.5) * 1.2;
      const ctrl: V3[] = [
        [Math.cos(a) * r, Math.sin(a) * r, 0],
        [Math.cos(a + bend) * r * 0.55, Math.sin(a + bend) * r * 0.55, 0],
        [Math.cos(a + bend * 1.6) * r * 0.2, Math.sin(a + bend * 1.6) * r * 0.2, 0],
        [0, 0, 0],
      ];
      const s = new Stroke(smoothPath(ctrl, 80), { width: 1.5, color: 'mist', opacity: 0.3 });
      s.u.uHead.value = 1;
      s.mesh.position.set(MX, MY, 0);
      this.paths.push(s);
      this.scene.add(s.mesh);
    }
    this.incoming = new DotField(170, { core: 0.48, halo: 0.3 });
    this.core = new DotField(4, { core: 0.5, halo: 0.34 });
    this.scene.add(this.incoming.points, this.core.points);

    const r = FAVICON.ring;
    this.ringTrack = new Ring({ r: r.r * K, w: r.stroke * K, color: 'mist', dash: 48, dotted: true, opacity: 0.3 });
    this.ring = new Ring({ r: r.r * K, w: r.stroke * K, color: 'mist' });
    this.ring.u.uHead.value = 1;
    this.ring.u.uHeadColor.value = COL.signal.clone();
    for (const m of [this.ringTrack.mesh, this.ring.mesh]) m.position.set(MX, MY, 0);
    this.flag = favShape(FAVICON.flag, K, COL.signal);
    this.facet = favShape(FAVICON.facet, K, COL.mist, FAVICON.facetOpacity);
    this.facet.renderOrder = 8;
    this.scene.add(this.ringTrack.mesh, this.ring.mesh, this.flag, this.facet);

    let x = WORD_X;
    for (const ch of 'CAMBIUM') {
      const l = new TextSprite(ch, { font: 'display', size: 300, color: 'signal', align: 'left', oversample: 1.5 });
      this.letters.push(l);
      this.letterX.push(x);
      x += l.width - l.pad * 2 + 6;
      this.scene.add(l.mesh);
    }
    this.eyebrow = new TextSprite('THE COMPANY COMPILER', { font: 'mono', size: 18, tracking: 0.32, color: 'mist' });
    this.tag = new TextSprite(TAG, { font: 'mono', size: 30, weight: 500, tracking: 0.14, color: 'paper' });
    this.promise = new TextSprite(PROMISE, { font: 'mono', size: 20, weight: 400, tracking: 0.04, color: 'mist' });
    this.rule = new Stroke([[WORD_X, 0, 0], [x - 6, 0, 0]], { width: 1.5, color: 'signal' });
    this.foot = new Stroke([[-864, 0, 0], [864, 0, 0]], { width: 1, color: 'mist' });
    this.footL = new TextSprite('', { font: 'mono', size: 14, tracking: 0.12, color: 'mist' });
    this.footR = new TextSprite('CAMBIUM DESIGN SYSTEM · v1.0.0 · EST. 2024', { font: 'mono', size: 14, tracking: 0.12, color: 'mist', align: 'right' });
    this.miniTrack = new Ring({ r: 13, w: 2.5, color: 'mist', opacity: 0.3 });
    this.mini = new Ring({ r: 13, w: 2.5, color: 'signal' });
    this.miniCheck = new Stroke([[-5, 0, 0], [-1.5, -4, 0], [6, 5, 0]], { width: 2, color: 'signal' });
    this.scene.add(this.eyebrow.mesh, this.tag.mesh, this.promise.mesh, this.rule.mesh, this.foot.mesh, this.footL.mesh, this.footR.mesh, this.miniTrack.mesh, this.mini.mesh, this.miniCheck.mesh);
  }

  update(f: number) {
    const t = f - A0;
    this.camera.position.set(0, 0, D0 * lerp(1.08, 1, ease(range(t, 0, 600))));
    this.camera.lookAt(0, 0, 0);

    const tu = this.topo.material.uniforms;
    tu.uTime.value = 14.6 + (f / 60) * 0.03;
    tu.uRippleC.value.set(MX, MY);
    const back = ease(range(t, 70, 320));
    tu.uReveal.value = lerp(lerp(2400, 0, ease(range(t, 0, 60))), 2400, back);
    tu.uRevealSoft.value = 500;
    tu.uRippleR.value = back * 2400;
    tu.uRippleW.value = 90;
    tu.uAlpha.value = 0.13;

    const land = 60;
    this.incoming.begin();
    this.paths.forEach((s, i) => {
      const t0 = (i % 11) * 2.4 - 20;
      const u = expoIn(range(t, t0, land));
      s.draw(Math.min(1, u + 0.02), Math.max(0, u - 0.3)).opacity(0.5 * (1 - range(t, land - 6, land)));
      if (u > 0 && u < 1) {
        for (let g = 0; g < 3; g++) {
          const p = s.pointAt(u - g * 0.03);
          this.incoming.push(p.x + MX, p.y + MY, 1, g === 0 ? 17 : 12 - g * 2, g === 0 ? COL.signal : COL.mist, g === 0 ? 1 : 0.42 - g * 0.12);
        }
      }
    });
    this.incoming.end();
    const hit = pop(range(t, land, land + 20)) * (1 - ease(range(t, land + 16, land + 60)));
    this.core.begin().push(MX, MY, 2, 26 + hit * 22, COL.signal, t >= land - 1 ? Math.max(0, hit) : 0).end();

    const sw = ease(range(t, land, land + 80));
    const rr = lerp(400, FAVICON.ring.r * K, ease(range(t, land, land + 90)));
    this.ring.radius(rr, FAVICON.ring.stroke * K).arc(sw).opacity(t >= land ? lerp(1, FAVICON.ring.opacity, range(t, land + 80, land + 100)) : 0);
    this.ringTrack.radius(rr, FAVICON.ring.stroke * K * 0.7).arc(1).opacity(t >= land ? 0.3 * (1 - range(t, land + 76, land + 92)) : 0);

    const breathe = 1 + 0.02 * Math.sin(((t - 200) / 60) * Math.PI * 2 * 0.45) * (1 - range(t, 540, 640)) * range(t, 200, 230);
    const fl = pop(range(t, 130, 170));
    const sy = Math.max(0.001, fl) * breathe;
    this.flag.scale.set(breathe, sy, 1);
    this.flag.position.set(MX, MY + 22 * K * (1 - sy), 0);
    this.flag.material.opacity = Math.min(1, fl * 3);
    this.flag.visible = fl > 0.001;
    const fc = pop(range(t, 150, 182));
    this.facet.position.set(MX + (1 - fc) * 60, MY - (1 - fc) * 60, 0);
    this.facet.scale.setScalar(breathe);
    this.facet.material.opacity = FAVICON.facetOpacity * Math.min(1, fc);
    this.facet.visible = fc > 0.001;

    const track = 1 - ease(range(t, B38, B38 + 120));
    this.letters.forEach((l, i) => {
      const k = ease(range(t, B38 + i * 6, B38 + 30 + i * 6));
      l.at(this.letterX[i] + track * i * 22, MY).rise(-(1 - k)).opacity(k > 0 ? 1 : 0);
    });
    this.rule.mesh.position.set(0, MY - 132, 0);
    this.rule.draw(ease(range(t, B38 + 20, B38 + 80))).opacity(0.7);
    this.eyebrow.at(WORD_X + 4, MY + 152).reveal(e(t, B38 + 20, B38 + 60)).opacity(0.85);

    const dec = range(t, B38 + 50, B38 + 150);
    let out = '';
    for (let i = 0; i < TAG.length; i++) {
      const ch = TAG[i];
      const at = (i / TAG.length) * 0.84;
      if (dec <= 0) out += ' ';
      else if (ch === ' ' || dec > at + 0.12) out += ch;
      else if (dec > at - 0.1) out += GLYPHS[Math.floor(hash3(i, Math.floor(f / 3), 7) * GLYPHS.length)];
      else out += ' ';
    }
    this.tag.set(out).at(WORD_X + 2, MY - 186).opacity(dec > 0 ? 1 : 0);
    this.promise.at(WORD_X + 2, MY - 240).reveal(ease(range(t, B38 + 180, B38 + 260))).opacity(0.9);

    const fy = -440;
    this.foot.mesh.position.set(0, fy + 34, 0);
    this.foot.draw(ease(range(t, 380, 440))).opacity(0.34);
    const nodes = Math.round(lerp(9, 17, ease(range(t, 400, 520))));
    const secs = Math.min(L_TOTAL / 60, Math.floor(f / 60) + (f >= L_TOTAL - 1 ? 1 : 0));
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    this.footL.set(`FPS 60 · NODES ${String(nodes).padStart(2, '0')}/17 · PACKETS 1,248 · UPTIME 00:${mm}:${ss}`)
      .at(-864, fy).reveal(e(t, 390, 440)).opacity(0.8);
    this.footR.at(864 - 46, fy).reveal(e(t, 400, 450)).opacity(0.7);
    const mp = ease(range(t, 400, 520));
    for (const r of [this.miniTrack, this.mini]) r.mesh.position.set(864 - 14, fy + 2, 0);
    this.miniTrack.arc(1).opacity(t > 396 ? 0.3 : 0);
    this.mini.arc(lerp(9 / 17, 1, mp)).opacity(t > 396 ? 1 : 0);
    this.miniCheck.mesh.position.set(864 - 14, fy + 2, 0);
    this.miniCheck.draw(ease(range(t, 520, 540))).opacity(1);
  }
}
