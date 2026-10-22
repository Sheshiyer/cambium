import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import {
  PORTFOLIO_FOUNDATION_PINS,
  REVIEWED_ACTION_CATALOG_DIGEST,
  REVIEWED_ACTION_SOURCE_DIGEST,
  REVIEWED_PORTFOLIO_CATALOG_DIGEST,
  REVIEWED_PORTFOLIO_CATALOG_VERSION,
  REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST,
  REVIEWED_PORTFOLIO_WORK_IDS,
  REVIEWED_ROOT_MAP_DIGEST,
} from './portfolio-foundation-pins.mjs'
import {
  PORTFOLIO_ACTION_CATALOG_VERSION,
  PORTFOLIO_CATALOG_DIGEST,
  PORTFOLIO_CLASSIFICATION_DIGEST,
  PORTFOLIO_REVIEWED_CATALOG_VERSIONS,
} from '../shared/portfolio-catalog-authority.ts'
import {
  PORTFOLIO_DISPLAY_CATALOG_DIGEST,
  PORTFOLIO_DISPLAY_PROPOSAL,
  PORTFOLIO_DISPLAY_PROPOSAL_WORK_IDS,
  PORTFOLIO_DISPLAY_SELECTION_DIGEST,
} from '../shared/portfolio-catalog-display-proposal.ts'
import {
  PORTFOLIO_DISPLAY_CATALOG,
  PORTFOLIO_DISPLAY_CATALOG_DIGEST as WORKER_DISPLAY_CATALOG_DIGEST,
  PORTFOLIO_REVIEWED_CATALOGS,
} from '../workers/quests/src/portfolio-catalog.ts'
import { snapshotDigest } from '../apps/portfolio-cartographer/scripts/generate-portfolio-root-map.mjs'

const PROPOSAL_ROOT_DIGEST_PATTERN = /PORTFOLIO_ROOT_MAP_DIGEST = "([0-9a-f]{64})"/
const REVIEWED_ROOT_DIGEST_PATTERN = /REVIEWED_PORTFOLIO_ROOT_MAP_DIGEST = "([0-9a-f]{64})"/

async function sourceText(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}

test('shared foundation pins keep proposal census and approved action roots distinct', async () => {
  const [rootMap, rootSnapshotText] = await Promise.all([
    sourceText('../apps/portfolio-cartographer/src/portfolio-root-map.generated.ts'),
    sourceText('../docs/project-management/portfolio-roots.v1.json'),
  ])
  const rootSnapshot = JSON.parse(rootSnapshotText)

  assert.equal(PROPOSAL_ROOT_DIGEST_PATTERN.exec(rootMap)?.[1], snapshotDigest(rootSnapshot))
  assert.equal(REVIEWED_ROOT_DIGEST_PATTERN.exec(rootMap)?.[1], REVIEWED_ROOT_MAP_DIGEST)
  assert.notEqual(PROPOSAL_ROOT_DIGEST_PATTERN.exec(rootMap)?.[1], REVIEWED_ROOT_MAP_DIGEST)
  assert.equal(PORTFOLIO_CLASSIFICATION_DIGEST, REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST)
  assert.equal(PORTFOLIO_CATALOG_DIGEST, REVIEWED_PORTFOLIO_CATALOG_DIGEST)
  assert.equal(REVIEWED_ACTION_SOURCE_DIGEST, REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST)
  assert.equal(REVIEWED_ACTION_CATALOG_DIGEST, REVIEWED_PORTFOLIO_CATALOG_DIGEST)
  assert.notEqual(REVIEWED_ACTION_CATALOG_DIGEST, REVIEWED_ACTION_SOURCE_DIGEST)
  assert.equal(REVIEWED_PORTFOLIO_CATALOG_VERSION, PORTFOLIO_ACTION_CATALOG_VERSION)
  assert.deepEqual(PORTFOLIO_REVIEWED_CATALOG_VERSIONS.at(-1), {
    version: REVIEWED_PORTFOLIO_CATALOG_VERSION,
    catalogDigest: REVIEWED_PORTFOLIO_CATALOG_DIGEST,
    admittedWorkIds: ['branch:relovo'],
    approvalEvidence: 'docs/evidence/2026-10-22-relovo-portfolio-admission.v1.json',
  })
  assert.deepEqual(PORTFOLIO_REVIEWED_CATALOGS.at(-1)?.workIds, REVIEWED_PORTFOLIO_WORK_IDS)
  for (const { version, catalogDigest, admittedWorkIds, approvalEvidence } of PORTFOLIO_REVIEWED_CATALOG_VERSIONS) {
    const evidenceText = await sourceText(`../${approvalEvidence}`)
    assert.ok(evidenceText.includes(catalogDigest), `${approvalEvidence} must name ${catalogDigest}`)
    if (version === 1) continue
    // Every admission after the baseline needs a recorded Founder Gate approval.
    const evidence = JSON.parse(evidenceText)
    assert.equal(evidence.reviewedCatalogVersions.admitted.version, version)
    assert.equal(evidence.reviewedCatalogVersions.admitted.catalogDigest, catalogDigest)
    assert.deepEqual(evidence.reviewedCatalogVersions.admitted.admittedWorkIds, admittedWorkIds)
    assert.equal(evidence.founderGate.decision, 'approved', `${approvalEvidence} lacks Founder Gate approval`)
  }
  assert.equal(REVIEWED_PORTFOLIO_WORK_IDS.length, 73)
  assert.equal(new Set(REVIEWED_PORTFOLIO_WORK_IDS).size, 73)
  assert.ok(REVIEWED_PORTFOLIO_WORK_IDS.includes('sapling:fitcheck'))
  assert.deepEqual(PORTFOLIO_DISPLAY_PROPOSAL_WORK_IDS, [
    'branch:codigo-olimpo',
    'branch:codigo-olimpo-creator-platform',
    'program:thoughtseed-organ-console',
  ])
  assert.equal(PORTFOLIO_DISPLAY_SELECTION_DIGEST, 'sha256:ce7c129bd24fd173089c069956b9d5cc18f8d829239ce32cbd2a6798252473ca')
  assert.equal(PORTFOLIO_DISPLAY_PROPOSAL.admission, 'render-and-proposal-only')
  assert.equal(PORTFOLIO_DISPLAY_CATALOG_DIGEST, WORKER_DISPLAY_CATALOG_DIGEST)
  assert.equal(PORTFOLIO_DISPLAY_CATALOG.records.length, 76)
  assert.deepEqual(PORTFOLIO_DISPLAY_CATALOG.actionAuthority, {
    schema: 'cambium.portfolio-action-authority.v1',
    classificationDigest: REVIEWED_ACTION_SOURCE_DIGEST,
    catalogDigest: REVIEWED_ACTION_CATALOG_DIGEST,
    admission: 'none',
  })
  for (const workId of PORTFOLIO_DISPLAY_PROPOSAL_WORK_IDS) {
    assert.equal(REVIEWED_PORTFOLIO_WORK_IDS.includes(workId), false, `${workId} is not action-admitted`)
  }
})

test('birth and closeout contracts mirror the shared foundation pins exactly', async () => {
  for (const relativePath of [
    '../docs/project-management/thoughtseed-project-birth.v1.json',
    '../docs/project-management/thoughtseed-project-closeout.v1.json',
  ]) {
    const contract = JSON.parse(await sourceText(relativePath))
    assert.deepEqual(contract.reviewedSnapshots, {
      ...PORTFOLIO_FOUNDATION_PINS,
      pinAuthority: 'scripts/portfolio-foundation-pins.mjs',
      exactMatchRequiredForExecution: true,
    })
  }
})
