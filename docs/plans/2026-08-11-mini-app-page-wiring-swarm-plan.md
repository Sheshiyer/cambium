# Cambium Mini App Page Wiring Swarm Plan

Status: execution-ready plan; Client Delivery source correction implemented on `codex/miniapp-page-wiring-plan`; production rollout remains gated.

## 1. Discovery Summary

- Planning depth: deep, production-hardening pass.
- Delivery mode: contract-first multi-agent swarm with one owner per file zone.
- Release model: source correction, reviewed merge, ledger republish, tenant pilot, authenticated Telegram validation, then broader promotion.
- Quality bar: truthful state, founder-gated mutation, tenant isolation, mobile-safe layout, explicit loading/empty/error/stale modes, rollback proof.
- Current production: legacy Mission/Gate/Tools/Story/Inspect remains active because `/v1/mission-fabric/cambium` returns `403 mission fabric tenant is not enabled`.
- Current data: 17 ledger rows, zero completed rows, zero beats, zero ActionRequests; Story is therefore truthfully empty.
- Current classification defect: `client-delivery` is a template with no canonical WorkObject ID, yet the branch packet loader projected it into the operational ledger.

## 2. Non-negotiable Contracts

1. Templates remain documentation/catalog inputs and never become live WorkObjects.
2. Every operational Sapling, Branch, or Program has one exact canonical ID: `sapling:<slug>`, `branch:<slug>`, or `program:<slug>`.
3. Promotion changes capability, not identity. A Sapling is not silently relabeled as a Branch.
4. Founder approval is required for graph mutations, delegation, publication, and autonomy promotion.
5. Telegram `initData` remains transient and is never persisted, logged, or copied into planning artifacts.
6. Empty, loading, stale, blocked, and error are separate UI states.
7. The legacy shell remains the rollback surface until authenticated Operating Fabric acceptance passes.

## 3. Answer: Saplings versus Branches

Distinct UI already exists in the hidden Operating Fabric portfolio: Saplings, Clients, Programs, Review, and Historical zones have separate classification and lifecycle treatment. The production screenshot is the legacy shell, which collapses operational packets into one generic rail. The plan promotes the existing classified UI—not a cosmetic rename—and joins real client Branches only after their exact `branch:<slug>` identity and mapping receipts exist.

## 4. Page Plans

### Mission

**Job:** show the selected canonical work object, its mission, proof frontier, loop, progress, and next safe action.

**Inputs:** mission-fabric graph head, selected WorkObject, branch-story packet, quest ledger, receipt/freshness summary, portfolio classification.

**Required states:** loading skeleton; current mission; no mapped mission; blocked proof; stale head; route/auth error. Never display a template as a selectable branch.

**UI contract:** visibly distinguish Sapling, Client Branch, and Program; retain identity badge and promotion state; keep horizontal card rail within the Telegram viewport; replace generic `Product branches` labeling with type-aware labels; expose why a card cannot promote.

**Acceptance:** `client-delivery` is absent; `branch:parkarea`-style records render in Clients only when joined; progress counts reconcile to the served head; selection persists without cross-tenant leakage.

Planned Markdown quest stages must read `7 planned`, never `0/7` completed, until receipt-backed status exists. The scene rail must snap to exactly one page after pointer cancel, pointer leave, visibility change, or window blur.

### Gate

**Job:** present founder decisions with their consequence, evidence, expiry, and signed action boundary.

**Inputs:** Goal Graph intake, ActionRequests, current ledger/head, proposal expiry, decision receipts.

**Required states:** loading; empty (`No founder decisions waiting`); ready; expired; blocked; submitting; accepted; rejected; network/auth error. `Gate quiet` must never coexist with `loading the queue…`.

**UI contract:** one decision focus at a time; concise consequence copy; proof links; countdown/expiry; disabled action with reason; retry without duplicate submission; receipt shown after action.

**Acceptance:** fetch has a timeout and terminal state; expired Fitcheck proposals cannot be approved; DLOCK/IVerif decisions display only when live ActionRequests exist; duplicate taps are idempotent.

### Tools

**Job:** expose truthful operational capability across status, services, agents, active work, and handoffs.

**Inputs:** typed `commands` projection, service health, agent roster, active runs, handoff records, freshness and authorization.

**Required states:** loading; ready; partial; stale; unavailable; unauthorized; empty per panel.

**UI contract:** each tool declares source and freshness; read-only versus founder-action capability is explicit; no inert buttons; retries are scoped; mutations route through Gate.

**Acceptance:** absent `commands` produces a useful unavailable state, not blank cards; each surface has fixture and route tests; handoff actions create reviewable requests rather than direct execution.

### Story

**Job:** narrate verified change over time without inventing progress.

**Inputs:** persisted beats, accepted/rejected ActionRequests, completed ledger transitions, receipt foldback, branch identity.

**Required states:** loading; empty with actionable explanation; timeline; partial/stale; error.

**UI contract:** entries carry time, work identity, event type, evidence/receipt, and source; filtering by Sapling/Branch/Program; no synthetic success language from queued work.

**Acceptance:** the current zero-data state explains which event will create the first beat; a completed quest or decision receipt deterministically creates one deduplicated story beat; tenant and branch filters are stable.

### Inspect

**Job:** be the truth/debug surface for mappings, sources, freshness, gaps, receipts, and policy boundaries.

**Inputs:** mission-fabric projection, portfolio join report, branch map, ledger, commands, action requests, source receipts.

**Required states:** loading; healthy; partial; stale; blocked; source mismatch; route/auth error.

**UI contract:** summary first, technical detail on demand; exact missing join reason; copy-safe identifiers; no secrets; link every displayed conclusion to its source/receipt.

**Acceptance:** reports template exclusion, catalog-versus-graph counts, allowlist status without leaking config, and per-page readiness; diagnostics match API payloads.

Production Inspect must hide fixture names and source-code paths behind a development-only diagnostics disclosure.

### Portfolio / Branch Promotion

**Job:** give Saplings, Client Branches, Programs, Review, and Historical work distinct homes and controlled lifecycle movement.

**Inputs:** portfolio catalog, mapping receipts, goal graph, branch packets, join report, promotion evidence.

**Required states:** zone loading; zone empty; joined; catalog-only; graph-only; mapping conflict; promotion proposed; founder-approved; rolled back.

**UI contract:** type-specific badge, lifecycle template, current gate, evidence completeness, and available next action; promotion is proposed through Gate; historical items cannot look active.

**Acceptance:** all canonical catalog entries reconcile to joined, explicitly excluded, or blocked-with-reason; real client Branches use `branch:<slug>`; no template reaches Mission, Story, or graph nodes.

## 5. Phase → Wave → Swarm Map

### Phase 1 — Contract and foundation setup

- **Wave 1 / Data Contract swarm:** operational/template boundary, canonical identity, mission-fabric/portfolio joins, story events.
- **Wave 1 / UI State swarm:** per-page state machines, accessibility, responsive viewport contracts.
- **Wave 2 / Route swarm:** activation/auth/allowlist, shared fetch lifecycle, typed errors and freshness.
- **Wave 2 / Proof swarm:** fixtures, source receipts, redaction and tenant isolation.
- **Wave 3 / Page Prep swarm:** page-level ownership packets and lock-zone sequencing.
- **Wave 3 / Validation Prep swarm:** CI matrix, browser stories, rollback rehearsal.

Exit: schemas frozen, fixtures accepted, no unknown identity scope, and every page has explicit terminal states.

### Phase 2 — Parallel page implementation

- Mission and Portfolio can run together after join contracts freeze.
- Gate and Story can run together after ActionRequest/event contracts freeze.
- Tools and Inspect can run together after command/diagnostic contracts freeze.
- Shared scaffold, handler, quest-envelope builder, and generated bundle changes remain serialized integration lock zones.

Exit: every page passes unit, contract, accessibility, and viewport checks against fresh/empty/stale/error fixtures.

### Phase 3 — Integration and hardening

- Merge behind the existing fail-closed activation behavior.
- Republish the ledger after the template filter merges; record before/after receipt and confirm total branch stories changes from six to five.
- Pilot `MISSION_FABRIC_TENANTS=cambium` only after owner approval and rollback evidence.
- Validate inside the actual Telegram Mini App using authenticated transient initData; direct browsers are insufficient.
- Promote real Branch joins in bounded batches with founder-reviewed mapping receipts.

Exit: authenticated five-page walkthrough, no template leakage, accurate empty states, production receipts, and tested allowlist rollback.

## 6. Ownership and Lock Zones

| Concern | Primary owner | Reviewer | Lock zone |
| --- | --- | --- | --- |
| Packet ingestion/template boundary | Data-contract agent | Cato/reviewer | `bin/quine/hyphae/branch-stories.ts`, `quests.ts` |
| Mission | Mission UI agent | Designer + QA | `page/scenes/mission.ts` |
| Gate | Gate UI/action agent | Security + QA | `page/scenes/gate.ts`, signed-action client |
| Tools | Tools UI agent | Backend + QA | `page/scenes/tools.ts` |
| Story | Story/event agent | Data + QA | `page/scenes/story.ts` |
| Inspect | Inspect/diagnostic agent | Security + QA | `page/scenes/inspect.ts` |
| Portfolio/Branches | Portfolio UI agent | Product + QA | `page/operating-fabric/portfolio.ts` |
| Integration | Orchestrator only | Cato + QATester | `handler.ts`, `scaffold.ts`, shared client, bundles, Wrangler config |

Each implementation task gets one branch and one worktree. Agents must not revert concurrent changes. Integration lock zones are queued and merged by the orchestrator.

## 7. Verification Gates

1. **Contract gate:** schemas validate; unknown types fail closed; template fixture excluded.
2. **Unit gate:** targeted page/data tests pass with no changed unrelated snapshots.
3. **Integration gate:** quest and mission-fabric route suites pass, including auth/tenant isolation.
4. **Visual gate:** 320px, 390px, and desktop captures; no clipping or unreachable controls.
   The shell uses complete tablist/tabpanel relationships, authored focus-visible states, 44px targets, enabled pinch zoom, and announced asynchronous states.
5. **Action gate:** founder mutations prove expiry, replay protection, idempotency, and receipt rendering.
6. **Release gate:** reviewed SHA, clean tree, rollback version, KV before/after receipts, tenant pilot approval.
7. **Live gate:** authenticated Telegram walkthrough of Mission, Gate, Tools, Story, Inspect, and Portfolio.

## 8. Rollout Order

1. Merge and republish the Client Delivery template exclusion.
2. Freeze identity, event, command, and page-state contracts.
3. Complete page work in parallel behind the closed activation gate.
4. Validate generated bundle parity and full CI.
5. Obtain explicit owner approval for production allowlist mutation.
6. Enable only `cambium`, validate in Telegram, and retain immediate allowlist rollback.
7. Join and promote real client Branches in receipt-backed batches.

## 9. Risks and Fallbacks

- **Activation misconfiguration:** remove `cambium` from `MISSION_FABRIC_TENANTS`; legacy shell returns immediately.
- **Incomplete portfolio joins:** keep items catalog-only with explicit reason; never fabricate graph nodes.
- **Empty Story:** show deterministic first-event guidance; do not generate fictional beats.
- **Duplicate founder action:** idempotency key plus signed receipt lookup.
- **Mobile overflow:** block release on viewport proof, not desktop-only screenshots.
- **Stale ledger after source merge:** compare KV receipt digest and served branch count before enabling Operating Fabric.

## 10. GitHub Sync Strategy

- One parent issue for the activation wave; one issue per task only when execution is scheduled.
- Labels: `phase:*`, `wave:*`, `page:*`, `area:*`, `lock-zone`, `founder-gate`, `blocked`.
- Every PR links task IDs, lists touched lock zones, and attaches validation evidence.
- Wave status comments contain completed task IDs, changed contracts, current blockers, and next executable wave.
- No issue or external project mutation is performed by this planning pass.

The machine-readable 80-task execution map is stored in `.planning/2026-08-11-mini-app-page-wiring.tasks.json`.
