---
phase: 260908-lme-refresh-the-approved-portfolio-census-wi
reviewed: 2026-09-08
depth: standard
base: 746acf814b4ffce1a6ccef295ba1f4b0a09760b6
head: 2f8458fc24f641806a5490b0e13ae75910afea6f
scope: source convergence and dependency gates
files_reviewed: 15
files_reviewed_list:
  - apps/portfolio-cartographer/README.md
  - apps/portfolio-cartographer/package.json
  - apps/portfolio-cartographer/scripts/generate-portfolio-root-map.mjs
  - apps/portfolio-cartographer/scripts/repository-intake.mjs
  - apps/portfolio-cartographer/scripts/repository-intake.test.mjs
  - apps/portfolio-cartographer/src/domain.test.ts
  - apps/portfolio-cartographer/src/domain.ts
  - apps/portfolio-cartographer/src/github-repository-mapping-action-queue.test.ts
  - apps/portfolio-cartographer/src/portfolio-root-map.generated.ts
  - apps/portfolio-cartographer/src/portfolio-root-map.test.ts
  - docs/project-management/github-repository-mapping-action-queue.v1.json
  - docs/project-management/portfolio-roots.v1.json
  - docs/project-management/repository-intake-source.v1.json
  - docs/project-management/repository-intake.v1.json
  - workers/quests/src/portfolio-root-map.generated.ts
findings:
  critical: 3
  warning: 0
  info: 0
  total: 3
status: issues_found
recommendation: prepare-local-draft-content-sanitize-before-publishing-merge-held
---

# Mapping source merge review

## Narrative Findings (AI reviewer)

The source branch has no Git conflict with the pinned main. A public-safe draft can be prepared after sanitizing the affected historical artifacts and choosing a history that excludes the original private paths. It is not ready to merge with green deterministic gates. Source convergence does not grant canonical registry admission.

Scope is the 39-file, 5,489-insertion/147-deletion delta across 18 commits. Fifteen source/data/test/documentation files form the implementation surface; 24 planning and handoff artifacts were included for lineage and bounded path-disclosure scanning. This is a convergence review, not a fresh full behavioral review of every generated row. The already-proven Saanmai bytes were not re-reviewed.

### CR-01 — BLOCKER: proposal changes are still coupled to reviewed execution pins

**Area:** `apps/portfolio-cartographer/src/portfolio-root-map.generated.ts:2`; `scripts/portfolio-foundation-pins.test.mjs:25`; `scripts/portfolio-miniapp-linkage.mjs:316`.

The current root digest is `47fe986558965c313170b5e18368c9f49b72c23161af0c223490c07d69a2b430`; the explicit reviewed execution pin remains `e2abef8080c6ababab7a41e1803fa1eccc08b58a4dbf7876e586df78493bf351`. The focused foundation test fails at line 28. Because root `npm test` includes this test, the core-test release gate cannot pass as submitted.

The read-only linkage audit independently reports exactly these blockers:

- `portfolio-root-map-pin-drift`
- `unknown-root-map-work-id:branch:codigo-olimpo`
- `unknown-root-map-work-id:branch:codigo-olimpo-creator-platform`
- `unknown-root-map-work-id:program:session-atlas`
- `unknown-root-map-work-id:program:thoughtseed-organ-console`

**Origin:** introduced by the complete mapping delta. Main's generated root digest equals the reviewed pin. It was already present before the final Saanmai census slice, so calling it inherited by Saanmai is accurate; calling it inherited from current main is not.

**Fix:** separate current proposal/census verification from the explicitly approved execution foundation. Preserve the existing reviewed pin, birth/closeout contracts, catalog membership, and fail-closed action boundaries. Give held/local mapping identities an explicit proposal-only representation that can be rendered without being treated as admitted catalog work. Test that every unclassified unknown remains blocked and each explicitly held identity remains visible without execution authority. Do not manufacture catalog rows or change approval pins simply to make checks green. If that contract separation is deferred, retain this as an explicit draft blocker.

### CR-02 — BLOCKER: committed publication artifacts contain private machine paths

**Files and lines:**

- `.planning/quick/260907-7pu-publish-reconciled-portfolio-headers/260907-7pu-PLAN.md:44` and line 45.
- `.planning/quick/260907-7pu-publish-reconciled-portfolio-headers/260907-7pu-SUMMARY.md:16` through line 19.
- `.planning/quick/260907-7pu-publish-reconciled-portfolio-headers/header-backups/20260906T235608Z/PUBLICATION-RECEIPT.json:8`, 15, 22, and 29.

These ten lines contain machine-absolute paths in files newly added relative to main. This violates the repository's public-safe artifact boundary. No raw path values are repeated here.

**Origin:** introduced by the mapping branch's older publication commits.

**Fix:** replace published path fields and prose with portable portfolio-relative targets or documented root aliases; preserve original receipts privately and describe any sanitized derivative honestly. A tip-only cleanup does not remove the strings from the 18-commit history. Prepare a clean integration history from the pinned main containing the sanitized final delta, while preserving the original local branch as provenance. Do not push the original history as the public-safe candidate.

### CR-03 — BLOCKER: historical receipt verification recompiles against the new proposal digest

**Area:** `scripts/prepare-portfolio-mapping-receipts.mjs:81`, 134, and 184–189; `docs/project-management/portfolio-mapping-receipts-batch-3.v1.json`.

The safe `--check` invocation fails: the checked-in bundle differs from the deterministic compiler output. The unchanged 39-receipt bundle remains bound to the prior reviewed root digest. The compiler uses the mutable current root source and generated digest, which now necessarily changes the content-derived receipt identities. The intake sidecar intentionally references the existing prepared receipt IDs and hashes.

**Origin:** current failure is confirmed. Rebinding the compiler to the new proposal digest is a consequence of this delta; the complete base compiler was not run in a separate checkout.

**Fix:** verify historical receipts against their exact reviewed input snapshot and preserve their original IDs/content digests. Separate any future preparation against current proposals from verification of that historical bundle. Do not run `--write` over the existing receipt set or imply that source merge issued/superseded receipts. Add a check proving the original 39 receipts remain verifiable while current proposal digests can advance independently.

## Lineage and conflict assessment

`git merge-base origin/main HEAD` equals the pinned main itself. There are 18 commits ahead and no upstream-only commits at these refs. Therefore no merge-tree or conflict-resolution edit is needed: this is a descendant source integration. No ref/worktree mutation was performed.

| Commit group | Intended behavior to retain |
|---|---|
| `d219056`, `1be492a`, `3fb6d9f` | Reconcile shallow census/infrastructure, distinguish Cambium Website display from existing identity, retain exact nested Codigo evidence. |
| `11664b6`, `1b287d0` | Offline observation-only intake, immutable repository evidence, selected receipt-backed identity associations, deterministic projection. |
| `e93fade` | Reviewed Cambium organs and Noesis/partner affiliations, with local identities held pending canonical admission. |
| Publication and handoff commits | Preserve bounded local publication provenance after public-safe sanitization. |
| `3fb58d3` and follow-ups | Previously verified Saanmai held census addition and four-header read-back; retain unchanged. |

## Inherited behavior relevant to reconciliation

**Hosted assets are already stale on main.** `apps/portfolio-cartographer/bundle.html` and `workers/quests/src/portfolio-workbench.generated.ts` are byte-identical to main. Their embedded action root digest is `e258543a3a3219605fc56f2c12f5d9a701505b68c0d73b5eebd634b558894259`, older than both main's reviewed digest and this branch's proposal digest. All three browser action builders use that embedded value; the current validator rejects a different digest at `workers/quests/src/portfolio-admin-actions.ts:475` and 517. Thus this incompatibility is inherited, not introduced by the mapping branch. The checked-in linkage manifest also remains at main's digest. Regenerate these artifacts through their owning writers after settling CR-01, and verify browser/server action-digest agreement. Existing bundle-vs-embed equality alone does not prove agreement with current source.

**The branch fixes an inherited generator failure.** Main's snapshot has 57 Thoughtseed folders, but its `validateSnapshot` hard-codes 58. The mapping generator replaces that inconsistent fixed count with internal count validation. Do not restore the old constant during integration.

**Non-strict audit success is not release readiness.** The audited CLI exits zero while its report is blocked unless strict mode is requested. The app's generation command does not use strict mode. The foundation test failure and blocked audit are proven; a claim that `pnpm build` was executed and failed would be unsupported.

## Minimal reconciliation and required checks

1. Create the sanitized integration candidate from current main; preserve the 15-file mapping implementation, reviewed ownership, observation-only semantics, and relevant portable provenance. No Git conflict repair or catalog admission is needed.
2. Resolve the proposal/execution contract in CR-01 without advancing approval pins. Keep held identities distinct from the reviewed catalog and test that the strict admission boundary remains closed.
3. Make historical receipt verification snapshot-bound as described in CR-03; keep old receipts unchanged.
4. Regenerate the linkage manifest, app bundle, and Worker embed with their owning generators in the implementation checkout. Add a focused invariant comparing the digest sent by the served artifact with the validator's intended action authority.
5. Run portfolio tests and exact generation/intake parity; foundation tests; receipt verification; focused Worker action and hosted-route tests; source-only typecheck/lint; then the repository's required deterministic release checks. Any browser-containing required release checks belong to a separately authorized execution lane, not this review.
6. Recheck the exact PR head/base and public-safe diff/history before publishing or merging. Label remaining approval/registry/production holds explicitly; do not represent local header read-back as registry admission or deployment.

## Executed checks and omitted checks

- Read-only Git ancestry, log, diff, and `git diff --check`: passed; 39-file scope verified.
- `node --test scripts/portfolio-foundation-pins.test.mjs`: two tests, one pass and one fail; birth/closeout contract parity passes, current generated-root pin equality fails.
- Read-only linkage CLI, without output-write flags: blocked with the five listed blockers, all three mirror comparisons true, and no mutations recorded.
- `node scripts/prepare-portfolio-mapping-receipts.mjs --check`: failed with deterministic bundle mismatch; no receipt written.
- Static base/current hosted-artifact and linkage-manifest comparisons, plus bounded machine-path scan of the changed text files: completed.

No full core suite, build/generation, external-root re-publication, browser/native hosted test, service/provider operation, remote query/mutation, PR comment, or agent dispatch was performed. No main-baseline test checkout was created. Parent-supplied portfolio results remain 109 passes and one existing skip; they were not rerun here. Broader CI status is unverified. This report is the reviewer's only output; source and Git state remain unchanged.
