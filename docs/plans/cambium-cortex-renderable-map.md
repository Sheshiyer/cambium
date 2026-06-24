# Cambium Cortex Renderable Map

## Why This Version Exists

The first isometric moodboard is useful directionally, but it is too painterly to
be a reliable product surface. The tiny buildings cannot be rendered, updated,
or scored consistently by the current Cortex/Taste pipeline.

This version moves the idea into browser-renderable primitives:

- stage slabs instead of buildings
- SVG rails instead of illustrated roads
- contract packets instead of decorative cargo
- a quest beacon bound to current progress
- a Cortex rules panel sourced from local contracts
- Taste skill lanes that point to the real supporting tools

## Files

- Renderer: [index.html](assets/cambium-cortex-renderable-map/index.html)
- Snapshot: [snapshot.json](assets/cambium-cortex-renderable-map/snapshot.json)
- QA screenshots: [qa](assets/cambium-cortex-renderable-map/qa)

## Cortex/Taste Inputs Used

- `cortex/cambium/contracts/acceptance_checks.json`
- `cortex/cambium/contracts/interaction_plan.json`
- `../Skill-clusters/taste/scripts/taste-resolve.mjs`
- `../Skill-clusters/scripts/visual-qa.mjs`
- `../Skill-clusters/taste/scripts/kit-qa.mjs`
- `../Skill-clusters/taste/scripts/lib/reroll.mjs`

## Verification

```bash
npm run validate
npm run render-docs:check
node -e "JSON.parse(require('fs').readFileSync('docs/plans/assets/cambium-cortex-renderable-map/snapshot.json','utf8')); console.log('snapshot ok')"
node ../Skill-clusters/scripts/visual-qa.mjs docs/plans/assets/cambium-cortex-renderable-map/index.html --widths 390,768,1440 --out docs/plans/assets/cambium-cortex-renderable-map/qa
```

Result: registry/pipeline valid, docs in sync, snapshot parses, and visual QA
passes with zero contrast failures across the audited desktop capture.
