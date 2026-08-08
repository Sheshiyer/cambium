import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import {
  HermesExecutionFoldbackConflictError,
  HermesExecutionFoldbackValidationError,
  adaptHermesExecutionFoldback,
  canonicalHermesFoldbackJson,
  createHermesExecutionFoldbackStore,
} from './hermes-execution-foldback.ts';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

function input(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'thoughtseed.hermes.execution-foldback.v1',
    tenantId: 'cambium',
    graphVersion: 8,
    goalGraph: {
      nodeId: 'goal-fitcheck-launch',
      taskId: 'task-fitcheck-launch',
      workObjectId: 'sapling:fitcheck',
      workObjectKind: 'sapling',
      pinnedLoadoutId: 'loadout:fitcheck-launch',
    },
    execution: {
      memberId: 'shesh', directiveId: 'native-fitcheck-canary', idempotencyKey: 'fitcheck-canary-1',
      executionId: 'exec_fitcheck_canary_1', claimId: 'claim-fitcheck-1', fencingToken: 'fence-fitcheck-1',
      attempt: 1, status: 'executed', attestationId: 'att_fitcheck_canary_1',
      inputDigest: `sha256:${'1'.repeat(64)}`, terminalProofDigest: `sha256:${'2'.repeat(64)}`,
      recordedAt: '2026-08-09T00:00:00.000Z',
    },
    ...overrides,
  };
}

test('adapts one terminal Hermes outcome into proof and next-intent edges', async () => {
  const result = await adaptHermesExecutionFoldback(input());
  assert.match(result.receipt.receiptId, /^hfb_[0-9a-f]{24}$/);
  assert.equal(result.receipt.r2Key, 'portfolio/thoughtseed/workobjects/sapling:fitcheck/foldback/exec_fitcheck_canary_1.json');
  assert.deepEqual(result.edges, [
    { kind: 'proves', fromId: result.receipt.receiptId, toId: 'task-fitcheck-launch' },
    { kind: 'informs-next-intent', fromId: result.receipt.receiptId, toId: 'sapling:fitcheck' },
  ]);
  assert.equal(result.node.kind === 'receipt' && result.node.value.graphVersion, 8);
});

test('foldback replay is deterministic while retryable and mismatched anchors fail closed', async () => {
  assert.deepEqual(await adaptHermesExecutionFoldback(input()), await adaptHermesExecutionFoldback(input()));
  await assert.rejects(
    () => adaptHermesExecutionFoldback(input({ execution: { ...input().execution, status: 'retryable' } })),
    HermesExecutionFoldbackValidationError,
  );
  await assert.rejects(
    () => adaptHermesExecutionFoldback(input({ goalGraph: { ...input().goalGraph, workObjectKind: 'branch' } })),
    HermesExecutionFoldbackValidationError,
  );
  await assert.rejects(
    () => adaptHermesExecutionFoldback(input({ goalGraph: { ...input().goalGraph, workObjectId: 'sapling:unknown' } })),
    HermesExecutionFoldbackValidationError,
  );
});

test('foldback store preserves exact replay and rejects conflicting terminal evidence', async () => {
  const { receipt } = await adaptHermesExecutionFoldback(input());
  const values = new Map<string, string>();
  const bucket = {
    async get(key: string) {
      const value = values.get(key);
      return value === undefined ? null : { async text() { return value; } };
    },
    async put(key: string, bytes: Uint8Array) {
      if (values.has(key)) return null;
      const value = new TextDecoder().decode(bytes);
      values.set(key, value);
      return { async text() { return value; } };
    },
  };
  const store = createHermesExecutionFoldbackStore(bucket);
  assert.deepEqual(await store.record(receipt), { duplicate: false });
  assert.deepEqual(await store.record(receipt), { duplicate: true });
  values.set(receipt.r2Key, canonicalHermesFoldbackJson({ ...receipt, contentDigest: `sha256:${'0'.repeat(64)}` }));
  await assert.rejects(() => store.record(receipt), HermesExecutionFoldbackConflictError);
});

test('foldback store rejects a tampered compiled receipt before writing', async () => {
  const { receipt } = await adaptHermesExecutionFoldback(input());
  let writes = 0;
  const store = createHermesExecutionFoldbackStore({
    async get() { return null; },
    async put() { writes += 1; return null; },
  });
  await assert.rejects(
    () => store.record({ ...receipt, r2Key: 'portfolio/thoughtseed/workobjects/sapling:fitcheck/foldback/wrong.json' }),
    HermesExecutionFoldbackValidationError,
  );
  assert.equal(writes, 0);
});
