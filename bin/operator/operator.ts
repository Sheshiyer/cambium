// Cambium · the infinite-game operator — the WAKE LOOP (one move).
// INFINITE-GAME.md §9. Event-driven: ingest → route → act → viability → learn → persist.
// PURE given injected deps (no disk, no spawn) → fully testable. Reuses the why-handler
// (error-vs-intent + ledger line) and the cortex transport (injected as deps.record).

import type { WorldState, GameEvent, Decision, WakeDeps, GateVerdict } from './types.ts';
import { route } from './router.ts';
import { ingest, applyTweak, moveSetpoint, viability, emergencyMove, commit } from './world.ts';
import { icpNpc, founderNpc } from './npc.ts';
// reuse the existing seams (HOMEOSTASIS.md §7 / §12)
import { handleDeviation, recordDeviation } from '../lib/whyhandler.mjs';

/** The operator's own fail-closed setpoint gate: a macro move needs REAL evidence. */
function setpointGate(event: GameEvent): GateVerdict {
  if (!event.evidence) {
    return { allowed: false, reason: 'no real-player evidence — fail-closed (anti-echo-chamber)' };
  }
  return { allowed: true, reason: 'evidence present — within trust-region α' };
}

/** One move in the infinite game. Returns the new world + the decision (the audit unit). */
export function wake(world: WorldState, event: GameEvent, deps: WakeDeps): { world: WorldState; decision: Decision } {
  const icp = deps.icp ?? icpNpc;
  const founder = deps.founder ?? founderNpc;

  // 1 · INGEST  (embed step stubbed — no NIM yet)
  let next = ingest(world, event);

  // 2 · ROUTE  (micro/meso/macro Venn + the mid-brain bypass)
  const routing = route(event);

  // 3 · ACT
  let action = 'noop';
  let setpointMoved = false;
  let gate: GateVerdict | undefined;
  let npc: Decision['npc'];

  if (routing.class === 'midbrain') {
    // NOESIS bypass — the existential axis (meaning ↕ survival). No routine tick.
    action = event.kind === 'calling'
      ? 'noesis · reaffirm the vision (calling)'
      : 'noesis · defensive (loss/drift) + escalate to the human';
  } else if (routing.lane === 'micro') {
    next = applyTweak(next, event);
    action = 'micro · tweak applied (reversible · no setpoint move)';
  } else if (routing.lane === 'meso') {
    const icpReading = icp(next.brand.label);
    const founderReading = founder(event);
    npc = { icp: icpReading, founder: founderReading };
    // error-vs-intent via the why-handler, with the Founder-NPC as the intent oracle
    const handled = handleDeviation(
      { stage: event.id, reason: event.kind },
      { intent: founderReading.intentBit === 'intent' ? event.id : null },
    );
    if (handled.classification.kind === 'intent' && event.evidence) {
      gate = setpointGate(event);
      if (gate.allowed) {
        next = moveSetpoint(next, event.direction ?? icpReading.direction, deps.alpha);
        setpointMoved = true;
        action = 'meso · intent absorbed → setpoint moved (gated)';
      } else {
        action = 'meso · intent but no evidence → hold';
      }
    } else {
      action = `meso · ${handled.resolution.action} (no setpoint move)`;  // reroll toward same x*
    }
  } else if (routing.lane === 'macro') {
    gate = setpointGate(event);
    if (gate.allowed) {
      next = moveSetpoint(next, event.direction ?? [0, 0], deps.alpha);
      setpointMoved = true;
      action = 'macro · setpoint moved (evidence + gate)';
    } else {
      action = `macro · hold (${gate.reason})`;
    }
  }

  // 4 · VIABILITY — a margin breach pre-empts the planned act
  let report = viability(next);
  let emergency = false;
  if (!report.ok) {
    next = emergencyMove(next);
    emergency = true;
    setpointMoved = false;
    action = 'EMERGENCY · defensive move into Viab(K) — overrode the act';
    report = viability(next);
  }

  // 5 · LEARN  +  6 · PERSIST (version bump = event sourcing)
  next = commit(next, event.id, action);
  deps.record(recordDeviation({
    ts: null, stage: event.id, kind: routing.class, action,
    rationale: routing.noesis ? 'mid-brain → noesis' : null, reason: event.kind,
  }));

  return {
    world: next,
    decision: { event: event.id, routing, action, setpointMoved, noesis: routing.noesis, gate, npc, viability: report, emergency },
  };
}

/** Event sourcing: fold a stream of events through wake → deterministic final world. */
export function replay(world: WorldState, events: GameEvent[], deps: WakeDeps): WorldState {
  let w = world;
  for (const e of events) w = wake(w, e, deps).world;
  return w;
}
