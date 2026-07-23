# Frozen Component-Integration Spec — TG Mini App Mission Control

> Status: **pre-frozen** (deep visual pass 2026-07-24). Ratified → frozen at P1-W1 (tasks T-001–T-004).
> Source boards: `../images/0*.png`, `../../mission-control-mobile-reference.png`, `../../source/*.png`.
> Rule: build agents implement these specs EXACTLY. Where a value says "not determinable from image",
> the builder proposes a value and the design-fidelity review adjudicates against the boards.

## Files

| File | Content | Source board |
|---|---|---|
| `01-component-anatomy.md` | All 12 components: anatomy, states, colors, typography | `01-component-glyph-state-board.png` |
| `02-screen-composition.md` | Mobile screen composition, section-by-section, px-proportional | `02-mission-control-state-stack-mobile.png` |
| `03-motion-spec.md` | 5 storyboard strips, named animations, global motion rules | `03-motion-storyboard-mobile.png` |
| `04-tokens-and-atlas.md` | Verified token set, type scale, controls, panels, atlas conventions | `source/cambium-design-system-source.png`, `source/cambium-atlas-source.png` |

## Global invariants (apply to every file)

- Palette: `#00272B` DEEP BASE · `#012F34` SURFACE · `#E0FF4F` ACCENT · `#D6FFF6` HIGHLIGHT · `#231651` VOID · `#F5F3E8` PAPER · `#FFC7A1` WARNING — all seven verified at native resolution, zero deltas.
- Chartreuse = current/actionable only. Peach = blocked/warning only. Dotted/dashed = pending or in-transit. Solid = settled/complete.
- State is always icon + color + rail style — never color alone, never text alone.
- 8px grid; spacing scale 8/16/24/32/48/64. Cards radius ≤ 8px in-app (16–24px only where the mobile board shows it), no card nesting.
- Mono = data/telemetry; condensed sans = titles/labels. Labels uppercase caps with wide tracking.
- Max one animated focal point; no flashing, no motion blur; peach never pulses.
- Banned: purple/blue AI gradients, decorative orbs, glossy hero layouts, marketing cards, copy-paste command blocks, narrative text walls on primary surfaces (detail lives in Inspect).
