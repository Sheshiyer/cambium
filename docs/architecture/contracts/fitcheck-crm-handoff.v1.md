# Fitcheck CRM Handoff Contract v1

Status: historical redacted design input, ready for founder review; this PR did
not re-probe the provider and performed no CRM configuration, contact export,
lead-status change, reply, send, or provider mutation.

Observation receipt: [`2026-08-11-fitcheck-explee-inbox-readback.v1.json`](../../evidence/2026-08-11-fitcheck-explee-inbox-readback.v1.json)

## Observed input

The dated 2026-08-11 IST local read-only receipt records:

- 0 conversations in `need_reply` across Fitcheck's six campaigns.
- 5 hot-lead records scoped to three Fitcheck campaign cohorts.
- 5 additional account-wide hot-lead records excluded from Fitcheck scope.

This is queue state, not a qualification or intent claim. Raw contacts,
identifiers, and message bodies were discarded and are neither in this receipt
nor in Cortex.

## Design decision

Explee remains the system of record for a prospect and thread until a founder
approves a named CRM destination and a lawful/scoped import. Cambium holds only
a redacted operational case: campaign, aggregate signal class, evidence
reference, owner role, approval state, and required next action.

```text
Explee thread/contact (provider record, not copied)
        │ GET-only aggregate observation
        ▼
Fitcheck redacted case proposal (Cortex/quest support)
        │ founder approves exact CRM destination and scope
        ▼
D1-admitted task / approved CRM action
        │ terminal receipt, no raw contact in Cambium
        ▼
redacted foldback lesson and next proposal
```

## Minimum viable case shape

| Field | Rule |
| --- | --- |
| `caseId` | Runtime-local opaque identifier; never an email, name, phone, or provider thread body. |
| `workObjectId` | Exact `sapling:fitcheck`. |
| `source` | `explee`; provenance remains a provider-side record. |
| `campaignRef` | Repository-safe cohort label only; provider campaign identifiers remain outside Git. |
| `signalClass` | `need-reply`, `hot-lead`, `reply-observed`, `disqualified`, or `unknown`; it is not a sales qualification by itself. |
| `state` | `observed`, `needs-human-triage`, `approval-pending`, `approved-action`, `closed-with-receipt`, or `blocked`. |
| `ownerRole` | Role only until a CRM system and operator are explicitly approved. |
| `nextAction` | A bounded instruction without copied contact content. |
| `consentOrProvenance` | Required before export, reply, enrichment, or a CRM write; unknown fails closed. |
| `evidenceRef` | Redacted observation or terminal receipt reference. |

## State transitions

| From | To | Authority | Required proof |
| --- | --- | --- | --- |
| `observed` | `needs-human-triage` | read-only provider observation | redacted aggregate or approved runtime-local case record |
| `needs-human-triage` | `approval-pending` | human triager | explicit intended action and source/provenance review |
| `approval-pending` | `approved-action` | founder through existing approval path | scoped CRM/contact action approval |
| `approved-action` | `closed-with-receipt` | admitted task | immutable terminal receipt |
| any non-terminal | `blocked` | validation/policy | missing consent, owner, scope, or safe destination |

No automatic path exists from `hot-lead` to a send, reply, enriched record,
contact export, CRM write, or completed quest.

## Current action policy

The next safe action is founder review of this contract and selection of one
CRM destination/owner. It is intentionally not a request to reply to the five
hot leads: the queue contains no `need_reply` conversations, and the aggregate
hot-lead signal has no retained person-level context in Cambium.

Once approved, the first implementation task must add only the smallest
reversible capability: a read-only, redacted case projection or a founder
review sheet. Contact writes, status mutations, exports, enrichment, replies,
and sends require a separate approval and receipt per action scope.

## Cortex and Mini App projection

- Cortex stores a tenant-scoped, redacted lesson such as “hot-lead demand is
  concentrated in three campaign cohorts; human triage and CRM destination are
  pending.” It does not store a contact or thread.
- A future Mini App synchronization may render
  `fitcheck-campaign-reply-triage` and
  `fitcheck-crm-minimum-viable-flow` as `ready-for-review`; neither may be
  projected as complete without a later runtime change and receipt.
- Any future missing access or account decision becomes `external-wait`; missing
  consent or approval becomes `blocked`.

## Non-goals

- Choosing a CRM vendor or enabling an integration.
- Syncing historical Explee contacts.
- Altering Explee Autopilot or auto-reply settings.
- Sending a reply, changing a lead status, or creating outreach copy.
- Treating provider hot-lead status as an MQL, SQL, meeting, or revenue result.
