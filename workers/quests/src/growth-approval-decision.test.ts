import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { createFounderAccessHost } from './founder-access-host.ts';
import { founderDecisionHttp, GROWTH_APPROVAL_ROUTES } from './founder-decision-transport.ts';
import { d1GoalGraphStore, GROWTH_DECISION_RECEIPT_KIND } from './goal-graph-store.ts';
import type { GoalGraphD1DatabaseLike, GoalGraphD1StatementLike } from './goal-graph-store.ts';
import {
  GROWTH_APPROVAL_PROPOSAL_SCHEMA, growthApprovalChangeDigest, growthApprovalConfirmation,
  growthApprovalDecision, growthApprovalProposalFromRecord, validGrowthApprovalSubject,
} from './growth-approval-decision.ts';

const TENANT = 'cambium';
const OTHER_TENANT = 'other-tenant';
const FOUNDER_A = 'access:founder-a';
const FOUNDER_B = 'access:founder-b';
const OUTSIDER = 'access:outsider';
const NOW = '2026-10-27T00:00:00.000Z';
const EXPIRES = '2026-10-27T01:00:00.000Z';
const BINDINGS = JSON.stringify([
  { founderId: FOUNDER_A, tenantId: TENANT }, { founderId: FOUNDER_B, tenantId: TENANT },
  { founderId: OUTSIDER, tenantId: OTHER_TENANT },
]);
const SUBJECT = {
  cellPath: '20-operations/growth/department/02-copywriter/social-posts',
  calendarRowId: '20-operations/growth/2026-08-24-x-linkedin-case-study-calendar.md#week-1/row-1',
  bodyDigest: `sha256:${'a'.repeat(64)}`,
};

class SqliteD1 implements GoalGraphD1DatabaseLike {
  readonly db = new DatabaseSync(':memory:');
  prepare(sql: string): GoalGraphD1StatementLike {
    const statement = this.db.prepare(sql);
    let values: unknown[] = [];
    const api: GoalGraphD1StatementLike = {
      bind: (...next: unknown[]) => { values = next; return api; },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: statement.all(...values) as T[] }),
      run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
    };
    return api;
  }
  async batch(statements: GoalGraphD1StatementLike[]): Promise<unknown[]> {
    this.db.exec('BEGIN');
    try { const out: unknown[] = []; for (const s of statements) out.push(await s.run()); this.db.exec('COMMIT'); return out; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}

function record(overrides: Record<string, unknown> = {}) {
  const subject = { ...SUBJECT, ...(overrides.subject as object ?? {}) };
  return {
    schema: GROWTH_APPROVAL_PROPOSAL_SCHEMA, tenantId: TENANT, version: 1, nonce: 'nonce-growth-1', expiresAt: EXPIRES,
    changeDigest: growthApprovalChangeDigest(subject), subject,
    gate: { fence: 'pass', grade: 'graded', rowStatus: 'queued' },
    review: {
      cell: subject.cellPath, body: { path: `${subject.cellPath}/current.md`, digest: subject.bodyDigest },
      fence: { result: 'pass', path: '20-operations/growth/cambium-temperance-social-workflow.md#4', hits: 0 },
      grade: { verdict: 'graded', desk: '06-analyst', rubric: 'spotting-ai-slop' },
      row: { path: '20-operations/growth/2026-08-24-x-linkedin-case-study-calendar.md', week: 1, ordinal: 1, status: 'queued' },
    },
    summary: 'Approve 02-copywriter/social-posts for 2026-08-24 x thread.',
    ...overrides, subject,
  };
}

async function harness(stored: Record<string, unknown> | null = record(), bindingsJson = BINDINGS) {
  const db = new SqliteD1();
  db.db.exec(await readFile(new URL('../migrations/0007_goal_graph.sql', import.meta.url), 'utf8'));
  db.db.exec(await readFile(new URL('../migrations/0009_goal_graph_operational_anchors.sql', import.meta.url), 'utf8'));
  const base = d1GoalGraphStore(db);
  const calls = { commit: 0, reject: 0, goalTaskReads: 0, kvWrites: 0, fetch: 0 };
  // Guard every other write path: a growth decision may only reach recordGrowthDecision.
  const store = { ...base,
    commit: async (...args: Parameters<typeof base.commit>) => { calls.commit++; return base.commit(...args); },
    reject: async (...args: Parameters<typeof base.reject>) => { calls.reject++; return base.reject(...args); },
  };
  const host = createFounderAccessHost({
    store, bindingsJson,
    verifyFounder: async (request) => request.headers.get('x-test-founder'),
    readTask: async () => { calls.goalTaskReads++; return null; },
    reviewTask: () => null,
    now: () => NOW,
    readGrowthProposalRecord: async (tenantId, digest) =>
      stored && stored.tenantId === tenantId && String(stored.changeDigest).replace(/^sha256:/, '') === digest.replace(/^sha256:/, '') ? stored : null,
  });
  assert.ok(host, 'host configured');
  const count = (table: string) => Number((db.db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n);
  const post = async (path: string, body: unknown, founder: string | null = FOUNDER_A) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => { calls.fetch++; throw new Error('no network leaves the growth decision'); }) as typeof fetch;
    try {
      const response = await founderDecisionHttp(new Request(`https://cambium.invalid${path}`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...(founder ? { 'x-test-founder': founder } : {}) }, body: JSON.stringify(body),
      }), host);
      return { status: response.status, body: await response.json() as Record<string, any> };
    } finally { globalThis.fetch = originalFetch; }
  };
  const id = `${TENANT}:${record().changeDigest}`;
  const review = async (founder = FOUNDER_A) => post('/v1/founder/growth/proposal', { proposalId: id }, founder);
  const envelope = (decision: 'approved' | 'rejected', confirmation: string, p = record()) => ({
    proposalId: id, version: p.version, changeDigest: p.changeDigest, nonce: p.nonce, expiresAt: p.expiresAt, decision, confirmation,
  });
  return { db, store, host, calls, count, post, review, envelope, id };
}

function expectNoWrites(h: Awaited<ReturnType<typeof harness>>) {
  assert.equal(h.count('goal_graph_approvals'), 0);
  assert.equal(h.calls.commit + h.calls.reject + h.calls.fetch, 0);
}

test('growth subject digest is deterministic and the subject is strictly shaped', () => {
  assert.ok(validGrowthApprovalSubject(SUBJECT));
  assert.equal(growthApprovalChangeDigest(SUBJECT), growthApprovalChangeDigest({ ...SUBJECT }));
  assert.notEqual(growthApprovalChangeDigest(SUBJECT), growthApprovalChangeDigest({ ...SUBJECT, bodyDigest: `sha256:${'b'.repeat(64)}` }));
  assert.match(growthApprovalChangeDigest(SUBJECT), /^sha256:[a-f0-9]{64}$/);
  assert.ok(!validGrowthApprovalSubject({ ...SUBJECT, body: 'draft copy' }));
  assert.ok(!validGrowthApprovalSubject({ ...SUBJECT, bodyDigest: 'abc' }));
  assert.ok(!validGrowthApprovalSubject({ ...SUBJECT, cellPath: '../../etc' }));
});

test('stored record validation fails closed on drift and on inlined body copy', () => {
  const key = { tenantId: TENANT, changeDigest: record().changeDigest };
  assert.ok(growthApprovalProposalFromRecord(record(), key, FOUNDER_A));
  assert.equal(growthApprovalProposalFromRecord(record({ tenantId: OTHER_TENANT }), key, FOUNDER_A), null);
  assert.equal(growthApprovalProposalFromRecord(record({ changeDigest: `sha256:${'c'.repeat(64)}` }), key, FOUNDER_A), null);
  assert.equal(growthApprovalProposalFromRecord(record({ schema: 'cambium.goal-graph-intake-task.v1' }), key, FOUNDER_A), null);
  assert.equal(growthApprovalProposalFromRecord(record({ gate: { fence: 'pass', grade: 'graded', rowStatus: 'queued', composio: true } }), key, FOUNDER_A), null);
  const inlined = record(); (inlined.review as Record<string, unknown>).body = { path: 'x.md', digest: SUBJECT.bodyDigest, text: 'Here is the whole thread...' };
  assert.equal(growthApprovalProposalFromRecord(inlined, key, FOUNDER_A), null);
  // The founder on the proposal is the verified caller, never a stored claim.
  assert.equal(growthApprovalProposalFromRecord(record({ founderId: OUTSIDER }), key, FOUNDER_A)?.founderId, FOUNDER_A);
});

test('a signed approve writes exactly one growth receipt and nothing else', async () => {
  const h = await harness();
  const reviewed = await h.review();
  assert.equal(reviewed.status, 200);
  assert.deepEqual(reviewed.body.actions, { approve: true, revise: true, hold: true });
  assert.equal(reviewed.body.externalAction, 'none');
  assert.equal(reviewed.body.proposal.subject.bodyDigest, SUBJECT.bodyDigest);
  assert.ok(!JSON.stringify(reviewed.body).includes('Here is the whole thread'));
  const approved = await h.post('/v1/founder/growth/decision', h.envelope('approved', reviewed.body.approveConfirmation));
  assert.equal(approved.status, 200);
  assert.equal(approved.body.status, 'approved');
  assert.equal(approved.body.canonicalReadback, true);
  assert.equal(approved.body.writerAuthority, false);
  assert.equal(approved.body.externalAction, 'none');
  assert.equal(approved.body.receipt.founderId, FOUNDER_A);
  assert.equal(approved.body.receipt.channel, 'curious');
  assert.deepEqual(approved.body.receipt.subject, SUBJECT);
  // Exactly the receipt: one approvals row, no graph head, node, event, migration or anchor rows.
  assert.equal(h.count('goal_graph_approvals'), 1);
  for (const table of ['goal_graph_heads', 'goal_graph_nodes', 'goal_graph_events', 'goal_graph_migrations']) assert.equal(h.count(table), 0, table);
  const row = h.db.db.prepare('SELECT decision, approver_id, canonical_json FROM goal_graph_approvals').get() as Record<string, string>;
  assert.equal(row.decision, 'approved');
  assert.equal(row.approver_id, FOUNDER_A);
  const metadata = JSON.parse(row.canonical_json);
  assert.equal(metadata.kind, GROWTH_DECISION_RECEIPT_KIND);
  assert.deepEqual(metadata.subject, SUBJECT);
  assert.ok(!('body' in metadata) && !('composio_job_id' in metadata) && !('permalink' in metadata));
  // No Goal Graph commit/reject, no Goal Graph task read, no network call, no KV write.
  assert.equal(h.calls.commit, 0);
  assert.equal(h.calls.reject, 0);
  assert.equal(h.calls.goalTaskReads, 0);
  assert.equal(h.calls.fetch, 0);
  assert.equal(h.calls.kvWrites, 0);
});

test('replaying the same tuple returns the original receipt without a second write', async () => {
  const h = await harness();
  const confirmation = (await h.review()).body.approveConfirmation;
  const first = await h.post('/v1/founder/growth/decision', h.envelope('approved', confirmation));
  const replay = await h.post('/v1/founder/growth/decision', h.envelope('approved', confirmation));
  assert.equal(replay.status, 200);
  assert.equal(replay.body.receiptDigest, first.body.receiptDigest);
  assert.equal(replay.body.receipt.decidedAt, first.body.receipt.decidedAt);
  const status = await h.post('/v1/founder/growth/status', h.envelope('approved', ''));
  assert.equal(status.body.receiptDigest, first.body.receiptDigest);
  // The other bound co-founder reads the same immutable receipt; it stays attributed to the signer.
  const coFounder = await h.post('/v1/founder/growth/status', h.envelope('approved', ''), FOUNDER_B);
  assert.equal(coFounder.status, 200);
  assert.equal(coFounder.body.receipt.founderId, FOUNDER_A);
  assert.equal(h.count('goal_graph_approvals'), 1);
  assert.equal(h.calls.commit + h.calls.reject + h.calls.fetch, 0);
});

test('revise and hold arrive as rejected; a later approve conflicts and writes nothing', async () => {
  const h = await harness();
  const reviewed = (await h.review()).body;
  const held = await h.post('/v1/founder/growth/decision', h.envelope('rejected', reviewed.rejectConfirmation));
  assert.equal(held.status, 200);
  assert.equal(held.body.status, 'rejected');
  const approve = await h.post('/v1/founder/growth/decision', h.envelope('approved', reviewed.approveConfirmation));
  assert.equal(approve.status, 409);
  assert.equal(approve.body.status, 'conflict');
  assert.equal(h.count('goal_graph_approvals'), 1);
  assert.equal(h.count('goal_graph_nodes'), 0);
});

test('a card with a failed fence, a revise grade or a non-queued row cannot produce an approve', async () => {
  for (const gate of [{ fence: 'fail', grade: 'graded', rowStatus: 'queued' }, { fence: 'pass', grade: 'revise', rowStatus: 'queued' }, { fence: 'pass', grade: 'graded', rowStatus: 'held' }]) {
    const h = await harness(record({ gate }));
    const reviewed = (await h.review()).body;
    assert.equal(reviewed.approveConfirmation, null, JSON.stringify(gate));
    assert.equal(reviewed.actions.approve, false);
    // Even a hand-built approve confirmation is refused before any write.
    const forged = growthApprovalConfirmation(growthApprovalProposalFromRecord(record({ gate }), { tenantId: TENANT, changeDigest: record().changeDigest }, FOUNDER_A)!, 'approved');
    const approve = await h.post('/v1/founder/growth/decision', h.envelope('approved', forged));
    assert.equal(approve.status, 409);
    assert.equal(approve.body.status, 'approve_unavailable');
    expectNoWrites(h);
    // Revise and hold remain available.
    const rejected = await h.post('/v1/founder/growth/decision', h.envelope('rejected', reviewed.rejectConfirmation));
    assert.equal(rejected.body.status, 'rejected');
    assert.equal(h.count('goal_graph_approvals'), 1);
  }
});

test('unsigned, unbound, cross-tenant and drifted calls are denied with zero writes', async () => {
  const h = await harness();
  const confirmation = (await h.review()).body.approveConfirmation;
  const env = h.envelope('approved', confirmation);
  // No verified identity.
  assert.equal((await h.post('/v1/founder/growth/decision', env, null)).status, 401);
  assert.equal((await h.review(null)).status, 401);
  // A founder bound only to another tenant, and an identity bound nowhere.
  assert.equal((await h.post('/v1/founder/growth/decision', env, OUTSIDER)).status, 401);
  assert.equal((await h.post('/v1/founder/growth/decision', env, 'access:nobody')).status, 401);
  // A bound founder asking for another tenant's row.
  const crossTenant = { ...env, proposalId: `${OTHER_TENANT}:${record().changeDigest}` };
  assert.equal((await h.post('/v1/founder/growth/decision', crossTenant, FOUNDER_A)).status, 401);
  assert.equal((await h.post('/v1/founder/growth/decision', crossTenant, OUTSIDER)).status, 403);
  // Tuple drift, wrong confirmation, broad direction and extra authority claims.
  assert.equal((await h.post('/v1/founder/growth/decision', { ...env, version: 2 })).body.status, 'changed');
  assert.equal((await h.post('/v1/founder/growth/decision', { ...env, nonce: 'other' })).body.status, 'changed');
  assert.equal((await h.post('/v1/founder/growth/decision', { ...env, confirmation: 'go ahead' })).body.status, 'confirmation_required');
  assert.equal((await h.post('/v1/founder/growth/decision', { ...env, confirmation: confirmation.replace('approved', 'rejected') })).body.status, 'confirmation_required');
  assert.equal((await h.post('/v1/founder/growth/decision', { ...env, founderId: FOUNDER_A })).body.status, 'invalid');
  assert.equal((await h.post('/v1/founder/growth/decision', { ...env, decision: 'published' })).body.status, 'confirmation_required');
  // A Goal Graph confirmation form is not a growth confirmation.
  assert.equal((await h.post('/v1/founder/growth/decision', { ...env, confirmation: confirmation.replace('growth row ', 'proposal ') })).body.status, 'confirmation_required');
  expectNoWrites(h);
  assert.equal(h.calls.goalTaskReads, 0);
});

test('an expired or missing proposal, or a missing growth host, writes nothing', async () => {
  const expired = await harness(record({ expiresAt: NOW }));
  const reviewed = (await expired.review()).body;
  const late = await expired.post('/v1/founder/growth/decision', expired.envelope('approved', reviewed.approveConfirmation, record({ expiresAt: NOW })));
  assert.equal(late.status, 409);
  assert.equal(late.body.status, 'expired');
  expectNoWrites(expired);
  const missing = await harness(null);
  assert.equal((await missing.review()).status, 403);
  expectNoWrites(missing);
  // A host without the growth reader keeps the growth routes closed.
  const closed = await founderDecisionHttp(new Request('https://cambium.invalid/v1/founder/growth/proposal', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proposalId: missing.id }) }),
    { ...missing.host, readGrowthProposal: undefined });
  assert.equal(closed.status, 503);
  assert.equal((await closed.json()).error, 'growth_approval_unconfigured');
  assert.deepEqual(GROWTH_APPROVAL_ROUTES, ['/v1/founder/growth/proposal', '/v1/founder/growth/decision', '/v1/founder/growth/status']);
});

test('a Goal Graph receipt under the same key is a conflict, never a growth approval', async () => {
  const h = await harness();
  const p = record();
  await h.store.reject({ tenantId: TENANT, changeDigest: p.changeDigest, intentVersion: 1, rejectorId: FOUNDER_A, expiresAt: EXPIRES, nonce: p.nonce, now: NOW });
  h.calls.reject = 0;
  const status = await h.post('/v1/founder/growth/status', h.envelope('approved', ''));
  assert.equal(status.body.status, 'conflict');
  assert.equal(h.count('goal_graph_approvals'), 1);
});

test('a lost write response reconciles through the authoritative readback', async () => {
  const h = await harness();
  let writes = 0;
  const base = h.host.store;
  const deps = {
    store: { readDecisionReceipt: base.readDecisionReceipt!, recordGrowthDecision: async (input: Parameters<NonNullable<typeof base.recordGrowthDecision>>[0]) => {
      writes++; await base.recordGrowthDecision!(input); throw new Error('response lost'); } },
    readGrowthProposal: async () => growthApprovalProposalFromRecord(record(), { tenantId: TENANT, changeDigest: record().changeDigest }, FOUNDER_A),
    authenticate: async () => ({ founderId: FOUNDER_A, tenantId: TENANT, channel: 'curious' as const }),
    now: () => NOW,
  };
  const p = (await deps.readGrowthProposal())!;
  const input = { ...h.envelope('approved', growthApprovalConfirmation(p, 'approved')) };
  assert.equal((await growthApprovalDecision(deps, input)).status, 'approved');
  assert.equal((await growthApprovalDecision(deps, input)).status, 'approved');
  assert.equal(writes, 1);
  assert.equal(h.count('goal_graph_approvals'), 1);
});
