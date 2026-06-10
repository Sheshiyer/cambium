// Cambium operator · the heartbeat — the self-scheduled event source so the operator is NOT
// blind while dormant (INFINITE-GAME.md §13, the first open question). A heartbeat is a `probe`
// event → a viability sweep that warns early, before a margin actually breaches.

import type { GameEvent, WorldState, WakeDeps, Decision } from './types.ts';
import { wake } from './operator.ts';

/** One heartbeat event — a scheduled viability sweep (no act; the viability step does the work). */
export function probeEvent(seq: number): GameEvent {
  return { id: `probe-${seq}`, kind: 'probe', note: 'heartbeat viability sweep' };
}

/**
 * Run heartbeats on an interval (a daemon). `load`/`step` are injected so this stays decoupled
 * from disk. Without `maxTicks` it runs until `stop()` (a real daemon); with it, it self-stops
 * (a bounded sweep — used for demos/tests). Returns a `stop()` handle.
 */
export function runHeartbeat(opts: {
  intervalMs: number;
  load: () => WorldState;
  step: (world: WorldState, decision: Decision) => void;
  deps: WakeDeps;
  maxTicks?: number;
}): { stop: () => void } {
  let seq = 0;
  const timer = setInterval(() => {
    seq += 1;
    const { world, decision } = wake(opts.load(), probeEvent(seq), opts.deps);
    opts.step(world, decision);
    if (opts.maxTicks && seq >= opts.maxTicks) clearInterval(timer);
  }, opts.intervalMs);
  return { stop: () => clearInterval(timer) };
}

/**
 * M3/C3 (issue #22): the multi-tenant heartbeat — ONE tick sweeps EVERY registered
 * tenant (not just $TENANT). `tenants` is injected (the registry lives with the CLI)
 * so this stays decoupled from disk, like runHeartbeat above.
 */
export function runHeartbeatMulti(opts: {
  intervalMs: number;
  tenants: () => string[];
  load: (tenant: string) => WorldState;
  step: (tenant: string, world: WorldState, decision: Decision) => void;
  deps: WakeDeps;
  maxTicks?: number;
}): { stop: () => void } {
  let seq = 0;
  const timer = setInterval(() => {
    seq += 1;
    for (const tenant of opts.tenants()) {
      const { world, decision } = wake(opts.load(tenant), probeEvent(seq), opts.deps);
      opts.step(tenant, world, decision);
    }
    if (opts.maxTicks && seq >= opts.maxTicks) clearInterval(timer);
  }, opts.intervalMs);
  return { stop: () => clearInterval(timer) };
}
