---
phase: viewport-behavior-gaps-v1
plan: VPG-07
type: execute
status: proposed
execution_authorized: false
autonomous: false
wave: 7
depends_on: ["VPG-06"]
requirements: ["FA-VPG-30","FA-VPG-31","FA-VPG-32","FA-VPG-35","FA-VPG-36"]
files_modified: ["apps/cambium-r3f/src/curious-world/action-request-folio.ts","apps/cambium-r3f/src/curious-world/action-request-folio.test.ts","workers/quests/src/page/client/curious-read-bridge.ts","scripts/field-atlas-operational-fixture.mjs","scripts/field-atlas-operational-fixture.test.mjs","apps/cambium-r3f/src/curious-world/index.ts","apps/cambium-r3f/src/curious-world/styles.css","workers/quests/src/page/components/curious-world.ts","workers/quests/src/page/client/curious-gate-bridge.ts","workers/quests/src/curious-world-gate.test.ts","scripts/capture-field-atlas.mjs","docs/visual/field-atlas-viewport-contract.v1.json","scripts/field-atlas-viewport-contract.test.mjs","workers/quests/src/page/components/curious-world.generated.ts","docs/plans/assets/field-atlas-viewport-proof/manifest.json","docs/plans/assets/field-atlas-viewport-proof/*.png"]
user_setup: []
must_haves:
  truths: ["ActionRequest approval has an explicit exact preflight and inspect/cancel path.","Request-sent is visible before an actual result and sends exactly one synthetic local POST.","Queued receipt, proof, refresh/navigation and idempotency retain their original geometry and truthful status."]
  artifacts: [{"path":"apps/cambium-r3f/src/curious-world/action-request-folio.ts","provides":"Typed ActionRequest identity, capability and result contracts"},{"path":"apps/cambium-r3f/src/curious-world/action-request-folio.test.ts","provides":"ActionRequest state and identity boundaries"},{"path":"workers/quests/src/page/client/curious-gate-bridge.ts","provides":"Separate typed non-goal adapter inside the existing page-owned Gate transport"},{"path":"workers/quests/src/curious-world-gate.test.ts","provides":"Transport, refusal, pending and duplicate boundaries"}]
  key_links: [{"from":"workers/quests/src/page/client/curious-gate-bridge.ts","to":"workers/quests/src/page/components/curious-world.ts","via":"Explicit non-goal capability and sanitized result, distinct from goal-only signGate"},{"from":"workers/quests/src/page/components/curious-world.ts","to":"apps/cambium-r3f/src/curious-world/index.ts","via":"Typed mount option connects ActionRequest confirm and original-status readback"},{"from":"apps/cambium-r3f/src/curious-world/action-request-folio.ts","to":"apps/cambium-r3f/src/curious-world/index.ts","via":"Exact request/option/tenant/idempotency context through native confirmation"},{"from":"scripts/capture-field-atlas.mjs","to":"docs/visual/field-atlas-viewport-contract.v1.json","via":"Original identity → implemented predicates → fresh source/fixture/PNG proof"}]
---

<objective>
ActionRequest signed preflight, sent, queued and proof journeys. This future source package covers 5 currently held intents. It does not execute from this proposal.

Purpose: ActionRequest approval has an explicit exact preflight and inspect/cancel path.
Output: 5 current 3D equivalents with exact fresh source evidence.
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
| gate-iverif-queued-proof-mobile.png | FA-VPG-30 | field-atlas-gap-30-390x844.png | 390×844 |
| sheet-gate-queued-result-mobile.png | FA-VPG-31 | field-atlas-gap-31-390x844.png | 390×844 |
| sheet-gate-queued-proof-detail-mobile.png | FA-VPG-32 | field-atlas-gap-32-390x844.png | 390×844 |
| sheet-gate-confirm-action-request-preflight-mobile.png | FA-VPG-35 | field-atlas-gap-35-390x844.png | 390×844 |
| sheet-gate-confirm-action-request-request-sent-mobile.png | FA-VPG-36 | field-atlas-gap-36-390x844.png | 390×844 |

Source files named here are existing unless this package first creates its named folio/test, operational fixture/test, owner-bindings reference or gap regression test. Generated bundle and capture artifacts are regenerated through existing commands, never manually restamped. File overlap is serialized by the dependency above.
</context>

<tasks>
<task type="auto" id="VPG-07-T1">
  <name>Extend exact action request folio owner projection</name>
  <files>apps/cambium-r3f/src/curious-world/action-request-folio.ts, apps/cambium-r3f/src/curious-world/action-request-folio.test.ts, workers/quests/src/page/client/curious-read-bridge.ts, scripts/field-atlas-operational-fixture.mjs, scripts/field-atlas-operational-fixture.test.mjs</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, workers/quests/src/action-requests.ts, workers/quests/src/handler.ts, apps/cambium-r3f/src/curious-world/gate-decision-chamber.ts, scripts/field-atlas-operational-fixture.mjs, scripts/field-atlas-founder-fixture.mjs</read_first>
  <action>Extend the ActionRequest model with preflight, request-sent, queued/unconfirmed, recorded-result and independent consumption/completion states; preserve tenant/request/option/idempotency throughout. Extend only the identified loopback operational action fixture for confirm-action-request, with one held response that lets native input observe request-sent. It must match the existing Telegram-signed owner payload and reject remote destinations, wrong method/kind/id/option and duplicates. Keep the founder read fixture's decision/renewal denials and all old 44 counters unchanged.</action>
  <verify><automated>node --test apps/cambium-r3f/src/curious-world/action-request-folio.test.ts scripts/field-atlas-operational-fixture.test.mjs</automated></verify>
  <acceptance_criteria>
    - Duplicate confirm, wrong option or remote POST cannot pass; uncertain result cannot be resubmitted as success.
    - A completed label before owner result, absent pending frame, changed request count or lost viewport/action geometry rejects evidence.
  </acceptance_criteria>
  <done>The source-bound model has positive and negative tests; unavailable or inconsistent owner data stays held.</done>
</task>

<task type="auto" id="VPG-07-T2">
  <name>Assign the typed non-goal host adapter and native confirmation wiring</name>
  <files>apps/cambium-r3f/src/curious-world/action-request-folio.ts, apps/cambium-r3f/src/curious-world/index.ts, apps/cambium-r3f/src/curious-world/styles.css, workers/quests/src/page/client/curious-gate-bridge.ts, workers/quests/src/page/components/curious-world.ts, workers/quests/src/curious-world-gate.test.ts, scripts/field-atlas-operational-fixture.test.mjs</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, apps/cambium-r3f/src/curious-world/action-request-folio.ts, apps/cambium-r3f/src/curious-world/gate-decision-chamber.ts, apps/cambium-r3f/src/curious-world/gate-folio.ts, workers/quests/src/page/client/curious-read-bridge.ts, workers/quests/src/page/client/curious-gate-bridge.ts, workers/quests/src/page/components/curious-world.ts, workers/quests/src/page/world-host.ts, workers/quests/src/page/client/signed-action.ts, workers/quests/src/handler.ts, workers/quests/src/action-requests.ts, workers/quests/src/curious-world-gate.test.ts</read_first>
  <action>The current signGate/CuriousGateBridge.sign and GateKind are goal-only; CuriousReadBridge is display-only, and the maintained host omits historical CLIENT_SIGNED_ACTION. Do not assume any of these already submits a non-goal request. Define separate typed ActionRequest confirmation input/capability/result contracts in action-request-folio.ts, with exact tenant/request/selected-option/idempotency and current owner-read identity/freshness binding. Extend the existing page-owned curious-gate-bridge.ts with that separate non-goal adapter and expose it explicitly through the component and CuriousWorldBridge mount options to native ActionRequest confirmation. Do not widen GateKind or route non-goal actions through Access signing. The host alone retains Telegram initData and same-origin POST ownership; the world receives only the sanitized capability/results, never credentials, fetch or a destination URL. Match the existing Telegram /api/gate/&lt;tenant&gt; confirm-action-request payload: kind, subject and actionRequestId bound to the same request, selected optionId, idempotencyKey, evidence/consequence/reversibility and host-owned initData. The route derives tenant and verified founder identity; do not invent body authority, a new endpoint or backend writer. Bind request-sent/pending before response settlement, queued only to a validated matching owner result, and refusal/uncertain to explicit outcomes. Original-status recovery uses the existing owner-backed quest/Gate read projection and exact request identity before any retry; a missing read capability stays held. The isolated operational fixture may inject only an explicitly identified loopback synthetic capability through its harness seam, with no query-flag or remote override in normal Access/guest sessions. Test Access/guest refusal, wrong/foreign/expired or stale owner context, option/idempotency mismatch, duplicate native confirm, uncertain-result readback and exactly one local POST before the held response settles. Implement exact inspect-before-confirm preflight, separate confirm/cancel and pending sending/Queueing state. Render queued receipt actions with full-width refresh above equal-height Mission/Inspect navigation, wrapping idempotency values, a two-line preview and full-width left-aligned proof button. Proof navigation preserves selected request and exact CSS/visual viewport; queue never implies consumption or execution. Read historical signed-action.ts only for existing payload semantics; do not import its renderer or script.</action>
  <verify><automated>node --test workers/quests/src/curious-world-gate.test.ts scripts/field-atlas-operational-fixture.test.mjs
npm --prefix apps/cambium-r3f run curious:test</automated></verify>
  <acceptance_criteria>
    - Native chart/dossier entry, selected identity, source labels, reachable controls and close/back/focus work at the original viewports.
    - The typed non-goal capability is wired host → component/mount → native ActionRequest confirm; no generic goal-signing call or display-only bridge is used to submit it.
    - Access/guest, invalid identity, stale/expired context and duplicate confirmation refuse without a second POST. Row 36 records exactly one identified loopback Worker POST and painted pending state before settlement.
    - No retired shell, new auth channel, remote effect or false runtime completion is introduced.
  </acceptance_criteria>
  <done>Current 3D presentation exposes the required original affordances with actual owner semantics and honest holds.</done>
</task>

<task type="auto" id="VPG-07-T3">
  <name>Prove 5 exact retained journeys and publish fresh source evidence</name>
  <files>scripts/capture-field-atlas.mjs, scripts/field-atlas-operational-fixture.mjs, docs/visual/field-atlas-viewport-contract.v1.json, scripts/field-atlas-viewport-contract.test.mjs</files>
  <read_first>.planning/viewport-proof-20261104/remaining-behaviors/CONTEXT.md, .planning/viewport-proof-20261104/remaining-behaviors/coverage.json, .planning/viewport-proof-20261104/remaining-behaviors/PATTERNS.md, workers/quests/src/visual-viewport-proof.mjs, scripts/field-atlas-viewport-contract.mjs, scripts/field-atlas-operational-fixture.test.mjs</read_first>
  <action>Port rows 30–32,35–36 in full. At 390×844 verify proof width≥44px and card width−28px, two-line preview, no signing entrypoint on a queued card, exact CSS/visual viewport, idempotency wrapping, refresh/navigation placement and proof-detail navigation. Request-sent row 36 must record exactly one identified synthetic Worker POST and the pending label before result settlement. Add typed per-case request/crop receipts rather than relaxing global zero/shape checks. Add only this package’s proposed terminal cases listed below, retain previous cases and bind new helper/model source files. Follow VALIDATION.md's clean-source capture/publication sequence. Qualified counts change only when all original predicates and native-input/visible-state evidence actually pass; otherwise stop this package with the exact hold.</action>
  <verify><automated>node --test scripts/capture-field-atlas.test.mjs scripts/field-atlas-viewport-contract.test.mjs scripts/field-atlas-operational-fixture.test.mjs</automated></verify>
  <acceptance_criteria>
    - Fresh source proof contains 76 cases; all previous qualified intents remain qualified.
    - Only after genuine complete proofs, the derived target is 39/43 qualified and 4 held.
    - Duplicate confirm, wrong option or remote POST cannot pass; uncertain result cannot be resubmitted as success.
    - A completed label before owner result, absent pending frame, changed request count or lost viewport/action geometry rejects evidence.
  </acceptance_criteria>
  <done>This package's 5 original identities have registered exact equivalents and fresh source proof, or an explicit unresolved capability prevents completion.</done>
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
Follow VALIDATION.md for the complete fresh-matrix sequence, source binding and owner-effect checks. Target after actual completion: 76 source cases, 39/43 qualified, 4 held. Intermediate strict exit1 is expected while any intent is held; sourceProofOk must still be true. Any missing predicate/capability blocks this package.
</verification>

<success_criteria>
- All listed whole-step semantics and local-browser evidence pass; no original identity, source predicate or qualified intent is dropped.
- This package's task tests and fresh source matrix pass with exact counts; failed/partial proofs do not change qualification.
- Source-only completion leaves live/device/native-owner/admission/deployment/traffic gates held.
</success_criteria>

<output>
After separate source admission and verified implementation, record exact commits, evidence, counts and unresolved gates in .planning/viewport-proof-20261104/remaining-behaviors/execution/VPG-07-SUMMARY.md. Do not create a success summary from this plan preparation.
</output>
