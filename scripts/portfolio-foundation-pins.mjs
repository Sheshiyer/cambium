import { readFileSync } from 'node:fs'

// Reviewed portfolio foundation pins shared by local execution surfaces.
// scripts/portfolio-foundation-pins.test.mjs compares these explicit approval
// pins with the generated root map and validated catalog, so later source drift
// fails closed until the reviewed pin is intentionally advanced.
export const REVIEWED_ROOT_MAP_DIGEST = '57436877fc82d480eae7eb35adc2bc9149c2a50e22619fb2bb346ee2a2acbe0a'
export const REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST = '43630e6e65dfa78cd5c5e486b389308a8dede9d7bda012b400f4976107cdb309'
export const REVIEWED_PORTFOLIO_CATALOG_DIGEST = 'sha256:1fcdc4dc690447ebd4bd23e228cd1a306440d8c37d65e6e56ea21e692eeacc24'

export const REVIEWED_ACTION_SOURCE_DIGEST = REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST
export const REVIEWED_ACTION_CATALOG_DIGEST = REVIEWED_PORTFOLIO_CATALOG_DIGEST

const catalogDataSource = readFileSync(
  new URL('../workers/quests/src/portfolio-catalog-data.ts', import.meta.url),
  'utf8',
)
const reviewedWorkEntries = [...catalogDataSource.matchAll(
  /^\s+\['((?:sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*)', '([^']+)',/gm,
)].map((match) => [match[1], match[2]])
const reviewedWorkIds = reviewedWorkEntries.map(([workId]) => workId)
if (reviewedWorkEntries.length !== 72 || new Set(reviewedWorkIds).size !== reviewedWorkIds.length) {
  throw new Error('portfolio_foundation_work_ids_invalid')
}
export const REVIEWED_PORTFOLIO_WORK_IDS = Object.freeze([...reviewedWorkIds].sort())
const reviewedPortfolioWorkIdSet = new Set(REVIEWED_PORTFOLIO_WORK_IDS)
const reviewedPortfolioWorkNames = new Map(reviewedWorkEntries)

export function isReviewedPortfolioWorkId(value) {
  return typeof value === 'string' && reviewedPortfolioWorkIdSet.has(value)
}

export function reviewedPortfolioWorkName(workId) {
  return reviewedPortfolioWorkNames.get(workId) ?? null
}

export const PORTFOLIO_FOUNDATION_PINS = Object.freeze({
  rootMapDigest: REVIEWED_ROOT_MAP_DIGEST,
  classificationSourceDigest: REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST,
  portfolioCatalogDigest: REVIEWED_PORTFOLIO_CATALOG_DIGEST,
  actionSourceDigest: REVIEWED_ACTION_SOURCE_DIGEST,
  actionCatalogDigest: REVIEWED_ACTION_CATALOG_DIGEST,
})
