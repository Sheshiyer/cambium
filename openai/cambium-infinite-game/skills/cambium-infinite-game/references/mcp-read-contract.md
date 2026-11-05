# Cambium MCP provenance-read contract

Status: **source-only, unconfigured**. This contract defines the reviewed
`read_infinite_game_node` tool and the injected service boundary that may
resolve canonical Cambium evidence after a separately approved deployment.
It does not configure the binding, connect OpenAI, perform a live read, or
grant writer authority.

## Tool goal

`read_infinite_game_node` retrieves exactly one canonical node from the
Cambium infinite-game lineage:

- Vision
- Mission
- ISA criterion
- GSD task
- D1 task
- run
- receipt
- Cortex learning reference

The input schema is closed. It requires `tenant`, `node_kind`, and `node_id`,
and optionally accepts an exact `graph_version` and `max_bytes` bound. Unknown
fields, invalid canonical identifiers, traversal, and oversized requests fail
before reader dispatch.

## Authentication and tenant authority

In OAuth mode, `tenant` must occur in the externally verified `tenant` or
`tenants` claims carried into MCP `authInfo`. In legacy Hermes mode, it must
occur in the existing `CONTEXT_ALLOWED_TENANTS` allowlist. A mismatch returns
`unauthorized_tenant` before the provenance reader is invoked.

Authorization is centralized for every advertised tool. Fixed-tenant tools
require their declared `thoughtseed` or `cambium` tenant; argument-bound tools
require the exact requested tenant. Missing and mismatched claims stop before
Workers AI, Vectorize, R2, the provenance reader, or any other provider call.

Every advertised MCP tool carries `_meta["cambium/capability"]` with:

- the exact logical resource;
- fixed or argument-bound tenant semantics;
- `classification = read`;
- the credential owner selected by runtime auth mode;
- `approval_requirement = none` for reads;
- replay-safe idempotency semantics;
- no terminal receipt;
- `writer_authority = false`.

These fields are discovery metadata. They never substitute for server-side
authorization.

## Injected reader boundary

The Worker accepts an optional `MCP_PROVENANCE_READER` service binding. The
tool is unavailable when the binding is absent. The Worker sends only the
validated read selector to the binding and never forwards access credentials,
native session identifiers, prompt bodies, or response bodies.

The binding must return `cambium.provenance_source.v1` with exactly:

- tenant, node kind, and node identifier;
- source authority and canonical source reference;
- source and graph versions;
- observation and stale-after timestamps;
- a canonical SHA-256 content digest;
- bounded omission metadata;
- one JSON object body.

No source record is trusted merely because it came from the binding.
The binding call has a five-second default deadline. The response stream is
consumed incrementally and cancelled as soon as it exceeds 128 KiB, including
when `Content-Length` is absent or false.

## Disclosure validation

Before returning any result, the Worker independently verifies:

1. exact tenant and requested-node identity;
2. node-kind-to-authority ownership;
3. canonical repository or authority references with no traversal;
4. exact requested graph version when supplied;
5. exact-calendar UTC timestamps, no future observation, a maximum 24-hour
   observation age, a maximum 24-hour freshness window, and a still-fresh
   expiry;
6. canonical body digest equality;
7. caller-selected and global response-size ceilings;
8. closed source and omission shapes;
9. absence of secret signatures anywhere in emitted text, secret-like fields,
   credentials, native-session material, file URLs, UNC paths, and absolute
   Unix, macOS, or Windows paths across both body and provenance metadata.

Any failure returns a bounded error code. Upstream bodies and internal errors
are never reflected.

## Result contract

A successful call returns both concise MCP text and structured content under
`cambium.mcp.read_envelope.v1`. The output schema includes provenance,
freshness, omissions, and the bounded body. It always records:

```text
writer_authority = false
canonical_completion = false
```

The read envelope is evidence for a Dot conversation. It is not a D1 write,
approval, run receipt, accepted completion, Hermes delivery, or Cortex
learning admission.

## Live holds

Source tests do not establish live operability. The root `mcp.json` declares
the exact portable Streamable HTTP connection intent, but it is not evidence
that the endpoint is OAuth-ready, installed, connected, or serving the reviewed
version. Before claiming an OpenAI-compatible live read, the owner-approved
receipts must prove the exact service credentials, deployment, endpoint and
tool catalog, workspace/plugin connection, authenticated readback, and rollback
state.
The compatibility manifest digest-binds the MCP source, `package.json`, and
resolved `package-lock.json`; a dependency-graph substitution invalidates the
source check.
