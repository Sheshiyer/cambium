# Shared Contract Packet — Cambium R3F Visual Engine

## Project Brief

- **Project / feature:** Cambium R3F visual engine.
- **Current phase / wave / swarm:** Phase 1, Wave 1, contract and foundation.
- **Delivery mode:** Prototype implementation with production-grade contract and validation gates.
- **Release model:** Phased rollout through GitHub issues.
- **Quality bar:** Reference parity, nonblank R3F canvas, browser screenshots, reduced motion, accessibility/performance review, existing Cambium checks remain green.

## Frozen Contracts

- **Reference contract:** `docs/plans/assets/cambium-r3f-implementation/reference-freeze.json`
- **Moodboard:** `docs/plans/cambium-r3f-visual-moodboard.md`
- **Screenshot pack:** `docs/plans/cambium-r3f-screenshot-pack.md`
- **Task queue:** `docs/plans/assets/cambium-r3f-implementation/tasks.md`
- **Dispatch plan:** `docs/plans/assets/cambium-r3f-implementation/dispatch-plan.json`

## API / Data Contracts

- Stage nodes: `genesis`, `taste`, `build`, `ops`, `cortex`.
- Progress signal: `ARC X`, `9/17`.
- Scene entities: nodes, rails, packet particles, rings, labels, telemetry panels, material tokens.
- Existing data anchors: `bin/operator/quests/quests.ts`, `bin/quine/hyphae/cortex.ts`, `bin/quine/hyphae/operator.ts`.

## UI Integration Boundaries

- Proposed app surface: `apps/cambium-r3f`.
- Root lock-zone: `package.json`, lockfiles, root CI config. Only `T002` or an explicit integration task may change these.
- Each screen route owns its screen implementation and may not change shared material/camera contracts without escalation.
- Shared material/tokens/camera contracts are owned by `T004` and `T014`.

## Coordination Rules

- One issue -> one owner -> one branch/worktree.
- Merge at wave boundaries unless orchestrator changes the rule.
- Lock-zone files are serialized.
- Contract changes require orchestrator review.
- Each generated image reference must remain one-to-one with its owning issue.

## Active Ownership Map

- Planner / orchestrator: `agent:claude`
- Frontend / app executor: `agent:codex`
- Backend / infra executor: `agent:copilot` only if needed
- Validation reviewer: `agent:gemini`
- Release integrator: planner / orchestrator

## Required Evidence

- Existing repo checks: `npm run validate`, `npm run render-docs:check`, `npm test`.
- App checks after scaffold: install/build/test command defined in `T002`.
- Browser evidence: screenshot per route.
- R3F evidence: canvas nonblank per route.
- Accessibility/performance: reduced-motion proof, keyboard/focus check, no obvious text overlap at mobile and desktop.
