# Fitcheck Cortex → Quest Contract v1

Status: local planning contract; no provider, D1, R2, CRM, or Telegram mutation

Schema: [`cambium.fitcheck-cortex-quest.v1`](./fitcheck-cortex-quest.schema.json)

## Purpose

Fitcheck needs a learning loop that converts evidence into an honest next action
without importing a customer inbox into Cambium, turning campaign telemetry into
a claim, or letting a recommendation execute itself. This contract defines that
boundary for `sapling:fitcheck` under tenant `cambium`.

```text
read-only source → redacted observation → candidate quest → founder review
                                                       ↓
                       immutable receipt ← terminal execution ← approved task
                                                       ↓
                                   redacted foldback → Cortex lesson → next proposal
```

The contract is additive. The D1 Goal Graph remains the only writer for an
admitted task, approval, status transition, run, or terminal receipt. Cortex is
memory and recommendation support, not a second workflow engine.

## Sources and admission boundary

| Source | May supply | Never retained in Cortex/repository | Admission rule |
| --- | --- | --- | --- |
| Explee campaign analytics | aggregate sends, replies, hot-lead counts, spend, campaign state | raw API response, contacts, email addresses, message bodies | GET-only observation becomes an aggregate candidate |
| Explee `need_reply` inbox | count, campaign, coarse intent class, response-age band | names, email/mobile, LinkedIn URL, thread body, attachments | human review first; no reply is drafted or sent by Cortex |
| Explee hot-lead view | aggregate count by campaign and status | lead identities and engagement transcript | human review first; no status is changed |
| Search Console / GA4 | aggregated discovery and conversion measurements | visitor identifiers, raw query exports, session payloads | account access and consent proof must exist |
| Site crawl / research | public URL, technical finding, source link | credentials, private crawl headers, unpublished client data | source and timestamp required |
| Merchant proof receipt | verified product or pilot outcome | customer media, personal data, raw support conversation | only after an approved, immutable receipt exists |

An observation must use the schema's `redaction` object. All four values are
fixed: no raw payload, identifiers, or message bodies; only a safe summary.
Real Cortex records stay in ignored runtime storage and use the existing
`CortexStore`/`makeCortex` seam. This repository may hold contracts, synthetic
fixtures, and redacted receipts only.

## Quest state contract

| State | Meaning in the Mini App | May mutate an external system? | Exit proof |
| --- | --- | --- | --- |
| `proposed` | Evidence suggests a bounded next action | no | founder selects or rejects a scoped action |
| `external-wait` | Someone outside Cambium must act or grant access | no | dated external confirmation or readback |
| `ready-for-review` | Enough evidence exists for a founder decision | no | decision/review receipt |
| `approved` | Exact scope has founder authorization | only through a separately admitted task | D1 approval plus scoped action request |
| `active` | A governed task is executing | only inside that task's authority | terminal receipt |
| `blocked` | Missing evidence, access, dependency, or safe scope | no | blocker-specific evidence |
| `complete` | Required proof validates the stated scope | no further action | immutable execution/foldback receipt |
| `superseded` | Replaced by a linked candidate | no | successor ID and rationale |

`external-wait` and `blocked` are unfinished states. The Telegram Mini App must
render them as active quest rows, not as completed work or hidden backlog.

## Candidate lifecycle and controls

1. A GET-only observer or approved public-source check produces an observation.
2. The normalizer removes direct identifiers and writes a local observation
   receipt or an R2 receipt only after separately approved storage authority.
3. Cortex may summarize the observation for the same tenant and propose one
   smallest reversible quest.
4. The proposal appears as `proposed`, `external-wait`, `ready-for-review`, or
   `blocked`. It is not operational work yet.
5. A founder may approve an exact task through the existing signed-action and
   D1 admission flow. Approval never covers future sends, purchases, publishes,
   tracking changes, or contact changes by implication.
6. A terminal receipt may fold a redacted lesson back into Cortex and create a
   new proposal. It cannot mark the preceding quest complete by prose alone.

## Cross-organ responsibility

| Organ | Owns | Does not own |
| --- | --- | --- |
| Genesis | product truth, ICP, claim boundary | performance claims inferred from telemetry |
| Taste | quality of public presentation and content | publication authority |
| Hands | approved technical SEO/instrumentation changes | account access or campaign sends |
| Will | approved content/outreach/pilot operations | auto-sending or lead-status mutation |
| Cortex | redacted learning, next-intent proposals, drift detection | CRM, D1, provider, or Telegram writes |

## CRM handoff boundary

The CRM flow is designed only after the live `need_reply` and hot-lead views
are inspected in aggregate. Its input is a redacted `reply-demand` or
`hot-lead` observation; its output is an approval-bound CRM quest. It must not
copy Explee contacts or message content into the quest ledger or Cortex.

## Invariants

- Fitcheck identity is exactly `sapling:fitcheck`; aliases never select a tenant.
- Every candidate has one source, one receipt reference, one quest state, and
  an explicit external-effect classification.
- A `contact`, `publish`, `spend`, or `account-configuration` effect requires
  explicit approval before activation.
- Aggregates can inform a hypothesis, but they never prove conversion lift,
  reduced returns, or product speed.
- A missing source, absent receipt, cross-tenant input, raw customer data, or
  unscoped approval fails closed to `blocked`.

## Verification

- Parse the JSON schema with `jq empty`.
- Ensure the schema fixes `tenantId` to `cambium` and `workObjectId` to
  `sapling:fitcheck`.
- Confirm all source kinds are explicitly read-only and the redaction flags are
  fixed to safe values.
- Confirm Mini App contract rows describe `external-wait` and `blocked` as
  unfinished.
