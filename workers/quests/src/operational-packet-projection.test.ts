import test from 'node:test';
import assert from 'node:assert/strict';

import { FITCHECK_GOLDEN_PATH } from '../../../shared/fitcheck-golden-path.ts';
import { IVERIF_GOLDEN_PATH } from '../../../shared/iverif-golden-path.ts';
import {
  OPERATIONAL_PACKET_PROJECTIONS,
  operationalPacketProjectionFor,
} from '../../../shared/operational-packet-registry.ts';
import {
  compileOperationalPacketProjection,
  OPERATIONAL_PACKET_PROJECTION_SCHEMA,
  OperationalPacketProjectionValidationError,
  type OperationalPacketProjectionInput,
} from '../../../shared/operational-packet-projection.ts';

function validInput(): OperationalPacketProjectionInput {
  return {
    schema: 'cambium.test-operational-packet.v1',
    version: 1,
    identity: {
      workId: 'sapling:test-product',
      kind: 'sapling',
      parentTenant: 'cambium',
      name: 'Test Product',
      aliases: [],
      promotionState: 'proof-only',
      autonomyLabel: 'Proof only',
    },
    authority: {
      packet: 'planning evidence',
      runtime: 'D1 Goal Graph',
      proof: 'immutable receipt',
      nextIntent: 'proposal only',
    },
    authorityBoundaries: [
      {
        boundaryId: 'test-planning',
        domain: 'planning',
        authority: 'repository packet',
        approvalRequired: false,
        mutationAllowed: true,
      },
    ],
    runtimeJoin: {
      evidenceStage: 'admitted',
      evidencedLabel: 'D1 admitted',
      heldLabel: 'D1 held',
    },
    mappingAuthority: {
      state: 'missing',
      receiptIssued: false,
      readbackVerified: false,
      issueAuthority: 'separately approved R2 conditional put',
    },
    lifecycleLadder: [
      { stage: 'identified', authority: 'catalog', current: true, surface: 'intake' },
      { stage: 'systems-bound', authority: 'topology', current: true, surface: 'intake' },
      { stage: 'mapping-receipt-verified', authority: 'R2 readback', current: false, surface: 'intake' },
      { stage: 'planned', authority: 'packet', current: true, surface: 'both' },
      { stage: 'd1-eligible', authority: 'receipt plus packet', current: false, surface: 'intake' },
      { stage: 'admitted', authority: 'D1', current: false, surface: 'execution' },
    ],
    repositoryComponents: [
      {
        componentId: 'test-frontend',
        nameWithOwner: 'thoughtseed/test-frontend',
        immutableRepositoryId: 'R_kgDOTest123',
        roles: ['experience', 'frontend'],
        ownerWorkObjectId: 'sapling:test-product',
        planningAuthority: true,
        accessState: 'verified',
      },
      {
        componentId: 'test-backend',
        nameWithOwner: 'thoughtseed/test-backend',
        roles: ['backend'],
        ownerWorkObjectId: 'program:test-backend',
        planningAuthority: false,
        accessState: 'selected',
      },
    ],
    workObjectDependencies: [
      {
        dependencyId: 'test-backend-program',
        workObjectId: 'program:test-backend',
        kind: 'runtime',
        required: true,
        purpose: 'Provides the backend runtime.',
      },
    ],
    infrastructureDependencies: [
      {
        dependencyId: 'test-hosting',
        kind: 'platform',
        name: 'Test Hosting',
        componentIds: ['test-frontend', 'test-backend'],
        accessState: 'verified',
        purpose: 'Hosts the test product.',
      },
    ],
    story: {
      arcTitle: 'Test arc',
      vision: 'Prove the reusable projection.',
      icp: 'A project operator.',
      currentFrontier: 'Projection validation.',
      antiClaims: 'Do not claim runtime admission.',
    },
    feedbackLoop: ['intent', 'receipt', 'learn'],
    loop: {
      loopId: 'test-loop',
      title: 'Test loop',
      cadence: 'manual',
      objective: 'Prove one bounded change.',
      metric: 'One verified change.',
      boundaryColor: 'yellow',
      oneChangeRule: 'Change one thing.',
      stopRule: 'Stop after proof.',
    },
    organs: [{ name: 'Hands', owner: 'operator', state: 'pending', role: 'bounded implementation' }],
    supportRails: [],
    missions: [{
      missionId: 'test-mission',
      title: 'Produce proof',
      type: 'proof',
      owner: 'operator',
      gate: 'Credentials',
      proofRequired: 'terminal receipt',
      dispatchTarget: 'hermes',
      proofIds: ['test-proof'],
    }],
    kpis: [{
      kpiId: 'test-kpi',
      label: 'Verified proof',
      survival: 'one proof exists',
      betterThanSurvival: 'proof produces a next intent',
      currentState: 'pending',
    }],
    gates: [{ gate: 'Credentials', status: 'pending', requiredProof: 'approved access' }],
    proofs: [{
      proofId: 'test-proof',
      sourcePath: 'future receipt',
      validates: 'the mission completed',
      promotes: 'D1 review eligibility',
    }],
    sources: {
      packet: 'docs/test.md',
      catalog: 'cambium.portfolio-catalog.v1',
      runtime: 'cambium.mission-fabric-projection.v1',
      foldback: 'cambium.hermes-execution-foldback.v1',
    },
  };
}

test('compiler exposes versioned intake and execution projections without conflating identity with mapping', () => {
  const projection = compileOperationalPacketProjection(validInput());

  assert.equal(projection.projectionSchema, OPERATIONAL_PACKET_PROJECTION_SCHEMA);
  assert.deepEqual(projection.intakeLadder.map((stage) => stage.stage), [
    'identified',
    'systems-bound',
    'mapping-receipt-verified',
    'planned',
    'd1-eligible',
  ]);
  assert.deepEqual(projection.executionLadder.map((stage) => stage.stage), ['planned', 'admitted']);
  assert.equal(projection.intakeLadder.find((stage) => stage.stage === 'mapping-receipt-verified')?.current, false);
  assert.equal(projection.intakeLadder.find((stage) => stage.stage === 'd1-eligible')?.current, false);
  assert.ok(Object.isFrozen(projection.repositoryComponents));
});

test('Fitcheck projects the selected frontend and HDILINT-owned backend with issued mapping readback', () => {
  assert.equal(FITCHECK_GOLDEN_PATH.schema, 'cambium.fitcheck-golden-path.v1');
  assert.equal(FITCHECK_GOLDEN_PATH.identity.workId, 'sapling:fitcheck');
  assert.deepEqual(FITCHECK_GOLDEN_PATH.repositoryComponents, [
    {
      componentId: 'fitcheck-landing',
      nameWithOwner: 'Sheshiyer/fitcheck-landing',
      immutableRepositoryId: 'R_kgDOSzF56w',
      roles: ['experience', 'frontend'],
      ownerWorkObjectId: 'sapling:fitcheck',
      planningAuthority: true,
      accessState: 'selected',
    },
    {
      componentId: 'hdilint-backend',
      nameWithOwner: 'Sheshiyer/HDILINT-backend-aleph',
      immutableRepositoryId: 'R_kgDOS4jKmg',
      roles: ['backend'],
      ownerWorkObjectId: 'program:hdilint',
      planningAuthority: false,
      accessState: 'verified',
    },
  ]);
  assert.equal(FITCHECK_GOLDEN_PATH.workObjectDependencies[0]?.workObjectId, 'program:hdilint');
  assert.equal(FITCHECK_GOLDEN_PATH.intakeLadder.find((stage) => stage.stage === 'systems-bound')?.current, true);
  assert.equal(FITCHECK_GOLDEN_PATH.intakeLadder.find((stage) => stage.stage === 'mapping-receipt-verified')?.current, true);
  assert.equal(FITCHECK_GOLDEN_PATH.intakeLadder.find((stage) => stage.stage === 'd1-eligible')?.current, true);
  assert.equal(FITCHECK_GOLDEN_PATH.executionLadder.find((stage) => stage.stage === 'mapped')?.current, true);
  assert.equal(FITCHECK_GOLDEN_PATH.executionLadder.find((stage) => stage.stage === 'admitted')?.current, false);
  assert.equal(FITCHECK_GOLDEN_PATH.mappingAuthority.state, 'readback-verified');
  assert.equal(FITCHECK_GOLDEN_PATH.mappingAuthority.preparedReceiptId, 'pmr_9de251ce89564f07f3e4c510');
  assert.equal(FITCHECK_GOLDEN_PATH.mappingAuthority.receiptIssued, true);
  assert.equal(FITCHECK_GOLDEN_PATH.mappingAuthority.readbackVerified, true);
  assert.equal(FITCHECK_GOLDEN_PATH.proofs.some((proof) => proof.proofId === 'fitcheck-mapping-readback'), true);
});

test('IVerif mapping is verified while D1 admission remains held', () => {
  assert.equal(IVERIF_GOLDEN_PATH.identity.workId, 'sapling:iverif');
  assert.equal(IVERIF_GOLDEN_PATH.mappingAuthority.state, 'readback-verified');
  assert.equal(IVERIF_GOLDEN_PATH.mappingAuthority.receiptIssued, true);
  assert.equal(IVERIF_GOLDEN_PATH.mappingAuthority.readbackVerified, true);
  assert.equal(IVERIF_GOLDEN_PATH.executionLadder.find((stage) => stage.stage === 'admitted')?.current, false);
  assert.equal(operationalPacketProjectionFor('sapling:iverif'), IVERIF_GOLDEN_PATH);
  assert.equal(operationalPacketProjectionFor('iverif'), null);
  assert.deepEqual(OPERATIONAL_PACKET_PROJECTIONS.map((projection) => projection.identity.workId), [
    'sapling:fitcheck',
    'sapling:iverif',
  ]);
});

test('validator rejects duplicate repository components and missing planning authority', () => {
  const duplicate = validInput() as any;
  duplicate.repositoryComponents.push({ ...duplicate.repositoryComponents[0] });
  assert.throws(
    () => compileOperationalPacketProjection(duplicate),
    OperationalPacketProjectionValidationError,
  );

  const noAuthority = validInput() as any;
  noAuthority.repositoryComponents = noAuthority.repositoryComponents.map((component: any) => ({
    ...component,
    planningAuthority: false,
  }));
  assert.throws(
    () => compileOperationalPacketProjection(noAuthority),
    /exactly one subject-owned planning authority/,
  );
});

test('validator rejects malformed canonical identity and broken cross-references', () => {
  const invalidIdentity = validInput() as any;
  invalidIdentity.identity.workId = 'Fitcheck';
  assert.throws(
    () => compileOperationalPacketProjection(invalidIdentity),
    /canonical WorkObject ID/,
  );

  const unknownOwner = validInput() as any;
  unknownOwner.repositoryComponents[1].ownerWorkObjectId = 'program:undeclared';
  assert.throws(
    () => compileOperationalPacketProjection(unknownOwner),
    /not the subject or a declared dependency/,
  );

  const unknownComponent = validInput() as any;
  unknownComponent.infrastructureDependencies[0].componentIds = ['missing-component'];
  assert.throws(
    () => compileOperationalPacketProjection(unknownComponent),
    /references unknown component/,
  );

  const unknownGate = validInput() as any;
  unknownGate.missions[0].gate = 'Undeclared gate';
  assert.throws(
    () => compileOperationalPacketProjection(unknownGate),
    /does not reference a declared gate/,
  );

  const prematureD1 = validInput() as any;
  prematureD1.lifecycleLadder.find((stage: any) => stage.stage === 'd1-eligible').current = true;
  assert.throws(
    () => compileOperationalPacketProjection(prematureD1),
    /D1 eligibility requires mapping-receipt readback verification/,
  );

  const mismatchedReadback = validInput() as any;
  mismatchedReadback.mappingAuthority.readbackVerified = true;
  assert.throws(
    () => compileOperationalPacketProjection(mismatchedReadback),
    /readback flag must match/,
  );
});
