import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileFieldObservation, FIELD_OBSERVATION_SCHEMA, FIELD_REPORT_SITE } from './field-observation.ts';

function fixture(): any {
  return {
    schema: FIELD_OBSERVATION_SCHEMA,
    source: { site: FIELD_REPORT_SITE, repository: 'Sheshiyer/field-report', sourceVersion: 'a'.repeat(40), schemaReference: `https://github.com/Sheshiyer/field-report/blob/${'a'.repeat(40)}/modules/snapshot.js` },
    selectedRecord: { kind: 'idea', id: 'synthetic-idea' },
    observedAt: '2026-10-10T07:34:17.798Z',
    sourceEvidence: { reference: 'https://example.org/synthetic/observation', digest: { type: 'receipt-sha256', value: 'b'.repeat(64) } },
    freshness: { cached: true, stale: true, sourceStatus: 'historical synthetic observation' },
    intendedOutcome: 'Review the synthetic observation before proposing a bounded next intent.',
    evidenceGaps: ['Underlying source not read back'],
  };
}

test('intake preserves cached/stale provenance and remains unadmitted without derived identities', () => {
  const input = fixture(); const before = structuredClone(input);
  const result = compileFieldObservation(input);
  assert.deepEqual(input, before);
  assert.deepEqual(result.observation, input);
  assert.deepEqual(result.sourceIds, ['idea:synthetic-idea']);
  assert.equal(result.admitted, false); assert.equal(result.executionAllowed, false);
  assert.equal(result.authority, 'proposal-only');
  assert.ok(result.holds.includes('underlying-source-sha-unverified'));
  assert.ok(result.holds.includes('deployed-api-compatibility-unverified'));
  assert.ok(result.holds.includes('cached-observation')); assert.ok(result.holds.includes('stale-observation'));
  assert.equal('tenant' in result, false); assert.equal('canonicalWorkObject' in result.observation, false);
  input.evidenceGaps.push('later edit'); assert.equal(result.observation.evidenceGaps.length, 1);
});

test('typed source digest cannot remove source truth or operational holds', () => {
  const input = fixture(); input.sourceEvidence.digest.type = 'source-sha256';
  const result = compileFieldObservation(input);
  assert.ok(!result.holds.includes('underlying-source-sha-unverified'));
  assert.ok(result.holds.includes('source-truth-unverified'));
  assert.equal(result.admitted, false);
});

test('payload fingerprint stays distinct from source SHA and receipt', () => {
  const input = fixture(); input.sourceEvidence.digest.type = 'payload-fingerprint-sha256';
  const result = compileFieldObservation(input);
  assert.equal(result.observation.sourceEvidence.digest?.type, 'payload-fingerprint-sha256');
  assert.ok(result.holds.includes('underlying-source-sha-unverified'));
});

test('explicit WorkObject verification provenance is preserved without granting authority', () => {
  const input = fixture(); input.canonicalWorkObject = { reference: 'sapling:synthetic-project', verificationReference: 'https://example.org/synthetic/identity', verificationDigest: 'c'.repeat(64) };
  const result = compileFieldObservation(input);
  assert.deepEqual(result.observation.canonicalWorkObject, input.canonicalWorkObject);
  assert.ok(result.holds.includes('work-object-verification-requires-authority-readback'));
  assert.equal(result.admitted, false);
});

test('fingerprint binds gaps, timestamp and source version deterministically', () => {
  const input = fixture(); const original = compileFieldObservation(input).fingerprint;
  assert.equal(compileFieldObservation(input).fingerprint, original);
  for (const mutate of [(x: any) => x.evidenceGaps.push('new gap'), (x: any) => x.observedAt = '2026-10-11T07:34:17.798Z', (x: any) => { x.source.sourceVersion = 'd'.repeat(40); x.source.schemaReference = `https://github.com/Sheshiyer/field-report/blob/${x.source.sourceVersion}/modules/snapshot.js`; }]) {
    const changed = fixture(); mutate(changed); assert.notEqual(compileFieldObservation(changed).fingerprint, original);
  }
});

for (const [name, mutate] of Object.entries({
  'missing provenance': (x: any) => delete x.sourceEvidence,
  'missing gaps': (x: any) => delete x.evidenceGaps,
  'wrong site': (x: any) => x.source.site = 'https://example.org',
  'schema version mismatch': (x: any) => x.source.sourceVersion = 'd'.repeat(40),
  'missing version': (x: any) => delete x.source.sourceVersion,
  'invalid timestamp': (x: any) => x.observedAt = '2026-02-30T07:34:17.798Z',
  'ambiguous digest': (x: any) => x.sourceEvidence.digest.type = 'sha256',
  'invalid digest': (x: any) => x.sourceEvidence.digest.value = 'bad',
  'credential URL': (x: any) => x.sourceEvidence.reference = 'https://user:password@example.org/source',
  'query URL': (x: any) => x.sourceEvidence.reference = 'https://example.org/source?token=synthetic',
  'display-name identity': (x: any) => x.canonicalWorkObject = { reference: 'Synthetic Project' },
  'signature as approval': (x: any) => x.signature = 'synthetic-signature',
  'tenant injection': (x: any) => x.tenant = 'synthetic',
  'approval injection': (x: any) => x.sourceEvidence.approved = true,
  'snapshot generated fallback ID': (x: any) => delete x.selectedRecord.id,
  'untyped freshness': (x: any) => x.freshness.cached = 'false',
})) test(`rejects ${name}`, () => { const input = fixture(); mutate(input); assert.throws(() => compileFieldObservation(input), /Invalid field observation/); });
