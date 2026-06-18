# Cambium Overview Reference Art Pass

Date: 2026-06-16

## Scope

Implement the first reference-matched art pass for the Cambium `home` overview route only.

No Meshy assets were promoted, no paid asset generation was run, and the island-specific routes were left structurally intact.

## Changes

- Added an explicit `overviewArtDirection` contract to the R3F scene model.
- Reframed the home camera with a tighter overview pose and `cameraZoom: 88`.
- Added overview-only authored glyph primitives:
  - Genesis: seed-star relic
  - Taste: capsule oracle
  - Build: triangular forge gate
  - Ops: folded current slab
  - Cortex: memory wheel instrument
- Replaced the overview rail presentation with spline-like flow paths, denser beads, ghost lanes, and signal pulses.
- Added world-space overview labels for `CAMBIUM`, `2.5D OVERVIEW`, and `FLAT NODE VIEW`.
- Reduced DOM chrome on the overview route by hiding the camera stack, lower readout card, and instrument panel.
- Made the large `CAMBIUM` title watermark overview-specific and moved it into a top-left title-plate role.
- Suppressed the `YOU ARE HERE` sprite label on the overview route to avoid occlusion inside the enlarged composition.
- Added regression tests for the overview art-direction contract and overview-specific reduced chrome.

## Evidence

- Screenshot: `docs/plans/assets/cambium-overview-reference-art-pass/overview-final.png`
- First-pass comparison capture: `docs/plans/assets/cambium-overview-reference-art-pass/overview-first-pass.png`
- Screenshot dimensions: `1904x898`
- Pixel sample: `10132` unique sampled colors, `0.5803` non-background ratio.

## Verification

- `npm run r3f:test` passed 46/46 tests.
- `npm run r3f:build` passed.
- Browser route loaded at `http://127.0.0.1:5173/`.
- Playwright screenshot capture passed after a clean Vite restart.

## Result

The overview now reads more like an authored tactical-map scene than the prior small WebGL map under a web-dashboard shell. The largest improvements are frame occupancy, iconic island silhouettes, rail/particle visibility, and reduced DOM chrome.

This is still not full reference parity. The next visual frontier is material richness: darker carved-metal/stone surfaces, better edge highlights, richer topographic texture, stronger depth shadows, and more refined typography layout around the enlarged glyphs.
