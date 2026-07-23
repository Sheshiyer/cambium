# Goal Graph Operating Model

Status: contract for the D1 Goal Graph, bounded Telegram intake, and projection/reconciliation fallback.

## Current implementation slice

The first slice is intentionally pure and reviewable: `goal-graph/types.ts`,
`identity.ts`, and `compiler.ts` define deterministic node identity, singleton
roots, stale-head detection, no-op replay, change-set digests, and migration
classification. `projection-contract.ts` defines the versioned read envelope
and authority rejection boundary. The next slice adds an approval-bound,
transactional D1 CAS store (`goal-graph-store.ts`) and a total, bounded,
canonical Telegram intent parser (`goal-graph-intake.ts`). The migration now
includes immutable approval witnesses. These contracts are still not wired to
Worker routes, Telegram delivery, or the BranchStoryArc renderer; that edge
integration is deliberately deferred until route and receipt tests exist.

## Authority and boundaries

The D1 Goal Graph is the sole operational writer. It owns tenant-scoped node
identity, graph revisions, graph digests, approvals, commits, execution leases,
and terminal receipts. A provider, Telegram handler, Cortex, visual surface, or
offline fallback may observe or propose work; none may write graph truth.

```text
source observation / approved intent
          -> D1 Goal Graph (the only writer)
             -> versioned receipt-backed projection envelope
                -> Telegram / UI / Cortex read lanes
```

Every projection carries `origin`, `graph_version`, `graph_digest`, `tenant`,
`source_ref`, and a bounded `payload` under
`cambium.goal-graph-projection.v1`. The envelope is provenance, not a command.
Its source reference points back to the authoritative revision or receipt; a
consumer must preserve the tenant and revision when it stores or forwards the
projection.

The source/projection boundary is fail-closed: a value recognized as a Goal
Graph projection is rejected when presented as fresh authoritative input. This
includes malformed projection-shaped values. That rule prevents Cortex
foldback, a Telegram refresh, or a fallback lane from feeding its own read model
back into the writer and creating a feedback loop.

## Approval-bound commits

An intent is not a graph change. Before a commit, D1 binds the exact tenant,
source reference, node set, policy decision, actor, and expiry into an approval
digest. The commit is accepted only when that digest, approval, and writer lease
still match the expected graph revision. Stale revisions, missing approval,
expired approval, and cross-tenant references produce no write. Approval never
extends to a future graph version or to a broader payload.

## Pinned execution and receipts

Execution resolves an immutable graph version, policy/catalog version, and
adapter version before invocation. The resolved versions are pinned in the task
and receipt; retries replay that exact identity rather than silently selecting a
new graph or adapter. A terminal receipt records bounded status, graph version,
input/output digests, approval reference, execution identity, and replay truth.
Provider payloads, credentials, and raw private data do not enter the receipt.

An invocation is preceded by durable `invoking` readback. If completion or
readback is ambiguous, the task becomes `reconciliation_required`: it is not
automatically retried, and no replacement version is activated until evidence is
reviewed. Replaying an already terminal task returns the stored receipt without
another provider call.

## Node reconciliation and proof

Reconciliation compares one prior authoritative graph revision with the next.
The pure contract classifies mappings as follows:

| Mapping | Outcome | Proof disposition |
| --- | --- | --- |
| one node → the same ID | accepted | `preserve` |
| one node → one different ID | accepted | `revalidate` |
| one node → no successor | accepted | `retire` |
| one node → multiple IDs (split) | `review_required` | `review_required` |
| multiple nodes → one ID (merge) | `review_required` | `review_required` |

Split and merge lineage is ambiguous until a human or an explicit reviewed
mapping resolves which proof belongs to which successor. Many-to-many and
otherwise unmapped lineages also stop for review; proof is never inherited by
guessing. Reconciliation helpers return data only and do not touch D1, provider
adapters, receipts, or Telegram handlers.

## Cortex foldback

Cortex is a derived learning/read lane, not a second graph writer. Only bounded,
privacy-reviewed summaries and numeric aggregates tied to a source receipt may
fold back. Foldback stores the source graph version and digest so stale memory
cannot masquerade as current graph truth. A Cortex result can inform a future
approved intent, but it must pass through the same D1 approval-bound commit and
revision check; it can never be accepted as a fresh authoritative projection.
