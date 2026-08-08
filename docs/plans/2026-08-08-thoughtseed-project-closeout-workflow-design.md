# Thoughtseed Project Closeout Workflow Design

**Date:** 2026-08-08
**Status:** implemented locally; production held
**Scope:** add a terminal portfolio workflow for work that is completed,
closed, or intentionally terminated, with the same evidence-first discipline as
project birth and repository-first intake.

## Founder decision

The portfolio needs a terminal state named `Completed / Closed` for projects
that no longer require active tracking, downstream flows, or recurring
planning attention.

This state is not a normal planning signal. It is a governed closeout process:

- the founder records why the project is completed, closed, or terminated;
- final handoff Markdown is prepared;
- an immutable closeout receipt is prepared;
- an agent-aware memory projection distinguishes active work from finished
  work;
- an active-to-finished index delta is prepared;
- the R2-synced Vault archive manifest is prepared;
- downstream active flows are stopped or transferred;
- only after the durable receipt exists does the WorkObject leave active
  Workbench views.

## Terminal grammar

`Completed / Closed` is a terminal workflow view. A WorkObject appears there
only when the closeout record is complete and has a durable receipt.

The closeout disposition is one of:

| Disposition | Meaning |
|---|---|
| `completed` | The intended outcome was delivered and can leave active tracking. |
| `closed` | The work is intentionally closed without needing an active flow. |
| `terminated` | The work is intentionally stopped and should not keep active momentum. |

The active index disposition is one of:

| Disposition | Meaning |
|---|---|
| `remove-from-active` | Remove from active workflow memory and emit a finished-index delta. |
| `mark-finished` | Preserve a finished marker while excluding the item from active flow. |

## Authority flow

```text
Founder Workbench closeout tab
  -> thoughtseed.project-closeout.v1 proposal
  -> closed validation and exact catalog/root-map digest check
  -> immutable/idempotent R2 action evidence
  -> bounded project-closeout queue trigger
  -> trusted local executor
  -> final handoff Markdown update
  -> closeout receipt JSON
  -> agent memory projection JSON
  -> finished-index delta JSON
  -> R2 vault object manifest for archive sync
  -> active Workbench hides the item except Completed / Closed
```

R2 remains evidence/archive storage. It is not the workflow authority, not a
filesystem writer, and not the Goal Graph writer. D1 Goal Graph remains the sole
operational writer for later approved operational state changes.

## Workbench interaction

Every focused Thoughtseed WorkObject gets a `Closeout` tab. The tab records:

- final outcome and handoff summary;
- disposition;
- active-index disposition;
- final handoff Markdown path;
- closeout receipt JSON path;
- agent memory JSON path;
- R2 vault closeout prefix;
- optional successor WorkObject;
- six required confirmation checks.

The save button is disabled until every required closeout field and checklist
item is complete. The local preview can draft a closeout, but only the hosted
admin route can submit the action.

After the hosted route returns a receipt, the local Workbench marks the card as
`Completed / Closed`, removes it from active workflow views, and exposes it in
the terminal `Completed / Closed` view.

## Executor and records

The local executor is intentionally narrow. It consumes one recorded
`close-work-object` action and an explicit project root. It validates the exact
reviewed root-map and catalog digests, safe relative document paths, safe R2
prefixes, required confirmations, and the source WorkObject identity before any
write.

When executed, it appends a final closeout section to `.project/HANDOFF.md` and
writes:

- `.project/project-closeout-receipt.v1.json`
- `.project/agent-memory-projection.v1.json`
- `.project/finished-index-delta.v1.json`

The returned R2 manifest names the archive objects expected in the synchronized
Vault copy:

- `final-handoff.md`
- `project-closeout-receipt.v1.json`
- `agent-memory-projection.v1.json`
- `finished-index-delta.v1.json`

The executor does not move repositories, delete files, close GitHub issues,
mutate the canonical portfolio registry, write production state, or deploy.

## Memory and project-index semantics

Closeout creates two machine-readable truths for future agents:

1. the WorkObject is no longer active and should not be selected for active
   planning unless a successor/new project is created;
2. the WorkObject remains available as finished knowledge with disposition,
   final summary, receipt, successor, closeout digest, and R2 archive target.

This solves the “planning scattered through tool files and sessions” problem by
making the terminal state explicit in the project repository and in the
agent-aware memory projection rather than relying on old chat history.

## Production and relocation boundary

This implementation prepares the closeout workflow only. It does not execute a
real closeout against the reviewed standalone projects roots, does not write the
R2-synced Vault copy, and does not deploy production.

Physical folder organization, GitHub issue closure, R2 synchronization, and
production promotion remain separately governed steps.

## Verification

- Domain tests prove terminal closeouts leave active views and appear in
  `Completed / Closed`.
- Worker/action tests prove `close-work-object` uses closed validation,
  immutable R2-before-queue evidence, exact replay, and incomplete-closeout
  rejection.
- Executor tests prove dry-run safety, record creation, stale digest rejection,
  incomplete confirmation rejection, unsafe path rejection, and symlink-root
  rejection.
- Portfolio build/check must regenerate the standalone bundle and Worker embed
  before production promotion.
