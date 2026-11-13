# Growth approval decision v1

Curious Gate stages and records a founder decision for one Growth review row.
The card follows the vault spec `20-operations/growth/department/approval-card-v1.md`.

## Stage and review

`GET /founder/growth` serves the protected review page. Paste the reviewed
intake JSON to stage a proposal, or open an existing proposal with the
`proposalId` query parameter. The four POST routes under
`/v1/founder/growth/` are `intake`, `proposal`, `status`, and `decision`.
They use the existing verified Access/Plexus identity and founder/tenant
bindings. Either bound co-founder may act alone; the receipt names the signer.

Intake binds the cell and calendar row to the exact body hash and records
references to the passed vocabulary fence, Analyst grade and queued review row.
Verify those references in the vault before staging. The Worker validates
their shape and consistency; it does not query the vault. The draft body stays
in its owning store.

D1 migration `0013_growth_approval_proposals.sql` adds a proposal table.
The Worker validates each proposal against its subject digest. A missing D1
record can fall back to the legacy KV reader. The Worker generates a nonce
and a 15-minute expiry. An exact retry returns the same proposal. Changed
evidence cannot overwrite the row, and an expired proposal cannot be signed.
A fresh review requires a new row identity.

## Founder decision

The review page reads canonical status before offering a decision. The founder
selects a decision and enters the exact displayed confirmation. The closed
envelope is `proposalId`, `version`, `changeDigest`, `nonce`, `expiresAt`,
`decision`, and `confirmation`. The ID is `TENANT:CHANGE_DIGEST`, where
`changeDigest` is the SHA-256 of the canonical row subject under
`thoughtseed.growth.approval-decision.v1`. The confirmation binds the full
review and uses the prefix `growth row` to distinguish it from Goal Graph.

Approve requires a passed fence, a graded draft and a queued row. Revise and
hold share the canonical `rejected` decision. Their distinction and reason
remain vault records. Opening, staging and checking a proposal do not decide it.
After a lost decision response, the page checks the ledger.

A signed decision writes one immutable receipt in `goal_graph_approvals`,
keyed by tenant, digest and nonce, with `canonical_json.kind = "growth-approval"`.
An exact replay returns that receipt and an opposite decision conflicts.
The Worker does not edit the draft, vault, Goal Graph or schedule. The vault
remains the cell and row status authority. Scheduling and publication require
separate workflows.

## Verify

`node --test workers/quests/src/growth-approval-decision.test.ts`

The tests use the existing Access host, real transport and in-memory SQLite D1.
They check persistence and deduplication, founder and tenant binding, immutable
evidence, expiry, decision preconditions, receipt replay and no downstream
effects.
