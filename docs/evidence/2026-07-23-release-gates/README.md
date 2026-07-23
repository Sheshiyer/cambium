# Release Gates — 2026-07-23

Evidence transcripts for the Cambium release-durability gates, run on `main` prior to
committing the Goal Graph + branch-map D1 receipt authority slice.

| # | Command | Transcript | Expected | Actual | Result |
|---|---------|------------|----------|--------|--------|
| 1 | `npm test` | [full-tests.txt](full-tests.txt) | 1023 pass / 0 fail | 1023 pass / 0 fail | PASS |
| 2 | `node --test workers/quests/src/branch-map-receipt-store.test.ts workers/quests/src/branch-map-sheet.test.ts workers/quests/src/branch-map-route.test.ts workers/quests/src/migration.test.ts` | [d1-slice-tests.txt](d1-slice-tests.txt) | 18 pass | 18 pass / 0 fail | PASS |
| 3 | `npm run validate:product-branches` | [product-branch-packets.txt](product-branch-packets.txt) | 8 packets | 8 packets validated against `cambium.product_branch_packet.v1` | PASS |
| 4 | `npm run standalone:audit` | [standalone-audit.txt](standalone-audit.txt) | 486 files | 491 files checked, 0 violations | PASS (count note below) |
| 5 | `npm run render-docs:check` | [docs-sync.txt](docs-sync.txt) | 6 pages / 91 components | 6 pages / 91 components, in sync | PASS |

## Standalone audit count note

The audit reported 491 publishable files vs the 486 anticipated when the release brief
was written. The delta is fully accounted for and benign:

- **+4** — the gate transcripts in this directory are themselves publishable files
  (`full-tests.txt`, `d1-slice-tests.txt`, `product-branch-packets.txt`, and the
  in-progress `standalone-audit.txt`) and were already on disk when gate 4 ran.
- **+1** — `.planning/ROADMAP-v0.4-continuation.md`, created during final doc
  reconciliation after the brief's counts were captured.

Excluding this evidence directory, the publishable-file count is 487 (= 486 + 1 ROADMAP
file). The audit's actual pass criterion — zero private-path, personal-account, or
live-deployment-pattern violations — held.

## Single verify command

`npm run verify:release` (`scripts/verify-release.mjs`) aggregates the release gates
sequentially. As of this release it includes `validate:product-branches` as the
"product branch packets" gate alongside tests, docs sync, standalone audit/smoke, and
the R3F/Electron packaging gates.
