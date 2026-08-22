# Operating Fabric — visual/motion/accessibility budget (Task 12)

Static contract for the five operating-fabric scenes (Canopy, Mission, Flow,
Workforce, Forge) plus the Gate and Inspect sheets. Enforced by
`workers/quests/src/page-motion-safety.test.ts` against the served `PAGE`
source and the operating-fabric scaffold/styles/client/gate-sheet/inspect-sheet
modules — no browser required for this file's assertions; the
320/390/430px containment proofs live in `visual-viewport-proof.mjs`.

## Responsive budget

- Target viewports: 320px, 390px, 430px (iPhone SE through Pro Max width
  class). No fixed pixel width in operating-fabric styles may exceed 320px.
- `.of-nav` scrolls horizontally (`overflow-x:auto`) rather than wrapping or
  clipping tabs at the 320px floor.
- Sheets (Gate, Inspect) clear the bottom safe-area inset and cap height with
  `max-height:calc(100dvh - var(--sat) - var(--sab) - 70px)` from the shared
  chrome contract (T-027).
- At 320px, a six-stage mission timeline must become a readable linear or
  horizontally scrollable sequence; it may not compress six stations into a
  single unreadable row. Branch/work rails scroll rather than wrap or clip.
- At 390px and 430px, cards may gain art/context only after the title,
  metadata, state label, and 44px controls retain their minimum readable area.
- At desktop widths, a side context panel is additive: DOM reading order,
  keyboard order, and the mobile Mission → state → proof → action sequence
  remain stable.

## Work-kind variants

- A `SaplingWork` uses the seed/starburst silhouette and may display branch
  promotion state.
- A `ProgramWork(client)` uses the linked/capsule silhouette and never renders
  Sapling promotion as program lifecycle.
- A `ProgramWork(capability|operations)` uses the folded-slab or cortex-wheel
  silhouette and service/run/receipt vocabulary.
- An unmapped source uses an explicit gap state. UI code may not infer a work
  kind from display copy, color, or a missing field.
- State treatment remains orthogonal to work kind: every variant supports
  selected, active, blocked, locked, stale, complete, and reduced-motion
  renderings through the shared glyph/token/rail grammar.

## Motion

- `prefers-reduced-motion: reduce` removes all nonessential transitions and
  animations under `#operating-fabric` (`transition:none!important;
  animation:none!important` on the shell and its descendants).
- Any motion that remains essential (e.g. state changes) must be
  transform/opacity-only — no layout-affecting properties (`width`, `height`,
  `top`, `left`) animate.

## Focus and controls

- All interactive controls (`.of-tab`, `.of-control`, including the Gate
  entrypoint button and Inspect sheet's back/close buttons) get a visible
  `:focus-visible` outline.
- Interactive controls meet the 44px minimum target (`.of-tab` declares
  `min-height:44px`).

## Semantics

- Scene navigation is a `<nav aria-label="Operating Fabric scenes">` with
  `<button>` tabs; the active tab carries `aria-selected="true"`.
- Each scene is a landmark `<section aria-labelledby="...">` with a heading
  (`<h2>`), satisfying heading hierarchy even when visually hidden (`class="sr"`).
- Gate and Inspect sheet headings use `<h2>`.

## Graph fallback

- The Flow scene's visual graph (`table[data-of-flow-representation="graph"]`)
  is `aria-hidden="true"`; the accessible representation is a linear
  `<ol data-of-flow-fallback="linear">` list that carries the same content.

## Safety states

Every scene must render an honest, non-crashing state for: `loading`,
`empty`, `stale`, `unauthorized`, and `error` — each surfaced via
`[data-component="FabricState"][role="status"][data-state="<state>"]` with a
human-readable `aria-label`. No state renders as a blank scene.

## Gate disabled / in-flight state

- The Gate entrypoint button (`data-of-gate-entrypoint="1"`) is
  `disabled aria-disabled="true"` for `no-pending`, `invalid`, and `expired`
  reasons — never silently absent.
- While a preflight request is in flight, the client sets `btn.disabled =
  true` before the request and only clears it (or re-disables per the
  server's `result.disabled`) after the response resolves — the button can
  never be double-submitted.
