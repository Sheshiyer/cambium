# One concrete work lineage: Fitcheck

Discovery observation, 2 November 2026. This is a read-only reconstruction from
committed source and dated evidence. No current production database, credentials,
merchant account or runner was queried. It is not an instruction to retry any
recorded action.

## Why this example

Fitcheck has a real product purpose, a separately owned backend, a reviewed
packet and a dated founder decision. Separate UI inspection records test
the whole-system → dossier → decision → execution distinction more thoroughly
than a wholly synthetic success path. It is selected as the first **historical
reference lineage**; current live eligibility remains a later readback dependency.

## Meaning and identity

The packet names `sapling:fitcheck`: a supervised virtual try-on launch service
for Shopify fashion brands. Its useful finite outcome is a qualified merchant
demo/reservation and, beyond that, a pilot with real widget evidence. The product
uses `program:hdilint` as its separately owned backend capability. Those identities
must remain distinct in the Canopy and dossier.

Source: [Fitcheck packet](../../../../docs/plans/product-branches/fitcheck.md).
The packet describes marketing and organ roles but contains historical wording,
including Snow Gloves as a Will execution source. The newer topology and current
project rails preserve Snow Gloves as an independent peer product; the Mac plan
must not turn this packet row into an execution dependency.

## Verified dated Fitcheck decision-to-graph path

| Step | Evidence inspected | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Product identity and topology | Fitcheck packet; golden-path contract | Explicit WorkObject and backend relationship in source | Current deployment, merchant or tenant admission |
| Founder decision, 25 October | `cambium.founder-gate.desktop-e2e.v1` receipt | One reviewed approval, canonical readback, exactly one decision POST | A general grant to launch all Fitcheck work |
| Graph result | Same evidence: one matching decision, one matching graph event, one renewal-family outcome, graph version 3 | Recorded graph change for one blocked tracking goal | Terminal execution, accepted artifact or completed merchant pilot |

## Separate UI examples, without an asserted lineage join

The Expedition evidence records an expired proposal inspection with only Graph
shown and no new decision/renewal. It does not supply an exact proposal identity
that joins it to the Fitcheck decision above.

The Gate chamber evidence records a different receipt/change digest from the
Fitcheck founder receipt. It demonstrates historical receipt reopening, requested
decision null, and independent decision/graph/connection presentation. It cannot
extend the specific Fitcheck decision-to-graph chain.

These observations are separate subjects. Their exact correlation is missing;
no common task, receipt or continuous execution lineage is asserted.

The chamber record explicitly reports `executionEvidenceObserved:false`.
Its read-only inspection left approval/event counts unchanged. Branch, phase and
organ context were “Not served”; the interface must preserve those gaps rather
than infer them from the portrait or loadout name.

Sources:

- [Founder desktop evidence](../../../../docs/evidence/2026-10-25-founder-gate-desktop-e2e.v1.json)
- [Expedition runtime evidence](../../../../docs/evidence/2026-10-25-expedition-dossier-live.v1.json)
- [Chamber runtime evidence](../../../../docs/evidence/2026-10-25-gate-chamber-live.v1.json)
- [Golden path](../../../../docs/architecture/fitcheck-golden-path.md)

These records describe bounded historical observations. They do not provide
current traffic, account, graph-head or runner status. No full private proposal,
founder identity, session material or customer payload is copied into this review.

## Native experience implied by the path

1. Canopy shows Fitcheck as an identified product, related to its distinct backend.
2. The dossier explains purpose, desired outcome, current evidence and named gaps.
3. A historical decision can be inspected without presenting a new requested action.
4. Decision and graph stages can be evidenced while execution remains unknown.
5. A current launch command appears only after fresh owner readback confirms an
   admitted task, exact loadout, permitted execution plant and live capability.
6. If a launch outcome is uncertain, retain its original identity and query the
   owner; never mint a new attempt merely because the connection failed.

This fits the founder-selected first release: coordinate decisions and launch
already-admitted work. The Fitcheck chain and separate UI examples motivate
independent decision, eligibility, connection, execution and semantic acceptance
models without combining unmatched records into one proven path.

## Current source route, before the native adapter

`GET /v1/mission-fabric/{tenant}` composes an authenticated projection. Current
handler source reads D1 head/nodes, stored quest facts and mapping receipts,
reconciles task identities, discovers/read-verifies foldback, redacts for the
reader, and serves freshness plus portfolio sidecars. The tenant allowlist is
server-owned and defaults disabled. Access/Plexus and Telegram have distinct
credential paths.

The older reusable read client validates schema/version, tenant, collection caps
and a recomputed graph digest. It returns typed gaps for refusal or unavailable
reads. It does not expose the complete portfolio/freshness envelope needed by a
native whole-system client. It is a reference for semantics, not a complete native
DTO or a substitute for strict node/edge/time decoding.

A matching digest demonstrates content self-consistency. It does not independently
prove the source's authenticity, freshness, principal scope or semantic acceptance.
Those must come from the authenticated owner and the relevant receipt.

Source anchors: [handler](../../../../workers/quests/src/handler.ts),
[read client](../../../../workers/quests/src/mission-fabric-read-client.ts),
[projection contract](../../../../docs/architecture/contracts/mission-fabric-v1.md),
[owner bindings](../../../../workers/quests/src/wave0-owner-bindings.ts).

## Fresh local contract verification

The following existing suites ran together with exit 0 and 49 passing checks:

```sh
node --test --test-reporter=dot \
  workers/quests/src/founder-decision.test.ts \
  workers/quests/src/mission-fabric-read-client.test.ts \
  workers/quests/src/wave0-owner-bindings.test.ts \
  bin/operator/onboarding/field-observation.test.ts
```

They exercise local decision semantics, read integrity/gaps, conditional owner
composition and proposal-only Field Report input. They do not exercise a Swift
client, native login, native launch, live cloud binding or the complete app.

## Required first real integration acceptance

During implementation, choose one currently authorized admitted work unit and
obtain current owner readback. Verify exact identity/tenant/revision/loadout,
perform a separately scoped non-destructive launch acceptance if authorized,
observe the owner run/terminal record, and display independent acceptance only
when its actual evidence exists. A fixture and these dated receipts remain useful
failure cases, but cannot satisfy that live native-release gate.
