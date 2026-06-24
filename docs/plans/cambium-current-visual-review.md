# Cambium Current Visual Review

Date: 2026-06-16

## Scope

Review the current `apps/cambium-r3f` runtime against the attached Cambium tactical-map inspiration pack. This is a review pass only; no app code was changed.

## Evidence

- Runtime: `http://127.0.0.1:5173/`
- Tests: `npm run r3f:test` passed 43/43 tests.
- Build: `npm run r3f:build` passed with named vendor chunks.
- Repo validation: `npm run validate` passed.
- Docs check: `npm run render-docs:check` passed.
- Advisor limitation: `bun ~/.claude/PAI/TOOLS/Inference.ts --mode advisor --auto-state ...` returned `401 Invalid authentication credentials`, so no external advisor verdict was available.
- Fresh screenshots:
  - `docs/plans/assets/cambium-current-visual-review/overview.png`
  - `docs/plans/assets/cambium-current-visual-review/island-taste.png`
  - `docs/plans/assets/cambium-current-visual-review/visualizations.png`
  - `docs/plans/assets/cambium-current-visual-review/asset-qa.png`

## Verdict

Visual acceptance is not ready.

The current app is technically healthy and has moved beyond a pure dashboard scaffold: it has R3F routes, camera modes, organic field geometry, procedural islands, Meshy-derived runtime assets, source-plate review, in-world labels, route state, and asset QA gates.

It still does not match the attached reference quality. The live screenshots read as a WebGL scene placed under a conventional web HUD. The reference reads as an authored cinematic control surface where typography, glyphs, rails, particles, topography, and panels are composed as one visual object.

## What Is Working

- The route set matches the desired Cambium screens: overview, five islands, settings/elements, visualizations, design-system, and asset QA.
- The app has real 3D scene state rather than a static renderer.
- The prior checkerboard has been reduced in favor of an organic field and contour language.
- The build/test gate is solid enough to support another art-direction pass.
- Asset review is correctly manual-gated; image-to-3D candidates are not silently promoted.

## Main Visual Gaps

1. The scene is too small relative to the viewport.
   - In the reference, the map dominates the frame and feels physically inspectable.
   - In the live overview, the island system occupies a small central region with large unused teal field around it.

2. The HUD still behaves like web chrome.
   - The bottom route dock, left camera stack, lower readout card, and top telemetry strip are rectangular DOM controls.
   - The reference uses paneling, but the panels are integrated into the composition and serve the map rather than boxing it.

3. Island silhouettes are not yet iconic enough.
   - The reference has bold authored glyphs: star, capsule, triangle, folded Ops slab, Cortex wheel.
   - The current islands are organic blobs/domes with labels; the route names are clearer than the objects themselves.

4. The light and material system is too flat.
   - The reference has edge highlights, metallic/stone depth, emissive cores, surface grain, and object-scale shadows.
   - The current scene has useful glow and fog, but the objects do not yet have enough material hierarchy or hero lighting.

5. Rail and particle language is underdeveloped.
   - The reference uses luminous dotted paths, beads, routed currents, curved flow trails, and dense data specks as a major visual signature.
   - The live route has rails and packet markers, but they are not yet the dominant compositional element.

6. Typography is not yet reference-grade.
   - The reference uses tall compressed display type and labels locked to spatial landmarks.
   - The current DOM type is readable, but the visual hierarchy still feels like app UI text over a scene.

7. The current perceptual gate is structural, not visual.
   - `reference-gate.ts` checks metadata and scene-model proxies.
   - It does not score actual screenshots for composition, silhouette richness, object scale, density, or reference similarity.

## Recommended Next Pass

Treat the next pass as an art-direction rebuild on top of the working R3F runtime, not another HUD polish pass.

1. Make the overview composition first.
   - Fill the frame with the Cambium map.
   - Use the attached `home` reference as the acceptance target.
   - Reduce fixed DOM chrome to a minimal overlay and move more status into the world.

2. Replace generic island forms with five authored hero glyphs.
   - Genesis: star/seed relic.
   - Taste: capsule/ring oracle.
   - Build: triangular forge gate.
   - Ops: folded slab/current channel.
   - Cortex: wheel/memory instrument.

3. Promote rail/particle flow to the main signature.
   - Build spline-based paths with bead packets, glow cores, and dotted memory feeds.
   - Make the current process path obvious without relying on cards.

4. Add screenshot-based visual gates.
   - Compare rendered screenshots against the frozen reference pack for frame occupancy, dominant object scale, HUD coverage, label/world integration, and rail density.
   - Keep unit tests for data contracts, but do not let them stand in for visual acceptance.

5. Use the asset QA route only for asset promotion decisions.
   - Do not let the QA route drive the main visual language.
   - It is useful operational tooling, not the target user-facing experience.

## Status

Current status: technically green, visually yellow/red.

Next best move: build a reference-matched overview art pass with authored glyph primitives and world-integrated UI before continuing route-by-route expansion.
