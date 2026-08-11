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
import { IVerifExpleeError, isIVerifPersonId } from './iverif-explee.ts';
import type { IVerifExpleeObserver, IVerifExpleeSource } from './iverif-explee.ts';
import { IVERIF_GROUNDING } from './iverif-grounding.ts';
import { runIverifCaptureEnrich } from './lead-runtime.ts';
import type { LeadRuntimeStoreLike } from './lead-runtime-store.ts';
import {
  MARKETING_CREATE_ADAPTER_ID,
  MARKETING_CREATE_EXPECTED_ACTIVATION,
  MarketingRendererError,
  executeMarketingRender,
  parseMarketingExecuteInput,
  prepareMarketingRender,
} from './marketing-renderer.ts';
import type { MarketingRenderStoreLike } from './marketing-renderer.ts';
import { THOUGHTSEED_TELEGRAM_CHAT_ID, TOPIC_QUEST_ROUTES } from './telegram-routing.ts';
import {
  claimProactiveDeliveries,
  compileProactiveLoopPlan,
  readFounderApproval,
  readPendingProactiveDeliveries,
  readProactiveLoopPlan,
  runAndStoreProactiveLoopTick,
  writeFounderApproval,
} from './proactive-loop-runtime.ts';
import { MINI_APP_SECTIONS, MINI_APP_MAP_SUBSECTIONS } from './mini-app-surface-contract.ts';
import { filterSections, filterSubsections, type Principal } from './rbac.ts';
import { createInvite as createConsultantInvite, verifyInvite as verifyConsultantInvite } from './invites.ts';
import { resolvePlexusPrincipal, type PlexusGateConfig } from './lib/plexus-principal.ts';
import { buildBranchMapProjection, projectionDigest } from './branch-map.ts';
import {
  MISSION_FABRIC_CAPS,
  adaptBranchStories,
  adaptCompanyPrograms,
  adaptGoalGraphAuthority,
  adaptQuestExecutionFacts,
  projectionDigest as missionFabricProjectionDigest,
  redactMissionFabricProjection,
} from './mission-fabric.ts';
import type { FabricEdge, FabricGap, FabricNode, MissionFabricProjectionV1, MissionFabricViewer } from './mission-fabric.ts';
import { BRANCH_MAP_RECEIPT_READ_LIMIT } from './branch-map-receipt-store.ts';
import type { BranchMapReceiptStoreLike } from './branch-map-receipt-store.ts';
import { renderBranchMapSheet } from './branch-map-sheet.ts';
import {
  PORTFOLIO_CATALOG,
  buildPortfolioJoinReport,
  portfolioCatalogForViewer,
  portfolioPairDigest,
} from './portfolio-catalog.ts';
import {
  ORGAN_UPDATE_PLAN,
  ORGAN_UPDATE_SUMMARY,
  compileOrganUpdateDelivery,
} from './organ-update-delivery.ts';
import { PORTFOLIO_WORKBENCH_HTML } from './portfolio-workbench.generated.ts';
import {
  PORTFOLIO_WORKBENCH_ACCESS_DENIED,
  PORTFOLIO_WORKBENCH_CSP,
  PORTFOLIO_WORKBENCH_LOADER,
  PORTFOLIO_WORKBENCH_LOADER_CSP,
} from './portfolio-workbench.ts';
import {
  PortfolioAdminActionConflictError,
  PortfolioAdminActionQueueError,
  PortfolioAdminActionStorageError,
  PortfolioAdminActionValidationError,
  createPortfolioFounderGateResolver,
  recordPortfolioAdminAction,
} from './portfolio-admin-actions.ts';
import type {
  PortfolioAdminActionQueueLike,
  PortfolioAdminActionStoreLike,
} from './portfolio-admin-actions.ts';
import type { GoalGraphApproval, GoalGraphCommitResult, GoalGraphStoreLike } from './goal-graph-store.ts';
import { canonicalizeGoalGraphApproval, goalGraphApprovalDigest } from './goal-graph-store.ts';
import { parseTelegramGoalGraphIntent } from './goal-graph-intake.ts';
import type { GoalChangeSet, GoalGraphHead, GoalGraphNode } from './goal-graph/types.ts';
import { buildCommandCodeBody, commandCodeHeaders, translateStream, translateToCompletion } from './command-code-adapter.ts';

const FOUNDER_FALLBACK_PRINCIPAL: Principal = {
  id: 'anonymous-founder',
  tenant: '*',
  role: 'founder',
  allow: [],
  createdBy: 'system',
};

function resolveSurfacePrincipal(req: SimpleRequest): Principal | null {
  let fromQuery: string | undefined;
  const queryStart = req.path.indexOf('?');
  if (queryStart >= 0) {
    fromQuery = new URLSearchParams(req.path.slice(queryStart + 1)).get('principal') ?? undefined;
  }
  const raw = req.headers['x-principal'] ?? fromQuery;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(String(raw));
    if (
      parsed && typeof parsed === 'object' &&
      typeof parsed.id === 'string' &&
      typeof parsed.tenant === 'string' &&
      (parsed.role === 'founder' || parsed.role === 'team' || parsed.role === 'consultant') &&
      Array.isArray(parsed.allow) &&
      typeof parsed.createdBy === 'string'
    ) {
      return {
        id: parsed.id,
        tenant: parsed.tenant,
        role: parsed.role,
        allow: parsed.allow.filter((v: unknown) => typeof v === 'string'),
        createdBy: parsed.createdBy,
        ...(typeof parsed.expiresAt === 'string' ? { expiresAt: parsed.expiresAt } : {}),
      };
    }
  } catch { /* fall through to founder default */ }
  return FOUNDER_FALLBACK_PRINCIPAL;
}

async function surfaceScopedQuestBody(kv: KvLike, tenantId: string, stored: string, principal: Principal): Promise<string> {
  const base = await publicQuestBody(kv, tenantId, stored);
  try {
    const envelope = JSON.parse(base);
    envelope.surface = {
      sections: filterSections(MINI_APP_SECTIONS, principal),
      subsections: filterSubsections(MINI_APP_MAP_SUBSECTIONS, principal),
    };
    return JSON.stringify(envelope);
  } catch {
    return base;
  }
}

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
  inviteSecret?: string;
  providerBroker?: ProviderBrokerConfig; // Worker secrets for hosted provider proxying (unset → provider lane 503s)
  contextRoutes?: ContextRouteDeps; // Optional bounded context route providers (unset → context lane 503s)
  iverifReadToken?: string;     // Dedicated IVERIF_READ_TOKEN; never falls back to bridge/admin credentials.
  iverifProviderApiKey?: string; // Equality-check only; prevents the provider key from serving as route auth.
  iverifExplee?: IVerifExpleeObserver; // Fixed GET-only Explee observer (unset → IVerif observer 503s).
  leadRuntimeStore?: LeadRuntimeStoreLike; // D1-only canonical identity, task, spend, receipt, and foldback authority.
  marketingRenderStore?: MarketingRenderStoreLike; // D1-only preparation, approval, fencing, and replay authority.
  marketingRenderer?: {        // Exclusive Worker bindings; never included in providerBroker/contextRoutes.
    activation?: string;
    apiKey?: string;
    fetchImpl?: typeof fetch;
  };
  githubCommand?: GithubCommandExecutor; // Optional GitHub repo/issue command executor for Hermes manual commands.
  githubAllowedRepos?: string[]; // Same allowlist used by the GitHub command executor.
  uuid?: () => string;         // injectable for tests
  now?: () => string;          // injectable clock (ISO) for the bridge
  nowMs?: () => number;        // injectable epoch-ms clock for handoff TTLs
  publicBaseUrl?: string;      // deployed Worker base URL for invite/deep links
  goalGraphStore?: GoalGraphStoreLike; // D1 Goal Graph authority for read-only branch projections
  branchMapReceiptStore?: BranchMapReceiptStoreLike; // D1 append-only transition evidence
  branchMapTenants?: string[]; // server-owned allowlist for Telegram map reads
  missionFabricTenants?: string[]; // server-owned allowlist for operating-fabric composition reads; absent/empty disables all tenants
  missionFabricViewerIds?: string[]; // server-owned non-founder viewer allowlist for /v1/mission-fabric only; absent/empty authorizes founders only
  portfolioActionStore?: PortfolioAdminActionStoreLike; // Immutable R2 action evidence; never operational authority.
  portfolioActionQueue?: PortfolioAdminActionQueueLike; // Bounded pending-intake trigger; Goal Graph remains the sole operational writer.
  plexus?: PlexusGateConfig;   // CF Access + whoami role gate (unset → dev founder fallback)
  plexusFetchImpl?: typeof fetch; // test-only fetch injection for Access JWKS + whoami probes
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel?: string;
  models?: string[];
  // Header the upstream expects the key in. Anthropic-shaped providers (kimi-coding)
  // want `x-api-key`, not `authorization`. Defaults to authorization + Bearer.
  authHeader?: string;
  // Non-credential protocol headers this upstream requires, forwarded verbatim from
  // the caller. An explicit per-provider allowlist rather than a blanket copy: the
  // caller's own broker credential must never reach the upstream, and a wildcard
  // would eventually forward one. Command Code rejects requests without its
  // version/session headers, so for that provider these are load-bearing.
  forwardHeaders?: string[];
  // Server-owned headers for an authenticated fixed-destination egress hop. Values
  // come only from Worker bindings; caller credentials may never override them.
  staticHeaders?: Record<string, string>;
  // Providers whose wire format is not OpenAI chat need translating, not proxying.
  // Only 'command-code' exists today; the field is explicit so a future one has to
  // opt in rather than inherit a translation meant for someone else.
  translate?: 'command-code';
}

export interface ProviderBrokerConfig {
  token: string;
  providers: Record<string, ProviderConfig | undefined>;
  fetch?: typeof fetch;
  // Upstream inference can legitimately run long. This sits OUTSIDE the caller's own
  // target timeout (OmniRoute combos use 30-90s) so their failover fires first and is
  // attributable to a slot rather than to us. Unset means the default below.
  timeoutMs?: number;
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

type GateActionKind = 'approve' | 'reroll' | 'promote-skill' | 'queue-side-quest' | 'confirm-action-request' | 'approve-marketing-render' | 'approve-goal-graph';

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
const INVITE_MAX_TTL_MS = 30 * 24 * 3600 * 1000;
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

/** Authenticates the signed Telegram payload only: signature + freshness +
 *  user id parsing. Performs NO authorization — callers decide who the
 *  authenticated userId is allowed to act as. */
async function authenticateInitData(
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
  if (!userId) return { ok: false, reason: 'missing telegram user id' };
  return { ok: true, userId };
}

/** Public founder-gate contract: authenticates AND authorizes against
 *  founderIds. Unchanged behavior — every existing caller keeps founder-only
 *  semantics exactly as before. */
export async function validateInitData(
  initData: string,
  cfg: GateConfig,
): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
  const auth = await authenticateInitData(initData, cfg);
  if (!auth.ok) return auth;
  if (!cfg.founderIds.includes(auth.userId)) return { ok: false, reason: 'not a founder' };
  return auth;
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
  // Streamed upstreams (provider-broker SSE) hand back the body unread so tokens reach
  // the caller as they arrive; every other route still returns a plain string.
  body: string | ReadableStream;
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

const portfolioHtml = (status: number, body: string, contentSecurityPolicy: string): SimpleResponse => ({
  status,
  headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'private, no-store',
    'content-security-policy': contentSecurityPolicy,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  },
  body,
});

const portfolioFailClosed = (status: 401 | 503): SimpleResponse =>
  portfolioHtml(status, PORTFOLIO_WORKBENCH_ACCESS_DENIED, PORTFOLIO_WORKBENCH_CSP);

async function handlePortfolioWorkbenchRoute(
  req: SimpleRequest,
  deps: HandlerDeps,
  routePath: string,
): Promise<SimpleResponse> {
  if (req.method !== 'GET') {
    return {
      ...json(405, { error: 'portfolio workbench is GET-only' }),
      headers: { ...JSON_HEADERS, allow: 'GET' },
    };
  }
  if (routePath === '/admin/portfolio') {
    return portfolioHtml(200, PORTFOLIO_WORKBENCH_LOADER, PORTFOLIO_WORKBENCH_LOADER_CSP);
  }
  if (routePath === '/admin/portfolio/web') {
    if (!deps.plexus) return portfolioFailClosed(503);
    const resolved = await resolvePlexusPrincipal(
      req.headers,
      deps.plexus,
      {
        get: deps.kv.get.bind(deps.kv),
        async put() { /* portfolio browser route is read-only */ },
      },
      deps.plexusFetchImpl,
    );
    if (resolved.kind === 'unconfigured') return portfolioFailClosed(503);
    if (resolved.kind !== 'principal' || resolved.principal.role !== 'founder') {
      return portfolioFailClosed(401);
    }
    return portfolioHtml(200, PORTFOLIO_WORKBENCH_HTML, PORTFOLIO_WORKBENCH_CSP);
  }
  const gate = deps.gate;
  const gateConfigured = Boolean(
    gate?.botId.trim()
    && /^[0-9a-f]{64}$/i.test(gate.pubKeyHex.trim())
    && gate.founderIds.some((founderId) => founderId.trim()),
  );
  if (!gate || !gateConfigured) return json(503, { error: 'telegram auth is not configured' });
  const initData = (req.headers['x-telegram-init-data'] ?? '').trim();
  const auth = await validateInitData(initData, gate);
  if (!auth.ok) {
    return json(401, { error: 'telegram authentication failed' });
  }
  return portfolioHtml(200, PORTFOLIO_WORKBENCH_HTML, PORTFOLIO_WORKBENCH_CSP);
}

async function resolvePortfolioFounder(
  req: SimpleRequest,
  deps: HandlerDeps,
): Promise<{ kind: 'founder'; actorId: string } | { kind: 'unauthorized' } | { kind: 'unconfigured' }> {
  const accessAssertion = (req.headers['cf-access-jwt-assertion'] ?? '').trim();
  if (accessAssertion || (deps.plexus && !(req.headers['x-telegram-init-data'] ?? '').trim())) {
    if (!deps.plexus) return { kind: 'unconfigured' };
    const resolved = await resolvePlexusPrincipal(
      req.headers,
      deps.plexus,
      { get: deps.kv.get.bind(deps.kv), put: deps.kv.put.bind(deps.kv) },
      deps.plexusFetchImpl,
    );
    if (resolved.kind === 'unconfigured') return { kind: 'unconfigured' };
    if (resolved.kind !== 'principal' || resolved.principal.role !== 'founder') return { kind: 'unauthorized' };
    return { kind: 'founder', actorId: `plexus:${resolved.principal.id}` };
  }

  const gate = deps.gate;
  const gateConfigured = Boolean(
    gate?.botId.trim()
    && /^[0-9a-f]{64}$/i.test(gate.pubKeyHex.trim())
    && gate.founderIds.some((founderId) => founderId.trim()),
  );
  if (!gate || !gateConfigured) return { kind: 'unconfigured' };
  const auth = await validateInitData((req.headers['x-telegram-init-data'] ?? '').trim(), gate);
  if (!auth.ok) return { kind: 'unauthorized' };
  return { kind: 'founder', actorId: `telegram:${auth.userId}` };
}

async function handlePortfolioAdminActionRoute(
  req: SimpleRequest,
  deps: HandlerDeps,
): Promise<SimpleResponse> {
  if (req.method !== 'POST') {
    return {
      ...json(405, { error: 'portfolio admin actions are POST-only' }),
      headers: { ...JSON_HEADERS, allow: 'POST' },
    };
  }
  const founder = await resolvePortfolioFounder(req, deps);
  if (founder.kind === 'unconfigured') return json(503, { error: 'portfolio action authentication is not configured' });
  if (founder.kind !== 'founder') return json(401, { error: 'portfolio action authentication failed' });
  if (!deps.portfolioActionStore || !deps.portfolioActionQueue) {
    return json(503, { error: 'portfolio action persistence is not configured' });
  }
  const body = req.body ?? '';
  if (new TextEncoder().encode(body).byteLength > 16 * 1024) {
    return json(413, { error: 'portfolio action body is too large' });
  }
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return json(400, { error: 'portfolio action body must be JSON' });
  }
  try {
    const receipt = await recordPortfolioAdminAction(input, {
      store: deps.portfolioActionStore,
      queue: deps.portfolioActionQueue,
      founderGateResolver: createPortfolioFounderGateResolver(deps.kv),
      actorId: founder.actorId,
      now: () => (deps.now ? deps.now() : new Date().toISOString()),
    });
    return json(200, { ok: true, receipt });
  } catch (error) {
    if (error instanceof PortfolioAdminActionValidationError) {
      return json(400, { error: 'portfolio action validation failed' });
    }
    if (error instanceof PortfolioAdminActionConflictError) {
      return json(409, { error: 'portfolio action idempotency conflict' });
    }
    if (error instanceof PortfolioAdminActionQueueError) {
      return json(503, {
        error: 'portfolio action trigger is pending retry',
        durable: error.durable,
        receiptId: error.receiptId,
      });
    }
    if (error instanceof PortfolioAdminActionStorageError) {
      return json(503, { error: 'portfolio action persistence is unavailable' });
    }
    return json(503, { error: 'portfolio action is unavailable' });
  }
}

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

// ── Plexus daily standup projection ─────────────────────────────────────────
// A Plexus daily_agent_event upstream message is the member's standup evidence
// on the reporting plane (the member-scoped bridge is Plexus's primary
// reporting port to Hermes). The raw bridge inbox is cofounder-only, so on
// ingest we additionally project a bounded, redacted record that Hermes reads
// at GET /v1/bridge/standups/{tenant}/{memberId}. KV only, following the
// volatile-data precedent: the bridge inbox stays the raw record, this is a
// derived read model. The deterministic key (tenant + member + UTC date) makes
// re-ingest an idempotent re-projection — same date overwrites, never
// duplicates. The projector is the pure boundary: a non-standup or malformed
// payload yields null, never an exception, so projection can never break the
// ingest lane. Only whitelisted, capped fields cross: no raw payload dump, no
// tokens, no Telegram IDs, no renderer secrets.

const MEMBER_STANDUP_SCHEMA = 'cambium.member-standup.v1';
const MEMBER_STANDUP_LIST_SCHEMA = 'cambium.member-standup-list.v1';
const PLEXUS_DAILY_AGENT_EVENT_TYPE = 'daily_agent_event';
const MEMBER_STANDUP_DATE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const MEMBER_STANDUP_MEMBER = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const MEMBER_STANDUP_RECENT_LIMIT = 14;      // a digest never needs more than a fortnight
const MEMBER_STANDUP_MAX_ROWS = 8;           // projects/blockers served per record
const MEMBER_STANDUP_MAX_COUNT = 1_000_000;  // counts above this are telemetry noise

const memberStandupKey = (tenant: string, memberId: string, date: string): string =>
  `standup:${tenant}:${memberId}:${date}`;

const memberStandupPrefix = (tenant: string, memberId: string): string =>
  `standup:${tenant}:${memberId}:`;

function boundedStandupCount(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MEMBER_STANDUP_MAX_COUNT) : 0;
}

function standupProjectionFromMessage(msg: Record<string, unknown>, receivedAt: string): Record<string, unknown> | null {
  const payload = isRecord(msg.payload) ? msg.payload : null;
  if (!payload || payload.type !== PLEXUS_DAILY_AGENT_EVENT_TYPE) return null;
  const event = isRecord(payload.event) ? payload.event : {};
  const tenant = String(msg.tenantId ?? '');
  const memberId = String(msg.memberId ?? '');
  const date = shortText(payload.date ?? event.date, '', 10);
  if (!VALID_TENANT.test(tenant) || !MEMBER_STANDUP_MEMBER.test(memberId) || !MEMBER_STANDUP_DATE.test(date)) return null;
  const workSummary = isRecord(event.workSummary) ? event.workSummary : {};
  const evidence = isRecord(event.evidenceSummary) ? event.evidenceSummary : {};
  const projects = (Array.isArray(event.projectSummaries) ? event.projectSummaries : [])
    .flatMap((raw) => {
      if (!isRecord(raw)) return [];
      return [{
        projectId: shortText(raw.projectId, 'unknown', 160),
        name: shortText(raw.name, 'unnamed project', 240),
        totalSeconds: boundedStandupCount(raw.totalSeconds),
        entryCount: boundedStandupCount(raw.entryCount),
        evidenceStatus: shortText(raw.evidenceStatus, 'unknown', 40),
        repoFullName: shortText(raw.repoFullName, '', 160) || null,
      }];
    })
    .filter((project) => project.totalSeconds > 0 || project.entryCount > 0)
    .sort((a, b) =>
      b.totalSeconds - a.totalSeconds
      || b.entryCount - a.entryCount
      || a.name.localeCompare(b.name)
    )
    .slice(0, MEMBER_STANDUP_MAX_ROWS);
  const blockers = (Array.isArray(event.blockers) ? event.blockers : [])
    .slice(0, MEMBER_STANDUP_MAX_ROWS)
    .flatMap((raw) => {
      if (!isRecord(raw)) return [];
      const severity = shortText(raw.severity, 'info', 24);
      return [{
        id: shortText(raw.id, 'blocker', 160),
        label: shortText(raw.label, 'blocker label not served', 240),
        severity: ['info', 'warning', 'critical'].includes(severity) ? severity : 'info',
        source: shortText(raw.source, 'unknown', 40),
      }];
    });
  return {
    schema: MEMBER_STANDUP_SCHEMA,
    tenantId: tenant,
    memberId,
    date,
    eventId: shortText(payload.eventId ?? event.eventId, '', 160) || null,
    standupRecordId: shortText(event.standupRecordId, '', 160) || null,
    generatedAt: shortText(event.generatedAt, receivedAt, 64),
    receivedAt,
    workSeconds: boundedStandupCount(workSummary.totalDurationSeconds),
    entryCount: boundedStandupCount(workSummary.totalEntries),
    evidencedEntries: boundedStandupCount(evidence.evidencedEntries ?? workSummary.evidencedEntries),
    missingEvidenceEntries: boundedStandupCount(evidence.missingEvidenceEntries ?? workSummary.missingEvidenceEntries),
    proofStatus: shortText(evidence.proofStatus, 'unknown', 40),
    sessionGroupCount: boundedStandupCount(Array.isArray(event.sessionGroups) ? event.sessionGroups.length : 0),
    projects,
    blockers,
  };
}

/** A stored record is served only when it parses and carries the standup
 *  schema; anything else under the prefix is treated as absent. */
async function readMemberStandup(kv: KvLike, tenant: string, memberId: string, date: string): Promise<Record<string, unknown> | null> {
  const record = parseJsonObject(await kv.get(memberStandupKey(tenant, memberId, date)));
  return record && record.schema === MEMBER_STANDUP_SCHEMA ? record : null;
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
  source: 'temperance-operator' | 'hermes-telegram-operator';
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
    || (value.source !== 'temperance-operator' && value.source !== 'hermes-telegram-operator')
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
    const merged: Record<string, unknown> = { ...envelope };
    const actionRequests = await listActionRequestRecords(kv, { tenantId, limit: 50 });
    if (actionRequests.status === 200 && Number(actionRequests.body.count) >= 1) {
      merged.actionRequests = actionRequests.body;
    }
    // Pending Telegram goal-graph proposals are founder decisions too: project
    // them into the same envelope the gate scene renders (bounded rows only).
    const goalGraphRows = await listGoalGraphIntakeGateRows(kv, tenantId);
    if (goalGraphRows.length >= 1) {
      merged.goalGraphIntake = {
        schema: GOAL_GRAPH_GATE_ROW_LIST_SCHEMA,
        ok: true,
        tenantId,
        count: goalGraphRows.length,
        rows: goalGraphRows,
      };
    }
    return JSON.stringify(merged);
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

const IVERIF_ROUTE_PREFIX = '/v1/bridge/iverif';
const IVERIF_THREAD_PREFIX = `${IVERIF_ROUTE_PREFIX}/thread/`;
const IVERIF_READ_TOKEN_PREFIX = 'iverif-read-v1.';

function iverifGroundingReady(): boolean {
  return IVERIF_GROUNDING.schema === 'cambium.iverif-grounding.v1'
    && IVERIF_GROUNDING.binding.productId === 'iverif'
    && IVERIF_GROUNDING.binding.expleeProjectId === 16_763
    && IVERIF_GROUNDING.binding.expleeCampaignId === 45_711
    && IVERIF_GROUNDING.policy.providerMode === 'observe-only'
    && IVERIF_GROUNDING.policy.providerMutationEnabled === false
    && IVERIF_GROUNDING.policy.allowedProviderMethods.length === 1
    && IVERIF_GROUNDING.policy.allowedProviderMethods[0] === 'GET';
}

function iverifGroundingProjection() {
  return {
    schema: IVERIF_GROUNDING.schema,
    version: IVERIF_GROUNDING.snapshot.version,
    digest: IVERIF_GROUNDING.snapshot.digest,
    binding: IVERIF_GROUNDING.binding,
  };
}

function iverifReadCredentialReady(deps: HandlerDeps): boolean {
  const token = deps.iverifReadToken?.trim();
  if (!token || token.length < IVERIF_READ_TOKEN_PREFIX.length + 32 || token.length > 256
    || !token.startsWith(IVERIF_READ_TOKEN_PREFIX)) return false;
  const otherBearerTokens = [
    deps.bridgeToken,
    deps.assignmentToken,
    deps.pushToken,
    deps.providerBroker?.token,
    deps.contextRoutes?.token,
    deps.iverifProviderApiKey,
  ];
  return otherBearerTokens.every((candidate) => !candidate || candidate.trim() !== token);
}

function iverifPolicyProjection(autoReplyEnabled?: boolean) {
  const oneWriterConflict = autoReplyEnabled === true || IVERIF_GROUNDING.policy.oneWriterState !== 'proven';
  return {
    mode: 'observe',
    proofState: IVERIF_GROUNDING.policy.promotionState,
    allowedProviderMethods: IVERIF_GROUNDING.policy.allowedProviderMethods,
    sendEligible: false,
    oneWriterConflict,
    oneWriterConflictReason: autoReplyEnabled === true
      ? 'provider-auto-reply-enabled'
      : 'ownership-unproven',
    autoReplyEnabled: autoReplyEnabled ?? null,
    liveCampaignDrift: IVERIF_GROUNDING.policy.liveCampaignDrift,
  };
}

function iverifEnvelope(schema: string, source: IVerifExpleeSource) {
  return {
    schema,
    source: source.provider,
    observedAt: source.observedAt,
    grounding: iverifGroundingProjection(),
  };
}

function iverifErrorResponse(error: unknown): SimpleResponse {
  if (!(error instanceof IVerifExpleeError)) {
    return json(503, { error: 'iverif_observer_unavailable', retryable: true });
  }
  switch (error.code) {
    case 'bad_person_id':
      return json(400, { error: 'bad_person_id', retryable: false });
    case 'upstream_not_found':
      return json(404, { error: 'provider_record_not_found', retryable: false });
    case 'upstream_rate_limited':
      return json(429, {
        error: 'provider_rate_limited',
        retryable: true,
        ...(error.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: error.retryAfterSeconds }),
      });
    case 'upstream_timeout':
      return json(503, { error: 'provider_timeout', retryable: true });
    case 'upstream_unavailable':
      return json(503, { error: 'provider_unavailable', retryable: error.retryable });
    case 'upstream_auth_failed':
      return json(502, { error: 'provider_auth_failed', retryable: false });
    case 'upstream_invalid_response':
      return json(502, { error: 'provider_invalid_response', retryable: false });
    case 'not_configured':
      return json(503, { error: 'iverif_observer_not_configured', retryable: false });
  }
  return json(503, { error: 'iverif_observer_unavailable', retryable: false });
}

async function handleIVerifObserverRoute(
  req: SimpleRequest,
  deps: HandlerDeps,
  routePath: string,
): Promise<SimpleResponse> {
  if (!iverifGroundingReady() || !iverifReadCredentialReady(deps) || !deps.iverifExplee) {
    return json(503, { error: 'iverif_observer_not_configured' });
  }
  if ((req.headers.authorization ?? '') !== `Bearer ${deps.iverifReadToken}`) {
    return json(401, { error: 'bad or missing iverif read credential' });
  }
  if (req.method !== 'GET') {
    return {
      ...json(405, { error: 'iverif observer is GET-only' }),
      headers: { ...JSON_HEADERS, allow: 'GET' },
    };
  }

  try {
    if (routePath === `${IVERIF_ROUTE_PREFIX}/status`) {
      const snapshot = await deps.iverifExplee.getSnapshot();
      return json(200, {
        ...iverifEnvelope('cambium.iverif-observer.status.v1', snapshot.source),
        policy: iverifPolicyProjection(snapshot.autopilot.autoReplyEnabled),
        project: {
          projectId: snapshot.project.projectId,
          emailsSent: snapshot.project.emailsSent,
          totalReplies: snapshot.project.replies,
          replyRatePct: snapshot.project.replyRatePercent,
          hotLeads: snapshot.project.hotLeads,
          spendUsd: snapshot.project.spendUsd,
        },
        campaign: {
          campaignId: snapshot.campaign.campaignId,
          status: snapshot.campaign.status,
          statusReason: snapshot.campaign.statusReason,
          emailsSent: snapshot.campaign.emailsSent,
          totalReplies: snapshot.campaign.replies,
          replyRatePct: snapshot.campaign.replyRatePercent,
          hotLeads: snapshot.campaign.hotLeads,
          spendUsd: snapshot.campaign.spendUsd,
          costPerLeadUsd: snapshot.campaign.costPerLeadUsd,
          dailyBudgetUsd: snapshot.campaign.dailyBudgetUsd,
          leadsPoolUsed: snapshot.campaign.poolUsed,
          leadsPoolTotal: snapshot.campaign.poolTotal,
        },
        autopilot: snapshot.autopilot,
      });
    }

    if (routePath === `${IVERIF_ROUTE_PREFIX}/inbox`) {
      const inbox = await deps.iverifExplee.getNeedReplyInbox();
      return json(200, {
        ...iverifEnvelope('cambium.iverif-observer.inbox.v1', inbox.source),
        policy: iverifPolicyProjection(),
        tab: inbox.tab,
        total: inbox.total,
        omittedContacts: inbox.omittedContacts,
        pageCount: inbox.pageCount,
        hasMore: inbox.truncated,
        contacts: inbox.contacts,
      });
    }

    if (routePath.startsWith(IVERIF_THREAD_PREFIX)) {
      const encodedPersonId = routePath.slice(IVERIF_THREAD_PREFIX.length);
      let personId = '';
      try { personId = decodeURIComponent(encodedPersonId); } catch { /* rejected below */ }
      if (!personId || encodedPersonId.includes('/') || !isIVerifPersonId(personId)) {
        return json(400, { error: 'bad_person_id', retryable: false });
      }
      const thread = await deps.iverifExplee.getThread(personId);
      return json(200, {
        ...iverifEnvelope('cambium.iverif-observer.thread.v1', thread.source),
        policy: iverifPolicyProjection(),
        personId: thread.personId,
        providerCanReply: thread.canReply,
        replyBlockedReason: thread.replyBlockedReason,
        latestIntent: thread.latestIntent,
        messageCount: thread.messageCount,
        truncated: thread.truncated,
        messages: thread.messages.map((message) => ({
          messageRef: typeof message.messageId === 'string' && SHA256_DIGEST.test(message.messageId)
            ? message.messageId
            : null,
          type: message.type,
          intent: message.intent,
          status: message.status,
          ts: message.timestamp,
        })),
      });
    }

    if (routePath === `${IVERIF_ROUTE_PREFIX}/optimize`) {
      const [campaign, autopilot] = await Promise.all([
        deps.iverifExplee.getCampaignAnalytics(),
        deps.iverifExplee.getAutopilot(),
      ]);
      return json(200, {
        ...iverifEnvelope('cambium.iverif-observer.optimize.v1', campaign.source),
        policy: iverifPolicyProjection(autopilot.autopilot.autoReplyEnabled),
        audience: IVERIF_GROUNDING.audience,
        baseline: {
          emailsSent: IVERIF_GROUNDING.baseline.sends,
          totalReplies: IVERIF_GROUNDING.baseline.replies,
          replyRatePct: IVERIF_GROUNDING.baseline.replyRatePercent,
          hotLeads: IVERIF_GROUNDING.baseline.hotLeads,
          spendUsd: IVERIF_GROUNDING.baseline.spendUsdCents / 100,
          leadsPoolUsed: IVERIF_GROUNDING.baseline.poolUsed,
          leadsPoolTotal: IVERIF_GROUNDING.baseline.poolTotal,
        },
        live: {
          emailsSent: campaign.analytics.emailsSent,
          totalReplies: campaign.analytics.replies,
          replyRatePct: campaign.analytics.replyRatePercent,
          hotLeads: campaign.analytics.hotLeads,
          spendUsd: campaign.analytics.spendUsd,
          leadsPoolUsed: campaign.analytics.poolUsed,
          leadsPoolTotal: campaign.analytics.poolTotal,
        },
        experiment: {
          id: IVERIF_GROUNDING.experiment.id,
          variable: IVERIF_GROUNDING.experiment.variable,
          hypothesis: IVERIF_GROUNDING.experiment.hypothesis,
          repliesClassified: IVERIF_GROUNDING.baseline.classifiedReplies,
          winnerEligible: false,
          nextStep: IVERIF_GROUNDING.experiment.prerequisites[0],
        },
        claimStatus: {
          verified: IVERIF_GROUNDING.claims.filter((claim) => claim.status === 'verified').length,
          hypotheses: IVERIF_GROUNDING.claims.filter((claim) => claim.status === 'hypothesis').length,
          blocked: IVERIF_GROUNDING.claims
            .filter((claim) => claim.status === 'blocked')
            .map((claim) => claim.category),
        },
      });
    }

    return json(404, { error: 'iverif observer route not found' });
  } catch (error) {
    return iverifErrorResponse(error);
  }
}

function queryParam(path: string, key: string): string | undefined {
  const queryStart = path.indexOf('?');
  if (queryStart < 0) return undefined;
  return new URLSearchParams(path.slice(queryStart + 1)).get(key) ?? undefined;
}


// ── Task 5 · GET /v1/mission-fabric/{tenant} ────────────────────────────────
// Authenticated, bounded, GET-only, read-only operating-fabric composition.
// Reads the D1 Goal Graph head/nodes, the KV quest envelope (ledgerKey), and
// the D1 branch/runtime receipts; adapts them through the pure Task 3-4
// compiler/adapters/redactor; never writes, backfills, or fabricates joins.
// The allowlist is server-owned: an absent or empty MISSION_FABRIC_TENANTS
// disables every tenant — the route never defaults to cambium.

export interface FabricShadowReport {
  branchFacts: number;
  representedFacts: number;
  missingIds: readonly string[];
  unexpectedIds: readonly string[];
}

const MISSION_FABRIC_CLOCK_SKEW_MS = 24 * 60 * 60_000;

function fabricIdentityOf(node: FabricNode): string {
  const value = node.value as Record<string, unknown>;
  return String(value.workId ?? value.missionId ?? value.taskId ?? value.agentId ?? value.clusterId ?? value.runId ?? value.receiptId ?? '');
}

type FabricTaskNode = Extract<FabricNode, { kind: 'task' }>;

function reconcileFabricTaskNodes(
  goalGraphNodes: readonly FabricNode[],
  executionNodes: readonly FabricNode[],
): {
  nodes: FabricNode[];
  gaps: FabricGap[];
  blockedTaskIds: Set<string>;
} {
  const goalTasks = new Map<string, FabricTaskNode[]>();
  const executionTasks = new Map<string, FabricTaskNode[]>();
  const executionNonTasks: FabricNode[] = [];
  const appendTask = (target: Map<string, FabricTaskNode[]>, node: FabricTaskNode): void => {
    const taskId = node.value.taskId;
    const rows = target.get(taskId) ?? [];
    rows.push(node);
    target.set(taskId, rows);
  };

  for (const node of goalGraphNodes) {
    if (node.kind === 'task') appendTask(goalTasks, node);
  }
  for (const node of executionNodes) {
    if (node.kind === 'task') appendTask(executionTasks, node);
    else executionNonTasks.push(node);
  }

  const taskIds = [...new Set([...goalTasks.keys(), ...executionTasks.keys()])].sort();
  const tasks: FabricTaskNode[] = [];
  const gaps: FabricGap[] = [];
  const blockedTaskIds = new Set<string>();
  let collisionOrdinal = 0;
  for (const taskId of taskIds) {
    const authoritative = goalTasks.get(taskId) ?? [];
    const overlays = executionTasks.get(taskId) ?? [];
    if (authoritative.length > 1 || overlays.length > 1) {
      collisionOrdinal += 1;
      blockedTaskIds.add(taskId);
      gaps.push({
        gapId: `gap-task-identity-collision-${collisionOrdinal}`,
        kind: 'identity-collision',
        subjectId: taskId,
        detail: `Task ${taskId} has ${authoritative.length} Goal Graph nodes and ${overlays.length} execution-fact nodes; every conflicting task node and edge was withheld.`,
        evidenceRef: null,
      });
      continue;
    }
    if (authoritative.length === 1) {
      tasks.push(authoritative[0]);
      if (overlays.length > 0) {
        gaps.push({
          gapId: `gap-task-overlay-reconciled-${gaps.filter((gap) => gap.kind === 'task-overlay-reconciled').length + 1}`,
          kind: 'task-overlay-reconciled',
          subjectId: taskId,
          detail: `Task ${taskId} was emitted once from Goal Graph authority; its execution-fact copy was treated only as an edge overlay.`,
          evidenceRef: null,
        });
      }
      continue;
    }
    if (overlays.length === 1) tasks.push(overlays[0]);
  }

  return { nodes: [...tasks, ...executionNonTasks], gaps, blockedTaskIds };
}

function fabricTimestampMs(value: string): number | null {
  if (!CANONICAL_FABRIC_TS.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

const CANONICAL_FABRIC_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function fabricBranchFactIds(branchStories: unknown): string[] {
  const rows = Array.isArray(branchStories) ? branchStories : [];
  const ids: string[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    if (row.branchKind === 'product' && typeof row.canonicalWorkId === 'string' && /^sapling:[a-z0-9][a-z0-9-]*$/.test(row.canonicalWorkId)) {
      ids.push(row.canonicalWorkId);
    }
    if (row.branchKind === 'client' && typeof row.canonicalWorkId === 'string' && /^branch:[a-z0-9][a-z0-9-]*$/.test(row.canonicalWorkId)) {
      ids.push(row.canonicalWorkId);
    }
  }
  return [...new Set(ids)].sort();
}

async function handleMissionFabricRoute(req: SimpleRequest, deps: HandlerDeps, routePath: string): Promise<SimpleResponse> {
  const tenantPath = routePath.split('?')[0];
  const tenant = tenantOf(tenantPath, '/v1/mission-fabric/');
  if (!tenant) return json(400, { error: 'bad tenant' });
  if (req.method !== 'GET') {
    return { ...json(405, { error: 'mission fabric is GET-only' }), headers: { ...JSON_HEADERS, allow: 'GET' } };
  }
  const allowlist = deps.missionFabricTenants ?? [];
  if (!allowlist.includes(tenant)) return json(403, { error: 'mission fabric tenant is not enabled' });
  if (!deps.gate) return json(503, { error: 'telegram auth is not configured' });
  const initData = (req.headers['x-telegram-init-data'] ?? req.headers['telegram-init-data'] ?? '').trim();
  const auth = await authenticateInitData(initData, deps.gate);
  if (!auth.ok) return json(401, { error: 'telegram authentication failed', reason: auth.reason });
  const viewerIds = deps.missionFabricViewerIds ?? [];
  const isFounder = deps.gate.founderIds.includes(auth.userId);
  const isViewer = viewerIds.includes(auth.userId);
  if (!isFounder && !isViewer) return json(401, { error: 'telegram authentication failed', reason: 'not authorized for mission fabric' });
  if (!deps.goalGraphStore || !deps.branchMapReceiptStore) {
    return json(503, { error: 'mission fabric authority is not configured' });
  }

  try {
    const head = await deps.goalGraphStore.readHead(tenant);
    if (!head) return json(404, { error: 'mission fabric graph not found' });
    const nodes = await deps.goalGraphStore.readNodes(tenant);
    const storedEnvelope = parseStoredEnvelope(await deps.kv.get(ledgerKey(tenant))) as Record<string, unknown> | null;
    const receipts = await deps.branchMapReceiptStore.listReceipts(tenant, undefined, BRANCH_MAP_RECEIPT_READ_LIMIT);

    const servedAt = deps.now ? deps.now() : new Date().toISOString();
    if (fabricTimestampMs(servedAt) === null) return json(503, { error: 'mission_fabric_clock_invalid' });

    const entries: Array<FabricNode | FabricGap> = [];
    for (const entry of [...adaptBranchStories(isRecord(storedEnvelope) ? storedEnvelope.branchStories : null), ...adaptCompanyPrograms(isRecord(storedEnvelope) ? storedEnvelope.companyPrograms : null)]) {
      if (entry.kind === 'gap') {
        entries.push({ gapId: entry.gapId, kind: entry.gapKind, subjectId: entry.subjectId, detail: entry.detail, evidenceRef: entry.evidenceRef });
      } else {
        entries.push(entry);
      }
    }
    const goalGraphAuthority = adaptGoalGraphAuthority({
      tenantId: tenant,
      graphVersion: head.graphVersion,
      nodes,
      workObjectIds: PORTFOLIO_CATALOG.records.map((record) => record.workId),
    });
    const goalGraphFabricNodes = goalGraphAuthority.nodes;
    const fabricFacts = isRecord(storedEnvelope) ? storedEnvelope.fabricFacts : null;
    if (isRecord(fabricFacts) && Array.isArray(fabricFacts.fences)) {
      for (const fenceRow of fabricFacts.fences) {
        if (!isRecord(fenceRow)) continue;
        const currentFence = fenceRow.currentFence;
        const nonFinite = typeof currentFence === 'number' && !Number.isFinite(currentFence);
        if (nonFinite || currentFence === '__fabric-non-finite__') {
          return json(503, { error: 'mission_fabric_fence_invalid' });
        }
      }
    }
    if (isRecord(fabricFacts) && Array.isArray(fabricFacts.runs)) {
      for (const run of fabricFacts.runs) {
        if (!isRecord(run)) continue;
        if (typeof run.nonceExpiresAt === 'string' && run.nonceExpiresAt.length > 0 && fabricTimestampMs(run.nonceExpiresAt) === null) {
          run.nonceExpiresAt = '1970-01-01T00:00:00.000Z';
        }
      }
    }
    const storedDerivedAt = isRecord(storedEnvelope) && typeof storedEnvelope.derivedAt === 'string' ? storedEnvelope.derivedAt : null;
    const contentAsOf = storedDerivedAt !== null && fabricTimestampMs(storedDerivedAt) !== null
      ? storedDerivedAt
      : (typeof head.committedAt === 'string' && fabricTimestampMs(head.committedAt) !== null
        ? head.committedAt
        : '1970-01-01T00:00:00.000Z');
    const execution = adaptQuestExecutionFacts(fabricFacts, { tenantId: tenant, now: servedAt, contentAsOf });
    const taskReconciliation = reconcileFabricTaskNodes(goalGraphFabricNodes, execution.nodes);
    entries.push(...taskReconciliation.nodes);
    const mergedEdges: FabricEdge[] = [...goalGraphAuthority.edges, ...execution.edges].filter((edge) => (
      !taskReconciliation.blockedTaskIds.has(edge.fromId)
      && !taskReconciliation.blockedTaskIds.has(edge.toId)
    ));
    const mergedGaps: FabricGap[] = [...goalGraphAuthority.gaps, ...execution.gaps, ...taskReconciliation.gaps];

    const runNodeIds = new Set(execution.nodes.filter((node) => node.kind === 'run').map((node) => node.value.runId));
    const agentNodeIds = new Set(entries.filter((node): node is FabricNode => !('gapId' in node) && node.kind === 'agent').map((node) => (node.value as { agentId: string }).agentId));
    for (let index = mergedEdges.length - 1; index >= 0; index -= 1) {
      const edge = mergedEdges[index];
      if (edge.kind !== 'executes') continue;
      if (agentNodeIds.has(edge.fromId)) continue;
      mergedEdges.splice(index, 1);
      mergedGaps.push({
        gapId: `gap-executes-join-${edge.toId}`,
        kind: 'missing-join',
        subjectId: edge.toId,
        detail: `Run ${edge.toId} names executor agent ${edge.fromId}, but no explicit agent node exists; the executes edge was not emitted.`,
        evidenceRef: null,
      });
    }

    const receiptEvidence = new Map(receipts.map((receipt) => [receipt.receiptId, receipt.observedAt]));
    const composedNodes: FabricNode[] = [];
    for (const entry of entries) {
      if ('gapId' in entry) {
        mergedGaps.push(entry);
        continue;
      }
      if (entry.kind === 'receipt') {
        const observedAt = receiptEvidence.get(entry.value.receiptId);
        if (observedAt !== undefined && fabricTimestampMs(observedAt) !== null) {
          composedNodes.push({ kind: 'receipt', value: { ...entry.value, createdAt: observedAt } });
          continue;
        }
      }
      composedNodes.push(entry);
    }
    for (const receipt of receipts) {
      if (runNodeIds.size === 0) break;
      const alreadyRepresented = composedNodes.some((node) => node.kind === 'receipt' && node.value.receiptId === receipt.receiptId);
      if (alreadyRepresented) continue;
      mergedGaps.push({
        gapId: `gap-runtime-receipt-${receipt.receiptId}`,
        kind: 'missing-join',
        subjectId: receipt.receiptId,
        detail: `Branch/runtime receipt ${receipt.receiptId} has no durable execution-fact counterpart in the quest envelope; it was not fabricated into a node.`,
        evidenceRef: null,
      });
    }

    const sortedNodes = [...composedNodes].sort((a, b) => {
      const left = `${a.kind}:${fabricIdentityOf(a)}`;
      const right = `${b.kind}:${fabricIdentityOf(b)}`;
      return left < right ? -1 : left > right ? 1 : 0;
    }).slice(0, MISSION_FABRIC_CAPS.MAX_NODES);
    const sortedEdges = [...mergedEdges].sort((a, b) => {
      const left = `${a.kind}:${a.fromId}:${a.toId}`;
      const right = `${b.kind}:${b.fromId}:${b.toId}`;
      return left < right ? -1 : left > right ? 1 : 0;
    }).slice(0, MISSION_FABRIC_CAPS.MAX_EDGES);
    if (composedNodes.length > MISSION_FABRIC_CAPS.MAX_NODES || mergedEdges.length > MISSION_FABRIC_CAPS.MAX_EDGES) {
      mergedGaps.push({
        gapId: 'gap-projection-truncated-composition',
        kind: 'projection-truncated',
        subjectId: null,
        detail: 'The composed mission fabric exceeded the projection caps; entries were omitted deterministically.',
        evidenceRef: null,
      });
    }
    const sortedGaps = [...mergedGaps].sort((a, b) => (a.gapId < b.gapId ? -1 : a.gapId > b.gapId ? 1 : 0));
    if (sortedGaps.length > MISSION_FABRIC_CAPS.MAX_GAPS) {
      return json(503, { error: 'mission_fabric_gap_overflow' });
    }

    const content = {
      projectionVersion: 1 as const,
      tenantId: tenant,
      graphVersion: head.graphVersion,
      sourceOfTruth: 'd1-goal-graph' as const,
      readOnly: true as const,
      nodes: sortedNodes,
      edges: sortedEdges,
      gaps: sortedGaps,
    };
    const projection: MissionFabricProjectionV1 = {
      schema: 'cambium.mission-fabric-projection.v1',
      ...content,
      graphDigest: missionFabricProjectionDigest(content),
      generatedAt: servedAt,
      asOf: typeof head.committedAt === 'string' && fabricTimestampMs(head.committedAt) !== null ? head.committedAt : servedAt,
    };

    const viewer: MissionFabricViewer = {
      role: isFounder ? 'founder' : 'viewer',
      tenantId: tenant,
    };
    const redacted = redactMissionFabricProjection(projection, viewer);
    const redactedDigest = missionFabricProjectionDigest(redacted);
    if (redactedDigest !== redacted.graphDigest) {
      return json(503, { error: 'mission_fabric_projection_digest_invalid' });
    }

    const derivedAt = isRecord(storedEnvelope) && typeof storedEnvelope.derivedAt === 'string' ? storedEnvelope.derivedAt : '';
    const headMs = fabricTimestampMs(projection.asOf);
    const derivedMs = fabricTimestampMs(derivedAt);
    const freshness = derivedMs !== null && headMs !== null && derivedMs >= headMs - MISSION_FABRIC_CLOCK_SKEW_MS ? 'fresh' : 'stale';

    const delivery: Record<string, unknown> = {
      operatingFabricEnabled: true,
      servedAt,
      freshness,
    };
    const body: Record<string, unknown> = {
      projection: redacted,
      delivery,
    };
    let responseDigest = redacted.graphDigest;

    // The Vault-classified portfolio is a separately digested, read-only
    // sidecar for the Cambium founder surface. It never enters Mission
    // Fabric nodes and therefore cannot look like Goal Graph operational
    // truth. Non-founder viewers receive aggregate counts only.
    if (tenant === 'cambium') {
      try {
        const portfolio = portfolioCatalogForViewer(PORTFOLIO_CATALOG, isFounder ? 'founder' : 'viewer');
        const pairDigest = portfolioPairDigest(redacted.graphDigest, PORTFOLIO_CATALOG.catalogDigest);
        body.portfolioCatalogSummary = {
          ...portfolio.summary,
          schema: PORTFOLIO_CATALOG.schema,
          version: PORTFOLIO_CATALOG.version,
          status: PORTFOLIO_CATALOG.status,
          readOnly: PORTFOLIO_CATALOG.readOnly,
          classificationDigest: PORTFOLIO_CATALOG.classificationDigest,
          catalogDigest: PORTFOLIO_CATALOG.catalogDigest,
        };
        delivery.portfolioPairDigest = pairDigest;
        responseDigest = pairDigest;
        if (portfolio.detail !== null) {
          const workNodes = redacted.nodes.filter((node) => node.kind === 'work');
          body.portfolioCatalog = portfolio.detail;
          body.portfolioJoinReport = buildPortfolioJoinReport(PORTFOLIO_CATALOG, workNodes, tenant);
          body.organUpdateDelivery = ORGAN_UPDATE_PLAN;
        } else {
          body.organUpdateDeliverySummary = ORGAN_UPDATE_SUMMARY;
        }
      } catch {
        return json(503, { error: 'portfolio_catalog_unavailable' });
      }
    }

    const shadowRequested = queryParam(req.path, 'shadow') === '1';
    if (shadowRequested && allowlist.includes(tenant)) {
      const branchFactIds = fabricBranchFactIds(isRecord(storedEnvelope) ? storedEnvelope.branchStories : null);
      const represented = new Set(
        redacted.nodes
          .filter((node): node is Extract<FabricNode, { kind: 'work' }> => node.kind === 'work')
          .filter((node) => node.value.kind === 'sapling' || (node.value.kind === 'program' && node.value.programKind === 'client'))
          .map((node) => node.value.workId),
      );
      const missingIds = branchFactIds.filter((id) => !represented.has(id)).sort();
      const unexpectedIds = [...represented].filter((id) => !branchFactIds.includes(id)).sort();
      const shadow: FabricShadowReport = {
        branchFacts: branchFactIds.length,
        representedFacts: branchFactIds.length - missingIds.length,
        missingIds,
        unexpectedIds,
      };
      body.shadow = shadow;
      body.promotionBlocked = missingIds.length > 0;
    }

    return {
      status: 200,
      headers: {
        ...JSON_HEADERS,
        'cache-control': 'private, no-store',
        etag: responseDigest,
      },
      body: JSON.stringify(body),
    };
  } catch {
    return json(503, { error: 'mission_fabric_authority_unavailable' });
  }
}

async function handleBranchMapRoute(req: SimpleRequest, deps: HandlerDeps, routePath: string): Promise<SimpleResponse> {
  const tenant = tenantOf(routePath, '/v1/branch-map/');
  if (!tenant) return json(400, { error: 'bad tenant' });
  if (req.method !== 'GET') {
    return { ...json(405, { error: 'branch map is GET-only' }), headers: { ...JSON_HEADERS, allow: 'GET' } };
  }
  const allowedTenants = deps.branchMapTenants?.length ? deps.branchMapTenants : ['cambium'];
  if (!allowedTenants.includes(tenant)) return json(403, { error: 'branch map tenant is not enabled' });
  if (!deps.gate) return json(503, { error: 'telegram auth is not configured' });
  const initData = (req.headers['x-telegram-init-data'] ?? req.headers['telegram-init-data'] ?? '').trim();
  const auth = await validateInitData(initData, deps.gate);
  if (!auth.ok) return json(401, { error: 'telegram authentication failed', reason: auth.reason });
  if (!deps.goalGraphStore || !deps.branchMapReceiptStore) {
    return json(503, { error: 'branch map authority is not configured' });
  }

  try {
    const head = await deps.goalGraphStore.readHead(tenant);
    if (!head) return json(404, { error: 'branch map graph not found' });
    const nodes = await deps.goalGraphStore.readNodes(tenant);
    const receipts = await deps.branchMapReceiptStore.listReceipts(tenant, undefined, BRANCH_MAP_RECEIPT_READ_LIMIT);
    const generatedAt = deps.now ? deps.now() : new Date().toISOString();
    const projected = buildBranchMapProjection({
      tenantId: tenant,
      graphVersion: head.graphVersion,
      graphDigest: head.graphDigest,
      generatedAt,
      sourceRef: head.sourceRef ?? 'd1:goal-graph',
      nodes,
      receipts,
    });
    if (!projected.accepted) {
      return json(503, { error: 'branch_map_projection_invalid', errors: projected.errors.slice(0, 12) });
    }
    const projection = projected.projection;
    // Recompute the digest at the seam so a stale or caller-mutated object
    // cannot be presented as a signed read model.
    if (projectionDigest(projection) !== projection.projectionDigest) {
      return json(503, { error: 'branch_map_projection_digest_invalid' });
    }
    const rendered = renderBranchMapSheet(projection);
    if (!rendered.accepted) return json(503, { error: 'branch_map_sheet_invalid', errors: rendered.errors.slice(0, 12) });
    const proofBody = {
      schema: 'cambium.telegram.branch-map-proof.v1',
      tenantId: tenant,
      graphVersion: projection.graphVersion,
      graphDigest: projection.graphDigest,
      projectionDigest: projection.projectionDigest,
      sheetSchema: rendered.sheet.schema,
      sheetEnvelopeDigest: `sha256:${await sha256hex(canonicalJson(rendered.sheet))}`,
      sheetTextDigest: `sha256:${await sha256hex(rendered.sheet.text)}`,
      authenticatedUserId: auth.userId,
      generatedAt: projection.generatedAt,
    };
    const proofDigest = `sha256:${await sha256hex(canonicalJson(proofBody))}`;
    return json(200, {
      schema: 'cambium.telegram.branch-map-route.v1',
      version: 1,
      tenantId: tenant,
      authenticated: { method: 'telegram-init-data', userId: auth.userId },
      projection,
      sheet: rendered.sheet,
      proof: { ...proofBody, proofDigest },
    });
  } catch {
    return json(503, { error: 'branch_map_authority_unavailable' });
  }
}

// ── T-039/T-040 · Telegram Goal Graph intake → founder approval → D1 commit ──
// The bridge intake route persists a bounded PENDING proposal (KV, following
// the action-requests record precedent: D1 remains the graph authority only,
// so a not-yet-approved proposal has no business in the graph tables). The
// founder-signed gate lane commits that proposal through d1GoalGraphStore with
// a CAS against the head the proposal was pinned to at intake time.

const GOAL_GRAPH_INTAKE_TASK_SCHEMA = 'cambium.goal-graph-intake-task.v1';
const GOAL_GRAPH_INTAKE_REJECTION_SCHEMA = 'cambium.goal-graph-intake-rejection.v1';
const GOAL_GRAPH_INTAKE_MAX_ERRORS = 8;
const GOAL_GRAPH_INTAKE_MAX_ERROR_BYTES = 240;
const GOAL_GRAPH_APPROVAL_TTL_MS = 15 * 60_000;

interface GoalGraphIntakeRouteResult {
  status: number;
  body: Record<string, unknown>;
}

function goalGraphIntakeTaskKey(tenantId: string, changeDigest: string): string {
  return `goal-graph-intake-task:${tenantId}:${changeDigest}`;
}

/** Best-effort bounded tenant for receipt scoping; never trusts the payload. */
function goalGraphIntakeReceiptTenant(raw: unknown): string {
  if (isRecord(raw) && typeof raw.tenantId === 'string' && VALID_TENANT.test(raw.tenantId)) return raw.tenantId;
  return 'unknown';
}

function boundedIntakeErrors(errors: readonly string[]): string[] {
  return errors.slice(0, GOAL_GRAPH_INTAKE_MAX_ERRORS).map((error) => String(error).slice(0, GOAL_GRAPH_INTAKE_MAX_ERROR_BYTES));
}

function parseJsonObject(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readGoalGraphIntakeTask(kv: KvLike, tenantId: string, changeDigest: string): Promise<Record<string, unknown> | null> {
  const record = parseJsonObject(await kv.get(goalGraphIntakeTaskKey(tenantId, changeDigest)));
  return record && record.schema === GOAL_GRAPH_INTAKE_TASK_SCHEMA && record.tenantId === tenantId ? record : null;
}

function goalGraphIntakeTaskReceipt(task: Record<string, unknown>, duplicate: boolean): GoalGraphIntakeRouteResult {
  return {
    status: 200,
    body: {
      ok: true,
      accepted: true,
      duplicate,
      schema: GOAL_GRAPH_INTAKE_TASK_SCHEMA,
      tenantId: task.tenantId,
      status: task.status,
      idempotencyKey: task.idempotencyKey,
      changeDigest: task.changeDigest,
      contentDigest: task.contentDigest,
      sourceRef: task.sourceRef,
      sourceDigest: task.sourceDigest,
      nodeId: task.nodeId,
      graphVersion: task.graphVersion,
      expectedHeadDigest: task.expectedHeadDigest ?? null,
      receivedAt: task.receivedAt,
    },
  };
}

// ── Gate-row projection of pending intake tasks ─────────────────────────────
// One bounded, render-ready row per PENDING proposal. The projection never
// echoes the intent envelope, the change set, metadata, or founder identity:
// only the digests, a bounded desiredState-derived title/summary, the source
// ref, and consequence/reversibility strings in the house gate-row style.

const GOAL_GRAPH_GATE_ROW_SCHEMA = 'cambium.goal-graph-gate-row.v1';
const GOAL_GRAPH_GATE_ROW_LIST_SCHEMA = 'cambium.goal-graph-gate-row-list.v1';
const GOAL_GRAPH_GATE_ROW_LIMIT = 25;

// Single source of truth for the approval descriptor (nonce/expiry/head
// version/fence), shared by the gate-row projection and the approval route.
// Legacy tasks that predate the descriptor fields are given exactly the same
// fallback derivation in both places, so an exact client echo of a projected
// row can never be rejected by approval. Malformed stored timestamps fail
// closed (return null) rather than propagating a NaN-derived date.
function resolveGoalGraphApprovalDescriptor(
  task: Record<string, unknown>,
  tenantId: string,
  changeDigest: string,
): { approvalNonce: string; approvalExpiresAt: string; expectedHeadVersion: number; fence: number } | null {
  const approvalNonce = shortText(task.approvalNonce, `goal-graph-approval:${tenantId}:${changeDigest}`, 240);
  let approvalExpiresAt = shortText(task.approvalExpiresAt, '', 64);
  if (!approvalExpiresAt) {
    const receivedAt = shortText(task.receivedAt, shortText(task.updatedAt, '', 64), 64);
    const receivedAtMs = receivedAt ? Date.parse(receivedAt) : NaN;
    if (!Number.isFinite(receivedAtMs)) return null;
    approvalExpiresAt = new Date(receivedAtMs + GOAL_GRAPH_APPROVAL_TTL_MS).toISOString();
  } else if (!Number.isFinite(Date.parse(approvalExpiresAt))) {
    return null;
  }
  const expectedHeadVersion = Number.isInteger(task.expectedHeadVersion) ? Number(task.expectedHeadVersion) : 0;
  const fence = Number.isInteger(task.fence) ? Number(task.fence) : (Number.isInteger(task.graphVersion) ? Number(task.graphVersion) : 0);
  return { approvalNonce, approvalExpiresAt, expectedHeadVersion, fence };
}

function goalGraphIntakeGateRow(task: Record<string, unknown>): Record<string, unknown> | null {
  const tenantId = shortText(task.tenantId, '', 160);
  const changeDigest = shortText(task.changeDigest, '', 160);
  if (!tenantId || !/^(?:sha256:)?[a-f0-9]{64}$/.test(changeDigest)) return null;
  const node = isRecord(task.node) ? task.node : {};
  const desiredState = shortText(node.desiredState, 'Telegram goal proposal', 120);
  const receivedAt = shortText(task.receivedAt, shortText(task.updatedAt, 'receivedAt not served', 64), 64);
  const nodeId = shortText(task.nodeId, 'node id not served', 160);
  const descriptor = resolveGoalGraphApprovalDescriptor(task, tenantId, changeDigest);
  if (!descriptor) return null;
  return {
    schema: GOAL_GRAPH_GATE_ROW_SCHEMA,
    kind: 'goal-graph-intake',
    id: `goal-graph-intake:${changeDigest}`,
    tenantId,
    status: 'pending',
    changeDigest,
    nodeId,
    title: shortText(`Goal proposal · ${desiredState}`, 'Goal proposal', 160),
    summary: shortText(`Telegram goal proposal awaiting founder signature: ${desiredState}`, 'Telegram goal proposal awaiting founder signature', 240),
    source: 'telegram-goal-graph-intake@v1',
    sourceRef: shortText(task.sourceRef, 'sourceRef not served', 160),
    evidence: shortText(`goal graph intake ${nodeId} pinned at intake; commit is a CAS against the pinned head`, 'goal graph intake evidence missing', 300),
    consequence: 'founder signature commits this Telegram goal proposal to the goal graph; no graph write happens before approval',
    reversibility: 'reversible until signed: an unsigned proposal never mutates the goal graph; a stale head is refused without a write',
    idempotencyHint: changeDigest,
    graphVersion: Number.isInteger(task.graphVersion) ? task.graphVersion : null,
    receivedAt,
    updatedAt: receivedAt,
    approvalNonce: descriptor.approvalNonce,
    approvalExpiresAt: descriptor.approvalExpiresAt,
    expectedHeadVersion: descriptor.expectedHeadVersion,
    fence: descriptor.fence,
  };
}

async function listGoalGraphIntakeGateRows(kv: KvLike, tenantId: string): Promise<Array<Record<string, unknown>>> {
  const keys = await kv.list(`goal-graph-intake-task:${tenantId}:`);
  const rows: Array<Record<string, unknown>> = [];
  for (const key of keys) {
    const task = parseJsonObject(await kv.get(key));
    if (!task || task.schema !== GOAL_GRAPH_INTAKE_TASK_SCHEMA) continue;
    if (task.tenantId !== tenantId || task.status !== 'pending') continue;
    const row = goalGraphIntakeGateRow(task);
    if (row) rows.push(row);
  }
  rows.sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
  return rows.slice(0, GOAL_GRAPH_GATE_ROW_LIMIT);
}

async function intakeTelegramGoalGraphRoute(
  deps: HandlerDeps,
  raw: unknown,
  nowIso: () => string,
): Promise<GoalGraphIntakeRouteResult> {
  const receivedAt = nowIso();
  const receiptTenant = goalGraphIntakeReceiptTenant(raw);
  // The parser is the pure boundary: a malformed envelope is data, never an
  // exception, so a Telegram redelivery can never crash-loop this lane.
  const initial = parseTelegramGoalGraphIntent(raw);
  if (!initial.accepted) {
    // Bounded rejection receipt: the parser's bounded error shape only. No
    // payload, metadata value, or raw Telegram content is echoed back.
    const receipt = {
      schema: GOAL_GRAPH_INTAKE_REJECTION_SCHEMA,
      tenantId: receiptTenant,
      code: initial.code,
      errors: boundedIntakeErrors(initial.errors),
      receivedAt,
    };
    const receiptId = `ggi-rej-${(await sha256hex(canonicalJson(receipt))).slice(0, 24)}`;
    await deps.kv.put(`goal-graph-intake-rejection:${receiptTenant}:${receiptId}`, JSON.stringify(receipt));
    return {
      status: 200,
      body: {
        ok: false,
        accepted: false,
        rejected: true,
        status: 'rejected',
        schema: GOAL_GRAPH_INTAKE_REJECTION_SCHEMA,
        tenantId: receiptTenant,
        code: initial.code,
        errors: receipt.errors,
        receiptId,
      },
    };
  }

  if (!deps.goalGraphStore) return { status: 503, body: { error: 'goal graph authority is not configured' } };
  const tenantId = initial.value.tenantId;
  let head: GoalGraphHead | null;
  let currentNodes: GoalGraphNode[];
  try {
    head = await deps.goalGraphStore.readHead(tenantId);
    currentNodes = await deps.goalGraphStore.readNodes(tenantId);
  } catch {
    return { status: 503, body: { error: 'goal_graph_authority_unavailable' } };
  }
  // Pin the proposal to the CURRENT head so the approval-bound commit is a
  // CAS against a known digest. The parse is deterministic, so identity,
  // content digest, and the idempotency key are unchanged by this re-parse.
  const pinned = parseTelegramGoalGraphIntent(raw, {
    expectedHeadDigest: head?.graphDigest ?? null,
    actualHead: head,
    currentNodes,
    graphVersion: (head?.graphVersion ?? 0) + 1,
    now: receivedAt,
  });
  if (!pinned.accepted) return { status: 500, body: { error: 'goal_graph_intake_context_failed' } };
  if (pinned.compile.status !== 'compiled') {
    return {
      status: 409,
      body: {
        ok: false,
        error: 'goal_graph_stale_head',
        status: 'stale',
        expectedHeadDigest: pinned.compile.expectedHeadDigest ?? null,
        actualHeadDigest: pinned.compile.actualHeadDigest ?? null,
      },
    };
  }
  const changeSet = pinned.compile.changeSet;

  // Collapse Telegram redelivery on the canonical idempotency key: a replay
  // returns the original task receipt and never writes a second record.
  const idempotencyRecordKey = `goal-graph-intake-idem:${pinned.idempotencyKey}`;
  const existingRecord = parseJsonObject(await deps.kv.get(idempotencyRecordKey));
  if (existingRecord) {
    if (existingRecord.contentDigest !== pinned.contentDigest) {
      return { status: 409, body: { error: 'goal graph intake idempotency conflict', idempotencyKey: pinned.idempotencyKey } };
    }
    const existingTask = parseJsonObject(await deps.kv.get(String(existingRecord.taskKey ?? '')));
    if (!existingTask) return { status: 409, body: { error: 'goal graph intake idempotency record missing task' } };
    return goalGraphIntakeTaskReceipt(existingTask, true);
  }

  // Server-issued approval descriptor, pinned at intake so approval never
  // derives nonce/expiry/fence from the request: the nonce format matches
  // the historical safe default, the TTL matches the existing 15-minute
  // window, expectedHeadVersion pins the head this proposal was built
  // against (0 for no head), and fence pins the target changeSet version.
  const approvalNonce = `goal-graph-approval:${tenantId}:${changeSet.changeDigest}`;
  const approvalExpiresAt = new Date(Date.parse(receivedAt) + GOAL_GRAPH_APPROVAL_TTL_MS).toISOString();
  const expectedHeadVersion = head?.graphVersion ?? 0;
  const fence = changeSet.graphVersion;

  const task = {
    schema: GOAL_GRAPH_INTAKE_TASK_SCHEMA,
    tenantId,
    status: 'pending',
    idempotencyKey: pinned.idempotencyKey,
    intentVersion: pinned.value.version,
    sourceRef: pinned.sourceRef,
    sourceDigest: pinned.sourceDigest,
    contentDigest: pinned.contentDigest,
    changeDigest: changeSet.changeDigest,
    graphVersion: changeSet.graphVersion,
    expectedHeadDigest: changeSet.expectedHeadDigest ?? null,
    nodeId: pinned.node.nodeId,
    intent: pinned.value,
    node: pinned.node,
    changeSet,
    receivedAt,
    updatedAt: receivedAt,
    approvalNonce,
    approvalExpiresAt,
    expectedHeadVersion,
    fence,
  };
  const taskKey = goalGraphIntakeTaskKey(tenantId, changeSet.changeDigest);
  await deps.kv.put(taskKey, JSON.stringify(task));
  await deps.kv.put(idempotencyRecordKey, JSON.stringify({
    taskKey,
    contentDigest: pinned.contentDigest,
    changeDigest: changeSet.changeDigest,
  }));
  return goalGraphIntakeTaskReceipt(task, false);
}

async function approveGoalGraphIntakeRoute(
  deps: HandlerDeps,
  tenant: string,
  body: Record<string, unknown>,
  founderId: string,
): Promise<GoalGraphIntakeRouteResult> {
  if (!deps.goalGraphStore) return { status: 503, body: { error: 'goal graph authority is not configured' } };
  const changeDigest = shortText(body.changeDigest || body.subject, '', 160);
  if (!/^(?:sha256:)?[a-f0-9]{64}$/.test(changeDigest)) {
    return { status: 400, body: { error: 'approve-goal-graph needs a changeDigest subject' } };
  }
  const task = await readGoalGraphIntakeTask(deps.kv, tenant, changeDigest);
  if (!task) return { status: 404, body: { error: 'goal graph intake task not found' } };
  const evidence = {
    kind: 'approve-goal-graph',
    subject: changeDigest,
    tenantId: tenant,
    changeDigest,
    nodeId: task.nodeId,
    sourceRef: task.sourceRef,
    sourceDigest: task.sourceDigest,
    readback: `/v1/branch-map/${tenant}`,
  };
  if (task.status === 'committed') {
    // Replay of an already-committed approval is a no-op with evidence: the
    // original head, nonce, and approval digest come back, nothing is written.
    return {
      status: 200,
      body: {
        ok: true,
        duplicate: true,
        replayed: true,
        committed: true,
        ...evidence,
        headDigest: task.headDigest,
        graphVersion: task.graphVersion,
        approvalNonce: task.approvalNonce,
        approvalDigest: task.approvalDigest,
      },
    };
  }
  if (task.status !== 'pending') {
    return {
      status: 409,
      body: { ok: false, error: `goal graph intake task status ${String(task.status)} cannot be approved`, ...evidence },
    };
  }

  const now = deps.now ? deps.now() : new Date().toISOString();

  // The descriptor is server-issued at intake time (backward-compatible
  // defaults when an old task predates the descriptor fields). Approval
  // reads it from storage; it never derives nonce/expiry/fence itself, and
  // a body-supplied value is only ever checked against the stored value —
  // never trusted to set it.
  const descriptor = resolveGoalGraphApprovalDescriptor(task, tenant, changeDigest);
  if (!descriptor) {
    return { status: 409, body: { ok: false, error: 'goal_graph_approval_descriptor_invalid', code: 'descriptor_invalid', ...evidence } };
  }
  const storedNonce = descriptor.approvalNonce;
  const storedExpiresAt = descriptor.approvalExpiresAt;
  const storedExpectedHeadVersion = descriptor.expectedHeadVersion;
  const storedFence = descriptor.fence;

  const storedExpiresAtMs = Date.parse(storedExpiresAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(storedExpiresAtMs) || !Number.isFinite(nowMs) || storedExpiresAtMs <= nowMs) {
    return { status: 409, body: { ok: false, error: 'goal_graph_approval_expired', code: 'approval_expired', ...evidence } };
  }
  if (body.nonce !== undefined && shortText(body.nonce, '', 240) !== storedNonce) {
    return { status: 409, body: { ok: false, error: 'goal_graph_approval_nonce_mismatch', code: 'nonce_mismatch', ...evidence } };
  }
  if (body.expiresAt !== undefined && shortText(body.expiresAt, '', 64) !== storedExpiresAt) {
    return { status: 409, body: { ok: false, error: 'goal_graph_approval_expiry_mismatch', code: 'expiry_mismatch', ...evidence } };
  }
  if (body.expectedHeadVersion !== undefined && Number(body.expectedHeadVersion) !== storedExpectedHeadVersion) {
    return { status: 409, body: { ok: false, error: 'goal_graph_approval_head_version_mismatch', code: 'head_version_mismatch', ...evidence } };
  }
  if (body.fence !== undefined && Number(body.fence) !== storedFence) {
    return { status: 409, body: { ok: false, error: 'goal_graph_approval_fence_mismatch', code: 'fence_mismatch', ...evidence } };
  }

  // Belt-and-suspenders head pin check ahead of the D1 CAS: the current
  // authoritative head must still equal the pinned expectedHeadVersion. The
  // final D1 conditional write remains the authoritative race guard.
  let currentHead: GoalGraphHead | null;
  try {
    currentHead = await deps.goalGraphStore.readHead(tenant);
  } catch {
    return { status: 503, body: { error: 'goal_graph_authority_unavailable' } };
  }
  const currentHeadVersion = currentHead?.graphVersion ?? 0;
  if (currentHeadVersion !== storedExpectedHeadVersion) {
    await deps.kv.put(goalGraphIntakeTaskKey(tenant, changeDigest), JSON.stringify({
      ...task,
      status: 'stale',
      observedHeadDigest: currentHead?.graphDigest ?? null,
      updatedAt: now,
    }));
    return {
      status: 409,
      body: {
        ok: false,
        error: 'goal_graph_stale_head',
        status: 'stale',
        changeDigest,
        expectedHeadDigest: task.expectedHeadDigest ?? null,
        actualHeadDigest: currentHead?.graphDigest ?? null,
      },
    };
  }

  const nonce = storedNonce;
  const expiresAt = storedExpiresAt;
  const intentVersion = Number.isInteger(task.intentVersion) ? Number(task.intentVersion) : 1;
  const approvalCore = { tenantId: tenant, changeDigest, intentVersion, approverId: founderId, expiresAt, nonce };
  const approval: GoalGraphApproval = {
    ...approvalCore,
    decision: 'approved',
    canonical: canonicalizeGoalGraphApproval(approvalCore),
    approvalDigest: goalGraphApprovalDigest(approvalCore),
  };
  let commit: GoalGraphCommitResult;
  try {
    commit = await deps.goalGraphStore.commit({
      tenantId: tenant,
      changeSet: task.changeSet as GoalChangeSet,
      approval,
      now,
    });
  } catch {
    return { status: 503, body: { error: 'goal_graph_commit_unavailable' } };
  }

  if (commit.status === 'committed' || commit.status === 'duplicate') {
    await deps.kv.put(goalGraphIntakeTaskKey(tenant, changeDigest), JSON.stringify({
      ...task,
      status: 'committed',
      headDigest: commit.head.graphDigest,
      headGraphVersion: commit.head.graphVersion,
      approvalNonce: nonce,
      approvalDigest: approval.approvalDigest,
      committedAt: commit.head.committedAt,
      updatedAt: now,
    }));
    return {
      status: 200,
      body: {
        ok: true,
        duplicate: commit.status === 'duplicate',
        replayed: commit.replayed,
        committed: true,
        ...evidence,
        headDigest: commit.head.graphDigest,
        graphVersion: commit.head.graphVersion,
        approvalNonce: nonce,
        approvalDigest: approval.approvalDigest,
        consequence: `committed telegram goal graph proposal ${changeDigest.slice(0, 16)} to the D1 authority`,
        reversibility: 'committed graph revisions are immutable; supersede with a new approved proposal',
      },
    };
  }
  if (commit.status === 'stale') {
    // The CAS lost: the store guarantees no write happened. Mark the proposal
    // stale so a fresh Telegram message can pin the current head.
    await deps.kv.put(goalGraphIntakeTaskKey(tenant, changeDigest), JSON.stringify({
      ...task,
      status: 'stale',
      observedHeadDigest: commit.actualHeadDigest,
      updatedAt: now,
    }));
    return {
      status: 409,
      body: {
        ok: false,
        error: 'goal_graph_stale_head',
        status: 'stale',
        changeDigest,
        expectedHeadDigest: commit.expectedHeadDigest,
        actualHeadDigest: commit.actualHeadDigest,
      },
    };
  }
  if (commit.status === 'unavailable') {
    return { status: 503, body: { ok: false, error: 'goal_graph_commit_unavailable', code: commit.code } };
  }
  return { status: 409, body: { ok: false, error: 'goal_graph_commit_rejected', code: commit.code, changeDigest } };
}

export async function handle(req: SimpleRequest, deps: HandlerDeps): Promise<SimpleResponse> {
  const { method, path } = req;
  const routePath = fabricRoutePath(path);

  if (routePath === '/v1/admin/portfolio/actions') {
    return handlePortfolioAdminActionRoute(req, deps);
  }

  if (routePath === '/admin/portfolio' || routePath === '/admin/portfolio/web' || routePath === '/v1/admin/portfolio') {
    return handlePortfolioWorkbenchRoute(req, deps, routePath);
  }

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

  if (routePath.startsWith('/v1/branch-map/')) {
    return handleBranchMapRoute(req, deps, routePath);
  }

  if (routePath.startsWith('/v1/mission-fabric/')) {
    return handleMissionFabricRoute(req, deps, routePath);
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

  if (method === 'GET' && routePath === '/v1/invites/verify') {
    if (!deps.inviteSecret) return json(503, { error: 'invite secret not configured on the worker' });
    const token = queryParam(path, 'token');
    if (!token) return json(400, { error: 'missing token' });
    const result = verifyConsultantInvite(token, deps.inviteSecret, new Date(deps.nowMs ? deps.nowMs() : Date.now()));
    if (!result.ok) return json(401, { ok: false, reason: result.reason });
    return json(200, { ok: true, principal: result.principal });
  }

  if (method === 'POST' && routePath.startsWith('/v1/invites/')) {
    const tenant = tenantOf(path, '/v1/invites/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    if (!deps.pushToken) return json(503, { error: 'push token not configured on the worker' });
    const auth = req.headers['authorization'] ?? '';
    if (auth !== `Bearer ${deps.pushToken}`) return json(401, { error: 'bad or missing bearer' });
    if (!deps.inviteSecret) return json(503, { error: 'invite secret not configured on the worker' });
    let inviteBody: any;
    try { inviteBody = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
    if (!isRecord(inviteBody)) return json(400, { error: 'invite body must be an object' });
    if (!Array.isArray(inviteBody.allow) || !inviteBody.allow.every((v: unknown) => typeof v === 'string')) {
      return json(400, { error: 'allow must be a string array' });
    }
    const createdBy = typeof inviteBody.createdBy === 'string' ? inviteBody.createdBy.trim() : '';
    if (!createdBy) return json(400, { error: 'createdBy must be a non-empty string' });
    let ttlMs = INVITE_TTL_MS;
    if (inviteBody.ttlMs !== undefined) {
      if (typeof inviteBody.ttlMs !== 'number' || !Number.isFinite(inviteBody.ttlMs) || inviteBody.ttlMs <= 0) {
        return json(400, { error: 'ttlMs must be a positive number' });
      }
      if (inviteBody.ttlMs > INVITE_MAX_TTL_MS) return json(400, { error: 'ttlMs exceeds the 30 day cap' });
      ttlMs = inviteBody.ttlMs;
    }
    const { token, principal } = createConsultantInvite({
      tenant,
      allow: inviteBody.allow,
      createdBy,
      ttlMs,
      now: new Date(deps.nowMs ? deps.nowMs() : Date.now()),
      secret: deps.inviteSecret,
    });
    return json(200, { token, principal, inviteUrl: `/app?invite=${token}` });
  }

  if (method === 'GET' && routePath.startsWith('/api/quests/')) {
    const tenant = tenantOf(path, '/api/quests/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    // M3 isolation suite is green — gate open to all valid tenants
    const stored = await deps.kv.get(ledgerKey(tenant));
    if (!stored) return json(404, { error: `no ledger pushed yet for "${tenant}" — run: quine write quests push --tenant ${tenant}` });
    const inviteToken = queryParam(path, 'invite');
    if (inviteToken) {
      if (!deps.inviteSecret) return json(503, { error: 'invite secret not configured on the worker' });
      const result = verifyConsultantInvite(inviteToken, deps.inviteSecret, new Date(deps.nowMs ? deps.nowMs() : Date.now()));
      if (!result.ok) return json(401, { error: result.reason === 'expired' ? 'invite expired' : 'invite invalid' });
      if (result.principal.tenant !== tenant) return json(403, { error: 'invite tenant mismatch' });
      return { status: 200, headers: { ...JSON_HEADERS }, body: await surfaceScopedQuestBody(deps.kv, tenant, stored, result.principal) };
    }
    let principal: Principal | null = null;
    if (deps.plexus) {
      const resolved = await resolvePlexusPrincipal(req.headers, deps.plexus, deps.kv, deps.plexusFetchImpl);
      if (resolved.kind === 'unauthenticated') {
        return json(401, { error: 'access_identity_required', message: 'A verified Cloudflare Access identity is required.' });
      }
      if (resolved.kind === 'principal') {
        principal = resolved.principal;
      } else {
        // 'unconfigured': deps.plexus was provided but env is partial — fail closed,
        // never silently promote to the dev founder fallback.
        return json(503, { error: 'plexus_gate_misconfigured', message: 'Plexus gate is enabled but Access env is incomplete.' });
      }
    }
    if (!principal) principal = resolveSurfacePrincipal(req);
    if (!principal) {
      return { status: 200, headers: { ...JSON_HEADERS }, body: await publicQuestBody(deps.kv, tenant, stored) };
    }
    return { status: 200, headers: { ...JSON_HEADERS }, body: await surfaceScopedQuestBody(deps.kv, tenant, stored, { ...principal, tenant }) };
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

  // The IVerif observer has a dedicated read credential and must never inherit
  // broad bridge, assignment, or member-token authority.
  if (routePath === IVERIF_ROUTE_PREFIX || routePath.startsWith(`${IVERIF_ROUTE_PREFIX}/`)) {
    return handleIVerifObserverRoute(req, deps, routePath);
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

    if (method === 'POST' && routePath === '/v1/bridge/lead-runs/iverif/capture-enrich') {
      if (!principal.admin) return json(403, { error: 'lead runtime execution is cofounder-only' });
      if (!deps.iverifExplee || !deps.leadRuntimeStore) {
        return json(503, { error: 'lead_runtime_not_configured' });
      }
      let input: unknown;
      try { input = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      if (!isRecord(input)
          || Object.keys(input).length !== 1
          || typeof input.idempotencyKey !== 'string'
          || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,191}$/.test(input.idempotencyKey)) {
        return json(400, { error: 'invalid_lead_run_input' });
      }
      let result;
      try {
        result = await runIverifCaptureEnrich({
          tenantId: 'thoughtseed',
          idempotencyKey: input.idempotencyKey,
          observer: deps.iverifExplee,
          store: deps.leadRuntimeStore,
          now: nowIso,
          uuid: deps.uuid ?? (() => crypto.randomUUID()),
        });
      } catch {
        return json(503, { ok: false, error: 'lead_runtime_unavailable' });
      }
      if (result.status === 'completed' || result.status === 'replay') {
        return json(200, { ok: true, status: result.status, receipt: result.receipt });
      }
      if (result.status === 'busy') {
        return json(409, { ok: false, error: 'lead_runtime_busy', retryAfterMs: result.retryAfterMs });
      }
      if (result.status === 'stopped') {
        return json(200, { ok: false, status: 'stopped', code: result.code });
      }
      return json(result.status === 'conflict' ? 409 : 503, {
        ok: false,
        error: result.status === 'conflict' ? 'lead_runtime_conflict' : 'lead_runtime_failed',
        code: result.code,
      });
    }

    if (method === 'POST' && routePath === '/v1/bridge/marketing-renders/prepare') {
      if (!principal.admin) return json(403, { error: 'marketing render preparation is cofounder-only' });
      if (deps.marketingRenderer?.activation !== MARKETING_CREATE_EXPECTED_ACTIVATION) {
        return json(503, { error: 'renderer_disabled' });
      }
      if (!deps.marketingRenderer.apiKey?.trim()) {
        return json(503, { error: 'renderer_secret_missing' });
      }
      if (!deps.marketingRenderStore) return json(503, { error: 'marketing_render_store_unavailable' });
      let input: unknown;
      try { input = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      let prepared;
      try {
        prepared = await prepareMarketingRender(input, {
          now: nowIso,
        });
      } catch (error) {
        const code = error instanceof MarketingRendererError ? error.code : 'invalid_prepare_input';
        const status = code === 'invalid_prepare_input' || code === 'prepare_expiry_invalid' ? 400 : 503;
        return json(status, { error: code });
      }
      let stored;
      try {
        stored = await deps.marketingRenderStore.prepare(prepared);
      } catch {
        return json(503, { error: 'marketing_render_store_unavailable' });
      }
      if (stored.status === 'conflict') return json(409, { error: 'marketing_render_identity_conflict' });
      return json(200, {
        ok: true,
        duplicate: stored.status === 'duplicate',
        requestId: stored.record.requestId,
        adapterId: MARKETING_CREATE_ADAPTER_ID,
        actionDigest: stored.record.actionDigest,
        status: 'awaiting_human_approval',
        nextAction: {
          route: '/api/gate/thoughtseed',
          kind: 'approve-marketing-render',
        },
      });
    }

    const marketingExecuteMatch = routePath.match(/^\/v1\/bridge\/marketing-renders\/([^/]+)\/execute$/);
    if (method === 'POST' && marketingExecuteMatch) {
      if (!principal.admin) return json(403, { error: 'marketing render execution is cofounder-only' });
      const requestId = executionText(marketingExecuteMatch[1]);
      if (!requestId) return json(400, { error: 'invalid_render_request_id' });
      let input: unknown;
      try { input = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const parsed = parseMarketingExecuteInput(input);
      if (!parsed.ok) return json(400, { error: parsed.code });
      if (!deps.marketingRenderStore) return json(503, { error: 'marketing_render_store_unavailable' });
      try {
        const result = await executeMarketingRender(requestId, parsed.value.approvalDecisionId, {
          store: deps.marketingRenderStore,
          activation: deps.marketingRenderer?.activation,
          apiKey: deps.marketingRenderer?.apiKey,
          fetchImpl: deps.marketingRenderer?.fetchImpl,
          now: nowIso,
          uuid: deps.uuid,
        });
        if (result.status === 'succeeded') return json(200, result);
        if (result.status === 'busy') return json(409, result);
        if (result.status === 'failed') return json(502, result);
        return json(409, result);
      } catch (error) {
        const code = error instanceof MarketingRendererError ? error.code : 'marketing_renderer_unavailable';
        if (code === 'renderer_disabled' || code === 'renderer_secret_missing') return json(503, { error: code });
        if (code === 'render_request_not_found' || code === 'approval_not_found') return json(404, { error: code });
        if (code.startsWith('approval_')) return json(403, { error: code });
        if (code === 'render_request_expired') return json(409, { error: code });
        return json(503, { error: 'marketing_renderer_unavailable' });
      }
    }

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
      const receivedAt = nowIso();
      await bridgeStore.putUpstream(String(msg.tenantId), String(msg.id), { ...msg, receivedAt });
      // Standup projection is additive: a Plexus daily_agent_event also lands as
      // a bounded member-standup record; every other payload takes the exact
      // pre-existing path, response shape included.
      const standup = standupProjectionFromMessage(msg, receivedAt);
      if (standup) {
        await deps.kv.put(memberStandupKey(String(msg.tenantId), String(msg.memberId), String(standup.date)), JSON.stringify(standup));
        return json(200, { ok: true, id: msg.id, stored: true, standup: { projected: true, date: standup.date } });
      }
      return json(200, { ok: true, id: msg.id, stored: true });
    }

    if (method === 'GET' && routePath.startsWith('/v1/bridge/inbox/')) {
      if (!principal.admin) return json(403, { error: 'inbox is cofounder-only' });
      const tenant = tenantOf(path, '/v1/bridge/inbox/');
      if (!tenant) return json(400, { error: 'bad tenant' });
      const messages = await bridgeStore.listUpstream(tenant, 100);
      return json(200, { tenant, count: messages.length, messages });
    }

    // Hermes's standup surface: "today's standup for member X" (?date=) and
    // "recent standups for digest" (no query, latest-first, capped at 14).
    // Admin and assignment tokens read any member; a member-scoped token reads
    // only its own memberId within its own tenant. The lane inherits the
    // bridge gate above, so an unconfigured bridge already fails closed (503).
    // Records are served exactly as projected — the projector's whitelist is
    // the redaction, so nothing raw, token-bearing, or Telegram-shaped can
    // reach this response.
    const standupReadMatch = routePath.match(/^\/v1\/bridge\/standups\/([^/]+)\/([^/]+)$/);
    if (method === 'GET' && standupReadMatch) {
      const tenant = standupReadMatch[1];
      const memberId = standupReadMatch[2];
      if (!VALID_TENANT.test(tenant)) return json(400, { error: 'bad tenant' });
      if (!MEMBER_STANDUP_MEMBER.test(memberId)) return json(400, { error: 'bad memberId' });
      if (!principal.admin && !principal.assignmentOnly && principal.memberId !== memberId) {
        return json(403, { error: 'token not scoped to this member' });
      }
      if (!principal.admin && !principal.assignmentOnly && principal.tenantId !== tenant) {
        return json(403, { error: 'token not scoped to this tenant' });
      }
      const params = new URLSearchParams(path.includes('?') ? path.slice(path.indexOf('?') + 1) : '');
      const date = params.get('date');
      if (date !== null) {
        if (!MEMBER_STANDUP_DATE.test(date)) return json(400, { error: 'bad date (expected YYYY-MM-DD)' });
        const standup = await readMemberStandup(deps.kv, tenant, memberId, date);
        if (!standup) return json(404, { ok: false, error: 'standup_not_found', tenant, memberId, date });
        return json(200, { ok: true, schema: MEMBER_STANDUP_SCHEMA, tenant, memberId, date, standup });
      }
      const prefix = memberStandupPrefix(tenant, memberId);
      const dates = (await deps.kv.list(prefix))
        .map((key) => key.slice(prefix.length))
        .filter((day) => MEMBER_STANDUP_DATE.test(day))
        .sort()
        .reverse()
        .slice(0, MEMBER_STANDUP_RECENT_LIMIT);
      const standups: Array<Record<string, unknown>> = [];
      for (const day of dates) {
        const standup = await readMemberStandup(deps.kv, tenant, memberId, day);
        if (standup) standups.push(standup);
      }
      return json(200, { ok: true, schema: MEMBER_STANDUP_LIST_SCHEMA, tenant, memberId, count: standups.length, standups });
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

    if (method === 'POST' && routePath === '/v1/bridge/organ-update-delivery') {
      if (!principal.admin) {
        return json(403, { error: 'organ update delivery compilation requires the admin bridge credential' });
      }
      let body: unknown;
      try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      try {
        const delivery = compileOrganUpdateDelivery(body);
        if (delivery.tenantId !== 'cambium') {
          return json(403, { error: 'organ update delivery is fixed to the cambium tenant' });
        }
        if (delivery.requiresApproval) {
          const approvalId = delivery.approvalRef?.startsWith('gate:')
            ? delivery.approvalRef.slice('gate:'.length)
            : '';
          const rawApproval = approvalId
            ? await deps.kv.get(`gate:${delivery.tenantId}:${approvalId}`)
            : null;
          let approval: Record<string, unknown> | null = null;
          try {
            approval = rawApproval && isRecord(JSON.parse(rawApproval))
              ? JSON.parse(rawApproval) as Record<string, unknown>
              : null;
          } catch {
            approval = null;
          }
          if (
            !approval
            || approval.id !== approvalId
            || approval.kind !== 'approve'
            || approval.subject !== delivery.workObjectId
            || !['queued', 'consumed'].includes(String(approval.status))
            || !approval.founderId
          ) {
            return json(403, { error: 'organ_update_delivery_approval_not_verified' });
          }
        }
        return json(200, {
          ok: true,
          organUpdateDelivery: delivery,
        });
      } catch (error) {
        return json(400, {
          ok: false,
          error: 'organ_update_delivery_invalid',
          detail: error instanceof Error ? error.message : 'delivery signal is invalid',
        });
      }
    }

    // Proactive Fitcheck L4 loops + quest templates → KV projection + Hermes delivery intents.
    // Never sends Telegram itself; never writes D1 Goal Graph.
    if (method === 'POST' && routePath === '/v1/bridge/proactive-loop-tick') {
      if (!principal.admin && !principal.assignmentOnly) {
        return json(403, { error: 'only cofounders/Hermes may run proactive loop tick' });
      }
      let body: Record<string, unknown> = {};
      try {
        if (req.body) body = JSON.parse(req.body) as Record<string, unknown>;
      } catch {
        return json(400, { error: 'body is not JSON' });
      }
      const tenantId = String(body.tenantId || body.tenant || 'cambium');
      if (tenantId !== 'cambium') {
        return json(403, { error: 'proactive loop tick is fixed to tenant cambium' });
      }
      // Founder may record operational clearance on the same tick (admin only).
      if (body.founderApproved === true || body.founderApprove === true) {
        if (!principal.admin) {
          return json(403, { error: 'founderApproved requires admin bridge credential' });
        }
        await writeFounderApproval(deps.kv, {
          tenantId,
          founderId: String(body.founderId || principal.memberId || 'founder'),
          approvedAt: nowIso(),
          note: String(body.note || 'Founder operational clearance via proactive-loop-tick'),
          hermesReceipt: body.hermesReceipt === true,
        });
      }
      const plan = await runAndStoreProactiveLoopTick(deps.kv, {
        tenantId,
        actor: String(body.actor || 'bridge-tick'),
        nowIso: nowIso(),
        goalGraphStore: deps.goalGraphStore,
        forceNotify: body.forceNotify === true,
      });
      return json(200, {
        ok: true,
        plan,
        evidence: plan.evidence,
        miniApp: plan.miniApp,
        deliveries: plan.deliveries,
        suppressedNotify: plan.suppressedNotify,
        hermes: {
          pull: 'GET /v1/bridge/proactive-loop/pending-deliveries',
          claim: 'POST /v1/bridge/proactive-loop/claim-deliveries',
          topicAssignment: 'POST /v1/bridge/topic-assignment with deliveries[].topicAssignment',
          note: plan.hermesPullHint,
        },
      });
    }

    if (method === 'POST' && routePath === '/v1/bridge/proactive-loop/founder-approve') {
      if (!principal.admin) {
        return json(403, { error: 'only cofounders may record proactive founder approval' });
      }
      let body: Record<string, unknown> = {};
      try {
        if (req.body) body = JSON.parse(req.body) as Record<string, unknown>;
      } catch {
        return json(400, { error: 'body is not JSON' });
      }
      const tenantId = String(body.tenantId || 'cambium');
      if (tenantId !== 'cambium') {
        return json(403, { error: 'proactive founder approval is fixed to tenant cambium' });
      }
      const approval = await writeFounderApproval(deps.kv, {
        tenantId,
        founderId: String(body.founderId || principal.memberId || 'founder'),
        approvedAt: nowIso(),
        note: String(body.note || 'Founder operational clearance for Fitcheck L4'),
        hermesReceipt: body.hermesReceipt === true,
      });
      // Recompile under clearance so Mini App / Hermes see quiet green ladder
      const plan = await runAndStoreProactiveLoopTick(deps.kv, {
        tenantId,
        actor: 'founder-approve',
        nowIso: nowIso(),
        goalGraphStore: deps.goalGraphStore,
        forceNotify: false,
      });
      return json(200, {
        ok: true,
        approval,
        planId: plan.planId,
        heldCount: plan.miniApp.heldCount,
        failedCount: plan.miniApp.failedCount,
        passedCount: plan.miniApp.passedCount,
        deliveries: plan.deliveries.length,
        writesGoalGraph: false,
        note: 'Operational clearance only. Goal Graph CAS is still a separate founder Gate path.',
      });
    }

    if (method === 'GET' && routePath === '/v1/bridge/proactive-loop/founder-approval') {
      if (!principal.admin && !principal.assignmentOnly) {
        return json(403, { error: 'authenticated Hermes/cofounder required' });
      }
      const params = new URLSearchParams(path.includes('?') ? path.slice(path.indexOf('?') + 1) : '');
      const tenantId = String(params.get('tenantId') || 'cambium');
      const approval = await readFounderApproval(deps.kv, tenantId);
      return json(200, { ok: true, tenantId, approval });
    }

    if (method === 'GET' && routePath === '/v1/bridge/proactive-loop/projection') {
      if (!principal.admin && !principal.assignmentOnly && !principal.memberId) {
        return json(403, { error: 'authenticated principal required for proactive projection' });
      }
      const params = new URLSearchParams(path.includes('?') ? path.slice(path.indexOf('?') + 1) : '');
      const tenantId = String(params.get('tenantId') || params.get('tenant') || 'cambium');
      const plan = await readProactiveLoopPlan(deps.kv, tenantId);
      if (!plan) {
        // Fail-open: compile ephemeral projection without store (no delivery queue)
        const ephemeral = compileProactiveLoopPlan({
          tenantId,
          observedAt: nowIso(),
          actor: 'projection-read',
        });
        return json(200, {
          ok: true,
          stored: false,
          miniApp: ephemeral.miniApp,
          planId: ephemeral.planId,
          observedAt: ephemeral.observedAt,
        });
      }
      return json(200, {
        ok: true,
        stored: true,
        miniApp: plan.miniApp,
        planId: plan.planId,
        planDigest: plan.planDigest,
        observedAt: plan.observedAt,
        heldCount: plan.miniApp.heldCount,
        failedCount: plan.miniApp.failedCount,
        nextFounderAction: plan.miniApp.nextFounderAction,
      });
    }

    if (method === 'GET' && routePath === '/v1/bridge/proactive-loop/pending-deliveries') {
      if (!principal.admin && !principal.assignmentOnly) {
        return json(403, { error: 'only cofounders/Hermes may pull proactive deliveries' });
      }
      const params = new URLSearchParams(path.includes('?') ? path.slice(path.indexOf('?') + 1) : '');
      const tenantId = String(params.get('tenantId') || params.get('tenant') || 'cambium');
      const pending = await readPendingProactiveDeliveries(deps.kv, tenantId);
      return json(200, {
        ok: true,
        tenantId,
        pending: pending ?? { deliveries: [], networkSend: false, writesGoalGraph: false },
        hermesNote:
          'Post messageText to the topic thread, then enqueue topicAssignment via /v1/bridge/topic-assignment. Claim IDs after send.',
      });
    }

    if (method === 'POST' && routePath === '/v1/bridge/proactive-loop/claim-deliveries') {
      if (!principal.admin && !principal.assignmentOnly) {
        return json(403, { error: 'only cofounders/Hermes may claim proactive deliveries' });
      }
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
      } catch {
        return json(400, { error: 'body is not JSON' });
      }
      const tenantId = String(body.tenantId || 'cambium');
      const ids = Array.isArray(body.deliveryIds)
        ? body.deliveryIds.map((x) => String(x))
        : [];
      if (!ids.length) return json(400, { error: 'deliveryIds required' });
      const result = await claimProactiveDeliveries(deps.kv, tenantId, ids, nowIso());
      return json(200, { ok: true, ...result });
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

    if (method === 'POST' && routePath === '/v1/bridge/goal-graph-intake') {
      if (!principal.admin && !principal.assignmentOnly) return json(403, { error: 'only cofounders/Hermes may submit goal graph intents' });
      let raw: unknown;
      try { raw = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const result = await intakeTelegramGoalGraphRoute(deps, raw, nowIso);
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
      if (!principal.admin && !principal.assignmentOnly) {
        return json(403, { error: 'only cofounders/Hermes may create business tasks' });
      }
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

    const businessOperatorReceiptRead = routePath.match(
      /^\/v1\/bridge\/business-tasks\/([^/]+)\/operator-receipt$/,
    );
    if (method === 'GET' && businessOperatorReceiptRead) {
      if (!deps.businessStore) return json(503, { error: 'durable business task store unavailable' });
      const taskId = decodeURIComponent(businessOperatorReceiptRead[1]);
      if (!BUSINESS_SAFE_ID.test(taskId)) return json(400, { error: 'invalid business task id' });
      const task = await deps.businessStore.getTask(taskId);
      if (!task) return json(404, { error: 'business task not found' });
      if (!principal.admin && !principal.assignmentOnly && principal.memberId !== task.memberId) {
        return json(403, { error: 'token not scoped to this business task receipt' });
      }
      return json(200, {
        ok: true,
        schema: 'thoughtseed.business_task_operator_receipt.v1',
        gsdTaskId: task.gsdTaskId,
        workflowId: task.workflowId,
        status: task.status,
        synthetic: true,
        externalAction: 'none',
        updatedAt: task.updatedAt,
        artifact: task.receipt ? {
          artifactId: task.receipt.artifactId,
          digest: task.receipt.digest,
          byteLength: task.receipt.byteLength,
          contentType: task.receipt.contentType,
          approvalState: task.receipt.approvalState,
        } : null,
      });
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
    if (!['approve', 'reroll', 'promote-skill', 'queue-side-quest', 'confirm-action-request', 'approve-marketing-render', 'approve-goal-graph'].includes(body.kind) || !(body.subject || body.actionRequestId || body.requestId)) {
      return json(400, { error: 'need a supported gate kind and subject' });
    }
    const verdict = await validateInitData(String(body.initData ?? ''), deps.gate);
    if (!verdict.ok) return json(401, { error: verdict.reason });
    const kind = body.kind as GateActionKind;
    if (kind === 'approve-goal-graph') {
      const result = await approveGoalGraphIntakeRoute(deps, tenant, body, verdict.userId);
      return json(result.status, result.body);
    }
    if (kind === 'approve-marketing-render') {
      if (tenant !== 'thoughtseed') return json(403, { error: 'marketing renderer is fixed to the thoughtseed tenant' });
      const allowedFields = new Set(['kind', 'requestId', 'subject', 'initData']);
      if (!isRecord(body)
          || !Object.hasOwn(body, 'requestId')
          || Object.keys(body).some((field) => !allowedFields.has(field))) {
        return json(400, { error: 'invalid_marketing_render_approval_input' });
      }
      if (deps.marketingRenderer?.activation !== MARKETING_CREATE_EXPECTED_ACTIVATION) {
        return json(503, { error: 'renderer_disabled' });
      }
      if (!deps.marketingRenderStore) return json(503, { error: 'marketing_render_store_unavailable' });
      const requestId = executionText(body.requestId || body.subject);
      if (!requestId) return json(400, { error: 'approve-marketing-render needs a valid requestId' });
      const approvalDecisionId = (deps.uuid ?? (() => crypto.randomUUID()))();
      let result;
      try {
        result = await deps.marketingRenderStore.approvePrepared({
          requestId,
          founderId: verdict.userId,
          decidedAt: deps.now ? deps.now() : new Date().toISOString(),
          approvalDecisionId,
        });
      } catch {
        return json(503, { error: 'marketing_render_approval_unavailable' });
      }
      if (result.status === 'not_found') return json(404, { error: 'render_request_not_found' });
      if (result.status === 'conflict') return json(409, { error: 'marketing_render_approval_conflict' });
      return json(200, {
        ok: true,
        duplicate: result.status === 'duplicate',
        requestId,
        approvalDecisionId: result.approval.record_id,
      });
    }
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
    // Pending Telegram goal-graph proposals ride the same envelope as bounded
    // gate rows so the founder (and the operator poller) sees one decision list.
    actions.push(...await listGoalGraphIntakeGateRows(deps.kv, tenant));
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
    // Inject pure proactive L4 loop projection for Mini App Fitcheck strip (no TG send, no D1 write)
    let pageBody = PAGE;
    try {
      const observedAt = deps.now ? deps.now() : new Date().toISOString();
      const stored = await readProactiveLoopPlan(deps.kv, 'cambium');
      const proactive = stored ?? compileProactiveLoopPlan({
        tenantId: 'cambium',
        observedAt,
        actor: 'mini-app-html',
      });
      const mini = 'miniApp' in proactive ? proactive.miniApp : proactive;
      const boot = `<script>globalThis.__CAMBIUM_PROACTIVE_LOOP__=${JSON.stringify({
        heldCount: mini.heldCount,
        failedCount: mini.failedCount,
        passedCount: mini.passedCount,
        nextFounderAction: mini.nextFounderAction,
        ladder: mini.ladder,
        observedAt: mini.observedAt,
        stored: !!stored,
        authorityNote: mini.authorityNote,
      })};</script>`;
      pageBody = PAGE.includes('</head>')
        ? PAGE.replace('</head>', `${boot}</head>`)
        : boot + PAGE;
    } catch {
      pageBody = PAGE;
    }
    return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, body: pageBody };
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

    // Without ?probe=1 this reports CONFIGURATION only — a provider whose key is set
    // but whose upstream is down still lists here. Callers that need a real verdict
    // (omniroute-check, temperance-doctor) must ask for the probe.
    if (path === '/v1/providers/health' && /[?&]probe=1(?:&|$)/.test(req.path)) {
      const probes = await probeProviders(cfg);
      return json(200, {
        ok: probes.every((p) => p.ok === true),
        broker: 'cambium-provider-broker',
        probed: true,
        providers: probes,
        count: probes.length,
      });
    }

    return json(200, {
      ok: true,
      broker: 'cambium-provider-broker',
      probed: false,
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

  // Command Code does not speak OpenAI chat, so this one provider is translated
  // rather than proxied. Everything else stays byte-passthrough.
  if (provider.translate === 'command-code' && req.method === 'POST' && /chat\/completions$/.test(upstreamPath)) {
    return handleCommandCode(cfg, provider, baseUrl, req);
  }

  const upstreamUrl = `${baseUrl}/${upstreamPath.replace(/^\/+/, '')}`;

  let upstream: Response;
  try {
    upstream = await providerFetch(cfg, provider, upstreamUrl, req);
  } catch (err) {
    // An AbortError here is our own timeout, not an upstream verdict. Say so plainly:
    // a caller that sees 504 knows to fail the slot, where a hang tells them nothing.
    const timedOut = (err as { name?: string })?.name === 'AbortError';
    return json(timedOut ? 504 : 502, {
      error: timedOut ? `provider "${providerId}" timed out` : `provider "${providerId}" unreachable`,
    });
  }

  const contentType = upstream.headers.get('content-type') ?? 'application/json; charset=utf-8';

  // Stream SSE straight through. Buffering it collapses time-to-first-token into
  // full generation time, which reads to the caller as a slot that timed out even
  // though the upstream answered fine.
  if (isEventStream(contentType) && upstream.body) {
    return {
      status: upstream.status,
      headers: {
        'content-type': contentType,
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
      body: upstream.body,
    };
  }

  const body = await upstream.text();
  return {
    status: upstream.status,
    headers: { 'content-type': contentType, 'cache-control': 'no-store' },
    body,
  };
}

/**
 * Command Code lane: OpenAI chat in, OpenAI chat out, Command Code's own protocol
 * in between. The caller never learns this provider is different.
 *
 * The endpoint only streams, so a non-streaming request is served by draining the
 * event stream and folding it into one completion rather than by asking for a
 * mode Command Code does not have.
 */
async function handleCommandCode(
  cfg: ProviderBrokerConfig,
  provider: ProviderConfig,
  baseUrl: string,
  req: SimpleRequest,
): Promise<SimpleResponse> {
  let body: unknown;
  try {
    body = req.body ? JSON.parse(req.body) : {};
  } catch {
    return json(400, { error: 'body is not JSON' });
  }
  const asRecord = (v: unknown) => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});
  const input = asRecord(body);
  const wantsStream = input.stream === true;

  // Strip any "command-code/" prefix a router may have prepended; Command Code
  // wants its own bare model id.
  const rawModel = typeof input.model === 'string' ? input.model : '';
  const model = rawModel.replace(/^command-code\//, '');
  if (!model) return json(400, { error: 'model is required' });

  const translated = buildCommandCodeBody(model, { ...input, model });
  const sessionId = crypto.randomUUID();

  const headers: Record<string, string> = {
    authorization: `Bearer ${provider.apiKey}`,
    'content-type': 'application/json',
    ...commandCodeHeaders(sessionId),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? PROVIDER_TIMEOUT_MS);
  let upstream: Response;
  try {
    const f = cfg.fetch ?? fetch;
    upstream = await f(`${baseUrl}/alpha/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(translated),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const timedOut = (err as { name?: string })?.name === 'AbortError';
    return json(timedOut ? 504 : 502, {
      error: timedOut ? 'provider "command-code" timed out' : 'provider "command-code" unreachable',
    });
  } finally {
    clearTimeout(timer);
  }

  if (!upstream.ok) {
    // Pass the vendor's own diagnostic through rather than inventing one — its
    // validation messages name the offending field.
    const text = await upstream.text().catch(() => '');
    return {
      status: upstream.status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      body: text || JSON.stringify({ error: `command-code upstream error ${upstream.status}` }),
    };
  }
  if (!upstream.body) return json(502, { error: 'command-code returned no body' });

  const ids = { completionId: `chatcmpl-${crypto.randomUUID()}`, newToolId: () => crypto.randomUUID() };

  if (wantsStream) {
    return {
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' },
      body: translateStream(upstream.body, model, ids),
    };
  }

  try {
    const completion = await translateToCompletion(upstream.body, model, ids);
    return json(200, completion as Record<string, unknown>);
  } catch (err) {
    // An `error` event mid-stream lands here; surface its message.
    return json(502, { error: err instanceof Error ? err.message : 'command-code stream error' });
  }
}

const PROVIDER_TIMEOUT_MS = 120_000;

function isEventStream(contentType: string): boolean {
  return contentType.toLowerCase().includes('text/event-stream');
}

/** Upstream call with the provider's own auth shape and a bounded deadline. */
async function providerFetch(
  cfg: ProviderBrokerConfig,
  provider: ProviderConfig,
  upstreamUrl: string,
  req: SimpleRequest,
): Promise<Response> {
  const f = cfg.fetch ?? fetch;
  const headers: Record<string, string> = {};

  // Anthropic-shaped upstreams take a bare key in x-api-key; OpenAI-shaped ones take
  // `Bearer <key>` in authorization. Only ever one of them — never leak the key twice.
  const authHeader = (provider.authHeader ?? 'authorization').toLowerCase();
  headers[authHeader] = authHeader === 'authorization' ? `Bearer ${provider.apiKey}` : provider.apiKey;

  // Client-supplied protocol headers the upstream needs but that carry no credential.
  const anthropicVersion = req.headers['anthropic-version'];
  if (anthropicVersion) headers['anthropic-version'] = anthropicVersion;

  // Per-provider allowlist. Anything that could carry a credential is refused
  // outright rather than trusted to the config — the caller's broker token lives
  // in `authorization`, and forwarding it upstream would leak it to the vendor.
  for (const name of provider.forwardHeaders ?? []) {
    const key = name.toLowerCase();
    if (key === 'authorization' || key === 'cookie' || key === 'x-api-key') continue;
    const value = req.headers[key];
    if (value) headers[key] = value;
  }

  for (const [name, value] of Object.entries(provider.staticHeaders ?? {})) {
    const key = name.toLowerCase();
    if (key === 'authorization' || key === 'cookie' || key === 'x-api-key') continue;
    headers[key] = value;
  }

  if (req.method === 'POST') {
    headers['content-type'] = req.headers['content-type'] ?? 'application/json';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? PROVIDER_TIMEOUT_MS);
  try {
    return await f(upstreamUrl, {
      method: req.method,
      headers,
      body: req.method === 'POST' ? req.body : undefined,
      signal: controller.signal,
    });
  } finally {
    // Streamed responses are consumed after we return, so this only clears the
    // deadline for establishing the response — not for draining its body.
    clearTimeout(timer);
  }
}

/** Probe each configured provider's models endpoint so "healthy" means it answered. */
async function probeProviders(cfg: ProviderBrokerConfig): Promise<Array<Record<string, unknown>>> {
  const entries = Object.entries(cfg.providers).filter(([, p]) => p?.apiKey && p.baseUrl);
  return Promise.all(
    entries.map(async ([id, provider]) => {
      const baseUrl = provider!.baseUrl.replace(/\/+$/, '');
      const probeReq: SimpleRequest = { method: 'GET', path: '/', headers: {} };
      try {
        const res = await providerFetch(cfg, provider!, `${baseUrl}/models`, probeReq);
        return { id, ok: res.ok, status: res.status };
      } catch (err) {
        const timedOut = (err as { name?: string })?.name === 'AbortError';
        return { id, ok: false, status: null, error: timedOut ? 'timeout' : 'unreachable' };
      }
    }),
  );
}
