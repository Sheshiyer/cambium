# Mission Control Modular Components

Generated: 2026-06-29
Model: `gpt-image-2` through Codex OAuth

This packet converts the Cambium design-system and atlas references into modular TG mini app component targets.

## Source References

- `../source/cambium-design-system-source.png`
- `../source/cambium-atlas-source.png`
- `../mission-control-mobile-reference.png`

The clipboard images were copied into `../source/` so the design contract does not depend on temporary `/var/folders` paths.

## Component Map

- `component-map.md`

Defines the reusable UI vocabulary:

- `MissionGlyph`
- `StateToken`
- `OrbitProgress`
- `SelectedHalo`
- `SignalRail`
- `PacketFlow`
- `BranchArcChip`
- `MissionCard`
- `QuestlineTimeline`
- `ProofList`
- `KpiPulse`
- `GateActionRow`

## Generated References

1. `images/01-component-glyph-state-board.png`
   - Component inventory for glyphs, states, orbit rings, mission composites, legends, and motion primitives.
2. `images/02-mission-control-state-stack-mobile.png`
   - Mobile Mission Control screen showing selected, blocked, proof-needed, and locked states in context.
3. `images/03-motion-storyboard-mobile.png`
   - Animation storyboard for selected halo, questline progress, proof orbit, packet rail, and Gate attention.

## Implementation Use

- Build component primitives from `component-map.md` before rewriting the full screen.
- Keep animation names stable: `orbitSweep`, `packetDrift`, `glyphBreathe`, `warningAttention`, `reducedMotion`.
- Treat source/proof architecture as Inspect/detail content, not primary card copy.
- Do not promote blocked or proof-only states visually as ready.
