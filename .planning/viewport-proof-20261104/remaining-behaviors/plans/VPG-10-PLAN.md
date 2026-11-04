---
phase: viewport-behavior-gaps-v1
plan: VPG-10
type: execute
status: proposed
execution_authorized: false
autonomous: false
wave: 10
depends_on: ["VPG-09"]
requirements: ["FA-VPG-10","FA-VPG-19","FA-VPG-27","FA-VPG-28","FA-VPG-37","FA-VPG-40","FA-VPG-41","FA-VPG-43","FA-VPG-44","FA-VPG-46","FA-VPG-47","FA-VPG-G02"]
files_modified: ["scripts/capture-field-atlas.mjs","scripts/field-atlas-viewport-contract.mjs","docs/visual/field-atlas-viewport-contract.v1.json","scripts/field-atlas-viewport-contract.test.mjs","docs/visual/field-atlas-viewport-proof.md","ISA.md",".planning/HANDOFF.json",".project/HANDOFF.md","docs/plans/assets/field-atlas-viewport-proof/manifest.json","workers/quests/src/page/components/curious-world.generated.ts","docs/plans/assets/field-atlas-viewport-proof/*.png"]
user_setup: []
must_haves:
  truths: ["All 43 retained intents qualify through complete registered current source journeys.","All 80 planned cases and 47 historical artifacts have independently checked provenance and visible evidence.","Source qualification leaves live/device/native-owner/deployment/traffic acceptance held."]
  artifacts: [{"path":"scripts/capture-field-atlas.mjs","provides":"Source implementation or verification for VPG-10"},{"path":"scripts/field-atlas-viewport-contract.mjs","provides":"Source implementation or verification for VPG-10"},{"path":"docs/visual/field-atlas-viewport-contract.v1.json","provides":"Source implementation or verification for VPG-10"}]
  key_links: [{"from":"scripts/capture-field-atlas.mjs","to":"scripts/field-atlas-viewport-contract.mjs","via":"Native journey and exact evidence registration"},{"from":"scripts/capture-field-atlas.mjs","to":"docs/visual/field-atlas-viewport-contract.v1.json","via":"Original identity → implemented predicates → fresh source/fixture/PNG proof"}]
---

<objective>
Qualify all 43 retained intents and close source evidence. This future source package covers 0 currently held intents and verifies all 11 protected equivalents. It does not execute from this proposal.

Purpose: All 43 retained intents qualify through complete registered current source journeys.
Output: Reviewed all 43 source qualification and bounded handoff.
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

Protected requirement IDs: FA-VPG-10, FA-VPG-19, FA-VPG-27, FA-VPG-28, FA-VPG-37, FA-VPG-40, FA-VPG-41, FA-VPG-43, FA-VPG-44, FA-VPG-46, FA-VPG-47. Final audit includes all 43 retained intents.

Source files named here are existing unless this package first creates its named folio/test, operational fixture/test, owner-bindings reference or gap regression test. Generated bundle and capture artifacts are regenerated through existing commands, never manually restamped. File overlap is serialized by the dependency above.
</context>

<tasks>
<task type="auto" id="VPG-10-T1">
  <name>Audit all 43 intents and the complete 80-case proof set</name>
  <files>scripts/capture-field-atlas.mjs, scripts/field-atlas-viewport-contract.mjs, docs/visual/field-atlas-viewport-contract.v1.json, scripts/field-atlas-viewport-contract.test.mjs, docs/visual/field-atlas-viewport-proof.md</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, .planning/viewport-proof-20261104/remaining-behaviors/TRACEABILITY.md, scripts/check-field-atlas-proof.mjs, scripts/verify-release.mjs</read_first>
  <action>Compare every whole original retained step against its implemented 3D journey. Require explicit registrations for all 32 new equivalents and protect the existing11, including Fitcheck Gate review, no fake progress, empty queue, complete consequence/reversal, approve preflight and exact-width back/close/focus. Validate all 80 planned cases and the four 430×844 supplements without deleting430×932 evidence. Tamper each behavior family’s identity, predicate, input/request/crop receipt or PNG binding and prove lost qualification. Inspect every terminal PNG and full source/PAGE/step/fixture/hash vector. No metadata-only or partial equivalent closes a row.</action>
  <verify><automated>node --test scripts/capture-field-atlas.test.mjs scripts/field-atlas-viewport-contract.test.mjs scripts/field-atlas-operational-fixture.test.mjs scripts/field-atlas-viewport-gaps.test.mjs</automated></verify>
  <acceptance_criteria>
    - All 43 retained identities have complete reviewed registrations; changing a required predicate/owner/crop/input loses qualification.
    - All 80 actual images are independently viewed with named states painted and exact source/instruction/PNG bindings.
    - Original47 history bytes and all 11 protected equivalence identities remain accounted for.
  </acceptance_criteria>
  <done>The source evidence audit supports all 43 retained behaviors; missing owner capability or predicate leaves that intent held.</done>
</task>

<task type="auto" id="VPG-10-T2">
  <name>Run frozen source verification and publish a bounded handoff</name>
  <files>ISA.md, .planning/HANDOFF.json, .project/HANDOFF.md, docs/visual/field-atlas-viewport-proof.md, docs/plans/assets/field-atlas-viewport-proof/manifest.json</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, .planning/viewport-proof-20261104/remaining-behaviors/VALIDATION.md, docs/assets/provenance.json, scripts/retired-runtime-surfaces.mjs, PROJECT.md</read_first>
  <action>After admitted source work and independent review, regenerate the bundle, commit a clean implementation cut, capture/publish the complete80-case source matrix through the existing recovery publisher, then commit evidence/checkpoint docs. Run full npm test on that exact final commit in an independent frozen Git checkout and retain head/tree/refs/clean-state before/after. Verify actual Worker dry-run sourcemap/output, app typing/parity, source drift, original history and docs-only image provenance. Record exact source versus evidence pins and retained broader type diagnostics. Update only the matching continuation and bounded human checkpoint; preserve the first 12 lines/history and unrelated Phase 9 spine. Mark ISA criteria only from actual accepted evidence, never from this plan.</action>
  <verify><automated>npm test</automated></verify>
  <acceptance_criteria>
    - Frozen npm test exits0; app typecheck/parity, source drift and actual Worker output checks pass with no introduced diagnostic identities.
    - Strict qualification exits0 with sourceProofOk=true,43 qualified and 0 held; fresh current matrix has80 cases.
    - Version 95 remains the planning baseline; live/device/native-prefill/callback/execution/deployment/traffic flags remain held, and no external operation occurs.
  </acceptance_criteria>
  <done>Exact source/local qualification and recovery evidence are handed off; no live, runtime-owner, physical-device or release acceptance is inferred.</done>
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
After separate source admission and verified implementation, record exact commits, evidence, counts and unresolved gates in .planning/viewport-proof-20261104/remaining-behaviors/execution/VPG-10-SUMMARY.md. Do not create a success summary from this plan preparation.
</output>

