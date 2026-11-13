---
phase: viewport-behavior-gaps-v1
plan: VPG-01
verified: 2026-11-04T11:20:46Z
status: passed
scope: local-source-foundation-only
score: 3/3 must-haves verified
overrides_applied: 0
gaps: []
human_verification: []
---

# VPG-01 independent source verification

The accepted scope is VPG-01 only: owner bindings, a closed operational fixture,
strict observed viewport/crop evidence and a fresh 48-case source foundation.
This report does not complete the ten-package phase, qualify any of the 32 gaps,
admit VPG-02 onward, or accept live owners, devices, deployment or traffic.
Version 95 remains the planning baseline.

Reviewed head: `366d7617`. Source cut: `9ffaf8a0`; fresh evidence:
`9ec9f781`; T1: `d3e1f661`. Source comparison starts at acceptance commit
`7460d730`. The immutable accepted packet digest remains
`bcde1f5d4ed3b5285bd62e4a0ce4991dfb2e6b28bde508665559a09c84fa6c21`.

## Observable truths

| Truth | Status | Independent evidence |
| --- | --- | --- |
| All 43 retained definitions and 47 historical image/manifest bindings retain their exact identities and predicates. | VERIFIED | Existing validateRetainedAssertions ran successfully in my own process against actual history bytes. Original contract and founder fixture are byte-identical to acceptance. A separate whole-step digest comparison matches all 44 prior complete current steps; the 11 equivalent definitions are byte-identical. |
| Four 430×844 supplements preserve the original protected height while retaining 430×932 evidence. | VERIFIED | The exact four named supplements are present in the 48-case matrix and individually viewed. Eight prior 430×932 cases remain. No current case or equivalent was removed. |
| A crop or synthetic action cannot weaken the required viewport, owner or no-effect checks. | VERIFIED | Actual source and wiring enforce closed loopback input/identity/freshness/method/refusal, persistent submit dedupe, idle operational receipts for all 48 cases, exact DPR 2 full-frame dimensions and derived clip/PNG binding. The 23 focused tests passed independently, including real loopback HTTP and adversarial geometry/counter cases. Actual crop PNG/receipt and offscreen rejection were inspected. |

No blocker or warning finding remains in this selected source scope. No override
was applied. The existing live/device/owner acceptance holds are outside this
source goal and remain held; no new source-scope human gate was introduced.

## Artifact and wiring verification

| Artifact | Substance and wiring | Result |
| --- | --- | --- |
| docs/visual/viewport-owner-bindings.md | Eight later groups name existing owner files/envelope schemas, auth channels and unavailable-state behavior. Goal-only Access and Telegram non-goal authority remain distinct; current missing 3D adapters are explicitly later-package work. | VERIFIED |
| scripts/field-atlas-operational-fixture.mjs | Passive synthetic object has no outbound request, credential, persistence or real queue owner. Exact HTTP 127.0.0.1 origin, Host and peer, route/method/content type, closed body, tenant/request/option/idempotency and fixture-only version/digest/freshness are checked before transition. The submit latch survives reselection; settlement is explicit. | VERIFIED |
| scripts/field-atlas-viewport-gaps.test.mjs | Real loopback requests exercise held response, wrong option, duplicate confirmation and explicit server injection; foreign Host is refused before selection. | VERIFIED |
| workers/quests/src/visual-viewport-proof.mjs | withServer binds the optional fixture and invokes it before generic Gate fallback. Normal harness use cannot select it without injection. captureViewportProof collects actual geometry after the existing assertion, validates observed viewport and PNG dimensions, then writes PNG bytes. Existing historical steps are unchanged. | VERIFIED |
| scripts/capture-field-atlas.mjs | Imports and uses the fixture, retains all old steps and checks, adds exactly four height supplements, records actual geometry/idle fixture receipts and binds 21 source inputs. validateFieldAtlasGeometry is called for every current frame; full-frame rules remain exact. | VERIFIED |
| Actual current manifest and 48 PNGs | Complete source-bound native journeys, clean diagnostics and actual image bytes/geometry validated in my own process and all images individually viewed. The existing staged publisher retains the earlier set. | VERIFIED |

This package changes capture tooling rather than app rendering. PAGE and app
presentation are unchanged. Its source fixtures are intentionally synthetic;
they are not hollow substitutes for live data or operational acceptance.
The unchanged founder read fixture still denies decision and renewal writes.

## Independent checks performed

- Ran `node --test scripts/field-atlas-operational-fixture.test.mjs scripts/field-atlas-viewport-gaps.test.mjs scripts/capture-field-atlas.test.mjs scripts/field-atlas-viewport-contract.test.mjs` in my own process: **23 passed, 0 failed, 0 cancelled, 0 skipped**, approximately 3.3 seconds.
- Ran a separate read-only Node probe against the actual manifest, PNGs and Git baseline: 48 current frames; all 48 geometry/PNG bindings valid; 44 complete prior step hashes preserved; 47 historical bindings valid; 43 retained intents; equivalent definitions, original contract and founder fixture byte-identical; four 430×844 supplements and eight prior 430×932 cases present.
- The focused contract tests independently derive current qualification as **11 qualified and 32 held**, with `sourceProofOk=true`. Their release test confirms strict retained qualification still blocks release.
- Inspected the real ignored crop PNG and receipt: CSS/visual 390×844, DPR 2, observed dialog at (18,11) with size 354×822, actual PNG 708×1644 and matching bytes/hash. Ran that actual receipt/PNG through validateFieldAtlasGeometry independently.
- Inspected the negative receipt: offscreen full-review crop raises the strict out-of-viewport error and records no PNG output. This diagnostic is outside the canonical matrix and qualifies no gap.
- Scanned changed source and owner documentation for unresolved debt markers; no untracked TBD/FIXME/XXX or stub path was found.
- The census unit test checks path/state/viewport only; it is not treated as complete predicate preservation. The separate whole-step digest probe supplies that check. Unit PNG stubs are not treated as browser proof; the actual 48 PNGs and their source-bound receipts supply it.

Current manifest SHA-256:
`18b6196b9e4d56bba02ad627f664e66fd1695a9058bea6340df1d00d89fc754d`.

The parent separately owns the frozen full-suite and broader audit receipts.
Those checks were not substituted for this source/image review or rerun here.

## Individual image review

Every canonical image below was opened individually from disk. Static image
review supports visible layout and state; native-input and focus behavior are
supported by the bound capture predicates and journeys, not inferred from pixels.
Scroll containers may show only part of their long content; required held/empty/
back messages and preflight controls are visibly within the terminal frame.

| # | Image | Result | Observation |
| --- | --- | --- | --- |
| 1 | `field-atlas-entry-320.png` | PASS | Header actions and status separated; intro and entry control visible. |
| 2 | `field-atlas-entry-390.png` | PASS | Header actions and status separated; intro and entry control visible. |
| 3 | `field-atlas-entry-430.png` | PASS | Header actions and status separated; intro and entry control visible. |
| 4 | `field-atlas-entry-600.png` | PASS | Header actions and status separated; intro and entry control visible. |
| 5 | `field-atlas-entry-601.png` | PASS | Header actions and status separated; intro and entry control visible. |
| 6 | `field-atlas-entry-1280.png` | PASS | Header actions and status separated; intro and entry control visible. |
| 7 | `field-atlas-world-320.png` | PASS | World/source label and local exploration state visible. |
| 8 | `field-atlas-world-390.png` | PASS | World/source label and local exploration state visible. |
| 9 | `field-atlas-world-430.png` | PASS | World/source label and local exploration state visible. |
| 10 | `field-atlas-world-1280.png` | PASS | World/source label and local exploration state visible. |
| 11 | `field-atlas-chart-320.png` | PASS | Chart and close visible; local visits explicitly distinct from real work; contained scrolling. |
| 12 | `field-atlas-chart-390.png` | PASS | Chart and close visible; local visits explicitly distinct from real work; contained scrolling. |
| 13 | `field-atlas-chart-430.png` | PASS | Chart and close visible; local visits explicitly distinct from real work; contained scrolling. |
| 14 | `field-atlas-chart-1280.png` | PASS | Chart and close visible; local visits explicitly distinct from real work; contained scrolling. |
| 15 | `field-atlas-departments-320.png` | PASS | Departments unavailable state, refresh and close visible; no header collision. |
| 16 | `field-atlas-departments-390.png` | PASS | Departments unavailable state, refresh and close visible; no header collision. |
| 17 | `field-atlas-departments-430.png` | PASS | Departments unavailable state, refresh and close visible; no header collision. |
| 18 | `field-atlas-departments-1280.png` | PASS | Departments unavailable state, refresh and close visible; no header collision. |
| 19 | `field-atlas-courier-320.png` | PASS | Cosmetic companion cards visible; no work or actor progress asserted. |
| 20 | `field-atlas-courier-390.png` | PASS | Cosmetic companion cards visible; no work or actor progress asserted. |
| 21 | `field-atlas-directory-320.png` | PASS | Named source directory contained; close visible. |
| 22 | `field-atlas-directory-390.png` | PASS | Named source directory contained; close visible. |
| 23 | `field-atlas-gate-held-320.png` | PASS | Complete held Gate message visible; signing unavailable. |
| 24 | `field-atlas-gate-held-390.png` | PASS | Complete held Gate message visible; signing unavailable. |
| 25 | `field-atlas-source-folio-320.png` | PASS | Cortex source dossier contained; close visible. |
| 26 | `field-atlas-source-folio-390.png` | PASS | Cortex source dossier contained; close visible. |
| 27 | `field-atlas-local-visit-320.png` | PASS | Local visit count/stamp visible with explicit no-real-work text. |
| 28 | `field-atlas-local-visit-390.png` | PASS | Local visit count/stamp visible with explicit no-real-work text. |
| 29 | `field-atlas-local-visit-read-320.png` | PASS | Local visit count/stamp visible with explicit no-real-work text. |
| 30 | `field-atlas-local-visit-read-390.png` | PASS | Local visit count/stamp visible with explicit no-real-work text. |
| 31 | `field-atlas-gate-empty-320.png` | PASS | Zero-proposal and empty-queue text fully visible. |
| 32 | `field-atlas-gate-empty-390.png` | PASS | Zero-proposal and empty-queue text fully visible. |
| 33 | `field-atlas-gate-reviewed-320.png` | PASS | Expanded exact review JSON wraps; synthetic consequence/reversal and close visible. |
| 34 | `field-atlas-gate-reviewed-390.png` | PASS | Expanded exact review JSON wraps; synthetic consequence/reversal and close visible. |
| 35 | `field-atlas-gate-reviewed-430.png` | PASS | Expanded exact review JSON wraps; synthetic consequence/reversal and close visible. |
| 36 | `field-atlas-gate-preflight-320.png` | PASS | Exact-digest preflight with separate visible confirm and cancel. |
| 37 | `field-atlas-gate-preflight-390.png` | PASS | Exact-digest preflight with separate visible confirm and cancel. |
| 38 | `field-atlas-gate-preflight-430.png` | PASS | Exact-digest preflight with separate visible confirm and cancel. |
| 39 | `field-atlas-gate-back-320.png` | PASS | Back returns to the complete visible Fitcheck proposal row. |
| 40 | `field-atlas-gate-back-390.png` | PASS | Back returns to the complete visible Fitcheck proposal row. |
| 41 | `field-atlas-gate-back-430.png` | PASS | Back returns to the complete visible Fitcheck proposal row. |
| 42 | `field-atlas-gate-close-320.png` | PASS | Dialog closed; world and source label restored; captured focus predicate passes. |
| 43 | `field-atlas-gate-close-390.png` | PASS | Dialog closed; world and source label restored; captured focus predicate passes. |
| 44 | `field-atlas-gate-close-430.png` | PASS | Dialog closed; world and source label restored; captured focus predicate passes. |
| 45 | `field-atlas-gate-reviewed-430x844.png` | PASS | Original-height review is contained; expanded JSON and synthetic consequence/reversal visible. |
| 46 | `field-atlas-gate-preflight-430x844.png` | PASS | Original-height preflight keeps full confirm/cancel controls visible. |
| 47 | `field-atlas-gate-back-430x844.png` | PASS | Original-height back frame contains the full Fitcheck proposal row. |
| 48 | `field-atlas-gate-close-430x844.png` | PASS | Original-height close restores world/source label; captured focus predicate passes. |

The ignored cropped dialog image was also individually viewed and matches the
receipt dimensions. No blank, obscured or offscreen terminal named-state image
was accepted by this review. No new behavior or live progress is inferred.

## Held boundaries

VPG-02 through VPG-10 remain unadmitted. The 32 gaps remain required. Version 95
remains the planning baseline. Deployment, traffic, real signatures, queueing,
graph/provider/native-store effects, fresh authenticated owners, physical-device,
trusted-touch and native callback acceptance remain held.
