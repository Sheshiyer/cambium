---
task: "Govern Fitcheck Cortex learning and quest flow"
slug: 20260811-fitcheck-cortex-quest-contract
project: cambium
effort: E3
effort_source: context-override
phase: complete
progress: 15/15
mode: interactive
started: 2026-08-11T00:00:00+05:30
updated: 2026-08-11T05:05:00+05:30
---

## Problem

Fitcheck has product evidence and aggregate campaign data but no governed
boundary from external observations to redacted learning and visible quests.

## Vision

An operator can see every meaningful next action, why it exists, what proof it
needs, and whether a human or external system must act—without exposing a lead
inbox or allowing a recommendation to execute itself.

## Out of Scope

No Explee mutation, CRM activation, D1 write, R2 write, Telegram send, account
configuration, publish, or automatic outbound is part of this contract pass.

## Constraints

- D1 Goal Graph remains the operational writer.
- Cortex receives only redacted, tenant-scoped summaries through its existing seam.
- `sapling:fitcheck` stays under tenant `cambium`.
- Customer identifiers, message bodies, credentials, and raw provider payloads never enter the repository.

## Goal

Define an evidence-safe Cortex candidate schema and a visible growth quest map,
then inspect the current campaign inbox in aggregate before designing the CRM
handoff.

## Criteria

- [x] ISC-1: The Cortex candidate schema parses as JSON.
- [x] ISC-2: The schema fixes the canonical tenant identifier.
- [x] ISC-3: The schema fixes the canonical Fitcheck WorkObject identifier.
- [x] ISC-4: The schema makes every listed source read-only.
- [x] ISC-5: The schema rejects raw-payload retention by contract.
- [x] ISC-6: The schema rejects direct-identifier retention by contract.
- [x] ISC-7: The schema rejects message-body retention by contract.
- [x] ISC-8: The contract states that D1 remains the only operational writer.
- [x] ISC-9: The contract declares `external-wait` unfinished.
- [x] ISC-10: The contract declares `blocked` unfinished.
- [x] ISC-11: The growth backlog includes SEO quests.
- [x] ISC-12: The growth backlog includes content quests.
- [x] ISC-13: The growth backlog includes analytics quests.
- [x] ISC-14: The CRM design follows, rather than precedes, a read-only inbox inspection.
- [x] ISC-15: Anti: No provider credential or raw contact appears in created artifacts.

## Test Strategy

| isc | type | check | threshold | tool |
| --- | --- | --- | --- | --- |
| ISC-1 | schema | parse candidate schema | succeeds | jq |
| ISC-2 | identity | inspect tenant const | `cambium` | jq |
| ISC-3 | identity | inspect work object const | `sapling:fitcheck` | jq |
| ISC-4–7 | boundary | inspect source/redaction contract | fixed safe values | jq/rg |
| ISC-8–10 | policy | inspect lifecycle wording | explicit | rg |
| ISC-11–13 | coverage | inspect backlog domain rows | all present | rg |
| ISC-14 | sequencing | inspect CRM handoff language | inbox first | rg |
| ISC-15 | safety | scan created artifacts | no secret/PII patterns | rg |

## Features

| name | description | satisfies | depends_on | parallelizable |
| --- | --- | --- | --- | --- |
| Cortex contract | Schema and narrative boundary | ISC-1–10, ISC-15 | existing memory boundary | false |
| Growth backlog | SEO/content/analytics quest inventory | ISC-11–13 | Cortex contract | false |
| Inbox observation | aggregate-only Explee read | ISC-14 | Cortex contract | false |
| CRM handoff | post-observation policy | ISC-14–15 | inbox observation | false |

## Decisions

- 2026-08-11: refined: a candidate quest is not an operational task; D1 admission remains a separate, explicit authority transition.
- 2026-08-11: the account-wide hot-lead endpoint required campaign-ID scoping; five non-Fitcheck records were excluded rather than inferred into the branch.

## Changelog

- 2026-08-11: conjectured that a campaign baseline was sufficient for CRM design; refuted by the need to inspect current reply demand and account-wide endpoint scope; learned that aggregate `need_reply` and campaign-scoped hot-lead readback must precede the handoff; criterion now requires the redacted observation receipt before CRM flow review.

## Verification

- `jq empty` passed for the Cortex candidate schema and aggregate inbox readback receipt.
- Canonical receipt digest recomputation matched `sha256:09358d5a1fbdfe75331ac66c97c70fe54b180537d7270f9a33d314e8fb101a8b`.
- `npm run validate:product-branches` validated 6 packets after support-file registration.
- `node --test workers/quests/src/fitcheck-golden-path.test.ts` passed 2/2.
- Focused secret/PII/path scan produced no matches in created artifacts.
