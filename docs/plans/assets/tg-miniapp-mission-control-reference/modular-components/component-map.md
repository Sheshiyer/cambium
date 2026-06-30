# TG Mini App Modular Component Map

Date: 2026-06-29
Source references:

- `../source/cambium-design-system-source.png`
- `../source/cambium-atlas-source.png`
- `../mission-control-mobile-reference.png`

## Purpose

Convert the Cambium visual references into reusable TG mini app UI components so the Mission Control implementation does not drift into generic cards or architecture-first copy.

## Core Glyph Components

### `MissionGlyph`

Reusable abstract glyph for branch/stage identity.

Variants:

- `genesis`: star/seed form.
- `taste`: capsule/link form.
- `build`: triangle/gate form.
- `ops`: folded slab form.
- `cortex`: radial ring form.
- `arc`: crescent branch marker.
- `proof`: dotted receipt ring.
- `gate`: warning triangle or review aperture.

Rules:

- Glyphs are ornamental identity, not buttons by themselves.
- Primary label must remain text-first for accessibility.
- Active glyphs get chartreuse halo and one orbit ring.
- Warning glyphs get peach stroke and no glow bloom.
- Locked glyphs desaturate to soft mint at low opacity.

## State Components

### `StateToken`

Compact label for one status.

States:

- `idle`: thin mint border, muted text.
- `active`: chartreuse border, filled dot, selected underline.
- `selected`: chartreuse orbit ring or left rail highlight.
- `complete`: check mark inside chartreuse circle.
- `blocked`: peach warning triangle plus solid row border.
- `locked`: lock icon, low-opacity border.
- `stale`: peach chip, no success color.
- `reducedMotion`: static ring with visible state label.

## Circle And Orbit Components

### `OrbitProgress`

Circular progress indicator for questline and KPI pulse.

Props:

- `value`: `0..100`
- `state`: `idle | active | complete | blocked | stale`
- `label`
- `showPacketDots`

Visual rules:

- Use partial chartreuse arc for active progress.
- Use full chartreuse ring for complete.
- Use peach segment and warning marker for blocked.
- Use dotted inactive ring for pending proof.
- Never use color alone; pair with icon or label.

### `SelectedHalo`

Selection treatment for branch chips, mission nodes, and detail sheets.

Rules:

- One selected item per rail.
- Use one clean orbit or underline, not multiple competing highlights.
- Prefer transform/opacity animation only.

## Rail And Packet Components

### `SignalRail`

Thin curved or straight connection path between mission nodes.

States:

- `idle`: muted mint line.
- `active`: chartreuse line with sparse packet dots.
- `blocked`: dashed line ending in peach warning token.
- `locked`: dashed low-opacity line.

### `PacketFlow`

Tiny dot stream used sparingly to imply live movement.

Rules:

- Packet dots travel along rails only.
- Do not cover text.
- Reduced motion freezes packets into a static dotted trail.

## Mission Control Components

### `BranchArcChip`

Horizontal chip for branch selection.

Content:

- `MissionGlyph`
- Branch name.
- Optional `StateToken`.

### `MissionCard`

Dominant card for next mission.

Content:

- Eyebrow: `Next Mission`
- Mission title.
- Owner, gate, dispatch target, promotion state.
- Small branch map/rail texture.
- `QuestlineTimeline`.

### `QuestlineTimeline`

Four to six mission stages with state tokens and rail connections.

### `ProofList`

Rows for proof needed.

Rules:

- Row text must describe a founder-understandable proof item.
- Raw route/source/schema values belong in Inspect, not here.

### `KpiPulse`

Compact KPI block with orbit rings and small packet bars.

## Motion Primitives

### `orbitSweep`

Used for active `OrbitProgress` and selected branch chips.

- Duration: slow, calm.
- Easing: smooth cubic.
- Reduced motion: static partial ring.

### `packetDrift`

Used on `SignalRail`.

- Dots move along the rail path.
- No fast sparkle.
- Reduced motion: static dots.

### `glyphBreathe`

Used only for the current branch/stage.

- Scale range is subtle.
- No pulsing on warning/blocked states.

### `warningAttention`

Used for blocked proof or Gate review.

- Peach stroke appears once, then rests.
- No flashing.

## Anti-Drift Rules

- Do not replace glyphs with generic SaaS icons.
- Do not use large rounded marketing cards.
- Do not show raw architecture copy on primary cards.
- Do not add purple/blue AI gradients.
- Do not make proof gaps look successful.
- Do not animate more than one primary focal point at a time.
