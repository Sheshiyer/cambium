// cambium-quests · the serving store for the quest ledger (Thalia wing, W1).
// Pure handler — no Workers runtime imports — so node:test covers it like every
// other module in this repo. The thin fetch glue lives in index.ts.
//
// Doctrine carried over the wire: the API serves DERIVED ledgers only, inside an
// envelope {schema, derivedAt, source, tenant} so the UI can show real freshness
// (no fake liveness). Tenant gate: cambium only until M3's isolation suite is
// green (the quest log's own arc VII — the feature gates itself).

import { PAGE } from './page.ts';
import { handleContextRoute } from './context-routes.ts';
import type { ContextRouteDeps } from './context-routes.ts';
import type { GithubCommandExecutor } from './github-command.ts';
import { validateGithubCommand } from './github-command.ts';

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  list(prefix: string): Promise<string[]>;   // key names under a prefix (gate queue)
}

export interface BridgeAssignmentRecord {
  id: string;
  memberId: string;
  taskId: string;
  projectId: string;
  eventId: string;
  correlationId?: string;
  payloadHash: string;
  enqueuedAt: string;
}

export interface BridgeStoreLike {
  putUpstream(tenantId: string, id: string, message: Record<string, unknown>): Promise<void>;
  listUpstream(tenantId: string, limit: number): Promise<any[]>;
  putDirective(memberId: string, id: string, directive: Record<string, unknown>): Promise<void>;
  listPendingDirectives(memberId: string, limit: number): Promise<{ directives: any[]; skipped: number }>;
  markDirectiveDelivered(memberId: string, id: string, deliveredAt: string): Promise<boolean>;
  getAssignment(memberId: string, eventId: string): Promise<BridgeAssignmentRecord | null>;
  putAssignment(record: BridgeAssignmentRecord): Promise<void>;
}

export type FabricEvidenceCandidateStatus = 'verified_evidence' | 'review_pending' | 'rejected_candidate';

export interface FabricLedgerTaskRecord {
  tenantId?: string;
  taskId: string;
  projectId: string;
  memberId: string;
  status: string;
  workMode?: string | null;
  evidenceStrength: 'weak_evidence' | 'verified_evidence';
  title?: string | null;
  payload: Record<string, unknown>;
  updatedAt: string;
}

export interface FabricLedgerEventRecord {
  tenantId?: string;
  eventId: string;
  taskId: string;
  projectId: string;
  memberId: string;
  type: string;
  source: string;
  payloadHash: string;
  upstreamPayloadHash?: string | null;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  receivedAt: string;
}

export interface FabricEvidenceCandidateRecord {
  tenantId?: string;
  candidateId: string;
  taskId: string;
  projectId: string;
  memberId: string;
  status: FabricEvidenceCandidateStatus;
  confidence: 'high' | 'medium' | 'low';
  matchKind: 'explicit' | 'inferred' | 'note_only';
  evidence: Record<string, unknown>;
  reason: string;
  createdAt: string;
  reviewedAt?: string | null;
  reviewActor?: string | null;
  reviewReason?: string | null;
}

export interface FabricEvidenceReviewRecord {
  tenantId?: string;
  reviewId: string;
  candidateId: string;
  outcome: 'accepted' | 'rejected';
  actor: string;
  reason?: string | null;
  reviewedAt: string;
}

export interface FabricLedgerStoreLike {
  getEvent(eventId: string, tenantId?: string): Promise<FabricLedgerEventRecord | null>;
  putEvent(record: FabricLedgerEventRecord): Promise<boolean>;
  getTask(taskId: string, tenantId?: string): Promise<FabricLedgerTaskRecord | null>;
  findTasks(tenantId?: string): Promise<FabricLedgerTaskRecord[]>;
  upsertTask(record: FabricLedgerTaskRecord): Promise<void>;
  putEvidenceCandidate(record: FabricEvidenceCandidateRecord): Promise<void>;
  getEvidenceCandidate(candidateId: string, tenantId?: string): Promise<FabricEvidenceCandidateRecord | null>;
  listReviewItems(tenantId?: string): Promise<FabricEvidenceCandidateRecord[]>;
  updateEvidenceCandidate(record: FabricEvidenceCandidateRecord): Promise<void>;
  putEvidenceReview(record: FabricEvidenceReviewRecord): Promise<void>;
}

export interface HandlerDeps {
  kv: KvLike;
  pushToken?: string;          // Worker secret QUESTS_PUSH_TOKEN (unset → push lane 503s)
  gate?: GateConfig;           // W4 founder gate (unset → gate lane 503s)
  bridgeToken?: string;        // Worker secret BRIDGE_TOKEN — the admin/cofounder bridge token
  assignmentToken?: string;    // Scoped Hermes token — may enqueue project_task_assignment only
  bridgeStore?: BridgeStoreLike; // Optional non-KV bridge queue store (D1 in production)
  fabricLedger?: FabricLedgerStoreLike; // Cambium-owned interpreted Fabric task/event ledger
  handoffSecret?: string;      // Worker secret HANDOFF_SECRET — signs invite links (unset → handoff 503)
  providerBroker?: ProviderBrokerConfig; // Worker secrets for hosted provider proxying (unset → provider lane 503s)
  contextRoutes?: ContextRouteDeps; // Optional bounded context route providers (unset → context lane 503s)
  githubCommand?: GithubCommandExecutor; // Optional GitHub repo/issue command executor for Hermes manual commands.
  githubAllowedRepos?: string[]; // Same allowlist used by the GitHub command executor.
  uuid?: () => string;         // injectable for tests
  now?: () => string;          // injectable clock (ISO) for the bridge
  nowMs?: () => number;        // injectable epoch-ms clock for handoff TTLs
  publicBaseUrl?: string;      // deployed Worker base URL for invite/deep links
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel?: string;
  models?: string[];
}

export interface ProviderBrokerConfig {
  token: string;
  providers: Record<string, ProviderConfig | undefined>;
  fetch?: typeof fetch;
}

// ── W4 · the founder gate: Telegram initData THIRD-PARTY validation ─────
// Ed25519 over the data-check string, verified with TELEGRAM'S PUBLIC KEY —
// zero secrets on this Worker (second pass F7). The bot token never leaves home.

export interface GateConfig {
  botId: string;                    // numeric bot id (non-secret, the token prefix)
  pubKeyHex: string;                // Telegram public Ed25519 key (prod constant) — injectable for tests
  founderIds: string[];             // the co-founder whitelist (same ids the commands use)
  maxAgeSec?: number;               // auth_date freshness window (default 600)
  now?: () => number;               // injectable clock
}

type GateActionKind = 'approve' | 'reroll' | 'promote-skill' | 'queue-side-quest';

/** Telegram production public key for third-party initData validation. */
export const TELEGRAM_PROD_PUBKEY = 'e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';

const hexToBytes = (hex: string): Uint8Array =>
  new Uint8Array((hex.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));

const b64urlToBytes = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

// ── Secure member handoff — crypto helpers (Web Crypto; runs in Workers + node) ──
const TEXT = new TextEncoder();
const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000;   // per-member token: 30d → monthly rotation
const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;   // invite link: 7d to redeem
const b64urlFromBytes = (bytes: Uint8Array): string => {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', TEXT.encode(s) as unknown as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hmacB64url(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', TEXT.encode(secret) as unknown as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, TEXT.encode(msg) as unknown as BufferSource);
  return b64urlFromBytes(new Uint8Array(sig));
}
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter((k) => record[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
}
async function bridgeSignature(secret: string, msg: Record<string, unknown>): Promise<string> {
  const { signature: _signature, ...unsigned } = msg;
  return hmacB64url(secret, canonicalJson(unsigned));
}
function randomTokenHex(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function signInvite(secret: string, claims: Record<string, unknown>): Promise<string> {
  const payload = b64urlFromBytes(TEXT.encode(JSON.stringify(claims)));
  return `${payload}.${await hmacB64url(secret, payload)}`;
}
async function verifyInvite(secret: string, token: string): Promise<Record<string, any> | null> {
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot), sig = token.slice(dot + 1);
  if (sig !== (await hmacB64url(secret, payload))) return null;
  try { return JSON.parse(new TextDecoder().decode(b64urlToBytes(payload))); } catch { return null; }
}
const memberKey = (id: string) => `member:${id}`;
const tokenIndexKey = (hash: string) => `memtok:${hash}`;
const inviteKey = (jti: string) => `invite:${jti}`;

/** The data-check string for THIRD-PARTY validation: `<bot_id>:WebAppData\n` +
 *  sorted key=value lines, excluding `hash` and `signature`. */
export function buildDataCheckString(initData: string, botId: string): { dcs: string; fields: Record<string, string> } {
  const params = new URLSearchParams(initData);
  const fields: Record<string, string> = {};
  for (const [k, v] of params.entries()) fields[k] = v;
  const lines = Object.keys(fields)
    .filter((k) => k !== 'hash' && k !== 'signature')
    .sort()
    .map((k) => `${k}=${fields[k]}`);
  return { dcs: `${botId}:WebAppData\n${lines.join('\n')}`, fields };
}

export async function validateInitData(
  initData: string,
  cfg: GateConfig,
): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
  if (!initData) return { ok: false, reason: 'missing initData (the gate opens inside Telegram)' };
  const { dcs, fields } = buildDataCheckString(initData, cfg.botId);
  if (!fields.signature) return { ok: false, reason: 'missing third-party signature' };
  const authDate = Number(fields.auth_date ?? 0);
  const now = (cfg.now ?? (() => Date.now()))() / 1000;
  const maxAge = cfg.maxAgeSec ?? 600;
  if (!authDate || now - authDate > maxAge) return { ok: false, reason: 'stale auth_date' };
  let verified = false;
  try {
    const key = await crypto.subtle.importKey('raw', hexToBytes(cfg.pubKeyHex), { name: 'Ed25519' }, false, ['verify']);
    verified = await crypto.subtle.verify('Ed25519', key, b64urlToBytes(fields.signature), new TextEncoder().encode(dcs));
  } catch {
    return { ok: false, reason: 'signature verification unavailable' };
  }
  if (!verified) return { ok: false, reason: 'bad signature' };
  let userId = '';
  try { userId = String(JSON.parse(fields.user ?? '{}').id ?? ''); } catch { /* fallthrough */ }
  if (!userId || !cfg.founderIds.includes(userId)) return { ok: false, reason: 'not a founder' };
  return { ok: true, userId };
}

export interface SimpleRequest {
  method: string;
  path: string;
  headers: Record<string, string>;   // lower-cased keys
  body?: string;
}

export interface SimpleResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Tenant ID validation: lowercase kebab, no leading/trailing dash. The M3 isolation
 *  suite is green (arc VII complete) — the gate is open to all valid tenants. */
const VALID_TENANT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const SOCIAL_OVERCLAIM_RE = /\b(leaderboard|social[-\s]proof|popularity|rank|follower|viral)\b/i;
const PUBLIC_SECRET_RE = /(?:\bBearer\s+|\b(?:TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|rawInitData|initData|query_id|auth_date)\b=?|\b(?:token|user|id)=|hash=)/i;
const SOCIAL_UNSAFE_RE = new RegExp(`${SOCIAL_OVERCLAIM_RE.source}|${PUBLIC_SECRET_RE.source}`, 'i');
const THOUGHTSEED_TELEGRAM_CHAT_ID = '-1002691202808';
const TOPIC_QUEST_ROUTES = {
  hermes: { topicName: 'Hermes', threadId: 797, questId: 'the-gate', priority: 'normal', taskType: 'operations', title: 'Coordinate Hermes topic signal' },
  digests: { topicName: 'Digests', threadId: 798, questId: 'the-review', priority: 'normal', taskType: 'research', title: 'Synthesize digest topic signal' },
  dev: { topicName: 'Dev', threadId: 799, questId: 'the-build', priority: 'high', taskType: 'engineering', title: 'Act on Dev topic signal' },
  inbox: { topicName: 'Inbox', threadId: 800, questId: 'the-brief', priority: 'normal', taskType: 'general', title: 'Triage Inbox topic signal' },
  calendar: { topicName: 'Calendar', threadId: 801, questId: 'the-brief', priority: 'normal', taskType: 'operations', title: 'Prepare Calendar topic signal' },
  agent_ops: { topicName: 'Agent Ops', threadId: 802, questId: 'living-org', priority: 'high', taskType: 'operations', title: 'Investigate Agent Ops topic signal' },
  alerts: { topicName: 'Alerts', threadId: 803, questId: 'the-ship-gate', priority: 'urgent', taskType: 'operations', title: 'Escalate Alerts topic signal' },
  clients: { topicName: 'Clients', threadId: 804, questId: 'the-handoff', priority: 'high', taskType: 'general', title: 'Prepare Clients topic signal' },
} as const;

const json = (status: number, value: unknown): SimpleResponse =>
  ({ status, headers: { ...JSON_HEADERS }, body: JSON.stringify(value) });

const ledgerKey = (tenant: string): string => `ledger:${tenant}`;
const shortText = (value: unknown, fallback: string, max = 300): string => {
  const text = String(value ?? '').trim();
  return (text || fallback).slice(0, max);
};
const optionalText = (value: unknown, max = 300): string | undefined => {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : undefined;
};

const FABRIC_TASK_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const FABRIC_TASK_TYPES = new Set(['engineering', 'design', 'marketing', 'operations', 'research', 'general']);

function assignmentEventId(projectId: string, taskId: string): string {
  return `cambium:${projectId}:${taskId}:assigned`;
}

function topicSkillHints(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const skillId = safeFabricText(raw.skillId, '', 120);
    const actionId = safeFabricText(raw.actionId, '', 120);
    if (!skillId || !actionId) return [];
    return [{
      skillId,
      domain: safeFabricText(raw.domain, 'unknown', 80),
      roleId: safeFabricText(raw.roleId, 'hermes', 80),
      actionId,
      approvalRequired: raw.approvalRequired === true,
      reason: safeFabricText(raw.reason, 'Hermes routed this topic through a skill loadout.', 300),
    }];
  });
}

function kvBridgeStore(kv: KvLike): BridgeStoreLike {
  return {
    async putUpstream(tenantId, id, message) {
      await kv.put(`bridge:up:${tenantId}:${id}`, JSON.stringify(message));
    },
    async listUpstream(tenantId, limit) {
      const keys = await kv.list(`bridge:up:${tenantId}:`);
      const messages: any[] = [];
      for (const k of keys.slice(-limit)) {
        const v = await kv.get(k);
        if (!v) continue;
        try { messages.push(JSON.parse(v)); } catch { /* skip corrupt bridge inbox records */ }
      }
      return messages;
    },
    async putDirective(memberId, id, directive) {
      await kv.put(`bridge:dir:${memberId}:${id}`, JSON.stringify(directive));
    },
    async listPendingDirectives(memberId, limit) {
      const keys = await kv.list(`bridge:dir:${memberId}:`);
      const directives: any[] = [];
      let skipped = 0;
      for (const k of keys) {
        const v = await kv.get(k);
        if (!v) continue;
        try {
          const d = JSON.parse(v);
          if (!d.delivered && directives.length < limit) directives.push(d);
        } catch {
          skipped++;
        }
      }
      return { directives, skipped };
    },
    async markDirectiveDelivered(memberId, id, deliveredAt) {
      const key = `bridge:dir:${memberId}:${id}`;
      const v = await kv.get(key);
      if (!v) return false;
      try {
        const d = JSON.parse(v);
        d.delivered = true;
        d.deliveredAt = deliveredAt;
        await kv.put(key, JSON.stringify(d));
        return true;
      } catch {
        return false;
      }
    },
    async getAssignment(memberId, eventId) {
      const raw = await kv.get(`bridge:assignment:${memberId}:${eventId}`);
      if (!raw) return null;
      try { return JSON.parse(raw) as BridgeAssignmentRecord; } catch { return null; }
    },
    async putAssignment(record) {
      await kv.put(`bridge:assignment:${record.memberId}:${record.eventId}`, JSON.stringify(record));
    },
  };
}

function normalizeAssignmentTask(raw: Record<string, unknown>, memberId: string): Record<string, unknown> | { error: string } {
  const taskId = optionalText(raw.taskId ?? raw.id, 120);
  const projectId = optionalText(raw.projectId, 120);
  const title = optionalText(raw.title, 180);
  if (!taskId) return { error: 'assignment task needs taskId' };
  if (!projectId) return { error: 'assignment task needs projectId' };
  if (!title) return { error: 'assignment task needs title' };
  const priority = optionalText(raw.priority, 24);
  const taskType = optionalText(raw.taskType ?? raw.type, 24);
  const skillHints = topicSkillHints(raw.skillHints);
  return {
    taskId,
    projectId,
    projectName: optionalText(raw.projectName, 180),
    questId: optionalText(raw.questId, 120),
    clientId: optionalText(raw.clientId, 120),
    clientName: optionalText(raw.clientName, 180),
    title,
    description: optionalText(raw.description, 1200),
    priority: priority && FABRIC_TASK_PRIORITIES.has(priority) ? priority : 'normal',
    taskType: taskType && FABRIC_TASK_TYPES.has(taskType) ? taskType : 'general',
    assigneeMemberId: memberId,
    assignedBy: optionalText(raw.assignedBy, 80) ?? 'cambium',
    source: optionalText(raw.source, 80) ?? 'cambium',
    ...(skillHints.length ? { skillHints } : {}),
  };
}

async function queueProjectTaskAssignment(
  bridgeStore: BridgeStoreLike,
  msg: Record<string, unknown>,
  nowIso: () => string,
  createId?: () => string,
): Promise<SimpleResponse> {
  const rawTask = msg && typeof msg.task === 'object' && msg.task && !Array.isArray(msg.task) ? msg.task as Record<string, unknown> : null;
  if (!rawTask) return json(400, { error: 'assignment needs a task object' });
  const memberId = String(msg.memberId ?? rawTask.assigneeMemberId ?? '').trim().toLowerCase();
  if (!memberId || !VALID_TENANT.test(memberId)) return json(400, { error: 'assignment needs a valid memberId' });
  const task = normalizeAssignmentTask(rawTask, memberId);
  if ('error' in task) return json(400, { error: task.error });

  const issuedAt = nowIso();
  const taskId = String(task.taskId);
  const projectId = String(task.projectId);
  const eventId = optionalText(msg.eventId ?? rawTask.eventId, 160) ?? assignmentEventId(projectId, taskId);
  const correlationId = optionalText(msg.correlationId ?? rawTask.correlationId, 160) ?? eventId;
  const directiveId = optionalText(msg.id, 160) ?? (createId ? createId() : `task_${memberId}_${issuedAt}`);
  const semanticPayload = {
    type: 'project_task_assignment',
    kind: 'project_task_assignment',
    schema: 'thoughtseed.project_task_assignment.v1',
    source: 'cambium',
    eventId,
    correlationId,
    target: { memberId, surface: 'plexus-agent-fabric' },
    task: { ...task, eventId, correlationId },
  };
  const payload = { ...semanticPayload, issuedAt };
  const payloadHash = await sha256hex(canonicalJson(semanticPayload));
  const existing = await bridgeStore.getAssignment(memberId, eventId);
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      return json(409, { error: 'assignment eventId conflict', eventId, memberId, existingId: existing.id });
    }
    return json(200, { ok: true, id: existing.id, memberId, taskId, projectId, eventId, correlationId, queued: true, duplicate: true });
  }

  const stored = {
    id: directiveId,
    memberId,
    direction: 'downstream',
    payload,
    payloadHash,
    delivered: false,
    issuedAt,
    enqueuedAt: issuedAt,
  };
  await bridgeStore.putAssignment({ id: directiveId, memberId, taskId, projectId, eventId, correlationId, payloadHash, enqueuedAt: issuedAt });
  const persisted = await bridgeStore.getAssignment(memberId, eventId);
  if (!persisted) return json(500, { error: 'assignment persistence failed', eventId, memberId });
  if (persisted.payloadHash !== payloadHash) {
    return json(409, { error: 'assignment eventId conflict', eventId, memberId, existingId: persisted.id });
  }
  if (persisted.id !== directiveId) {
    return json(200, { ok: true, id: persisted.id, memberId, taskId, projectId, eventId, correlationId, queued: true, duplicate: true });
  }
  await bridgeStore.putDirective(memberId, directiveId, stored);
  return json(200, { ok: true, id: directiveId, memberId, taskId, projectId, eventId, correlationId, queued: true });
}

function topicQuestAssignment(raw: Record<string, unknown>, createId: () => string): Record<string, unknown> | { error: string } {
  const topicKey = optionalText(raw.topicKey ?? raw.topic, 80);
  if (!topicKey || !(topicKey in TOPIC_QUEST_ROUTES)) return { error: 'topicKey must be one of hermes|digests|dev|inbox|calendar|agent_ops|alerts|clients' };
  const route = TOPIC_QUEST_ROUTES[topicKey as keyof typeof TOPIC_QUEST_ROUTES];
  const chatId = optionalText(raw.chatId, 80);
  if (chatId && chatId !== THOUGHTSEED_TELEGRAM_CHAT_ID) return { error: 'topic signal chatId is not THOUGHTSEED LABS' };
  const threadId = raw.threadId ?? raw.topicThreadId ?? raw.messageThreadId;
  if (threadId !== undefined && Number(threadId) !== route.threadId) return { error: `topic thread mismatch for ${topicKey}` };

  const signalId = optionalText(raw.signalId ?? raw.sourceMessageId ?? raw.messageId ?? raw.id, 120) ?? createId();
  const memberId = optionalText(raw.memberId ?? raw.assigneeMemberId, 80) ?? 'shesh';
  const projectId = optionalText(raw.projectId, 120) ?? 'thoughtseed-ops';
  const title = safeFabricText(raw.title, route.title, 180);
  const summary = safeFabricText(raw.summary ?? raw.text ?? raw.note, 'topic signal summary withheld or unavailable', 900);
  const priority = optionalText(raw.priority, 24);
  const taskType = optionalText(raw.taskType ?? raw.type, 24);
  const taskId = optionalText(raw.taskId, 160) ?? fabricCleanId(`topic-${topicKey}-${signalId}`, 'task');
  const eventId = optionalText(raw.eventId, 180) ?? `topic:${projectId}:${topicKey}:${signalId}:assigned`;
  const correlationId = optionalText(raw.correlationId, 180) ?? eventId;
  const skillHints = topicSkillHints(raw.skillHints);
  return {
    memberId,
    eventId,
    correlationId,
    task: {
      taskId,
      projectId,
      projectName: optionalText(raw.projectName, 180) ?? 'Thoughtseed Ops',
      questId: optionalText(raw.questId, 120) ?? route.questId,
      clientId: optionalText(raw.clientId, 120),
      clientName: optionalText(raw.clientName, 180),
      title,
      description: `Telegram ${route.topicName} topic signal (${topicKey}/${route.threadId}) -> ${summary}`,
      priority: priority && FABRIC_TASK_PRIORITIES.has(priority) ? priority : route.priority,
      taskType: taskType && FABRIC_TASK_TYPES.has(taskType) ? taskType : route.taskType,
      assignedBy: optionalText(raw.assignedBy, 80) ?? 'hermes-topic-router',
      source: 'cambium-topic-routing',
      ...(skillHints.length ? { skillHints } : {}),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function fabricCleanId(value: string, prefix: string): string {
  const stable = value
    .toLowerCase()
    .replace(/[^a-z0-9:-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return stable ? `${prefix}_${stable}` : `${prefix}_${Date.now()}`;
}

function fabricPayloadFromMessage(message: any): Record<string, unknown> | null {
  const payload = isRecord(message?.payload) ? message.payload : null;
  if (!payload) return null;
  const type = optionalText(payload.type ?? payload.kind, 80);
  return type === 'fabric_task_event' || type === 'fabric_task_report' ? payload : null;
}

function fabricEventId(message: any, payload: Record<string, unknown>): string {
  return optionalText(payload.historyEventId ?? payload.eventId, 180)
    ?? optionalText(message?.id, 180)
    ?? `fabric_event_${Date.now()}`;
}

function fabricHashPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const {
    historyPayloadHash: _historyPayloadHash,
    evidenceStrength: _evidenceStrength,
    ...serverHashPayload
  } = payload;
  return serverHashPayload;
}

async function fabricPayloadHash(payload: Record<string, unknown>): Promise<string> {
  return sha256hex(canonicalJson(fabricHashPayload(payload)));
}

function fabricUpstreamPayloadHash(payload: Record<string, unknown>): string | null {
  return optionalText(payload.historyPayloadHash, 180) ?? null;
}

function taskRecordFromFabricPayload(message: any, payload: Record<string, unknown>, receivedAt: string): FabricLedgerTaskRecord | null {
  const taskId = optionalText(payload.taskId, 160);
  const projectId = optionalText(payload.projectId, 160);
  const memberId = optionalText(message?.memberId ?? payload.assigneeMemberId ?? payload.memberId, 120);
  if (!taskId || !projectId || !memberId) return null;
  const tenantId = optionalText(message?.tenantId ?? payload.tenantId, 80) ?? 'cambium';
  if (!VALID_TENANT.test(tenantId)) return null;
  return {
    tenantId,
    taskId,
    projectId,
    memberId,
    status: optionalText(payload.status, 40) ?? 'seen',
    workMode: optionalText(payload.workMode, 40) ?? null,
    evidenceStrength: 'weak_evidence',
    title: optionalText(payload.title, 180) ?? taskId,
    payload,
    updatedAt: receivedAt,
  };
}

function evidenceFromFabricPayload(payload: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(payload.evidence)) return payload.evidence;
  const note = optionalText(payload.note, 1200);
  if (!note) return null;
  return { type: 'note', value: note, label: 'Completion note', source: 'manual', strength: 'weak_evidence' };
}

function evidenceType(evidence: Record<string, unknown> | null): string {
  return String(evidence?.type ?? '').trim().toLowerCase().replace(/[-\s]+/g, '_');
}

function evidenceText(evidence: Record<string, unknown>, keys: string[], max = 500): string | undefined {
  for (const key of keys) {
    const text = optionalText(evidence[key], max);
    if (text) return text;
  }
  return undefined;
}

function evidenceUrl(evidence: Record<string, unknown>): URL | null {
  const value = evidenceText(evidence, ['url', 'value', 'href', 'link'], 1000);
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function hostIs(url: URL, domain: string): boolean {
  return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
}

function hasGithubPullProof(evidence: Record<string, unknown>): boolean {
  const url = evidenceUrl(evidence);
  return !!url && hostIs(url, 'github.com') && /^\/[^/\s]+\/[^/\s]+\/pull\/\d+(?:\/)?$/i.test(url.pathname);
}

function hasGithubCommitProof(evidence: Record<string, unknown>): boolean {
  const sha = evidenceText(evidence, ['sha', 'commit', 'commitSha', 'value'], 120);
  if (sha && /^[a-f0-9]{7,40}$/i.test(sha)) return true;
  const url = evidenceUrl(evidence);
  return !!url && hostIs(url, 'github.com') && /^\/[^/\s]+\/[^/\s]+\/commit\/[a-f0-9]{7,40}$/i.test(url.pathname);
}

function hasDesignProof(evidence: Record<string, unknown>, domain: string): boolean {
  const url = evidenceUrl(evidence);
  return !!url && hostIs(url, domain);
}

function isStrongFabricEvidence(evidence: Record<string, unknown>): boolean {
  switch (evidenceType(evidence)) {
    case 'github_pr':
    case 'pull_request':
      return hasGithubPullProof(evidence);
    case 'github_commit':
    case 'git_commit':
    case 'commit':
      return hasGithubCommitProof(evidence);
    case 'github_branch':
    case 'git_branch':
    case 'branch':
      return false;
    case 'deployment':
    case 'deploy':
    case 'deploy_preview':
    case 'preview_url':
      return false;
    case 'figma':
    case 'figma_file':
      return hasDesignProof(evidence, 'figma.com');
    case 'canva':
    case 'canva_design':
      return hasDesignProof(evidence, 'canva.com');
    case 'file_path':
    case 'file':
      return false;
    default:
      return false;
  }
}

function fabricCandidateForEvent(
  task: FabricLedgerTaskRecord,
  eventId: string,
  payload: Record<string, unknown>,
  receivedAt: string,
): FabricEvidenceCandidateRecord | null {
  const evidence = evidenceFromFabricPayload(payload);
  if (!evidence) return null;
  const type = evidenceType(evidence);
  const verified = isStrongFabricEvidence(evidence);
  return {
    candidateId: fabricCleanId(`${eventId}:${task.taskId}:${type || 'note'}`, 'cand'),
    tenantId: task.tenantId,
    taskId: task.taskId,
    projectId: task.projectId,
    memberId: task.memberId,
    status: verified ? 'verified_evidence' : 'review_pending',
    confidence: verified ? 'high' : 'low',
    matchKind: verified ? 'explicit' : (type === 'note' || type.startsWith('manual') ? 'note_only' : 'inferred'),
    evidence,
    reason: verified
      ? 'validated strong evidence attached to explicit Fabric task report'
      : 'unvalidated, note-only, or weak evidence requires founder/admin review',
    createdAt: receivedAt,
  };
}

async function consumeFabricBridgeMessages(
  bridgeStore: BridgeStoreLike,
  fabricLedger: FabricLedgerStoreLike,
  tenantId: string,
  nowIso: () => string,
): Promise<{
  tenantId: string;
  checked: number;
  consumed: number;
  duplicates: number;
  conflicts: number;
  upgraded: number;
}> {
  const messages = await bridgeStore.listUpstream(tenantId, 200);
  let consumed = 0;
  let duplicates = 0;
  let conflicts = 0;
  let upgraded = 0;

  for (const message of messages) {
    const payload = fabricPayloadFromMessage(message);
    if (!payload) continue;
    const receivedAt = optionalText(message.receivedAt, 80) ?? nowIso();
    const eventId = fabricEventId(message, payload);
    const payloadHash = await fabricPayloadHash(payload);
    const existing = await fabricLedger.getEvent(eventId, tenantId);
    if (existing) {
      if (existing.payloadHash === payloadHash) duplicates++;
      else conflicts++;
      continue;
    }

    const task = taskRecordFromFabricPayload(message, payload, receivedAt);
    if (!task) continue;
    const candidate = fabricCandidateForEvent(task, eventId, payload, receivedAt);
    if (candidate?.status === 'verified_evidence') task.evidenceStrength = 'verified_evidence';

    const inserted = await fabricLedger.putEvent({
      tenantId,
      eventId,
      taskId: task.taskId,
      projectId: task.projectId,
      memberId: task.memberId,
      type: optionalText(payload.type ?? payload.kind, 80) ?? 'fabric_task_event',
      source: 'plexus',
      payloadHash,
      upstreamPayloadHash: fabricUpstreamPayloadHash(payload),
      payload,
      correlationId: optionalText(payload.correlationId, 180) ?? null,
      receivedAt,
    });
    if (!inserted) {
      const raced = await fabricLedger.getEvent(eventId, tenantId);
      if (raced?.payloadHash === payloadHash) duplicates++;
      else conflicts++;
      continue;
    }

    const existingTask = await fabricLedger.getTask(task.taskId, tenantId);
    const previousStrength = existingTask?.evidenceStrength ?? 'weak_evidence';
    const nextStrength = previousStrength === 'verified_evidence' || task.evidenceStrength === 'verified_evidence'
      ? 'verified_evidence'
      : 'weak_evidence';
    await fabricLedger.upsertTask({
      ...existingTask,
      ...task,
      evidenceStrength: nextStrength,
      payload: { ...(existingTask?.payload ?? {}), ...task.payload },
    });

    if (candidate) {
      await fabricLedger.putEvidenceCandidate(candidate);
      if (previousStrength !== 'verified_evidence' && candidate.status === 'verified_evidence') upgraded++;
    }
    consumed++;
  }

  return { tenantId, checked: messages.length, consumed, duplicates, conflicts, upgraded };
}

function matchesInferredTask(task: FabricLedgerTaskRecord, evidence: Record<string, unknown>): boolean {
  const haystack = [
    evidence.repo,
    evidence.branch,
    evidence.clientName,
    evidence.client,
    evidence.title,
    evidence.value,
  ].map((v) => String(v ?? '').toLowerCase()).join(' ');
  return [task.taskId, task.projectId, task.title, task.payload.clientName, task.payload.clientId]
    .map((v) => String(v ?? '').toLowerCase())
    .filter((v) => v.length >= 4)
    .some((needle) => haystack.includes(needle));
}

function fabricTenantFromRecord(value: { tenantId?: string; payload?: Record<string, unknown> } | null | undefined): string {
  return optionalText(value?.tenantId ?? value?.payload?.tenantId, 80) ?? 'cambium';
}

function fabricTenantFromInput(value: Record<string, unknown>, fallback = 'cambium'): string | { error: string } {
  const tenantId = optionalText(value.tenantId, 80) ?? fallback;
  return VALID_TENANT.test(tenantId) ? tenantId : { error: 'bad tenantId' };
}

function fabricTenantFromPath(path: string): string | { error: string } {
  const query = path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';
  const tenantId = optionalText(new URLSearchParams(query).get('tenantId'), 80) ?? 'cambium';
  return VALID_TENANT.test(tenantId) ? tenantId : { error: 'bad tenantId' };
}

function fabricRoutePath(path: string): string {
  return path.split('?')[0];
}

function sameFabricTenant(record: { tenantId?: string; payload?: Record<string, unknown> } | null | undefined, tenantId: string): boolean {
  return fabricTenantFromRecord(record) === tenantId;
}

function safeFabricText(value: unknown, fallback = '', max = 300): string {
  const text = String(value ?? '').trim();
  if (!text || SOCIAL_UNSAFE_RE.test(text)) return fallback;
  return text.slice(0, max);
}

function safeFabricEvidence(evidence: Record<string, unknown>): Record<string, string> {
  const allowed = ['type', 'label', 'source', 'value', 'url', 'href', 'link', 'repo', 'branch', 'clientName', 'client', 'sha', 'commit', 'commitSha'];
  const safe: Record<string, string> = {};
  for (const key of allowed) {
    const value = evidence[key];
    if (value === undefined || value === null) continue;
    const text = safeFabricText(value, '[redacted]', key === 'value' || key === 'url' || key === 'href' || key === 'link' ? 500 : 180);
    if (text) safe[key] = text;
  }
  return safe.type ? safe : { type: 'redacted' };
}

function fabricCandidateDto(candidate: FabricEvidenceCandidateRecord): Record<string, unknown> {
  return {
    tenantId: fabricTenantFromRecord(candidate),
    candidateId: candidate.candidateId,
    taskId: candidate.taskId,
    projectId: candidate.projectId,
    memberId: candidate.memberId,
    status: candidate.status,
    reviewStatus: candidate.status,
    confidence: candidate.confidence,
    matchKind: candidate.matchKind,
    evidence: safeFabricEvidence(candidate.evidence),
    reason: safeFabricText(candidate.reason, 'review reason unavailable', 300),
    createdAt: candidate.createdAt,
    reviewedAt: candidate.reviewedAt ?? null,
    reviewActor: candidate.reviewActor ? safeFabricText(candidate.reviewActor, 'cambium-admin', 80) : null,
    reviewReason: candidate.reviewReason ? safeFabricText(candidate.reviewReason, '[redacted]', 300) : null,
  };
}

function fabricStoredCandidateDto(candidate: Record<string, unknown>, tenantId: string): Record<string, unknown> {
  const rawEvidence = isRecord(candidate.evidence) ? candidate.evidence : {};
  return {
    tenantId,
    candidateId: safeFabricText(candidate.candidateId, 'unknown-candidate', 180),
    taskId: safeFabricText(candidate.taskId, 'unknown-task', 160),
    projectId: safeFabricText(candidate.projectId, 'unknown-project', 160),
    memberId: safeFabricText(candidate.memberId, 'unknown-member', 120),
    status: safeFabricText(candidate.status, 'review_pending', 80),
    reviewStatus: safeFabricText(candidate.reviewStatus ?? candidate.status, 'review_pending', 80),
    confidence: safeFabricText(candidate.confidence, 'low', 40),
    matchKind: safeFabricText(candidate.matchKind, 'inferred', 40),
    evidence: safeFabricEvidence(rawEvidence),
    reason: safeFabricText(candidate.reason, 'review reason unavailable', 300),
    createdAt: safeFabricText(candidate.createdAt, '', 80),
    reviewedAt: candidate.reviewedAt ? safeFabricText(candidate.reviewedAt, '', 80) : null,
    reviewActor: candidate.reviewActor ? safeFabricText(candidate.reviewActor, 'cambium-admin', 80) : null,
    reviewReason: candidate.reviewReason ? safeFabricText(candidate.reviewReason, '[redacted]', 300) : null,
  };
}

function fabricTaskDto(task: FabricLedgerTaskRecord): Record<string, unknown> {
  const detailKeys = ['projectName', 'questId', 'clientId', 'clientName', 'description', 'priority', 'taskType', 'assigneeMemberId', 'assignedBy', 'source'];
  const details: Record<string, string> = {};
  for (const key of detailKeys) {
    const value = task.payload[key];
    if (value === undefined || value === null) continue;
    const text = safeFabricText(value, '[redacted]', key === 'description' ? 500 : 180);
    if (text) details[key] = text;
  }
  return {
    tenantId: fabricTenantFromRecord(task),
    taskId: task.taskId,
    projectId: task.projectId,
    memberId: task.memberId,
    status: task.status,
    workMode: task.workMode ?? null,
    evidenceStrength: task.evidenceStrength,
    title: safeFabricText(task.title ?? task.taskId, task.taskId, 180),
    updatedAt: task.updatedAt,
    details,
  };
}

function candidateTaskProjection(candidate: FabricEvidenceCandidateRecord): Record<string, unknown> {
  return {
    candidateId: candidate.candidateId,
    tenantId: fabricTenantFromRecord(candidate),
    taskId: candidate.taskId,
    projectId: candidate.projectId,
    memberId: candidate.memberId,
    status: candidate.status,
    reviewStatus: candidate.status,
    confidence: candidate.confidence,
    matchKind: candidate.matchKind,
    evidence: safeFabricEvidence(candidate.evidence),
    reason: candidate.reason,
    createdAt: candidate.createdAt,
    reviewedAt: candidate.reviewedAt ?? null,
    reviewActor: candidate.reviewActor ?? null,
    reviewReason: candidate.reviewReason ?? null,
  };
}

async function upsertTaskCandidateProjection(
  fabricLedger: FabricLedgerStoreLike,
  task: FabricLedgerTaskRecord,
  candidate: FabricEvidenceCandidateRecord,
  updatedAt: string,
  evidenceStrength: FabricLedgerTaskRecord['evidenceStrength'] = task.evidenceStrength,
): Promise<void> {
  const existing = Array.isArray(task.payload.evidenceCandidates)
    ? task.payload.evidenceCandidates.filter((item) => isRecord(item) && item.candidateId !== candidate.candidateId)
    : [];
  await fabricLedger.upsertTask({
    ...task,
    tenantId: fabricTenantFromRecord(candidate),
    evidenceStrength,
    updatedAt,
    payload: {
      ...task.payload,
      evidenceCandidates: [...existing, candidateTaskProjection(candidate)],
    },
  });
}

async function createEvidenceCandidate(
  fabricLedger: FabricLedgerStoreLike,
  raw: Record<string, unknown>,
  tenantId: string,
  nowIso: () => string,
  createId: () => string,
): Promise<{ candidate: FabricEvidenceCandidateRecord; task: FabricLedgerTaskRecord; verified: boolean } | { error: string }> {
  const evidence = isRecord(raw.evidence) ? raw.evidence : raw;
  const taskId = optionalText(raw.taskId ?? evidence.taskId, 160);
  const projectId = optionalText(raw.projectId ?? evidence.projectId, 160);
  const tasks = (await fabricLedger.findTasks(tenantId)).filter((task) => sameFabricTenant(task, tenantId));
  const explicitTask = taskId
    ? tasks.find((task) => task.taskId === taskId && sameFabricTenant(task, tenantId) && (!projectId || task.projectId === projectId))
    : null;
  const task = explicitTask ?? tasks.find((candidate) => matchesInferredTask(candidate, evidence));
  if (!task) return { error: 'no matching Fabric task for evidence candidate' };

  const explicit = !!explicitTask;
  const verified = explicit && isStrongFabricEvidence(evidence);
  const createdAt = nowIso();
  const rawCandidateId = optionalText(raw.candidateId, 180);
  const candidateId = rawCandidateId ?? optionalText(createId(), 180)
    ?? fabricCleanId(`${task.taskId}:${evidenceType(evidence) || 'evidence'}:${String(evidence.value ?? evidence.url ?? createdAt)}`, 'cand');
  const candidate: FabricEvidenceCandidateRecord = {
    candidateId,
    tenantId,
    taskId: task.taskId,
    projectId: task.projectId,
    memberId: task.memberId,
    status: verified ? 'verified_evidence' : 'review_pending',
    confidence: verified ? 'high' : (explicit ? 'medium' : 'low'),
    matchKind: explicit ? 'explicit' : (evidenceType(evidence) === 'note' ? 'note_only' : 'inferred'),
    evidence,
    reason: explicit
      ? 'explicit taskId/projectId evidence candidate'
      : 'inferred match from repo/client/branch/title evidence',
    createdAt,
  };
  await fabricLedger.putEvidenceCandidate(candidate);
  await upsertTaskCandidateProjection(
    fabricLedger,
    task,
    candidate,
    createdAt,
    verified ? 'verified_evidence' : task.evidenceStrength,
  );
  return { candidate, task, verified };
}

function reviewDirective(candidate: FabricEvidenceCandidateRecord, outcome: 'accepted' | 'rejected', reviewedAt: string): Record<string, unknown> {
  const accepted = outcome === 'accepted';
  const eventId = `candidate-review:${candidate.candidateId}:${outcome}`;
  return {
    id: eventId,
    memberId: candidate.memberId,
    direction: 'downstream',
    delivered: false,
    enqueuedAt: reviewedAt,
    payload: {
      type: 'fabric_task_history_event',
      kind: 'fabric_task_history_event',
      schema: 'thoughtseed.fabric_task_history_event.v1',
      source: 'cambium',
      event: {
        eventId,
        timestamp: reviewedAt,
        actor: candidate.reviewActor ?? 'cambium-admin',
        source: 'cambium',
        type: accepted ? 'candidate_accepted' : 'candidate_rejected',
        correlationId: candidate.candidateId,
        payload: {
          tenantId: fabricTenantFromRecord(candidate),
          taskId: candidate.taskId,
          projectId: candidate.projectId,
          evidenceCandidateId: candidate.candidateId,
          evidence: safeFabricEvidence(candidate.evidence),
          evidenceStrength: accepted ? 'verified_evidence' : 'weak_evidence',
          status: accepted ? 'verified_evidence' : 'rejected_candidate',
          reason: candidate.reviewReason ?? candidate.reason,
        },
      },
    },
  };
}

function fallbackSocialRow() {
  return {
    id: 'social-gap',
    title: 'SOCIAL GAP',
    state: 'gap',
    detail: 'coordination rows rejected because they were not tenant handoff evidence',
    proof: 'tenant handoff evidence must come from explicit bridge, handoff, or founder gate sources',
    source: 'missing',
    scope: 'tenant-handoff-only',
    evidence: [],
    gap: 'coordination evidence rejected',
  };
}

function sanitizedEvidence(value: unknown): Array<Record<string, string>> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => item as Record<string, unknown>)
    .filter((item) => !SOCIAL_UNSAFE_RE.test(socialText(item)))
    .map((item) => ({
      label: socialString(item.label, 'row', 120),
      status: socialString(item.status, 'served', 80),
      detail: socialString(item.detail, '', 300),
    }));
}

function socialText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(socialText).join(' ');
  if (!value || typeof value !== 'object') return '';
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, item]) => [rawSocialKeyMarker(key), socialText(item)])
    .join(' ');
}

function rawSocialKeyMarker(key: string): string {
  return /^(rawInitData|initData|query_id|auth_date|token|user|userId|hash)$/i.test(key) ? `${key}=` : '';
}

function socialString(value: unknown, fallback: string, max = 300): string {
  const text = String(value ?? '').trim();
  if (!text || SOCIAL_UNSAFE_RE.test(text)) return fallback;
  return text.slice(0, max);
}

function socialRowText(row: Record<string, unknown>): string {
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  return [
    row.id,
    row.title,
    row.detail,
    row.proof,
    ...evidence.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const ev = item as Record<string, unknown>;
      return Object.values(ev);
    }),
  ].filter((item) => typeof item === 'string').join(' ');
}

function sanitizeQuestEnvelope(envelope: any): any {
  const social = envelope?.social;
  if (!social || typeof social !== 'object' || Array.isArray(social)) return envelope;
  const rows = Array.isArray(social.rows) ? social.rows : [];
  const safeRows = rows.filter((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    const item = row as Record<string, unknown>;
    const unsafeVisibleText = SOCIAL_UNSAFE_RE.test(socialRowText(item));
    const unsafeGapFallback = !item.detail && !item.proof && typeof item.gap === 'string' && SOCIAL_UNSAFE_RE.test(item.gap);
    return !unsafeVisibleText && !unsafeGapFallback;
  }).map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: socialString(item.id, 'coordination-row', 120),
      title: socialString(item.title ?? item.id, 'coordination', 160),
      state: item.state === 'ready' ? 'ready' : 'wait',
      detail: socialString(item.detail, 'coordination evidence missing', 300),
      proof: socialString(item.proof, 'proof missing from coordination row', 300),
      source: 'coordination-evidence@v1',
      scope: 'tenant-handoff-only',
      gap: item.gap && !SOCIAL_UNSAFE_RE.test(String(item.gap)) ? String(item.gap).slice(0, 300) : undefined,
      evidence: sanitizedEvidence(item.evidence),
    };
  });
  const metadataRejected = SOCIAL_UNSAFE_RE.test(socialText(social));
  const rowMetadataRejected = rows.some((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    const item = row as Record<string, unknown>;
    return [item.source, item.scope, item.gap].some((value) =>
      typeof value === 'string' && SOCIAL_UNSAFE_RE.test(value),
    );
  });
  if (safeRows.length === rows.length && !metadataRejected && !rowMetadataRejected) return envelope;
  return {
    ...envelope,
    social: {
      source: 'coordination-evidence@v1',
      scope: 'tenant-handoff-only',
      status: safeRows.some((row: any) => row.state === 'ready') ? 'ready' : 'gap',
      rows: safeRows.length ? safeRows : [fallbackSocialRow()],
      gap: 'coordination evidence sanitized',
    },
  };
}

function publicQuestBody(stored: string): string {
  try {
    return JSON.stringify(sanitizeQuestEnvelope(JSON.parse(stored)));
  } catch {
    return stored;
  }
}

function tenantOf(path: string, prefix: string): string | null {
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length).replace(/\/+$/, '');
  return VALID_TENANT.test(rest) ? rest : null;
}

export async function handle(req: SimpleRequest, deps: HandlerDeps): Promise<SimpleResponse> {
  const { method, path } = req;
  const routePath = fabricRoutePath(path);

  if (method === 'GET' && routePath === '/healthz') {
    return json(200, { ok: true, worker: 'cambium-quests' });
  }

  if (routePath.startsWith('/v1/context/')) {
    return handleContextRoute(req, deps.contextRoutes ?? {});
  }

  if (routePath === '/v1/providers' || routePath === '/v1/providers/health' || routePath.startsWith('/v1/providers/')) {
    return handleProviderBroker(req, deps);
  }

  if (routePath === '/v1/fabric/consume'
    || routePath === '/v1/fabric/evidence-candidates'
    || routePath === '/v1/fabric/evidence-candidates/review'
    || routePath === '/v1/fabric/review-items'
    || routePath.startsWith('/v1/fabric/tasks/')) {
    if (!deps.bridgeToken && !deps.assignmentToken) return json(503, { error: 'Fabric ledger auth token not configured' });
    const auth = req.headers['authorization'] ?? '';
    const isAdmin = !!deps.bridgeToken && auth === `Bearer ${deps.bridgeToken}`;
    const isScopedConsumer = method === 'POST' && routePath === '/v1/fabric/consume'
      && !!deps.assignmentToken && auth === `Bearer ${deps.assignmentToken}`;
    if (!isAdmin && !isScopedConsumer) return json(401, { error: 'admin token required' });
    if (!deps.fabricLedger) return json(503, { error: 'Fabric ledger not configured' });

    const bridgeStore = deps.bridgeStore ?? kvBridgeStore(deps.kv);
    const nowIso = () => (deps.now ? deps.now() : new Date().toISOString());

    if (method === 'POST' && routePath === '/v1/fabric/consume') {
      let body: any = {};
      try { body = req.body ? JSON.parse(req.body) : {}; } catch { return json(400, { error: 'body is not JSON' }); }
      const tenantId = optionalText(body.tenantId, 80) ?? 'cambium';
      if (!VALID_TENANT.test(tenantId)) return json(400, { error: 'bad tenantId' });
      return json(200, await consumeFabricBridgeMessages(bridgeStore, deps.fabricLedger, tenantId, nowIso));
    }

    if (method === 'POST' && routePath === '/v1/fabric/evidence-candidates') {
      let body: any;
      try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      if (!isRecord(body)) return json(400, { error: 'candidate body must be an object' });
      const tenantId = fabricTenantFromInput(body);
      if (typeof tenantId !== 'string') return json(400, tenantId);
      const result = await createEvidenceCandidate(
        deps.fabricLedger,
        body,
        tenantId,
        nowIso,
        () => (deps.uuid ? deps.uuid() : ''),
      );
      if ('error' in result) return json(404, { error: result.error });
      return json(200, { ok: true, candidate: fabricCandidateDto(result.candidate), verified: result.verified });
    }

    if (method === 'POST' && routePath === '/v1/fabric/evidence-candidates/review') {
      let body: any;
      try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      if (!isRecord(body)) return json(400, { error: 'review body must be an object' });
      const tenantId = fabricTenantFromInput(body);
      if (typeof tenantId !== 'string') return json(400, tenantId);
      const candidateId = optionalText(body.candidateId, 180);
      const outcome = body.outcome === 'accepted' || body.outcome === 'rejected' ? body.outcome : null;
      if (!candidateId || !outcome) return json(400, { error: 'review needs candidateId and outcome accepted|rejected' });
      const candidate = await deps.fabricLedger.getEvidenceCandidate(candidateId, tenantId);
      if (!candidate) return json(404, { error: 'candidate not found' });
      if (!sameFabricTenant(candidate, tenantId)) return json(404, { error: 'candidate not found' });
      if (candidate.status !== 'review_pending') {
        const previousOutcome = candidate.status === 'verified_evidence' ? 'accepted' : candidate.status === 'rejected_candidate' ? 'rejected' : null;
        if (previousOutcome === outcome) {
          return json(200, {
            ok: true,
            candidate: fabricCandidateDto(candidate),
            directiveId: `candidate-review:${candidate.candidateId}:${outcome}`,
            duplicate: true,
          });
        }
        return json(409, { error: 'candidate already reviewed', candidateId, status: candidate.status });
      }
      const reviewedAt = nowIso();
      const reviewed: FabricEvidenceCandidateRecord = {
        ...candidate,
        tenantId,
        status: outcome === 'accepted' ? 'verified_evidence' : 'rejected_candidate',
        reviewedAt,
        reviewActor: optionalText(body.actor, 80) ?? 'cambium-admin',
        reviewReason: optionalText(body.reason, 300) ?? null,
      };
      await deps.fabricLedger.updateEvidenceCandidate(reviewed);
      await deps.fabricLedger.putEvidenceReview({
        reviewId: fabricCleanId(`${candidateId}:${outcome}:${reviewedAt}`, 'review'),
        tenantId,
        candidateId,
        outcome,
        actor: reviewed.reviewActor ?? 'cambium-admin',
        reason: reviewed.reviewReason ?? null,
        reviewedAt,
      });

      const task = await deps.fabricLedger.getTask(candidate.taskId, tenantId);
      if (task && sameFabricTenant(task, tenantId)) {
        await upsertTaskCandidateProjection(
          deps.fabricLedger,
          task,
          reviewed,
          reviewedAt,
          outcome === 'accepted' ? 'verified_evidence' : task.evidenceStrength,
        );
      }
      const directive = reviewDirective(reviewed, outcome, reviewedAt);
      await bridgeStore.putDirective(reviewed.memberId, String(directive.id), directive);
      return json(200, { ok: true, candidate: fabricCandidateDto(reviewed), directiveId: directive.id });
    }

    if (method === 'GET' && routePath === '/v1/fabric/review-items') {
      const tenantId = fabricTenantFromPath(path);
      if (typeof tenantId !== 'string') return json(400, tenantId);
      const candidates = await deps.fabricLedger.listReviewItems(tenantId);
      const visible = candidates.filter((candidate) => candidate.status === 'review_pending' && sameFabricTenant(candidate, tenantId));
      return json(200, { ok: true, tenantId, count: visible.length, candidates: visible.map(fabricCandidateDto) });
    }

    if (method === 'GET' && routePath.startsWith('/v1/fabric/tasks/')) {
      const tenantId = fabricTenantFromPath(path);
      if (typeof tenantId !== 'string') return json(400, tenantId);
      const taskId = decodeURIComponent(routePath.slice('/v1/fabric/tasks/'.length).replace(/\/+$/, ''));
      const task = await deps.fabricLedger.getTask(taskId, tenantId);
      if (!task || !sameFabricTenant(task, tenantId)) return json(404, { error: 'task not found' });
      const candidates = Array.isArray(task.payload.evidenceCandidates)
        ? task.payload.evidenceCandidates.filter(isRecord)
        : [];
      return json(200, { ok: true, task: fabricTaskDto(task), candidates: candidates.map((candidate) => fabricStoredCandidateDto(candidate, tenantId)) });
    }

    return json(404, { error: `no Fabric route for ${method} ${path}` });
  }

  if (method === 'GET' && path.startsWith('/api/quests/')) {
    const tenant = tenantOf(path, '/api/quests/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    // M3 isolation suite is green — gate open to all valid tenants
    const stored = await deps.kv.get(ledgerKey(tenant));
    if (!stored) return json(404, { error: `no ledger pushed yet for "${tenant}" — run: quine write quests push --tenant ${tenant}` });
    return { status: 200, headers: { ...JSON_HEADERS }, body: publicQuestBody(stored) };
  }

  if (method === 'POST' && path.startsWith('/internal/ledger/')) {
    const tenant = tenantOf(path, '/internal/ledger/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    if (!deps.pushToken) return json(503, { error: 'push token not configured on the worker' });
    const auth = req.headers['authorization'] ?? '';
    if (auth !== `Bearer ${deps.pushToken}`) return json(401, { error: 'bad or missing bearer' });
    // M3 isolation suite is green — gate open to all valid tenants
    let envelope: any;
    try { envelope = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
    for (const field of ['schema', 'derivedAt', 'source', 'tenant', 'ledger']) {
      if (envelope[field] === undefined) return json(400, { error: `envelope missing "${field}"` });
    }
    if (envelope.tenant !== tenant) return json(400, { error: 'envelope tenant mismatch' });
    envelope = sanitizeQuestEnvelope(envelope);
    const body = JSON.stringify(envelope);
    await deps.kv.put(ledgerKey(tenant), body);
    return json(200, { ok: true, tenant, bytes: body.length, derivedAt: envelope.derivedAt });
  }

  // ── Founder ↔ Paperclip bridge ──────────────────────────────────────────
  // Hosted here so the curios.self mini app has the same gate/handoff surface. LISTEN:
  // Paperclip's upstream POSTs signed BridgeMessages to /ingest (stored in KV for
  // cofounders/Hermes to read at /inbox). WRITE: cofounders/Hermes enqueue
  // downstream directives at /directive; Paperclip's downstream polls /directives
  // and /ack's them (anti-redeliver; seeds the G1 reconnect handshake). The admin
  // BRIDGE_TOKEN or scoped member token gates each op; upstream messages must also
  // carry a per-message HMAC in protocol.signature so payload tampering fails shut.
  if (path.startsWith('/v1/bridge/')) {
    if (!deps.bridgeToken && !deps.assignmentToken) return json(503, { error: 'bridge not configured on the worker' });
    // Resolve the principal: the admin BRIDGE_TOKEN (cofounders/Hermes, full access)
    // a scoped Hermes assignment token, or a per-member token (scoped to one member,
    // active + unexpired). Member tokens are issued by the handoff invite flow and
    // stored as SHA-256 in a memtok: index.
    const _auth = req.headers['authorization'] ?? '';
    const _tok = _auth.startsWith('Bearer ') ? _auth.slice(7) : '';
    let principal: { admin: boolean; assignmentOnly?: boolean; memberId?: string; tenantId?: string } | null = null;
    if (_tok && deps.bridgeToken && _tok === deps.bridgeToken) {
      principal = { admin: true };
    } else if (_tok && deps.assignmentToken && _tok === deps.assignmentToken) {
      principal = { admin: false, assignmentOnly: true };
    } else if (_tok) {
      const tokenHash = await sha256hex(_tok);
      const mid = await deps.kv.get(tokenIndexKey(tokenHash));
      if (mid) {
        const raw = await deps.kv.get(memberKey(mid));
        if (raw) {
          const m = JSON.parse(raw);
          const nowMs = deps.nowMs ? deps.nowMs() : Date.now();
          if (m.status === 'active' && m.tokenHash === tokenHash && m.tokenExp && m.tokenExp > nowMs) {
            principal = { admin: false, memberId: mid, tenantId: m.tenantId };
          }
        }
      }
    }
    if (!principal) return json(401, { error: 'bad or missing bridge credential' });
    const mayAct = (mid: string) => principal!.admin || principal!.memberId === mid;
    const nowIso = () => (deps.now ? deps.now() : new Date().toISOString());
    const bridgeStore = deps.bridgeStore ?? kvBridgeStore(deps.kv);

    if (method === 'POST' && path === '/v1/bridge/ingest') {
      let msg: any;
      try { msg = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      for (const f of ['id', 'timestamp', 'direction', 'tenantId', 'memberId', 'payload']) {
        if (msg[f] === undefined) return json(400, { error: `message missing "${f}"` });
      }
      if (msg.direction !== 'upstream') return json(400, { error: 'ingest expects direction=upstream' });
      if (!VALID_TENANT.test(String(msg.tenantId))) return json(400, { error: 'bad tenantId' });
      if (!mayAct(String(msg.memberId))) return json(403, { error: 'token not scoped to this member' });
      if (!principal.admin && principal.tenantId !== String(msg.tenantId)) return json(403, { error: 'token not scoped to this tenant' });
      if (!msg.signature || msg.signature !== await bridgeSignature(_tok, msg)) return json(401, { error: 'bad or missing bridge signature' });
      await bridgeStore.putUpstream(String(msg.tenantId), String(msg.id), { ...msg, receivedAt: nowIso() });
      return json(200, { ok: true, id: msg.id, stored: true });
    }

    if (method === 'GET' && path.startsWith('/v1/bridge/inbox/')) {
      if (!principal.admin) return json(403, { error: 'inbox is cofounder-only' });
      const tenant = tenantOf(path, '/v1/bridge/inbox/');
      if (!tenant) return json(400, { error: 'bad tenant' });
      const messages = await bridgeStore.listUpstream(tenant, 100);
      return json(200, { tenant, count: messages.length, messages });
    }

    if (method === 'POST' && path === '/v1/bridge/assign-task') {
      if (!principal.admin && !principal.assignmentOnly) return json(403, { error: 'only cofounders/Hermes may enqueue task assignments' });
      let msg: any;
      try { msg = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      return queueProjectTaskAssignment(bridgeStore, msg, nowIso, deps.uuid);
    }

    if (method === 'POST' && path === '/v1/bridge/topic-assignment') {
      if (!principal.admin && !principal.assignmentOnly) return json(403, { error: 'only cofounders/Hermes may enqueue topic assignments' });
      let body: any;
      try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      if (!isRecord(body)) return json(400, { error: 'topic signal body must be an object' });
      const msg = topicQuestAssignment(body, () => (deps.uuid ? deps.uuid() : `topic_${nowIso()}`));
      if ('error' in msg) return json(400, msg);
      const response = await queueProjectTaskAssignment(bridgeStore, msg, nowIso, deps.uuid);
      if (response.status !== 200) return response;
      const parsed = JSON.parse(response.body);
      const topicKey = String(body.topicKey ?? body.topic);
      const route = TOPIC_QUEST_ROUTES[topicKey as keyof typeof TOPIC_QUEST_ROUTES];
      return json(200, {
        ...parsed,
        topic: { topicKey, threadId: route.threadId, questId: route.questId },
      });
    }

    if (method === 'POST' && path === '/v1/bridge/github-command') {
      if (!principal.admin) return json(403, { error: 'only cofounders/Hermes may execute GitHub commands' });
      if (!deps.githubCommand) return json(503, { error: 'GitHub command executor not configured' });
      let body: any;
      try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const command = validateGithubCommand(body, deps.githubAllowedRepos);
      if ('error' in command) return json(400, command);
      let result;
      try {
        result = await deps.githubCommand(command);
      } catch {
        return json(502, {
          ok: false,
          commandId: command.commandId,
          repo: command.repo,
          issueNumber: command.issueNumber,
          dryRun: command.dryRun,
          error: 'GitHub command executor unreachable',
        });
      }
      if (!result.ok) return json(result.status && result.status >= 400 ? result.status : 400, result);
      return json(200, result);
    }

    if (method === 'POST' && path === '/v1/bridge/directive') {
      if (!principal.admin) return json(403, { error: 'only cofounders/Hermes may enqueue directives' });
      let msg: any;
      try { msg = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const memberId = msg.memberId ?? msg.payload?.target?.memberId;
      if (!memberId || !VALID_TENANT.test(String(memberId))) return json(400, { error: 'directive needs a valid memberId (top-level or payload.target.memberId)' });
      if (!msg.payload) return json(400, { error: 'directive needs a payload' });
      const id = msg.id ?? (deps.uuid ? deps.uuid() : `b_${memberId}_${nowIso()}`);
      const stored = { ...msg, id, memberId, direction: 'downstream', delivered: false, enqueuedAt: nowIso() };
      await bridgeStore.putDirective(String(memberId), String(id), stored);
      return json(200, { ok: true, id, memberId, queued: true });
    }

    if (method === 'GET' && path.startsWith('/v1/bridge/directives/')) {
      const member = path.slice('/v1/bridge/directives/'.length).replace(/\/+$/, '');
      if (!VALID_TENANT.test(member)) return json(400, { error: 'bad member' });
      if (!mayAct(member)) return json(403, { error: 'token not scoped to this member' });
      const pending = await bridgeStore.listPendingDirectives(member, 100);
      return json(200, { member, count: pending.directives.length, skipped: pending.skipped, directives: pending.directives });
    }

    if (method === 'POST' && path === '/v1/bridge/ack') {
      let body: any;
      try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const member = body.memberId; const ids = Array.isArray(body.ids) ? body.ids : [];
      if (!member || !ids.length) return json(400, { error: 'ack needs memberId + ids[]' });
      if (!mayAct(member)) return json(403, { error: 'token not scoped to this member' });
      let acked = 0;
      for (const id of ids) {
        if (await bridgeStore.markDirectiveDelivered(String(member), String(id), nowIso())) acked++;
      }
      return json(200, { ok: true, acked });
    }

    return json(404, { error: `no bridge route for ${method} ${path}` });
  }

  // ── Secure member handoff: invites → per-member bridge tokens → rotation ──
  // Admin ops (add/list/invite/revoke) need the BRIDGE_TOKEN; redeem/rotate are
  // public (gated by the signed invite / the member's current token). The issued
  // per-member token is what the member's Plexus uses for the scoped bridge auth.
  if (path.startsWith('/v1/handoff/')) {
    if (!deps.handoffSecret || !deps.bridgeToken) return json(503, { error: 'handoff not configured on the worker' });
    const nowMs = deps.nowMs ? deps.nowMs() : Date.now();
    const nowIso = () => (deps.now ? deps.now() : new Date().toISOString());
    const isAdmin = (req.headers['authorization'] ?? '') === `Bearer ${deps.bridgeToken}`;
    const readJson = (): any => { try { return JSON.parse(req.body ?? ''); } catch { return undefined; } };

    if (method === 'POST' && path === '/v1/handoff/members') {
      if (!isAdmin) return json(401, { error: 'admin token required' });
      const b = readJson(); if (!b) return json(400, { error: 'body is not JSON' });
      const memberId = String(b.memberId ?? '').toLowerCase(), email = String(b.email ?? '').toLowerCase();
      const tenantId = String(b.tenantId ?? memberId).toLowerCase();
      if (!VALID_TENANT.test(memberId)) return json(400, { error: 'memberId must be lowercase kebab' });
      if (!VALID_TENANT.test(tenantId)) return json(400, { error: 'tenantId must be lowercase kebab' });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: 'a valid email is required' });
      const existing = await deps.kv.get(memberKey(memberId));
      const prev = existing ? JSON.parse(existing) : null;
      const member = { ...prev, memberId, tenantId, email, status: prev ? prev.status : 'invited',
        addedAt: prev ? prev.addedAt : nowIso(), updatedAt: nowIso() };
      await deps.kv.put(memberKey(memberId), JSON.stringify(member));
      return json(200, { ok: true, member: { memberId, tenantId, email, status: member.status } });
    }

    if (method === 'GET' && path === '/v1/handoff/members') {
      if (!isAdmin) return json(401, { error: 'admin token required' });
      const keys = await deps.kv.list('member:');
      const members: any[] = [];
      for (const k of keys) { const v = await deps.kv.get(k); if (v) { const m = JSON.parse(v);
        members.push({ memberId: m.memberId, tenantId: m.tenantId ?? m.memberId, email: m.email, status: m.status, tokenExpiresAt: m.tokenExp ? new Date(m.tokenExp).toISOString() : null }); } }
      return json(200, { count: members.length, members });
    }

    if (method === 'POST' && path === '/v1/handoff/invite') {
      if (!isAdmin) return json(401, { error: 'admin token required' });
      const b = readJson(); if (!b) return json(400, { error: 'body is not JSON' });
      const memberId = String(b.memberId ?? '').toLowerCase();
      const raw = await deps.kv.get(memberKey(memberId));
      if (!raw) return json(404, { error: 'member not in allowlist — POST /v1/handoff/members first' });
      const member = JSON.parse(raw);
      const jti = deps.uuid ? deps.uuid() : randomTokenHex().slice(0, 16);
      const exp = nowMs + INVITE_TTL_MS;
      const invite = await signInvite(deps.handoffSecret, { memberId, tenantId: member.tenantId ?? memberId, email: member.email, jti, exp });
      await deps.kv.put(inviteKey(jti), JSON.stringify({ jti, memberId, email: member.email, exp, used: false, createdAt: nowIso() }));
      const base = String(b.linkBase ?? deps.publicBaseUrl ?? 'https://cambium.example.com').replace(/\/+$/, '');
      return json(200, { ok: true, memberId, email: member.email, expiresAt: new Date(exp).toISOString(), invite, link: `${base}/join?t=${invite}` });
    }

    if (method === 'POST' && path === '/v1/handoff/revoke') {
      if (!isAdmin) return json(401, { error: 'admin token required' });
      const b = readJson(); if (!b) return json(400, { error: 'body is not JSON' });
      const memberId = String(b.memberId ?? '').toLowerCase();
      const raw = await deps.kv.get(memberKey(memberId));
      if (!raw) return json(404, { error: 'member not found' });
      const m = JSON.parse(raw);
      if (m.tokenHash) await deps.kv.put(tokenIndexKey(m.tokenHash), ''); // tombstone the token index
      m.status = 'revoked'; delete m.tokenHash; delete m.tokenExp; m.updatedAt = nowIso();
      await deps.kv.put(memberKey(memberId), JSON.stringify(m));
      return json(200, { ok: true, memberId, status: 'revoked' });
    }

    if (method === 'POST' && path === '/v1/handoff/redeem') {
      const b = readJson(); if (!b) return json(400, { error: 'body is not JSON' });
      const claims = await verifyInvite(deps.handoffSecret, String(b.invite ?? ''));
      if (!claims) return json(401, { error: 'invalid invite signature' });
      if (!claims.exp || claims.exp < nowMs) return json(401, { error: 'invite expired' });
      const invRaw = await deps.kv.get(inviteKey(claims.jti));
      if (!invRaw) return json(401, { error: 'unknown invite' });
      const inv = JSON.parse(invRaw);
      if (inv.used) return json(409, { error: 'invite already redeemed' });
      const raw = await deps.kv.get(memberKey(claims.memberId));
      if (!raw) return json(404, { error: 'member not found' });
      const m = JSON.parse(raw);
      if (m.status === 'revoked') return json(403, { error: 'member revoked' });
      if (claims.tenantId && m.tenantId && claims.tenantId !== m.tenantId) return json(403, { error: 'invite tenant mismatch' });
      const token = randomTokenHex(), tokenHash = await sha256hex(token), tokenExp = nowMs + TOKEN_TTL_MS;
      m.status = 'active'; m.tokenHash = tokenHash; m.tokenExp = tokenExp; m.redeemedAt = nowIso(); m.updatedAt = nowIso();
      await deps.kv.put(memberKey(claims.memberId), JSON.stringify(m));
      await deps.kv.put(tokenIndexKey(tokenHash), claims.memberId);
      inv.used = true; inv.usedAt = nowIso();
      await deps.kv.put(inviteKey(claims.jti), JSON.stringify(inv));
      return json(200, { ok: true, memberId: claims.memberId, tenantId: m.tenantId ?? claims.memberId, bridgeApiUrl: 'https://curious.thoughtseed.space', token, expiresAt: new Date(tokenExp).toISOString() });
    }

    if (method === 'POST' && path === '/v1/handoff/rotate') {
      const b = readJson(); if (!b) return json(400, { error: 'body is not JSON' });
      const cur = String(b.token ?? '');
      const memberId = cur ? await deps.kv.get(tokenIndexKey(await sha256hex(cur))) : null;
      if (!memberId) return json(401, { error: 'unknown or expired token' });
      const raw = await deps.kv.get(memberKey(memberId));
      if (!raw) return json(401, { error: 'member not found' });
      const m = JSON.parse(raw);
      if (m.status !== 'active') return json(403, { error: 'member not active' });
      if (m.tokenHash) await deps.kv.put(tokenIndexKey(m.tokenHash), '');
      const token = randomTokenHex(), tokenHash = await sha256hex(token), tokenExp = nowMs + TOKEN_TTL_MS;
      m.tokenHash = tokenHash; m.tokenExp = tokenExp; m.rotatedAt = nowIso(); m.updatedAt = nowIso();
      await deps.kv.put(memberKey(memberId), JSON.stringify(m));
      await deps.kv.put(tokenIndexKey(tokenHash), memberId);
      return json(200, { ok: true, memberId, token, expiresAt: new Date(tokenExp).toISOString() });
    }

    return json(404, { error: `no handoff route for ${method} ${path}` });
  }

  if (method === 'POST' && path.startsWith('/api/gate/')) {
    const tenant = tenantOf(path, '/api/gate/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    // M3 isolation suite is green — gate open to all valid tenants
    if (!deps.gate) return json(503, { error: 'gate not configured' });
    let body: any;
    try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
    if (!['approve', 'reroll', 'promote-skill', 'queue-side-quest'].includes(body.kind) || !body.subject) {
      return json(400, { error: 'need kind approve|reroll|promote-skill|queue-side-quest and subject' });
    }
    const verdict = await validateInitData(String(body.initData ?? ''), deps.gate);
    if (!verdict.ok) return json(401, { error: verdict.reason });
    const kind = body.kind as GateActionKind;
    const subject = shortText(body.subject, 'unknown subject', 160);
    const idempotencyKey = shortText(body.idempotencyKey, `${kind}:${subject}`, 240);
    const existingKeys = await deps.kv.list(`gate:${tenant}:`);
    for (const key of existingKeys) {
      const stored = await deps.kv.get(key);
      if (!stored) continue;
      const existing = JSON.parse(stored);
      if (existing.status === 'queued' && existing.idempotencyKey === idempotencyKey) {
        return json(200, {
          queued: existing.id,
          duplicate: true,
          kind: existing.kind,
          subject: existing.subject,
          idempotencyKey,
          consequence: existing.consequence,
          reversibility: existing.reversibility,
        });
      }
    }
    const id = (deps.uuid ?? (() => crypto.randomUUID()))();
    const ts = deps.now ? deps.now() : new Date().toISOString();
    const action = {
      id, ts, founderId: verdict.userId,
      kind,
      subject,
      evidence: shortText(body.evidence, 'evidence not provided by gate item'),
      consequence: shortText(body.consequence, kind === 'approve'
        ? `approve ${subject}`
        : kind === 'promote-skill'
          ? `queue founder review to promote ${subject} to production`
          : kind === 'queue-side-quest'
            ? `queue side quest ${subject} for operator review`
          : `reroll ${subject}`),
      reversibility: shortText(body.reversibility, kind === 'approve'
        ? 'queued approval can be superseded until consumed'
        : kind === 'promote-skill'
          ? 'queued promotion can be superseded until consumed; registry remains unchanged until operator applies it'
          : kind === 'queue-side-quest'
            ? 'queued side quest can be superseded until consumed; side quest ledger remains unchanged until operator applies it'
          : 'reroll asks for revision before execution'),
      idempotencyKey,
      note: body.note ? String(body.note).slice(0, 300) : null,
      status: 'queued',
    };
    await deps.kv.put(`gate:${tenant}:${id}`, JSON.stringify(action));
    return json(200, {
      queued: id,
      duplicate: false,
      kind: action.kind,
      subject: action.subject,
      idempotencyKey,
      consequence: action.consequence,
      reversibility: action.reversibility,
    });
  }

  if (method === 'GET' && path.startsWith('/internal/gate/') && !path.endsWith('/consume')) {
    const tenant = tenantOf(path, '/internal/gate/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    if (!deps.pushToken) return json(503, { error: 'push token not configured on the worker' });
    if ((req.headers['authorization'] ?? '') !== `Bearer ${deps.pushToken}`) return json(401, { error: 'bad or missing bearer' });
    const keys = await deps.kv.list(`gate:${tenant}:`);
    const actions: unknown[] = [];
    for (const key of keys) {
      const stored = await deps.kv.get(key);
      if (!stored) continue;
      const action = JSON.parse(stored);
      if (action.status === 'queued') actions.push(action);
    }
    return json(200, { tenant, actions });
  }

  if (method === 'POST' && path.startsWith('/internal/gate/') && path.endsWith('/consume')) {
    const tenant = tenantOf(path.slice(0, -'/consume'.length), '/internal/gate/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    if (!deps.pushToken) return json(503, { error: 'push token not configured on the worker' });
    if ((req.headers['authorization'] ?? '') !== `Bearer ${deps.pushToken}`) return json(401, { error: 'bad or missing bearer' });
    let body: any;
    try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
    const key = `gate:${tenant}:${body.id}`;
    const stored = await deps.kv.get(key);
    if (!stored) return json(404, { error: 'unknown action' });
    const action = { ...JSON.parse(stored), status: 'consumed', result: body.result ?? null, consumedAt: new Date().toISOString() };
    await deps.kv.put(key, JSON.stringify(action));
    return json(200, { consumed: body.id });
  }

  if (method === 'GET' && (path === '/' || path === '/index.html')) {
    return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, body: PAGE };
  }

  return json(404, { error: 'not found' });
}

function providerAuth(req: SimpleRequest, token: string): boolean {
  const auth = req.headers['authorization'] ?? '';
  return auth === `Bearer ${token}`;
}

function configuredProviders(cfg: ProviderBrokerConfig): Array<Record<string, unknown>> {
  return Object.entries(cfg.providers)
    .filter(([, provider]) => provider?.apiKey && provider.baseUrl)
    .map(([id, provider]) => ({
      id,
      baseUrl: provider!.baseUrl.replace(/\/+$/, ''),
      defaultModel: provider!.defaultModel ?? null,
      models: provider!.models ?? [],
    }));
}

async function handleProviderBroker(req: SimpleRequest, deps: HandlerDeps): Promise<SimpleResponse> {
  const cfg = deps.providerBroker;
  if (!cfg?.token) return json(503, { error: 'provider broker not configured on the worker' });
  if (!providerAuth(req, cfg.token)) return json(401, { error: 'bad or missing provider broker credential' });

  if (req.method === 'GET' && (req.path === '/v1/providers' || req.path === '/v1/providers/health')) {
    const providers = configuredProviders(cfg);
    return json(200, {
      ok: true,
      broker: 'cambium-provider-broker',
      providers,
      count: providers.length,
    });
  }

  const match = req.path.match(/^\/v1\/providers\/([a-z0-9-]+)(?:\/(.*))?$/);
  if (!match) return json(404, { error: `no provider route for ${req.method} ${req.path}` });
  const providerId = match[1];
  const provider = cfg.providers[providerId];
  if (!provider?.apiKey || !provider.baseUrl) return json(404, { error: `unknown or unconfigured provider "${providerId}"` });

  const upstreamPath = match[2] || 'models';
  if (!/^[A-Za-z0-9_./:-]+$/.test(upstreamPath) || upstreamPath.includes('..')) {
    return json(400, { error: 'bad upstream provider path' });
  }
  if (!['GET', 'POST'].includes(req.method)) return json(405, { error: 'provider broker supports GET and POST only' });

  const baseUrl = provider.baseUrl.replace(/\/+$/, '');
  const upstreamUrl = `${baseUrl}/${upstreamPath.replace(/^\/+/, '')}`;
  const f = cfg.fetch ?? fetch;
  const upstream = await f(upstreamUrl, {
    method: req.method,
    headers: {
      authorization: `Bearer ${provider.apiKey}`,
      ...(req.method === 'POST' ? { 'content-type': req.headers['content-type'] ?? 'application/json' } : {}),
    },
    body: req.method === 'POST' ? req.body : undefined,
  });
  const contentType = upstream.headers.get('content-type') ?? 'application/json; charset=utf-8';
  const body = await upstream.text();
  return {
    status: upstream.status,
    headers: { 'content-type': contentType, 'cache-control': 'no-store' },
    body,
  };
}
