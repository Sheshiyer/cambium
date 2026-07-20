# Plan — Mini-App Surfaces → 2.5D R3F Integration + KB/Graph + RBAC

Date: 2026-07-21
Status: draft
Scope decision (user, verbatim): "not rebuild — integrate this ui, understanding what we have built already as a 2d version, in the 3d app" · "keep it semi 2-and-a-half-d like we have now already"

---

## What we already have (the assets this plan integrates, not replaces)

| Surface | Where | What it is |
|---|---|---|
| **2D mini-app UI/UX** | `workers/quests/src/` (`handler.ts`, `page.ts`) | Telegram mini-app "mission control": 5 scenes (`mission`, `gate`, `tools`, `story`, `inspect`), 5 sections, 21 map subsections, served per-tenant |
| **Surface contract** | `workers/quests/src/mini-app-surface-contract.ts` | Machine-readable taxonomy: scenes, sections, subsections, ecosystem targets (18), interaction kinds (`sheet`, `signed-action`, `chat-command`, `read-only`, `external-proof`) |
| **2.5D R3F app** | `apps/cambium-r3f/src/` | Semi-2.5D organ map: `home` overview + island screens (genesis/taste/build/ops/cortex), `SceneHud` (operator strip, route dock, diegetic readout, camera dial, instruments), camera modes `overview / node / flat` — `flat` is already the 2D hosting mode |
| **KB — semantic** | `bin/operator/cortex-memory.ts`, `cortex-sqlite.ts`, `vectorize-cortex.ts` | 1024-d recall across runs, per-tenant |
| **KB — structural / graph** | `bin/operator/codegraph-recall.ts`, tapestry snapshot (six-scale map: skill→cluster→organ→venture→company→portfolio) | Code recall lane + bounded JSON graph |
| **Multi-tenancy** | `bin/operator/tenant.ts` (M3 shipped) | Slug registry, adversarial isolation, all-tenant heartbeat — the substrate RBAC extends |

## The one insight the plan turns on

`MiniAppInteractionKind` is already a permission taxonomy. `read-only` < `sheet` < `external-proof` < `chat-command` < `signed-action` is a capability ladder. RBAC roles are just *ceilings on that ladder*:

| Role | Ceiling | Meaning |
|---|---|---|
| **founder** | `signed-action` | everything, incl. gates, promotions, queue actions |
| **team** | `chat-command` | operate, but no signed mutations without founder approval |
| **consultant** | `read-only` (+ nominated `external-proof`) | scoped visibility, zero mutation, per-subsection allow-list |

Enforcement is **server-side at the envelope layer** (worker filters sections/subsections/controls by role before serializing). The R3F client only renders what the envelope contains — no client-side hiding, nothing to leak.

## Visual Plan — derived from `Video-595.mp4` reference (2026-07-21)

A 9.9s screen capture of a "second brain" constellation UI. This is the **target art direction for the graph layer** (Phase 2) and the overall KB visualization. Observed design language, mapped to cambium-r3f constructs:

| # | Observed element (frame evidence) | Cambium mapping |
|---|---|---|
| V1 | **Radial constellation overview** — 7 department clusters arranged in a ring around a central particle-burst "compiled brain" (f01) | The six-scale **tapestry** rendered as a ring of organ/venture clusters around a cortex core; center burst = cortex memory field (`cambium-field.ts`) |
| V2 | **Dendrite clusters** — each hub is a glowing ring-node with an icon; children branch outward as trees of small glowing dots on thin line segments, 2–4 levels deep (f01, f03, f10) | New `ConstellationCluster` world component: hub = island/organ, branches = jobs/quests/skills from the tapestry JSON; replaces generic node scatter for graph data |
| V3 | **Per-cluster accent color** — Deals red, Operations green, Back Office amber, others warm-white (f01, f03, f07) | Extend `visual-tokens.ts` with per-island accent hues (already tonally aligned: signal/mist/depth → accent per organ) |
| V4 | **Giant watermark label** — the focused department's name rendered huge and dim behind the graph (f03 "INTELLIGENCE", f07 "BACK OFFICE", f10 "MARKETING") | HUD/scene watermark per focused screen — extends `SceneHud` eyebrow concept into a scene-layer text plate |
| V5 | **Bottom focus label + 4-word subtitle** — "OPERATIONS / onboarding · builds · client ops", "BACK OFFICE / money · tools · hires · plans" (f03, f07) | `diegetic-readout` adopts this exact pattern: screen title + 4-dot-separated capability words from the surface contract |
| V6 | **`<` `>` chevrons** flanking the bottom label to cycle departments (f01, f03) | Route dock gains prev/next cycling; keyboard arrows too |
| V7 | **Top segmented nav pill** — `MAP | DASHBOARDS | WORKFORCE`, active segment lit (f05, f09) | Camera/view pill in `SceneHud`: `MAP` (2.5D constellation) · `SHEETS` (mini-app surfaces) · `WORKFORCE` (RBAC/team view, Phase 4) — three top-level modes |
| V8 | **Zoom-to-cluster transition** — selecting a hub camera-pushes into its dendrite tree; unfocused clusters dim and fall back (f02→f03, f06→f07) | `camera-rig.tsx`: hub select → `node` mode push-in; deselect → `overview`; non-focused clusters reduce emissive intensity |
| V9 | **Edge micro-labels** — tiny caps labels at cluster periphery ("CREATION", "REPURPOSING", "BRAND DEALS") (f10) | Subsection labels from `MINI_APP_MAP_SUBSECTIONS` rendered at branch tips in flat/node mode |
| V10 | **Near-black canvas, sparse starfield, warm-white glow nodes, thin hairline edges** (all frames) | Already the cambium-r3f baseline (near-black + warm glow) — confirmed compatible, no palette fight |
| V11 | **Overview↔focus is one continuous scene**, never a page change | Matches the freeze: sheets/graph are layers in the same 2.5D scene, no DOM page swaps |

**Visual-plan deltas to the phases below:**
- Phase 2's `tapestry-graph` layer IS the V1/V2 constellation: ring-of-clusters overview + dendrite drill-down, built as a `ConstellationCluster` + center `cortex-field` burst.
- Phase 1's sheets open in the V7 `SHEETS` mode (flat camera), so 2D legibility never fights the constellation.
- Phase 4's team/consultant view lands in the V7 `WORKFORCE` mode — principals as their own mini-constellation (role-colored hubs, allow-listed branches), which makes RBAC *visible*: a consultant literally sees only their lit branches.
- `MAP/DASHBOARDS/WORKFORCE` pill is the RBAC-aware nav: consultants only receive the modes their role permits in the envelope.

---

## Current state — verified live (2026-07-21)

Ran the system locally before planning execution. Evidence:

- **R3F app** (`npm run r3f:dev` → http://127.0.0.1:5173, screenshots taken): 10 screens in the route dock (`CAMBIUM, GENESIS, TASTE, BUILD, OPS, CORTEX, ELEMENTS, VISUALIZATIONS, CAMBIUM DESIGN SYSTEM, ASSET QA`), 3 camera modes. **Flat mode is already a top-down ring-of-islands with a dotted quest rail** — structurally the video reference's cluster ring, but islands are 3D dioramas with no internal node graph.
- **Instruments are static**: cortex screen panels (`SEMANTIC sqlite/vector`, `STRUCTURAL codegraph`…) are hardcoded strings in `route-registry.ts`, not live envelope data. This is the precise seam Phase 1's adapter must replace.
- **Watermark label (V4) already exists** — giant `CAMBIUM` behind the scene; extends naturally to per-screen names.
- **KB works headlessly**: `operator demo` shows the wake loop with live recall (`recall: 3 similar past situations → last "macro · hold…" ↺3`); `operator coderecall "wake"` returns 5 structural neighbors; demo tenant fixtures + `/tmp/demo-org.tapestry.json` snapshot generated cleanly.
- **No auth anywhere**: no login, principal, or role concept in worker or R3F — Phase 4 starts from zero on identity, but not on tenant isolation (M3).
- **Mini-app contract is worker-local**: `mini-app-surface-contract.ts` is not importable by the R3F app today — Phase 0's shared-package move is real work, not a formality.

## Non-negotiables (constraints)

1. The shipped 2.5D art direction (`docs/plans/cambium-r3f-implementation-freeze.md`, reference-gate tests) is preserved. 2D content lands as **HUD sheets and flat-camera panels**, never as a DOM page replacing the scene.
2. `mini-app-surface-contract.ts` remains the single source of truth. R3F consumes it; it does not fork it.
3. The Telegram mini-app keeps working unchanged until each scene's R3F parity is proven and gated.
4. Every RBAC filter is provable by a test that diffs envelopes per role (like the existing `topic-map-drift.test.ts` pattern).

---

## Phase 0 — Contract unification (0.5–1 day)

**Goal:** one surface contract, two renderers.

- Extract `mini-app-surface-contract.ts` into a shared package importable by both `workers/quests` and `apps/cambium-r3f` (mirror the existing `shared/cambium-visual-contract.ts` pattern referenced by the `inspect` section).
- Add a scene→screen mapping table: `mission→home`, `gate→overlay:founder-gate`, `tools→island panel mode`, `story→story rail`, `inspect→island-cortex`.
- Extend R3F `types.ts` `ScreenSpec` with an optional `miniAppScene: MiniAppSceneId` field; keep all existing fields untouched.
- **Exit test:** contract imports cleanly in both tsconfigs; `route-registry.test.ts` still green; no visual change (reference-gate passes).

## Phase 1 — Read-only surfaces in the 2.5D scene (2–4 days)

**Goal:** every mini-app *read-only* and *sheet* surface visible inside the R3F app, art-direction intact.

- New `SceneSheet.tsx` HUD component: renders a `MiniAppSurfaceSection` as a diegetic sheet (extends the existing `diegetic-readout`/`scene-instruments` HUD language, coolshape specimen + instrument lines).
- `scene-data.ts` gains an envelope adapter: fetch the worker's quest-ledger envelope → hydrate sheets for `mission-control`, `story-feed`, `inspect` and the 21 map subsections.
- Camera: selecting a sheet bumps to `flat` mode (2D legibility); deselecting returns to `overview`/`node`. The 2.5D islands stay live behind the sheet.
- Route dock gains the 5 mini-app scenes alongside island screens.
- **Exit test:** desktop-qa-policy + a new `sheet-parity.test.ts`: every read-only/sheet control in the contract has a rendered sheet; screenshot pack shows unchanged art direction.

## Phase 2 — KB + graph integration (3–5 days)

**Goal:** the cortex and the tapestry become navigable layers of the scene.

- **Semantic lane:** `island-cortex` screen gets a recall sheet — query box → `coderecall`/cortex-memory results as instrument lines (read-only; reuses the CLI lanes, no new backend).
- **Graph layer:** new `VisualizationLayer` kind `tapestry-graph` — renders the six-scale tapestry snapshot (skill→cluster→organ→venture→company→portfolio) as the **V1/V2 constellation**: a ring of organ clusters around a central cortex burst (reusing `cambium-field.ts`), each cluster a `ConstellationCluster` dendrite tree on the existing `generated-connectors` rails, per-organ accent hues (V3), zoom-to-cluster via `camera-rig` (V8), branch-tip micro-labels (V9). Node selection focuses the matching island.
- **Senses/companions subsections** (already cortex-targeted in the contract) hydrate from the same adapter as Phase 1.
- **Exit test:** tapestry snapshot loads for `demo-org`; selecting a graph node navigates to the matching screen; recall sheet returns results for a synthetic query on the demo tenant.

## Phase 3 — Interactive surfaces (3–5 days)

**Goal:** `chat-command` and `signed-action` controls work from the scene.

- Wire `signed-action` controls (founder-gate, `queue-side-quest`, `promote-skill-review`) through the existing worker gate queue — sheet becomes a confirm dialog; action posts to the worker; result beat appears in `story-feed`.
- `chat-command` controls (operator toolbelt) get a command line in the HUD (flat mode), posting to the same endpoint the Telegram surface uses.
- **Exit test:** on `demo-org`, queue a side-quest from the R3F sheet and see the story beat; founder-gate approve/reject round-trips; Telegram mini-app shows the same state (single backend).

## Phase 4 — RBAC (4–6 days)

**Goal:** founder / team / consultant roles enforced server-side, shareable per tenant.

- **Identity:** magic-link or Telegram-identity login at the worker; a `principals` table per tenant: `{ id, tenant, role, allow: MiniAppMapSubsectionId[], createdBy }`.
- **Envelope filter:** worker middleware applies the role ceiling + consultant allow-list to `MINI_APP_SECTIONS`/`MINI_APP_MAP_SUBSECTIONS` before serialization; disallowed controls are *absent*, not disabled.
- **Tenant substrate:** reuse `tenant.ts` registry — roles are per-tenant-slug, isolation tests extend to role cross-access (adversarial: consultant token for tenant A cannot read tenant B).
- **R3F:** login screen (flat mode, on-brand), role badge in the operator strip, zero conditional rendering logic beyond "render what the envelope has".
- **Consultant sharing:** founder generates a scoped invite link (role=consultant + subsection allow-list + expiry); revocation list in the worker.
- **Exit tests:** (1) envelope diff test per role — consultant envelope contains only allow-listed read-only/external-proof controls; (2) adversarial cross-tenant test; (3) signed-action from a team account returns 403 with an audit log entry; (4) expired invite returns 401.

## Phase 5 — Hardening & handoff (2–3 days)

- Audit log surface (who approved what) as a `story-feed` beat source.
- Onboarding overlay per role (consultant sees a 3-step "what you're looking at" tour over the 2.5D scene).
- Docs: `docs/adopters/` entry for inviting team/consultants; architecture refresh per `docs/architecture/REFRESH-NEEDED.md`.
- **Exit test:** a consultant with zero context completes the tour and answers "what stage is venture X in" from the scene alone.

---

## Sequencing & parallelism

- P0 blocks everything. P1 ∥ P2 (different files: HUD sheets vs graph layer). P3 depends on P1. P4 depends on P1 (envelope adapter) and can start its worker-side filter in parallel with P2/P3. P5 last.
- Suggested dispatch: P1 + P2 as parallel build tracks; P4 worker filter on the external/parallel rail; P3 + R3F login sequential in-session (touch shared HUD state).

## Anti-goals (out of scope)

- No full-3D conversion of sheet content (2.5D is the freeze).
- No replacement of the Telegram mini-app (it stays a first-class surface on the same contract + backend).
- No org-level RBAC beyond founder/team/consultant (no custom permission editor in this plan).
- No public/anonymous sharing tier.
