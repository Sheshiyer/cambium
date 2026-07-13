export interface ActionRequestKvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export type ActionRequestStatus =
  | 'binding_required'
  | 'proposed'
  | 'awaiting_input'
  | 'needs_signed_confirmation'
  | 'queued'
  | 'blocked'
  | 'consumed'
  | 'completed'
  | 'superseded';

export interface ActionRequestOptionV1 {
  id: string;
  label: string;
  consequence: string;
  risk: 'low' | 'high';
  requiresSignedConfirmation: boolean;
  resultKind: 'hold' | 'reroll' | 'queue_task' | 'request_input' | 'escalate_signed_gate' | 'record_only';
}

export interface ActionRequestV1 {
  schema: 'thoughtseed.action-request.v1';
  id: string;
  idempotencyKey: string;
  tenantId: string;
  status: ActionRequestStatus;
  source: 'hermes-topic-signal' | 'hermes-routine-signal';
  createdAt: string;
  updatedAt: string;
  branchId?: string;
  branchLabel?: string;
  projectId: string;
  projectName: string;
  questId?: string;
  topic: {
    chatId: string;
    topicKey: string;
    threadId: number;
    sourceMessageId?: string;
  };
  title: string;
  summary: string;
  why: string;
  options: ActionRequestOptionV1[];
  selectedOptionId?: string;
  receipts: Array<{
    at: string;
    kind: 'posted' | 'edited' | 'callback' | 'reply' | 'gate' | 'consume' | 'complete';
    text: string;
    telegramMessageId?: number;
  }>;
  redaction: 'safe' | 'redacted' | 'withheld';
}

export interface ActionRequestResolveInput {
  tenantId?: string;
  optionId?: string;
  founderTelegramUserId?: string;
  actor?: {
    telegramUserId?: string;
    chatId?: string;
    threadId?: number;
  };
}

export interface ActionRequestSignedConfirmInput {
  tenantId?: string;
  optionId?: string;
  founderTelegramUserId?: string;
  evidence?: string;
  idempotencyKey?: string;
}

export interface ActionRequestRouteResult {
  status: number;
  body: Record<string, unknown>;
}

export interface ActionRequestListInput {
  tenantId?: string;
  branchId?: string;
  status?: string;
  limit?: number;
}

export interface ActionRequestListItemV1 {
  schema: 'thoughtseed.action-request-list-item.v1';
  id: string;
  tenantId: string;
  status: ActionRequestStatus;
  branchId?: string;
  branchLabel?: string;
  projectId: string;
  projectName: string;
  questId?: string;
  topic: {
    topicKey: string;
    threadId: number;
    sourceMessageId?: string;
  };
  title: string;
  summary: string;
  why: string;
  source: ActionRequestV1['source'];
  redaction: ActionRequestV1['redaction'];
  createdAt: string;
  updatedAt: string;
  selectedOptionId?: string;
  next: string;
  evidence: string;
  consequence: string;
  approveConsequence: string;
  rerollConsequence: string;
  reversibility: string;
  idempotencyHint: string;
  owner: string;
  priority: {
    source: string;
    risk: 'low' | 'high';
    dependency: string;
    score: number;
    reasons: string[];
  };
  options: Array<{
    id: string;
    label: string;
    consequence: string;
    risk: 'low' | 'high';
    requiresSignedConfirmation: boolean;
    resultKind: ActionRequestOptionV1['resultKind'];
  }>;
  receipts: {
    count: number;
    latest?: {
      at: string;
      kind: ActionRequestV1['receipts'][number]['kind'];
      text: string;
    };
  };
}

const VALID_TENANT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function createActionRequestRecord(
  kv: ActionRequestKvLike,
  raw: unknown,
  nowIso: () => string,
): Promise<ActionRequestRouteResult> {
  if (!isRecord(raw)) return route(400, { error: 'ActionRequest body must be an object' });
  const validation = validateIverifActionRequest(raw);
  if ('error' in validation) return route(400, { error: validation.error });

  const actionRequest = {
    ...validation.actionRequest,
    updatedAt: validation.actionRequest.updatedAt || nowIso(),
  };
  const payloadHash = await sha256hex(canonicalJson(actionRequest));
  const idempotencyKey = arIdempotencyKey(actionRequest.tenantId, actionRequest.idempotencyKey);
  const existingIdempotency = await kv.get(idempotencyKey);
  if (existingIdempotency) {
    const existing = parseJson(existingIdempotency);
    if (!isRecord(existing)) return route(409, { error: 'idempotency record corrupt' });
    if (existing.payloadHash !== payloadHash) return route(409, { error: 'idempotency conflict', idempotencyKey: actionRequest.idempotencyKey });
    const stored = await readActionRequest(kv, actionRequest.tenantId, String(existing.id));
    if (!stored) return route(409, { error: 'idempotency record missing action request' });
    return route(200, { ok: true, duplicate: true, actionRequest: stored });
  }

  await kv.put(arRecordKey(actionRequest.tenantId, actionRequest.id), JSON.stringify(actionRequest));
  await kv.put(idempotencyKey, JSON.stringify({ id: actionRequest.id, payloadHash }));
  return route(200, { ok: true, duplicate: false, actionRequest });
}

export async function listActionRequestRecords(
  kv: ActionRequestKvLike,
  raw: ActionRequestListInput = {},
): Promise<ActionRequestRouteResult> {
  const tenantId = clean(raw.tenantId) || 'cambium';
  if (!VALID_TENANT.test(tenantId)) return route(400, { error: 'bad tenantId' });
  const branchId = clean(raw.branchId);
  const status = statusText(raw.status) || null;
  const limit = Math.max(1, Math.min(100, Number(raw.limit) || 50));
  const keys = await kv.list(arRecordPrefix(tenantId));
  const rows = (await Promise.all(keys.map(async (key) => parseJson(await kv.get(key)))))
    .filter(isActionRequest)
    .filter((row) => !branchId || row.branchId === branchId)
    .filter((row) => !status || row.status === status)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
    .slice(0, limit)
    .map(toListItem);

  return route(200, {
    schema: 'thoughtseed.action-request-list.v1',
    ok: true,
    tenantId,
    branchId: branchId || undefined,
    count: rows.length,
    rows,
    actionRequests: rows,
  });
}

export async function resolveActionRequestRecord(
  kv: ActionRequestKvLike,
  id: string,
  raw: unknown,
  nowIso: () => string,
): Promise<ActionRequestRouteResult> {
  if (!isRecord(raw)) return route(400, { error: 'ActionRequest resolve body must be an object' });
  const tenantId = clean(raw.tenantId) || 'cambium';
  if (!VALID_TENANT.test(tenantId)) return route(400, { error: 'bad tenantId' });
  const actionRequest = await readActionRequest(kv, tenantId, id);
  if (!actionRequest) return route(404, { error: 'ActionRequest not found' });

  const actorCheck = validateActor(actionRequest, raw);
  if (actorCheck) return route(403, { error: actorCheck });

  const optionId = clean(raw.optionId);
  const option = actionRequest.options.find((candidate) => candidate.id === optionId);
  if (!option) return route(400, { error: 'unknown ActionRequest option' });

  if (actionRequest.selectedOptionId === option.id && actionRequest.status !== 'proposed') {
    return route(200, {
      ok: true,
      duplicate: true,
      actionRequest,
      receipt: { editCard: false, toast: 'Already handled' },
    });
  }

  const nextStatus = statusForOption(option);
  const receipt = receiptForStatus(nextStatus, option.label);
  const updated: ActionRequestV1 = {
    ...actionRequest,
    status: nextStatus,
    selectedOptionId: option.id,
    updatedAt: nowIso(),
    receipts: [
      ...actionRequest.receipts,
      { at: nowIso(), kind: 'callback', text: receipt.reply ?? receipt.toast },
    ],
  };
  await kv.put(arRecordKey(updated.tenantId, updated.id), JSON.stringify(updated));

  return route(200, {
    ok: true,
    duplicate: false,
    actionRequest: updated,
    receipt,
    ...(nextStatus === 'needs_signed_confirmation' ? {
      miniAppGate: {
        required: true,
        route: '/api/gate/cambium',
        actionRequestId: updated.id,
        optionId: option.id,
      },
    } : {}),
  });
}

export async function confirmSignedActionRequestRecord(
  kv: ActionRequestKvLike,
  id: string,
  raw: unknown,
  nowIso: () => string,
): Promise<ActionRequestRouteResult> {
  if (!isRecord(raw)) return route(400, { error: 'ActionRequest signed confirmation body must be an object' });
  const tenantId = clean(raw.tenantId) || 'cambium';
  if (!VALID_TENANT.test(tenantId)) return route(400, { error: 'bad tenantId' });
  const actionRequest = await readActionRequest(kv, tenantId, id);
  if (!actionRequest) return route(404, { error: 'ActionRequest not found' });

  const founderTelegramUserId = clean(raw.founderTelegramUserId);
  if (!founderTelegramUserId) return route(403, { error: 'founder signed confirmation missing' });

  const optionId = clean(raw.optionId) || clean(actionRequest.selectedOptionId);
  if (!optionId) return route(400, { error: 'ActionRequest option is required for signed confirmation' });
  if (actionRequest.selectedOptionId && actionRequest.selectedOptionId !== optionId) {
    return route(409, { error: 'signed confirmation option mismatch', selectedOptionId: actionRequest.selectedOptionId });
  }
  const option = actionRequest.options.find((candidate) => candidate.id === optionId);
  if (!option) return route(400, { error: 'unknown ActionRequest option' });
  if (statusForOption(option) !== 'needs_signed_confirmation') {
    return route(400, { error: 'ActionRequest option does not require signed confirmation' });
  }

  const idempotencyKey = clean(raw.idempotencyKey) || `confirm-action-request:${tenantId}:${actionRequest.id}:${option.id}`;
  const consequence = option.consequence || 'queue signed ActionRequest for operator consumption';
  const reversibility = 'queued ActionRequest can be superseded until consumed by Cambium';

  if (actionRequest.status === 'queued' && actionRequest.selectedOptionId === option.id) {
    return route(200, {
      ok: true,
      duplicate: true,
      queued: actionRequest.id,
      kind: 'confirm-action-request',
      subject: actionRequest.id,
      idempotencyKey,
      consequence,
      reversibility,
      actionRequest,
      receipt: { editCard: false, toast: 'Already queued' },
    });
  }

  if (actionRequest.status !== 'needs_signed_confirmation') {
    return route(409, { error: `ActionRequest status ${actionRequest.status} cannot be signed-confirmed` });
  }

  const at = nowIso();
  const receiptText = `Signed confirmation queued: ${option.label}.`;
  const updated: ActionRequestV1 = {
    ...actionRequest,
    status: 'queued',
    selectedOptionId: option.id,
    updatedAt: at,
    receipts: [
      ...actionRequest.receipts,
      { at, kind: 'gate', text: receiptText },
    ],
  };
  await kv.put(arRecordKey(updated.tenantId, updated.id), JSON.stringify(updated));

  return route(200, {
    ok: true,
    duplicate: false,
    queued: updated.id,
    kind: 'confirm-action-request',
    subject: updated.id,
    idempotencyKey,
    consequence,
    reversibility,
    actionRequest: updated,
    receipt: { editCard: true, reply: receiptText, toast: 'Signed confirmation queued' },
  });
}

export async function consumeActionRequestRecord(
  kv: ActionRequestKvLike,
  tenantId: string,
  id: string,
  nowIso: () => string,
): Promise<ActionRequestRouteResult> {
  if (!VALID_TENANT.test(tenantId)) return route(400, { error: 'bad tenantId' });
  const actionRequest = await readActionRequest(kv, tenantId, id);
  if (!actionRequest) return route(404, { error: 'ActionRequest not found' });

  if (actionRequest.status === 'consumed') {
    return route(200, {
      ok: true,
      consumed: actionRequest.id,
      kind: 'action-request',
      duplicate: true,
      actionRequest,
    });
  }
  if (actionRequest.status !== 'queued') {
    return route(409, { error: `ActionRequest status ${actionRequest.status} cannot be consumed` });
  }

  const at = nowIso();
  const updated: ActionRequestV1 = {
    ...actionRequest,
    status: 'consumed',
    updatedAt: at,
    receipts: [
      ...actionRequest.receipts,
      {
        at,
        kind: 'consume',
        text: 'Operator consumed queued ActionRequest; no external mutation was performed by Cambium.',
      },
    ],
  };
  await kv.put(arRecordKey(updated.tenantId, updated.id), JSON.stringify(updated));

  return route(200, {
    ok: true,
    consumed: updated.id,
    kind: 'action-request',
    duplicate: false,
    actionRequest: updated,
  });
}

function validateIverifActionRequest(raw: Record<string, unknown>): { actionRequest: ActionRequestV1 } | { error: string } {
  if (raw.schema !== 'thoughtseed.action-request.v1') return { error: 'unsupported ActionRequest schema' };
  const tenantId = clean(raw.tenantId) || 'cambium';
  if (!VALID_TENANT.test(tenantId)) return { error: 'bad tenantId' };
  const id = clean(raw.id);
  const idempotencyKey = clean(raw.idempotencyKey);
  if (!id || !idempotencyKey) return { error: 'ActionRequest needs id and idempotencyKey' };
  if (clean(raw.branchId) !== 'iverif' || clean(raw.projectId) !== 'iverif') {
    return { error: 'only the iVerif ActionRequest slice is active' };
  }
  const topic = isRecord(raw.topic) ? raw.topic : null;
  if (!topic || clean(topic.chatId) !== '-1002691202808' || clean(topic.topicKey) !== 'clients' || Number(topic.threadId) !== 804) {
    return { error: 'ActionRequest must target THOUGHTSEED LABS clients:804' };
  }
  const options = Array.isArray(raw.options) ? raw.options.filter(isRecord).map(toOption).filter((option): option is ActionRequestOptionV1 => !!option) : [];
  if (!options.length) return { error: 'ActionRequest needs options' };

  return {
    actionRequest: {
      schema: 'thoughtseed.action-request.v1',
      id,
      idempotencyKey,
      tenantId,
      status: statusText(raw.status) ?? 'proposed',
      source: raw.source === 'hermes-topic-signal' ? 'hermes-topic-signal' : 'hermes-routine-signal',
      createdAt: clean(raw.createdAt) || new Date(0).toISOString(),
      updatedAt: clean(raw.updatedAt) || clean(raw.createdAt) || new Date(0).toISOString(),
      branchId: 'iverif',
      branchLabel: clean(raw.branchLabel) || 'IVerif',
      projectId: 'iverif',
      projectName: clean(raw.projectName) || 'IVerif',
      questId: clean(raw.questId) || 'the-handoff',
      topic: {
        chatId: '-1002691202808',
        topicKey: 'clients',
        threadId: 804,
        sourceMessageId: clean(topic.sourceMessageId) || undefined,
      },
      title: clean(raw.title) || 'iVerif ActionRequest',
      summary: clean(raw.summary) || 'iVerif AutoGTM action request',
      why: clean(raw.why) || 'iVerif branch needs founder choice before action',
      options,
      selectedOptionId: clean(raw.selectedOptionId) || undefined,
      receipts: Array.isArray(raw.receipts) ? raw.receipts.filter(isRecord).map(toReceipt) : [],
      redaction: raw.redaction === 'redacted' || raw.redaction === 'withheld' ? raw.redaction : 'safe',
    },
  };
}

function validateActor(actionRequest: ActionRequestV1, raw: Record<string, unknown>): string | null {
  const actor = isRecord(raw.actor) ? raw.actor : {};
  const telegramUserId = clean(actor.telegramUserId);
  const founderTelegramUserId = clean(raw.founderTelegramUserId) || telegramUserId;
  if (!telegramUserId || telegramUserId !== founderTelegramUserId) return 'founder actor mismatch';
  if (clean(actor.chatId) !== actionRequest.topic.chatId || Number(actor.threadId) !== actionRequest.topic.threadId) {
    return 'topic actor mismatch';
  }
  return null;
}

function statusForOption(option: ActionRequestOptionV1): ActionRequestStatus {
  if (option.requiresSignedConfirmation || option.risk === 'high' || option.resultKind === 'request_input' || option.resultKind === 'escalate_signed_gate') {
    return 'needs_signed_confirmation';
  }
  if (option.resultKind === 'hold' || option.resultKind === 'record_only') return 'blocked';
  return 'queued';
}

function receiptForStatus(status: ActionRequestStatus, label: string) {
  if (status === 'queued') return { editCard: true, reply: `Queued: ${label}.`, toast: 'Queued' };
  if (status === 'blocked') return { editCard: true, reply: `Blocked: ${label}.`, toast: 'Blocked' };
  if (status === 'needs_signed_confirmation') {
    return {
      editCard: true,
      reply: `Needs signed confirmation in the Mini App before ${label} can run.`,
      toast: 'Open Mini App confirmation',
    };
  }
  return { editCard: true, toast: 'Updated' };
}

async function readActionRequest(kv: ActionRequestKvLike, tenantId: string, id: string): Promise<ActionRequestV1 | null> {
  const raw = await kv.get(arRecordKey(tenantId, id));
  const parsed = parseJson(raw);
  return isRecord(parsed) ? parsed as unknown as ActionRequestV1 : null;
}

function isActionRequest(value: unknown): value is ActionRequestV1 {
  return isRecord(value) && value.schema === 'thoughtseed.action-request.v1' && typeof value.id === 'string';
}

function toListItem(actionRequest: ActionRequestV1): ActionRequestListItemV1 {
  const selected = actionRequest.options.find((option) => option.id === actionRequest.selectedOptionId);
  const lowRisk = actionRequest.options.find((option) => option.risk === 'low') || actionRequest.options[0];
  const signed = actionRequest.options.find((option) => option.requiresSignedConfirmation || option.risk === 'high') || actionRequest.options[1] || lowRisk;
  const latestReceipt = actionRequest.receipts.length ? actionRequest.receipts[actionRequest.receipts.length - 1] : undefined;
  const risk = actionRequest.options.some((option) => option.risk === 'high') ? 'high' : 'low';
  const consequence = (selected || lowRisk || signed)?.consequence || 'founder choice changes only the queued ActionRequest state until consumed';
  return {
    schema: 'thoughtseed.action-request-list-item.v1',
    id: actionRequest.id,
    tenantId: actionRequest.tenantId,
    status: actionRequest.status,
    branchId: actionRequest.branchId,
    branchLabel: actionRequest.branchLabel,
    projectId: actionRequest.projectId,
    projectName: actionRequest.projectName,
    questId: actionRequest.questId,
    topic: {
      topicKey: actionRequest.topic.topicKey,
      threadId: actionRequest.topic.threadId,
      sourceMessageId: actionRequest.topic.sourceMessageId,
    },
    title: actionRequest.title,
    summary: actionRequest.summary,
    why: actionRequest.why,
    source: actionRequest.source,
    redaction: actionRequest.redaction,
    createdAt: actionRequest.createdAt,
    updatedAt: actionRequest.updatedAt,
    selectedOptionId: actionRequest.selectedOptionId,
    next: nextForActionRequest(actionRequest),
    evidence: `${actionRequest.summary} · ${actionRequest.why}`,
    consequence,
    approveConsequence: lowRisk
      ? `queue ${lowRisk.label}; no client, spend, or public action runs until operator consumption`
      : 'queue low-risk branch task; no external action runs until consumed',
    rerollConsequence: signed
      ? `escalate ${signed.label} to signed Mini App confirmation before execution`
      : 'request a clearer branch option before execution',
    reversibility: actionRequest.status === 'needs_signed_confirmation'
      ? 'withheld until signed Mini App confirmation; reversible by choosing another option'
      : 'queued ActionRequest can be superseded until consumed by Cambium',
    idempotencyHint: actionRequest.idempotencyKey,
    owner: 'founder',
    priority: {
      source: 'cambium-action-requests@v1',
      risk,
      dependency: actionRequest.status === 'needs_signed_confirmation' ? 'signed-confirmation' : 'founder-choice',
      score: risk === 'high' ? 18 : 10,
      reasons: [
        actionRequest.branchLabel || actionRequest.projectName,
        actionRequest.questId || 'quest pending',
        actionRequest.status,
      ],
    },
    options: actionRequest.options.map((option) => ({
      id: option.id,
      label: option.label,
      consequence: option.consequence,
      risk: option.risk,
      requiresSignedConfirmation: option.requiresSignedConfirmation,
      resultKind: option.resultKind,
    })),
    receipts: {
      count: actionRequest.receipts.length,
      ...(latestReceipt ? {
        latest: {
          at: latestReceipt.at,
          kind: latestReceipt.kind,
          text: latestReceipt.text,
        },
      } : {}),
    },
  };
}

function nextForActionRequest(actionRequest: ActionRequestV1): string {
  if (actionRequest.status === 'needs_signed_confirmation') return 'Mini App signed confirmation required before execution';
  if (actionRequest.status === 'queued') return 'Cambium can consume this queued branch task after operator review';
  if (actionRequest.status === 'completed') return 'Completed; keep the receipt in Story and Inspect';
  if (actionRequest.status === 'blocked') return 'Blocked until the branch receives a safer option or proof';
  if (actionRequest.status === 'awaiting_input') return 'Capture founder reply in the Telegram topic before proceeding';
  return 'Founder choice is still required in Telegram';
}

function toOption(raw: Record<string, unknown>): ActionRequestOptionV1 | null {
  const id = clean(raw.id);
  const label = clean(raw.label);
  if (!id || !label) return null;
  return {
    id,
    label,
    consequence: clean(raw.consequence),
    risk: raw.risk === 'high' ? 'high' : 'low',
    requiresSignedConfirmation: raw.requiresSignedConfirmation === true,
    resultKind: resultKind(raw.resultKind),
  };
}

function toReceipt(raw: Record<string, unknown>) {
  return {
    at: clean(raw.at) || new Date(0).toISOString(),
    kind: receiptKind(raw.kind),
    text: clean(raw.text),
    ...(Number.isFinite(Number(raw.telegramMessageId)) ? { telegramMessageId: Number(raw.telegramMessageId) } : {}),
  };
}

function resultKind(value: unknown): ActionRequestOptionV1['resultKind'] {
  if (value === 'hold' || value === 'reroll' || value === 'queue_task' || value === 'request_input' || value === 'escalate_signed_gate' || value === 'record_only') return value;
  return 'record_only';
}

function receiptKind(value: unknown): ActionRequestV1['receipts'][number]['kind'] {
  if (value === 'posted' || value === 'edited' || value === 'callback' || value === 'reply' || value === 'gate' || value === 'consume' || value === 'complete') return value;
  return 'callback';
}

function statusText(value: unknown): ActionRequestStatus | null {
  if (value === 'binding_required' || value === 'proposed' || value === 'awaiting_input' || value === 'needs_signed_confirmation' || value === 'queued' || value === 'blocked' || value === 'consumed' || value === 'completed' || value === 'superseded') return value;
  return null;
}

function arRecordKey(tenantId: string, id: string): string {
  return `action-request:${tenantId}:${id}`;
}

function arRecordPrefix(tenantId: string): string {
  return `action-request:${tenantId}:`;
}

function arIdempotencyKey(tenantId: string, idempotencyKey: string): string {
  return `action-request-idempotency:${tenantId}:${idempotencyKey}`;
}

function route(status: number, body: Record<string, unknown>): ActionRequestRouteResult {
  return { status, body };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

async function sha256hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value) as unknown as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
