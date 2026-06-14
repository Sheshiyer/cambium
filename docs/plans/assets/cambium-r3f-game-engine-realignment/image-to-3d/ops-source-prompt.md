# Cambium Ops Image-to-3D Source Plate Prompt

Target: one controlled source image for a single Meshy image-to-3D trial. This should test whether an authored concept plate gives better Cambium island geometry than text-to-3D.

Island: `ops`

Prompt:

```text
Single isolated 3D game asset concept render for a Cambium Ops loop island. A low horizontal circular torus terrain slab, like a living operations organ, with an irregular broken-ring silhouette and a clear hollow center. Dark green-black basalt substrate, layered contour ridges, embedded glowing chartreuse heartbeat channels, small ivory perimeter signal nodes, and a few peach calibration seams. Three-quarter isometric orthographic camera, full object visible, centered, no cropping, clean silhouette, neutral dark gray background, soft studio lighting, high contrast edge definition, production concept art intended for image-to-3D reconstruction. No text, no UI, no labels, no humans, no buildings, no trees, no background scenery, no dramatic perspective distortion.
```

Generation settings:

- Tool: `codex-gpt-image`
- Model: `gpt-image-2`
- Size: `1024x1024`
- Output: `docs/plans/assets/cambium-r3f-game-engine-realignment/image-to-3d/ops-source.png`

Meshy trial settings:

- Endpoint: Image to 3D
- Input: data URI from this PNG
- Model: `latest`
- Texture: enabled
- PBR: enabled
- Remesh: enabled
- Target format: `glb`
- Asset output root: `apps/cambium-r3f/public/assets/meshy/image-to-3d/ops/`
