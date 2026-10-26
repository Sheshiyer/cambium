import { renewFounderProposal, validFounderRenewalInput, type FounderRenewalInput } from './founder-renewal.ts';
import type { GoalGraphLoadoutAuthority } from './goal-graph/types.ts';
import type { FounderContext, FounderProposal } from './founder-decision.ts';
import type { FounderTransportHost } from './founder-decision-transport.ts';
import type { GoalGraphStoreLike, FounderDecisionStore } from './goal-graph-store.ts';
import type { GoalChangeSet } from './goal-graph/types.ts';
import { sha256 } from './goal-graph/identity.ts';

const TENANT = /^[a-z][a-z0-9-]{1,63}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,239}$/;
export function founderProposalKey(id: unknown): { tenantId: string; changeDigest: string } | null {
  if (typeof id !== 'string') return null;
  const at = id.indexOf(':');
  const tenantId = id.slice(0, at), changeDigest = id.slice(at + 1);
  return at > 0 && TENANT.test(tenantId) && /^(?:sha256:)?[a-f0-9]{64}$/.test(changeDigest)
    ? { tenantId, changeDigest } : null;
}

/** Explicit reviewed bindings, never wildcard scope from the general UI role. */
export function founderBindings(raw: string | undefined): Array<{ founderId: string; tenantId: string }> | null {
  try {
    const rows = JSON.parse(raw ?? 'null');
    if (!Array.isArray(rows) || !rows.length || rows.length > 128 || rows.some(row => !row
        || Object.keys(row).sort().join(',') !== 'founderId,tenantId'
        || typeof row.founderId !== 'string' || !ID.test(row.founderId)
        || typeof row.tenantId !== 'string' || !TENANT.test(row.tenantId))) return null;
    return rows;
  } catch { return null; }
}

/** Per-request adapter over the existing verifier, stored intake and sole D1 writer. */
export function createFounderAccessHost(deps: {
  store?: GoalGraphStoreLike;
  bindingsJson?: string;
  verifyFounder(request: Request): Promise<string | null>;
  readTask(tenantId: string, digest: string): Promise<Record<string, unknown> | null>;
  reviewTask(task: Record<string, unknown>): Record<string, unknown> | null;
  now(): string;
  loadoutAuthority?: GoalGraphLoadoutAuthority;
  persistRenewal?: Parameters<typeof renewFounderProposal>[0]['persist'];
}): FounderTransportHost | undefined {
  const allowed = founderBindings(deps.bindingsJson);
  const store = deps.store as FounderDecisionStore | undefined;
  if (!allowed || !store?.reject || !store.readDecisionReceipt) return undefined;
  let context: FounderContext | null = null;
  let beforeWrite: (() => Promise<string>) | null = null;
  let renewalRoot: { changeDigest: string; nonce: string } | undefined;
  const host: FounderTransportHost = {
    store: { ...store,
      get commit() {
        const guard = beforeWrite;
        return guard ? async (args: Parameters<FounderDecisionStore['commit']>[0]) => store.commit({ ...args, renewalRoot, now: await guard() }) : store.commit;
      },
      get reject() {
        const guard = beforeWrite;
        return guard ? async (args: Parameters<FounderDecisionStore['reject']>[0]) => store.reject({ ...args, renewalRoot, now: await guard() }) : store.reject;
      },
    }, now: deps.now,
    async authenticateRequest(request) {
      context = null; beforeWrite = null; renewalRoot = undefined;
      const founderId = await deps.verifyFounder(request);
      if (!founderId) return null;
      const input = await request.clone().json() as { proposalId?: unknown };
      const key = founderProposalKey(input?.proposalId);
      if (!key || !allowed.some(row => row.founderId === founderId && row.tenantId === key.tenantId)) return null;
      context = { founderId, tenantId: key.tenantId, channel: 'curious' };
      return context;
    },
    async readProposal(id, renewal = false): Promise<FounderProposal | null> {
      const key = founderProposalKey(id);
      if (!context || !key || context.tenantId !== key.tenantId) return null;
      const task = await deps.readTask(key.tenantId, key.changeDigest);
      // This slice only admits the existing Telegram Goal Graph proposal type.
      // Evidence candidates and other intake types keep their existing flow.
      if (!task || task.schema !== 'cambium.goal-graph-intake-task.v1' || task.candidate
          || task.tenantId !== key.tenantId || task.changeDigest !== key.changeDigest
          || !['pending', 'committed', 'rejected', 'stale'].includes(String(task.status))
          || !Number.isInteger(task.intentVersion) || Number(task.intentVersion) < 1) return null;
      const row = deps.reviewTask(task);
      const review = row ? { ...row, status: 'pending' } as Record<string, unknown> : null;
      // Eligibility is volatile projection data, not part of the immutable
      // reviewed tuple: expiry/head changes must not rewrite old receipt text.
      if (review) { delete review.canRenew; delete review.renewOnly; }
      const inspect = review?.founderInspect as Record<string, unknown> | undefined;
      const changeSet = task.changeSet as GoalChangeSet | undefined;
      if (!review || inspect?.consistent !== true || !changeSet || changeSet.tenantId !== key.tenantId
          || changeSet.changeDigest !== key.changeDigest || changeSet.expectedHeadDigest !== task.expectedHeadDigest
          || changeSet.graphVersion !== task.graphVersion || review.fence !== changeSet.graphVersion
          || review.expectedHeadVersion !== changeSet.graphVersion - 1
          || typeof review.approvalNonce !== 'string' || typeof review.approvalExpiresAt !== 'string') return null;
      const { changeDigest: _digest, isNoop: _noop, ...digestInput } = changeSet;
      if (sha256(digestInput) !== key.changeDigest.replace(/^sha256:/, '')) return null;
      // A legacy retry may mark KV stale after the canonical D1 write won.
      // Recover that immutable outcome only; stale KV never admits a new decision.
      if (task.status === 'stale') {
        const receipt = await store.readDecisionReceipt(key.tenantId, key.changeDigest, review.approvalNonce);
        if (!receipt && !renewal) return null;
        if (receipt && (receipt.tenant_id !== key.tenantId || receipt.change_digest !== key.changeDigest
            || receipt.nonce !== review.approvalNonce || receipt.intent_version !== task.intentVersion
            || receipt.approver_id !== context.founderId || receipt.expires_at !== review.approvalExpiresAt
            || !['approved', 'rejected'].includes(receipt.decision))) return null;
      }
      if (task.renewal) {
        const lineage = task.renewal as Record<string, unknown>;
        const { renewalId, ...boundLineage } = lineage;
        if (lineage.founderId !== context.founderId || sha256(boundLineage) !== renewalId
            || changeSet.sourceRef !== `founder-renewal:${renewalId}` || changeSet.sourceDigest !== renewalId
            || Number(lineage.version) + 1 !== task.intentVersion
            || typeof lineage.changeDigest !== 'string' || typeof lineage.nonce !== 'string'
            || !Array.isArray(lineage.ancestors) || !lineage.ancestors.length || lineage.ancestors.length > 16
            || lineage.ancestors.some(ancestor => !validFounderRenewalInput(ancestor)
              || founderProposalKey(ancestor.proposalId)?.tenantId !== key.tenantId
              || founderProposalKey(ancestor.proposalId)?.changeDigest !== ancestor.changeDigest)) return null;
        const root = (lineage.ancestors as FounderRenewalInput[])[0];
        renewalRoot = { changeDigest: root.changeDigest, nonce: root.nonce };
        const parentDecision = async () => {
          for (const ancestor of lineage.ancestors as FounderRenewalInput[]) {
            if (await store.readDecisionReceipt(key.tenantId, ancestor.changeDigest, ancestor.nonce)) return true;
          }
          return false;
        };
        const childDecision = await store.readDecisionReceipt(key.tenantId, key.changeDigest, review.approvalNonce);
        if (!childDecision && await parentDecision()) return null;
        const check = async () => {
          if (await parentDecision()) throw new Error('renewal_parent_decided');
          const writeAt = deps.now();
          if (!Number.isFinite(Date.parse(writeAt)) || Date.parse(writeAt) >= Date.parse(review.approvalExpiresAt as string)) throw new Error('renewal_expired');
          return writeAt;
        };
        beforeWrite = check;
      }
      return {
        id, tenantId: key.tenantId, founderId: context.founderId, version: Number(task.intentVersion),
        changeSet, nonce: review.approvalNonce, expiresAt: review.approvalExpiresAt,
        // Show and bind every changed field; Inspect alone is a bounded projection.
        review: { ...review, changeSet, ...(task.renewal ? { renewal: task.renewal } : {}) },
        summary: `${review.summary} Consequence: ${review.consequence} Reversibility: ${review.reversibility}`,
      };
    },
  };
  host.renewProposal = async (input: FounderRenewalInput) => {
    if (!context || !deps.persistRenewal) return { status: 'unknown', writerAuthority: false };
    if (!await store.renewalFenceReady?.()) return { status: 'unknown', error: 'renewal_fence_required', writerAuthority: false };
    const p = await host.readProposal(input.proposalId, true);
    const key = founderProposalKey(input.proposalId);
    if (!p || !key) return { status: 'forbidden', writerAuthority: false };
    const task = await deps.readTask(key.tenantId, key.changeDigest);
    if (!task) return { status: 'forbidden', writerAuthority: false };
    return renewFounderProposal({ context, input, proposal: p, task, store,
      now: deps.now, persist: deps.persistRenewal, loadoutAuthority: deps.loadoutAuthority });
  };
  return host;
}
