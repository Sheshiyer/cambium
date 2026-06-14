# Cambium R3F Game-Engine Realignment Tasks

| ID | Issue | Title | Acceptance |
| --- | --- | --- | --- |
| R3F-GE-01 | #44 | Triage/spec freeze and reference parity gate | Prior milestone is named as scaffold history; new acceptance criteria reject dashboard-like screens. |
| R3F-GE-02 | #45 | Engine scene architecture | Scene code is split into engine, world, materials, and HUD subsystems. |
| R3F-GE-03 | #46 | Tactical world overview | Home shows connected organ islands, rails, emitters, and current process position. |
| R3F-GE-04 | #49 | Island zoom state | Genesis, Taste, Build, Ops, and Cortex have distinct silhouettes and focused camera behavior. |
| R3F-GE-05 | #47 | Diegetic HUD and settings control bay | HUD is sparse and settings read as renderer/operator controls, not SaaS panels. |
| R3F-GE-06 | #48 | Scene-native visualizations | Flow, heat, dependency, runner, and emitter layers are spatial scene overlays. |
| R3F-GE-07 | #50 | Figma-style design system sheet | Tokens, glyphs, states, controls, and HUD elements render as a component board. |
| R3F-GE-08 | #51 | Electron desktop readiness | Desktop-only viewport and keyboard/mouse assumptions are documented and tested. |
| R3F-GE-09 | #52 | Visual QA screenshot acceptance | Build/test pass, desktop QA policy, and not-dashboard review are documented; browser visual e2e is skipped and final flow acceptance waits for user feedback. |

## Continuation Batches

| ID | Parent Issue | Title | Acceptance |
| --- | --- | --- | --- |
| R3F-GE-CF-01 | #46 / #49 / #52 | CambiumField + generated rail connector integration | The overview no longer uses a checkerboard/gridHelper substrate; islands sit on a living organic field, rails have physical generated-asset connector language, and generated connector assets remain manual-approval-gated. |
| R3F-GE-LF-01 | #46 / #48 / #49 / #52 | Living flow layer and island integration | Generated source-plate prop language appears as procedural scene meshes: signal packets, emitter nodes, process beacon, island ports, local terrain seams, and spatial visualization overlays. |
