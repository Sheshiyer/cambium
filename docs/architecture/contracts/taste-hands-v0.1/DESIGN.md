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
    body: '"Arial Narrow", "Aptos Display", "Satoshi", system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
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
    why: "Opened in this review. Condensed sans scale includes BODY 14/20. Core swatches match ink, substrate, mist, and depth. The plate accent is #E0FFAF and it also shows paper and warning. Those three are not canonical tokens."
    applies_to: components
    resolved: true
    inspected: true
  - ref: docs/assets/visual-flow/0062--telegram-mini-app--cambium-atlas-source.png
    why: "Opened in this review. Organ glyphs on a dark field with a yellow wordmark. No hex legend and no type specimen. Not a palette source."
    applies_to: tokens.glyphs
    resolved: true
    inspected: true
  - ref: apps/cambium-r3f/public/assets/meshy/islands/taste/thumbnail.png
    why: "Opened in this review. Taste island on black, with looping tubes over white and teal terrain. Glyph reference only. Not a component or color source."
    applies_to: tokens.glyphs.taste
    resolved: true
    inspected: true
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
  - field: tokens.type.body
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
  - field: surface_bindings
    source: experiment binding for curious-world.location-readout
    kind: inferred
  - field: render_proof
    source: owner hold, no viewport capture in this experiment
    kind: supplied
surface_bindings:
  - surface_id: curious-world.location-readout
    production_edited: false
    background: color.ink
    roles:
      - role: index
        kind: text
        size_px: 11
        weight: 400
        color: color.signal
        type: type.mono
        against: color.ink
      - role: district
        kind: text
        size_px: 32
        weight: 400
        color: color.mist
        type: type.display
        against: color.ink
      - role: tagline
        kind: text
        size_px: 12
        weight: 400
        color: color.mist
        type: type.body
        against: color.ink
      - role: rail
        kind: non-text
        size_px: 1
        color: color.signal
        against: color.ink
      - role: shadow
        kind: effect
        color: none
render_proof:
  status: candidate-held
  viewport: held
  screenshot_touch: held
  method: "Binding evidence is the local checker only. No viewport capture was taken."
experiment:
  revision_rounds: 0
  authoring_note: "Contrast was computed before the first binding. The checker did not reject a round."
---

# Location readout

One Hands instance of `cambium.taste-hands.v0.1`. Surface: the curious-world location chip (`.cw-location` in `apps/cambium-r3f/src/curious-world/index.ts`). Production CSS and the Gate decision chamber are not edited. Frontmatter is normative.

## Visual theme

Dark field, ink `#00272B`. Mist carries the place name. Signal carries the index and the 1px rail. Depth and substrate stay off this chip because they fail as type or as a boundary on ink.

## Color

| token | hex | role on this surface |
| ink | #00272B | field behind the chip |
| substrate | #012F34 | unused here |
| signal | #E0FF4F | index text and rail |
| mist | #D6FFF6 | district name and tagline |
| depth | #231651 | unused here |

## Contrast

Ratios are WCAG relative luminance, rounded to two decimals by the checker.

| pair | ratio | limit |
| signal on ink | 14.03 | text |
| mist on ink | 14.71 | text |
| signal on substrate | 12.75 | text |
| mist on substrate | 13.38 | text |
| depth on mist | 14.94 | text |
| signal on depth | 14.24 | text |
| substrate on ink | 1.10 | fail |
| depth on ink | 1.02 | fail |
| signal on mist | 1.05 | fail |
| depth on substrate | 1.12 | fail |

Signal on ink is legal for 11px text and for a 1px rail. Signal on mist is not legal for text or for a UI boundary. Substrate and depth are field colors on ink.

## Type

District uses `tokens.type.display`. Index uses `tokens.type.mono`. Tagline uses `tokens.type.body`. Body is the same condensed sans stack as display, which is the BODY role on the opened design-system plate. The tagline stays 12px. The plate's 14/20 size is recorded and is not applied to this chip.

## Layout and components

No spacing scale, radius, or focus ring is invented. The chip's observed desktop measure (max width 320px, 9px gap, 14px rail inset) stays in the production stylesheet and is not promoted to a token. Narrow overrides change size and inset only. They do not change these hexes. District at 25px is still large text.

## Voice

Unspecified. Product copy on the chip is not a brand-voice sample.

## Do and don't

Follow the contract list. This surface adds no second list.

## Hands

`surface_bindings` maps the five baseline roles. `render_proof.status` is `candidate-held`. Viewport and screenshot/touch stay held. This file is not viewport proof.

## Run A reminder

The unbound paints are copper `#B58B65`, peach `#FFC7A1`, near-mist `#D3E9E0`, and shadow `#00191D`, plus Georgia for the district. Those live in `location-readout.baseline.json` and in the production stylesheet. They are the drift this binding is measured against.
