// Browser-safe action authority shared by the Workbench and Worker. The
// Worker validator recomputes and verifies this 72-record catalog digest;
// presentation proposals must never advance it by implication.
export const PORTFOLIO_ACTION_CLASSIFICATION_DIGEST = '43630e6e65dfa78cd5c5e486b389308a8dede9d7bda012b400f4976107cdb309' as const;
export const PORTFOLIO_ACTION_CATALOG_DIGEST = 'sha256:311ead84a1e533f86e34f15a9d783e0350ac327d51d2c51c10d236d107ab96ca' as const;

// Compatibility exports retain the established action-bound names. New
// consumers must use the explicit ACTION names above or the separate
// portfolio-catalog-display-proposal.ts module.
export const PORTFOLIO_CLASSIFICATION_DIGEST = PORTFOLIO_ACTION_CLASSIFICATION_DIGEST;
export const PORTFOLIO_CATALOG_DIGEST = PORTFOLIO_ACTION_CATALOG_DIGEST;

export const PORTFOLIO_CATALOG_COUNTS = Object.freeze({
  total: 72,
  saplings: 17,
  clientBranches: 40,
  internalPrograms: 15,
  classificationReview: 0,
  historicalProducts: 20,
  operationalGaps: 48,
} as const);
