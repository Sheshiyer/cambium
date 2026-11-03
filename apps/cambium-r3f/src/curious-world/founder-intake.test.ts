import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFounderIntake } from './founder-intake.ts';

const draft = { schema: 'cambium.founder.goal-graph-intent.v1', version: 1, tenantId: 'cambium', clientRequestId: 'review-001', goals: [{ externalId: 'first' }] };
test('intake draft preserves exact goal fields for the owning server boundary', () => {
  assert.deepEqual(parseFounderIntake(JSON.stringify(draft)), draft);
});
test('intake draft refuses wrong tenant, empty or oversized batches and unstable request IDs', () => {
  for (const change of [{ tenantId: 'other' }, { goals: [] }, { goals: Array(33).fill({}) }, { clientRequestId: 'two words' }, { schema: 'projection' }]) {
    assert.throws(() => parseFounderIntake(JSON.stringify({ ...draft, ...change })));
  }
});
test('intake draft enforces UTF8 byte bound and readable malformed JSON errors', () => {
  assert.throws(() => parseFounderIntake(JSON.stringify({ ...draft, extra: '界'.repeat(22_000) })), /64 KB/);
  assert.throws(() => parseFounderIntake('{'), /valid JSON/);
});
