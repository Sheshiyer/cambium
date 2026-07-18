import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { d1MarketingRenderStore } from './marketing-render-store.ts';
import { prepareMarketingRender } from './marketing-renderer.ts';
import type { MarketingPreparedRender } from './marketing-renderer.ts';

const NOW = '2026-07-18T13:00:00.000Z';
const EXPIRES = '2026-07-18T14:00:00.000Z';

class SqliteD1 {
  db = new DatabaseSync(':memory:');
  beforeRun?: (sql: string) => void;

  prepare(sql: string) {
    const statement = this.db.prepare(sql);
    let values: unknown[] = [];
    const api = {
      bind: (...next: unknown[]) => {
        values = next;
        return api;
      },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: statement.all(...values) as T[] }),
      run: async () => {
        this.beforeRun?.(sql);
        const result = statement.run(...values);
        return { meta: { changes: Number(result.changes) } };
      },
    };
    return api;
  }
}

async function preparedFixture(overrides: Record<string, unknown> = {}): Promise<MarketingPreparedRender> {
  return prepareMarketingRender({
    requestId: 'marketing-render-request-001',
    idempotencyKey: 'marketing-render-replay-001',
    actorId: 'operator-founder-001',
    budgetReservationId: 'budget-founder-article-001',
    expiresAt: EXPIRES,
    brief: {
      briefId: 'asset-brief-founder-001',
      objective: 'Explain safe organic media.',
      audience: 'Founder-led teams',
      callToAction: 'Review the workflow.',
      productPacketId: 'thoughtseed-marketing@1.0.0',
      productPacketDigest: '2'.repeat(64),
      evidenceSnapshotDigest: '3'.repeat(64),
      seedDigest: '4'.repeat(64),
      facts: [{ claimId: 'claim-safe-001', text: 'Every draft requires review.', sourceDigest: '5'.repeat(64) }],
    },
    ...overrides,
  }, { now: () => NOW });
}

async function harness() {
  const db = new SqliteD1();
  db.db.exec(await readFile(new URL('../migrations/0005_marketing_create_renderer.sql', import.meta.url), 'utf8'));
  return { db, store: d1MarketingRenderStore(db) };
}

test('D1 prepare is idempotent for identical input and conflicts on drift', async () => {
  const { store } = await harness();
  const prepared = await preparedFixture();
  const first = await store.prepare(prepared);
  assert.equal(first.status, 'prepared');
  const duplicate = await store.prepare(prepared);
  assert.equal(duplicate.status, 'duplicate');

  const drifted = await preparedFixture({ requestId: 'marketing-render-request-002' });
  const conflict = await store.prepare(drifted);
  assert.deepEqual(conflict, { status: 'conflict' });
  const stored = await store.getPrepared(prepared.requestId);
  assert.equal(stored?.requestDigest, prepared.requestDigest);
});

test('D1 approval is derived from the persisted action and replays immutably', async () => {
  const { store } = await harness();
  const prepared = await preparedFixture();
  await store.prepare(prepared);
  const approved = await store.approvePrepared({
    requestId: prepared.requestId,
    founderId: '12345',
    decidedAt: NOW,
    approvalDecisionId: 'approval-marketing-render-001',
  });
  assert.equal(approved.status, 'approved');
  if (approved.status !== 'approved') return;
  assert.equal(approved.approval.action_digest, prepared.actionDigest);
  assert.equal(approved.approval.approver_id, 'telegram-founder-12345');
  assert.equal(approved.approval.expires_at, prepared.expiresAt);

  const duplicate = await store.approvePrepared({
    requestId: prepared.requestId,
    founderId: '12345',
    decidedAt: NOW,
    approvalDecisionId: 'approval-marketing-render-001',
  });
  assert.equal(duplicate.status, 'duplicate');
  const loaded = await store.getApproval('approval-marketing-render-001');
  assert.deepEqual(loaded, approved.approval);
});

test('D1 approval rejects malformed or out-of-window timestamps before persistence', async () => {
  for (const decidedAt of [
    'not-a-timestamp',
    '2026-07-18T12:59:59.000Z',
    '2026-07-18T14:00:00.000Z',
  ]) {
    const { store } = await harness();
    const prepared = await preparedFixture();
    await store.prepare(prepared);
    const result = await store.approvePrepared({
      requestId: prepared.requestId,
      founderId: '12345',
      decidedAt,
      approvalDecisionId: 'approval-marketing-render-invalid',
    });
    assert.deepEqual(result, { status: 'conflict' }, decidedAt);
    assert.equal(await store.getApproval('approval-marketing-render-invalid'), null, decidedAt);
  }
});

test('D1 claim permits one active fence and reports concurrent work busy', async () => {
  const { store } = await harness();
  const prepared = await preparedFixture();
  await store.prepare(prepared);
  const approval = await store.approvePrepared({
    requestId: prepared.requestId,
    founderId: '12345',
    decidedAt: NOW,
    approvalDecisionId: 'approval-marketing-render-001',
  });
  assert.ok(approval.status === 'approved');
  const first = await store.claim({
    requestId: prepared.requestId,
    requestDigest: prepared.requestDigest,
    actionDigest: prepared.actionDigest,
    approvalDecisionId: 'approval-marketing-render-001',
    claimId: 'claim-render-001',
    claimedAt: NOW,
    leaseExpiresAt: '2026-07-18T13:05:00.000Z',
  });
  assert.deepEqual(first, {
    status: 'claimed',
    requestId: prepared.requestId,
    claimId: 'claim-render-001',
    fencingToken: 1,
    leaseExpiresAt: '2026-07-18T13:05:00.000Z',
  });
  const concurrent = await store.claim({
    requestId: prepared.requestId,
    requestDigest: prepared.requestDigest,
    actionDigest: prepared.actionDigest,
    approvalDecisionId: 'approval-marketing-render-001',
    claimId: 'claim-render-002',
    claimedAt: '2026-07-18T13:01:00.000Z',
    leaseExpiresAt: '2026-07-18T13:06:00.000Z',
  });
  assert.deepEqual(concurrent, { status: 'busy', retryAfterMs: 240000 });
});

test('D1 reclaims only an expired pre-invocation claim with a higher fence', async () => {
  const { store } = await harness();
  const prepared = await preparedFixture();
  await store.prepare(prepared);
  await store.approvePrepared({ requestId: prepared.requestId, founderId: '12345', decidedAt: NOW, approvalDecisionId: 'approval-marketing-render-001' });
  await store.claim({
    requestId: prepared.requestId,
    requestDigest: prepared.requestDigest,
    actionDigest: prepared.actionDigest,
    approvalDecisionId: 'approval-marketing-render-001',
    claimId: 'claim-render-001',
    claimedAt: NOW,
    leaseExpiresAt: '2026-07-18T13:01:00.000Z',
  });
  const reclaimed = await store.claim({
    requestId: prepared.requestId,
    requestDigest: prepared.requestDigest,
    actionDigest: prepared.actionDigest,
    approvalDecisionId: 'approval-marketing-render-001',
    claimId: 'claim-render-002',
    claimedAt: '2026-07-18T13:02:00.000Z',
    leaseExpiresAt: '2026-07-18T13:07:00.000Z',
  });
  assert.deepEqual(reclaimed, {
    status: 'claimed',
    requestId: prepared.requestId,
    claimId: 'claim-render-002',
    fencingToken: 2,
    leaseExpiresAt: '2026-07-18T13:07:00.000Z',
  });
});

test('D1 expired takeover replays a terminal winner instead of reporting busy', async () => {
  const { db, store } = await harness();
  const prepared = await preparedFixture();
  await store.prepare(prepared);
  await store.approvePrepared({
    requestId: prepared.requestId,
    founderId: '12345',
    decidedAt: NOW,
    approvalDecisionId: 'approval-marketing-render-001',
  });
  await store.claim({
    requestId: prepared.requestId,
    requestDigest: prepared.requestDigest,
    actionDigest: prepared.actionDigest,
    approvalDecisionId: 'approval-marketing-render-001',
    claimId: 'claim-render-001',
    claimedAt: NOW,
    leaseExpiresAt: '2026-07-18T13:01:00.000Z',
  });

  let raced = false;
  db.beforeRun = (sql) => {
    if (raced || !/fencing_token = fencing_token \+ 1/.test(sql)) return;
    raced = true;
    db.db.prepare(`
      UPDATE marketing_render_runs
      SET status = 'failed', invoked_at = ?, error_code = 'raced_failure',
        updated_at = ?, terminal_at = ?
      WHERE request_id = ? AND status = 'claimed'
    `).run(
      '2026-07-18T13:01:30.000Z',
      '2026-07-18T13:01:31.000Z',
      '2026-07-18T13:01:31.000Z',
      prepared.requestId,
    );
  };
  const result = await store.claim({
    requestId: prepared.requestId,
    requestDigest: prepared.requestDigest,
    actionDigest: prepared.actionDigest,
    approvalDecisionId: 'approval-marketing-render-001',
    claimId: 'claim-render-002',
    claimedAt: '2026-07-18T13:02:00.000Z',
    leaseExpiresAt: '2026-07-18T13:07:00.000Z',
  });
  assert.equal(raced, true);
  assert.deepEqual(result, { status: 'terminal', outcome: 'failed', code: 'raced_failure' });
});

test('D1 confirms durable invoking readback before any provider authority', async () => {
  const { store } = await harness();
  const prepared = await preparedFixture();
  await store.prepare(prepared);
  await store.approvePrepared({ requestId: prepared.requestId, founderId: '12345', decidedAt: NOW, approvalDecisionId: 'approval-marketing-render-001' });
  const claim = await store.claim({
    requestId: prepared.requestId,
    requestDigest: prepared.requestDigest,
    actionDigest: prepared.actionDigest,
    approvalDecisionId: 'approval-marketing-render-001',
    claimId: 'claim-render-001',
    claimedAt: NOW,
    leaseExpiresAt: '2026-07-18T13:05:00.000Z',
  });
  assert.ok(claim.status === 'claimed');
  if (claim.status !== 'claimed') return;
  assert.equal(await store.beginInvocation({
    requestId: prepared.requestId,
    claimId: claim.claimId,
    fencingToken: claim.fencingToken,
    observedAt: NOW,
  }), 'confirmed');
  assert.equal(await store.beginInvocation({
    requestId: prepared.requestId,
    claimId: claim.claimId,
    fencingToken: claim.fencingToken + 1,
    observedAt: NOW,
  }), 'reconciliation_required');
  const replay = await store.claim({
    requestId: prepared.requestId,
    requestDigest: prepared.requestDigest,
    actionDigest: prepared.actionDigest,
    approvalDecisionId: 'approval-marketing-render-001',
    claimId: 'claim-render-002',
    claimedAt: '2026-07-18T13:10:00.000Z',
    leaseExpiresAt: '2026-07-18T13:15:00.000Z',
  });
  assert.deepEqual(replay, { status: 'reconciliation_required', state: 'invoking' });
});

test('D1 stale fences cannot finalize normalized renderer output', async () => {
  const { store } = await harness();
  const prepared = await preparedFixture();
  await store.prepare(prepared);
  await store.approvePrepared({ requestId: prepared.requestId, founderId: '12345', decidedAt: NOW, approvalDecisionId: 'approval-marketing-render-001' });
  const claim = await store.claim({
    requestId: prepared.requestId,
    requestDigest: prepared.requestDigest,
    actionDigest: prepared.actionDigest,
    approvalDecisionId: 'approval-marketing-render-001',
    claimId: 'claim-render-001',
    claimedAt: NOW,
    leaseExpiresAt: '2026-07-18T13:05:00.000Z',
  });
  assert.ok(claim.status === 'claimed');
  if (claim.status !== 'claimed') return;
  await store.beginInvocation({ requestId: prepared.requestId, claimId: claim.claimId, fencingToken: claim.fencingToken, observedAt: NOW });
  const artifact = {
    schema_version: 'asset_draft@1.0.0' as const,
    tenant: { tenant_id: 'thoughtseed' as const, purpose: 'marketing_create_render' as const, data_classification: 'public_business' as const, processing_region: 'global' as const, retention_days: 30 as const },
    record_id: 'asset-draft-001', brief_id: 'asset-brief-founder-001', recipe_id: 'founder-article-draft@1.0.0' as const,
    title: 'Title', body: 'Body', claim_ids: ['claim-safe-001'], evidence_snapshot_digest: '3'.repeat(64),
    rights_state: 'review_required' as const, status: 'draft' as const, created_at: NOW, content_digest: '6'.repeat(64),
  };
  const receipt = {
    schema_version: 'operator_receipt@1.0.0' as const,
    tenant: artifact.tenant,
    record_id: 'operator-receipt-001', task_id: prepared.requestId, state: 'awaiting_human_approval' as const,
    artifact_count: 1 as const, next_action: 'review' as const, replayed: false, redaction_applied: true as const, updated_at: NOW,
  };
  assert.equal(await store.complete({
    requestId: prepared.requestId,
    claimId: claim.claimId,
    fencingToken: claim.fencingToken + 1,
    artifact,
    receipt,
    artifactDigest: artifact.content_digest,
    providerUsageTokens: 100,
    recordedAt: NOW,
  }), 'reconciliation_required');
  assert.equal(await store.complete({
    requestId: prepared.requestId,
    claimId: claim.claimId,
    fencingToken: claim.fencingToken,
    artifact,
    receipt,
    artifactDigest: artifact.content_digest,
    providerUsageTokens: 100,
    recordedAt: NOW,
  }), 'recorded');
  const replay = await store.claim({
    requestId: prepared.requestId,
    requestDigest: prepared.requestDigest,
    actionDigest: prepared.actionDigest,
    approvalDecisionId: 'approval-marketing-render-001',
    claimId: 'claim-render-002',
    claimedAt: '2026-07-18T13:10:00.000Z',
    leaseExpiresAt: '2026-07-18T13:15:00.000Z',
  });
  assert.equal(replay.status, 'terminal');
  if (replay.status === 'terminal') assert.equal(replay.outcome, 'succeeded');
});
