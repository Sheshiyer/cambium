// Cambium operator · the typed, event-sourced world-state + its transforms.
// Pure functions: (world, …) → new world. The setpoint x* is a low-dim stub here;
// the real x* is the 1024-dim NIM point (cortex). See INFINITE-GAME.md §4–§5.

import type { WorldState, GameEvent, Margin, ViabilityReport } from './types.ts';

// Viability bounds (the hard ones that dominate the learned boundary — INFINITE-GAME.md §5.2).
export const SOLVENCY_FLOOR_DAYS = 30;   // below this runway → out of the game
export const COHERENCE_FLOOR = 0.40;     // below this mission-coherence → drifting out

export function createWorld(seed: Partial<WorldState> & { tenant: string; vision: string }): WorldState {
  return {
    tenant: seed.tenant,
    version: 0,
    vision: seed.vision,
    mission: seed.mission ?? 'pursue the vision now',
    goals: seed.goals ?? [],
    brand: seed.brand ?? { setpoint: [0, 0], label: 'unset', trustRegion: 0.25, coherence: 0.6 },
    artifacts: seed.artifacts ?? {},
    business: seed.business ?? { runwayDays: 120 },
    log: seed.log ?? [],
  };
}

const clone = (w: WorldState): WorldState => ({
  ...w, brand: { ...w.brand, setpoint: [...w.brand.setpoint] },
  goals: [...w.goals], artifacts: { ...w.artifacts }, business: { ...w.business }, log: [...w.log],
});

/** 1 · INGEST — upsert any artifact the event carries (the embed step is stubbed: no NIM yet). */
export function ingest(world: WorldState, event: GameEvent): WorldState {
  if (!event.artifact) return world;
  const next = clone(world);
  next.artifacts[event.artifact.id] = event.artifact.text;
  return next;
}

/** MICRO — a reversible on-mission tweak (no setpoint move). */
export function applyTweak(world: WorldState, event: GameEvent): WorldState {
  const next = clone(world);
  if (event.artifact) next.artifacts[event.artifact.id] = event.artifact.text;
  return next;
}

const norm = (v: number[]) => Math.hypot(...v) || 1;

/**
 * MACRO / allostasis — move the setpoint x* by step g, CLAMPED to the trust-region α.
 * Stability through change, but bounded. Coherence nudges up toward resonance (capped).
 */
export function moveSetpoint(world: WorldState, g: number[], alpha?: number): WorldState {
  const a = alpha ?? world.brand.trustRegion;
  const n = norm(g);
  const scale = n > a ? a / n : 1;                     // clamp ‖g‖ ≤ α
  const next = clone(world);
  next.brand.setpoint = world.brand.setpoint.map((x, i) => x + (g[i] ?? 0) * scale);
  next.brand.coherence = Math.min(1, world.brand.coherence + 0.05);
  return next;
}

/** The viability monitor (approx): hard bounds → margins. ≥ 0 = inside Viab(K). */
export function viability(world: WorldState): ViabilityReport {
  const margins: Margin[] = [
    { name: 'solvency', value: world.business.runwayDays - SOLVENCY_FLOOR_DAYS },
    { name: 'mission-coherence', value: world.brand.coherence - COHERENCE_FLOOR },
  ];
  return { margins, ok: margins.every((m) => m.value >= 0) };
}

/** EMERGENCY — a defensive move back inside the keep-playing set; overrides the planned act. */
export function emergencyMove(world: WorldState): WorldState {
  const next = clone(world);
  // pull the worst margin back to safe: top up runway to the floor, re-ground coherence.
  if (next.business.runwayDays < SOLVENCY_FLOOR_DAYS) next.business.runwayDays = SOLVENCY_FLOOR_DAYS;
  if (next.brand.coherence < COHERENCE_FLOOR) next.brand.coherence = COHERENCE_FLOOR;
  return next;
}

/** Fold one resolved wake into the world: bump the version + audit line (event sourcing). */
export function commit(world: WorldState, eventId: string, action: string): WorldState {
  const next = clone(world);
  next.version = world.version + 1;
  next.log.push(`#${next.version} ${eventId} → ${action}`);
  return next;
}
