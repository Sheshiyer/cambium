# Growth approval decision v1

Source-only draft for growth fan-out item B2. It wires the founder approval
card (vault spec `20-operations/growth/department/approval-card-v1.md`) to
Curious Gate as a signed founder action on one growth row. No deployment,
binding enrollment, live decision, Telegram rendering, vault write, or
business execution is authorized by this patch.

## Shape

The founder signs the existing closed seven-field decision envelope
(`proposalId`, `version`, `changeDigest`, `nonce`, `expiresAt`, `decision`,
`confirmation`). Only the subject differs:

- `proposalId` is `TENANT:CHANGE_DIGEST`, the Founder Gate form.
- `changeDigest` is `sha256:` of the growth row identity, computed by
  `growthApprovalChangeDigest({ cellPath, calendarRowId, bodyDigest })`
  under schema `thoughtseed.growth.approval-decision.v1`. The body never
  enters Cambium; only its digest does.
- `decision` keeps the Gate's two values. `approve` is `approved`. `revise`
  and `hold` both arrive as `rejected`; the revise/hold distinction and the
  dated reason are vault-side records written on the Mac in a later item.
- `confirmation` is recomputed from the complete displayed review with a
  `growth row` prefix, so a Goal Graph confirmation can never decide a growth
  row and vice versa.

The stored proposal (`thoughtseed.growth.approval-proposal.v1`) is server
owned, read from the Worker's existing KV under
`growth-approval-proposal:TENANT:DIGEST`, and validated against its key: the
digest must equal the digest of its subject, the `gate` must be exactly
`{fence, grade, rowStatus}`, and a `review.body` must be `{path, digest}` only.
Nothing in this patch creates such a proposal; the card builder (B1) and the
Mac-side vault reader own that.

## Routes

`POST /v1/founder/growth/proposal`, `/v1/founder/growth/decision` and
`/v1/founder/growth/status` sit beside the canonical founder routes inside
`founderDecisionHttp`. They use the same verified Access/Plexus identity, the
same `FOUNDER_GATE_BINDINGS_JSON` founder/tenant bindings, and the same D1
store. Either bound co-founder may act alone; the receipt names the signer.
A host without a growth proposal reader answers 503
`growth_approval_unconfigured`.

The proposal read returns `actions: {approve, revise, hold}`. `approve` is
computed, never asserted: `fence == pass`, `grade == graded`, `rowStatus ==
queued`. When it is false the response carries `approveConfirmation: null`
and a submitted `approved` envelope returns 409 `approve_unavailable` before
any write.

## What a signed approve writes

Exactly one row in the existing `goal_graph_approvals` table through
`recordGrowthDecision`, keyed `approval:TENANT:DIGEST:NONCE`, with
`canonical_json.kind = "growth-approval"` and the subject. No migration. The
write never touches `goal_graph_heads`, `goal_graph_nodes`,
`goal_graph_events`, a renewal root, KV, the vault, Composio, NotebookLM,
Higgsfield, Genesis DNA, or any network. The same immutable primary key makes
a replay return the original receipt and makes an opposite decision a
conflict. A Goal Graph receipt under the same key reads as `conflict`.

Cambium's `thoughtseed.growth.result.v1` record is unchanged: its
`approvalState` stays `draft` and `externalAction` stays `none`. The vault is
the status authority for the cell and calendar row; this receipt is what the
Mac-side writer reads before it sets `approved`/`held`.

## Local verification

`node --test workers/quests/src/growth-approval-decision.test.ts`

The tests use the actual `createFounderAccessHost` bindings, the real
transport, and an in-memory SQLite D1 with migrations 0007 and 0009. They
prove: one receipt row and zero rows elsewhere on approve, with Goal Graph
commit/reject, task reads, KV writes and `fetch` all counted at zero; replay
and cross-founder status equality; revise/hold then approve conflict; fence
fail, revise grade and non-queued row refusing approve; unsigned, unbound,
cross-tenant, drifted tuple, wrong confirmation and extra-claim denial with
zero writes; expiry; missing host; and lost-response reconciliation.

## Deliberately out of scope

Telegram card rendering, the vault status write, proposal creation, a
three-valued decision, a new table, and any OAuth or identity authority.
