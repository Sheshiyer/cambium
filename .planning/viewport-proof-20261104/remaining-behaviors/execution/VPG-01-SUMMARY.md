---
phase: viewport-behavior-gaps-v1
plan: VPG-01
subsystem: viewport-source-proof
tags: [loopback-fixture, owner-bindings, viewport, crop, retained-assertions]
requires: [accepted-viewport-plan]
provides: [closed-operational-fixture, observed-crop-receipts, forty-eight-case-foundation]
affects: [VPG-02, VPG-03, VPG-04, VPG-05, VPG-06, VPG-07, VPG-08, VPG-09, VPG-10]
tech-stack:
  added: []
  patterns: [existing-passive-loopback-harness, native-browser-input, staged-source-publication]
key-files:
  created: [docs/visual/viewport-owner-bindings.md, scripts/field-atlas-operational-fixture.mjs, scripts/field-atlas-operational-fixture.test.mjs, scripts/field-atlas-viewport-gaps.test.mjs]
  modified: [scripts/capture-field-atlas.mjs, scripts/capture-field-atlas.test.mjs, workers/quests/src/visual-viewport-proof.mjs, docs/plans/assets/field-atlas-viewport-proof/manifest.json]
metrics:
  tasks-completed: 2
  completed: 2026-11-04
  duration: 22min
requirements-source-verified: [FA-VPG-G01]
requirements-owner-accepted: []
planning-baseline: 95
deployment-approved: false
traffic-approved: false
---

# VPG-01: Owner, fixture and source proof foundation

The eight later behavior groups now have explicit source owner bindings. A
separate closed loopback ActionRequest fixture and observed viewport/crop/PNG
receipts support a fresh 48-case source matrix while preserving all 43 retained
intents, the existing 11 qualified behaviors and 32 explicit holds.

## Admission and scope

The user accepted content digest
`bcde1f5d4ed3b5285bd62e4a0ce4991dfb2e6b28bde508665559a09c84fa6c21`
and admitted only VPG-01-T1/T2 in `execution/ACCEPTANCE.json`, recorded in
`7460d730`. The reviewed proposal, coverage ledger and ten plans remain
byte-identical. Root Phase 9 STATE/ROADMAP/REQUIREMENTS/config were not advanced.
The matching ISA/handoff and final independent verification belong to the parent
continuation. VPG-02 through VPG-10 remain unadmitted.

## Task commits

| Task | Commit | Result |
| --- | --- | --- |
| VPG-01-T1 | `d3e1f661` | Eight-group owner map, separate passive operational fixture and meaningful unit/real-loopback boundary tests |
| VPG-01-T2 source | `9ffaf8a0` | Four 430×844 supplements, strict observed viewport/crop/PNG receipts, explicit harness fixture seam and refusal/counter tests |
| VPG-01-T2 evidence | `9ec9f781` | Complete real-browser 48-case matrix published through the existing staged recovery publisher from clean unchanged `9ffaf8a0` |

## Implemented boundaries

The existing founder fixture is byte-identical, with decision/renewal denials and
all prior case counter rules unchanged. The operational fixture is a separate
passive object injected into the local harness. It validates its exact HTTP
127.0.0.1 origin, Host and peer, method, route, closed payload and synthetic
tenant/request/option/version/digest/freshness context. Version/digest bind the
fixture input envelope and do not invent a backend fence. It has no credential,
fetch, real signature, persistence or queue owner. Duplicate confirmation and
refresh/reselection cannot clear the submit latch. A held local response exposes
request-sent before explicit synthetic settlement. All 48 source cases leave this
fixture idle with zero operational requests or owner writes.

Each current source case now binds actual CSS and visual viewport, device scale
and actual PNG dimensions/bytes/hash. Strict dialog crops reject missing,
obscured or offscreen targets before PNG output. Visible observed modal bounds
are aligned outward to the physical pixel grid; full-frame dimensions remain
exact. Existing named state visibility, hit-testing and native pointer/key/wheel
journeys remain required. The original 44 complete step digests are unchanged.

Exactly four full-frame supplements were added: gate-reviewed, gate-preflight,
gate-back and gate-close at 430×844. Existing 430×932 captures remain. No new
behavior equivalent or clipped matrix case was registered.

## Verification

- All 23 focused tests pass across capture, viewport contract, operational fixture
  and gap-boundary suites, with zero failures/skips. New tests include a real
  loopback pending-response request, duplicate/refusal and foreign-Host checks,
  viewport/crop/PNG tampering, idle fixture counters and exact 48-case census.
- `validateRetainedAssertions` passes all 47 original whole-step/image/manifest
  bindings. The same four gallery retirements and 43 required intents remain.
- Current proof reports `sourceProofOk=true`, 48 frames, 11 qualified and 32 held.
  Strict retained qualification therefore correctly remains exit 1.
- Bundle regeneration is byte-identical: 805549 bytes, SHA-256
  `2dc5ccc0826f8e85d1b0732e6f61f6b3e3723c347aa1e8a93c195cc887724195`.
  PAGE SHA-256 remains
  `40ca02967498382374320fcb45852621cee06f78ce65229da62ddd5cfa012741`.
- Fresh manifest SHA-256:
  `18b6196b9e4d56bba02ad627f664e66fd1695a9058bea6340df1d00d89fc754d`.
  It binds 21 source inputs. All 48 observed geometry receipts pass, with clean
  browser diagnostics. No operational action, decision or renewal was posted.
- The previous complete source set is retained in
  `artifact:field-atlas-current-pJwPlq/previous`; original 47-frame history is
  unchanged. Detailed local results are in
  `artifact:viewport-vpg01-20261104/implementation-receipt.json`.
- An ignored real-browser crop diagnostic exercised the same native Gate review
  journey at CSS/visual 390×844 and DPR 2. The painted dialog at (18,11),354×822
  produced a matching 708×1644 PNG with clean diagnostics. An offscreen full-review
  crop was rejected before writing a PNG. These diagnostics are outside the
  canonical matrix and qualify no gap; receipts are under
  `artifact:viewport-vpg01-20261104/crop-diagnostic`.

The independent code/image review and frozen final full suite are pending in the
parent continuation. No full-suite result is claimed by this executor.

## Deviations from plan

1. **[Rule 1 - Bug] Preserve duplicate protection across fixture reselection.**
   T2 boundary review found the initial synthetic fixture selection could reset
   its submit latch. The latch now survives refresh/reselection, while observation
   counters can reset. Regression coverage verifies a second accepted POST cannot
   occur. The existing browser server also rejects foreign Host/target requests
   before fixture selection. Both corrections are in `9ffaf8a0`.
2. **Execution adapter:** The existing isolated reader branch was retained and the
   immutable proposal was executed through the separate accepted-task receipt.
   Global phase initialization, automatic state/config updates and future-wave
   transition were intentionally omitted to preserve unrelated active Phase 9
   and the user's VPG-01-only admission. No new branch, fleet dispatch or external
   mapping was created.

## Remaining gates

Source fixtures and browser captures do not establish fresh authenticated owner,
physical-device, trusted-touch, native callback/installed Noesis, runtime or
release acceptance. The 32 behavior gaps remain required and held. Version 95
remains the planning baseline; deployment, traffic and real owner effects remain
held. Further packages require their own execution admission.

## Self-Check: PASSED

The implementation/evidence commits exist, all owned source and proof artifacts
exist, strict source audit passes and original history/founder fixture bytes are
preserved. This check concerns VPG-01 source delivery; independent final review
and owner acceptance remain separate.
