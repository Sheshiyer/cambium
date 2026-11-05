# OpenAI Dot operating contract (Cambium reference)

Status: **source-only reference**. This document describes how the
`cambium-infinite-game` skill compiles bounded envelopes that mirror
OpenAI Dot semantics. It is a reader-and-compiler contract; nothing in
this packet sends messages, writes to D1, mutates tenant state, saves
memory, or acknowledges receipts from any live surface. All
authoritative writes remain with the existing Cambium authorities
(Goal Graph in D1, Hermes for delivery, the Cambium Gate for
approval).

The runtime module is `scripts/dot-runtime.mjs`. This reference
records the semantic map the module implements.

## 1. Digest-only surface

The runtime accepts **only** canonical digest references
`sha256:<64 lowercase hex>`. It never accepts, transports, or logs:

- raw prompt bodies or response bodies,
- secrets, credentials, API keys, bearer tokens,
- native client session identifiers (dot session ids, thread ids,
  conversation ids, cursor/native connection ids),
- absolute filesystem paths or home-directory paths,
- arbitrary free-form user content.

Field names that look sensitive (`api_key`, `token`, `password`,
`credential`, `bearer`, `prompt_body`, `response_body`,
`native_session`, `session_id`, `absolute_path`, `home_dir`,
`env_file`, and neighbours) are rejected wherever they appear in
input, at any depth.

Every operation also has a closed input shape. Unknown fields fail as
`unknown_field`; the compiler never silently carries unreviewed content into an
envelope.

## 2. Dot memory checkpoint

A Dot memory checkpoint is a bounded record of what the Dot is
authorized to remember between turns. The compiler enforces:

- `tenant_id` is a lowercase slug (multi-tenant isolation).
- `dot_id` is a bounded identifier that is *not* a native session id.
- `graph_version` is a non-negative integer pinning the Goal Graph
  version the checkpoint was compiled against.
- `source_version` is the reviewed source doctrine tag
  (e.g. `v0.5.0`), never a live-deployment tag.
- `references` is a map of digest references (ISA, Mission, Vision,
  D1 tasks, receipts) — never raw bodies.
- `approval_state.status` ∈
  `{compiled_not_authorized, authorized, stopped, expired}`.
- `last_accepted_receipt` is either `null` or a bounded reference to
  a real accepted receipt digest with idempotency key and caller-
  supplied acceptance timestamp.
- `task_state` records the current bounded task's idempotency key
  and status ∈
  `{idle, compiled, awaiting_authorization, authorized, in_progress,
    accepted, held, unknown, stopped}`.
- `freshness` is a caller-supplied strict UTC ISO timestamp; the
  runtime never reads the wall clock.

The compiled checkpoint is stamped with a canonical
`checkpoint_digest` computed by canonical JSON hashing (see §8).

## 3. Local and cloud Codex task envelopes

Dot tasks may be executed by a local Codex runner (which requires a
connected computer) or by a cloud Codex runner (which does not).
Both envelope forms preserve the exact same **canonical identity**:

- `work_object_digest` (Cambium WorkObject),
- `d1_task_digest` (D1 Goal Graph task),
- `approval_digest` (Gate-issued approval),
- `proof_digest` (reviewed proof),
- `idempotency_key`,
- `graph_version`,
- `tenant_id`.

The canonical identity is hashed into
`canonical_identity_digest`. Local and cloud envelopes for the same
task therefore share the identical `canonical_identity_digest`,
which is what receipts, reconciliation, and the Gate bind against.

They differ only in **environment/run identity**:

- `environment` is `"local"` or `"cloud"`.
- `run_identity_digest` is a canonical hash over
  `{environment, canonical_identity_digest, compiled_at}` and so is
  guaranteed to differ between local and cloud runs of the same
  canonical task.
- `requires_connected_computer` is `true` for local envelopes and
  `false` for cloud envelopes. Local skills that touch the user's
  computer require a connected computer; cloud tasks must not
  assume one.

Neither envelope is authorization. Both begin
`status = "compiled_not_authorized"` and require a separate
Gate-issued approval bound to the canonical identity.

## 4. Connected surfaces (channels, apps, plugins, MCP, computer)

Channels (ChatGPT, Slack, Teams), apps, plugins, MCP, and the connected computer
are **separate connections**. `evaluateConnectedSurfaces` returns an
outcome per required surface:

- `ready` — the surface is available.
- `held` — the surface is not available; the caller must hold. There
  is **no fallback**. The runtime never substitutes one channel for
  another, never suggests reissuing on an alternative surface, and
  never marks a surface `ready` because a different surface is up.
- Surfaces not listed in `required` are ignored, even if available.
- Overall is `ready` only when *all* required surfaces are `ready`;
  otherwise `held`.
- `fallback_used` is always `false`.
- `recommend_alternative_channel` is always `false`.

Local Codex skills evaluate `connected_computer` as required; the
runtime holds if the computer is not connected.

## 5. Updates (chatgpt / slack / teams only)

`compileUpdate` compiles an update envelope for exactly one of
`chatgpt`, `slack`, or `teams`. It never sends. Every compiled
update has:

- `status = "compiled_not_sent"`,
- `sent = false`,
- a canonical `update_digest`.

`telegram` is rejected with a dedicated error: Telegram delivery is
owned by **Hermes**; the Dot runtime must not compile Telegram
updates, must not attempt Telegram delivery, and must not carry
Telegram tokens or chat identifiers.

Any other channel value is rejected as `unknown_channel`.

## 6. Stop, pause, cancel-schedule

These three operator actions are **distinct** and are compiled by
`compileStopReceipt`:

- `stop` — freezes authorization for the idempotency key.
  `authorization_frozen = true`, `late_results_policy = "evidence_only"`.
  Any result that arrives after a stop is evidence, not
  authorization, and must never re-open the task.
- `pause` — halts progress without freezing authorization.
  `authorization_frozen = false`, `late_results_policy = "admissible"`.
- `cancel_schedule` — cancels a scheduled future run without
  affecting an in-flight run or its authorization.
  `authorization_frozen = false`, `late_results_policy = "admissible"`.

Every stop receipt has a canonical `stop_digest` and a
caller-supplied `compiled_at` timestamp.

## 7. Action admission after lifecycle controls

`evaluateActionAdmission` consumes the current lifecycle status and its receipt
digest before any caller may request a separate authorization:

- `stopped` returns `decision = "held"`, freezes authorization, sets
  `may_request_authorization = false`, and keeps late results evidence-only.
- `paused` also holds a new authorization request, without converting the pause
  into a stop.
- `active` and `schedule_cancelled` may be eligible to request a separate Gate
  authorization; they are never marked authorized by this runtime.
- `authorized` is always `false` in the compiled admission decision.

This is the pure, source-only enforcement bridge between a stop receipt and a
later action attempt. The caller must supply the latest authoritative lifecycle
receipt; the runtime does not persist state itself.

## 8. Reconciliation by idempotency key

`reconcileOutcome` matches known outcomes to the current
idempotency key and returns the first matching outcome deterministically.
It **never** recommends reissue while the outcome is unknown.
When no outcome is known, the result is:

```
status: "unknown"
matched: false
recommend_reissue: false
recommend_authoritative_readback: true
```

Even multiple conflicting outcomes for the same idempotency key do
not trigger reissue; the runtime reports the conflict count and
leaves resolution to authoritative readback against the Goal Graph
and the Gate.

## 9. Deterministic canonical JSON hashing

Canonicalization sorts object keys lexicographically, drops
`undefined` values, and emits strict JSON with no whitespace. The
hash is `sha256:` + hex(sha256(canonical_json)). All compiled
digests in this module use this scheme, which lets Cambium bind
receipts, envelopes, and checkpoints across surfaces without
re-serialization ambiguity.

## 10. Timestamps come from the caller

The runtime never reads the wall clock. Every timestamp used inside
a compiled envelope is a caller-supplied strict UTC ISO string of
the form `YYYY-MM-DDTHH:MM:SS.sssZ`. Non-UTC offsets, missing
milliseconds, and non-ISO strings are rejected. This is what makes
outputs deterministic across invocations, machines, and time zones.

## 11. What this runtime is not

- Not a live sender. It never speaks to ChatGPT, Slack, Teams,
  Telegram, Cloudflare, D1, Hermes, or any provider.
- Not a memory writer. Compiled checkpoints are proposals; live
  Dot memory is written by the Dot host under a separate contract.
- Not an authorization. Compiled envelopes and stop receipts must
  be paired with existing Cambium Gate approvals before any live
  action is possible.
- Not an authority for finishing a task. Background completion
  inside a Dot task is not canonical task acceptance; the canonical
  authority remains the D1 receipt.
- Not a research writer. Proactive research inside a Dot task is
  read-only from Cambium's perspective; no writes to D1, tenants,
  or receipts occur from this surface.
- Not a cross-channel bridge. Held surfaces stay held; the runtime
  never routes around a held surface via another connection.

## 12. CLI

The module is also a JSON-stdin CLI. It reads a single JSON payload
`{ "op": "<opName>", "input": <opInput> }` from stdin and prints the
compiled result to stdout as canonical JSON. On invalid input,
unknown op, or any compile error it exits with a nonzero status and
prints a machine-readable error object of the form
`{ "error": true, "code": "<code>", "message": "<human message>" }`
to stderr.

Supported ops:

- `compileMemoryCheckpoint`
- `compileLocalTaskEnvelope`
- `compileCloudTaskEnvelope`
- `evaluateConnectedSurfaces`
- `compileUpdate`
- `compileStopReceipt`
- `evaluateActionAdmission`
- `reconcileOutcome`
- `canonicalJsonHash`

The CLI performs no network I/O and no filesystem writes.
