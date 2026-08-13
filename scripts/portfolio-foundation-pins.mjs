import { readFileSync } from 'node:fs'

// Reviewed portfolio foundation pins shared by local execution surfaces.
// scripts/portfolio-foundation-pins.test.mjs compares these explicit approval
// pins with the generated root map and validated catalog, so later source drift
// fails closed until the reviewed pin is intentionally advanced.
export const REVIEWED_ROOT_MAP_DIGEST = 'e258543a3a3219605fc56f2c12f5d9a701505b68c0d73b5eebd634b558894259'
export const REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST = '43630e6e65dfa78cd5c5e486b389308a8dede9d7bda012b400f4976107cdb309'
export const REVIEWED_PORTFOLIO_CATALOG_DIGEST = 'sha256:311ead84a1e533f86e34f15a9d783e0350ac327d51d2c51c10d236d107ab96ca'

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
