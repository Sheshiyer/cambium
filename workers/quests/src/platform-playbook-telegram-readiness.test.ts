import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  PLATFORM_PLAYBOOK_TELEGRAM_APPROVAL_SCHEMA,
  PLATFORM_PLAYBOOK_TELEGRAM_READINESS_CONTRACT,
  PLATFORM_PLAYBOOK_TELEGRAM_READINESS_SCHEMA,
  PLATFORM_PLAYBOOK_TELEGRAM_PROPOSAL_SCHEMA,
  platformPlaybookTelegramProposalDigest,
  preparePlatformPlaybookTelegramDryRun,
  type PlatformPlaybookTelegramProposal,
} from './platform-playbook-telegram-readiness.ts';

const DIGEST = `sha256:${'a'.repeat(64)}`;
const CREATED_AT = '2026-09-27T09:00:00.000Z';
const NOW = '2026-09-27T09:05:00.000Z';

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

function proposal(overrides: Record<string, unknown> = {}): PlatformPlaybookTelegramProposal {
  return {
    schema: PLATFORM_PLAYBOOK_TELEGRAM_PROPOSAL_SCHEMA,
    proposalId: 'platform-playbook-telegram-stage3',
    tenantId: 'cambium',
    platform: 'telegram',
    topicKey: 'agent_ops',
    threadId: 7,
    summary: 'Telegram Stage 3 readiness gate prepared for controlled review.',
    messageText: 'Stage 3 readiness\nWhat happened: Telegram transport remains disabled.\nProof: receipt:stage3-readiness\nNEXT /ts-status',
    proof: { ref: 'receipt:stage3-readiness', digest: DIGEST },
    createdAt: CREATED_AT,
    ...overrides,
  } as PlatformPlaybookTelegramProposal;
}

function approval(input: PlatformPlaybookTelegramProposal, overrides: Record<string, unknown> = {}) {
  return {
    schema: PLATFORM_PLAYBOOK_TELEGRAM_APPROVAL_SCHEMA,
    approvalRef: 'approval:stage3-controlled-send',
    approvedBy: 'founder:stage3-controlled-send',
    approvedAt: '2026-09-27T09:04:00.000Z',
    status: 'approved',
    scope: 'telegram:send:agent_ops',
    proposalId: input.proposalId,
    proposalDigest: platformPlaybookTelegramProposalDigest(input),
    topicKey: input.topicKey,
    threadId: input.threadId,
    messageDigest: digest(input.messageText),
    expiresAt: '2026-09-27T09:29:00.000Z',
    ...overrides,
  };
}

test('controlled readiness contract keeps transport disabled and maps only Agent Ops', () => {
  const contract = PLATFORM_PLAYBOOK_TELEGRAM_READINESS_CONTRACT;
  assert.equal(contract.schema, PLATFORM_PLAYBOOK_TELEGRAM_READINESS_SCHEMA);
  assert.deepEqual(contract.mode.allowed, ['dry-run']);
  assert.equal(contract.mode.networkSend, false);
  assert.equal(contract.mode.executionAllowed, false);
  assert.deepEqual(contract.destination.allowedTopicKeys, ['agent_ops']);
  assert.equal(contract.destination.requireExactThreadBinding, true);
  assert.equal(contract.approval.readinessOnly, true);
});

test('dry-run creates a body-redacted receipt and records missing approval as a blocker', () => {
  const receipt = preparePlatformPlaybookTelegramDryRun(proposal(), null, NOW);
  assert.equal(receipt.route.topicKey, 'agent_ops');
  assert.equal(receipt.route.threadId, 7);
  assert.equal(receipt.message.bodyStored, false);
  assert.equal(receipt.transport.networkSend, false);
  assert.equal(receipt.transport.attempted, false);
  assert.equal(receipt.approvalState, 'missing');
  assert.match(receipt.receiptId, /^ptgr_[0-9a-f]{24}$/);
  assert.ok(receipt.blockers.some((blocker) => blocker.includes('approval')));
  assert.doesNotMatch(JSON.stringify(receipt), /What happened/);
});

test('approved future-send receipt binds approval, proposal, route, and message without enabling transport', () => {
  const input = proposal();
  const receipt = preparePlatformPlaybookTelegramDryRun(input, approval(input), NOW);
  assert.equal(receipt.approvalState, 'approved-for-future-send');
  assert.equal(receipt.transport.networkSend, false);
  assert.ok(receipt.blockers.some((blocker) => blocker.includes('transport remains disabled')));

  const invalid = preparePlatformPlaybookTelegramDryRun(input, approval(input, { messageDigest: DIGEST }), NOW);
  assert.equal(invalid.approvalState, 'invalid');

  const widened = preparePlatformPlaybookTelegramDryRun(input, approval(input, { rawTelegramPayload: 'withheld' }), NOW);
  assert.equal(widened.approvalState, 'invalid');
  assert.ok(widened.blockers.some((blocker) => blocker.includes('unsupported fields')));
});

test('proposal rejects an unpinned route, missing next action, secret-shaped input, and oversized messages', () => {
  assert.throws(() => preparePlatformPlaybookTelegramDryRun(proposal({ topicKey: 'dev', threadId: 4 }), null, NOW), /topicKey/);
  assert.throws(() => preparePlatformPlaybookTelegramDryRun(proposal({ messageText: 'No next action.' }), null, NOW), /next action/);
  assert.throws(() => preparePlatformPlaybookTelegramDryRun(proposal({ summary: 'Bearer secret' }), null, NOW), /summary/);
  assert.throws(() => preparePlatformPlaybookTelegramDryRun(proposal({ messageText: `${'a'.repeat(1024)}\nNEXT /ts-status` }), null, NOW), /messageText/);
});

test('expired, overlong, and misordered approval windows fail closed', () => {
  const input = proposal();
  assert.equal(preparePlatformPlaybookTelegramDryRun(input, approval(input, { expiresAt: NOW }), NOW).approvalState, 'expired');
  assert.equal(preparePlatformPlaybookTelegramDryRun(input, approval(input, { expiresAt: '2026-09-27T09:34:00.001Z' }), NOW).approvalState, 'invalid');
  assert.equal(preparePlatformPlaybookTelegramDryRun(input, approval(input, { approvedAt: '2026-09-27T08:59:59.999Z' }), NOW).approvalState, 'invalid');
  assert.equal(preparePlatformPlaybookTelegramDryRun(input, approval(input, { expiresAt: 'not-a-timestamp' }), NOW).approvalState, 'invalid');
});
