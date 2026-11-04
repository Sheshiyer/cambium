---
phase: viewport-behavior-gaps-v1
plan: VPG-02
type: execute
status: proposed
execution_authorized: false
autonomous: false
wave: 2
depends_on: ["VPG-01"]
requirements: ["FA-VPG-01","FA-VPG-02","FA-VPG-03","FA-VPG-04","FA-VPG-05","FA-VPG-11","FA-VPG-12"]
files_modified: ["apps/cambium-r3f/src/curious-world/mission-overview.ts","apps/cambium-r3f/src/curious-world/mission-overview.test.ts","workers/quests/src/page/client/curious-read-bridge.ts","workers/quests/src/curious-world-operational-read.test.ts","apps/cambium-r3f/src/curious-world/index.ts","apps/cambium-r3f/src/curious-world/styles.css","workers/quests/src/page/components/curious-world.ts","scripts/capture-field-atlas.mjs","scripts/field-atlas-operational-fixture.mjs","docs/visual/field-atlas-viewport-contract.v1.json","scripts/field-atlas-viewport-contract.test.mjs","workers/quests/src/page/components/curious-world.generated.ts","docs/plans/assets/field-atlas-viewport-proof/manifest.json","docs/plans/assets/field-atlas-viewport-proof/*.png"]
user_setup: []
must_haves:
  truths: ["Mission, branch, proof, task and utility state is visible with exact source/authority identity.","Only the branch rail scrolls horizontally; Vantyx selection and focus survive native input.","Exact branch proof opens in a contained dossier and returns to its opener."]
  artifacts: [{"path":"apps/cambium-r3f/src/curious-world/mission-overview.ts","provides":"Source implementation or verification for VPG-02"},{"path":"apps/cambium-r3f/src/curious-world/mission-overview.test.ts","provides":"Source implementation or verification for VPG-02"},{"path":"workers/quests/src/page/client/curious-read-bridge.ts","provides":"Source implementation or verification for VPG-02"}]
  key_links: [{"from":"apps/cambium-r3f/src/curious-world/mission-overview.ts","to":"apps/cambium-r3f/src/curious-world/index.ts","via":"Sanitized existing-owner projection into the current 3D dossier"},{"from":"scripts/capture-field-atlas.mjs","to":"docs/visual/field-atlas-viewport-contract.v1.json","via":"Original identity → implemented predicates → fresh source/fixture/PNG proof"}]
---

<objective>
Mission overview, proof navigation and branch interaction. This future source package covers 7 currently held intents. It does not execute from this proposal.

Purpose: Mission, branch, proof, task and utility state is visible with exact source/authority identity.
Output: 7 current 3D equivalents with exact fresh source evidence.
</objective>

<admission_gate>
Proposed only. Require owner acceptance of the exact finite packet, a fresh source-head/admission check and its ISA acceptance reference before any implementation. CONTEXT.md's effect boundary applies throughout. Version 95 remains the planning baseline; deployment and traffic remain held.
</admission_gate>

<context>
@.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md
@.planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md
@.planning/viewport-proof-20261104/remaining-behaviors/coverage.json
@.planning/viewport-proof-20261104/remaining-behaviors/VALIDATION.md
@ISA.md — Viewport behavior gap proposal — 2026-11-04

| Original identity | ISA requirement | Terminal capture | Viewport |
| --- | --- | --- | --- |
| mission-control-320-mobile.png | FA-VPG-01 | field-atlas-gap-01-320x844.png | 320×844 |
| mission-control-mobile.png | FA-VPG-02 | field-atlas-gap-02-390x844.png | 390×844 |
| mission-control-430-mobile.png | FA-VPG-03 | field-atlas-gap-03-430x844.png | 430×844 |
| mission-actions-mobile.png | FA-VPG-04 | field-atlas-gap-04-390x844.png | 390×844 |
| mission-utilities-mobile.png | FA-VPG-05 | field-atlas-gap-05-390x844.png | 390×844 |
| sheet-mission-open-proof-mobile.png | FA-VPG-11 | field-atlas-gap-11-390x844.png | 390×844 |
| mission-vantyx-selected-mobile.png | FA-VPG-12 | field-atlas-gap-12-390x844.png | 390×844 |

Source files named here are existing unless this package first creates its named folio/test, operational fixture/test, owner-bindings reference or gap regression test. Generated bundle and capture artifacts are regenerated through existing commands, never manually restamped. File overlap is serialized by the dependency above.
</context>

<tasks>
<task type="auto" id="VPG-02-T1">
  <name>Build exact mission overview owner projection</name>
  <files>apps/cambium-r3f/src/curious-world/mission-overview.ts, apps/cambium-r3f/src/curious-world/mission-overview.test.ts, workers/quests/src/page/client/curious-read-bridge.ts, workers/quests/src/curious-world-operational-read.test.ts</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, workers/quests/src/mission-fabric.ts, workers/quests/src/mission-fabric-read-client.ts, apps/cambium-r3f/src/curious-world/mission-dossier.ts, workers/quests/src/page/scenes/mission.ts</read_first>
  <action>Add normalizeMissionOverview and renderMissionOverview in mission-overview.ts over the existing mission/fabric and ledger/proof owners. Extend the existing read bridge with a sanitized mission snapshot/getter/subscription; no credentials or write API reaches the world. Cover absent/stale/conflicting sources, branch identity, task/proof ordering, tool/loop/KPI source distinctions and local-visits-not-work. Use source-bound branch-stories fixture inputs, including the exact Fitcheck/Vantyx identities; real content is derived from served owner data, not those fixture labels.</action>
  <verify><automated>node --test apps/cambium-r3f/src/curious-world/mission-overview.test.ts workers/quests/src/curious-world-operational-read.test.ts</automated></verify>
  <acceptance_criteria>
    - Stale/foreign branch or proof cannot appear as current mission authority.
    - The journey fails if any non-rail horizontal scroller, timeline pan-x, overlap, offscreen state or lost opener focus is introduced.
  </acceptance_criteria>
  <done>The source-bound model has positive and negative tests; unavailable or inconsistent owner data stays held.</done>
</task>

<task type="auto" id="VPG-02-T2">
  <name>Wire reachable current 3D interactions</name>
  <files>apps/cambium-r3f/src/curious-world/index.ts, apps/cambium-r3f/src/curious-world/styles.css, workers/quests/src/page/components/curious-world.ts</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, apps/cambium-r3f/src/curious-world/mission-overview.ts, apps/cambium-r3f/src/curious-world/gate-decision-chamber.ts, apps/cambium-r3f/src/curious-world/gate-folio.ts, workers/quests/src/page/client/curious-read-bridge.ts</read_first>
  <action>Mount the mission overview from the current chart/dossier through the existing bridge. Render branch tabs, proof buttons, timeline, mission action stack and tool/loop/KPI controls with their original meanings. For widths 320/390/430, keep the branch rail as the sole allowlisted horizontal scroller, timeline intrinsically fitting with no pan-x gesture, bounded labels, separated compact action text/buttons, and other dossier panes isolated. Native Vantyx selection must retain aria-selected, keyboard focus and trusted horizontal drag isolation. Open exact branch-required proof with reachable back/close and focus restoration; no retired shell is imported.</action>
  <verify><automated>npm --prefix apps/cambium-r3f run curious:test</automated></verify>
  <acceptance_criteria>
    - Native chart/dossier entry, selected identity, source labels, reachable controls and close/back/focus work at the original viewports.
    - No retired shell, new auth channel, remote effect or false runtime completion is introduced.
  </acceptance_criteria>
  <done>Current 3D presentation exposes the required original affordances with actual owner semantics and honest holds.</done>
</task>

<task type="auto" id="VPG-02-T3">
  <name>Prove 7 exact retained journeys and publish fresh source evidence</name>
  <files>scripts/capture-field-atlas.mjs, scripts/field-atlas-operational-fixture.mjs, docs/visual/field-atlas-viewport-contract.v1.json, scripts/field-atlas-viewport-contract.test.mjs</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, scripts/field-atlas-viewport-contract.mjs, scripts/field-atlas-operational-fixture.test.mjs</read_first>
  <action>Port complete original rows 1–5, 11 and 12, including missionContainmentAssertion and the branch-selection/drag journey. Map each original selector to its current 3D counterpart explicitly in assertion code. Use exact original viewports and crop rules. Fixture proof presence, branch identity and utility semantics must be asserted, not only modal containment. Add only this package’s proposed terminal cases listed below, retain previous cases and bind new helper/model source files. Follow VALIDATION.md's clean-source capture/publication sequence. Qualified counts change only when all original predicates and native-input/visible-state evidence actually pass; otherwise stop this package with the exact hold.</action>
  <verify><automated>node --test scripts/capture-field-atlas.test.mjs scripts/field-atlas-viewport-contract.test.mjs scripts/field-atlas-operational-fixture.test.mjs</automated></verify>
  <acceptance_criteria>
    - Fresh source proof contains 55 cases; all previous qualified intents remain qualified.
    - Only after genuine complete proofs, the derived target is 18/43 qualified and 25 held.
    - Stale/foreign branch or proof cannot appear as current mission authority.
    - The journey fails if any non-rail horizontal scroller, timeline pan-x, overlap, offscreen state or lost opener focus is introduced.
  </acceptance_criteria>
  <done>This package's 7 original identities have registered exact equivalents and fresh source proof, or an explicit unresolved capability prevents completion.</done>
</task>
</tasks>

<threat_model>
| Boundary | Disposition | Mitigation |
| --- | --- | --- |
| Owner data → displayed state | mitigate | Validate exact identity/source/freshness; deny contradictory, foreign or unavailable capability rather than infer completion. |
| Browser/input → source evidence | mitigate | Full original-step mapping, native input, painted-state/crop bounds and exact source/fixture/PNG hashes; a partial image cannot qualify. |
| Source fixture → real effect | mitigate | Loopback-only identified fixtures and strict per-step method counters; existing auth and owner writers remain unchanged. |
</threat_model>

<verification>
Follow VALIDATION.md for the complete fresh-matrix sequence, source binding and owner-effect checks. Target after actual completion: 55 source cases, 18/43 qualified, 25 held. Intermediate strict exit1 is expected while any intent is held; sourceProofOk must still be true. Any missing predicate/capability blocks this package.
</verification>

<success_criteria>
- All listed whole-step semantics and local-browser evidence pass; no original identity, source predicate or qualified intent is dropped.
- This package's task tests and fresh source matrix pass with exact counts; failed/partial proofs do not change qualification.
- Source-only completion leaves live/device/native-owner/admission/deployment/traffic gates held.
</success_criteria>

<output>
After separate source admission and verified implementation, record exact commits, evidence, counts and unresolved gates in .planning/viewport-proof-20261104/remaining-behaviors/execution/VPG-02-SUMMARY.md. Do not create a success summary from this plan preparation.
</output>
