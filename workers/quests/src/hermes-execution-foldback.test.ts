import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import {
  HermesExecutionFoldbackConflictError,
  HermesExecutionFoldbackValidationError,
  adaptHermesExecutionFoldback,
  canonicalHermesFoldbackJson,
  createHermesExecutionFoldbackStore,
  deriveHermesExecutionFoldbackAgentMemoryProjection,
  deriveHermesExecutionFoldbackCortexProjection,
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

function activationVerifierFor(candidate: ReturnType<typeof input>) {
  const expected = candidate.activation;
  assert.ok(expected);
  return {
    source: 'external-admission-readback' as const,
    verifyActivationAuthority(activation: typeof expected) {
      return activation.activationId === expected.activationId
        && activation.activationDigest === expected.activationDigest
        && activation.mappingReceiptId === expected.mappingReceiptId
        && activation.mappingReceiptDigest === expected.mappingReceiptDigest;
    },
  };
}

async function adaptVerified(candidate = input()) {
  return adaptHermesExecutionFoldback(candidate, activationVerifierFor(candidate));
}

test('adapts an admitted terminal Hermes outcome into receipt-bound projections and next-intent edges', async () => {
  const result = await adaptVerified();
  assert.match(result.receipt.receiptId, /^hfb_[0-9a-f]{24}$/);
  assert.equal(result.receipt.r2Key, 'portfolio/thoughtseed/workobjects/sapling:fitcheck/foldback/exec_fitcheck_canary_1.json');
  assert.deepEqual(result.cortex, {
    schema: 'thoughtseed.cortex.terminal-receipt.v1',
    receiptId: result.receipt.receiptId, receiptDigest: result.receipt.contentDigest,
    workObjectId: 'sapling:fitcheck', taskId: 'task-fitcheck-launch', executionId: 'exec_fitcheck_canary_1',
    outcome: 'executed', terminalProofDigest: `sha256:${'2'.repeat(64)}`,
    recordedAt: '2026-08-09T00:00:00.000Z',
    r2Key: 'portfolio/thoughtseed/workobjects/sapling:fitcheck/foldback/cortex/exec_fitcheck_canary_1.json',
  });
  assert.deepEqual(result.agentMemory?.workObject, { id: 'sapling:fitcheck', kind: 'sapling' });
  assert.deepEqual(result.agentMemory?.lineage, {
    nodeId: 'goal-fitcheck-launch', taskId: 'task-fitcheck-launch', graphVersion: 8,
    pinnedLoadoutId: 'loadout:fitcheck-launch', executionId: 'exec_fitcheck_canary_1',
  });
  assert.equal(result.agentMemory?.r2Key, 'portfolio/thoughtseed/workobjects/sapling:fitcheck/foldback/agent-memory/exec_fitcheck_canary_1.json');
  assert.deepEqual(result.nextIntent, {
    schema: 'thoughtseed.next-intent-proposal.v1', proposalId: `nip_${result.receipt.receiptId.slice(4)}`,
    receiptId: result.receipt.receiptId, workObjectId: 'sapling:fitcheck', taskId: 'task-fitcheck-launch',
    terminalProofDigest: `sha256:${'2'.repeat(64)}`,
    approvalRequired: true, goalGraphAuthority: false, status: 'proposal-only',
  });
  assert.deepEqual(result.edges, [
    { kind: 'proves', fromId: result.receipt.receiptId, toId: 'task-fitcheck-launch' },
    { kind: 'informs-next-intent', fromId: result.receipt.receiptId, toId: 'sapling:fitcheck' },
  ]);
  assert.equal(result.node.kind === 'receipt' && result.node.value.graphVersion, 8);
});

test('Cortex and agent memory are bounded receipt projections that exclude raw execution material', async () => {
  const { receipt } = await adaptVerified();
  const taintedReceipt = {
    ...receipt,
    execution: {
      ...receipt.execution,
      rawPrompt: 'prompt-must-never-project', rawResponse: 'response-must-never-project',
      providerPayload: { credential: 'credential-must-never-project' },
    },
  } as unknown as typeof receipt;
  const serialized = JSON.stringify({
    cortex: deriveHermesExecutionFoldbackCortexProjection(taintedReceipt),
    agentMemory: deriveHermesExecutionFoldbackAgentMemoryProjection(taintedReceipt),
  });
  for (const forbidden of ['prompt-must-never-project', 'response-must-never-project', 'credential-must-never-project', 'providerPayload', 'memberId']) {
    assert.doesNotMatch(serialized, new RegExp(forbidden));
  }
});

test('terminal foldback rejects unissued, stale, or substituted admission evidence before projection', async () => {
  const base = input();
  await assert.rejects(
    () => adaptHermesExecutionFoldback(
      input({ activation: { ...base.activation!, issued: false } }),
      activationVerifierFor(base),
    ),
    HermesExecutionFoldbackValidationError,
  );
  await assert.rejects(
    () => adaptHermesExecutionFoldback(
      input({ activation: { ...base.activation!, staleFence: true } }),
      activationVerifierFor(base),
    ),
    HermesExecutionFoldbackValidationError,
  );
  await assert.rejects(
    () => adaptHermesExecutionFoldback(
      input({ activation: { ...base.activation!, pinnedLoadoutId: 'loadout:substituted' } }),
      activationVerifierFor(base),
    ),
    HermesExecutionFoldbackValidationError,
  );
  await assert.rejects(
    () => adaptHermesExecutionFoldback(
      input({ activation: { ...base.activation!, workObjectId: 'sapling:iverif' } }),
      activationVerifierFor(base),
    ),
    HermesExecutionFoldbackValidationError,
  );
});

test('terminal foldback rejects self-asserted admission without authoritative readback', async () => {
  await assert.rejects(
    () => adaptHermesExecutionFoldback(input()),
    /requires an external admission readback verifier/i,
  );
  await assert.rejects(
    () => adaptHermesExecutionFoldback(input(), {
      source: 'external-admission-readback',
      verifyActivationAuthority: () => false,
    }),
    /lacks external admission readback proof/i,
  );
});

test('terminal foldback keeps existing receipt callers compatible when activation evidence is absent', async () => {
  const { activation: _activation, ...legacy } = input();
  const projection = await adaptHermesExecutionFoldback(legacy);
  assert.equal(projection.receipt.activation, undefined);
  assert.equal(projection.cortex, undefined);
  assert.equal(projection.agentMemory, undefined);
  assert.equal(projection.nextIntent, undefined);
  assert.deepEqual(projection.edges, [
    { kind: 'proves', fromId: projection.receipt.receiptId, toId: 'task-fitcheck-launch' },
  ]);
});

test('foldback replay is deterministic while retryable and mismatched anchors fail closed', async () => {
  assert.deepEqual(await adaptVerified(), await adaptVerified());
  await assert.rejects(
    () => adaptHermesExecutionFoldback(
      input({ execution: { ...input().execution, status: 'retryable' } }),
      activationVerifierFor(input()),
    ),
    HermesExecutionFoldbackValidationError,
  );
  await assert.rejects(
    () => adaptHermesExecutionFoldback(
      input({ goalGraph: { ...input().goalGraph, workObjectKind: 'branch' } }),
      activationVerifierFor(input()),
    ),
    HermesExecutionFoldbackValidationError,
  );
  await assert.rejects(
    () => adaptHermesExecutionFoldback(
      input({ goalGraph: { ...input().goalGraph, workObjectId: 'sapling:unknown' } }),
      activationVerifierFor(input()),
    ),
    HermesExecutionFoldbackValidationError,
  );
});

test('foldback store preserves exact replay and rejects conflicting terminal evidence', async () => {
  const base = input();
  const verifier = activationVerifierFor(base);
  const { receipt } = await adaptHermesExecutionFoldback(base, verifier);
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
  const store = createHermesExecutionFoldbackStore(bucket, verifier);
  assert.deepEqual(await store.record(receipt), { duplicate: false });
  assert.deepEqual(await store.record(receipt), { duplicate: true });
  const conflictingInput = input({
    execution: { ...input().execution, terminalProofDigest: `sha256:${'0'.repeat(64)}` },
  });
  const conflicting = (await adaptHermesExecutionFoldback(conflictingInput, verifier)).receipt;
  assert.equal(conflicting.r2Key, receipt.r2Key);
  await assert.rejects(() => store.record(conflicting), HermesExecutionFoldbackConflictError);
});

test('foldback store rejects a tampered compiled receipt before writing', async () => {
  const base = input();
  const verifier = activationVerifierFor(base);
  const { receipt } = await adaptHermesExecutionFoldback(base, verifier);
  let writes = 0;
  const store = createHermesExecutionFoldbackStore({
    async get() { return null; },
    async put() { writes += 1; return null; },
  }, verifier);
  await assert.rejects(
    () => store.record({ ...receipt, r2Key: 'portfolio/thoughtseed/workobjects/sapling:fitcheck/foldback/wrong.json' }),
    HermesExecutionFoldbackValidationError,
  );
  assert.equal(writes, 0);
});
