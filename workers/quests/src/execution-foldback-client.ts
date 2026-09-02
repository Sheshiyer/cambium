// Phase I · Hermes execution-foldback client.
//
// Wraps the real foldback adapter (hermes-execution-foldback.ts) in the same
// fail-closed, never-throws shape as the Phase G/H clients:
//
//   foldbackExecution(raw, opts)
//     -> { ok:false, gap } on any validation/conflict/verifier failure
//     -> { ok:true, projection } when the terminal receipt is well-formed
//     -> persists ONLY when opts.persist===true AND a store is injected
//
// Invariants (verified against hermes-execution-foldback.ts):
//   * The adapter itself performs NO Goal Graph write. `nextIntent` is always
//     proposal-only (approvalRequired:true, goalGraphAuthority:false). This
//     client preserves that: a foldback never mutates the graph.
//   * An `activation` in the input REQUIRES an external-admission-readback
//     verifier; without it the adapter throws and we surface a typed gap.
//   * Persistence (R2 receipt) happens only on explicit opt-in via an injected
//     HermesExecutionFoldbackStoreLike. Absent store / absent opt-in => the
//     projection is returned but nothing is written.

import {
  adaptHermesExecutionFoldback,
  HermesExecutionFoldbackConflictError,
  HermesExecutionFoldbackStorageError,
  HermesExecutionFoldbackValidationError,
  type HermesExecutionFoldbackActivationVerifier,
  type HermesExecutionFoldbackProjection,
  type HermesExecutionFoldbackStoreLike,
} from './hermes-execution-foldback.ts';

export type FoldbackGapReason =
  | 'validation'
  | 'activation-unverified'
  | 'conflict'
  | 'storage'
  | 'persist-not-requested'
  | 'no-store'
  | 'unknown';

export interface FoldbackGap {
  ok: false;
  kind: 'gap';
  reason: FoldbackGapReason;
  detail: string;
}

export interface FoldbackOk {
  ok: true;
  kind: 'projection';
  projection: HermesExecutionFoldbackProjection;
  /** Whether the receipt was persisted (only true on opt-in + successful store). */
  persisted: boolean;
  /** True when the store reported this receipt already existed. */
  duplicate: boolean;
  /** True when issued+exact activation evidence admitted cortex/memory/nextIntent. */
  admitted: boolean;
}

export type FoldbackResult = FoldbackOk | FoldbackGap;

export interface FoldbackOptions {
  activationVerifier?: HermesExecutionFoldbackActivationVerifier;
  /** Must be true to persist the prepared receipt. Absent/false => project-only. */
  persist?: boolean;
  store?: HermesExecutionFoldbackStoreLike;
}

function gap(reason: FoldbackGapReason, detail: string): FoldbackGap {
  return { ok: false, kind: 'gap', reason, detail };
}

/**
 * Fold a terminal Hermes execution into a Mission Fabric receipt projection.
 * Never throws: adapter validation/verifier/conflict/storage errors all resolve
 * to typed gaps. Persists only on explicit opt-in with an injected store.
 */
export async function foldbackExecution(
  raw: unknown,
  options: FoldbackOptions = {},
): Promise<FoldbackResult> {
  let projection: HermesExecutionFoldbackProjection;
  try {
    projection = await adaptHermesExecutionFoldback(raw, options.activationVerifier);
  } catch (err) {
    if (err instanceof HermesExecutionFoldbackValidationError) {
      // The adapter uses one validation error type for both shape problems and
      // the activation-verifier gate; disambiguate on the message.
      const reason: FoldbackGapReason = /activation/i.test(err.message)
        ? 'activation-unverified'
        : 'validation';
      return gap(reason, err.message);
    }
    if (err instanceof HermesExecutionFoldbackConflictError) return gap('conflict', err.message);
    if (err instanceof HermesExecutionFoldbackStorageError) return gap('storage', err.message);
    return gap('unknown', err instanceof Error ? err.message : String(err));
  }

  const admitted = projection.nextIntent !== undefined;

  // Project-only unless the caller explicitly opts in to persistence.
  if (options.persist !== true) {
    return { ok: true, kind: 'projection', projection, persisted: false, duplicate: false, admitted };
  }
  if (!options.store) {
    return gap('no-store', 'persist requested without an injected foldback store');
  }

  try {
    const { duplicate } = await options.store.record(projection.receipt);
    return { ok: true, kind: 'projection', projection, persisted: true, duplicate, admitted };
  } catch (err) {
    return gap('storage', err instanceof Error ? err.message : String(err));
  }
}
