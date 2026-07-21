# UI/UX Deep Pass — Prune + Constellation Convergence Plan

Date: 2026-07-21
Status: proposal (no code changed yet)
Reads: route-registry.ts, implementation-freeze, docs/visual/README.md, waves 1–3 commits

---

## The goal, restated

Cambium compiles an idea into a self-running, on-brand business. The **R3F app is becoming the shared spatial UI for that business**: one 2.5D map where the founder, the team, and (scoped) consultants see the same living venture — organs as islands, quests as rails, memory as the cortex field, the tapestry as a constellation graph — with mini-app sheets for detail and RBAC deciding what each role can see and touch.

Three layers, one scene:
1. **Spatial model** — the constellation (tapestry rendered as cluster ring + dendrites). *Landed: layout, component, scene layer (fixture-driven).*
2. **Content model** — the mini-app surface contract (5 scenes, 21 subsections). *Landed: shared package, sheets, parity test, worker RBAC filtering.*
3. **Sharing model** — founder/team/consultant ceilings, invites, audit. *Landed: rbac.ts, invites.ts, audit.ts, handler filtering.*

## What the 10 screens actually are (the deep pass)

| Screen | Built for | Verdict |
|---|---|---|
| `home` | product: organ map overview | **KEEP** — becomes the constellation home |
| `island-genesis/taste/build/ops/cortex` | product: organ drill-down | **KEEP** — hub zoom targets (V8) |
| `visualizations` (T012) | milestone issue #38: "operator cockpit" with **static** panels | **REPURPOSE** — it now hosts the constellation layer; fold into `home` or rename to MAP |
| `elements-settings` (T011) | milestone issue #37: settings board, **all panels are hardcoded strings** | **PRUNE** — nothing is wired; real settings belong in a sheet |
| `figma-components` (T013) | milestone issue #39: design-system inventory (`ComponentSpecimens`) | **PRUNE** — pure cosmetic dev tool, not a product surface |
| `asset-comparison` (R3F-GE-ASSET-QA) | issue #52: art-pipeline promotion bench | **PRUNE from dock** — dev/art tool; keep code behind a dev flag if still needed for Meshy asset QA |

The freeze doc confirms these four were **Phase-2 reference-parity scaffolding** ("Home, five islands, settings, visualizations, and component board render" = milestone exit criteria), not the product's target UX. They did their job: the art direction survived. Now they dilute the dock.

## Dead/unwired UX (built but not mounted)

| Artifact | State | Action |
|---|---|---|
| `SceneSheet.tsx` + envelope adapter + `FIXTURE_SHEET_ROWS` | component exists, **not mounted** in SceneHud | Wire: sheet opens on subsection select (SHEETS mode) |
| `ConfirmActionSheet.tsx` | component exists, not mounted | Wire in P3 gate round-trip |
| `OnboardingOverlay.tsx` + `ROLE_TOUR_STEPS` | component exists, not mounted | Wire to first-visit / role entry |
| `routeDrafts.panels` | **every instrument line in the app is a hardcoded string** | Replace per-screen with envelope/contract-backed rows (the seam identified in the live review) |
| Constellation layer | fixture-driven, floats over VisualizationField | Drive from real tapestry snapshot; make it THE overview, not an overlay |
| Worker `surface` envelope | served when principal provided | R3F doesn't fetch it yet — Phase 1 adapter wiring |

## UX problems to fix in the same pass

1. **Two overlapping map metaphors** — diorama islands AND constellation both claim "overview". Resolve: constellation at overview/zoom-out, diorama at island zoom-in (exactly the video reference's behavior).
2. **Route dock is 10 wide** — 4 are dev tools. Product dock: `MAP · GENESIS · TASTE · BUILD · OPS · CORTEX` + mode pill `MAP | SHEETS | WORKFORCE` (V7).
3. **Instruments lie** — static strings ("SEMANTIC sqlite/vector") presented as live telemetry. Either wire them or label them as fixtures until wired (no-fake-progress doctrine).
4. **Telemetry strip is static** (`ALL QUESTS · 17/17 · LIVE · T005`) — same doctrine issue; it has a real source (`sourceContract.questSummary`) but never updates per tenant.

## Constellation convergence plan (the ask)

**C1 — Prune (0.5 day)**
- Remove `elements-settings`, `figma-components`, `asset-comparison` from `routeDrafts` + dock; gate `ComponentSpecimens`/asset bench behind `?dev=1` query flag instead of deleting (art pipeline may still need it).
- Delete `ControlBay` wiring for settings; keep `visualTokens` (that's the real design system).
- Update `route-registry.test.ts`, reference-gate, and QA-policy tests to the 7-screen product dock.

**C2 — Constellation becomes home (1–2 days)**
- `home` screen renders `ConstellationMapField` as the primary overview (ring of 5 organ clusters + cortex center burst), dioramas demoted to island screens only.
- Drive from the real tapestry snapshot (fetch `tapestry:snapshot` output; fallback fixture) instead of `fixture-tapestry.ts`.
- Hub click → existing island screen navigation (reuses V8 camera push); cluster focus dimming already landed.
- Branch-tip micro-labels (V9) in flat/node camera only.

**C3 — Sheets mounted (1–2 days)**
- `SHEETS` mode in the HUD pill: selecting any of the 21 subsections opens its `SceneSheet` (flat camera), rows from the worker envelope (`surface.subsections` + quest rows), `FIXTURE_SHEET_ROWS` only as offline fallback.
- Instruments on island screens hydrate from the same adapter — static `routeDrafts.panels` die here.

**C4 — Workforce + identity (2–3 days)**
- `WORKFORCE` mode: principals as a mini-constellation (founder hub, team/consultant branches, role-colored) — makes RBAC visible.
- Login: magic-link or Telegram-identity at the worker → `x-principal` header from R3F; role badge in the operator strip; `OnboardingOverlay` on first entry per role.
- Invite flow UI: founder generates consultant invite link (invites.ts already signs/verifies) from the WORKFORCE sheet.

**C5 — Gate round-trip (1–2 days)**
- `ConfirmActionSheet` mounted for signed-action controls → posts to worker gate queue → story beat returns (audit.ts events become story-feed beats).

**Order:** C1 first (shrinks the surface before building on it), C2 ∥ C3, C4 after C3 (needs sheets), C5 last.

## Canonical design source review (2026-07-21)

Reviewed `docs/plans/assets/tg-miniapp-mission-control-reference/source/` (atlas + design-system sheet). These are the **visual language authority** beside the freeze — and they already contain the constellation's design vocabulary:

- **The design system's "GLYPH NODES" panel IS a constellation cluster**: a central flower/cortex node with organ satellites on chain-link connectors. The Video-595 dendrites must adopt this — **chain-link edges + organ glyph hubs**, not plain hairlines + dots.
- **Organ glyphs (canonical):** genesis = six-point star, taste = capsule, build = triangle, ops = faceted slab, cortex = wheel. Hubs in `ConstellationCluster` should render these glyphs (or their Coolshapes equivalents, already used in SceneHud).
- **Tokens:** `#00272B` deep base, `#012F34` surface, `#E0FF4F` chartreuse accent, `#D6FFF6` highlight, `#231651` void, `#F5F3E8` paper, `#FFC7A1` warning. 8px grid, radius 2/4/8/16, elevation 0/1/2/4. Type: condensed sans, caps track 0.06, mono for data. Motto: **"ORGANIC SYSTEMS. PRECISE DATA."**
- **Where Video-595 conflicts:** the video's near-black + warm-white loses to the canonical deep-teal + chartreuse. Keep the video's *structure* (ring, dendrites, zoom, mode pill) but render it in canonical tokens.
- **Node-view panel pattern (canonical):** `ID · TYPE · STATUS · PROGRESS % · PACKETS · LAST SEEN` — this is the exact row model `SceneSheet` should hydrate for organ/cluster selection.
- **States (canonical):** idle / active / stale / warning / selected / reduced-motion — map directly onto tapestry node `status` values in the constellation layer.

**Deltas to C2:** constellation edges become chain-link styled; hubs carry organ glyphs; accent = chartreuse family per tokens, not warm white; sheet rows follow the node-view panel pattern.

## Anti-goals

- No deleting the art pipeline code outright (dev flag, not deletion).
- No new screens beyond MAP/SHEETS/WORKFORCE modes.
- No diorama rebuild — the frozen art direction stays; only the overview metaphor changes.
