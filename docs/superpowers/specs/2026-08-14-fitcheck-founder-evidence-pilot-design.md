# Fitcheck Founder Evidence Pilot Design

## Purpose

Give the authenticated founder one bounded action space for the exact Fitcheck
quest `fitcheck-shopify-widget-qa`: submit a screenshot receipt reference and a
widget-event receipt reference, review the server-derived consequence in Gate,
and read the resulting quest and Goal Graph state after approval.

This is a candidate-only implementation. It does not upload or promote a
Worker, write production D1/KV/R2, send Telegram messages, enable Hermes, or
alter `MISSION_FABRIC_TENANTS`.

## Authority model

- Telegram `initData` and the existing `GATE_FOUNDER_IDS` validator authenticate
  the founder. Browser or Cloudflare Access identity alone is insufficient.
- The browser submits evidence references and an observed outcome. It cannot
  choose a Goal Graph head, node identity, parent, loadout, status transition,
  approval descriptor, transport route, or execution result.
- The Worker validates one closed `cambium.founder-outcome-intent.v1` envelope,
  derives the exact Goal Graph proposal, pins it to the current D1 head, and
  stores it as the existing pending Goal Graph intake task in KV.
- Gate continues to be the sole approval UI. Its existing
  `approve-goal-graph` path commits the stored change set through D1 CAS.
- D1 remains the sole goal/status authority. Mission renders a founder-only,
  bounded readback projection; it never rewrites the branch packet or quest
  ledger.
- Hermes remains the sole execution and Telegram transport authority. Founder
  evidence cannot manufacture `executed`, `failed`, foldback, ACK, or delivery.

## Exact pilot identity

| Field | Value |
|---|---|
| tenant | `cambium` |
| WorkObject | `sapling:fitcheck` |
| branch | `fitcheck` |
| mission | `fitcheck-shopify-qa` |
| quest | `fitcheck-shopify-widget-qa` |
| loadout | `loadout:fitcheck-launch` |
| required references | screenshot receipt and widget-event receipt |

The server must find an existing D1 node anchored to
`sapling:fitcheck`. Absence or ambiguity is a bounded conflict with zero write;
the browser cannot supply a replacement parent node.

## Input contract

The route is `POST /api/founder-outcomes/cambium`. The JSON body contains:

- `schema: cambium.founder-outcome-intent.v1`
- the five exact pilot identity fields above
- `outcome`: `passed`, `failed`, `blocked`, or `needs-review`
- `screenshotRef`: a bounded query-free HTTPS or opaque receipt reference
- `widgetEventRef`: a bounded query-free HTTPS or opaque receipt reference
- `note`: optional bounded founder note
- `clientRequestId`: bounded replay identity
- `initData`: runtime Telegram authentication material, consumed only by the
  validator and excluded from canonical payloads, KV, D1, logs, responses, and
  markup

References reject credentials, bearer material, raw Telegram data, every URL
query component, data URLs, JavaScript URLs, local file paths, absolute checkout
paths, obvious identifying material, and raw event payloads. This surface records
pointers, not binary screenshots or logs. The UI explains the accepted reference
grammar. The candidate stores
a canonical digest of each submitted reference string so Gate approval binds
the exact reviewed pointers; this is chain-of-custody, not independent proof
that a mutable remote artifact remained unchanged.

## Derived transition

The Worker derives one deterministic proof-scoped Goal Graph node under the
existing Fitcheck anchor. Before Gate approval, D1 remains unchanged and the
KV task contains a `review_pending` evidence-candidate projection. Gate shows
the exact outcome, both references, consequence, reversibility, pinned head,
nonce, expiry, and fence.

On approval:

- `passed` proposes an active evidence node with `proofRequired: false`;
- `failed` or `blocked` proposes a blocked node with `proofRequired: true`;
- `needs-review` proposes a paused node with `proofRequired: true`.

No outcome proposes `retired`, terminal execution, autonomy promotion, or a
Hermes receipt. A committed revision is immutable and can only be superseded by
a later separately approved proposal.

## Founder experience

The selected Fitcheck Mission card exposes `Add proof` and `Report outcome`.
Both open the same bottom sheet with the two required references, observed
outcome, optional note, and a claim guard. A successful submission shows a
bounded candidate receipt and moves focus to Gate. Gate approval refreshes both
the queue and quest envelope. Mission then projects the D1-backed outcome onto
the exact quest row and exposes the head digest/version in founder-only Inspect
readback.

When a candidate is pending, Mission says `Pending Gate`; it never implies the
quest changed. Authentication, validation, authority, stale-head, and network
failures render distinct no-write messages. Safe input values survive local
validation failures and focus moves to the first invalid field. A browser
reload reconstructs pending state from the founder-scoped server envelope.
Every Mission and Gate quest-envelope refresh carries the runtime Telegram
authentication header; an unauthenticated browser receives no founder outcome
projection.
Expired proposals leave the actionable Gate queue and provide an explicit
refresh-and-resubmit path.

## Safety and verification

- Pure parser tests cover accepted envelopes, every identity mismatch, unknown
  keys, bounds, unsafe references, and secret/raw-payload rejection.
- Handler tests prove missing/non-founder/expired auth refusal, missing or
  ambiguous Fitcheck anchors, replay/conflict semantics, pending candidate
  storage, zero D1 writes before approval, exact Gate descriptors, CAS commit,
  stale-head refusal, and bounded founder-only readback.
- Browser-harness tests exercise inputs, submission, pending state, Gate
  approval, refresh, and Mission/Goal Graph readback without storing initData.
- Full release, viewport, mobile, secret-scan, and clean-worktree gates remain
  mandatory before an inert candidate can be proposed for separate upload.

## Analysis record

### SystemsThinking · Iceberg

- **Event:** the live Fitcheck Mission names both required proofs but exposes no
  editable founder control; Gate can only approve a proposal that already exists.
- **Pattern:** prior replacement intakes expired or remained external to the UI,
  while founder-visible surfaces stayed read-only and authenticated evidence
  routes remained admin-bearer scoped.
- **Structure:** branch packets flow one way into Mission; generic Goal Graph
  intake flows through Hermes/admin credentials; signed Gate flows only from an
  already-persisted proposal. No edge carries founder evidence into that loop.
- **Mental model:** making the whole Mission surface read-only was treated as the
  only safe alternative to browser authority. The missing distinction is between
  recording an intent and committing operational state.
- **Intervention:** add the missing high-leverage edge—authenticated intent to a
  pending proposal—while leaving Gate, D1, and Hermes ownership unchanged.

### FirstPrinciples · Deconstruct

Fundamental truths:

1. The founder must prove a fresh Telegram identity at the mutation boundary.
2. Evidence references and an observed outcome are the only facts the founder
   needs to supply for this pilot.
3. The server must own identity, parent, loadout, consequence, status mapping,
   head pinning, descriptor, and commit.
4. Unsigned input cannot change the D1 head or quest projection.
5. A Goal Graph commit is not a Hermes execution or Telegram delivery receipt.

The existing admin-only intake route and read-only Mission UI are soft policy
choices, not fundamental constraints. A second quest-status writer is an
unnecessary assumption. The minimal reconstruction is therefore one fixed
founder adapter that creates the same existing intake-task shape, with an
embedded evidence-candidate projection, then disappears behind the current Gate.

### RootCauseAnalysis · Fishbone

| Category | Verified contributor | Corrective control |
|---|---|---|
| People | the founder holds the observed outcome but has no bounded ingress | exact authenticated sheet |
| Machine | Mission has zero editable controls; evidence and intake endpoints require bearer roles | fixed founder route using existing `initData` validator |
| Method | Gate approval begins after proposal creation, but no founder method creates that proposal | pending candidate compiled before Gate |
| Material | the branch packet names two proof types but no safe reference grammar | closed reference-only schema |
| Measurement | current tests prove rendering and Gate commit separately, not their feedback loop | one browser-harness vertical-slice test |
| Environment | Telegram auth expires and stale graph heads can race review | distinct auth expiry and D1 CAS refusal |

The vital few are the missing ingress, absent server-owned transition adapter,
and missing post-approval readback. The implementation plan addresses those
three in that order instead of widening the existing admin evidence API or
adding optimistic browser state.

### IterativeDepth synthesis

Four independent lenses confirmed the proposal model and tightened its edges:

- **Literal/stakeholder:** Gate must commit the exact pre-signature consequence;
  Mission and Goal Graph readback must share one committed head; non-founders
  learn neither candidate existence nor pending counts; logs omit auth, proof
  references, and notes.
- **Failure/temporal:** intake retry repairs partial KV persistence; approval
  replay reconciles a D1-success/KV-failure interval without a second commit;
  committed D1 state outranks stale pending KV; legacy tasks remain unchanged.
- **Experiential/constraint:** labels explain reference formats, validation
  preserves safe values and focuses errors, reload restores pending context,
  and no new lifecycle, transport, execution, or pending-state writer appears.
- **Analogical/meta:** candidate approval binds the exact submitted references
  and derived change while keeping observed outcome, review status, operational
  node state, and independent evidence verification semantically distinct.

The initial pilot intentionally has no new rejection transition. A reviewer can
withhold approval until expiry, after which the founder refreshes and submits a
new candidate. Adding rejection would create a second lifecycle mutation and is
therefore a separately reviewed extension, not a hidden requirement here.
