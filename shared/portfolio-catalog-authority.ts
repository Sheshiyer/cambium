// Browser-safe action authority shared by the Workbench and Worker. The
// Worker validator recomputes and verifies this 73-record catalog digest;
// presentation proposals must never advance it by implication.
export const PORTFOLIO_ACTION_CLASSIFICATION_DIGEST = '43630e6e65dfa78cd5c5e486b389308a8dede9d7bda012b400f4976107cdb309' as const;
export const PORTFOLIO_ACTION_CATALOG_VERSION = 2 as const;
export const PORTFOLIO_ACTION_CATALOG_DIGEST = 'sha256:b7393ed6ad4d05ec831fc105e9519c365bde036f7e29f9002b8a8abcff95170c' as const;

// Reviewed action-catalog versions, oldest first; the last entry is the
// current action authority above. Each later version names exactly the
// WorkObjects it admitted, so the Worker validator must reproduce every
// earlier digest by removing those admissions from the current catalog. A
// historical digest keeps receipts issued under it valid for the WorkObjects
// it contained; it never authorizes a later admission, and no caller-supplied
// digest can add a version.
export const PORTFOLIO_REVIEWED_CATALOG_VERSIONS = Object.freeze([
  Object.freeze({
    version: 1,
    catalogDigest: 'sha256:311ead84a1e533f86e34f15a9d783e0350ac327d51d2c51c10d236d107ab96ca',
    admittedWorkIds: Object.freeze([] as string[]),
    approvalEvidence: 'docs/evidence/2026-08-12-reviewed-pins-ledger-push.v1.json',
  }),
  Object.freeze({
    version: PORTFOLIO_ACTION_CATALOG_VERSION,
    catalogDigest: PORTFOLIO_ACTION_CATALOG_DIGEST,
    admittedWorkIds: Object.freeze(['branch:relovo']),
    approvalEvidence: 'docs/evidence/2026-10-22-relovo-portfolio-admission.v1.json',
  }),
]);

// Compatibility exports retain the established action-bound names. New
// consumers must use the explicit ACTION names above or the separate
// portfolio-catalog-display-proposal.ts module.
export const PORTFOLIO_CLASSIFICATION_DIGEST = PORTFOLIO_ACTION_CLASSIFICATION_DIGEST;
export const PORTFOLIO_CATALOG_DIGEST = PORTFOLIO_ACTION_CATALOG_DIGEST;

export const PORTFOLIO_CATALOG_COUNTS = Object.freeze({
  total: 73,
  saplings: 17,
  clientBranches: 41,
  internalPrograms: 15,
  classificationReview: 0,
  historicalProducts: 20,
  operationalGaps: 49,
} as const);
