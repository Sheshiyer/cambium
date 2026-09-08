import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { buildBatch3MappingReceiptBundle } from './prepare-portfolio-mapping-receipts.mjs'
import {
  PORTFOLIO_ROOT_MAP_DIGEST,
  REVIEWED_PORTFOLIO_ROOT_MAP_DIGEST,
} from '../workers/quests/src/portfolio-root-map.generated.ts'

test('compiles the complete reviewed Batch 3 mapping receipt set', async () => {
  const bundle = await buildBatch3MappingReceiptBundle()
  assert.equal(bundle.status, 'prepared-not-issued')
  assert.equal(bundle.summary.receiptCount, 39)
  assert.equal(bundle.summary.workObjectCount, 13)
  assert.equal(bundle.summary.repositoryCount, 39)
  assert.equal(bundle.summary.founderHoldCount, 0)
  assert.equal(new Set(bundle.receipts.map((receipt) => receipt.receiptId)).size, 39)
  assert.equal(new Set(bundle.receipts.map((receipt) => receipt.r2Key)).size, 39)
  const fitcheck = bundle.receipts.find((receipt) => receipt.workObjectId === 'sapling:fitcheck')
  assert.equal(fitcheck?.repository.nameWithOwner, 'Sheshiyer/fitcheck-landing')
  assert.equal(fitcheck?.repository.repositoryId, 'R_kgDOSzF56w')
  assert.equal(fitcheck?.rootMap.folder, 'fitcheck-landing')
  assert.match(bundle.bundleDigest, /^sha256:[0-9a-f]{64}$/)
})

test('preserves reviewed provenance splits without cross-contamination', async () => {
  const bundle = await buildBatch3MappingReceiptBundle()
  const names = new Set(bundle.receipts.map((receipt) => receipt.repository.nameWithOwner))
  assert.equal(names.has('Sheshiyer/snow-gloves-os'), false)
  assert.equal(names.has('pineappleinnovationlabs/chakra-shine-admin'), false)
  assert.equal(bundle.receipts.filter((receipt) => receipt.workObjectId === 'branch:klear-karma').length, 8)
  assert.equal(bundle.receipts.filter((receipt) => receipt.workObjectId === 'branch:kristudios').length, 4)
  assert.equal(bundle.receipts.filter((receipt) => receipt.workObjectId === 'branch:parkarea').length, 2)
  assert.equal(bundle.receipts.filter((receipt) => receipt.workObjectId === 'branch:tirak').length, 10)
  assert.equal(bundle.receipts.some((receipt) => receipt.workObjectId === 'sapling:parkarea'), false)
  assert.equal(bundle.receipts.some((receipt) => receipt.workObjectId === 'sapling:tirak'), false)
})

test('binds every receipt to frozen reviewed authorities and complete immutable metadata', async () => {
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

test('frozen historical inputs preserve existing receipt identities while the proposal census advances', async () => {
  const [snapshotText, checkedInText] = await Promise.all([
    readFile(new URL('./fixtures/portfolio-mapping-receipts-batch-3-input.v1.json', import.meta.url), 'utf8'),
    readFile(new URL('../docs/project-management/portfolio-mapping-receipts-batch-3.v1.json', import.meta.url), 'utf8'),
  ])
  const snapshot = JSON.parse(snapshotText)
  const checkedIn = JSON.parse(checkedInText)
  const bundle = await buildBatch3MappingReceiptBundle()

  assert.equal(snapshot.authority.rootMapDigest, REVIEWED_PORTFOLIO_ROOT_MAP_DIGEST)
  assert.notEqual(snapshot.authority.rootMapDigest, PORTFOLIO_ROOT_MAP_DIGEST)
  assert.equal(snapshot.authority.expectedReceiptCount, 39)
  assert.equal(snapshot.authority.expectedBundleDigest, checkedIn.bundleDigest)
  assert.equal(bundle.bundleDigest, checkedIn.bundleDigest)
  assert.deepEqual(bundle.receipts.map((receipt) => [receipt.receiptId, receipt.contentDigest]), checkedIn.receipts.map((receipt) => [receipt.receiptId, receipt.contentDigest]))
})
