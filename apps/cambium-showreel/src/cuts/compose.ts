// A composition = one cut's acts, shot table, transitions and overlays.
import type { Act, Ctx, Overlay, Shot, Transition } from '../engine.ts';
import type { CutSpec } from './spec.ts';
import { buildReel } from './reel.ts';
import { buildLong } from './long/index.ts';

export interface Composition {
  spec: CutSpec;
  acts: Act[];
  shots: Shot[];
  transitions: Transition[];
  overlays: (Overlay & { init?(ctx: Ctx): void })[];
}

export function buildCut(id: string, ctx: Ctx): Promise<Composition> {
  return id === 'long' ? buildLong(ctx) : buildReel(ctx);
}
