# Mission Control visual-system reconciliation

**Status:** responsive/semantic Mission implementation landed locally; no
deployment, read-model write, or release-gate change is authorized by this
document. The authenticated production proof remains pending on a separately
owner-approved Worker write.

**Implementation readback (2026-08-12):** the Mission renderer now exposes
source-derived Sapling, client Program, capability Program, operations Program,
and classification-gap variants, and stacks its existing QuestlineTimeline at
320–520px. Fixture coverage and fresh 320/390/430 local captures verify that
composition. They do not substitute for the stale authenticated production
read-model or its live proof.

## Goal

Restore Mission Control as a responsive, truthful operator surface: it must
preserve Cambium's existing teal / chartreuse / peach visual language, express
the actual kind of selected work, and remain useful at 320px through desktop
without treating stale or missing read-model data as successful state.

## Walkthrough evidence

The authenticated production walkthrough on 2026-08-12 showed a stale
read-model, an empty Story scene, and a Mission card that compresses the
questline and state stack instead of adapting its composition. This is two
connected failures with separate remedies:

1. **Data truth:** the live read model is stale and has no served branch story.
   Empty, stale, and error states must remain visible until that source is
   corrected; visual work must never synthesize a branch story.
2. **Presentation:** the branch-only renderer uses desktop-density structures
   at narrow widths. Its rail, metadata, title, questline, and state stack need
   an explicit responsive contract, not smaller type or clipped labels.

## Source reconciliation

| Reference family | Binding contribution | Must not be copied literally |
| --- | --- | --- |
| `cambium-isometric-moodboard` | organ topology, rails, packets, calm instrument-panel depth | dense telemetry dashboards on the Mini App primary surface |
| `constellation-ui-reference` | map / node / sheet / workforce spatial grammar | desktop map as the mobile default |
| `tg-miniapp-mission-control-reference` | mission-first hierarchy, state stack, proof rows, Gate actions | a one-size-fits-all product-branch card |
| `tg-miniapp-viewport-proof` | 320/390/430 containment and real hit-testing as regressions | fixture screenshots as live-data proof |
| `cambium-r3f-visual-moodboard` | glyph silhouettes, orbit/ring/rail primitives, decorative contour fields | decorative art that obscures content or state |
| `cambium-operating-fabric-moodboard` | Canopy → Mission → Flow → Workforce → Forge system and work-kind shapes | moodboard labels or actions as implementation authority |

## Non-negotiable visual grammar

- Base `#00272B`, surface `#012F34`, action/current `#E0FF4F`, readable mint
  `#D6FFF6`, paper titles `#F5F3E8`, and blocked-only peach `#FFC7A1` remain
  the system tokens.
- Glyph silhouette names work kind; state uses icon, label, border/rail, and
  color together. Stale additionally shows freshness; it is never a neutral
  success treatment.
- The main Mission card keeps one focal point. Contours, rails, and packet
  dots remain decorative behind content; they cannot consume touch targets or
  hide the current mission/title.
- Gate remains the only mutation entrypoint. Mission, Canopy, Story, and
  Inspect may navigate, disclose provenance, or request refresh only.
- Primary surfaces use founder-readable labels. Raw schema, routes, digests,
  and receipt details remain in Inspect.

## Work-kind and branch-variant taxonomy

The visual variant is derived from canonical source type. It is never inferred
from a name, color, or missing packet field.

| Source truth | Canopy / rail variant | Mission metadata | Lifecycle language | Prohibited collapse |
| --- | --- | --- | --- | --- |
| `branchKind: product` → `SaplingWork` | starburst / seed glyph, branch arc rail | promotion + current gate | seed → packet → proof → launch | do not render as a generic program |
| `branchKind: client` → `ProgramWork(client)` | capsule / linked rail glyph | client/program context + gate | mission/task/receipt state, no Sapling promotion | do not label as a Sapling |
| `branchKind: internal-service` → `ProgramWork(capability|operations)` | folded slab or cortex-wheel glyph, service rail | capability/operations + health/freshness | service/run/receipt state, no launch ladder | do not claim a product lifecycle |
| unmapped / malformed | gap glyph + explicit classification-needed state | source missing / inspect | no lifecycle claim | do not fabricate a visual variant |

State variation is orthogonal to work kind: selected is a halo; active uses a
chartreuse rail; blocked uses peach warning plus a broken/dashed rail; locked
uses lock plus low-opacity rail; stale uses faded dotted rail plus timestamp;
complete carries a check. Reduced motion freezes packet and orbit movement.

## Responsive composition contract

| Width | Shell and navigation | Branch/work rail | Mission and questline | Secondary content |
| --- | --- | --- | --- | --- |
| 320px | one column; root navigation scrolls horizontally; 44px targets | one chip is fully legible; rail scrolls, never wraps | title is 2–3 lines max; metadata is one readable column; questline is an ordered vertical list or horizontally scrollable stations—not six squeezed columns | state/proof rows stack; actions stay visible above safe area |
| 390px | same information order; no new desktop-only card | two chips may be visible, but selection remains obvious | card may use a compact two-column art/text split only when text retains its minimum width | state stack remains single-column, rows never clip |
| 430px | reference-phone composition: header, rail, dominant card, state, proof, actions | horizontal rail remains intentional, not accidental overflow | four to six stages may render horizontally only when each station stays legible | KPI/proof rows remain full-width |
| ≥768px | responsive grid may add a contextual side panel; it never changes reading order | rail can show more work, retaining keyboard/tab semantics | card uses a reserved constellation region without reducing title/meta width | Inspect context may be adjacent; Gate remains contextual |

At every width: no document horizontal overflow, no text-size reduction below
the frozen readability scale, no clipped action, visible focus, logical tab
order, reduced-motion behavior, and honest loading/empty/stale/unauthorized/
error states.

## Implementation sequence

1. **Truth seam first.** Repair and prove the authenticated ledger/read-model
   write path. Add a production-shaped stale/empty fixture so the UI cannot
   regress to blank content when source facts are absent.
2. **Normalize variants.** Extend the Mission view model with explicit
   `workKind`, `programKind`, `branchKind`, and `variant` values sourced from
   the Mission Fabric adapter. Rename the rail aria-label and headings from
   `Product branches` to the selected work collection.
3. **Build responsive primitives.** Keep `MissionGlyph`, `StateToken`,
   `OrbitProgress`, `SignalRail`, `PacketFlow`, `MissionCard`, and
   `QuestlineTimeline`; change their layout composition rather than replacing
   the UI with generic cards.
4. **Promote Canopy.** Use Canopy for the portfolio-level Sapling/Program
   distinction; Mission is the selected work's next outcome, not a second
   portfolio map.
5. **Prove regression safety.** Add semantic variant tests and viewport
   captures at 320/390/430 plus desktop. Preserve the existing five-scene
   route and signed Gate behavior until the generalized flow passes parity.

## Acceptance matrix for the next implementation wave

- A product branch renders the Sapling variant and its promotion state.
- A client branch renders a Program/client variant and does not show promotion.
- An internal-service branch renders its mapped capability/operations variant.
- An unmapped branch renders a classification gap, never an invented type.
- Each variant renders active, blocked, locked, stale, and reduced-motion
  states with the shared state grammar.
- Browser proofs at 320, 390, 430, 768, and desktop show no horizontal
  overflow, truncated controls, collapsed timeline labels, or inaccessible
  rail navigation.
- The stale production envelope continues to show `refresh first` and an
  explicit empty Story state; fresh branch stories render only after served
  source data is read back.
- Existing Mission, Gate, Tools, Story, and Inspect routes retain their
  semantics and signed-action boundaries. No deployment or gate relaxation is
  part of this planning wave.

## Decision record

The immediate corrective goal is not “make the screen green.” It is to make
the screen truthful, responsive, and semantically varied. The read-model
repair and the visual implementation are coupled in acceptance but separated
in authority: neither a fixture nor a CSS change may impersonate production
readback, and no release gate may be weakened to publish the visual work.
