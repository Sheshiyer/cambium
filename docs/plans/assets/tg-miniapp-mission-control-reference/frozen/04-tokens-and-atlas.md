# 04 — Tokens & Atlas Spec (from `source/cambium-design-system-source.png` + `source/cambium-atlas-source.png`, both 1536×1024)

## Design system board — verified tokens (zero deltas at native res)
- **Colors:** `#00272B` DEEP BASE · `#012F34` SURFACE · `#E0FF4F` ACCENT · `#D6FFF6` HIGHLIGHT · `#231651` VOID · `#F5F3E8` PAPER · `#FFC7A1` WARNING.
- **Grid:** 8px, base unit 8. **Radius:** 2/4/8/16. **Elevation:** 0 FLAT / 1 RAISED / 2 HIGH / 4 FLOAT (stacked isometric slabs, increasing offset shadow).
- **Spacing scale:** 8/16/24/32/48/64px.
- **Type scale (condensed sans + mono data):** H1 64/72 track −0.02 · H2 40/48 −0.01 · H3 28/36 −0.01 · H4 20/28 0 · BODY 14/20 · CAPS 12/16 track +0.06/+0.08 · MICRO 10/14 track +0.08/+0.12 · DATA 10/14 MONO track +0.08.

## Controls anatomy
- **Buttons:** IDLE outline (surface border) · HOVER chartreuse outline + chartreuse text · PRESSED solid chartreuse fill, dark text · DISABLED dim outline, low-contrast text.
- **Chips:** icon + label + × dismiss; variants: count chip ("9/17"), ACTIVE (star icon, chartreuse outline), WARNING (triangle icon, peach outline/text).
- **Toggles:** pill switches; off = mint knob; on = chartreuse knob/track.
- **Sliders:** horizontal track, ring handle, mono readout chips ("42.0", "0.73").
- **Segmented control:** ALL | ACTIVE | STALE | FLAGGED; active segment = chartreuse fill, dark text.
- **Progress:** dotted-ring gauges at 0/25/50/75/100% — solid chartreuse arc grows clockwise over dotted track; large arc ring pairs with "9/17" readout.

## State conventions (node-graph canon)
Six states over one hub-and-satellite graph: IDLE (mint/neutral) · ACTIVE/CURRENT (chartreuse glow + 9/17 callout) · STALE (desaturated, dimmed) · WARNING (peach accents + triangle badge) · SELECTED (chartreuse ring around focus node + 9/17) · REDUCED MOTION (static, no particle trails).
Text legend: IDLE "No interaction" · ACTIVE "In progress" · STALE "Outdated data" · WARNING "Attention" · SELECTED "Current focus" · REDUCED MOTION "Minimizes animation".
Interaction legend: NODE selectable location · RAIL connection path · PACKET data unit · RING progress indicator · STATUS state indicator.

## Panel patterns (reuse for Inspect scene)
- **EMPTY STATE:** dashed circle + node icon, "No nodes discovered / Initialize a survey to begin exploring." + outline CTA.
- **LOADING STATE:** "Synchronizing network / Please wait…" + linear progress bar (72%).
- **ERROR STATE:** peach warning triangle, "Signal lost in strata / Check connection and try again." + RETRY outline button.
- **NODE VIEW (selected):** ID + ACTIVE chip, large glyph with orbit arc; right column TYPE / STATUS / PROGRESS bar / PACKETS count / LAST SEEN mono + packet scatter.
- **LIST PANEL:** "NODES 9/17", numbered rows (01 GENESIS…05 CORTEX) + status labels; selected row = chartreuse outline.
- **DATA PANEL:** "PACKET FLOW (LAST 60S)" dot scatter (mint + peach); stat row IN/OUT/DROP/LAT mono.

## Atlas board (`cambium-atlas-source.png`) — conventions, not components
Concept/hero board: isometric dark-teal terrain, dotted topographic contours, diagonal etched grid. Central hub (rosette, glowing chartreuse core) → rails (dark tubes with evenly spaced node beads) → satellite glyph nodes labeled in chartreuse caps: GENESIS star, TASTE capsule ring, BUILD nested triangle, OPS trough-slab, CORTEX spoke-wheel, ARC X crescent.
Selection annotation canon: dotted orbit circle + chartreuse arc with handle dot + "9/17" readout.
Flat node view: concentric dotted orbit rings + bold chartreuse progress arc with terminal dots; vertical particle streams (mint + peach); ring gauge (~65%) beside large "9/17"; six-row icon+label list with dotted leaders + mini spark meters.
Bottom specimen strip: each glyph decomposes into shared primitives — curved beaded rails, dotted arcs, vertical dotted rules with square/round stops, particle columns.
**Use in-app:** constellation textures on MissionCard and branch-map views follow this convention (rails + beads + one active hub), always decorative-behind-content, never competing with state tokens.

## Footer telemetry canon (mono)
FPS 60 · MEM 512MB · NODES 9/17 · PACKETS 1,248 · UPTIME 01:42:17 — the model for Inspect's telemetry rows.

*Not determinable: exact border weights, blur values, font family name.*
