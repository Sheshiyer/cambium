// Quine hypha · quests — the quest log: where this venture stands in the infinite game.
// Read = render the quest panel for a tenant. This hypha is the I/O layer for the PURE
// quest fold (bin/operator/quests/quests.ts): it gathers inputs fail-soft (missing files
// → honest "unplayed"/"unreachable" states) and NEVER writes world or onboarding state.

import { appendFileSync, readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Hypha, QuineCtx } from '../types.ts';
import { flag } from '../types.ts';
import { questLedger } from '../../operator/quests/quests.ts';
import type { QuestInputs, QuestLedger, QuestLedgerRow } from '../../operator/quests/quests.ts';
import { renderQuestLog } from '../../operator/quests/panel.ts';
import { narrate } from '../../operator/narrative/narrative.ts';
import type { StoryBeat } from '../../operator/narrative/narrative.ts';
import { parseWorldLogLine } from '../../operator/skills/forge.ts';
import type { SkillRecord } from '../../operator/skills/forge.ts';
import { DECLINE_MIN_USES, DECLINE_RATE, DECLINE_WINDOW, isDeclining, recentRate, successRate } from '../../operator/skills/telemetry.ts';
import { SKILL_PRODUCTION_RATE, hasProductionGradeTelemetry, skillProductionReadiness } from '../../operator/skills/promotion.ts';
import { evaluateOperatorPolicy } from '../../operator/quests/operator-policy.ts';
import type { OperatorPolicyEnvelope, PolicyPrioritySignals } from '../../operator/quests/operator-policy.ts';
import { CAMBIUM_LANES, CAMBIUM_SENSES, CAMBIUM_VISUAL_STAGES, CAMBIUM_WAKE_STEPS } from '../../../shared/cambium-visual-contract.ts';
import { paperclipActivityBeats, paperclipOpenItems, paperclipQuestInputs, paperclipCommandsData } from './paperclip.ts';
import type { PaperclipOpenItem } from './paperclip.ts';
import { refreshProjectEvidence } from './project-evidence.ts';
import { auditPrioritySource, capturePrioritySource, prioritySignalsPath, prioritySourceTemplate, refreshPrioritySignals } from './priority-signals.ts';

const DEFAULT_TENANT = 'demo-org';
const ROOT_TENANTS = new Set(['cambium', 'thoughtseed', DEFAULT_TENANT]);

const tenantOf = (args: string[]): string => flag(args, '--tenant', process.env.TENANT || DEFAULT_TENANT);

const readJson = (path: string): any | undefined => {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return undefined; }
};

export type EnvelopeStoryBeat = Omit<StoryBeat, 'source'> & { source: string };

function normalizeStoryBeatSource(source: unknown, fallback: string): string {
  if (source === 'world-log') return 'world.log';
  if (source === 'paperclip') return 'paperclipActivityBeats';
  if (typeof source === 'string' && source.trim()) return source;
  return fallback;
}

export function storyBeatsWithSources(beats: Array<Partial<StoryBeat> & Record<string, unknown>>, fallback = 'operator-narrative'): EnvelopeStoryBeat[] {
  return beats.map((beat) => ({
    ...beat,
    source: normalizeStoryBeatSource(beat.source, fallback),
  } as EnvelopeStoryBeat));
}

type WakeStatus = 'proved' | 'missing';
type StanceStatus = 'ready' | 'insufficient';
type SkillTier = 'unproven' | 'declining' | 'learning' | 'reliable' | 'production';
type SkillPromotionStatus = 'blocked' | 'observe' | 'founder-review' | 'approved';
type NpcRelationshipStatus = 'missing' | 'inferred';
type NpcRelationshipStageId = 'missing' | 'sighted' | 'profile-backed' | 'founder-backed' | 'needs-review';
type NpcEventKind = 'profile-signal' | 'interaction' | 'advice' | 'contradiction' | 'note';
type NpcEventSource = 'operator-note' | 'founder-gate' | 'system';
type NpcAdviceStatus = 'ready' | 'blocked';
type NpcAdviceActionKind = 'review' | 'ask-founder' | 'collect-evidence';
type VisualInsightStatus = 'ready' | 'wait';
type VisualInsightSource = 'quest-ledger' | 'operator-insights@v1' | 'missing';
type VisualInsightOrigin = 'completed-quest' | 'active-frontier' | 'empty-ledger' | 'operator-insight';
type VisualSocialState = 'ready' | 'gap';
type DecisionSignalState = 'served' | 'gap';
type DecisionSignalId = 'founder-preference' | 'owner-load' | 'economic-risk' | 'team-availability' | 'member-revocation' | 'cross-tenant-urgency';
type DecisionSignalSource = 'paperclip-open-items' | 'project-evidence' | 'tenant-registry' | 'operator-priority-signals' | 'missing';
type LiveProofState = 'complete' | 'ready' | 'ready-to-capture' | 'blocked' | 'gap';
type LiveProofStatus = 'ready' | 'blocked' | 'missing';
type WakeEventSource = 'operator-note' | 'system';
type SideQuestStatus = 'triggered' | 'queued' | 'completed' | 'expired';
type SideQuestEventStatus = Exclude<SideQuestStatus, 'triggered'>;
type SideQuestEventSource = 'operator-note' | 'founder-gate' | 'system';
type SideQuestOwner = 'operator' | 'founder' | 'system';
type SideQuestActionKind = 'inspect' | 'refresh' | 'founder-review' | 'collect-evidence';
type VisualSenseId = (typeof CAMBIUM_SENSES)[number]['id'];

const STANCE_MIN_SAMPLE = 6;
const STANCE_WINDOW = 24;
const SKILL_RELIABLE_RATE = 2 / 3;
const WAKE_EVENT_SCHEMA = 'cambium.wake-event.v1';
const NPC_EVENT_SCHEMA = 'cambium.npc-event.v1';
const SIDE_QUEST_EVENT_SCHEMA = 'cambium.side-quest-event.v1';
const WAKE_EVENT_SOURCES: readonly WakeEventSource[] = ['operator-note', 'system'];
const NPC_EVENT_KINDS: readonly NpcEventKind[] = ['profile-signal', 'interaction', 'advice', 'contradiction', 'note'];
const NPC_EVENT_SOURCES: readonly NpcEventSource[] = ['operator-note', 'founder-gate', 'system'];
const NPC_ADVICE_ACTIONS: readonly NpcAdviceActionKind[] = ['review', 'ask-founder', 'collect-evidence'];
const NPC_OVERCLAIM_RE = /\b(affinity|trusted advisor|partner|partnership|loyalty|friendship|romance|love)\b/i;
const SIDE_QUEST_EVENT_STATUSES: readonly SideQuestEventStatus[] = ['queued', 'completed', 'expired'];
const SIDE_QUEST_EVENT_SOURCES: readonly SideQuestEventSource[] = ['operator-note', 'founder-gate', 'system'];
const SIDE_QUEST_OVERCLAIM_RE = /\b(reward|bonus|level up|hidden quest|leaderboard|social proof|popularity|rank)\b/i;
const INSIGHT_OVERCLAIM_RE = /\b(reward|bonus|level up|hidden quest|leaderboard|social proof|popularity|rank|random reward)\b/i;
const INSIGHT_SECRET_RE = /\b(?:TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN)=|\bBearer\b|\b(?:hash|query_id|auth_date)=|\brawInitData\b/i;
const LIVE_PROOF_READINESS_PATH = 'docs/plans/assets/tg-miniapp-live-proof/readiness.json';
const LIVE_PROOF_CAPTURE_INVARIANT = 'Capture commands create redacted receipts; they are proof only after their artifacts validate ready.';

export interface VisualWakeStep {
  id: string;
  status: WakeStatus;
  detail: string;
  source: 'quest-envelope' | 'quest-ledger' | 'freshness' | 'missing';
  proof: string;
  evidence: VisualSenseEvidence[];
  gap?: string;
  history?: VisualWakeHistory;
}

export interface VisualSenseEvidence {
  label: string;
  status: string;
  detail: string;
}

export interface VisualSenseRow {
  id: VisualSenseId;
  title: string;
  on: boolean;
  detail: string;
  proof: string;
  source: 'quest-ledger' | 'cortex-count' | 'paperclip-open-items' | 'freshness' | 'missing';
  evidence: VisualSenseEvidence[];
  gap?: string;
}

export interface VisualInsightRow {
  id: string;
  title: string;
  state: VisualInsightStatus;
  detail: string;
  proof: string;
  source: VisualInsightSource;
  origin: VisualInsightOrigin;
  quest?: {
    arc: string;
    id: string;
    status: string;
  };
  evidence: VisualSenseEvidence[];
  gap?: string;
}

export interface NpcEventRecord {
  schema: typeof NPC_EVENT_SCHEMA;
  id: string;
  tenant: string;
  npcId: string;
  kind: NpcEventKind;
  source: NpcEventSource;
  detail: string;
  evidence: string;
  createdAt: string;
  contradicts?: string;
  advice?: {
    detail: string;
    action: {
      kind: NpcAdviceActionKind;
      label: string;
      target: string;
    };
  };
}

export interface WakeEventRecord {
  schema: typeof WAKE_EVENT_SCHEMA;
  id: string;
  tenant: string;
  stepId: string;
  status: WakeStatus;
  source: WakeEventSource;
  detail: string;
  proof: string;
  createdAt: string;
  target?: string;
}

interface VisualWakeHistory {
  source: 'operator-wake-events@v1' | 'missing';
  total: number;
  status: WakeStatus | 'mixed' | 'none';
  proof: string;
  latest?: {
    id: string;
    stepId: string;
    status: WakeStatus;
    source: WakeEventSource;
    detail: string;
    proof: string;
    createdAt: string;
    target?: string;
  };
  rows: Array<{
    id: string;
    stepId: string;
    status: WakeStatus;
    source: WakeEventSource;
    detail: string;
    proof: string;
    createdAt: string;
    target?: string;
  }>;
}

interface VisualNpcAdvice {
  status: NpcAdviceStatus;
  label: string;
  detail: string;
  proof: string;
  action: {
    kind: NpcAdviceActionKind;
    label: string;
    target: string;
  };
}

interface VisualNpcHistory {
  source: 'operator-npc-events@v1' | 'missing';
  total: number;
  contradictions: number;
  rows: Array<{
    id: string;
    kind: NpcEventKind;
    source: NpcEventSource;
    detail: string;
    evidence: string;
    createdAt: string;
    contradicts?: string;
    advice?: NpcEventRecord['advice'];
  }>;
}

export interface SideQuestEventRecord {
  schema: typeof SIDE_QUEST_EVENT_SCHEMA;
  id: string;
  tenant: string;
  sideQuestId: string;
  status: SideQuestEventStatus;
  source: SideQuestEventSource;
  detail: string;
  proof: string;
  createdAt: string;
  target?: string;
  actionId?: string;
  idempotencyKey?: string;
}

export interface GateSideQuestAction {
  id: string;
  kind: string;
  subject: string;
  ts?: string;
  founderId?: string;
  evidence?: string;
  consequence?: string;
  reversibility?: string;
  idempotencyKey?: string;
  note?: string | null;
  status?: string;
}

export interface SideQuestQueueApplyOptions {
  baseUrl?: string;
  token?: string;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  nowIso?: () => string;
  paperclip?: QuestInputs['paperclip'];
  openItems?: PaperclipOpenItem[];
}

export interface SideQuestQueueApplyResult {
  schema: 'cambium.side-quest-queue-apply.v1';
  actionId: string;
  actionTs: string | null;
  appliedAt: string;
  tenant: string;
  subject: string;
  founderId: string | null;
  idempotencyKey: string | null;
  result: 'queued' | 'already-queued' | 'rejected';
  reason: string;
  evidence: string | null;
  consequence: string | null;
  reversibility: string | null;
  dryRun: boolean;
  eventId?: string;
}

interface VisualSideQuestRuntime {
  source: 'operator-side-quests@v1' | 'missing';
  status: SideQuestStatus;
  total: number;
  proof: string;
  expiredAt?: string;
  latest?: {
    id: string;
    status: SideQuestEventStatus;
    source: SideQuestEventSource;
    detail: string;
    proof: string;
    createdAt: string;
    target?: string;
  };
  rows: Array<{
    id: string;
    status: SideQuestEventStatus;
    source: SideQuestEventSource;
    detail: string;
    proof: string;
    createdAt: string;
    target?: string;
  }>;
}

export interface VisualEnvelope {
  wake: {
    source: string;
    steps: VisualWakeStep[];
  };
  lanes: {
    source: 'world.log' | 'missing';
    total: number;
    dominant: string | null;
    counts: Record<string, number>;
    gap?: string;
  };
  senses: {
    source: 'quest-ledger-envelope@v1';
    status: 'ready';
    rows: VisualSenseRow[];
  };
  insights: {
    source: 'quest-ledger-evidence@v1' | 'operator-insights@v1';
    status: 'ready' | 'empty';
    rows: VisualInsightRow[];
    gap?: string;
  };
  stance: {
    source: 'tenant-world.log' | 'missing';
    status: StanceStatus;
    scope: 'tenant-world-log-only';
    sampleSize: number;
    minimum: number;
    window: number;
    dominant: string | null;
    label: string | null;
    confidence: number;
    ratios: Record<string, number>;
    counts: Record<string, number>;
    gap?: string;
  };
  skills: {
    source: 'skill-registry' | 'missing';
    total: number;
    rows: Array<{
      id: string;
      status: string;
      uses: number;
      successes: number;
      failures: number;
      successRate: number;
      declining: boolean;
      tier: SkillTier;
      tierLabel: string;
      sampleSize: number;
      minimum: number;
      recentRate: number;
      recentWindow: number;
      promotion: {
        status: SkillPromotionStatus;
        label: string;
        detail: string;
        requiredApproval: boolean;
      };
      gap?: string;
      updated: number | null;
    }>;
    gap?: string;
  };
  policy: OperatorPolicyEnvelope;
  npc: {
    source: 'cortex-memory' | 'operator-npc-events' | 'mixed' | 'missing';
    relationships: Array<{
      id: string;
      status: NpcRelationshipStatus;
      detail: string;
      proof?: string;
      stage?: {
        id: NpcRelationshipStageId;
        label: string;
        detail: string;
        confidence: number;
      };
      events?: Array<{
        id: string;
        kind: string;
        source: 'tenant-cortex-memory' | 'founder-arcs' | 'operator-npc-event' | 'missing';
        detail: string;
        ts?: number;
      }>;
      history?: VisualNpcHistory;
      advice?: VisualNpcAdvice;
      sampleSize?: number;
      scope?: string;
      evidence?: string[];
    }>;
  };
  social: {
    source: 'coordination-evidence@v1';
    status: 'ready' | 'gap';
    scope: 'tenant-handoff-only';
    rows: Array<{
      id: string;
      title: string;
      state: VisualSocialState;
      detail: string;
      proof: string;
      source: 'paperclip-quest-inputs' | 'paperclip-open-items' | 'quest-ledger' | 'missing';
      scope: 'tenant-handoff-only' | 'founder-gate-only' | 'client-handoff-only';
      evidence: VisualSenseEvidence[];
      gap?: string;
    }>;
    gap?: string;
  };
  decisionContext: {
    source: 'decision-context@v1';
    status: 'ready';
    served: number;
    gaps: number;
    rows: Array<{
      id: DecisionSignalId;
      title: string;
      state: DecisionSignalState;
      detail: string;
      proof: string;
      source: DecisionSignalSource;
      scope: 'tenant-only' | 'project-only' | 'cross-tenant';
      evidence: VisualSenseEvidence[];
      gap?: string;
    }>;
  };
  liveProof: {
    source: 'tg-live-proof-readiness@v1' | 'missing';
    status: LiveProofStatus;
    generatedAt?: string;
    workerUrl?: string;
    summary: {
      ready: number;
      blocked: number;
      total: number;
      liveProofReady: boolean;
    };
    invariant: string;
    rows: Array<{
      id: string;
      title: string;
      state: LiveProofState;
      detail: string;
      proof: string;
      source: 'tg-live-proof-capture-plan' | 'missing';
      command: string;
      writes: string;
      prerequisites: VisualSenseEvidence[];
      privacy: string[];
    }>;
    gap?: string;
  };
  sideQuests: {
    source: 'pure-trigger-predicates';
    status: 'ready' | 'empty';
    rows: Array<{
      id: string;
      title: string;
      status: SideQuestStatus;
      trigger: string;
      detail: string;
      proof: string;
      origin: string;
      owner: SideQuestOwner;
      action: {
        kind: SideQuestActionKind;
        label: string;
        target: string;
      };
      lifetime: {
        scope: 'until-next-refresh' | 'until-consumed' | 'until-evidence-arrives';
        staleAfterMinutes: number;
        detail: string;
      };
      completion: {
        kind: 'proof-arrives' | 'queue-consumed' | 'policy-ready';
        proof: string;
      };
      runtime?: VisualSideQuestRuntime;
    }>;
    gap?: string;
  };
}

// Founder-inheritance reducer. Root tenants (cambium/thoughtseed) earn the I–IX
// "founder tutorial" arcs once; every client tenant inherits those completions
// via founder.json. Non-root tenants never write to founder.json — their
// progress lives in ${tenant}.project.json instead.

export interface FounderState { completedArcs: string[]; derivedFrom: string; derivedAt: string }

export function reconcileFounder(
  prev: FounderState,
  ledger: { rows: Array<{ quest: { id: string }; status: 'complete' | 'active' | 'locked' }> },
  tenant: string,
  nowIso?: string,
): FounderState | null {
  if (!ROOT_TENANTS.has(tenant)) return null;
  const completed = ledger.rows.filter((r) => r.status === 'complete').map((r) => r.quest.id);
  const merged = Array.from(new Set([...prev.completedArcs, ...completed]));
  if (merged.length === prev.completedArcs.length) return prev;        // no change
  return { completedArcs: merged, derivedFrom: tenant, derivedAt: nowIso ?? new Date().toISOString() };
}

function wakeEventsPath(ctx: QuineCtx, tenant: string): string {
  return join(ctx.root, '.operator', `${tenant}.wake-events.jsonl`);
}

function isWakeStepId(stepId: string): boolean {
  return CAMBIUM_WAKE_STEPS.some((step) => step.id === stepId);
}

function isWakeEventSource(source: string): source is WakeEventSource {
  return (WAKE_EVENT_SOURCES as readonly string[]).includes(source);
}

function readWakeEvents(ctx: QuineCtx, tenant: string): WakeEventRecord[] {
  let text = '';
  try { text = readFileSync(wakeEventsPath(ctx, tenant), 'utf8'); } catch { return []; }
  return text.split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter((row): row is WakeEventRecord => {
      if (!row || typeof row !== 'object') return false;
      const event = row as Partial<WakeEventRecord>;
      return event.schema === WAKE_EVENT_SCHEMA &&
        event.tenant === tenant &&
        typeof event.id === 'string' &&
        typeof event.stepId === 'string' && isWakeStepId(event.stepId) &&
        typeof event.status === 'string' && (event.status === 'proved' || event.status === 'missing') &&
        typeof event.source === 'string' && isWakeEventSource(event.source) &&
        typeof event.detail === 'string' &&
        typeof event.proof === 'string' &&
        typeof event.createdAt === 'string';
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

function appendWakeEvent(args: string[], ctx: QuineCtx, tenant: string): unknown {
  const subIndex = args.indexOf('wake-event');
  const rest = args.slice(subIndex + 1).filter((arg) => !arg.startsWith('--') && !['--detail', '--proof', '--source', '--target', '--created-at'].includes(arg));
  const [stepId = '', statusRaw = 'missing'] = rest;
  const status = statusRaw.toLowerCase();
  const source = flagValue(args, '--source', 'operator-note');
  const detail = flagValue(args, '--detail', '').trim();
  const proof = flagValue(args, '--proof', detail).trim();
  const target = flagValue(args, '--target', stepId).trim();
  const createdAt = flagValue(args, '--created-at', new Date().toISOString()).trim();

  if (!isWakeStepId(stepId)) return 'usage: quine write quests wake-event <ingest|route|act|viability|learn|persist> <proved|missing> --detail "..." --proof "..." [--tenant t]';
  if (status !== 'proved' && status !== 'missing') return `wake event rejected: unknown status "${statusRaw}"`;
  if (!isWakeEventSource(source)) return `wake event rejected: unknown source "${source}"`;
  if (!detail) return 'wake event rejected: --detail is required';
  if (!proof) return 'wake event rejected: --proof is required when detail is empty';
  if (!Number.isFinite(Date.parse(createdAt))) return `wake event rejected: invalid --created-at "${createdAt}"`;

  const event: WakeEventRecord = {
    schema: WAKE_EVENT_SCHEMA,
    id: `${tenant}:${stepId}:${status}:${Date.now()}`,
    tenant,
    stepId,
    status,
    source,
    detail,
    proof,
    createdAt,
    ...(target ? { target } : {}),
  };
  mkdirSync(join(ctx.root, '.operator'), { recursive: true });
  appendFileSync(wakeEventsPath(ctx, tenant), JSON.stringify(event) + '\n');
  return {
    hypha: 'quests',
    op: 'wake-event',
    tenant,
    path: `.operator/${tenant}.wake-events.jsonl`,
    event: {
      id: event.id,
      stepId: event.stepId,
      status: event.status,
      source: event.source,
      target: event.target ?? null,
    },
  };
}

function wakeHistoryForStep(stepId: string, events: WakeEventRecord[]): VisualWakeHistory {
  const rows = events.filter((event) => event.stepId === stepId);
  if (rows.length === 0) {
    return {
      source: 'missing',
      total: 0,
      status: 'none',
      proof: 'no operator wake events served',
      rows: [],
    };
  }
  const recent = rows.slice(-4);
  const latest = rows[rows.length - 1];
  const statuses = new Set(rows.map((event) => event.status));
  return {
    source: 'operator-wake-events@v1',
    total: rows.length,
    status: statuses.size === 1 ? latest.status : 'mixed',
    proof: latest.proof,
    latest: {
      id: latest.id,
      stepId: latest.stepId,
      status: latest.status,
      source: latest.source,
      detail: latest.detail,
      proof: latest.proof,
      createdAt: latest.createdAt,
      ...(latest.target ? { target: latest.target } : {}),
    },
    rows: recent.map((event) => ({
      id: event.id,
      stepId: event.stepId,
      status: event.status,
      source: event.source,
      detail: event.detail,
      proof: event.proof,
      createdAt: event.createdAt,
      ...(event.target ? { target: event.target } : {}),
    })),
  };
}

function cortexCountFor(opDir: string, tenant: string): number | undefined {
  try {
    // node:sqlite is the local transport's engine (see ../../operator/cortex-sqlite.ts)
    const db = new DatabaseSync(join(opDir, 'cortex.db'), { readOnly: true });
    try {
      const row = db.prepare('SELECT COUNT(*) AS n FROM memory WHERE tenant = ?').get(tenant) as { n: number };
      return Number(row?.n ?? 0);
    } finally { db.close(); }
  } catch { return undefined; }
}

function cortexMemoryRowsFor(
  opDir: string,
  tenant: string,
  limit = 12,
): Array<{ id: string; kind: string; payload: Record<string, unknown>; ts: number }> {
  try {
    const db = new DatabaseSync(join(opDir, 'cortex.db'), { readOnly: true });
    try {
      const rows = db.prepare(
        'SELECT id, kind, payload, ts FROM memory WHERE tenant = ? ORDER BY ts DESC',
      ).all(tenant) as Array<{ id: string; kind: string; payload: string; ts: number }>;
      const seen = new Set<string>();
      return rows.map((row) => {
        let payload: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(row.payload);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed;
        } catch {
          payload = {};
        }
        return { id: row.id, kind: row.kind, payload, ts: row.ts };
      }).filter((row) => {
        const key = `${row.kind}:${JSON.stringify(row.payload)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, limit);
    } finally { db.close(); }
  } catch {
    return [];
  }
}

const negativeEvidence = /\b(pending|missing|unreachable|unplayed|unclaimed|awaiting|false|none)\b|no .+ yet|×0|0\//i;
const riskEvidence = /\b(pending|blocked|missing|unreachable|rejected|failed|stuck)\b|no .+ yet|0\//i;
const CORTEX_ARCS = new Set(CAMBIUM_VISUAL_STAGES.find((stage) => stage.id === 'cortex')?.arcs ?? []);

function questFields(row: QuestLedgerRow | { arc: string; id?: string; title: string }): { arc: string; id?: string; title: string } {
  return 'quest' in row ? row.quest : row;
}

const rowLabel = (row: QuestLedgerRow | { arc: string; id?: string; title: string }): string => {
  const quest = questFields(row);
  return `${quest.arc} · ${quest.title}`;
};

function senseContract(id: VisualSenseId): (typeof CAMBIUM_SENSES)[number] {
  return CAMBIUM_SENSES.find((sense) => sense.id === id)!;
}

function rowEvidence(row: QuestLedgerRow): VisualSenseEvidence {
  return {
    label: rowLabel(row),
    status: row.status,
    detail: row.evidence || 'evidence missing from quest row',
  };
}

function minutesSince(raw: string): number | null {
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return (Date.now() - parsed) / 60000;
}

function visualSenseRow(
  id: VisualSenseId,
  on: boolean,
  detail: string,
  proof: string,
  source: VisualSenseRow['source'],
  evidence: VisualSenseEvidence[],
  gap?: string,
): VisualSenseRow {
  const contract = senseContract(id);
  return {
    id,
    title: contract.title,
    on,
    detail,
    proof,
    source,
    evidence,
    ...(gap ? { gap } : {}),
  };
}

function deriveSenseEnvelope(
  inputs: QuestInputs,
  ledger: QuestLedger,
  derivedAt: string,
  openItems: PaperclipOpenItem[] = [],
): VisualEnvelope['senses'] {
  const activeRow = ledger.current
    ? ledger.rows.find((row) => row.quest.id === ledger.current?.id || row.quest.arc === ledger.current?.arc)
    : undefined;
  const cortexRows = ledger.rows.filter((row) => CORTEX_ARCS.has(row.quest.arc));
  const openCortexRows = cortexRows.filter((row) => row.status !== 'locked');
  const cortexCount = Number(inputs.cortexCount ?? 0);
  const riskRows = ledger.rows.filter((row) => row.status === 'locked' || riskEvidence.test(row.evidence || ''));
  const gateRiskRows = openItems.filter((item) =>
    /blocked|stuck|failed|critical|urgent/i.test(`${item.status} ${item.title}`) ||
    /^(critical|high)$/.test(String(item.priority?.risk ?? '')) ||
    item.priority?.dependency === 'blocks-delivery'
  );
  const age = minutesSince(derivedAt);

  const signalEvidence = activeRow
    ? [rowEvidence(activeRow)]
    : ledger.current
      ? [{ label: rowLabel(ledger.current), status: 'active', detail: 'active frontier served without matching row evidence' }]
      : [];
  const memoryEvidence = [
    ...(cortexCount > 0 ? [{ label: 'tenant cortex memory', status: 'served', detail: `${cortexCount} records` }] : []),
    ...openCortexRows.slice(0, 3).map(rowEvidence),
  ];
  const riskEvidenceRows = [
    ...riskRows.slice(0, 4).map(rowEvidence),
    ...gateRiskRows.slice(0, 4).map((item) => ({
      label: item.id,
      status: item.status,
      detail: `${item.priority?.risk ?? 'unknown'} risk · ${item.priority?.dependency ?? 'unknown'} dependency`,
    })),
  ];

  return {
    source: 'quest-ledger-envelope@v1',
    status: 'ready',
    rows: [
      visualSenseRow(
        'signal',
        !!ledger.current,
        ledger.current ? rowLabel(ledger.current) : senseContract('signal').empty,
        signalEvidence.map((item) => `${item.label}: ${item.detail}`).join(' · ') || 'no active frontier served',
        ledger.current ? 'quest-ledger' : 'missing',
        signalEvidence,
        ledger.current ? undefined : 'no active quest frontier',
      ),
      visualSenseRow(
        'memory',
        cortexCount > 0 || openCortexRows.length > 0,
        cortexCount > 0
          ? `${cortexCount} tenant cortex memor${cortexCount === 1 ? 'y' : 'ies'}`
          : openCortexRows.length > 0
            ? `${openCortexRows.length}/${cortexRows.length} cortex rows`
            : senseContract('memory').empty,
        memoryEvidence.map((item) => `${item.label}: ${item.detail}`).join(' · ') || 'no tenant cortex memory or open cortex quest rows served',
        cortexCount > 0 ? 'cortex-count' : openCortexRows.length > 0 ? 'quest-ledger' : 'missing',
        memoryEvidence,
        cortexCount > 0 || openCortexRows.length > 0 ? undefined : 'memory sense has no served cortex evidence',
      ),
      visualSenseRow(
        'risk',
        riskRows.length > 0 || gateRiskRows.length > 0,
        riskRows.length > 0 || gateRiskRows.length > 0
          ? `${riskRows.length} quest risk trace${riskRows.length === 1 ? '' : 's'} · ${gateRiskRows.length} gate risk${gateRiskRows.length === 1 ? '' : 's'}`
          : senseContract('risk').empty,
        riskEvidenceRows.map((item) => `${item.label}: ${item.detail}`).join(' · ') || 'no risk rows served',
        gateRiskRows.length > 0 ? 'paperclip-open-items' : riskRows.length > 0 ? 'quest-ledger' : 'missing',
        riskEvidenceRows,
        riskRows.length > 0 || gateRiskRows.length > 0 ? undefined : 'risk sense has no locked, pending, or gate-risk evidence',
      ),
      visualSenseRow(
        'drift',
        age === null || age > 360,
        age === null ? 'freshness missing' : age > 360 ? `${Math.round(age / 60)}h stale` : senseContract('drift').empty,
        age === null ? 'derivedAt is missing or invalid' : `derivedAt ${derivedAt}`,
        age === null ? 'missing' : 'freshness',
        [{ label: 'derivedAt', status: age === null ? 'missing' : age > 360 ? 'stale' : 'fresh', detail: derivedAt || 'missing' }],
        age === null ? 'freshness missing' : age > 360 ? 'ledger older than 360 minutes' : undefined,
      ),
    ],
  };
}

function evidenceHeadline(evidence: string | undefined): string {
  const first = String(evidence ?? '')
    .split('·')
    .map((part) => part.trim())
    .find(Boolean);
  return first || 'evidence pending';
}

function insightFromQuestRow(
  row: QuestLedgerRow,
  origin: VisualInsightRow['origin'],
): VisualInsightRow {
  const complete = row.status === 'complete';
  return {
    id: `${origin}:${row.quest.id}`,
    title: rowLabel(row),
    state: complete ? 'ready' : 'wait',
    detail: evidenceHeadline(row.evidence),
    proof: row.evidence || 'evidence missing from quest row',
    source: 'quest-ledger',
    origin,
    quest: {
      arc: row.quest.arc,
      id: row.quest.id,
      status: row.status,
    },
    evidence: [rowEvidence(row)],
    ...(complete ? {} : { gap: 'active frontier is not complete yet' }),
  };
}

function insightRowText(row: Record<string, unknown>): string {
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  return [
    row.id,
    row.title,
    row.detail,
    row.proof,
    row.gap,
    ...evidence.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const ev = item as Record<string, unknown>;
      return [ev.label, ev.status, ev.detail];
    }),
  ].filter((item) => typeof item === 'string').join(' ');
}

function insightTextOverclaims(row: Record<string, unknown>): boolean {
  return INSIGHT_OVERCLAIM_RE.test(insightRowText(row));
}

function insightTextLeaksSecret(row: Record<string, unknown>): boolean {
  return INSIGHT_SECRET_RE.test(insightRowText(row));
}

function operatorInsightsPath(ctx: QuineCtx, tenant: string): string {
  return join(ctx.root, '.operator', `${tenant}.insights.json`);
}

function readOperatorInsightRows(ctx: QuineCtx, tenant: string): VisualInsightRow[] {
  const envelope = readJson(operatorInsightsPath(ctx, tenant));
  if (!envelope || typeof envelope !== 'object' || envelope.source !== 'operator-insights@v1' || !Array.isArray(envelope.rows)) return [];
  return envelope.rows
    .filter((row: unknown): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
    .filter((row) => !insightTextOverclaims(row))
    .filter((row) => !insightTextLeaksSecret(row))
    .map((row): VisualInsightRow | null => {
      const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : '';
      const title = typeof row.title === 'string' && row.title.trim() ? row.title.trim() : '';
      const detail = typeof row.detail === 'string' && row.detail.trim() ? row.detail.trim() : '';
      const proof = typeof row.proof === 'string' && row.proof.trim() ? row.proof.trim() : '';
      if (!id || !title || !detail || !proof) return null;
      const state = row.state === 'wait' ? 'wait' : 'ready';
      const evidence = Array.isArray(row.evidence)
        ? row.evidence.flatMap((item): VisualSenseEvidence[] => {
            if (!item || typeof item !== 'object') return [];
            const ev = item as Record<string, unknown>;
            return [{
              label: typeof ev.label === 'string' && ev.label ? ev.label : title,
              status: typeof ev.status === 'string' && ev.status ? ev.status : state,
              detail: typeof ev.detail === 'string' && ev.detail ? ev.detail : proof,
            }];
          })
        : [{ label: title, status: state, detail: proof }];
      return {
        id,
        title,
        state,
        detail,
        proof,
        source: 'operator-insights@v1',
        origin: 'operator-insight',
        evidence,
        ...(state === 'ready' ? {} : { gap: typeof row.gap === 'string' ? row.gap : detail }),
      };
    })
    .filter((row): row is VisualInsightRow => !!row)
    .slice(0, 4);
}

function deriveInsightEnvelope(ctx: QuineCtx, tenant: string, ledger: QuestLedger): VisualEnvelope['insights'] {
  const operatorRows = readOperatorInsightRows(ctx, tenant);
  if (operatorRows.length > 0) {
    return {
      source: 'operator-insights@v1',
      status: 'ready',
      rows: operatorRows,
    };
  }

  const completed = ledger.rows.filter((row) => row.status === 'complete').slice(-3);
  const active = ledger.current
    ? ledger.rows.find((row) => row.quest.id === ledger.current?.id || row.quest.arc === ledger.current?.arc)
    : undefined;
  const rows = [
    ...completed.map((row) => insightFromQuestRow(row, 'completed-quest')),
    ...(active ? [insightFromQuestRow(active, 'active-frontier')] : []),
  ].slice(-4);

  if (rows.length === 0) {
    return {
      source: 'quest-ledger-evidence@v1',
      status: 'empty',
      rows: [],
      gap: 'no quest evidence rows served for insight boxes',
    };
  }

  return {
    source: 'quest-ledger-evidence@v1',
    status: 'ready',
    rows,
  };
}

function deriveWakeEnvelope(source: string, derivedAt: string, ledger: QuestLedger, wakeEvents: WakeEventRecord[] = []): VisualEnvelope['wake'] {
  const active = ledger.current;
  const rows = ledger.rows;
  const activeRow = active
    ? rows.find((row) => row.quest.id === active.id || row.quest.arc === active.arc)
    : undefined;
  const openRows = rows.filter((row) => row.status !== 'locked');
  const viabilityRows = rows.filter((row) =>
    row.status !== 'locked' &&
    /viability|gate|approval|deposit|deploy|sign.?off|margin/i.test(row.evidence) &&
    !negativeEvidence.test(row.evidence)
  );
  const learnRows = rows.filter((row) =>
    row.status !== 'locked' &&
    /memory|cortex|lesson|learn|mint|archive/i.test(row.evidence) &&
    !negativeEvidence.test(row.evidence)
  );
  const step = (
    id: string,
    ok: boolean,
    detail: string,
    proof: string,
    stepSource: VisualWakeStep['source'],
    evidence: VisualSenseEvidence[] = [],
  ): VisualWakeStep => {
    const contract = CAMBIUM_WAKE_STEPS.find((s) => s.id === id);
    const fallback = contract?.missing ?? detail;
    return {
      id,
      status: ok ? 'proved' : 'missing',
      detail: ok ? detail : fallback,
      source: ok ? stepSource : 'missing',
      proof: proof || fallback,
      evidence,
      history: wakeHistoryForStep(id, wakeEvents),
      ...(ok ? {} : { gap: fallback }),
    };
  };

  return {
    source: 'quest-ledger-envelope@v1',
    steps: [
      step(
        'ingest',
        !!source,
        source || 'missing source',
        source ? `quest envelope source ${source}` : 'quest envelope source missing',
        'quest-envelope',
        source ? [{ label: 'source', status: 'served', detail: source }] : [],
      ),
      step(
        'route',
        !!active || ledger.completed === ledger.total,
        active ? `${active.arc} · ${active.title}` : 'all arcs complete',
        active ? `active frontier ${active.arc} · ${active.title}` : `${ledger.completed}/${ledger.total} quests complete`,
        'quest-ledger',
        activeRow ? [rowEvidence(activeRow)] : rows.slice(-1).map(rowEvidence),
      ),
      step(
        'act',
        openRows.length > 0,
        `${ledger.completed}/${ledger.total} quest rows`,
        `${openRows.length}/${ledger.total} quest rows are active or complete`,
        'quest-ledger',
        openRows.slice(0, 4).map(rowEvidence),
      ),
      step(
        'viability',
        viabilityRows.length > 0,
        'evidence present',
        viabilityRows.map((row) => `${rowLabel(row)}: ${row.evidence}`).join(' · ') || 'no viability, gate, approval, deposit, deploy, sign-off, or margin evidence served',
        'quest-ledger',
        viabilityRows.slice(0, 4).map(rowEvidence),
      ),
      step(
        'learn',
        learnRows.length > 0,
        'memory trace',
        learnRows.map((row) => `${rowLabel(row)}: ${row.evidence}`).join(' · ') || 'no memory, cortex, lesson, learn, mint, or archive evidence served',
        'quest-ledger',
        learnRows.slice(0, 4).map(rowEvidence),
      ),
      step(
        'persist',
        !!derivedAt,
        'ledger snapshot',
        derivedAt ? `derivedAt ${derivedAt}` : 'derivedAt missing',
        'freshness',
        derivedAt ? [{ label: 'derivedAt', status: 'served', detail: derivedAt }] : [],
      ),
    ],
  };
}

function deriveLaneEnvelope(inputs: QuestInputs): VisualEnvelope['lanes'] {
  const counts = Object.fromEntries(CAMBIUM_LANES.map((lane) => [lane.id, 0])) as Record<string, number>;
  for (const parsed of tenantLaneHistory(inputs)) {
    counts[parsed.lane] += 1;
  }
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const dominant = total > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
    : null;
  return {
    source: total > 0 ? 'world.log' : 'missing',
    total,
    dominant,
    counts,
    ...(total > 0 ? {} : { gap: 'lane telemetry missing from world.log' }),
  };
}

function tenantLaneHistory(inputs: QuestInputs): Array<{ lane: string; raw: string }> {
  const laneIds = new Set(CAMBIUM_LANES.map((lane) => lane.id));
  const out: Array<{ lane: string; raw: string }> = [];
  for (const raw of inputs.world?.log ?? []) {
    const parsed = parseWorldLogLine(raw);
    if (parsed && laneIds.has(parsed.lane)) out.push({ lane: parsed.lane, raw });
  }
  return out;
}

const stanceLabel = (dominant: string | null): string =>
  dominant ? `${dominant.toUpperCase()}-LED` : 'BALANCED';

function deriveStanceEnvelope(inputs: QuestInputs): VisualEnvelope['stance'] {
  const recent = tenantLaneHistory(inputs).slice(-STANCE_WINDOW);
  const counts = Object.fromEntries(CAMBIUM_LANES.map((lane) => [lane.id, 0])) as Record<string, number>;
  for (const event of recent) counts[event.lane] += 1;
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const ratios = Object.fromEntries(Object.entries(counts).map(([lane, n]) => [lane, total ? Number((n / total).toFixed(2)) : 0]));
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked[0];
  const tied = total > 0 && ranked.filter(([, n]) => n === top[1]).length > 1;
  const dominant = total >= STANCE_MIN_SAMPLE && top[1] > 0 && !tied
    ? top[0]
    : null;
  const confidence = total && top ? Number((top[1] / total).toFixed(2)) : 0;
  if (total < STANCE_MIN_SAMPLE) {
    return {
      source: total > 0 ? 'tenant-world.log' : 'missing',
      status: 'insufficient',
      scope: 'tenant-world-log-only',
      sampleSize: total,
      minimum: STANCE_MIN_SAMPLE,
      window: STANCE_WINDOW,
      dominant: null,
      label: null,
      confidence,
      ratios,
      counts,
      gap: `need ${STANCE_MIN_SAMPLE} tenant events; found ${total}`,
    };
  }
  return {
    source: 'tenant-world.log',
    status: 'ready',
    scope: 'tenant-world-log-only',
    sampleSize: total,
    minimum: STANCE_MIN_SAMPLE,
    window: STANCE_WINDOW,
    dominant,
    label: stanceLabel(dominant),
    confidence,
    ratios,
    counts,
  };
}

const skillRegistryPath = (ctx: QuineCtx, tenant: string): string =>
  join(ctx.root, '.operator', `${tenant}.skills.json`);

function validSkillTelemetry(skill: Partial<SkillRecord>): skill is SkillRecord {
  const t = skill.telemetry;
  return typeof skill.skill_id === 'string' && !!t &&
    typeof t.uses === 'number' && typeof t.successes === 'number' && typeof t.failures === 'number' &&
    Array.isArray(t.scenarios) && Array.isArray(t.gotchas) && Array.isArray(t.amendments);
}

function skillTier(skill: SkillRecord): {
  tier: SkillTier;
  tierLabel: string;
  sampleSize: number;
  minimum: number;
  recentRate: number;
  recentWindow: number;
  gap?: string;
} {
  const sampleSize = skill.telemetry.uses;
  const totalRate = successRate(skill);
  const recent = recentRate(skill);
  const common = {
    sampleSize,
    minimum: DECLINE_MIN_USES,
    recentRate: Number(recent.rate.toFixed(2)),
    recentWindow: recent.n,
  };
  if (sampleSize < DECLINE_MIN_USES) {
    return {
      ...common,
      tier: 'unproven',
      tierLabel: 'UNPROVEN',
      gap: `need ${DECLINE_MIN_USES} uses for tier; found ${sampleSize}`,
    };
  }
  if (isDeclining(skill)) {
    return {
      ...common,
      tier: 'declining',
      tierLabel: 'DECLINING',
      gap: `recent success ${Math.round(recent.rate * 100)}% below ${Math.round(DECLINE_RATE * 100)}% over ${recent.n} uses`,
    };
  }
  if (skill.status === 'production' && hasProductionGradeTelemetry(skill)) {
    return { ...common, tier: 'production', tierLabel: 'PRODUCTION' };
  }
  if (totalRate >= SKILL_RELIABLE_RATE && recent.n >= DECLINE_MIN_USES && recent.rate >= SKILL_RELIABLE_RATE) {
    return { ...common, tier: 'reliable', tierLabel: 'RELIABLE' };
  }
  return { ...common, tier: 'learning', tierLabel: 'LEARNING' };
}

function skillPromotion(skill: SkillRecord, tier: ReturnType<typeof skillTier>): {
  status: SkillPromotionStatus;
  label: string;
  detail: string;
  requiredApproval: boolean;
} {
  const productionReady = skillProductionReadiness(skill).ready;
  if (skill.status === 'production' && tier.tier === 'production') {
    return {
      status: 'approved',
      label: 'PRODUCTION',
      detail: 'founder-approved production skill with healthy telemetry',
      requiredApproval: false,
    };
  }
  if (skill.status === 'validated' && productionReady) {
    return {
      status: 'founder-review',
      label: 'FOUNDER REVIEW',
      detail: 'eligible for production review; founder approval required',
      requiredApproval: true,
    };
  }
  if (tier.tier === 'reliable') {
    return {
      status: 'observe',
      label: 'OBSERVE',
      detail: `needs ${DECLINE_WINDOW} healthy uses at ${Math.round(SKILL_PRODUCTION_RATE * 100)}% before production review`,
      requiredApproval: true,
    };
  }
  return {
    status: 'blocked',
    label: 'NO PROMOTION',
    detail: tier.gap ?? 'skill is not reliable enough for production review',
    requiredApproval: true,
  };
}

function deriveSkillsEnvelope(ctx: QuineCtx, tenant: string): VisualEnvelope['skills'] {
  const raw = readJson(skillRegistryPath(ctx, tenant));
  if (!Array.isArray(raw)) {
    return { source: 'missing', total: 0, rows: [], gap: 'skill registry missing' };
  }
  const rows = raw
    .filter(validSkillTelemetry)
    .sort((a, b) => b.telemetry.uses - a.telemetry.uses || Number(b.updated ?? 0) - Number(a.updated ?? 0))
    .slice(0, 5)
    .map((skill) => {
      const tier = skillTier(skill);
      return {
        id: skill.skill_id,
        status: skill.status,
        uses: skill.telemetry.uses,
        successes: skill.telemetry.successes,
        failures: skill.telemetry.failures,
        successRate: Number(successRate(skill).toFixed(2)),
        declining: isDeclining(skill),
        ...tier,
        promotion: skillPromotion(skill, tier),
        updated: Number.isFinite(skill.updated) ? skill.updated : null,
      };
    });
  return {
    source: rows.length ? 'skill-registry' : 'missing',
    total: raw.length,
    rows,
    ...(rows.length ? {} : { gap: 'skill registry has no telemetry rows' }),
  };
}

function derivePolicyEnvelope(
  stance: VisualEnvelope['stance'],
  skills: VisualEnvelope['skills'],
  ledger: QuestLedger,
  gateItems: PaperclipOpenItem[] = [],
  prioritySignals?: PolicyPrioritySignals,
): VisualEnvelope['policy'] {
  return evaluateOperatorPolicy({ ledger, stance, skills, gateItems, prioritySignals });
}

function flagValue(args: string[], name: string, def = ''): string {
  const value = flag(args, name, def);
  return value.startsWith('--') ? def : value;
}

function optionalFlagValue(args: string[], name: string): string | undefined {
  const value = flagValue(args, name, '').trim();
  return value || undefined;
}

function numericFlagValue(args: string[], name: string): number | undefined {
  const raw = optionalFlagValue(args, name);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function booleanFlagValue(args: string[], name: string): boolean | undefined {
  const raw = optionalFlagValue(args, name)?.toLowerCase();
  if (raw === 'true' || raw === 'yes' || raw === '1') return true;
  if (raw === 'false' || raw === 'no' || raw === '0') return false;
  return undefined;
}

function prioritySourceCaptureFromArgs(args: string[]) {
  return {
    founderTarget: optionalFlagValue(args, '--founder-target'),
    founderWeight: numericFlagValue(args, '--founder-weight'),
    founderProof: optionalFlagValue(args, '--founder-proof'),
    owner: optionalFlagValue(args, '--owner'),
    capacity: numericFlagValue(args, '--capacity'),
    capacityProof: optionalFlagValue(args, '--capacity-proof'),
    amount: numericFlagValue(args, '--amount'),
    currency: optionalFlagValue(args, '--currency'),
    economicRisk: optionalFlagValue(args, '--economic-risk') as any,
    economicProof: optionalFlagValue(args, '--economic-proof'),
    available: numericFlagValue(args, '--available'),
    required: numericFlagValue(args, '--required'),
    availabilityProof: optionalFlagValue(args, '--availability-proof'),
    revoked: booleanFlagValue(args, '--revoked'),
    revocationProof: optionalFlagValue(args, '--revocation-proof'),
    urgencyScore: numericFlagValue(args, '--urgency-score'),
    urgencyProof: optionalFlagValue(args, '--urgency-proof'),
  };
}

function npcEventsPath(ctx: QuineCtx, tenant: string): string {
  return join(ctx.root, '.operator', `${tenant}.npc-events.jsonl`);
}

function isNpcEventKind(kind: string): kind is NpcEventKind {
  return (NPC_EVENT_KINDS as readonly string[]).includes(kind);
}

function isNpcEventSource(source: string): source is NpcEventSource {
  return (NPC_EVENT_SOURCES as readonly string[]).includes(source);
}

function isNpcAdviceAction(kind: string): kind is NpcAdviceActionKind {
  return (NPC_ADVICE_ACTIONS as readonly string[]).includes(kind);
}

function validNpcSlug(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,63}$/.test(id);
}

function rejectNpcOverclaim(...values: string[]): string | undefined {
  const hit = values.find((value) => NPC_OVERCLAIM_RE.test(value));
  return hit ? `npc event rejected: relationship overclaiming language is not allowed (${hit.match(NPC_OVERCLAIM_RE)?.[0]})` : undefined;
}

function npcEventSignature(row: NpcEventRecord): string {
  return JSON.stringify({
    tenant: row.tenant,
    npcId: row.npcId,
    kind: row.kind,
    source: row.source,
    detail: row.detail,
    evidence: row.evidence,
    contradicts: row.contradicts ?? '',
    advice: row.advice ?? null,
  });
}

function readNpcEvents(ctx: QuineCtx, tenant: string): NpcEventRecord[] {
  let text = '';
  try { text = readFileSync(npcEventsPath(ctx, tenant), 'utf8'); } catch { return []; }
  return text.split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter((row): row is NpcEventRecord => {
      if (!row || typeof row !== 'object') return false;
      const event = row as Partial<NpcEventRecord>;
      return event.schema === NPC_EVENT_SCHEMA &&
        event.tenant === tenant &&
        typeof event.id === 'string' &&
        typeof event.npcId === 'string' &&
        typeof event.kind === 'string' && isNpcEventKind(event.kind) &&
        typeof event.source === 'string' && isNpcEventSource(event.source) &&
        typeof event.detail === 'string' &&
        typeof event.evidence === 'string' &&
        typeof event.createdAt === 'string';
    })
    .filter((row, index, rows) => rows.findIndex((candidate) =>
      candidate.id === row.id || npcEventSignature(candidate) === npcEventSignature(row),
    ) === index)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

function npcRelationshipHistory(rows: NpcEventRecord[]): VisualNpcHistory {
  const latest = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).slice(0, 6);
  return {
    source: rows.length ? 'operator-npc-events@v1' : 'missing',
    total: rows.length,
    contradictions: rows.filter((row) => row.kind === 'contradiction' || !!row.contradicts).length,
    rows: latest.map((row) => ({
      id: row.id,
      kind: row.kind,
      source: row.source,
      detail: row.detail,
      evidence: row.evidence,
      createdAt: row.createdAt,
      ...(row.contradicts ? { contradicts: row.contradicts } : {}),
      ...(row.advice ? { advice: row.advice } : {}),
    })),
  };
}

function durableNpcEvents(rows: NpcEventRecord[]): Array<{
  id: string;
  kind: string;
  source: 'operator-npc-event';
  detail: string;
  ts?: number;
}> {
  return [...rows]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, 4)
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      source: 'operator-npc-event' as const,
      detail: row.detail,
      ts: Number.isFinite(Date.parse(row.createdAt)) ? Date.parse(row.createdAt) : undefined,
    }));
}

function npcAdvice(npcId: string, history: VisualNpcHistory): VisualNpcAdvice {
  if (history.contradictions > 0) {
    return {
      status: 'blocked',
      label: 'ADVICE BLOCKED',
      detail: `${history.contradictions} durable NPC contradiction event(s) require operator review`,
      proof: history.rows.find((row) => row.kind === 'contradiction' || row.contradicts)?.evidence ?? 'contradiction event served',
      action: { kind: 'review', label: 'Review NPC contradiction', target: `npc:${npcId}` },
    };
  }
  const adviceRow = history.rows.find((row) => row.advice);
  if (adviceRow?.advice) {
    return {
      status: 'ready',
      label: 'REVIEW ADVICE',
      detail: adviceRow.advice.detail,
      proof: adviceRow.evidence,
      action: adviceRow.advice.action,
    };
  }
  return {
    status: 'blocked',
    label: 'NO ADVICE',
    detail: history.total > 0 ? 'durable NPC events exist, but no advice event is served' : 'no durable NPC advice event served',
    proof: history.total > 0 ? `${history.total} durable NPC event(s), 0 advice events` : 'no durable NPC events served',
    action: { kind: 'collect-evidence', label: 'Record NPC evidence', target: `quine write quests npc-event ${npcId}` },
  };
}

function appendNpcEvent(args: string[], ctx: QuineCtx, tenant: string): unknown {
  const subIndex = args.indexOf('npc-event');
  const rest = args.slice(subIndex + 1).filter((arg) => !arg.startsWith('--') && !['--detail', '--evidence', '--source', '--advice', '--action-kind', '--action-label', '--target', '--contradicts'].includes(arg));
  const [npcId = '', kindRaw = 'note'] = rest;
  const kind = kindRaw.toLowerCase();
  const source = flagValue(args, '--source', 'operator-note');
  const detail = flagValue(args, '--detail', '').trim();
  const evidence = flagValue(args, '--evidence', detail).trim();
  const adviceDetail = (flagValue(args, '--advice', '') || (kind === 'advice' ? detail : '')).trim();
  const actionKindRaw = flagValue(args, '--action-kind', 'review');
  const actionKind = actionKindRaw.toLowerCase();
  const actionLabel = flagValue(args, '--action-label', actionKind === 'ask-founder' ? 'Ask founder' : actionKind === 'collect-evidence' ? 'Collect evidence' : 'Review advice').trim();
  const target = flagValue(args, '--target', `npc:${npcId}`).trim();
  const contradicts = flagValue(args, '--contradicts', '').trim();

  if (!validNpcSlug(npcId)) return 'usage: quine write quests npc-event <npc-id> <profile-signal|interaction|advice|contradiction|note> --detail "..." [--evidence "..."] [--advice "..."] [--tenant t]';
  if (!isNpcEventKind(kind)) return `npc event rejected: unknown kind "${kindRaw}"`;
  if (!isNpcEventSource(source)) return `npc event rejected: unknown source "${source}"`;
  if (!isNpcAdviceAction(actionKind)) return `npc event rejected: unknown advice action "${actionKindRaw}"`;
  if (!detail) return 'npc event rejected: --detail is required';
  if (!evidence) return 'npc event rejected: --evidence is required when detail is empty';
  const overclaim = rejectNpcOverclaim(detail, evidence, adviceDetail);
  if (overclaim) return overclaim;

  const nowIso = new Date().toISOString();
  const event: NpcEventRecord = {
    schema: NPC_EVENT_SCHEMA,
    id: `${tenant}:${npcId}:${kind}:${Date.now()}`,
    tenant,
    npcId,
    kind,
    source,
    detail,
    evidence,
    createdAt: nowIso,
    ...(contradicts ? { contradicts } : {}),
    ...(adviceDetail ? {
      advice: {
        detail: adviceDetail,
        action: {
          kind: actionKind,
          label: actionLabel || 'Review advice',
          target: target || `npc:${npcId}`,
        },
      },
    } : {}),
  };
  mkdirSync(join(ctx.root, '.operator'), { recursive: true });
  appendFileSync(npcEventsPath(ctx, tenant), JSON.stringify(event) + '\n');
  return {
    hypha: 'quests',
    op: 'npc-event',
    tenant,
    path: `.operator/${tenant}.npc-events.jsonl`,
    event: {
      id: event.id,
      npcId: event.npcId,
      kind: event.kind,
      source: event.source,
      advice: !!event.advice,
      contradicts: event.contradicts ?? null,
    },
  };
}

function sideQuestEventsPath(ctx: QuineCtx, tenant: string): string {
  return join(ctx.root, '.operator', `${tenant}.side-quests.jsonl`);
}

function isSideQuestEventStatus(status: string): status is SideQuestEventStatus {
  return (SIDE_QUEST_EVENT_STATUSES as readonly string[]).includes(status);
}

function isSideQuestEventSource(source: string): source is SideQuestEventSource {
  return (SIDE_QUEST_EVENT_SOURCES as readonly string[]).includes(source);
}

function rejectSideQuestOverclaim(...values: string[]): string | undefined {
  const hit = values.find((value) => SIDE_QUEST_OVERCLAIM_RE.test(value));
  return hit ? `side quest event rejected: reward/social overclaiming language is not allowed (${hit.match(SIDE_QUEST_OVERCLAIM_RE)?.[0]})` : undefined;
}

function readSideQuestEvents(ctx: QuineCtx, tenant: string): SideQuestEventRecord[] {
  let text = '';
  try { text = readFileSync(sideQuestEventsPath(ctx, tenant), 'utf8'); } catch { return []; }
  return text.split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter((row): row is SideQuestEventRecord => {
      if (!row || typeof row !== 'object') return false;
      const event = row as Partial<SideQuestEventRecord>;
      return event.schema === SIDE_QUEST_EVENT_SCHEMA &&
        event.tenant === tenant &&
        typeof event.id === 'string' &&
        typeof event.sideQuestId === 'string' &&
        typeof event.status === 'string' && isSideQuestEventStatus(event.status) &&
        typeof event.source === 'string' && isSideQuestEventSource(event.source) &&
        typeof event.detail === 'string' &&
        typeof event.proof === 'string' &&
        typeof event.createdAt === 'string';
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

function writeSideQuestEventRecord(ctx: QuineCtx, tenant: string, event: SideQuestEventRecord): string {
  mkdirSync(join(ctx.root, '.operator'), { recursive: true });
  const path = sideQuestEventsPath(ctx, tenant);
  appendFileSync(path, JSON.stringify(event) + '\n');
  return path;
}

function appendSideQuestEvent(args: string[], ctx: QuineCtx, tenant: string): unknown {
  const subIndex = args.indexOf('side-quest');
  const rest = args.slice(subIndex + 1).filter((arg) => !arg.startsWith('--') && !['--detail', '--proof', '--source', '--target', '--created-at'].includes(arg));
  const [sideQuestId = '', statusRaw = 'queued'] = rest;
  const status = statusRaw.toLowerCase();
  const source = flagValue(args, '--source', 'operator-note');
  const detail = flagValue(args, '--detail', '').trim();
  const proof = flagValue(args, '--proof', detail).trim();
  const target = flagValue(args, '--target', sideQuestId).trim();
  const createdAt = flagValue(args, '--created-at', new Date().toISOString()).trim();

  if (!validNpcSlug(sideQuestId)) return 'usage: quine write quests side-quest <side-quest-id> <queued|completed|expired> --detail "..." --proof "..." [--tenant t]';
  if (!isSideQuestEventStatus(status)) return `side quest event rejected: unknown status "${statusRaw}"`;
  if (!isSideQuestEventSource(source)) return `side quest event rejected: unknown source "${source}"`;
  if (!detail) return 'side quest event rejected: --detail is required';
  if (!proof) return 'side quest event rejected: --proof is required when detail is empty';
  if (!Number.isFinite(Date.parse(createdAt))) return `side quest event rejected: invalid --created-at "${createdAt}"`;
  const overclaim = rejectSideQuestOverclaim(detail, proof, target);
  if (overclaim) return overclaim;

  const event: SideQuestEventRecord = {
    schema: SIDE_QUEST_EVENT_SCHEMA,
    id: `${tenant}:${sideQuestId}:${status}:${Date.now()}`,
    tenant,
    sideQuestId,
    status,
    source,
    detail,
    proof,
    createdAt,
    ...(target ? { target } : {}),
  };
  writeSideQuestEventRecord(ctx, tenant, event);
  return {
    hypha: 'quests',
    op: 'side-quest',
    tenant,
    path: `.operator/${tenant}.side-quests.jsonl`,
    event: {
      id: event.id,
      sideQuestId: event.sideQuestId,
      status: event.status,
      source: event.source,
      target: event.target ?? null,
    },
  };
}

function miraRelationship(
  memoryRows: ReturnType<typeof cortexMemoryRowsFor>,
  npcRows: NpcEventRecord[] = [],
): VisualEnvelope['npc']['relationships'][number] {
  const matches = memoryRows
    .map((row) => {
      const text = [row.id, row.kind, ...Object.values(row.payload).map((v) => typeof v === 'string' ? v : '')]
        .join(' ')
        .toLowerCase();
      return { row, text };
    })
    .filter(({ text }) => /\b(mira|icp|ideal customer|customer persona|resonance)\b/.test(text));
  const history = npcRelationshipHistory(npcRows);
  const advice = npcAdvice('mira', history);
  const durableEvents = durableNpcEvents(npcRows);
  const durableEvidenceRows = npcRows.filter((row) => row.kind !== 'contradiction');
  const events = matches.slice(0, 4).map(({ row, text }) => ({
    id: row.id,
    kind: row.kind,
    source: 'tenant-cortex-memory' as const,
    detail: text.match(/\b(ideal customer|customer persona|icp|mira|resonance)\b/)?.[0] ?? 'tenant cortex memory mentions Mira or ICP signal',
    ts: row.ts,
  }));
  const contradictionCount = history.contradictions;
  if (matches.length === 0 && durableEvidenceRows.length === 0 && contradictionCount === 0) {
    return {
      id: 'mira',
      status: 'missing',
      detail: memoryRows.length
        ? `0/${memoryRows.length} tenant cortex memories mention Mira or ICP relationship evidence`
        : 'npc relationship state not served yet',
      proof: memoryRows.length
        ? `${memoryRows.length} tenant cortex memories scanned; no Mira/ICP signal`
        : 'no tenant cortex memories served',
      stage: {
        id: 'missing',
        label: 'MISSING',
        detail: 'no tenant-scoped Mira/ICP evidence served',
        confidence: 0,
      },
      events: durableEvents,
      history,
      advice,
      sampleSize: memoryRows.length,
      scope: 'tenant-cortex-only',
    };
  }
  const first = matches[0]?.row;
  const profileBacked =
    matches.length >= 2 ||
    durableEvidenceRows.length >= 2 ||
    matches.some(({ text }) => /\b(ideal customer|customer persona|profile|persona)\b/.test(text)) ||
    durableEvidenceRows.some((row) => row.kind === 'profile-signal');
  const denominator = Math.max(1, memoryRows.length + npcRows.length);
  const confidence = contradictionCount > 0 ? 0 : Number(((matches.length + durableEvidenceRows.length) / denominator).toFixed(2));
  return {
    id: 'mira',
    status: 'inferred',
    detail: contradictionCount > 0
      ? `${contradictionCount} durable NPC contradiction event(s) require review`
      : `${matches.length}/${memoryRows.length} tenant cortex memories and ${durableEvidenceRows.length} durable NPC events mention Mira or ICP signals`,
    proof: [...events, ...durableEvents].map((event) => `${event.id}: ${event.kind} · ${event.detail}`).join(' · '),
    stage: contradictionCount > 0
      ? {
          id: 'needs-review',
          label: 'NEEDS REVIEW',
          detail: 'durable NPC events include a contradiction; advice is blocked',
          confidence: 0,
        }
      : profileBacked
      ? {
          id: 'profile-backed',
          label: 'PROFILE BACKED',
          detail: 'tenant cortex has repeated or persona-specific Mira/ICP evidence',
          confidence,
        }
      : {
          id: 'sighted',
          label: 'SIGHTED',
          detail: 'tenant cortex has one Mira/ICP evidence event',
          confidence,
        },
    events: [...durableEvents, ...events].slice(0, 4),
    history,
    advice,
    sampleSize: matches.length + durableEvidenceRows.length,
    scope: 'tenant-cortex-only',
    evidence: first ? [first.id, first.kind] : durableEvidenceRows[0] ? [durableEvidenceRows[0].id, durableEvidenceRows[0].kind] : undefined,
  };
}

function deriveNpcEnvelope(ctx: QuineCtx, tenant: string, inputs: QuestInputs): VisualEnvelope['npc'] {
  const founderArcs = inputs.founder?.completedArcs?.length ?? 0;
  const memoryRows = cortexMemoryRowsFor(join(ctx.root, '.operator'), tenant);
  const npcRows = readNpcEvents(ctx, tenant);
  const miraRows = npcRows.filter((row) => row.npcId === 'mira');
  const founderNpcRows = npcRows.filter((row) => row.npcId === 'founder-npc');
  const founderHistory = npcRelationshipHistory(founderNpcRows);
  const founderAdvice = npcAdvice('founder-npc', founderHistory);
  const founderDurableEvents = durableNpcEvents(founderNpcRows);
  const founderContradictions = founderHistory.contradictions;
  const founderEvidenceRows = founderNpcRows.filter((row) => row.kind !== 'contradiction');
  const source = memoryRows.length > 0 && npcRows.length > 0
    ? 'mixed'
    : memoryRows.length > 0
      ? 'cortex-memory'
      : npcRows.length > 0
        ? 'operator-npc-events'
        : 'missing';
  return {
    source,
    relationships: [
      miraRelationship(memoryRows, miraRows),
      {
        id: 'founder-npc',
        status: founderArcs > 0 || founderEvidenceRows.length > 0 || founderContradictions > 0 ? 'inferred' : 'missing',
        detail: founderContradictions > 0
          ? `${founderContradictions} durable founder NPC contradiction event(s) require review`
          : founderArcs > 0
            ? `${founderArcs} inherited founder arcs`
            : founderEvidenceRows.length > 0
              ? `${founderEvidenceRows.length} durable founder NPC event(s)`
              : 'founder memory not served yet',
        proof: founderContradictions > 0
          ? founderHistory.rows.find((row) => row.kind === 'contradiction' || row.contradicts)?.evidence ?? 'founder NPC contradiction event served'
          : founderArcs > 0
            ? `${founderArcs} inherited founder arcs served`
            : founderEvidenceRows.length > 0
              ? founderEvidenceRows.map((row) => `${row.id}: ${row.kind} · ${row.detail}`).join(' · ')
              : 'no inherited founder arcs served',
        stage: founderContradictions > 0
          ? {
              id: 'needs-review',
              label: 'NEEDS REVIEW',
              detail: 'durable founder NPC events include a contradiction; advice is blocked',
              confidence: 0,
            }
          : founderArcs > 0
          ? {
              id: 'founder-backed',
              label: 'FOUNDER BACKED',
              detail: 'founder progress exists as inherited arc memory',
              confidence: 1,
            }
          : founderEvidenceRows.length > 0
            ? {
                id: 'sighted',
                label: 'SIGHTED',
                detail: 'durable founder NPC event exists',
                confidence: 1,
              }
          : {
              id: 'missing',
              label: 'MISSING',
              detail: 'no inherited founder arc memory served',
              confidence: 0,
            },
        events: founderArcs > 0
          ? [{ id: 'founder-arcs', kind: 'founder-progress', source: 'founder-arcs', detail: `${founderArcs} inherited arcs` }, ...founderDurableEvents].slice(0, 4)
          : founderDurableEvents,
        history: founderHistory,
        advice: founderAdvice,
        sampleSize: founderArcs + founderEvidenceRows.length,
        scope: 'founder-arcs',
      },
    ],
  };
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function deriveSocialEnvelope(
  tenant: string,
  inputs: QuestInputs,
  ledger: QuestLedger,
  openItems: PaperclipOpenItem[] = [],
): VisualEnvelope['social'] {
  const rows: VisualEnvelope['social']['rows'] = [];
  const paperclip = inputs.paperclip;
  if (paperclip?.reachable) {
    const pending = Number(paperclip.pendingApprovals ?? 0);
    rows.push({
      id: 'paperclip-org',
      title: 'PAPERCLIP ORG',
      state: 'ready',
      detail: `${plural(paperclip.agents, 'agent')} · ${plural(paperclip.issuesOpen, 'open handoff')} · ${plural(pending, 'pending approval')}`,
      proof: `tenant ${tenant} Paperclip snapshot reachable`,
      source: 'paperclip-quest-inputs',
      scope: 'tenant-handoff-only',
      evidence: [
        { label: 'agents', status: 'served', detail: String(paperclip.agents) },
        { label: 'open handoffs', status: 'served', detail: String(paperclip.issuesOpen) },
        { label: 'pending approvals', status: 'served', detail: String(pending) },
      ],
    });
  }

  if (openItems.length > 0) {
    rows.push({
      id: 'handoff-queue',
      title: 'HANDOFF QUEUE',
      state: 'ready',
      detail: `${plural(openItems.length, 'open tenant handoff')} awaiting founder review`,
      proof: openItems.slice(0, 4).map((item) => `${item.id}: ${item.status} · owner ${item.owner}`).join(' · '),
      source: 'paperclip-open-items',
      scope: 'tenant-handoff-only',
      evidence: openItems.slice(0, 4).map((item) => ({
        label: item.id,
        status: item.status,
        detail: `${item.title} · owner ${item.owner}`,
      })),
    });
  }

  const founderGate = ledger.rows.find((row) => row.quest.id === 'the-gate');
  if (founderGate && founderGate.status !== 'locked') {
    rows.push({
      id: 'founder-gate',
      title: 'FOUNDER GATE',
      state: founderGate.status === 'complete' ? 'ready' : 'gap',
      detail: `${founderGate.quest.arc} · ${founderGate.quest.title} · ${founderGate.status}`,
      proof: founderGate.evidence,
      source: 'quest-ledger',
      scope: 'founder-gate-only',
      evidence: [rowEvidence(founderGate)],
      ...(founderGate.status === 'complete' ? {} : { gap: 'founder gate is visible but not resolved' }),
    });
  }

  const clientHandoff = ledger.rows.find((row) => row.quest.id === 'the-handoff');
  if (clientHandoff && clientHandoff.status !== 'locked') {
    rows.push({
      id: 'client-handoff',
      title: 'CLIENT HANDOFF',
      state: clientHandoff.status === 'complete' ? 'ready' : 'gap',
      detail: `${clientHandoff.quest.arc} · ${clientHandoff.quest.title} · ${clientHandoff.status}`,
      proof: clientHandoff.evidence,
      source: 'quest-ledger',
      scope: 'client-handoff-only',
      evidence: [rowEvidence(clientHandoff)],
      ...(clientHandoff.status === 'complete' ? {} : { gap: 'client acceptance is not complete yet' }),
    });
  }

  if (rows.length === 0) {
    return {
      source: 'coordination-evidence@v1',
      status: 'gap',
      scope: 'tenant-handoff-only',
      rows: [{
        id: 'social-gap',
        title: 'SOCIAL GAP',
        state: 'gap',
        detail: 'no tenant-scoped bridge or handoff evidence served',
        proof: 'Paperclip open items, founder gate, and client handoff signals are absent',
        source: 'missing',
        scope: 'tenant-handoff-only',
        evidence: [],
        gap: 'coordination evidence missing',
      }],
      gap: 'no tenant-scoped bridge or handoff evidence served',
    };
  }

  const ready = rows.some((row) => row.state === 'ready');
  return {
    source: 'coordination-evidence@v1',
    status: ready ? 'ready' : 'gap',
    scope: 'tenant-handoff-only',
    rows: rows.slice(0, 5),
    ...(ready ? {} : { gap: rows[0]?.gap ?? 'coordination evidence is visible but unresolved' }),
  };
}

function decisionRow(
  id: DecisionSignalId,
  title: string,
  state: DecisionSignalState,
  detail: string,
  proof: string,
  source: DecisionSignalSource,
  scope: VisualEnvelope['decisionContext']['rows'][number]['scope'],
  evidence: VisualSenseEvidence[] = [],
  gap?: string,
): VisualEnvelope['decisionContext']['rows'][number] {
  return {
    id,
    title,
    state,
    detail,
    proof,
    source,
    scope,
    evidence,
    ...(gap ? { gap } : {}),
  };
}

function prioritySignalsForContext(inputs: QuestInputs): PolicyPrioritySignals | undefined {
  const signals = inputs.prioritySignals as any;
  if (!signals || signals.source !== 'operator-priority-signals@v1') return undefined;
  if (!signals.founderPreference?.targetId || typeof signals.founderPreference.weight !== 'number' || !signals.founderPreference.proof) return undefined;
  if (!signals.ownerLoad?.owner || typeof signals.ownerLoad.openItems !== 'number' || typeof signals.ownerLoad.capacity !== 'number' || !signals.ownerLoad.proof) return undefined;
  if (typeof signals.economicRisk?.amount !== 'number' || !signals.economicRisk.currency || !signals.economicRisk.risk || !signals.economicRisk.proof) return undefined;
  if (typeof signals.teamAvailability?.available !== 'number' || typeof signals.teamAvailability.required !== 'number' || !signals.teamAvailability.proof) return undefined;
  if (typeof signals.memberRevocation?.revoked !== 'boolean' || !signals.memberRevocation.proof) return undefined;
  if (typeof signals.crossTenantUrgency?.score !== 'number' || typeof signals.crossTenantUrgency.tenants !== 'number' || !signals.crossTenantUrgency.proof) return undefined;
  return signals as PolicyPrioritySignals;
}

function deriveDecisionContextEnvelope(
  inputs: QuestInputs,
  openItems: PaperclipOpenItem[] = [],
): VisualEnvelope['decisionContext'] {
  const prioritySignals = prioritySignalsForContext(inputs);
  const ownerCounts = new Map<string, number>();
  for (const item of openItems) ownerCounts.set(item.owner, (ownerCounts.get(item.owner) ?? 0) + 1);
  const ownerLoad = [...ownerCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const ownerEvidence = ownerLoad.slice(0, 4).map(([owner, n]) => ({
    label: owner,
    status: 'served',
    detail: `${n} open handoff${n === 1 ? '' : 's'}`,
  }));
  const project = inputs.project;
  const projectBits = project ? [
    `brief ${project.briefStatus ?? 'missing'}`,
    `contract ${project.contractExists === true ? 'signed' : project.contractExists === false ? 'pending' : 'missing'}`,
    `deposit ${project.depositReceived === true ? 'received' : project.depositReceived === false ? 'pending' : 'missing'}`,
  ] : [];
  const tenantCount = inputs.tenants?.length ?? 0;
  const rows = [
    prioritySignals
      ? decisionRow(
          'founder-preference',
          'FOUNDER PREFERENCE',
          'served',
          `${prioritySignals.founderPreference.targetId} · weight ${prioritySignals.founderPreference.weight}`,
          prioritySignals.founderPreference.proof,
          'operator-priority-signals',
          'tenant-only',
          [{ label: 'target', status: 'served', detail: prioritySignals.founderPreference.targetId }],
        )
      : decisionRow(
          'founder-preference',
          'FOUNDER PREFERENCE',
          'gap',
          'founder preference signal not served',
          'no founder preference row exists in the current visual envelope',
          'missing',
          'tenant-only',
          [],
          'founder preference missing',
        ),
    prioritySignals
      ? decisionRow(
          'owner-load',
          'OWNER LOAD',
          'served',
          `${prioritySignals.ownerLoad.owner} ${prioritySignals.ownerLoad.openItems}/${prioritySignals.ownerLoad.capacity}`,
          prioritySignals.ownerLoad.proof,
          'operator-priority-signals',
          'tenant-only',
          [{ label: prioritySignals.ownerLoad.owner, status: 'served', detail: `${prioritySignals.ownerLoad.openItems}/${prioritySignals.ownerLoad.capacity}` }],
        )
      : ownerLoad.length > 0
      ? decisionRow(
          'owner-load',
          'OWNER LOAD',
          'served',
          ownerLoad.map(([owner, n]) => `${owner} ${n}`).join(' · '),
          openItems.slice(0, 4).map((item) => `${item.id}: owner ${item.owner}`).join(' · '),
          'paperclip-open-items',
          'tenant-only',
          ownerEvidence,
        )
      : decisionRow(
          'owner-load',
          'OWNER LOAD',
          'gap',
          'no owner load signal served',
          'no Paperclip open items with owner fields were served',
          'missing',
          'tenant-only',
          [],
          'owner load missing',
        ),
    prioritySignals
      ? decisionRow(
          'economic-risk',
          'ECONOMIC RISK',
          'served',
          `${prioritySignals.economicRisk.risk} · ${prioritySignals.economicRisk.currency} ${prioritySignals.economicRisk.amount}`,
          prioritySignals.economicRisk.proof,
          'operator-priority-signals',
          'project-only',
          [{ label: 'amount', status: 'served', detail: `${prioritySignals.economicRisk.currency} ${prioritySignals.economicRisk.amount}` }],
        )
      : project
      ? decisionRow(
          'economic-risk',
          'ECONOMIC RISK',
          'served',
          `${projectBits.join(' · ')} · amount not served`,
          'project evidence serves commitment state, but no amount/currency risk score',
          'project-evidence',
          'project-only',
          projectBits.map((bit) => ({ label: bit.split(' ')[0], status: 'served', detail: bit })),
        )
      : decisionRow(
          'economic-risk',
          'ECONOMIC RISK',
          'gap',
          'economic commitment state not served',
          'no project evidence object served for brief, contract, deposit, amount, or currency',
          'missing',
          'project-only',
          [],
          'economic risk missing',
        ),
    prioritySignals
      ? decisionRow(
          'team-availability',
          'TEAM AVAILABILITY',
          'served',
          `${prioritySignals.teamAvailability.available}/${prioritySignals.teamAvailability.required} available`,
          prioritySignals.teamAvailability.proof,
          'operator-priority-signals',
          'tenant-only',
          [{ label: 'availability', status: 'served', detail: `${prioritySignals.teamAvailability.available}/${prioritySignals.teamAvailability.required}` }],
        )
      : decisionRow(
          'team-availability',
          'TEAM AVAILABILITY',
          'gap',
          'team availability signal not served',
          'Paperclip owners are not availability or capacity signals',
          'missing',
          'tenant-only',
          [],
          'team availability missing',
        ),
    prioritySignals
      ? decisionRow(
          'member-revocation',
          'MEMBER REVOCATION',
          'served',
          prioritySignals.memberRevocation.revoked ? 'member revocation active' : 'no member revocation active',
          prioritySignals.memberRevocation.proof,
          'operator-priority-signals',
          'tenant-only',
          [{ label: 'revoked', status: 'served', detail: String(prioritySignals.memberRevocation.revoked) }],
        )
      : decisionRow(
          'member-revocation',
          'MEMBER REVOCATION',
          'gap',
          'member revocation state not served',
          'bridge/member token revocation state is not present in the visual envelope',
          'missing',
          'tenant-only',
          [],
          'member revocation missing',
        ),
    prioritySignals
      ? decisionRow(
          'cross-tenant-urgency',
          'CROSS-TENANT URGENCY',
          'served',
          `score ${prioritySignals.crossTenantUrgency.score} across ${prioritySignals.crossTenantUrgency.tenants} tenant${prioritySignals.crossTenantUrgency.tenants === 1 ? '' : 's'}`,
          prioritySignals.crossTenantUrgency.proof,
          'operator-priority-signals',
          'cross-tenant',
          [{ label: 'urgency score', status: 'served', detail: String(prioritySignals.crossTenantUrgency.score) }],
        )
      : tenantCount > 0
      ? decisionRow(
          'cross-tenant-urgency',
          'CROSS-TENANT URGENCY',
          'gap',
          `${tenantCount} tenant${tenantCount === 1 ? '' : 's'} registered; urgency scores not served`,
          'tenant registry count is served, but no cross-tenant urgency score exists',
          'tenant-registry',
          'cross-tenant',
          [{ label: 'tenant registry', status: 'served', detail: `${tenantCount} tenant${tenantCount === 1 ? '' : 's'}` }],
          'cross-tenant urgency missing',
        )
      : decisionRow(
          'cross-tenant-urgency',
          'CROSS-TENANT URGENCY',
          'gap',
          'cross-tenant urgency signal not served',
          'no tenant registry or urgency score served',
          'missing',
          'cross-tenant',
          [],
          'cross-tenant urgency missing',
        ),
  ];
  return {
    source: 'decision-context@v1',
    status: 'ready',
    served: rows.filter((row) => row.state === 'served').length,
    gaps: rows.filter((row) => row.state === 'gap').length,
    rows,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function liveProofTitle(id: string): string {
  if (id === 'device-webview-proof') return 'DEVICE WEBVIEW PROOF';
  if (id === 'worker-list-proof') return 'WORKER LIST PROOF';
  if (id === 'signed-action-smoke') return 'SIGNED ACTION SMOKE';
  return id.replace(/[-_]+/g, ' ').toUpperCase();
}

function normalizeLiveProofState(value: unknown): LiveProofState {
  return value === 'complete' || value === 'ready' || value === 'ready-to-capture' || value === 'blocked'
    ? value
    : 'gap';
}

function liveProofPrerequisites(value: unknown): VisualSenseEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 14).map((entry, index) => {
    const row = isRecord(entry) ? entry : {};
    const id = String(row.id ?? `prerequisite-${index + 1}`);
    return {
      label: id,
      status: String(row.state ?? row.status ?? 'blocked'),
      detail: String(row.detail ?? 'prerequisite detail missing'),
    };
  });
}

function missingLiveProofEnvelope(gap: string): VisualEnvelope['liveProof'] {
  return {
    source: 'missing',
    status: 'missing',
    summary: { ready: 0, blocked: 3, total: 3, liveProofReady: false },
    invariant: LIVE_PROOF_CAPTURE_INVARIANT,
    rows: [
      {
        id: 'live-proof-readiness',
        title: 'LIVE PROOF GAP',
        state: 'gap',
        detail: gap,
        proof: `${LIVE_PROOF_READINESS_PATH} is not a served readiness receipt`,
        source: 'missing',
        command: 'npm run proof:tg-live-readiness',
        writes: LIVE_PROOF_READINESS_PATH,
        prerequisites: [{ label: 'readiness.json', status: 'blocked', detail: gap }],
        privacy: ['capture plan is run guidance, not proof'],
      },
    ],
    gap,
  };
}

function deriveLiveProofEnvelope(ctx: QuineCtx, tenant: string): VisualEnvelope['liveProof'] {
  const readiness = readJson(join(ctx.root, LIVE_PROOF_READINESS_PATH));
  if (!isRecord(readiness) || readiness.schema !== 'cambium.tg-live-proof-readiness.v1') {
    return missingLiveProofEnvelope(`live proof readiness missing at ${LIVE_PROOF_READINESS_PATH}`);
  }
  const readinessTenant = typeof readiness.tenant === 'string' ? readiness.tenant : '';
  if (readinessTenant && readinessTenant !== tenant) {
    return missingLiveProofEnvelope(`live proof readiness tenant ${readinessTenant} does not match ${tenant}`);
  }
  const summary = isRecord(readiness.summary) ? readiness.summary : {};
  const capturePlan = isRecord(readiness.capturePlan) ? readiness.capturePlan : {};
  const invariant = typeof capturePlan.invariant === 'string' && capturePlan.invariant.trim()
    ? capturePlan.invariant
    : LIVE_PROOF_CAPTURE_INVARIANT;
  const steps = Array.isArray(capturePlan.steps) ? capturePlan.steps : [];
  const rows = steps.slice(0, 3).map((entry, index) => {
    const step = isRecord(entry) ? entry : {};
    const id = String(step.id ?? `live-proof-step-${index + 1}`);
    const prerequisites = liveProofPrerequisites(step.prerequisites);
    const blocked = prerequisites.filter((item) => item.status !== 'ready').length;
    const ready = prerequisites.length - blocked;
    const state = normalizeLiveProofState(step.state);
    const writes = String(step.writes ?? '');
    const detail = state === 'complete' || state === 'ready'
      ? `${writes || id} validates ready as a redacted receipt`
      : state === 'ready-to-capture'
        ? `${ready}/${prerequisites.length} prerequisites ready; capture can run, but no receipt is proof yet`
        : prerequisites.length
          ? `${blocked}/${prerequisites.length} prerequisites blocked`
          : 'capture prerequisites are not served';
    return {
      id,
      title: liveProofTitle(id),
      state,
      detail,
      proof: `${writes || 'receipt path missing'}; ${invariant}`,
      source: 'tg-live-proof-capture-plan' as const,
      command: String(step.command ?? 'npm run proof:tg-live-readiness'),
      writes,
      prerequisites,
      privacy: Array.isArray(step.privacy) ? step.privacy.slice(0, 5).map(String) : ['redacted receipt required'],
    };
  });
  return {
    source: 'tg-live-proof-readiness@v1',
    status: readiness.status === 'ready' ? 'ready' : 'blocked',
    generatedAt: typeof readiness.generatedAt === 'string' ? readiness.generatedAt : undefined,
    workerUrl: typeof readiness.workerUrl === 'string' ? readiness.workerUrl : typeof capturePlan.workerUrl === 'string' ? capturePlan.workerUrl : undefined,
    summary: {
      ready: Number(summary.ready ?? 0),
      blocked: Number(summary.blocked ?? rows.filter((row) => row.state === 'blocked' || row.state === 'gap').length),
      total: Number(summary.total ?? rows.length),
      liveProofReady: summary.liveProofReady === true,
    },
    invariant,
    rows: rows.length ? rows : missingLiveProofEnvelope('live proof capturePlan.steps missing').rows,
    ...(readiness.status === 'ready' ? {} : { gap: 'live Telegram WebView and Worker proof are not complete yet' }),
  };
}

function sideQuestRuntimeFor(
  row: VisualEnvelope['sideQuests']['rows'][number],
  events: SideQuestEventRecord[],
  derivedAt: string,
): VisualSideQuestRuntime {
  const history = events
    .filter((event) => event.sideQuestId === row.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const rows = history.slice(-6).reverse().map((event) => ({
    id: event.id,
    status: event.status,
    source: event.source,
    detail: event.detail,
    proof: event.proof,
    createdAt: event.createdAt,
    ...(event.target ? { target: event.target } : {}),
  }));
  if (history.length === 0) {
    return {
      source: 'missing',
      status: 'triggered',
      total: 0,
      proof: 'no operator side-quest events served',
      rows: [],
    };
  }
  const latest = history[history.length - 1];
  let status: SideQuestStatus = latest.status;
  let proof = latest.proof;
  let expiredAt: string | undefined;
  if (latest.status === 'queued') {
    const queuedAt = Date.parse(latest.createdAt);
    const derived = Date.parse(derivedAt);
    const staleAfter = Number(row.lifetime.staleAfterMinutes ?? 0);
    if (Number.isFinite(queuedAt) && Number.isFinite(derived) && staleAfter > 0) {
      const expires = queuedAt + staleAfter * 60_000;
      if (derived >= expires) {
        status = 'expired';
        expiredAt = new Date(expires).toISOString();
        proof = `${latest.id} queued at ${latest.createdAt} expired at ${expiredAt}`;
      }
    }
  }
  return {
    source: 'operator-side-quests@v1',
    status,
    total: history.length,
    proof,
    ...(expiredAt ? { expiredAt } : {}),
    latest: {
      id: latest.id,
      status: latest.status,
      source: latest.source,
      detail: latest.detail,
      proof: latest.proof,
      createdAt: latest.createdAt,
      ...(latest.target ? { target: latest.target } : {}),
    },
    rows,
  };
}

function applySideQuestRuntime(
  row: VisualEnvelope['sideQuests']['rows'][number],
  events: SideQuestEventRecord[],
  derivedAt: string,
): VisualEnvelope['sideQuests']['rows'][number] {
  const runtime = sideQuestRuntimeFor(row, events, derivedAt);
  if (runtime.source === 'missing') return { ...row, runtime };
  const latest = runtime.latest;
  const runtimeDetail = latest?.detail ?? row.detail;
  const detail = runtime.status === 'triggered'
    ? row.detail
    : `${runtime.status.toUpperCase()} · ${runtimeDetail}`;
  return {
    ...row,
    status: runtime.status,
    detail,
    runtime,
  };
}

function deriveSideQuestEnvelope(
  wake: VisualEnvelope['wake'],
  stance: VisualEnvelope['stance'],
  skills: VisualEnvelope['skills'],
  policy: VisualEnvelope['policy'],
  npc: VisualEnvelope['npc'],
  ledger: QuestLedger,
  openItems: PaperclipOpenItem[] = [],
  sideQuestEvents: SideQuestEventRecord[] = [],
  derivedAt = '',
): VisualEnvelope['sideQuests'] {
  const rows: VisualEnvelope['sideQuests']['rows'] = [];
  const add = (row: VisualEnvelope['sideQuests']['rows'][number]) => rows.push(row);
  const refreshLifetime = {
    scope: 'until-next-refresh' as const,
    staleAfterMinutes: 360,
    detail: 'expires when the next quest envelope is pushed or the envelope becomes stale',
  };
  const missingWake = wake.steps.filter((step) => step.status === 'missing');
  if (missingWake.length > 0) {
    add({
      id: 'wake-proof',
      title: 'WAKE PROOF',
      status: 'triggered',
      trigger: 'wake.steps.missing',
      detail: `${missingWake.length} wake step${missingWake.length === 1 ? '' : 's'} awaiting signal`,
      proof: missingWake.map((step) => `${step.id}: ${step.detail}`).join(' · '),
      origin: wake.source,
      owner: 'operator',
      action: { kind: 'refresh', label: 'Refresh quest evidence', target: 'quine write quests push' },
      lifetime: refreshLifetime,
      completion: { kind: 'proof-arrives', proof: 'all wake steps referenced by this row become proved or explicitly absent' },
    });
  }

  if (stance.status !== 'ready') {
    add({
      id: 'stance-sample',
      title: 'STANCE SAMPLE',
      status: 'triggered',
      trigger: 'stance.insufficient',
      detail: stance.gap ?? 'tenant stance sample missing',
      proof: `${stance.sampleSize}/${stance.minimum} tenant lane events`,
      origin: stance.source,
      owner: 'operator',
      action: { kind: 'collect-evidence', label: 'Record tenant lane events', target: 'tenant world.log' },
      lifetime: { scope: 'until-evidence-arrives', staleAfterMinutes: 360, detail: 'remains open until tenant lane sample reaches the minimum' },
      completion: { kind: 'proof-arrives', proof: `tenant stance sample reaches ${stance.minimum} events` },
    });
  }

  if (skills.source !== 'skill-registry' || skills.rows.length === 0) {
    add({
      id: 'skill-registry',
      title: 'SKILL REGISTRY',
      status: 'triggered',
      trigger: 'skills.missing',
      detail: skills.gap ?? 'skill telemetry missing',
      proof: `${skills.rows.length}/${skills.total} served skill telemetry rows`,
      origin: skills.source,
      owner: 'operator',
      action: { kind: 'refresh', label: 'Refresh skill telemetry', target: `.operator/<tenant>.skills.json` },
      lifetime: refreshLifetime,
      completion: { kind: 'proof-arrives', proof: 'skill registry serves at least one telemetry row' },
    });
  }

  const promotionRows = skills.rows.filter((skill) => skill.promotion.status === 'founder-review');
  if (promotionRows.length > 0) {
    add({
      id: 'skill-promotion-review',
      title: 'PROMOTION REVIEW',
      status: 'triggered',
      trigger: 'skills.promotion.founder-review',
      detail: `${promotionRows[0].id} is waiting for founder review`,
      proof: promotionRows.map((skill) => `${skill.id}: ${skill.promotion.detail}`).join(' · '),
      origin: 'skill-registry',
      owner: 'founder',
      action: { kind: 'founder-review', label: 'Queue founder review', target: promotionRows[0].id },
      lifetime: { scope: 'until-consumed', staleAfterMinutes: 1440, detail: 'remains open until the signed promotion decision is consumed or superseded' },
      completion: { kind: 'queue-consumed', proof: 'promotion audit records approved, rejected, stale, or already-production result' },
    });
  }

  if (openItems.length > 0) {
    add({
      id: 'gate-review',
      title: 'GATE REVIEW',
      status: 'triggered',
      trigger: 'gate.openItems',
      detail: `${openItems.length} open handoff${openItems.length === 1 ? '' : 's'} awaiting founder attention`,
      proof: openItems.slice(0, 4).map((item) => `${item.id}: ${item.status}`).join(' · '),
      origin: 'paperclip-open-items',
      owner: 'founder',
      action: { kind: 'founder-review', label: 'Open signed Gate chamber', target: openItems[0].id },
      lifetime: { scope: 'until-consumed', staleAfterMinutes: 1440, detail: 'remains open until the gate decision is consumed, rerolled, or superseded' },
      completion: { kind: 'queue-consumed', proof: 'gate action is consumed with a durable approve, reroll, or superseded result' },
    });
  }

  if (policy.status !== 'ready') {
    add({
      id: 'policy-unblock',
      title: 'POLICY UNBLOCK',
      status: 'triggered',
      trigger: 'policy.blocked',
      detail: policy.gap ?? policy.blockers[0] ?? 'operator policy blocked',
      proof: policy.blockers.slice(0, 4).join(' · ') || 'blocked without served blockers',
      origin: policy.source,
      owner: 'system',
      action: { kind: 'inspect', label: 'Inspect policy blockers', target: policy.rulesVersion },
      lifetime: refreshLifetime,
      completion: { kind: 'policy-ready', proof: 'operator policy serves a ready next action or a narrower blocker' },
    });
  }

  const mira = npc.relationships.find((rel) => rel.id === 'mira');
  if (mira && mira.status === 'missing') {
    add({
      id: 'mira-evidence',
      title: 'MIRA EVIDENCE',
      status: 'triggered',
      trigger: 'npc.mira.missing',
      detail: mira.detail,
      proof: `${mira.sampleSize ?? 0} tenant cortex matches`,
      origin: npc.source,
      owner: 'operator',
      action: { kind: 'collect-evidence', label: 'Mint tenant cortex memory', target: 'npc.mira' },
      lifetime: { scope: 'until-evidence-arrives', staleAfterMinutes: 1440, detail: 'remains open until tenant cortex evidence mentions Mira or ICP signals' },
      completion: { kind: 'proof-arrives', proof: 'tenant-scoped cortex memory backs Mira relationship evidence' },
    });
  }

  const active = ledger.current;
  if (!active && rows.length === 0) {
    return {
      source: 'pure-trigger-predicates',
      status: 'empty',
      rows: [],
      gap: 'no side quest triggers; quest ledger has no active frontier',
    };
  }

  const rowsWithRuntime = rows.map((row) => applySideQuestRuntime(row, sideQuestEvents, derivedAt));
  return rowsWithRuntime.length > 0
    ? { source: 'pure-trigger-predicates', status: 'ready', rows: rowsWithRuntime }
    : {
        source: 'pure-trigger-predicates',
        status: 'empty',
        rows: [],
        gap: 'no side quest triggers from current evidence',
      };
}

export function buildVisualEnvelope(
  ctx: QuineCtx,
  tenant: string,
  inputs: QuestInputs,
  ledger: QuestLedger,
  meta: { source: string; derivedAt: string; openItems?: PaperclipOpenItem[] },
): VisualEnvelope {
  const wakeEvents = readWakeEvents(ctx, tenant);
  const wake = deriveWakeEnvelope(meta.source, meta.derivedAt, ledger, wakeEvents);
  const lanes = deriveLaneEnvelope(inputs);
  const senses = deriveSenseEnvelope(inputs, ledger, meta.derivedAt, meta.openItems);
  const insights = deriveInsightEnvelope(ctx, tenant, ledger);
  const stance = deriveStanceEnvelope(inputs);
  const skills = deriveSkillsEnvelope(ctx, tenant);
  const policy = derivePolicyEnvelope(stance, skills, ledger, meta.openItems, inputs.prioritySignals);
  const npc = deriveNpcEnvelope(ctx, tenant, inputs);
  const social = deriveSocialEnvelope(tenant, inputs, ledger, meta.openItems);
  const decisionContext = deriveDecisionContextEnvelope(inputs, meta.openItems);
  const liveProof = deriveLiveProofEnvelope(ctx, tenant);
  const sideQuestEvents = readSideQuestEvents(ctx, tenant);
  return {
    wake,
    lanes,
    senses,
    insights,
    stance,
    skills,
    policy,
    npc,
    social,
    decisionContext,
    liveProof,
    sideQuests: deriveSideQuestEnvelope(wake, stance, skills, policy, npc, ledger, meta.openItems, sideQuestEvents, meta.derivedAt),
  };
}

/** Gather everything the quest fold may look at — every source fail-soft. */
export function gatherQuestInputs(ctx: QuineCtx, tenant: string): QuestInputs {
  const opDir = join(ctx.root, '.operator');
  const onb = readJson(join(opDir, `${tenant}.onboarding.json`));
  const main = readJson(join(opDir, `${tenant}.world.json`));

  const inputs: QuestInputs = {};
  if (onb && typeof onb.stepIndex === 'number') {
    inputs.onboarding = {
      stepIndex: onb.stepIndex,
      drivesActivated: Array.isArray(onb.drivesActivated) ? onb.drivesActivated : [],
      noesisMoments: Number(onb.noesisMoments ?? 0),
    };
  }
  const worlds = [onb?.world, main].filter(Boolean);
  if (worlds.length > 0) {
    inputs.world = {
      version: Math.max(...worlds.map((w: any) => Number(w.version ?? 0))),
      artifacts: Object.assign({}, ...worlds.map((w: any) => w.artifacts ?? {})),
      log: worlds.flatMap((w: any) => (Array.isArray(w.log) ? w.log : [])),
    };
  }
  inputs.cortexCount = cortexCountFor(opDir, tenant);
  try {
    inputs.tenants = readdirSync(opDir)
      .map((f) => f.match(/^(.+)\.world\.json$/)?.[1])
      .filter((t): t is string => !!t && !t.startsWith('_'));
  } catch { /* no .operator dir yet */ }
  try {
    inputs.isolationSuite = readdirSync(join(ctx.root, 'bin', 'operator'))
      .some((f) => /tenan/i.test(f) && /\.test\.ts$/.test(f));      // flips true when M3 C4 lands
  } catch { inputs.isolationSuite = false; }
  // M5 Phase Q Bridge: founder-level completion (arcs I–IX inherited by all tenants)
  const founder = readJson(join(opDir, 'founder.json'));
  if (founder && Array.isArray(founder.completedArcs)) {
    inputs.founder = { completedArcs: founder.completedArcs };
  }
  // M5 Phase Q Bridge: project/delivery evidence (arcs X+)
  const proj = readJson(join(opDir, `${tenant}.project.json`));
  if (proj && typeof proj === 'object') {
    inputs.project = proj;
  }
  const prioritySignals = readJson(join(opDir, `${tenant}.priority-signals.json`));
  if (prioritySignals && typeof prioritySignals === 'object' && prioritySignals.source === 'operator-priority-signals@v1') {
    inputs.prioritySignals = prioritySignals as PolicyPrioritySignals;
  }
  return inputs;
}

/** Gather Paperclip-derived quest inputs — async because it calls the local org runtime. Fail-soft. */
export async function gatherPaperclipInputs(): Promise<QuestInputs['paperclip']> {
  return paperclipQuestInputs();
}

// The push lane (Thalia wing W1): derive the ledger and POST it inside a freshness
// envelope to the serving Worker (curious.thoughtseed.space). Token read IN-PROCESS
// from the founder env file — never shell-sourced, never echoed (house pattern,
// see scripts/onboard-live.ts). The vault R2 backup bucket is not involved.
const PUSH_URL_DEFAULT = 'https://curious.thoughtseed.space';

function pushTokenFromEnvFile(explicit = ''): string | undefined {
  if (explicit) return explicit;
  if (process.env.QUESTS_PUSH_TOKEN) return process.env.QUESTS_PUSH_TOKEN;
  try {
    const txt = readFileSync(process.env.CAMBIUM_ENV_FILE || join(process.env.HOME ?? '', '.config', 'cambium', '.env'), 'utf8');
    const line = txt.split('\n').find((l) => l.startsWith('QUESTS_PUSH_TOKEN='));
    return line?.slice('QUESTS_PUSH_TOKEN='.length).replace(/^["']|["']$/g, '').trim() || undefined;
  } catch { return undefined; }
}

async function gateJson(
  fetchImpl: typeof fetch,
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: any }> {
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined) };
  const res = await fetchImpl(url, { ...init, headers });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
}

async function currentSideQuestRows(
  ctx: QuineCtx,
  tenant: string,
  options: SideQuestQueueApplyOptions,
  derivedAt: string,
): Promise<VisualEnvelope['sideQuests']['rows']> {
  const inputs = gatherQuestInputs(ctx, tenant);
  if ('paperclip' in options) {
    inputs.paperclip = options.paperclip;
  } else {
    try { inputs.paperclip = await gatherPaperclipInputs(); } catch { /* optional visual source */ }
  }
  const ledger = questLedger(inputs);
  let openItems: PaperclipOpenItem[] = [];
  if ('openItems' in options) {
    openItems = options.openItems ?? [];
  } else {
    try { openItems = await paperclipOpenItems(12); } catch { /* optional visual source */ }
  }
  return buildVisualEnvelope(ctx, tenant, inputs, ledger, {
    source: 'apply-side-quests',
    derivedAt,
    openItems,
  }).sideQuests.rows;
}

function sideQuestQueueResultFor(
  tenant: string,
  action: GateSideQuestAction,
  rows: VisualEnvelope['sideQuests']['rows'],
  opts: { nowIso: string; dryRun: boolean },
): { audit: SideQuestQueueApplyResult; event?: SideQuestEventRecord } {
  const subject = String(action.subject ?? '');
  const common = {
    schema: 'cambium.side-quest-queue-apply.v1' as const,
    actionId: String(action.id ?? ''),
    actionTs: action.ts ?? null,
    appliedAt: opts.nowIso,
    tenant,
    subject,
    founderId: action.founderId ?? null,
    idempotencyKey: action.idempotencyKey ?? null,
    evidence: action.evidence ?? null,
    consequence: action.consequence ?? null,
    reversibility: action.reversibility ?? null,
    dryRun: opts.dryRun,
  };
  const reject = (reason: string): { audit: SideQuestQueueApplyResult; event?: SideQuestEventRecord } => ({
    audit: { ...common, result: 'rejected', reason },
  });

  if (action.kind !== 'queue-side-quest') return reject(`unsupported action kind ${action.kind}`);
  if (!validNpcSlug(subject)) return reject(`invalid side quest id ${subject || '(empty)'}`);
  const row = rows.find((candidate) => candidate.id === subject);
  if (!row) return reject(`side quest ${subject} is not present in the current visual envelope`);
  const allowedAction = ['refresh', 'founder-review', 'collect-evidence'].includes(row.action.kind);
  if (!allowedAction) return reject(`side quest ${subject} has non-queueable action ${row.action.kind}`);
  if (row.runtime?.status === 'completed' || row.status === 'completed') return reject(`side quest ${subject} is already completed in the current ledger`);
  if (row.runtime?.status === 'queued' || row.status === 'queued') {
    return {
      audit: {
        ...common,
        result: 'already-queued',
        reason: `side quest ${subject} already has a queued operator event`,
        eventId: row.runtime?.latest?.id,
      },
    };
  }

  const detail = action.consequence || action.note || `founder gate queued ${subject}: ${row.detail}`;
  const proof = [
    `current envelope row ${row.id}: ${row.proof}`,
    action.evidence ? `signed gate evidence: ${action.evidence}` : 'signed gate evidence missing',
  ].join(' · ');
  const target = row.action.target || subject;
  const overclaim = rejectSideQuestOverclaim(subject, detail, proof, target);
  if (overclaim) return reject(overclaim);
  const eventId = `${tenant}:${subject}:queued:${action.id || Date.parse(opts.nowIso) || Date.now()}`;
  const event: SideQuestEventRecord = {
    schema: SIDE_QUEST_EVENT_SCHEMA,
    id: eventId,
    tenant,
    sideQuestId: subject,
    status: 'queued',
    source: 'founder-gate',
    detail,
    proof,
    createdAt: opts.nowIso,
    target,
    actionId: action.id,
    idempotencyKey: action.idempotencyKey,
  };
  return {
    audit: {
      ...common,
      result: 'queued',
      reason: `current visual envelope still serves side quest ${subject}`,
      eventId,
    },
    event,
  };
}

export async function applySideQuestQueueDecisions(
  ctx: QuineCtx,
  tenant: string,
  options: SideQuestQueueApplyOptions = {},
): Promise<unknown> {
  const base = (options.baseUrl ?? PUSH_URL_DEFAULT).replace(/\/+$/, '');
  const token = pushTokenFromEnvFile(options.token);
  if (!token) {
    return { hypha: 'quests', op: 'apply-side-quests', tenant, checked: 0, queued: 0, rejected: 0, alreadyQueued: 0, consumed: 0, error: 'no QUESTS_PUSH_TOKEN (env, --token, or ~/.claude/.env) — refusing' };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const list = await gateJson(fetchImpl, `${base}/internal/gate/${tenant}`, token);
  if (!list.ok) {
    return { hypha: 'quests', op: 'apply-side-quests', tenant, checked: 0, queued: 0, rejected: 0, alreadyQueued: 0, consumed: 0, status: list.status, error: list.body?.error ?? 'gate list failed' };
  }

  const actions = Array.isArray(list.body?.actions)
    ? (list.body.actions as GateSideQuestAction[]).filter((action) => action.kind === 'queue-side-quest')
    : [];
  const nowIso = options.nowIso ? options.nowIso() : new Date().toISOString();
  const rows = await currentSideQuestRows(ctx, tenant, options, nowIso);
  const results: SideQuestQueueApplyResult[] = [];
  let consumed = 0;

  for (const action of actions) {
    const result = sideQuestQueueResultFor(tenant, action, rows, { nowIso, dryRun: !!options.dryRun });
    results.push(result.audit);
    if (!options.dryRun) {
      if (result.event) writeSideQuestEventRecord(ctx, tenant, result.event);
      const consume = await gateJson(fetchImpl, `${base}/internal/gate/${tenant}/consume`, token, {
        method: 'POST',
        body: JSON.stringify({ id: action.id, result: result.audit }),
      });
      if (consume.ok) consumed += 1;
    }
  }

  return {
    hypha: 'quests',
    op: 'apply-side-quests',
    tenant,
    checked: actions.length,
    queued: results.filter((r) => r.result === 'queued').length,
    rejected: results.filter((r) => r.result === 'rejected').length,
    alreadyQueued: results.filter((r) => r.result === 'already-queued').length,
    consumed,
    dryRun: !!options.dryRun,
    audit: options.dryRun ? null : `.operator/${tenant}.side-quests.jsonl`,
    results,
  };
}

// The push lane body, extracted from `write` so the dispatcher below can compose
// it with the new `evidence` and `activate-tenant` subverbs. Behavior unchanged.
async function pushLedger(args: string[], ctx: QuineCtx, tenant: string): Promise<unknown> {
  const base = flag(args, '--url', PUSH_URL_DEFAULT).replace(/\/+$/, '');
  const token = pushTokenFromEnvFile();
  if (!token) return 'quests push: no QUESTS_PUSH_TOKEN (env or ~/.claude/.env) — refusing.';

  const inputs = gatherQuestInputs(ctx, tenant);
  inputs.paperclip = await gatherPaperclipInputs();
  const L = questLedger(inputs);
  // W3: the narrative mapper turns logs + deviations into PROSE beats; the live
  // Paperclip org appends agents/issues/handoffs (source:"paperclip") fail-soft.
  const devLines: string[] = [];
  for (const p of [join(ctx.root, 'cortex', tenant, 'deviations.jsonl'), join(ctx.root, 'deviations.jsonl')]) {
    try { devLines.push(...readFileSync(p, 'utf8').split('\n')); } catch { /* absent */ }
  }
  const beats = storyBeatsWithSources(narrate(inputs.world?.log ?? [], devLines, 40));
  let openItems: PaperclipOpenItem[] = [];
  try { beats.push(...storyBeatsWithSources(await paperclipActivityBeats(8), 'paperclipActivityBeats')); openItems = await paperclipOpenItems(12); }
  catch { /* Paperclip unreachable — story stays local, gate stays empty */ }
  // Read-only command data for the miniapp Commands panel (status/agents/work/handoffs).
  let commands: Record<string, unknown> | null = null;
  try {
    commands = await paperclipCommandsData(`${L.completed}/${L.total}`);
    commands.handoffs = openItems;
  } catch { /* Paperclip unreachable — commands cards show 'unavailable' */ }
  const derivedAt = new Date().toISOString();
  refreshPrioritySignals(ctx, tenant, { openItems, tenantIds: inputs.tenants, nowIso: derivedAt });
  const refreshedPrioritySignals = readJson(prioritySignalsPath(ctx, tenant));
  if (refreshedPrioritySignals && typeof refreshedPrioritySignals === 'object' && refreshedPrioritySignals.source === 'operator-priority-signals@v1') {
    inputs.prioritySignals = refreshedPrioritySignals as PolicyPrioritySignals;
  }
  const source = flag(args, '--source', 'push');
  const visual = buildVisualEnvelope(ctx, tenant, inputs, L, { source, derivedAt, openItems });
  const envelope = {
    schema: 1,
    derivedAt,
    source,
    tenant,
    beats,
    openItems,
    commands,
    ...visual,
    ledger: {
      completed: L.completed,
      total: L.total,
      current: L.current ? { arc: L.current.arc, id: L.current.id, title: L.current.title, narration: L.current.narration } : null,
      rows: L.rows.map((r) => ({ arc: r.quest.arc, id: r.quest.id, title: r.quest.title, status: r.status, evidence: r.evidence })),
    },
  };
  const res = await fetch(`${base}/internal/ledger/${tenant}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
  });
  const j: any = await res.json().catch(() => ({}));
  if (res.ok) {
    // Founder-inheritance side-effect (root tenants only). Only fires when the
    // upstream push succeeded — we never let founder.json drift ahead of what
    // the worker has accepted.
    const founderPath = join(ctx.root, '.operator', 'founder.json');
    const prevFounder: FounderState =
      readJson(founderPath) ?? { completedArcs: [], derivedFrom: tenant, derivedAt: new Date().toISOString() };
    const nextFounder = reconcileFounder(prevFounder, L, tenant);
    if (nextFounder && nextFounder !== prevFounder) {
      writeFileSync(founderPath, JSON.stringify(nextFounder, null, 2) + '\n');
    }
  }
  return {
    hypha: 'quests', pushed: res.ok, status: res.status, url: `${base}/api/quests/${tenant}`,
    tenant, derivedAt: envelope.derivedAt, completed: `${L.completed}/${L.total}`, bytes: j.bytes ?? null,
    ...(res.ok ? {} : { error: j.error ?? 'push failed' }),
  };
}

export const quests: Hypha = {
  name: 'quests',
  describe: 'the quest log — where this venture stands in the infinite game (derived, never stored)',
  help: 'quine quests [--tenant t]            the quest log panel\n' +
        '       quine write quests push [--tenant t] [--url base]      derive + push the ledger envelope\n' +
        '       quine write quests evidence [--tenant t]               refresh ${tenant}.project.json from real sources\n' +
        '       quine write quests priority-source --founder-target id --founder-weight n --founder-proof "..." --owner name --capacity n --capacity-proof "..." --amount n --currency USD --economic-risk high --economic-proof "..." --available n --required n --availability-proof "..." --revoked false --revocation-proof "..." --urgency-proof "..." [--tenant t]\n' +
        '       quine write quests priority-audit [--tenant t]         inspect priority-source gaps without writing authority\n' +
        '       quine write quests priority-template [--tenant t] [--write-template]  scaffold non-authoritative priority source facts\n' +
        '       quine write quests priority-signals [--tenant t]       refresh explicit policy priority signals\n' +
        '       quine write quests activate-tenant --tenant <id>       bootstrap a new tenant world + project\n' +
        '       quine write quests wake-event <step> <proved|missing> --detail "..." --proof "..." [--tenant t]\n' +
        '       quine write quests npc-event <npc-id> <kind> --detail "..." [--advice "..."] [--tenant t]\n' +
        '       quine write quests side-quest <id> <queued|completed|expired> --detail "..." --proof "..." [--tenant t]\n' +
        '       quine write quests apply-side-quests [--tenant t] [--url base] [--token t] [--dry-run]',

  async status(ctx) {
    const opDir = join(ctx.root, '.operator');
    if (!existsSync(opDir)) return { name: 'quests', reachable: false, detail: 'no .operator state yet' };
    const tenants = gatherQuestInputs(ctx, DEFAULT_TENANT).tenants ?? [];
    return { name: 'quests', reachable: true, detail: `quest fold ready · ${tenants.length} tenant(s)` };
  },

  async read(args, ctx) {
    const tenant = tenantOf(args);
    const inputs = gatherQuestInputs(ctx, tenant);
    inputs.paperclip = await gatherPaperclipInputs();
    const ledger = questLedger(inputs);
    const lines: string[] = [];
    renderQuestLog(ledger, tenant, (s) => lines.push(s));
    return lines.join('\n');
  },

  async write(args, ctx) {
    const sub = args.find((a) => !a.startsWith('--'));
    const tenant = tenantOf(args);

    if (sub === 'push') {
      return await pushLedger(args, ctx, tenant);
    }

    if (sub === 'evidence') {
      const evidence = refreshProjectEvidence(ctx, tenant);
      return { hypha: 'quests', op: 'evidence', tenant, evidence };
    }

    if (sub === 'priority-signals') {
      const inputs = gatherQuestInputs(ctx, tenant);
      let openItems: PaperclipOpenItem[] = [];
      try { openItems = await paperclipOpenItems(12); } catch { /* Paperclip priority context remains optional */ }
      return refreshPrioritySignals(ctx, tenant, { openItems, tenantIds: inputs.tenants });
    }

    if (sub === 'priority-audit') {
      const inputs = gatherQuestInputs(ctx, tenant);
      let openItems: PaperclipOpenItem[] = [];
      try { openItems = await paperclipOpenItems(12); } catch { /* Paperclip priority context remains optional */ }
      return auditPrioritySource(ctx, tenant, { openItems, tenantIds: inputs.tenants });
    }

    if (sub === 'priority-template') {
      const inputs = gatherQuestInputs(ctx, tenant);
      let openItems: PaperclipOpenItem[] = [];
      try { openItems = await paperclipOpenItems(12); } catch { /* Paperclip priority context remains optional */ }
      return prioritySourceTemplate(ctx, tenant, {
        openItems,
        tenantIds: inputs.tenants,
        writeTemplate: args.includes('--write-template'),
      });
    }

    if (sub === 'priority-source') {
      const inputs = gatherQuestInputs(ctx, tenant);
      let openItems: PaperclipOpenItem[] = [];
      try { openItems = await paperclipOpenItems(12); } catch { /* Paperclip priority context remains optional */ }
      return capturePrioritySource(ctx, tenant, prioritySourceCaptureFromArgs(args), { openItems, tenantIds: inputs.tenants });
    }

    if (sub === 'activate-tenant') {
      const opDir = join(ctx.root, '.operator');
      mkdirSync(opDir, { recursive: true });
      const worldPath = join(opDir, `${tenant}.world.json`);
      const worldAlreadyExisted = existsSync(worldPath);
      if (!worldAlreadyExisted) {
        writeFileSync(worldPath, JSON.stringify({
          version: 1,
          artifacts: { tenant },
          log: [`${new Date().toISOString()} → tenant activated via quine write quests activate-tenant`],
        }, null, 2) + '\n');
      }
      const evidence = refreshProjectEvidence(ctx, tenant);
      return { hypha: 'quests', op: 'activate-tenant', tenant, worldCreated: !worldAlreadyExisted, evidence };
    }

    if (sub === 'wake-event') {
      return appendWakeEvent(args, ctx, tenant);
    }

    if (sub === 'npc-event') {
      return appendNpcEvent(args, ctx, tenant);
    }

    if (sub === 'side-quest') {
      return appendSideQuestEvent(args, ctx, tenant);
    }

    if (sub === 'apply-side-quests') {
      return await applySideQuestQueueDecisions(ctx, tenant, {
        baseUrl: flag(args, '--url', PUSH_URL_DEFAULT),
        token: flag(args, '--token', ''),
        dryRun: args.includes('--dry-run'),
      });
    }

    return 'quests: unknown write. Try: push | evidence | activate-tenant | wake-event | npc-event | side-quest | apply-side-quests [--tenant t]';
  },
};
