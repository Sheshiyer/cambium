# 02 — Screen Composition Spec (from `02-mission-control-state-stack-mobile.png`, 862×1825)

**Structural note:** the board is ONE phone frame showing all states simultaneously across components. Idle and reduced-motion full-screen treatments are not determinable from the board. Measurements are px on the 862-wide canvas (≈@2x of ~431pt) — treat as proportional. Outer screen margin ≈30px.

## 1. Header block (y≈30–215)
- Title "Mission Control": bold sans, `#F5F3E8`, ~40px cap height, left.
- Freshness chip (top right): pill radius ~30, 2px chartreuse outline, transparent fill, filled chartreuse dot + mono "fresh 2m" in chartreuse.
- Subtitle: mono, muted mint (40–50% opacity) — "cambium · branch arcs".
- Nav row (5 items, full width): selected = chartreuse text + solid chartreuse underline bar (~160×8px, rounded ends, ~12px below text); unselected = muted gray-mint, no bar.
- 1px hairline divider below nav.

## 2. Branch chip rail (y≈235–300; pills ~60px tall, gaps ~15px, horizontal scroll)
| Chip example | Border | Glyph | Text | State |
|---|---|---|---|---|
| Fitcheck (selected+active) | 2px chartreuse + soft outer glow | filled circle + 8 radiating rays | chartreuse | selected/active |
| Vantyx (stale) | 1px muted gray | outline 4-point sparkle | muted gray | stale = neutral/dim, NO accent color |
| Snow Gloves (blocked) | 1px peach + peach-tinted fill | peach glyph + small dot | peach | blocked |
| IVerif (locked) | 1px dim gray, lowest contrast | outline triangle-with-lock | dim gray | locked |

## 3. Mission card (y≈310–860; radius ~24 on this board, `#012F34`, 1px muted border, ~30px padding, faint contour texture)
Right ~45%: branch-arc constellation (thin chartreuse lines, node dots, one large filled hub with halo ring).
- Eyebrow "NEXT MISSION": mono chartreuse small-caps.
- Title: bold sans ~55px, paper/white.
- Meta grid (4 rows, ~35px pitch): mono muted labels left (Owner:/Gate:/Dispatch:/Promotion:), mono light-mint values.

## 4. Questline timeline (inside card, y≈690–850)
4 nodes, even spacing, 2-line labels (name: sans white; state: mono muted):
- Seed/complete: chartreuse ring + check; connector to next = **solid chartreuse**.
- Packet/active: filled chartreuse core + solid ring + **outer dashed orbit ring with 4 satellite dots**.
- Proof/blocked: peach outline warning triangle with "!"; connectors onward = **dashed muted-gray**.
- Launch/locked: dim-gray outline padlock.
**Transition grammar:** complete→active = solid chartreuse; anything past active = dashed gray.

## 5. STATE STACK section (y≈890–1280)
Header: mono chartreuse small-caps. Container: rounded list, surface fill, hairline dividers; rows ~85px. Row anatomy: left state token (~60px) → mono white title over mono muted subtitle → right status dot + chevron.
| Row | Left token | Subtitle | Right dot |
|---|---|---|---|
| Selected | concentric chartreuse rings + 4 orbit dots | "current focus" | solid chartreuse ring |
| Blocked | peach warning triangle | "needs gate review" | peach filled dot |
| Proof needed | dashed chartreuse ring (hollow) | "evidence missing" | dashed hollow ring |
| Locked | dim-gray padlock | "waiting unlock" | dim gray dot |

## 6. PROOF NEEDED section (y≈1300–1560)
Rows (~75px): dashed chartreuse ring checkbox → mono white label → scattered cluster of ~8 tiny chartreuse packet dots (mid-right) → chevron. All rows pending/dashed; none complete.

## 7. Bottom actions (y≈1590–1700; two buttons ~48% width, ~110px tall, radius ~20, gap ~15)
Primary "Review Gate": solid chartreuse, `#00272B` semibold text. Secondary "Open Proof": transparent, 2px chartreuse border, chartreuse text.

## 8. Chrome
Home indicator: paper-white rounded bar ~300×10px, centered. Global background: `#00272B` + faint contour lines concentrated in upper third.

## Color usage per frame
Chartreuse: all current/actionable signals. Peach: blocked only. Mint: text at varying opacity. Paper: title + home indicator. Void `#231651`: not visibly used on this board. Base/surface split: `#00272B` screen / `#012F34` cards.
