# TG Mini App Component Foundation Plan

Date: 2026-06-30
Status: planned and synced to GitHub
Purpose: build the reusable Mission Control component code before page execution starts, so Mission, Gate, Tools, Story, and Inspect do not drift from the modular Cambium references.

## Source References

- Component map: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/component-map.md`
- Component board prompt: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/prompts/01-component-glyph-state-board.md`
- State-stack prompt: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/prompts/02-mission-control-state-stack-mobile.md`
- Motion storyboard prompt: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/prompts/03-motion-storyboard-mobile.md`
- Component board image: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/images/01-component-glyph-state-board.png`
- State-stack image: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/images/02-mission-control-state-stack-mobile.png`
- Motion storyboard image: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/images/03-motion-storyboard-mobile.png`

## Why This Gate Exists

The current UI has improved flow, but many visual primitives still live as page-local `mc*` helpers or placeholder treatments inside `workers/quests/src/page.ts`. That is why Mission can improve while Gate, Tools, Story, and Inspect still feel like older surfaces. The component foundation gate moves the design vocabulary into shared code first, then page issues consume those primitives.

Page issues #100-#199 remain valid feature/integration work. If a page child issue currently names a primitive, treat it as page consumption and composition. The primitive implementation itself belongs to #200-#219.

## Code Extraction Targets

Immediate implementation target: `workers/quests/src/page.ts`.

Allowed refinement: extract a focused mini app component module if it reduces the `page.ts` lock zone without changing Worker runtime semantics. The implementation must preserve stable `data-component` selectors for viewport proof and handler regression tests.

| Extracted primitive | Current code to replace or stabilize | Build issue | Shared consumers |
| --- | --- | --- | --- |
| Component registry/contract | scattered `mc*` helpers and page render functions | #200 | all pages |
| Visual tokens | page-local CSS variables and one-off component classes | #201 | all primitives |
| `MissionGlyph` | `mcGlyphSvg()` Unicode placeholders | #202 | branch chips, cards, timelines, proof, Gate |
| `StateToken` | `mcStateKind()`, `mcStateToken()` taxonomy | #203 | every stateful row/card |
| `OrbitProgress` | `mcOrbitProgress()` plus separate Gate orbit work | #204 | Mission, Gate, KPI, proof |
| `SelectedHalo` | `mc-selected-halo` page-local class use | #205 | branch chips, state rows, sheets |
| `SignalRail` | `mcSignalRail()` and page-specific rails | #206 | mission card, questline, Story, Inspect |
| `PacketFlow` | `mcPacketDots()` | #207 | rails, branch texture, packet bars |
| `BranchArcChip` | `renderBranchArcRail()` chip markup | #208 | Mission rail, Story filters, Gate filters |
| `MissionCard` | `renderMissionCard()` and branch sheet hero | #209 | Mission, branch sheets |
| `QuestlineTimeline` | `renderQuestlineTimeline()`, branch timeline | #210 | Mission, sheets, Story |
| `ProofList` | `renderMissionProofNeeded()`, branch proof rows | #211 | Mission, Gate, Story, Inspect |
| `KpiPulse` | `renderMissionKpis()`, `branchSheetKpis()` | #212 | Mission, branch sheets |
| `GateActionRow` | `renderMissionActions()` and empty-state actions | #213 | Mission, sheets |
| `orbitSweep` | selected/progress animation classes | #214 | orbit progress, selected chips |
| `packetDrift` | packet-dot animation classes | #215 | rails and packet trails |
| `glyphBreathe` | current glyph emphasis | #216 | current branch/stage glyph only |
| `warningAttention` | blocked/Gate warning attention | #217 | Gate, ProofList, State Stack |
| Reduced motion/accessibility | `RM` conditionals and state labels | #218 | all primitives |
| Component gallery/proof fixture | no dedicated primitive proof surface yet | #219 | all page implementers |

## GitHub Issues

| Task | Issue | Component | Deliverable |
| --- | --- | --- | --- |
| TG-MC-C001 | #200 | ComponentRegistry | Create the shared code seam and named primitive API before pages consume it. |
| TG-MC-C002 | #201 | VisualTokens | Build Cambium tokens for color, spacing, radius, contour, density, and safe areas. |
| TG-MC-C003 | #202 | MissionGlyph | Replace placeholder characters with reusable inline SVG glyph variants. |
| TG-MC-C004 | #203 | StateToken | Centralize idle, active, selected, complete, blocked, locked, stale, proof-needed, and reduced-motion states. |
| TG-MC-C005 | #204 | OrbitProgress | Build the shared ring/progress primitive for mission, proof, Gate, and KPI states. |
| TG-MC-C006 | #205 | SelectedHalo | Build one selected-state halo/underline treatment for chips, nodes, and sheets. |
| TG-MC-C007 | #206 | SignalRail | Build idle, active, blocked, and locked rail states. |
| TG-MC-C008 | #207 | PacketFlow | Build bounded packet dots for rails, textures, and static reduced-motion trails. |
| TG-MC-C009 | #208 | BranchArcChip | Build branch chip rail components for selected, stale, blocked, and locked branches. |
| TG-MC-C010 | #209 | MissionCard | Build the Next Mission composite with branch texture, orbit, and product-facing metadata. |
| TG-MC-C011 | #210 | QuestlineTimeline | Build four-to-six stage timelines with glyphs, tokens, rails, and blocked/locked states. |
| TG-MC-C012 | #211 | ProofList | Build proof-needed rows with receipt-ring/glyph states and founder-readable copy. |
| TG-MC-C013 | #212 | KpiPulse | Build orbit KPI rows and packet-bar signal depth without fake progress. |
| TG-MC-C014 | #213 | GateActionRow | Build non-floating Review Gate/Open Proof action rows with preserved click routing. |
| TG-MC-C015 | #214 | orbitSweep | Build the calm selected/progress orbit motion primitive. |
| TG-MC-C016 | #215 | packetDrift | Build the rail-confined packet movement primitive. |
| TG-MC-C017 | #216 | glyphBreathe | Build subtle current-glyph emphasis only for active focus states. |
| TG-MC-C018 | #217 | warningAttention | Build single-pass peach warning attention for blocked proof/Gate review. |
| TG-MC-C019 | #218 | reducedMotion | Build the shared accessibility and static-state fallback contract. |
| TG-MC-C020 | #219 | ComponentGalleryProof | Build a proofable gallery/fixture for all primitives before page execution. |

Machine-readable manifest: `docs/plans/assets/tg-miniapp-component-system-swarm/component-foundation-issues.json`.

## Page Dependency Contract

- Mission page epic #95 and child issues #100-#119 start after the relevant component foundation issues land.
- Gate page epic #96 and child issues #120-#139 start after `MissionGlyph`, `StateToken`, `OrbitProgress`, `SignalRail`, `ProofList`, `GateActionRow`, and `warningAttention` are available.
- Tools page epic #97 and child issues #140-#159 start after `MissionGlyph`, `StateToken`, `BranchArcChip`, `ProofList`, and reduced-motion/accessibility primitives are available.
- Story page epic #98 and child issues #160-#179 start after `MissionGlyph`, `StateToken`, `SignalRail`, `PacketFlow`, `ProofList`, and motion primitives are available.
- Inspect page epic #99 and child issues #180-#199 can proceed in parallel only for source/debug panels, but any component rendering must consume the shared primitives.

## Anti-Drift Acceptance

- No page may add generic SaaS icons in place of `MissionGlyph`.
- No primary page may expose raw architecture copy such as schema, envelope, quest-ledger, operator map, or paperclip command internals.
- No blocked/proof-needed/stale state may use complete/ready success styling.
- No component may animate more than one primary focal treatment at a time.
- Review Gate and Open Proof remain in-flow actions; they may not float over content or block swipes.
- Component code must preserve text-first accessibility and reduced-motion readability.
