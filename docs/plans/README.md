# docs/plans — Active Plans Only

This directory holds **currently-executing plans only**. Executed, superseded, or
exploratory plans live in `docs/archive/plans/` so agents reading this directory
are never misled by stale intent.

## Active

| Doc | Purpose |
|---|---|
| `2026-07-21-ui-prune-constellation-convergence.md` | **Current execution plan** — prune dev-milestone screens, constellation becomes home, sheets mounted, WORKFORCE/RBAC |
| `2026-07-21-r3f-miniapp-integration-rbac-plan.md` | Parent integration plan (phases 0–5, visual plan V1–V11) — superseded in sequencing by the convergence plan above |
| `2026-07-18-lead-ecosystem-integration-review.md` | Lead ecosystem review (recent) |
| `2026-07-10-tg-miniapp-signed-gate-channel-quest-plan.md` | Signed-gate channel quest (recent tg-miniapp work) |
| `cambium-r3f-implementation-freeze.md` | **Frozen** art-direction contract — visual changes route through T001 |
| `cambium-r3f-visual-moodboard.md` + `cambium-r3f-screenshot-pack.md` | Freeze source-of-truth references |
| `cambium-r3f-game-engine-realignment.md` | Visual-product milestone (GitHub #44–#52), non-blocking for standalone release |
| `product-branches/` | Active product branch packets (fitcheck, iverif, vantyx, snow-gloves-os, loop-library) |
| `assets/` | Freeze manifests, reference images, QA fixtures — design sources, not plans |

## Canonical design sources

- `assets/tg-miniapp-mission-control-reference/source/` — the atlas + design-system sheet (tokens, glyphs, states, panels). This is the visual language authority alongside the freeze.
- `assets/constellation-ui-reference/` — generated main-usage screen references (MAP / node view / SHEETS / WORKFORCE) in canonical tokens; the convergence plan’s visual targets.

## Archive policy

- Executed plans → `docs/archive/plans/`
- Superseded superpowers plans/specs → `docs/archive/superpowers/`
- Exploratory visual studies (isometric moodboard, cortex renderable map, art-pass reviews) → `docs/archive/plans/`
- When moving a file, update inbound links (run `npm run render-docs:check` and `node scripts/validate-product-branch-packets.mjs` after).
