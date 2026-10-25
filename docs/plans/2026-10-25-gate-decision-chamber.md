# Gate decision chamber

## Intent

Make the Founder Gate feel like a consequential place in Cambium's world. The founder orients, inspects, chooses, sees the choice recorded, and follows the evidence back into the world. The receipt is a persistent artifact of that choice. It is not the objective's completion screen.

This is a design study and implementation plan, not a deployment or live action. The local interactive prototype uses synthetic data only.

## Source language

The source-library inventory maps46assets:10Telegram and36R3F, with4preservedduplicates and5unresolved previews. Those reference images establish a visual grammar; they do not establish runtime truth. Preserve explicit organ lineage and leave unresolved assets unassigned.

| Source | Transfer into interface | Meaning constraint |
| --- | --- | --- |
| Design-system board | Petrol space, ivory information, acid focus, copper/stone edges,8px rhythm, condensed headings, mono coordinates | Color complements text; selected orbit does not mean completion |
| Atlas board | A connected field with one subject in focus; reduced detail outside that focus | Spatial relation comes from an authored or canonical relation |
| Glyph/state board | Stable glyph identity across world, journal and compact HUD; distinct idle,selected,blocked,stale,locked | An empty orbit is unknown, not0percent failure |
| Motion storyboard | Short settling halo, packet travel on an observed rail, static reduced-motion state | Motion communicates an actual transition, not continuous invented execution |
| Control dial specimen | The deliberate choice apparatus at the Gate; becomes inactive after settlement | No new approval shortcut or hold-to-confirm replacement |
| Signal packet specimen | A reviewed proposal with a sealed canonical decision record | Seal appears only after validated canonical readback |
| Process beacon / rail arc | An observed stage and explicit handoff path | No stage lights merely because approval occurred |
| Visualization lens | Inspecting the same object at greater evidence detail | The lens changes presentation, never action authority |
| Named Genesis,Taste,Hands,Will,Cortex specimens | Organ portraits only when that identity is explicitly established | A generic component or district never assigns an organ |

Reference paths: `docs/assets/visual-flow/source-library/telegram-mini-app/boards/`, `telegram-mini-app/motion/`, `r3f/components/`, `r3f/organs/`, and the source-library README/asset map.

## Recommended composition: sealed choice

A dark full-width Gate chamber keeps the world around the founder. A sculptural record/choice object occupies the left field. The right field leads with the objective and **Founder decision recorded**, followed by the actual approved/rejected outcome, time and abbreviated receipt. Goal scale and explicit branch/phase/organ context sit in a quiet orientation rail. No grid of equivalent metric cards competes with the decision.

Below it, a physical rail shows discrete observed states: Decision, Graph, Execution, Evidence. Unknown stages remain labelled unobserved. Rejection has equal visual dignity and does not imply a graph commit. The canonical JSON and opaque IDs sit inside **Inspect immutable record**. Full content stays accessible for audit.

A connection warning occupies a separate thin signal strip: **Queue refresh unavailable. This recorded decision is retained.** That strip cannot invalidate a verified historical receipt. An uncertain outcome instead gets **Decision not confirmed** and a read-only original-status recovery; it receives no seal and never offers submit-again.

The action hierarchy is **Trace decision**, **Inspect record**, **Return to world**. These are evidence and navigation controls after settlement. No execution button is added. The object becomes an entry in the decision journal, rather than disappearing with the pending queue row.

## Experience loop

1. Orient in the world: world/district/subject context.
2. Inspect the objective, exact delta, consequences and authority boundary.
3. Make the existing explicit founder decision through the existing host.
4. Settle: validated receipt appears as a quiet, durable seal. Celebrate clarity, including a deliberate rejection; no XP or reward for approving more proposals.
5. Trace only proven handoffs, inspect missing proof, and return to the world.

Macro/meso/micro/proof remains the actual canonical goal scale. A future ancestry projection can support zooming purpose→questline→objective; the interface cannot infer those parents from labels. Branch, phase and organ remain independent explicit fields.

## Presentation-state defect and safe integration

The current host's `receipt()` validates the canonical tuple and canonicalReadback, then flattens the receipt into a text message. The world retains that message while the settled pending row disappears. Its missing-row path can then lead with an unverified Gate read. This conflates a durable decision, a transient queue read and independently observed execution.

Future production work should return a typed decision presentation object from the existing validated receipt path, never parse a success-looking message. Keep three independent models:

- Decision: none/submitting/unknown/recorded, including requested outcome versus actual recorded outcome and a conflict state.
- Connection: checking/ready/unavailable/reauth-required.
- Execution: observed stages with provenance and observation time, matched to the same change.

Capture reviewed context before settlement, bind it to the exact tuple and store it separately from the pending queue. If context is absent, show an unserved objective rather than borrowing the next row. A recorded opposite decision remains a conflict. Unavailable queue refresh cannot reactivate a settled proposal's controls.

Preserve host identity and tenant checks, fresh canonical predecision read, explicit confirmation, immutable decision ledger, family fence and original-tuple status-only recovery. This design adds no new writer, endpoint or retry path.

## Build order and tests

1. Add the typed validated receipt/context contract and regressions before styling.
2. Add one receipt-chamber component shared by approved/rejected/uncertain/disconnected states.
3. Adapt existing glyphs/materials at three levels of detail: world geometry, focused artifact, compact glyph. Keep heavy source images in design studies; use bounded local assets or existing geometry for runtime, loading only the selected object.
4. Reuse scoped tokens,45pxcontrols, visible focus, semantic text and a linear accessible path. Use CSS transform/opacity only when reduced motion permits; static end-state otherwise. Motion/audio remain optional and no background sound is introduced.
5. Verify confirmed receipt survives held/missing queue; malformed text cannot create a receipt; opposite outcome stays conflict; navigation cannot reuse another proposal's context; refresh issues zero decision POSTs; unknown stages remain unknown;320pxlayout and reduced motion hold.

No production changes, source-library edits, deployment or live decision are part of this study.

## Local prototype and verification

The portable design study is `docs/design/gate-decision-chamber.html`, using relative URLs to the existing source-library specimens. It has no fetch/XHR/WebSocket/form or backend decision integration. Its local scenario controls illustrate approved, rejected, uncertain and disconnected states; they are never real approval controls.

IAB checks: all3sourceimages load;4scenario narratives and path states match; uncertain has receipt=null, no observed stage and no seal circles; trace and raw fixture disclosure work; return/reopen preserves state and moves focus. Actual320x844viewport has scrollWidth320,45pxminimum controls and visible focus. Reduced motion has0animated elements. The build-routing attempt failed before tool effects due the installed CLI's context7 transport configuration; bounded in-session fallback produced the HTML without modifying runtime configuration.

The prototype uses raster concept references to judge composition and material language. Production needs bounded local assets or existing lightweight geometry and the typed receipt change described above. It does not fix the production receipt screen by itself.
