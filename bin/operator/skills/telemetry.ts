// Cambium operator · skills — usage telemetry + self-improvement (M4 / W2).
// A skill LEARNS from being used: every use records a scenario (ok | fail + note);
// success feeds promotion (candidate → validated, rubric-aligned); failure feeds the
// gotchas list; a declining recent success rate triggers an APPENDED amendment proposal
// — the skill-creator failure→lesson loop, applied to machine-minted skills. Pure module:
// (skill, outcome) → new skill. Persistence lives in the quine hypha.

import type { SkillRecord, Amendment } from './forge.ts';

export const DECLINE_WINDOW = 5;      // look at the last N uses
export const DECLINE_MIN_USES = 3;    // need at least this many recent uses to judge
export const DECLINE_RATE = 0.5;      // recent rate below this = declining

export function successRate(skill: SkillRecord): number {
  return skill.telemetry.uses > 0 ? skill.telemetry.successes / skill.telemetry.uses : 0;
}

/** Success rate over the last DECLINE_WINDOW scenarios. */
export function recentRate(skill: SkillRecord): { rate: number; n: number } {
  const recent = skill.telemetry.scenarios.slice(-DECLINE_WINDOW);
  if (recent.length === 0) return { rate: 0, n: 0 };
  return { rate: recent.filter((s) => s.ok).length / recent.length, n: recent.length };
}

export function isDeclining(skill: SkillRecord): boolean {
  const { rate, n } = recentRate(skill);
  return n >= DECLINE_MIN_USES && rate < DECLINE_RATE;
}

function amendmentFor(skill: SkillRecord, now: number): Amendment {
  const { rate, n } = recentRate(skill);
  const lastFail = [...skill.telemetry.scenarios].reverse().find((s) => !s.ok);
  return {
    ts: now,
    reason: `success rate ${rate.toFixed(2)} over last ${n} uses (below ${DECLINE_RATE})`,
    proposal:
      'tighten trigger_signals or split the skill; review the latest failure' +
      (lastFail?.note ? `: "${lastFail.note}"` : '') +
      ' and add the lesson to gotchas before the next use.',
  };
}

/**
 * Record one use. Immutable: returns a new SkillRecord.
 * ok=true  → success count + promotion (candidate → validated on FIRST verified use).
 * ok=false → failure count + the note becomes a gotcha (dedup).
 * Either way: if the recent rate has gone into decline, append ONE amendment for this streak
 * (no duplicate amendments while the decline persists).
 */
export function recordUse(skill: SkillRecord, ok: boolean, note: string | undefined, now: number): SkillRecord {
  const scenarios = [...skill.telemetry.scenarios, { ts: now, ok, ...(note ? { note } : {}) }];
  const gotchas = !ok && note && !skill.telemetry.gotchas.includes(note)
    ? [...skill.telemetry.gotchas, note]
    : [...skill.telemetry.gotchas];

  let next: SkillRecord = {
    ...skill,
    status: ok && skill.status === 'candidate' ? 'validated' : skill.status,
    telemetry: {
      ...skill.telemetry,
      uses: skill.telemetry.uses + 1,
      successes: skill.telemetry.successes + (ok ? 1 : 0),
      failures: skill.telemetry.failures + (ok ? 0 : 1),
      scenarios,
      gotchas,
      amendments: [...skill.telemetry.amendments],
    },
    updated: now,
  };

  // One amendment per decline STREAK: append exactly on the transition into decline.
  if (isDeclining(next) && !isDeclining(skill)) {
    next = {
      ...next,
      telemetry: { ...next.telemetry, amendments: [...next.telemetry.amendments, amendmentFor(next, now)] },
    };
  }
  return next;
}
