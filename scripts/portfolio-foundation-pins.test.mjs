import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import {
  PORTFOLIO_FOUNDATION_PINS,
  REVIEWED_ACTION_CATALOG_DIGEST,
  REVIEWED_ACTION_SOURCE_DIGEST,
  REVIEWED_PORTFOLIO_CATALOG_DIGEST,
  REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST,
  REVIEWED_PORTFOLIO_WORK_IDS,
  REVIEWED_ROOT_MAP_DIGEST,
} from './portfolio-foundation-pins.mjs'

const ROOT_DIGEST_PATTERN = /PORTFOLIO_ROOT_MAP_DIGEST = "([0-9a-f]{64})"/
const CLASSIFICATION_DIGEST_PATTERN = /PORTFOLIO_CLASSIFICATION_DIGEST = '([0-9a-f]{64})'/
const CATALOG_DIGEST_PATTERN = /PORTFOLIO_CATALOG_DIGEST = '(sha256:[0-9a-f]{64})'/

async function sourceText(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}

test('shared foundation pins match generated root-map and validated catalog sources', async () => {
  const rootMap = await sourceText('../apps/portfolio-cartographer/src/portfolio-root-map.generated.ts')
  const catalog = await sourceText('../workers/quests/src/portfolio-catalog.ts')

  assert.equal(ROOT_DIGEST_PATTERN.exec(rootMap)?.[1], REVIEWED_ROOT_MAP_DIGEST)
  assert.equal(CLASSIFICATION_DIGEST_PATTERN.exec(catalog)?.[1], REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST)
  assert.equal(CATALOG_DIGEST_PATTERN.exec(catalog)?.[1], REVIEWED_PORTFOLIO_CATALOG_DIGEST)
  assert.equal(REVIEWED_ACTION_SOURCE_DIGEST, REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST)
  assert.equal(REVIEWED_ACTION_CATALOG_DIGEST, REVIEWED_PORTFOLIO_CATALOG_DIGEST)
  assert.notEqual(REVIEWED_ACTION_CATALOG_DIGEST, REVIEWED_ACTION_SOURCE_DIGEST)
  assert.equal(REVIEWED_PORTFOLIO_WORK_IDS.length, 74)
  assert.equal(new Set(REVIEWED_PORTFOLIO_WORK_IDS).size, 74)
  assert.ok(REVIEWED_PORTFOLIO_WORK_IDS.includes('sapling:fitcheck'))
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
