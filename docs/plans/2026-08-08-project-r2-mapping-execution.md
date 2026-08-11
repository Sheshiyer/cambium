# Project/R2 Mapping Execution Plan

> **For Codex:** use the executing-plans workflow to execute this plan in reviewed
> batches. Use Temperance parallel dispatch only after the rail preflight in
> Task 3 passes. Do not dispatch workers from this plan draft alone.

**Status:** ready for founder review; no worker dispatch performed
**Owner:** Cambium / Portfolio Workbench
**Scope:** Thoughtseed portfolio mapping from Workbench/root-map evidence into
repository-owned planning and R2 evidence records without changing folder
grammar.

## Goal

Turn the live Workbench and root-map proposal into a safe project/R2 mapping
workflow that can be executed in small batches. Each folder must resolve to a
GitHub repository identity or an explicit gap, each WorkObject must keep the
correct grammar, and R2 must remain evidence/durability unless a separate
owner-approved R2-primary contract replaces the current runbook.

## Non-negotiable boundaries

- Use `$PROJECTS_ROOT/thoughtseed/<folder>` as the shallow folder grammar.
- Do not create `client-branches/`, `saplings/`, `programs/`, or other grouping
  directories.
- Do not move, rename, delete, archive, or nest project folders in this plan.
- Do not write to vault registries, native client stores, provider credentials,
  OmniRoute settings, D1 Goal Graph, or R2 objects unless a task explicitly
  names a reviewed contract and dry-run proof.
- Treat `thoughtseed-labs` as vault/R2 infrastructure context, not a WorkObject
  folder.
- Treat R2 as immutable/idempotent evidence and encrypted durability by default.
  Bidirectional or R2-primary sync requires a separate contract update before
  execution.

## Source inputs

- Live Workbench production bundle and hosted action contracts.
- `docs/project-management/portfolio-root-ingestion-issue.md`.
- `docs/project-management/portfolio-roots.v1.json`.
- `docs/project-management/thoughtseed-project-closeout.v1.json`.
- `docs/plans/2026-08-07-portfolio-repository-first-intake-implementation.md`.
- `docs/plans/2026-08-07-portfolio-hosted-admin-actions-implementation.md`.
- `docs/plans/2026-08-07-thoughtseed-governed-project-birth-implementation.md`.
- `docs/plans/2026-08-08-thoughtseed-project-closeout-workflow-implementation.md`.
- Vault R2 runbook and founder vault sync contract as referenced context only.

## Batch execution

Execute the first three tasks, report evidence, and wait for founder feedback
before continuing.

### Task 1: Prove the active authority set

**Files:** none expected; evidence-only.

1. Verify the active Cambium checkout resolves to GitHub `Sheshiyer/cambium`
   `main`.
2. Verify Workbench production is deployed to the expected Worker version and
   the authenticated UI exposes `Review repository & map`, `New Thoughtseed
   project`, and `Finish / close work`.
3. Verify `$PROJECTS_ROOT/thoughtseed/PORTFOLIO.md` and
   `$PROJECTS_ROOT/thoughtseed/portfolio-map.v1.json` exist and match the
   committed root-map digest.
4. Verify `$PROJECTS_ROOT/thoughtseed/cambium` is not silently treated as the
   authoritative repository unless it is an exact Git checkout.

**Verification:** paste command output showing Git remote/HEAD, Worker version,
Workbench DOM labels, root-map digest, and exact Git top-level probes.

### Task 2: Build the read-only folder inventory

**Files:**

- Create: `docs/evidence/YYYY-MM-DD-project-r2-folder-inventory.json`
- Create: `docs/evidence/YYYY-MM-DD-project-r2-folder-inventory.md`

1. Enumerate only depth-one folders under `$PROJECTS_ROOT/thoughtseed`.
2. For each folder, record whether it has an exact `.git` directory, linked
   worktree `.git` file, nested Git repositories, or no Git identity.
3. Join each folder to `portfolio-roots.v1.json` proposal fields:
   `proposedKind`, `accountId`, `workIds`, and `status`.
4. Mark `thoughtseed-labs` as `infrastructure:r2-vault-context`.
5. Mark unmapped physical folders and missing mapped folders as explicit gaps.

**Verification:** inventory counts must reconcile: physical folders, mapped
folders, infrastructure folders, exact Git repositories, nested repositories,
non-Git folders, unmapped physical gaps, and missing mapped gaps.

### Task 3: Preflight dispatch rails before using workers

**Files:**

- Create: `docs/evidence/YYYY-MM-DD-temperance-dispatch-preflight.md`

1. Check availability for `temperance-batch`, `temperance-claude`,
   `te-dispatch`, `omniroute`, `ollama`, `clinepass`, `codex`, and `gh`.
2. If `temperance-batch` is unavailable, do not claim Temperance batch dispatch.
3. If `clinepass` is unavailable, do not claim ClinePass execution.
4. If `omniroute` is available, run read-only model/route probes only; do not
   alter OmniRoute settings or provider state.
5. If `ollama` is available, record `ollama list` and use it only for bounded
   read-only review unless a later task names an exact model and output gate.
6. For any candidate non-Sol model, require a live nontrivial output proof and
   receipt/gateway attribution before accepting it for batch work.

**Verification:** evidence file names each rail as `available`, `missing`,
`blocked`, or `candidate`, with the exact command output used to decide.

### Task 4: Draft repository-identity mapping proposals

**Files:**

- Create: `docs/project-management/project-r2-mapping-proposals.v1.json`
- Create: `docs/project-management/project-r2-mapping-proposals.md`

1. Use the Task 2 inventory and GitHub remote probes to propose a canonical
   repository identity for each folder.
2. Keep Thoughtseed-originated ventures as Saplings, client-originated work as
   Client Branches, shared company work as Internal Programs, and unknowns as
   Needs Review.
3. For folders with multiple nested repositories, represent each nested
   repository explicitly and do not collapse it into the container.
4. For folders without Git identity, record the exact gap and recommended next
   founder decision.
5. Preserve ambiguous cases such as mixed Sapling/Branch evidence as review
   rows, not automatic rewrites.

**Verification:** every active mapped folder has one proposal row or one explicit
gap row; no row creates a new canonical identity without GitHub evidence.

### Task 5: Draft R2 evidence-prefix plan

**Files:**

- Create: `docs/project-management/project-r2-evidence-prefixes.v1.json`
- Create: `docs/project-management/project-r2-evidence-prefixes.md`

1. Define proposed R2 evidence prefixes for intake, mapping, closeout, and
   finished-index receipts.
2. Keep payloads bounded: receipt JSON, handoff Markdown pointers, agent-aware
   memory projections, and active/finished index deltas.
3. Do not define R2 as live project state, code history, or the primary writer.
4. Identify any desired R2-primary/two-way-sync change as a separate contract
   decision requiring founder approval.

**Verification:** prefix schema has no absolute local paths, no credentials, no
secret names, no raw prompt/response bodies, and no command that writes to R2.

### Task 6: Wire Workbench action follow-ups

**Files:**

- Modify only after approval: Workbench action contract/docs/tests.

1. Convert accepted mapping proposals into one or more closed action payloads
   for the existing hosted action route.
2. Ensure server-side validation checks root-map digest, catalog digest,
   WorkObject identity, repository identity, and R2 evidence prefix.
3. Preserve ordering: immutable R2 evidence first, bounded downstream trigger
   second, no D1 Goal Graph direct write from the Workbench.
4. Keep Founder Gate behavior: explicit local founder commands may execute
   directly only under their existing contract; agent/system intents wait for
   founder approval.

**Verification:** focused tests prove malformed, stale digest, invented
repository, invented WorkObject, unsafe path, and missing R2-prefix payloads
fail before storage or trigger.

### Task 7: Review, commit, and only then dispatch workers

**Files:** `.project/HANDOFF.md`, PR body, GitHub Project item.

1. Summarize completed batches and evidence.
2. Ask founder to approve the next batch or worker dispatch.
3. If dispatch is approved and rail preflight passed, create explicit
   non-conflicting worker tasks from this plan.
4. Use read-only workers for audits and isolated worktrees for any mutation.
5. Validate worker outputs through `SUMMARY.md`, `index.json`, nontrivial
   content, and gateway attribution before integrating anything.

**Verification:** no worker output is accepted without a reviewed evidence file,
and no mutation worker shares a checkout with another writer.

## First-batch stop point

Stop after Tasks 1–3. Report:

- active checkout proof;
- Workbench/live action proof;
- folder inventory counts;
- dispatch rail availability;
- blockers or review questions.

Say: `Ready for feedback.`
