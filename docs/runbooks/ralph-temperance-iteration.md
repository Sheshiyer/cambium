# Ralph and Temperance: one bounded iteration

This runbook describes one disposable Ralph iteration. It is not a daemon,
scheduler, queue, checkpoint database, or mutable ledger. Native Codex remains
the orchestrator and babysitter; the repository projection remains read-only.

## Seven-step loop

1. **Reread durable truth.** Read `ISA.md`, `.planning/STATE.md`, the active
   Phase 5 plans, committed evidence summaries, and `.project/HANDOFF.md` afresh.
   Do not reuse process-local state from a previous invocation.
2. **Freeze and project.** Capture one immutable pre-effect snapshot, including
   per-file digests and the expected preimage of every persistence surface.
   Bind the action and idempotency key to an opaque repository identity, the
   reviewed Git commit, and a digest of the canonical checkout root.
   Regenerate or check `docs/architecture/temperance-flow.v1.json` and its
   matching Markdown readback from the declared source set.
3. **Inspect action or stop.** Continue only when the projection exposes exactly
   one dependency-ready remaining-phase unit and exact GSD phase command. The
   unit source-digests every incomplete plan the phase command may execute;
   internal plan tasks are not represented as separately executable units. Authority disagreement,
   blocked dependencies, terminal work, or multiple ready units stop with no
   command. `temperance-next-wave` is proposal-only.
4. **Verify route and approval.** For `te-dispatch-paid`, obtain fresh bounded
   host and owner-approval verification results through the fixed host-owned
   Manifest verifier. They must bind the remaining-phase unit, exact command, route,
   projection digest, and immutable source-set digest. Route intent never proves
   provider resolution, and raw receipts or caller-selected trust are rejected.
5. **Revalidate and execute once.** Immediately before the irreversible effect,
   reread the checkout identity and complete snapshot and stop on any drift. The
   protected executor starts with that checkout as its working directory and
   receives the bound relative-path snapshot so it can repeat the same reread
   before mutation. Then dispatch exactly one
   remaining-phase unit through `te-dispatch-paid`; the fixed phase command may
   execute only the incomplete plans already bound into that unit.
6. **Verify and persist.** Resolve the executor-owned durable receipt by the
   iteration digest before executing. The fixed executor enforces that digest as
   its idempotency key. Resolve declared verification the same way, or run it
   once against the execution receipt. On success,
   append the same stable iteration and result digests using a per-checkpoint
   exclusive lock and versioned compare-and-swap (inode metadata plus digest) in
   strict plan-summary → `.planning/STATE.md` → reviewed-handoff order. Regenerate
   the machine and human flow readbacks only after those durable bytes settle.
7. **Exit.** Exit after the one remaining-phase unit completes or stops. The next fresh
   invocation starts again at durable reread and owns no independent state.

## Partial-persistence recovery

Each completed surface records the stable iteration/result digest and its
pre-effect CAS evidence. Before any repository marker is trusted, the next
invocation repeats fixed host and owner verification, validates the marker's
closed schema and canonical digests, and resolves the executor-owned execution
and verification receipts by the iteration idempotency key. This also recovers
an interruption before the first summary rename: the missing repository writes
resume without repeating either external effect. Drift, an absent or mismatched
host receipt, a conflicting result digest, a duplicate/malformed marker, or a
CAS mismatch stops recovery for independent review.

## Held boundaries

Dry-run and read-only inspection resolve entirely from repository sources and
do not initialize the protected host command boundary. Non-dry execution fails
closed with `host_boundary_unavailable` when that boundary is absent or
unusable. The returned status names Temperance Engine as owner and requires a
`separately_authorized_installation`; Cambium never creates, repairs, or writes
the host manifest or its commands. Installation and live integration testing
are a separate owner-approved host task.

This procedure does not authorize deployment, provider or failover-policy
changes, D1/KV/R2 writes, Telegram mutation, credentials, vault changes, or any
unscoped external effect. The host owns runtime resolution and authenticated
receipts; Cambium stores only route intent and bounded evidence references.
