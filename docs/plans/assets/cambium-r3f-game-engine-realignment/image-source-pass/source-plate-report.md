# Cambium Image-First Source Plate Pass

Date: 2026-06-12

## Purpose

Generate source images before further 3D spend. The Ops image-to-3D trial proved that Meshy maps visible texture cues from the source image into the GLB, so the image prompt must act as both art direction and texture contract.

This pass creates controlled source plates for the five island assets and six reusable scene props. No additional Meshy 3D generation was run for this pass.

## Inputs

- Prompt manifest: `docs/plans/assets/cambium-r3f-game-engine-realignment/image-source-pass/source-plate-prompts.json`
- Style reference: `docs/plans/assets/cambium-r3f-game-engine-realignment/image-to-3d/ops-source.png`
- Generator: `npm run r3f:source-plates -- generate --execute`
- Model: `gpt-image-2`
- Size: `1024x1024`
- Auth: local Codex OAuth through `codex-gpt-image`

## Outputs

- Contact sheet: `docs/plans/assets/cambium-r3f-game-engine-realignment/image-source-pass/contact-sheet.png`
- Source plates directory: `docs/plans/assets/cambium-r3f-game-engine-realignment/image-source-pass/source-plates/`

| Asset | Kind | Output | Review |
| --- | --- | --- | --- |
| `genesis` | island | `source-plates/genesis.png` | Keep. Strong seed-crystal silhouette, texture-visible strata, enough height to distinguish origin without becoming architecture. |
| `taste` | island | `source-plates/taste.png` | Keep. Thick loop geometry and clear negative spaces should reconstruct better than thin knot lines. |
| `build` | island | `source-plates/build.png` | Keep. Better than text-to-3D direction because it avoids machinery and reads as a faceted artifact island. |
| `ops` | island | `source-plates/ops.png` | Keep. Preserves the proven ring-island language with a cleaner hollow center and thick surface channels. |
| `cortex` | island | `source-plates/cortex.png` | Keep with caution. The orbit rings are strong, but later 3D conversion must avoid thin floating ring artifacts. |
| `rail-arc` | prop | `source-plates/rail-arc.png` | Keep. Thick, modular connector slab, not a hairline rail. |
| `signal-packet` | prop | `source-plates/signal-packet.png` | Keep. Reads as a physical bead/capsule rather than a flat UI icon. |
| `emitter-node` | prop | `source-plates/emitter-node.png` | Keep. Squat beacon form avoids tower/building drift. |
| `process-beacon` | prop | `source-plates/process-beacon.png` | Keep. Physical current-position marker with readable wedge, suitable for a zoom target. |
| `control-dial` | prop | `source-plates/control-dial.png` | Keep. Strong settings/control-bay instrument, not a web settings panel. |
| `visualization-lens` | prop | `source-plates/visualization-lens.png` | Keep with caution. The translucent membrane is useful visually, but later GLB conversion may need a solid shallow surface. |

## What Worked

- The Ops reference anchored the material family across the pack.
- Visible surface channels, contour ridges, ivory caps, and peach seams give Meshy texture cues to map.
- Chunky geometry and beveled forms are more reconstructable than elegant thin lines.
- The props now read as physical scene assets, not SaaS controls.
- One object per frame makes later image-to-3D trials easy to isolate and evaluate.

## What To Avoid Next

- Do not run all assets through Meshy as a batch. Validate one island and one prop first.
- Do not use source images with text, UI labels, decorative frames, scenery, or dramatic shadows.
- Do not constrain master generation with low-poly targets. File-size and polycount budgets belong to the promotion/optimization gate.
- Do not accept GLBs into runtime above the runtime budget without Blender/glTF optimization.
- Do not replace the current runtime assets until side-by-side R3F screenshots prove improvement.

## Recommended Next Pass

1. Run Meshy image-to-3D on `genesis` and `rail-arc` only.
2. Use the `master` image-to-3D profile: `standard`, `latest`, textured, PBR, HD texture, source image as the texture guide, no `target_polycount`, and no remesh target.
3. Treat the resulting GLBs as high-quality masters even if they are too large for runtime.
4. Optimize approved candidates through Blender/glTF tooling or a later runtime derivative pass.
5. Add a side-by-side R3F comparison route before replacing the text-to-3D assets.
6. Promote only assets that pass visual improvement, GLB validity, optimized model size, and screenshot gates.
