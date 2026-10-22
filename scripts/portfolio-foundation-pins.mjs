import { readFileSync } from 'node:fs'

// Reviewed portfolio foundation pins shared by local execution surfaces.
// scripts/portfolio-foundation-pins.test.mjs compares these explicit approval
// pins with the generated root map and validated catalog, so later source drift
// fails closed until the reviewed pin is intentionally advanced.
export const REVIEWED_ROOT_MAP_DIGEST = 'e2abef8080c6ababab7a41e1803fa1eccc08b58a4dbf7876e586df78493bf351'
export const REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST = '43630e6e65dfa78cd5c5e486b389308a8dede9d7bda012b400f4976107cdb309'
// Version 2 admits branch:relovo. Version 1 (sha256:311ead84...) stays valid
// only for receipts already bound to it; see PORTFOLIO_REVIEWED_CATALOG_VERSIONS
// in shared/portfolio-catalog-authority.ts. New execution binds this version.
export const REVIEWED_PORTFOLIO_CATALOG_VERSION = 2
export const REVIEWED_PORTFOLIO_CATALOG_DIGEST = 'sha256:b7393ed6ad4d05ec831fc105e9519c365bde036f7e29f9002b8a8abcff95170c'

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
if (reviewedWorkEntries.length !== 73 || new Set(reviewedWorkIds).size !== reviewedWorkIds.length) {
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
  portfolioCatalogVersion: REVIEWED_PORTFOLIO_CATALOG_VERSION,
  portfolioCatalogDigest: REVIEWED_PORTFOLIO_CATALOG_DIGEST,
  actionSourceDigest: REVIEWED_ACTION_SOURCE_DIGEST,
  actionCatalogDigest: REVIEWED_ACTION_CATALOG_DIGEST,
})
