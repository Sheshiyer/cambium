export interface WorkflowLearningKvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export type WorkflowLearningKind =
  | 'failed'
  | 'retry_exhausted'
  | 'missed_cron'
  | 'timed_out'
  | 'ambiguous_intent'
  | 'manual_override'
  | 'send_verification_failed';

export interface WorkflowLearningEventV1 {
  schema: 'thoughtseed.workflow-learning-event.v1';
  id: string;
  tenantId: string;
  workflowId: string;
  at: string;
  kind: WorkflowLearningKind;
  rootCause: string;
  summary: string;
  retryable: boolean;
  source: 'hermes' | 'cambium' | 'cron' | 'operator';
  actionRequestId?: string;
}

export interface WorkflowLearningResult {
  status: number;
  body: Record<string, unknown>;
}

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const SECRET_RE = /(?:authorization\s*[:=]|bearer\s+|api[-_ ]?key\s*[:=]|token\s*[:=]|password\s*[:=])/i;
const KINDS = new Set<WorkflowLearningKind>([
  'failed', 'retry_exhausted', 'missed_cron', 'timed_out',
  'ambiguous_intent', 'manual_override', 'send_verification_failed',
]);
const SOURCES = new Set(['hermes', 'cambium', 'cron', 'operator']);

export async function recordWorkflowLearningEvent(
  kv: WorkflowLearningKvLike,
  raw: unknown,
): Promise<WorkflowLearningResult> {
  const parsed = parseEvent(raw);
  if ('error' in parsed) return route(400, { error: parsed.error });
  const event = parsed.event;
  const key = eventKey(event.tenantId, event.at.slice(0, 7), event.id);
  const canonical = JSON.stringify(event);
  const existing = await kv.get(key);
  if (existing !== null) {
    if (existing !== canonical) return route(409, { error: 'workflow learning event idempotency conflict' });
    return route(200, { ok: true, duplicate: true, event });
  }
  await kv.put(key, canonical);
  return route(200, { ok: true, duplicate: false, event });
}

export async function summarizeWorkflowLearningMonth(
  kv: WorkflowLearningKvLike,
  input: { tenantId?: string; month?: string },
): Promise<WorkflowLearningResult> {
  const tenantId = clean(input.tenantId) || 'cambium';
  const month = clean(input.month);
  if (!SAFE_ID.test(tenantId) || !MONTH.test(month)) return route(400, { error: 'valid tenantId and YYYY-MM month required' });
  const keys = await kv.list(eventPrefix(tenantId, month));
  const events = (await Promise.all(keys.map(async (key) => parseStored(await kv.get(key)))))
    .filter((event): event is WorkflowLearningEventV1 => event !== null)
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.rootCause, (counts.get(event.rootCause) ?? 0) + 1);
  const rootCauses = [...counts.entries()]
    .map(([rootCause, count]) => ({ rootCause, count }))
    .sort((a, b) => b.count - a.count || a.rootCause.localeCompare(b.rootCause));
  return route(200, {
    schema: 'thoughtseed.workflow-learning-summary.v1',
    tenantId,
    month,
    eventCount: events.length,
    rootCauses,
    replayCases: rootCauses.map(({ rootCause, count }) => ({
      id: `ralph:${month}:${rootCause}`,
      rootCause,
      evidenceCount: count,
      proposedOnly: true,
      acceptance: 'reproduce failure, verify bounded recovery, preserve approval and authority boundaries',
    })),
    automaticChanges: false,
    next: events.length
      ? 'Review proposed replay cases in Agent Ops; founder approval is required before workflow changes.'
      : 'No failure evidence recorded for this month.',
  });
}

function parseEvent(raw: unknown): { event: WorkflowLearningEventV1 } | { error: string } {
  if (!isRecord(raw) || raw.schema !== 'thoughtseed.workflow-learning-event.v1') return { error: 'unsupported workflow learning event' };
  const id = clean(raw.id), tenantId = clean(raw.tenantId), workflowId = clean(raw.workflowId);
  const at = clean(raw.at), rootCause = clean(raw.rootCause), summary = clean(raw.summary);
  if (![id, tenantId, workflowId, rootCause].every((value) => SAFE_ID.test(value))) return { error: 'event identifiers must be bounded' };
  if (!Number.isFinite(Date.parse(at)) || at.slice(0, 7).match(MONTH) === null) return { error: 'event at must be an ISO timestamp' };
  if (!KINDS.has(raw.kind as WorkflowLearningKind) || !SOURCES.has(raw.source as string)) return { error: 'unsupported event kind or source' };
  if (!summary || summary.length > 480 || SECRET_RE.test(summary)) return { error: 'event summary is unsafe' };
  const actionRequestId = clean(raw.actionRequestId);
  if (actionRequestId && !SAFE_ID.test(actionRequestId)) return { error: 'bad actionRequestId' };
  return { event: {
    schema: 'thoughtseed.workflow-learning-event.v1', id, tenantId, workflowId, at,
    kind: raw.kind as WorkflowLearningKind, rootCause, summary,
    retryable: raw.retryable === true, source: raw.source as WorkflowLearningEventV1['source'],
    ...(actionRequestId ? { actionRequestId } : {}),
  } };
}

function parseStored(raw: string | null): WorkflowLearningEventV1 | null {
  try {
    const value = JSON.parse(raw ?? 'null');
    return isRecord(value) && value.schema === 'thoughtseed.workflow-learning-event.v1' ? value as unknown as WorkflowLearningEventV1 : null;
  } catch { return null; }
}

function eventKey(tenantId: string, month: string, id: string): string { return `${eventPrefix(tenantId, month)}${id}`; }
function eventPrefix(tenantId: string, month: string): string { return `workflow-learning:${tenantId}:${month}:`; }
function route(status: number, body: Record<string, unknown>): WorkflowLearningResult { return { status, body }; }
function clean(value: unknown): string { return String(value ?? '').trim(); }
function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }

