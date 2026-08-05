import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseCompanyProgram,
  PROGRAM_FIXTURE,
} from './program-stories.ts';
import { FABRIC_SOURCE_FIXTURE } from '../../../workers/quests/src/mission-fabric-fixture.ts';

test('parseCompanyProgram rejects unknown keys', () => {
  assert.throws(
    () => parseCompanyProgram({ schema: 'company-program-packet.v1', surprise: true }),
    /unknown key/i,
  );
});

test('parseCompanyProgram rejects missing authority independently', () => {
  const { authority: _authority, ...withoutAuthority } = PROGRAM_FIXTURE;

  assert.throws(() => parseCompanyProgram(withoutAuthority), /missing required key: authority/i);
});

test('parseCompanyProgram rejects inherited packet and authority keys', () => {
  assert.throws(
    () => parseCompanyProgram(Object.create(PROGRAM_FIXTURE)),
    /missing required key/i,
  );
  assert.throws(
    () => parseCompanyProgram({ ...PROGRAM_FIXTURE, authority: Object.create(PROGRAM_FIXTURE.authority) }),
    /missing required key/i,
  );
});

test('parseCompanyProgram accepts bounded, sorted, unique packet values', () => {
  const packet = parseCompanyProgram(PROGRAM_FIXTURE);

  assert.deepEqual(packet, PROGRAM_FIXTURE);
});

test('parseCompanyProgram rejects duplicate and unsorted mission identifiers', () => {
  assert.throws(
    () => parseCompanyProgram({ ...PROGRAM_FIXTURE, missionIds: ['mission-b', 'mission-a'] }),
    /sorted/i,
  );
  assert.throws(
    () => parseCompanyProgram({ ...PROGRAM_FIXTURE, missionIds: ['mission-a', 'mission-a'] }),
    /sorted and unique/i,
  );
});

test('parseCompanyProgram rejects invalid authority values and unknown nested keys', () => {
  assert.throws(
    () => parseCompanyProgram({ ...PROGRAM_FIXTURE, authority: { ...PROGRAM_FIXTURE.authority, graphVersion: 0 } }),
    /positive integer/i,
  );
  assert.throws(
    () => parseCompanyProgram({ ...PROGRAM_FIXTURE, authority: { ...PROGRAM_FIXTURE.authority, surprise: true } }),
    /authority contains unknown key/i,
  );
});

test('parseCompanyProgram rejects maximum-bound and secret-like strings', () => {
  assert.throws(
    () => parseCompanyProgram({ ...PROGRAM_FIXTURE, title: 'x'.repeat(257) }),
    /title must be a non-empty string up to 256 characters/i,
  );
  assert.throws(
    () => parseCompanyProgram({ ...PROGRAM_FIXTURE, outcomeMetric: 'secret value' }),
    /must not contain secret-bearing content/i,
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
  assert.equal(FABRIC_SOURCE_FIXTURE.gaps.some((gap) => gap.kind === 'missing-receipt'), true);
  assert.equal(FABRIC_SOURCE_FIXTURE.gaps.some((gap) => gap.kind === 'capability-gap'), true);
  assert.doesNotMatch(JSON.stringify(FABRIC_SOURCE_FIXTURE), /initData|token|secret/i);
});
