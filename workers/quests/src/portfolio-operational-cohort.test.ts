import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import { adaptHermesExecutionFoldback } from './hermes-execution-foldback.ts';
import {
  GOVERNED_ACTIVATION_MANIFEST,
  GOVERNED_ACTIVATION_MANIFEST_DIGEST,
  GOVERNED_LOADOUT_REGISTRY,
  GOVERNED_LOADOUT_REGISTRY_DIGEST,
  THREE_SAPLING_LOADOUT_AUTHORITY,
  GovernedPortfolioOperationalCohortValidationError,
  buildUnverifiedAdmittedActivationClaim,
  buildUnverifiedIssuedMappingReceiptClaim,
  deriveActivationRecordDigest,
  deriveGovernedDispatchApprovalSubjectDigest,
  deriveLoadoutAuthorityDigest,
  prepareGovernedDispatch,
  resolveGovernedLoadout,
  validateGovernedActivationManifest,
  validateGovernedLoadoutRegistry,
} from './portfolio-operational-cohort.ts';
import type { GovernedWorkObjectId } from './portfolio-operational-cohort.ts';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

const WORK_OBJECT_IDS = ['sapling:fitcheck', 'sapling:iverif', 'sapling:dlock'] as const;

function activationRecord(workObjectId: GovernedWorkObjectId) {
  const record = GOVERNED_ACTIVATION_MANIFEST.records.find((entry) => entry.workObjectId === workObjectId) ?? null;
  assert.ok(record, `missing activation record ${workObjectId}`);
  return record;
}

function dispatchInput(workObjectId: GovernedWorkObjectId = 'sapling:fitcheck') {
  const record = activationRecord(workObjectId);
  const loadoutId = workObjectId === 'sapling:fitcheck'
    ? 'loadout:fitcheck-launch'
    : workObjectId === 'sapling:iverif'
      ? 'loadout:iverif-observer'
      : 'loadout:dlock-inventory';
  const loadout = resolveGovernedLoadout(loadoutId, workObjectId);
  assert.ok(loadout, `missing loadout ${workObjectId}`);
  const issuedMappingReceiptAuthority = buildUnverifiedIssuedMappingReceiptClaim(workObjectId, `issued-receipt:${workObjectId}`);
  const admittedActivationAuthority = buildUnverifiedAdmittedActivationClaim(
    workObjectId,
    issuedMappingReceiptAuthority,
    `admitted-activation:${workObjectId}`,
  );
  const authority = {
    tenantId: 'cambium' as const,
    workObjectId,
    taskId: loadout.taskId,
    graphVersion: 7,
    activationManifestDigest: GOVERNED_ACTIVATION_MANIFEST_DIGEST,
    activationRecordDigest: record.recordDigest,
    activationDigest: record.activationDigest,
    repository: record.repository,
    loadoutId: loadout.loadoutId,
    loadoutDigest: loadout.authorityDigest,
    clusters: loadout.authorizedClusterIds,
    command: loadout.commandAllowlist[0],
    mappingReceiptAuthority: {
      preparedAuthorityRef: issuedMappingReceiptAuthority.preparedAuthorityRef,
      preparedAuthorityDigest: issuedMappingReceiptAuthority.preparedAuthorityDigest,
      issuedAuthorityRef: issuedMappingReceiptAuthority.issuedAuthorityRef,
      issuedAuthorityDigest: issuedMappingReceiptAuthority.issuedAuthorityDigest,
    },
    admittedActivationAuthority,
  };
  return {
    schema: 'cambium.governed-dispatch-preparation-input.v1' as const,
    tenantId: 'cambium' as const,
    workObjectId,
    taskId: loadout.taskId,
    graphVersion: 7,
    loadoutId: loadout.loadoutId,
    clusterIds: loadout.authorizedClusterIds,
    command: loadout.commandAllowlist[0],
    repository: record.repository,
    issuedMappingReceiptAuthority,
    admittedActivationAuthority,
    approval: {
      schema: 'cambium.governed-dispatch-approval-reference.v1' as const,
      approvalRef: `approval:${workObjectId}`,
      approvalSubjectDigest: deriveGovernedDispatchApprovalSubjectDigest(authority),
      status: 'signed-unconsumed' as const,
      consumed: false as const,
    },
  };
}

function authorityVerifierFor(candidate: ReturnType<typeof dispatchInput>) {
  return {
    source: 'external-authority-readback' as const,
    verifyIssuedMappingReceiptAuthority(authority: { issuedAuthorityDigest: string }) {
      return authority.issuedAuthorityDigest === candidate.issuedMappingReceiptAuthority.issuedAuthorityDigest;
    },
    verifyAdmittedActivationAuthority(authority: { admittedAuthorityDigest: string }) {
      return authority.admittedAuthorityDigest === candidate.admittedActivationAuthority.admittedAuthorityDigest;
    },
  };
}

test('ships exactly three held activations and exact immutable no-spend loadouts', () => {
  assert.deepEqual(GOVERNED_ACTIVATION_MANIFEST.records.map((record) => record.workObjectId), WORK_OBJECT_IDS);
  assert.deepEqual(
    GOVERNED_LOADOUT_REGISTRY.records.map((record) => record.loadoutId),
    ['loadout:fitcheck-launch', 'loadout:iverif-observer', 'loadout:dlock-inventory'],
  );
  assert.match(GOVERNED_ACTIVATION_MANIFEST_DIGEST, /^sha256:[0-9a-f]{64}$/);
  assert.match(GOVERNED_LOADOUT_REGISTRY_DIGEST, /^sha256:[0-9a-f]{64}$/);
  assert.equal(Object.isFrozen(GOVERNED_ACTIVATION_MANIFEST), true);
  assert.equal(Object.isFrozen(GOVERNED_LOADOUT_REGISTRY), true);
  assert.deepEqual(activationRecord('sapling:dlock').rootContext, {
    folder: null,
    additionalFolders: [],
    proposedKind: null,
    accountId: null,
    workIds: [],
    status: 'no-shallow-folder',
  });
  for (const record of GOVERNED_ACTIVATION_MANIFEST.records) {
    assert.equal(record.mappingReceiptAuthority.issued, false);
    assert.equal(record.activationAuthority.admitted, false);
  }
  for (const loadout of GOVERNED_LOADOUT_REGISTRY.records) {
    assert.equal(loadout.spendClass, 'none');
    assert.equal(loadout.deliveryEnabled, false);
    assert.equal(loadout.externalMutationAllowed, false);
  }
});

test('registry authority resolves exact loadouts and rejects syntax-only or cross-Sapling joins', () => {
  const fitcheck = THREE_SAPLING_LOADOUT_AUTHORITY.resolve('loadout:fitcheck-launch');
  assert.ok(fitcheck);
  assert.deepEqual(fitcheck.eligibleWorkObjectIds, ['sapling:fitcheck']);
  assert.equal(THREE_SAPLING_LOADOUT_AUTHORITY.resolve('loadout:unknown'), null);
  assert.equal(resolveGovernedLoadout('loadout:fitcheck-launch', 'sapling:iverif'), null);
});

test('closed manifest and registry validation rejects unknown, duplicate, and tampered records', () => {
  const manifestUnknown = structuredClone(GOVERNED_ACTIVATION_MANIFEST) as Record<string, unknown>;
  (manifestUnknown.records as Array<Record<string, unknown>>)[0].rogue = true;
  assert.throws(() => validateGovernedActivationManifest(manifestUnknown), GovernedPortfolioOperationalCohortValidationError);
  const manifestDuplicate = structuredClone(GOVERNED_ACTIVATION_MANIFEST) as Record<string, unknown>;
  (manifestDuplicate.records as unknown[])[2] = structuredClone((manifestDuplicate.records as unknown[])[0]);
  assert.throws(() => validateGovernedActivationManifest(manifestDuplicate), GovernedPortfolioOperationalCohortValidationError);
  const registryTampered = structuredClone(GOVERNED_LOADOUT_REGISTRY) as { records: Array<Record<string, unknown>> };
  registryTampered.records[0].authorityDigest = `sha256:${'0'.repeat(64)}`;
  assert.throws(() => validateGovernedLoadoutRegistry(registryTampered), /digest is tampered/i);
});

test('activation and loadout digests change for authority-bearing mutations', () => {
  const activation = activationRecord('sapling:fitcheck');
  const activationMutation = structuredClone(activation);
  activationMutation.repository.repositoryId = 'R_kgDOSzF56x';
  assert.notEqual(deriveActivationRecordDigest(activationMutation), activation.recordDigest);
  const loadout = resolveGovernedLoadout('loadout:iverif-observer', 'sapling:iverif');
  assert.ok(loadout);
  const loadoutMutation = structuredClone(loadout);
  loadoutMutation.commandAllowlist[0] = 'command:fitcheck-launch-packet';
  assert.notEqual(deriveLoadoutAuthorityDigest(loadoutMutation), loadout.authorityDigest);
});

test('governed dispatch is exact, approval-bound, immutable, and mutation-disabled', () => {
  const candidate = dispatchInput();
  const prepared = prepareGovernedDispatch(candidate, authorityVerifierFor(candidate));
  assert.equal(prepared.workObjectId, 'sapling:fitcheck');
  assert.equal(prepared.activationManifestDigest, GOVERNED_ACTIVATION_MANIFEST_DIGEST);
  assert.equal(prepared.approval.status, 'signed-unconsumed');
  assert.equal(prepared.approval.consumed, false);
  assert.equal(prepared.spendClass, 'none');
  assert.equal(prepared.deliveryEnabled, false);
  assert.equal(prepared.externalMutationAllowed, false);
  assert.equal(Object.isFrozen(prepared), true);
});

test('governed dispatch rejects cross-Sapling substitutions and stale approval subjects', () => {
  const base = dispatchInput();
  for (const mutation of [
    { ...base, repository: activationRecord('sapling:iverif').repository },
    { ...base, taskId: 'task:iverif-observer' as const },
    { ...base, clusterIds: ['cluster:iverif-observer'] as const },
    { ...base, loadoutId: 'loadout:iverif-observer' as const },
    { ...base, issuedMappingReceiptAuthority: buildUnverifiedIssuedMappingReceiptClaim('sapling:iverif', 'issued-receipt:sapling:iverif') },
    {
      ...base,
      admittedActivationAuthority: buildUnverifiedAdmittedActivationClaim(
        'sapling:iverif',
        buildUnverifiedIssuedMappingReceiptClaim('sapling:iverif', 'issued-receipt:sapling:iverif'),
        'admitted-activation:sapling:iverif',
      ),
    },
    { ...base, approval: { ...base.approval, approvalSubjectDigest: `sha256:${'8'.repeat(64)}` } },
  ]) {
    assert.throws(
      () => prepareGovernedDispatch(mutation, authorityVerifierFor(base)),
      GovernedPortfolioOperationalCohortValidationError,
    );
  }
});

test('governed dispatch rejects a same-Sapling admission bound to another issued receipt', () => {
  const base = dispatchInput();
  const otherIssuedAuthority = buildUnverifiedIssuedMappingReceiptClaim(
    'sapling:fitcheck',
    'issued-receipt:sapling:fitcheck:replacement',
  );
  const mismatchedAdmission = buildUnverifiedAdmittedActivationClaim(
    'sapling:fitcheck',
    otherIssuedAuthority,
    'admitted-activation:sapling:fitcheck:replacement',
  );
  assert.throws(
    () => prepareGovernedDispatch(
      { ...base, admittedActivationAuthority: mismatchedAdmission },
      authorityVerifierFor(base),
    ),
    /does not match the issued mapping receipt authority/i,
  );
});

test('governed dispatch rejects self-consistent claims without external readback verification', () => {
  const candidate = dispatchInput();
  assert.throws(
    () => prepareGovernedDispatch(candidate, {
      source: 'external-authority-readback',
      verifyIssuedMappingReceiptAuthority: () => false,
      verifyAdmittedActivationAuthority: () => true,
    }),
    /lacks external readback proof/i,
  );
  assert.throws(
    () => prepareGovernedDispatch(candidate, {
      source: 'external-authority-readback',
      verifyIssuedMappingReceiptAuthority: () => true,
      verifyAdmittedActivationAuthority: () => false,
    }),
    /lacks external readback proof/i,
  );
});

test('proves independent activation, dispatch, receipt, memory, and next-intent lineage for all three Saplings', async () => {
  const projections = await Promise.all(WORK_OBJECT_IDS.map(async (workObjectId, index) => {
    const candidate = dispatchInput(workObjectId);
    const dispatch = prepareGovernedDispatch(candidate, authorityVerifierFor(candidate));
    const fencingToken = `fence:${workObjectId}`;
    const foldbackInput = {
      schema: 'thoughtseed.hermes.execution-foldback.v1', tenantId: 'cambium', graphVersion: dispatch.graphVersion,
      goalGraph: {
        nodeId: `goal:${workObjectId}`, taskId: dispatch.taskId, workObjectId,
        workObjectKind: 'sapling', pinnedLoadoutId: dispatch.loadoutId,
      },
      execution: {
        memberId: 'temperance', directiveId: `directive:${workObjectId}`, idempotencyKey: `idempotency:${workObjectId}`,
        executionId: `execution:${workObjectId}`, claimId: `claim:${workObjectId}`, fencingToken, attempt: 1,
        status: 'executed', attestationId: `attestation:${workObjectId}`, inputDigest: dispatch.dispatchAuthorityDigest,
        terminalProofDigest: `sha256:${String(index + 1).repeat(64)}`, recordedAt: `2026-08-09T00:00:0${index}.000Z`,
      },
      activation: {
        activationId: dispatch.admittedActivationAuthority.admittedAuthorityRef,
        activationDigest: dispatch.admittedActivationAuthority.admittedAuthorityDigest,
        mappingReceiptId: dispatch.mappingReceiptAuthority.issuedAuthorityRef,
        mappingReceiptDigest: dispatch.mappingReceiptAuthority.issuedAuthorityDigest,
        issued: true, staleFence: false, workObjectId, taskId: dispatch.taskId,
        pinnedLoadoutId: dispatch.loadoutId, fencingToken,
      },
    } as const;
    const projection = await adaptHermesExecutionFoldback(foldbackInput, {
      source: 'external-admission-readback',
      verifyActivationAuthority(activation) {
        return activation.activationId === dispatch.admittedActivationAuthority.admittedAuthorityRef
          && activation.activationDigest === dispatch.admittedActivationAuthority.admittedAuthorityDigest
          && activation.mappingReceiptId === dispatch.mappingReceiptAuthority.issuedAuthorityRef
          && activation.mappingReceiptDigest === dispatch.mappingReceiptAuthority.issuedAuthorityDigest;
      },
    });
    return { dispatch, projection };
  }));

  assert.equal(new Set(projections.map(({ projection }) => projection.receipt.receiptId)).size, 3);
  for (const [index, { dispatch, projection }] of projections.entries()) {
    const workObjectId = WORK_OBJECT_IDS[index];
    assert.equal(projection.receipt.goalGraph.workObjectId, workObjectId);
    assert.equal(projection.cortex?.workObjectId, workObjectId);
    assert.equal(projection.agentMemory?.workObject.id, workObjectId);
    assert.equal(projection.agentMemory?.lineage.taskId, dispatch.taskId);
    assert.equal(projection.agentMemory?.lineage.pinnedLoadoutId, dispatch.loadoutId);
    assert.equal(projection.nextIntent?.workObjectId, workObjectId);
    assert.equal(projection.nextIntent?.approvalRequired, true);
    assert.equal(projection.nextIntent?.goalGraphAuthority, false);
    for (const r2Key of [projection.receipt.r2Key, projection.cortex?.r2Key, projection.agentMemory?.r2Key]) {
      assert.ok(r2Key?.includes(`/workobjects/${workObjectId}/foldback/`));
    }
    const serialized = JSON.stringify({ dispatch, projection });
    for (const other of WORK_OBJECT_IDS.filter((candidate) => candidate !== workObjectId)) {
      assert.equal(serialized.includes(other), false);
    }
  }
});
