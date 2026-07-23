# TG Mini App Scene Data Contracts (P1-W3 · T-011)

Status: draft for P2 scene builders. These contracts bind each of the five tabs to
the frozen wire shapes; they do **not** create new envelope shapes. Where a scene
needs data, the source is always a field of an envelope already frozen in
`../tg-miniapp-contract-v2.md` (v2) or a static client constant.

## Files

| File | Scene | Tab index | Scene root | Word cap (frozen/05) |
|---|---|---|---|---|
| `mission.json` | Mission | 0 | `#stem` | ≤ 90 |
| `gate.json` | Gate | 1 | `#gate` (+ `#gauge`, `#gateHeroDecision`) | ≤ 110 |
| `tools.json` | Tools | 2 | `#cmds` | ≤ 80 |
| `story.json` | Story | 3 | `#beats` | ≤ 70 |
| `inspect.json` | Inspect | 4 | `#mapwrap` | ≤ 260 |

Matching fixtures: `workers/quests/src/page/scenes/fixtures/<tab>.fixture.json`
— each covers at least `normal`, one `blocked`, and one `empty` state with
redacted synthetic data (synthetic `fx-*` ids; `sha256:<64 hex>` for any
user/receipt material; no initData, tokens, chat ids, or query strings).

## Contract JSON shape (all five files)

- `sceneId` / `tabIndex` / `sceneRoot` — identity and mount point.
- `refreshRoute` — the route the scene's data comes from.
- `envelopes[]` — frozen envelopes consumed, with schema name and authority
  (from v2 §1/§4). No scene may invent an envelope.
- `components[]` — subset of the **frozen 12** the scene renders:
  `MissionGlyph`, `StateToken`, `OrbitProgress`, `SelectedHalo`, `SignalRail`,
  `PacketFlow`, `BranchArcChip`, `MissionCard`, `QuestlineTimeline`,
  `ProofList`, `KpiPulse`, `GateActionRow`
  (registry: `workers/quests/src/page/client/core.ts` `MC_COMPONENT_REGISTRY`;
  anatomy: frozen `01-component-anatomy.md`).
- `dataFields[]` — every data field the scene consumes: `field` (dot path),
  `type`, `source` (which envelope field / route / client constant),
  `required`, and `fallback` (what renders when absent — explicit gap, never
  inference, per v1 no-fake-progress rules).
- `states.renders[]` — subset of the frozen **8-state language**: `idle`,
  `active`, `selected`, `complete`, `blocked`, `locked`, `stale`,
  `reducedMotion`. Data-derived aliases (e.g. `proof-needed`) map onto these
  via `mcStateKind` and are listed in `states.aliases`.
- `panelBehavior` — `loading` / `empty` / `error` reuse the three panel
  patterns frozen in `04-tokens-and-atlas.md` §"Panel patterns":
  - **EMPTY:** dashed circle + node icon, plain cause, one outline CTA.
  - **LOADING:** "Synchronizing …" + linear progress bar.
  - **ERROR:** peach warning triangle, plain cause, RETRY outline button.
  Scene copy stays within the per-tab word cap; empty/error ≤ 12 words + one
  action button (frozen/05 §2).

## Rules for P2 scene builders

1. Render only what the envelopes contain; missing data renders as the
   declared `fallback`, never as invented content.
2. Never display raw founder ids, raw `initData`, bearer tokens, private chat
   ids, or query strings (v2 §1; `PUBLIC_SECRET_RE` in `handler.ts`).
3. `consumed` / `completed` / `superseded` gate rows leave the active Gate
   list (v2 §1 display rules).
4. Proof/signed receipts render as hashes-only receipt tokens (v2 §5).
5. Copy budgets and the banned-copy list (frozen/05) are wave-gate failures,
   not warnings. kv grids are Inspect-only; no copy-paste command blocks.
6. Fixtures are layout/proof calibration only — they never satisfy live proof
   rows (see `inspect.ts` `branch-fixtures` group).
