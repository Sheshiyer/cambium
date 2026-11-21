---
version: cambium.taste-hands.v0.1
brand_id: cambium
source_sha: 8261d4840988e2e1c6fa6c2eb85cee96d4344b58
research_sha: 1a97cd396709357cffaf45f417dde40c84a50b9a
palette_authority: apps/cambium-r3f/src/scene/visual-tokens.ts
owners:
  taste:
    - frontmatter
    - tokens
    - layout
    - components
    - voice
    - do
    - dont
    - reference_board
  hands:
    - surface_bindings
    - render_proof
  owner:
    - gates
tokens:
  color:
    ink: "#00272B"
    substrate: "#012F34"
    signal: "#E0FF4F"
    mist: "#D6FFF6"
    depth: "#231651"
  alpha:
    hairline: 0.18
    grid: 0.26
    ghost: 0.34
    secondary: 0.62
    strong: 0.86
  type:
    display: '"Arial Narrow", "Aptos Display", "Satoshi", system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  motion:
    orbitSeconds: 90
    packetSeconds: 18
    reducedMotionQuery: '(prefers-reduced-motion: reduce)'
    allowedProperties:
      - transform
      - opacity
  glyphs:
    genesis:
      glyph: seed
      coolshapeIntent: "soft seed shard object for idea intake"
    taste:
      glyph: taste
      coolshapeIntent: "curved resonance object for taste memory"
    build:
      glyph: hands
      coolshapeIntent: "faceted tool object for artifact making"
    ops:
      glyph: will
      coolshapeIntent: "looping operating object for heartbeat and GTM"
    cortex:
      glyph: cortex
      coolshapeIntent: "orbital memory object linking every island"
  materials:
    substrate:
      color: substrate
      roughness: 0.92
      metalness: 0.02
    nodeComplete:
      color: mist
      emissive: substrate
      emissiveIntensity: 0.08
    nodeActive:
      color: signal
      emissive: signal
      emissiveIntensity: 0.18
    nodePending:
      color: depth
      emissive: substrate
      emissiveIntensity: 0.05
    rail:
      color: mist
      opacity: 0.58
    packet:
      color: signal
      opacity: 0.88
    fog:
      color: ink
      near: 8
      far: 24
layout:
  scale: unspecified
components:
  radius: unspecified
  focus: unspecified
voice:
  status: unspecified
do:
  - "Paint only ink, substrate, signal, mist, and depth from visual-tokens.ts."
  - "Use signal or mist for text placed on ink."
  - "Keep viewport proof and screenshot or touch proof at held."
dont:
  - "Do not treat atlas CSS paper, forest, gold, or line as the canonical palette."
  - "Do not place signal on mist."
  - "Do not place substrate or depth on ink as type or as a UI boundary."
  - "Do not add a publish, send, or spend field. Marketing create/send/spend/publish stays disabled."
reference_board:
  - ref: apps/cambium-r3f/src/scene/visual-tokens.ts
    why: "Owner-approved canonical palette and type stacks."
    applies_to: tokens
    resolved: true
    inspected: true
  - ref: apps/cambium-r3f/src/scene/visual-tokens.test.ts
    why: "Palette lock names the same five hexes."
    applies_to: tokens.color
    resolved: true
    inspected: true
  - ref: apps/cambium-r3f/src/curious-world/styles.css
    why: "Baseline paints for the location readout."
    applies_to: curious-world.location-readout
    resolved: true
    inspected: true
  - ref: apps/cambium-r3f/src/curious-world/index.ts
    why: "Markup for the location readout."
    applies_to: curious-world.location-readout
    resolved: true
    inspected: true
  - ref: docs/assets/visual-flow/0063--telegram-mini-app--cambium-design-system-source.png
    why: "Design-system source plate. Pixels were not opened."
    applies_to: components
    resolved: true
    inspected: false
  - ref: docs/assets/visual-flow/0062--telegram-mini-app--cambium-atlas-source.png
    why: "Atlas source plate. Pixels were not opened and are not palette authority."
    applies_to: reference-only
    resolved: true
    inspected: false
  - ref: apps/cambium-r3f/public/assets/meshy/islands/taste/thumbnail.png
    why: "Taste island thumbnail. Pixels were not opened."
    applies_to: tokens.glyphs.taste
    resolved: true
    inspected: false
gates:
  claim_review: exact
  phase: verify
  viewport_hold: explicit
  screenshot_touch_hold: explicit
  marketing_create_send_spend_publish: disabled
provenance:
  - field: tokens.color.ink
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: tokens.color.substrate
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: tokens.color.signal
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: tokens.color.mist
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: tokens.color.depth
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: tokens.alpha
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: tokens.type.display
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: tokens.type.mono
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: tokens.motion
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: tokens.glyphs
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: tokens.materials
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: layout.scale
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: components.radius
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: components.focus
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: voice.status
    source: apps/cambium-r3f/src/scene/visual-tokens.ts
    kind: repo
  - field: do
    source: pair limits computed from visual-tokens.ts
    kind: inferred
  - field: dont
    source: pair limits computed from visual-tokens.ts
    kind: inferred
  - field: reference_board
    source: paths checked at source_sha
    kind: repo
  - field: gates
    source: owner brief 2026-11-01 standing holds
    kind: supplied
surface_bindings: []
render_proof:
  status: candidate-held
  viewport: held
  screenshot_touch: held
---

# cambium.taste-hands.v0.1

Experiment packet. This is not an adopted architecture contract. The frontmatter is normative. `DESIGN.md` in this directory is the one-surface instance a Hands pass would consume.

Taste owns frontmatter, tokens, layout, components, voice, do, dont, and `reference_board`. Hands owns `surface_bindings` and `render_proof`. In this schema packet the Hands sections are empty or held. The owner owns `gates`. Taste and Hands read gates and do not change them.

## Palette

Colors, alpha, type, motion, glyphs, and materials are copied from `apps/cambium-r3f/src/scene/visual-tokens.ts` at `source_sha`. That file is the canonical Cambium palette (signal `#E0FF4F`, ink `#00272B`), owner approved on 2026-10-31 over atlas CSS tokens. Atlas paper, forest, gold, and line are not tokens here.

`research_sha` is the 2026-10-28 proposal's Cambium commit. It is an ancestor of `source_sha`. Current main had moved forward by the time this experiment started.

## Gates

`claim_review` is exact. `phase` is verify. Viewport hold and screenshot/touch hold are explicit. Marketing create/send/spend/publish is disabled. This packet has no publish, send, or spend field.

## Contrast limits

The checked ratios live in `DESIGN.md`. The limits Hands has to obey:

- Signal on ink, and mist on ink, clear WCAG AA for text. Signal may be small text or a 1px rail on ink.
- Signal on mist fails text and non-text UI. Do not put signal type or a signal boundary on mist.
- Substrate on ink, depth on ink, and depth on substrate fail non-text UI. They are field colors, not strokes or type on those partners.

There is no separate line token. The older atlas result (line on paper about 3.35, borders only) does not transfer to this palette.

## Unspecified on purpose

`visual-tokens.ts` has no spacing scale, radius, focus ring, or voice guide. Those fields stay `unspecified`. Inventing them would be a second palette. Glyph intents stay under `tokens.glyphs`.

## References

Repo paths only. `resolved: true` means the path exists at `source_sha`. `inspected: false` means this experiment did not open the pixels. Three plates are uninspected on purpose: the design-system source PNG, the atlas source PNG, and the taste island thumbnail.
