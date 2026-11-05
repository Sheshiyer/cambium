---
name: cambium-infinite-game
description: Read Cambium's infinite-game operating loop (Vision → Mission → ISA → GSD → D1 → Run → Receipt → Cortex learning), compile exact founder-bound intents, and execute only separately approved actions through Cambium Gate with authoritative readback.
version: 1.9.0
authors:
  - cambium
compatibility:
  packet: openai/cambium-infinite-game
  import_version: v1
  plugin_schema_version: 1.0.0
isc_bindings:
  - ISC-2474
  - ISC-2475
  - ISC-2478
  - ISC-2479
  - ISC-2480
  - ISC-2481
  - ISC-2485
  - ISC-2491
  - ISC-2505
---

# cambium-infinite-game

A reusable skill for OpenAI dots and plugin surfaces that consume Cambium's
infinite-game loop. It is a **reader and Gate adapter**, never a canonical
writer.

The plugin root includes portable Agent Plugins `mcp.json` wiring for the exact
Streamable HTTP endpoint `https://cortex.thoughtseed.space/mcp`. That descriptor
is connection intent, not live proof: installation, OAuth metadata, public
initialization, tool discovery, credentials, and deployment/version parity stay
held until the separate live receipts pass.

Before any owner-approved activation, validate the checked-in
`deployment-admission.policy.json` and a separately produced redacted snapshot
with `scripts/check-openai-mcp-deployment-admission.mjs`. The snapshot names
the exact OAuth variables, three service bindings, and two dedicated secrets,
but represents binding targets, secret presence, deployed version, and rollback
target only by distinct SHA-256 references. The deployed version must match the
digest recomputed from the reviewed Worker runtime sources, and the complete
canonical snapshot must match a separately owner-approved configuration digest;
snapshot-only validation remains held. The checker never deploys, reads
Wrangler, opens a network connection, or prints configuration values. A
source-policy pass is not a live readiness receipt.

## When to use

- Ask why a specific ISA criterion is currently open or blocked.
- Trace a D1 task backward to Mission and Vision, or forward to receipts and
  Cortex learning references.
- Compile a founder-approval-gated action intent for the Cambium Gate.
- Persist that exact intent as a founder review request and read its status.
- Execute an exact, separately approved intent through the Cambium Gate and
  require authoritative readback before reporting terminal success.
- Report the state of the five independent readiness gates.
- Prepare deterministic local or cloud Codex task envelopes for a Dot.
- Compile one-channel status updates, lifecycle controls, and reconciliation.

## When not to use

- Do not use this skill to send a Telegram message; Hermes is the delivery
  authority (ISC-2495).
- Do not use this skill to write to D1, mutate tenant data, or promote a
  deployment; those remain outside the plugin boundary (ISC-2505).
- Do not use this skill on a stale graph version; the caller must refresh
  against the current Goal Graph version (ISC-2492).

## Contract

Each read returns a bounded tenant-scoped envelope with:

- `source_authority` — the doctrinal owner of the field (Vision, Mission, ISA,
  GSD, D1, Hermes, Cortex).
- `source_reference` — a repository-relative path or canonical D1 identifier.
- `content_digest` — `sha256:...` of the returned body.
- `graph_version` — the Goal Graph version this envelope was compiled against.
- `freshness` — a UTC timestamp for when the envelope was compiled.
- `omissions` — a list of intentionally omitted or redacted fields with reasons.

`compile_action_intent` is non-writing. The caller supplies arguments, never an
actor or argument digest; Cortex derives actor, plugin identity, MCP identity,
issuer, and the canonical argument digest from verified OAuth context.

`request_action_approval` stores the exact tuple for review and projects a
redacted row into the Telegram founder Gate. `get_action_approval_status` reads
whether it is awaiting approval, approved, executed, or expired. Neither tool
writes the Goal Graph or implies canonical completion.

`execute_approved_action` requires a separate Gate-issued approval bound to the
exact tenant, actor, action kind, canonical argument digest, Goal Graph version,
nonce, expiry, idempotency key, plugin identity, MCP identity, and issuer
(ISC-2485). It submits that tuple only to the injected Gate adapter. Success is
reported only after one mutation and matching authoritative readback
(ISC-2487). See `references/mcp-action-contract.md`.

## Dot runtime

Use `scripts/dot-runtime.mjs` when a connected computer needs a deterministic,
source-only compiler for Dot task state. The module is also a JSON-stdin CLI:

```bash
node skills/cambium-infinite-game/scripts/dot-runtime.mjs
```

Its supported operations compile bounded memory checkpoints, local/cloud Codex
task envelopes, connected-surface readiness, one-channel updates, lifecycle
receipts, post-stop action admission, and idempotent outcome reconciliation.
Inputs use closed shapes: unknown fields, raw content, credentials, native
session identifiers, and absolute paths fail closed. See
`references/dot-operating-contract.md` for the exact contract.

Runtime output is evidence, never execution. In particular:

- `compiled_not_sent` does not mean a channel update was delivered.
- `eligible_for_separate_authorization` does not authorize an action.
- a stopped lifecycle blocks any later authorization request and makes late
  results evidence-only.
- local execution requires a separately connected computer; cloud execution
  preserves canonical task identity but has a distinct run identity.

## MCP provenance read

When the separately approved MCP connection and service binding exist, use
`read_infinite_game_node` for one canonical Vision, Mission, ISA, GSD, D1,
run, receipt, or Cortex-learning node. The tool binds the requested tenant to
verified token claims (or the legacy Hermes allowlist), validates authority,
identity, graph version, digest, freshness, size, omissions, and sensitive
content, and returns `cambium.mcp.read_envelope.v1` as structured content.

The tool is unavailable when its injected reader binding is absent. A returned
envelope remains evidence only: `writer_authority` and `canonical_completion`
are always false. See `references/mcp-read-contract.md` for the exact boundary.

## Connected profile

When OAuth and the separate profile-key binding are both configured,
`get_connected_profile` returns one stable opaque `id` derived from the already
verified issuer and subject. It accepts no identity input, discloses no raw
subject, email, token, tenant, session, credential, or local path, and calls no
provider or Gate binding. Profile recognition grants no tenant, approval,
execution, writer, or canonical-completion authority. See
`references/connected-profile-contract.md`.

## MCP Gate actions

Action tools are advertised only when the source runtime has complete OAuth
action configuration: a dedicated action scope, an exact plugin client ID, and
an explicit founder-subject allowlist. Every action call must carry verified
OAuth claims for the tenant, founder, client, issuer, and action scope.
Read-only or legacy bearer credentials cannot dispatch Gate work.

The runtime has no D1 binding. The Gate adapter is the execution authority and
must return the original or duplicate receipt plus matching authoritative
readback. Conflicts, drift, expiry, timeouts, oversized responses, unknown
fields, sensitive content, and malformed receipts fail closed.

For `goal-graph.apply-approved-change`, the only accepted arguments are
`{ "change_digest": "sha256:<64 lowercase hex>" }`. The tuple's version,
nonce, expiry, and idempotency key must exactly match the server-owned pending
Goal Graph task. `request_action_approval` first stores one immutable review
request. The Telegram Gate receives only a redacted display row, and its signed
`approve-mcp-action` submission contains only the action and request digests.
Quests resolves the sensitive intent and arguments server-side, stores an
approval artifact, and performs no D1 write. Execution then crosses
the token-protected `MCP_GATE_ADAPTER` service binding to Quests, which invokes
the existing Goal Graph CAS writer and returns a digest-bound authoritative
receipt. `MCP_GATE_ADAPTER_TOKEN` is a dedicated shared binding secret; it is
not a Cortex read token, admin token, or founder credential.

## Boundaries

- No direct D1 writer authority (`ISC-2505`).
- No cross-tenant read (`ISC-2489`).
- No Hermes receipt (`ISC-2495`).
- No fallback channel (`ISC-2497`).
- No unsupported plugin or MCP major version (`ISC-2503`).
- No live MCP declaration until OAuth, discovery, endpoint, and tool catalog
  have owner-approved receipts (`ISC-2476`, `ISC-2480`, `ISC-2482`).

## Live-gate holds

This skill is source-only until every live-gate evidence receipt exists at
`openai/cambium-infinite-game/live-gates/`. Absent any receipt, the packet's
full compatibility check fails closed (ISC-2476, ISC-2477, ISC-2493).

The nine infrastructure receipts do not establish behavioral acceptance. A
separate tenth `end-to-end-canary.receipt.json` must canonically bind all nine
prerequisites and prove a clean Dot session, unchanged authority, the reviewed
tool catalog, digest-only persistent context, local/cloud task identity parity,
held-surface zero effect, exactly one approved ChatGPT/Slack/Teams delivery,
idempotent replay, stop and late-result exclusion, rollback restoration,
disconnect reconciliation without reissue, upgrade-required version handling,
and Vision-to-Learning lineage. Without that joined canary, the verifier reports
infrastructure readiness only and keeps behavioral acceptance held.
