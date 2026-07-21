# Constellation UI Reference — Main-Usage Screens

Generated 2026-07-21 via gpt-image-2 (Codex OAuth), anchored on the canonical
sources in `../tg-miniapp-mission-control-reference/source/`. These are the
**target UI references for the convergence plan** (`docs/plans/2026-07-21-ui-prune-constellation-convergence.md`)
— the app's main usage surfaces, in canonical brand tokens (`#00272B` / `#012F34` / `#E0FF4F`).

| File | Screen | Convergence step | Implementation notes |
|---|---|---|---|
| `01-map-overview.png` | **MAP — constellation home** | C2 | Ring of 5 organ glyph hubs + cortex flower center with particle burst; chain-link connectors; dendrite child nodes; `9/17` orbit ring; route dock + `MAP \| SHEETS \| WORKFORCE` pill |
| `02-cluster-node-view.png` | **Cluster zoom (node view)** | C2 | Camera pushed into one cluster; unfocused clusters ghost; node-view panel pattern `ID · TYPE · STATUS · PROGRESS · PACKETS · LAST SEEN` + dendrite spark-map; `OVERVIEW \| NODE \| FLAT` camera dial |
| `03-sheets-mode.png` | **SHEETS mode** | C3 | Diegetic sheet over dimmed constellation; instrument ruled rows; state chips (ACTIVE/STALE/LOCKED); CONFIRM/CANCEL — the `SceneSheet` + `ConfirmActionSheet` targets. (Header echoes "design system" — ignore; use CAMBIUM brand strip) |
| `04-workforce-mode.png` | **WORKFORCE mode (RBAC)** | C4 | Founder hub + team/consultant branches; pruned consultant as dotted/faded branch; invite token row + COPY LINK / REVOKE; allow-list chips per consultant; network summary ring. The visual answer to "what does a consultant see" — only their lit branches |

## Rules for use

- Structure comes from these references; **tokens/glyphs/type come from the canonical design-system sheet** — where they disagree, the canonical sheet wins.
- These are direction references, not pixel-parity gates (pixel parity remains reserved for the freeze manifest flow, T001).
- Regenerate with `--image` anchoring on both canonical sources if the brand shifts.
