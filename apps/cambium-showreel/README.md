# Cambium showreel

Deterministic motion-graphics reels with synthesized sound, built from Cambium's own design system. They use no Remotion and no Playwright. There are two cuts:

| Cut | Length | Tempo | Pacing | Output |
|---|---|---|---|---|
| `reel` (default) | 15 s · 900 frames | 120 BPM | one organ per beat | `out/cambium-showreel-v1.mp4` |
| `long` | 120 s · 7200 frames | 80 BPM | one idea per bar, with chapter text | `out/long/cambium-showreel-v1-long.mp4` |

Both cuts render at 1920×1080 and 60 fps.

- **Picture:** a three.js engine renders each frame as a pure function of the frame number.
- **Capture:** headless Brave pushes raw RGBA frames to a local Bun server, which streams them into ffmpeg.
- **Sound:** a TypeScript synth renders the soundtrack from the same cue list (`src/timeline.ts`).

## Render

```bash
bun install
bun run prep            # matte the R3F specimen renders -> out/mattes
bun run audio           # synthesize out/audio.wav (-14 LUFS, TP <= -1.5 dBFS)
bun run render          # 1080p60 picture -> out/video.mp4 (~1.5-2.5 min)
bun run mux             # deliverables -> out/ and ~/Downloads/
bun run verify          # spec, loudness, strobe and determinism checks
```

Quick iteration:

```bash
bun run render:preview                  # 960x540@30 in ~20 s
bun run build && bun tools/render.ts --stills 120,300,899   # PNG stills -> out/stills
bun run dev                             # scrubber at http://127.0.0.1:4789/?dev
```

Determinism check (all three manifests must match):

```bash
bun tools/render.ts --hash a --fresh
bun tools/render.ts --hash b --fresh
bun tools/render.ts --hash shuffle --shuffle
```

### The 120 s cut

Add `--cut long` to `render`, `audio`, `mux` and `verify`, and use `?cut=long` in the dev scrubber:

```bash
bun tools/audio.ts --cut long
bun run build && bun tools/render.ts --cut long      # ~12 min on an idle M3
bun tools/mux.ts --cut long
bun tools/verify.ts --cut long
```

The long cut lives in `src/cuts/long/`:

- **Timing:** 40 bars of 3 s at 80 BPM; every chapter boundary is a bar line (`timeline.ts`).
- **Text:** `src/lib/textblock.ts` stacks rule, kicker, headline, body and key/value rows, landing one per beat.
- **Copy:** all on-screen copy comes from the README and the system field guide (`docs/explainers/system-field-guide-2026-09-27/product-sources/10–21`).

| Bars | Chapter | Text |
|---|---|---|
| 1–4 | Ignite | What cambium means; "this is that layer for business" |
| 5–6 | Title | CAMBIUM, the company compiler, the README promise |
| 7–8 | Two halves | Composition layer vs the operator's infinite game |
| 9–20 | Organs | Each organ's job, why it exists, IN/OUT and its failure boundary, then the atlas strip |
| 21–28 | One governed flow | Observe → identify → admit → execute → verify → deliver; the Temperance ring; OPS node view; blocked then completed proof |
| 29–32 | Motion names | The five primitives with their rules; reducedMotion freezes the board on bar 32 |
| 33–36 | Surfaces | Mission Control callouts, Organ Console views, the design-system board |
| 37–40 | Resolve | Mark, wordmark on bar 38, tagline, promise, 17/17 |

The score follows the same chapters: one chord per two bars (A, F♯m, D, E), a pad and bass, a half-time heartbeat, and a bell arpeggio through the flow. The long master uses CRF 17 with lighter grain to keep 120 s of 1080p60 a reasonable size.

## Inputs

Assets are read in place and never copied:

- **Visual-flow assets:** `docs/assets/visual-flow/` (specimens, Organ Console views and features, Telegram Mini App screens, design-system board, favicon geometry).
- **Genesis island GLB:** `apps/cambium-r3f/public/assets/meshy/image-to-3d/genesis/optimized/model.glb`.
- **Tokens:** `apps/cambium-r3f/src/scene/visual-tokens.ts`. Paper and warning come from the frozen Mission Control tokens.

Fonts:

- **Display:** DIN Condensed Bold, the macOS system font. Override its path with `REEL_DISPLAY_FONT`.
- **Mono:** JetBrains Mono, from `@fontsource`.

The browser is auto-detected; override it with `REEL_BROWSER`.

## Acts

| Act | Frames | Content |
|---|---|---|
| 1 Ignite | 0–119 | A seed packet ignites, the contour field ripples out, and the packet fissions into a branching network |
| 2 Roll-call | 120–299 | Genesis (real GLB), then Taste, Build, Ops and Cortex, ending in the atlas strip |
| 3 Constellation | 300–509 | Cortex hub with packet flow; OPS is selected (9/17, node view); BUILD's warning resolves |
| 4 Motion names | 510–629 | orbitSweep, packetDrift, glyphBreathe, warningAttention, reducedMotion |
| 5 Surfaces | 630–749 | Mission Control and Commands, then Organ Console views and blueprint cards, then the design-system board |
| 6 Resolve | 750–899 | Favicon mark, CAMBIUM wordmark, tagline and 17/17 footer; the last 0.4 s holds as the poster |

## Brand rules followed

The reel follows the frozen motion spec (`docs/plans/assets/tg-miniapp-mission-control-reference/frozen/03-motion-spec.md`):

- No motion blur and no full-frame flashes.
- Dotted means pending; solid chartreuse means settled.
- Peach is used only for warning or review states.
- Glow stays a small tinted halo at ≤ .35 alpha. There is no bloom pass (`source-contract.ts:152`).
