/**
 * Fitcheck L4 loop pack — one bounded loop per golden-path stage with ISA-style probes.
 *
 * Pure, reviewable, no Goal Graph writes. Loops diagnose and report; admission remains
 * a separate founder/CAS path. Aligns with docs/architecture/loops-to-graphs.md (L4).
 *
 * Schema: cambium.fitcheck-loop-pack.v1
 */

import { FITCHECK_GOLDEN_PATH } from './fitcheck-golden-path.ts';

export const FITCHECK_LOOP_PACK_SCHEMA = 'cambium.fitcheck-loop-pack.v1' as const;

export type LoopStageId =
  | 'identified'
  | 'systems-bound'
  | 'mapping-verified'
  | 'planned'
  | 'd1-eligible'
  | 'admitted'
  | 'pinned'
  | 'executed'
  | 'learned';

export type ProbeStatus = 'pass' | 'fail' | 'held' | 'n/a';

export interface IsaProbe {
  /** Stable ISC-style id for this pack (not ISA.md renumber). */
  probeId: string;
  title: string;
  /** What machine evidence satisfies the probe. */
  check: string;
  /** Layer from L1–L5 diagnosis stack. */
  layer: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  /** Evaluate against golden-path truth + optional external evidence flags. */
  evaluate: (ctx: LoopEvidenceContext) => { status: ProbeStatus; evidence: string };
}

export interface FitcheckLoop {
  loopId: string;
  stage: LoopStageId;
  title: string;
  /** From golden-path ladder current flag (static contract, not live D1). */
  ladderCurrent: boolean;
  /** Whether this stage is currently held for live ops. */
  operationalHeld: boolean;
  turnCap: number;
  exitRubric: string;
  specialty: string;
  probes: IsaProbe[];
  /** One-change rule for this stage only. */
  oneChangeRule: string;
  stopRule: string;
  /** Forbidden: these would be L1 anti-patterns or L5 decoration. */
  antiPatterns: string[];
}

/** Optional external evidence the evaluator may use (fail-soft defaults). */
export interface LoopEvidenceContext {
  golden: typeof FITCHECK_GOLDEN_PATH;
  /** When true, an exact D1 WorkObject task for sapling:fitcheck was read. */
  d1TaskReadback?: boolean;
  /** When true, a governed loadout pin was read for that task. */
  loadoutPinned?: boolean;
  /** When true, a Hermes terminal receipt exists for a canary/run. */
  hermesReceipt?: boolean;
  /** When true, foldback proposal was derived without writing the graph. */
  foldbackProposal?: boolean;
  /** When true, Mission Fabric re-read shows evidence without bypassing Gate. */
  missionFabricHonest?: boolean;
}

function isLadderCurrent(stage: LoopStageId): boolean {
  // map pack ids onto ladder stage names
  const map: Record<LoopStageId, string[]> = {
    identified: ['identified'],
    'systems-bound': ['systems-bound'],
    'mapping-verified': ['mapped', 'mapping-receipt-verified'],
    planned: ['planned'],
    'd1-eligible': ['d1-eligible'],
    admitted: ['admitted'],
    pinned: ['pinned'],
    executed: ['executed'],
    learned: ['learned'],
  };
  return (map[stage] ?? []).some((id) => {
    const row = FITCHECK_GOLDEN_PATH.lifecycleLadder.find((s) => s.stage === id);
    return row?.current === true;
  });
}

export const FITCHECK_LOOPS: FitcheckLoop[] = [
  {
    loopId: 'fitcheck-loop-identified',
    stage: 'identified',
    title: 'IDENTIFIED — canonical WorkObject',
    ladderCurrent: isLadderCurrent('identified'),
    operationalHeld: false,
    turnCap: 1,
    exitRubric: 'catalog WorkObject sapling:fitcheck is exact; aliases display-only',
    specialty: 'portfolio-identity',
    oneChangeRule: 'Only reconcile identity metadata; do not invent tasks.',
    stopRule: 'Stop after identity probe pass or catalog mismatch is recorded.',
    antiPatterns: ['alias used as join key', 'tenant inferred from display name'],
    probes: [
      {
        probeId: 'FIT-ISC-ID-1',
        title: 'Canonical workId',
        check: 'identity.workId === sapling:fitcheck',
        layer: 'L5',
        evaluate: (ctx) => ({
          status: ctx.golden.identity.workId === 'sapling:fitcheck' ? 'pass' : 'fail',
          evidence: `workId=${ctx.golden.identity.workId}`,
        }),
      },
      {
        probeId: 'FIT-ISC-ID-2',
        title: 'Parent tenant',
        check: 'identity.parentTenant === cambium',
        layer: 'L5',
        evaluate: (ctx) => ({
          status: ctx.golden.identity.parentTenant === 'cambium' ? 'pass' : 'fail',
          evidence: `parent=${ctx.golden.identity.parentTenant}`,
        }),
      },
    ],
  },
  {
    loopId: 'fitcheck-loop-systems-bound',
    stage: 'systems-bound',
    title: 'SYSTEMS BOUND — typed repositories',
    ladderCurrent: isLadderCurrent('systems-bound'),
    operationalHeld: false,
    turnCap: 2,
    exitRubric: 'landing owned by sapling:fitcheck; HDILINT dependency explicit',
    specialty: 'topology',
    oneChangeRule: 'Only fix one repository or dependency row.',
    stopRule: 'Stop after component ownership probes pass.',
    antiPatterns: ['treating HDILINT as the same WorkObject as Fitcheck'],
    probes: [
      {
        probeId: 'FIT-ISC-SYS-1',
        title: 'Landing owner',
        check: 'fitcheck-landing.ownerWorkObjectId === sapling:fitcheck',
        layer: 'L5',
        evaluate: (ctx) => {
          const landing = ctx.golden.repositoryComponents.find((c) => c.componentId === 'fitcheck-landing');
          const ok = landing?.ownerWorkObjectId === 'sapling:fitcheck';
          return { status: ok ? 'pass' : 'fail', evidence: `owner=${landing?.ownerWorkObjectId ?? 'missing'}` };
        },
      },
      {
        probeId: 'FIT-ISC-SYS-2',
        title: 'Backend dependency',
        check: 'runtime dependency on program:hdilint required',
        layer: 'L5',
        evaluate: (ctx) => {
          const dep = ctx.golden.workObjectDependencies.find((d) => d.workObjectId === 'program:hdilint');
          const ok = !!dep && dep.required === true;
          return { status: ok ? 'pass' : 'fail', evidence: dep ? `dep=${dep.dependencyId}` : 'missing hdilint dep' };
        },
      },
    ],
  },
  {
    loopId: 'fitcheck-loop-mapping-verified',
    stage: 'mapping-verified',
    title: 'MAPPING VERIFIED — receipt + readback',
    ladderCurrent: isLadderCurrent('mapping-verified'),
    operationalHeld: false, // receipt issued + readback per golden path
    turnCap: 2,
    exitRubric: 'mappingAuthority.receiptIssued && readbackVerified',
    specialty: 'mapping-receipt',
    oneChangeRule: 'Only verify or issue one mapping receipt; no D1 write.',
    stopRule: 'Stop after readback verified or mismatch receipt recorded.',
    antiPatterns: ['treating prepared receipt as D1 admission'],
    probes: [
      {
        probeId: 'FIT-ISC-MAP-1',
        title: 'Receipt issued',
        check: 'mappingAuthority.receiptIssued === true',
        layer: 'L3',
        evaluate: (ctx) => ({
          status: ctx.golden.mappingAuthority.receiptIssued ? 'pass' : 'held',
          evidence: `receiptIssued=${ctx.golden.mappingAuthority.receiptIssued} id=${ctx.golden.mappingAuthority.preparedReceiptId}`,
        }),
      },
      {
        probeId: 'FIT-ISC-MAP-2',
        title: 'Immutable readback',
        check: 'mappingAuthority.readbackVerified === true',
        layer: 'L3',
        evaluate: (ctx) => ({
          status: ctx.golden.mappingAuthority.readbackVerified ? 'pass' : 'held',
          evidence: `readbackVerified=${ctx.golden.mappingAuthority.readbackVerified} state=${ctx.golden.mappingAuthority.state}`,
        }),
      },
    ],
  },
  {
    loopId: 'fitcheck-loop-planned',
    stage: 'planned',
    title: 'PLANNED — packet missions / gates',
    ladderCurrent: isLadderCurrent('planned'),
    operationalHeld: false,
    turnCap: 2,
    exitRubric: 'three missions + seven gates present on golden path',
    specialty: 'planning-packet',
    oneChangeRule: 'Only edit packet planning evidence; not live tasks.',
    stopRule: 'Stop after packet parity probes pass.',
    antiPatterns: ['UI synthesizing signed actions from packet gates'],
    probes: [
      {
        probeId: 'FIT-ISC-PLAN-1',
        title: 'Three missions',
        check: 'missions.length === 3',
        layer: 'L1',
        evaluate: (ctx) => ({
          status: ctx.golden.missions.length === 3 ? 'pass' : 'fail',
          evidence: `missions=${ctx.golden.missions.length}`,
        }),
      },
      {
        probeId: 'FIT-ISC-PLAN-2',
        title: 'Seven gates',
        check: 'gates.length === 7',
        layer: 'L1',
        evaluate: (ctx) => ({
          status: (ctx.golden.gates?.length ?? 0) === 7 ? 'pass' : 'fail',
          evidence: `gates=${ctx.golden.gates?.length ?? 0}`,
        }),
      },
    ],
  },
  {
    loopId: 'fitcheck-loop-d1-eligible',
    stage: 'd1-eligible',
    title: 'D1 ELIGIBLE — proposal unlocked, not applied',
    ladderCurrent: isLadderCurrent('d1-eligible'),
    operationalHeld: true,
    turnCap: 3,
    exitRubric: 'proposal compiled against mapping receipt; migration/apply still gated',
    specialty: 'goal-graph-proposal',
    oneChangeRule: 'Compile one Mission→Task→loadout proposal only; no CAS write.',
    stopRule: 'Stop after proposal artifact exists or eligibility blockers listed.',
    antiPatterns: ['silent D1 write', 'auto-admit without founder approval'],
    probes: [
      {
        probeId: 'FIT-ISC-D1E-1',
        title: 'Ladder marks d1-eligible current',
        check: 'lifecycleLadder d1-eligible.current === true',
        layer: 'L5',
        evaluate: (ctx) => {
          const row = ctx.golden.lifecycleLadder.find((s) => s.stage === 'd1-eligible');
          return {
            status: row?.current ? 'pass' : 'held',
            evidence: `d1-eligible.current=${row?.current ?? false}`,
          };
        },
      },
      {
        probeId: 'FIT-ISC-D1E-2',
        title: 'Admitted still false on ladder',
        check: 'admitted.current === false until CAS',
        layer: 'L5',
        evaluate: (ctx) => {
          const row = ctx.golden.lifecycleLadder.find((s) => s.stage === 'admitted');
          return {
            status: row && row.current === false ? 'pass' : row?.current ? 'fail' : 'held',
            evidence: `admitted.current=${row?.current ?? 'missing'}`,
          };
        },
      },
    ],
  },
  {
    loopId: 'fitcheck-loop-admitted',
    stage: 'admitted',
    title: 'ADMITTED — exact D1 WorkObject task',
    ladderCurrent: isLadderCurrent('admitted'),
    operationalHeld: true,
    turnCap: 2,
    exitRubric: 'founder-approved CAS; exact sapling:fitcheck task readback',
    specialty: 'goal-graph-admission',
    oneChangeRule: 'One CAS commit for one task set; no pin/execute in same turn.',
    stopRule: 'Stop after task readback or rejected approval digest.',
    antiPatterns: ['projection fed back as authority', 'cross-tenant write'],
    probes: [
      {
        probeId: 'FIT-ISC-ADM-1',
        title: 'Ladder admitted not current until live',
        check: 'admitted.current === false in static packet until proved',
        layer: 'L5',
        evaluate: (ctx) => {
          const row = ctx.golden.lifecycleLadder.find((s) => s.stage === 'admitted');
          if (ctx.d1TaskReadback === true) {
            return { status: 'pass', evidence: 'external d1TaskReadback=true' };
          }
          return {
            status: row?.current ? 'fail' : 'held',
            evidence: `admitted.current=${row?.current ?? false}; d1TaskReadback=${ctx.d1TaskReadback ?? false}`,
          };
        },
      },
      {
        probeId: 'FIT-ISC-ADM-2',
        title: 'Runtime join evidence stage is admitted',
        check: 'runtimeJoin.evidenceStage === admitted',
        layer: 'L4',
        evaluate: (ctx) => ({
          status: ctx.golden.runtimeJoin.evidenceStage === 'admitted' ? 'pass' : 'fail',
          evidence: `evidenceStage=${ctx.golden.runtimeJoin.evidenceStage}`,
        }),
      },
    ],
  },
  {
    loopId: 'fitcheck-loop-pinned',
    stage: 'pinned',
    title: 'PINNED — governed loadout',
    ladderCurrent: isLadderCurrent('pinned'),
    operationalHeld: true,
    turnCap: 2,
    exitRubric: 'loadout pin exact to admitted task identity',
    specialty: 'loadout-pin',
    oneChangeRule: 'Pin one loadout version; do not execute.',
    stopRule: 'Stop after pin readback or missing registry row.',
    antiPatterns: ['catalog presence as pin', 'Sol/default generic agent'],
    probes: [
      {
        probeId: 'FIT-ISC-PIN-1',
        title: 'Pinned stage held until loadout evidence',
        check: 'pinned.current === false unless loadoutPinned',
        layer: 'L3',
        evaluate: (ctx) => {
          if (ctx.loadoutPinned === true) return { status: 'pass', evidence: 'loadoutPinned=true' };
          const row = ctx.golden.lifecycleLadder.find((s) => s.stage === 'pinned');
          return {
            status: row?.current ? 'fail' : 'held',
            evidence: `pinned.current=${row?.current ?? false}`,
          };
        },
      },
    ],
  },
  {
    loopId: 'fitcheck-loop-executed',
    stage: 'executed',
    title: 'EXECUTED — Hermes run + terminal receipt',
    ladderCurrent: isLadderCurrent('executed'),
    operationalHeld: true,
    turnCap: 3,
    exitRubric: 'execution-disabled canary or approved run with terminal receipt',
    specialty: 'hermes-execution',
    oneChangeRule: 'One canary or one admitted run; preserve receipt; no graph rewrite.',
    stopRule: 'Stop after receipt or reconciliation_required.',
    antiPatterns: ['retry that selects new adapter version', 'Hermes writing Goal Graph'],
    probes: [
      {
        probeId: 'FIT-ISC-EXE-1',
        title: 'Hermes support rail pending until proved',
        check: 'supportRails Hermes state + optional receipt flag',
        layer: 'L4',
        evaluate: (ctx) => {
          if (ctx.hermesReceipt === true) return { status: 'pass', evidence: 'hermesReceipt=true' };
          const hermes = ctx.golden.supportRails.find((r) => r.name === 'Hermes');
          return {
            status: hermes?.state === 'pending' || hermes?.state === 'blocked' ? 'held' : 'held',
            evidence: `Hermes.state=${hermes?.state ?? 'missing'}`,
          };
        },
      },
    ],
  },
  {
    loopId: 'fitcheck-loop-learned',
    stage: 'learned',
    title: 'LEARNED — foldback without auto-admission',
    ladderCurrent: isLadderCurrent('learned'),
    operationalHeld: true,
    turnCap: 2,
    exitRubric: 'foldback proposal only; next intent requires Gate + CAS',
    specialty: 'cortex-foldback',
    oneChangeRule: 'Emit one next-intent proposal; never CAS from foldback alone.',
    stopRule: 'Stop after proposal artifact or explicit missing-evidence list.',
    antiPatterns: ['Cortex auto-writing D1', 'Mission Fabric pretending achieved metrics'],
    probes: [
      {
        probeId: 'FIT-ISC-LRN-1',
        title: 'Next-intent authority is proposal-only',
        check: 'authority.nextIntent mentions proposal only',
        layer: 'L4',
        evaluate: (ctx) => ({
          status: /proposal only/i.test(ctx.golden.authority.nextIntent) ? 'pass' : 'fail',
          evidence: ctx.golden.authority.nextIntent,
        }),
      },
      {
        probeId: 'FIT-ISC-LRN-2',
        title: 'Foldback / Mission Fabric honesty',
        check: 'external flags or held',
        layer: 'L2',
        evaluate: (ctx) => {
          if (ctx.foldbackProposal === true && ctx.missionFabricHonest !== false) {
            return { status: 'pass', evidence: 'foldbackProposal=true' };
          }
          return {
            status: 'held',
            evidence: `foldbackProposal=${ctx.foldbackProposal ?? false} missionFabricHonest=${ctx.missionFabricHonest ?? 'unset'}`,
          };
        },
      },
    ],
  },
];

export interface LoopRunResult {
  loopId: string;
  stage: LoopStageId;
  operationalHeld: boolean;
  probes: Array<{ probeId: string; title: string; status: ProbeStatus; evidence: string; layer: string }>;
  exit: 'passed' | 'held' | 'failed';
  summary: string;
}

export function runFitcheckLoop(
  loopId: string,
  evidence: Partial<LoopEvidenceContext> = {},
): LoopRunResult {
  const loop = FITCHECK_LOOPS.find((l) => l.loopId === loopId);
  if (!loop) {
    throw new Error(`unknown_loop:${loopId}`);
  }
  const ctx: LoopEvidenceContext = { golden: FITCHECK_GOLDEN_PATH, ...evidence };
  const probes = loop.probes.map((p) => {
    const r = p.evaluate(ctx);
    return { probeId: p.probeId, title: p.title, status: r.status, evidence: r.evidence, layer: p.layer };
  });
  const failed = probes.some((p) => p.status === 'fail');
  const held = probes.some((p) => p.status === 'held');
  const exit: LoopRunResult['exit'] = failed ? 'failed' : held || loop.operationalHeld ? 'held' : 'passed';
  const summary = `${loop.stage}: ${exit} (${probes.filter((p) => p.status === 'pass').length}/${probes.length} pass)`;
  return {
    loopId: loop.loopId,
    stage: loop.stage,
    operationalHeld: loop.operationalHeld,
    probes,
    exit,
    summary,
  };
}

export function runAllFitcheckLoops(evidence: Partial<LoopEvidenceContext> = {}): LoopRunResult[] {
  return FITCHECK_LOOPS.map((l) => runFitcheckLoop(l.loopId, evidence));
}

export function fitcheckLoopPackManifest() {
  return {
    schema: FITCHECK_LOOP_PACK_SCHEMA,
    version: 1,
    workId: FITCHECK_GOLDEN_PATH.identity.workId,
    source: 'shared/fitcheck-golden-path.ts',
    doctrine: 'docs/architecture/loops-to-graphs.md',
    writesGoalGraph: false,
    loops: FITCHECK_LOOPS.map((l) => ({
      loopId: l.loopId,
      stage: l.stage,
      title: l.title,
      operationalHeld: l.operationalHeld,
      ladderCurrent: l.ladderCurrent,
      turnCap: l.turnCap,
      specialty: l.specialty,
      probeIds: l.probes.map((p) => p.probeId),
      exitRubric: l.exitRubric,
    })),
  };
}
