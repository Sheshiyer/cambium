import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const repositoryRoot = new URL('../', import.meta.url)

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, repositoryRoot), 'utf8'))
}

test('issue 290 audit accounts for every residual without inferred admission', async () => {
  const audit = await readJson('docs/evidence/2026-08-15-portfolio-origin-classification-audit.v1.json')
  const expectedSourceRefs = [
    'catalog-folder-hold:sapling:seedforge',
    'catalog-folder-hold:sapling:whatslegal',
    'relocation-registry:brandmint-showcase',
    'repo:Coproperty/nimbus-gate',
    'repo:Coproperty/wanderfruit-docs',
    'repo:SAFVR-SG/Landingpage2.0',
    'repo:Sheshiyer/reddit-cli',
    'repo:ashwinsheth-group/marina-one-KA/web',
    'repo:ashwinsheth-group/panaroma-v2',
    'root-map:branch:symphonics',
  ]

  assert.equal(audit.schema, 'thoughtseed.portfolio-origin-classification-audit.v1')
  assert.equal(audit.githubIssue, '#290')
  assert.equal(audit.rows.length, 10)
  assert.equal(new Set(audit.rows.map(({ sourceRef }) => sourceRef)).size, 10)
  assert.deepEqual(audit.rows.map(({ sourceRef }) => sourceRef).sort(), expectedSourceRefs)
  assert.deepEqual(audit.summary, {
    rowsReviewed: 10,
    resolvedOrReconciled: 2,
    explicitHolds: 8,
    inferredAssignments: 0,
    catalogAdmissions: 0,
    folderMutations: 0,
    privateContentReads: 0,
  })

  for (const row of audit.rows) {
    assert.match(row.disposition, /^(resolved|reconciled|explicit-hold)-/)
    if (row.disposition.startsWith('explicit-hold-')) {
      assert.equal(row.resolvedAssignments.length, 0)
      assert.ok(row.holdReasons.length > 0)
    } else {
      assert.ok(row.resolvedAssignments.length > 0)
      assert.equal(row.holdReasons.length, 0)
    }
  }

  assert.equal(JSON.stringify(audit).includes('/Volumes/'), false)
  assert.equal(JSON.stringify(audit).includes('credential'), false)
})

test('issue 290 resolutions are projected into the governed mapping queue', async () => {
  const audit = await readJson('docs/evidence/2026-08-15-portfolio-origin-classification-audit.v1.json')
  const queue = await readJson('docs/project-management/github-repository-mapping-action-queue.v1.json')
  const batch5 = queue.batches.find(({ batchId }) => batchId === 'github-batch-005-root-map-catalog-repair')
  const batch6 = queue.batches.find(({ batchId }) => batchId === 'github-batch-006-foundation-repository-reconciliation')
  const bySourceRef = new Map(batch6.rows.map((row) => [row.sourceRef, row]))
  const auditBySourceRef = new Map(audit.rows.map((row) => [row.sourceRef, row]))

  assert.equal(batch6.status, 'foundation-reconciled-with-explicit-repository-holds')
  assert.equal(batch6.summary.rowsReviewed, 22)
  assert.equal(batch6.summary.newResolvedAssignments, 10)
  assert.equal(batch6.summary.explicitUnavailableIdentityHolds, 6)
  assert.equal(batch6.summary.unassignedClassificationHolds, 0)

  assert.deepEqual(bySourceRef.get('repo:reddit-cli').resolvedAssignments, [])
  assert.equal(bySourceRef.get('repo:reddit-cli').status, 'explicit-hold-exact-identity-unavailable')
  assert.deepEqual(bySourceRef.get('repo:Sheshiyer/reddit-flux').resolvedAssignments, [
    { workId: 'program:operator-utilities', repositoryRefs: ['Sheshiyer/reddit-flux'] },
  ])
  assert.deepEqual(bySourceRef.get('relocation-registry:brandmint-showcase').resolvedAssignments, [
    { workId: 'program:meristem-brand-system', repositoryRefs: ['Sheshiyer/brandmint-showcase'] },
  ])
  assert.deepEqual(auditBySourceRef.get('root-map:branch:symphonics').resolvedAssignments, [
    { workId: 'branch:symphonics', repositoryRefs: ['Sheshiyer/workforce-automation-app-symphonics'] },
  ])
  assert.equal(
    auditBySourceRef.get('relocation-registry:brandmint-showcase').localEvidence.architectureEvidence,
    'ARCHITECTURE.md:20',
  )

  const symphonics = batch5.rows.find(({ folder }) => folder === 'symphonics')
  assert.equal(symphonics.status, 'resolved-repository-only-planning-surface-shallow-held')
  assert.equal(symphonics.relocationGate.requiresFounderApprovedManifest, true)
})
