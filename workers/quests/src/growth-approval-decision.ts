import { sha256 } from './goal-graph/identity.ts';
import { GROWTH_DECISION_RECEIPT_KIND } from './goal-graph-store.ts';
import type { FounderDecisionStore, GoalGraphDecisionReceiptRow } from './goal-graph-store.ts';
import type { FounderContext, FounderDecision } from './founder-decision.ts';

/**
 * Growth approval card decision (fan-out item B2).
 *
 * The founder signs the same closed seven-field envelope the Goal Graph
 * decision uses; the subject is a growth row, not a graph change set. A
 * signed `approved` writes exactly one receipt row and nothing else: no
 * graph head/node/event, no Composio call, no vault write, no Genesis path,
 * no publication side effect. The vault status write happens elsewhere
 * (Mac side) by reading this receipt.
 *
 * The Gate has two decisions. `approve` is `approved`; `revise` and `hold`
 * both arrive as `rejected`, and the revise/hold distinction plus its reason
 * is a vault-side record, never part of this receipt.
 */
export const GROWTH_APPROVAL_PROPOSAL_SCHEMA = 'thoughtseed.growth.approval-proposal.v1';
export const GROWTH_APPROVAL_DECISION_SCHEMA = 'thoughtseed.growth.approval-decision.v1';

/** Growth row identity. Paths and digests only; the body copy never enters Cambium. */
export interface GrowthApprovalSubject { cellPath: string; calendarRowId: string; bodyDigest: string }

/** Card preconditions observed at proposal time; `approve` is only offered when all three hold. */
export interface GrowthApprovalGate { fence: 'pass' | 'fail'; grade: 'graded' | 'revise'; rowStatus: string }

/** Server-owned stored proposal; argument text can never create one. */
export interface GrowthApprovalProposal {
  schema: typeof GROWTH_APPROVAL_PROPOSAL_SCHEMA;
  /** `TENANT:CHANGE_DIGEST`, the Founder Gate proposal id form. */
  id: string;
  tenantId: string;
  /** The verified bound founder acting on this read; either bound co-founder may act alone. */
  founderId: string;
  version: number;
  changeDigest: string;
  nonce: string;
  expiresAt: string;
  subject: GrowthApprovalSubject;
  gate: GrowthApprovalGate;
  /** The card proof as displayed (paths, digests, fence, grade, row). Bound into the confirmation. */
  review: Record<string, unknown>;
  summary: string;
}

const PATH = /^[A-Za-z0-9][A-Za-z0-9._/ -]{0,511}$/;
const ROW_ID = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,511}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function validGrowthApprovalSubject(x: unknown): x is GrowthApprovalSubject {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const s = x as Record<string, unknown>;
  return Object.keys(s).sort().join(',') === 'bodyDigest,calendarRowId,cellPath'
    && typeof s.cellPath === 'string' && PATH.test(s.cellPath) && !s.cellPath.includes('..')
    && typeof s.calendarRowId === 'string' && ROW_ID.test(s.calendarRowId)
    && typeof s.bodyDigest === 'string' && DIGEST.test(s.bodyDigest);
}

/** Deterministic change digest of the growth row identity; the Gate tuple digest for this card. */
export function growthApprovalChangeDigest(subject: GrowthApprovalSubject): string {
  return `sha256:${sha256({ schema: GROWTH_APPROVAL_DECISION_SCHEMA, subject: {
    cellPath: subject.cellPath, calendarRowId: subject.calendarRowId, bodyDigest: subject.bodyDigest } })}`;
}

/** `approve` is computed, never asserted: fence pass, grade graded, row queued. */
export function growthApproveEnabled(gate: GrowthApprovalGate): boolean {
  return gate.fence === 'pass' && gate.grade === 'graded' && gate.rowStatus === 'queued';
}

/** A card body is a path and digest. A review that inlines draft copy is non-conforming. */
function reviewCarriesNoBodyCopy(review: Record<string, unknown>): boolean {
  const body = review.body;
  if (body === undefined) return true;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const keys = Object.keys(body as Record<string, unknown>).sort().join(',');
  return keys === 'digest,path';
}

/** Validate a stored record against its key. Fail closed on any drift. */
export function growthApprovalProposalFromRecord(record: unknown, key: { tenantId: string; changeDigest: string }, founderId: string): GrowthApprovalProposal | null {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const r = record as Record<string, unknown>;
  if (r.schema !== GROWTH_APPROVAL_PROPOSAL_SCHEMA || r.tenantId !== key.tenantId) return null;
  if (!validGrowthApprovalSubject(r.subject)) return null;
  const changeDigest = growthApprovalChangeDigest(r.subject);
  if (r.changeDigest !== changeDigest || changeDigest.replace(/^sha256:/, '') !== key.changeDigest.replace(/^sha256:/, '')) return null;
  if (!Number.isInteger(r.version) || Number(r.version) < 1) return null;
  if (typeof r.nonce !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/.test(r.nonce)) return null;
  if (typeof r.expiresAt !== 'string' || !ISO.test(r.expiresAt) || !Number.isFinite(Date.parse(r.expiresAt))) return null;
  const gate = r.gate as Record<string, unknown> | undefined;
  if (!gate || typeof gate !== 'object' || Object.keys(gate).sort().join(',') !== 'fence,grade,rowStatus'
      || !['pass', 'fail'].includes(String(gate.fence)) || !['graded', 'revise'].includes(String(gate.grade))
      || typeof gate.rowStatus !== 'string' || !/^[a-z-]{1,32}$/.test(gate.rowStatus)) return null;
  if (!r.review || typeof r.review !== 'object' || Array.isArray(r.review) || !reviewCarriesNoBodyCopy(r.review as Record<string, unknown>)) return null;
  if (typeof r.summary !== 'string' || !r.summary || r.summary.length > 512) return null;
  const subject = r.subject;
  return {
    schema: GROWTH_APPROVAL_PROPOSAL_SCHEMA, id: `${key.tenantId}:${changeDigest}`, tenantId: key.tenantId, founderId,
    version: Number(r.version), changeDigest, nonce: r.nonce, expiresAt: r.expiresAt,
    subject: { cellPath: subject.cellPath, calendarRowId: subject.calendarRowId, bodyDigest: subject.bodyDigest },
    gate: { fence: gate.fence as 'pass' | 'fail', grade: gate.grade as 'graded' | 'revise', rowStatus: gate.rowStatus },
    // Bind the subject and gate into the reviewed text so a changed row cannot reuse an old confirmation.
    review: { ...(r.review as Record<string, unknown>), subject: { ...subject }, gate: { ...gate } },
    summary: r.summary,
  };
}

/** Exact confirmation, recomputed from the complete displayed review; distinct prefix from the Goal Graph form. */
export function growthApprovalConfirmation(p: GrowthApprovalProposal, decision: 'approved' | 'rejected'): string {
  return `${decision} growth row ${p.id} version ${p.version} digest ${p.changeDigest} expires ${p.expiresAt}: ${p.summary} review sha256:${sha256(p.review)}`;
}

export interface GrowthApprovalDecisionDeps {
  store: Pick<FounderDecisionStore, 'readDecisionReceipt' | 'recordGrowthDecision'>;
  readGrowthProposal(id: string): Promise<GrowthApprovalProposal | null>;
  authenticate(): Promise<FounderContext | null>;
  now(): string;
}

const KEYS = ['proposalId', 'version', 'changeDigest', 'nonce', 'expiresAt', 'decision', 'confirmation'];

function growthReceipt(row: GoalGraphDecisionReceiptRow): Record<string, unknown> | null {
  try {
    const metadata = JSON.parse(row.canonical_json) as Record<string, unknown>;
    return metadata && metadata.kind === GROWTH_DECISION_RECEIPT_KIND ? metadata : null;
  } catch { return null; }
}

/** D1 is the sole decision authority; this function dispatches nothing. */
export async function growthApprovalDecision(deps: GrowthApprovalDecisionDeps, input: FounderDecision, statusOnly = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== KEYS.length
      || Object.keys(input).some((key) => !KEYS.includes(key))) return { status: 'invalid' };
  const context = await deps.authenticate();
  if (!context || !['plugin', 'curious', 'telegram'].includes(context.channel)) return { status: 'unauthorized' };
  const p = await deps.readGrowthProposal(input.proposalId);
  if (!p || p.tenantId !== context.tenantId || p.founderId !== context.founderId) return { status: 'forbidden' };
  if (p.id !== input.proposalId || p.version !== input.version || p.changeDigest !== input.changeDigest
      || p.nonce !== input.nonce || p.expiresAt !== input.expiresAt) return { status: 'changed' };
  if (!['approved', 'rejected'].includes(input.decision)
      || (!statusOnly && input.confirmation !== growthApprovalConfirmation(p, input.decision))) return { status: 'confirmation_required' };
  const readback = async () => {
    const row = await deps.store.readDecisionReceipt(p.tenantId, input.changeDigest, p.nonce);
    if (!row) return null;
    const metadata = growthReceipt(row);
    if (!metadata || row.tenant_id !== p.tenantId || row.change_digest !== input.changeDigest || row.nonce !== p.nonce
        || !['approved', 'rejected'].includes(row.decision) || row.intent_version !== p.version || row.expires_at !== p.expiresAt) return { status: 'conflict' };
    return {
      receiptDigest: sha256(JSON.stringify(row)),
      status: row.decision === input.decision || statusOnly ? row.decision : 'conflict',
      receipt: { schema: GROWTH_APPROVAL_DECISION_SCHEMA, proposalId: p.id, version: row.intent_version, changeDigest: row.change_digest,
        tenantId: row.tenant_id, founderId: row.approver_id, nonce: row.nonce, expiresAt: row.expires_at,
        decision: row.decision, decidedAt: row.decided_at, channel: metadata.channel ?? null, subject: metadata.subject ?? null },
      canonicalReadback: true, writerAuthority: false, externalAction: 'none',
    };
  };
  try {
    const settled = await readback();
    if (settled) return settled;
    if (statusOnly) return { status: 'pending', canonicalReadback: true, writerAuthority: false };
    // A card whose fence failed, whose grade is not graded, or whose row is not queued cannot produce an approve.
    if (input.decision === 'approved' && !growthApproveEnabled(p.gate)) return { status: 'approve_unavailable', gate: p.gate };
    const expiresAtMs = Date.parse(p.expiresAt);
    const decidedAt = deps.now();
    const decidedAtMs = Date.parse(decidedAt);
    if (!Number.isFinite(expiresAtMs) || !Number.isFinite(decidedAtMs) || expiresAtMs <= decidedAtMs) return { status: 'expired' };
    if (!deps.store.recordGrowthDecision) return { status: 'unknown', retry: 'status_only' };
    try {
      await deps.store.recordGrowthDecision({ tenantId: p.tenantId, changeDigest: input.changeDigest, intentVersion: p.version,
        approverId: p.founderId, decision: input.decision, channel: context.channel, expiresAt: p.expiresAt, nonce: p.nonce,
        subject: p.subject, now: decidedAt });
    } catch { /* A lost response is never grounds for a second write. */ }
    return await readback() ?? { status: 'unknown', retry: 'status_only' };
  } catch { return { status: 'unknown', retry: 'status_only' }; }
}
