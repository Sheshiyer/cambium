---
phase: viewport-behavior-gaps-v1
plan: VPG-09
type: execute
status: proposed
execution_authorized: false
autonomous: false
wave: 9
depends_on: ["VPG-08"]
requirements: ["FA-VPG-39","FA-VPG-42","FA-VPG-45"]
files_modified: ["apps/cambium-r3f/src/curious-world/portfolio-folio.ts","apps/cambium-r3f/src/curious-world/portfolio-folio.test.ts","workers/quests/src/page/client/curious-read-bridge.ts","workers/quests/src/curious-world-operational-read.test.ts","apps/cambium-r3f/src/curious-world/index.ts","apps/cambium-r3f/src/curious-world/styles.css","workers/quests/src/page/components/curious-world.ts","scripts/capture-field-atlas.mjs","scripts/field-atlas-operational-fixture.mjs","docs/visual/field-atlas-viewport-contract.v1.json","scripts/field-atlas-viewport-contract.test.mjs","workers/quests/src/page/components/curious-world.generated.ts","docs/plans/assets/field-atlas-viewport-proof/manifest.json","docs/plans/assets/field-atlas-viewport-proof/*.png"]
user_setup: []
must_haves:
  truths: ["Portfolio zones/counts and alias meaning derive from exact catalog authority.","Fitcheck selection survives the five original portfolio context views.","The five organ-plan cards remain inactive without a matching authoritative receipt and no recurring schedule is inferred."]
  artifacts: [{"path":"apps/cambium-r3f/src/curious-world/portfolio-folio.ts","provides":"Source implementation or verification for VPG-09"},{"path":"apps/cambium-r3f/src/curious-world/portfolio-folio.test.ts","provides":"Source implementation or verification for VPG-09"},{"path":"workers/quests/src/page/client/curious-read-bridge.ts","provides":"Source implementation or verification for VPG-09"}]
  key_links: [{"from":"apps/cambium-r3f/src/curious-world/portfolio-folio.ts","to":"apps/cambium-r3f/src/curious-world/index.ts","via":"Sanitized existing-owner projection into the current 3D dossier"},{"from":"scripts/capture-field-atlas.mjs","to":"docs/visual/field-atlas-viewport-contract.v1.json","via":"Original identity → implemented predicates → fresh source/fixture/PNG proof"}]
---

<objective>
Authoritative portfolio and organ-plan overview. This future source package covers 3 currently held intents. It does not execute from this proposal.

Purpose: Portfolio zones/counts and alias meaning derive from exact catalog authority.
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
| operating-fabric-320-mobile.png | FA-VPG-39 | field-atlas-gap-39-320x844.png | 320×844 |
| operating-fabric-390-mobile.png | FA-VPG-42 | field-atlas-gap-42-390x844.png | 390×844 |
| operating-fabric-430-mobile.png | FA-VPG-45 | field-atlas-gap-45-430x844.png | 430×844 |

Source files named here are existing unless this package first creates its named folio/test, operational fixture/test, owner-bindings reference or gap regression test. Generated bundle and capture artifacts are regenerated through existing commands, never manually restamped. File overlap is serialized by the dependency above.
</context>

<tasks>
<task type="auto" id="VPG-09-T1">
  <name>Build exact portfolio folio owner projection</name>
  <files>apps/cambium-r3f/src/curious-world/portfolio-folio.ts, apps/cambium-r3f/src/curious-world/portfolio-folio.test.ts, workers/quests/src/page/client/curious-read-bridge.ts, workers/quests/src/curious-world-operational-read.test.ts</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, shared/portfolio-catalog-authority.ts, workers/quests/src/portfolio-catalog.ts, workers/quests/src/operating-fabric-portfolio.test.ts, workers/quests/src/operating-fabric-organ-update.test.ts, workers/quests/src/page/operating-fabric/organ-update.ts</read_first>
  <action>Normalize portfolio authority and organ-update-plan projections from their existing contracts. Bind ids, source revision/digest, classification and freshness; keep review/historical distinctions and aliases display-only. For the original synthetic fixture only, derive4zones/93cards and category counts 17saplings/41clients/15programs/0review/20historical plus5organ-plan cards from its pinned input. Never hardcode those as live counts or substitute the historical132-node graph. Missing or contradictory actual owner counts remain unavailable.</action>
  <verify><automated>node --test apps/cambium-r3f/src/curious-world/portfolio-folio.test.ts workers/quests/src/operating-fabric-portfolio.test.ts workers/quests/src/operating-fabric-organ-update.test.ts</automated></verify>
  <acceptance_criteria>
    - Unattributed count, alias-as-canonical id, historical graph substitution or stale catalog cannot pass.
    - Another context view visible, lost Fitcheck context, inferred organ activation/schedule or incorrect fixture count rejects proof.
  </acceptance_criteria>
  <done>The source-bound model has positive and negative tests; unavailable or inconsistent owner data stays held.</done>
</task>

<task type="auto" id="VPG-09-T2">
  <name>Wire reachable current 3D interactions</name>
  <files>apps/cambium-r3f/src/curious-world/index.ts, apps/cambium-r3f/src/curious-world/styles.css, workers/quests/src/page/components/curious-world.ts</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, apps/cambium-r3f/src/curious-world/portfolio-folio.ts, apps/cambium-r3f/src/curious-world/gate-decision-chamber.ts, apps/cambium-r3f/src/curious-world/gate-folio.ts, workers/quests/src/page/client/curious-read-bridge.ts</read_first>
  <action>Build current 3D portfolio/organ dossiers with four source-classification zones and native Fitcheck selection. Supply contained Canopy/Mission/Flow/Workforce/Forge context views without remounting operating-fabric renderers. Each view must retain Fitcheck identity, selected tab/focus, source context and inactive organ status; other context views are hidden. Preserve 5organ cards with Genesis/Inbox, Taste/Digests, Hands/Dev, Will/Clients, Cortex/Agent Ops and No recurring schedule. Controls are≥44px; tab labels and panels fit320/390/430. Restore Canopy after the traversal.</action>
  <verify><automated>npm --prefix apps/cambium-r3f run curious:test</automated></verify>
  <acceptance_criteria>
    - Native chart/dossier entry, selected identity, source labels, reachable controls and close/back/focus work at the original viewports.
    - No retired shell, new auth channel, remote effect or false runtime completion is introduced.
  </acceptance_criteria>
  <done>Current 3D presentation exposes the required original affordances with actual owner semantics and honest holds.</done>
</task>

<task type="auto" id="VPG-09-T3">
  <name>Prove 3 exact retained journeys and publish fresh source evidence</name>
  <files>scripts/capture-field-atlas.mjs, scripts/field-atlas-operational-fixture.mjs, docs/visual/field-atlas-viewport-contract.v1.json, scripts/field-atlas-viewport-contract.test.mjs</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, scripts/field-atlas-viewport-contract.mjs, scripts/field-atlas-operational-fixture.test.mjs</read_first>
  <action>Port all operatingFabricAllScenesAssertion predicates from rows 39/42/45 at original320/390/430×844. Check fixture-derived93cards/4zones/category counts,5organ cards, alias semantics, all-five-view isolation/selection persistence, organ-active none, no body overflow and restored Canopy. Prove owner count drift/unknown data is shown honestly rather than made to match the fixture. Add only this package’s proposed terminal cases listed below, retain previous cases and bind new helper/model source files. Follow VALIDATION.md's clean-source capture/publication sequence. Qualified counts change only when all original predicates and native-input/visible-state evidence actually pass; otherwise stop this package with the exact hold.</action>
  <verify><automated>node --test scripts/capture-field-atlas.test.mjs scripts/field-atlas-viewport-contract.test.mjs scripts/field-atlas-operational-fixture.test.mjs</automated></verify>
  <acceptance_criteria>
    - Fresh source proof contains 80 cases; all previous qualified intents remain qualified.
    - Only after genuine complete proofs, the derived target is 43/43 qualified and 0 held.
    - Unattributed count, alias-as-canonical id, historical graph substitution or stale catalog cannot pass.
    - Another context view visible, lost Fitcheck context, inferred organ activation/schedule or incorrect fixture count rejects proof.
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
Follow VALIDATION.md for the complete fresh-matrix sequence, source binding and owner-effect checks. Target after actual completion: 80 source cases, 43/43 qualified, 0 held. Intermediate strict exit1 is expected while any intent is held; sourceProofOk must still be true. Any missing predicate/capability blocks this package.
</verification>

<success_criteria>
- All listed whole-step semantics and local-browser evidence pass; no original identity, source predicate or qualified intent is dropped.
- This package's task tests and fresh source matrix pass with exact counts; failed/partial proofs do not change qualification.
- Source-only completion leaves live/device/native-owner/admission/deployment/traffic gates held.
</success_criteria>

<output>
After separate source admission and verified implementation, record exact commits, evidence, counts and unresolved gates in .planning/viewport-proof-20261104/remaining-behaviors/execution/VPG-09-SUMMARY.md. Do not create a success summary from this plan preparation.
</output>

