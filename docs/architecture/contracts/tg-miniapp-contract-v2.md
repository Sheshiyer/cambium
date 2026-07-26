# Cambium TG Mini App Contract v2 — Contract Freeze

Status: v2 frozen (P1-W1, task T-005)
Supersedes: `docs/architecture/contracts/tg-miniapp-ecosystem-contract.md` (v1) for the gate/proof surfaces frozen below; v1 scene-ownership and no-fake-progress rules remain active and are incorporated by reference.
Owner: Cambium operator / Telegram mini app
Runtime sources: `workers/quests/src/handler.ts` (routes + auth), `workers/quests/src/page.ts` (served UI bundle)
Proof tooling: `workers/quests/src/live-proof-readiness.mjs` (schema v2 after T-006/T-007)
Governing plan: `docs/plans/2026-07-24-tg-miniapp-mobile-redesign-swarm-plan.md`

This document freezes, as version v2, the wire contract between the Telegram mini
app and the `cambium-quests` Worker, and the founder-device proof shape. All
redesign workers (W1–W3, all phases) implement this shape identically; no worker
may improvise an alternate envelope, payload, or proof shape.

---

## 1. Served Envelopes (Worker → Mini App UI)

The mini app renders only what these envelopes contain. Missing data renders as
an explicit gap, never as inference (v1 no-fake-progress rules stand).

| Envelope | Schema name | Authority | Consumer |
|---|---|---|---|
| Branch packets | `product-branch-packets@v1` | Operator packet build | Mission scene (arcs, missions, KPIs, gates, proof foldback) |
| Quest ledger | `quest-ledger-envelope@v1` | Quest ledger | Mission / Story scenes |
| Gate queue rows | `thoughtseed.action-request-list-item.v1` projection (see v1 §"Gate ActionRequest Display Contract") | Worker KV gate store + ActionRequest records | Gate scene |
| Branch map read model | `cambium.telegram.branch-map-route.v1` (see §4) | Goal-graph store + branch-map receipt store | Inspect scene |

Display rules inherited from v1 and unchanged in v2:

- A Telegram-originated row may display `id`, `branchId`, `questId`,
  `topic.topicKey`, `topic.threadId`, optional `topic.sourceMessageId`,
  `selectedOptionId` (resolved through the served `options` array),
  `receipts.latest` (the latest actual redacted receipt, never a predicted
  `receiptExpectation`), `evidence`, `consequence`, `reversibility`, and
  `idempotencyHint`.
- `needs_signed_confirmation` renders one signed-confirm control; `queued`
  renders selection + latest receipt + operator-waiting state without another
  confirm control; `consumed` / `completed` / `superseded` leave the active
  Gate list.
- Envelopes must never carry raw founder ids, raw `initData`, bearer tokens,
  private chat ids, WebView query strings, or queued secrets. The Worker-side
  public-surface regex (`PUBLIC_SECRET_RE` in `handler.ts`) is the enforcement
  reference and is unchanged.

## 2. Signed-Action Payload Contract — `POST /api/gate/{tenant}`

Runtime initData auth **stays unchanged** in v2: the mini app, running inside
the Telegram WebView, submits the live `Telegram.WebApp.initData` string in the
request payload, and the Worker validates it server-side
(`validateInitData` in `handler.ts`: Ed25519 third-party signature against the
`<bot_id>:WebAppData` data-check string, `auth_date` freshness ≤ 600 s, founder
allowlist). No manual paste or env-supplied initData exists anywhere in this
flow.

### 2.1 Request body

```json
{
  "kind": "approve | reroll | promote-skill | queue-side-quest | confirm-action-request | approve-marketing-render | approve-goal-graph",
  "subject": "<short text, ≤160 chars>",
  "initData": "<live Telegram.WebApp.initData string>",
  "idempotencyKey": "<opaque key, ≤240 chars; defaults to `${kind}:${subject}`>",
  "evidence": "<short text, optional>",
  "consequence": "<short text, optional>",
  "reversibility": "<short text, optional>",
  "note": "<short text, optional, ≤300 chars>",
  "actionRequestId": "<for kind=confirm-action-request>",
  "requestId": "<for kind=approve-marketing-render>"
}
```

- `kind` is a closed enum; unknown kinds → `400 need a supported gate kind and subject`.
- `subject` or (`actionRequestId` / `requestId` for the two id-keyed kinds) is
  required; its absence → `400`.
- `initData` travels in the **payload** for this route (not a header) — this is
  the pinned runtime-auth shape and must not regress.
- `confirm-action-request` is keyed by durable `actionRequestId`; it adds one
  redacted consume receipt, is idempotent on replay, and performs no external
  send, spend, deployment, or client mutation.
- `approve-marketing-render` is fixed to tenant `thoughtseed`; its body is
  field-restricted to `{kind, requestId, subject, initData}` and writes no gate
  KV entry (it approves a prepared render record instead).
- `approve-goal-graph` (added after the v2 freeze, with the shipped Phase-5
  lane) is keyed by `subject` = the intake change digest; it writes no gate KV
  entry and instead CAS-commits the pending KV proposal to the D1 goal graph.
  Replay returns `200` with `duplicate: true, replayed: true`; a stale head
  returns `409 goal_graph_stale_head` with no write. The full contract is the
  [Telegram Goal Graph intake lifecycle](../../runbooks/goal-graph-telegram-lifecycle.md)
  runbook.

### 2.2 Success response (`200`)

```json
{
  "queued": "<worker-assigned action id>",
  "duplicate": false,
  "kind": "<echoed kind>",
  "subject": "<echoed subject>",
  "idempotencyKey": "<echoed key>",
  "consequence": "<served consequence text>",
  "reversibility": "<served reversibility text>"
}
```

Idempotency replay: if a `queued` action with the same `idempotencyKey` exists
for the tenant, the Worker returns `200` with `duplicate: true` and the
**original** `queued` id, kind, subject, consequence, and reversibility — no new
KV write.

### 2.3 Failure modes

| Status | Cause |
|---|---|
| `400` | bad tenant, non-JSON body, unsupported kind, missing subject/id |
| `401` | missing, stale, malformed, or wrongly-signed `initData`; non-founder user (fail-closed, reason string redacted) |
| `403` | kind tenant restriction (e.g. marketing renderer off-tenant) |
| `404` | keyed record not found (`approve-marketing-render`, `approve-goal-graph`) |
| `409` | keyed record conflict |
| `503` | gate/auth/store not configured |

### 2.4 Operator consume (context, not a mini-app surface)

`GET /internal/gate/{tenant}` and `POST /internal/gate/{tenant}/consume` are
bearer-token operator routes. The mini app never calls them; they are listed
here only to complete the signed-action lifecycle
(telegram submit → worker list → operator consume → mini app refresh).

## 3. Reserved

(This section intentionally left as a placeholder anchor; the gate payload
contract is §2.)

## 4. Read-Only Branch-Map Route — `GET /v1/branch-map/{tenant}`

The branch-map route is a **read-only, authenticated read model**. It mutates
nothing.

- **Method:** `GET` only; any other method → `405` with `allow: GET`.
- **Tenant:** path tenant must pass the kebab-case tenant regex and be in the
  enabled branch-map tenant list (default `['cambium']`); otherwise `400` / `403`.
- **Auth:** live `initData` in the `x-telegram-init-data` (or
  `telegram-init-data`) header, validated server-side exactly as in §2.
  Failure → `401 { error: 'telegram authentication failed', reason }`.
- **Authority:** goal-graph store head + nodes plus the branch-map receipt
  store; missing authority → `503`; missing graph head → `404`.

### 4.1 Success response (`200`) — `cambium.telegram.branch-map-route.v1`

```json
{
  "schema": "cambium.telegram.branch-map-route.v1",
  "version": 1,
  "tenantId": "<tenant>",
  "authenticated": { "method": "telegram-init-data", "userId": "<validated founder id>" },
  "projection": { "…": "validated branch-map projection, digest re-verified at the seam" },
  "sheet": { "…": "rendered branch-map sheet" },
  "proof": {
    "schema": "cambium.telegram.branch-map-proof.v1",
    "tenantId": "<tenant>",
    "graphVersion": "…",
    "graphDigest": "…",
    "projectionDigest": "…",
    "sheetSchema": "…",
    "sheetEnvelopeDigest": "sha256:<64 hex>",
    "sheetTextDigest": "sha256:<64 hex>",
    "authenticatedUserId": "…",
    "generatedAt": "<ISO 8601>",
    "proofDigest": "sha256:<64 hex>"
  }
}
```

The Worker recomputes the projection digest at the seam before serving; a
digest mismatch → `503 branch_map_projection_digest_invalid`. Invalid
projection or sheet → `503` with up to 12 validation errors. The mini app must
treat the proof block as digests only and must not request or display raw
graph payloads beyond what the sheet renders.

## 5. Proof Shape v2 — Founder-Device Proof as In-App Signed Receipt

**Founder-device proof v2 is an in-app signed gate action whose redacted
receipt artifact validates under readiness schema v2.** The redesigned UI
performs one real signed action (e.g. a gate approval smoke) from inside the
Telegram WebView on the founder's device; the redacted receipt of that action
**is** the device proof.

### 5.1 Receipt artifact — hashes only

```json
{
  "schema": "cambium.signed-gate-receipt.v2",
  "tenant": "cambium",
  "capturedAt": "<ISO 8601 capture timestamp>",
  "userIdHash": "sha256:<64 hex of Telegram user id>",
  "actionKind": "<one of the §2.1 kind enum>",
  "subjectHash": "sha256:<64 hex of action subject>",
  "idempotencyHash": "sha256:<64 hex of idempotency key>",
  "workerVersionId": "<deployed Worker version id serving the gate>",
  "notes": ["<operator notes, redacted>"]
}
```

Field rules:

- `userIdHash`, `subjectHash`, `idempotencyHash` are `sha256:<64 lowercase hex>`
  of the respective raw values. The raw values never appear in the artifact.
- `actionKind` is the enum string from §2.1 (kinds are not secret).
- `workerVersionId` is the Worker deployment version identifier (public
  deployment metadata, not a secret).
- `capturedAt` is an ISO 8601 timestamp; readiness freshness rules apply.

### 5.2 Explicit prohibitions (schema v2 validators enforce)

- **No pasted or env-supplied initData anywhere in tooling.** The
  `TELEGRAM_INIT_DATA` and `TG_INIT_DATA` environment variables are retired
  from every tool, template, runbook, and doc. Tooling must not read them,
  accept them as flags, or mention them as capture inputs.
- **No raw initData, raw user ids, tokens, or query strings in any artifact.**
  Validators reject artifacts containing `query_id`, `auth_date`, `signature`,
  `hash=`, `tgWebAppData`, `Bearer`, raw `user=`/`id=`/`token=` fields, or any
  initData-shaped string.
- The receipt proves *that a real signed action executed on the founder's
  device through the live Worker*. It does not prove layout (viewport proofs
  do that) and does not mutate authority beyond the action's own gate path.

## 6. Removed vs v1 — and Why

| v1 element | v2 disposition | Reason |
|---|---|---|
| `--capture-device-proof` ritual in `live-proof-readiness.mjs` (read `initData` from `TELEGRAM_INIT_DATA`/`TG_INIT_DATA` env, parse it, emit `cambium.tg-device-proof.v1` with `telegram.initDataHash`, `initDataAgeSeconds`, WebView URL, and a hashed screenshot) | **Retired.** The env-initData capture path, the device-proof template, and the `cambium.tg-device-proof.v1` schema are removed from tooling and docs. | Current Telegram desktop clients no longer expose WebView inspect/devtools, so there is no supported way to manually capture `initData` outside the WebView. The ritual is unexecutable, not merely deprecated. |
| Founder-device proof target `.artifacts/tg-miniapp-live-proof/telegram-webview.json` | Replaced by the in-app signed receipt artifact (§5). | Same evidence goal — founder device + live Worker + real auth — achieved through an action the app performs natively, with zero manual capture. |
| Manual initData paste as a verification step in any runbook/doc | Removed everywhere. | Redaction invariant: raw initData must never transit human tooling. |
| Runtime initData auth inside the WebView (`validateInitData`, Ed25519, founder allowlist) | **Unchanged.** | This is automatic, server-validated, and never touches human hands. It is the auth mechanism §2 and §4 depend on. |
| Signed-action smoke (`cambium.signed-action-smoke.v1`, phase receipts) | Retained as the smoke harness; its founder-device role is superseded by proof v2. The smoke may continue to record `initDataHash` internally as a phase digest, but no artifact may require pasted initData to produce it. | The smoke exercises the same §2 payload the in-app proof uses. |
| Redaction invariant (no raw initData / user ids / tokens / query strings in artifacts) | **Unchanged and extended** to forbid env/pasted initData as an *input path*, not just as stored content. | Pinned shared contract decision, 2026-07-24. |

## 7. Compatibility Note — Fail-Closed Auth Unchanged

v2 freezes shapes, not security posture. The fail-closed behavior of
`validateInitData` is byte-for-byte compatible with v1:

- Missing, malformed, stale (`auth_date` older than 600 s), wrongly-signed, or
  non-founder `initData` → `401` with a redacted reason string, on **both**
  `/api/gate/{tenant}` (payload auth) and `/v1/branch-map/{tenant}` (header
  auth).
- No route gains an unauthenticated path; no error response leaks initData
  material, founder ids beyond the validated `userId` echo on the branch-map
  route, or signature internals.
- Existing route tests covering 401 fail-closed behavior must stay green at
  every wave boundary (`npm run verify:release`, 5/5). Any change to this
  behavior is a contract break and requires a v3 of this document.
