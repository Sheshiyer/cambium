// Cambium operator · onboarding — the interactive runner (M1 / A3, issue #11).
// `operator onboard` walks the 20 interactions over the REAL wake loop: renders each
// Decision + viability margins, pauses for the founder (or --auto autoplays), and persists
// the session per step so it's resumable. UX only — the deterministic fold lives in
// session.ts (A2). A4 (#12) elevates the mid-brain → noesis beats; A5 (#13) the full panel.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface, type Interface } from 'node:readline';
import type { Decision, WakeDeps, OnboardingStep } from '../types.ts';
import { ONBOARDING_SCRIPT } from './script.ts';
import { initOnboarding, advance } from './session.ts';
import type { OnboardingState, OnboardingInput, OnboardingSeed } from './session.ts';
import { renderOctalysisPanel, DRIVE_NAMES } from './octalysis.ts';

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// DRIVE_NAMES is imported from ./octalysis.ts (the Octalysis source of truth, A5).
const PHASE_NAMES: Record<string, string> = {
  A: 'Discovery / The Calling', B: 'First Mint', C: 'Meet the Players', D: 'The Loop', E: 'The Infinite Hook',
};

export interface RunnerOpts {
  auto?: boolean;                              // autoplay — no pausing, no stdin
  restart?: boolean;                           // start fresh (ignore any saved session)
  tenant?: string;
  seed?: OnboardingSeed;
  stateDir?: string;                           // where the session persists (default <root>/.operator)
  deps?: WakeDeps;
  out?: (line: string) => void;                // injectable sink (tests) — default console.log
  input?: (prompt: string) => Promise<string>; // injectable input (tests/scripting) — default readline
  delayMs?: number;                            // --auto pacing
}

const statePath = (dir: string, tenant: string): string => join(dir, `${tenant}.onboarding.json`);

function loadState(dir: string, tenant: string, seed: OnboardingSeed): OnboardingState {
  const p = statePath(dir, tenant);
  if (existsSync(p)) {
    try { return JSON.parse(readFileSync(p, 'utf8')) as OnboardingState; } catch { /* corrupt → fresh */ }
  }
  return initOnboarding({ ...seed, tenant });
}

function saveState(dir: string, state: OnboardingState): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(statePath(dir, state.world.tenant), JSON.stringify(state, null, 2));
}

function driveTag(step: OnboardingStep): string {
  return `drive ${step.drive} · ${DRIVE_NAMES[step.drive]}  [${step.hat} hat · ${step.brain}-brain${step.brain === 'mid' ? ' → noesis' : ''}]`;
}

function renderStep(step: OnboardingStep, out: (s: string) => void): void {
  out('');
  out(`  ── #${step.n}/20 · Phase ${step.phase} (${PHASE_NAMES[step.phase]}) · ${step.title}`);
  out(`     ${driveTag(step)}`);
  out(`     "${step.narration}"`);
}

function renderDecision(state: OnboardingState, step: OnboardingStep, decision: Decision, out: (s: string) => void): void {
  const margins = decision.viability.margins.map((m) => `${m.name} ${m.value.toFixed(2)}${m.warn ? '⚠' : ''}`).join(' · ');
  const flags = [
    `[${decision.routing.class}${decision.noesis ? ' · noesis' : ''}]`,
    decision.setpointMoved ? '✓ x* moved' : '',
    decision.emergency ? '🛑 emergency' : '',
  ].filter(Boolean).join('  ');
  out(`     → reveals: ${step.reveals}`);
  out(`     ${flags}  ${decision.action}`);
  out(`     margins: ${margins}  ·  drives ${state.drivesActivated.length}/8  ·  v${state.world.version}`);
}

/**
 * The mid-brain → noesis HELD FRAME (A4). At the existential extremes (drive 1 Epic Meaning ·
 * drive 8 Loss) the operator steps OUT of the routine micro/meso/macro tick and hands the moment
 * to the human. Rendered distinctly — a set-apart block, not a compact metric line — so the beat
 * lands as *meaning*, not mechanics (ONBOARDING-OCTALYSIS.md §0).
 */
function renderNoesisFrame(step: OnboardingStep, state: OnboardingState, decision: Decision, out: (s: string) => void): void {
  const axis = step.drive === 1
    ? 'meaning — the calling that pulls you in'
    : step.drive === 8
      ? 'survival — the dread of dropping out of the game'
      : 'meaning ↕ survival';
  const rail = '─'.repeat(58);
  const margins = decision.viability.margins.map((m) => `${m.name} ${m.value.toFixed(2)}${m.warn ? '⚠' : ''}`).join(' · ');
  out('');
  out(`  ╭${rail}`);
  out('  │  ◆ NOESIS — the mid-brain wakes. This is bigger than the task.');
  out(`  │  the vertical axis: ${axis}`);
  out(`  │  drive ${step.drive} (${DRIVE_NAMES[step.drive]})  ⟶  ${decision.action}`);
  out('  │  The operator steps OUT of the routine micro/meso/macro tick and hands');
  out('  │  this moment to you — reflect on the *why*, not the mechanics.');
  out(`  ╰${rail}`);
  out(`     margins: ${margins}  ·  drives ${state.drivesActivated.length}/8  ·  v${state.world.version}`);
}

// The end-of-session summary now lives in renderOctalysisPanel (./octalysis.ts, A5).

function promptFor(step: OnboardingStep): string {
  if (step.event.kind === 'redirect') return '     » error or intent? [e/i] (Enter = keep scripted) ';
  if (step.event.artifact) return `     » set ${step.event.artifact.id}? (type text, or Enter to keep) `;
  return '     » Enter to continue ';
}

function parseInput(step: OnboardingStep, line: string): OnboardingInput {
  const t = (line ?? '').trim();
  if (!t) return {};
  if (step.event.kind === 'redirect') {
    if (/^(i|intent|y|yes)/i.test(t)) return { intent: true };
    if (/^(e|error|n|no)/i.test(t)) return { intent: false };
  }
  if (step.event.artifact) return { text: t };
  return {};
}

/**
 * Run the first session. Renders every step + its Decision, persists per step, returns the
 * final state. Input source priority: injected `opts.input` > interactive readline > (auto → none).
 */
export async function runOnboard(opts: RunnerOpts = {}): Promise<OnboardingState> {
  const out = opts.out ?? ((s) => console.log(s));
  const dir = opts.stateDir ?? join(DEFAULT_ROOT, '.operator');
  const tenant = opts.tenant ?? opts.seed?.tenant ?? 'onboarding';

  let state = opts.restart ? initOnboarding({ ...opts.seed, tenant }) : loadState(dir, tenant, opts.seed ?? {});

  out(state.stepIndex > 0
    ? `cambium · onboarding — resuming at #${state.stepIndex + 1}/20 (tenant ${tenant})`
    : 'cambium · onboarding — the first session: 20 interactions over the wake loop.');

  if (state.stepIndex >= ONBOARDING_SCRIPT.length) {
    out('  already complete — run `onboard --restart` to play again.');
    renderOctalysisPanel(state, out);
    return state;
  }

  let rl: Interface | null = null;
  let read: ((prompt: string) => Promise<string>) | null = opts.input ?? null;
  if (!read && !opts.auto) {
    rl = createInterface({ input: process.stdin, output: process.stdout });
    read = (p) => new Promise<string>((res) => rl!.question(p, res));
  }

  try {
    while (state.stepIndex < ONBOARDING_SCRIPT.length) {
      const step = ONBOARDING_SCRIPT[state.stepIndex];
      const isNoesis = step.brain === 'mid';        // drive ∈ {1,8} → the mid-brain bypass
      renderStep(step, out);
      const input = read && !isNoesis ? parseInput(step, await read(promptFor(step))) : {};
      const r = advance(state, input, opts.deps);
      state = r.state;
      if (r.decision!.noesis) {
        renderNoesisFrame(step, state, r.decision!, out);
        if (read) await read('     » (take a breath — Enter to continue) ');   // hold the moment for the human
      } else {
        renderDecision(state, step, r.decision!, out);
      }
      saveState(dir, state);
      if (opts.auto && opts.delayMs) await new Promise((res) => setTimeout(res, opts.delayMs));
    }
  } finally {
    rl?.close();
  }

  renderOctalysisPanel(state, out);
  return state;
}
