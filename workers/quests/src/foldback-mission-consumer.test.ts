import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { adaptHermesExecutionFoldback, canonicalHermesFoldbackJson, createHermesExecutionFoldbackReader } from './hermes-execution-foldback.ts';
const verifier = { source: 'external-admission-readback' as const, verifyActivationAuthority: () => true };
import { readFoldbackMissionFacts, type AcceptedWorkUnitReceipt } from './foldback-mission-consumer.ts';

function fixture() {
  const binding = { tenantId: 'cambium', graphVersion: 8, goalGraph: { nodeId: 'goal-wtfmedia', taskId: 'task-wtfmedia', workObjectId: 'branch:wtfmedia', workObjectKind: 'branch' as const, pinnedLoadoutId: 'loadout:wtfmedia-source-audit' } };
  const unit: AcceptedWorkUnitReceipt = { schema: 'temperance.accepted-work-unit.v1', contractId: `sha256:${'1'.repeat(64)}`, binding: { taskId: 'task-wtfmedia', goalId: 'goal-wtfmedia', workObjectId: 'branch:wtfmedia', executionInputDigest: `sha256:${'1'.repeat(64)}` }, domain: 'test-fixture', taskAccepted: true, wholeLifecycleAccepted: false, productionCambiumAdmission: false };
  const input = { schema: 'thoughtseed.hermes.execution-foldback.v1', ...binding, activation: { activationId: 'activation:wtfmedia', activationDigest: `sha256:${'3'.repeat(64)}`, mappingReceiptId: 'pmr_wtfmedia', mappingReceiptDigest: `sha256:${'4'.repeat(64)}`, issued: true, staleFence: false, workObjectId: 'branch:wtfmedia', taskId: 'task-wtfmedia', pinnedLoadoutId: 'loadout:wtfmedia-source-audit', fencingToken: 'fence-wtfmedia' }, execution: { memberId: 'synthetic', directiveId: 'native-wtfmedia-canary', idempotencyKey: 'wtfmedia-1', executionId: 'exec_wtfmedia_1', claimId: 'claim-wtfmedia', fencingToken: 'fence-wtfmedia', attempt: 1, status: 'executed', attestationId: 'att_wtfmedia', inputDigest: unit.contractId, terminalProofDigest: `sha256:${createHash('sha256').update(JSON.stringify(unit)).digest('hex')}`, recordedAt: '2026-10-16T10:00:00.000Z' } };
  const node = { tenantId: 'cambium', graphVersion: 8, ...binding.goalGraph, externalId: binding.goalGraph.taskId, status: 'active' };
  return { binding, unit, input, node };
}

test('stored terminal receipt joins exact D1 lineage and accepted owner readback, without whole-goal claim', async () => {
  const f = fixture();
  const projection = await adaptHermesExecutionFoldback(f.input, verifier);
  let reads = 0;
  const reader = createHermesExecutionFoldbackReader({ async get() { reads++; return { async text() { return canonicalHermesFoldbackJson(projection.receipt); } }; } }, verifier);
  const args = { tenantId: f.binding.tenantId, graphVersion: 8, nodes: [f.node], references: [{ r2Key: projection.receipt.r2Key, binding: f.binding }], reader };
  const held = await readFoldbackMissionFacts(args);
  assert.equal(held.gaps[0].kind, 'semantic-acceptance-unavailable');
  const accepted = await readFoldbackMissionFacts({ ...args, acceptedWorkUnitReadback: { source: 'owner-readback', async readAcceptedWorkUnit() { return f.unit; } } });
  assert.equal(accepted.gaps.length, 0);
  assert.equal(accepted.nodes.length, 1);
  assert.ok(accepted.nodes[0].kind === 'receipt' && accepted.nodes[0].value.evidenceRefs.some(ref => ref.startsWith('accepted-work-unit:sha256:')));
  assert.equal(reads, 2);
  const wrong = await readFoldbackMissionFacts({ ...args, acceptedWorkUnitReadback: { source: 'owner-readback', async readAcceptedWorkUnit() { return { ...f.unit, binding: { ...f.unit.binding, executionInputDigest: `sha256:${'f'.repeat(64)}` } }; } } });
  assert.equal(wrong.gaps[0].kind, 'semantic-acceptance-unavailable');
});

test('stopped/wrong loadout lineage never reads immutable receipt; tenant mismatch and malformed refs reject', async () => {
  const f = fixture();
  const projection = await adaptHermesExecutionFoldback(f.input, verifier);
  let reads = 0;
  const args = { tenantId: 'cambium', graphVersion: 8, nodes: [f.node], references: [{ r2Key: projection.receipt.r2Key, binding: f.binding }], reader: { async read() { reads++; return projection; } } };
  for (const node of [{ ...f.node, status: 'paused' }, { ...f.node, status: 'draft' }, { ...f.node, status: 'retired' }, { ...f.node, tenantId: 'other' }, { ...f.node, graphVersion: 9 }, { ...f.node, currentState: 'stopped' }, { ...f.node, status: 'stopped' }, { ...f.node, pinnedLoadoutId: 'other-loadout' }]) {
    const result = await readFoldbackMissionFacts({ ...args, nodes: [node] });
    assert.equal(result.nodes.length, 0); assert.equal(result.gaps[0].kind, 'foldback-binding-unmatched');
  }
  assert.equal(reads, 0);
  await assert.rejects(() => readFoldbackMissionFacts({ ...args, tenantId: 'other-tenant' }));
  await assert.rejects(() => readFoldbackMissionFacts({ ...args, references: [null] as never[] }));
});

test('legacy prepared receipt without verified activation cannot acquire semantic acceptance', async () => {
  const f = fixture();
  const { activation: _activation, ...legacy } = f.input;
  const projection = await adaptHermesExecutionFoldback(legacy);
  const facts = await readFoldbackMissionFacts({ tenantId: 'cambium', graphVersion: 8, nodes: [f.node],
    references: [{ r2Key: projection.receipt.r2Key, binding: f.binding }], reader: { async read() { return projection; } },
    acceptedWorkUnitReadback: { source: 'owner-readback', async readAcceptedWorkUnit() { throw new Error('must not read owner'); } } });
  assert.equal(facts.gaps[0].kind, 'semantic-acceptance-unavailable');
});
