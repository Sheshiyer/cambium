# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.3 — Managerial Control Loop

**Shipped:** 2026-08-17  
**Phases:** 2 | **Plans:** 2 | **Sessions:** not historically recorded

### What Was Built

- A replay-safe D1-leased synthetic service-agreement draft with immutable artifact readback.
- Feature-gated Telegram intake and redacted task-status projection over the same durable loop.
- Rollback, allowlist, access-revocation, and human-approval boundaries for the synthetic canary.

### What Worked

- One typed command kept the authority and side-effect surface narrow.
- D1 task, lease, artifact, outcome, and readback identities provided a durable proof spine.
- The Telegram adapter reused the existing loop instead of becoming another orchestrator.

### What Was Inefficient

- Historical phases did not emit the current GSD `VERIFICATION.md` artifact.
- External Hermes and Temperance evidence was preserved in summaries rather than a replayable cross-repository receipt packet.
- Later squash/reconciliation history weakened direct ancestry from summary commit identities to current main.

### Patterns Established

- Finite moves stop at an explicit human gate and emit immutable evidence.
- Read projections may explain authority but never become a second writer.
- Runtime claims must name whether they are freshly probed, source-traced, or historically summary-attested.

### Key Lessons

1. Package per-requirement verification at phase close, not only prose summaries.
2. Preserve producer/consumer commit equivalence when repositories later squash or reconcile history.
3. Treat orchestration adapters as bounded views over one durable authority spine.

### Cost Observations

- Model mix and session counts were not retained by the historical milestone.
- The 2026-08-17 archive audit used one read-only GSD integration checker and no external runtime calls.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|---|---:|---:|---|
| v0.3 | not recorded | 2 | Established durable D1-to-Telegram proof; exposed missing verification packaging |

### Cumulative Quality

| Milestone | Requirements | Integration | Critical Gaps |
|---|---:|---:|---:|
| v0.3 | 11/11 mapped | 9/9 edges | 0 |

### Top Lessons

1. Durable evidence must travel with the planning artifact that claims completion.
2. Infinite-game learning depends on truthful finite-game closure and provenance.
