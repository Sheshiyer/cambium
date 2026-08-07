# Portfolio Repository-First Intake Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace premature Unplanned scheduling with deterministic repository/origin/planning-authority reconciliation while preserving all existing local plans and external safety boundaries.

**Architecture:** Generate a privacy-safe repository-evidence snapshot outside the browser, add pure origin/type/readiness functions and v4 persistence to the Cartographer domain, render a focused Intake tab that gates Plan controls only for unresolved work, then regenerate the exact offline bundle and Worker embed. GitHub issues and a Project carry the durable cross-portfolio follow-up. Filesystem relocation and production deployment stay held.

**Tech stack:** TypeScript, React, Vite, Node test runner, `gh`, deterministic single-file bundler, generated Worker embed.

---

## Task 1: Lock the grammar with failing domain tests

**Files:**

- Modify: `apps/portfolio-cartographer/src/domain.test.ts`
- Modify: `apps/portfolio-cartographer/src/domain.ts`

1. Add failing tests proving the four origin-to-type mappings.
2. Add anti-tests proving `new` cannot derive Sapling and client origin always derives Client Branch.
3. Add readiness tests for repository gaps, unknown origin, missing review checks, missing authority, and canonical mismatch.
4. Add a test proving reusable client-derived IP creates a linked Sapling proposal without changing the client WorkObject.
5. Run `node --test --experimental-strip-types apps/portfolio-cartographer/src/domain.test.ts` and record the expected missing-contract RED failure.
6. Implement the smallest pure types and functions.
7. Re-run the focused test to GREEN.
8. Commit: `test(portfolio): define repository-first intake grammar`.

## Task 2: Generate exact repository evidence

**Files:**

- Create: `apps/portfolio-cartographer/scripts/generate-repository-evidence.mjs`
- Create: `apps/portfolio-cartographer/src/repository-evidence.generated.ts`
- Create: `apps/portfolio-cartographer/src/repository-evidence.test.ts`
- Read: `docs/project-management/relocation-registry/thoughtseed/*/entry.json`

1. Add a failing fixture test for relocation-registry, qualified-name, and unique-name resolution.
2. Add failing tests for unverified owner/name candidates, ambiguous aliases, duplicate immutable IDs, unmatched refs, unsafe fields, and nondeterministic order.
3. Run the focused generator test and record RED.
4. Implement the resolver and privacy-safe projection.
5. Use authenticated `gh` only in the generator input step; do not write credentials or repository contents.
6. Generate the checked-in snapshot and record its count plus digest.
7. Re-run tests and generation determinism to GREEN.
8. Commit: `feat(portfolio): add repository evidence snapshot`.

## Task 3: Migrate durable state to v4

**Files:**

- Modify: `apps/portfolio-cartographer/src/domain.ts`
- Modify: `apps/portfolio-cartographer/src/domain.test.ts`
- Modify: `apps/portfolio-cartographer/src/planning-history.ts`
- Modify: `apps/portfolio-cartographer/src/planning-history.test.ts`

1. Add failing v3-to-v4 migration tests preserving every plan and review field.
2. Add failing v1/v2 compatibility and future-schema rejection tests.
3. Add failing round-trip tests for reconciliation, repository evidence references, planning authority, and notes.
4. Add failing validation tests for arbitrary repository refs, evidence/disposition mismatches, planning-authority identity drift, and `no-repository` bypasses when catalog repository evidence exists.
5. Add failing history-isolation tests for import and reset.
6. Run focused tests and record RED.
7. Implement schema v4 and explicit migrations.
8. Re-run focused tests to GREEN.
9. Commit: `feat(portfolio): persist repository reconciliation state`.

## Task 4: Replace Unplanned quick scheduling with Intake

**Files:**

- Modify: `apps/portfolio-cartographer/src/App.tsx`
- Modify: `apps/portfolio-cartographer/src/App.test.tsx` if present, otherwise extend domain/UI contract tests
- Modify: `apps/portfolio-cartographer/src/styles.css`

1. Add failing UI assertions that Unplanned cards expose `Inspect & reconcile` and no horizon shortcuts.
2. Add failing assertions for Intake/Plan/Delivery tabs, repository evidence, origin controls, derived/canonical type comparison, authority, review checklist, blockers, and readiness.
3. Add failing assertions that Plan is locked only for source-unplanned, not-ready work.
4. Implement the focused Intake surface with accessible labels, 44px targets, and clear grammar guidance.
5. Preserve existing resolved-item Plan/Delivery behavior.
6. Run focused tests and TypeScript checks to GREEN.
7. Commit: `feat(portfolio): gate scheduling behind intake`.

## Task 5: Fix review suggestions and exports

**Files:**

- Modify: `apps/portfolio-cartographer/src/domain.ts`
- Modify: `apps/portfolio-cartographer/src/domain.test.ts`
- Modify: `apps/portfolio-cartographer/src/App.tsx`

1. Add a failing test proving Sapling is never suggested without explicit Thoughtseed-origin evidence.
2. Add failing JSON and Markdown export tests for repository, origin, derived type, authority, review checks, blockers, and mapping proposals.
3. Implement the narrower suggestion rule and layered export.
4. Add UI guidance for linked reusable-IP Sapling proposals.
5. Re-run focused tests to GREEN.
6. Commit: `fix(portfolio): preserve origin grammar in review exports`.

## Task 6: Regenerate and prove the offline artifact

**Files:**

- Modify: `apps/portfolio-cartographer/bundle.html`
- Modify: `workers/quests/src/portfolio-workbench.generated.ts`
- Modify: `workers/quests/src/portfolio-workbench-route.test.ts` only if parity assertions need extension

1. Run `pnpm check` in `apps/portfolio-cartographer`.
2. Regenerate `bundle.html` with the existing project command.
3. Regenerate the Worker embed with the existing repository command.
4. Prove exact byte parity and route security tests.
5. Run the zero-egress/source-writer audit.
6. Run a local browser proof at 390, 768, and 1440 pixels; reconcile one unresolved item, confirm Plan unlock, reload, and confirm persistence.
7. Capture browser evidence without claiming production promotion.
8. Commit: `build(portfolio): regenerate repository-first workbench`.

## Task 7: Save planning continuity and GitHub tracking

**Files:**

- Modify: `.planning/ROADMAP-v0.4-continuation.md`
- Modify: `.project/HANDOFF.md`
- Modify: `ISA.md`
- Add/modify: GitHub Issues and one GitHub Project

1. Add the repository-first phase before physical relocation and R2-backed Vault remapping.
2. Link existing unfinished-board and relocation issues instead of duplicating them.
3. Create bounded issues for UI/state, repository/origin audit, planning-authority migration, packet review, and later deployment.
4. Create a dedicated GitHub Project and add preserved plus new issues.
5. Record issue URLs, Project URL, mapping gaps, clean branch, verification, and non-executed scope in the handoff.
6. Append canonical ISA Decisions, Verification, and Changelog entries.
7. Commit: `docs(portfolio): record repository-first rollout`.

## Task 8: Full verification, review, and handoff

**Files:** all changed files

1. Run focused tests, `pnpm check`, Worker route tests, `npm test`, repository release verification, and `git diff --check` in that order.
2. Run static searches for egress, GitHub credentials, writers, absolute paths, and relocation/deployment mutations.
3. Run independent Cato review and address all critical/high findings and relevant medium findings.
4. Run the post-deliverable Advisor; if unavailable, record the exact failure and rely on the independent review plus direct probes without inferring approval.
5. Run ReReadCheck against the founder's exact grammar and no-relocation boundary.
6. Push `codex/portfolio-repository-first-intake`, open a draft PR, wait for required checks, review the diff, and merge only when clean.
7. Do not upload or promote a Cloudflare Worker Version while the packet remains `draft-held`.
8. Record the merged SHA, outstanding human review gate, and exact next action.

## Rollback

The runtime remains unchanged because production is not promoted. Code rollback is the merge revert. Local browser state v4 remains importable/exportable; prior v3 packets still migrate. GitHub issues and the Project are coordination records and can be closed or archived without changing catalog truth. No filesystem or Vault rollback is necessary because relocation and registry mutation are excluded.
