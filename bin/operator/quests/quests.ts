// Cambium operator · quests — the startup flow as a quest line (M4 / W1 · M5 Phase Q ·
// M5 Phase Q Bridge). Like all good game engines: the venture's progression is a QUEST LOG.
// The doctrine (INFINITE-GAME.md): scarcity is real solvency, so progress must be REAL
// progress — every quest's status DERIVES from actual world-state and logs. There is no
// stored quest tracker to drift; this module is a pure fold (inputs → ledger), mirroring
// octalysisLedger (../onboarding/octalysis.ts). All I/O lives in the quine hypha.
//
// M5 Phase Q adds Paperclip-derived evidence: agent activity, issue flow, gate handoffs.
// M5 Phase Q Bridge extends the line: arcs I–IX are the operator tutorial (founder-level
// completion inherited by all tenants). Arcs X+ are the real project/delivery phases —
// each tenant tracks its own journey from brief → garden.

import type { PolicyPrioritySignals } from './operator-policy.ts';

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
  /** M5 Phase Q — Paperclip org plane (real activity, never decoration). */
  paperclip?: {
    reachable: boolean;
    agents: number;           // agents in the Thoughtseed Paperclip company
    issuesDone: number;       // issues completed
    issuesOpen: number;       // open work/handoffs
    agentErrors?: number;     // dashboard-visible agent error count
    pendingApprovals?: number;
  };
  /** M5 Phase Q Bridge — founder-level completion (arcs I–IX inherited by all tenants). */
  founder?: {
    completedArcs: string[];  // arc ids the founder has completed on any root tenant
  };
  /** M5 Phase Q Bridge — project/delivery evidence (arcs X+). */
  project?: {
    briefStatus?: 'draft' | 'accepted' | 'rejected';
    contractExists?: boolean;
    depositReceived?: boolean;
    repoExists?: boolean;
    tenantProvisioned?: boolean;
    specsFrozen?: boolean;
    buildCommits?: number;
    reviewEvents?: number;
    gateApprovals?: number;
    deployEvents?: number;
    clientSignOff?: boolean;
    lessonsMinted?: number;
    projectArchived?: boolean;
  };
  /** Explicit policy-facing priority contract. Visual decisionContext rows never substitute for this. */
  prioritySignals?: PolicyPrioritySignals;
}

export interface Quest {
  id: string;
  arc: string;              // 'I'..'IX'
  title: string;
  narration: string;        // one line, the quest-giver's voice
  reveals: string;          // the operator capability this quest proves
  doneWhen: (i: QuestInputs) => { done: boolean; evidence: string };
}

const count = (log: string[] | undefined, needle: string): number =>
  (log ?? []).filter((l) => l.includes(needle)).length;

const placeholderFree = (s: string | undefined): boolean => !!s && !s.includes('<');

const founderCompleted = (i: QuestInputs, id: string): boolean =>
  i.founder?.completedArcs?.includes(id) ?? false;

const liveOrg = (i: QuestInputs): NonNullable<QuestInputs['paperclip']> | undefined =>
  i.paperclip;

/** The quest line — seventeen arcs.
 *  I–IX : the operator tutorial (founder-level; inherited by all tenants).
 *  X–XVII : the project/delivery journey (tenant-specific; from brief to garden). */
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
      if (!done && founderCompleted(i, 'the-calling')) return { done: true, evidence: 'founder completed on root tenant' };
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
      if (!done && founderCompleted(i, 'first-mint')) return { done: true, evidence: 'founder completed on root tenant' };
      return { done, evidence };
    },
  },
  {
    id: 'taste-resonance', arc: 'III', title: 'Taste & Resonance',
    narration: 'Let the ICP push back — meso moves are the market talking.',
    reveals: 'the ICP-NPC + the meso lane',
    doneWhen: (i) => {
      const meso = count(i.world?.log, 'meso');
      const done = meso >= 3;
      if (!done && founderCompleted(i, 'taste-resonance')) return { done: true, evidence: 'founder completed on root tenant' };
      return { done, evidence: meso > 0 ? `meso ×${meso} — the ICP pushed back` : 'no meso moves yet' };
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
      const done = micro >= 1 && meso >= 1 && macro >= 1;
      if (!done && founderCompleted(i, 'the-loop')) return { done: true, evidence: 'founder completed on root tenant' };
      return { done, evidence: `micro ×${micro} · meso ×${meso} · macro ×${macro}` };
    },
  },
  {
    id: 'viability', arc: 'V', title: 'Viability',
    narration: 'Face the board — solvency and mission-coherence are real bounds, visibly swept.',
    reveals: 'the heartbeat + viability margins',
    doneWhen: (i) => {
      const beats = count(i.world?.log, 'heartbeat') + count(i.world?.log, 'viability');
      const done = beats >= 1;
      if (!done && founderCompleted(i, 'viability')) return { done: true, evidence: 'founder completed on root tenant' };
      return { done, evidence: beats > 0 ? `viability swept ×${beats}` : 'no heartbeat yet' };
    },
  },
  {
    id: 'memory', arc: 'VI', title: 'Memory',
    narration: 'The operator remembers — the cortex holds this venture across runs.',
    reveals: 'the cortex (semantic memory)',
    doneWhen: (i) => {
      if (i.cortexCount === undefined) {
        if (founderCompleted(i, 'memory')) return { done: true, evidence: 'founder completed on root tenant' };
        return { done: false, evidence: 'cortex unreachable' };
      }
      const done = i.cortexCount >= 1;
      if (!done && founderCompleted(i, 'memory')) return { done: true, evidence: 'founder completed on root tenant' };
      return { done, evidence: i.cortexCount >= 1 ? `${i.cortexCount} memories in the cortex` : 'cortex empty' };
    },
  },
  {
    id: 'many-gardens', arc: 'VII', title: 'Many Gardens',
    narration: 'One operator, many ventures — isolated worlds, isolated memories (M3).',
    reveals: 'multi-tenancy + the isolation suite',
    doneWhen: (i) => {
      const n = i.tenants?.length ?? 0;
      const done = n > 1 && i.isolationSuite === true;
      if (!done && founderCompleted(i, 'many-gardens')) return { done: true, evidence: 'founder completed on root tenant' };
      const evidence = `${n} garden${n === 1 ? '' : 's'} · isolation suite ${i.isolationSuite ? 'green' : 'pending (M3 open: C1–C4)'}`;
      return { done, evidence };
    },
  },
  {
    id: 'living-org', arc: 'VIII', title: 'The Living Org',
    narration: 'The org breathes — Paperclip agents, issues, and Hermes handoffs move.',
    reveals: 'Paperclip integration — real agent operations',
    doneWhen: (i) => {
      const m = liveOrg(i);
      if (!m || !m.reachable) {
        if (founderCompleted(i, 'living-org')) return { done: true, evidence: 'founder completed on root tenant' };
        return { done: false, evidence: 'Paperclip org unreachable' };
      }
      const done = m.agents >= 1;
      if (!done && founderCompleted(i, 'living-org')) return { done: true, evidence: 'founder completed on root tenant' };
      const errors = 'agentErrors' in m && m.agentErrors ? ` · ${m.agentErrors} error${m.agentErrors === 1 ? '' : 's'}` : '';
      const evidence = `${m.agents} agent${m.agents === 1 ? '' : 's'} · ${m.issuesDone} done · ${m.issuesOpen} open${errors}`;
      return { done, evidence };
    },
  },
  {
    id: 'the-gate', arc: 'IX', title: 'The Gate',
    narration: "The founder's hand reaches through Hermes — decisions land, Paperclip responds.",
    reveals: 'founder gate — Telegram actions drive real Paperclip state',
    doneWhen: (i) => {
      const m = liveOrg(i);
      if (!m || !m.reachable) {
        if (founderCompleted(i, 'the-gate')) return { done: true, evidence: 'founder completed on root tenant' };
        return { done: false, evidence: 'Paperclip org unreachable' };
      }
      const done = m.issuesDone >= 1;
      if (!done && founderCompleted(i, 'the-gate')) return { done: true, evidence: 'founder completed on root tenant' };
      const evidence = done
        ? `${m.issuesDone} handoff${m.issuesDone === 1 ? '' : 's'} resolved through Hermes/Paperclip`
        : `${m.issuesOpen} item${m.issuesOpen === 1 ? '' : 's'} awaiting first founder decision`;
      return { done, evidence };
    },
  },
  {
    id: 'the-brief', arc: 'X', title: 'The Brief',
    narration: 'The client says yes — scope locked, contract signed, deposit in hand.',
    reveals: 'venture definition + commercial commitment',
    doneWhen: (i) => {
      const p = i.project;
      const briefOk = p?.briefStatus === 'accepted';
      const contractOk = p?.contractExists === true;
      const depositOk = p?.depositReceived === true;
      const done = briefOk && contractOk && depositOk;
      const missing = [
        !briefOk && 'brief pending',
        !contractOk && 'contract pending',
        !depositOk && 'deposit pending',
      ].filter(Boolean);
      const evidence = done ? 'brief accepted · contract signed · deposit received' : missing.join(' · ') || 'no project evidence yet';
      return { done, evidence };
    },
  },
  {
    id: 'the-scaffold', arc: 'XI', title: 'The Scaffold',
    narration: 'The foundation is poured — repo, tenant, and spec ready to build on.',
    reveals: 'infrastructure provisioning + spec freeze',
    doneWhen: (i) => {
      const p = i.project;
      const repoOk = p?.repoExists === true;
      const tenantOk = p?.tenantProvisioned === true;
      const specOk = p?.specsFrozen === true;
      const done = repoOk && tenantOk && specOk;
      const ready = [repoOk && 'repo', tenantOk && 'tenant', specOk && 'spec'].filter(Boolean);
      const evidence = done ? 'repo · tenant · spec — all ready' : `${ready.join(' · ') || 'none'} ready · scaffold in progress`;
      return { done, evidence };
    },
  },
  {
    id: 'the-build', arc: 'XII', title: 'The Build',
    narration: 'Code flows — commits land, PRs merge, the shape emerges.',
    reveals: 'active development + delivery velocity',
    doneWhen: (i) => {
      const commits = i.project?.buildCommits ?? 0;
      return { done: commits >= 1, evidence: commits > 0 ? `${commits} commit${commits === 1 ? '' : 's'} on main` : 'no build activity yet' };
    },
  },
  {
    id: 'the-review', arc: 'XIII', title: 'The Review',
    narration: 'Quality is not assumed — it is inspected, tested, and signed off.',
    reveals: 'QA + stakeholder review loop',
    doneWhen: (i) => {
      const reviews = i.project?.reviewEvents ?? 0;
      return { done: reviews >= 1, evidence: reviews > 0 ? `${reviews} review round${reviews === 1 ? '' : 's'} completed` : 'no review rounds yet' };
    },
  },
  {
    id: 'the-ship-gate', arc: 'XIV', title: 'The Ship Gate',
    narration: "The founder's hand on the lever — approve, hold, or send back.",
    reveals: 'pre-launch founder approval (project gate)',
    doneWhen: (i) => {
      const approvals = i.project?.gateApprovals ?? 0;
      return { done: approvals >= 1, evidence: approvals > 0 ? `${approvals} approval${approvals === 1 ? '' : 's'} through the gate` : 'awaiting ship approval' };
    },
  },
  {
    id: 'the-launch', arc: 'XV', title: 'The Launch',
    narration: 'Live in the world — DNS cut, traffic flows, the garden opens.',
    reveals: 'production deployment + real users',
    doneWhen: (i) => {
      const deploys = i.project?.deployEvents ?? 0;
      return { done: deploys >= 1, evidence: deploys > 0 ? `${deploys} production deploy${deploys === 1 ? '' : 's'}` : 'not yet deployed' };
    },
  },
  {
    id: 'the-handoff', arc: 'XVI', title: 'The Handoff',
    narration: 'The client takes the keys — docs delivered, support plan active.',
    reveals: 'client acceptance + ongoing support contract',
    doneWhen: (i) => {
      const signed = i.project?.clientSignOff === true;
      return { done: signed, evidence: signed ? 'client signed off' : 'awaiting client acceptance' };
    },
  },
  {
    id: 'the-garden', arc: 'XVII', title: 'The Garden',
    narration: 'What grew here becomes seed — lessons minted into skills for the next garden.',
    reveals: 'project archive + skill minting (cross-run learning)',
    doneWhen: (i) => {
      const lessons = i.project?.lessonsMinted ?? 0;
      const archived = i.project?.projectArchived === true;
      const done = lessons >= 1 && archived;
      const evidence = archived
        ? `${lessons} lesson${lessons === 1 ? '' : 's'} minted · project archived`
        : `${lessons} lesson${lessons === 1 ? '' : 's'} minted · project still active`;
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
