// Cambium operator · onboarding — the Octalysis progress meter (M1 / A5, issue #13).
// The end-of-session panel: which of the 8 core drives lit, the White/Black/mid-brain balance
// across the 20 interactions, and the mid-brain → noesis count. Reads the session ledger (A2)
// + the script design (A1). The runner (A3) calls renderOctalysisPanel at session end.

import type { Drive, Hat, Brain } from '../types.ts';
import { ONBOARDING_SCRIPT, hatOf, brainOf } from './script.ts';
import type { OnboardingState } from './session.ts';

/** The 8 Octalysis core drives — the canonical names (ONBOARDING-OCTALYSIS.md §0). */
export const DRIVE_NAMES: Record<number, string> = {
  1: 'Epic Meaning & Calling',
  2: 'Development & Accomplishment',
  3: 'Empowerment of Creativity & Feedback',
  4: 'Ownership & Possession',
  5: 'Social Influence & Relatedness',
  6: 'Scarcity & Impatience',
  7: 'Unpredictability & Curiosity',
  8: 'Loss & Avoidance',
};

const DRIVES: Drive[] = [1, 2, 3, 4, 5, 6, 7, 8];

export interface OctalysisLedger {
  drivesActivated: Drive[];            // from the session — the primary drives that fired (order of first hit)
  driveHits: Record<number, number>;   // per drive: # of steps engaging it (primary + secondary) across the script
  drivesCovered: Drive[];              // sorted 1..8 the script engages at all (primary ∪ secondary)
  hatTally: Record<Hat, number>;       // per-step hat counts across all 20 (sums to total)
  brainTally: Record<Brain, number>;   // per-step brain counts (sums to total)
  noesisMoments: number;               // from the session — mid-brain beats reached
  version: number;                     // world.version (events folded)
  total: number;                       // 20
}

/** Build the Octalysis ledger from a (typically completed) onboarding session. */
export function octalysisLedger(state: OnboardingState): OctalysisLedger {
  const hatTally: Record<Hat, number> = { white: 0, black: 0, neutral: 0 };
  const brainTally: Record<Brain, number> = { left: 0, right: 0, mid: 0 };
  const driveHits: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
  for (const s of ONBOARDING_SCRIPT) {
    hatTally[s.hat] += 1;
    brainTally[s.brain] += 1;
    driveHits[s.drive] += 1;
    for (const d of s.secondaryDrives ?? []) driveHits[d] += 1;
  }
  const drivesCovered = DRIVES.filter((d) => driveHits[d] > 0);
  return {
    drivesActivated: [...state.drivesActivated],
    driveHits,
    drivesCovered,
    hatTally,
    brainTally,
    noesisMoments: state.noesisMoments,
    version: state.world.version,
    total: ONBOARDING_SCRIPT.length,
  };
}

function meter(n: number, max: number, width = 8): string {
  const filled = max > 0 ? Math.round((n / max) * width) : 0;
  return '█'.repeat(filled) + '·'.repeat(Math.max(0, width - filled));
}

/** Render the end-of-session Octalysis panel (the runner calls this at session end). */
export function renderOctalysisPanel(state: OnboardingState, out: (s: string) => void): void {
  const L = octalysisLedger(state);
  const activated = new Set(L.drivesActivated);
  const maxHits = Math.max(...DRIVES.map((d) => L.driveHits[d]));
  out('');
  out('  ════════ Octalysis · the first session ════════');
  out('');
  out('  the 8 core drives                        hat · brain      fired');
  for (const d of DRIVES) {
    const name = DRIVE_NAMES[d].padEnd(38);
    const tag = `${hatOf(d)} · ${brainOf(d)}`.padEnd(16);
    const lit = activated.has(d) ? '✓' : '·';
    out(`  ${d}  ${name}${tag}${lit} ${meter(L.driveHits[d], maxHits)} ${L.driveHits[d]}×`);
  }
  out('');
  out(`  hat balance:   white ${L.hatTally.white} · neutral ${L.hatTally.neutral} · black ${L.hatTally.black}   ` +
    `(${L.hatTally.white > L.hatTally.black ? 'White-Hat dominant — the infinite-game shape' : 'check the balance'})`);
  out(`  brain axis:    left ${L.brainTally.left} · right ${L.brainTally.right} · mid ${L.brainTally.mid}   (mid-brain → noesis)`);
  out('');
  out(`  drives activated:  ${[...L.drivesActivated].sort((a, b) => a - b).join(' ')}   (${L.drivesActivated.length}/8)`);
  out(`  noesis moments:    ${L.noesisMoments}`);
  out(`  world version:     ${L.version}`);
  out('  the operator goes dormant — it will wake on your next move. The game continues.');
}
