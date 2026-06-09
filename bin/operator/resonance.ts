// Cambium operator · resolve a REAL ICP reading — pains (LLM) + embeddings (NIM) → a true gradient.
// This is the meso "resolve" step: async + impure, so the pure wake stays sync. INFINITE-GAME.md §5.3/§8.

import type { IcpReading, WorldState } from './types.ts';
import { realIcp } from './npc.ts';
import { makeEmbedder, cosine, sub, l2normalize, type Embedder } from './embed.ts';

/** Ensure the world's setpoint x* is a real embedding of the positioning (dims match the embedder). */
export async function ensureSetpoint(world: WorldState, e: Embedder): Promise<WorldState> {
  if (world.brand.setpoint.length === e.dims) return world;
  const [x] = await e.embed([world.brand.label]);
  return { ...world, brand: { ...world.brand, setpoint: x } };
}

/**
 * Resolve the ICP against the world's positioning:
 *   1. the model gives pains + a direction phrase (in the persona's voice)
 *   2. embed the positioning's setpoint x*, the direction phrase (→ target), and each pain
 *   3. the resonance gradient g = normalize(target − x*) — the real direction to move x*
 *   4. resonance = cosine(x*, target) mapped to [0,1] — grounded in vector space, not a self-report
 * Falls back to text-only pains + stub vectors offline.
 */
export async function resolveIcp(
  world: WorldState,
  opts: { embedder?: Embedder; icpOpts?: Parameters<typeof realIcp>[1] } = {},
): Promise<IcpReading> {
  const e = opts.embedder ?? makeEmbedder();
  const w = await ensureSetpoint(world, e);
  const positioning = w.brand.label;
  const reading = await realIcp(positioning, opts.icpOpts);
  const targetText = reading.directionLabel || 'toward resonance with the customer';
  const [, vTarget, ...vPains] = await e.embed([positioning, targetText, ...reading.pains]);
  const x = w.brand.setpoint;
  const gradient = l2normalize(sub(vTarget, x));
  const resonance = (cosine(x, vTarget) + 1) / 2;        // [-1,1] → [0,1]
  return { ...reading, direction: gradient, painVectors: vPains, resonance, dims: e.dims };
}
