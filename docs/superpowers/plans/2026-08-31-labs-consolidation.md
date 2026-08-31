# Thoughtseed Labs Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Labs the fail-closed production profile, map every Cambium Cloudflare primitive, and start the governed v0.5 retirement milestone without mutating external state.

**Architecture:** A pure Node resolver validates the checked-in Cloudflare profile contracts before an operator constructs a Wrangler command. A stable JSON resource map and Labs-only runbook expose the connected infrastructure, while GSD and ISA carry the finite migration gates.

**Tech Stack:** Node.js ESM, Node test runner, JSONC Wrangler configuration, Markdown GSD planning, Git worktrees.

**Spec:** `docs/superpowers/specs/2026-08-31-labs-consolidation-design.md`

## Global Constraints

- Dirty `main` is user-owned and must remain unchanged.
- `thoughtseed-labs` is the only production profile.
- `9d9d` is read-only source and rollback evidence.
- No Cloudflare, DNS, R2, D1, KV, Vectorize, Access, tunnel, deployment, or retirement mutation.
- D1 Goal Graph remains the sole operational writer; Hermes remains transport.
- No secret values, session identifiers, prompt bodies, or machine-local checkout paths.

---

### Task 1: Fail-closed Wrangler profile resolver

**Files:**
- Create: `scripts/quests-wrangler-profile.mjs`
- Create: `scripts/quests-wrangler-profile.test.mjs`

**Interfaces:**
- Produces: `parseJsonc(source: string): object`
- Produces: `resolveQuestsWranglerProfile({ profile, operation }): ProfileReceipt`

- [x] **Step 1: Write the failing resolver tests**

  Cover JSONC URLs/comments, complete Labs mapping, legacy read access,
  legacy write/deploy rejection, unknown input, and CLI receipts.

- [x] **Step 2: Run the test and observe the missing-module failure**

  Run: `node --test scripts/quests-wrangler-profile.test.mjs`

  Expected: `ERR_MODULE_NOT_FOUND` for
  `scripts/quests-wrangler-profile.mjs`.

- [x] **Step 3: Implement the resolver**

  Parse JSONC without corrupting URL strings; validate Worker, account, route,
  Access team, D1, KV, R2, and Vectorize bindings; reject legacy
  `write`/`deploy`.

- [x] **Step 4: Verify GREEN**

  Run: `node --test scripts/quests-wrangler-profile.test.mjs`

  Expected: 7 tests pass, 0 fail.

### Task 2: Stable Cloudflare map and Labs production runbook

**Files:**
- Create: `docs/architecture/contracts/cambium-cloudflare-resource-map.v1.json`
- Create: `workers/quests/DEPLOY-LABS.md`
- Modify: `workers/quests/DEPLOY.md`
- Modify: `scripts/release-contract.test.mjs`

**Interfaces:**
- Consumes: `resolveQuestsWranglerProfile`
- Produces: a stable resource map and one Labs-only operator entrypoint

- [x] **Step 1: Write failing release-contract assertions**

  Require `DEPLOY-LABS.md`, the profile resolver preflight, explicit Labs
  config/profile flags, source-read-only language, and no legacy config in
  executable Labs examples.

- [x] **Step 2: Run the focused tests**

  Run: `node --test scripts/release-contract.test.mjs scripts/quests-wrangler-profile.test.mjs`

  Expected: release-contract failure because `DEPLOY-LABS.md` is absent.

- [x] **Step 3: Add the map, runbook, and authority notice**

  Store no counts or secrets in the stable map. Use the resolver before each
  read/write/deploy class and spell both Wrangler selectors explicitly.

- [x] **Step 4: Verify the focused tests**

  Run: `node --test scripts/release-contract.test.mjs scripts/quests-wrangler-profile.test.mjs`

  Expected: all tests pass.

### Task 3: Start milestone v0.5 coherently

**Files:**
- Create: `.planning/v0.5-MILESTONE-CONTEXT.md`
- Create: `.planning/REQUIREMENTS.md`
- Create: `.planning/phases/08-labs-authority-and-profile-safety/08-CONTEXT.md`
- Create: `.planning/phases/08-labs-authority-and-profile-safety/08-01-PLAN.md`
- Modify: `.planning/STATE.md`
- Modify: `.planning/ROADMAP.md`
- Modify: `.planning/PROJECT.md`
- Modify: `.planning/config.json`
- Modify: `.temperance/goal.json`
- Modify: `ISA.md`

**Interfaces:**
- Consumes: the approved design and stable resource map
- Produces: one active Phase 8 with Phases 9–10 held behind explicit gates

- [x] **Step 1: Add Phase 8 acceptance assertions**

  Extend `scripts/infinite-game-anchors.test.mjs` so active ISA/GSD state
  must name v0.5, Labs production authority, legacy read-only posture, and the
  Phase 8 plan.

- [x] **Step 2: Run the focused test and observe stale-v0.4 failures**

  Run:
  `node --test --test-name-pattern='Labs consolidation|ISA lifecycle' scripts/infinite-game-anchors.test.mjs`

- [x] **Step 3: Write the v0.5 planning packet**

  Set Phase 8 active with 0/1 plans complete. Keep external operations held.
  Replace retired `te-dispatch-paid` with `noesis-execute`.

- [x] **Step 4: Verify focused planning contracts**

  Run:
  `node --test --test-name-pattern='Labs consolidation|ISA lifecycle' scripts/infinite-game-anchors.test.mjs`

  Expected: all selected tests pass.

### Task 4: Review branch integration and record the checkpoint

**Files:**
- Modify: `.project/HANDOFF.md`

**Interfaces:**
- Consumes: verified diff and live branch readbacks
- Produces: a bounded handoff that names PR order and external holds

- [x] **Step 1: Re-read branch topology**

  Run: `git worktree list --porcelain`, `git branch -vv`, and
  `gh pr list --state open`.

- [x] **Step 2: Append one checkpoint**

  Record the implementation worktree/branch, write set, RED/GREEN evidence,
  Telegram-first PR order, held admission branch, and all external gates.

- [x] **Step 3: Verify no private or machine-local state entered tracked files**

  Run: `git diff --check` and the named privacy/safety tests.

### Task 5: Full verification and PR preparation

**Files:**
- Verify only

- [x] **Step 1: Run focused contracts**

  Run:
  `node --test scripts/quests-wrangler-profile.test.mjs scripts/release-contract.test.mjs`

- [x] **Step 2: Run repository gates**

  Run: `npm test`, `npm run render-docs:check`,
  `node scripts/generate-temperance-flow.mjs --check`, and
  `git diff --check`.

- [x] **Step 3: Review the diff and source boundaries**

  Run: `git status --short`, `git diff --stat`, and
  `git diff --check`.

- [x] **Step 4: Create reviewable commits**

  Commit the profile/map/runbook slice separately from the GSD/ISA/checkpoint
  slice. Do not push, open a PR, merge, deploy, or mutate Cloudflare unless the
  operator explicitly authorizes that next external step.
