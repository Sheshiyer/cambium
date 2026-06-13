# Cambium R3F Game-Engine Realignment

## Plan

- [x] Record the correction as a new tactical-map realignment wave, preserving the prior R3F milestone as scaffold history.
- [x] Create the new GitHub milestone and issue set for the game-engine visual target.
- [x] Replace the dashboard-like R3F scene layer with engine/world/material/HUD subsystems.
- [x] Rebuild home, island, settings, visualization, and component-board routes as desktop tactical-map states.
- [x] Add tests and visual acceptance gates that prevent a dashboard-style regression.
- [x] Run build/test/browser verification, capture desktop screenshots, and document the evidence.
- [x] Add Art Pass 02: procedural island meshes, shader/material studies, atmosphere/post-process layers, in-world typography, camera choreography, and a structural perceptual reference gate.
- [x] Add a credit-safe Meshy AI asset bridge for authored island mesh candidates without spending credits by default.
- [x] Trial one image-to-3D pass by generating a controlled Codex GPT Image source plate and sending only that one asset through Meshy without replacing the current scene assets.
- [x] Create an image-first source-plate pass for every island plus reusable 3D scene props, using the Ops image-to-3D texture/silhouette lessons before any further Meshy spend.
- [x] Add a side-by-side R3F asset comparison route for source/current/master candidate review without promoting image-to-3D assets.
- [x] Optimize approved image-to-3D master candidates into separate runtime-budget derivatives while preserving full masters.
- [x] Add an Asset Review Bay continuation pass with promotion-safe perceptual scoring, review instruments, and tests.

## Review

- Added `docs/plans/cambium-r3f-game-engine-realignment.md` and the realignment packet under `docs/plans/assets/cambium-r3f-game-engine-realignment/`.
- Created GitHub milestone `Cambium R3F Game Engine Realignment`: https://github.com/Sheshiyer/cambium/milestone/7
- Created issues #44 through #52 and mapped them in `github-issues.md` / `github-issues.json`.
- Rebuilt `apps/cambium-r3f` around engine, world, materials, scene, and HUD subsystems.
- Added tactical-map island metadata: silhouettes, biomes, camera targets, emitter lanes, engine controls, and scene-native visualization layers.
- Replaced the panel-heavy HUD with a sparse desktop operator strip, route dock, camera dial, diegetic readout, and instrument lines.
- Captured all nine desktop screenshots and a contact sheet at `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/desktop-contact-sheet.png`.
- Verification passed: `npm run r3f:test`, `npm run r3f:build`, Playwright route capture, and nonblank pixel sampling.
- Correction from design review: this is only about 10% better than the prior version and still not close enough to the reference ambition. Keep milestone issues open and treat this as a foundation pass, not final visual acceptance.
- Art Pass 02 added authored procedural island geometry, shader studies, atmosphere sheets, CSS post-process overlays, in-world sprite labels, cinematic camera drift, and `reference-gate.ts`.
- Captured Art Pass 02 screenshots and contact sheet at `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/art-pass-02/desktop-contact-sheet.png`.
- Art Pass 02 verification passed: `npm run r3f:test`, `npm run r3f:build`, and Playwright route capture at 1440x900.
- Honest status: Art Pass 02 is materially better and denser, but still not final AAA/reference parity. Next frontier is more authored geometry, composer-level post-processing, occlusion-aware labels, and human perceptual review against the original references.
- Residual: Vite still reports the expected large Three/R3F chunk warning; code splitting remains a performance follow-up.
- Meshy bridge added without spending credits: local key presence verified, five island prompt specs added, root/app CLI wrappers added, public manifest seeded, paid preview/refine/download commands require `--execute`, and the no-`--execute` preview path fails before calling Meshy.
- Meshy bridge verification passed: `npm run r3f:meshy -- plan`, `npm run r3f:test`, `npm run r3f:build`, `npm run validate`, `npm run render-docs:check`, and `npm test`.
- Meshy generation pass completed after explicit approval: five final refined GLBs are in `apps/cambium-r3f/public/assets/meshy/islands/`; weak Build/Ops previews were rejected and regenerated before refine. Total Meshy spend for this run was 210 credits: 160 preview credits across eight preview attempts and 50 refine credits across five accepted assets.
- Meshy assets are wired into the R3F scene through `src/world/meshy-assets.ts` and `GLTFLoader`, with procedural terrain/core retained as fallback. Desktop screenshots for all nine routes passed nonblank checks at `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/meshy-art-pass/desktop-contact-sheet.png`.
- New correction: text-to-3D quality is not strong enough for the desired Cambium island bar. Trial image-to-3D next using a deliberately isolated concept plate generated through `codex-gpt-image`, then compare the result before adopting it as the asset pipeline.
- Image-to-3D Ops trial completed: source plate generated at `docs/plans/assets/cambium-r3f-game-engine-realignment/image-to-3d/ops-source.png`, Meshy task `019ebbbf-8657-7368-a8bd-46fcb514ae11` succeeded, and the trial GLB/thumbnail were downloaded under `apps/cambium-r3f/public/assets/meshy/image-to-3d/ops/`.
- Verdict: image-to-3D is directionally better for authored island silhouettes and surface richness than the text-to-3D Ops asset, but the trial GLB is 18 MB versus the current 15 MB runtime budget, so it needs optimization or a lower-poly rerun before replacement.
- Image-first asset-pass scope: generate source plates first for five islands (`genesis`, `taste`, `build`, `ops`, `cortex`) and reusable 3D props (`rail-arc`, `signal-packet`, `emitter-node`, `process-beacon`, `control-dial`, `visualization-lens`). No additional Meshy 3D calls in this pass.
- Image-first source plate pass completed: generated 11 `gpt-image-2` source plates under `docs/plans/assets/cambium-r3f-game-engine-realignment/image-source-pass/source-plates/`, created `contact-sheet.png`, and documented the keep/caution review in `source-plate-report.md`.
- Correction: do not lead the next Meshy pass with low-poly targets. Generate high-quality master assets first, then optimize approved candidates into runtime derivatives.
- Next 3D recommendation: do not batch-run Meshy yet. Test `genesis` plus `rail-arc` first as high-quality masters with no `target_polycount`; enforce the 15 MB budget only at the later promotion/optimization gate.
- High-quality master pass completed for `genesis` and `rail-arc`: accepted Meshy tasks consumed 60 credits total, produced valid master GLBs under `apps/cambium-r3f/public/assets/meshy/image-to-3d/`, and are documented in `master-pass-report.md`.
- Pipeline adjustment: default Meshy image-to-3D texture mode should use `texture_prompt`. A `texture_image_url` attempt failed moderation before task creation; keep image-guided texturing as an explicit experiment only.
- Added `#asset-comparison` as a post-freeze R3F QA route. It renders the source plate, current promoted runtime asset when available, and the master-derived optimized candidate side by side while displaying full master size/provenance in-scene.
- Captured the comparison screenshot at `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/master-comparison/asset-comparison.png` with a nonblank report showing `0.4445` non-background ratio and `8378` unique sampled colors.
- Added a local GLB optimizer at `apps/cambium-r3f/scripts/optimize-glb-textures.py`. It first downscales embedded textures and can apply vertex-cluster geometry reduction only for derivatives that cannot meet the runtime budget through texture optimization alone.
- Optimized candidates remain separate from runtime promotion: `genesis` is `12,317,204` bytes via `texture-1536-grid256`; `rail-arc` is `15,522,024` bytes via `texture-1536`. Both pass the `15 MiB` budget and are tracked in `optimized-candidates.json`.
- No image-to-3D optimized candidate is promoted into `src/world/meshy-assets.ts`; manual visual approval is still required before replacement.
- Asset Review Bay continuation completed: `#asset-comparison` now shows source/current/master/review columns, weighted perceptual criteria, review score, readiness, blocker state, and a visible `HOLD` gate while keeping every candidate `not-promoted`.
- Review status: `genesis` is `86/86` and `review-ready`; `rail-arc` is `80/86`, `needs-art-pass`, and blocked on connector scale approval. Both remain manual-approval-only.
- Asset Review Bay verification passed: `npm run r3f:test`, `npm run r3f:build`, browser route load at `http://127.0.0.1:5176/#asset-comparison`, screenshot capture at `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/master-comparison/asset-review-bay.png`, `npm run validate`, `npm run render-docs:check`, and `npm test`.

# Cambium Isometric Moodboard

## Plan

- [x] Review the current repo model for organs, runner/hyphae, background emitters, and quest progress surfaces.
- [x] Identify the brand/reference inputs available locally and the attached Terrain-style visual direction.
- [x] Generate a Cambium isometric moodboard image through the local `codex-gpt-image` workflow.
- [x] Produce a concise moodboard/spec artifact that maps data feeds to visual engine concepts.
- [x] Verify generated files and document results.

## Review

- Created `docs/plans/cambium-isometric-moodboard.md` as the companion moodboard/spec.
- Created `docs/plans/assets/cambium-isometric-moodboard/prompt.md` for reproducible image generation.
- Generated `docs/plans/assets/cambium-isometric-moodboard/cambium-isometric-moodboard.png` with Codex OAuth and `gpt-image-2` at 1536x1024.
- Verified current repo model with `npm run validate`: registry + pipeline valid, 4 stages and 5 organs resolve.
- Verified docs with `npm run render-docs:check`: docs in sync with source, 6 pages and 100 components.
- Verified live progress with `npm run quine -- quests --tenant cambium`: Arc X, The Brief, 9/17 quests complete.
- Exact search did not find a literal `decliperto` module; the spec treats the relevant feed path as the existing `compose` runner plus `quine` hypha emitters.
- Existing dirty worktree remains unrelated and was not reverted or folded into this artifact.

# Cambium Cortex Renderable Map

## Plan

- [x] Re-scope the visual from generated buildings to renderable HTML/SVG primitives.
- [x] Use local Cortex contracts for palette, motion, and acceptance checks.
- [x] Export a bounded JSON snapshot from the Cambium plan and current quest state.
- [x] Build a static renderer that can be opened directly in a browser.
- [x] Verify the renderer at desktop and mobile sizes and document results.

## Review

- Added `docs/plans/cambium-cortex-renderable-map.md` to separate the renderer-first direction from the generated bitmap moodboard.
- Added `docs/plans/assets/cambium-cortex-renderable-map/snapshot.json` as the bounded data shape for the visual engine.
- Added `docs/plans/assets/cambium-cortex-renderable-map/index.html` as a dependency-free HTML/SVG renderer using simple slabs, rails, packets, a quest beacon, and Cortex/Taste panels.
- Used local Cortex contract constraints from `cortex/cambium/contracts`: palette lock, no neon outer glow, opacity hierarchy, transform/opacity motion, honest freshness, reduced motion, and readability.
- Used relevant Taste/Cortex skill surfaces from `../Skill-clusters`: `taste-resolve`, `visual-qa`, `kit-qa`, and the reroll loop.
- Initial visual QA found contrast failures and text collisions; fixed by adding explicit dark text backgrounds, dark warning-chip text, simplified rail labels, and a cleaner map layout.
- Verification passed: `npm run validate`, `npm run render-docs:check`, snapshot JSON parse, and `visual-qa` at 390/768/1440 with 0 contrast failures.
- Browser MCP was not exposed through tool discovery in this thread, so Playwright visual QA was used as the browser-rendering fallback.

# Cambium R3F Visual Moodboard

## Plan

- [x] Re-scope the artifact as a visual moodboard for a future R3F/Three scene, not a code spec or HTML renderer.
- [x] Pull Cambium brand essence, Cortex/Taste contracts, and local design references into one prompt direction.
- [x] Use Terrain screenshots plus Taste/Codrops references to guide a renderable 2.5D overview and flat node-view visual language.
- [x] Generate a polished moodboard through the local `codex-gpt-image` workflow.
- [x] Inspect the generated image, document the files, and verify repo docs still pass.

## Review

- Added `docs/plans/cambium-r3f-visual-moodboard.md` to capture the visual direction and the explicit "not a scene spec yet" boundary.
- Added `docs/plans/assets/cambium-r3f-visual-moodboard/prompt.md` for reproducible image generation.
- Generated `docs/plans/assets/cambium-r3f-visual-moodboard/cambium-r3f-visual-moodboard.png` with Codex OAuth and `gpt-image-2` at 1536x1024.
- Used Cambium source contracts from `README.md`, `composition/pipeline.json`, `cortex/cambium/contracts/acceptance_checks.json`, `cortex/cambium/contracts/interaction_plan.json`, and `docs/plans/assets/stage-handoff-matrix.json`.
- Used Taste/Codrops references from `../Skill-clusters/taste/corpus/shots`: shader graph object, flat-to-spatial object field, and topographic web frame.
- The image CLI accepts at most five reference images, so the final generation used one Terrain composite, one Terrain plane/detail reference, and three Taste/Codrops images.
- Visual inspection passed the main correction: no houses/city/towers, no HTML-flat renderer, clear `2.5D OVERVIEW` and `FLAT NODE VIEW`, and abstract glyph objects suitable for later R3F translation.
- Verified image dimensions with `sips`: 1536x1024.
- Verified current repo model with `npm run validate`: registry + pipeline valid, 4 stages and 5 organs resolve.
- Verified docs with `npm run render-docs:check`: docs in sync with source, 6 pages and 100 components.

# Cambium R3F Screenshot Pack

## Plan

- [x] Create a shared visual spine so all generated screenshots match the accepted R3F moodboard.
- [x] Generate the home/overview screenshot.
- [x] Generate island interior screenshots for `Genesis`, `Taste`, `Build`, `Ops`, and `Cortex`.
- [x] Generate the elements/settings screenshot.
- [x] Generate the visualizations screenshot.
- [x] Generate the Figma-style design doc component board.
- [x] Archive every prompt and document the reference set.
- [x] Inspect the generated images, regenerate any off-direction frames, and verify repo docs.

## Review

- Added `docs/plans/cambium-r3f-screenshot-pack.md` as the screenshot-pack companion doc.
- Added prompt archive under `docs/plans/assets/cambium-r3f-screenshots/prompts/`, including the shared style spine and one prompt per screen.
- Generated nine 1536x1024 concept screenshots with Codex OAuth and `gpt-image-2`:
  - `home.png`
  - `island-genesis.png`
  - `island-taste.png`
  - `island-build.png`
  - `island-ops.png`
  - `island-cortex.png`
  - `elements-settings.png`
  - `visualizations.png`
  - `figma-components.png`
- Generated `docs/plans/assets/cambium-r3f-screenshots/contact-sheet.png` for review.
- Visual inspection passed the main constraints: no houses/city/towers, no generic neon AI palette, coherent dark cartographic/R3F glyph language, and distinct pages for overview, island interiors, settings, visualizations, and component inventory.
- Verified all nine screenshots with `sips`: each is 1536x1024.
- Verified contact sheet with `sips`: 1608x1221.
- Verified current repo model with `npm run validate`: registry + pipeline valid, 4 stages and 5 organs resolve.
- Verified docs with `npm run render-docs:check`: docs in sync with source, 6 pages and 100 components.

# Cambium R3F Implementation Freeze

## Plan

- [x] Load `swarm-architect`, skill-cluster resolver context, GitHub state, and CodeGraph structure.
- [x] Freeze the screenshot references one-to-one with paths, prompt paths, and hashes.
- [x] Create a phase/wave/swarm implementation plan with owner boundaries and validation gates.
- [x] Create issue-ready bodies that preserve the reference image for each build target.
- [x] Run skill-cluster resolution against the task queue.
- [x] Create GitHub milestone, labels, and issues for the frozen implementation plan.
- [x] Verify GitHub issue URLs, repo checks, and update this ledger with results.

## Review

- Used `swarm-architect` plus the canonical skill-cluster resolver at `~/.agents/skill-clusters` to plan the work as phase/wave GitHub delivery.
- Added `docs/plans/cambium-r3f-implementation-freeze.md` as the frozen implementation plan.
- Added `docs/plans/assets/cambium-r3f-implementation/reference-freeze.json` with one-to-one screenshot paths, prompt paths, task IDs, and SHA-256 hashes.
- Added the implementation packet under `docs/plans/assets/cambium-r3f-implementation/`: `tasks.md`, `dispatch-plan.json`, `shared-contract-packet.md`, `validation-gate.md`, `issue-map.json`, `github-issues.json`, `github-issues.md`, and per-task issue bodies.
- Skill resolution completed cleanly: no phantom skills, no unresolved clusters, no required activation, and execution routed through `github-next-wave-orchestrator`.
- Created GitHub milestone `Cambium R3F Visual Engine`: https://github.com/Sheshiyer/cambium/milestone/6
- Created and linked 17 GitHub issues, #27 through #43, with dependency comments and reference image contracts for each visual target.
- Verified GitHub state with `gh issue list` and milestone API checks: 17 open issues are assigned to the milestone.
- Verification passed: `npm run validate`, `npm test`, JSON parsing for generated manifests, and `npm run render-docs:check`.
- `npm run render-docs:check` initially found generated docs drift in `docs/organs.html` and `docs/organs/hands.html`; `npm run render-docs` regenerated them and the docs check then passed.

# Cambium R3F Phase 1 Implementation

## Plan

- [x] Load the frozen implementation plan and identify Phase 1 scope as `T001`-`T004`.
- [x] Add an isolated Vite/React/R3F app under `apps/cambium-r3f`.
- [x] Add a source-contract generator that derives app data from Cambium pipeline, Cortex contracts, frozen references, and quest line.
- [x] Implement the scene adapter, overview canvas, HUD, visual tokens, glyph metadata, and material constraints.
- [x] Add focused app-local tests for data and token contracts.
- [x] Install scoped app dependencies, run app build/tests, browser-render the route, and capture screenshot evidence.
- [x] Update the frozen task queue and verification evidence.

## Review

- Added root scripts: `r3f:sync`, `r3f:test`, `r3f:build`, and `r3f:dev`.
- Added `apps/cambium-r3f` with Vite 8, React, React Three Fiber, Three, and `coolshapes-react` pinned to the published `^1.0.1` line.
- Added `apps/cambium-r3f/scripts/generate-scene-contract.mjs` and generated `src/generated/source-contract.ts` from source Cambium artifacts.
- Implemented `buildCambiumScene()` with source-backed stage nodes, Cortex memory node, rails, packet counts, `ARC X · The Brief · 9/17` telemetry, frozen references, and acceptance/interaction contracts.
- Implemented visual tokens constrained to the Cortex palette lock, transform/opacity motion contract, reduced-motion CSS, abstract glyph metadata, and R3F materials.
- Added verification note: `docs/plans/assets/cambium-r3f-implementation/phase1-verification.md`.
- Captured browser screenshot proof: `docs/plans/assets/cambium-r3f-implementation/verification/phase1-home.png`.
- Verification passed: `npm run r3f:sync`, `npm run r3f:test`, `npm run r3f:build`, Playwright route load, screenshot capture, and canvas nonblank pixel probe.
- Dependency audit is clean after moving to Vite 8.0.16 and `@vitejs/plugin-react` 5.2.0.
- Closed GitHub Phase 1 issues with evidence comments: #27, #28, #29, and #30.
- Residual: Vite reports the expected large-chunk warning for the first Three/R3F prototype bundle; `T016` owns code splitting and performance hardening.

# Cambium R3F Phase 2-3 Implementation

## Plan

- [x] Load remaining open issues and frozen screenshot prompts for `T005`-`T017`.
- [x] Implement the route registry for home, five islands, settings, visualizations, and component board.
- [x] Add hash navigation, camera modes, active-node detail state, exact prompt labels, and frozen reference bindings.
- [x] Expand R3F scene rendering for overview, island, settings, visualization, and component-board modes.
- [x] Add tests for route ordering, task/issue mapping, exact labels, references, camera modes, and selected-node state.
- [x] Capture desktop screenshots and nonblank pixel evidence for all nine routes.
- [x] Capture mobile screenshots for overview and the longest-title route.
- [x] Run repo/app validation gates and close remaining GitHub issues with evidence.

## Review

- Added `apps/cambium-r3f/src/scene/route-registry.ts` as the route/task/issue/label contract for `T005`-`T013`.
- Updated `buildCambiumScene()` to bind routes to frozen references and expose active screen, selected node, camera mode, and panels.
- Added hash routes for every reference screen plus camera controls for `overview`, `node`, and `flat`.
- Expanded `CambiumScene` with route-specific overview, island, settings, visualization, and component-board compositions.
- Added `route-registry.test.ts` and expanded `scene-data.test.ts`; app tests now cover 10 route/data/token checks.
- Added Phase 2-3 evidence: `docs/plans/assets/cambium-r3f-implementation/phase2-3-verification.md`.
- Captured desktop screenshots for all nine routes plus `phase2-contact-sheet.png`.
- Captured mobile screenshots: `phase3-mobile-home.png` and `phase3-mobile-visualizations.png`.
- Nonblank pixel probe passed for every route; lowest sampled unique-color count was 506 and lowest non-background ratio was 0.294.
- Closed GitHub issues #31 through #43, and closed the `Cambium R3F Visual Engine` milestone with 17 closed issues and 0 open.
- Correction from design review: this implementation is only a technical scaffold, not visual parity. It reads as a SaaS dashboard and is roughly 10% of the intended reference quality.
- Future work must reframe Cambium R3F as a desktop/Electron game-engine experience: widescreen, spatial, cinematic, game-tested interaction patterns, non-dashboard HUD, deeper island/level design, camera rigs, material/lighting studies, and no mobile-first assumptions.
