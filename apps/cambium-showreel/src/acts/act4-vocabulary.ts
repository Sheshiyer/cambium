// ACT 4 — MOTION NAMES (f510–629)
// The five frozen motion primitives from the Mission Control storyboard, each
// in its own 8px-rhythm cell with a live demo and its chip. reducedMotion
// lands last and freezes the whole board for a beat (motion is optional,
// meaning is not), then the cells collapse to hairlines.
import { Group, PerspectiveCamera, Scene } from 'three';
import type { Act, Ctx } from '../engine.ts';
import { clamp01, e, ease, easeIn, lerp, pop, range } from '../lib/ease.ts';
import { Ring } from '../lib/ring.ts';
import { DotField, Stroke, smoothPath, type V3 } from '../lib/shapes.ts';
import { PaintSprite, TextSprite } from '../lib/text.ts';
import { makeTopo, type Topo } from '../layers/topo.ts';
import { COL, FONT, HEX } from '../tokens.ts';
import { D0 } from './act1-ignite.ts';

const A0 = 510;
const FREEZE = 598;
const CW = 328;
const CH = 440;
const GAP = 16;
const CX = (i: number) => -((CW * 5 + GAP * 4) / 2) + CW / 2 + i * (CW + GAP);
const CY = -46;

const CELLS = [
  { title: 'PROOF ORBIT', chip: 'orbitSweep', icon: 'orbit' },
  { title: 'PACKET RAIL', chip: 'packetDrift', icon: 'drift' },
  { title: 'SELECTED BRANCH', chip: 'glyphBreathe', icon: 'glyph' },
  { title: 'GATE ATTENTION', chip: 'warningAttention', icon: 'warn' },
  { title: 'REDUCED MOTION', chip: 'reducedMotion', icon: 'reduced' },
] as const;

function drawCell(c: CanvasRenderingContext2D, i: number) {
  const cell = CELLS[i];
  c.strokeStyle = HEX.mist;
  c.globalAlpha = 0.22;
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(0.5, 0.5, CW - 1, CH - 1, 8);
  c.stroke();
  // number badge
  c.globalAlpha = 0.62;
  c.beginPath();
  c.roundRect(16.5, 16.5, 34, 24, 12);
  c.stroke();
  c.globalAlpha = 1;
  c.fillStyle = HEX.paper;
  c.font = `500 12px "${FONT.mono}"`;
  (c as any).letterSpacing = '1px';
  c.textBaseline = 'middle';
  c.fillText(`0${i + 1}`, 25, 29);
  c.fillStyle = HEX.mist;
  c.globalAlpha = 0.85;
  c.font = `500 12px "${FONT.mono}"`;
  (c as any).letterSpacing = '2px';
  c.fillText(cell.title, 62, 29);
  // chip
  const cw = 196;
  const cx = (CW - cw) / 2;
  const cy = CH - 58;
  c.globalAlpha = 0.5;
  c.strokeStyle = HEX.mist;
  c.beginPath();
  c.roundRect(cx + 0.5, cy + 0.5, cw, 34, 6);
  c.stroke();
  c.globalAlpha = 1;
  c.fillStyle = HEX.paper;
  c.font = `500 14px "${FONT.mono}"`;
  (c as any).letterSpacing = '0.5px';
  c.textAlign = 'left';
  c.fillText(cell.chip, cx + 42, cy + 18);
  // chip icon
  const ix = cx + 22;
  const iy = cy + 17;
  c.lineWidth = 1.5;
  c.strokeStyle = cell.icon === 'warn' ? HEX.warning : HEX.signal;
  c.fillStyle = HEX.signal;
  if (cell.icon === 'orbit' || cell.icon === 'reduced') {
    c.setLineDash(cell.icon === 'orbit' ? [2, 3] : [3, 3]);
    c.beginPath();
    c.arc(ix, iy, 8, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
  } else if (cell.icon === 'drift') {
    for (let k = 0; k < 3; k++) {
      c.globalAlpha = 0.4 + k * 0.3;
      c.beginPath();
      c.arc(ix - 8 + k * 6, iy, 2.2, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    c.beginPath();
    c.moveTo(ix + 6, iy);
    c.lineTo(ix + 12, iy);
    c.stroke();
  } else if (cell.icon === 'glyph') {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      c.beginPath();
      c.moveTo(ix, iy);
      c.lineTo(ix + Math.cos(a) * 8, iy + Math.sin(a) * 8);
      c.stroke();
    }
  } else {
    c.beginPath();
    c.moveTo(ix, iy - 8);
    c.lineTo(ix + 8, iy + 6);
    c.lineTo(ix - 8, iy + 6);
    c.closePath();
    c.stroke();
  }
}

export function rrPts(w: number, h: number, r: number): V3[] {
  const out: V3[] = [];
  const cs: [number, number, number][] = [
    [w / 2 - r, h / 2 - r, Math.PI / 2],
    [w / 2 - r, -h / 2 + r, 0],
    [-w / 2 + r, -h / 2 + r, -Math.PI / 2],
    [-w / 2 + r, h / 2 - r, Math.PI],
  ];
  for (const [cx, cy, a0] of cs) for (let k = 0; k <= 6; k++) {
    const a = a0 - (k / 6) * (Math.PI / 2);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0]);
  }
  out.push(out[0]);
  return out;
}

export class VocabularyAct implements Act {
  id = 'vocabulary';
  scene = new Scene();
  ui = new Scene();
  camera = new PerspectiveCamera(35, 16 / 9, 10, 20000);
  private topo!: Topo;
  private title!: TextSprite;
  private sub!: TextSprite;
  private groups: Group[] = [];
  private frames: PaintSprite[] = [];
  private chipGlow: Stroke[] = [];
  // 01 orbit
  private oTrack!: Ring;
  private oArc!: Ring;
  private oPct!: TextSprite;
  private oDots!: DotField;
  private oCheck!: Stroke;
  private oBadge!: Ring;
  // 02 drift
  private dRail!: Stroke;
  private dDots!: DotField;
  private dArrows: Stroke[] = [];
  // 03 glyph
  private gPetals: Stroke[] = [];
  private gArc!: Stroke;
  private gDots!: DotField;
  private gHalo!: Ring;
  private gHaloSolid!: Ring;
  // 04 warn
  private wCard!: PaintSprite;
  private wBorder!: Stroke;
  private wIcon: Stroke[] = [];
  private wPill!: PaintSprite;
  private wChevron!: Stroke;
  // 05 reduced
  private rRail!: Stroke;
  private rDots!: DotField;
  private rRing!: Ring;
  private hair: Stroke[] = [];

  init(_ctx: Ctx) {
    this.topo = makeTopo({ w: 6000, h: 3600 });
    this.topo.material.uniforms.uAlpha.value = 0.11;
    this.topo.material.uniforms.uGrid.value = 0.05;
    this.scene.add(this.topo);
    this.camera.position.set(0, 0, D0);

    this.title = new TextSprite('MOTION NAMES', { font: 'display', size: 96, tracking: 0.01, color: 'paper' });
    this.sub = new TextSprite('FIVE FROZEN PRIMITIVES · DOTTED = PENDING · SOLID = SETTLED · PEACH = WARNING ONLY', {
      font: 'mono', size: 14, tracking: 0.12, color: 'mist',
    });
    this.ui.add(this.title.mesh, this.sub.mesh);

    for (let i = 0; i < 5; i++) {
      const g = new Group();
      const fr = new PaintSprite(CW, CH, (c) => drawCell(c, i));
      g.add(fr.mesh);
      const glow = new Stroke(rrPts(196, 34, 6), { width: 1.5, color: 'signal' });
      glow.mesh.position.set(0, -CH / 2 + 41, 0);
      g.add(glow.mesh);
      this.frames.push(fr);
      this.chipGlow.push(glow);
      this.groups.push(g);
      this.ui.add(g);
      const hl = new Stroke([[-CW / 2, 0, 0], [CW / 2, 0, 0]], { width: 1.5, color: 'mist' });
      this.hair.push(hl);
      this.ui.add(hl.mesh);
    }
    const [g0, g1, g2, g3, g4] = this.groups;
    const MID = 24; // demo centre (y) inside a cell

    // 01 orbitSweep
    this.oTrack = new Ring({ r: 92, w: 4, color: 'mist', dash: 28, dotted: true, opacity: 0.45 });
    this.oArc = new Ring({ r: 92, w: 4, color: 'signal' });
    this.oArc.u.uHead.value = 1;
    this.oPct = new TextSprite('0%', { font: 'mono', size: 34, weight: 500, color: 'paper', align: 'center' });
    this.oDots = new DotField(6, { core: 0.5, halo: 0.3 });
    this.oBadge = new Ring({ r: 16, w: 2.5, color: 'signal' });
    this.oCheck = new Stroke([[-7, 0, 0], [-2, -5, 0], [8, 6, 0]], { width: 2.5, color: 'signal' });
    for (const m of [this.oTrack.mesh, this.oArc.mesh]) m.position.y = MID;
    this.oBadge.mesh.position.set(92, MID, 0);
    this.oCheck.mesh.position.set(92, MID, 0);
    g0.add(this.oTrack.mesh, this.oArc.mesh, this.oPct.mesh, this.oDots.points, this.oBadge.mesh, this.oCheck.mesh);

    // 02 packetDrift
    const sCurve = (amp: number): V3[] => {
      const pts: V3[] = [];
      for (let k = 0; k <= 60; k++) {
        const x = -130 + (k / 60) * 260;
        pts.push([x, MID + Math.sin((k / 60) * Math.PI * 1.6 - 0.8) * amp, 0]);
      }
      return pts;
    };
    this.dRail = new Stroke(sCurve(34), { width: 3, color: 'mist', opacity: 0.4 });
    this.dDots = new DotField(16, { core: 0.48, halo: 0.3 });
    for (let k = 0; k < 3; k++) {
      const a = new Stroke([[-16, 0, 0], [12, 0, 0], [5, 6, 0]], { width: 1.5, color: 'mist' });
      this.dArrows.push(a);
      g1.add(a.mesh);
    }
    g1.add(this.dRail.mesh, this.dDots.points);

    // 03 glyphBreathe — bloom node on an arc rail with a selected halo
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const petal: V3[] = [];
      for (let j = 0; j <= 24; j++) {
        const u = (j / 24) * Math.PI * 2;
        const px = Math.cos(u) * 9;
        const py = 20 + Math.sin(u) * 18;
        petal.push([px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a), 0]);
      }
      const s = new Stroke(petal, { width: 1.6, color: 'signal' });
      this.gPetals.push(s);
      g2.add(s.mesh);
    }
    const arc: V3[] = [];
    for (let j = 0; j <= 40; j++) {
      const u = Math.PI * (0.15 + 0.7 * (j / 40));
      arc.push([Math.cos(u) * -110, -Math.sin(u) * 52 + 0, 0]);
    }
    this.gArc = new Stroke(arc, { width: 3, color: 'mist', opacity: 0.5 });
    this.gDots = new DotField(4, { core: 0.5, halo: 0.3 });
    this.gHalo = new Ring({ r: 120, w: 3, color: 'signal', dash: 44, dotted: true, opacity: 0.8 });
    this.gHaloSolid = new Ring({ r: 120, w: 3, color: 'signal' });
    for (const r of [this.gHalo, this.gHaloSolid]) r.mesh.scale.set(1, 0.62, 1);
    g2.add(this.gArc.mesh, this.gHalo.mesh, this.gHaloSolid.mesh, this.gDots.points);

    // 04 warningAttention — Genesis gate row
    this.wCard = new PaintSprite(276, 76, (c) => {
      c.fillStyle = 'rgba(1,47,52,0.9)';
      c.beginPath();
      c.roundRect(0, 0, 276, 76, 10);
      c.fill();
      c.strokeStyle = HEX.mist;
      c.globalAlpha = 0.5;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(38, 38, 20, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(38, 26);
      c.lineTo(49, 46);
      c.lineTo(27, 46);
      c.closePath();
      c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = HEX.paper;
      c.font = `700 24px "${FONT.display}"`;
      (c as any).letterSpacing = '2px';
      c.fillText('GENESIS', 72, 38);
      c.fillStyle = HEX.mist;
      c.globalAlpha = 0.7;
      c.font = `500 12px "${FONT.mono}"`;
      (c as any).letterSpacing = '1px';
      c.fillText('Gate', 72, 58);
    });
    this.wBorder = new Stroke(rrPts(276, 76, 10), { width: 1.5, color: 'mist', opacity: 0.16 });
    const T = 13;
    this.wIcon = [
      new Stroke([[0, T, 0], [T * 0.92, -T * 0.6, 0], [-T * 0.92, -T * 0.6, 0], [0, T, 0]], { width: 2, color: 'warning' }),
      new Stroke([[0, 5, 0], [0, -3, 0]], { width: 2, color: 'warning' }),
    ];
    this.wChevron = new Stroke([[-4, 8, 0], [4, 0, 0], [-4, -8, 0]], { width: 2, color: 'mist' });
    this.wPill = new PaintSprite(120, 36, (c) => {
      c.fillStyle = HEX.warning;
      c.beginPath();
      c.roundRect(0, 0, 120, 36, 8);
      c.fill();
      c.fillStyle = HEX.ink;
      c.font = `500 13px "${FONT.mono}"`;
      (c as any).letterSpacing = '0.5px';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('Review Gate', 60, 19);
    });
    this.wBorder.mesh.renderOrder = 11;
    for (const s of this.wIcon) s.mesh.renderOrder = 11;
    this.wChevron.mesh.renderOrder = 11;
    this.wPill.mesh.renderOrder = 12;
    this.wCard.mesh.position.set(0, MID + 30, 0);
    this.wBorder.mesh.position.set(0, MID + 30, 0);
    for (const s of this.wIcon) s.mesh.position.set(78, MID + 30, 0);
    this.wChevron.mesh.position.set(116, MID + 30, 0);
    this.wPill.mesh.position.set(66, MID - 50, 0);
    g3.add(this.wCard.mesh, this.wBorder.mesh, ...this.wIcon.map((s) => s.mesh), this.wChevron.mesh, this.wPill.mesh);

    // 05 reducedMotion — static dots, zero translation
    this.rRail = new Stroke(sCurve(34), { width: 3, color: 'mist', opacity: 0.4 });
    this.rDots = new DotField(4, { core: 0.5, halo: 0.25 });
    this.rRing = new Ring({ r: 120, w: 2, color: 'mist', dash: 40, opacity: 0.4 });
    this.rRing.mesh.position.y = MID;
    g4.add(this.rRail.mesh, this.rDots.points, this.rRing.mesh);
  }

  update(f: number) {
    const t = f - A0;
    this.camera.position.set(0, -10 + t * 0.15, D0 * (1 - 0.04 * ease(range(t, 0, 120))));
    this.camera.lookAt(0, 0, 0);
    const tu = this.topo.material.uniforms;
    tu.uTime.value = 9.8 + f / 60 * 0.04;
    tu.uRippleR.value = -1e4;

    const freeze = f >= FREEZE && f < FREEZE + 8;
    const ft = freeze ? FREEZE - A0 : t; // reducedMotion freezes every demo
    const collapse = (i: number) => easeIn(range(t, 96 + i * 3, 108 + i * 3));
    const titleOut = 1 - ease(range(t, 94, 110));
    this.title.at(-852, 330).rise(-(1 - ease(range(t, 0, 14)))).opacity(titleOut);
    this.sub.at(-852, 264).reveal(e(t, 6, 30)).opacity(0.8 * titleOut);

    this.groups.forEach((g, i) => {
      const inT = pop(range(t, 4 + i * 8, 20 + i * 8));
      const c = collapse(i);
      g.position.set(CX(i), CY + (1 - inT) * -30, 0);
      g.scale.set(lerp(0.9, 1, inT), lerp(0.9, 1, inT) * (1 - c * 0.995), 1);
      g.visible = inT > 0.001 && c < 0.999;
      this.frames[i].opacity(clamp01(inT * 1.4));
      const running = i === 4 ? f >= FREEZE : t > 6 + i * 8;
      this.chipGlow[i].draw(e(t, 14 + i * 8, 30 + i * 8)).opacity(running ? 0.9 : 0);
      // hairline left behind by the collapse, then drawn away
      const h = this.hair[i];
      h.mesh.position.set(CX(i), CY, 0);
      h.draw(1, ease(range(t, 106 + i * 3, 118 + i * 3))).opacity(c > 0.5 ? 0.62 : 0);
    });

    // 01 orbitSweep: pending dots -> 54% -> 100% + check badge
    const lt0 = ft - 4;
    const prog = lt0 < 12 ? 0 : lt0 < 34 ? 0.54 * ease(range(lt0, 12, 34)) : 0.54 + 0.46 * ease(range(lt0, 40, 66));
    this.oTrack.arc(1).opacity(0.45);
    this.oArc.arc(prog).opacity(prog > 0 ? 1 : 0);
    this.oPct.set(`${Math.round(prog * 100)}%`).at(0, 24 - 4);
    this.oDots.begin();
    if (prog > 0) {
      const a = prog * Math.PI * 2;
      this.oDots.push(Math.sin(a) * 92, 24 + Math.cos(a) * 92, 0, 14, COL.signal, 1);
      for (let g = 1; g < 3 && prog < 0.999; g++) {
        const b = (prog - g * 0.03) * Math.PI * 2;
        this.oDots.push(Math.sin(b) * 92, 24 + Math.cos(b) * 92, 0, 10, COL.mist, 0.4 - g * 0.12);
      }
      if (prog >= 0.999) {
        this.oDots.push(0, 24 + 92, 0, 11, COL.signal, 1);
        this.oDots.push(0, 24 - 92, 0, 11, COL.signal, 1);
      }
    }
    this.oDots.end();
    const done = pop(range(lt0, 66, 78));
    this.oBadge.arc(1).opacity(done > 0 ? 1 : 0);
    this.oBadge.mesh.scale.setScalar(Math.max(0.001, done));
    this.oCheck.draw(ease(range(lt0, 70, 80))).opacity(done > 0 ? 1 : 0);

    // 02 packetDrift
    const lt1 = ft - 12;
    this.dRail.draw(ease(range(lt1, 0, 18))).opacity(0.4);
    this.dDots.begin();
    for (let k = 0; k < 3; k++) {
      const u = (k / 3 + lt1 * 0.0105) % 1;
      if (lt1 < 0) continue;
      for (let g = 0; g < 3; g++) {
        const uu = u - g * 0.04;
        if (uu < 0) continue;
        const p = this.dRail.pointAt(uu);
        this.dDots.push(p.x, p.y, 0, g === 0 ? 15 : 11 - g * 2, g === 0 ? COL.signal : COL.mist, (g === 0 ? 0.95 : 0.42 - g * 0.12) * Math.min(1, uu * 6, (1 - uu) * 6));
      }
    }
    this.dDots.end();
    this.dArrows.forEach((a, k) => {
      const x = -90 + ((k * 90 + lt1 * 2.6) % 200);
      a.mesh.position.set(x, 24 + 62 - k * 10, 0);
      a.draw(1).opacity(lt1 > 0 ? 0.5 * Math.sin((x + 90) / 200 * Math.PI) : 0);
    });

    // 03 glyphBreathe + selected halo
    const lt2 = ft - 20;
    const breathe = 1 + 0.06 * Math.sin((lt2 / 60) * Math.PI * 2 * 1.4);
    this.gPetals.forEach((s, k) => {
      s.mesh.position.set(0, 30, 0);
      s.mesh.scale.setScalar(breathe);
      s.draw(ease(range(lt2, k * 1.5, 14 + k * 1.5))).opacity(0.9);
    });
    this.gArc.mesh.position.set(0, -10, 0);
    this.gArc.draw(ease(range(lt2, 0, 16))).opacity(0.5);
    this.gDots.begin();
    if (lt2 > 0) {
      this.gDots.push(0, 30, 0, 18 * breathe, COL.signal, 1);
      this.gDots.push(-96, -36, 0, 13, COL.mist, 0.8);
      this.gDots.push(96, -36, 0, 13, COL.mist, 0.8);
    }
    this.gDots.end();
    const sel = ease(range(lt2, 18, 44));
    for (const r of [this.gHalo, this.gHaloSolid]) r.mesh.position.set(0, 10, 0);
    this.gHalo.arc(1).opacity(lt2 > 14 ? 0.6 * (1 - range(lt2, 44, 52)) : 0);
    this.gHaloSolid.arc(sel).opacity(1);

    // 04 warningAttention: stroke + icon only, then the review pill
    const lt3 = ft - 28;
    const warn = ease(range(lt3, 14, 30));
    (this.wBorder.u.uColor.value as any).copy(COL.mist).lerp(COL.warning, warn);
    this.wBorder.draw(1).opacity(lerp(0.16, 0.62, warn));
    this.wIcon.forEach((s) => s.draw(ease(range(lt3, 18, 30))).opacity(1));
    const review = ease(range(lt3, 40, 52));
    this.wChevron.draw(1).opacity(0.62 * (1 - review));
    this.wPill.reveal(review).opacity(review > 0 ? 1 : 0);

    // 05 reducedMotion: identical rail, ghosts removed, zero translation
    const lt4 = t - 36;
    this.rRail.draw(ease(range(lt4, 0, 16))).opacity(0.4);
    this.rDots.begin();
    if (lt4 > 4) for (const u of [0.18, 0.5, 0.82]) {
      const p = this.rRail.pointAt(u);
      this.rDots.push(p.x, p.y, 0, 14, COL.signal, 0.95);
    }
    this.rDots.end();
    this.rRing.arc(1).opacity(lt4 > 8 ? 0.4 : 0);
  }
}
