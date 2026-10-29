// LONG 04 — ORGANS (bars 9–20, f1440–3599)
// Five two-bar chapters. Hero object right (Genesis is the real GLB), text
// column left: name, headline, why, IN/OUT contract and its failure
// boundary — all paraphrased from the system field guide (sources 11–15).
// Bars 19–20: the atlas strip with each organ's one-word role.
import { Group, Mesh, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { Act, Ctx } from '../../../engine.ts';
import { clamp01, e, ease, inOut, lerp, pop, range } from '../../../lib/ease.ts';
import { Ring } from '../../../lib/ring.ts';
import { DotField, Stroke } from '../../../lib/shapes.ts';
import { PaintSprite, TextSprite } from '../../../lib/text.ts';
import { TextBlock } from '../../../lib/textblock.ts';
import { glyph } from '../../../layers/glyphs.ts';
import { lightIsland } from '../../../layers/islands.ts';
import { makeSpecimen, type Specimen } from '../../../layers/specimen.ts';
import { makeTopo, type Topo } from '../../../layers/topo.ts';
import { ORGANS, type OrganId } from '../../../timeline.ts';
import { COL, HEX } from '../../../tokens.ts';
import { D0 } from '../../../acts/act1-ignite.ts';
import { L_BAR, ORGAN_START, STRIP_START, L } from '../timeline.ts';

const HX = 330; // hero centre
const HY = -10;
const HERO = 680;
const CHAPTER = 2 * L_BAR;
const STRIP_X = (i: number) => (i - 2) * 352;
const STRIP_Y = -10;
const CELL = 300;

interface Copy {
  family: string;
  headline: string[];
  why: string[];
  inp: string;
  out: string;
  boundary: string;
  role: string;
}

const COPY: Record<OrganId, Copy> = {
  genesis: {
    family: 'ORGAN 01 / 05 · CAMBIUM',
    headline: ['TURN AN IDEA INTO A COHERENT,', 'BOUNDED BRAND SYSTEM.'],
    why: ['Records who the venture serves, what it', 'promises, how it speaks, what visuals may claim.'],
    inp: 'idea · declared scope · approved sources',
    out: 'brand · copy · visual systems + lineage',
    boundary: 'BOUNDARY — missing canonical fields are contract drift',
    role: 'BRAND SYSTEM',
  },
  taste: {
    family: 'ORGAN 02 / 05 · CAMBIUM',
    headline: ['MAKE QUALITY AND MEANING', 'INSPECTABLE BEFORE ACCEPTANCE.'],
    why: ['A page can match the colours and still', 'misidentify the product. Taste catches that.'],
    inp: 'brand system · audience · claim boundaries',
    out: 'taste brief · verdict · repair or hold',
    boundary: 'BOUNDARY — similarity scores cannot establish meaning',
    role: 'TESTABLE BRIEF',
  },
  build: {
    family: 'ORGAN 03 / 05 · HANDS',
    headline: ['BUILD A BOUNDED ARTIFACT WITH', 'THE RIGHT DECLARED CAPABILITY.'],
    why: ['The unit is a scoped task with exit evidence,', 'not an endlessly busy agent.'],
    inp: 'admitted task · versioned brief · criteria',
    out: 'artifact · verification · terminal evidence',
    boundary: 'BOUNDARY — local tests are not a deployment',
    role: 'INSPECTABLE ARTIFACT',
  },
  ops: {
    family: 'ORGAN 04 / 05 · WILL',
    headline: ['TURN APPROVED INTENT INTO', 'ACCOUNTABLE OPERATIONS.'],
    why: ['Connects finished output to audience, offer,', 'market evidence and distribution.'],
    inp: 'approved brief · artifact · audience evidence',
    out: 'bounded plan · approved move · outcomes',
    boundary: 'BOUNDARY — approval precedes consequential outreach',
    role: 'ACCOUNTABLE OPS',
  },
  cortex: {
    family: 'ORGAN 05 / 05 · CAMBIUM',
    headline: ['PRESERVE AND RETRIEVE EVIDENCE', 'WITHOUT REWRITING INTENT.'],
    why: ['Gives finite runs continuity: a memory contract,', 'not a vendor and not the one who decides.'],
    inp: 'source material · tenant context · lineage',
    out: 'validated chunks · retrieval · receipts',
    boundary: 'BOUNDARY — an empty result is no licence to invent',
    role: 'TENANT MEMORY',
  },
};

interface Rig {
  id: OrganId;
  plate?: Specimen;
  island?: Group;
  word: TextSprite;
  glyph: Stroke[];
  index: TextSprite;
  block: TextBlock;
  stripLabel: TextSprite;
  stripRole: TextSprite;
  frame: PaintSprite;
}

export class LongOrgans implements Act {
  id = 'l-organs';
  scene = new Scene();
  ui = new Scene();
  camera = new PerspectiveCamera(35, 16 / 9, 10, 20000);
  private topo!: Topo;
  private rigs: Rig[] = [];
  private back!: Ring;
  private front!: Ring;
  private trackBack!: Ring;
  private trackFront!: Ring;
  private halo = new Group();
  private headDot!: DotField;
  private list: TextSprite[] = [];
  private listTick!: Stroke;
  private stripHead!: TextBlock;

  init(ctx: Ctx) {
    this.topo = makeTopo({ w: 6000, h: 3600 });
    this.scene.add(this.topo);
    lightIsland(this.scene, ctx.renderer);
    this.camera.position.set(0, 0, D0);

    this.trackBack = new Ring({ r: 430, w: 3.2, color: 'mist', dash: 110, dotted: true, opacity: 0.34 });
    this.trackFront = new Ring({ r: 430, w: 3.2, color: 'mist', dash: 110, dotted: true, opacity: 0.34 });
    this.back = new Ring({ r: 430, w: 3, color: 'signal' });
    this.front = new Ring({ r: 430, w: 3, color: 'signal' });
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

    ORGANS.forEach((o, i) => {
      const c = COPY[o.id];
      const rig: Rig = {
        id: o.id,
        word: new TextSprite(o.label, { font: 'display', size: 520, tracking: -0.01, color: 'mist', align: 'center', oversample: 1 }),
        glyph: glyph(o.id).map((pts) => new Stroke(pts.map(([x, y]) => [x * 40, y * 40, 0]), { width: 2, color: 'mist' })),
        index: new TextSprite(`0${i + 1}`, { font: 'display', size: 132, color: 'signal' }),
        block: new TextBlock(this.ui, -864, 238)
          .kicker(c.family)
          .title([o.label], 132)
          .gap(4)
          .title(c.headline, 40, 'signal')
          .gap(10)
          .body(c.why, 19)
          .gap(16)
          .kv('IN', c.inp)
          .kv('OUT', c.out)
          .gap(10)
          .label(c.boundary, 13, 'mist', 0.62),
        stripLabel: new TextSprite(o.label, { font: 'display', size: 34, tracking: 0.06, color: 'paper', align: 'center' }),
        stripRole: new TextSprite(c.role, { font: 'mono', size: 12, tracking: 0.16, color: 'signal', align: 'center' }),
        frame: new PaintSprite(CELL + 24, CELL + 72, (cx) => {
          cx.strokeStyle = HEX.mist;
          cx.globalAlpha = 0.22;
          cx.lineWidth = 1;
          cx.beginPath();
          cx.roundRect(0.5, 0.5, CELL + 23, CELL + 71, 8);
          cx.stroke();
          cx.globalAlpha = 0.5;
          cx.fillStyle = HEX.signal;
          cx.fillRect(12.5, 0.5, 24, 2);
        }),
      };
      if (o.id === 'genesis') {
        rig.island = (ctx.assets.island as Group).clone();
        this.scene.add(rig.island);
      } else {
        rig.plate = makeSpecimen(ctx.tex[`m:${o.id}`], HERO);
        this.scene.add(rig.plate);
      }
      rig.word.mesh.renderOrder = 1;
      this.scene.add(rig.word.mesh);
      for (const s of rig.glyph) this.ui.add(s.mesh);
      this.ui.add(rig.stripLabel.mesh, rig.stripRole.mesh, rig.frame.mesh);
      void rig.index;
      this.rigs.push(rig);
    });
    ORGANS.forEach((o, i) => {
      const t = new TextSprite(`0${i + 1} ${o.label}`, { font: 'mono', size: 13, tracking: 0.14, color: 'mist' });
      this.list.push(t);
      this.ui.add(t.mesh);
    });
    this.listTick = new Stroke([[0, 0, 0], [18, 0, 0]], { width: 2, color: 'signal' });
    this.ui.add(this.listTick.mesh);
    this.stripHead = new TextBlock(this.ui, 0, 360, { align: 'center' })
      .kicker('THE COMPOSITION LAYER + ITS MEMORY')
      .title(['GENESIS → TASTE → BUILD → OPS'], 72)
      .body(['Cortex feeds every island.'], 22, 'mist', 0.9);
  }

  update(f: number, variant: number) {
    const strip = f >= STRIP_START;
    const cur = strip ? 4 : Math.min(4, variant);
    const S = ORGAN_START(cur);
    const t = f - S;
    const st = range(f, STRIP_START, STRIP_START + 30);

    this.camera.position.set(Math.sin(f / 200) * 10, 0, D0 * (strip ? lerp(1, 0.94, ease(range(f, STRIP_START, L.organs[1]))) : 1));
    this.camera.lookAt(0, 0, 0);
    const u = this.topo.material.uniforms;
    u.uTime.value = 5.1 + (f / 60) * 0.03 + cur * 0.9;
    u.uAlpha.value = 0.15;
    u.uRippleR.value = -1e4;

    // halo: orbitSweep over one bar
    const sweep = ease(range(t, 20, 170));
    const haloOn = (1 - st) * clamp01((t + 8) / 8) * (1 - ease(range(t, 330, 356)));
    const haloR = 430 * lerp(1.08, 1, ease(range(t, 0, 40)));
    for (const r of [this.trackBack, this.trackFront]) r.radius(haloR, 3.2).arc(1).opacity(0.34 * haloOn);
    for (const r of [this.back, this.front]) r.radius(haloR, 3).arc(sweep).opacity(haloOn);
    this.halo.position.set(HX, HY - 140, 0);
    this.halo.rotation.z = -t * 0.0012;
    this.halo.updateMatrixWorld();
    this.headDot.begin();
    if (sweep > 0.002 && haloOn > 0) {
      const a = sweep * Math.PI * 2;
      const p = new Vector3(Math.sin(a) * haloR, Math.cos(a) * haloR, 0).applyMatrix4(this.halo.matrixWorld);
      this.headDot.push(p.x, p.y, p.z, 15, COL.signal, haloOn);
      if (sweep >= 0.999) {
        for (const ang of [0, Math.PI]) {
          const q = new Vector3(Math.sin(ang) * haloR, Math.cos(ang) * haloR, 0).applyMatrix4(this.halo.matrixWorld);
          this.headDot.push(q.x, q.y, q.z, 11, COL.signal, haloOn * 0.9);
        }
      }
    }
    this.headDot.end();

    this.rigs.forEach((o, i) => {
      const isCur = i === cur && !strip;
      const k = i === 4 ? ease(range(f, STRIP_START, STRIP_START + 40)) : pop(range(f, STRIP_START + 8 + i * 6, STRIP_START + 40 + i * 6));
      const inStrip = strip ? k : 0;
      const ent = pop(range(t, 0, 40));
      const heroScale = lerp(1.18, 1, ent) * (1 + 0.04 * range(t, 0, CHAPTER));
      const vis = strip ? (i === 4 ? 1 : clamp01(k * 3)) : isCur ? 1 : 0;
      const sx = strip ? lerp(i === 4 ? HX : STRIP_X(i), STRIP_X(i), i === 4 ? k : 1) : HX;
      const sy = strip ? lerp(i === 4 ? HY : STRIP_Y, STRIP_Y, i === 4 ? k : 1) : lerp(HY - 40, HY, ent);
      const size = strip ? lerp(i === 4 ? HERO : CELL * 0.4, CELL, i === 4 ? k : inStrip) : HERO * heroScale;
      const drift = strip ? 0 : Math.sin((t + i * 13) / 60) * 0.012;
      if (o.plate) {
        const m = o.plate.material.uniforms;
        o.plate.visible = vis > 0.001;
        o.plate.position.set(sx, sy, 0);
        o.plate.scale.setScalar(size / HERO);
        o.plate.rotation.set(0, strip ? 0 : lerp(0.16, -0.1, inOut(range(t, 0, CHAPTER))), drift);
        m.uOpacity.value = vis;
      }
      if (o.island) {
        o.island.visible = vis > 0.001;
        const s = size * (strip ? 0.86 : 0.7);
        o.island.scale.setScalar(s);
        o.island.position.set(sx, sy + (strip ? 0 : 40), 0);
        o.island.rotation.set(lerp(0.52, 0.44, range(t, 0, CHAPTER)), lerp(-0.9, 0.5, inOut(range(t, -10, CHAPTER))) + (strip ? 0.6 : 0), 0);
      }
      const wOn = isCur ? clamp01((t + 6) / 12) * (1 - range(t, 330, 356)) : 0;
      o.word.at(HX + lerp(220, -220, range(t, -10, CHAPTER)), 40, -40).opacity(wOn * 0.024);
      o.glyph.forEach((s, gi) => {
        s.mesh.position.set(HX + 300, 300, 0);
        s.draw(isCur ? ease(range(t, 30 + gi * 8, 80 + gi * 8)) : 0).opacity(isCur ? 0.8 * (1 - range(t, 330, 350)) : 0);
      });
      if (isCur) o.block.update(f, S + 6, S + 334, 13);
      else o.block.update(f, Infinity, Infinity);

      const lab = strip ? e(f, STRIP_START + 20 + i * 6, STRIP_START + 44 + i * 6) : 0;
      o.stripLabel.at(STRIP_X(i), STRIP_Y - CELL / 2 - 26).reveal(lab).opacity(lab > 0 ? 1 : 0);
      const rl = strip ? e(f, STRIP_START + 60 + i * 9, STRIP_START + 84 + i * 9) : 0;
      o.stripRole.at(STRIP_X(i), STRIP_Y - CELL / 2 - 70).reveal(rl).opacity(rl > 0 ? 0.9 : 0);
      o.frame.mesh.position.set(STRIP_X(i), STRIP_Y - 24, 0);
      o.frame.reveal(strip ? e(f, STRIP_START + 6 + i * 6, STRIP_START + 36 + i * 6) : 0).opacity(strip ? 1 : 0);
    });

    this.list.forEach((s, i) => {
      const active = i === cur;
      s.color(active ? 'signal' : 'mist').at(760, -170 - i * 28).opacity(strip ? 1 - st : active ? 1 : 0.32);
    });
    this.listTick.mesh.position.set(734, -165 - cur * 28, 0);
    this.listTick.draw(1).opacity(strip ? 1 - st : 1);
    this.stripHead.update(f, STRIP_START + 30, L.organs[1] - 26, 22);
  }
}

export type { Mesh };
