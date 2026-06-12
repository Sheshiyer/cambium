# Cambium Image-to-3D Master Pass Report

Date: 2026-06-12

## Scope

Generated two high-quality Meshy image-to-3D master candidates from the source-plate pack:

- `genesis`: first island master candidate.
- `rail-arc`: first reusable connector prop master candidate.

This pass deliberately avoided runtime optimization constraints. The assets are master candidates only and are not wired into the R3F runtime asset registry.

## Spend

- `genesis`: 30 credits
- `rail-arc`: 30 credits
- Total accepted-task spend: 60 credits

One initial `genesis` request using `texture_image_url` returned `500: Failed to complete moderation checks` before a task id was created. The successful retry used the source image as `image_url` and a `texture_prompt` for texture guidance, matching the safer path from the earlier Ops trial.

## Outputs

| Asset | Task ID | Model | Size | Thumbnail |
| --- | --- | --- | --- | --- |
| `genesis` | `019ebc10-4745-7225-912e-a304d8ef2425` | `apps/cambium-r3f/public/assets/meshy/image-to-3d/genesis/model.glb` | 68 MB | `apps/cambium-r3f/public/assets/meshy/image-to-3d/genesis/thumbnail.png` |
| `rail-arc` | `019ebc10-9ca7-7a9f-a599-12fd4e4952ef` | `apps/cambium-r3f/public/assets/meshy/image-to-3d/rail-arc/model.glb` | 53 MB | `apps/cambium-r3f/public/assets/meshy/image-to-3d/rail-arc/thumbnail.png` |

Additional views:

- `apps/cambium-r3f/public/assets/meshy/image-to-3d/genesis/thumbnail-front.png`
- `apps/cambium-r3f/public/assets/meshy/image-to-3d/genesis/thumbnail-right.png`
- `apps/cambium-r3f/public/assets/meshy/image-to-3d/genesis/thumbnail-back.png`
- `apps/cambium-r3f/public/assets/meshy/image-to-3d/genesis/thumbnail-left.png`
- `apps/cambium-r3f/public/assets/meshy/image-to-3d/rail-arc/thumbnail-front.png`
- `apps/cambium-r3f/public/assets/meshy/image-to-3d/rail-arc/thumbnail-right.png`
- `apps/cambium-r3f/public/assets/meshy/image-to-3d/rail-arc/thumbnail-back.png`
- `apps/cambium-r3f/public/assets/meshy/image-to-3d/rail-arc/thumbnail-left.png`

Contact sheet:

- `docs/plans/assets/cambium-r3f-game-engine-realignment/image-to-3d/master-contact-sheet.png`

## Technical Validation

- Both GLBs are valid glTF 2.0.
- Both GLBs report matching declared and actual binary lengths.
- Each master has one mesh, one material, four images, and four textures.
- Both masters are intentionally above runtime size budget and must not replace runtime assets without optimization.

## Visual Review

`genesis` is a strong keeper candidate. It preserves the source plate's seed-crystal focal object, circular stepped island base, chartreuse vein language, ivory node caps, and layered basalt side strata.

`rail-arc` is usable as a master candidate but needs in-scene inspection. The default thumbnail is edge-on, so the silhouette reads flatter than the source plate. The side views confirm it stayed as a chunky physical connector rather than a hairline rail, but the next step should render it in R3F from the tactical-map camera before deciding whether to optimize it.

## Pipeline Decision

- Default texture mode should be `texture_prompt`, not `texture_image_url`.
- `texture_image_url` remains available only as an explicit experimental option.
- Continue master-first: no `target_polycount`, no runtime remesh target, no replacement until visual approval.
- Next step: build a side-by-side R3F comparison route for source plate, current text-to-3D asset, and image-to-3D master.
