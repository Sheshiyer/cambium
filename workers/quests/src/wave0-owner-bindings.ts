// Production wiring for the wave0 accepted-result loop (Phase 1, T7).
//
// All-or-nothing: the admission lookup, activation verifier, foldback store and
// attested acceptance readback are injected only when the Goal Graph D1, a
// writable vault R2, a valid ACCEPTANCE_OWNER_PUBKEYS var and the
// WAVE0_ACTIVATION_KEY secret (>= 32 bytes) are all present.
// Otherwise the Worker keeps the read-only reader it had before, so deploying
// this code without binding the var changes nothing. No fixture or synthetic
// owner module is imported here (guarded by wave0-owner-bindings.test.ts).

import type { R2BucketLike } from './context-bindings.ts';
import type { HandlerDeps } from './handler.ts';
import type { GoalGraphD1DatabaseLike } from './goal-graph-store.ts';
import { d1GoalGraphStore } from './goal-graph-store.ts';
import { createHermesExecutionFoldbackReader, createHermesExecutionFoldbackStore } from './hermes-execution-foldback.ts';
import { createAttestedAcceptanceStore, createAttestedAcceptedWorkUnitReadback, parseAcceptanceOwnerPublicKeys } from './accepted-work-unit-attestation.ts';
import { createGoalGraphTerminalAdmission, importActivationKey } from './terminal-admission.ts';

/** The Goal Graph tenant whose D1 nodes may admit wave0 executions. */
export const WAVE0_ADMISSION_TENANT = 'cambium';

export async function wave0OwnerBindings(env: {
  BRIDGE_DB?: GoalGraphD1DatabaseLike;
  THOUGHTSEED_VAULT?: R2BucketLike;
  ACCEPTANCE_OWNER_PUBKEYS?: string;
  WAVE0_ACTIVATION_KEY?: string;
}): Promise<Pick<HandlerDeps, 'foldbackReader' | 'acceptedWorkUnitReadback' | 'terminalFoldback'>> {
  const vault = env.THOUGHTSEED_VAULT;
  const keys = await parseAcceptanceOwnerPublicKeys(env.ACCEPTANCE_OWNER_PUBKEYS);
  const activationKey = await importActivationKey(env.WAVE0_ACTIVATION_KEY);
  if (!vault || !vault.put || !env.BRIDGE_DB || keys.length === 0 || !activationKey) {
    // No admission or acceptance verifier is inferred from an R2 binding alone.
    return { foldbackReader: vault ? createHermesExecutionFoldbackReader(vault) : undefined };
  }
  // Wired per request (index.ts), so one D1 graph read serves every verify in that request.
  const admission = createGoalGraphTerminalAdmission({ tenantId: WAVE0_ADMISSION_TENANT, goalGraphStore: d1GoalGraphStore(env.BRIDGE_DB), activationKey, cacheGraphReads: true });
  return {
    foldbackReader: createHermesExecutionFoldbackReader(vault, admission.activationVerifier),
    acceptedWorkUnitReadback: createAttestedAcceptedWorkUnitReadback(vault, keys),
    terminalFoldback: {
      store: createHermesExecutionFoldbackStore(vault, admission.activationVerifier),
      activationVerifier: admission.activationVerifier,
      prepare: admission.prepare,
      acceptanceStore: createAttestedAcceptanceStore(vault, keys),
    },
  };
}
