# Cambium R3F Game-Engine Realignment

## Decision

The previous `Cambium R3F Visual Engine` milestone remains a completed technical scaffold. It proved an isolated Vite/R3F package, source-contract generation, route wiring, and screenshot automation, but it did not satisfy the intended visual direction.

This wave replaces the scene layer with a tactical-map game-engine interface for desktop and future Electron packaging.

## Target Experience

- Widescreen desktop tactical map, not mobile web layout.
- 2.5D overview where Cambium organs are sculptural islands connected by signal rails.
- Zoomed island states that feel like entering local engine spaces, not opening pages.
- Sparse diegetic HUD with telemetry, camera modes, and process position.
- Settings as a control bay for renderer/material/emitter/camera choices.
- Visualizations as scene-native layers: flow, heat, dependency, runner, and background emitters.

## Implementation Wave

1. Freeze the correction and new acceptance criteria.
2. Split R3F internals into engine, world, materials, and HUD responsibilities.
3. Build the tactical overview with authored islands, rails, particles, and current-position beacon.
4. Build focused island camera states for Genesis, Taste, Build, Ops, and Cortex.
5. Rebuild elements/settings, visualizations, and component-board routes as spatial modes.
6. Add desktop-only visual QA, screenshot contact sheets, and a reference-parity checklist.
7. Prepare Electron-readiness notes without starting native packaging in this wave.

## Anti-Regression Gates

- No route may rely on stacked dashboard cards as its primary experience.
- The HUD must be secondary to the scene and must not occupy the dominant composition.
- The home route must show a connected tactical organism with visible user/process position.
- Every island needs a distinct silhouette, material role, and camera target.
- Mobile screenshots are deprecated for this work; use laptop/macOS-style viewports.
