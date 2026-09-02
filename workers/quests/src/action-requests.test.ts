import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createActionRequestRecord,
  listActionRequestRecords,
  resolveActionRequestRecord,
  resolveActionRequestReplyRecord,
  type ActionRequestKvLike,
} from './action-requests.ts';

const FOUNDER_A = ['137', '1522080'].join('');
const FOUNDER_B = ['926', '168615'].join('');
const FOUNDERS = [FOUNDER_A, FOUNDER_B];
const CREATED_AT = '2026-08-18T10:00:00.000Z';
const EXPIRES_AT = '2026-08-18T10:30:00.000Z';

function fakeKv(): ActionRequestKvLike {
  const rows = new Map<string, string>();
  return {
    async get(key) { return rows.get(key) ?? null; },
    async put(key, value) { rows.set(key, value); },
    async list(prefix) { return [...rows.keys()].filter((key) => key.startsWith(prefix)); },
  };
}

function hrActionRequest() {
  return {
    schema: 'thoughtseed.action-request.v1',
    id: 'ar_hr_imran_exit_packet',
    idempotencyKey: 'hr:imran:exit-packet:2026-08-18',
    tenantId: 'cambium',
    status: 'proposed',
    source: 'hermes-founder-intent',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    branchId: 'thoughtseed-hr',
    branchLabel: 'ThoughtSeed HR',
    projectId: 'thoughtseed-hr',
    projectName: 'ThoughtSeed People Operations',
    questId: 'living-org',
    topic: {
      chatId: '-1003942929819',
      topicKey: 'agent-ops',
      threadId: 7,
      sourceMessageId: '5512',
    },
    title: 'Approve Imran separation packet',
    summary: 'Generate the final relieving letter and May–July payslip packet; do not email it yet.',
    why: 'Official employee documents require one founder approval before final rendering.',
    approval: {
      mode: 'telegram-reply-or-button',
      expiresAt: EXPIRES_AT,
      workObjectId: 'program:thoughtseed-vault',
    },
    options: [
      {
        id: 'approve-final-render',
        label: 'Approve final render',
        consequence: 'queue the official HTML-to-PDF render; external email remains separately gated',
        risk: 'high',
        requiresSignedConfirmation: false,
        acceptsVerbalApproval: true,
        resultKind: 'queue_task',
      },
      {
        id: 'hold',
        label: 'Hold for review',
        consequence: 'retain the preview without creating final documents',
        risk: 'low',
        requiresSignedConfirmation: false,
        resultKind: 'hold',
      },
    ],
    receipts: [],
    redaction: 'redacted',
  };
}

test('generic HR ActionRequest is accepted and projected without Telegram chat identity', async () => {
  const kv = fakeKv();
  const created = await createActionRequestRecord(kv, hrActionRequest(), () => CREATED_AT);
  assert.equal(created.status, 200);
  assert.equal((created.body.actionRequest as any).approval.workObjectId, 'program:thoughtseed-vault');

  const listed = await listActionRequestRecords(kv);
  assert.equal(listed.status, 200);
  const serialized = JSON.stringify(listed.body);
  assert.match(serialized, /telegram-reply-or-button/);
  assert.doesNotMatch(serialized, /-1003942929819/);
});

test('generic workflow rejects unknown work objects and approval windows longer than thirty minutes', async () => {
  const badWorkObject = structuredClone(hrActionRequest());
  badWorkObject.approval.workObjectId = 'program:invented-control-plane';
  assert.equal((await createActionRequestRecord(fakeKv(), badWorkObject, () => CREATED_AT)).status, 400);

  const longWindow = structuredClone(hrActionRequest());
  longWindow.approval.expiresAt = '2026-08-18T10:31:00.000Z';
  const rejected = await createActionRequestRecord(fakeKv(), longWindow, () => CREATED_AT);
  assert.equal(rejected.status, 400);
  assert.match(String(rejected.body.error), /30 minutes/);
});

test('HR button approval revalidates the founder allowlist and queues high-risk bounded work', async () => {
  const kv = fakeKv();
  await createActionRequestRecord(kv, hrActionRequest(), () => CREATED_AT);

  const rejected = await resolveActionRequestRecord(kv, 'ar_hr_imran_exit_packet', {
    tenantId: 'cambium',
    optionId: 'approve-final-render',
    founderTelegramUserId: '999',
    actor: { telegramUserId: '999', chatId: '-1003942929819', threadId: 7 },
  }, () => '2026-08-18T10:10:00.000Z', FOUNDERS);
  assert.equal(rejected.status, 403);
  assert.match(String(rejected.body.error), /not an authorized founder/);

  const approved = await resolveActionRequestRecord(kv, 'ar_hr_imran_exit_packet', {
    tenantId: 'cambium',
    optionId: 'approve-final-render',
    founderTelegramUserId: FOUNDER_B,
    actor: { telegramUserId: FOUNDER_B, chatId: '-1003942929819', threadId: 7 },
  }, () => '2026-08-18T10:10:00.000Z', FOUNDERS);
  assert.equal(approved.status, 200);
  assert.equal((approved.body.actionRequest as any).status, 'queued');
  assert.equal(approved.body.miniAppGate, undefined);
});

test('reply approval is exact, reply-bound, unique, and expires after thirty minutes', async () => {
  const ambientKv = fakeKv();
  await createActionRequestRecord(ambientKv, hrActionRequest(), () => CREATED_AT);
  const ambient = await resolveActionRequestReplyRecord(ambientKv, 'ar_hr_imran_exit_packet', {
    tenantId: 'cambium',
    phrase: 'yes',
    founderTelegramUserId: FOUNDER_A,
    actor: { telegramUserId: FOUNDER_A, chatId: '-1003942929819', threadId: 7 },
    reply: { actionRequestId: 'a-different-card', replyToOwnMessage: true },
  }, () => '2026-08-18T10:10:00.000Z', FOUNDERS);
  assert.equal(ambient.status, 409);

  const kv = fakeKv();
  await createActionRequestRecord(kv, hrActionRequest(), () => CREATED_AT);
  const approved = await resolveActionRequestReplyRecord(kv, 'ar_hr_imran_exit_packet', {
    tenantId: 'cambium',
    phrase: 'approve',
    founderTelegramUserId: FOUNDER_A,
    actor: { telegramUserId: FOUNDER_A, chatId: '-1003942929819', threadId: 7 },
    reply: { actionRequestId: 'ar_hr_imran_exit_packet', replyToOwnMessage: true },
  }, () => '2026-08-18T10:29:59.000Z', FOUNDERS);
  assert.equal(approved.status, 200);
  assert.equal((approved.body.actionRequest as any).status, 'queued');
  assert.equal((approved.body.actionRequest as any).receipts.at(-1).kind, 'reply');

  const expiredKv = fakeKv();
  await createActionRequestRecord(expiredKv, hrActionRequest(), () => CREATED_AT);
  const expired = await resolveActionRequestReplyRecord(expiredKv, 'ar_hr_imran_exit_packet', {
    tenantId: 'cambium',
    phrase: 'yes',
    founderTelegramUserId: FOUNDER_A,
    actor: { telegramUserId: FOUNDER_A, chatId: '-1003942929819', threadId: 7 },
    reply: { actionRequestId: 'ar_hr_imran_exit_packet', replyToOwnMessage: true },
  }, () => EXPIRES_AT, FOUNDERS);
  assert.equal(expired.status, 410);
  assert.equal((expired.body.actionRequest as any).status, 'superseded');
});

