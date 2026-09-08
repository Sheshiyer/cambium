import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

import {
  PORTFOLIO_MAPPING_BUNDLE_SCHEMA,
  PORTFOLIO_MAPPING_RECEIPT_SCHEMA,
  canonicalMappingReceiptJson,
  preparePortfolioMappingReceipt,
} from '../workers/quests/src/portfolio-mapping-receipts.ts'
import { REVIEWED_ROOT_MAP_DIGEST } from './portfolio-foundation-pins.mjs'
import historicalInput from './fixtures/portfolio-mapping-receipts-batch-3-input.v1.json' with { type: 'json' }

const OUTPUT_PATH = new URL('../docs/project-management/portfolio-mapping-receipts-batch-3.v1.json', import.meta.url)

function fail(message) {
  throw new Error(`Batch 3 mapping receipt preparation failed: ${message}`)
}

function addAssignment(assignments, workObjectId, repositoryNames, originAssertion, repositoryRole) {
  for (const nameWithOwner of repositoryNames) {
    assignments.push({ workObjectId, nameWithOwner, originAssertion, repositoryRole })
  }
}

function collectAssignments(batch) {
  const assignments = []
  for (const row of batch.directSaplingMappings) {
    addAssignment(assignments, row.workId, row.candidateRepos, 'thoughtseed-origin', 'product-source')
  }
  for (const split of batch.resolvedProvenanceSplits) {
    if (split.name === 'Klear Karma') {
      addAssignment(assignments, split.targetWorkId, split.mappedRepos, 'co-founded-venture', 'co-founded-venture-source')
    } else if (split.name === 'Kristudios') {
      addAssignment(assignments, split.targetWorkId, split.mappedRepos, 'client-origin', 'client-branch-source')
    } else if (split.name === 'ParkArea' || split.name === 'Tirak') {
      addAssignment(assignments, split.clientWorkId, split.branchRepos, 'linked-product-client-delivery', 'client-branch-source')
    } else {
      fail(`unexpected provenance split ${split.name}`)
    }
  }
  return assignments.sort((left, right) =>
    left.workObjectId.localeCompare(right.workObjectId) || left.nameWithOwner.localeCompare(right.nameWithOwner),
  )
}

function rootContext(workObjectId, roots) {
  const matches = roots
    .filter((entry) => entry.workIds.includes(workObjectId))
    .sort((left, right) => left.folder.localeCompare(right.folder))
  if (matches.length === 0) {
    return { folder: null, additionalFolders: [], proposedKind: null, accountId: null, workIds: [], status: 'no-shallow-folder' }
  }
  const [primary, ...additional] = matches
  return {
    folder: primary.folder,
    additionalFolders: additional.map((entry) => entry.folder),
    proposedKind: primary.proposedKind,
    accountId: primary.accountId,
    workIds: [...primary.workIds].sort(),
    status: primary.status,
  }
}

function sha256Ref(value) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`
}

function frozenBatch3Input() {
  const { inputDigest, ...input } = historicalInput
  if (input.schema !== 'thoughtseed.portfolio-mapping-receipt-input-snapshot.v1'
    || input.purpose !== 'frozen-historical-batch-3-verification-only') {
    fail('frozen historical input schema is invalid')
  }
  if (inputDigest !== sha256Ref(JSON.stringify(input))) fail('frozen historical input digest drifted')
  const authority = input.authority
  if (!authority || authority.rootMapDigest !== REVIEWED_ROOT_MAP_DIGEST
    || authority.expectedReceiptCount !== 39
    || authority.expectedBundleDigest !== 'sha256:180688749d4b12f0ae9815d69e2826a7b3d0608215f211f6d7b5fbc21e4dc001') {
    fail('frozen historical authority is invalid')
  }
  if (!Array.isArray(input.repositoryInventory) || !Array.isArray(input.portfolioCatalogRecords)
    || !input.repositoryMetadata || !input.queue || !input.rootMap) {
    fail('frozen historical input is incomplete')
  }
  return input
}

export async function buildBatch3MappingReceiptBundle() {
  const input = frozenBatch3Input()
  const { authority, queue, rootMap, repositoryMetadata: metadata, repositoryInventory, portfolioCatalogRecords } = input
  const batch = queue.batches.find((entry) => entry.batchId === authority.batchId)
  if (!batch) fail('reviewed batch is missing')
  if (batch.status !== 'founder-reviewed-provenance-split-ready-for-mapping-receipts') fail('batch is not receipt-ready')
  if (!Array.isArray(batch.founderHolds) || batch.founderHolds.length !== 0) fail('founder holds remain')
  if (queue.currentDigests.rootMapDigest !== authority.rootMapDigest
    || queue.currentDigests.catalogDigest !== authority.catalogDigest
    || queue.currentDigests.classificationDigest !== authority.classificationDigest) {
    fail('frozen queue digest pins do not match frozen authorities')
  }

  const assignments = collectAssignments(batch)
  if (assignments.length !== 39) fail(`expected 39 reviewed repository assignments, found ${assignments.length}`)
  const repositoryNames = assignments.map((entry) => entry.nameWithOwner)
  if (new Set(repositoryNames).size !== repositoryNames.length) fail('a repository is assigned more than once')
  if (repositoryNames.includes('Sheshiyer/snow-gloves-os')) fail('Snow Gloves contamination entered Batch 3')
  if (repositoryNames.includes('pineappleinnovationlabs/chakra-shine-admin')) fail('Tirak false-positive repository entered Batch 3')

  const inventory = new Map(repositoryInventory.map((entry) => [entry.fullName.toLowerCase(), entry]))
  const metadataByName = new Map(metadata.records.map((entry) => [entry.nameWithOwner.toLowerCase(), entry]))
  if (metadataByName.size !== assignments.length) fail('reviewed metadata cardinality does not match the assignment set')
  const catalog = new Map(portfolioCatalogRecords.map((entry) => [entry.workId, entry]))
  const thoughtseed = rootMap.portfolios.find((entry) => entry.portfolioId === 'thoughtseed')
  if (!thoughtseed) fail('Thoughtseed root map is missing')

  const receipts = []
  for (const assignment of assignments) {
    const metadataRecord = metadataByName.get(assignment.nameWithOwner.toLowerCase())
    const inventoryRecord = inventory.get(assignment.nameWithOwner.toLowerCase())
    const catalogRecord = catalog.get(assignment.workObjectId)
    if (!metadataRecord || !inventoryRecord || !catalogRecord) fail(`incomplete evidence for ${assignment.workObjectId} -> ${assignment.nameWithOwner}`)
    if (metadataRecord.repositoryId !== inventoryRecord.repositoryId) fail(`immutable repository ID drift for ${assignment.nameWithOwner}`)
    const workObjectKind = assignment.workObjectId.split(':', 1)[0]
    receipts.push(await preparePortfolioMappingReceipt({
      schema: PORTFOLIO_MAPPING_RECEIPT_SCHEMA,
      portfolioId: 'thoughtseed',
      batchId: authority.batchId,
      founderApprovalId: authority.founderApprovalId,
      decision: 'map-reviewed-repository',
      workObjectId: assignment.workObjectId,
      workObjectKind,
      originAssertion: assignment.originAssertion,
      repositoryRole: assignment.repositoryRole,
      repository: metadataRecord,
      rootMap: rootContext(assignment.workObjectId, thoughtseed.folders),
      lifecycle: catalogRecord.lifecycle ?? catalogRecord.portfolioStatus,
      catalogDigest: authority.catalogDigest,
      classificationDigest: authority.classificationDigest,
      rootMapDigest: authority.rootMapDigest,
      repositoryEvidenceDigest: authority.repositoryEvidenceDigest,
    }))
  }

  const core = {
    schema: PORTFOLIO_MAPPING_BUNDLE_SCHEMA,
    preparedDate: '2026-08-09',
    status: 'prepared-not-issued',
    portfolioId: 'thoughtseed',
    batchId: authority.batchId,
    founderApprovalId: authority.founderApprovalId,
    authority: {
      evidenceRole: 'immutable-idempotent-repository-to-workobject-mapping',
      liveApply: 'separately-approved-r2-conditional-put',
      notAuthorityFor: ['Sapling promotion', 'Goal Graph mutation', 'repository ownership', 'folder movement', 'deployment'],
    },
    digests: {
      rootMapDigest: authority.rootMapDigest,
      classificationDigest: authority.classificationDigest,
      catalogDigest: authority.catalogDigest,
      repositoryEvidenceDigest: authority.repositoryEvidenceDigest,
    },
    summary: {
      receiptCount: receipts.length,
      workObjectCount: new Set(receipts.map((receipt) => receipt.workObjectId)).size,
      repositoryCount: new Set(receipts.map((receipt) => receipt.repository.repositoryId)).size,
      founderHoldCount: batch.founderHolds.length,
      excludedContaminationCount: 1,
      excludedFalsePositiveCount: 1,
    },
    exclusions: [
      { repository: 'Sheshiyer/snow-gloves-os', disposition: 'program:snow-gloves-os', reason: 'Snow Gloves contamination is not Klear Karma product source.' },
      { repository: 'pineappleinnovationlabs/chakra-shine-admin', disposition: 'excluded-false-positive', reason: 'Repository is not part of the Tirak family.' },
    ],
    receipts,
    applyManifest: {
      operation: 'r2-conditional-put-if-absent',
      approvalRequired: true,
      expectedNewObjects: receipts.length,
      orderedKeys: receipts.map((receipt) => receipt.r2Key),
      preconditions: ['re-read all four digests', 'confirm every target key is absent or byte-identical', 'confirm production binding and rollback owner'],
      conflictPolicy: 'abort-entire-apply-before-new-write-on-any-preflight-conflict',
      correctionPolicy: 'immutable receipts are never edited or deleted; append a separately approved superseding receipt',
    },
  }
  const bundle = { ...core, bundleDigest: sha256Ref(canonicalMappingReceiptJson(core)) }
  if (bundle.bundleDigest !== authority.expectedBundleDigest) fail('frozen historical input did not reproduce the reviewed bundle')
  return bundle
}

async function main() {
  const bundle = await buildBatch3MappingReceiptBundle()
  const output = `${JSON.stringify(bundle, null, 2)}\n`
  if (process.argv.includes('--check')) {
    const current = await readFile(OUTPUT_PATH, 'utf8')
    if (current !== output) fail('checked-in bundle differs from deterministic compiler output')
    process.stdout.write(`Batch 3 mapping receipts verified: ${bundle.summary.receiptCount} receipts, ${bundle.bundleDigest}\n`)
    return
  }
  if (process.argv.includes('--write')) {
    fail('historical receipt bundle is frozen; --write is not permitted')
  }
  process.stdout.write(output)
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  await main()
}
