# GitHub and Planning Reconciliation Execution Plan

> Lifecycle: active execution checkpoint. Execute with the `executing-plans`
> workflow in reviewed batches and keep every mutation in an isolated worktree.

**Baseline:** `origin/main@1aab53d5fda1f886d7f7069e5ff847c193350936`
**Owner:** Cambium roadmap and planning authority
**First-batch stop:** Tasks 1–3, then report `Ready for feedback.`

## Objective

Reconcile all open GitHub issues and current planning authority, remove work
already completed from the execution surface, convert only genuine residuals
into task-shaped work, and correct the first confirmed user-facing defect.

## Authority order

1. Reviewed production receipts and authenticated runtime evidence.
2. Merged `origin/main` source and passing tests.
3. Current contracts, runbooks, root `ISA.md`, and active branch packets.
4. Open GitHub issues and project status.
5. Dated plans as historical context only.

An unchecked box in a dated plan is not a task by itself.

## First batch

### Task 1 — Source reconciliation ledger

Create `.planning/execution/2026-08-12-source-reconciliation.v1.json` and its
Markdown companion. Cover 14/14 open issues and 80/80 Mini App task IDs. Each
row has one state: `implemented`, `residual`, `blocked`, `approval-gated`,
`historical`, or `inbox-triage`. An implemented row must cite a commit, test,
or receipt. This task is read-only with respect to GitHub and runtime systems.

### Task 2 — Residual execution and issue-hygiene proposal

Create `.planning/2026-08-12-cambium-execution-wave.tasks.json` and
`docs/project-management/2026-08-12-github-issue-reconciliation.md` from Task
1. Every residual task must name dependencies, file ownership, acceptance,
verification, and authority limits. Proposed GitHub changes must cite evidence;
do not call GitHub mutation APIs in this task.

### Task 3 — Quest-client HTTP state integrity

Update `workers/quests/src/page/client/data.ts` and focused tests so `200` with
no ledger remains honest-empty, while `401`, `403`, `404`, `5xx`, malformed
JSON, timeout, and network failure are distinct. Authentication material must
never enter the DOM, logs, fixtures, or snapshots. Do not deploy.

## First-batch verification

- JSON files parse and reconcile their declared counts.
- No open issue or Mini App task ID is missing or duplicated.
- Focused quest client/handler tests and the full repository test suite pass.
- `git diff --check` passes.
- Independent review finds no unsupported closure or external mutation.

## Later waves

Later work may update GitHub issues, execute repository-mapping residuals,
publish the company website ledger, or run authenticated Hermes proof. Those
waves begin only from the reviewed first-batch manifest. Provider cleanup,
deployment, Telegram sends, relocation, and owner decisions remain separately
approved actions.
