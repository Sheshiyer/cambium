/**
 * Worker-side store for proactive loop plans.
 * Pure compile lives in shared/proactive-loop-routine.ts.
 */
import type { LoopEvidenceContext } from '../../../shared/fitcheck-loop-pack.ts';
import {
  compileProactiveLoopPlan,
  mergeNotifyState,
  type ProactiveLoopDelivery,
  type ProactiveLoopPlan,
  type ProactiveNotifyState,
} from '../../../shared/proactive-loop-routine.ts';

export { compileProactiveLoopPlan };

export interface ProactiveKvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  list?(opts: { prefix: string }): Promise<{ keys: Array<{ name: string }> }>;
}

export interface GoalGraphNodeLike {
  nodeId?: string;
  workObjectId?: string | null;
  pinnedLoadoutId?: string | null;
  desiredState?: string;
  currentState?: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
}

export interface GoalGraphStoreLite {
  readNodes(tenantId: string): Promise<GoalGraphNodeLike[]>;
  readHead?(tenantId: string): Promise<unknown>;
}

export function proactivePlanKey(tenantId: string): string {
  return `proactive-loop:plan:${tenantId}`;
}

export function proactiveDeliveriesKey(tenantId: string): string {
  return `proactive-loop:deliveries:${tenantId}`;
}

export function proactiveNotifyStateKey(tenantId: string): string {
  return `proactive-loop:notify-state:${tenantId}`;
}

export function proactiveFounderApprovalKey(tenantId: string): string {
  return `proactive-loop:founder-approval:${tenantId}`;
}

export interface FounderApprovalRecord {
  schema: 'cambium.proactive-loop-founder-approval.v1';
  tenantId: string;
  status: 'approved';
  founderId: string;
  approvedAt: string;
  subject: string;
  note: string;
  /** Operational only — never implies D1 CAS completed. */
  writesGoalGraph: false;
  hermesReceipt?: boolean;
}

export async function readFounderApproval(
  kv: ProactiveKvLike,
  tenantId: string,
): Promise<FounderApprovalRecord | null> {
  const raw = await kv.get(proactiveFounderApprovalKey(tenantId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FounderApprovalRecord;
    if (parsed?.schema !== 'cambium.proactive-loop-founder-approval.v1') return null;
    if (parsed.status !== 'approved') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeFounderApproval(
  kv: ProactiveKvLike,
  input: {
    tenantId?: string;
    founderId: string;
    approvedAt: string;
    note?: string;
    hermesReceipt?: boolean;
  },
): Promise<FounderApprovalRecord> {
  const tenantId = input.tenantId ?? 'cambium';
  const record: FounderApprovalRecord = {
    schema: 'cambium.proactive-loop-founder-approval.v1',
    tenantId,
    status: 'approved',
    founderId: input.founderId,
    approvedAt: input.approvedAt,
    subject: 'sapling:fitcheck',
    note: input.note
      ?? 'Founder operational clearance for Fitcheck L4 held stages. D1 CAS remains separate.',
    writesGoalGraph: false,
    hermesReceipt: input.hermesReceipt === true,
  };
  await kv.put(proactiveFounderApprovalKey(tenantId), JSON.stringify(record));
  // Also materialize a Gate-shaped receipt so Workbench can show founder authority
  await kv.put(
    `gate:${tenantId}:proactive-fitcheck-admission`,
    JSON.stringify({
      id: 'proactive-fitcheck-admission',
      ts: input.approvedAt,
      founderId: input.founderId,
      kind: 'approve',
      subject: 'sapling:fitcheck:proactive-l4-clearance',
      status: 'queued',
      evidence: record.note,
      consequence: 'Clear operational held probes for Fitcheck L4 notify path; do not write Goal Graph CAS.',
      reversibility: 'Revoke by deleting proactive-loop:founder-approval KV key.',
      idempotencyKey: 'approve:sapling:fitcheck:proactive-l4-clearance',
      writesGoalGraph: false,
    }),
  );
  return record;
}

export async function readNotifyState(
  kv: ProactiveKvLike,
  tenantId: string,
): Promise<ProactiveNotifyState | null> {
  const raw = await kv.get(proactiveNotifyStateKey(tenantId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProactiveNotifyState;
    if (parsed?.schema !== 'cambium.proactive-loop-notify-state.v1') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Gather live evidence: founder approval + D1 node scan (schema-tolerant). */
export async function gatherFitcheckLoopEvidence(
  kv: ProactiveKvLike,
  opts: {
    tenantId?: string;
    goalGraphStore?: GoalGraphStoreLite;
  } = {},
): Promise<Partial<LoopEvidenceContext>> {
  const tenantId = opts.tenantId ?? 'cambium';
  const evidence: Partial<LoopEvidenceContext> = {};

  const approval = await readFounderApproval(kv, tenantId);
  if (approval) {
    evidence.founderAuthorizedAdmission = true;
    evidence.foldbackProposal = true;
    evidence.missionFabricHonest = true;
    if (approval.hermesReceipt) evidence.hermesReceipt = true;
  }

  // Hermes canary receipts (if any) under foldback keys
  if (kv.list) {
    try {
      const listed = await kv.list({ prefix: 'portfolio/thoughtseed/workobjects/sapling:fitcheck/' });
      if (listed.keys.some((k) => /foldback|receipt|hermes/i.test(k.name))) {
        evidence.hermesReceipt = true;
        evidence.foldbackProposal = true;
      }
    } catch {
      // fail-soft
    }
  }

  if (opts.goalGraphStore) {
    try {
      const nodes = await opts.goalGraphStore.readNodes(tenantId);
      const fit = nodes.filter((n) => {
        const id = String(n.workObjectId ?? n.nodeId ?? '');
        const desired = String(n.desiredState ?? '');
        const meta = n.metadata ? JSON.stringify(n.metadata) : '';
        return /fitcheck/i.test(id) || /fitcheck/i.test(desired) || /fitcheck/i.test(meta);
      });
      if (fit.length > 0) {
        evidence.d1TaskReadback = true;
        if (fit.some((n) => n.pinnedLoadoutId)) evidence.loadoutPinned = true;
      }
    } catch {
      // D1 schema drift must not break cron
    }
  }

  return evidence;
}

export async function runAndStoreProactiveLoopTick(
  kv: ProactiveKvLike,
  opts: {
    tenantId?: string;
    actor?: string;
    nowIso?: string;
    evidence?: Partial<LoopEvidenceContext>;
    goalGraphStore?: GoalGraphStoreLite;
    forceNotify?: boolean;
    /** After Hermes claims, mark notify state — optional at tick time for open set only. */
  } = {},
): Promise<ProactiveLoopPlan & { evidence: Partial<LoopEvidenceContext> }> {
  const tenantId = opts.tenantId ?? 'cambium';
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const gathered = await gatherFitcheckLoopEvidence(kv, {
    tenantId,
    goalGraphStore: opts.goalGraphStore,
  });
  const evidence = { ...gathered, ...(opts.evidence ?? {}) };
  const notifyState = await readNotifyState(kv, tenantId);

  const plan = compileProactiveLoopPlan({
    tenantId,
    actor: opts.actor ?? 'worker-cron',
    observedAt: nowIso,
    evidence,
    notifyState,
    forceNotify: opts.forceNotify === true,
  });
  await kv.put(proactivePlanKey(tenantId), JSON.stringify(plan));
  await kv.put(
    proactiveDeliveriesKey(tenantId),
    JSON.stringify({
      schema: 'cambium.proactive-loop-pending-deliveries.v1',
      tenantId,
      planId: plan.planId,
      planDigest: plan.planDigest,
      updatedAt: plan.observedAt,
      deliveries: plan.deliveries,
      suppressedNotify: plan.suppressedNotify,
      networkSend: false,
      writesGoalGraph: false,
    }),
  );
  return { ...plan, evidence };
}

export async function readProactiveLoopPlan(
  kv: ProactiveKvLike,
  tenantId = 'cambium',
): Promise<ProactiveLoopPlan | null> {
  const raw = await kv.get(proactivePlanKey(tenantId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.schema !== 'cambium.proactive-loop-plan.v1') return null;
    return parsed as ProactiveLoopPlan;
  } catch {
    return null;
  }
}

export async function readPendingProactiveDeliveries(
  kv: ProactiveKvLike,
  tenantId = 'cambium',
): Promise<Record<string, unknown> | null> {
  const raw = await kv.get(proactiveDeliveriesKey(tenantId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Mark deliveries claimed by Hermes (does not send TG). Updates notify cooldown state. */
export async function claimProactiveDeliveries(
  kv: ProactiveKvLike,
  tenantId: string,
  deliveryIds: string[],
  nowIso: string,
): Promise<{ claimed: string[]; remaining: number }> {
  const pending = await readPendingProactiveDeliveries(kv, tenantId);
  if (!pending || !Array.isArray(pending.deliveries)) {
    return { claimed: [], remaining: 0 };
  }
  const want = new Set(deliveryIds);
  const claimed: string[] = [];
  const claimedRows: ProactiveLoopDelivery[] = [];
  const remaining = [];
  for (const d of pending.deliveries as ProactiveLoopDelivery[]) {
    if (d.deliveryId && want.has(d.deliveryId)) {
      claimed.push(d.deliveryId);
      claimedRows.push(d);
    } else {
      remaining.push(d);
    }
  }
  await kv.put(
    proactiveDeliveriesKey(tenantId),
    JSON.stringify({
      ...pending,
      updatedAt: nowIso,
      claimedAt: nowIso,
      claimedIds: claimed,
      deliveries: remaining,
    }),
  );
  if (claimedRows.length) {
    const prior = await readNotifyState(kv, tenantId);
    const next = mergeNotifyState(prior, claimedRows, tenantId, nowIso);
    await kv.put(proactiveNotifyStateKey(tenantId), JSON.stringify(next));
  }
  return { claimed, remaining: remaining.length };
}
