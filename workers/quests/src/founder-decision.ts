import { sha256 } from './goal-graph/identity.ts';
import { goalGraphApprovalDigest } from './goal-graph-store.ts';
import type { d1GoalGraphStore } from './goal-graph-store.ts';
import type { GoalChangeSet } from './goal-graph/types.ts';

export type FounderChannel = 'plugin' | 'curious' | 'telegram';
/** Host-authenticated context, never accepted from a tool's argument object. */
export interface FounderContext { founderId: string; tenantId: string; channel: FounderChannel }
export interface FounderProposal {
  id: string; tenantId: string; founderId: string; version: number; changeSet: GoalChangeSet;
  nonce: string; expiresAt: string; summary: string;
}
export interface FounderDecision {
  proposalId: string; version: number; changeDigest: string; nonce: string; expiresAt: string;
  decision: 'approved' | 'rejected'; confirmation: string;
}
export interface FounderDecisionDeps {
  store: ReturnType<typeof d1GoalGraphStore>;
  /** Must read a server-owned proposal; argument text cannot create one. */
  readProposal(id: string): Promise<FounderProposal | null>;
  /** Authenticated issuer/subject must resolve to this tenant's founder. */
  authenticate(): Promise<FounderContext | null>;
  now(): string;
}
export function founderConfirmation(p: FounderProposal, decision: 'approved' | 'rejected'): string {
  return `${decision} proposal ${p.id} version ${p.version} digest ${p.changeSet.changeDigest} expires ${p.expiresAt}: ${p.summary}`;
}

/** No KV ledger and no execution dispatch. D1 is the sole decision authority. */
export async function founderDecision(deps: FounderDecisionDeps, input: FounderDecision, statusOnly = false) {
  const keys = ['proposalId', 'version', 'changeDigest', 'nonce', 'expiresAt', 'decision', 'confirmation'];
  if (!input || typeof input !== 'object' || Object.keys(input).length !== keys.length
      || Object.keys(input).some(key => !keys.includes(key))) return { status: 'invalid' };
  const context = await deps.authenticate();
  if (!context || !['plugin', 'curious', 'telegram'].includes(context.channel)) return { status: 'unauthorized' };
  const p = await deps.readProposal(input.proposalId);
  if (!p || p.tenantId !== context.tenantId || p.founderId !== context.founderId) return { status: 'forbidden' };
  if (p.id !== input.proposalId || p.version !== input.version || p.changeSet.changeDigest !== input.changeDigest
      || p.nonce !== input.nonce || p.expiresAt !== input.expiresAt) return { status: 'changed' };
  if (!['approved', 'rejected'].includes(input.decision) || (!statusOnly && input.confirmation !== founderConfirmation(p, input.decision))) return { status: 'confirmation_required' };
  const readback = async () => {
    const row = await deps.store.readDecisionReceipt(p.tenantId, input.changeDigest, p.nonce);
    if (!row) return null;
    if (row.intent_version !== p.version || row.approver_id !== p.founderId || row.expires_at !== p.expiresAt) return { status: 'conflict' };
    const metadata = JSON.parse(row.canonical_json);
    return { receiptDigest: sha256(JSON.stringify(row)), status: row.decision === input.decision || statusOnly ? row.decision : 'conflict',
      receipt: { proposalId: p.id, version: row.intent_version, changeDigest: row.change_digest,
        tenantId: row.tenant_id, founderId: row.approver_id, nonce: row.nonce, expiresAt: row.expires_at,
        decision: row.decision, decidedAt: row.decided_at, channel: metadata.channel ?? null }, writerAuthority: false };
  };
  try {
    const settled = await readback();
    if (settled) return settled;
    if (statusOnly) return { status: 'pending' };
    if (!Number.isFinite(Date.parse(p.expiresAt)) || !Number.isFinite(Date.parse(deps.now())) || Date.parse(p.expiresAt) <= Date.parse(deps.now())) return { status: 'expired' };
    const head = await deps.store.readHead(p.tenantId);
    if ((head?.graphDigest ?? null) !== p.changeSet.expectedHeadDigest) return { status: 'stale' };
    const core = { tenantId: p.tenantId, changeDigest: input.changeDigest, intentVersion: p.version,
      approverId: p.founderId, nonce: p.nonce, expiresAt: p.expiresAt };
    try {
      if (input.decision === 'approved') await deps.store.commit({ tenantId: p.tenantId, changeSet: p.changeSet,
        approval: { ...core, decision: 'approved', approvalDigest: goalGraphApprovalDigest(core), channel: context.channel }, now: deps.now() });
      else await deps.store.reject({ ...core, rejectorId: p.founderId, channel: context.channel, now: deps.now() });
    } catch { /* A lost response is never grounds for a second write. */ }
    return await readback() ?? { status: 'unknown', retry: 'status_only' };
  } catch { return { status: 'unknown', retry: 'status_only' }; }
}
