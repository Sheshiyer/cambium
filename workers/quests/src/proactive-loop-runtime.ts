/**
 * Worker-side store for proactive loop plans.
 * Pure compile lives in shared/proactive-loop-routine.ts.
 */
import {
  compileProactiveLoopPlan,
  type ProactiveLoopPlan,
} from '../../../shared/proactive-loop-routine.ts';

export { compileProactiveLoopPlan };

export interface ProactiveKvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export function proactivePlanKey(tenantId: string): string {
  return `proactive-loop:plan:${tenantId}`;
}

export function proactiveDeliveriesKey(tenantId: string): string {
  return `proactive-loop:deliveries:${tenantId}`;
}

export async function runAndStoreProactiveLoopTick(
  kv: ProactiveKvLike,
  opts: {
    tenantId?: string;
    actor?: string;
    nowIso?: string;
  } = {},
): Promise<ProactiveLoopPlan> {
  const tenantId = opts.tenantId ?? 'cambium';
  const plan = compileProactiveLoopPlan({
    tenantId,
    actor: opts.actor ?? 'worker-cron',
    observedAt: opts.nowIso ?? new Date().toISOString(),
  });
  await kv.put(proactivePlanKey(tenantId), JSON.stringify(plan));
  // Pending deliveries queue for Hermes pull (idempotent overwrite of open set)
  await kv.put(
    proactiveDeliveriesKey(tenantId),
    JSON.stringify({
      schema: 'cambium.proactive-loop-pending-deliveries.v1',
      tenantId,
      planId: plan.planId,
      planDigest: plan.planDigest,
      updatedAt: plan.observedAt,
      deliveries: plan.deliveries,
      networkSend: false,
      writesGoalGraph: false,
    }),
  );
  return plan;
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

/** Mark deliveries claimed by Hermes (does not send TG). */
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
  const remaining = [];
  for (const d of pending.deliveries as Array<{ deliveryId?: string }>) {
    if (d.deliveryId && want.has(d.deliveryId)) claimed.push(d.deliveryId);
    else remaining.push(d);
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
  return { claimed, remaining: remaining.length };
}
