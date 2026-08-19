# Ralph and Temperance: one bounded iteration

This runbook describes one disposable Ralph iteration. It is not a daemon,
scheduler, queue, checkpoint database, or mutable ledger. Native Codex remains
the orchestrator and babysitter; the repository projection remains read-only.

## Seven-step loop

1. **Reread durable truth.** Read `ISA.md`, `.planning/STATE.md`, the active
   Phase 5 plan, committed evidence summaries, and `.project/HANDOFF.md` afresh.
   Do not reuse process-local state from a previous invocation.
2. **Freeze and project.** Capture one immutable pre-effect snapshot, including
   per-file digests and the expected preimage of every persistence surface.
   Regenerate or check `docs/architecture/temperance-flow.v1.json` and its
   matching Markdown readback from the declared source set.
3. **Inspect action or stop.** Continue only when the projection exposes exactly
   one dependency-ready task and exact GSD command. Authority disagreement,
   blocked dependencies, terminal work, or multiple ready units stop with no
   command. `temperance-next-wave` is proposal-only.
4. **Verify route and approval.** For `te-dispatch-paid`, obtain fresh bounded
   host and owner-approval verification results through the fixed host-owned
   Manifest verifier. They must bind the selected task, exact command, route,
   projection digest, and immutable source-set digest. Route intent never proves
   provider resolution, and raw receipts or caller-selected trust are rejected.
5. **Revalidate and execute once.** Immediately before the irreversible effect,
   reread the complete snapshot and stop on any drift. Then dispatch exactly one
   unit through `te-dispatch-paid`; no second task may be selected or executed.
6. **Verify and persist.** Run the task's declared verification. On success,
   append the same stable iteration and result digests using compare-and-swap in
   strict plan-summary → `.planning/STATE.md` → reviewed-handoff order. Regenerate
   the machine and human flow readbacks only after those durable bytes settle.
7. **Exit.** Exit after one unit whether it completes or stops. The next fresh
   invocation starts again at durable reread and owns no independent state.

## Partial-persistence recovery

Each completed surface records the stable iteration/result digest and its
pre-effect CAS evidence. If interruption occurs after the summary alone or after
the summary plus STATE, the next invocation validates that record and resumes
only the missing persistence steps. It must never repeat external execution or
declared verification. Drift, a conflicting result digest, or a CAS mismatch
stops recovery for independent review.

## Held boundaries

This procedure does not authorize deployment, provider or failover-policy
changes, D1/KV/R2 writes, Telegram mutation, credentials, vault changes, or any
unscoped external effect. The host owns runtime resolution and authenticated
receipts; Cambium stores only route intent and bounded evidence references.
