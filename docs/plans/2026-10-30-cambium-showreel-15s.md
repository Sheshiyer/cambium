# Cambium Showreel — 15s motion-graphics reel (no Remotion)

## Context

You asked for a 15-second motion-graphics showreel for Cambium that goes all out without using Remotion. It should be built from the assets, visual planning and design system in `docs/assets/visual-flow/`.

The repo already has a complete visual language:
- tokens in `apps/cambium-r3f/src/scene/visual-tokens.ts` and `docs/plans/assets/tg-miniapp-mission-control-reference/frozen/design-tokens.json`
- a named motion vocabulary (`orbitSweep`, `packetDrift`, `glyphBreathe`, `warningAttention`, `reducedMotion`) in `workers/quests/src/page/styles/components.ts` and `frozen/03-motion-spec.md`
- 11 high-quality 3D specimen renders, Organ Console views, Telegram Mini App screens and blueprint feature geometries
- real GLB models

There is no video pipeline in the repo. The plan is to build a small deterministic render engine (three.js + headless Brave + ffmpeg, driven by bun), so the reel is code, re-renderable and frame-exact.

**Locked decisions (your answers):**
- 1920×1080 at 60fps, 900 frames.
- Synthesized sound design.
- Brand-true but fast edit:
  - Real motion names and the `--ease`/`--pop` curves.
  - No motion blur, no strobe flashes.
  - Glow is inset/tinted at ≤ .35 alpha. `source-contract.ts:152` forbids neon outer glow, so there is no UnrealBloom.
  - Peach (`#FFC7A1`) is used only for warning states.
  - Dotted means pending; solid chartreuse means settled.
- Engine goes in `apps/cambium-showreel/`. Output goes to a gitignored `out/`, and the final MP4 is copied to `~/Downloads/`.

## Design language used

- **Palette:**
  - ink `#00272B`
  - substrate `#012F34`
  - signal `#E0FF4F`
  - mist `#D6FFF6`
  - depth/void `#231651`
  - paper `#F5F3E8`
  - warning `#FFC7A1`
  - Background gradient: `#00272b → #012f34 64% → #17123e` (`apps/cambium-r3f/src/styles.css:48`).
- **Alpha steps:** .18 / .26 / .34 / .62 / .86.
- **Grid:** 8px. Radius 2/4/8/16. Spacing 8–64.
- **Easing:** `--ease cubic-bezier(.16,1,.3,1)`, `--pop cubic-bezier(.34,1.56,.64,1)`.
- **Type:**
  - Display: **DIN Condensed Bold**, a macOS system font. Chosen deliberately: the token stack's "Arial Narrow" isn't installed, and DIN matches the boards' condensed caps.
  - Mono: **JetBrains Mono**, via `@fontsource/jetbrains-mono` (OFL; already in Mission Control's mono stack).
  - Both are loaded with the `FontFace` API and awaited before frame 0.
- **On-screen copy (all sourced from the repo):**
  - "ORGANIC SYSTEMS. PRECISE DATA."
  - "THE COMPANY COMPILER"
  - "GENESIS → TASTE → BUILD → OPS · CORTEX FEEDS EVERY ISLAND" (`route-registry.ts:14`)
  - organ roles from field-guide sources 11–21
  - board telemetry (IN 1,248 · OUT 943 · DROP 12 · LAT 46ms · ARC X 9/17)

## Storyboard (120 BPM, 1 beat = 30 frames; cuts land on beats)

| Act | Time / frames | What happens | Assets |
|---|---|---|---|
| **1 IGNITE** | 0.00–2.00 / f0–119 | <ul><li>Black opens to the ink→void gradient.</li><li>A single signal packet ignites (`glyphBreathe`, `--pop`).</li><li>A topographic contour field (shader; dotted iso-lines like the boards) ripples out from it.</li><li>The 8px ruler and "GRID 8PX · BASE UNIT 8 · RADIUS 2/4/8/16 · ELEVATION 0/1/2/4" draw in; telemetry counters spin up.</li><li>The packet fissions into 5 that shoot out along curved rails, dotted while drawing and solid once settled.</li><li>Camera dollies in.</li></ul> | procedural |
| **2 ROLL-CALL** | 2.00–5.00 / f120–299 | <ul><li>One organ per beat:<ul><li>**GENESIS**: a real 3D GLB turntable, key + rim lit and graded to the brand.</li><li>Then **TASTE, BUILD, OPS, CORTEX**: specimen plates.</li></ul></li><li>Each beat stacks:<ul><li>a `--pop` spring entrance</li><li>a giant DIN word sliding counter to the object at .10 mist</li><li>the line-art glyph (star / capsule / triangle / slab / wheel) drawing on</li><li>an `orbitSweep` ring from 12 o'clock</li><li>mono "ID 0n/17 · role"</li></ul></li><li>Organs change with an 8×8-cell grid wipe in a diagonal wave.</li><li>f270–299: all five snap into the atlas-style bottom strip.</li></ul> | `image-to-3d/genesis/optimized/model.glb`; `1097` taste, `1088` build, `1093` ops, `1090` cortex |
| **3 CONSTELLATION** | 5.00–8.50 / f300–509 | <ul><li>The strip tilts into a 2.5D plane with the topo field as ground. Cortex is the hub, with spokes to each island and the Genesis→Taste→Build→Ops chain.</li><li>About 600 GPU packets flow along the rails (`packetDrift`).</li><li>The 6 Temperance organs sit in an outer ring as circle-masked lens nodes.</li><li>Slow 12° yaw orbit.</li><li>f400: `orbitSweep` selects OPS with a "9/17" label, and the flat node-view panel slides in from the right with list rows staggering in.</li><li>f450: `warningAttention` on BUILD: the peach border runs once and a "Review Gate" chip appears, then it resolves to solid.</li><li>f480: camera rises to top-down and the plane's grid match-cuts to Act 4.</li></ul> | specimen plates; `organ-console/organs/*/concept-v1.png`; procedural rails |
| **4 VOCABULARY** | 8.50–10.50 / f510–629 | <ul><li>A 5-cell storyboard grid with hairline 8px rhythm. Cells pop in staggered, each with a live mini-animation and a mono chip:<ul><li>01 `orbitSweep` (0 → 54 → 100% ✓)</li><li>02 `packetDrift`</li><li>03 `glyphBreathe`</li><li>04 `warningAttention` (Genesis Gate row)</li><li>05 `reducedMotion`: everything stops, and the audio drops out for 4 frames.</li></ul></li><li>The cells collapse into lines that become screen edges.</li></ul> | procedural |
| **5 SURFACES** | 10.50–12.50 / f630–749 | <ul><li>A z-space corridor dolly with 3 eased stops:<ul><li>The Mission Control phone, revealed by a scan-line sweep.</li><li>Organ Console Work/Receipts wide views, with parallax.</li><li>A pull-back reveal of the full Design System board.</li></ul></li><li>Three paper "blueprint" feature cards flip through (identity-seam, receipt-strata, typed-handoff). They punctuate the edit as inverse-palette cards, not full-frame flashes.</li></ul> | `0060`, `0064`, `organ-console/views/{work,receipts,canopy}/wide-v1.png`, `organ-console/features/*/geometry-v1.png`, `0063` |
| **6 RESOLVE** | 12.50–15.00 / f750–899 | <ul><li>Everything is pulled back along the rails into one point, and the topo field contracts.</li><li>An `orbitSweep` ring draws to 100% and becomes the favicon ring. The signal flag shape and the mist facet build in with `--pop`, using the exact geometry from `1085--r3f--favicon.svg`.</li><li>"THE COMPANY COMPILER" eyebrow appears, and the **CAMBIUM** wordmark is mask-revealed per letter.</li><li>"ORGANIC SYSTEMS. PRECISE DATA." resolves through a scramble-decode.</li><li>Footer: "NODES 17/17 · PACKETS 1,248 · UPTIME 00:00:15", with the ring at 17/17 ✓.</li><li>The last 0.4s holds still, so the final frame doubles as the poster.</li></ul> | favicon SVG geometry |

## Engine architecture — `apps/cambium-showreel/` (bun, TypeScript, three ^0.170)

```
apps/cambium-showreel/
  package.json            # bun scripts: dev, build, render, render:preview, audio, verify
  .gitignore              # out/, node_modules/, .profile/
  index.html              # canvas host; ?f=N scrubber + realtime play in dev mode
  src/
    main.ts               # renderer (setPixelRatio 1, setSize 1920x1080), await-ready gate, window.__reel
    timeline.ts           # FPS/BPM/act table + CUES (shared with audio.ts), frame→act-local time
    tokens.ts             # re-exports ../../cambium-r3f/src/scene/visual-tokens.ts + paper/warning/ease/grid
    lib/ease.ts           # cubicBezier(--ease, --pop), expo, analytic damped spring
    lib/rng.ts            # mulberry32 (seeded; no Math.random/Date/rAF in render path)
    lib/text.ts           # Canvas2D→CanvasTexture per text element; needsUpdate only on change; digit atlas for counters
    layers/topo.ts        # fullscreen/ground-plane shader: fbm iso-contours, dotted, ripple uniforms
    layers/specimen.ts    # specimen plate shader: difference key vs fitted bg model + 5x5 dilate; ink-ramp regrade; keeps chartreuse/brass
    layers/islands.ts     # GLTFLoader for genesis GLB; brand grade, key/rim lights
    layers/rails.ts       # CatmullRom tube rails; dash draw-on uniform (dotted pending → solid settled)
    layers/packets.ts     # GPU Points; position along rails computed in vertex shader from time; inset core glow
    layers/hud.ts         # ruler, chips, telemetry, panels, list rows (ortho camera, pixel-snapped, drawn after scene)
    layers/glyphs.ts      # vector line-art glyphs + favicon geometry, stroke draw-on
    layers/final.ts       # final pass: grain (seeded by frame), vignette, ≤1px chromatic offset only on cut impacts; OutputPass last
    acts/act1-ignite.ts … act6-resolve.ts   # each: setup(ctx), update(ctx, f)
  tools/
    prep-assets.ts        # ffmpeg-measured bg colour + vignette per specimen → src/generated/specimens.json
    serve.ts              # Bun.serve: app, /assets/* → ../../docs/assets/visual-flow, /glb/* → ../cambium-r3f/public/assets/meshy, /fonts/*; POST /frame → ffmpeg stdin
    render.ts             # spawn headless Brave, self-test, frame loop, encode; --preview (960x540@30), --frames a-b, --stills t1,t2
    audio.ts              # 48kHz stereo WAV synth from CUES (800 samples/frame)
    mux.ts                # AAC 320k mux + bt709 tags + faststart; copy final to ~/Downloads
    verify.ts             # ffprobe + ebur128 + determinism manifest checks
```

**Reuse.**
- Tokens are imported directly from `apps/cambium-r3f/src/scene/visual-tokens.ts`, which is a pure const module.
- GLB paths follow `apps/cambium-r3f/src/world/meshy-assets.ts` and `public/assets/meshy/image-to-3d/optimized-candidates.json`.
- Assets are read in place. Nothing is copied into the app.

**Capture pipeline (zero deps beyond three and fontsource).**
1. `render.ts` spawns Brave (`REEL_BROWSER` env override; Brave is auto-detected) with these flags:
   - `--headless --use-angle=metal --ignore-gpu-blocklist --force-color-profile=srgb --disable-background-timer-throttling --disable-renderer-backgrounding --no-first-run --mute-audio`
   - a gitignored `--user-data-dir=out/.profile`
2. The page loops through the frames itself. For each frame it runs `renderFrame(f)`, then `gl.readPixels` in the same task, then POSTs the raw RGBA (8.3 MB) to `serve.ts`. The server writes it into ffmpeg stdin and acknowledges, which gives back-pressure.
3. ffmpeg settings:
   - input: `-f rawvideo -pix_fmt rgba -s 1920x1080 -r 60 -i - -vf vflip,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`
   - encoder: `libx264 -profile:v high -crf 14 -preset slow -tune grain`
   - bt709 colour tags
   - preview builds use `h264_videotoolbox`
4. Estimated speed is about 30–50 ms per frame, so roughly 1–2 minutes for the full render.

**Safeguards.**
- **Brave pixel-noise self-test.** Brave's shields can add noise to `readPixels`. Before frame 0, the page draws a known pattern and reads it back; any mismatch aborts the render.
  - Fallback 1: open the profile once with shields off for 127.0.0.1.
  - Fallback 2: point `REEL_BROWSER` at a plain Chromium.
- **Fonts.** The render aborts unless `document.fonts.check` passes and a `measureText` width differs from the fallback font's width.

**Specimen keying.**
- Border flood-fill doesn't work here: it can't reach the cortex ring gaps, and the vignette and shadows sit at the same brightness as the rock.
- Instead, the shader keys on the luminance difference from a background model fitted per image. `prep-assets.ts` measures that model with ffmpeg, so Brave's canvas noise can't affect it.
- A 5×5 dilate fills small holes, and the edges are colour-decontaminated toward ink.
- Each specimen's matte is dumped to `out/debug/` and checked by eye. If one fails, it falls back to an opaque plate whose regraded background matches the scene's ink, with a radial edge fade.

## Sound design — `tools/audio.ts`

Everything is synthesized from `timeline.CUES`, so the sound is frame-locked to the picture:
- a sub drone (A1, with a filter LFO)
- a riser into f120
- impacts on each roll-call beat (pitch-swept sine + click)
- packet ticks (seeded granular blips)
- a whoosh on the strip and on each z-dolly stop
- a rising orbitSweep chime at f400
- a soft two-tone warning at f450 (not harsh)
- a cell blip for each Act 4 reveal, with a 4-frame dropout on `reducedMotion`
- a reverse swell at f750
- the final impact plus an open-fifth chord (A–E–A–C♯) tailing to 15.0s

Effects are a simple feedback-delay reverb and a soft limiter. Targets: −14 LUFS integrated, true peak ≤ −1.5 dBTP before AAC.

## Implementation order

1. **Scaffold the app.**
   - `bun init`; `bun add three@^0.170 @fontsource/jetbrains-mono`; `bun add -d @types/three typescript`.
   - Write `timeline.ts`, `tokens.ts`, `ease.ts`, `rng.ts`, `main.ts`.
   - Write `serve.ts` and `render.ts` with the self-tests.
2. **Gray-box all 6 acts** as coloured placeholders with act labels. Render a full-length preview on day one to prove capture, timing and encoding.
3. **Build the layers:** `topo` → `rails` + `packets` → `text`/`hud` → `glyphs` → `specimen` (with the `prep-assets` matte check) → `islands` (Genesis GLB) → `final`.
4. **Refine act by act** (1 → 6). After each act, run a preview render, build a contact sheet and review it.
5. **Audio:** `audio.ts` → `mux.ts`.
6. **Final:** run the final render plus `verify.ts`, copy to `~/Downloads/cambium-showreel-v1.mp4`, and write a bounded checkpoint in `.project/HANDOFF.md` (per `AGENTS.md`).

## Verification

- **Static checks:** `bunx tsc --noEmit` is clean. Grep the bundle to confirm no `Math.random|Date|performance.now|requestAnimationFrame` outside dev-mode play.
- **Visual review:**
  - Use `render --stills` at each act's midpoint and at every cut frame, and view them.
  - Build a contact sheet with `ffmpeg -vf fps=2,scale=480:-1,tile=6x5` for the whole reel.
  - Use `bun run dev` with the `?f=` scrubber in the Browser pane to scrub and check realtime feel.
- **Determinism:**
  - Hash each RGBA frame in `serve.ts`.
  - Two fresh-browser runs plus one run in shuffled frame order must produce identical manifests.
  - Frame 0 rendered twice must hash the same.
  - Encode with `-fflags +bitexact -map_metadata -1`.
- **ffprobe:**
  - h264 High, 1920×1080, yuv420p, `r_frame_rate` 60/1, `-count_frames` gives 900, bt709 tags.
  - AAC 48 kHz stereo.
  - Duration 15.000s ±1 frame; faststart (`moov` before `mdat`).
- **Loudness:** `ebur128=peak=true` gives −14 ±1 LUFS with true peak ≤ −1 dBTP. `astats` shows no clipping and no DC. A `showwavespic` image confirms the cues line up with the act boundaries.
- **Brand:**
  - Sample pixels at key frames to confirm the background sits on ink/void.
  - Peach appears only during the warning beats (f450–504, Act 4 cell 04).
  - No full-frame luminance jump above 20% within 3 frames (no strobe).
- **Delivery:** send the MP4, the poster frame (f899) and the contact sheet back via SendUserFile.
