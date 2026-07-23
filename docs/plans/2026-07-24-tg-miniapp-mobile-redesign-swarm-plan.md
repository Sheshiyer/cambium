# TG Mini App — Mobile-First Redesign · Swarm Architect Plan

> Date: 2026-07-24 · Author: orchestrator (Kimi) via Swarm Architect skill
> (`~/.craft-agent/workspaces/my-workspace/skills/swarm-architect/`)
> Design references: `docs/plans/assets/tg-miniapp-mission-control-reference/`
> Status: **plan — awaiting founder approval before Wave 1 launches**

---

## 1. Discovery Summary

| Dimension | Value | Source |
|---|---|---|
| Planning depth | standard (skill default of ~80 tasks explicitly scaled down — see §6 note) | founder scope: one app surface |
| Delivery mode | production | live Worker `cambium-quests` @ 100% traffic |
| CI/CD | existing — `verify:release` 5/5 gates | `scripts/verify-release.mjs` |
| Release model | phased rollout (3 phases, wave-boundary merges) | skill default, fits repo |
| Quality bar | tests + visual evidence (screenshots) + contract validation; no text regressions to old flow | skill verification gates |
| Team topology | solo founder + agent swarm (Kimi runtime: coder / plan / explore subagents) | — |
| Platform constraints | Telegram WebView, mobile portrait first, safe-area aware, `prefers-reduced-motion` | reference boards |
| Hard decision 1 | **Retire the manual initData capture flow** (right-click inspect no longer exists in current Telegram Mac). Runtime initData auth (automatic, in-WebView) stays; only the *manual verification ritual* dies. | founder, 2026-07-24 |
| Hard decision 2 | **Mobile UI first, visual-based, not text-heavy; actions taken in-app**, not copy-paste chat commands | founder, 2026-07-24 |
| Replacement proof | Founder-device proof (ISC-279) is re-instrumented as an **in-app signed action receipt** — the redesigned UI performs a real `gate-approval` smoke; its redacted receipt *is* the device proof. No pasted initData anywhere. | this plan |

## 2. Assumptions and Constraints

**Assumptions**
- The UI remains a Worker-served bundle (no separate app host); origin stays `https://curious.thoughtseed.space`.
- `/api/gate/{tenant}` signed-action contract (kind, subject, initData, idempotency) is stable and reused as-is.
- Design tokens and glyph vocabulary from the reference boards are the target system, not a starting suggestion.
- `.artifacts/tg-miniapp-live-proof/` is the canonical temporal proof dir (gitignored); dated promotions go to `docs/evidence/tg-miniapp/`.

**Constraints**
- `workers/quests/src/handler.ts` is a **lock zone** (shared Worker file) — serialized owners only.
- `workers/quests/src/page.ts` (~4,780-line inline bundle) is currently a monolith = also a lock zone. **It must be modularized before parallel UI swarms** (Wave 1).
- Gates must stay green at every wave boundary: `npm run verify:release` (5/5), including `render-docs:check` and `standalone:audit`.
- Fail-closed auth behavior (401 on bad/absent initData) must not regress — covered by existing route tests.
- No raw initData, user ids, or tokens in any artifact, screenshot, or commit (no-fake-progress + redaction invariants stand).

## 3. Agent Ownership Model

| Concern | Primary owner | Secondary reviewer | Notes |
|---|---|---|---|
| Orchestration, plan, wave gates, ISA/docs | Planner (orchestrator, this session) | plan subagent | owns lock-zone merges |
| UI components + scenes (`workers/quests/src/page/**`) | UI coder subagents (one per swarm) | plan subagent (design-fidelity review vs reference boards) | parallel after W1 contract freeze |
| Worker routes, gate API, proof tooling (`handler.ts`, `live-proof-readiness.mjs`) | Backend coder subagent | orchestrator | serialized with UI on `handler.ts` |
| Validation: tests, screenshots, gates, adversarial text-audit | Validation subagent (explore/plan) | orchestrator | every wave has ≥1 validation task |

Branch model: `swarm/miniapp-redesign/p<phase>-w<wave>/<swarm>/<task-id>`; merges only at wave boundaries by the orchestrator.

## 4. Phase Map

| Phase | Goal | Exit criteria | Waves |
|---|---|---|---|
| **P1 — Contract & foundation** | Freeze design tokens + component contracts + gate/proof contract changes; modularize `page.ts`; retire initData capture from tooling | Contract packet frozen; `page/` module skeleton green; old capture path deleted + tests rewritten | W1 contract freeze · W2 scaffolding · W3 launch prep |
| **P2 — Parallel scene implementation** | Rebuild the 5 tabs as visual-first scenes on frozen contracts | Each scene passes design-fidelity + state-language + reduced-motion checks; text-density budget met | W1 Mission+Gate · W2 Tools(actions)+Story · W3 Inspect+polish |
| **P3 — Integration & hardening** | Integrate, deploy, re-instrument device proof as in-app signed smoke, update ISA/docs | Production deploy + in-app smoke receipt promoted to `docs/evidence/`; ISC-279 superseded; 5/5 gates | W1 integration · W2 live proof |

## 5. Detailed Phase 1 Wave Layout

### W1 — Contract freeze
- **Swarm A (backend contracts):** freeze mini-app↔Worker contract v2 — envelope shapes, `/api/gate` payload, branch-map read route, **proof-shape change**: device proof = in-app signed action receipt; delete `--capture-device-proof` env-initData path from `live-proof-readiness.mjs`; readiness schema v2. *Inputs:* removal-surface map (2026-07-24 discovery). *Outputs:* `docs/architecture/contracts/tg-miniapp-contract-v2.md`, edited tooling + rewritten tests. *Validation:* tooling tests green; validators reject pasted-initData artifacts.
- **Swarm B (design contracts):** ratify the pre-frozen component-integration specs produced by the 2026-07-24 deep visual pass — `docs/plans/assets/tg-miniapp-mission-control-reference/frozen/` (`README.md` global invariants, `01-component-anatomy.md` all 12 components, `02-screen-composition.md`, `03-motion-spec.md`, `04-tokens-and-atlas.md`) — then derive `design-tokens.json` from `04`, the text-density budget, and safe-area rules. *Inputs:* the frozen spec files (every board already analyzed at full resolution, including the atlas). *Outputs:* ratified `frozen/` + `design-tokens.json` + copy budget. *Validation:* every frozen spec entry ratified or amended with reason; banned-list (gradients/orbs/text walls/copy-paste command blocks) encoded as review checklist.

### W2 — Delivery scaffolding
- **Swarm A (backend):** `page.ts` → `page/` module skeleton (tokens, glyphs, components, scenes/, client/) with identical rendered output (pure refactor). Lock zone — sole owner. *Validation:* snapshot/diff of served HTML unchanged; route tests green.
- **Swarm B (validation):** visual regression harness — viewport screenshot capture at mobile sizes + state-matrix fixtures (idle/active/blocked/locked/stale/complete/reduced-motion). *Validation:* harness reproduces current UI screenshots as baseline.

### W3 — Parallel-work launch prep
- **Swarm A:** scene data contracts per tab (what each scene needs from the envelope; fixtures per scene).
- **Swarm B:** copy rewrite brief — founder-readable labels per ProofList/GateActionRow; narrative (`~57 .nar` blocks) → collapsed/info-sheet model; kv panels → Inspect-only. *Validation:* copy budget ≤ agreed words/screen.

## 6. Task List

> **Scale deviation (explicit):** skill default is ≥70 tasks; founder scope is one app surface, so this plan carries 38 tasks. If P2 scene estimates blow up, split scenes into per-component tasks at the W1 boundary.

### Phase 1 — Contract & foundation (12)

| id | title | area | owner_role | est_hours | dependencies | deliverable | acceptance | validation |
|---|---|---|---|---|---|---|---|---|
| T-001 | Ratify token spec + derive design-tokens.json | frontend | UI | 1 | — | `frozen/design-tokens.json` | 7 colors verified (zero deltas), type scale, 8px grid, radii, elevation — per `frozen/04-tokens-and-atlas.md` | tokens lint + spot-check vs design-system board |
| T-002 | Ratify component anatomy spec (12 components) | frontend | UI | 2 | T-001 | ratified `frozen/01-component-anatomy.md` | every component w/ anatomy, states, data needs — deep-pass complete 2026-07-24 | maps 1:1 to `component-map.md` + glyph board |
| T-003 | Ratify motion + reduced-motion spec | frontend | UI | 1 | T-001 | ratified `frozen/03-motion-spec.md` | 5 strips, 5 named animations, 6 global rules, fallback canon | storyboard parity check |
| T-004 | Freeze text-density budget + banned list | product | Planner | 1 | — | spec section | words/screen caps per tab; banned patterns listed | checklist sign-off |
| T-005 | Contract v2 doc: envelopes, gate payload, routes | backend | Backend | 2 | — | `contracts/tg-miniapp-contract-v2.md` | all shapes frozen, versioned | contract review |
| T-006 | Retire `--capture-device-proof` env-initData flow | backend | Backend | 3 | T-005 | edited `live-proof-readiness.mjs` | no env-initData path; templates regenerated | `live-proof-readiness.test.ts` rewritten + green |
| T-007 | Readiness schema v2: proof = in-app signed receipt | backend | Backend | 2 | T-005 | schema + validators | validators reject pasted-initData artifacts | adversarial fixture tests |
| T-008 | Supersede ISC-279 in ISA.md (redesign instrument) | infra | Planner | 1 | T-007 | ISA entry | old ISC marked superseded-by new criterion | docs sync gate |
| T-009 | Modularize `page.ts` → `page/` skeleton (pure refactor) | frontend | Backend(lock) | 6 | T-005 | `src/page/**` modules | served HTML byte-diff clean | snapshot diff + route tests |
| T-010 | Visual regression harness + state fixtures | qa | Validation | 4 | T-001 | harness + baseline shots | mobile viewports × 7 states captured | harness self-test + baseline archive |
| T-011 | Scene data contracts + fixtures per tab | backend | Backend | 3 | T-005, T-009 | `contracts/scenes/*.json` + fixtures | each scene's data needs enumerated | fixture render smoke |
| T-012 | Copy rewrite brief (labels, collapsed narrative) | product | Planner | 2 | T-004 | `frozen/copy-brief.md` | every user-facing string accounted for | budget audit |

### Phase 2 — Parallel scene implementation (16)

| id | title | area | owner_role | est_hours | dependencies | deliverable | acceptance | validation |
|---|---|---|---|---|---|---|---|---|
| T-013 | Shared components: MissionGlyph + StateToken | frontend | UI-A | 3 | P1 | `page/components/` | 8 glyph variants, 8 states render | state-matrix screenshots |
| T-014 | Shared components: OrbitProgress + SelectedHalo + SignalRail + PacketFlow | frontend | UI-A | 4 | T-013 | components | match spec incl. reduced-motion | screenshots + motion audit |
| T-015 | Mission scene: hero card + orbit + freshness chip | frontend | UI-A | 4 | T-011, T-013 | `scenes/mission` | matches reference layout; copy within budget | design-fidelity review + shots |
| T-016 | Mission scene: QuestlineTimeline stage tracker | frontend | UI-A | 3 | T-015 | component | 4–6 stages, rail states correct | state-matrix shots |
| T-017 | Gate scene: decision queue as visual stack | frontend | UI-B | 4 | T-011, T-013 | `scenes/gate` | queue scannable without reading paragraphs | shots + fidelity review |
| T-018 | Gate scene: GateActionRow + preflight sheet (visual, kv→Inspect) | frontend | UI-B | 4 | T-017 | sheet component | approve/reroll/confirm in-app; preflight visual not kv wall | signed-action flow test |
| T-019 | Tools scene: replace copyable commands with in-app action surfaces | frontend | UI-B | 5 | T-011 | `scenes/tools` | zero copy-paste command blocks; actions POST via gate client | e2e action test (staging) |
| T-020 | Tools scene: action result feedback (receipt token + state flip) | frontend | UI-B | 2 | T-019 | feedback components | result visible without leaving tab | state-matrix shots |
| T-021 | Story scene: beats as signal rows w/ state tokens | frontend | UI-C | 3 | T-011, T-013 | `scenes/story` | evidence-backed beats, glyph-coded | shots |
| T-022 | Story scene: PacketFlow rails between beats | frontend | UI-C | 2 | T-021 | rails | dots on rails only, never over text | motion audit |
| T-023 | Inspect scene: ProofList founder-readable rows | frontend | UI-C | 3 | T-011 | `scenes/inspect` | raw routes/schemas stay here only | copy budget audit |
| T-024 | Inspect scene: branch map + audit panels (visual map) | frontend | UI-C | 4 | T-023 | map view | branch-map sheet rendered visually | shots vs D1 fixture |
| T-025 | RootNav + BranchArcChip rail (selected halo, one-selection) | frontend | UI-A | 2 | T-013 | nav components | matches reference tab bar + chip rail | shots |
| T-026 | Metric cards: KpiPulse donuts + packet bars | frontend | UI-C | 2 | T-014 | components | donut states 0/25/50/75/100 | state-matrix shots |
| T-027 | Cross-scene: safe-area + `prefers-reduced-motion` pass | qa | Validation | 2 | T-015..T-026 | fixes | iOS/Android viewport matrix clean | viewport harness run |
| T-028 | Cross-scene: text-density enforcement sweep | qa | Validation | 2 | T-015..T-026 | report + fixes | every screen within budget | automated string-count audit |

### Phase 3 — Integration & hardening (10)

| id | title | area | owner_role | est_hours | dependencies | deliverable | acceptance | validation |
|---|---|---|---|---|---|---|---|---|
| T-029 | Integrate scenes into single bundle; resolve collisions | frontend | Planner(lock) | 3 | P2 | integrated `page/` | all scenes coexist; no dup components | full screenshot matrix |
| T-030 | handler.ts serving update (lock zone, serialized) | backend | Backend | 2 | T-029 | route serves new bundle | 401 fail-closed unchanged | route tests + probe |
| T-031 | Full gate run + fix-forward | qa | Validation | 2 | T-030 | green `verify:release` | 5/5 gates | gate transcripts |
| T-032 | Staging deploy + mobile device QA pass | infra | Backend | 2 | T-031 | staging URL QA notes | Telegram WebView render correct on real phone | device screenshots |
| T-033 | Production deploy + health checks | infra | Backend | 1 | T-032 | version @ 100% | per `workers/quests/DEPLOY.md` | evidence JSON |
| T-034 | In-app signed smoke = new founder-device proof | qa | Founder+Planner | 1 | T-033 | redacted receipt | founder taps one gate action in-app; receipt validates | `signed-action-smoke.json` v2 |
| T-035 | Promote proof to `docs/evidence/tg-miniapp/2026-XX/` | infra | Planner | 1 | T-034 | dated evidence dir | README updated; 2026-06-30 marked superseded | docs gates |
| T-036 | ISA.md: new ISC criteria for redesign + close superseded | infra | Planner | 1 | T-035 | ISA entries | changelog entry + criteria checked | docs sync |
| T-037 | Update runbooks referencing retired flow | infra | Planner | 1 | T-035 | edited runbooks | no live doc teaches pasted initData | grep audit |
| T-038 | Wave-close retrospective + v0.4 roadmap reconciliation | product | Planner | 1 | T-036 | closeout note | phases 5–7 re-sequenced if affected | roadmap updated |

## 7. Dependency Rationale

- **Before any parallelism:** contract freeze (T-001–T-008) — the initData retirement is a contract change touching tooling + UI + ISA, so it lands in W1, never as drift.
- **Serialization:** T-009 (page modularization) and T-030 (handler serving) are lock-zone tasks — sole owner, no concurrent edits. All UI parallelism happens *after* T-009 splits the monolith into per-scene modules.
- **Independent tracks:** P2 scenes (Mission/Gate/Tools/Story/Inspect) own disjoint modules under `page/scenes/`; shared components (T-013/T-014) precede all scenes.
- **Integration swarm:** T-029–T-031 absorbs collisions at the P2→P3 boundary; merges happen only at wave boundaries.

## 8. Verification Strategy

- **Per task:** schema `validation` column — screenshots against the reference boards are the primary evidence for UI tasks; tests for contract/tooling tasks.
- **Per wave:** `verify:release` 5/5 + viewport harness matrix (mobile sizes × 7 UI states × reduced-motion on/off) + text-density audit (T-028's automated string counter runs every wave).
- **Design fidelity:** plan-subagent review of screenshots against the frozen specs (`frozen/01`–`04`) and `mission-control-mobile-reference.png` at each P2 wave boundary — state must always be icon + color + rail style, never color or text alone; builders implement the frozen anatomy, not approximations.
- **Regression:** served-HTML snapshot diff after T-009; fail-closed 401 route tests after T-030; signed-action e2e on staging before T-033.
- **Proof:** T-034's in-app smoke produces the first founder-device proof of the new flow — this closes the Phase-4 leftover (ISC-279) *by redesign*, not by the retired ritual.

## 9. GitHub Sync Strategy

- Repo: `Sheshiyer/cambium`. **Created 2026-07-24:** [#266 Phase 1 — Contract & foundation](https://github.com/Sheshiyer/cambium/issues/266) · [#267 Phase 2 — Parallel scene implementation](https://github.com/Sheshiyer/cambium/issues/267) · [#268 Phase 3 — Integration & hardening](https://github.com/Sheshiyer/cambium/issues/268), labels `miniapp-redesign` + `phase-N`. (Milestone creation is not exposed by the connected GitHub MCP — create milestone `miniapp-mobile-redesign` manually in the GitHub UI and attach the three issues if wanted.)
- Wave status posted as issue comments at each boundary (orchestrator duty). PRs state: task IDs, phase/wave/swarm, lock-zone files touched, validation evidence. Task checkboxes in the issues mirror §6 and are checked off as tasks complete.

## 10. Risks and Fallback Plan

| Risk | Trigger | Fallback |
|---|---|---|
| `page.ts` refactor breaks served HTML | T-009 snapshot diff non-empty | revert to monolith; modularize scene-by-scene behind flags |
| Design drift (AI-default aesthetics creep in) | fidelity review failures in P2 | freeze on reference boards; re-run T-001/T-002; swap worker |
| Text-density budget unrealistic for Gate preflight | T-012 audit vs legal/safety copy | preflight keeps a single consequence line + Inspect link; founder adjudicates |
| In-app smoke blocked by WebView limits | T-034 failure on device | fall back to bot-command signed smoke (no pasted initData — still not the old ritual) |
| Scope creep into Phase 5 (Goal Graph intake) | scene work starts wiring intake commits | intake wiring stays in Phase 5; redesign ships read/act surfaces only |
| Reference boards incomplete for Gate/Tools | spec gaps found in T-002 | derive missing patterns from design-system source board; log derivation in spec |
