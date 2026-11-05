# Cambium Infinite Game — reviewed project instructions (v1)

This file is the reviewed, repository-relative instruction packet imported by
the Cambium Infinite Game plugin. It carries doctrine references and boundary
language only. It contains no secrets, no absolute machine paths, no native
session identifiers, no prompt or response bodies, and no credentials.

## Authority (do not restate; refer)

- **Vision** — `VISION.md` (near-invariant enduring doctrine).
- **Mission** — `MISSION.md` (renewable doctrine horizon).
- **Acceptance** — `ISA.md` (approved goals and acceptance criteria).
- **Planning** — `.planning/` (finite planning state under GSD).
- **Handoff (this packet)** — `.project/HANDOFF.md`.
- **Operational writer** — the D1 Goal Graph. Nothing here writes.
- **Delivery** — Hermes owns Telegram. This packet cannot claim a Hermes receipt.

## What this import provides

- A canonical name for the infinite-game loop as read by an OpenAI dot or plugin surface.
- A tenant-scoped read contract for provenance-bound envelopes (source authority,
  source reference, content digest, graph or version reference, freshness, and
  omission or redaction metadata).
- A non-writing action-intent compiler, an immutable founder-review request and
  status seam, plus an execution adapter that accepts only an exact, separately
  approved founder tuple. Telegram Gate receives a redacted review row and
  submits only action/request digests; Quests resolves the tuple server-side
  and records approval without writing D1. A dedicated authenticated
  service-binding hop then reuses the existing Goal Graph CAS writer and
  reports success only after matching Cambium Gate authoritative readback.

## What this import does not provide

- No direct D1 writer authority. No caller-supplied actor identity or argument
  digest. No mutation outside Cambium Gate, no fallback delivery channel, no
  cross-tenant read, and no coercion of unsupported plugin or MCP major
  versions.

## Independent readiness gates (all must be separately satisfied)

1. Dot entitlement for the approved workspace.
2. Workspace-admin enablement for private plugins.
3. Private-plugin connection to the exact Access-protected deployment.
4. Service credentials owned by the approved principal.
5. Deployed-version verification against the exact bindings digest.
6. MCP endpoint, OAuth discovery, and reviewed tool-catalog verification.
7. One exact approval, execution, and authoritative-readback receipt.
8. A verified rollback receipt for the deployed source and bindings.
9. Closed marketplace import and workspace availability evidence.

No gate may be inferred from another. See ISC-2476 in `ISA.md`.

## Privacy boundary

Persistent dot context may hold only canonical identifiers, digests, approval
state, and the last accepted receipt. Raw prompts, responses, credentials,
native session identifiers, and private Vault content are forbidden. See
ISC-2491.

## Version

- `import_version: v1`
- Governed by `openai/cambium-infinite-game/compatibility.manifest.json`.
