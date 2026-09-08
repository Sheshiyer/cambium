---
quick: 260908-l18-catalog-finite-promotion
subsystem: Cambium portfolio catalog
tags: [catalog, proposal, action-authority, cartographer]
requires:
  - canonical registry revision 4ab895653a3b5bc575dffb0b2360a70062221697
  - approved 72-record action catalog
provides:
  - frozen 75-record display/proposal catalog
  - explicit 72-record action-authority boundary
affects:
  - portfolio Cartographer presentation
  - founder catalog response
tech-stack:
  added: [TypeScript frozen proposal module]
  patterns: [separate display and action authority]
key-files:
  created: [shared/portfolio-catalog-display-proposal.ts]
  modified: [workers/quests/src/portfolio-catalog.ts, workers/quests/src/handler.ts, apps/portfolio-cartographer/src/domain.ts]
decisions:
  - The committed three-identity proposal is presentation-only and cannot admit actions.
  - Join reports, pair digests, and action validation remain bound to the approved 72-record catalog.
metrics:
  tasks_completed: 4
  source_commit: e58bbc0
  completed: 2026-09-08
---

# Finite catalog promotion: summary

The catalog now renders exactly three committed, source-backed proposal identities alongside the approved 72 records, while retaining the original action authority and all action pins.

## Delivered

- Added `shared/portfolio-catalog-display-proposal.ts`, a frozen three-record inventory with the exact committed selection `ce7c129bd24fd173089c069956b9d5cc18f8d829239ce32cbd2a6798252473ca`, source revision `4ab895653a3b5bc575dffb0b2360a70062221697`, and explicit `render-and-proposal-only` admission.
- Kept the action catalog at 72 records and digest `sha256:311ead84a1e533f86e34f15a9d783e0350ac327d51d2c51c10d236d107ab96ca`; it remains the only authority for joins, pair digests, eligible identities, and action validators.
- Added a separately validated 75-record display catalog, pinned at `sha256:899d3b0443f27c5de923e369157bb3d1e94119780869a18ca0ac65442926356a`. It overlays only the exact three proposal records and preserves every legacy display record byte-for-byte.
- Routed the expanded inventory only into the read-only founder catalog projection. Non-founders receive aggregate counts only. The runtime join report stays action-bound, and display-only action attempts fail closed.
- Updated the Cartographer projection and foundation tests so the three identities retain their source classification, tenant state, account facts, reciprocal linkage, and existing root mappings without broadening action authority.

## Verification

- `node --test apps/portfolio-cartographer/src/domain.test.ts` — 38 passed, 1 existing skip.
- `node --test workers/quests/src/portfolio-catalog.test.ts workers/quests/src/portfolio-admin-actions.test.ts workers/quests/src/portfolio-catalog-route.test.ts` — 33 passed.
- `node --test scripts/portfolio-foundation-pins.test.mjs` — 2 passed.
- `node --experimental-strip-types scripts/audit-portfolio-miniapp-linkage.ts --quiet` — passed.
- `node scripts/prepare-portfolio-mapping-receipts.mjs --check` — passed; 39 receipts verified at `sha256:180688749d4b12f0ae9815d69e2826a7b3d0608215f211f6d7b5fbc21e4dc001`.
- `npm run validate:portfolio-foundation` — passed, including 45 initial branch checks, 110 Cartographer passes with 1 existing skip, and 114 Worker checks.
- `git diff --check` — passed.

## Deferred issues

The broad root `npm test` suite was not completed. Two duplicate attempts stalled in the unrelated `scripts/infinite-game-anchors.test.mjs` and were stopped after the scoped release gate passed. No whole-suite result is claimed; the bounded detail is recorded in `deferred-items.md`.

## Deviations from plan

### Auto-fixed issues

1. [Rule 2 - Generated-source parity] Kept the Cartographer catalog module byte-identical with the Worker catalog module.
   - The existing linkage audit compares those modules structurally, so leaving the display catalog only in the Worker would make the installed presentation contract drift.
   - The shared proposal authority is browser-safe; both consumers use the same immutable display projection while actions remain separately pinned.
   - Verified by the linkage audit and focused catalog tests.

## Boundaries retained

No live Vault, Worker, D1, provider, tenant, approval, deployment, catalog-source, or action-authority mutation occurred. The remaining source delta continues to be named as pending rather than admitted.

## Self-Check: PASSED

- Source commit `e58bbc0` exists and contains the frozen display proposal and bounded consumer changes.
- The quick plan, this summary, and the deferred record exist under the finite-promotion quick directory.
- No tracked file deletion appears in the source commit.
