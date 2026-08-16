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

### 6.1 Collision-safe residual ownership map (T-029)

The machine-readable task map is authoritative for the full path arrays and now exposes the exact ordered execution-stage graph. `executable=true` is the residual backlog, not immediate dispatch readiness; `ready_task_ids` derives only from the earliest incomplete stage whose dependencies are already implemented. After T-044 closes with tenant-isolated canonical Mission selection, the ready frontier is exactly `T-053`.

| Stage | Task set | Sole implementation writer | Test owner | Serialized integration lock |
| --- | --- | --- | --- | --- |
| planning | T-032, T-033 | Packet worktree | `scripts/mini-app-task-reconciliation.test.mjs` | none after packet completion; these tasks only define the contract and queue truth |
| mission | T-044 | Mission-selection task worktree | `workers/quests/src/handler.test.ts` | `workers/quests/src/handler.ts` |
| tools | T-053, T-054, T-056 | Tools task worktree | `workers/quests/src/handler.test.ts` | `workers/quests/src/page/scenes/tools.ts`; `workers/quests/src/handler.ts` for T-053 |
| story | T-059, T-060, T-061, T-062, T-063 | Story task worktree | `workers/quests/src/handler.test.ts` | `workers/quests/src/page/scenes/story.ts`; `workers/quests/src/handler.ts` for T-059 |
| inspect | T-065, T-068 | Inspect task worktree | `workers/quests/src/handler.test.ts` | `workers/quests/src/page/scenes/inspect.ts` |
| portfolio | T-074, T-075 | Portfolio task worktree | `workers/quests/src/operating-fabric-portfolio.test.ts` | `workers/quests/src/handler.ts` for T-074; `workers/quests/src/page/operating-fabric/portfolio.ts` for T-075 |
| validation | T-028, T-036, T-037 | Evidence/CI/browser task worktrees | `scripts/mini-app-task-reconciliation.test.mjs`, `workers/quests/src/page-motion-safety.test.ts` | none; evidence and test-matrix surfaces only |

Queue policy:
- `executable=true` distinguishes the executable backlog from the ready frontier; backlog order alone never authorizes parallel dispatch.
- `ready_task_ids` comes only from the earliest incomplete stage; later dependency-satisfied tasks stay blocked until the frontier stage completes.
- `workers/quests/src/handler.ts` remains serialized in the exact order `T-044`, `T-053`, `T-059`, `T-074`; T-044 is complete and the remaining lock order is `T-053`, `T-059`, `T-074`.
- Generated bundles, `page.ts`, `page/scaffold.ts`, shared client assembly, and Wrangler configuration remain orchestrator-only lock zones when a task actually needs them.

### 6.2 P0 implementation packets

#### Mission packet — T-030 complete

- **Inputs/contracts:** selected canonical WorkObject, branch-story packet, quest ledger, receipt/freshness summary, Mission state contract, and founder-action boundary.
- **Implementation owner:** `workers/quests/src/page/scenes/mission.ts`.
- **Test owner:** `workers/quests/src/handler.test.ts`.
- **Integration locks:** `workers/quests/src/handler.ts`, `workers/quests/src/page.ts`, and `workers/quests/src/page/scaffold.ts`; orchestrator only.
- **Required states:** loading, current mission, no mapped mission, blocked proof, stale head, and route/auth error.
- **Acceptance probes:** canonical selection remains tenant-isolated; planned stages never appear completed; the resting hierarchy renders the hero before one state stack, with the blocker row before the proof cue; actions open reviewable sheets rather than mutating lifecycle.
- **Exclusions:** no tenant allowlist change, ledger publication, synthetic progress, or generated-bundle ownership.

#### Gate packet — T-031 complete

- **Inputs/contracts:** redacted ActionRequests, proposal expiry, decision receipts, signed-action preflight, and authoritative founder identity.
- **Implementation owners:** `workers/quests/src/page/client/signed-action.ts` and `workers/quests/src/page/operating-fabric/gate-sheet.ts`.
- **Test owners:** `workers/quests/src/handler.test.ts` and `workers/quests/src/operating-fabric-page.test.ts`.
- **Integration locks:** `workers/quests/src/handler.ts`, `workers/quests/src/page.ts`, and shared client assembly; orchestrator only.
- **Required states:** loading, empty, ready, expired, blocked, submitting, accepted, rejected, and route/auth error.
- **Action boundary:** every approve/reject path is founder-authenticated, expiry-checked, replay-protected, idempotent, and receipt-returning. No button writes Goal Graph or lifecycle state directly.
- **Acceptance probes:** quiet never coexists with loading; expired proposals cannot submit; duplicate taps resolve to one receipt; blocked actions display an exact reason.
- **Exclusions:** no fabricated ActionRequest, no stored Telegram initData, and no runtime allowlist or deployment mutation.

#### Inspect packet — T-034 complete

- **Inputs/contracts:** served Mission Control envelope, branch joins, readiness rows, freshness, redacted receipts, and source-qualified gaps.
- **Implementation owner:** `workers/quests/src/page/scenes/inspect.ts`. The separate `workers/quests/src/page/operating-fabric/inspect-sheet.ts` remains the canonical graph node/edge sheet and is not the owner of the founder-first Mission Control hierarchy.
- **Test owner:** `workers/quests/src/handler.test.ts`.
- **Integration locks:** `workers/quests/src/handler.ts`, `workers/quests/src/page.ts`, and `workers/quests/src/page/scaffold.ts`; orchestrator only.
- **Required states:** loading, healthy, partial, stale, blocked, source mismatch, and route/auth error.
- **Acceptance probes:** proof summary and decision readiness lead; blocker/freshness/receipt cues precede system detail; source-code paths and fixture detail stay behind Inspect disclosures; secrets and raw Telegram authorization material never render.
- **Exclusions:** read-only diagnostics only; no lifecycle action, config write, credential display, or direct graph mutation.

#### Portfolio packet — T-035 complete

- **Inputs/contracts:** portfolio catalog, canonical join report, mapping receipts, Goal Graph projection, promotion evidence, and founder Gate boundary.
- **Implementation owner:** `workers/quests/src/page/operating-fabric/portfolio.ts`.
- **Test owner:** `workers/quests/src/operating-fabric-portfolio.test.ts`.
- **Integration locks:** `workers/quests/src/handler.ts`, `workers/quests/src/page.ts`, and `workers/quests/src/page/operating-fabric/scaffold.ts`; orchestrator only.
- **Required states:** zone loading/empty, joined, catalog-only, graph-only, mapping conflict, promotion proposed, founder-approved, and rolled back.
- **Zone semantics:** Saplings, Client Branches, Programs, Review, and Historical remain distinct; promotion changes capability, never canonical identity.
- **Acceptance probes:** every catalog entry is joined, excluded, or blocked with reason; templates never reach runtime nodes; promotion produces a founder-gated proposal and no UI toggle mutates lifecycle directly.
- **Exclusions:** no folder relocation, repository creation, registry transition, direct Goal Graph mutation, or production promotion.

#### Tools packet — T-032 complete

- **Contract authority:** merged T-009 public-envelope enforcement and handler-to-renderer proofs define the canonical Tools packet.
- **Panels:** panels status/services/agents/activeWork/handoffs.
- **Panel identity mapping:** panelId mappings status/services/agents/active-work/handoffs.
- **Data shapes:** `status` is one object; every other panel is an array. Every panel entry carries `source`, `freshness`, and canonical ISO `checkedAt`.
- **Freshness contract:** freshness state `fresh|stale|unknown`; stale or unknown data renders honest unavailable copy instead of implied readiness.
- **Fixture contract:** handler-to-renderer normal/fail-closed/malformed/unexpected fixtures cover the exact projection boundary.
- **Implementation owner:** `workers/quests/src/page/scenes/tools.ts`.
- **Test owner:** `workers/quests/src/handler.test.ts`.
- **Future write set:** `workers/quests/src/page/scenes/tools.ts`; `workers/quests/src/handler.ts` for coordinator-owned T-053 integration only; `workers/quests/src/handler.test.ts`; and the task map, source-reconciliation mirror, GIP manifest, ISA, and handoff only when verified closeout changes their planning truth. T-053 serves the typed projection, T-054 renders per-panel freshness, and T-056 wires the selected canonical WorkObject into Tools.
- **Serialized integration:** `workers/quests/src/handler.ts` remains serialized; T-053 is the only Tools task in the shared handler order.
- **Exclusions:** no founder-action mutation, no direct runtime writes, no invented panel, no hidden freshness coercion, and no bypass around Gate for mutations.

#### Story packet — T-033 complete

- **Contract authority:** merged T-008 public-envelope enforcement and handler-to-renderer proofs define the canonical Story packet.
- **Event identity:** every event exposes `eventId`, canonical `workObject.id`, canonical `workObject.kind`, `source`, canonical ISO `eventAt`, and `receipt.id` when a receipt exists.
- **Projection contract:** receipts, decisions, and transitions project into one Story event stream with stable replay dedupe.
- **Filtering contract:** Story filters operate on exact `kind` + identity rather than inferred branch/group aliases.
- **Empty-state contract:** the first qualifying event and empty guidance are explicit; empty state explains what exact event will create the first beat.
- **Fixture contract:** handler-to-renderer normal/fail-closed/malformed/unexpected fixtures cover the exact event boundary.
- **Implementation owner:** `workers/quests/src/page/scenes/story.ts`.
- **Test owner:** `workers/quests/src/handler.test.ts`.
- **Future write set:** `workers/quests/src/page/scenes/story.ts`; `workers/quests/src/handler.ts` for coordinator-owned T-059 integration only; `workers/quests/src/handler.test.ts`; and the task map, source-reconciliation mirror, GIP manifest, ISA, and handoff only when verified closeout changes their planning truth. T-059 projects receipt-backed events, T-060 enforces stable replay dedupe, T-061 renders source-qualified timeline rows, T-062 adds kind-and-identity filters, and T-063 explains the first qualifying event.
- **Serialized integration:** `workers/quests/src/handler.ts` remains serialized; T-059 is the only Story task in the shared handler order.
- **Exclusions:** no synthetic success beats, no alias-derived WorkObject joins, no non-canonical timestamps, and no direct ledger mutation.

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
