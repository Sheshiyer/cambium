import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { test } from 'node:test'

const repositoryRoot = new URL('../', import.meta.url)

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, repositoryRoot), 'utf8'))
}

test('GIP-008 maps every active packet to one exact owning-repository issue', async () => {
  const receipt = await readJson('docs/evidence/2026-08-15-product-branch-repository-task-migration.v1.json')
  const expectedWorkIds = [
    'program:snow-gloves-os',
    'sapling:dlock',
    'sapling:fitcheck',
    'sapling:iverif',
    'sapling:vantyx',
  ]

  assert.equal(receipt.schema, 'thoughtseed.product-branch-repository-task-migration.v1')
  assert.equal(receipt.wave, 'GIP-008')
  assert.deepEqual(receipt.summary, {
    packetsReviewed: 5,
    duplicateExactTitleMatches: 0,
    owningRepositoryIssuesCreated: 5,
    openIssueReadbacks: 5,
    externalRuntimeMutations: 0,
  })
  assert.equal(receipt.migrations.length, 5)
  assert.deepEqual(receipt.migrations.map(({ canonicalWorkId }) => canonicalWorkId).sort(), expectedWorkIds)
  assert.equal(new Set(receipt.migrations.map(({ repository }) => repository)).size, 5)
  assert.equal(new Set(receipt.migrations.map(({ url }) => url)).size, 5)

  for (const migration of receipt.migrations) {
    assert.equal(migration.state, 'OPEN')
    assert.equal(migration.url, `https://github.com/${migration.repository}/issues/${migration.issueNumber}`)
    assert.match(migration.issueNodeId, /^I_/)
    await access(new URL(migration.packet, repositoryRoot))
    const packet = await readFile(new URL(migration.packet, repositoryRoot), 'utf8')
    assert.match(packet, new RegExp(migration.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(packet, /Cambium retains cross-portfolio sequencing/)
  }
})

test('GIP-008 is complete without widening gated execution authority', async () => {
  const manifest = await readJson('.planning/2026-08-12-cambium-execution-wave.tasks.json')
  const gip008 = manifest.find(({ id }) => id === 'GIP-008')
  const gated = manifest.filter(({ id }) => ['GIP-004', 'GIP-005', 'GIP-006'].includes(id))

  assert.equal(gip008.status, 'completed')
  assert.match(gip008.authorityBoundary, /Issue\/task creation only/)
  assert.deepEqual(gated.map(({ status }) => status), ['runtime-gated', 'runtime-gated', 'content-gated'])
})
