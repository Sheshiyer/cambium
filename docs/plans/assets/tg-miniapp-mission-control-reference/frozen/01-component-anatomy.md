# 01 — Component Anatomy Spec (from `01-component-glyph-state-board.png`, 1536×1024)

**Global board grammar.** Background `#00272B` with faint low-opacity contour-field linework. Panels: `#012F34` fill, 1px hairline borders (mint ~20% opacity), 8px corner radius, thin separators. Section headers: condensed uppercase display, `#E0FF4F`. Component/state labels: small monospace, `#D6FFF6` at 60–80% opacity (active labels full-opacity chartreuse). Footer ruler strip: "8px grid" in chartreuse.

## MissionGlyph — 8 variants (~96px tall, dark metallic/teal 3D tokens, beveled edges, warm chartreuse glow core, mono label above)
| Variant | Form |
|---|---|
| `genesis` | six-pointed star, glowing round core |
| `taste` | horizontal capsule/loop ring (torus-like oblong) |
| `build` | upright triangle slab, inner embossed triangle + glow dot |
| `ops` | folded slab (open box/tray with folded lid) |
| `cortex` | radial ring: outer disc, 8 spokes to glowing hub |
| `arc` | crescent C-shape |
| `proof` | curled receipt scroll printed with dotted rows |
| `gate` | warning aperture: triangle outline + small inner triangle — **always peach `#FFC7A1`** |

Glyphs are identity marks, not buttons; labels stay text-first for accessibility.

## StateToken — 8 states (scene grammar: central rosette node + orbit rails to satellite glyphs)
| State | Visual |
|---|---|
| `idle` | all elements desaturated teal/grey, dim; no ring, no badges |
| `active` | chartreuse partial arc (~270°) on orbit + 3 chartreuse packet dots on rails; "active" label in chartreuse |
| `selected` | double chartreuse halo: full thin outer ring + full inner ring, concentric |
| `complete` | full thin chartreuse ring + chartreuse check badge (circle+checkmark) top-right; packets settled as trail |
| `blocked` | entire scene re-tinted peach; orbit becomes **dashed** peach arc; peach warning-triangle badge top-right; glyph cores glow peach |
| `locked` | desaturated like idle; **dashed** grey/mint orbit arc; mint padlock badge top-right |
| `stale` | desaturated; dotted/faded orbit (lighter dash, lower opacity); no badge |
| `reducedMotion` | full solid thin mint ring; glyphs static; no packets |

## OrbitProgress (~64px circle, 4 node dots at cardinal points)
Track: dashed mint, low opacity. Fill: solid chartreuse arc clockwise from 12 o'clock. Variants: 0% (track only) / 25% / 50% / 75% / 100% (full solid ring) / **blocked** (peach dashed track, no fill, peach warning triangle centered) / **stale** (faint dashed track, dimmer nodes, no fill). Never color alone — pair with label or `%` readout.

## BranchArcChip (pill, full radius, ~28px tall)
Glyph icon + mono count ("9/17") + 1px vertical divider + branch label. Mint text, hairline border, transparent/surface fill. Selected: chartreuse stroke + chartreuse text.

## MissionCard (8px radius, surface fill, 1px border, faint contour texture)
Left text column + right constellation thumbnail (node-graph on dark field, one chartreuse active node): eyebrow caps label (chartreuse), title (mint, medium), 4 mono label/value rows (Owner/Gate/Dispatch/Promotion).

## QuestlineTimeline (horizontal dashed rail, 4–6 stations)
Station = icon + 2-line mono caption (name / state-word). Canonical set: check-circle "Seed/complete" (mint) → filled target ring "Packet/active" (chartreuse) → warning triangle "Proof/blocked" (peach) → padlock "Launch/locked" (dim mint). Connectors: solid chartreuse behind complete→active; dashed muted past the active node.

## ProofList (rows ~48–56px)
Dotted-circle outline icon + mint founder-readable label ("Deploy URL", "Viewport capture", "Evidence receipt") + right chevron `›`; hairline separators. Raw routes/schemas never appear here — Inspect only.

## KpiPulse (stacked rows)
Row = concentric dotted-ring badge + 2-line mono label ("Survival:/qualified waitlist", "Better:/paid pilot") + right-aligned spark-bar chart (~18 thin chartreuse bars, varied heights).

## GateActionRow (bottom actions)
Primary: solid `#E0FF4F` fill, `#00272B` text ("Review Gate"), 8px radius. Secondary: transparent fill, 1px chartreuse border, chartreuse text ("Open Proof").

## Legend vocabulary (frozen)
`node` = rosette · `rail` = curved connector with dots · `packet` = dotted trail of small chartreuse squares · `orbit` = dashed mint circle · `selected` = solid chartreuse ring · `warning` = peach triangle outline with "!" · `locked` = mint padlock · `stale` = faint dotted ring.

*Not determinable from image: exact px font sizes, dash-gap ratios, exact opacities — treat above as proportional; colors map to the named token palette.*
