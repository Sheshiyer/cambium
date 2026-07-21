# TG Mini App Per-Page Feature Issue Plan

Date: 2026-06-30
Status: planned and synced to GitHub
Generated from: component map, modular prompts, reference images, and parent issues #95-#99.

## Purpose

Expand the five coarse page issues into concrete UI/UX/component feature work. This plan deliberately avoids creating test-only or e2e-only issues. Each child issue must change visible UI, UX behavior, component rendering, or interaction flow; focused tests and screenshots are validation inside the feature, not the feature itself.

Before executing these page issues, complete the component foundation gate in `docs/plans/2026-06-30-tg-miniapp-component-foundation-plan.md`. Issues #200-#219 own the reusable component code extracted from the component map, prompts, and reference images; issues #100-#199 own page-level consumption, composition, feature behavior, and polish.

## Reference Review

- Component board demands real glyphs, state tokens, orbit progress, mission composites, and motion primitives.
- Mobile state-stack reference demands branch chips, Next Mission hero, questline, selected/blocked/proof/locked stack, ProofList, and GateActionRow as one coherent phone surface.
- Motion storyboard demands selected halo, packet rail, proof orbit, warning attention, and reduced-motion variants.
- Existing parent issues #95-#99 are useful page epics but too coarse for multi-agent execution.

## Parent Issues

- mission: #95 - Mission page: organ-driven glyph state stack
- gate: #96 - Gate page: branch decision chamber
- tools: #97 - Tools page: operator toolbelt
- story: #98 - Story page: mission progress feed
- inspect: #99 - Inspect page: proof/debug layer

## Component Foundation Gate

The following issues must land before page-specific execution starts, unless a page issue is explicitly limited to non-component data/source work:

| Foundation | Issues | Blocks |
| --- | --- | --- |
| Shared code seam and visual tokens | #200-#201 | all page issues |
| Glyph, state, orbit, halo, rail, and packet primitives | #202-#207 | all page issues that render stateful UI |
| Mission composites | #208-#213 | Mission, Gate, Story, and shared sheet work |
| Motion primitives and reduced-motion contract | #214-#218 | all animated/highlighted page work |
| Component gallery/proof fixture | #219 | page viewport proof and visual lock |

Where a page issue already names a primitive, it now means "integrate or compose the already-built primitive on that page." For example, #100 should consume #202 rather than build a separate Mission-only glyph system.

## Expansion Summary

- Total child feature issues: 100
- mission: 20
- gate: 20
- tools: 20
- story: 20
- inspect: 20

## Mission Child Issues

| Task | Issue | Feature | Deliverable |
| --- | --- | --- | --- |
| TG-MC-111 | #100 | MissionGlyph primitive library | Replace character placeholders with reusable inline glyph primitives for genesis, taste, build, ops, cortex, arc, proof, and gate. |
| TG-MC-112 | #101 | Arc-to-organ visual adapter | Add a presentation adapter that maps branch arc and mission stage data through shared Cambium visual stages before rendering. |
| TG-MC-113 | #102 | Branch rail chip state system | Rebuild branch chips so selected, active, stale, blocked, and locked branches match the state-stack reference. |
| TG-MC-114 | #103 | Selected branch halo interaction | Implement the selected halo behavior for branch chips using one clear orbit or underline treatment. |
| TG-MC-115 | #104 | Mission hero map texture | Upgrade the MissionCard background into a compact branch map with contour texture, active node, rail paths, and packet dots. |
| TG-MC-116 | #105 | Mission metadata grid polish | Rework Owner, Gate, Dispatch, and Promotion metadata into compact founder-readable cells. |
| TG-MC-117 | #106 | Questline stage composer | Render a four-to-six stage questline that prioritizes founder-readable stages like Seed, Packet, Proof, and Launch. |
| TG-MC-118 | #107 | Questline rail states | Add rail segments between questline nodes with active packets, blocked warning endpoint, and locked low-opacity continuation. |
| TG-MC-119 | #108 | Selected row in State Stack | Implement the State Stack selected row with orbit halo, current focus copy, and selected token. |
| TG-MC-120 | #109 | Blocked row in State Stack | Implement the blocked row with peach warning glyph, blocker reason, and action affordance. |
| TG-MC-121 | #110 | Proof-needed row in State Stack | Implement the proof-needed row with dotted receipt ring and evidence-missing copy. |
| TG-MC-122 | #111 | Locked row in State Stack | Implement the locked row with muted lock token and next-stage explanation. |
| TG-MC-123 | #112 | ProofList content rewrite | Rewrite Mission proof rows around proof outcomes rather than source paths or technical identifiers. |
| TG-MC-124 | #113 | Proof row affordance and sheets | Add clear chevrons, tap affordances, and proof-detail sheet routing for each proof row. |
| TG-MC-125 | #114 | KPI orbit pulse rows | Replace two-letter KPI circles with orbit progress rings for survival and better-than-survival signals. |
| TG-MC-126 | #115 | KPI packet bars | Add small packet bars to KPI rows to show signal depth without implying fake progress. |
| TG-MC-127 | #116 | GateActionRow polish | Finalize non-floating Review Gate and Open Proof buttons with native mini app spacing and state-aware treatment. |
| TG-MC-128 | #117 | Mission empty and stale states | Design Mission empty/stale states for missing branch packets or stale envelope without reverting to generic copy. |
| TG-MC-129 | #118 | Branch mission sheet header polish | Upgrade branch mission sheets with glyph header, claim guard, questline, proof, KPI, and inspect sections. |
| TG-MC-130 | #119 | Mission reduced motion and accessibility pass | Ensure Mission component states remain legible with reduced motion and text-first accessibility. |

## Gate Child Issues

| Task | Issue | Feature | Deliverable |
| --- | --- | --- | --- |
| TG-MC-211 | #120 | Gate chamber shell | Rebuild the Gate page shell as a decision chamber with Gate aperture, state strip, and branch-aware context. |
| TG-MC-212 | #121 | Gate empty state experience | Replace the current empty state with an honest no-decision chamber that still shows branch readiness context. |
| TG-MC-213 | #122 | Gate decision hero card | Add a hero card for the selected/open decision with branch, mission, proof, and consequence summary. |
| TG-MC-214 | #123 | Gate queue card layout | Rebuild queue rows as compact branch decision cards with glyph, status token, and consequence preview. |
| TG-MC-215 | #124 | Proof attached row | Add a proof-attached row pattern for each decision, showing what evidence is available or missing. |
| TG-MC-216 | #125 | Approve consequence display | Show approve consequence in founder language before any action is queued. |
| TG-MC-217 | #126 | Reroll consequence display | Show reroll consequence with same prominence as approve consequence. |
| TG-MC-218 | #127 | Reversibility summary | Add a concise reversibility/idempotency summary to Gate cards and preflight sheets. |
| TG-MC-219 | #128 | Gate aperture glyph | Implement the Gate warning aperture glyph as its own reusable visual primitive. |
| TG-MC-220 | #129 | Gate warningAttention primitive | Apply the warningAttention motion primitive to blocked Gate rows once, then rest. |
| TG-MC-221 | #130 | Decision state stack | Add Gate state stack rows for Decision, Proof, Effect, and Reversible. |
| TG-MC-222 | #131 | Signed preflight sheet layout | Redesign approve/reroll preflight sheets to lead with decision, proof, consequence, and reversibility. |
| TG-MC-223 | #132 | Signed result sheet layout | Redesign result sheets after approve/reroll so outcome, queued effect, and next step are clear. |
| TG-MC-224 | #133 | Telegram unavailable state | Add a clear state for trying to approve outside founder Telegram context. |
| TG-MC-225 | #134 | Gate branch filter chips | Add optional branch filter chips when multiple branch decisions exist. |
| TG-MC-226 | #135 | Gate row expansion details | Add expandable details for proof, consequence, actor, updated time, and audit trail. |
| TG-MC-227 | #136 | Gate action safety copy | Rewrite Gate action copy so it names decision safety rather than queue mechanics. |
| TG-MC-228 | #137 | Gate-to-Mission return path | Add a clear path from Gate decisions back to the affected Mission branch/card. |
| TG-MC-229 | #138 | Gate stale and sync states | Show stale Gate data and refresh status without hiding queued decisions. |
| TG-MC-230 | #139 | Gate reduced motion and safe spacing | Ensure Gate animations, rows, and action sheets remain stable under reduced motion and mobile safe areas. |

## Tools Child Issues

| Task | Issue | Feature | Deliverable |
| --- | --- | --- | --- |
| TG-MC-311 | #140 | Tools page shell | Rebuild Tools as a mission-aware toolbelt page with header, freshness, and branch context. |
| TG-MC-312 | #141 | Tool group segmented control | Add Act, Ask, Report, and Coordinate group controls for scanning tools by job. |
| TG-MC-313 | #142 | Mission recommendation panel | Add a suggested-tool panel based on current branch mission, blocker, or proof requirement. |
| TG-MC-314 | #143 | Tool card glyph taxonomy | Assign glyphs to tool actions using act, ask, report, coordinate, proof, and gate visual language. |
| TG-MC-315 | #144 | Tool availability states | Render ready, locked, stale, blocked, and unavailable tools with state tokens. |
| TG-MC-316 | #145 | Command syntax drawer | Move exact slash command syntax into an expandable drawer or sheet below the mission-facing explanation. |
| TG-MC-317 | #146 | Copy command feedback | Improve copy interaction with copied state, haptic feedback, and fallback copy text. |
| TG-MC-318 | #147 | Act group tool cards | Design Act group cards for commands that move current mission work forward. |
| TG-MC-319 | #148 | Ask group tool cards | Design Ask group cards for status, freshness, and branch questions. |
| TG-MC-320 | #149 | Report group tool cards | Design Report group cards for proof capture, evidence foldback, and branch receipts. |
| TG-MC-321 | #150 | Coordinate group tool cards | Design Coordinate group cards for Hermes, Plexus, Fabric, and handoff routines. |
| TG-MC-322 | #151 | Tool context chips | Add branch, gate, proof, and dispatch context chips to relevant tool cards. |
| TG-MC-323 | #152 | Tool safety sheet | Add a safety/detail sheet for tools with consequence, required proof, and expected result. |
| TG-MC-324 | #153 | Disabled tool reason rows | Add clear disabled reasons for unavailable tools, including missing proof, auth, or stale data. |
| TG-MC-325 | #154 | Mission deep links to Tools | Allow Mission proof/blocker rows to deep-link to the most relevant tool card. |
| TG-MC-326 | #155 | Tool payload preview | Show a compact preview of what a command will send or request, without exposing secrets. |
| TG-MC-327 | #156 | Tool audit links | Add Inspect links for command source, bridge route, and tool proof details. |
| TG-MC-328 | #157 | Tools empty and error states | Design empty/error states for missing command data or unavailable tool source. |
| TG-MC-329 | #158 | Tools recent/suggested strip | Add a small recent or suggested tools strip derived from current mission needs, not persisted user tracking. |
| TG-MC-330 | #159 | Tools mobile density polish | Tune card density, scroll rhythm, and safe-area spacing for repeat tool use. |

## Story Child Issues

| Task | Issue | Feature | Deliverable |
| --- | --- | --- | --- |
| TG-MC-411 | #160 | Story page shell | Rebuild Story as a branch progress feed with clear page header, branch context, and state-aware grouping. |
| TG-MC-412 | #161 | Story group controls | Add Mission wins, New signals, Lessons, and Drift group controls. |
| TG-MC-413 | #162 | Mission wins cards | Design Mission wins cards for completed branch mission evidence and meaningful progress. |
| TG-MC-414 | #163 | New signals cards | Design New signals cards for fresh branch-relevant inputs from Hermes, Paperclip, Fabric, or packets. |
| TG-MC-415 | #164 | Lessons cards | Design Lessons cards for durable learning or packet changes that affect branch execution. |
| TG-MC-416 | #165 | Drift cards | Design Drift cards for stale, missing, contradictory, or blocked signals. |
| TG-MC-417 | #166 | Beat glyph taxonomy | Assign glyphs and state tokens for win, signal, lesson, drift, proof, and gate beats. |
| TG-MC-418 | #167 | Story timeline rail | Add a subtle timeline/rail treatment connecting beats without creating a decorative card stack. |
| TG-MC-419 | #168 | Branch filter chips | Add branch filter chips so Story can focus on Fitcheck, Vantyx, Snow Gloves, or IVerif. |
| TG-MC-420 | #169 | Latest change hero | Add a compact latest-change hero summarizing the newest meaningful branch update. |
| TG-MC-421 | #170 | Beat detail sheet | Design beat detail sheets with summary, proof, source, related mission, and next action. |
| TG-MC-422 | #171 | Evidence linkouts | Add proof/evidence linkouts from Story beats to relevant ProofList or Inspect sections. |
| TG-MC-423 | #172 | Contradiction warning treatment | Add specific visual and copy treatment for contradictory or stale story data. |
| TG-MC-424 | #173 | Story empty state | Design an empty Story state for no branch beats served yet. |
| TG-MC-425 | #174 | Story digest cards | Add digest cards that summarize a set of related beats into one compact scan surface. |
| TG-MC-426 | #175 | Packet trail visuals | Add small packet trail visuals between related beats where they represent actual sequence. |
| TG-MC-427 | #176 | Source containment links | Move source, schema, and operator narrative details into detail sheets or Inspect. |
| TG-MC-428 | #177 | Story action links | Add action links from beats to Mission, Gate, Tools, or Inspect depending on beat type. |
| TG-MC-429 | #178 | Story freshness state | Add freshness and sync state to Story so old beats are not mistaken for current state. |
| TG-MC-430 | #179 | Story mobile readability polish | Tune typography, spacing, truncation, and row rhythm for long narrative text. |

## Inspect Child Issues

| Task | Issue | Feature | Deliverable |
| --- | --- | --- | --- |
| TG-MC-511 | #180 | Inspect page shell | Rebuild Inspect as a deliberate proof/debug page with clear title, scope, and grouped sections. |
| TG-MC-512 | #181 | Inspect overview grid | Add an overview grid for freshness, policy, live proof, branch packets, gates, tools, rails, and evidence. |
| TG-MC-513 | #182 | Freshness panel | Build a freshness panel showing derivedAt, age, source, refresh route, and stale state. |
| TG-MC-514 | #183 | Branch packets panel | Build a branch packet panel for branchStories source, rows, selected branch, missing packet diagnostics, and packet links. |
| TG-MC-515 | #184 | Live proof panel | Build a live proof panel with readiness summary, blockers, receipts, and honest 8/10 boundary. |
| TG-MC-516 | #185 | Policy panel | Build a policy panel for operator policy state, claim guard, proof boundaries, and promotion rules. |
| TG-MC-517 | #186 | Gate audit panel | Build a Gate audit panel for open items, decision context, signed-action evidence, consequences, and reversibility. |
| TG-MC-518 | #187 | Tools audit panel | Build a Tools audit panel for command sources, bridge routes, command availability, and payload proof. |
| TG-MC-519 | #188 | Organ and rail contract panel | Preserve Cambium visual stages and rails as an Inspect contract panel. |
| TG-MC-520 | #189 | Evidence list panel | Build an evidence panel that aggregates proof paths, receipts, screenshots, and branch evidence rows. |
| TG-MC-521 | #190 | Mini app surface contract panel | Add a panel showing Mission, Gate, Tools, Story, Inspect contract coverage and page readiness. |
| TG-MC-522 | #191 | Inspect detail sheet template | Create a consistent detail sheet template for all Inspect panels. |
| TG-MC-523 | #192 | Primary page trace links | Implement trace links from Mission/Gate/Tools/Story into the relevant Inspect detail section. |
| TG-MC-524 | #193 | Stale and missing diagnostics | Add dedicated diagnostics for stale envelope, missing branchStories, missing live proof, and unavailable command data. |
| TG-MC-525 | #194 | Secret redaction display | Add redaction-safe rendering for auth/initData/token-like values in Inspect details. |
| TG-MC-526 | #195 | Readiness blocker hierarchy | Group blockers by founder action, live proof, packet, policy, command, and visual proof. |
| TG-MC-527 | #196 | Branch fixture inspector | Add a fixture inspector for the branch-stories proof fixture used by viewport captures. |
| TG-MC-528 | #197 | Visual stage sheets | Polish stage sheets for each Cambium organ with glyph, routes, active arc, and related branch rows. |
| TG-MC-529 | #198 | Rail sheet containment | Polish rail sheets with from/to, lane, active status, proof source, and related pages. |
| TG-MC-530 | #199 | Copy proof summary action | Add a safe copy/share proof summary action that summarizes current Inspect state without secrets. |

## Execution Rules

- Keep one owner, one branch, one worktree per child issue.
- Do not run concurrent `page.ts` edits unless an integration issue owns the merge.
- Child issues inherit the parent issue reference contract and page lock-zone boundaries.
- Validation should be focused and attached to the UI/UX feature, not split into separate filler issues.
- Parent issues #95-#99 remain the page-level epics and should receive child completion summaries.
