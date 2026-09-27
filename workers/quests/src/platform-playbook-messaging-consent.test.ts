import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  PLATFORM_PLAYBOOK_TELEGRAM_APPROVAL_SCHEMA,
  PLATFORM_PLAYBOOK_TELEGRAM_PROPOSAL_SCHEMA,
  platformPlaybookTelegramProposalDigest,
  preparePlatformPlaybookTelegramDryRun,
  type PlatformPlaybookTelegramProposal,
} from './platform-playbook-telegram-readiness.ts';
import {
  MESSAGING_RECIPIENT_PREFERENCE_SCHEMA,
  PLATFORM_PLAYBOOK_MESSAGING_CONSENT_CONTRACT,
  PLATFORM_PLAYBOOK_MESSAGING_CONSENT_SCHEMA,
  PLATFORM_PLAYBOOK_MESSAGING_INTENT_SCHEMA,
  messagingIntentDigest,
  preparePlatformPlaybookMessagingConsentDryRun,
  validatePlatformPlaybookMessagingConsentReceipt,
} from './platform-playbook-messaging-consent.ts';

const DIGEST = `sha256:${'a'.repeat(64)}`;
const NOW = '2026-09-27T09:10:00.000Z';

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

function digest(value: unknown) {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

function stage3Proposal(): PlatformPlaybookTelegramProposal {
  return {
    schema: PLATFORM_PLAYBOOK_TELEGRAM_PROPOSAL_SCHEMA,
    proposalId: 'stage3-consent-telegram',
    tenantId: 'cambium',
    platform: 'telegram',
    topicKey: 'agent_ops',
    threadId: 7,
    summary: 'Controlled Telegram consent gate preflight.',
    messageText: 'Messaging consent gate\nProof: receipt:stage4-consent\nNEXT /ts-status',
    proof: { ref: 'evidence:stage4-consent', digest: DIGEST },
    createdAt: '2026-09-27T09:00:00.000Z',
  };
}

function stage3Approval(proposal: PlatformPlaybookTelegramProposal) {
  return {
    schema: PLATFORM_PLAYBOOK_TELEGRAM_APPROVAL_SCHEMA,
    approvalRef: 'approval:stage4-telegram',
    approvedBy: 'founder:stage4-telegram',
    approvedAt: '2026-09-27T09:02:00.000Z',
    status: 'approved',
    scope: 'telegram:send:agent_ops',
    proposalId: proposal.proposalId,
    proposalDigest: platformPlaybookTelegramProposalDigest(proposal),
    topicKey: 'agent_ops',
    threadId: 7,
    messageDigest: digest(proposal.messageText),
    expiresAt: '2026-09-27T09:25:00.000Z',
  };
}

function approvedStage3Receipt() {
  const proposal = stage3Proposal();
  return preparePlatformPlaybookTelegramDryRun(proposal, stage3Approval(proposal), '2026-09-27T09:05:00.000Z');
}

function whatsappRecipient(overrides: Record<string, unknown> = {}) {
  return {
    schema: MESSAGING_RECIPIENT_PREFERENCE_SCHEMA,
    recipientRef: 'recipient:0123456789abcdef',
    channel: 'whatsapp_business',
    status: 'active',
    optedInAt: '2026-09-27T08:30:00.000Z',
    optInProofRef: 'consent:whatsapp-marketing-v1',
    categories: ['marketing', 'utility'],
    categoryOptInProofRefs: {
      marketing: 'consent:whatsapp-marketing-category-v1',
      utility: 'consent:whatsapp-utility-category-v1',
    },
    optOutStatus: 'clear',
    optOutProofRef: 'preference:whatsapp-opt-out-check-v1',
    checkedAt: '2026-09-27T09:08:00.000Z',
    ...overrides,
  };
}

function whatsappIntent(overrides: Record<string, unknown> = {}) {
  return {
    schema: PLATFORM_PLAYBOOK_MESSAGING_INTENT_SCHEMA,
    intentId: 'whatsapp-consent-stage4',
    tenantId: 'cambium',
    channel: 'whatsapp_business',
    category: 'marketing',
    messageText: 'A source-backed product update is ready for your review.',
    proof: { ref: 'evidence:stage4-consent', digest: DIGEST },
    createdAt: '2026-09-27T09:09:00.000Z',
    recipient: whatsappRecipient(),
    whatsapp: {
      businessInitiated: true,
      contentClassification: 'general',
      contentClassificationProofRef: 'evidence:whatsapp-general-classification-v1',
      templateRef: 'template:product-update-v1',
      humanEscalationRef: 'support:thoughtseed',
      businessProfileRef: 'profile:thoughtseed-whatsapp',
      privacyNoticeRef: 'notice:thoughtseed-privacy',
    },
    ...overrides,
  };
}

test('messaging consent contract is dry-run only and cites the reviewed WhatsApp policy', () => {
  const contract = PLATFORM_PLAYBOOK_MESSAGING_CONSENT_CONTRACT;
  assert.equal(contract.schema, PLATFORM_PLAYBOOK_MESSAGING_CONSENT_SCHEMA);
  assert.deepEqual(contract.mode.allowed, ['dry-run']);
  assert.equal(contract.mode.networkSend, false);
  assert.equal(contract.mode.executionAllowed, false);
  assert.equal(contract.mode.scheduleArmed, false);
  assert.equal(contract.recipientPreference.requiresExplicitOptIn, true);
  assert.equal(contract.recipientPreference.requiresCategoryScopedOptIn, true);
  assert.equal(contract.channels.whatsapp_business.officialPolicy.sourceUrl, 'https://whatsappbusiness.com/policy/');
  assert.equal(contract.channels.whatsapp_business.officialPolicy.policyUpdatedAt, '2026-09-23');
});

test('Telegram consent gate requires and carries a valid Stage 3 receipt without exposing message body', () => {
  const stage3Receipt = approvedStage3Receipt();
  const receipt = preparePlatformPlaybookMessagingConsentDryRun({
    schema: PLATFORM_PLAYBOOK_MESSAGING_INTENT_SCHEMA,
    intentId: 'telegram-consent-stage4',
    tenantId: 'cambium',
    channel: 'telegram_internal',
    category: 'internal_operational',
    messageText: stage3Proposal().messageText,
    proof: { ref: 'evidence:stage4-consent', digest: DIGEST },
    createdAt: '2026-09-27T09:06:00.000Z',
    telegram: { stage3Receipt },
  }, NOW);
  assert.equal(receipt.consentState, 'not_applicable');
  assert.deepEqual(receipt.destination, { type: 'telegram_topic', topicKey: 'agent_ops', threadId: 7 });
  assert.equal(receipt.routing.topicMapDigest, stage3Receipt.topicMapDigest);
  assert.equal(receipt.message.bodyStored, false);
  assert.equal(receipt.transport.networkSend, false);
  assert.equal(receipt.transport.executionAllowed, false);
  assert.ok(receipt.blockers.some((blocker) => blocker.includes('Stage 3')));
  assert.doesNotMatch(JSON.stringify(receipt), /Messaging consent gate/);
  assert.equal(validatePlatformPlaybookMessagingConsentReceipt(receipt), true);
});

test('Telegram consent gate rejects missing, unapproved, mismatched, and widened Stage 3 receipts', () => {
  const base = {
    schema: PLATFORM_PLAYBOOK_MESSAGING_INTENT_SCHEMA,
    intentId: 'telegram-consent-stage4',
    tenantId: 'cambium',
    channel: 'telegram_internal',
    category: 'internal_operational',
    messageText: stage3Proposal().messageText,
    proof: { ref: 'evidence:stage4-consent', digest: DIGEST },
    createdAt: '2026-09-27T09:06:00.000Z',
  };
  assert.throws(() => preparePlatformPlaybookMessagingConsentDryRun(base, NOW), /Stage 3 binding/);
  const missingApproval = preparePlatformPlaybookTelegramDryRun(stage3Proposal(), null, '2026-09-27T09:05:00.000Z');
  assert.throws(() => preparePlatformPlaybookMessagingConsentDryRun({ ...base, telegram: { stage3Receipt: missingApproval } }, NOW), /lacks future-send approval/);
  const mismatched = { ...approvedStage3Receipt(), message: { ...approvedStage3Receipt().message, digest: DIGEST } };
  assert.throws(() => preparePlatformPlaybookMessagingConsentDryRun({ ...base, telegram: { stage3Receipt: mismatched } }, NOW), /Stage 3 receipt is invalid/);
  assert.throws(() => preparePlatformPlaybookMessagingConsentDryRun({ ...base, telegram: { stage3Receipt: approvedStage3Receipt(), rawTelegramPayload: 'forbidden' } }, NOW), /telegram.rawTelegramPayload/);
});

test('WhatsApp consent gate recognizes eligible consent but keeps the unconfigured transport blocked', () => {
  const receipt = preparePlatformPlaybookMessagingConsentDryRun(whatsappIntent(), NOW);
  assert.equal(receipt.consentState, 'eligible');
  assert.equal(receipt.destination.type, 'whatsapp_business');
  assert.equal(receipt.routing.topicMapDigest, null);
  assert.equal(receipt.policy.policyFresh, true);
  assert.equal(receipt.policy.templateRequired, true);
  assert.equal(receipt.policy.templatePresent, true);
  assert.equal(receipt.policy.humanEscalationPresent, true);
  assert.equal(receipt.policy.businessProfilePresent, true);
  assert.equal(receipt.policy.privacyNoticePresent, true);
  assert.equal(receipt.policy.contentClassificationProofPresent, true);
  assert.equal(receipt.transport.networkSend, false);
  assert.ok(receipt.blockers.some((blocker) => blocker.includes('transport is unconfigured')));
  assert.doesNotMatch(JSON.stringify(receipt), /recipient:0123456789abcdef/);
  assert.doesNotMatch(JSON.stringify(receipt), /source-backed product update/);
  assert.equal(validatePlatformPlaybookMessagingConsentReceipt(receipt), true);
});

test('WhatsApp consent gate blocks opt-out, stale checks, absent category consent, templates, and escalation', () => {
  const receipt = preparePlatformPlaybookMessagingConsentDryRun(whatsappIntent({
    recipient: whatsappRecipient({ status: 'opted_out', optOutStatus: 'opted_out', categories: ['utility'], categoryOptInProofRefs: { utility: 'consent:whatsapp-utility-category-v1' }, optedInAt: '2026-09-24T08:30:00.000Z', checkedAt: '2026-09-25T09:08:00.000Z' }),
    whatsapp: { businessInitiated: true, contentClassification: 'general', contentClassificationProofRef: 'evidence:whatsapp-general-classification-v1' },
  }), NOW);
  assert.equal(receipt.consentState, 'blocked');
  assert.ok(receipt.blockers.some((blocker) => blocker.includes('not active')));
  assert.ok(receipt.blockers.some((blocker) => blocker.includes('opted out')));
  assert.ok(receipt.blockers.some((blocker) => blocker.includes('stale')));
  assert.ok(receipt.blockers.some((blocker) => blocker.includes('category')));
  assert.ok(receipt.blockers.some((blocker) => blocker.includes('template')));
  assert.ok(receipt.blockers.some((blocker) => blocker.includes('human escalation')));
});

test('WhatsApp customer-service window permits an eligible service draft without a template', () => {
  const receipt = preparePlatformPlaybookMessagingConsentDryRun(whatsappIntent({
    category: 'utility',
    recipient: whatsappRecipient({ categories: ['utility'], categoryOptInProofRefs: { utility: 'consent:whatsapp-utility-category-v1' } }),
    whatsapp: {
      businessInitiated: false,
      contentClassification: 'general',
      contentClassificationProofRef: 'evidence:whatsapp-general-classification-v1',
      customerServiceWindowOpenedAt: '2026-09-27T08:30:00.000Z',
      humanEscalationRef: 'support:thoughtseed',
      businessProfileRef: 'profile:thoughtseed-whatsapp',
      privacyNoticeRef: 'notice:thoughtseed-privacy',
    },
  }), NOW);
  assert.equal(receipt.consentState, 'eligible');
  assert.equal(receipt.policy.withinServiceWindow, true);
  assert.equal(receipt.policy.templateRequired, false);
  assert.equal(receipt.policy.templatePresent, false);
});

test('WhatsApp policy freshness and restricted content fail closed', () => {
  const stale = preparePlatformPlaybookMessagingConsentDryRun(whatsappIntent(), '2026-10-28T09:10:00.000Z');
  assert.equal(stale.policy.policyFresh, false);
  assert.ok(stale.blockers.some((blocker) => blocker.includes('WhatsApp policy review')));
  assert.throws(() => preparePlatformPlaybookMessagingConsentDryRun(whatsappIntent({
    whatsapp: { businessInitiated: true, contentClassification: 'restricted' },
  }), NOW), /regulated or restricted/);
  assert.throws(() => preparePlatformPlaybookMessagingConsentDryRun(whatsappIntent({
    whatsapp: { businessInitiated: true, contentClassification: 'general' },
  }), NOW), /contentClassificationProofRef/);
});

test('recipient and receipt validation fail closed for raw identifiers, unknown fields, and tampering', () => {
  assert.throws(() => preparePlatformPlaybookMessagingConsentDryRun(whatsappIntent({ recipient: whatsappRecipient({ recipientRef: 'recipient:+15551234567' }) }), NOW), /recipientRef/);
  assert.throws(() => preparePlatformPlaybookMessagingConsentDryRun(whatsappIntent({ recipient: whatsappRecipient({ categoryOptInProofRefs: { marketing: 'consent:whatsapp-marketing-category-v1' } }) }), NOW), /categoryOptInProofRefs is incomplete/);
  assert.throws(() => preparePlatformPlaybookMessagingConsentDryRun(whatsappIntent({
    whatsapp: { businessInitiated: true, contentClassification: 'general', contentClassificationProofRef: 'evidence:../classification' },
  }), NOW), /contentClassificationProofRef/);
  assert.throws(() => preparePlatformPlaybookMessagingConsentDryRun({ ...whatsappIntent(), unexpected: true }, NOW), /intent.unexpected/);
  const receipt = preparePlatformPlaybookMessagingConsentDryRun(whatsappIntent(), NOW);
  assert.equal(validatePlatformPlaybookMessagingConsentReceipt({ ...receipt, transport: { ...receipt.transport, networkSend: true } }), false);
  assert.equal(validatePlatformPlaybookMessagingConsentReceipt({ ...receipt, receiptDigest: DIGEST }), false);
  assert.match(messagingIntentDigest({
    schema: PLATFORM_PLAYBOOK_MESSAGING_INTENT_SCHEMA,
    intentId: 'telegram-digest-stage4',
    tenantId: 'cambium',
    channel: 'telegram_internal',
    category: 'internal_operational',
    messageText: stage3Proposal().messageText,
    proof: { ref: 'evidence:stage4-consent', digest: DIGEST },
    createdAt: '2026-09-27T09:06:00.000Z',
    telegram: { stage3Receipt: approvedStage3Receipt() },
  }), /^sha256:/);
});
