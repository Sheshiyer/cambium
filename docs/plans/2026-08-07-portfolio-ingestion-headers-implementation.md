# Portfolio Ingestion Headers Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add shallow portfolio-root mapping, type-correct Thoughtseed and Tryambakam-Noesis headers, and governed production-parity proof without moving repositories.

**Architecture:** A committed relative-path snapshot generates a typed browser projection and optional bounded root headers. The existing Workbench remains the only UI artifact; it switches between canonical Thoughtseed WorkObjects and proposal-only Tryambakam-Noesis Projects.

**Tech Stack:** TypeScript, React, Vite, Node test runner, deterministic single-file bundler, Cloudflare Worker generated embed.

---

### Task 1: Freeze the folder-map contract

**Files:**
- Create: `docs/project-management/portfolio-roots.v1.json`
- Create: `apps/portfolio-cartographer/src/portfolio-root-map.test.ts`

1. Write failing tests requiring schema v1, 47 Thoughtseed folders, 30 active Tryambakam-Noesis projects, explicit infrastructure/archive exclusions, relative paths, unique folder names, and bounded proposal kinds.
2. Run `node --experimental-strip-types --test src/portfolio-root-map.test.ts` and confirm failure because the snapshot/module does not exist.
3. Add the minimal JSON snapshot.
4. Re-run the focused test and confirm the contract passes.

### Task 2: Generate typed data and bounded root headers

**Files:**
- Create: `apps/portfolio-cartographer/scripts/generate-portfolio-root-map.mjs`
- Create: `apps/portfolio-cartographer/src/portfolio-root-map.generated.ts`
- Modify: `apps/portfolio-cartographer/package.json`
- Test: `apps/portfolio-cartographer/src/portfolio-root-map.test.ts`

1. Add failing tests for deterministic output, exact observed-folder matching, dry-run default, and a two-file-per-portfolio write ceiling.
2. Run the focused test and confirm the generator API is missing.
3. Implement pure validation/render functions plus a CLI that requires both `--projects-root` and `--write-headers` for external writes.
4. Generate the typed module and re-run focused tests.

### Task 3: Add portfolio headers and Project cards

**Files:**
- Modify: `apps/portfolio-cartographer/src/domain.ts`
- Modify: `apps/portfolio-cartographer/src/domain.test.ts`
- Modify: `apps/portfolio-cartographer/src/App.tsx`
- Modify: `apps/portfolio-cartographer/src/index.css`

1. Add failing tests requiring two portfolio selectors, folder receipts for Thoughtseed client families, visible missing-folder gaps, Tryambakam `Project` labels, and intake-only actions.
2. Run the domain suite and confirm failure on missing UI/domain surfaces.
3. Implement the minimal portfolio-selection projection and Tryambakam intake drawer.
4. Re-run the domain suite and refactor only after green.

### Task 4: Write reversible root headers

**Files:**
- Create outside repository: `<projects-root>/thoughtseed/PORTFOLIO.md`
- Create outside repository: `<projects-root>/thoughtseed/portfolio-map.v1.json`
- Create outside repository: `<projects-root>/tryambakam-noesis/PORTFOLIO.md`
- Create outside repository: `<projects-root>/tryambakam-noesis/portfolio-map.v1.json`

1. Capture the exact depth-one directory names and inode metadata for both roots.
2. Run the generator in dry-run mode and inspect the proposed two-file changes.
3. Run the explicit header write.
4. Re-capture depth-one directories and prove no directory name or inode changed and no nested grouping directory appeared.

### Task 5: Regenerate and verify the hosted admin artifact

**Files:**
- Modify: `apps/portfolio-cartographer/bundle.html`
- Modify: `workers/quests/src/portfolio-workbench.generated.ts`
- Modify: `workers/quests/src/portfolio-workbench-route.test.ts`
- Modify: `apps/portfolio-cartographer/README.md`

1. Preserve Workbench state v4 because the root map is additive and has its own v1 schema; add the root-map artifact marker and smoke assertion.
2. Run `pnpm check` and confirm tests, lint, typed build, bundle, same-origin CSP, hosted-action audit, and artifact smoke pass.
3. Run the focused Worker route tests and confirm exact bundle/embed parity.
4. Run local browser proof for both portfolios at 390, 768, and 1440 pixels and require `scrollWidth === innerWidth`.

**Execution:** superseded by the hosted admin action pass. `pnpm check` passes 46 active tests with one historical fixture skip; the bundle and Worker embed are 352,037 bytes with SHA-256 `a195927aaa9dff17326e52022a1f868a13e375456ff2e2df911124fe460b2348`. The action boundary is detailed in `docs/plans/2026-08-07-portfolio-hosted-admin-actions-design.md`.

### Task 6: Complete governed release handoff

**Files:**
- Modify: `ISA.md`
- Modify: `.planning/ROADMAP-v0.4-continuation.md`
- Modify: `.project/HANDOFF.md`

1. Run the complete deterministic release verification and `git diff --check`.
2. Obtain independent review and close every priority finding.
3. Commit, push, create a pull request, attach it to Project #14, and wait for CI.
4. Record production as held while issue #292 remains open; do not upload or promote a Worker Version without the required owner packet review.
