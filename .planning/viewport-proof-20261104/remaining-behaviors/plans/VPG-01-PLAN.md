---
phase: viewport-behavior-gaps-v1
plan: VPG-01
type: execute
status: proposed
execution_authorized: false
autonomous: false
wave: 1
depends_on: []
requirements: ["FA-VPG-G01"]
files_modified: ["docs/visual/viewport-owner-bindings.md","scripts/field-atlas-operational-fixture.mjs","scripts/field-atlas-operational-fixture.test.mjs","scripts/field-atlas-viewport-gaps.test.mjs","scripts/capture-field-atlas.mjs","scripts/capture-field-atlas.test.mjs","scripts/field-atlas-viewport-contract.mjs","scripts/field-atlas-viewport-contract.test.mjs","workers/quests/src/page/components/curious-world.generated.ts","docs/plans/assets/field-atlas-viewport-proof/manifest.json","workers/quests/src/visual-viewport-proof.mjs","docs/plans/assets/field-atlas-viewport-proof/*.png"]
user_setup: []
must_haves:
  truths: ["All 43 retained definitions and 47 historical artifacts retain their exact identities and predicates.","Four 430×844 supplements preserve the original protected height without replacing 430×932 evidence.","A crop or synthetic action cannot weaken viewport, owner or no-effect validation."]
  artifacts: [{"path":"docs/visual/viewport-owner-bindings.md","provides":"Source implementation or verification for VPG-01"},{"path":"scripts/field-atlas-operational-fixture.mjs","provides":"Source implementation or verification for VPG-01"},{"path":"scripts/field-atlas-operational-fixture.test.mjs","provides":"Source implementation or verification for VPG-01"}]
  key_links: [{"from":"scripts/capture-field-atlas.mjs","to":"scripts/field-atlas-viewport-contract.mjs","via":"Native journey and exact evidence registration"},{"from":"scripts/capture-field-atlas.mjs","to":"docs/visual/field-atlas-viewport-contract.v1.json","via":"Original identity → implemented predicates → fresh source/fixture/PNG proof"}]
---

<objective>
Freeze owner contracts and preserve proof coverage. This future source package covers 0 currently held intents. It does not execute from this proposal.

Purpose: All 43 retained definitions and 47 historical artifacts retain their exact identities and predicates.
Output: Owner bindings, immutable-coverage regressions and 48-case capture foundation.
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

Four supplements: gate-reviewed, gate-preflight, gate-back and gate-close at 430×844. All 44 existing cases remain, including 430×932.

Source files named here are existing unless this package first creates its named folio/test, operational fixture/test, owner-bindings reference or gap regression test. Generated bundle and capture artifacts are regenerated through existing commands, never manually restamped. File overlap is serialized by the dependency above.
</context>

<tasks>
<task type="auto" id="VPG-01-T1">
  <name>Freeze original predicates and exact owner boundaries</name>
  <files>docs/visual/viewport-owner-bindings.md, scripts/field-atlas-operational-fixture.mjs, scripts/field-atlas-operational-fixture.test.mjs, scripts/field-atlas-viewport-gaps.test.mjs</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, workers/quests/src/handler.ts, workers/quests/src/action-requests.ts, scripts/field-atlas-founder-fixture.mjs</read_first>
  <action>Record the existing owner, envelope field, schema, auth channel and unavailable-state behavior for each of the eight gap groups. Preserve /founder Access signing only for goal approval/rejection; other Gate kinds remain Telegram-signed. Add a loopback-only synthetic operational fixture and meaningful tests for tenant/id/version/digest/freshness conflicts, wrong methods and remote-target refusal. It cannot alter the existing founder read fixture or issue external requests. Reuse the existing validateRetainedAssertions history checks for all47 whole-step/image/manifest bindings; add new regression tests only for the operational owner/counter/clip boundaries, not a duplicate snapshot of existing assertions. An unavailable owner contract is a named blocking result, never an invented success.</action>
  <verify><automated>node --test scripts/field-atlas-operational-fixture.test.mjs scripts/field-atlas-viewport-gaps.test.mjs</automated></verify>
  <acceptance_criteria>
    - All 47 original step and PNG bindings validate; the same four gallery rows alone are retired.
    - Owner map names goal-only Access and existing Telegram-signed non-goal boundaries; missing capability blocks its package.
    - Wrong identity/method/remote destination is rejected before any synthetic action transition.
  </acceptance_criteria>
  <done>Source owner bindings and isolated fixture boundaries are testable, with no owner write or signer expansion.</done>
</task>

<task type="auto" id="VPG-01-T2">
  <name>Add original-height cases and strict crop evidence</name>
  <files>scripts/capture-field-atlas.mjs, scripts/capture-field-atlas.test.mjs, scripts/field-atlas-viewport-contract.mjs, scripts/field-atlas-viewport-contract.test.mjs, workers/quests/src/visual-viewport-proof.mjs, docs/plans/assets/field-atlas-viewport-proof/manifest.json, docs/plans/assets/field-atlas-viewport-proof/*.png</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, scripts/field-atlas-viewport-contract.mjs, scripts/capture-field-atlas.test.mjs</read_first>
  <action>Add exactly the four gate-reviewed/preflight/back/close 430×844 supplemental cases from coverage.json; retain all 44 current cases, including 430×932. Extend the existing withServer loopback fixture option for the isolated operational fixture and return actual observed crop receipts from captureViewportProof in visual-viewport-proof.mjs; preserve every original step definition and existing founder read denial. Extend per-case capture evidence to bind the actual CSS/visual viewport, an observed modal crop rectangle where an original step requires clipping, and the PNG dimensions/hash to that rectangle. Keep existing full-frame dimension rules exact; no unbounded crop or exemption from painted-state checks. Bind the new fixture/helper sources explicitly. Preserve the below-fold negative rejection and current 11 equivalents; take a fresh 48-case matrix from a clean source cut.</action>
  <verify><automated>node --test scripts/capture-field-atlas.test.mjs scripts/field-atlas-viewport-contract.test.mjs</automated></verify>
  <acceptance_criteria>
    - Exactly 48 source cases exist: prior 44 plus the four named supplements; no behavior is newly qualified by a row alone.
    - Changing viewport, crop bounds, dimensions, PNG bytes, text visibility or fixture method counts rejects evidence.
    - Fresh source proof passes; strict qualification still reports 11/43 and 32 holds.
  </acceptance_criteria>
  <done>The 48-case foundation proves protected viewport dimensions and a closed crop/input contract without dropping an old assertion.</done>
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
Follow VALIDATION.md for the complete fresh-matrix sequence, source binding and owner-effect checks. Target after actual completion: 48 source cases, 11/43 qualified, 32 held. Intermediate strict exit1 is expected while any intent is held; sourceProofOk must still be true. Any missing predicate/capability blocks this package.
</verification>

<success_criteria>
- All listed whole-step semantics and local-browser evidence pass; no original identity, source predicate or qualified intent is dropped.
- This package's task tests and fresh source matrix pass with exact counts; failed/partial proofs do not change qualification.
- Source-only completion leaves live/device/native-owner/admission/deployment/traffic gates held.
</success_criteria>

<output>
After separate source admission and verified implementation, record exact commits, evidence, counts and unresolved gates in .planning/viewport-proof-20261104/remaining-behaviors/execution/VPG-01-SUMMARY.md. Do not create a success summary from this plan preparation.
</output>

