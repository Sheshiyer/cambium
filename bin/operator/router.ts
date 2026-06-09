// Cambium operator · the micro/meso/macro Venn router + the mid-brain bypass.
// Every event is classified → which lane, gated?, and whether the mid-brain (the
// vertical Octalysis axis: 1 Epic Meaning ↕ 8 Loss) routes it to noesis instead of a
// routine tick. See INFINITE-GAME.md §7 and ONBOARDING-OCTALYSIS.md.

import type { GameEvent, Routing, Lane } from './types.ts';

const MID_BRAIN_DRIVES = new Set([1, 8]);        // the vertical axis: meaning ↕ survival
const MID_BRAIN_KINDS = new Set(['calling', 'drift']);

const LANE_BY_KIND: Record<string, Lane> = {
  tweak: 'micro',
  redirect: 'meso',
  objection: 'meso',
  metric: 'meso',
  probe: 'meso',
  reposition: 'macro',
};

export function route(event: GameEvent): Routing {
  const firesMidBrain =
    MID_BRAIN_KINDS.has(event.kind) || (event.drives ?? []).some((d) => MID_BRAIN_DRIVES.has(d));

  if (firesMidBrain) {
    return {
      class: 'midbrain',
      lane: null,
      noesis: true,
      gated: true,                 // existential → escalate / deepest consideration
      why: `mid-brain (${event.kind}) — meaning↕survival → invoke noesis, bypass the routine tick`,
    };
  }

  const lane: Lane = LANE_BY_KIND[event.kind] ?? 'meso';
  return {
    class: lane,
    lane,
    noesis: false,
    gated: lane === 'macro',       // only macro setpoint moves are gated
    why: `${lane} — ${event.kind}`,
  };
}
