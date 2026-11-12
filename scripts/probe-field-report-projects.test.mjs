import assert from 'node:assert/strict';
import { test } from 'node:test';
import { censusFieldReport } from './probe-field-report-projects.mjs';

const catalog = [{ workId: 'sapling:alpha', provenance: ['repo:Example/Alpha/docs/README.md'] },
  { workId: 'program:shared', provenance: ['repo:Example/Shared'] },
  { workId: 'program:other', provenance: ['repo:Example/Shared'] }];
const snapshot = rows => ({ observedAt: '2026-11-03', products: rows, drafts: [] });

test('exact repository provenance produces candidates without name-based or operational joins', () => {
  const input = snapshot([{ id: 'alpha-source', repository: 'https://github.com/example/alpha.git', body: 'private-body' },
    { id: 'same-name', name: 'Alpha' }, { id: 'shared', repository: 'Example/Shared' }]);
  const before = structuredClone(input);
  const result = censusFieldReport(input, catalog);
  assert.deepEqual(input, before);
  assert.equal(result.summary.candidateRows, 2);
  assert.equal(result.summary.unresolvedRows, 1);
  assert.equal(result.summary.ambiguousRows, 1);
  assert.deepEqual(result.candidates[0].candidateWorkIds, ['sapling:alpha']);
  assert.equal(result.operationalAdmission, 'none');
  assert.ok(!JSON.stringify(result).includes('private-body'));
});

test('missing identities, fallback differences and duplicate keys remain explicit holds', () => {
  const result = censusFieldReport(snapshot([{ name: 'No ID', repository: 'Example/Alpha' },
    { id: 'duplicate' }, { id: 'duplicate' }]), catalog);
  assert.equal(result.summary.missingId, 1);
  assert.equal(result.summary.fallbackDisagreements, 1);
  assert.equal(result.summary.duplicateSnapshotKeys, 1);
  assert.equal(result.summary.duplicateOperationKeys, 1);
  assert.equal(result.identityReviewRequired, true);
  assert.deepEqual(result.candidates, []);
});

test('credential, query, fragment and foreign-host URLs never provide repository evidence', () => {
  const refs = ['https://user:secret@github.com/Example/Alpha',
    'https://github.com/Example/Alpha?token=private', 'https://github.com/Example/Alpha#ref',
    'https://foreign.invalid/Example/Alpha', 'Example/../Alpha'];
  const result = censusFieldReport(snapshot(refs.map((repository, i) => ({ id: `row-${i}`, repository }))), catalog);
  assert.equal(result.summary.candidateRows, 0);
  assert.deepEqual(result.candidates, []);
  assert.ok(!JSON.stringify(result).includes('secret'));
});

test('rejects malformed collections and conflicting catalog identities', () => {
  assert.throws(() => censusFieldReport({ ...snapshot([]), boards: {} }, catalog));
  assert.throws(() => censusFieldReport(snapshot([null]), catalog));
  assert.throws(() => censusFieldReport(snapshot([]), [catalog[0], catalog[0]]));
});
