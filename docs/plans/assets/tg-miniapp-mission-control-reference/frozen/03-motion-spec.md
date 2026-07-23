# 03 — Motion Spec (from `03-motion-storyboard-mobile.png`, 1024×1536)

Five strips, each 3 numbered frames. **Durations, easings, delays: not determinable from board — builders propose, fidelity review adjudicates.** Board defines anatomy and state mapping only.

## Strip 1 — Selected Branch (trigger: branch selection)
- F1 IDLE: node glyph centered on arc rail, two endpoint dots. Static.
- F2 HALO BEGINS: dotted ellipse orbit ring materializes around node; ghosted dots + curved clockwise arrow. Runs **two** named animations: `glyphBreathe` + `orbitSweep` (the only 2-animation frame on the board).
- F3 RESTING: ring solid chartreuse ellipse, glow dots at 4 cardinal points. Tag `selected`.

## Strip 2 — Questline Progress
- F1 PACKET ACTIVE: horizontal rail ~6 circles; active chartreuse-ringed circle with ghosted trailing positions + horizontal arrow → `packetDrift`.
- F2 PROOF BLOCKED: rail dimmed; peach warning triangle in peach circle overlaid → `warningAttention`.
- F3 LAUNCH LOCKED: dim circles terminate at dashed circle with lock glyph. Static end state.
Trigger mapping: packetDrift = active progression; warningAttention = proof blocked; locked = gated.

## Strip 3 — Proof Orbit
- F1 PENDING: ring of discrete dots, no arc; center `0%`.
- F2 IN PROGRESS: partial solid chartreuse arc (top-right quadrant) over dotted ring; bright leading dot + ghosted tail + clockwise arrow; center `54%` → `orbitSweep`.
- F3 COMPLETE: full solid chartreuse ring, glow dots top & bottom, `100%`, chartreuse ✓ badge at right edge.
orbitSweep semantics: arc grows clockwise from top; pending ring = dotted track beneath.

## Strip 4 — Packet Rail
- F1 STATIC: S-curve rail, 3 glowing packet dots at rest.
- F2 MOVING: ghosted trailing dots + arrows along rail direction → `packetDrift`.
- F3 REDUCED MOTION: identical rail + dots; ghosts/arrows removed → `reducedMotion`. **Canonical fallback = static dots, zero translation.**

## Strip 5 — Gate Attention
- F1 QUIET: row card — warning-triangle-in-circle icon, `GENESIS`/`Gate` text, chevron; thin dim outline.
- F2 ATTENTION: row stroke turns peach; standalone peach warning triangle inserted before chevron; icon chip tinted peach → `warningAttention`. **No flashing — stroke/icon change only.**
- F3 REVIEW: chevron replaced by filled peach `Review Gate` pill; peach stroke persists.

## Named animations (frozen names)
`orbitSweep` (dotted circle chip) · `packetDrift` (dots+arrow chip) · `glyphBreathe` (glyph chip) · `warningAttention` (triangle chip) · `reducedMotion` (dashed circle chip).

## Global motion rules
1. Motion conveyed by ghosted positions + arrows; **no motion blur**.
2. **No flashing or aggressive warning visuals** — warningAttention = persistent peach stroke + icon, never pulsing.
3. Max simultaneous named animations: **2** (implied by strip 1 F2).
4. reducedMotion fallback: remove translation/ghosting; keep static state dots.
5. Dotted/dashed = pending or in-transit; solid chartreuse = settled/complete; peach exclusively warning/review.
6. Slow, calm cubic easing per companion prompt; max one animated focal point per screen.

## Ratification — 2026-07-24, P1-W1: verified against `03-motion-storyboard-mobile.png` (full resolution + region crops of Questline Progress and Proof Orbit strips); corrections: none — all five strips, frame tags, named-animation chips (`orbitSweep`/`packetDrift`/`glyphBreathe`/`warningAttention`/`reducedMotion`), primitive legend, and global motion rules match the board; status: RATIFIED
