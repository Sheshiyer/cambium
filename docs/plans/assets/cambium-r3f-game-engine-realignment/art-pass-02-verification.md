# Cambium R3F Art Pass 02 Verification

## Summary

Art Pass 02 adds the first real art-pipeline layer on top of the tactical-map foundation:

- authored procedural island mesh profiles per organ silhouette
- shader-based terrain strata and atmosphere sheets
- CSS post-process/vignette/scanline overlays
- in-world sprite labels for island identity and state
- cinematic camera drift for overview, node, and flat modes
- a structural perceptual reference gate

This is a meaningful improvement over the prior pass, but still not final reference parity. The next frontier is deeper authored geometry, richer material/post-processing treatment, and stricter human visual review against the original screenshot references.

## Evidence

- Contact sheet: `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/art-pass-02/desktop-contact-sheet.png`
- Screenshot folder: `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/art-pass-02/`
- Nonblank report: `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/art-pass-02/desktop-nonblank-report.json`

## Verification

- `npm run r3f:test`: 20 tests passed.
- `npm run r3f:build`: passed.
- Playwright captured all nine desktop routes at `1440x900`.

## Visual Delta

The first game-engine pass sampled roughly 4k-5.7k unique colors per route. Art Pass 02 samples roughly 6.3k-10.4k unique colors per route, reflecting richer geometry, in-world labels, shader strata, atmospheric overlays, and post-process texture.

## Current Limits

- Meshes are procedural and deterministic, but still not art-directed external assets.
- Shader studies are static and lightweight; there is no real post-processing composer yet.
- In-world labels improve diegesis but need occlusion, scale, and layout tuning.
- The perceptual gate is now explicit in code, but still requires human reference review before milestone closure.

## Meshy Bridge

`MESHY_API_KEY` is available locally in `~/.config/cambium/.env`, so the next asset pass can generate authored island candidates through Meshy's Text-to-3D API. The repo now includes a credit-safe wrapper:

- Prompt specs: `apps/cambium-r3f/asset-prompts/meshy-island-prompts.json`
- CLI wrapper: `apps/cambium-r3f/scripts/meshy-island-assets.mjs`
- Public manifest: `apps/cambium-r3f/public/assets/meshy/islands/manifest.json`
- Root shortcut: `npm run r3f:meshy -- plan`

The wrapper defaults to `plan` and requires `--execute` for paid `preview`, `refine`, and `download` actions. Based on Meshy's current pricing, a full preview+refine pass is estimated at 30 credits per island and 150 credits for all five islands.

Verified without spending credits:

- `grep -q '^MESHY_API_KEY=' ~/.config/cambium/.env`: passed without printing the key.
- `npm run r3f:meshy -- plan`: passed and printed five island prompt lengths plus the 30/150 credit estimate.
- `npm run r3f:meshy -- preview --island genesis`: failed closed before any paid generation with `Preview generation would call the paid Meshy API. Re-run with --execute after confirming credit spend.`
- `npm run r3f:test`: 20 tests passed, including Meshy prompt coverage, prompt limit, literal architecture rejection, and explicit credit-estimate checks.
- `npm run r3f:build`, `npm run validate`, `npm run render-docs:check`, and `npm test`: passed. The known large Three/R3F chunk warning remains.

## Meshy Art Pass

After explicit approval, Meshy generated the first authored GLB island set:

- Final GLBs: `apps/cambium-r3f/public/assets/meshy/islands/*/model.glb`
- Final thumbnails: `apps/cambium-r3f/public/assets/meshy/islands/*/thumbnail.png`
- Runtime manifest: `apps/cambium-r3f/public/assets/meshy/islands/manifest.json`
- Typed app registry: `apps/cambium-r3f/src/world/meshy-assets.ts`
- Task ledger: `docs/plans/assets/cambium-r3f-game-engine-realignment/meshy-task-ledger.json`

Credit spend for this run was 210 Meshy credits:

- 100 credits for the first five preview attempts.
- 40 credits for corrected Build v2 and Ops v2 previews.
- 20 credits for corrected Build v3 preview.
- 50 credits for five accepted refine tasks.

Generation judgment:

- Accepted after first preview: Genesis, Taste, Cortex.
- Rejected before refine: Build v1, Build v2, Ops v1.
- Accepted after regeneration: Ops v2 and Build v3.

Runtime verification:

- Contact sheet: `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/meshy-art-pass/desktop-contact-sheet.png`
- Nonblank report: `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/meshy-art-pass/desktop-nonblank-report.json`
- Captured all nine desktop routes at `1440x900`.
- Lowest sampled unique-color count: 7,129.
- Lowest sampled non-background ratio: 0.6322.
- Console issues were limited to WebGL `ReadPixels` performance warnings from screenshot capture; no GLB load failures or page errors were reported.

Current limits:

- Final GLBs are 7.8-11 MB each, acceptable for this desktop proof but too heavy for final packaging without compression/LOD work.
- Build is now usable as a molten terrain island, but still needs a stronger authored silhouette in the next art pass.
- The scene now proves Meshy asset loading, not final reference parity.
