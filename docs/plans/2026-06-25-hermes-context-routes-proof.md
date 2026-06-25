# Hermes Context Routes Proof

Date: 2026-06-25
Status: blocked before live deploy

## Scope

Cambium now has bounded `/v1/context/*` Worker routes for AWS Hermes:

- `/v1/context/health`
- `/v1/context/routine-snapshot`
- `/v1/context/semantic-recall`

The route contract is token gated, tenant gated, and source-bounded. R2 routine
snapshots read only exact allowlisted object keys. Default routine sections stay
blocked/no-signal until exact R2 keys or tested subprefix proof exists.

## Local Tests

- `node --test workers/quests/src/context-bindings.test.ts` passed `11/11`.
- `node --test workers/quests/src/context-bindings.test.ts workers/quests/src/context-routes.test.ts workers/quests/src/handler.test.ts` passed `182/182`.
- `npm test` passed `554/554`.
- `git diff --check -- workers/quests/src/context-bindings.ts workers/quests/src/context-bindings.test.ts workers/quests/src/index.ts workers/quests/wrangler.jsonc` passed with no output.

## Dry Run

`npx wrangler deploy --config workers/quests/wrangler.jsonc --dry-run` exited `0`.

Bindings reported by Wrangler dry-run:

- `QUESTS` KV namespace
- `BRIDGE_DB` D1 database
- `CAMBIUM_CORTEX` Vectorize index
- `THOUGHTSEED_VAULT` R2 bucket
- non-secret vars: `CONTEXT_ALLOWED_TENANTS`, `CONTEXT_EMBEDDING_PROVIDER`, `CONTEXT_EMBEDDING_MODEL`

Wrangler emitted an existing warning about the repository-level `astro/tsconfigs/strict`
extension. The warning did not block dry-run packaging.

## Secrets

Blocked:

- `CONTEXT_ROUTE_TOKEN` is not present in the local shell.
- `HERMES_CONTEXT_ROUTE_TOKEN` is not present in the local shell.
- `npx wrangler secret list --config workers/quests/wrangler.jsonc` does not show `CONTEXT_ROUTE_TOKEN`.

No token value was printed, generated, or committed.

## Deploy

Not run. Live deployment is intentionally blocked until a shared
`CONTEXT_ROUTE_TOKEN` exists for both Cambium Worker and AWS Hermes.

## Live Probes

Not run. Authenticated live probes require the same shared token that AWS Hermes
will use.

