// Cambium operator · onboarding — the first-session script (M1 / A1, issue #9).
// 1:1 with ONBOARDING-OCTALYSIS.md's 20-interaction table. The focused parity
// test parses that table so titles, experience copy, drives, layers, and evidence
// semantics cannot drift silently again.
//
// A motivational drive is not itself a routing instruction. Interaction 4, for
// example, is motivated by drives 1·4 but remains a routine meso interaction.
// Only the three doctrine-declared noesis peaks (1, 18, 20) inject a mid-brain
// routing drive. This keeps the tutorial ethical and the router deterministic.

import type { Drive, Hat, Brain, OnboardingPhase, OnboardingStep, GameEvent, RouteClass } from '../types.ts';

export type OnboardingDoctrineLayer =
  | 'macro/noesis'
  | 'macro'
  | 'macro→meso'
  | 'meso'
  | 'micro'
  | 'meso/noesis'
  | 'cross-run';

/** Runtime fields copied verbatim from the doctrine table and parity-checked. */
export interface OnboardingRuntimeStep extends OnboardingStep {
  doctrineLayer: OnboardingDoctrineLayer;
  evidenceState: string;
}

/** Octalysis octagon → brain region. Vertical axis (1,8) = mid; odds = right, evens = left. */
export function brainOf(d: Drive): Brain {
  return d === 1 || d === 8 ? 'mid' : d % 2 === 1 ? 'right' : 'left';
}

/** Octalysis octagon → hat. White 1·2·3, Black 6·7·8, neutral axis 4·5. */
export function hatOf(d: Drive): Hat {
  return d <= 3 ? 'white' : d >= 6 ? 'black' : 'neutral';
}

/** Build a doctrine-backed step; routing brain follows the declared noesis boundary. */
function step(
  n: number,
  title: string,
  phase: OnboardingPhase,
  drive: Drive,
  secondaryDrives: Drive[],
  narration: string,
  reveals: string,
  doctrineLayer: OnboardingDoctrineLayer,
  evidenceState: string,
  event: GameEvent,
  expect: RouteClass,
): OnboardingRuntimeStep {
  return {
    n,
    title,
    phase,
    drive,
    secondaryDrives,
    hat: hatOf(drive),
    brain: expect === 'midbrain' ? 'mid' : brainOf(event.drives?.find((d) => d !== 1 && d !== 8) ?? drive),
    narration,
    reveals,
    doctrineLayer,
    evidenceState,
    event,
    expect,
  };
}

/**
 * The first 20 interactions. Source of truth: ONBOARDING-OCTALYSIS.md.
 * Phases group the experience without claiming operational evidence:
 * A identity/frontier (1–3), B story/mission/authority (4–8),
 * C customer/signal (9–13), D controlled change (14–17), E foldback (18–20).
 */
export const ONBOARDING_SCRIPT: OnboardingRuntimeStep[] = [
  step(
    1,
    'The Calling',
    'A',
    1,
    [],
    'Choose one identified project and state why it should continue.',
    'the durable cause and infinite-game frame',
    'macro/noesis',
    'Doctrine',
    { id: 'onb-01-calling', kind: 'calling', drives: [1], note: 'reflect on why this identified project should continue' },
    'midbrain',
  ),
  step(
    2,
    'Confirm identity',
    'A',
    4,
    [],
    'See its canonical WorkObject, parent, aliases, and provenance.',
    'canonical identity and provenance',
    'macro',
    'Local · Workbench',
    { id: 'onb-02-identity', kind: 'reposition', drives: [4], evidence: false, note: 'read identity authority; do not mutate the goal' },
    'macro',
  ),
  step(
    3,
    'Read the frontier',
    'A',
    7,
    [],
    'See the current problem without a fabricated task.',
    'the evidence-backed frontier',
    'macro→meso',
    'Local · Fitcheck packet',
    { id: 'onb-03-frontier', kind: 'metric', drives: [7], note: 'read the current problem without fabricating a task' },
    'meso',
  ),
  step(
    4,
    'Read the story',
    'B',
    1,
    [4],
    'Inspect ICP, value hypothesis, and anti-claims together.',
    'the bounded project story',
    'meso',
    'Local · Fitcheck Operate',
    { id: 'onb-04-story', kind: 'metric', drives: [4], note: 'read ICP, hypothesis, and anti-claims without invoking noesis' },
    'meso',
  ),
  step(
    5,
    'See the missions',
    'B',
    2,
    [],
    'Reveal three bounded missions and their proof burden.',
    'bounded missions and proof burden',
    'meso',
    'Local · both UIs',
    { id: 'onb-05-missions', kind: 'metric', drives: [2], note: 'reveal planned missions, not live assignments' },
    'meso',
  ),
  step(
    6,
    'See target KPIs',
    'B',
    2,
    [4],
    'Show target evidence separately from achieved metrics.',
    'target-versus-achieved evidence boundaries',
    'meso',
    'Local · both UIs',
    { id: 'onb-06-kpis', kind: 'metric', drives: [2, 4], note: 'never render targets as achieved metrics' },
    'meso',
  ),
  step(
    7,
    'Inspect authority',
    'B',
    4,
    [],
    'Distinguish WorkObject, repositories, dependent programs, services, packet, D1, execution, and proof owners.',
    'the authority boundary ledger',
    'macro',
    'Local · both UIs',
    { id: 'onb-07-authority', kind: 'reposition', drives: [4], evidence: false, note: 'inspect authority boundaries; do not move the goal' },
    'macro',
  ),
  step(
    8,
    'Find the hold',
    'B',
    7,
    [],
    'Treat mapping-receipt readback or the first later missing stage as the next frontier.',
    'the lifecycle hold and next frontier',
    'meso',
    'Local · both UIs',
    { id: 'onb-08-hold', kind: 'metric', drives: [7], note: 'mapping-receipt readback is the first hold before later lifecycle stages' },
    'meso',
  ),
  step(
    9,
    'Meet the merchant',
    'C',
    5,
    [],
    'Review a grounded Shopify merchant hypothesis.',
    'the grounded customer hypothesis',
    'meso',
    'Doctrine / packet',
    { id: 'onb-09-merchant', kind: 'metric', drives: [5], note: 'review a hypothesis, not a simulated customer as truth' },
    'meso',
  ),
  step(
    10,
    'Ask what hurts',
    'C',
    5,
    [7],
    'Capture a real conversation, not a simulated answer as truth.',
    'the held external-evidence boundary',
    'meso',
    'Held · external evidence',
    { id: 'onb-10-pain', kind: 'objection', drives: [5, 7], note: 'hold until a real merchant conversation is captured' },
    'meso',
  ),
  step(
    11,
    'Propose one change',
    'C',
    3,
    [],
    'Convert the signal into one falsifiable next-intent proposal.',
    'a bounded next-intent proposal',
    'meso',
    'Local contract',
    { id: 'onb-11-proposal', kind: 'redirect', drives: [3], intent: true, note: 'prepare one falsifiable intent; do not approve it' },
    'meso',
  ),
  step(
    12,
    'Meet the mirror',
    'C',
    4,
    [5],
    'Surface assumptions, risk, taste, and claim boundaries.',
    'the founder reflection boundary',
    'meso',
    'Doctrine',
    { id: 'onb-12-mirror', kind: 'metric', drives: [4, 5], note: 'surface founder assumptions without manufacturing certainty' },
    'meso',
  ),
  step(
    13,
    'Face an objection',
    'C',
    7,
    [],
    'Preserve contradictory evidence instead of smoothing it away.',
    'contradictory evidence preservation',
    'meso',
    'Local packet pattern / held live evidence',
    { id: 'onb-13-objection', kind: 'objection', drives: [7], note: 'preserve contradiction and its provenance' },
    'meso',
  ),
  step(
    14,
    'Make a micro move',
    'D',
    2,
    [3],
    'Prepare one reversible change against the same intent version.',
    'the reversible micro proposal',
    'micro',
    'Local proposal path',
    { id: 'onb-14-micro', kind: 'tweak', drives: [2, 3], artifact: { id: 'cta', text: '<one reversible change>' }, note: 'prepare only; retain the same intent version' },
    'micro',
  ),
  step(
    15,
    'Error or intent?',
    'D',
    3,
    [7],
    'Classify divergence; default to error and hold.',
    'the fail-closed why-handler',
    'meso',
    'Local why-handler seam',
    { id: 'onb-15-divergence', kind: 'redirect', drives: [3, 7], intent: false, note: 'default to error and hold' },
    'meso',
  ),
  step(
    16,
    'Move the goal',
    'D',
    4,
    [],
    'Show evidence, trust boundary, graph version, and signed Gate.',
    'the signed macro Gate',
    'macro',
    'Local contract / held live action',
    { id: 'onb-16-goal', kind: 'reposition', drives: [4], evidence: true, direction: [0.15, 0.05], note: 'proposal still requires the authoritative signed Gate' },
    'macro',
  ),
  step(
    17,
    'Read viability',
    'D',
    6,
    [],
    'Inspect actual margins and missing evidence without synthetic certainty.',
    'actual viability margins and evidence gaps',
    'macro',
    'Doctrine; partial local signals',
    { id: 'onb-17-viability', kind: 'reposition', drives: [6], evidence: false, note: 'macro inspection only; missing evidence remains explicit' },
    'macro',
  ),
  step(
    18,
    'Do not drop out',
    'E',
    8,
    [],
    'Escalate a real integrity, solvency, or mission boundary.',
    'the evidence-gated survival noesis peak',
    'meso/noesis',
    'Held · requires real signal',
    { id: 'onb-18-boundary', kind: 'drift', drives: [8], note: 'invoke noesis only for a real integrity, solvency, or mission boundary' },
    'midbrain',
  ),
  step(
    19,
    'Replay the proof',
    'E',
    2,
    [4],
    'Read task, loadout, run, receipt, and foldback lineage.',
    'the cross-run proof lineage',
    'cross-run',
    'Local contracts / held live Fitcheck proof',
    { id: 'onb-19-replay', kind: 'metric', drives: [2, 4], note: 'read lineage without claiming held live proof exists' },
    'meso',
  ),
  step(
    20,
    'The game continues',
    'E',
    1,
    [4],
    'Return evidence to a bounded next intent; then rest.',
    'the approval-bound foldback and dormant wake loop',
    'macro/noesis',
    'Local contract / held live loop',
    { id: 'onb-20-continue', kind: 'calling', drives: [1], note: 'return evidence to purpose; never silently commit the next intent' },
    'midbrain',
  ),
];

/** The number of interactions in the first session. */
export const ONBOARDING_LENGTH = ONBOARDING_SCRIPT.length;
