import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoalGraphTerminalAdmission, EXECUTION_ADMISSION_SCHEMA, executionAdmissionMetadata, importActivationKey, parseExecutionAdmission } from './terminal-admission.ts';
import { parseTelegramGoalGraphIntentBoundary, TELEGRAM_GOAL_GRAPH_INTENT_SCHEMA, TELEGRAM_GOAL_GRAPH_INTENT_VERSION } from './goal-graph-intake.ts';
const KEY = (await importActivationKey('k'.repeat(32)))!;
import { adaptHermesExecutionFoldback } from './hermes-execution-foldback.ts';
import type { GoalGraphHead, GoalGraphNode } from './goal-graph/types.ts';

const DISPATCH = `sha256:${'d'.repeat(64)}`;
const admission = { schema: EXECUTION_ADMISSION_SCHEMA, memberId: 'synthetic', directiveId: 'native-wtfmedia-1', idempotencyKey: 'wtfmedia-1', clusterId: 'cluster:wtfmedia-source-verification', dispatchDigest: DISPATCH };
const head: GoalGraphHead = { tenantId: 'cambium', graphVersion: 8, graphDigest: `sha256:${'8'.repeat(64)}`, nodeIds: ['goal-wtfmedia'], sourceRef: null, sourceDigest: null, committedAt: '2026-10-20T00:00:00.000Z' };
const node: GoalGraphNode = { nodeId: 'goal-wtfmedia', tenantId: 'cambium', namespace: 'thoughtseed', externalId: 'task-wtfmedia', parentNodeId: null, workObjectId: 'branch:wtfmedia', workObjectKind: 'branch', pinnedLoadoutId: 'loadout:wtfmedia-source-audit', scope: 'proof', desiredState: 'verified', currentState: 'admitted', owner: 'operator', nextAction: null, waitCondition: null, proofRequired: true, reviewAt: null, status: 'active', sourceRef: 'gate:approval', sourceDigest: `sha256:${'5'.repeat(64)}`, graphVersion: 8, metadata: executionAdmissionMetadata(admission), createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z' };
const outcome = { memberId: 'synthetic', directiveId: 'native-wtfmedia-1', idempotencyKey: 'wtfmedia-1', executionId: 'exec_wtfmedia_1', runnerId: 'runner-1', hostIdentity: 'host-1', claimId: 'claim-1', fencingToken: 'fence_1', attempt: 1, status: 'executed' as const,
  attestation: { schema: 'thoughtseed.hermes.execution_attestation.v1' as const, id: 'att_1', executionId: 'exec_wtfmedia_1', directiveId: 'native-wtfmedia-1', idempotencyKey: 'wtfmedia-1', runnerId: 'runner-1', hostIdentity: 'host-1', command: 'canary.record' as const, status: 'executed' as const, exitCode: 0 as const, inputDigest: DISPATCH, outputDigest: `sha256:${'a'.repeat(64)}`, startedAt: '2026-10-20T01:00:00.000Z', finishedAt: '2026-10-20T01:01:00.000Z' },
  attestationDigest: `sha256:${'b'.repeat(64)}`, recordedAt: '2026-10-20T01:01:00.000Z' };

function store(state: { head: GoalGraphHead | null; nodes: GoalGraphNode[]; fail?: boolean }) {
  return { async readHead() { if (state.fail) throw new Error('d1 down'); return state.head; }, async readNodes() { if (state.fail) throw new Error('d1 down'); return state.nodes; } };
}

test('exact D1 admission prepares a foldback input the real adapter accepts with its own verifier', async () => {
  const admissionOwner = createGoalGraphTerminalAdmission({ tenantId: 'cambium', activationKey: KEY, goalGraphStore: store({ head, nodes: [node] }) });
  const input = await admissionOwner.prepare(outcome);
  assert.ok(input && input.activation);
  assert.equal(input.goalGraph.taskId, 'task-wtfmedia');
  assert.equal(input.execution.terminalProofDigest, outcome.attestation.outputDigest);
  assert.equal(input.activation.fencingToken, outcome.fencingToken);
  assert.equal(await admissionOwner.activationVerifier.verifyActivationAuthority(input.activation, input.execution), true);
  assert.equal(await admissionOwner.activationVerifier.verifyActivationAuthority(input.activation), false, 'no execution, no authority');
  // Review 3 M1: a genuine activation copied onto a sibling receipt fails.
  for (const sibling of [
    { ...input.execution, executionId: 'exec_planted' },
    { ...input.execution, terminalProofDigest: `sha256:${'c'.repeat(64)}` },
    { ...input.execution, status: 'failed' as const },
    { ...input.execution, attestationId: 'att_planted' },
    { ...input.execution, recordedAt: '2026-10-20T02:00:00.000Z' },
  ]) assert.equal(await admissionOwner.activationVerifier.verifyActivationAuthority(input.activation, sibling), false);
  const projection = await adaptHermesExecutionFoldback(input, admissionOwner.activationVerifier);
  assert.ok(projection.nextIntent && projection.nextIntent.approvalRequired === true && projection.nextIntent.goalGraphAuthority === false);
});

test('inactive, stopped, stale, rebound, unregistered, unauthorized, ambiguous and failed reads never admit', async () => {
  const cases: Array<[string, { head: GoalGraphHead | null; nodes: GoalGraphNode[]; fail?: boolean }, typeof outcome]> = [
    ['paused', { head, nodes: [{ ...node, status: 'paused' }] }, outcome],
    ['stopped', { head, nodes: [{ ...node, currentState: 'stopped' }] }, outcome],
    ['stale node version', { head, nodes: [{ ...node, graphVersion: 7 }] }, outcome],
    ['other tenant', { head, nodes: [{ ...node, tenantId: 'other' }] }, outcome],
    ['rebound directive', { head, nodes: [{ ...node, metadata: executionAdmissionMetadata({ ...admission, directiveId: 'other' }) }] }, outcome],
    ['wrong dispatch digest', { head, nodes: [node] }, { ...outcome, attestation: { ...outcome.attestation, inputDigest: `sha256:${'e'.repeat(64)}` } }],
    ['unregistered loadout', { head, nodes: [{ ...node, pinnedLoadoutId: 'loadout:unknown' }] }, outcome],
    ['cluster not authorized', { head, nodes: [{ ...node, metadata: executionAdmissionMetadata({ ...admission, clusterId: 'cluster:fitcheck-no-spend' }) }] }, outcome],
    ['work object outside loadout', { head, nodes: [{ ...node, workObjectId: 'sapling:fitcheck', workObjectKind: 'sapling' }] }, outcome],
    ['extra admission field', { head, nodes: [{ ...node, metadata: { ...executionAdmissionMetadata(admission), executionAdmissionAccepted: true } }] }, outcome],
    ['no admission', { head, nodes: [{ ...node, metadata: {} }] }, outcome],
    ['ambiguous', { head, nodes: [node, { ...node, nodeId: 'goal-wtfmedia-dup', externalId: 'task-dup' }] }, outcome],
    ['no head', { head: null, nodes: [node] }, outcome],
    ['d1 error', { head, nodes: [node], fail: true }, outcome],
    ['retryable is not terminal', { head, nodes: [node] }, { ...outcome, status: 'retryable' as never }],
  ];
  for (const [label, state, candidate] of cases) {
    const owner = createGoalGraphTerminalAdmission({ tenantId: 'cambium', activationKey: KEY, goalGraphStore: store(state) });
    assert.equal(await owner.prepare(candidate), null, label);
  }
});

test('activation verifier recomputes from current D1 and rejects caller-made or outdated activations', async () => {
  const state = { head, nodes: [node] };
  const owner = createGoalGraphTerminalAdmission({ tenantId: 'cambium', activationKey: KEY, goalGraphStore: store(state) });
  const input = (await owner.prepare(outcome))!;
  const activation = input.activation!;
  const execution = input.execution;
  for (const forged of [
    { ...activation, activationDigest: `sha256:${'0'.repeat(64)}` },
    { ...activation, fencingToken: 'fence_other' },
    { ...activation, mappingReceiptId: 'pmr_goal-wtfmedia' },
    { ...activation, mappingReceiptId: 'gga:missing-node' },
    { ...activation, pinnedLoadoutId: 'loadout:fitcheck-launch' },
  ]) assert.equal(await owner.activationVerifier.verifyActivationAuthority(forged, execution), false);
  // A vault writer who knows every D1 value still cannot compute the keyed digest.
  const otherKey = (await importActivationKey('o'.repeat(32)))!;
  const forger = createGoalGraphTerminalAdmission({ tenantId: 'cambium', activationKey: otherKey, goalGraphStore: store(state) });
  const forged = (await forger.prepare({ ...outcome, fencingToken: 'fence_forged' }))!;
  assert.equal(await owner.activationVerifier.verifyActivationAuthority(forged.activation!, forged.execution), false, 'activation keyed by another secret');
  assert.equal(await importActivationKey('short'), null);
  assert.equal(await importActivationKey(undefined), null);
  state.head = { ...head, graphDigest: `sha256:${'9'.repeat(64)}` };
  assert.equal(await owner.activationVerifier.verifyActivationAuthority(activation, execution), false, 'graph advanced');
  state.head = head; state.nodes = [{ ...node, status: 'retired' }];
  assert.equal(await owner.activationVerifier.verifyActivationAuthority(activation, execution), false, 'node retired');
});

test('admission metadata parse is exact', () => {
  assert.deepEqual(parseExecutionAdmission(executionAdmissionMetadata(admission)), admission);
  assert.deepEqual(parseExecutionAdmission({ ...executionAdmissionMetadata(admission), unrelated: 'kept' }), admission);
  const partial: Record<string, string> = executionAdmissionMetadata(admission);
  delete partial.executionAdmissionClusterId;
  for (const bad of [null, {}, partial, { executionAdmission: admission }, executionAdmissionMetadata({ ...admission, schema: 'v0' as never }), executionAdmissionMetadata({ ...admission, dispatchDigest: 'nope' }), executionAdmissionMetadata({ ...admission, memberId: '' })]) {
    assert.equal(parseExecutionAdmission(bad), null);
  }
});

test('admission metadata crosses the real Gate Telegram intake boundary (scalar-only, no forbidden keys)', () => {
  const result = parseTelegramGoalGraphIntentBoundary({
    schema: TELEGRAM_GOAL_GRAPH_INTENT_SCHEMA, version: TELEGRAM_GOAL_GRAPH_INTENT_VERSION, tenantId: 'cambium',
    source: { kind: 'telegram', chatId: '-100123', messageId: '42', updateId: '9001' },
    goal: { desiredState: 'verify the pinned WTFMedia source-mode contract', externalId: 'task-wtfmedia', status: 'active', scope: 'proof',
      workObjectId: 'branch:wtfmedia', workObjectKind: 'branch', pinnedLoadoutId: 'loadout:wtfmedia-source-audit', metadata: executionAdmissionMetadata(admission) },
  });
  assert.equal(result.accepted, true, JSON.stringify(result));
  const goal = (result as { value?: { goal?: Record<string, unknown> } }).value?.goal ?? {};
  assert.equal(goal.pinnedLoadoutId, 'loadout:wtfmedia-source-audit');
  assert.deepEqual(parseExecutionAdmission(goal.metadata), admission);
});
