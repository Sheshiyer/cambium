import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseCompanyProgram,
  PROGRAM_FIXTURE,
} from './program-stories.ts';
import { FABRIC_SOURCE_FIXTURE } from '../../../workers/quests/src/mission-fabric-fixture.ts';

test('parseCompanyProgram rejects unknown keys and missing authority', () => {
  assert.throws(
    () => parseCompanyProgram({ schema: 'company-program-packet.v1', surprise: true }),
    /unknown key|authority/i,
  );
});

test('parseCompanyProgram accepts only bounded, sorted, unique packet values', () => {
  const packet = parseCompanyProgram(PROGRAM_FIXTURE);

  assert.deepEqual(packet, PROGRAM_FIXTURE);
  assert.throws(
    () => parseCompanyProgram({ ...PROGRAM_FIXTURE, missionIds: ['mission-b', 'mission-a'] }),
    /sorted/i,
  );
  assert.throws(
    () => parseCompanyProgram({ ...PROGRAM_FIXTURE, authority: { ...PROGRAM_FIXTURE.authority, graphVersion: 0 } }),
    /positive integer/i,
  );
});

test('company program fixtures are versioned, synthetic, and deterministic', () => {
  assert.equal(PROGRAM_FIXTURE.schema, 'company-program-packet.v1');
  assert.equal(PROGRAM_FIXTURE.authority.kind, 'goal-graph');
  assert.equal(PROGRAM_FIXTURE.lifecycle, 'executing');
  assert.doesNotMatch(JSON.stringify(PROGRAM_FIXTURE), /initData|token|secret/i);
});

test('the frozen source fixture spans every projection adapter', () => {
  assert.deepEqual(FABRIC_SOURCE_FIXTURE.coverage, [
    'sapling', 'program', 'mission', 'task', 'run',
    'receipt', 'agent', 'skill-cluster', 'gap',
  ]);
  assert.equal(FABRIC_SOURCE_FIXTURE.runtimeRuns.some((run) => run.staleFence), true);
  assert.equal(FABRIC_SOURCE_FIXTURE.receipts.some((receipt) => receipt.status === 'missing'), true);
  assert.equal(FABRIC_SOURCE_FIXTURE.gaps.length, 1);
  assert.doesNotMatch(JSON.stringify(FABRIC_SOURCE_FIXTURE), /initData|token|secret/i);
});
