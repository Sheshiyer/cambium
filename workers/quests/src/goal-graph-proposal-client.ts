// Phase H · goal-graph proposal client.
//
// Compiles a goal-graph proposal against the CURRENT head with compare-and-swap
// (CAS) and FAILS CLOSED: it never commits to D1 unless the caller supplies a
// valid founder approval AND explicitly opts in with `commit: true`.
//
// The write path (compileGoalGraph -> commit) reuses the real Worker modules:
//   * goal-graph/compiler.ts  — pure CAS compile (expectedHeadDigest gate)
//   * goal-graph-store.ts      — the durable, approval-bound D1 commit boundary
//
// This client adds NO new authority. It orchestrates the existing ones and
// makes the fail-closed contract explicit at the call site:
//
//   proposeGoalGraph(...)                       -> compiled | stale | noop | needs-approval  (NO write)
//   proposeGoalGraph(..., { commit:true, approval }) -> commit result via the injected store
//
// If `commit:true` is requested without a matching approval, the client refuses
// (returns 'needs-approval') and does NOT touch the store. There is no path
// where a proposal reaches D1 without a founder decision.

import { compileGoalGraph } from './goal-graph/compiler.ts';
import type {
  GoalChangeSet,
  GoalGraphCompileInput,
  GoalGraphHead,
  GoalGraphInputNode,
  GoalGraphLoadoutAuthority,
  GoalGraphNode,
} from './goal-graph/types.ts';
import type {
  GoalGraphApproval,
  GoalGraphCommitResult,
  GoalGraphStoreLike,
} from './goal-graph-store.ts';

export interface GoalGraphProposalInput {
  tenantId: string;
  /**
   * The head digest the caller observed when they BUILT this proposal (the CAS
   * baseline). Compare-and-swap succeeds only if the freshly-read `actualHead`
   * still matches this. Omit (or pass null) to bind CAS to `actualHead` — i.e.
   * "I read and propose atomically, no external baseline."
   */
  expectedHeadDigest?: string | null;
  /** Freshly-read current head at proposal/commit time (null for empty graph). */
  actualHead: GoalGraphHead | null;
  /** Current nodes as read from the store. */
  currentNodes: readonly GoalGraphNode[];
  /** The proposed node set (full desired state of the graph). */
  proposedNodes: readonly GoalGraphInputNode[];
  /** Monotonic target version. */
  graphVersion: number;
  sourceRef: string;
  sourceDigest: string;
  now?: string;
  loadoutAuthority?: GoalGraphLoadoutAuthority;
}

export interface ProposalCommitOptions {
  /** Must be true to even attempt a write. Absent/false => propose-only. */
  commit?: boolean;
  /** Founder approval. Required for any commit; must match the changeDigest. */
  approval?: GoalGraphApproval;
  /** The durable store. Required only when commit is attempted. */
  store?: GoalGraphStoreLike;
}

export type GoalGraphProposalResult =
  // CAS miss: the head moved under us. Caller must re-read and recompile.
  | { status: 'stale'; expectedHeadDigest: string | null; actualHeadDigest: string | null }
  // Nothing to change.
  | { status: 'noop'; changeSet: GoalChangeSet }
  // Compiled and ready, but fail-closed: no valid founder approval provided.
  | { status: 'needs-approval'; changeSet: GoalChangeSet; reason: string }
  // Committed (or a store outcome) — only reachable with a matching approval.
  | { status: 'committed'; changeSet: GoalChangeSet; commit: GoalGraphCommitResult };

/**
 * Compile a proposal with CAS and, only when explicitly approved + opted-in,
 * commit it via the injected store. Pure and side-effect-free unless a commit
 * is both requested and authorized.
 */
export async function proposeGoalGraph(
  input: GoalGraphProposalInput,
  options: ProposalCommitOptions = {},
): Promise<GoalGraphProposalResult> {
  const expectedHeadDigest =
    input.expectedHeadDigest !== undefined
      ? input.expectedHeadDigest
      : input.actualHead?.graphDigest ?? null;
  const compileInput: GoalGraphCompileInput = {
    tenantId: input.tenantId,
    expectedHeadDigest,
    actualHead: input.actualHead,
    currentNodes: input.currentNodes,
    proposedNodes: input.proposedNodes,
    graphVersion: input.graphVersion,
    sourceRef: input.sourceRef,
    sourceDigest: input.sourceDigest,
    now: input.now,
    loadoutAuthority: input.loadoutAuthority,
  };

  const compiled = compileGoalGraph(compileInput);
  if (compiled.status === 'stale') {
    return {
      status: 'stale',
      expectedHeadDigest: compiled.expectedHeadDigest,
      actualHeadDigest: compiled.actualHeadDigest,
    };
  }

  const { changeSet } = compiled;
  if (changeSet.isNoop) {
    return { status: 'noop', changeSet };
  }

  // Fail-closed gate. A commit requires: opt-in, a store, and an approval whose
  // decision is 'approved' for THIS exact changeDigest and tenant.
  const wantsCommit = options.commit === true;
  const gate = evaluateApproval(input.tenantId, changeSet, options);
  if (!wantsCommit || !gate.ok) {
    return {
      status: 'needs-approval',
      changeSet,
      reason: gate.ok
        ? 'commit not requested (propose-only)'
        : gate.reason,
    };
  }

  // Only here — with an explicit opt-in and a matching founder approval — do we
  // touch the durable store. The store itself is also fail-closed (CAS + AUD).
  const commit = await options.store!.commit({
    tenantId: input.tenantId,
    changeSet,
    approval: options.approval!,
    now: input.now,
  });
  return { status: 'committed', changeSet, commit };
}

interface ApprovalGate {
  ok: boolean;
  reason: string;
}

function evaluateApproval(
  tenantId: string,
  changeSet: GoalChangeSet,
  options: ProposalCommitOptions,
): ApprovalGate {
  if (!options.store) return { ok: false, reason: 'no store provided for commit' };
  const approval = options.approval;
  if (!approval) return { ok: false, reason: 'founder approval required' };

  const approvalTenant = approval.tenantId ?? approval.tenant_id;
  const approvalDigest = approval.changeDigest ?? approval.change_digest;

  if (approval.decision !== 'approved') {
    return { ok: false, reason: `approval decision is '${approval.decision}', not 'approved'` };
  }
  if (approvalTenant !== tenantId) {
    return { ok: false, reason: `approval tenant '${String(approvalTenant)}' != '${tenantId}'` };
  }
  if (approvalDigest !== changeSet.changeDigest) {
    return {
      ok: false,
      reason: `approval changeDigest '${String(approvalDigest)}' != compiled '${changeSet.changeDigest}'`,
    };
  }
  return { ok: true, reason: 'approved' };
}
