# Phase Q Bridge — shipped retrospective

> Replaces the pre-ship design draft. As-built reference; the in-line design notes were superseded by the simpler single-line model that landed.

## What shipped (2026-06-16)

- One 17-arc quest line. Arcs I–IX are founder-level (the operator tutorial), arcs X–XVII are per-tenant project delivery. No `mode` field on `QuestInputs` — the separation comes from the data, not the schema.
- `founder.json` carries the cross-tenant completion. `reconcileFounder` (bin/quine/hyphae/quests.ts) auto-merges newly-completed arcs into it on every root-tenant push.
- `${tenant}.project.json` carries the per-tenant evidence. `assembleProjectEvidence` + `gatherProjectSignals` (bin/quine/hyphae/project-evidence.ts) derive it from real sources every time `quine write quests evidence` runs.
- Two new write verbs: `quine write quests evidence [--tenant t]` and `quine write quests activate-tenant --tenant <id>`.

## Why the single-line model

The pre-ship draft proposed `mode: 'tutorial' | 'operations' | 'portfolio'`. In practice, founder inheritance + per-tenant project state achieves the same per-tenant separation without changing the fold's signature. The 26 existing tests stay valid; no refactor of the gather/push layers needed.

## Demo tenant as first-light

`.operator/demo-org.world.json` and `.operator/demo-org.project.json` are now derived from `project-evidence@v1`. The demo quest line shows arcs I–IX inherited via founder.json and arcs X–XVII reflecting repo state (honest zeros where progress has not yet happened — no fake progress).

First demo envelope at `https://cambium.example.com/api/quests/demo-org` (`completed: 9/17`): I–IX complete via founder inheritance, X "The Brief" the active frontier, XI–XVII locked with honest evidence (e.g. "no review rounds yet", "no build activity yet", "awaiting ship approval").

## A bug caught at first-light

The plan's original `readReviewSignals` (bin/quine/hyphae/project-evidence.ts) fell back to the root `deviations.jsonl` when the tenant-scoped one was missing — that file is cross-tenant noise, and a tenant's arc XIII "Review" could falsely close with unrelated entries. The fix (commit 3c58d6e): tenant-scoped only, honest zero when absent. Caught and fixed before issue #25 closed — the kind of inversion the no-fake-progress invariant exists to expose.

## Deferred wings

- **Miniapp Project Health Card** (Tenant Switcher, Revenue Tracker, Team Pulse, Client Comms) — UI work. Goes with the R3F realignment session.
- **Narrative client-grammar** (`<tenant>` subject / `<deliverable>` object / `<milestone>` plot point) — extension of `bin/operator/narrative/narrative.ts`. Wing post-W2.5.
- **Lesson-miner agent** — `docs/plans/2026-06-11-group-memory-lesson-agent.md`. Closes arc XVII (lessons minted into skills).
- **GitHub + Cloudflare signal sources** — `readRepoSignals` and `readDeploySignals` in `project-evidence.ts` are honest-zero stubs today; wiring through `bin/quine/hyphae/gh.ts` and `bin/quine/hyphae/cf.ts` is a small follow-on.

---

*Reconciled 2026-06-16 after Phase Q + Bridge writers landed.*
