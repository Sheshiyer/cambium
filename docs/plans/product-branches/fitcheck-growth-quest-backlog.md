# Fitcheck Growth Quest Backlog

Status: proposed planning inventory — no account configuration, publishing,
outreach, spend, or provider mutation authorized by this file.

Contract: [`fitcheck-cortex-quest-flow.v1`](../../architecture/contracts/fitcheck-cortex-quest-flow.v1.md)

Owning repository task: [`Sheshiyer/fitcheck-landing#2`](https://github.com/Sheshiyer/fitcheck-landing/issues/2). Cambium retains cross-portfolio sequencing; the owning repository now holds implementation and local proof.

The backlog turns known growth gaps into visible, proof-bound quests. It is not
a claim roadmap: all commercial claims remain constrained by the Fitcheck
branch packet and source-backed evidence.

| Quest ID | Domain | Current state | Smallest next action | Exit proof | External effect / gate |
| --- | --- | --- | --- | --- | --- |
| `fitcheck-search-measurement-foundation` | analytics | `external-wait` | Name the Search Console and GA4 owners; document consent and conversion events before any tag change. | Access/readback plus approved measurement plan. | account configuration; founder + account owner |
| `fitcheck-technical-search-baseline` | seo | `proposed` | Record a public crawl of canonical URLs, sitemap, robots, titles, and schema as a dated baseline. | Source-linked baseline receipt; no code change required. | read-only |
| `fitcheck-icp-query-evidence-map` | seo | `proposed` | Research merchant-intent queries, comparison language, and source-backed questions by ICP. | Redacted source ledger with confidence labels. | read-only; research review |
| `fitcheck-answer-library` | content | `blocked` | Build a claim-safe FAQ/answer outline only from product and policy evidence. | Founder-reviewed source map and answer brief. | publish; founder approval required before use |
| `fitcheck-editorial-pilot` | content | `blocked` | Select one evidence-backed merchant education topic and prepare a channel-native draft. | Approved draft, source links, destination, and publish receipt. | publish; founder approval |
| `fitcheck-link-relationship-research` | seo | `proposed` | Identify relevant editorial/partner relationships with public rationale; exclude purchased or automated links. | Reviewed prospect rationale and no-contact receipt. | contact; founder approval before outreach |
| `fitcheck-attribution-readback` | analytics | `external-wait` | After instrumentation is approved, read aggregate acquisition, query, CTA, and qualified-demo data on a defined cadence. | Dated aggregate receipt with caveats and next proposal. | read-only after account access |
| `fitcheck-campaign-reply-triage` | crm | `ready-for-review` | Review the dated aggregate reply/hot-lead receipt; do not alter a lead. | Human review note that preserves the receipt's historical boundary. | read-only |
| `fitcheck-crm-minimum-viable-flow` | crm | `ready-for-review` | Review the minimum viable CRM handoff; select one destination/owner before any implementation. | Founder-reviewed CRM contract and privacy boundary. | account configuration/contact; founder approval |
| `fitcheck-campaign-learning-foldback` | cortex | `proposed` | Fold verified aggregate outcomes into a redacted learning receipt and propose one next experiment. | Receipt references, caveats, and one bounded successor quest. | none/read-only |

## Sequencing

1. `fitcheck-campaign-reply-triage` is read-only and precedes the CRM flow.
2. Measurement ownership and consent precede any analytics implementation.
3. Technical baseline and research can proceed without publishing.
4. Content and relationship work remain visible but blocked until sources and
   approval are present.
5. Every completed quest returns a receipt-derived Cortex proposal; no backlog
   row may self-promote to `active`.

## Mini App projection rule

If a separately reviewed Fitcheck synchronization pass runs, each row above is projected as a
quest with its current state, owner/gate, required proof, and next action.
Only `complete` and `superseded` are terminal. `external-wait`, `blocked`,
`proposed`, and `ready-for-review` remain in the unfinished queue.
