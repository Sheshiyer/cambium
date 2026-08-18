import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOAL_GRAPH_PROJECTION_SCHEMA,
  createProjectionEnvelope,
  validateProjectionEnvelope,
  validateAuthoritativeInput,
  isGoalGraphProjection,
  reconcileNodeMapping,
  classifyNodeMapping,
} from './projection-contract.ts';

const digest = `sha256:${'a'.repeat(64)}`;

function envelope() {
  return createProjectionEnvelope({
    origin: 'cortex-foldback',
    graph_version: 'goal-graph@3.2.0',
    graph_digest: digest,
    tenant: 'tenant-alpha',
    source_ref: 'd1:goal-graph:revision:42',
    payload: { nodes: [{ id: 'goal-1', state: 'active' }] },
  });
}

test('projection envelope round-trips and is rejected as fresh authoritative input', () => {
  const original = envelope();
  const roundTrip = JSON.parse(JSON.stringify(original));
  const validated = validateProjectionEnvelope(roundTrip);

  assert.equal(validated.valid, true);
  assert.deepEqual(validated.value, original);
  assert.equal(isGoalGraphProjection(roundTrip), true);

  const authority = validateAuthoritativeInput(roundTrip);
  assert.equal(authority.accepted, false);
  assert.equal(authority.reason, 'goal_graph_projection_is_not_authoritative');
  assert.match(authority.errors[0], /cannot be accepted as fresh authoritative/i);
});

test('envelope validation reports all missing or malformed fields', () => {
  const result = validateProjectionEnvelope({
    schema: GOAL_GRAPH_PROJECTION_SCHEMA,
    origin: '',
    graph_version: 0,
    graph_digest: '',
    tenant: 'tenant-alpha',
    payload: null,
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    'origin must be a non-empty string',
    'graph_version must be a non-empty string or positive integer',
    'graph_digest must be a non-empty string',
    'source_ref must be a non-empty string',
    'payload must be an object',
  ]);
});

test('unrelated authoritative records are not mistaken for projections', () => {
  const record = { kind: 'goal-command', tenant: 'tenant-alpha', command: 'add-node' };
  assert.equal(isGoalGraphProjection(record), false);
  assert.deepEqual(validateAuthoritativeInput(record), { accepted: true, value: record, errors: [] });
});

test('intent projection identities are rejected by the shared authoritative-input guard', () => {
  const fixtures = [
    {
      schema: 'cambium.intent-graph-projection.v1',
      projectionAuthority: 'read_only',
      sourceSetDigest: digest,
      graphDigest: digest,
      nodes: [],
      edges: [],
    },
    { schema: 'cambium.intent-graph-projection.v1', payload: { marker: 'malformed-intent-projection' } },
  ];

  for (const fixture of fixtures) {
    const authority = validateAuthoritativeInput(fixture);
    assert.equal(authority.accepted, false);
    assert.equal(authority.reason, 'intent_graph_projection_is_not_authoritative');
    assert.match(authority.errors[0], /intent graph projection cannot be accepted as fresh authoritative input/i);
  }

  const unrelated = { kind: 'goal-command', tenant: 'tenant-alpha', command: 'add-node' };
  assert.deepEqual(validateAuthoritativeInput(unrelated), { accepted: true, value: unrelated, errors: [] });
});

test('unchanged mappings preserve proof', () => {
  const result = reconcileNodeMapping(['goal-a'], ['goal-a']);
  assert.equal(result.classification, 'unchanged');
  assert.equal(result.proofDisposition, 'preserve');
  assert.equal(result.outcome, 'accepted');
  assert.equal(result.reviewRequired, false);
});

test('replaced mappings require fresh proof', () => {
  const result = reconcileNodeMapping(['goal-a'], ['goal-b']);
  assert.equal(result.classification, 'replaced');
  assert.equal(result.proofDisposition, 'revalidate');
  assert.equal(result.outcome, 'accepted');
  assert.equal(result.reviewRequired, false);
});

test('retired mappings retire proof without creating a successor', () => {
  const result = reconcileNodeMapping(['goal-a'], []);
  assert.equal(result.classification, 'retired');
  assert.equal(result.proofDisposition, 'retire');
  assert.equal(result.outcome, 'accepted');
  assert.equal(result.reviewRequired, false);
});

test('split mappings are explicit review-required outcomes', () => {
  const result = reconcileNodeMapping(['goal-a'], ['goal-b', 'goal-c']);
  assert.equal(result.classification, 'split');
  assert.equal(result.proofDisposition, 'review_required');
  assert.equal(result.outcome, 'review_required');
  assert.equal(result.reviewRequired, true);
  assert.match(result.reason, /ambiguous/i);
});

test('merged mappings are explicit review-required outcomes', () => {
  const result = reconcileNodeMapping(['goal-a', 'goal-b'], ['goal-c']);
  assert.equal(result.classification, 'merged');
  assert.equal(result.proofDisposition, 'review_required');
  assert.equal(result.outcome, 'review_required');
  assert.equal(result.reviewRequired, true);
  assert.match(result.reason, /ambiguous/i);
});

test('unsupported many-to-many mappings stay review-required', () => {
  const result = reconcileNodeMapping(['goal-a', 'goal-b'], ['goal-c', 'goal-d']);
  assert.equal(classifyNodeMapping(['goal-a', 'goal-b'], ['goal-c', 'goal-d']), 'unmapped');
  assert.equal(result.outcome, 'review_required');
  assert.equal(result.proofDisposition, 'review_required');
});
