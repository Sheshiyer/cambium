// LONG 06 — MOTION NAMES (bars 29–32, f5040–5759)
// The five frozen primitives at reading pace, each cell carrying its rule
// from the Mission Control motion spec, then the global rules strip.
// reducedMotion lands on bar 32: every demo freezes for a beat.
import { Group, PerspectiveCamera, Scene } from 'three';
import type { Act, Ctx } from '../../../engine.ts';
import { clamp01, e, ease, easeIn, lerp, pop, range } from '../../../lib/ease.ts';
import { Ring } from '../../../lib/ring.ts';
import { DotField, Stroke, type V3 } from '../../../lib/shapes.ts';
import { PaintSprite, TextSprite } from '../../../lib/text.ts';
import { TextBlock } from '../../../lib/textblock.ts';
import { makeTopo, type Topo } from '../../../layers/topo.ts';
import { COL, FONT, HEX } from '../../../tokens.ts';
import { D0 } from '../../../acts/act1-ignite.ts';
import { rrPts } from '../../../acts/act4-vocabulary.ts';
import { L, bar } from '../timeline.ts';

const A0 = L.motion[0];
const FREEZE = bar(32);
const CW = 328;
const CH = 470;
const GAP = 16;
const CX = (i: number) => -((CW * 5 + GAP * 4) / 2) + CW / 2 + i * (CW + GAP);
const CY = -20;
const MID = 70; // demo centre inside a cell

const CELLS = [
  { title: 'PROOF ORBIT', chip: 'orbitSweep', icon: 'orbit', rule: ['Arc grows clockwise from', 'twelve; dotted = pending.'] },
  { title: 'PACKET RAIL', chip: 'packetDrift', icon: 'drift', rule: ['Motion shown by ghosted', 'positions — never blur.'] },
  { title: 'SELECTED BRANCH', chip: 'glyphBreathe', icon: 'glyph', rule: ['One focal point per screen;', 'the halo settles solid.'] },
  { title: 'GATE ATTENTION', chip: 'warningAttention', icon: 'warn', rule: ['Persistent peach stroke', 'and icon — never pulsing.'] },
  { title: 'REDUCED MOTION', chip: 'reducedMotion', icon: 'reduced', rule: ['Static dots, zero', 'translation, same meaning.'] },
] as const;

const RULES = ['NO MOTION BLUR', 'NO FLASHING', '≤ 2 NAMED ANIMATIONS AT ONCE', 'SOLID CHARTREUSE = SETTLED', 'PEACH = WARNING ONLY'];

function drawCell(c: CanvasRenderingContext2D, i: number) {
  const cell = CELLS[i];
  c.strokeStyle = HEX.mist;
  c.globalAlpha = 0.22;
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(0.5, 0.5, CW - 1, CH - 1, 8);
  c.stroke();
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
  (c as any).letterSpacing = '2px';
  c.fillText(cell.title, 62, 29);
  // rule text
  c.globalAlpha = 0.8;
  c.fillStyle = HEX.mist;
  c.font = `400 14px "${FONT.mono}"`;
  (c as any).letterSpacing = '0px';
  c.textAlign = 'center';
  cell.rule.forEach((line, k) => c.fillText(line, CW / 2, CH - 116 + k * 22));
  c.globalAlpha = 0.18;
  c.fillRect(24, CH - 140, CW - 48, 1);
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

export class LongMotion implements Act {
  id = 'l-motion';
  scene = new Scene();
  ui = new Scene();
  camera = new PerspectiveCamera(35, 16 / 9, 10, 20000);
  private topo!: Topo;
  private head!: TextBlock;
  private groups: Group[] = [];
  private frames: PaintSprite[] = [];
  private chipGlow: Stroke[] = [];
  private rules: TextSprite[] = [];
  private oTrack!: Ring;
  private oArc!: Ring;
  private oPct!: TextSprite;
  private oDots!: DotField;
  private oCheck!: Stroke;
  private oBadge!: Ring;
  private dRail!: Stroke;
  private dDots!: DotField;
  private gPetals: Stroke[] = [];
  private gArc!: Stroke;
  private gDots!: DotField;
  private gHalo!: Ring;
  private gHaloSolid!: Ring;
  private wCard!: PaintSprite;
  private wBorder!: Stroke;
  private wIcon: Stroke[] = [];
  private wPill!: PaintSprite;
  private wChevron!: Stroke;
  private rRail!: Stroke;
  private rDots!: DotField;
  private rRing!: Ring;
  private hair: Stroke[] = [];

  init(_ctx: Ctx) {
    this.topo = makeTopo({ w: 6000, h: 3600 });
    this.topo.material.uniforms.uAlpha.value = 0.11;
    this.topo.material.uniforms.uGrid.value = 0.05;
    this.topo.material.uniforms.uRippleR.value = -1e4;
    this.scene.add(this.topo);
    this.camera.position.set(0, 0, D0);

    this.head = new TextBlock(this.ui, -852, 412)
      .kicker('06 · THE FROZEN MOTION VOCABULARY')
      .title(['MOTION NAMES'], 84)
      .body(['Five primitives. Every animation in Cambium is one of them — or none.'], 18);

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

    this.oTrack = new Ring({ r: 84, w: 4, color: 'mist', dash: 26, dotted: true, opacity: 0.45 });
    this.oArc = new Ring({ r: 84, w: 4, color: 'signal' });
    this.oArc.u.uHead.value = 1;
    this.oPct = new TextSprite('0%', { font: 'mono', size: 32, weight: 500, color: 'paper', align: 'center' });
    this.oDots = new DotField(6, { core: 0.5, halo: 0.3 });
    this.oBadge = new Ring({ r: 15, w: 2.5, color: 'signal' });
    this.oCheck = new Stroke([[-7, 0, 0], [-2, -5, 0], [8, 6, 0]], { width: 2.5, color: 'signal' });
    for (const m of [this.oTrack.mesh, this.oArc.mesh]) m.position.y = MID;
    this.oBadge.mesh.position.set(84, MID, 0);
    this.oCheck.mesh.position.set(84, MID, 0);
    g0.add(this.oTrack.mesh, this.oArc.mesh, this.oPct.mesh, this.oDots.points, this.oBadge.mesh, this.oCheck.mesh);

    const sCurve = (amp: number): V3[] => {
      const pts: V3[] = [];
      for (let k = 0; k <= 60; k++) pts.push([-130 + (k / 60) * 260, MID + Math.sin((k / 60) * Math.PI * 2 - 0.4) * amp, 0]);
      return pts;
    };
    this.dRail = new Stroke(sCurve(30), { width: 3, color: 'mist', opacity: 0.4 });
    this.dDots = new DotField(16, { core: 0.48, halo: 0.3 });
    g1.add(this.dRail.mesh, this.dDots.points);

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
      arc.push([Math.cos(u) * -110, -Math.sin(u) * 52, 0]);
    }
    this.gArc = new Stroke(arc, { width: 3, color: 'mist', opacity: 0.5 });
    this.gDots = new DotField(4, { core: 0.5, halo: 0.3 });
    this.gHalo = new Ring({ r: 116, w: 3, color: 'signal', dash: 44, dotted: true, opacity: 0.8 });
    this.gHaloSolid = new Ring({ r: 116, w: 3, color: 'signal' });
    for (const r of [this.gHalo, this.gHaloSolid]) r.mesh.scale.set(1, 0.62, 1);
    g2.add(this.gArc.mesh, this.gHalo.mesh, this.gHaloSolid.mesh, this.gDots.points);

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
    this.wPill.mesh.position.set(66, MID - 46, 0);
    g3.add(this.wCard.mesh, this.wBorder.mesh, ...this.wIcon.map((s) => s.mesh), this.wChevron.mesh, this.wPill.mesh);

    this.rRail = new Stroke(sCurve(30), { width: 3, color: 'mist', opacity: 0.4 });
    this.rDots = new DotField(4, { core: 0.5, halo: 0.25 });
    this.rRing = new Ring({ r: 112, w: 2, color: 'mist', dash: 40, opacity: 0.4 });
    this.rRing.mesh.position.y = MID;
    g4.add(this.rRail.mesh, this.rDots.points, this.rRing.mesh);

    RULES.forEach((r) => {
      const s = new TextSprite(r, { font: 'mono', size: 14, tracking: 0.16, color: 'paper', align: 'center' });
      this.rules.push(s);
      this.ui.add(s.mesh);
    });
  }

  update(f: number) {
    const t = f - A0;
    this.camera.position.set(0, -10 + t * 0.04, D0 * (1 - 0.03 * ease(range(t, 0, 720))));
    this.camera.lookAt(0, 0, 0);
    this.topo.material.uniforms.uTime.value = 9.8 + (f / 60) * 0.03;

    const frozen = f >= FREEZE && f < FREEZE + 14;
    const ft = frozen ? FREEZE - A0 : t;
    const collapse = (i: number) => easeIn(range(t, 640 + i * 6, 668 + i * 6));
    this.head.update(f, A0 + 8, A0 + 636, 14);

    this.groups.forEach((g, i) => {
      const inT = pop(range(t, 45 + i * 45, 80 + i * 45));
      const c = collapse(i);
      g.position.set(CX(i), CY + (1 - inT) * -30, 0);
      g.scale.set(lerp(0.92, 1, inT), lerp(0.92, 1, inT) * (1 - c * 0.995), 1);
      g.visible = inT > 0.001 && c < 0.999;
      this.frames[i].opacity(clamp01(inT * 1.4));
      const running = i === 4 ? f >= FREEZE : t > 60 + i * 45;
      this.chipGlow[i].draw(e(t, 70 + i * 45, 110 + i * 45)).opacity(running ? 0.9 : 0);
      const h = this.hair[i];
      h.mesh.position.set(CX(i), CY, 0);
      h.draw(1, ease(range(t, 664 + i * 6, 690 + i * 6))).opacity(c > 0.5 ? 0.62 : 0);
    });

    // 01 orbitSweep: pending -> 54% (hold) -> 100% + badge
    const lt0 = ft - 60;
    const prog = lt0 < 30 ? 0 : lt0 < 130 ? 0.54 * ease(range(lt0, 30, 130)) : 0.54 + 0.46 * ease(range(lt0, 200, 300));
    this.oTrack.arc(1).opacity(0.45);
    this.oArc.arc(prog).opacity(prog > 0 ? 1 : 0);
    this.oPct.set(`${Math.round(prog * 100)}%`).at(0, MID - 4);
    this.oDots.begin();
    if (prog > 0) {
      const a = prog * Math.PI * 2;
      this.oDots.push(Math.sin(a) * 84, MID + Math.cos(a) * 84, 0, 14, COL.signal, 1);
      for (let g = 1; g < 3 && prog < 0.999; g++) {
        const b = (prog - g * 0.03) * Math.PI * 2;
        this.oDots.push(Math.sin(b) * 84, MID + Math.cos(b) * 84, 0, 10, COL.mist, 0.4 - g * 0.12);
      }
      if (prog >= 0.999) {
        this.oDots.push(0, MID + 84, 0, 11, COL.signal, 1);
        this.oDots.push(0, MID - 84, 0, 11, COL.signal, 1);
      }
    }
    this.oDots.end();
    const done = pop(range(lt0, 300, 330));
    this.oBadge.arc(1).opacity(done > 0 ? 1 : 0);
    this.oBadge.mesh.scale.setScalar(Math.max(0.001, done));
    this.oCheck.draw(ease(range(lt0, 312, 336))).opacity(done > 0 ? 1 : 0);

    // 02 packetDrift
    const lt1 = ft - 105;
    this.dRail.draw(ease(range(lt1, 0, 40))).opacity(0.4);
    this.dDots.begin();
    if (lt1 >= 0) {
      for (let k = 0; k < 3; k++) {
        const u = (k / 3 + lt1 * 0.0045) % 1;
        for (let g = 0; g < 3; g++) {
          const uu = u - g * 0.035;
          if (uu < 0) continue;
          const p = this.dRail.pointAt(uu);
          this.dDots.push(p.x, p.y, 0, g === 0 ? 15 : 11 - g * 2, g === 0 ? COL.signal : COL.mist, (g === 0 ? 0.95 : 0.42 - g * 0.12) * Math.min(1, uu * 6, (1 - uu) * 6));
        }
      }
    }
    this.dDots.end();

    // 03 glyphBreathe + selected halo
    const lt2 = ft - 150;
    const breathe = 1 + 0.05 * Math.sin((lt2 / 60) * Math.PI * 2 * 0.6);
    this.gPetals.forEach((s, k) => {
      s.mesh.position.set(0, MID + 6, 0);
      s.mesh.scale.setScalar(breathe);
      s.draw(ease(range(lt2, k * 4, 30 + k * 4))).opacity(0.9);
    });
    this.gArc.mesh.position.set(0, MID - 34, 0);
    this.gArc.draw(ease(range(lt2, 0, 36))).opacity(0.5);
    this.gDots.begin();
    if (lt2 > 0) {
      this.gDots.push(0, MID + 6, 0, 18 * breathe, COL.signal, 1);
      this.gDots.push(-96, MID - 60, 0, 13, COL.mist, 0.8);
      this.gDots.push(96, MID - 60, 0, 13, COL.mist, 0.8);
    }
    this.gDots.end();
    const sel = ease(range(lt2, 60, 150));
    for (const r of [this.gHalo, this.gHaloSolid]) r.mesh.position.set(0, MID - 14, 0);
    this.gHalo.arc(1).opacity(lt2 > 40 ? 0.6 * (1 - range(lt2, 150, 170)) : 0);
    this.gHaloSolid.arc(sel).opacity(1);

    // 04 warningAttention -> review
    const lt3 = ft - 195;
    const warn = ease(range(lt3, 40, 80));
    (this.wBorder.u.uColor.value as any).copy(COL.mist).lerp(COL.warning, warn);
    this.wBorder.draw(1).opacity(lerp(0.16, 0.62, warn));
    this.wIcon.forEach((s) => s.draw(ease(range(lt3, 50, 80))).opacity(1));
    const review = ease(range(lt3, 130, 160));
    this.wChevron.draw(1).opacity(0.62 * (1 - review));
    this.wPill.reveal(review).opacity(review > 0 ? 1 : 0);

    // 05 reducedMotion
    const lt4 = t - 240;
    this.rRail.draw(ease(range(lt4, 0, 40))).opacity(0.4);
    this.rDots.begin();
    if (lt4 > 10) for (const u of [0.18, 0.5, 0.82]) {
      const p = this.rRail.pointAt(u);
      this.rDots.push(p.x, p.y, 0, 14, COL.signal, 0.95);
    }
    this.rDots.end();
    this.rRing.arc(1).opacity(lt4 > 20 ? 0.4 : 0);

    // global rules strip, one rule per beat
    const rw = 1704 / RULES.length;
    this.rules.forEach((s, i) => {
      const k = ease(range(t, 360 + i * 45, 390 + i * 45));
      const out = 1 - ease(range(t, 630, 650));
      s.at(-852 + rw / 2 + i * rw, -330).reveal(k).opacity(k > 0 ? out * 0.85 : 0);
    });
  }
}
