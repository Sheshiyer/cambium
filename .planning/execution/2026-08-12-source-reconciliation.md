# 2026-08-15 Source Reconciliation Report

- Schema: `2026-08-15-mini-app-page-wiring-reconciliation.v1`
- Source: `origin/main@f7e8795615e372323aaa24a5ae2d0255cb45aaec`
- Scope: preserve all 80 historical Mini App task IDs while reducing the executable queue to current, evidence-backed residuals.
- Authority: current merged source and tests outrank dated plan checklists.

## Result

- **80 / 80** task IDs retained with provenance.
- **44** implemented.
- **4** superseded by broader verified coverage.
- **28** executable residuals.
- **4** approval-gated and excluded from automatic execution.
- **0** blocked rows and **0** historical rows promoted into authority.

The governed queue is `.planning/2026-08-11-mini-app-page-wiring.tasks.json`. Only rows with `executable: true` are runnable. Implemented, superseded, and approval-gated rows remain in the file for provenance but are not executable.

## Executable residuals

| Task | Outcome | Single file owner | Missing acceptance |
| --- | --- | --- | --- |
| T-008 | Define Story event schema | `workers/quests/src/page/scenes/story.ts` | No typed Story event authority ensures every event carries identity, source, time, and receipt. |
| T-009 | Define command projection schema | `workers/quests/src/page/scenes/tools.ts` | No typed per-panel command projection contract enforces source and freshness. |
| T-021 | Unify initial envelope hydration | `workers/quests/src/page/client/data.ts` | The shell still boot-fetches the quest envelope; scenes do not paint from a served initial payload. |
| T-028 | Record production baseline evidence | `docs/plans/evidence/cambium-operating-fabric-2026-07-29.md` | No reproducible pre-activation 403/ledger baseline receipt with verified digest is checked in. |
| T-029 | Assign page file ownership | `docs/plans/2026-08-11-mini-app-page-wiring-swarm-plan.md` | No collision-safe file ownership map proves every implementation file has one writer. |
| T-030 | Create Mission implementation packet | `docs/plans/2026-08-11-mini-app-page-wiring-swarm-plan.md` | No reviewed Mission implementation handoff brief records complete inputs, outputs, and tests. |
| T-031 | Create Gate implementation packet | `docs/plans/2026-08-11-mini-app-page-wiring-swarm-plan.md` | No reviewed Gate implementation handoff brief records explicit action boundaries. |
| T-032 | Create Tools implementation packet | `docs/plans/2026-08-11-mini-app-page-wiring-swarm-plan.md` | No reviewed Tools implementation handoff brief records typed panel sources. |
| T-033 | Create Story implementation packet | `docs/plans/2026-08-11-mini-app-page-wiring-swarm-plan.md` | No reviewed Story implementation handoff brief records the event projection contract. |
| T-034 | Create Inspect implementation packet | `docs/plans/2026-08-11-mini-app-page-wiring-swarm-plan.md` | No reviewed Inspect implementation handoff brief separates production and developer detail. |
| T-035 | Create Portfolio implementation packet | `docs/plans/2026-08-11-mini-app-page-wiring-swarm-plan.md` | No reviewed Portfolio implementation handoff brief fixes zone and promotion semantics. |
| T-036 | Build CI page matrix | `.github/workflows/ci.yml` | Broad CI exists, but no authoritative page-state matrix proves every state runs in CI. |
| T-037 | Build browser story matrix | `workers/quests/src/page-motion-safety.test.ts` | Viewport and keyboard tests exist, but no browser-story matrix proves complete mobile and desktop journeys. |
| T-042 | Simplify Mission resting hierarchy | `workers/quests/src/page/scenes/mission.ts` | Mission ordering exists, but no reviewed design evidence proves one action blocker and proof cue dominate. |
| T-044 | Persist canonical Mission selection | `workers/quests/src/page/scenes/mission.ts` | Same-tenant selection persistence is tested; canonical selection isolation across tenants is not. |
| T-053 | Serve typed command projection | `workers/quests/src/page/scenes/tools.ts` | Tools still reads an ad-hoc command object; five typed panel inputs and route-contract tests are absent. |
| T-054 | Render per-panel freshness | `workers/quests/src/page/scenes/tools.ts` | Tools exposes global/coarse freshness, not per-panel freshness invariants. |
| T-056 | Wire selected WorkObject into Tools | `workers/quests/src/page/scenes/tools.ts` | Tools retains branch context, not the exact selected WorkObject identity and kind. |
| T-059 | Project receipt-backed Story events | `workers/quests/src/page/scenes/story.ts` | No explicit projector proves receipts, decisions, and transitions become Story events. |
| T-060 | Deduplicate Story events | `workers/quests/src/page/scenes/story.ts` | No stable Story event identity or replay-deduplication test is present. |
| T-061 | Render source-qualified Story timeline | `workers/quests/src/page/scenes/story.ts` | Story beats do not all expose exact source plus WorkObject provenance. |
| T-062 | Add Story WorkObject filters | `workers/quests/src/page/scenes/story.ts` | Story filters by group and branch, not WorkObject kind plus identity. |
| T-063 | Explain first Story event | `workers/quests/src/page/scenes/story.ts` | The Story empty state does not name the first qualifying event. |
| T-065 | Lead Inspect with blockers | `workers/quests/src/page/operating-fabric/inspect-sheet.ts` | Inspect renders provenance but lacks reviewed blocker/freshness/receipt-first hierarchy. |
| T-068 | Expose page readiness summary | `workers/quests/src/page/operating-fabric/inspect-sheet.ts` | Freshness metadata exists, but no explicit per-page readiness summary panel is present. |
| T-074 | Route promotions through Gate | `workers/quests/src/page/operating-fabric/portfolio.ts` | Portfolio promotion remains advisory; no founder-gated promotion proposal path exists. |
| T-075 | Test Portfolio state matrix | `workers/quests/src/operating-fabric-portfolio.test.ts` | Portfolio route tests exist, but no dedicated zone/state fixture matrix proves all states. |
| T-078 | Republish corrected quest ledger | `docs/plans/evidence/cambium-operating-fabric-2026-07-29.md` | No reviewed KV republication receipt proves the served ledger contains five non-template branches. |

## Approval-gated rows

| Task | Outcome | Missing authority |
| --- | --- | --- |
| T-020 | Specify tenant pilot allowlist | Founder approval and live rollback authority are required before changing MISSION_FABRIC_TENANTS. |
| T-038 | Build release evidence template | An owner-approved ledger republication and rollback receipt is required before pilot evidence can be claimed. |
| T-079 | Run authenticated Telegram pilot | An authenticated live Telegram pilot and six-surface evidence packet require explicit runtime authority. |
| T-080 | Close pilot or rollback | A founder promotion-or-rollback decision and post-decision production probe are required. |

## Verification contract

- IDs are exactly `T-001` through `T-080`, with no duplicates or omissions.
- Every row has one disposition and one exact file owner.
- Every executable row retains dependencies, validation, current-source evidence, and one missing acceptance.
- Implemented and superseded rows cite current source/test evidence.
- Approval-gated rows remain non-executable and name the missing authority.
- No deployment, allowlist, KV/D1/R2/Vault, Telegram, provider, credential, or folder mutation is performed by this reconciliation.
