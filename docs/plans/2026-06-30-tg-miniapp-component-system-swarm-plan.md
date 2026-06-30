# TG Mini App Component System Swarm Plan

Date: 2026-06-30
Status: planned
Repo: `Sheshiyer/cambium`
Planner: `swarm-architect`
Scope: Cambium Telegram mini app Mission Control UI, component-system rebuild, page-by-page execution tracking.

## Discovery Summary

- Planning depth: deeply detailed.
- Delivery mode: production hardening for a live Worker mini app.
- Release model: phased rollout with wave-boundary integration.
- CI/CD expectation: production-grade local gates plus viewport proof and live readiness honesty.
- Team topology: small multi-agent squad.
- Primary planner / orchestrator: Claude / noesisX.
- UI / app implementation owner: Codex.
- Backend / cloud owner: Copilot only if Worker, API, CI, or deploy plumbing changes become necessary.
- Validation owner: Gemini-style validation reviewer or Codex validation pass when no separate reviewer is available.
- Primary lock zones: `workers/quests/src/page.ts`, `workers/quests/src/handler.test.ts`, `workers/quests/src/visual-viewport-proof.mjs`, `workers/quests/src/live-proof-readiness.test.ts`.
- Current boundary: `ISA.md` remains local/untracked and is not part of this UI swarm.

## Source Contracts

- Component vocabulary: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/component-map.md`
- Reference board: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/images/01-component-glyph-state-board.png`
- Mobile state stack: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/images/02-mission-control-state-stack-mobile.png`
- Motion storyboard: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/images/03-motion-storyboard-mobile.png`
- Design spec: `docs/superpowers/specs/2026-06-29-tg-miniapp-mission-control-design.md`
- Visual organ contract: `shared/cambium-visual-contract.ts`
- Runtime mini app surface: `workers/quests/src/page.ts`

## GitHub Issues

Component foundation gate:

| Component layer | Issue range | Phase | Wave | Owner | Scope |
| --- | --- | --- | --- | --- | --- |
| Shared primitives | https://github.com/Sheshiyer/cambium/issues/200 through https://github.com/Sheshiyer/cambium/issues/219 | P1 | W1 | Codex | Build reusable code for glyphs, state tokens, orbit progress, rails, packets, mission composites, Gate actions, and motion primitives before page execution |

Page epics:

| Page | Issue | Phase | Wave | Owner | Scope |
| --- | --- | --- | --- | --- | --- |
| Mission | https://github.com/Sheshiyer/cambium/issues/95 | P2 | W2 | Codex | Organ-driven glyph state stack |
| Gate | https://github.com/Sheshiyer/cambium/issues/96 | P2 | W3 | Codex | Branch decision chamber |
| Tools | https://github.com/Sheshiyer/cambium/issues/97 | P3 | W1 | Codex | Operator toolbelt |
| Story | https://github.com/Sheshiyer/cambium/issues/98 | P3 | W2 | Codex | Mission progress feed |
| Inspect | https://github.com/Sheshiyer/cambium/issues/99 | P3 | W3 | Codex | Proof/debug layer |

Issue body artifacts:

- `docs/plans/2026-06-30-tg-miniapp-component-foundation-plan.md`
- `docs/plans/assets/tg-miniapp-component-system-swarm/component-foundation-issues.json`
- `docs/plans/assets/tg-miniapp-component-system-swarm/issues/issue-mission.md`
- `docs/plans/assets/tg-miniapp-component-system-swarm/issues/issue-gate.md`
- `docs/plans/assets/tg-miniapp-component-system-swarm/issues/issue-tools.md`
- `docs/plans/assets/tg-miniapp-component-system-swarm/issues/issue-story.md`
- `docs/plans/assets/tg-miniapp-component-system-swarm/issues/issue-inspect.md`

## Assumptions And Constraints

- The first UI pass fixed flow, stale live deploy, action-row placement, and basic component markers, but it did not complete the component-system visual grammar.
- The next work must not change signed Gate semantics, Telegram auth validation, product-branch packet schema, or live-readiness truth boundaries.
- `page.ts` is a global app-shell lock zone. Only one page implementation issue may edit it at a time unless an integration issue explicitly owns the merge.
- Branch stories and `shared/cambium-visual-contract.ts` are the data-to-visual source for organ identity.
- Primary pages may not expose raw architecture copy; Inspect owns source/schema/proof/debug vocabulary.
- Viewport proof is required for page completion. Live readiness may remain `8/10` until founder Telegram `initData` and redacted device proof exist.

## Agent Ownership Model

| Concern | Primary owner | Reviewer | Notes |
| --- | --- | --- | --- |
| Plan, issue graph, wave close | Planner / orchestrator | Human lead | Owns dependency decisions and issue sync |
| Component primitives and pages | Codex | Planner / orchestrator | Owns `page.ts`, page tests, screenshots |
| Worker/API/deploy plumbing | Copilot or Codex integration task | Planner / orchestrator | Only if page work exposes backend gaps |
| Regression and adversarial validation | Validation reviewer | Planner / orchestrator | Owns copy denylist, no-overclaim, viewport review |
| Release integration | Planner / orchestrator | Human lead | Confirms staged bundle, deploy readiness, remaining blockers |

## Phase Map

### Phase 1 - Contract Freeze And Foundations

Goal: freeze and build component primitives, organ-state mapping, copy containment, proof fixture expectations, and page lock-zone ownership before page work starts.

Exit criteria:

- Component primitive contract is explicit and tracked in GitHub issues #200-#219.
- Shared component code exists for glyphs, state tokens, orbit progress, rails, packets, mission composites, Gate actions, and motion primitives before page issues #100-#199 consume it.
- Organ-state adapter rules are explicit.
- Page ownership and sequencing are explicit.
- Copy denylist is scoped to primary pages.
- Viewport proof expectations are updated.

### Phase 2 - Mission And Gate Core Surfaces

Goal: rebuild the two highest-trust surfaces first: Mission and Gate.

Exit criteria:

- Mission page visually matches the component-system state-stack direction.
- Gate page reads as a founder decision chamber.
- Mission actions open the correct sheets and remain non-floating.
- Blocked/proof-only work never looks ready.

### Phase 3 - Tools, Story, And Inspect

Goal: complete the secondary page set so the whole five-scene app follows the new grammar.

Exit criteria:

- Tools is a mission-aware operator toolbelt.
- Story is a mission progress feed.
- Inspect contains proof/debug architecture language intentionally.
- Primary-page copy containment holds across Mission, Gate, Tools, and Story.

### Phase 4 - Integration, Proof, And Live Boundary

Goal: integrate page work, regenerate screenshots, run local gates, deploy only after proof passes, and keep live readiness honest.

Exit criteria:

- Focused tests pass.
- `npm run proof:tg-viewport` passes and screenshots are inspected.
- `npm run validate`, `npm run validate:product-branches`, and `npm test` pass.
- `npm run proof:tg-live-readiness` stays accurate.
- Production probe confirms current UI markers after deploy.

### Phase 5 - Handoff, Wave Close, And Dispatch Packets

Goal: leave next-worker packets and wave-close notes so each issue can be executed in isolated worktrees without re-deriving the plan.

Exit criteria:

- Each issue has owner, branch, worktree, allowed edit surface, acceptance, and validation.
- Wave close notes capture completed, deferred, blocked, and validation evidence.
- Any remaining risks are named explicitly.

## Detailed Phase 1 Wave Layout

### Wave 1 - Contract Freeze

Swarm A - Component Primitive Contract

- Owner: planner / orchestrator.
- Inputs: component map, reference images, current `mc-` helpers.
- Outputs: issue-backed component code plan for `MissionGlyph`, `StateToken`, `OrbitProgress`, `SignalRail`, `PacketFlow`, `SelectedHalo`, `BranchArcChip`, `MissionCard`, `QuestlineTimeline`, `ProofList`, `KpiPulse`, `GateActionRow`, and motion primitives.
- Validation: GitHub issues #200-#219 exist, page issues #100-#199 are documented as downstream consumers, and no placeholder glyph regression check is assigned to page work alone.

Swarm A1 - Component Code Foundation

- Owner: Codex.
- Inputs: `docs/plans/2026-06-30-tg-miniapp-component-foundation-plan.md`, component map, prompts, reference images, current `workers/quests/src/page.ts` helpers.
- Outputs: reusable code primitives and proof fixture/gallery before Mission, Gate, Tools, Story, and Inspect page execution.
- Validation: component proof surface renders every primitive and page work consumes the shared API instead of forking visual logic.

Swarm B - Organ-State Routing Contract

- Owner: planner / orchestrator.
- Inputs: `shared/cambium-visual-contract.ts`, branch stories, current `stageForArc`.
- Outputs: branch/mission arc -> organ -> glyph/state mapping rules.
- Validation: handler tests for branch chips and questline stages using organ-derived glyphs.

### Wave 2 - Page Integration Boundaries

Swarm A - Page Lock-Zone Boundaries

- Owner: planner / orchestrator.
- Inputs: `page.ts` render functions, current tests, viewport proof script.
- Outputs: serialized page order: Mission, Gate, Tools, Story, Inspect.
- Validation: issue bodies include one branch/worktree and allowed edit surface.

Swarm B - Copy Containment Contract

- Owner: validation reviewer.
- Inputs: design spec copy policy, current primary UI strings.
- Outputs: primary-page denylist and Inspect allowlist.
- Validation: copy-denylist tests for primary pages excluding Inspect/detail sheets.

### Wave 3 - Proof And Dispatch Readiness

Swarm A - Viewport Proof Contract

- Owner: validation reviewer.
- Inputs: existing `visual-viewport-proof.mjs`, proof fixture, screenshots.
- Outputs: page-specific screenshot list and wait selectors.
- Validation: `npm run proof:tg-viewport` manifest includes Mission, Gate, Tools, Story, Inspect.

Swarm B - GitHub Dispatch Contract

- Owner: planner / orchestrator.
- Inputs: Swarm Architect templates and GitHub sync playbook.
- Outputs: five GitHub issues plus reproducible issue body files.
- Validation: `gh issue list` returns issues #95-#99 with labels.

## Full Task List

| ID | Phase/Wave | Issue | Owner | Dependencies | Deliverable | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| TG-MC-001 | P1/W1 | plan | orchestrator | none | Freeze primitive inventory from `component-map.md` | Reference list matches component map |
| TG-MC-002 | P1/W1 | plan | orchestrator | 001 | Define real `MissionGlyph` variant contract | Glyph variants listed in plan/tests |
| TG-MC-003 | P1/W1 | plan | orchestrator | 001 | Define `StateToken` state taxonomy | States include idle/active/selected/complete/blocked/locked/stale/reducedMotion |
| TG-MC-004 | P1/W1 | plan | orchestrator | 001 | Define `OrbitProgress` rendering states | Active/complete/blocked/stale/pending rules named |
| TG-MC-005 | P1/W1 | plan | orchestrator | 001 | Define `SignalRail` and `PacketFlow` states | Rail state matrix exists |
| TG-MC-006 | P1/W1 | plan | orchestrator | 001 | Define `SelectedHalo` single-focus rule | No competing selected highlights allowed |
| TG-MC-007 | P1/W1 | plan | orchestrator | 001 | Define `KpiPulse` orbit/bar structure | KPI pulse acceptance references orbit plus bars |
| TG-MC-008 | P1/W1 | plan | orchestrator | 001 | Define reduced-motion fallback behavior | Static state remains visible |
| TG-MC-009 | P1/W1 | plan | orchestrator | 001 | Define warning attention behavior | Warning appears once then rests |
| TG-MC-010 | P1/W1 | plan | orchestrator | 001 | Define no-placeholder glyph regression rule | Tests reject character-only glyphs |
| TG-MC-011 | P1/W1 | plan | orchestrator | 002 | Map `genesis` organ to branch/stage glyph | Contract references visual stage |
| TG-MC-012 | P1/W1 | plan | orchestrator | 002 | Map `taste` organ to branch/stage glyph | Contract references visual stage |
| TG-MC-013 | P1/W1 | plan | orchestrator | 002 | Map `build` organ to branch/stage glyph | Contract references visual stage |
| TG-MC-014 | P1/W1 | plan | orchestrator | 002 | Map `ops` organ to branch/stage glyph | Contract references visual stage |
| TG-MC-015 | P1/W1 | plan | orchestrator | 002 | Map `cortex` organ to branch/stage glyph | Contract references visual stage |
| TG-MC-016 | P1/W2 | plan | validation | 003 | Freeze primary-page copy denylist | Denylist excludes Inspect/detail sheets |
| TG-MC-017 | P1/W2 | plan | validation | 016 | Freeze Inspect copy allowlist | Inspect can show source/schema/proof/debug |
| TG-MC-018 | P1/W2 | plan | orchestrator | 016 | Freeze page sequencing and lock zones | Page order and `page.ts` lock zone documented |
| TG-MC-019 | P1/W3 | plan | validation | 018 | Freeze viewport screenshot expectations | Screenshot list covers five pages |
| TG-MC-020 | P1/W3 | plan | orchestrator | 018 | Create GitHub issue bodies and labels | Issues #95-#99 exist |
| TG-MC-021 | P2/W2 | #95 | codex | 001-020 | Replace placeholder `mcGlyphSvg` with reusable primitives | Handler test detects real glyph markup |
| TG-MC-022 | P2/W2 | #95 | codex | 021 | Add organ-state adapter helper | Tests prove arc -> organ -> glyph mapping |
| TG-MC-023 | P2/W2 | #95 | codex | 022 | Rework branch chips with organ-derived glyphs | Mission fixture shows four branch chips |
| TG-MC-024 | P2/W2 | #95 | codex | 022 | Rework questline as four-to-six connected stages | Screenshot shows readable stage sequence |
| TG-MC-025 | P2/W2 | #95 | codex | 021 | Upgrade `MissionCard` map/rail texture | Mission screenshot shows active organ signal |
| TG-MC-026 | P2/W2 | #95 | codex | 021 | Upgrade `MissionStateStack` tokens | State stack rows have distinct state treatment |
| TG-MC-027 | P2/W2 | #95 | codex | 021 | Rework `ProofList` copy and glyphs | Raw source/schema absent from primary proof rows |
| TG-MC-028 | P2/W2 | #95 | codex | 021 | Rework `KpiPulse` orbit/bar UI | KPI screenshot shows orbit and packet bars |
| TG-MC-029 | P2/W2 | #95 | codex | 027 | Preserve non-floating action row | No sticky/fixed action row regression |
| TG-MC-030 | P2/W2 | #95 | codex | 029 | Preserve Gate/Proof sheet click handlers | Gate/proof buttons open branch mission sheets |
| TG-MC-031 | P2/W2 | #95 | validation | 021-030 | Add Mission no-overclaim assertions | Blocked/proof-only never renders ready |
| TG-MC-032 | P2/W2 | #95 | validation | 021-031 | Regenerate Mission screenshots | `mission-control-mobile.png` and `mission-actions-mobile.png` pass inspection |
| TG-MC-033 | P2/W3 | #96 | codex | 021-032 | Rebuild Gate empty chamber | Empty state has Gate glyph/state stack |
| TG-MC-034 | P2/W3 | #96 | codex | 033 | Rebuild Gate item cards | Cards show branch/mission/proof/consequence |
| TG-MC-035 | P2/W3 | #96 | codex | 034 | Add Gate warning aperture treatment | Blocked rows use peach warning not success |
| TG-MC-036 | P2/W3 | #96 | codex | 034 | Preserve signed approve/reroll preflight | Signed action tests remain green |
| TG-MC-037 | P2/W3 | #96 | codex | 034 | Move route/idempotency copy to sheets | Primary Gate copy denylist passes |
| TG-MC-038 | P2/W3 | #96 | codex | 035 | Add Gate attention reduced-motion fallback | Static warning state remains legible |
| TG-MC-039 | P2/W3 | #96 | validation | 033-038 | Regenerate Gate screenshots | Empty/consequence/preflight screenshots pass |
| TG-MC-040 | P2/W3 | #96 | validation | 033-039 | Verify Mission -> Gate handoff | Review Gate opens Gate-focused branch sheet |
| TG-MC-041 | P3/W1 | #97 | codex | 021-032 | Rename Commands primary surface to Tools | Nav/headings use Tools consistently |
| TG-MC-042 | P3/W1 | #97 | codex | 041 | Group tools into Act/Ask/Report/Coordinate | Tools cards grouped by mission effect |
| TG-MC-043 | P3/W1 | #97 | codex | 042 | Add tool glyph/state treatment | Tool cards show availability state |
| TG-MC-044 | P3/W1 | #97 | codex | 042 | Keep exact command syntax in details | Copy/click behavior remains intact |
| TG-MC-045 | P3/W1 | #97 | codex | 042 | Move command source copy to sheets | `paperclipCommandsData` absent from primary Tools |
| TG-MC-046 | P3/W1 | #97 | validation | 041-045 | Regenerate Tools screenshots | `tools-mobile.png` and command sheet pass |
| TG-MC-047 | P3/W2 | #98 | codex | 021-032 | Define Story group renderer | Groups: Mission wins/New signals/Lessons/Drift |
| TG-MC-048 | P3/W2 | #98 | codex | 047 | Convert beats to branch progress cards | Primary cards favor branch progress |
| TG-MC-049 | P3/W2 | #98 | codex | 047 | Add drift state treatment | Stale/missing/contradictory rows are non-success |
| TG-MC-050 | P3/W2 | #98 | codex | 047 | Move source/proof detail to sheets | Primary Story copy denylist passes |
| TG-MC-051 | P3/W2 | #98 | codex | 047 | Add links to Mission/Gate/Inspect context | Beat actions route correctly |
| TG-MC-052 | P3/W2 | #98 | validation | 047-051 | Regenerate Story screenshot | `story-feed-mobile.png` passes inspection |
| TG-MC-053 | P3/W3 | #99 | codex | 041-052 | Rename old Map primary surface to Inspect | Nav/headings use Inspect consistently |
| TG-MC-054 | P3/W3 | #99 | codex | 053 | Group Inspect proof/debug sections | Groups include freshness/policy/live proof/branch packets/gates/tools/rails/evidence |
| TG-MC-055 | P3/W3 | #99 | codex | 054 | Preserve organ/rail details as proof layer | Visual contract remains inspectable |
| TG-MC-056 | P3/W3 | #99 | codex | 054 | Add stale envelope and branch-story diagnostics | Inspect explains missing/stale branch data |
| TG-MC-057 | P3/W3 | #99 | codex | 054 | Link primary pages into relevant Inspect sheets | Details/Proof links resolve |
| TG-MC-058 | P3/W3 | #99 | codex | 054 | Remove operator-map copy from primary nav | Old surface copy contained to details |
| TG-MC-059 | P3/W3 | #99 | validation | 053-058 | Regenerate Inspect screenshots | Inspect live/policy/branch proof screenshots pass |
| TG-MC-060 | P3/W3 | #99 | validation | 053-059 | Verify live readiness remains honest | `proof:tg-live-readiness` still reports real blockers |
| TG-MC-061 | P4/W1 | integration | orchestrator | 021-060 | Merge page work at wave boundary | No lock-zone conflicts remain |
| TG-MC-062 | P4/W1 | integration | validation | 061 | Run focused handler tests | Page-specific patterns pass |
| TG-MC-063 | P4/W1 | integration | validation | 061 | Run live-readiness tests | Live readiness assertions pass |
| TG-MC-064 | P4/W1 | integration | validation | 061 | Run `npm run validate` | Registry/pipeline valid |
| TG-MC-065 | P4/W1 | integration | validation | 061 | Run `validate:product-branches` | Product branch packets validate |
| TG-MC-066 | P4/W1 | integration | validation | 061 | Run `npm test` | Full suite passes |
| TG-MC-067 | P4/W2 | integration | validation | 061 | Run `proof:tg-viewport` | Manifest and screenshots regenerate |
| TG-MC-068 | P4/W2 | integration | validation | 067 | Visual inspect all five page screenshots | Screens match component-system references |
| TG-MC-069 | P4/W2 | integration | validation | 067 | Run proof artifact secret scan | No secrets in proof artifacts |
| TG-MC-070 | P4/W2 | integration | orchestrator | 067 | Update viewport proof README | New screenshots documented |
| TG-MC-071 | P4/W3 | integration | orchestrator | 062-070 | Dry-run Worker deploy | Wrangler dry-run succeeds |
| TG-MC-072 | P4/W3 | integration | orchestrator | 071 | Deploy Worker if approved by gates | Worker deploy succeeds |
| TG-MC-073 | P4/W3 | integration | validation | 072 | Probe live Mission page markers | Live HTML shows current components |
| TG-MC-074 | P4/W3 | integration | validation | 072 | Probe old marker absence | No old sticky/go(1)/quest-log markers |
| TG-MC-075 | P4/W3 | integration | validation | 072 | Re-run live readiness after deploy | Remaining blockers are Telegram/device only |
| TG-MC-076 | P5/W1 | handoff | orchestrator | 061-075 | Post wave summaries to page issues | Each issue has status and evidence comment |
| TG-MC-077 | P5/W1 | handoff | orchestrator | 076 | Write next-worker bootstrap packet | Worker can start from issue branch/worktree |
| TG-MC-078 | P5/W1 | handoff | orchestrator | 076 | Record deferred risks | Deferred list names blockers, not vague notes |
| TG-MC-079 | P5/W1 | handoff | orchestrator | 076 | Stage reproducible docs and issue artifacts | Plan and issue bodies staged, `ISA.md` untouched |
| TG-MC-080 | P5/W1 | handoff | orchestrator | 076-079 | Final release handoff summary | User gets issue links, checks run, remaining blockers |

## Dependency Rationale

- Phase 1 must precede page implementation because the same component primitives and `page.ts` lock zone affect every page.
- Mission precedes Gate because Gate action sheets and page navigation consume Mission branch/mission context.
- Tools and Story can start after Mission primitives are stable, but they should not edit `page.ts` concurrently.
- Inspect should be last among primary pages because it absorbs architecture/debug copy displaced from the other pages.
- Integration and deploy work must wait until all page screenshots and no-overclaim checks pass.

## Verification Strategy

Task-level evidence:

- `node --test --test-name-pattern ... workers/quests/src/handler.test.ts`
- `node --test workers/quests/src/live-proof-readiness.test.ts`
- `npm run proof:tg-viewport`
- visual inspection of regenerated PNGs
- `npm run validate`
- `npm run validate:product-branches`
- `npm test`
- `git diff --check`
- proof artifact secret scan
- live `curl` marker checks after deploy

Wave-level evidence:

- P1: plan, issues, labels, and lock-zone boundaries exist.
- P2: Mission and Gate screenshots match component-system references and click flows remain correct.
- P3: Tools, Story, and Inspect primary copy containment passes.
- P4: local gates and viewport proof pass; live readiness remains honest.
- P5: issue comments and handoff notes capture evidence and deferred risks.

## GitHub Sync Strategy

- One page issue per primary app page.
- Page issues use one owner, one branch, one worktree.
- Dependencies are encoded in issue bodies because GitHub dependency tooling may not be enabled.
- Wave summaries should be posted as issue comments at start and close.
- PRs must reference the owning issue and include validation evidence.
- Labels use `phase:*`, `wave:*`, `swarm:ui`, `area:frontend`, `agent:codex`, `status:planned`, `tg-miniapp`, `mission-control`, and `page:*`.

## Worker Bootstrap Packet Strategy

Every worker session should start from the corresponding issue body file and load:

- this plan,
- the page issue body,
- `component-map.md`,
- the relevant reference image,
- `workers/quests/src/page.ts`,
- `workers/quests/src/handler.test.ts`,
- `workers/quests/src/visual-viewport-proof.mjs`,
- and `shared/cambium-visual-contract.ts` when the page touches organ routing.

Default branch/worktree pattern:

- Branch: `swarm/tg-miniapp/<phase>-<wave>/ui/<task-id>-codex`
- Worktree: `.worktrees/<task-id>-codex`

Worker completion comment must include:

1. summary of changes,
2. validation evidence,
3. PR/commit link,
4. lock-zone files touched,
5. contract changes or confirmation of no drift,
6. next dependency unlocked.

## Risks And Fallback Plan

| Risk | Trigger | Fallback |
| --- | --- | --- |
| `page.ts` lock-zone conflict | Two page issues edit shell/render helpers at once | Stop, merge at wave boundary, create integration task |
| Placeholder glyphs remain | Screenshots still look like text symbols | Block page issue until real `MissionGlyph` primitives land |
| Primary copy leaks architecture | Denylist appears in Mission/Gate/Tools/Story | Move copy to Inspect/detail sheets and add regression test |
| Proof gaps look successful | Blocked/proof-only state renders as ready | Add no-overclaim tests and warning state visual |
| Viewport proof drifts | Screenshot wait selectors pass but pixels are wrong | Add pixel/visual inspection notes before closing issue |
| Live readiness overclaim | Missing Telegram/device proof is hidden | Keep `proof:tg-live-readiness` blocker rows unchanged |
| Issue scope too broad | A page issue needs backend or deploy changes | Split backend/cloud change into a new issue before execution |

## Execution Recommendation

Execute in this order:

1. `TG-MC-101` Mission page.
2. `TG-MC-102` Gate page.
3. `TG-MC-103` Tools page.
4. `TG-MC-104` Story page.
5. `TG-MC-105` Inspect page.
6. Phase 4 integration and deploy proof.

Do not run more than one `page.ts` implementation issue in parallel unless a dedicated integration branch owns the merge.
