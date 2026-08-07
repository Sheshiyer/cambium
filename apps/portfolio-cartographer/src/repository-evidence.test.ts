import assert from 'node:assert/strict'
import test from 'node:test'

import {
  repositoryEvidenceDigest,
  resolveRepositoryEvidence,
  type RelocationRegistryEntry,
  type RepositoryInventoryRecord,
} from './repository-evidence.ts'

const relocationEntries: readonly RelocationRegistryEntry[] = [
  { stableId: 'fitcheck-landing', githubIdentity: 'Sheshiyer/fitcheck-landing' },
  { stableId: 'monthlymealprep', githubIdentity: 'Sheshiyer/rasa' },
  { stableId: 'alpha', githubIdentity: 'Org/shared-name' },
  { stableId: 'beta', githubIdentity: 'Another/shared-name' },
]

test('repository evidence resolves registry aliases, qualified names, and unique exact names deterministically', () => {
  const inventory: readonly RepositoryInventoryRecord[] = [
    { fullName: 'Sheshiyer/fitcheck-landing', repositoryId: 'R_1', nodeId: 'N_1', visibility: 'PRIVATE', defaultBranch: 'main', archived: false },
    { fullName: 'Coproperty/nimbus-gate', repositoryId: 'R_2' },
    { fullName: 'Sheshiyer/rasa', repositoryId: 'R_3' },
  ]
  const records = resolveRepositoryEvidence(
    ['repo:fitcheck-landing', 'repo:Coproperty/nimbus-gate', 'repo:monthlymealprep'],
    relocationEntries,
    inventory,
  )

  assert.deepEqual(records.map((record) => [record.sourceRef, record.status, record.matchMethod, record.fullName]), [
    ['repo:Coproperty/nimbus-gate', 'resolved', 'qualified-name', 'Coproperty/nimbus-gate'],
    ['repo:fitcheck-landing', 'resolved', 'relocation-registry', 'Sheshiyer/fitcheck-landing'],
    ['repo:monthlymealprep', 'resolved', 'relocation-registry', 'Sheshiyer/rasa'],
  ])
  assert.equal(records[1].repositoryId, 'R_1')
  assert.equal(repositoryEvidenceDigest(records), repositoryEvidenceDigest(resolveRepositoryEvidence(
    ['repo:monthlymealprep', 'repo:fitcheck-landing', 'repo:Coproperty/nimbus-gate'],
    relocationEntries,
    inventory,
  )))
})

test('owner/name candidates without immutable GitHub metadata stay unverified', () => {
  const [record] = resolveRepositoryEvidence(
    ['repo:Coproperty/wanderfruit-docs'],
    relocationEntries,
  )
  assert.equal(record.status, 'unverified')
  assert.equal(record.fullName, 'Coproperty/wanderfruit-docs')
  assert.equal(record.repositoryId, null)
  assert.deepEqual(record.gaps, ['immutable-id-unavailable', 'live-metadata-unavailable'])
})

test('repository evidence fails ambiguous, unmatched, malformed, and unsafe refs explicitly', () => {
  const records = resolveRepositoryEvidence(
    ['repo:shared-name', 'repo:missing-repo', 'repo:', 'repo:https://github.com/secret/token'],
    relocationEntries,
  )
  assert.deepEqual(records.map((record) => [record.sourceRef, record.status]), [
    ['repo:', 'malformed'],
    ['repo:https://github.com/secret/token', 'unsafe'],
    ['repo:missing-repo', 'unmatched'],
    ['repo:shared-name', 'ambiguous'],
  ])
  assert.deepEqual(records.find((record) => record.sourceRef === 'repo:shared-name')?.candidates, [
    'Another/shared-name',
    'Org/shared-name',
  ])
})

test('repository evidence rejects duplicate immutable repository ids', () => {
  assert.throws(() => resolveRepositoryEvidence(
    ['repo:fitcheck-landing'],
    relocationEntries,
    [
      { fullName: 'Sheshiyer/fitcheck-landing', repositoryId: 'R_DUP' },
      { fullName: 'Sheshiyer/rasa', repositoryId: 'R_DUP' },
    ],
  ))
})

test('repository evidence separates repository identity from source subpaths', () => {
  const records = resolveRepositoryEvidence(
    ['repo:fitcheck-landing/README.md', 'repo:ashwinsheth-group/marina-one-KA/web'],
    relocationEntries,
  )
  assert.deepEqual(records.map((record) => [record.fullName, record.sourcePath, record.url]), [
    ['ashwinsheth-group/marina-one-KA', 'web', 'https://github.com/ashwinsheth-group/marina-one-KA'],
    ['Sheshiyer/fitcheck-landing', 'README.md', 'https://github.com/Sheshiyer/fitcheck-landing'],
  ])
})
