import assert from 'node:assert/strict'
import test from 'node:test'

import { buildBatch3MappingReceiptBundle } from './prepare-portfolio-mapping-receipts.mjs'

test('compiles the complete reviewed Batch 3 mapping receipt set', async () => {
  const bundle = await buildBatch3MappingReceiptBundle()
  assert.equal(bundle.status, 'prepared-not-issued')
  assert.equal(bundle.summary.receiptCount, 38)
  assert.equal(bundle.summary.workObjectCount, 12)
  assert.equal(bundle.summary.repositoryCount, 38)
  assert.equal(bundle.summary.founderHoldCount, 0)
  assert.equal(new Set(bundle.receipts.map((receipt) => receipt.receiptId)).size, 38)
  assert.equal(new Set(bundle.receipts.map((receipt) => receipt.r2Key)).size, 38)
  assert.match(bundle.bundleDigest, /^sha256:[0-9a-f]{64}$/)
})

test('preserves reviewed provenance splits without cross-contamination', async () => {
  const bundle = await buildBatch3MappingReceiptBundle()
  const names = new Set(bundle.receipts.map((receipt) => receipt.repository.nameWithOwner))
  assert.equal(names.has('Sheshiyer/snow-gloves-os'), false)
  assert.equal(names.has('pineappleinnovationlabs/chakra-shine-admin'), false)
  assert.equal(bundle.receipts.filter((receipt) => receipt.workObjectId === 'sapling:klear-karma').length, 8)
  assert.equal(bundle.receipts.filter((receipt) => receipt.workObjectId === 'branch:kristudios').length, 4)
  assert.equal(bundle.receipts.filter((receipt) => receipt.workObjectId === 'branch:parkarea').length, 2)
  assert.equal(bundle.receipts.filter((receipt) => receipt.workObjectId === 'branch:tirak').length, 10)
  assert.equal(bundle.receipts.some((receipt) => receipt.workObjectId === 'sapling:parkarea'), false)
  assert.equal(bundle.receipts.some((receipt) => receipt.workObjectId === 'sapling:tirak'), false)
})

test('binds every receipt to current authorities and complete immutable metadata', async () => {
  const bundle = await buildBatch3MappingReceiptBundle()
  for (const receipt of bundle.receipts) {
    assert.equal(receipt.rootMapDigest, bundle.digests.rootMapDigest)
    assert.equal(receipt.classificationDigest, bundle.digests.classificationDigest)
    assert.equal(receipt.catalogDigest, bundle.digests.catalogDigest)
    assert.equal(receipt.repositoryEvidenceDigest, bundle.digests.repositoryEvidenceDigest)
    assert.match(receipt.repository.repositoryId, /^(?:R_|MDEwOlJlcG9zaXRvcnk)/)
    assert.equal(Number.isSafeInteger(receipt.repository.databaseId), true)
    assert.equal(typeof receipt.repository.isFork, 'boolean')
  }
})
