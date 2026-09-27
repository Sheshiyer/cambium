import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  TELEGRAM_ROUTING_CONTRACT,
  THOUGHTSEED_TELEGRAM_CHAT_ID,
  TOPIC_QUEST_ROUTES,
} from './telegram-routing.ts';

export const PLATFORM_PLAYBOOK_TELEGRAM_READINESS_SCHEMA = 'cambium.platform-playbook-telegram-readiness.v1' as const;
export const PLATFORM_PLAYBOOK_TELEGRAM_PROPOSAL_SCHEMA = 'cambium.platform-playbook-telegram-proposal.v1' as const;
export const PLATFORM_PLAYBOOK_TELEGRAM_APPROVAL_SCHEMA = 'cambium.platform-playbook-approval.v1' as const;
export const PLATFORM_PLAYBOOK_TELEGRAM_RECEIPT_SCHEMA = 'cambium.platform-playbook-telegram-readiness-receipt.v1' as const;

const CONTRACT_URL = new URL('./platform-playbook-telegram-readiness.v1.json', import.meta.url);
const CONTRACT_BYTES = readFileSync(CONTRACT_URL);
const CONTRACT = JSON.parse(CONTRACT_BYTES.toString('utf8')) as {
  schema: typeof PLATFORM_PLAYBOOK_TELEGRAM_READINESS_SCHEMA;
  version: 1;
  status: 'controlled_dry_run_only';
  mode: { allowed: ['dry-run']; networkSend: false; executionAllowed: false };
  destination: { allowedTopicKeys: ['agent_ops']; requiredTopicMapContract: 'thoughtseed.telegram-topic-map.v1'; requireExactThreadBinding: true };
  message: { maxBytes: 1024; requiresNextAction: true; nextActionPattern: string };
  approval: { schema: typeof PLATFORM_PLAYBOOK_TELEGRAM_APPROVAL_SCHEMA; requiredForFutureSend: true; requiredScope: 'telegram:send:agent_ops'; maxWindowMinutes: 30; binds: string[]; readinessOnly: true };
  receipt: { dropMessageBody: true; requires: string[] };
};

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const SECRET_MARKER = /(?:query_id|auth_date|token)=|(?:^|\W)hash=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|PRIVATE KEY/i;
const NEXT_ACTION = /\/ts-[a-z0-9-]+(?:\s|$)/i;
const APPROVAL_STATES = new Set<PlatformPlaybookTelegramReadinessReceipt['approvalState']>([
  'missing',
  'invalid',
  'expired',
  'approved-for-future-send',
]);

export interface PlatformPlaybookTelegramProposal {
  schema: typeof PLATFORM_PLAYBOOK_TELEGRAM_PROPOSAL_SCHEMA;
  proposalId: string;
  tenantId: string;
  platform: 'telegram';
  topicKey: 'agent_ops';
  threadId: number;
  summary: string;
  messageText: string;
  proof: { ref: string; digest: string };
  createdAt: string;
}

export interface PlatformPlaybookTelegramApproval {
  schema: typeof PLATFORM_PLAYBOOK_TELEGRAM_APPROVAL_SCHEMA;
  approvalRef: string;
  approvedBy: string;
  approvedAt: string;
  status: 'approved';
  scope: 'telegram:send:agent_ops';
  proposalId: string;
  proposalDigest: string;
  topicKey: 'agent_ops';
  threadId: number;
  messageDigest: string;
  expiresAt: string;
}

export interface PlatformPlaybookTelegramReadinessReceipt {
  schema: typeof PLATFORM_PLAYBOOK_TELEGRAM_RECEIPT_SCHEMA;
  version: 1;
  receiptId: string;
  receiptDigest: string;
  contractDigest: string;
  topicMapDigest: string;
  proposalId: string;
  proposalDigest: string;
  route: { chatId: typeof THOUGHTSEED_TELEGRAM_CHAT_ID; topicKey: 'agent_ops'; threadId: number };
  message: { digest: string; byteLength: number; bodyStored: false };
  approvalState: 'missing' | 'invalid' | 'expired' | 'approved-for-future-send';
  transport: { mode: 'dry-run'; attempted: false; networkSend: false; executionAllowed: false; reason: string };
  blockers: string[];
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

function bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], field: string) {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`${field}.${key} is not allowed`);
}

function safeText(value: unknown, field: string, maxBytes: number): string {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`);
  const normalized = value.trim().replace(/\r\n/g, '\n');
  if (!normalized || bytes(normalized) > maxBytes || SECRET_MARKER.test(normalized)) throw new TypeError(`${field} is invalid`);
  return normalized;
}

function safeId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SAFE_ID.test(value) || SECRET_MARKER.test(value)) throw new TypeError(`${field} is invalid`);
  return value;
}

function timestampMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function timestamp(value: unknown, field: string): string {
  if (timestampMs(value) === null) throw new TypeError(`${field} is invalid`);
  return value as string;
}

export const PLATFORM_PLAYBOOK_TELEGRAM_READINESS_CONTRACT = Object.freeze({
  ...CONTRACT,
  contractDigest: `sha256:${createHash('sha256').update(CONTRACT_BYTES).digest('hex')}`,
});

export function platformPlaybookTelegramProposalDigest(proposal: PlatformPlaybookTelegramProposal): string {
  const { messageText, ...withoutMessage } = proposal;
  return digest({ ...withoutMessage, messageDigest: digest(messageText) });
}

export function normalizePlatformPlaybookTelegramProposal(value: unknown): PlatformPlaybookTelegramProposal {
  if (!isRecord(value)) throw new TypeError('proposal must be an object');
  const row = value;
  exactKeys(row, ['schema', 'proposalId', 'tenantId', 'platform', 'topicKey', 'threadId', 'summary', 'messageText', 'proof', 'createdAt'], 'proposal');
  if (row.schema !== PLATFORM_PLAYBOOK_TELEGRAM_PROPOSAL_SCHEMA) throw new TypeError('proposal.schema is invalid');
  if (row.platform !== 'telegram') throw new TypeError('proposal.platform is invalid');
  if (row.topicKey !== 'agent_ops') throw new TypeError('proposal.topicKey is invalid');
  const route = TOPIC_QUEST_ROUTES.agent_ops;
  if (Number(row.threadId) !== route.threadId) throw new TypeError('proposal.threadId does not match the pinned topic map');
  if (!isRecord(row.proof)) throw new TypeError('proposal.proof is invalid');
  const proof = row.proof;
  exactKeys(proof, ['ref', 'digest'], 'proposal.proof');
  const messageText = safeText(row.messageText, 'proposal.messageText', CONTRACT.message.maxBytes);
  if (!NEXT_ACTION.test(messageText)) throw new TypeError('proposal.messageText requires a /ts-* next action');
  return {
    schema: PLATFORM_PLAYBOOK_TELEGRAM_PROPOSAL_SCHEMA,
    proposalId: safeId(row.proposalId, 'proposal.proposalId'),
    tenantId: safeId(row.tenantId, 'proposal.tenantId'),
    platform: 'telegram',
    topicKey: 'agent_ops',
    threadId: route.threadId,
    summary: safeText(row.summary, 'proposal.summary', 320),
    messageText,
    proof: {
      ref: safeId(proof.ref, 'proposal.proof.ref'),
      digest: typeof proof.digest === 'string' && SHA256.test(proof.digest)
        ? proof.digest
        : (() => { throw new TypeError('proposal.proof.digest is invalid'); })(),
    },
    createdAt: timestamp(row.createdAt, 'proposal.createdAt'),
  };
}

export function evaluatePlatformPlaybookTelegramApproval(
  proposal: PlatformPlaybookTelegramProposal,
  raw: unknown,
  nowIso: string,
): { state: PlatformPlaybookTelegramReadinessReceipt['approvalState']; blockers: string[] } {
  if (!raw) return { state: 'missing', blockers: ['future send requires a separately issued approval receipt'] };
  if (!isRecord(raw)) return { state: 'invalid', blockers: ['approval receipt is malformed'] };
  const approval = raw;
  const allowedKeys = ['schema', 'approvalRef', 'approvedBy', 'approvedAt', 'status', 'scope', 'proposalId', 'proposalDigest', 'topicKey', 'threadId', 'messageDigest', 'expiresAt'];
  if (Object.keys(approval).some((key) => !allowedKeys.includes(key))) return { state: 'invalid', blockers: ['approval receipt contains unsupported fields'] };
  const expectedDigest = platformPlaybookTelegramProposalDigest(proposal);
  const messageDigest = digest(proposal.messageText);
  const approvedAt = timestampMs(approval.approvedAt);
  const exact = typeof approval.approvalRef === 'string'
    && SAFE_ID.test(approval.approvalRef)
    && typeof approval.approvedBy === 'string'
    && SAFE_ID.test(approval.approvedBy)
    && approvedAt !== null
    && approval.schema === PLATFORM_PLAYBOOK_TELEGRAM_APPROVAL_SCHEMA
    && approval.status === 'approved'
    && approval.scope === CONTRACT.approval.requiredScope
    && approval.proposalId === proposal.proposalId
    && approval.proposalDigest === expectedDigest
    && approval.topicKey === proposal.topicKey
    && Number(approval.threadId) === proposal.threadId
    && approval.messageDigest === messageDigest;
  if (!exact) return { state: 'invalid', blockers: ['approval receipt does not bind this exact proposal, route, and message digest'] };
  const expiresAt = timestampMs(approval.expiresAt);
  const nowAt = timestampMs(nowIso);
  const createdAt = timestampMs(proposal.createdAt);
  if (expiresAt === null || nowAt === null || createdAt === null) return { state: 'invalid', blockers: ['approval receipt timing is invalid'] };
  if (expiresAt <= nowAt) return { state: 'expired', blockers: ['approval receipt is expired'] };
  if (approvedAt < createdAt || approvedAt > expiresAt) return { state: 'invalid', blockers: ['approval receipt timing is invalid'] };
  if (expiresAt - approvedAt > CONTRACT.approval.maxWindowMinutes * 60 * 1000) return { state: 'invalid', blockers: ['approval receipt exceeds the maximum approval window'] };
  return { state: 'approved-for-future-send', blockers: ['transport remains disabled by the controlled dry-run contract'] };
}

export function preparePlatformPlaybookTelegramDryRun(
  rawProposal: unknown,
  rawApproval: unknown = null,
  nowIso: string = new Date().toISOString(),
): PlatformPlaybookTelegramReadinessReceipt {
  const proposal = normalizePlatformPlaybookTelegramProposal(rawProposal);
  const approval = evaluatePlatformPlaybookTelegramApproval(proposal, rawApproval, nowIso);
  const messageDigest = digest(proposal.messageText);
  const body = {
    schema: PLATFORM_PLAYBOOK_TELEGRAM_RECEIPT_SCHEMA,
    version: 1 as const,
    contractDigest: PLATFORM_PLAYBOOK_TELEGRAM_READINESS_CONTRACT.contractDigest,
    topicMapDigest: `sha256:${TELEGRAM_ROUTING_CONTRACT.manifestSha256}`,
    proposalId: proposal.proposalId,
    proposalDigest: platformPlaybookTelegramProposalDigest(proposal),
    route: { chatId: THOUGHTSEED_TELEGRAM_CHAT_ID, topicKey: proposal.topicKey, threadId: proposal.threadId },
    message: { digest: messageDigest, byteLength: bytes(proposal.messageText), bodyStored: false as const },
    approvalState: approval.state,
    transport: {
      mode: 'dry-run' as const,
      attempted: false,
      networkSend: false,
      executionAllowed: false,
      reason: 'Stage 3 readiness validates one exact future-send envelope. Hermes transport remains disabled.',
    },
    blockers: approval.blockers,
  };
  const receiptDigest = digest(body);
  return {
    ...body,
    receiptId: `ptgr_${receiptDigest.slice('sha256:'.length, 'sha256:'.length + 24)}`,
    receiptDigest,
  };
}

export function validatePlatformPlaybookTelegramReadinessReceipt(value: unknown): value is PlatformPlaybookTelegramReadinessReceipt {
  try {
    if (!isRecord(value)) return false;
    exactKeys(value, ['schema', 'version', 'receiptId', 'receiptDigest', 'contractDigest', 'topicMapDigest', 'proposalId', 'proposalDigest', 'route', 'message', 'approvalState', 'transport', 'blockers'], 'receipt');
    if (value.schema !== PLATFORM_PLAYBOOK_TELEGRAM_RECEIPT_SCHEMA || value.version !== 1) return false;
    if (value.contractDigest !== PLATFORM_PLAYBOOK_TELEGRAM_READINESS_CONTRACT.contractDigest) return false;
    if (value.topicMapDigest !== `sha256:${TELEGRAM_ROUTING_CONTRACT.manifestSha256}`) return false;
    if (safeId(value.proposalId, 'receipt.proposalId') !== value.proposalId || typeof value.proposalDigest !== 'string' || !SHA256.test(value.proposalDigest)) return false;
    if (!isRecord(value.route) || !isRecord(value.message) || !isRecord(value.transport)) return false;
    exactKeys(value.route, ['chatId', 'topicKey', 'threadId'], 'receipt.route');
    exactKeys(value.message, ['digest', 'byteLength', 'bodyStored'], 'receipt.message');
    exactKeys(value.transport, ['mode', 'attempted', 'networkSend', 'executionAllowed', 'reason'], 'receipt.transport');
    if (value.route.chatId !== THOUGHTSEED_TELEGRAM_CHAT_ID || value.route.topicKey !== 'agent_ops' || Number(value.route.threadId) !== TOPIC_QUEST_ROUTES.agent_ops.threadId) return false;
    if (typeof value.message.digest !== 'string' || !SHA256.test(value.message.digest) || !Number.isInteger(value.message.byteLength) || value.message.byteLength < 1 || value.message.bodyStored !== false) return false;
    if (!APPROVAL_STATES.has(value.approvalState as PlatformPlaybookTelegramReadinessReceipt['approvalState'])) return false;
    if (value.transport.mode !== 'dry-run' || value.transport.attempted !== false || value.transport.networkSend !== false || value.transport.executionAllowed !== false || !safeText(value.transport.reason, 'receipt.transport.reason', 240)) return false;
    if (!Array.isArray(value.blockers) || value.blockers.some((blocker) => !safeText(blocker, 'receipt.blocker', 240))) return false;
    const { receiptId, receiptDigest, ...body } = value;
    if (typeof receiptDigest !== 'string' || !SHA256.test(receiptDigest) || digest(body) !== receiptDigest) return false;
    return receiptId === `ptgr_${receiptDigest.slice('sha256:'.length, 'sha256:'.length + 24)}`;
  } catch {
    return false;
  }
}
