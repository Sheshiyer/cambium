// Phase I · execution-foldback client tests.
//
// Verifies the fail-closed wrapper over the REAL adapter. No R2, no network.
// The store is an in-memory spy that records receipts. Guarantees:
//   * never throws — adapter errors become typed gaps,
//   * project-only unless persist opt-in + injected store,
//   * an activation requires the external-admission-readback verifier,
//   * the adapter never writes the Goal Graph (nextIntent is proposal-only).
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import type {
  HermesExecutionFoldbackReceipt,
  HermesExecutionFoldbackStoreLike,
} from './hermes-execution-foldback.ts';
import { foldbackExecution } from './execution-foldback-client.ts';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

function input(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'thoughtseed.hermes.execution-foldback.v1',
    tenantId: 'cambium',
    graphVersion: 8,
    goalGraph: {
      nodeId: 'goal-fitcheck-launch', taskId: 'task-fitcheck-launch',
      workObjectId: 'sapling:fitcheck', workObjectKind: 'sapling',
      pinnedLoadoutId: 'loadout:fitcheck-launch',
    },
    execution: {
      memberId: 'shesh', directiveId: 'native-fitcheck-canary', idempotencyKey: 'fitcheck-canary-1',
      executionId: 'exec_fitcheck_canary_1', claimId: 'claim-fitcheck-1', fencingToken: 'fence-fitcheck-1',
      attempt: 1, status: 'executed', attestationId: 'att_fitcheck_canary_1',
      inputDigest: `sha256:${'1'.repeat(64)}`, terminalProofDigest: `sha256:${'2'.repeat(64)}`,
      recordedAt: '2026-08-09T00:00:00.000Z',
    },
    activation: {
      activationId: 'activation:fitcheck-canary', activationDigest: `sha256:${'3'.repeat(64)}`,
      mappingReceiptId: 'pmr_fitcheck_canary', mappingReceiptDigest: `sha256:${'4'.repeat(64)}`,
      issued: true, staleFence: false,
      workObjectId: 'sapling:fitcheck', taskId: 'task-fitcheck-launch',
      pinnedLoadoutId: 'loadout:fitcheck-launch', fencingToken: 'fence-fitcheck-1',
    },
    ...overrides,
  };
}

function verifierFor(candidate: ReturnType<typeof input>) {
  const expected = candidate.activation as Record<string, unknown>;
  return {
    source: 'external-admission-readback' as const,
    verifyActivationAuthority(activation: Record<string, unknown>) {
      return activation.activationId === expected.activationId
        && activation.activationDigest === expected.activationDigest;
    },
  };
}

function unadmitted() {
  const c = input();
  delete (c as Record<string, unknown>).activation;
  return c;
}

function spyStore(duplicate = false) {
  const calls: HermesExecutionFoldbackReceipt[] = [];
  const store: HermesExecutionFoldbackStoreLike = {
    async record(receipt) {
      calls.push(receipt);
      return { duplicate };
    },
  };
  return { store, calls };
}

test('admitted terminal outcome projects (project-only) without persisting', async () => {
  const c = input();
  const res = await foldbackExecution(c, { activationVerifier: verifierFor(c) });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.admitted, true);
    assert.equal(res.persisted, false);
    // The adapter must never grant Goal Graph authority.
    assert.equal(res.projection.nextIntent?.goalGraphAuthority, false);
    assert.equal(res.projection.nextIntent?.approvalRequired, true);
    assert.equal(res.projection.nextIntent?.status, 'proposal-only');
  }
});

test('activation present WITHOUT verifier fails closed to an activation gap (never throws)', async () => {
  const res = await foldbackExecution(input(), {});
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, 'activation-unverified');
});

test('malformed input fails closed to a validation gap', async () => {
  const res = await foldbackExecution({ schema: 'wrong' }, {});
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, 'validation');
});

test('unadmitted (no activation) still projects, with no cortex/memory/nextIntent', async () => {
  const res = await foldbackExecution(unadmitted(), {});
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.admitted, false);
    assert.equal(res.projection.nextIntent, undefined);
    assert.equal(res.projection.cortex, undefined);
  }
});

test('persist requested without a store fails closed (no-store gap)', async () => {
  const c = input();
  const res = await foldbackExecution(c, { activationVerifier: verifierFor(c), persist: true });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, 'no-store');
});

test('persist opt-in with a store records the receipt exactly once', async () => {
  const c = input();
  const { store, calls } = spyStore();
  const res = await foldbackExecution(c, { activationVerifier: verifierFor(c), persist: true, store });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.persisted, true);
    assert.equal(res.duplicate, false);
  }
  assert.equal(calls.length, 1);
  assert.match(calls[0].receiptId, /^hfb_[0-9a-f]{24}$/);
  assert.equal(calls[0].status, 'prepared');
});

test('duplicate from the store is reported, not an error', async () => {
  const c = input();
  const { store } = spyStore(true);
  const res = await foldbackExecution(c, { activationVerifier: verifierFor(c), persist: true, store });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.duplicate, true);
});

test('a store that throws resolves to a storage gap (never throws)', async () => {
  const c = input();
  const store: HermesExecutionFoldbackStoreLike = {
    async record() {
      throw new Error('R2 unavailable');
    },
  };
  const res = await foldbackExecution(c, { activationVerifier: verifierFor(c), persist: true, store });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, 'storage');
});
