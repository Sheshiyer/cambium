// Cambium operator · quests — the startup flow as a quest line (M4 / W1).
// Like all good game engines: the venture's progression is a QUEST LOG. The doctrine
// (INFINITE-GAME.md): scarcity is real solvency, so progress must be REAL progress —
// every quest's status DERIVES from actual world-state and logs. There is no stored
// quest tracker to drift; this module is a pure fold (inputs → ledger), mirroring
// octalysisLedger (../onboarding/octalysis.ts). All I/O lives in the quine hypha.

export type QuestStatus = 'complete' | 'active' | 'locked';

/** Everything the quest fold may look at — gathered (fail-soft) by the hypha layer. */
export interface QuestInputs {
  onboarding?: {
    stepIndex: number;
    drivesActivated: number[];
    noesisMoments: number;
  };
  /** Merged view: onboarding-session world + main operator world (artifacts ∪, logs ⧺). */
  world?: {
    version: number;
    artifacts: Record<string, string>;
    log: string[];
  };
  cortexCount?: number;     // memory records for this tenant (undefined = cortex unreachable)
  tenants?: string[];       // tenants with a world on disk
  isolationSuite?: boolean; // M3 C4 isolation suite present in the repo
}

export interface Quest {
  id: string;
  arc: string;              // 'I'..'VII'
  title: string;
  narration: string;        // one line, the quest-giver's voice
  reveals: string;          // the operator capability this quest proves
  doneWhen: (i: QuestInputs) => { done: boolean; evidence: string };
}

const count = (log: string[] | undefined, needle: string): number =>
  (log ?? []).filter((l) => l.includes(needle)).length;

const placeholderFree = (s: string | undefined): boolean => !!s && !s.includes('<');

/** The quest line — seven arcs mirroring the REAL flow: first session → mint → taste →
 *  the loop → viability → memory → many gardens (M3). Order is the dependency order. */
export const QUEST_LINE: Quest[] = [
  {
    id: 'the-calling', arc: 'I', title: 'The Calling',
    narration: 'Play the first session — 20 interactions, all 8 drives, the noesis beats.',
    reveals: 'the onboarding organ (Octalysis tutorial)',
    doneWhen: (i) => {
      const o = i.onboarding;
      const done = !!o && o.stepIndex >= 20 && o.drivesActivated.length >= 8 && o.noesisMoments >= 3;
      const evidence = o
        ? `${Math.min(o.stepIndex, 20)}/20 steps · ${o.drivesActivated.length}/8 drives · noesis ${o.noesisMoments}`
        : 'first session unplayed';
      return { done, evidence };
    },
  },
  {
    id: 'first-mint', arc: 'II', title: 'First Mint',
    narration: 'Claim a real brand-DNA — seed, positioning, and a one-word CTA of your own.',
    reveals: 'genesis output + world-state mutability',
    doneWhen: (i) => {
      const a = i.world?.artifacts ?? {};
      const done = placeholderFree(a.seed) && placeholderFree(a.positioning) && placeholderFree(a.cta);
      const evidence = done
        ? `brand-DNA claimed — cta "${a.cta}"`
        : `artifacts pending — ${['seed', 'positioning', 'cta'].filter((k) => !placeholderFree(a[k])).join(', ') || 'none'} unclaimed`;
      return { done, evidence };
    },
  },
  {
    id: 'taste-resonance', arc: 'III', title: 'Taste & Resonance',
    narration: 'Let the ICP push back — meso moves are the market talking.',
    reveals: 'the ICP-NPC + the meso lane',
    doneWhen: (i) => {
      const meso = count(i.world?.log, 'meso');
      return { done: meso >= 3, evidence: meso > 0 ? `meso ×${meso} — the ICP pushed back` : 'no meso moves yet' };
    },
  },
  {
    id: 'the-loop', arc: 'IV', title: 'The Loop',
    narration: 'Exercise all three tick-rates — micro tweak, meso reroll, macro setpoint move through the gate.',
    reveals: 'micro / meso / macro + the evidence gate',
    doneWhen: (i) => {
      const micro = count(i.world?.log, 'micro');
      const meso = count(i.world?.log, 'meso');
      const macro = count(i.world?.log, 'macro');
      return {
        done: micro >= 1 && meso >= 1 && macro >= 1,
        evidence: `micro ×${micro} · meso ×${meso} · macro ×${macro}`,
      };
    },
  },
  {
    id: 'viability', arc: 'V', title: 'Viability',
    narration: 'Face the board — solvency and mission-coherence are real bounds, visibly swept.',
    reveals: 'the heartbeat + viability margins',
    doneWhen: (i) => {
      const beats = count(i.world?.log, 'heartbeat') + count(i.world?.log, 'viability');
      return { done: beats >= 1, evidence: beats > 0 ? `viability swept ×${beats}` : 'no heartbeat yet' };
    },
  },
  {
    id: 'memory', arc: 'VI', title: 'Memory',
    narration: 'The operator remembers — the cortex holds this venture across runs.',
    reveals: 'the cortex (semantic memory)',
    doneWhen: (i) => {
      if (i.cortexCount === undefined) return { done: false, evidence: 'cortex unreachable' };
      return {
        done: i.cortexCount >= 1,
        evidence: i.cortexCount >= 1 ? `${i.cortexCount} memories in the cortex` : 'cortex empty',
      };
    },
  },
  {
    id: 'many-gardens', arc: 'VII', title: 'Many Gardens',
    narration: 'One operator, many ventures — isolated worlds, isolated memories (M3).',
    reveals: 'multi-tenancy + the isolation suite',
    doneWhen: (i) => {
      const n = i.tenants?.length ?? 0;
      const done = n > 1 && i.isolationSuite === true;
      const evidence = `${n} garden${n === 1 ? '' : 's'} · isolation suite ${i.isolationSuite ? 'green' : 'pending (M3 open: C1–C4)'}`;
      return { done, evidence };
    },
  },
];

export interface QuestLedgerRow {
  quest: Quest;
  status: QuestStatus;
  evidence: string;
}

export interface QuestLedger {
  rows: QuestLedgerRow[];
  completed: number;
  total: number;
  /** The active quest (first incomplete whose predecessor is complete) — null when all done. */
  current: Quest | null;
}

/** The pure fold: inputs → quest ledger. Empty inputs ⇒ zero complete (no fake progress). */
export function questLedger(inputs: QuestInputs): QuestLedger {
  const results = QUEST_LINE.map((q) => ({ quest: q, ...q.doneWhen(inputs) }));
  const rows: QuestLedgerRow[] = [];
  let current: Quest | null = null;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    let status: QuestStatus;
    if (r.done) status = 'complete';
    else if (!current) { status = 'active'; current = r.quest; }   // the frontier: first incomplete quest
    else status = 'locked';
    rows.push({ quest: r.quest, status, evidence: r.evidence });
  }
  return { rows, completed: rows.filter((r) => r.status === 'complete').length, total: rows.length, current };
}
