import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  THOUGHTSEED_TELEGRAM_CHAT_ID,
  TOPIC_QUEST_ROUTES,
  TELEGRAM_ROUTING_CONTRACT,
} from './telegram-routing.ts';
import {
  type PlatformPlaybookTelegramReadinessReceipt,
  validatePlatformPlaybookTelegramReadinessReceipt,
} from './platform-playbook-telegram-readiness.ts';

export const PLATFORM_PLAYBOOK_MESSAGING_CONSENT_SCHEMA = 'cambium.platform-playbook-messaging-consent.v1' as const;
export const MESSAGING_RECIPIENT_PREFERENCE_SCHEMA = 'cambium.messaging-recipient-preference.v1' as const;
export const PLATFORM_PLAYBOOK_MESSAGING_INTENT_SCHEMA = 'cambium.platform-playbook-messaging-intent.v1' as const;
export const PLATFORM_PLAYBOOK_MESSAGING_RECEIPT_SCHEMA = 'cambium.platform-playbook-messaging-consent-receipt.v1' as const;

const CONTRACT_URL = new URL('./platform-playbook-messaging-consent.v1.json', import.meta.url);
const CONTRACT_BYTES = readFileSync(CONTRACT_URL);
const CONTRACT = JSON.parse(CONTRACT_BYTES.toString('utf8')) as {
  schema: typeof PLATFORM_PLAYBOOK_MESSAGING_CONSENT_SCHEMA;
  version: 1;
  status: 'controlled_dry_run_only';
  mode: { allowed: ['dry-run']; networkSend: false; executionAllowed: false; scheduleArmed: false };
  recipientPreference: {
    schema: typeof MESSAGING_RECIPIENT_PREFERENCE_SCHEMA;
    opaqueRecipientReference: string;
    maxCheckAgeHours: 24;
    requiresExplicitOptIn: true;
    requiresCategoryScopedOptIn: true;
    requiresCategoryScopedOptInProof: true;
    requiresFreshOptOutCheck: true;
    requiresOptInProof: true;
    requiresOptOutProof: true;
  };
  channels: {
    telegram_internal: {
      requiredCategory: 'internal_operational';
      allowedTopicKey: 'agent_ops';
      requiresStage3Readiness: true;
      recipientConsent: 'not_applicable';
      transport: 'disabled';
    };
    whatsapp_business: {
      officialPolicy: {
        policyId: string;
        sourceUrl: string;
        policyUpdatedAt: string;
        reviewedAt: string;
        localPolicyRefreshDays: 30;
      };
      messageCategories: ['marketing', 'utility', 'authentication', 'service'];
      acceptedContentClassifications: ['general'];
      requiresContentClassificationProof: true;
      regulatedOrRestrictedRequiresSeparateApproval: true;
      businessInitiatedRequiresApprovedTemplate: true;
      customerServiceWindowHours: 24;
      requiresHumanEscalationReference: true;
      requiresBusinessProfileReference: true;
      requiresPrivacyNoticeReference: true;
      transport: 'unconfigured';
    };
  };
  receipt: {
    schema: typeof PLATFORM_PLAYBOOK_MESSAGING_RECEIPT_SCHEMA;
    dropMessageBody: true;
    dropRecipientIdentifier: true;
    requires: string[];
  };
};

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const RECIPIENT_REF = /^recipient:[a-f0-9]{16,64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const REFERENCE = /^(?:evidence|consent|preference|template|support|profile|notice):[A-Za-z0-9._/-]{1,112}$/;
const PHONE_LIKE = /(?:^|\D)\+?\d(?:[\s()-]*\d){6,14}(?:$|\D)/;
const NEXT_ACTION = /\/ts-[a-z0-9-]+(?:\s|$)/i;
const SECRET_MARKER = /(?:query_id|auth_date|token)=|(?:^|\W)hash=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|PRIVATE KEY/i;
const WHATSAPP_CATEGORIES = ['marketing', 'utility', 'authentication', 'service'] as const;
const CONSENT_STATES = new Set<PlatformPlaybookMessagingConsentReceipt['consentState']>(['not_applicable', 'eligible', 'blocked']);

export type MessagingChannel = 'telegram_internal' | 'whatsapp_business';
export type WhatsAppMessageCategory = typeof WHATSAPP_CATEGORIES[number];

export interface MessagingRecipientPreference {
  schema: typeof MESSAGING_RECIPIENT_PREFERENCE_SCHEMA;
  recipientRef: string;
  channel: 'whatsapp_business';
  status: 'active' | 'opted_out';
  optedInAt: string;
  optInProofRef: string;
  categories: WhatsAppMessageCategory[];
  categoryOptInProofRefs: Partial<Record<WhatsAppMessageCategory, string>>;
  optOutStatus: 'clear' | 'opted_out';
  optOutProofRef: string;
  checkedAt: string;
}

export interface PlatformPlaybookMessagingIntent {
  schema: typeof PLATFORM_PLAYBOOK_MESSAGING_INTENT_SCHEMA;
  intentId: string;
  tenantId: string;
  channel: MessagingChannel;
  category: WhatsAppMessageCategory | 'internal_operational';
  messageText: string;
  proof: { ref: string; digest: string };
  createdAt: string;
  recipient?: MessagingRecipientPreference;
  telegram?: { stage3Receipt: PlatformPlaybookTelegramReadinessReceipt };
  whatsapp?: {
    businessInitiated: boolean;
    contentClassification: 'general';
    contentClassificationProofRef: string;
    templateRef?: string;
    customerServiceWindowOpenedAt?: string;
    humanEscalationRef?: string;
    businessProfileRef?: string;
    privacyNoticeRef?: string;
  };
}

export interface PlatformPlaybookMessagingConsentReceipt {
  schema: typeof PLATFORM_PLAYBOOK_MESSAGING_RECEIPT_SCHEMA;
  version: 1;
  receiptId: string;
  receiptDigest: string;
  contractDigest: string;
  channel: MessagingChannel;
  intentId: string;
  intentDigest: string;
  consentState: 'not_applicable' | 'eligible' | 'blocked';
  destination: { type: 'telegram_topic' | 'whatsapp_business'; topicKey?: 'agent_ops'; threadId?: number };
  routing: { topicMapDigest: string | null };
  message: { digest: string; byteLength: number; bodyStored: false };
  policy: {
    policyId?: string;
    sourceUrl?: string;
    reviewedAt?: string;
    policyFresh: boolean;
    templateRequired?: boolean;
    templatePresent?: boolean;
    withinServiceWindow?: boolean;
    humanEscalationPresent?: boolean;
    businessProfilePresent?: boolean;
    privacyNoticePresent?: boolean;
    contentClassification?: 'general';
    contentClassificationProofPresent?: boolean;
  };
  transport: {
    mode: 'dry-run';
    attempted: false;
    networkSend: false;
    executionAllowed: false;
    scheduleArmed: false;
    reason: string;
  };
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

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], field: string) {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`${field}.${key} is not allowed`);
}

function timestampMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function dateMs(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestamp(value: unknown, field: string): string {
  if (timestampMs(value) === null) throw new TypeError(`${field} is invalid`);
  return value as string;
}

function safeId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SAFE_ID.test(value) || SECRET_MARKER.test(value)) throw new TypeError(`${field} is invalid`);
  return value;
}

function safeReference(value: unknown, field: string): string {
  if (typeof value !== 'string' || !REFERENCE.test(value) || SECRET_MARKER.test(value)) throw new TypeError(`${field} is invalid`);
  const path = value.slice(value.indexOf(':') + 1);
  if (path.startsWith('/') || path.includes('//') || path.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new TypeError(`${field} is invalid`);
  }
  return value;
}

function safeText(value: unknown, field: string, maxBytes: number): string {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`);
  const normalized = value.trim().replace(/\r\n/g, '\n');
  if (!normalized || byteLength(normalized) > maxBytes || SECRET_MARKER.test(normalized) || PHONE_LIKE.test(normalized)) throw new TypeError(`${field} is invalid`);
  return normalized;
}

function whatsappCategory(value: unknown, field: string): WhatsAppMessageCategory {
  if (typeof value !== 'string' || !WHATSAPP_CATEGORIES.includes(value as WhatsAppMessageCategory)) throw new TypeError(`${field} is invalid`);
  return value as WhatsAppMessageCategory;
}

export const PLATFORM_PLAYBOOK_MESSAGING_CONSENT_CONTRACT = Object.freeze({
  ...CONTRACT,
  contractDigest: `sha256:${createHash('sha256').update(CONTRACT_BYTES).digest('hex')}`,
});

export function messagingIntentDigest(intent: PlatformPlaybookMessagingIntent): string {
  const { messageText, ...withoutMessage } = intent;
  return digest({ ...withoutMessage, messageDigest: digest(messageText) });
}

export function normalizeMessagingRecipientPreference(value: unknown): MessagingRecipientPreference {
  if (!isRecord(value)) throw new TypeError('recipient must be an object');
  const row = value;
  exactKeys(row, ['schema', 'recipientRef', 'channel', 'status', 'optedInAt', 'optInProofRef', 'categories', 'categoryOptInProofRefs', 'optOutStatus', 'optOutProofRef', 'checkedAt'], 'recipient');
  if (row.schema !== MESSAGING_RECIPIENT_PREFERENCE_SCHEMA) throw new TypeError('recipient.schema is invalid');
  if (typeof row.recipientRef !== 'string' || !RECIPIENT_REF.test(row.recipientRef)) throw new TypeError('recipient.recipientRef is invalid');
  if (row.channel !== 'whatsapp_business') throw new TypeError('recipient.channel is invalid');
  if (row.status !== 'active' && row.status !== 'opted_out') throw new TypeError('recipient.status is invalid');
  if (row.optOutStatus !== 'clear' && row.optOutStatus !== 'opted_out') throw new TypeError('recipient.optOutStatus is invalid');
  if (!Array.isArray(row.categories)) throw new TypeError('recipient.categories is invalid');
  const categories = row.categories.map((category) => whatsappCategory(category, 'recipient.categories'));
  if (new Set(categories).size !== categories.length) throw new TypeError('recipient.categories contains duplicates');
  if (!isRecord(row.categoryOptInProofRefs)) throw new TypeError('recipient.categoryOptInProofRefs is invalid');
  const categoryOptInProofRefs = row.categoryOptInProofRefs;
  for (const [category, proofRef] of Object.entries(categoryOptInProofRefs)) {
    if (!WHATSAPP_CATEGORIES.includes(category as WhatsAppMessageCategory) || !categories.includes(category as WhatsAppMessageCategory)) throw new TypeError('recipient.categoryOptInProofRefs has an unsupported category');
    safeReference(proofRef, 'recipient.categoryOptInProofRefs');
  }
  if (categories.some((category) => !(category in categoryOptInProofRefs))) throw new TypeError('recipient.categoryOptInProofRefs is incomplete');
  const optedInAt = timestamp(row.optedInAt, 'recipient.optedInAt');
  const checkedAt = timestamp(row.checkedAt, 'recipient.checkedAt');
  if (timestampMs(checkedAt)! < timestampMs(optedInAt)!) throw new TypeError('recipient.checkedAt precedes recipient.optedInAt');
  return {
    schema: MESSAGING_RECIPIENT_PREFERENCE_SCHEMA,
    recipientRef: row.recipientRef,
    channel: 'whatsapp_business',
    status: row.status,
    optedInAt,
    optInProofRef: safeReference(row.optInProofRef, 'recipient.optInProofRef'),
    categories: [...categories].sort(),
    categoryOptInProofRefs: Object.fromEntries(categories.sort().map((category) => [category, safeReference(categoryOptInProofRefs[category], 'recipient.categoryOptInProofRefs')])) as Partial<Record<WhatsAppMessageCategory, string>>,
    optOutStatus: row.optOutStatus,
    optOutProofRef: safeReference(row.optOutProofRef, 'recipient.optOutProofRef'),
    checkedAt,
  };
}

export function normalizePlatformPlaybookMessagingIntent(value: unknown): PlatformPlaybookMessagingIntent {
  if (!isRecord(value)) throw new TypeError('intent must be an object');
  const row = value;
  exactKeys(row, ['schema', 'intentId', 'tenantId', 'channel', 'recipient', 'category', 'messageText', 'proof', 'createdAt', 'telegram', 'whatsapp'], 'intent');
  if (row.schema !== PLATFORM_PLAYBOOK_MESSAGING_INTENT_SCHEMA) throw new TypeError('intent.schema is invalid');
  if (row.channel !== 'telegram_internal' && row.channel !== 'whatsapp_business') throw new TypeError('intent.channel is invalid');
  if (!isRecord(row.proof)) throw new TypeError('intent.proof is invalid');
  const proof = row.proof;
  exactKeys(proof, ['ref', 'digest'], 'intent.proof');
  const base = {
    schema: PLATFORM_PLAYBOOK_MESSAGING_INTENT_SCHEMA as const,
    intentId: safeId(row.intentId, 'intent.intentId'),
    tenantId: safeId(row.tenantId, 'intent.tenantId'),
    channel: row.channel,
    messageText: safeText(row.messageText, 'intent.messageText', 1024),
    proof: {
      ref: safeReference(proof.ref, 'intent.proof.ref'),
      digest: typeof proof.digest === 'string' && SHA256.test(proof.digest)
        ? proof.digest
        : (() => { throw new TypeError('intent.proof.digest is invalid'); })(),
    },
    createdAt: timestamp(row.createdAt, 'intent.createdAt'),
  };
  if (base.channel === 'telegram_internal') {
    if (row.category !== 'internal_operational' || !NEXT_ACTION.test(base.messageText)) throw new TypeError('telegram intent category or next action is invalid');
    if (row.recipient !== undefined || row.whatsapp !== undefined || !isRecord(row.telegram)) throw new TypeError('telegram intent requires a Stage 3 binding only');
    const telegram = row.telegram;
    exactKeys(telegram, ['stage3Receipt'], 'intent.telegram');
    const stage3Receipt = telegram.stage3Receipt;
    if (!validatePlatformPlaybookTelegramReadinessReceipt(stage3Receipt)) throw new TypeError('telegram intent Stage 3 receipt is invalid');
    if (stage3Receipt.approvalState !== 'approved-for-future-send') throw new TypeError('telegram intent Stage 3 receipt lacks future-send approval');
    if (stage3Receipt.route.chatId !== THOUGHTSEED_TELEGRAM_CHAT_ID || stage3Receipt.route.topicKey !== 'agent_ops' || stage3Receipt.route.threadId !== TOPIC_QUEST_ROUTES.agent_ops.threadId || stage3Receipt.message.digest !== digest(base.messageText)) {
      throw new TypeError('telegram intent Stage 3 receipt does not bind this exact message and route');
    }
    return {
      ...base,
      channel: 'telegram_internal',
      category: 'internal_operational',
      telegram: { stage3Receipt },
    };
  }
  if (!isRecord(row.recipient) || !isRecord(row.whatsapp) || row.telegram !== undefined) throw new TypeError('whatsapp intent requires recipient and WhatsApp bindings only');
  const recipient = normalizeMessagingRecipientPreference(row.recipient);
  const whatsapp = row.whatsapp;
  exactKeys(whatsapp, ['businessInitiated', 'contentClassification', 'contentClassificationProofRef', 'templateRef', 'customerServiceWindowOpenedAt', 'humanEscalationRef', 'businessProfileRef', 'privacyNoticeRef'], 'intent.whatsapp');
  if (typeof whatsapp.businessInitiated !== 'boolean') throw new TypeError('intent.whatsapp.businessInitiated is invalid');
  if (whatsapp.contentClassification !== 'general') throw new TypeError('whatsapp regulated or restricted content requires a separate approval lane');
  const contentClassificationProofRef = safeReference(whatsapp.contentClassificationProofRef, 'intent.whatsapp.contentClassificationProofRef');
  const templateRef = whatsapp.templateRef === undefined ? undefined : safeReference(whatsapp.templateRef, 'intent.whatsapp.templateRef');
  const customerServiceWindowOpenedAt = whatsapp.customerServiceWindowOpenedAt === undefined
    ? undefined
    : timestamp(whatsapp.customerServiceWindowOpenedAt, 'intent.whatsapp.customerServiceWindowOpenedAt');
  const humanEscalationRef = whatsapp.humanEscalationRef === undefined ? undefined : safeReference(whatsapp.humanEscalationRef, 'intent.whatsapp.humanEscalationRef');
  const businessProfileRef = whatsapp.businessProfileRef === undefined ? undefined : safeReference(whatsapp.businessProfileRef, 'intent.whatsapp.businessProfileRef');
  const privacyNoticeRef = whatsapp.privacyNoticeRef === undefined ? undefined : safeReference(whatsapp.privacyNoticeRef, 'intent.whatsapp.privacyNoticeRef');
  return {
    ...base,
    channel: 'whatsapp_business',
    category: whatsappCategory(row.category, 'intent.category'),
    recipient,
    whatsapp: {
      businessInitiated: whatsapp.businessInitiated,
      contentClassification: 'general',
      contentClassificationProofRef,
      ...(templateRef ? { templateRef } : {}),
      ...(customerServiceWindowOpenedAt ? { customerServiceWindowOpenedAt } : {}),
      ...(humanEscalationRef ? { humanEscalationRef } : {}),
      ...(businessProfileRef ? { businessProfileRef } : {}),
      ...(privacyNoticeRef ? { privacyNoticeRef } : {}),
    },
  };
}

export function preparePlatformPlaybookMessagingConsentDryRun(rawIntent: unknown, nowIso: string = new Date().toISOString()): PlatformPlaybookMessagingConsentReceipt {
  const intent = normalizePlatformPlaybookMessagingIntent(rawIntent);
  const nowAt = timestampMs(nowIso);
  if (nowAt === null) throw new TypeError('nowIso is invalid');
  const blockers: string[] = [];
  let consentState: PlatformPlaybookMessagingConsentReceipt['consentState'];
  let destination: PlatformPlaybookMessagingConsentReceipt['destination'];
  let routing: PlatformPlaybookMessagingConsentReceipt['routing'];
  let policy: PlatformPlaybookMessagingConsentReceipt['policy'];

  if (intent.channel === 'telegram_internal') {
    consentState = 'not_applicable';
    destination = { type: 'telegram_topic', topicKey: 'agent_ops', threadId: TOPIC_QUEST_ROUTES.agent_ops.threadId };
    routing = { topicMapDigest: `sha256:${TELEGRAM_ROUTING_CONTRACT.manifestSha256}` };
    policy = { policyFresh: true };
    blockers.push('Telegram transport remains disabled by the Stage 3 readiness contract');
  } else {
    const recipient = intent.recipient!;
    const preferenceCheckedAt = timestampMs(recipient.checkedAt)!;
    const optedInAt = timestampMs(recipient.optedInAt)!;
    const config = CONTRACT.channels.whatsapp_business;
    const policyReviewedAt = dateMs(config.officialPolicy.reviewedAt);
    if (policyReviewedAt === null) throw new TypeError('messaging consent contract policy review date is invalid');
    const preferenceFresh = nowAt >= preferenceCheckedAt && nowAt - preferenceCheckedAt <= CONTRACT.recipientPreference.maxCheckAgeHours * 60 * 60 * 1000;
    const optInValid = optedInAt <= nowAt;
    const policyFresh = nowAt >= policyReviewedAt && nowAt - policyReviewedAt <= config.officialPolicy.localPolicyRefreshDays * 24 * 60 * 60 * 1000;
    const windowOpenedAt = intent.whatsapp?.customerServiceWindowOpenedAt ? timestampMs(intent.whatsapp.customerServiceWindowOpenedAt) : null;
    const withinServiceWindow = windowOpenedAt !== null && nowAt >= windowOpenedAt && nowAt - windowOpenedAt <= config.customerServiceWindowHours * 60 * 60 * 1000;
    const templateRequired = intent.whatsapp!.businessInitiated || !withinServiceWindow;
    const templatePresent = Boolean(intent.whatsapp?.templateRef);
    const humanEscalationPresent = Boolean(intent.whatsapp?.humanEscalationRef);
    const businessProfilePresent = Boolean(intent.whatsapp?.businessProfileRef);
    const privacyNoticePresent = Boolean(intent.whatsapp?.privacyNoticeRef);
    const contentClassificationProofPresent = Boolean(intent.whatsapp?.contentClassificationProofRef);
    if (recipient.status !== 'active') blockers.push('recipient preference is not active');
    if (recipient.optOutStatus !== 'clear') blockers.push('recipient has opted out');
    if (!preferenceFresh) blockers.push('recipient preference check is stale or future-dated');
    if (!optInValid) blockers.push('recipient opt-in is future-dated');
    if (!recipient.categories.includes(intent.category as WhatsAppMessageCategory)) blockers.push('recipient has not opted into this message category');
    if (!recipient.categoryOptInProofRefs[intent.category as WhatsAppMessageCategory]) blockers.push('recipient category opt-in proof is missing');
    if (!policyFresh) blockers.push('WhatsApp policy review is stale or future-dated');
    if (templateRequired && !templatePresent) blockers.push('approved template reference is required');
    if (!humanEscalationPresent) blockers.push('human escalation reference is required');
    if (!businessProfilePresent) blockers.push('business profile reference is required');
    if (!privacyNoticePresent) blockers.push('privacy notice reference is required');
    if (!contentClassificationProofPresent) blockers.push('content classification proof reference is required');
    consentState = blockers.length === 0 ? 'eligible' : 'blocked';
    destination = { type: 'whatsapp_business' };
    routing = { topicMapDigest: null };
    policy = {
      policyId: config.officialPolicy.policyId,
      sourceUrl: config.officialPolicy.sourceUrl,
      reviewedAt: config.officialPolicy.reviewedAt,
      policyFresh,
      templateRequired,
      templatePresent,
      withinServiceWindow,
      humanEscalationPresent,
      businessProfilePresent,
      privacyNoticePresent,
      contentClassification: 'general',
      contentClassificationProofPresent,
    };
    blockers.push('WhatsApp transport is unconfigured');
  }

  const body = {
    schema: PLATFORM_PLAYBOOK_MESSAGING_RECEIPT_SCHEMA,
    version: 1 as const,
    contractDigest: PLATFORM_PLAYBOOK_MESSAGING_CONSENT_CONTRACT.contractDigest,
    channel: intent.channel,
    intentId: intent.intentId,
    intentDigest: messagingIntentDigest(intent),
    consentState,
    destination,
    routing,
    message: { digest: digest(intent.messageText), byteLength: byteLength(intent.messageText), bodyStored: false as const },
    policy,
    transport: {
      mode: 'dry-run' as const,
      attempted: false,
      networkSend: false,
      executionAllowed: false,
      scheduleArmed: false,
      reason: 'Stage 4 validates messaging consent and policy. Every transport remains disabled.',
    },
    blockers,
  };
  const receiptDigest = digest(body);
  return { ...body, receiptId: `pmcr_${receiptDigest.slice('sha256:'.length, 'sha256:'.length + 24)}`, receiptDigest };
}

export function validatePlatformPlaybookMessagingConsentReceipt(value: unknown): value is PlatformPlaybookMessagingConsentReceipt {
  try {
    if (!isRecord(value)) return false;
    exactKeys(value, ['schema', 'version', 'receiptId', 'receiptDigest', 'contractDigest', 'channel', 'intentId', 'intentDigest', 'consentState', 'destination', 'routing', 'message', 'policy', 'transport', 'blockers'], 'receipt');
    if (value.schema !== PLATFORM_PLAYBOOK_MESSAGING_RECEIPT_SCHEMA || value.version !== 1 || value.contractDigest !== PLATFORM_PLAYBOOK_MESSAGING_CONSENT_CONTRACT.contractDigest) return false;
    if ((value.channel !== 'telegram_internal' && value.channel !== 'whatsapp_business') || !CONSENT_STATES.has(value.consentState as PlatformPlaybookMessagingConsentReceipt['consentState'])) return false;
    if (safeId(value.intentId, 'receipt.intentId') !== value.intentId || typeof value.intentDigest !== 'string' || !SHA256.test(value.intentDigest)) return false;
    if (!isRecord(value.destination) || !isRecord(value.routing) || !isRecord(value.message) || !isRecord(value.policy) || !isRecord(value.transport)) return false;
    exactKeys(value.destination, ['type', 'topicKey', 'threadId'], 'receipt.destination');
    exactKeys(value.routing, ['topicMapDigest'], 'receipt.routing');
    exactKeys(value.message, ['digest', 'byteLength', 'bodyStored'], 'receipt.message');
    exactKeys(value.policy, ['policyId', 'sourceUrl', 'reviewedAt', 'policyFresh', 'templateRequired', 'templatePresent', 'withinServiceWindow', 'humanEscalationPresent', 'businessProfilePresent', 'privacyNoticePresent', 'contentClassification', 'contentClassificationProofPresent'], 'receipt.policy');
    exactKeys(value.transport, ['mode', 'attempted', 'networkSend', 'executionAllowed', 'scheduleArmed', 'reason'], 'receipt.transport');
    if (value.channel === 'telegram_internal') {
      if (value.destination.type !== 'telegram_topic' || Object.keys(value.destination).length !== 3 || value.destination.topicKey !== 'agent_ops' || Number(value.destination.threadId) !== TOPIC_QUEST_ROUTES.agent_ops.threadId || value.routing.topicMapDigest !== `sha256:${TELEGRAM_ROUTING_CONTRACT.manifestSha256}` || value.consentState !== 'not_applicable' || Object.keys(value.policy).length !== 1) return false;
    } else if (value.destination.type !== 'whatsapp_business' || Object.keys(value.destination).length !== 1 || value.routing.topicMapDigest !== null || value.policy.contentClassification !== 'general' || value.policy.policyId !== CONTRACT.channels.whatsapp_business.officialPolicy.policyId || value.policy.sourceUrl !== CONTRACT.channels.whatsapp_business.officialPolicy.sourceUrl || value.policy.reviewedAt !== CONTRACT.channels.whatsapp_business.officialPolicy.reviewedAt) return false;
    if (typeof value.message.digest !== 'string' || !SHA256.test(value.message.digest) || !Number.isInteger(value.message.byteLength) || value.message.byteLength < 1 || value.message.bodyStored !== false) return false;
    if (typeof value.policy.policyFresh !== 'boolean') return false;
    if (value.channel === 'whatsapp_business' && [value.policy.templateRequired, value.policy.templatePresent, value.policy.withinServiceWindow, value.policy.humanEscalationPresent, value.policy.businessProfilePresent, value.policy.privacyNoticePresent, value.policy.contentClassificationProofPresent].some((item) => typeof item !== 'boolean')) return false;
    if (value.transport.mode !== 'dry-run' || value.transport.attempted !== false || value.transport.networkSend !== false || value.transport.executionAllowed !== false || value.transport.scheduleArmed !== false || !safeText(value.transport.reason, 'receipt.transport.reason', 240)) return false;
    if (!Array.isArray(value.blockers) || value.blockers.some((blocker) => !safeText(blocker, 'receipt.blocker', 240))) return false;
    if (value.channel === 'whatsapp_business' && value.consentState === 'eligible' && (!value.policy.policyFresh || !value.policy.humanEscalationPresent || !value.policy.businessProfilePresent || !value.policy.privacyNoticePresent || !value.policy.contentClassificationProofPresent || (value.policy.templateRequired && !value.policy.templatePresent) || value.blockers.length !== 1 || value.blockers[0] !== 'WhatsApp transport is unconfigured')) return false;
    const { receiptId, receiptDigest, ...body } = value;
    if (typeof receiptDigest !== 'string' || !SHA256.test(receiptDigest) || digest(body) !== receiptDigest) return false;
    return receiptId === `pmcr_${receiptDigest.slice('sha256:'.length, 'sha256:'.length + 24)}`;
  } catch {
    return false;
  }
}
