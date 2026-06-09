// Cambium operator · onboarding — the session state machine (M1 / A2, issue #10).
// Folds the ONBOARDING_SCRIPT through the PURE wake loop → a deterministic first-run.
// No I/O, no async, no NIM: just (state, input) → (state, decision). The runner (A3)
// adds the interactive UX; the meter (A5) reads drivesActivated / noesisMoments.
// Contract: ../types.ts · ./script.ts · folds through ../operator.ts `wake`.

import type { WorldState, GameEvent, Decision, WakeDeps, Drive, OnboardingStep } from '../types.ts';
import { createWorld } from '../world.ts';
import { wake } from '../operator.ts';
import { ONBOARDING_SCRIPT } from './script.ts';

/** The onboarding session — folded over the wake loop, one interaction at a time. */
export interface OnboardingState {
  stepIndex: number;            // 0..20 (=== ONBOARDING_SCRIPT.length when complete)
  drivesActivated: Drive[];     // the Octalysis drives that fired, in order of first activation
  noesisMoments: number;        // count of mid-brain → noesis beats reached
  world: WorldState;            // the live, event-sourced world (version === events folded)
}

/** Founder input for one step — overrides the scripted event where the founder actually types/chooses. */
export interface OnboardingInput {
  text?: string;                // founder text (vision sentence, raw idea, edited field, CTA word…)
  intent?: boolean;             // the founder's error-vs-intent answer (the #15 one-bit question)
  evidence?: boolean;           // founder-supplied evidence (the #16 gated macro move)
}

/** Optional overrides for the starting world (defaults to the operator's own positioning, 2-D setpoint). */
export interface OnboardingSeed {
  tenant?: string;
  vision?: string;
  brand?: WorldState['brand'];
  business?: WorldState['business'];
}

const DEFAULT_DEPS: WakeDeps = { record: () => {} };   // no-op ledger keeps the fold pure + deterministic

/** A fresh first-run world. 2-D setpoint stub — no NIM needed for the onboarding fold. */
export function initOnboarding(seed: OnboardingSeed = {}): OnboardingState {
  const world = createWorld({
    tenant: seed.tenant ?? 'onboarding',
    vision: seed.vision ?? 'turn complex requirements into coherent systems people can own',
    brand: seed.brand ?? { setpoint: [0, 0], label: 'founder-led systems studio', trustRegion: 0.25, coherence: 0.7 },
    business: seed.business ?? { runwayDays: 120 },
  });
  return { stepIndex: 0, drivesActivated: [], noesisMoments: 0, world };
}

/** Apply founder input onto a scripted event (immutably) — only where the founder actually supplies it. */
function applyInput(event: GameEvent, input: OnboardingInput): GameEvent {
  let e = event;
  if (input.text !== undefined && event.artifact) e = { ...e, artifact: { ...event.artifact, text: input.text } };
  if (input.intent !== undefined) e = { ...e, intent: input.intent };
  if (input.evidence !== undefined) e = { ...e, evidence: input.evidence };
  return e;
}

export interface AdvanceResult {
  state: OnboardingState;
  step: OnboardingStep | null;   // the step just played (null if already complete)
  decision: Decision | null;     // the operator's decision for that step
  done: boolean;                 // true once the 20th step has been played
}

/**
 * Play exactly ONE interaction: fold the (input-adjusted) step event through `wake`, record the
 * drive that fired + any noesis beat, advance the cursor. Pure given deps (a no-op ledger by default);
 * never mutates the input state (event-sourcing immutability).
 */
export function advance(
  state: OnboardingState, input: OnboardingInput = {}, deps: WakeDeps = DEFAULT_DEPS,
): AdvanceResult {
  const step = ONBOARDING_SCRIPT[state.stepIndex];
  if (!step) return { state, step: null, decision: null, done: true };

  const event = applyInput(step.event, input);
  const { world, decision } = wake(state.world, event, deps);

  const drivesActivated = state.drivesActivated.includes(step.drive)
    ? state.drivesActivated
    : [...state.drivesActivated, step.drive];

  const next: OnboardingState = {
    stepIndex: state.stepIndex + 1,
    drivesActivated,
    noesisMoments: state.noesisMoments + (decision.noesis ? 1 : 0),
    world,
  };
  return { state: next, step, decision, done: next.stepIndex >= ONBOARDING_SCRIPT.length };
}

export interface RunResult {
  state: OnboardingState;
  steps: OnboardingStep[];
  decisions: Decision[];
}

/** Fold the WHOLE script (calling → dormant). `inputs[i]` is the founder input for the (i+1)-th step. */
export function runOnboarding(
  opts: { init?: OnboardingSeed; inputs?: OnboardingInput[]; deps?: WakeDeps } = {},
): RunResult {
  let state = initOnboarding(opts.init);
  const steps: OnboardingStep[] = [];
  const decisions: Decision[] = [];
  while (state.stepIndex < ONBOARDING_SCRIPT.length) {
    const r = advance(state, opts.inputs?.[state.stepIndex] ?? {}, opts.deps);
    state = r.state;
    if (r.step) steps.push(r.step);
    if (r.decision) decisions.push(r.decision);
  }
  return { state, steps, decisions };
}
