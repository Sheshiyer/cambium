# Thoughtseed Project Closeout Workflow Implementation

> Execute only from a clean Cambium branch. Do not move repositories, mutate the
> Vault/R2 copy, close live GitHub issues, or deploy production as part of this
> implementation.

**Goal:** add a terminal `Completed / Closed` workflow that records final
handoff, archive, memory, and index-delta evidence before removing a WorkObject
from active portfolio tracking.

## Task 1: Extend portfolio domain grammar

- Add `completed-closed` as a smart view.
- Add a `ProjectCloseout` state record with disposition, required output paths,
  R2 vault prefix, active-index disposition, optional successor, receipt ID,
  and required confirmation booleans.
- Treat a closeout as terminal only when it is complete and receipt-backed.
- Exclude terminal closeouts from active views and include them only in
  `Completed / Closed`.
- Preserve v1/v2/v3/v4 state migrations; older packets load with empty
  closeout state.
- Include completed/closed records in Markdown export and packet round-trip.

## Task 2: Replace passive completion with governed closeout UI

- Add a `Closeout` drawer tab for every Thoughtseed WorkObject.
- Disable closeout submission until final summary, document paths, R2 prefix,
  index disposition, and all six confirmations are complete.
- On successful receipt, mark the WorkObject terminal locally and switch the
  Workbench to `Completed / Closed`.
- Make card/footer language show `Completed / Closed` and `closeout receipt`
  instead of an ordinary planning signal when terminal.
- Keep local preview draft-only; the hosted admin route is the only submitter.

## Task 3: Extend hosted admin action grammar

- Add `close-work-object` to `thoughtseed.portfolio-admin-action.v1`.
- Require `thoughtseed.project-closeout.v1` proposal shape.
- Bind actions to exact shipped portfolio catalog and root-map digests.
- Validate safe repo-local document paths and safe R2 vault prefix.
- Require all closeout confirmations to be literal `true`.
- Write immutable/idempotent R2 action evidence before queueing
  `project-closeout`.
- Preserve Goal Graph isolation.

## Task 4: Add trusted local closeout executor

- Add `npm run project:closeout`.
- Support dry-run planning without project writes.
- In execute mode, append `.project/HANDOFF.md` and write:
  `.project/project-closeout-receipt.v1.json`,
  `.project/agent-memory-projection.v1.json`, and
  `.project/finished-index-delta.v1.json`.
- Return a bounded R2 object manifest for the synchronized Vault archive copy.
- Reject stale digests, incomplete confirmations, unsafe paths, symlink roots,
  and non-Thoughtseed action shapes.
- Perform no GitHub, Vault, R2, registry, Goal Graph, deployment, or deletion
  side effect.

## Task 5: Reconcile docs and roadmap

- Add the machine-readable closeout contract:
  `docs/project-management/thoughtseed-project-closeout.v1.json`.
- Add the design note:
  `docs/plans/2026-08-08-thoughtseed-project-closeout-workflow-design.md`.
- Update the hosted admin action design to include closeout.
- Update `.planning/ROADMAP-v0.4-continuation.md` and `.project/HANDOFF.md`.
- Extend `ISA.md` with stable closeout criteria, decisions, changelog, and
  verification.

## Task 6: Verify

- Run the focused domain/action/executor tests.
- Run the full root test suite or an equivalent release gate.
- Run the Portfolio Cartographer check to regenerate bundle and Worker embed.
- Run `git diff --check`.
- Do not claim production is live until a separate production promotion is
  explicitly authorized and verified.
