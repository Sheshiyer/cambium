---
phase: viewport-behavior-gaps-v1
plan: VPG-03
type: execute
status: proposed
execution_authorized: false
autonomous: false
wave: 3
depends_on: ["VPG-02"]
requirements: ["FA-VPG-13","FA-VPG-14","FA-VPG-15"]
files_modified: ["apps/cambium-r3f/src/curious-world/story-tools-folio.ts","apps/cambium-r3f/src/curious-world/story-tools-folio.test.ts","workers/quests/src/page/client/curious-read-bridge.ts","workers/quests/src/curious-world-operational-read.test.ts","apps/cambium-r3f/src/curious-world/index.ts","apps/cambium-r3f/src/curious-world/styles.css","workers/quests/src/page/components/curious-world.ts","scripts/capture-field-atlas.mjs","scripts/field-atlas-operational-fixture.mjs","docs/visual/field-atlas-viewport-contract.v1.json","scripts/field-atlas-viewport-contract.test.mjs","workers/quests/src/page/components/curious-world.generated.ts","docs/plans/assets/field-atlas-viewport-proof/manifest.json","docs/plans/assets/field-atlas-viewport-proof/*.png"]
user_setup: []
must_haves:
  truths: ["Story beats and packets retain signal/source distinctions.","Tools show their actual handoff and organization-status owners.","Handoff opens the exact action review before any signed confirmation."]
  artifacts: [{"path":"apps/cambium-r3f/src/curious-world/story-tools-folio.ts","provides":"Source implementation or verification for VPG-03"},{"path":"apps/cambium-r3f/src/curious-world/story-tools-folio.test.ts","provides":"Source implementation or verification for VPG-03"},{"path":"workers/quests/src/page/client/curious-read-bridge.ts","provides":"Source implementation or verification for VPG-03"}]
  key_links: [{"from":"apps/cambium-r3f/src/curious-world/story-tools-folio.ts","to":"apps/cambium-r3f/src/curious-world/index.ts","via":"Sanitized existing-owner projection into the current 3D dossier"},{"from":"scripts/capture-field-atlas.mjs","to":"docs/visual/field-atlas-viewport-contract.v1.json","via":"Original identity → implemented predicates → fresh source/fixture/PNG proof"}]
---

<objective>
Story signals and tool handoff review. This future source package covers 3 currently held intents. It does not execute from this proposal.

Purpose: Story beats and packets retain signal/source distinctions.
Output: 3 current 3D equivalents with exact fresh source evidence.
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
| story-feed-mobile.png | FA-VPG-13 | field-atlas-gap-13-390x844.png | 390×844 |
| tools-mobile.png | FA-VPG-14 | field-atlas-gap-14-390x844.png | 390×844 |
| sheet-tools-handoff-action-mobile.png | FA-VPG-15 | field-atlas-gap-15-390x844.png | 390×844 |

Source files named here are existing unless this package first creates its named folio/test, operational fixture/test, owner-bindings reference or gap regression test. Generated bundle and capture artifacts are regenerated through existing commands, never manually restamped. File overlap is serialized by the dependency above.
</context>

<tasks>
<task type="auto" id="VPG-03-T1">
  <name>Build exact story tools folio owner projection</name>
  <files>apps/cambium-r3f/src/curious-world/story-tools-folio.ts, apps/cambium-r3f/src/curious-world/story-tools-folio.test.ts, workers/quests/src/page/client/curious-read-bridge.ts, workers/quests/src/curious-world-operational-read.test.ts</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, workers/quests/src/page/scenes/story.ts, workers/quests/src/page/scenes/tools.ts, workers/quests/src/handler.ts, apps/cambium-r3f/src/curious-world/gate-folio.ts</read_first>
  <action>Add source-normalizing story/tools view models, reusing the existing story projection and normalizeToolsCommandProjection parser contracts without importing their retired SCENE renderers. Consume the existing envelope's projected beats/storyProjection and tool/status fields through sanitized read-bridge accessors. Preserve event/packet order, status provenance and unavailable/stale distinctions. Build Handoff review data from its existing action owner and exact subject/consequence/reversibility/idempotency fields; a goal-graph proposal is not a Handoff action.</action>
  <verify><automated>node --test apps/cambium-r3f/src/curious-world/story-tools-folio.test.ts workers/quests/src/curious-world-operational-read.test.ts</automated></verify>
  <acceptance_criteria>
    - Goal approval cannot satisfy the Handoff identity or signed requirement.
    - Hidden packet content, stale organization status, wrong event/packet source or any preflight action POST rejects proof.
  </acceptance_criteria>
  <done>The source-bound model has positive and negative tests; unavailable or inconsistent owner data stays held.</done>
</task>

<task type="auto" id="VPG-03-T2">
  <name>Wire reachable current 3D interactions</name>
  <files>apps/cambium-r3f/src/curious-world/index.ts, apps/cambium-r3f/src/curious-world/styles.css, workers/quests/src/page/components/curious-world.ts</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, apps/cambium-r3f/src/curious-world/story-tools-folio.ts, apps/cambium-r3f/src/curious-world/gate-decision-chamber.ts, apps/cambium-r3f/src/curious-world/gate-folio.ts, workers/quests/src/page/client/curious-read-bridge.ts</read_first>
  <action>Expose Story and Tools dossiers through current chart/directory navigation. Native input opens the packet rail/beat detail and the Handoff preflight with contained reviewed content, explicit inspect/cancel/back/close and opener focus. Show source distinctions and organization status in the visible terminal frames. A missing Telegram signer leaves non-goal confirmation held; opening Handoff review performs zero action POSTs. Keep existing read labels, 44px controls and the current header unchanged.</action>
  <verify><automated>npm --prefix apps/cambium-r3f run curious:test</automated></verify>
  <acceptance_criteria>
    - Native chart/dossier entry, selected identity, source labels, reachable controls and close/back/focus work at the original viewports.
    - No retired shell, new auth channel, remote effect or false runtime completion is introduced.
  </acceptance_criteria>
  <done>Current 3D presentation exposes the required original affordances with actual owner semantics and honest holds.</done>
</task>

<task type="auto" id="VPG-03-T3">
  <name>Prove 3 exact retained journeys and publish fresh source evidence</name>
  <files>scripts/capture-field-atlas.mjs, scripts/field-atlas-operational-fixture.mjs, docs/visual/field-atlas-viewport-contract.v1.json, scripts/field-atlas-viewport-contract.test.mjs</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, scripts/field-atlas-viewport-contract.mjs, scripts/field-atlas-operational-fixture.test.mjs</read_first>
  <action>Port original rows 13–15, including the fresh fixture's Story rail and the Handoff sheet preparation/waits/click-target/crop conditions. Show the complete named state in each terminal image and assert the exact original Handoff owner fields and no action request before explicit confirmation. Add only this package’s proposed terminal cases listed below, retain previous cases and bind new helper/model source files. Follow VALIDATION.md's clean-source capture/publication sequence. Qualified counts change only when all original predicates and native-input/visible-state evidence actually pass; otherwise stop this package with the exact hold.</action>
  <verify><automated>node --test scripts/capture-field-atlas.test.mjs scripts/field-atlas-viewport-contract.test.mjs scripts/field-atlas-operational-fixture.test.mjs</automated></verify>
  <acceptance_criteria>
    - Fresh source proof contains 58 cases; all previous qualified intents remain qualified.
    - Only after genuine complete proofs, the derived target is 21/43 qualified and 22 held.
    - Goal approval cannot satisfy the Handoff identity or signed requirement.
    - Hidden packet content, stale organization status, wrong event/packet source or any preflight action POST rejects proof.
  </acceptance_criteria>
  <done>This package's 3 original identities have registered exact equivalents and fresh source proof, or an explicit unresolved capability prevents completion.</done>
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
Follow VALIDATION.md for the complete fresh-matrix sequence, source binding and owner-effect checks. Target after actual completion: 58 source cases, 21/43 qualified, 22 held. Intermediate strict exit1 is expected while any intent is held; sourceProofOk must still be true. Any missing predicate/capability blocks this package.
</verification>

<success_criteria>
- All listed whole-step semantics and local-browser evidence pass; no original identity, source predicate or qualified intent is dropped.
- This package's task tests and fresh source matrix pass with exact counts; failed/partial proofs do not change qualification.
- Source-only completion leaves live/device/native-owner/admission/deployment/traffic gates held.
</success_criteria>

<output>
After separate source admission and verified implementation, record exact commits, evidence, counts and unresolved gates in .planning/viewport-proof-20261104/remaining-behaviors/execution/VPG-03-SUMMARY.md. Do not create a success summary from this plan preparation.
</output>

