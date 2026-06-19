# Cambium R3F Implementation Freeze

This is the execution freeze for turning the accepted Cambium R3F moodboard and screenshot pack into an implemented visual engine. The purpose is to prevent visual drift: every build issue points to the exact generated reference image, prompt, and SHA-256 where applicable.

## Discovery Summary

- **Planning depth:** standard, with swarm-ready issue bodies.
- **Delivery mode:** prototype implementation with production-grade contract and validation gates.
- **Release model:** phased rollout.
- **CI/CD expectation:** basic first, then app build and visual QA added before integration close.
- **Quality bar:** reference parity, browser-rendered screenshots, R3F canvas nonblank checks, reduced-motion behavior, accessibility/performance review, and no regression to existing Cambium tests.
- **Team topology:** planner/orchestrator plus Codex UI implementation, optional Copilot infra assistance, Gemini validation.
- **Repo constraint:** current Cambium repo is a zero-dependency Node/operator repo; no existing React app surface exists.

## Source Of Truth

- Visual moodboard: `docs/plans/cambium-r3f-visual-moodboard.md`
- Screenshot pack: `docs/plans/cambium-r3f-screenshot-pack.md`
- Reference freeze manifest: `docs/plans/assets/cambium-r3f-implementation/reference-freeze.json`
- Shared style prompt: `docs/plans/assets/cambium-r3f-screenshots/prompts/00-shared-style.md`
- Skill-cluster dispatch: `docs/plans/assets/cambium-r3f-implementation/dispatch-plan.json`
- GitHub issue index: `docs/plans/assets/cambium-r3f-implementation/github-issues.md`

## Assumptions And Constraints

- Use an isolated app surface, proposed as `apps/cambium-r3f`, so existing operator code remains stable.
- Root `package.json` and lockfile changes are a lock-zone owned only by the foundation issue.
- Each generated screenshot gets exactly one reference-parity issue.
- No issue may change the visual contract silently. Contract changes go back through `T001`.
- Do not build literal houses, city maps, generic neon AI screens, or HTML-only approximations.
- The visual engine should be R3F-first: planes, curves, rings, extrusions, instanced particles, text labels, and shader-grain material.

## Agent Ownership Model

| Concern | Primary owner | Secondary reviewer | Notes |
|---|---|---|---|
| Planning, issue graph, contract freeze | Planner / orchestrator | Human lead | Owns `T001`, `T017`, wave gates. |
| UI/R3F app implementation | Codex | Planner / orchestrator | Owns scaffold, screens, materials, navigation. |
| Backend/cloud/CI support | Copilot if needed | Planner / orchestrator | Only if CI/deploy work grows beyond app-local scripts. |
| Validation/adversarial review | Gemini | Planner / orchestrator | Owns visual parity and regression challenge. |

## Phase Map

### Phase 1 — Contract And Foundation

**Goal:** freeze references, scaffold the app, define data/material contracts.

**Exit criteria:**
- Reference manifest is committed.
- App scaffold runs locally.
- Stage/node schema and visual tokens exist.
- GitHub issues carry task IDs, branches, worktrees, references, and validation.

### Phase 2 — Reference-Parity Screen Build

**Goal:** implement every generated screen as a routed R3F/UI surface against its frozen reference.

**Exit criteria:**
- Home, five islands, settings, visualizations, and component board render.
- Each screen has a reference checklist and browser screenshot proof.
- Shared navigation/camera contract remains unchanged or is escalated.

### Phase 3 — Integration, QA, And Hardening

**Goal:** integrate navigation, validate visual parity, harden performance/accessibility, and close the wave.

**Exit criteria:**
- Visual QA artifacts exist for every route.
- Existing `npm run validate`, `npm run render-docs:check`, and `npm test` still pass.
- App build/test scripts pass.
- GitHub issues have evidence and handoff notes.

## Detailed Wave Layout

### Wave 1 — Freeze And Foundation

| Swarm | Tasks | Owner | Output | Gate |
|---|---|---|---|---|
| Contract | `T001` | Planner/orchestrator | Frozen references, issue graph, contract packet | No screen implementation starts before this is accepted. |
| App foundation | `T002` | Codex | Isolated Vite/R3F app scaffold | App starts and root tests remain green. |
| Data contract | `T003` | Codex | Static scene model/data adapter | Data shape can render current arc, stages, nodes, packets. |
| Visual system | `T004` | Codex + design review | Tokens, materials, glyph metadata | Palette/motion constraints match Cortex contracts. |

### Wave 2 — Reference-Parity Screens

| Swarm | Tasks | Owner | Output | Gate |
|---|---|---|---|---|
| Overview | `T005` | Codex | Home overview route | Browser screenshot compared to frozen home reference. |
| Islands | `T006`-`T010` | Codex | Genesis/Taste/Build/Ops/Cortex routes | Each route references exactly one frozen image. |
| Controls and visualizations | `T011`-`T013` | Codex | Settings, visualizations, component board | Controls/states/components match references without drift. |

### Wave 3 — Integration And Validation

| Swarm | Tasks | Owner | Output | Gate |
|---|---|---|---|---|
| Navigation | `T014` | Codex | Shared route/camera/detail flow | No frozen reference contracts changed. |
| Visual QA | `T015` | Gemini / validation | Screenshot and canvas validation evidence | Every route has proof artifacts. |
| Hardening | `T016` | Codex | Performance, a11y, reduced-motion, CI | Existing and new checks pass. |
| Closeout | `T017` | Planner/orchestrator | Issue/PR handoff, wave summary | All evidence linked; residual risk explicit. |

## Reference-Parity Issue Map

| Task | Screen | Frozen image | SHA-256 |
|---|---|---|---|
| `T005` | Home overview | `docs/plans/assets/cambium-r3f-screenshots/images/home.png` | `516167ad28184402e7ee074b50626a8175eaa47a53ee623d759f9055d857224a` |
| `T006` | Genesis island | `docs/plans/assets/cambium-r3f-screenshots/images/island-genesis.png` | `7f679e562fe49aff8b9b97764b0e90bea7d4a3a5a2c657072adca54f61a0d7d6` |
| `T007` | Taste island | `docs/plans/assets/cambium-r3f-screenshots/images/island-taste.png` | `22d04df88eebe88506979fd392ea9fc4c2ad9215a0a724695adadd47a779c8b5` |
| `T008` | Build island | `docs/plans/assets/cambium-r3f-screenshots/images/island-build.png` | `9d0cb0c05ae6e2c7ce44b919229b0f0eee96bd1e9e34cfb08f1933e1ff6ebc14` |
| `T009` | Ops island | `docs/plans/assets/cambium-r3f-screenshots/images/island-ops.png` | `cce1395f774a1730447b122d97d6186317edff6a3d102450c0cf9fc21b434f11` |
| `T010` | Cortex island | `docs/plans/assets/cambium-r3f-screenshots/images/island-cortex.png` | `8713e27bda4914b49e0e72806566752f6113f93e94f46065a8c592b361ec12b9` |
| `T011` | Elements/settings | `docs/plans/assets/cambium-r3f-screenshots/images/elements-settings.png` | `6e4eda932c87b435cd73d78ea624d1ea2575435c920b8afe6833ffa12a1c59cf` |
| `T012` | Visualizations | `docs/plans/assets/cambium-r3f-screenshots/images/visualizations.png` | `dce39ebaad9fe1ab8df7032e90cb75b828a5725a4520cedd8f7a081397c9c804` |
| `T013` | Figma-style components | `docs/plans/assets/cambium-r3f-screenshots/images/figma-components.png` | `aaef9b5a40b3da2a08069216306e0619ae920f3025aa951a7dabff25490a033f` |

## Skill-Cluster Dispatch

Validated with:

```bash
node ~/private/.agents/skill-clusters/scripts/resolve-task.mjs \
  docs/plans/assets/cambium-r3f-implementation/tasks.md \
  docs/plans/cambium-r3f-screenshot-pack.md \
  --json \
  --modality github-delivery \
  --propose docs/plans/assets/cambium-r3f-implementation/cluster-proposals.json
```

Result:

- **Modality:** `github-delivery`
- **Planning orchestrator:** `swarm-architect`
- **Execution orchestrator:** `github-next-wave-orchestrator`
- **Touched clusters:** `ai-agents-meta`, `frontend-web`, `design`, `creative-frontend`, `browser-automation`, `git-pr-ops`
- **Deferred activations:** none
- **Unresolved / phantoms / bad skills:** none

## GitHub Sync Strategy

- Create one milestone: `Cambium R3F Visual Engine`.
- Create one GitHub issue per task `T001`-`T017`.
- Use labels: `initiative:r3f-visual-engine`, phase/wave/swarm labels, `area:*`, `agent:*`, and `status:planned`.
- Every issue body must include branch/worktree, dependencies, lock zones, frozen references, and validation evidence requirements.
- PRs must close or reference exactly one owning issue unless the work is an explicit integration issue.
- Materialized issue URLs are recorded in `docs/plans/assets/cambium-r3f-implementation/github-issues.md`.

## Verification Strategy

- Existing checks: `npm run validate`, `npm run render-docs:check`, `npm test`.
- App checks to add in `T002`/`T016`: app build, route smoke, browser screenshot capture.
- R3F checks: canvas nonblank, route screenshot exists, reduced-motion state disables loops, no visual overlap at desktop/mobile.
- Reference checks: each route has a checklist against its frozen image and prompt.

## Risks And Fallbacks

- **Risk:** R3F dependencies disturb the zero-dependency root package.  
  **Fallback:** keep the app isolated under `apps/cambium-r3f` and serialize root script changes in `T002`.
- **Risk:** generated references are too detailed to reproduce exactly in the first implementation.  
  **Fallback:** define parity levels: structure, palette, glyph vocabulary, route/state readability, then material polish.
- **Risk:** parallel screen work drifts the shared material/camera contract.  
  **Fallback:** block screen work behind `T004` and escalate contract edits back to `T001`.
- **Risk:** visual QA becomes subjective.  
  **Fallback:** require screenshot proof, canvas nonblank checks, and a route-by-route reference checklist.
