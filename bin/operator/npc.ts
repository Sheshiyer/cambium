// Cambium operator · the two meso NPCs — self-play, grounded by reality (INFINITE-GAME.md §8).
// STUBS today (deterministic, no NIM/LLM). The contract is what matters: they PROPOSE
// (pain-vectors, a resonance direction, an intent reading) but may not COMMIT — every
// setpoint move still needs REAL evidence + the gate (anti-echo-chamber).

import type { GameEvent, IcpReading, FounderReading } from './types.ts';

// tiny deterministic hash → a stable pseudo-vector, so the stub is reproducible (no Math.random).
function seed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 0xffffffff;
}

/** ICP-NPC ("Mira"): interrogated against the positioning → pains + a resonance direction g. */
export function icpNpc(positioning: string): IcpReading {
  const r = seed(positioning);
  return {
    simulated: true,
    pains: [
      'has to assemble coherence across single-slice vendors',
      'systems break at ownership transfer',
      'AI proposals are demos that never mature',
    ],
    direction: [Math.cos(r * 6.283), Math.sin(r * 6.283)],   // a unit step in brand-space (stub)
    resonance: Number((0.4 + 0.5 * r).toFixed(3)),
  };
}

/** Founder-NPC: the intent oracle for the error-vs-intent bit. Defaults to ERROR (fail-closed). */
export function founderNpc(event: GameEvent): FounderReading {
  return {
    simulated: true,
    intentBit: event.intent ? 'intent' : 'error',
    confidence: event.intent ? 0.7 : 0.6,
  };
}
