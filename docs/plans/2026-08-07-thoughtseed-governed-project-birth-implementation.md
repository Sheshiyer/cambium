# Thoughtseed Governed Project Birth Implementation

> Execute only from the clean Cambium branch. Do not edit the dirty primary
> checkout, move repositories, mutate the Vault/R2 copy, or deploy production.

**Goal:** make Thoughtseed the only active Workbench portfolio and connect
human/agent project birth to the existing repository-first ingestion system.

## Task 1: Retire the active Tryambakam UI

- Remove the portfolio selector and Tryambakam rendering branch.
- Remove Tryambakam actions from the browser and hosted action contract.
- Preserve the static root snapshot and external headers as historical mapping
  evidence; do not delete or relocate any folder.
- Add source and rendered-artifact tests proving no active Tryambakam marker.

## Task 2: Add the creation-intent contract

- Add one visible `New Thoughtseed project` form to the active Workbench.
- Collect name, safe slug, origin, and conditional client family; display the
  derived kind without an override and never collect a destination path.
- Add `create-thoughtseed-project` to the closed admin action union.
- Require `requestSource`, `slug`, `name`, explicit origin, bounded client
  family, and an optional Founder Gate reference.
- Derive kind and relative destination server-side.
- Return `execution-ready` only for local founder intent or a non-founder
  intent whose referenced approval resolves from the authoritative Thoughtseed
  Gate store and binds the exact normalized intent; otherwise queue
  `founder-gate-pending`.
- Preserve immutable R2-before-queue ordering and replay behavior.

## Task 3: Add the trusted local executor

- Accept one versioned intent file and one explicit projects root.
- Validate without writing in dry-run mode.
- Refuse unknown origin, unapproved non-founder sources, unsafe destinations,
  symlinks, and existing/non-empty targets.
- Pin the exact reviewed root-map and portfolio-catalog digests; valid-shaped
  stale digests fail closed.
- Keep the standalone CLI local-founder-only. Non-founder execution requires a
  trusted host-injected resolver backed by the authoritative Gate store; never
  trust an inline receipt claim.
- Create the project packet, initialize Git, and write project-local ingestion
  and index-proposal receipts.
- Load an explicit workflow registry, write `.project/WORKFLOW.md`, and create
  one safe project-local directory for every selected workflow stage.
- Perform no GitHub, network, Vault, R2, Goal Graph, or deployment action.

## Task 4: Reconcile governance artifacts

- Extend the project ISA with stable project-birth criteria and tombstone the
  superseded active Tryambakam UI criteria.
- Record the decision in the continuation roadmap and project handoff.
- Attach the implementation issue and pull request to GitHub Project #14.
- Keep packet review #292 and promotion #293 as independent gates.

## Task 5: Verify

- Run focused creation-intent, action-store, route, executor, and Workbench tests.
- Run `pnpm check` for Portfolio Cartographer.
- Run the deterministic repository release suite.
- Capture a local browser proof for the Thoughtseed-only UI.
- Run Forge implementation review and independent Cato audit.
- Commit and push only after all material findings are closed.
