/**
 * Proactive loop/graph routine — pure compiler for cron + Hermes + Mini App.
 *
 * Cambium owns: run L4 Fitcheck loops, quest templates, topic routing, Mini App
 * projection, and Hermēs *delivery intents*.
 * Hermes owns: actual Telegram send to Thoughtseed topics.
 * Mini App owns: rendering projection (no fake progress).
 *
 * Never: D1 CAS, Telegram HTTP, provider spend, or silent admission.
 *
 * Schema family: cambium.proactive-loop-*.v1
 */

import { createHash } from 'node:crypto';

import {
  FITCHECK_LOOP_PACK_SCHEMA,
  FITCHECK_LOOPS,
  type LoopRunResult,
  fitcheckLoopPackManifest,
  runAllFitcheckLoops,
  type LoopEvidenceContext,
} from './fitcheck-loop-pack.ts';
import {
  QUEST_ARC_TEMPLATES,
  QUEST_GRAPH_TEMPLATES_SCHEMA,
  compileQuestGraphAdmissionProposal,
  questGraphTemplatesManifest,
} from './quest-graph-templates.ts';

export const PROACTIVE_LOOP_PLAN_SCHEMA = 'cambium.proactive-loop-plan.v1' as const;
export const PROACTIVE_LOOP_DELIVERY_SCHEMA = 'cambium.proactive-loop-delivery.v1' as const;
export const PROACTIVE_LOOP_MINIAPP_SCHEMA = 'cambium.proactive-loop-miniapp.v1' as const;

/** Pinned Thoughtseed Labs chat (Hermes topic map). */
export const THOUGHTSEED_CHAT_ID = '-1003942929819';

export const PROACTIVE_TOPIC_ROUTES = {
  hermes: { topicName: 'Hermes', threadId: 2, questId: 'the-gate', priority: 'normal' as const },
  digests: { topicName: 'Digests', threadId: 3, questId: 'the-review', priority: 'normal' as const },
  dev: { topicName: 'Dev', threadId: 4, questId: 'the-build', priority: 'high' as const },
  inbox: { topicName: 'Inbox', threadId: 5, questId: 'the-brief', priority: 'normal' as const },
  agent_ops: { topicName: 'Agent Ops', threadId: 7, questId: 'living-org', priority: 'high' as const },
  alerts: { topicName: 'Alerts', threadId: 8, questId: 'the-ship-gate', priority: 'urgent' as const },
  clients: { topicName: 'Clients', threadId: 9, questId: 'the-handoff', priority: 'high' as const },
} as const;

export type ProactiveTopicKey = keyof typeof PROACTIVE_TOPIC_ROUTES;

export interface ProactiveLoopDelivery {
  schema: typeof PROACTIVE_LOOP_DELIVERY_SCHEMA;
  deliveryId: string;
  topicKey: ProactiveTopicKey;
  chatId: typeof THOUGHTSEED_CHAT_ID;
  threadId: number;
  topicName: string;
  priority: 'normal' | 'high' | 'urgent';
  questId: string;
  workObjectId: string;
  stage: string;
  /** held | failed — only non-pass stages emit deliveries */
  exit: 'held' | 'failed';
  title: string;
  summary: string;
  /** plain text for Hermes to post — no secrets */
  messageText: string;
  requiresFounderGate: boolean;
  /** Hermes may call POST /v1/bridge/topic-assignment with this body */
  topicAssignment: {
    topicKey: ProactiveTopicKey;
    threadId: number;
    chatId: typeof THOUGHTSEED_CHAT_ID;
    summary: string;
    title: string;
    priority: string;
    questId: string;
    projectId: string;
    projectName: string;
    taskType: string;
  };
  networkSend: false;
  writesGoalGraph: false;
}

export interface ProactiveMiniAppProjection {
  schema: typeof PROACTIVE_LOOP_MINIAPP_SCHEMA;
  version: 1;
  tenantId: string;
  workObjectId: string;
  observedAt: string;
  ladder: Array<{
    stage: string;
    exit: 'passed' | 'held' | 'failed';
    summary: string;
    operationalHeld: boolean;
  }>;
  heldCount: number;
  failedCount: number;
  passedCount: number;
  nextFounderAction: string | null;
  questArcs: Array<{
    arc: string;
    questId: string;
    form: string;
    title: string;
    admissionGate: string;
  }>;
  /** UI must not treat this as live D1 admission */
  authorityNote: string;
}

export interface ProactiveLoopPlan {
  schema: typeof PROACTIVE_LOOP_PLAN_SCHEMA;
  version: 1;
  planId: string;
  planDigest: string;
  tenantId: string;
  observedAt: string;
  /** Worker cron may invoke the tick; Hermes still owns Telegram transport. */
  routineCadence: 'worker-cron-or-hermes-pull';
  eventDriven: true;
  scheduleArmed: true;
  autonomousMutation: false;
  writesGoalGraph: false;
  networkSend: false;
  loopPackSchema: typeof FITCHECK_LOOP_PACK_SCHEMA;
  questTemplateSchema: typeof QUEST_GRAPH_TEMPLATES_SCHEMA;
  loopResults: LoopRunResult[];
  miniApp: ProactiveMiniAppProjection;
  deliveries: ProactiveLoopDelivery[];
  /** Deliveries suppressed by cooldown (not queued for Hermes). */
  suppressedNotify: Array<{ deliveryId: string; reason: string }>;
  /** Admission proposal for arcs I–VII — still not a write */
  questAdmissionProposal: ReturnType<typeof compileQuestGraphAdmissionProposal>;
  hermesPullHint: string;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(row[k])}`).join(',')}}`;
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

function shortId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

/** Map Fitcheck loop stage → Thoughtseed TG topic */
function topicForLoop(result: LoopRunResult): ProactiveTopicKey {
  if (result.exit === 'failed') return 'alerts';
  switch (result.stage) {
    case 'identified':
    case 'systems-bound':
    case 'planned':
      return 'dev';
    case 'mapping-verified':
    case 'd1-eligible':
    case 'admitted':
    case 'pinned':
      return 'agent_ops';
    case 'executed':
      return 'hermes';
    case 'learned':
      return 'digests';
    default:
      return 'agent_ops';
  }
}

function deliveryFromLoop(result: LoopRunResult, observedAt: string, workObjectId: string): ProactiveLoopDelivery | null {
  // Only notify on held/failed — pass stages stay silent (no spam)
  if (result.exit === 'passed') return null;
  const exit = result.exit as 'held' | 'failed';
  const topicKey = topicForLoop(result);
  const route = PROACTIVE_TOPIC_ROUTES[topicKey];
  const requiresFounderGate = result.operationalHeld && exit === 'held';
  const title = `Fitcheck ${result.stage}: ${exit}`;
  const probeBits = result.probes
    .filter((p) => p.status !== 'pass')
    .map((p) => `${p.probeId}=${p.status}`)
    .slice(0, 4)
    .join(', ');
  const summary = `${result.summary}${probeBits ? ` · ${probeBits}` : ''}`;
  const messageText = [
    `Fitcheck proactive loop · ${result.stage}`,
    `status: ${exit}`,
    result.summary,
    probeBits ? `open probes: ${probeBits}` : '',
    requiresFounderGate
      ? 'Next: open Telegram Mini App Gate / Workbench — no D1 write until founder CAS.'
      : 'Next: review Dev/Agent Ops evidence; Hermes transport only.',
    `workObject: ${workObjectId}`,
    `at: ${observedAt}`,
  ]
    .filter(Boolean)
    .join('\n');

  // Stable across ticks so Hermes/KV can dedupe the same stage+exit notify.
  const deliveryId = `pld_${shortId(`${result.loopId}:${exit}`)}`;
  return {
    schema: PROACTIVE_LOOP_DELIVERY_SCHEMA,
    deliveryId,
    topicKey,
    chatId: THOUGHTSEED_CHAT_ID,
    threadId: route.threadId,
    topicName: route.topicName,
    priority: exit === 'failed' ? 'urgent' : route.priority,
    questId: route.questId,
    workObjectId,
    stage: result.stage,
    exit,
    title,
    summary,
    messageText,
    requiresFounderGate,
    topicAssignment: {
      topicKey,
      threadId: route.threadId,
      chatId: THOUGHTSEED_CHAT_ID,
      summary,
      title,
      priority: exit === 'failed' ? 'urgent' : route.priority,
      questId: route.questId,
      projectId: 'thoughtseed-ops',
      projectName: 'Thoughtseed Ops',
      taskType: topicKey === 'dev' ? 'engineering' : 'operations',
    },
    networkSend: false,
    writesGoalGraph: false,
  };
}

/** Notify cooldown: same stage+exit+topic is not re-queued within this window. */
export const PROACTIVE_NOTIFY_COOLDOWN_MS = 18 * 60 * 60 * 1000;

export interface ProactiveNotifyState {
  schema: 'cambium.proactive-loop-notify-state.v1';
  tenantId: string;
  updatedAt: string;
  /** key = `${stage}:${exit}:${topicKey}` */
  byKey: Record<string, { lastAt: string; deliveryId: string; title: string }>;
}

export function notifyKeyForDelivery(d: Pick<ProactiveLoopDelivery, 'stage' | 'topicKey' | 'exit'>): string {
  return `${d.stage}:${d.exit}:${d.topicKey}`;
}

/** Drop deliveries already notified inside cooldown (or suppressed by caller). */
export function filterDeliveriesForNotify(
  deliveries: ProactiveLoopDelivery[],
  state: ProactiveNotifyState | null | undefined,
  nowIso: string,
  cooldownMs: number = PROACTIVE_NOTIFY_COOLDOWN_MS,
): { open: ProactiveLoopDelivery[]; suppressed: Array<{ deliveryId: string; reason: string }> } {
  const now = Date.parse(nowIso);
  const open: ProactiveLoopDelivery[] = [];
  const suppressed: Array<{ deliveryId: string; reason: string }> = [];
  for (const d of deliveries) {
    const nk = notifyKeyForDelivery(d);
    const prev = state?.byKey?.[nk];
    if (prev) {
      const last = Date.parse(prev.lastAt);
      if (Number.isFinite(last) && Number.isFinite(now) && now - last < cooldownMs) {
        suppressed.push({
          deliveryId: d.deliveryId,
          reason: `cooldown ${Math.round((cooldownMs - (now - last)) / 3600000)}h remaining for ${nk}`,
        });
        continue;
      }
    }
    open.push(d);
  }
  return { open, suppressed };
}

export function mergeNotifyState(
  prior: ProactiveNotifyState | null | undefined,
  claimed: ProactiveLoopDelivery[],
  tenantId: string,
  nowIso: string,
): ProactiveNotifyState {
  const byKey = { ...(prior?.byKey ?? {}) };
  for (const d of claimed) {
    const nk = notifyKeyForDelivery(d);
    byKey[nk] = { lastAt: nowIso, deliveryId: d.deliveryId, title: d.title };
  }
  return {
    schema: 'cambium.proactive-loop-notify-state.v1',
    tenantId,
    updatedAt: nowIso,
    byKey,
  };
}

export function compileProactiveLoopPlan(input: {
  tenantId?: string;
  workObjectId?: string;
  observedAt?: string;
  evidence?: Partial<LoopEvidenceContext>;
  actor?: string;
  /** Prior notify state for cooldown filtering (optional). */
  notifyState?: ProactiveNotifyState | null;
  /** When true, skip cooldown filter (admin force). */
  forceNotify?: boolean;
}): ProactiveLoopPlan {
  const tenantId = input.tenantId ?? 'cambium';
  const workObjectId = input.workObjectId ?? 'sapling:fitcheck';
  const observedAt = input.observedAt ?? new Date().toISOString();
  const loopResults = runAllFitcheckLoops(input.evidence ?? {});
  const deliveries = loopResults
    .map((r) => deliveryFromLoop(r, observedAt, workObjectId))
    .filter((d): d is ProactiveLoopDelivery => d !== null);

  // Cap deliveries: one per topic (highest priority), avoid flood
  const byTopic = new Map<ProactiveTopicKey, ProactiveLoopDelivery>();
  const rank = { urgent: 3, high: 2, normal: 1 } as const;
  for (const d of deliveries) {
    const prev = byTopic.get(d.topicKey);
    if (!prev || rank[d.priority] > rank[prev.priority]) byTopic.set(d.topicKey, d);
  }
  let capped = [...byTopic.values()].sort((a, b) => rank[b.priority] - rank[a.priority]);
  let suppressed: Array<{ deliveryId: string; reason: string }> = [];
  if (!input.forceNotify && input.notifyState) {
    const filtered = filterDeliveriesForNotify(capped, input.notifyState, observedAt);
    capped = filtered.open;
    suppressed = filtered.suppressed;
  }

  const miniApp: ProactiveMiniAppProjection = {
    schema: PROACTIVE_LOOP_MINIAPP_SCHEMA,
    version: 1,
    tenantId,
    workObjectId,
    observedAt,
    ladder: loopResults.map((r) => ({
      stage: r.stage,
      exit: r.exit,
      summary: r.summary,
      operationalHeld: r.operationalHeld,
    })),
    heldCount: loopResults.filter((r) => r.exit === 'held').length,
    failedCount: loopResults.filter((r) => r.exit === 'failed').length,
    passedCount: loopResults.filter((r) => r.exit === 'passed').length,
    nextFounderAction:
      capped.find((d) => d.requiresFounderGate)?.summary
      ?? capped[0]?.summary
      ?? null,
    questArcs: QUEST_ARC_TEMPLATES.map((a) => ({
      arc: a.arc,
      questId: a.questId,
      form: a.form,
      title: a.title,
      admissionGate: a.admissionGate,
    })),
    authorityNote:
      'Projection only. Not D1 admission. Gate + CAS still required for Goal Graph writes. Hermes owns Telegram transport.',
  };

  const questAdmissionProposal = compileQuestGraphAdmissionProposal({
    tenant: tenantId,
    actor: input.actor ?? 'proactive-loop-routine',
    sourceRef: `proactive-loop:${observedAt}`,
  });

  const body = {
    schema: PROACTIVE_LOOP_PLAN_SCHEMA,
    version: 1 as const,
    tenantId,
    observedAt,
    routineCadence: 'worker-cron-or-hermes-pull' as const,
    eventDriven: true as const,
    scheduleArmed: true as const,
    autonomousMutation: false as const,
    writesGoalGraph: false as const,
    networkSend: false as const,
    loopPackSchema: FITCHECK_LOOP_PACK_SCHEMA,
    questTemplateSchema: QUEST_GRAPH_TEMPLATES_SCHEMA,
    loopResults,
    miniApp,
    deliveries: capped,
    suppressedNotify: suppressed,
    questAdmissionProposal,
    hermesPullHint:
      'Hermes: POST each deliveries[].topicAssignment to /v1/bridge/topic-assignment then post messageText to topic thread. Do not claim graph admission.',
    packs: {
      fitcheck: fitcheckLoopPackManifest(),
      quests: questGraphTemplatesManifest(),
    },
  };

  const planId = `plp_${shortId(canonicalJson(body))}`;
  const planDigest = digest({ ...body, planId });
  return { ...body, planId, planDigest };
}
