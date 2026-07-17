// cambium-quests · the serving store for the quest ledger (Thalia wing, W1).
// Pure handler — no Workers runtime imports — so node:test covers it like every
// other module in this repo. The thin fetch glue lives in index.ts.
//
// Doctrine carried over the wire: the API serves DERIVED ledgers only, inside an
// envelope {schema, derivedAt, source, tenant} so the UI can show real freshness
// (no fake liveness). Tenant gate: cambium only until M3's isolation suite is
// green (the quest log's own arc VII — the feature gates itself).

import { PAGE } from './page.ts';
import { confirmSignedActionRequestRecord, consumeActionRequestRecord, createActionRequestRecord, listActionRequestRecords, resolveActionRequestRecord } from './action-requests.ts';
import { handleContextRoute } from './context-routes.ts';
import type { ContextRouteDeps } from './context-routes.ts';
import type { GithubCommandExecutor, GithubCommandResult } from './github-command.ts';
import { isGithubWriteCommand, validateGithubCommand } from './github-command.ts';
import { THOUGHTSEED_TELEGRAM_CHAT_ID, TOPIC_QUEST_ROUTES } from './telegram-routing.ts';

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

export interface BridgeRoleTaskClaimRecord {
  eventId: string;
  roleId: string;
  memberId: string;
  projectId: string;
  bindingVersion: string;
  intentHash: string;
  claimedAt: string;
}

export interface BridgeStoreLike {
  putUpstream(tenantId: string, id: string, message: Record<string, unknown>): Promise<void>;
  listUpstream(tenantId: string, limit: number): Promise<any[]>;
  getDirective(memberId: string, id: string): Promise<Record<string, unknown> | null>;
  putDirective(memberId: string, id: string, directive: Record<string, unknown>): Promise<void>;
  putDirectiveIfAbsent(memberId: string, id: string, directive: Record<string, unknown>): Promise<void>;
  listPendingDirectives(memberId: string, limit: number): Promise<{ directives: any[]; skipped: number }>;
  markDirectiveDelivered(memberId: string, id: string, deliveredAt: string): Promise<boolean>;
  getAssignment(memberId: string, eventId: string): Promise<BridgeAssignmentRecord | null>;
  putAssignment(record: BridgeAssignmentRecord): Promise<void>;
  getRoleTaskClaim(eventId: string): Promise<BridgeRoleTaskClaimRecord | null>;
  putRoleTaskClaim(record: BridgeRoleTaskClaimRecord): Promise<void>;
}

export type BridgeExecutionOutcomeStatus = 'executed' | 'failed' | 'retryable';

export interface BridgeExecutionAttestation {
  schema: 'thoughtseed.hermes.execution_attestation.v1';
  id: string;
  executionId: string;
  directiveId: string;
  idempotencyKey: string;
  runnerId: string;
  hostIdentity: string;
  command: 'canary.record' | 'service_agreement.draft.render';
  status: BridgeExecutionOutcomeStatus;
  exitCode: 0 | 1 | null;
  inputDigest: string;
  outputDigest?: string;
  businessReceipt?: BridgeBusinessArtifactReceipt;
  errorCode?: string;
  startedAt: string;
  finishedAt: string;
}

export interface BridgeBusinessArtifactReceipt {
  schema: 'thoughtseed.business_artifact_receipt.v1';
  artifactId: string;
  businessTaskId: string;
  gsdTaskId: string;
  executionId: string;
  directiveId: string;
  memberId: string;
  digest: string;
  byteLength: number;
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  r2Key: string;
  contentPolicyId: string;
  contentPolicyDigest: string;
  rendererPolicyId: string;
  rendererPolicyDigest: string;
  approvalState: 'awaiting_human_approval';
  synthetic: true;
  externalAction: 'none';
}

export interface BridgeExecutionClaimInput {
  memberId: string;
  directiveId: string;
  idempotencyKey: string;
  inputDigest: string;
  executionId: string;
  runnerId: string;
  hostIdentity: string;
  claimId: string;
  fencingToken: string;
  claimedAt: string;
  leaseExpiresAt: string;
}

export type BridgeExecutionClaimResult =
  | {
    status: 'claimed';
    claimId: string;
    fencingToken: string;
    attempt: number;
    leaseExpiresAt: string;
    runnerId: string;
    hostIdentity: string;
  }
  | {
    status: 'busy';
    retryAfterMs: number;
  }
  | {
    status: 'terminal';
    claimId: string;
    fencingToken: string;
    attempt: number;
    runnerId: string;
    hostIdentity: string;
    outcome: {
      status: 'executed' | 'failed';
      attestation: BridgeExecutionAttestation;
    };
  }
  | {
    status: 'conflict';
    reason: 'execution_id_reused' | 'execution_replay_mismatch';
  };

export interface BridgeExecutionOutcomeInput {
  memberId: string;
  directiveId: string;
  idempotencyKey: string;
  executionId: string;
  runnerId: string;
  hostIdentity: string;
  claimId: string;
  fencingToken: string;
  attempt: number;
  status: BridgeExecutionOutcomeStatus;
  attestation: BridgeExecutionAttestation;
  attestationDigest: string;
  recordedAt: string;
}

export type BridgeExecutionOutcomeResult =
  | { status: 'recorded'; terminal: boolean; duplicate: boolean }
  | { status: 'conflict'; reason: 'claim_not_found' | 'claim_mismatch' | 'fencing_conflict' | 'outcome_conflict' };

export interface BridgeExecutionContractIdentity {
  idempotencyKey: string;
  inputDigest: string;
  executionId: string;
}

export interface BridgeExecutionStoreLike {
  claimExecution(input: BridgeExecutionClaimInput): Promise<BridgeExecutionClaimResult>;
  recordExecutionOutcome(input: BridgeExecutionOutcomeInput): Promise<BridgeExecutionOutcomeResult>;
  hasTerminalExecution(memberId: string, directiveId: string, identity: BridgeExecutionContractIdentity): Promise<boolean>;
  acknowledgeTerminalDirective(memberId: string, directiveId: string, identity: BridgeExecutionContractIdentity, acknowledgedAt: string): Promise<boolean>;
  verifyActiveClaim(input: {
    memberId: string;
    directiveId: string;
    idempotencyKey: string;
    executionId: string;
    runnerId: string;
    hostIdentity: string;
    claimId: string;
    fencingToken: string;
    attempt: number;
    observedAt: string;
  }): Promise<boolean>;
}

export type BridgeBusinessTaskStatus =
  | 'queued'
  | 'leased'
  | 'rendering'
  | 'artifact_stored'
  | 'retrying'
  | 'awaiting_human_approval'
  | 'failed';

export interface BridgeBusinessTaskRecord {
  businessTaskId: string;
  gsdTaskId: string;
  idempotencyKey: string;
  intentDigest: string;
  directiveId: string;
  directiveSchema: 'thoughtseed.hermes.native_execution.v1';
  memberId: string;
  tenantId: 'thoughtseed';
  projectId: string;
  clientId: string;
  workflowId: 'thoughtseed.legal.service-agreement.draft.v1';
  status: BridgeBusinessTaskStatus;
  request: Record<string, unknown>;
  approvalScope: 'internal_canary_draft_only';
  approvalObservationId: string;
  approvalObservedAt: string;
  synthetic: true;
  externalAction: 'none';
  executionId?: string;
  receipt?: BridgeBusinessArtifactReceipt;
  createdAt: string;
  updatedAt: string;
  terminalAt?: string;
}

export interface BridgeBusinessArtifactUpload {
  task: BridgeBusinessTaskRecord;
  executionId: string;
  artifactId: string;
  digest: string;
  byteLength: number;
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  fileName: string;
  bytes: Uint8Array;
  contentPolicyId: string;
  contentPolicyDigest: string;
  rendererPolicyId: string;
  rendererPolicyDigest: string;
  recordedAt: string;
}

export interface BridgeBusinessTaskStoreLike {
  createTask(record: BridgeBusinessTaskRecord): Promise<'created' | 'duplicate' | 'conflict'>;
  getTask(businessTaskId: string): Promise<BridgeBusinessTaskRecord | null>;
  markLeased(businessTaskId: string, executionId: string, recordedAt: string): Promise<void>;
  putArtifact(input: BridgeBusinessArtifactUpload): Promise<{ stored: boolean; duplicate: boolean; receipt: BridgeBusinessArtifactReceipt }>;
  markOutcome(businessTaskId: string, status: 'retrying' | 'awaiting_human_approval' | 'failed', recordedAt: string): Promise<void>;
  getArtifact(businessTaskId: string): Promise<{ receipt: BridgeBusinessArtifactReceipt; base64: string } | null>;
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
  roleTaskBindingsJson?: string; // Server-owned Hermes role -> member/project/task binding registry
  bridgeStore?: BridgeStoreLike; // Optional non-KV bridge queue store (D1 in production)
  executionStore?: BridgeExecutionStoreLike; // D1-only claim/outcome authority; never falls back to KV
  businessStore?: BridgeBusinessTaskStoreLike; // D1 task metadata plus immutable R2 artifact bytes
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

type GateActionKind = 'approve' | 'reroll' | 'promote-skill' | 'queue-side-quest' | 'confirm-action-request';

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
async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
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
    async getDirective(memberId, id) {
      const raw = await kv.get(`bridge:dir:${memberId}:${id}`);
      if (!raw) return null;
      try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
    },
    async putDirective(memberId, id, directive) {
      await kv.put(`bridge:dir:${memberId}:${id}`, JSON.stringify(directive));
    },
    async putDirectiveIfAbsent(memberId, id, directive) {
      const key = `bridge:dir:${memberId}:${id}`;
      // Workers KV cannot provide atomic insert-if-absent. Keep its fallback
      // best-effort and never deliberately overwrite an existing directive;
      // production uses D1's atomic INSERT OR IGNORE implementation.
      if (await kv.get(key)) return;
      await kv.put(key, JSON.stringify(directive));
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
    async getRoleTaskClaim(eventId) {
      const raw = await kv.get(`bridge:role-task-claim:${eventId}`);
      if (!raw) return null;
      try { return JSON.parse(raw) as BridgeRoleTaskClaimRecord; } catch { return null; }
    },
    async putRoleTaskClaim(record) {
      const key = `bridge:role-task-claim:${record.eventId}`;
      if (await kv.get(key)) return;
      await kv.put(key, JSON.stringify(record));
    },
  };
}

// ── GitHub command bridge: replay protection + write rate limiting ──────────────
// KvLike has no native expirationTtl, so both records embed their own expiry/window and
// are validated against an injectable clock on read (same pattern as member-token tokenExp).
// NOTE: KV is eventually consistent with no atomic increment/CAS, so — exactly like the
// /api/gate idempotency check — these are best-effort under the sequential single-admin
// caller model (Hermes behind BRIDGE_TOKEN). Concurrent same-key requests could race the
// read-modify-write; tightening that further would require Durable Objects.
// `actorId` is caller-supplied free text, so it is reduced to a safe KV-key segment.
const kvKeySegment = (value: string): string => value.toLowerCase().replace(/[^a-z0-9_.-]/g, '_').slice(0, 160);
const GH_CMD_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;   // a key fences duplicate writes for 24h
const GH_WRITE_RATE_LIMIT = 10;                          // writes per actor+repo per window
const GH_WRITE_RATE_WINDOW_MS = 60 * 1000;               // rolling 1-minute window
const EXECUTION_LEASE_MS = 60 * 1000;
const EXECUTION_ID = /^exec_[A-Za-z0-9._:-]{1,180}$/;
const EXECUTION_SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const EXECUTION_OWNER = /^[A-Za-z0-9._:-]{1,128}$/;
const ATTESTATION_ID = /^att_[A-Za-z0-9._:-]{1,180}$/;
const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/;
const EXECUTION_ERROR_CODE = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const EXECUTION_NONCE = /^[A-Za-z0-9._:-]{1,128}$/;
const BUSINESS_SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const BUSINESS_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const;
const BUSINESS_EXTERNAL_ACTION_RE = /\b(?:email|send|deliver|publish|signature|signing|e-?sign|whatsapp|telegram)\b/i;
const BUSINESS_CONTENT_POLICY_ID = 'anthropic-skills:thoughtseed-contract-generator@1';
const BUSINESS_CONTENT_POLICY_DIGEST = 'sha256:b34b87ac93681a9acb4127ebdeb3030eccf4f9b6e2f8119b21326fdf3ffe9a13';
const BUSINESS_RENDERER_POLICY_ID = 'thoughtseed.docx.legal.a4.v1';
const BUSINESS_RENDERER_POLICY_DIGEST = 'sha256:ab11e39c744ac22dd6ee88b50f7fd275954ce4dd6bebd44590844b1f6ac6f453';

interface ServiceAgreementDraftInput {
  schema: 'thoughtseed.legal.service_agreement_draft_input.v1';
  workflowId: 'thoughtseed.legal.service-agreement.draft.v1';
  tenantId: 'thoughtseed';
  projectId: string;
  clientId: string;
  gsdTaskId: string;
  synthetic: true;
  intent: string;
  documentKind: 'service_agreement';
  clientDisplayName: 'Thoughtseed Systems Test Client';
  projectName: string;
  projectSummary: string;
  engagementType: 'fixed_price';
  currency: 'INR';
  feeMinor: number;
  deliverables: string[];
  outOfScope: string[];
  approval: {
    scope: 'internal_canary_draft_only';
    observationId: string;
    observedAt: string;
  };
  externalAction: 'none';
}

type NativeExecutionContract =
  | { command: 'canary.record'; idempotencyKey: string; input: { nonce: string } }
  | { command: 'service_agreement.draft.render'; idempotencyKey: string; input: ServiceAgreementDraftInput };

interface BusinessTaskIntake {
  schema: 'thoughtseed.business_task_intake.v1';
  source: 'temperance-operator';
  action: 'service_agreement.draft.render';
  memberId: string;
  idempotencyKey: string;
  synthetic: true;
  intent: string;
  project: {
    tenantId: 'thoughtseed';
    projectId: string;
    clientId: string;
    clientDisplayName: 'Thoughtseed Systems Test Client';
    projectName: string;
    projectSummary: string;
    deliverables: string[];
    outOfScope: string[];
  };
  commercial: {
    engagementType: 'fixed_price';
    currency: 'INR';
    feeMinor: number;
  };
  approval: {
    scope: 'internal_canary_draft_only';
    observationId: string;
    observedAt: string;
  };
  externalAction: 'none';
}

interface BusinessArtifactUploadBody {
  memberId: string;
  directiveId: string;
  idempotencyKey: string;
  executionId: string;
  runnerId: string;
  hostIdentity: string;
  claimId: string;
  fencingToken: string;
  attempt: number;
  artifact: {
    id: string;
    fileName: string;
    contentType: typeof BUSINESS_CONTENT_TYPE;
    byteLength: number;
    digest: string;
    bytes: Uint8Array;
  };
  workflowId: 'thoughtseed.legal.service-agreement.draft.v1';
  gsdTaskId: string;
  approvalState: 'awaiting_human_approval';
  synthetic: true;
  externalAction: 'none';
  policies: {
    contentPolicyId: string;
    contentPolicyDigest: string;
    rendererPolicyId: string;
    rendererPolicyDigest: string;
    fallbackPolicy: 'fail_closed';
  };
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

function canonicalIso(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function safeBusinessText(value: unknown, max: number): value is string {
  return typeof value === 'string'
    && value.trim() === value
    && value.length > 0
    && value.length <= max
    && !/[\u0000-\u001F\u007F]/.test(value);
}

function safeBusinessList(value: unknown, min: number, max: number, itemMax: number): value is string[] {
  return Array.isArray(value)
    && value.length >= min
    && value.length <= max
    && value.every((item) => safeBusinessText(item, itemMax));
}

function parseServiceAgreementDraftInput(value: unknown): ServiceAgreementDraftInput | null {
  if (!isRecord(value) || !exactKeys(value, [
    'schema', 'workflowId', 'tenantId', 'projectId', 'clientId', 'gsdTaskId', 'synthetic',
    'intent', 'documentKind', 'clientDisplayName', 'projectName', 'projectSummary', 'engagementType',
    'currency', 'feeMinor', 'deliverables', 'outOfScope', 'approval', 'externalAction',
  ])) return null;
  if (value.schema !== 'thoughtseed.legal.service_agreement_draft_input.v1'
    || value.workflowId !== 'thoughtseed.legal.service-agreement.draft.v1'
    || value.tenantId !== 'thoughtseed'
    || value.synthetic !== true
    || value.documentKind !== 'service_agreement'
    || value.clientDisplayName !== 'Thoughtseed Systems Test Client'
    || value.engagementType !== 'fixed_price'
    || value.currency !== 'INR'
    || value.externalAction !== 'none') return null;
  for (const key of ['projectId', 'clientId', 'gsdTaskId']) {
    if (typeof value[key] !== 'string' || !BUSINESS_SAFE_ID.test(value[key])) return null;
  }
  if (!safeBusinessText(value.intent, 240) || BUSINESS_EXTERNAL_ACTION_RE.test(value.intent)) return null;
  if (!safeBusinessText(value.projectName, 120) || !safeBusinessText(value.projectSummary, 600)) return null;
  if (!Number.isSafeInteger(value.feeMinor) || Number(value.feeMinor) < 100 || Number(value.feeMinor) > 10_000_000_000) return null;
  if (!safeBusinessList(value.deliverables, 1, 8, 180) || !safeBusinessList(value.outOfScope, 1, 8, 180)) return null;
  if (!isRecord(value.approval) || !exactKeys(value.approval, ['scope', 'observationId', 'observedAt'])) return null;
  if (value.approval.scope !== 'internal_canary_draft_only'
    || typeof value.approval.observationId !== 'string'
    || !BUSINESS_SAFE_ID.test(value.approval.observationId)
    || !canonicalIso(value.approval.observedAt)) return null;
  return value as unknown as ServiceAgreementDraftInput;
}

function parseBusinessTaskIntake(value: unknown): { intake?: BusinessTaskIntake; error?: string; code?: string } {
  if (!isRecord(value)) return { error: 'invalid business task intake' };
  if (typeof value.intent === 'string' && BUSINESS_EXTERNAL_ACTION_RE.test(value.intent)) {
    return { error: 'external action is forbidden for this business slice', code: 'external_action_forbidden' };
  }
  if (!exactKeys(value, [
    'schema', 'source', 'action', 'memberId', 'idempotencyKey', 'synthetic', 'intent',
    'project', 'commercial', 'approval', 'externalAction',
  ])) return { error: 'invalid business task intake' };
  if (value.schema !== 'thoughtseed.business_task_intake.v1'
    || value.source !== 'temperance-operator'
    || value.action !== 'service_agreement.draft.render'
    || value.synthetic !== true
    || value.externalAction !== 'none'
    || typeof value.memberId !== 'string'
    || !VALID_TENANT.test(value.memberId)
    || typeof value.idempotencyKey !== 'string'
    || !BUSINESS_SAFE_ID.test(value.idempotencyKey)
    || !safeBusinessText(value.intent, 240)) return { error: 'invalid business task intake' };
  if (!isRecord(value.project) || !exactKeys(value.project, [
    'tenantId', 'projectId', 'clientId', 'clientDisplayName', 'projectName', 'projectSummary', 'deliverables', 'outOfScope',
  ])) return { error: 'invalid business project contract' };
  if (value.project.tenantId !== 'thoughtseed'
    || value.project.clientDisplayName !== 'Thoughtseed Systems Test Client'
    || typeof value.project.projectId !== 'string'
    || !BUSINESS_SAFE_ID.test(value.project.projectId)
    || typeof value.project.clientId !== 'string'
    || !BUSINESS_SAFE_ID.test(value.project.clientId)
    || !safeBusinessText(value.project.projectName, 120)
    || !safeBusinessText(value.project.projectSummary, 600)
    || !safeBusinessList(value.project.deliverables, 1, 8, 180)
    || !safeBusinessList(value.project.outOfScope, 1, 8, 180)) return { error: 'invalid business project contract' };
  if (!isRecord(value.commercial) || !exactKeys(value.commercial, ['engagementType', 'currency', 'feeMinor'])
    || value.commercial.engagementType !== 'fixed_price'
    || value.commercial.currency !== 'INR'
    || !Number.isSafeInteger(value.commercial.feeMinor)
    || Number(value.commercial.feeMinor) < 100
    || Number(value.commercial.feeMinor) > 10_000_000_000) return { error: 'invalid business commercial contract' };
  if (!isRecord(value.approval) || !exactKeys(value.approval, ['scope', 'observationId', 'observedAt'])
    || value.approval.scope !== 'internal_canary_draft_only'
    || typeof value.approval.observationId !== 'string'
    || !BUSINESS_SAFE_ID.test(value.approval.observationId)
    || !canonicalIso(value.approval.observedAt)) return { error: 'invalid business approval contract' };
  return { intake: value as unknown as BusinessTaskIntake };
}

function parseBusinessArtifactUpload(value: unknown): BusinessArtifactUploadBody | null {
  if (!isRecord(value) || !exactKeys(value, [
    'schema', 'memberId', 'directiveId', 'idempotencyKey', 'executionId', 'runnerId', 'hostIdentity',
    'claimId', 'fencingToken', 'attempt', 'artifact', 'workflowId', 'gsdTaskId', 'approvalState',
    'synthetic', 'externalAction', 'policies',
  ])) return null;
  if (value.schema !== 'thoughtseed.hermes.business_artifact_upload.v1'
    || typeof value.memberId !== 'string' || !VALID_TENANT.test(value.memberId)
    || !executionText(value.directiveId)
    || !executionText(value.idempotencyKey)
    || !executionText(value.executionId, EXECUTION_ID)
    || !executionText(value.runnerId, EXECUTION_OWNER)
    || !executionText(value.hostIdentity, EXECUTION_OWNER)
    || !executionText(value.claimId)
    || !executionText(value.fencingToken)
    || !Number.isSafeInteger(value.attempt) || Number(value.attempt) < 1
    || value.workflowId !== 'thoughtseed.legal.service-agreement.draft.v1'
    || typeof value.gsdTaskId !== 'string' || !BUSINESS_SAFE_ID.test(value.gsdTaskId)
    || value.approvalState !== 'awaiting_human_approval'
    || value.synthetic !== true
    || value.externalAction !== 'none') return null;
  if (!isRecord(value.artifact) || !exactKeys(value.artifact, [
    'id', 'fileName', 'contentType', 'byteLength', 'digest', 'base64',
  ])) return null;
  if (typeof value.artifact.id !== 'string' || !BUSINESS_SAFE_ID.test(value.artifact.id)
    || !safeBusinessText(value.artifact.fileName, 240) || !value.artifact.fileName.endsWith('.docx')
    || value.artifact.contentType !== BUSINESS_CONTENT_TYPE
    || !Number.isSafeInteger(value.artifact.byteLength)
    || Number(value.artifact.byteLength) < 1
    || Number(value.artifact.byteLength) > 2_000_000
    || typeof value.artifact.digest !== 'string' || !SHA256_DIGEST.test(value.artifact.digest)
    || typeof value.artifact.base64 !== 'string'
    || value.artifact.base64.length > 2_700_000
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.artifact.base64)) return null;
  let bytes: Uint8Array;
  try {
    const binary = atob(value.artifact.base64);
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
  if (bytes.byteLength !== value.artifact.byteLength) return null;
  if (!isRecord(value.policies) || !exactKeys(value.policies, [
    'contentPolicyId', 'contentPolicyDigest', 'rendererPolicyId', 'rendererPolicyDigest', 'fallbackPolicy',
  ])) return null;
  if (value.policies.contentPolicyId !== BUSINESS_CONTENT_POLICY_ID
    || value.policies.contentPolicyDigest !== BUSINESS_CONTENT_POLICY_DIGEST
    || value.policies.rendererPolicyId !== BUSINESS_RENDERER_POLICY_ID
    || value.policies.rendererPolicyDigest !== BUSINESS_RENDERER_POLICY_DIGEST
    || value.policies.fallbackPolicy !== 'fail_closed') return null;
  return {
    memberId: value.memberId,
    directiveId: value.directiveId as string,
    idempotencyKey: value.idempotencyKey as string,
    executionId: value.executionId as string,
    runnerId: value.runnerId as string,
    hostIdentity: value.hostIdentity as string,
    claimId: value.claimId as string,
    fencingToken: value.fencingToken as string,
    attempt: Number(value.attempt),
    artifact: {
      id: value.artifact.id,
      fileName: value.artifact.fileName,
      contentType: BUSINESS_CONTENT_TYPE,
      byteLength: Number(value.artifact.byteLength),
      digest: value.artifact.digest,
      bytes,
    },
    workflowId: 'thoughtseed.legal.service-agreement.draft.v1',
    gsdTaskId: value.gsdTaskId,
    approvalState: 'awaiting_human_approval',
    synthetic: true,
    externalAction: 'none',
    policies: {
      contentPolicyId: value.policies.contentPolicyId,
      contentPolicyDigest: value.policies.contentPolicyDigest,
      rendererPolicyId: value.policies.rendererPolicyId,
      rendererPolicyDigest: value.policies.rendererPolicyDigest,
      fallbackPolicy: 'fail_closed',
    },
  };
}

function sameBusinessReceipt(left: BridgeBusinessArtifactReceipt | undefined, right: BridgeBusinessArtifactReceipt | undefined): boolean {
  return Boolean(left && right && canonicalJson(left) === canonicalJson(right));
}

function executionText(value: unknown, pattern = EXECUTION_SAFE_ID): string | null {
  return typeof value === 'string' && pattern.test(value) ? value : null;
}

function executionClaimBody(value: unknown): Omit<BridgeExecutionClaimInput, 'claimId' | 'fencingToken' | 'claimedAt' | 'leaseExpiresAt'> | null {
  if (!isRecord(value) || value.schema !== 'thoughtseed.hermes.execution_claim.v1') return null;
  const memberId = typeof value.memberId === 'string' && VALID_TENANT.test(value.memberId) ? value.memberId : null;
  const directiveId = executionText(value.directiveId);
  const idempotencyKey = executionText(value.idempotencyKey);
  const executionId = executionText(value.executionId, EXECUTION_ID);
  const runnerId = executionText(value.runnerId, EXECUTION_OWNER);
  const hostIdentity = executionText(value.hostIdentity, EXECUTION_OWNER);
  if (!memberId || !directiveId || !idempotencyKey || !executionId || !runnerId || !hostIdentity) return null;
  return { memberId, directiveId, idempotencyKey, executionId, runnerId, hostIdentity };
}

function parseBusinessArtifactReceipt(value: unknown): BridgeBusinessArtifactReceipt | null {
  if (!isRecord(value) || !exactKeys(value, [
    'schema', 'artifactId', 'businessTaskId', 'gsdTaskId', 'executionId', 'directiveId', 'memberId',
    'digest', 'byteLength', 'contentType', 'r2Key', 'contentPolicyId', 'contentPolicyDigest',
    'rendererPolicyId', 'rendererPolicyDigest', 'approvalState', 'synthetic', 'externalAction',
  ])) return null;
  if (value.schema !== 'thoughtseed.business_artifact_receipt.v1'
    || typeof value.artifactId !== 'string' || !BUSINESS_SAFE_ID.test(value.artifactId)
    || typeof value.businessTaskId !== 'string' || !BUSINESS_SAFE_ID.test(value.businessTaskId)
    || typeof value.gsdTaskId !== 'string' || !BUSINESS_SAFE_ID.test(value.gsdTaskId)
    || typeof value.executionId !== 'string' || !EXECUTION_ID.test(value.executionId)
    || typeof value.directiveId !== 'string' || !BUSINESS_SAFE_ID.test(value.directiveId)
    || typeof value.memberId !== 'string' || !VALID_TENANT.test(value.memberId)
    || typeof value.digest !== 'string' || !SHA256_DIGEST.test(value.digest)
    || !Number.isSafeInteger(value.byteLength) || Number(value.byteLength) < 1 || Number(value.byteLength) > 2_000_000
    || value.contentType !== BUSINESS_CONTENT_TYPE
    || typeof value.r2Key !== 'string' || !value.r2Key.startsWith('business-artifacts/thoughtseed/')
    || value.contentPolicyId !== BUSINESS_CONTENT_POLICY_ID
    || value.contentPolicyDigest !== BUSINESS_CONTENT_POLICY_DIGEST
    || value.rendererPolicyId !== BUSINESS_RENDERER_POLICY_ID
    || value.rendererPolicyDigest !== BUSINESS_RENDERER_POLICY_DIGEST
    || value.approvalState !== 'awaiting_human_approval'
    || value.synthetic !== true
    || value.externalAction !== 'none') return null;
  return value as unknown as BridgeBusinessArtifactReceipt;
}

function executionOutcomeBody(value: unknown): Omit<BridgeExecutionOutcomeInput, 'attestationDigest' | 'recordedAt'> | null {
  if (!isRecord(value) || value.schema !== 'thoughtseed.hermes.execution_outcome.v1') return null;
  const memberId = typeof value.memberId === 'string' && VALID_TENANT.test(value.memberId) ? value.memberId : null;
  const directiveId = executionText(value.directiveId);
  const idempotencyKey = executionText(value.idempotencyKey);
  const executionId = executionText(value.executionId, EXECUTION_ID);
  const runnerId = executionText(value.runnerId, EXECUTION_OWNER);
  const claimId = executionText(value.claimId);
  const fencingToken = executionText(value.fencingToken);
  const attempt = Number.isSafeInteger(value.attempt) && Number(value.attempt) > 0 ? Number(value.attempt) : null;
  const status = value.status === 'executed' || value.status === 'failed' || value.status === 'retryable'
    ? value.status
    : null;
  const rawAttestation = value.attestation;
  if (!isRecord(rawAttestation) || rawAttestation.schema !== 'thoughtseed.hermes.execution_attestation.v1') return null;
  const attestationId = executionText(rawAttestation.id, ATTESTATION_ID);
  const attestationRunnerId = executionText(rawAttestation.runnerId, EXECUTION_OWNER);
  const attestationHostIdentity = executionText(rawAttestation.hostIdentity, EXECUTION_OWNER);
  const hostIdentity = attestationHostIdentity;
  const inputDigest = executionText(rawAttestation.inputDigest, SHA256_DIGEST);
  const outputDigest = rawAttestation.outputDigest === undefined
    ? undefined
    : executionText(rawAttestation.outputDigest, SHA256_DIGEST);
  const errorCode = rawAttestation.errorCode === undefined
    ? undefined
    : executionText(rawAttestation.errorCode, EXECUTION_ERROR_CODE);
  if (errorCode && /token|secret|password|authorization|credential|api[_-]?key/i.test(errorCode)) return null;
  const startedAt = typeof rawAttestation.startedAt === 'string' ? rawAttestation.startedAt : null;
  const finishedAt = typeof rawAttestation.finishedAt === 'string' ? rawAttestation.finishedAt : null;
  const startedAtMs = startedAt ? Date.parse(startedAt) : NaN;
  const finishedAtMs = finishedAt ? Date.parse(finishedAt) : NaN;
  const validTimes = Number.isFinite(startedAtMs) && Number.isFinite(finishedAtMs)
    && new Date(startedAtMs).toISOString() === startedAt
    && new Date(finishedAtMs).toISOString() === finishedAt
    && finishedAtMs >= startedAtMs;
  if (!memberId || !directiveId || !idempotencyKey || !executionId || !runnerId
    || !hostIdentity || !claimId || !fencingToken || !attempt || !status || !attestationId
    || !attestationRunnerId || !attestationHostIdentity || !inputDigest || !validTimes) return null;
  if (rawAttestation.executionId !== executionId
    || rawAttestation.directiveId !== directiveId
    || rawAttestation.idempotencyKey !== idempotencyKey
    || attestationRunnerId !== runnerId
    || attestationHostIdentity !== hostIdentity
    || (rawAttestation.command !== 'canary.record' && rawAttestation.command !== 'service_agreement.draft.render')
    || rawAttestation.status !== status) return null;
  const exitCode: 0 | 1 | null = status === 'executed' ? 0 : status === 'failed' ? 1 : null;
  if (rawAttestation.exitCode !== exitCode) return null;
  const businessReceipt = rawAttestation.businessReceipt === undefined
    ? undefined
    : parseBusinessArtifactReceipt(rawAttestation.businessReceipt);
  if (rawAttestation.businessReceipt !== undefined && !businessReceipt) return null;
  if (status === 'executed' && (!outputDigest || errorCode !== undefined)) return null;
  if ((status === 'failed' || status === 'retryable') && (outputDigest !== undefined || !errorCode || businessReceipt !== undefined)) return null;
  if (rawAttestation.command === 'service_agreement.draft.render') {
    if (status === 'executed' && (!businessReceipt || businessReceipt.digest !== outputDigest)) return null;
  } else if (businessReceipt !== undefined) return null;
  return {
    memberId,
    directiveId,
    idempotencyKey,
    executionId,
    runnerId,
    hostIdentity,
    claimId,
    fencingToken,
    attempt,
    status,
    attestation: {
      schema: 'thoughtseed.hermes.execution_attestation.v1',
      id: attestationId,
      executionId,
      directiveId,
      idempotencyKey,
      runnerId,
      hostIdentity,
      command: rawAttestation.command,
      status,
      exitCode,
      inputDigest,
      ...(outputDigest ? { outputDigest } : {}),
      ...(businessReceipt ? { businessReceipt } : {}),
      ...(errorCode ? { errorCode } : {}),
      startedAt: startedAt!,
      finishedAt: finishedAt!,
    },
  };
}

function nativeExecutionContract(
  directive: Record<string, unknown> | null,
  memberId: string,
  directiveId: string,
): NativeExecutionContract | null {
  if (!directive || (directive.memberId !== undefined && directive.memberId !== memberId)) return null;
  const payload = isRecord(directive.payload) ? directive.payload : null;
  const target = payload && isRecord(payload.target) ? payload.target : null;
  const input = payload && isRecord(payload.input) ? payload.input : null;
  if (payload?.type !== 'native_execution'
    || payload.schema !== 'thoughtseed.hermes.native_execution.v1'
    || target?.memberId !== memberId
    || !input) return null;
  const idempotencyKey = directive.idempotencyKey === undefined
    ? directiveId
    : executionText(directive.idempotencyKey);
  if (!idempotencyKey) return null;
  if (payload.command === 'canary.record'
    && Object.keys(input).length === 1
    && typeof input.nonce === 'string'
    && EXECUTION_NONCE.test(input.nonce)) {
    return { command: 'canary.record', idempotencyKey, input: { nonce: input.nonce } };
  }
  if (payload.command === 'service_agreement.draft.render') {
    const businessInput = parseServiceAgreementDraftInput(input);
    if (businessInput) return { command: 'service_agreement.draft.render', idempotencyKey, input: businessInput };
  }
  return null;
}

async function nativeExecutionIdentity(
  memberId: string,
  directiveId: string,
  contract: NativeExecutionContract,
): Promise<BridgeExecutionContractIdentity> {
  const inputDigest = `sha256:${await sha256hex(canonicalJson(contract.input))}`;
  const executionId = `exec_${(await sha256hex(canonicalJson({
    memberId,
    directiveId,
    idempotencyKey: contract.idempotencyKey,
  }))).slice(0, 32)}`;
  return { idempotencyKey: contract.idempotencyKey, inputDigest, executionId };
}

function sameNativeExecutionContract(
  left: NativeExecutionContract,
  right: NativeExecutionContract,
): boolean {
  return left.command === right.command
    && left.idempotencyKey === right.idempotencyKey
    && canonicalJson(left.input) === canonicalJson(right.input);
}

async function validExecutionAttestation(
  contract: NativeExecutionContract,
  outcome: Omit<BridgeExecutionOutcomeInput, 'attestationDigest' | 'recordedAt'>,
): Promise<boolean> {
  const expectedInputDigest = `sha256:${await sha256hex(canonicalJson(contract.input))}`;
  if (outcome.attestation.inputDigest !== expectedInputDigest) return false;
  if (outcome.attestation.command !== contract.command) return false;
  if (outcome.status === 'executed') {
    if (contract.command === 'canary.record') {
      const proof = {
        schema: 'thoughtseed.hermes.canary_proof.v1',
        directiveId: outcome.directiveId,
        idempotencyKey: outcome.idempotencyKey,
        executionId: outcome.executionId,
        command: 'canary.record',
        inputDigest: expectedInputDigest,
      };
      const expectedOutputDigest = `sha256:${await sha256hex(canonicalJson(proof))}`;
      if (outcome.attestation.outputDigest !== expectedOutputDigest) return false;
    } else {
      const receipt = outcome.attestation.businessReceipt;
      const expectedArtifactId = `artifact_${(await sha256hex(`${contract.input.gsdTaskId}\u0000thoughtseed.hermes.native_execution.v1`)).slice(0, 32)}`;
      if (!receipt
        || receipt.artifactId !== expectedArtifactId
        || receipt.businessTaskId !== contract.input.gsdTaskId
        || receipt.gsdTaskId !== contract.input.gsdTaskId
        || receipt.executionId !== outcome.executionId
        || receipt.directiveId !== outcome.directiveId
        || receipt.memberId !== outcome.memberId
        || receipt.digest !== outcome.attestation.outputDigest
        || receipt.approvalState !== 'awaiting_human_approval'
        || receipt.synthetic !== true
        || receipt.externalAction !== 'none') return false;
    }
  }
  const { id: _id, ...identity } = outcome.attestation;
  const expectedId = `att_${(await sha256hex(canonicalJson(identity))).slice(0, 32)}`;
  return outcome.attestation.id === expectedId;
}

// Returns the stored result for a previously-executed write, or null if absent/expired.
async function readGithubIdempotent(kv: KvLike, idempotencyKey: string, nowMs: number): Promise<GithubCommandResult | null> {
  const raw = await kv.get(`gh-cmd:${idempotencyKey}`);
  if (!raw) return null;
  try {
    const rec = JSON.parse(raw);
    if (typeof rec.expiresAt === 'number' && rec.expiresAt <= nowMs) return null;
    return (rec.result ?? null) as GithubCommandResult | null;
  } catch {
    return null; // corrupt record → treat as no prior write
  }
}

async function storeGithubIdempotent(kv: KvLike, idempotencyKey: string, result: GithubCommandResult, nowMs: number): Promise<void> {
  await kv.put(`gh-cmd:${idempotencyKey}`, JSON.stringify({ result, storedAt: nowMs, expiresAt: nowMs + GH_CMD_IDEMPOTENCY_TTL_MS }));
}

// Increments the per-actor+repo window counter and reports whether this write is allowed.
// The window resets once it ages past GH_WRITE_RATE_WINDOW_MS; over-limit writes are not counted.
async function touchGithubWriteRate(kv: KvLike, actorId: string, repo: string, nowMs: number): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const key = `gh-rate:${kvKeySegment(actorId)}:${repo.toLowerCase()}`;
  let windowStart = nowMs;
  let count = 0;
  const raw = await kv.get(key);
  if (raw) {
    try {
      const rec = JSON.parse(raw);
      if (typeof rec.windowStart === 'number' && nowMs - rec.windowStart < GH_WRITE_RATE_WINDOW_MS) {
        windowStart = rec.windowStart;
        count = typeof rec.count === 'number' ? rec.count : 0;
      }
    } catch { /* corrupt counter → start a fresh window */ }
  }
  if (count >= GH_WRITE_RATE_LIMIT) {
    return { allowed: false, retryAfterMs: Math.max(0, windowStart + GH_WRITE_RATE_WINDOW_MS - nowMs) };
  }
  await kv.put(key, JSON.stringify({ windowStart, count: count + 1 }));
  return { allowed: true, retryAfterMs: 0 };
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
  const branchMission = isRecord(raw.branchMission) ? raw.branchMission : {};
  const rawKpiIds = Array.isArray(raw.kpiIds) ? raw.kpiIds : Array.isArray(branchMission.kpiIds) ? branchMission.kpiIds : [];
  const kpiIds = rawKpiIds.map((value) => optionalText(value, 120)).filter((value): value is string => !!value);
  const rawApprovalsRequired = Array.isArray(raw.approvalsRequired) ? raw.approvalsRequired : Array.isArray(branchMission.approvalsRequired) ? branchMission.approvalsRequired : [];
  const approvalsRequired = rawApprovalsRequired.map((value) => optionalText(value, 240)).filter((value): value is string => !!value);
  const branchMissionMeta = {
    branchId: optionalText(raw.branchId ?? branchMission.branchId, 120),
    arcId: optionalText(raw.arcId ?? branchMission.arcId, 160),
    missionId: optionalText(raw.missionId ?? branchMission.missionId, 160),
    ...(kpiIds.length ? { kpiIds } : {}),
    proofRequired: optionalText(raw.proofRequired ?? branchMission.proofRequired, 500),
    gateId: optionalText(raw.gateId ?? branchMission.gateId, 160),
    promotionState: optionalText(raw.promotionState ?? branchMission.promotionState, 120),
    proofFoldback: optionalText(raw.proofFoldback ?? branchMission.proofFoldback, 500),
    autonomyBoundary: optionalText(raw.autonomyBoundary ?? branchMission.autonomyBoundary, 500),
    loopId: optionalText(raw.loopId ?? branchMission.loopId, 160),
    loopBoundaryColor: optionalText(raw.loopBoundaryColor ?? branchMission.loopBoundaryColor, 24),
    loopStateFile: optionalText(raw.loopStateFile ?? branchMission.loopStateFile, 240),
    loopStopRule: optionalText(raw.loopStopRule ?? branchMission.loopStopRule, 500),
    loopOneChangeRule: optionalText(raw.loopOneChangeRule ?? branchMission.loopOneChangeRule, 500),
    ...(approvalsRequired.length ? { approvalsRequired } : {}),
  };
  const branchMissionRecord = Object.fromEntries(Object.entries(branchMissionMeta).filter(([, value]) =>
    Array.isArray(value) ? value.length > 0 : !!value
  ));
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
    ...branchMissionRecord,
  };
}

async function queueProjectTaskAssignment(
  bridgeStore: BridgeStoreLike,
  msg: Record<string, unknown>,
  nowIso: () => string,
  createId?: () => string,
  trustedTaskMetadata?: Record<string, unknown>,
): Promise<SimpleResponse> {
  const rawTask = msg && typeof msg.task === 'object' && msg.task && !Array.isArray(msg.task) ? msg.task as Record<string, unknown> : null;
  if (!rawTask) return json(400, { error: 'assignment needs a task object' });
  const memberId = String(msg.memberId ?? rawTask.assigneeMemberId ?? '').trim().toLowerCase();
  if (!memberId || !VALID_TENANT.test(memberId)) return json(400, { error: 'assignment needs a valid memberId' });
  const normalizedTask = normalizeAssignmentTask(rawTask, memberId);
  if ('error' in normalizedTask) return json(400, { error: normalizedTask.error });
  const task = { ...normalizedTask, ...(trustedTaskMetadata ?? {}) };

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
  const payloadHash = await sha256hex(canonicalJson(semanticPayload));

  const finalize = async (assignment: BridgeAssignmentRecord, duplicate: boolean): Promise<SimpleResponse> => {
    if (assignment.payloadHash !== payloadHash) {
      return json(409, { error: 'assignment eventId conflict', eventId, memberId, existingId: assignment.id });
    }
    const assignedCorrelationId = assignment.correlationId ?? correlationId;
    const assignedSemanticPayload = {
      ...semanticPayload,
      correlationId: assignedCorrelationId,
      task: { ...task, eventId, correlationId: assignedCorrelationId },
    };
    const expectedDirective = {
      id: assignment.id,
      memberId,
      direction: 'downstream',
      payload: { ...assignedSemanticPayload, issuedAt: assignment.enqueuedAt },
      payloadHash,
      delivered: false,
      issuedAt: assignment.enqueuedAt,
      enqueuedAt: assignment.enqueuedAt,
    };
    let directive = await bridgeStore.getDirective(memberId, assignment.id);
    if (!directive) {
      try {
        await bridgeStore.putDirectiveIfAbsent(memberId, assignment.id, expectedDirective);
      } catch {
        return json(500, { error: 'assignment directive persistence failed', eventId, memberId, id: assignment.id });
      }
      directive = await bridgeStore.getDirective(memberId, assignment.id);
    }
    if (!directive) {
      return json(500, { error: 'assignment directive persistence failed', eventId, memberId, id: assignment.id });
    }
    const storedPayload = isRecord(directive.payload) ? directive.payload : null;
    const { issuedAt: _storedIssuedAt, ...storedSemanticPayload } = storedPayload ?? {};
    const storedPayloadHash = storedPayload ? await sha256hex(canonicalJson(storedSemanticPayload)) : '';
    if (
      directive.id !== assignment.id
      || directive.memberId !== memberId
      || directive.direction !== 'downstream'
      || directive.payloadHash !== payloadHash
      || storedPayloadHash !== payloadHash
    ) {
      return json(409, { error: 'assignment directive conflict', eventId, memberId, existingId: assignment.id });
    }
    return json(200, {
      ok: true,
      id: assignment.id,
      memberId,
      taskId,
      projectId,
      eventId,
      correlationId: assignedCorrelationId,
      queued: directive.delivered !== true,
      ...(directive.delivered === true ? { delivered: true } : {}),
      ...(duplicate ? { duplicate: true } : {}),
    });
  };

  const existing = await bridgeStore.getAssignment(memberId, eventId);
  if (existing) {
    return finalize(existing, true);
  }

  await bridgeStore.putAssignment({ id: directiveId, memberId, taskId, projectId, eventId, correlationId, payloadHash, enqueuedAt: issuedAt });
  const persisted = await bridgeStore.getAssignment(memberId, eventId);
  if (!persisted) return json(500, { error: 'assignment persistence failed', eventId, memberId });
  return finalize(persisted, persisted.id !== directiveId);
}

interface RoleTaskBinding {
  enabled: boolean;
  memberId: string;
  projectId: string;
  taskType: string;
}

interface RoleTaskBindingRegistry {
  schema: 'cambium.role-task-bindings.v1';
  version: string;
  bindings: Record<string, RoleTaskBinding>;
}

const ROLE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OPAQUE_VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const CONTROL_CHAR_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const OPAQUE_CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]/;

function parseRoleTaskBindings(raw: string | undefined): RoleTaskBindingRegistry | null {
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value)) return null;
  if (value.schema !== 'cambium.role-task-bindings.v1') return null;
  if (typeof value.version !== 'string' || !OPAQUE_VERSION_RE.test(value.version)) return null;
  if (!isRecord(value.bindings)) return null;
  const entries = Object.entries(value.bindings);
  if (entries.length < 1 || entries.length > 64) return null;
  const bindings: Record<string, RoleTaskBinding> = {};
  for (const [roleId, candidate] of entries) {
    if (roleId.length > 80 || !ROLE_ID_RE.test(roleId) || !isRecord(candidate)) return null;
    const allowedKeys = new Set(['enabled', 'memberId', 'projectId', 'taskType']);
    if (Object.keys(candidate).some((key) => !allowedKeys.has(key))) return null;
    if (typeof candidate.enabled !== 'boolean') return null;
    if (typeof candidate.memberId !== 'string' || !VALID_TENANT.test(candidate.memberId)) return null;
    if (typeof candidate.projectId !== 'string' || !VALID_TENANT.test(candidate.projectId)) return null;
    if (typeof candidate.taskType !== 'string' || !FABRIC_TASK_TYPES.has(candidate.taskType)) return null;
    bindings[roleId] = {
      enabled: candidate.enabled,
      memberId: candidate.memberId,
      projectId: candidate.projectId,
      taskType: candidate.taskType,
    };
  }
  return { schema: 'cambium.role-task-bindings.v1', version: value.version, bindings };
}

function roleTaskText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  if (value.length > max) return null;
  const text = value.trim();
  if (!text || CONTROL_CHAR_RE.test(text)) return null;
  return text;
}

function opaqueRoleTaskKey(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 1 || value.length > 160) return null;
  if (!value.trim() || OPAQUE_CONTROL_CHAR_RE.test(value)) return null;
  return value;
}

async function queueRoleTask(
  bridgeStore: BridgeStoreLike,
  raw: Record<string, unknown>,
  bindingsJson: string | undefined,
  nowIso: () => string,
  createId?: () => string,
): Promise<SimpleResponse> {
  const forbiddenOverrides = ['memberId', 'projectId', 'binding', 'bindingVersion', 'assigneeMemberId', 'taskType', 'task'];
  const override = forbiddenOverrides.find((key) => Object.prototype.hasOwnProperty.call(raw, key));
  if (override) return json(400, { error: `role task cannot override ${override}` });
  if (raw.schema !== 'hermes.role-task-intake.v1') return json(400, { error: 'role task schema must be hermes.role-task-intake.v1' });
  if (raw.source !== 'telegram-manual') return json(400, { error: 'role task source must be telegram-manual' });

  const roleId = typeof raw.roleId === 'string' ? raw.roleId : '';
  if (!roleId || roleId.length > 80 || !ROLE_ID_RE.test(roleId)) return json(400, { error: 'roleId must be lowercase-kebab' });
  const text = roleTaskText(raw.text, 1200);
  if (!text) return json(400, { error: 'role task text must be 1-1200 characters' });
  const idempotencyKey = opaqueRoleTaskKey(raw.idempotencyKey);
  if (!idempotencyKey) return json(400, { error: 'idempotencyKey must be an opaque 1-160 character value' });
  const actorId = raw.actorId === undefined ? undefined : roleTaskText(raw.actorId, 80);
  if (raw.actorId !== undefined && !actorId) return json(400, { error: 'actorId must be 1-80 characters when provided' });

  const registry = parseRoleTaskBindings(bindingsJson);
  if (!registry) return json(503, { error: 'role task binding registry unavailable' });
  const binding = registry.bindings[roleId];
  if (!binding || !binding.enabled) return json(503, { error: 'role task binding unavailable', roleId });

  const idempotencyHash = await sha256hex(`hermes.role-task-intake.v1\u0000${idempotencyKey}`);
  const taskId = `role-task-${idempotencyHash.slice(0, 32)}`;
  const eventId = `hermes:role-task:${idempotencyHash}`;
  const correlationId = eventId;
  const intentHash = await sha256hex(canonicalJson({
    schema: 'hermes.role-task-intake.v1',
    source: 'telegram-manual',
    roleId,
    text,
    actorId,
    idempotencyKeyHash: idempotencyHash,
    binding: {
      schema: registry.schema,
      version: registry.version,
      memberId: binding.memberId,
      projectId: binding.projectId,
      taskType: binding.taskType,
    },
  }));
  const claim: BridgeRoleTaskClaimRecord = {
    eventId,
    roleId,
    memberId: binding.memberId,
    projectId: binding.projectId,
    bindingVersion: registry.version,
    intentHash,
    claimedAt: nowIso(),
  };
  try {
    await bridgeStore.putRoleTaskClaim(claim);
  } catch {
    return json(500, { error: 'role task idempotency claim failed', eventId });
  }
  const persistedClaim = await bridgeStore.getRoleTaskClaim(eventId);
  if (!persistedClaim) return json(500, { error: 'role task idempotency claim failed', eventId });
  if (
    persistedClaim.intentHash !== claim.intentHash
    || persistedClaim.roleId !== claim.roleId
    || persistedClaim.memberId !== claim.memberId
    || persistedClaim.projectId !== claim.projectId
    || persistedClaim.bindingVersion !== claim.bindingVersion
  ) {
    return json(409, { error: 'role task idempotency binding conflict', eventId });
  }

  const fallbackTitle = `Manual task for ${roleId}`;
  const firstLine = text.split(/\r?\n/, 1)[0].replace(/\s+/g, ' ').trim();
  const title = safeFabricText(firstLine, fallbackTitle, 180);
  const provenance = {
    schema: 'hermes.role-task-intake.v1',
    source: 'telegram-manual',
    roleId,
    binding: {
      schema: registry.schema,
      version: registry.version,
      memberId: binding.memberId,
      projectId: binding.projectId,
      taskType: binding.taskType,
    },
    idempotencyKeyHash: idempotencyHash,
    ...(actorId ? { actorId } : {}),
  };
  const queued = await queueProjectTaskAssignment(bridgeStore, {
    memberId: binding.memberId,
    eventId,
    correlationId,
    task: {
      taskId,
      projectId: binding.projectId,
      title,
      description: text,
      taskType: binding.taskType,
      assignedBy: 'hermes',
      source: 'telegram-manual',
    },
  }, nowIso, createId, { roleTaskProvenance: provenance });
  if (queued.status !== 200) return queued;
  const receipt = JSON.parse(queued.body) as Record<string, unknown>;
  return json(200, {
    ok: true,
    schema: 'thoughtseed.role-task-receipt.v1',
    id: receipt.id,
    queued: receipt.queued === true,
    duplicate: receipt.duplicate === true,
    eventId,
    correlationId,
    idempotencyKey,
    binding: {
      version: registry.version,
      roleId,
      memberId: binding.memberId,
      projectId: binding.projectId,
    },
    task: { taskId, title, taskType: binding.taskType },
  });
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
  const kpiIds = Array.isArray(raw.kpiIds)
    ? raw.kpiIds.map((value) => optionalText(value, 120)).filter((value): value is string => !!value)
    : [];
  const approvalsRequired = Array.isArray(raw.approvalsRequired)
    ? raw.approvalsRequired.map((value) => optionalText(value, 240)).filter((value): value is string => !!value)
    : [];
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
      ...(optionalText(raw.branchId, 120) ? { branchId: optionalText(raw.branchId, 120) } : {}),
      ...(optionalText(raw.arcId, 160) ? { arcId: optionalText(raw.arcId, 160) } : {}),
      ...(optionalText(raw.missionId, 160) ? { missionId: optionalText(raw.missionId, 160) } : {}),
      ...(kpiIds.length ? { kpiIds } : {}),
      ...(optionalText(raw.gateId, 160) ? { gateId: optionalText(raw.gateId, 160) } : {}),
      ...(optionalText(raw.proofRequired, 500) ? { proofRequired: optionalText(raw.proofRequired, 500) } : {}),
      ...(optionalText(raw.proofFoldback, 500) ? { proofFoldback: optionalText(raw.proofFoldback, 500) } : {}),
      ...(optionalText(raw.promotionState, 120) ? { promotionState: optionalText(raw.promotionState, 120) } : {}),
      ...(optionalText(raw.autonomyBoundary, 500) ? { autonomyBoundary: optionalText(raw.autonomyBoundary, 500) } : {}),
      ...(optionalText(raw.loopId, 160) ? { loopId: optionalText(raw.loopId, 160) } : {}),
      ...(optionalText(raw.loopBoundaryColor, 24) ? { loopBoundaryColor: optionalText(raw.loopBoundaryColor, 24) } : {}),
      ...(optionalText(raw.loopStateFile, 240) ? { loopStateFile: optionalText(raw.loopStateFile, 240) } : {}),
      ...(optionalText(raw.loopStopRule, 500) ? { loopStopRule: optionalText(raw.loopStopRule, 500) } : {}),
      ...(optionalText(raw.loopOneChangeRule, 500) ? { loopOneChangeRule: optionalText(raw.loopOneChangeRule, 500) } : {}),
      ...(approvalsRequired.length ? { approvalsRequired } : {}),
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

async function publicQuestBody(kv: KvLike, tenantId: string, stored: string): Promise<string> {
  try {
    const envelope = sanitizeQuestEnvelope(JSON.parse(stored));
    const actionRequests = await listActionRequestRecords(kv, { tenantId, limit: 50 });
    if (actionRequests.status !== 200 || Number(actionRequests.body.count) < 1) return JSON.stringify(envelope);
    return JSON.stringify({
      ...envelope,
      actionRequests: actionRequests.body,
    });
  } catch {
    return stored;
  }
}

function parsedTime(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStoredEnvelope(stored: string | null): any | null {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasBranchStoryRows(envelope: unknown): boolean {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return false;
  const branchStories = (envelope as Record<string, unknown>).branchStories;
  if (!branchStories || typeof branchStories !== 'object' || Array.isArray(branchStories)) return false;
  const rows = (branchStories as Record<string, unknown>).rows;
  return Array.isArray(rows) && rows.length > 0;
}

function staleLedgerPush(existing: unknown, incoming: unknown): boolean {
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return false;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return false;
  const existingDerivedAt = parsedTime((existing as Record<string, unknown>).derivedAt);
  const incomingDerivedAt = parsedTime((incoming as Record<string, unknown>).derivedAt);
  return existingDerivedAt !== null && incomingDerivedAt !== null && incomingDerivedAt < existingDerivedAt;
}

function wouldRegressBranchStories(existing: unknown, incoming: unknown): boolean {
  return hasBranchStoryRows(existing) && !hasBranchStoryRows(incoming);
}

function tenantOf(path: string, prefix: string): string | null {
  const routePath = fabricRoutePath(path);
  if (!routePath.startsWith(prefix)) return null;
  const rest = routePath.slice(prefix.length).replace(/\/+$/, '');
  return VALID_TENANT.test(rest) ? rest : null;
}

export async function handle(req: SimpleRequest, deps: HandlerDeps): Promise<SimpleResponse> {
  const { method, path } = req;
  const routePath = fabricRoutePath(path);

  if (method === 'GET' && routePath === '/healthz/gate') {
    const gateConfigured = Boolean(
      deps.gate?.botId.trim()
      && deps.gate.founderIds.some((founderId) => founderId.trim()),
    );
    return json(gateConfigured ? 200 : 503, {
      ok: gateConfigured,
      worker: 'cambium-quests',
      capability: 'telegram-signed-gate',
      gateConfigured,
      ...(gateConfigured ? {} : { error: 'gate not configured' }),
    });
  }

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

  if (method === 'GET' && routePath.startsWith('/api/quests/')) {
    const tenant = tenantOf(path, '/api/quests/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    // M3 isolation suite is green — gate open to all valid tenants
    const stored = await deps.kv.get(ledgerKey(tenant));
    if (!stored) return json(404, { error: `no ledger pushed yet for "${tenant}" — run: quine write quests push --tenant ${tenant}` });
    return { status: 200, headers: { ...JSON_HEADERS }, body: await publicQuestBody(deps.kv, tenant, stored) };
  }

  if (method === 'POST' && routePath.startsWith('/internal/ledger/')) {
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
    const key = ledgerKey(tenant);
    const existingEnvelope = parseStoredEnvelope(await deps.kv.get(key));
    if (staleLedgerPush(existingEnvelope, envelope)) {
      return json(409, {
        ok: false,
        tenant,
        error: 'stale ledger push rejected',
        existingDerivedAt: existingEnvelope?.derivedAt,
        incomingDerivedAt: envelope.derivedAt,
      });
    }
    if (wouldRegressBranchStories(existingEnvelope, envelope)) {
      return json(409, {
        ok: false,
        tenant,
        error: 'branchStories regression rejected',
        existingDerivedAt: existingEnvelope?.derivedAt,
        incomingDerivedAt: envelope.derivedAt,
      });
    }
    const body = JSON.stringify(envelope);
    await deps.kv.put(key, body);
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
  if (routePath.startsWith('/v1/bridge/')) {
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

    if (method === 'POST' && routePath === '/v1/bridge/ingest') {
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

    if (method === 'GET' && routePath.startsWith('/v1/bridge/inbox/')) {
      if (!principal.admin) return json(403, { error: 'inbox is cofounder-only' });
      const tenant = tenantOf(path, '/v1/bridge/inbox/');
      if (!tenant) return json(400, { error: 'bad tenant' });
      const messages = await bridgeStore.listUpstream(tenant, 100);
      return json(200, { tenant, count: messages.length, messages });
    }

    if (method === 'POST' && routePath === '/v1/bridge/assign-task') {
      if (!principal.admin && !principal.assignmentOnly) return json(403, { error: 'only cofounders/Hermes may enqueue task assignments' });
      let msg: any;
      try { msg = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      return queueProjectTaskAssignment(bridgeStore, msg, nowIso, deps.uuid);
    }

    if (method === 'POST' && routePath === '/v1/bridge/role-task') {
      if (!principal.admin && !principal.assignmentOnly) return json(403, { error: 'only cofounders/Hermes may enqueue role tasks' });
      if (!deps.bridgeStore) return json(503, { error: 'durable role task store unavailable' });
      let msg: unknown;
      try { msg = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      if (!isRecord(msg)) return json(400, { error: 'role task body must be an object' });
      return queueRoleTask(deps.bridgeStore, msg, deps.roleTaskBindingsJson, nowIso, deps.uuid);
    }

    if (method === 'POST' && routePath === '/v1/bridge/topic-assignment') {
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

    if (method === 'GET' && routePath === '/v1/bridge/action-requests') {
      if (!principal.admin && !principal.assignmentOnly) return json(403, { error: 'only cofounders/Hermes may list action requests' });
      const params = new URLSearchParams(path.includes('?') ? path.slice(path.indexOf('?') + 1) : '');
      const result = await listActionRequestRecords(deps.kv, {
        tenantId: String(params.get('tenantId') || params.get('tenant') || 'cambium'),
        branchId: String(params.get('branchId') || ''),
        status: String(params.get('status') || ''),
        limit: Number(params.get('limit') || 50),
      });
      return json(result.status, result.body);
    }

    if (method === 'POST' && routePath === '/v1/bridge/action-requests') {
      if (!principal.admin && !principal.assignmentOnly) return json(403, { error: 'only cofounders/Hermes may create action requests' });
      let body: any;
      try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const result = await createActionRequestRecord(deps.kv, body, nowIso);
      return json(result.status, result.body);
    }

    const actionRequestResolve = routePath.match(/^\/v1\/bridge\/action-requests\/([^/]+)\/resolve$/);
    if (method === 'POST' && actionRequestResolve) {
      if (!principal.admin && !principal.assignmentOnly) return json(403, { error: 'only cofounders/Hermes may resolve action requests' });
      let body: any;
      try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const id = decodeURIComponent(actionRequestResolve[1]);
      const result = await resolveActionRequestRecord(deps.kv, id, body, nowIso);
      return json(result.status, result.body);
    }

    if (method === 'POST' && routePath === '/v1/bridge/github-command') {
      if (!principal.admin) return json(403, { error: 'only cofounders/Hermes may execute GitHub commands' });
      if (!deps.githubCommand) return json(503, { error: 'GitHub command executor not configured' });
      let body: any;
      try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const command = validateGithubCommand(body, deps.githubAllowedRepos);
      if ('error' in command) return json(400, command);
      // Replay protection + write rate limiting apply only to real (non-dry-run) mutating
      // verbs. idempotencyKey is validated upstream but must be CONSULTED before the write,
      // mirroring the /api/gate idempotency pattern. KvLike has no native TTL, so expiry is
      // embedded in the stored record (same shape as the member-token tokenExp pattern).
      const isWrite = isGithubWriteCommand(command.commandId) && !command.dryRun;
      const ghNowMs = deps.nowMs ? deps.nowMs() : Date.now();
      if (isWrite) {
        const replayed = await readGithubIdempotent(deps.kv, command.idempotencyKey, ghNowMs);
        if (replayed) return json(200, { ...replayed, duplicate: true });
        const rate = await touchGithubWriteRate(deps.kv, command.actorId, command.repo, ghNowMs);
        if (!rate.allowed) return json(429, { error: 'GitHub write rate limit exceeded', retryAfterMs: rate.retryAfterMs });
      }
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
      // Store the result for replay only on success: a failed/transient write leaves the
      // idempotencyKey free to retry, while a duplicate successful write is fenced out.
      if (isWrite && result.ok) await storeGithubIdempotent(deps.kv, command.idempotencyKey, result, ghNowMs);
      if (!result.ok) return json(result.status && result.status >= 400 ? result.status : 400, result);
      return json(200, result);
    }

    if (method === 'POST' && routePath === '/v1/bridge/business-tasks') {
      if (!principal.admin) return json(403, { error: 'only cofounders/Hermes may create business tasks' });
      if (!deps.businessStore) return json(503, { error: 'durable business task store unavailable' });
      let raw: unknown;
      try { raw = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const parsed = parseBusinessTaskIntake(raw);
      if (!parsed.intake) return json(400, { error: parsed.error, ...(parsed.code ? { code: parsed.code } : {}) });
      const intake = parsed.intake;
      const identityHash = await sha256hex(`thoughtseed.business_task_intake.v1\u0000${intake.idempotencyKey}`);
      const gsdTaskId = `gsd-service-agreement-${identityHash.slice(0, 32)}`;
      const directiveId = `business-service-agreement-${identityHash.slice(0, 32)}`;
      const createdAt = nowIso();
      const input: ServiceAgreementDraftInput = {
        schema: 'thoughtseed.legal.service_agreement_draft_input.v1',
        workflowId: 'thoughtseed.legal.service-agreement.draft.v1',
        tenantId: 'thoughtseed',
        projectId: intake.project.projectId,
        clientId: intake.project.clientId,
        gsdTaskId,
        synthetic: true,
        intent: intake.intent,
        documentKind: 'service_agreement',
        clientDisplayName: 'Thoughtseed Systems Test Client',
        projectName: intake.project.projectName,
        projectSummary: intake.project.projectSummary,
        engagementType: 'fixed_price',
        currency: 'INR',
        feeMinor: intake.commercial.feeMinor,
        deliverables: intake.project.deliverables,
        outOfScope: intake.project.outOfScope,
        approval: intake.approval,
        externalAction: 'none',
      };
      const task: BridgeBusinessTaskRecord = {
        businessTaskId: gsdTaskId,
        gsdTaskId,
        idempotencyKey: intake.idempotencyKey,
        intentDigest: `sha256:${await sha256hex(canonicalJson(intake))}`,
        directiveId,
        directiveSchema: 'thoughtseed.hermes.native_execution.v1',
        memberId: intake.memberId,
        tenantId: 'thoughtseed',
        projectId: intake.project.projectId,
        clientId: intake.project.clientId,
        workflowId: 'thoughtseed.legal.service-agreement.draft.v1',
        status: 'queued',
        request: intake as unknown as Record<string, unknown>,
        approvalScope: 'internal_canary_draft_only',
        approvalObservationId: intake.approval.observationId,
        approvalObservedAt: intake.approval.observedAt,
        synthetic: true,
        externalAction: 'none',
        createdAt,
        updatedAt: createdAt,
      };
      const createResult = await deps.businessStore.createTask(task);
      if (createResult === 'conflict') return json(409, { error: 'business task idempotency conflict' });
      const directive = {
        id: directiveId,
        memberId: intake.memberId,
        tenantId: 'thoughtseed',
        idempotencyKey: intake.idempotencyKey,
        direction: 'downstream',
        delivered: false,
        enqueuedAt: createdAt,
        payload: {
          type: 'native_execution',
          schema: 'thoughtseed.hermes.native_execution.v1',
          command: 'service_agreement.draft.render',
          target: { memberId: intake.memberId },
          input,
        },
      };
      await bridgeStore.putDirectiveIfAbsent(intake.memberId, directiveId, directive);
      const persisted = await bridgeStore.getDirective(intake.memberId, directiveId);
      const contract = nativeExecutionContract(persisted, intake.memberId, directiveId);
      if (!contract || contract.command !== 'service_agreement.draft.render'
        || contract.idempotencyKey !== intake.idempotencyKey
        || canonicalJson(contract.input) !== canonicalJson(input)) {
        return json(409, { error: 'business directive identity conflict' });
      }
      return json(200, {
        ok: true,
        businessTaskId: gsdTaskId,
        gsdTaskId,
        directiveId,
        status: (await deps.businessStore.getTask(gsdTaskId))?.status ?? 'queued',
        ...(createResult === 'duplicate' ? { duplicate: true } : {}),
      });
    }

    const businessTaskRead = routePath.match(/^\/v1\/bridge\/business-tasks\/([^/]+)$/);
    if (method === 'GET' && businessTaskRead) {
      if (!deps.businessStore) return json(503, { error: 'durable business task store unavailable' });
      const taskId = decodeURIComponent(businessTaskRead[1]);
      if (!BUSINESS_SAFE_ID.test(taskId)) return json(400, { error: 'invalid business task id' });
      const task = await deps.businessStore.getTask(taskId);
      if (!task) return json(404, { error: 'business task not found' });
      if (!mayAct(task.memberId)) return json(403, { error: 'token not scoped to this business task' });
      return json(200, { task });
    }

    const businessArtifactRead = routePath.match(/^\/v1\/bridge\/business-artifacts\/([^/]+)$/);
    if (method === 'GET' && businessArtifactRead) {
      if (!deps.businessStore) return json(503, { error: 'durable business task store unavailable' });
      const taskId = decodeURIComponent(businessArtifactRead[1]);
      if (!BUSINESS_SAFE_ID.test(taskId)) return json(400, { error: 'invalid business task id' });
      const task = await deps.businessStore.getTask(taskId);
      if (!task) return json(404, { error: 'business task not found' });
      if (!mayAct(task.memberId)) return json(403, { error: 'token not scoped to this business task' });
      const artifact = await deps.businessStore.getArtifact(taskId);
      return artifact ? json(200, artifact) : json(404, { error: 'business artifact not found' });
    }

    if (method === 'POST' && routePath === '/v1/bridge/executions/artifact') {
      if (!deps.executionStore || !deps.businessStore) return json(503, { error: 'durable business execution stores unavailable' });
      let raw: unknown;
      try { raw = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const upload = parseBusinessArtifactUpload(raw);
      if (!upload) return json(400, { error: 'invalid business artifact upload contract' });
      if (!mayAct(upload.memberId)) return json(403, { error: 'token not scoped to this member' });
      const task = await deps.businessStore.getTask(upload.gsdTaskId);
      const directive = await bridgeStore.getDirective(upload.memberId, upload.directiveId);
      const contract = nativeExecutionContract(directive, upload.memberId, upload.directiveId);
      if (!task || !contract || contract.command !== 'service_agreement.draft.render'
        || task.memberId !== upload.memberId
        || task.directiveId !== upload.directiveId
        || task.idempotencyKey !== upload.idempotencyKey
        || task.gsdTaskId !== upload.gsdTaskId
        || contract.idempotencyKey !== upload.idempotencyKey
        || contract.input.gsdTaskId !== upload.gsdTaskId) {
        return json(409, { error: 'business artifact execution contract mismatch' });
      }
      const identity = await nativeExecutionIdentity(upload.memberId, upload.directiveId, contract);
      if (identity.executionId !== upload.executionId) return json(409, { error: 'business artifact execution identity mismatch' });
      const active = await deps.executionStore.verifyActiveClaim({
        memberId: upload.memberId,
        directiveId: upload.directiveId,
        idempotencyKey: upload.idempotencyKey,
        executionId: upload.executionId,
        runnerId: upload.runnerId,
        hostIdentity: upload.hostIdentity,
        claimId: upload.claimId,
        fencingToken: upload.fencingToken,
        attempt: upload.attempt,
        observedAt: nowIso(),
      });
      if (!active) return json(409, { error: 'fencing_conflict', code: 'stale_fence' });
      const digest = `sha256:${await sha256Bytes(upload.artifact.bytes)}`;
      const expectedArtifactId = `artifact_${(await sha256hex(`${upload.gsdTaskId}\u0000thoughtseed.hermes.native_execution.v1`)).slice(0, 32)}`;
      const expectedFileName = `Service_Agreement_${expectedArtifactId}_DRAFT.docx`;
      const hasZipMagic = upload.artifact.bytes[0] === 0x50
        && upload.artifact.bytes[1] === 0x4b
        && upload.artifact.bytes[2] === 0x03
        && upload.artifact.bytes[3] === 0x04;
      if (digest !== upload.artifact.digest
        || expectedArtifactId !== upload.artifact.id
        || upload.artifact.fileName !== expectedFileName
        || !hasZipMagic) {
        return json(409, { error: 'business artifact digest or identity mismatch' });
      }
      const recordedAt = nowIso();
      const result = await deps.businessStore.putArtifact({
        task,
        executionId: upload.executionId,
        artifactId: upload.artifact.id,
        digest,
        byteLength: upload.artifact.byteLength,
        contentType: upload.artifact.contentType,
        fileName: upload.artifact.fileName,
        bytes: upload.artifact.bytes,
        contentPolicyId: upload.policies.contentPolicyId,
        contentPolicyDigest: upload.policies.contentPolicyDigest,
        rendererPolicyId: upload.policies.rendererPolicyId,
        rendererPolicyDigest: upload.policies.rendererPolicyDigest,
        recordedAt,
      });
      return json(200, result);
    }

    if (method === 'POST' && routePath === '/v1/bridge/executions/claim') {
      if (!deps.executionStore) return json(503, { error: 'durable execution store unavailable' });
      let raw: unknown;
      try { raw = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const claim = executionClaimBody(raw);
      if (!claim) return json(400, { error: 'invalid execution claim contract' });
      if (!mayAct(claim.memberId)) return json(403, { error: 'token not scoped to this member' });

      const directive = await bridgeStore.getDirective(claim.memberId, claim.directiveId);
      const contract = nativeExecutionContract(directive, claim.memberId, claim.directiveId);
      if (!contract) {
        return json(409, { error: 'directive is not an executable native directive for this member' });
      }
      if (claim.idempotencyKey !== contract.idempotencyKey) {
        return json(409, { error: 'directive idempotency key mismatch' });
      }
      const identity = await nativeExecutionIdentity(claim.memberId, claim.directiveId, contract);

      const claimedAt = nowIso();
      const claimedAtMs = Date.parse(claimedAt);
      if (!Number.isFinite(claimedAtMs)) return json(500, { error: 'execution clock unavailable' });
      const result = await deps.executionStore.claimExecution({
        ...claim,
        inputDigest: identity.inputDigest,
        claimId: `claim_${deps.uuid ? deps.uuid() : randomTokenHex()}`,
        fencingToken: `fence_${randomTokenHex()}`,
        claimedAt,
        leaseExpiresAt: new Date(claimedAtMs + EXECUTION_LEASE_MS).toISOString(),
      });
      if (result.status === 'busy') return json(409, result);
      if (result.status === 'conflict') return json(409, { error: result.reason });
      if (result.status === 'claimed' && contract.command === 'service_agreement.draft.render') {
        if (!deps.businessStore) return json(503, { error: 'durable business task store unavailable' });
        await deps.businessStore.markLeased(contract.input.gsdTaskId, identity.executionId, claimedAt);
      }
      return json(200, result);
    }

    if (method === 'POST' && routePath === '/v1/bridge/executions/outcome') {
      if (!deps.executionStore) return json(503, { error: 'durable execution store unavailable' });
      let raw: unknown;
      try { raw = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const outcome = executionOutcomeBody(raw);
      if (!outcome) return json(400, { error: 'invalid execution outcome contract' });
      if (!mayAct(outcome.memberId)) return json(403, { error: 'token not scoped to this member' });
      const directive = await bridgeStore.getDirective(outcome.memberId, outcome.directiveId);
      const contract = nativeExecutionContract(directive, outcome.memberId, outcome.directiveId);
      if (!contract || contract.idempotencyKey !== outcome.idempotencyKey) {
        return json(409, { error: 'execution directive contract mismatch' });
      }
      if (!await validExecutionAttestation(contract, outcome)) {
        return json(409, { error: 'execution attestation verification failed' });
      }
      if (contract.command === 'service_agreement.draft.render') {
        if (!deps.businessStore) return json(503, { error: 'durable business task store unavailable' });
        const task = await deps.businessStore.getTask(contract.input.gsdTaskId);
        if (!task || task.executionId !== outcome.executionId) {
          return json(409, { error: 'business task execution state mismatch' });
        }
        if (outcome.status === 'executed' && !sameBusinessReceipt(task.receipt, outcome.attestation.businessReceipt)) {
          return json(409, { error: 'business artifact receipt is not durably stored' });
        }
      }
      const attestationDigest = `sha256:${await sha256hex(canonicalJson(outcome.attestation))}`;
      const result = await deps.executionStore.recordExecutionOutcome({
        ...outcome,
        attestationDigest,
        recordedAt: nowIso(),
      });
      if (result.status === 'conflict') {
        return result.reason === 'fencing_conflict'
          ? json(409, { error: result.reason, code: 'stale_fence' })
          : json(409, { error: result.reason });
      }
      if (contract.command === 'service_agreement.draft.render') {
        await deps.businessStore!.markOutcome(
          contract.input.gsdTaskId,
          outcome.status === 'executed' ? 'awaiting_human_approval' : outcome.status === 'failed' ? 'failed' : 'retrying',
          nowIso(),
        );
      }
      return json(200, {
        recorded: true,
        terminal: result.terminal,
        ...(result.duplicate ? { duplicate: true } : {}),
      });
    }

    if (method === 'POST' && routePath === '/v1/bridge/directive') {
      if (!principal.admin) return json(403, { error: 'only cofounders/Hermes may enqueue directives' });
      let msg: any;
      try { msg = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const memberId = msg.memberId ?? msg.payload?.target?.memberId;
      if (!memberId || !VALID_TENANT.test(String(memberId))) return json(400, { error: 'directive needs a valid memberId (top-level or payload.target.memberId)' });
      if (!msg.payload) return json(400, { error: 'directive needs a payload' });
      const id = msg.id ?? (deps.uuid ? deps.uuid() : `b_${memberId}_${nowIso()}`);
      if (!executionText(id)) return json(400, { error: 'directive id must be a bounded identifier' });
      const stored = { ...msg, id, memberId, direction: 'downstream', delivered: false, enqueuedAt: nowIso() };
      const existing = await bridgeStore.getDirective(String(memberId), String(id));
      const incomingPayload = isRecord(stored.payload) ? stored.payload : null;
      const existingPayload = isRecord(existing?.payload) ? existing.payload : null;
      const incomingNative = incomingPayload?.type === 'native_execution';
      const existingNative = existingPayload?.type === 'native_execution';
      if (incomingNative || existingNative) {
        if (!incomingNative) return json(409, { error: 'native directive identity conflict' });
        const incomingContract = nativeExecutionContract(stored, String(memberId), String(id));
        if (!incomingContract) return json(400, { error: 'invalid native execution directive contract' });
        await bridgeStore.putDirectiveIfAbsent(String(memberId), String(id), stored);
        const persisted = await bridgeStore.getDirective(String(memberId), String(id));
        const persistedContract = nativeExecutionContract(persisted, String(memberId), String(id));
        if (!persisted || !persistedContract || !sameNativeExecutionContract(persistedContract, incomingContract)) {
          return json(409, { error: 'native directive identity conflict' });
        }
        const duplicate = existing !== null;
        return json(200, {
          ok: true,
          id,
          memberId,
          queued: persisted.delivered !== true,
          ...(persisted.delivered === true ? { delivered: true } : {}),
          ...(duplicate ? { duplicate: true } : {}),
        });
      }
      await bridgeStore.putDirective(String(memberId), String(id), stored);
      const persisted = await bridgeStore.getDirective(String(memberId), String(id));
      const persistedPayload = isRecord(persisted?.payload) ? persisted.payload : null;
      if (persistedPayload?.type === 'native_execution') {
        return json(409, { error: 'native directive identity conflict' });
      }
      return json(200, { ok: true, id, memberId, queued: true });
    }

    if (method === 'GET' && routePath.startsWith('/v1/bridge/directives/')) {
      const member = routePath.slice('/v1/bridge/directives/'.length).replace(/\/+$/, '');
      if (!VALID_TENANT.test(member)) return json(400, { error: 'bad member' });
      if (!mayAct(member)) return json(403, { error: 'token not scoped to this member' });
      const pending = await bridgeStore.listPendingDirectives(member, 100);
      return json(200, { member, count: pending.directives.length, skipped: pending.skipped, directives: pending.directives });
    }

    if (method === 'POST' && routePath === '/v1/bridge/ack') {
      let body: any;
      try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const member = body.memberId; const ids = Array.isArray(body.ids) ? body.ids : [];
      if (!member || !ids.length) return json(400, { error: 'ack needs memberId + ids[]' });
      if (!mayAct(member)) return json(403, { error: 'token not scoped to this member' });
      const normalizedIds = ids.map((id: unknown) => executionText(id)).filter((id: string | null): id is string => Boolean(id));
      if (normalizedIds.length !== ids.length) return json(400, { error: 'ack ids must be bounded identifiers' });
      const nativeContracts = new Map<string, BridgeExecutionContractIdentity>();
      for (const id of normalizedIds) {
        const directive = await bridgeStore.getDirective(String(member), id);
        const payload = isRecord(directive?.payload) ? directive.payload : null;
        if (payload?.type !== 'native_execution') continue;
        const contract = nativeExecutionContract(directive, String(member), id);
        if (!contract) {
          return json(409, { ok: false, error: 'native directive contract is invalid', refused: [id] });
        }
        nativeContracts.set(id, await nativeExecutionIdentity(String(member), id, contract));
      }
      if (nativeContracts.size && !deps.executionStore) {
        return json(503, { error: 'durable execution store unavailable for native ACK' });
      }
      const refused: string[] = [];
      for (const [id, identity] of nativeContracts) {
        if (!await deps.executionStore!.hasTerminalExecution(String(member), id, identity)) refused.push(id);
      }
      if (refused.length) {
        return json(409, {
          ok: false,
          error: 'terminal execution outcome required before ACK',
          refused,
        });
      }
      let acked = 0;
      for (const id of normalizedIds) {
        const identity = nativeContracts.get(id);
        if (identity) {
          if (await deps.executionStore!.acknowledgeTerminalDirective(String(member), id, identity, nowIso())) acked++;
        } else if (await bridgeStore.markDirectiveDelivered(String(member), id, nowIso())) {
          acked++;
        }
      }
      return json(200, { ok: true, acked });
    }

    return json(404, { error: `no bridge route for ${method} ${path}` });
  }

  // ── Secure member handoff: invites → per-member bridge tokens → rotation ──
  // Admin ops (add/list/invite/revoke) need the BRIDGE_TOKEN; redeem/rotate are
  // public (gated by the signed invite / the member's current token). The issued
  // per-member token is what the member's Plexus uses for the scoped bridge auth.
  if (routePath.startsWith('/v1/handoff/')) {
    if (!deps.handoffSecret || !deps.bridgeToken) return json(503, { error: 'handoff not configured on the worker' });
    const nowMs = deps.nowMs ? deps.nowMs() : Date.now();
    const nowIso = () => (deps.now ? deps.now() : new Date().toISOString());
    const isAdmin = (req.headers['authorization'] ?? '') === `Bearer ${deps.bridgeToken}`;
    const readJson = (): any => { try { return JSON.parse(req.body ?? ''); } catch { return undefined; } };

    if (method === 'POST' && routePath === '/v1/handoff/members') {
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

    if (method === 'GET' && routePath === '/v1/handoff/members') {
      if (!isAdmin) return json(401, { error: 'admin token required' });
      const keys = await deps.kv.list('member:');
      const members: any[] = [];
      for (const k of keys) { const v = await deps.kv.get(k); if (v) { const m = JSON.parse(v);
        members.push({ memberId: m.memberId, tenantId: m.tenantId ?? m.memberId, email: m.email, status: m.status, tokenExpiresAt: m.tokenExp ? new Date(m.tokenExp).toISOString() : null }); } }
      return json(200, { count: members.length, members });
    }

    if (method === 'POST' && routePath === '/v1/handoff/invite') {
      if (!isAdmin) return json(401, { error: 'admin token required' });
      const b = readJson(); if (!b) return json(400, { error: 'body is not JSON' });
      const memberId = String(b.memberId ?? '').toLowerCase();
      const raw = await deps.kv.get(memberKey(memberId));
      if (!raw) return json(404, { error: 'member not in allowlist — POST /v1/handoff/members first' });
      const member = JSON.parse(raw);
      const base = String(b.linkBase ?? deps.publicBaseUrl ?? '').replace(/\/+$/, '');
      if (!base) return json(503, { error: 'public base URL unavailable' });
      const jti = deps.uuid ? deps.uuid() : randomTokenHex().slice(0, 16);
      const exp = nowMs + INVITE_TTL_MS;
      const invite = await signInvite(deps.handoffSecret, { memberId, tenantId: member.tenantId ?? memberId, email: member.email, jti, exp });
      await deps.kv.put(inviteKey(jti), JSON.stringify({ jti, memberId, email: member.email, exp, used: false, createdAt: nowIso() }));
      return json(200, { ok: true, memberId, email: member.email, expiresAt: new Date(exp).toISOString(), invite, link: `${base}/join?t=${invite}` });
    }

    if (method === 'POST' && routePath === '/v1/handoff/revoke') {
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

    if (method === 'POST' && routePath === '/v1/handoff/redeem') {
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

    if (method === 'POST' && routePath === '/v1/handoff/rotate') {
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

  if (method === 'POST' && routePath.startsWith('/api/gate/')) {
    const tenant = tenantOf(path, '/api/gate/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    // M3 isolation suite is green — gate open to all valid tenants
    if (!deps.gate) return json(503, { error: 'gate not configured' });
    let body: any;
    try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
    if (!['approve', 'reroll', 'promote-skill', 'queue-side-quest', 'confirm-action-request'].includes(body.kind) || !(body.subject || body.actionRequestId)) {
      return json(400, { error: 'need kind approve|reroll|promote-skill|queue-side-quest|confirm-action-request and subject' });
    }
    const verdict = await validateInitData(String(body.initData ?? ''), deps.gate);
    if (!verdict.ok) return json(401, { error: verdict.reason });
    const kind = body.kind as GateActionKind;
    if (kind === 'confirm-action-request') {
      const actionRequestId = shortText(body.actionRequestId || body.subject, '', 160);
      if (!actionRequestId) return json(400, { error: 'confirm-action-request needs actionRequestId' });
      const result = await confirmSignedActionRequestRecord(deps.kv, actionRequestId, {
        ...body,
        tenantId: tenant,
        founderTelegramUserId: verdict.userId,
      }, () => (deps.now ? deps.now() : new Date().toISOString()));
      return json(result.status, result.body);
    }
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

  if (method === 'GET' && routePath.startsWith('/internal/gate/') && !routePath.endsWith('/consume')) {
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
    const actionRequests = await listActionRequestRecords(deps.kv, { tenantId: tenant, status: 'queued', limit: 100 });
    const rows = Array.isArray(actionRequests.body.rows) ? actionRequests.body.rows : [];
    actions.push(...rows.map((row) => ({ ...row, kind: 'action-request' })));
    return json(200, { tenant, actions });
  }

  if (method === 'POST' && routePath.startsWith('/internal/gate/') && routePath.endsWith('/consume')) {
    const tenant = tenantOf(routePath.slice(0, -'/consume'.length), '/internal/gate/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    if (!deps.pushToken) return json(503, { error: 'push token not configured on the worker' });
    if ((req.headers['authorization'] ?? '') !== `Bearer ${deps.pushToken}`) return json(401, { error: 'bad or missing bearer' });
    let body: any;
    try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
    if (body.kind === 'action-request') {
      const result = await consumeActionRequestRecord(
        deps.kv,
        tenant,
        String(body.id ?? ''),
        () => (deps.now ? deps.now() : new Date().toISOString()),
      );
      return json(result.status, result.body);
    }
    const key = `gate:${tenant}:${body.id}`;
    const stored = await deps.kv.get(key);
    if (!stored) return json(404, { error: 'unknown action' });
    const action = { ...JSON.parse(stored), status: 'consumed', result: body.result ?? null, consumedAt: new Date().toISOString() };
    await deps.kv.put(key, JSON.stringify(action));
    return json(200, { consumed: body.id });
  }

  if (method === 'GET' && (routePath === '/' || routePath === '/index.html')) {
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

  // req.path may carry a query string (context routes parse it via new URL); match provider
  // routes on the pathname only so calls like /v1/providers/<id>/chat/completions?stream=true
  // route correctly instead of failing the upstream-path validator below.
  const path = fabricRoutePath(req.path);

  if (req.method === 'GET' && (path === '/v1/providers' || path === '/v1/providers/health')) {
    const providers = configuredProviders(cfg);
    return json(200, {
      ok: true,
      broker: 'cambium-provider-broker',
      providers,
      count: providers.length,
    });
  }

  const match = path.match(/^\/v1\/providers\/([a-z0-9-]+)(?:\/(.*))?$/);
  if (!match) return json(404, { error: `no provider route for ${req.method} ${path}` });
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
