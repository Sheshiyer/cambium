# Spec — Constellation App Usability (the app must actually work)

Date: 2026-07-21
Status: executing
Parent: `2026-07-21-ui-prune-constellation-convergence.md` · Visual targets: `assets/constellation-ui-reference/`

## Goal

A person (founder today, team/consultant as RBAC opens) can run the Cambium app and actually *use* it: see the living venture as a constellation, drill into organs, read real quest/memory state in sheets, change real settings, and find the knowledge to operate it — with nothing on screen that is fake, dead, or decorative.

## Acceptance criteria (binary)

1. **Pruned dock** — route dock shows exactly `MAP · GENESIS · TASTE · BUILD · OPS · CORTEX`; `elements-settings`, `figma-components`, `asset-comparison` unreachable except via `?dev=1`; all tests updated and green.
2. **Constellation is home** — `home` renders `ConstellationMapField` as the primary overview; hub click navigates to the matching island screen; layout driven by a real tapestry snapshot file with fixture fallback; canonical organ glyphs (star/capsule/triangle/slab/wheel) distinguish hubs.
3. **Sheets mounted** — selecting a map subsection opens `SceneSheet` in flat camera; island instruments hydrate from the sheet-row adapter instead of `routeDrafts.panels` strings for the five island screens.
4. **Settings that work** — a SETTINGS sheet (gear in the HUD) controls: reduced motion (wired to the existing media-query policy), camera default, tenant selector (demo-org + any local tenant), worker base URL. Every control changes live behavior; none are decorative.
5. **Knowledge in-app** — a KNOWLEDGE sheet surfaces the operator runbook: how to boot (`r3f:dev`, demo tenant, tapestry snapshot), where docs live, what each mode does. Content sourced from committed docs (README quick start + plans/README), not invented.
6. **Mode pill** — `MAP | SHEETS | WORKFORCE` pill exists in the HUD; MAP and SHEETS work per 2–3; WORKFORCE shows a principals placeholder sheet wired to the worker `surface` envelope shape (RBAC UI lands fully in C4/C5, this spec only makes the mode honest about its state).
7. **Runbook** — `docs/adopters/run-the-app.md`: boot the app + worker + demo tenant from a clean clone in <5 minutes; verified by following it.
8. **No regressions** — root `npm test`, `r3f:test`, `r3f:build` green; screenshots of MAP + node view + SHEETS captured as evidence.

## Non-goals

- Full C4 identity/login and C5 gate round-trip (next spec).
- Pixel parity with reference images (direction, not gate).
- New organs, new backend endpoints.

## Execution waves

| Wave | Item | Rail | Files owned |
|---|---|---|---|
| A | C1 prune | inline | route-registry.ts, tests |
| B | C2 constellation home | Codex subagent | CambiumScene.tsx, world/* |
| B | C3 sheets + instruments | Codex subagent | SceneHud.tsx, SceneSheet.tsx, scene-data.ts |
| B | C4-settings + C5-knowledge sheets | command-code external | new files only |
| C | runbook + verification | inline | docs/adopters/, screenshots |
