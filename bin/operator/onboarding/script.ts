// Cambium operator · onboarding — the first-session script (M1 / A1, issue #9).
// 1:1 with ONBOARDING-OCTALYSIS.md §2: the 20 interactions, each engineered against an
// Octalysis core drive, each teaching one part of the micro/meso/macro loop, each
// asserting the RouteClass the real router must return for the event it injects.
//
// Design notes (kept honest by script.test.ts):
//   · hat + brain are DERIVED from the drive (one source of truth) so the table can't drift.
//   · `expect` is checked against the real route() — the script is provably router-faithful.
//   · The mid-brain → noesis steps (#1, #18, #20) carry drive ∈ {1,8}; every lane-teaching
//     step keeps 1/8 OUT of event.drives so it routes to its lane (the secondary mid-brain
//     weight, e.g. #13/#16's Loss, lives in the narration, not the router).
//   · Arc opens (#1) and closes (#20) on White-Hat Epic Meaning (drive 1, mid-brain) — the
//     correct shape for an infinite game (ONBOARDING-OCTALYSIS.md §0/§3).
//
// Node v26 runs this .ts natively — zero build, zero deps.  Contract: ../types.ts.

import type { Drive, Hat, Brain, OnboardingPhase, OnboardingStep, GameEvent, RouteClass } from '../types.ts';

/** Octalysis octagon → brain region. Vertical axis (1,8) = mid → noesis; odds = right, evens = left. */
export function brainOf(d: Drive): Brain {
  return d === 1 || d === 8 ? 'mid' : d % 2 === 1 ? 'right' : 'left';
}

/** Octalysis octagon → hat. White 1·2·3, Black 6·7·8, neutral axis 4·5 ('—' in the doc). */
export function hatOf(d: Drive): Hat {
  return d <= 3 ? 'white' : d >= 6 ? 'black' : 'neutral';
}

/** Build a step with hat/brain derived from the drive — keeps the data table honest. */
function step(
  n: number,
  title: string,
  phase: OnboardingPhase,
  drive: Drive,
  secondaryDrives: Drive[],
  narration: string,
  reveals: string,
  event: GameEvent,
  expect: RouteClass,
): OnboardingStep {
  return { n, title, phase, drive, secondaryDrives, hat: hatOf(drive), brain: brainOf(drive), narration, reveals, event, expect };
}

/**
 * The first 20 interactions — the onboarding tutorial. Source of truth: ONBOARDING-OCTALYSIS.md §2.
 * Phases: A Discovery/Calling (1–3) · B First Mint (4–8) · C Meet the Players (9–13) ·
 *         D The Loop (14–17) · E The Infinite Hook (18–20).
 */
export const ONBOARDING_SCRIPT: OnboardingStep[] = [
  // ── Phase A · Discovery / The Calling ───────────────────────────────────────
  step(1, 'The Calling', 'A', 1, [],
    "You're not building a product. You're starting an infinite game. — Plant a thoughtseed.",
    'the infinite-game frame',
    { id: 'onb-01-calling', kind: 'calling', drives: [1] },
    'midbrain'),

  step(2, 'Name the Just Cause', 'A', 4, [1],
    'Write your vision in one sentence. The operator pins it as the near-invariant anchor — watch it barely move.',
    'the vision anchor',
    { id: 'onb-02-vision', kind: 'reposition', drives: [4], evidence: true, direction: [0.02, 0], note: 'pin the vision anchor (near-invariant)' },
    'macro'),

  step(3, 'Plant the seed', 'A', 7, [1],
    'Drop a raw idea. The operator accepts the thoughtseed and says: watch.',
    'idea ingestion',
    { id: 'onb-03-seed', kind: 'tweak', drives: [7], artifact: { id: 'seed', text: 'a raw idea — one sentence or a brand-config' }, note: 'ingest the thoughtseed' },
    'micro'),

  // ── Phase B · First Mint / Accomplishment ───────────────────────────────────
  step(4, 'Germination', 'B', 2, [7],
    'Genesis runs — watch the 7 waves complete live. A real progress bar, not a spinner.',
    'the genesis (meristem) organ',
    { id: 'onb-04-germination', kind: 'tweak', drives: [2], artifact: { id: 'brand-dna', text: 'genesis: 7 waves complete' }, note: 'genesis germination (finite run)' },
    'micro'),

  step(5, 'First light', 'B', 2, [4],
    'The minted brand-DNA appears — name, positioning, palette, voice, all at once. Your first real win.',
    'the brand-spec output',
    { id: 'onb-05-first-light', kind: 'tweak', drives: [2], artifact: { id: 'brand-dna', text: 'name · positioning · palette · voice' } },
    'micro'),

  step(6, 'Claim it', 'B', 4, [3],
    'Accept the brand-DNA — or edit one field. The world-state is now yours, and mutable.',
    'world-state mutability',
    { id: 'onb-06-claim', kind: 'tweak', drives: [4], artifact: { id: 'positioning', text: '<accepted, or one founder edit>' }, note: 'the world-state is now yours + mutable' },
    'micro'),

  step(7, 'The on-brand meter', 'B', 3, [2],
    'A live gauge appears — the on-brand score V. Green = on-brand. Your first quantified feedback.',
    'the cortex / taste · the V meter',
    { id: 'onb-07-meter', kind: 'tweak', drives: [3], note: 'surface the on-brand meter V = d(x, x*)' },
    'micro'),

  step(8, 'First booster', 'B', 3, [],
    'Nudge the voice tone — the operator re-projects every artifact on-brand, instantly. Choice → immediate effect.',
    'allostatic micro-correction',
    { id: 'onb-08-booster', kind: 'redirect', drives: [3], intent: true, note: 'nudge tone → re-project all artifacts on-brand' },
    'meso'),

  // ── Phase C · Meet the Players ──────────────────────────────────────────────
  step(9, 'Meet your customer', 'C', 5, [7],
    'Meet Mira — your Ideal Customer — a living character you can talk to.',
    'the ICP-NPC',
    { id: 'onb-09-meet-icp', kind: 'metric', drives: [5], note: 'introduce the ICP-NPC (Mira)' },
    'meso'),

  step(10, 'Interrogate the ICP', 'C', 7, [5],
    'Ask Mira what actually hurts. She answers — and pain-point vectors light up in the brand space.',
    'pain-point vectors',
    { id: 'onb-10-interrogate', kind: 'objection', drives: [7], note: 'ask the ICP what hurts → pain-point vectors' },
    'meso'),

  step(11, 'The resonance arrow', 'C', 3, [2],
    "The operator draws the arrow — the direction to move positioning so Mira's pain resolves. Follow it.",
    'the resonance direction g',
    { id: 'onb-11-resonance', kind: 'metric', drives: [3], note: 'the resonance gradient g = target − x*' },
    'meso'),

  step(12, 'Meet your mirror', 'C', 4, [5],
    'Meet your mirror — the Founder-NPC reflects your own operating logic and taste. Your intent oracle.',
    'the Founder-NPC',
    { id: 'onb-12-meet-mirror', kind: 'metric', drives: [4], note: 'introduce the Founder-NPC — the intent oracle' },
    'meso'),

  step(13, 'A surprising objection', 'C', 7, [8],
    "Mira raises an objection you didn't expect — curiosity, plus a small, productive uh-oh.",
    'co-evolution / objection signals',
    { id: 'onb-13-surprise', kind: 'objection', drives: [7], note: 'an unexpected objection — Red Queen co-evolution (the felt 8·Loss lives here, not in the router)' },
    'meso'),

  // ── Phase D · The Loop (micro → meso → macro + the gates) ───────────────────
  step(14, 'Your first micro move', 'D', 2, [3],
    'Make a tiny fine-tune — a CTA word. Auto-applied, instantly reversible. This is MICRO.',
    'the micro tick',
    { id: 'onb-14-micro', kind: 'tweak', drives: [2], artifact: { id: 'cta', text: '<one word>' }, note: 'MICRO — reversible fine-tune' },
    'micro'),

  step(15, 'Error or intent?', 'D', 3, [7],
    'Redirect something. The operator asks the one bit: bad step (reroll), or new intent (move the goal)? This is MESO.',
    'the error-vs-intent why-handler',
    { id: 'onb-15-error-or-intent', kind: 'redirect', drives: [3], intent: false, note: 'MESO — the one-bit question; defaults to error (fail-closed)' },
    'meso'),

  step(16, 'Move the goal (gated)', 'D', 4, [8],
    'Propose a reposition. The gate asks for real evidence and shows the trust-region cap. With evidence, x* moves — clamped. This is MACRO.',
    'the setpoint move + the fail-closed gate',
    { id: 'onb-16-move-goal', kind: 'reposition', drives: [4], evidence: true, direction: [0.15, 0.05], note: 'MACRO — gated, evidence-backed; clamped to the trust-region (the felt 8·Loss lives here)' },
    'macro'),

  step(17, 'The viability board', 'D', 6, [8],
    'The operator reveals the viability margins — solvency, mission-coherence. Runway is finite, and visible. Real scarcity.',
    'the viability monitor + the solvency bound',
    { id: 'onb-17-viability', kind: 'probe', drives: [6], note: 'the viability board — solvency + mission-coherence margins' },
    'heartbeat'),

  // ── Phase E · The Infinite Hook ─────────────────────────────────────────────
  step(18, "Don't drop out", 'E', 8, [2],
    'A drift is detected — a V spike. The operator warns: this moves you toward leaving the game. You correct. Relief.',
    'drift detection (Lyapunov)',
    { id: 'onb-18-dont-drop-out', kind: 'drift', drives: [8], note: 'a real V-spike → leaving the viability kernel' },
    'midbrain'),

  step(19, 'The replay', 'E', 4, [2],
    'Scrub the replay — the whole life of the venture so far, every move, learning accumulating. Deep ownership.',
    'the replay log / cross-run learning',
    { id: 'onb-19-replay', kind: 'metric', drives: [4], note: 'scrub the replay log — cross-run learning' },
    'meso'),

  step(20, 'The game continues', 'E', 1, [4, 6],
    "The operator goes dormant: the game never ends — I'll wake on your next move. You're now in the infinite game — Just Cause, brand, customer, margin, loop, all live.",
    'the wake loop / the infinite game',
    { id: 'onb-20-continue', kind: 'calling', drives: [1], note: 'dormant → wakes on the next move (secondary: 4 Ownership, 6 Anticipation)' },
    'midbrain'),
];

/** The number of interactions in the first session. */
export const ONBOARDING_LENGTH = ONBOARDING_SCRIPT.length;
