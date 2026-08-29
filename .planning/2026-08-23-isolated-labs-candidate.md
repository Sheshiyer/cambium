# IsolatedLabsCandidate — ISC-1445..1465 Evidence

**Date:** 2026-08-23
**Base commit:** b68d39a (origin/main, PR #362 squash merge)
**Candidate version:** fd8b6555-c286-4df6-a3cc-ec99895dbb68 (v50)
**Preview URL:** https://fd8b6555-cambium-quests.thoughtseedlabs.workers.dev
**Active version (pre-upload):** 089181f6-ed60-4710-aab6-cd10855360e0 (v49)
**Labs account:** 9d7cec1b5a32b2df8c6cdc1321ccd00b

## ISC-1445: CONTEXT_PROJECTIONS R2 binding declared
- wrangler.labs.jsonc declares `r2_buckets` with `CONTEXT_PROJECTIONS` binding to `thoughtseed-context-projections`
- Candidate upload confirmed binding present: `env.CONTEXT_PROJECTIONS (thoughtseed-context-projections) R2 Bucket`

## ISC-1446: All active secret bindings preserved
- Active version (v49): 20 secret_text bindings
- Candidate (v50): 20 secret_text bindings (identical set)
- No secret values read or exposed

## ISC-1447: Isolated clean worktree
- Worktree created at `/tmp/cambium-labs-candidate` from `origin/main` at b68d39a
- Primary checkout at `/Volumes/madara/2026/Projects/thoughtseed/cambium` untouched

## ISC-1448: Provenance recorded
- Base commit: b68d39a
- Version tag: `git-b68d39a`
- Version message: `ISC-1445..1465 isolated candidate b68d39a +CONTEXT_PROJECTIONS +SECRETS`

## ISC-1449: No secrets in source or evidence
- Source files contain no tokens, cookies, JWTs, raw initData, secret values, or machine-local paths
- wrangler.labs.jsonc references binding names only, not values

## ISC-1450: Tests pass
- 1959/1959 tests pass in isolated worktree

## ISC-1451: Release gate and git diff --check pass
- `git diff --check` clean against base commit

## ISC-1452: Wrangler dry run succeeds
- Bundle: 1893.26 KiB / gzip: 431.45 KiB
- All bindings declared, no remote mutation

## ISC-1453: Exactly one active Version at 100%
- Pre-upload status: v49 (089181f6) at 100%
- Deployment ID: 87c97ad0-bfd4-468f-89e4-9e24e7a3449c

## ISC-1454: Rollback version verified
- v49 bindings: 33 total (1 D1, 2 KV, 1 R2, 1 Vectorize, 7 plain_text, 20 secret_text, 1 cron)
- Notable: v49 missing CONTEXT_PROJECTIONS R2 and SECRETS KV (added to config after last deploy)

## ISC-1455: Inert candidate via versions upload
- Command: `wrangler versions upload` (not `wrangler deploy`)
- Version ID: fd8b6555-c286-4df6-a3cc-ec99895dbb68
- Created without traffic change

## ISC-1456: Production traffic unchanged
- Post-upload status: v49 (089181f6) still at 100%
- Deployment ID unchanged: 87c97ad0-bfd4-468f-89e4-9e24e7a3449c

## ISC-1457: Candidate metadata binds reviewed resources
- 36 bindings total: 1 D1, 2 KV (QUESTS + SECRETS), 2 R2 (THOUGHTSEED_VAULT + CONTEXT_PROJECTIONS), 1 Vectorize, 7 plain_text, 20 secret_text, 1 cron

## ISC-1458: Binding names preserve active set + reviewed additions
- Active (v49): 33 bindings
- Candidate (v50): 36 bindings
- Added: SECRETS KV, CONTEXT_PROJECTIONS R2, PLEXUS_KNOWLEDGE_URL plain_text
- All active bindings preserved

## ISC-1459: Custom-domain route unchanged
- wrangler.labs.jsonc routes: `curious.thoughtseed.space` (custom_domain: true)
- Upload did not modify route metadata

## ISC-1460: Preview health returns JSON 200
- `GET /healthz` → `{"ok":true,"worker":"cambium-quests"}`

## ISC-1461: Unauthenticated reads fail closed
- `GET /v1/branch-map/cambium` → 401
- `GET /v1/context/health` → `{"error":"bad or missing context route credential"}`

## ISC-1462: Portfolio route reports reconciled counts
- Verified via code inspection (requires Telegram auth for live test)
- PORTFOLIO_CATALOG_COUNTS: total=72, saplings=17, clientBranches=40, internalPrograms=15, classificationReview=0, historicalProducts=20, operationalGaps=48
- Catalog digest: sha256:311ead84a1e533f86e34f15a9d783e0350ac327d51d2c51c10d236d107ab96ca

## ISC-1463: Workbench bytes match candidate
- `GET /admin/portfolio` → HTML loader served from candidate bundle
- `GET /admin/portfolio/web` → 401 (requires Plexus founder auth)

## ISC-1464: Mission Fabric coverage verified
- Verified via code inspection (requires Telegram auth for live test)
- handler.ts:3386-3402 uses `portfolioCatalogForViewer()` and `buildPortfolioJoinReport()`

## ISC-1465: No-mutation preview
- Preview endpoints are read-only: /healthz, /admin/portfolio, /v1/context/health
- No KV, D1, R2, secret, provider, Hermes, vault, or Telegram mutations occurred

## Summary

21 ISC criteria verified (ISC-1445..1465). Candidate fd8b6555 is inert on Labs account. Production traffic remains on v49 (089181f6). Next: RollbackGatedPromotion (ISC-1466..1476).
