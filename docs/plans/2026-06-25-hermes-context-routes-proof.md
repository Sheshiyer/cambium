# Hermes Context Routes Proof

Date: 2026-06-25
Status: deployed and live-probed

## Scope

Cambium now has bounded `/v1/context/*` Worker routes for AWS Hermes:

- `/v1/context/health`
- `/v1/context/routine-snapshot`
- `/v1/context/semantic-recall`

The route contract is token gated, tenant gated, and source-bounded. R2 routine
snapshots read only exact allowlisted object keys. Default routine sections stay
blocked/no-signal until exact R2 keys or tested subprefix proof exists.

## Local Tests

- `node --test workers/quests/src/context-bindings.test.ts` passed `12/12`.
- `node --test workers/quests/src/context-bindings.test.ts workers/quests/src/context-routes.test.ts workers/quests/src/handler.test.ts` passed `183/183`.
- `npm test` passed `555/555` after the semantic provider payload fix.
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

Configured:

- `CONTEXT_ROUTE_TOKEN` was generated locally as a 96-character hex token.
- `printf %s "$token" | npx wrangler secret put CONTEXT_ROUTE_TOKEN --config workers/quests/wrangler.jsonc` succeeded.
- `npx wrangler secret list --config workers/quests/wrangler.jsonc` shows `CONTEXT_ROUTE_TOKEN`.

No token value was printed or committed.

## Deploy

Ran `npx wrangler deploy --config workers/quests/wrangler.jsonc`.

- Initial context-route deploy: `cc3ebf28-a5bb-4ba3-835b-9133d5ebb4d2`
- Semantic adapter fix deploy: `c443b44d-bd5f-45b5-a640-6e0a51ee125c`

Wrangler emitted the existing repository-level `astro/tsconfigs/strict` warning
and deployed successfully.

## Live Probes

Probed `https://curious.thoughtseed.space` with the shared context route token:

- `GET /v1/context/health` returned `200` with routine and semantic capabilities.
- unauthenticated context calls returned `401`.
- `GET /v1/context/routine-snapshot?tenant=cambium&routine=daily-standup-digest`
  returned `200` with Cloudflare R2 source metadata and two bounded
  blocked/no-signal sections.
- `POST /v1/context/semantic-recall` returned `200` with provider
  `cloudflare-vectorize`, index `cambium-cortex`, three bounded hits, and
  `omitted.rawVectors=true`.

The first live semantic probe exposed an NVIDIA embedding `400` as Worker
`1101`. The adapter now sends NVIDIA query embeddings as array input with
`input_type=query` and `encoding_format=float`, and semantic provider exceptions
fall back to bounded no-signal metadata instead of throwing.
