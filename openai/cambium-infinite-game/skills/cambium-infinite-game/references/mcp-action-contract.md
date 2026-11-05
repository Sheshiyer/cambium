# Cambium MCP Gate action contract

This contract makes the narrow Cambium mutation path operable from an approved
OpenAI plugin connection without transferring canonical writer authority to
Cortex MCP.

## Admission

Action tools are exposed only when the runtime has all of these source
configuration values:

- OAuth resource-server mode;
- a dedicated action scope;
- the exact approved plugin OAuth client ID;
- an explicit allowlist of founder token subjects.

Every call must also present a verified token whose issuer, audience, expiry,
base read scope, action scope, subject, client ID, and tenant claims match that
configuration. Read-only OAuth and the legacy Hermes bearer route cannot call
any action tool.

## Compile

`compile_action_intent` accepts this closed caller shape:

- `tenant`
- `action_kind`
- `arguments`
- `graph_version`
- `nonce`
- `expiry`
- `idempotency_key`

The server derives `actor`, `plugin_identity`, `mcp_identity`, `issuer`, and
`argument_digest`; callers cannot declare them. Arguments are canonicalized,
bounded to 32 KiB, scanned for sensitive fields, secrets, and machine-local
paths, then hashed. Expiry must be an exact UTC instant no more than 15 minutes
ahead. The output is `cambium.mcp.action_intent.v1` with
`compiled_not_authorized`, `writer_authority: false`, and
`canonical_completion: false`.

## Request and inspect founder review

`request_action_approval` accepts the same closed input, recomputes the exact
intent, validates the server-owned target, and stores one immutable review
request through the token-authenticated Gate adapter. Exact replay returns the
original request digest. The redacted founder Gate row contains no OAuth actor,
issuer, plugin identity, MCP identity, or raw arguments.

`get_action_approval_status` accepts the same closed input and returns
`awaiting_founder_approval`, `approved`, `executed`, or `expired` for that exact
tuple. Both tools return `writer_authority: false` and
`canonical_completion: false`.

## Execute

`execute_approved_action` accepts the same closed input plus one canonical
`approval_digest`. It recomputes the intent from the current verified OAuth
identity and sends only `cambium.mcp.gate_action_request.v1` to the injected
Cambium Gate adapter. Cortex has no D1 binding.

The adapter call is bounded to five seconds and a 128 KiB response. HTTP 409 is
an idempotency conflict. Other transport failures, timeouts, malformed JSON,
unexpected fields, and oversized responses fail closed without reflecting
secrets.

## Goal Graph approval and execution seam

The implemented action kind is `goal-graph.apply-approved-change`. Its closed
arguments object contains only `change_digest`, formatted as
`sha256:<64 lowercase hex>`. The compiled graph version, nonce, expiry, and
idempotency key must equal the server-owned pending Goal Graph task descriptor.

Review request, approval, and execution remain distinct events:

1. Cortex calls `request_action_approval`. Quests validates the exact tuple and
   stores one immutable review request without writing D1.
2. A founder signs `approve-mcp-action` through the existing Telegram Gate.
   The browser submits only the action digest and request digest. Quests loads
   the complete intent and arguments server-side, validates them against the
   pending task, records one immutable approval digest in KV, and performs no
   D1 write.
3. Cortex reads the approval digest with `get_action_approval_status`, then
   submits the original intent plus that approval digest through its
   injected `MCP_GATE_ADAPTER`. A dedicated shared
   `MCP_GATE_ADAPTER_TOKEN` authenticates only this service-binding hop.
4. Quests resolves the stored approval, rejects tuple or idempotency drift,
   and invokes the existing `approveGoalGraphIntakeRoute` D1 CAS path using
   the recorded Telegram founder identity. Cortex never receives a D1 binding.
5. Quests stores and returns one `cambium.gate.action_receipt.v1`. Identical
   replay returns the original receipt with `duplicate`; changed replay fails
   before mutation.

The source declares both binding/token seams but does not configure them in
Wrangler. Binding creation, secret installation, deployment, and live calls
remain separately owner-approved operations.

## Completion

A terminal result is valid only when the Gate returns
`cambium.gate.action_receipt.v1` and
`cambium.gate.authoritative_readback.v1` that match the exact tenant, actor,
plugin identity, MCP identity, issuer, action kind, argument digest, action
digest, graph version, nonce, expiry, idempotency key, approval digest,
terminal outcome, and receipt digest. Exactly one mutation is required.

An identical replay may return the original receipt with `duplicate` status.
A changed replay is a conflict. Receipt drift is never repaired or accepted by
Cortex. Only a matching readback yields `canonical_completion: true`; execution
authority remains `cambium-gate`, and `writer_authority` remains false.

## OpenAI tool semantics

The compile and status tools are annotated read-only and idempotent. The review
request tool is non-destructive and idempotent but writes a review record. The
execute tool is annotated mutating, destructive, and idempotent, requires the action OAuth
scope, and is intended to remain behind host confirmation. Tool annotations
describe behavior but never substitute for server-side authorization.

These semantics follow OpenAI's current MCP authentication, server, security,
and reference guidance. Live endpoint installation, OAuth-client registration,
workspace enablement, tool review, and receipt capture remain separate
owner-approved gates.
