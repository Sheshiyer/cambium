import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  adaptHermesExecutionFoldback,
  canonicalHermesFoldbackJson,
  createHermesExecutionFoldbackReader,
  type HermesExecutionFoldbackActivationVerifier,
  type HermesExecutionFoldbackInput,
  type HermesExecutionFoldbackProjection,
} from '../../workers/quests/src/hermes-execution-foldback.ts';
import { readFoldbackText, type FoldbackTextRequest } from './cortex-foldback-text.ts';

function input(): HermesExecutionFoldbackInput {
  return {
    schema: 'thoughtseed.hermes.execution-foldback.v1', tenantId: 'synthetic-tenant', graphVersion: 8,
    goalGraph: {
      nodeId: 'synthetic-goal', taskId: 'synthetic-task', workObjectId: 'sapling:cambium',
      workObjectKind: 'sapling', pinnedLoadoutId: 'loadout:synthetic',
    },
    execution: {
      memberId: 'synthetic-member', directiveId: 'synthetic-directive', idempotencyKey: 'synthetic-idempotency',
      executionId: 'synthetic-execution', claimId: 'synthetic-claim', fencingToken: 'synthetic-fence',
      attempt: 1, status: 'executed', attestationId: 'synthetic-attestation',
      inputDigest: `sha256:${'1'.repeat(64)}`, terminalProofDigest: `sha256:${'2'.repeat(64)}`,
      recordedAt: '2026-01-02T03:04:05.000Z',
    },
    activation: {
      activationId: 'activation:synthetic', activationDigest: `sha256:${'3'.repeat(64)}`,
      mappingReceiptId: 'synthetic-mapping', mappingReceiptDigest: `sha256:${'4'.repeat(64)}`,
      issued: true, staleFence: false, workObjectId: 'sapling:cambium', taskId: 'synthetic-task',
      pinnedLoadoutId: 'loadout:synthetic', fencingToken: 'synthetic-fence',
    },
  };
}

async function setup(candidate = input(), admitted = true) {
  const expected = input();
  const verifier: HermesExecutionFoldbackActivationVerifier = {
    source: 'external-admission-readback',
    verifyActivationAuthority(activation, execution) {
      return admitted && canonicalHermesFoldbackJson(activation) === canonicalHermesFoldbackJson(expected.activation)
        && execution?.executionId === expected.execution.executionId;
    },
  };
  const projection = await adaptHermesExecutionFoldback(candidate, verifier);
  const bytes = canonicalHermesFoldbackJson(projection.receipt);
  const values = new Map([[projection.receipt.r2Key, bytes]]);
  let reads = 0;
  const bucket = { async get(key: string) { reads++; const value = values.get(key); return value === undefined ? null : { async text() { return value; } }; } };
  const request: FoldbackTextRequest = {
    r2Key: projection.receipt.r2Key,
    binding: { tenantId: candidate.tenantId, graphVersion: candidate.graphVersion, goalGraph: candidate.goalGraph },
    scope: { tenantId: candidate.tenantId, projectId: candidate.goalGraph.workObjectId, sourcePlane: 'execution-learning', audience: 'founder' },
  };
  return { projection, bytes, values, bucket, request, verifier,
    reader: createHermesExecutionFoldbackReader(bucket, verifier), reads: () => reads };
}

test('admission-verified read emits bounded provider-neutral evidence with exact citation and stable replay', async () => {
  const f = await setup();
  const first = await readFoldbackText(f.reader, f.request);
  assert.equal(first.status, 'available');
  if (first.status !== 'available') return;
  assert.deepEqual(await readFoldbackText(f.reader, f.request), first);
  assert.equal(first.note.noteId, `hermes.${f.projection.receipt.receiptId}`);
  assert.equal(first.note.authorityTier, 'projection');
  assert.equal(first.note.effectsAuthorized, false);
  assert.equal(first.note.semanticAcceptance, false);
  assert.equal(first.note.evidence.kind, 'admitted-foldback');
  assert.equal(first.note.evidence.terminalProofDigest, input().execution.terminalProofDigest);
  assert.equal(first.note.citations[0].sha256, createHash('sha256').update(f.bytes).digest('hex'));
  assert.ok(first.note.text.length < 1200);
  assert.match(first.note.text, /terminal executed/);
  assert.match(first.note.text, /project ISA acceptance.*own authority/);
  assert.doesNotMatch(JSON.stringify(first), /api[_-]?key|provider|activationDigest|rawPrompt/);
});

test('legacy unadmitted receipt remains held even if raw text claims acceptance', async () => {
  const candidate = input(); delete candidate.activation;
  const f = await setup(candidate);
  assert.deepEqual(await readFoldbackText(f.reader, f.request), { status: 'held', reason: 'missing-evidence' });
  const raw = JSON.parse(f.bytes); raw.cortex = { accepted: true }; raw.semanticAcceptance = true;
  f.values.set(f.request.r2Key, JSON.stringify(raw));
  const result = await readFoldbackText(f.reader, f.request);
  assert.equal(result.status, 'unavailable');
  assert.equal('note' in result, false);
});

test('missing or refusing external admission verifier cannot authorize foldback text', async () => {
  const f = await setup();
  const absent = createHermesExecutionFoldbackReader(f.bucket);
  const refuses = createHermesExecutionFoldbackReader(f.bucket, { source: 'external-admission-readback', verifyActivationAuthority: () => false });
  assert.equal((await readFoldbackText(absent, f.request)).status, 'unavailable');
  assert.equal((await readFoldbackText(refuses, f.request)).status, 'unavailable');
});

test('configured tenant, project, plane and member audience cannot expand the reader binding', async () => {
  const f = await setup();
  for (const scope of [
    { ...f.request.scope, tenantId: 'another-tenant' },
    { ...f.request.scope, projectId: 'sapling:fitcheck' },
    { ...f.request.scope, sourcePlane: 'nutrix-signal' },
    { ...f.request.scope, memberId: 'unexpected-member' },
  ]) assert.equal((await readFoldbackText(f.reader, { ...f.request, scope })).status, 'held');
  assert.equal(f.reads(), 0);
  const wrong = await readFoldbackText(f.reader, { ...f.request, scope: { ...f.request.scope, audience: 'member', memberId: 'other-member' } });
  assert.equal(wrong.status, 'held');
  const member = await readFoldbackText(f.reader, { ...f.request, scope: { ...f.request.scope, audience: 'member', memberId: 'synthetic-member' } });
  assert.equal(member.status, 'available');
});

test('exact graph/task/loadout lineage and canonical immutable bytes remain required', async () => {
  const f = await setup();
  for (const binding of [
    { ...f.request.binding, graphVersion: 9 },
    { ...f.request.binding, goalGraph: { ...f.request.binding.goalGraph, taskId: 'other-task' } },
    { ...f.request.binding, goalGraph: { ...f.request.binding.goalGraph, pinnedLoadoutId: 'loadout:other' } },
  ]) assert.equal((await readFoldbackText(f.reader, { ...f.request, binding })).status, 'unavailable');
  f.values.set(f.request.r2Key, `${f.bytes}\n`);
  assert.equal((await readFoldbackText(f.reader, f.request)).status, 'unavailable');
  assert.equal((await readFoldbackText(f.reader, { ...f.request, r2Key: '../escape.json' })).status, 'held');
});

test('projection lineage mismatch is held even at an incorrectly composed reader boundary', async () => {
  const f = await setup();
  const mismatches: HermesExecutionFoldbackProjection[] = [
    { ...f.projection, cortex: { ...f.projection.cortex!, executionId: 'sibling-execution' } },
    { ...f.projection, receipt: { ...f.projection.receipt, tenantId: 'other-tenant' } },
    { ...f.projection, receipt: { ...f.projection.receipt, r2Key: 'wrong-key' } },
  ];
  for (const projection of mismatches) {
    const result = await readFoldbackText({ async read() { return projection; } }, f.request);
    assert.deepEqual(result, { status: 'held', reason: 'lineage-mismatch' });
  }
});

test('failed terminal execution stays failed evidence without exposing raw payloads', async () => {
  const candidate = input(); candidate.execution.status = 'failed';
  const f = await setup(candidate);
  const result = await readFoldbackText(f.reader, f.request);
  assert.equal(result.status, 'available');
  if (result.status !== 'available') return;
  assert.equal(result.note.evidence.outcome, 'failed');
  assert.match(result.note.text, /terminal failed/);
  assert.equal(result.note.semanticAcceptance, false);
});

test('absent immutable source and read failures expose no source bodies', async () => {
  const f = await setup(); f.values.clear();
  assert.deepEqual(await readFoldbackText(f.reader, f.request), { status: 'held', reason: 'missing-evidence' });
  const result = await readFoldbackText({ async read() { throw new Error('synthetic-private-body'); } }, f.request);
  assert.deepEqual(result, { status: 'unavailable', reason: 'read-failed' });
  assert.doesNotMatch(JSON.stringify(result), /synthetic-private-body/);
});
