// Global HUD: the board chrome that frames every Cambium surface — 8px ruler,
// spec line, section index, reel progress, live telemetry and corner brackets.
// Driven by the active cut's sections so the same chrome serves every edit.
import { Scene } from 'three';
import type { Ctx, Overlay } from '../engine.ts';
import { e, ease, range } from '../lib/ease.ts';
import { PaintSprite, TextSprite } from '../lib/text.ts';
import { Stroke } from '../lib/shapes.ts';
import { HEX } from '../tokens.ts';
import { H, W } from '../timeline.ts';
import { sectionAt, type CutSpec } from '../cuts/spec.ts';

const M = 56; // outer margin (7 grid units)

export interface HudTiming {
  fadeIn: [number, number];
  brackets: [number, number];
  ruler: [number, number];
  spec: [number, number];
  brand: [number, number];
}

export const REEL_HUD: HudTiming = {
  fadeIn: [14, 40],
  brackets: [10, 34],
  ruler: [18, 62],
  spec: [26, 70],
  brand: [34, 70],
};

export type Telemetry = (f: number) => { nodes: number; packets: number };

export class Hud implements Overlay {
  scene = new Scene();
  private ruler!: PaintSprite;
  private spec!: TextSprite;
  private brand!: TextSprite;
  private act!: TextSprite;
  private tele!: TextSprite;
  private time!: TextSprite;
  private progTrack!: Stroke;
  private progFill!: Stroke;
  private brackets: Stroke[] = [];

  constructor(
    private cut: CutSpec,
    private telemetry: Telemetry,
    private timing: HudTiming = REEL_HUD,
  ) {}

  init(_ctx: Ctx) {
    const rw = W - M * 2;
    this.ruler = new PaintSprite(rw, 28, (c) => {
      c.strokeStyle = HEX.mist;
      c.fillStyle = HEX.mist;
      c.globalAlpha = 0.34;
      c.fillRect(0, 27, rw, 1);
      for (let x = 0; x <= rw; x += 8) {
        const major = x % 64 === 0;
        c.globalAlpha = major ? 0.62 : 0.26;
        c.fillRect(Math.round(x), major ? 17 : 22, 1, major ? 10 : 5);
      }
      c.globalAlpha = 0.62;
      c.font = '500 10px "ReelMono"';
      c.textBaseline = 'alphabetic';
      for (let x = 0, i = 0; x <= rw; x += 128, i++) c.fillText(String(i * 16), x + 3, 12);
    });
    this.ruler.mesh.position.set(0, H / 2 - M + 2, 0);
    this.spec = new TextSprite('GRID 8PX · BASE UNIT 8 · RADIUS 2/4/8/16 · ELEVATION 0/1/2/4', {
      font: 'mono', size: 13, tracking: 0.1, color: 'mist',
    });
    this.brand = new TextSprite('CAMBIUM DESIGN SYSTEM · v1.0.0', { font: 'mono', size: 13, tracking: 0.14, color: 'signal', align: 'right' });
    this.act = new TextSprite(this.cut.sections[0].label, { font: 'mono', size: 14, tracking: 0.18, color: 'paper' });
    this.tele = new TextSprite('', { font: 'mono', size: 13, tracking: 0.08, color: 'mist', align: 'right' });
    this.time = new TextSprite('', { font: 'mono', size: 13, tracking: 0.08, color: 'signal', align: 'right' });
    const by = -H / 2 + M - 10;
    this.progTrack = new Stroke([[-W / 2 + M, by, 0], [-W / 2 + M + 240, by, 0]], { width: 2, color: 'mist', opacity: 0.18 });
    this.progFill = new Stroke([[-W / 2 + M, by, 0], [-W / 2 + M + 240, by, 0]], { width: 2, color: 'signal' });
    const L = 22;
    const x0 = W / 2 - 32;
    const y0 = H / 2 - 32;
    for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      this.brackets.push(
        new Stroke(
          [
            [sx * x0, sy * (y0 - L), 0],
            [sx * x0, sy * y0, 0],
            [sx * (x0 - L), sy * y0, 0],
          ],
          { width: 1.5, color: 'mist', opacity: 0.34 },
        ),
      );
    }
    this.scene.add(
      this.ruler.mesh, this.spec.mesh, this.brand.mesh, this.act.mesh, this.tele.mesh, this.time.mesh,
      this.progTrack.mesh, this.progFill.mesh, ...this.brackets.map((b) => b.mesh),
    );
  }

  update(f: number) {
    const T = this.timing;
    // HUD lives from ignition until the final section hands over to its own footer
    const last = this.cut.sections[this.cut.sections.length - 1].start;
    const vis = e(f, ...T.fadeIn) * (1 - e(f, last - 6, last + 8));
    const top = H / 2 - M - 22;
    this.ruler.reveal(e(f, ...T.ruler)).opacity(vis);
    this.spec.at(-W / 2 + M, top).reveal(e(f, ...T.spec)).opacity(vis * 0.7);
    this.brand.at(W / 2 - M, top).reveal(e(f, ...T.brand)).opacity(vis * 0.9);
    for (const b of this.brackets) b.draw(e(f, ...T.brackets)).opacity(vis * 0.34);

    const sec = sectionAt(this.cut, f);
    this.act.set(sec.label);
    const roll = sec === this.cut.sections[0] ? 0 : 1 - ease(range(f, sec.start, sec.start + 12));
    this.act.at(-W / 2 + M, -H / 2 + M + 8).rise(-roll).opacity(vis);
    this.progTrack.draw(1).opacity(vis * 0.18);
    this.progFill.draw(f / (this.cut.total - 1)).opacity(vis);

    const { nodes, packets } = this.telemetry(f);
    this.tele
      .set(`FPS 60 · NODES ${String(nodes).padStart(2, '0')}/17 · PACKETS ${packets.toLocaleString('en-US').padStart(5, '0')}`)
      .at(W / 2 - M - 118, -H / 2 + M + 8)
      .opacity(vis * 0.75);
    const s = Math.floor(f / 60);
    const fr = f % 60;
    const mm = Math.floor(s / 60);
    const clock = this.cut.total > 3600 ? `T+${String(mm).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `T+${String(s).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
    this.time.set(clock).at(W / 2 - M, -H / 2 + M + 8).opacity(vis);
  }
}
