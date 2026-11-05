// Editorial text block for the long cut: rule, kicker, DIN headline lines,
// mono body lines and key/value rows, stacked on the 8px rhythm. Each item
// lands on its own step (usually half a beat) and the whole block clears
// together. Headlines rise inside their own mask; mono lines wipe in.
import { Group, type Object3D } from 'three';
import { clamp01, ease, range } from './ease.ts';
import { Stroke } from './shapes.ts';
import { TextSprite } from './text.ts';
import type { Swatch } from '../tokens.ts';

type Item =
  | { kind: 'rule'; stroke: Stroke; y: number; w: number }
  | { kind: 'kicker' | 'body' | 'label'; sprite: TextSprite; y: number; alpha: number }
  | { kind: 'title'; sprite: TextSprite; y: number }
  | { kind: 'kv'; key: TextSprite; value: TextSprite; y: number };

export interface BlockOpts {
  align?: 'left' | 'center';
  /** key column width for kv rows */
  keyWidth?: number;
}

export class TextBlock {
  readonly group = new Group();
  private items: Item[] = [];
  private cursor: number;
  height = 0;

  constructor(parent: Object3D, private x: number, private y: number, private o: BlockOpts = {}) {
    this.cursor = y;
    parent.add(this.group);
  }

  private get align() {
    return this.o.align ?? 'left';
  }

  rule(w = 64, color: Swatch = 'signal') {
    const x0 = this.align === 'center' ? this.x - w / 2 : this.x;
    const s = new Stroke([[x0, 0, 0], [x0 + w, 0, 0]], { width: 3, color });
    s.mesh.position.y = this.cursor - 2;
    this.group.add(s.mesh);
    this.items.push({ kind: 'rule', stroke: s, y: this.cursor - 2, w });
    this.cursor -= 22;
    return this;
  }

  kicker(text: string, color: Swatch = 'signal', size = 15) {
    const s = new TextSprite(text, { font: 'mono', size, tracking: 0.16, color, align: this.align });
    const y = this.cursor - size * 0.7;
    this.group.add(s.mesh);
    this.items.push({ kind: 'kicker', sprite: s, y, alpha: 1 });
    this.cursor -= size * 2.2;
    return this;
  }

  title(lines: string[], size = 64, color: Swatch = 'paper') {
    for (const line of lines) {
      const s = new TextSprite(line, { font: 'display', size, tracking: 0.01, color, align: this.align, oversample: size > 100 ? 1.5 : 2 });
      const y = this.cursor - size * 0.42;
      this.group.add(s.mesh);
      this.items.push({ kind: 'title', sprite: s, y });
      this.cursor -= size * 0.98;
    }
    this.cursor -= size * 0.12;
    return this;
  }

  body(lines: string[], size = 20, color: Swatch = 'mist', alpha = 0.86) {
    for (const line of lines) {
      const s = new TextSprite(line, { font: 'mono', size, weight: 400, tracking: 0.02, color, align: this.align });
      const y = this.cursor - size * 0.65;
      this.group.add(s.mesh);
      this.items.push({ kind: 'body', sprite: s, y, alpha });
      this.cursor -= size * 1.7;
    }
    return this;
  }

  label(text: string, size = 14, color: Swatch = 'mist', alpha = 0.7) {
    const s = new TextSprite(text, { font: 'mono', size, tracking: 0.14, color, align: this.align });
    const y = this.cursor - size * 0.7;
    this.group.add(s.mesh);
    this.items.push({ kind: 'label', sprite: s, y, alpha });
    this.cursor -= size * 2;
    return this;
  }

  kv(key: string, value: string, size = 19) {
    const k = new TextSprite(key, { font: 'mono', size: 13, tracking: 0.18, color: 'signal' });
    const v = new TextSprite(value, { font: 'mono', size, weight: 400, tracking: 0.02, color: 'paper' });
    const y = this.cursor - size * 0.7;
    this.group.add(k.mesh, v.mesh);
    this.items.push({ kind: 'kv', key: k, value: v, y });
    this.cursor -= size * 1.85;
    return this;
  }

  gap(px: number) {
    this.cursor -= px;
    return this;
  }

  /** Reveal from `inAt`, one item every `step` frames; clear over 16 frames from `outAt`. */
  update(f: number, inAt: number, outAt: number, step = 10) {
    const out = 1 - ease(range(f, outAt, outAt + 16));
    const lift = ease(range(f, outAt, outAt + 16)) * 10;
    this.group.visible = f >= inAt - 1 && out > 0.001;
    if (!this.group.visible) return;
    this.items.forEach((it, i) => {
      const t0 = inAt + i * step;
      const k = ease(range(f, t0, t0 + 18));
      switch (it.kind) {
        case 'rule':
          it.stroke.mesh.position.y = it.y + lift;
          it.stroke.draw(k).opacity(out);
          break;
        case 'title':
          it.sprite.at(this.x, it.y + lift).rise(-(1 - k)).opacity(k > 0 ? out : 0);
          break;
        case 'kicker':
        case 'body':
        case 'label':
          it.sprite.at(this.x, it.y + lift).reveal(k).opacity(k > 0 ? out * it.alpha : 0);
          break;
        case 'kv':
          it.key.at(this.x, it.y + lift).reveal(clamp01(k * 1.6)).opacity(k > 0 ? out : 0);
          it.value.at(this.x + (this.o.keyWidth ?? 92), it.y + lift).reveal(k).opacity(k > 0 ? out : 0);
          break;
      }
    });
  }

  /** Last frame at which an item starts revealing, for scheduling. */
  doneAt(inAt: number, step = 10) {
    return inAt + (this.items.length - 1) * step + 18;
  }

  get bottom() {
    return this.cursor;
  }
}
