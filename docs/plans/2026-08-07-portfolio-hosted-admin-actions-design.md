# Portfolio Hosted Admin Actions Design

**Date:** 2026-08-07
**Status:** implemented locally; production held
**Scope:** replace the Workbench's offline export controls with authenticated,
durable, governed intake actions.

> **Founder Gate refinement (2026-08-07):** the active Workbench is now
> Thoughtseed-only. `start-project-ingestion` and the Tryambakam selector are
> retired from the active contract. New Thoughtseed project birth uses
> `create-thoughtseed-project` and the origin-derived, Founder Gate model in
> `2026-08-07-thoughtseed-governed-project-birth-design.md`. The earlier
> Tryambakam action grammar below is retained only as implementation history.

## Decision

Portfolio Workbench is now a hosted founder admin surface, not an offline
Markdown/JSON handoff tool. Import, Copy, JSON, Markdown, and Reset are removed
from the header. A local preview remains useful for deterministic UI proof, but
it cannot submit actions.

The browser does not become a storage client. It posts one bounded action to a
same-origin Worker route:

```text
Founder browser / Telegram WebApp
  -> POST /v1/admin/portfolio/actions
  -> Cloudflare Access + Plexus founder OR Telegram signed-founder validation
  -> closed-schema validation and 16 KiB request ceiling
  -> immutable/idempotent R2 action evidence
  -> pending-governed-intake queue trigger
  -> later reviewed compiler/approval flow
  -> D1 Goal Graph (sole operational writer)
```

R2 is evidence storage, not transaction or workflow authority. The queue
trigger contains the receipt identity and bounded routing facts but never the
internal R2 object key. No Goal Graph mutation occurs in the action endpoint.

## Action grammar

`thoughtseed.portfolio-admin-action.v1` permits two initial actions:

- `reconcile-work-object` for a Thoughtseed WorkObject's repository-first intake
  proposal;
- `start-project-ingestion` for a Tryambakam · Noesis Project folder.

The server rejects unknown fields, invalid portfolio/kind combinations,
unbounded text, missing client families, inconsistent repository authority,
digests that differ from the shipped catalog/root map, Thoughtseed subjects
absent from the shipped WorkObject catalog, Tryambakam subjects or paths absent
from the reviewed shallow 30-Project map, status drift, oversized bodies,
missing founder authentication, and absent R2 configuration before any action
can be accepted.

Only Thoughtseed-originated ventures can become Saplings. Client work remains a
Client Branch. Tryambakam · Noesis actions use Project grammar and never emit a
Client Branch classification.

## Durability and replay

The action's idempotency key selects one deterministic R2 object. Its canonical
payload produces a SHA-256 action digest and stable receipt ID. Exact replay
returns the same receipt without a second R2 or queue write. A semantic change
under the same idempotency key returns a conflict.

Ordering is deliberate: R2 evidence is written first. If queue creation fails,
the endpoint returns a bounded `durable: true` retry receipt. A retry reuses the
same R2 evidence and completes the missing trigger.

## Authentication and CSP

- Browser admin: Cloudflare Access JWT verified and resolved through Plexus;
  only the founder role may act.
- Telegram: signed `initData` plus the configured founder allowlist.
- Document CSP: `connect-src 'self'`; every other network destination remains
  denied.
- Client source: only `/v1/admin/portfolio/actions` is an allowed action path.

## Promotion boundary

This implementation is deploy-ready but is not deployed by this change.
Packet review issue #292 must move the packet out of `draft-held` before issue
#293 can authorize a Worker upload or production promotion. Implementation is
tracked by issue #296 in GitHub Project #14.
