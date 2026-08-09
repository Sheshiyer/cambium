import { readFileSync } from 'node:fs'

// Reviewed portfolio foundation pins shared by local execution surfaces.
// scripts/portfolio-foundation-pins.test.mjs compares these explicit approval
// pins with the generated root map and validated catalog, so later source drift
// fails closed until the reviewed pin is intentionally advanced.
export const REVIEWED_ROOT_MAP_DIGEST = 'baec8991188eb7f4f3aed07f55b5ca74441c2fa7386b0b66b5a6358010795962'
export const REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST = '18d5efd69376923be383043894124e7cdda27958a5f47aafe4a6db6342afe542'
export const REVIEWED_PORTFOLIO_CATALOG_DIGEST = 'sha256:448cd80278a7f8e1055c229a8cd4b692f56493f88e579814f30cfe5bbf12354e'

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
if (reviewedWorkEntries.length !== 74 || new Set(reviewedWorkIds).size !== reviewedWorkIds.length) {
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
