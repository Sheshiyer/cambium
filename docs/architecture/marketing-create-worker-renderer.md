# Thoughtseed founder-article Worker renderer

Status: implemented for review, fixed-tenant, registered disabled, and not deployed.

## Outcome and boundary

This slice adds one Cloudflare Worker renderer that can turn a bounded, prepared Thoughtseed brief into one
founder-article draft. The renderer has no publication authority: its only successful artifact is an
`asset_draft@1.0.0` with `status: draft` and `rights_state: review_required`, accompanied by a redacted
`operator_receipt@1.0.0` whose next action is human review.

The implementation is deliberately inert in production. This slice did not deploy a Worker, apply a D1
migration, create or change a Cloudflare secret, enable the activation, or call NVIDIA. Tests use injected
offline fetch doubles. Provisioning commands below are an operator runbook only; they were not executed while
building this branch.

## Immutable identity

| Property | Fixed value |
|---|---|
| Tenant | `thoughtseed` |
| Adapter | `founder-article-nvidia@1.0.0` |
| Adapter catalog digest | `ae1d60e951f6d6c18041581ddb018b53b162ebfb49bf9370f3185c38e03fc12f` |
| Required activation | `founder-article-nvidia@1.0.0:ae1d60e951f6d6c18041581ddb018b53b162ebfb49bf9370f3185c38e03fc12f` |
| Recipe | `founder-article-draft@1.0.0` |
| Provider | `nvidia` |
| Provider endpoint | `https://integrate.api.nvidia.com/v1/chat/completions` |
| Model | `meta/llama-3.1-70b-instruct` |
| Prompt template | `thoughtseed-founder-article@1.0.0` |
| Prompt digest | `d1d1db81ae9b1eaeb9ba3f799a9a7fdeb61e87bc2805fdab4b29761274963a80` |
| Provider credential binding | `NVIDIA_MARKETING_CREATE_API_KEY` |
| Activation binding | `MARKETING_CREATE_ACTIVATION` |
| Generation | `stream=false`, `temperature=0.2`, `max_tokens=1800` |
| Network policy | one attempt, 30-second timeout, 65,536-byte maximum response |
| Output authority | `externalAction=none`, `publishEligible=false` |

The catalog registers the adapter as `registered_disabled`. Tenant, adapter, recipe, provider, endpoint,
model, prompt, generation settings, credential descriptor, and output authority are server-owned. A caller
cannot override them in prepare or execute input. Any change to provider, model, prompt, or catalog semantics
requires a new immutable adapter version and a separately reviewed activation value.

## Authority and state flow

```text
admin prepare
    |
    v
D1 prepared -- exact action digest --> signed Telegram founder approval
    |                                      |
    |                                      v
    +------------------------------ approval persisted
                                           |
                                           v
                               admin execute by IDs only
                                           |
                                           v
                                D1 claimed + fencing token
                                           |
                                           v
                           D1 invoking CAS + exact readback
                                           |
                                  one provider attempt
                                  /        |        \
                                 v         v         v
                           succeeded     failed   indeterminate
                               |                      |
                               v                      v
                    review-only draft       manual reconciliation
```

### 1. Prepare

An authenticated bridge administrator submits only request identity, idempotency identity, actor identity,
budget reservation, expiry, and bounded public-business brief facts. The Worker rejects assignment/member
credentials, unknown fields, routing overrides, raw prompts, credentials, confidential classifications,
malformed digests, duplicate claim IDs, and oversized input.

The Worker derives every fixed field, computes the input, action, and request digests, and writes the immutable
prepared record to D1. The activation must already equal the exact registered value. A missing or mismatched
activation fails closed before preparation, provider-secret use, or network egress. Identical idempotent
prepare requests replay; identity or content drift conflicts.

### 2. Signed Thoughtseed founder approval

The next action is `approve-marketing-render` on `/api/gate/thoughtseed`. The existing Telegram gate validates
fresh signed init data against Telegram's public key and the configured founder allowlist. The Worker then
loads the prepared action and persists `approval_decision@1.0.0` for its exact action digest. The client cannot
supply an approval object, action digest, tenant, or authority fields. A duplicate signature for the same
founder and action replays the stored decision; a wrong tenant, non-founder, stale signature, invalid
signature, expired request, or missing prepared action does not grant authority.

### 3. Claim and fence

The admin execute route accepts only the prepared request ID in the path and `approvalDecisionId` in the body.
It loads both persisted records, verifies the exact digest and expiry binding, and claims the D1 run. Claiming
assigns a claim ID, lease, and monotonically increasing fencing token. Only an expired `claimed` record may be
reclaimed. An `invoking` or `indeterminate` record is never reclaimed automatically.

### 4. Durable invoking boundary

Before provider egress, D1 must move `claimed -> invoking` with request ID, claim ID, fencing token, status,
and single-attempt predicates. The store then reads the row back and confirms the same state and identities.
An ambiguous write or readback returns reconciliation-required and performs zero provider calls.

### 5. Provider result

After durable invoking confirmation, the Worker makes at most one POST using the dedicated credential in an
in-memory Authorization header. There is no automatic provider retry.

| Stored state | Meaning | Operator behavior |
|---|---|---|
| `succeeded` | A bounded title/body result was normalized and a review-only artifact and redacted receipt were stored. | Review the draft; do not treat it as published or approved content. Replays return the stored artifact without another provider call. |
| `failed` | The provider returned a definite HTTP, size, or schema failure. Only a bounded error code is stored. | Diagnose the classified failure. A new attempt requires a new governed request; do not mutate or replay the terminal run as if it were pending. |
| `indeterminate` | A timeout, fetch exception, or other ambiguity occurred after durable invocation began. | Reconcile provider and D1 evidence manually. Do not retry automatically and do not activate a replacement adapter version until reconciliation is complete. |

Raw upstream response bodies, exception diagnostics, prompts, Authorization headers, and credential values are
not persisted in D1, logs, receipts, API responses, or evidence. Success retains only normalized title, body,
approved claim IDs, bounded usage count, computed digests, and review metadata.

## Secret custody and activation

Two independent Cloudflare Worker secrets gate the runtime:

- `NVIDIA_MARKETING_CREATE_API_KEY` is the provider credential. It must be separately issued for this exact
  renderer, restricted as narrowly as NVIDIA permits, and stored only as a Cloudflare Worker secret.
- `MARKETING_CREATE_ACTIVATION` contains the exact immutable activation shown above. It is a separate kill
  switch and must also be stored as a Worker secret, never as a plaintext Wrangler `vars` entry.

The provider key must not be copied or reused from a generic `NVIDIA_API_KEY`, an EC2 environment or secret,
an MCP server, a developer shell profile, or another adapter. Conversely, this renderer's key must never be
made available to EC2, MCP, generic provider maps, context routes, repository files, `.env` files, Wrangler
`vars`, request payloads, D1, logs, receipts, test snapshots, or evidence artifacts. Never print, echo, diff,
or paste either secret value into a command line argument or recorded terminal transcript.

### Operator provisioning checklist

Perform this only from a trusted operator machine, against a verified Worker account and environment, and in a
separately approved activation change. Enter secret values only at Wrangler's interactive prompt.

1. Issue a new NVIDIA key dedicated to `founder-article-nvidia@1.0.0`. Do not select an existing generic,
   EC2, MCP, or shared key.
2. Verify the target account, Worker, environment, catalog digest, and planned rollback. Do not deploy as part
   of secret inspection.
3. Provision the dedicated provider credential interactively:

   ```bash
   npx wrangler secret put NVIDIA_MARKETING_CREATE_API_KEY
   ```

4. In a separate reviewed action, provision the activation binding interactively:

   ```bash
   npx wrangler secret put MARKETING_CREATE_ACTIVATION
   ```

   At the prompt, enter the exact activation from the immutable identity table. Do not place it in
   `wrangler.toml`, plaintext `vars`, shell history, CI logs, or a non-interactive command argument.
5. Inspect secret **names only** with `npx wrangler secret list`. The presence of both names is not proof that
   their values are correct and does not authorize a deploy or provider call.
6. Use the established deployment review to bind both secrets to only the intended Worker environment. Keep
   activation disabled everywhere else.
7. After activation, exercise the governed sequence only: prepare, signed founder approval, ID-only execute,
   then human review. Stop on any reconciliation-required result.

This repository slice intentionally stops before every provisioning and deployment step above.

## Rotation, rollback, and reconciliation

Credential rotation replaces only `NVIDIA_MARKETING_CREATE_API_KEY` through the same trusted interactive
Worker-secret procedure. It requires no EC2 or MCP change because those systems must never possess this key.
Keep the old key revoked only after the new Worker binding and rollback plan have been independently verified.

Rollback begins by removing `MARKETING_CREATE_ACTIVATION` from the affected Worker environment. Removing the
activation first makes prepare and execute fail closed before D1 mutation or provider egress. Then, if needed,
roll back the Worker version through the normal reviewed Cloudflare process. Do not rely on provider-key
deletion as the primary kill switch, and do not expose a value while proving that a binding was removed.

Before rotation, rollback completion, or activation of any successor adapter:

- enumerate `invoking` and `indeterminate` runs without printing payload or credential material;
- reconcile each run against bounded provider and D1 evidence;
- preserve terminal artifacts and receipts for idempotent replay;
- never reset an ambiguous row to `claimed` or retry it automatically; and
- register a new immutable adapter version for any provider, model, prompt, or contract change.

## Implementation map

| Concern | Path |
|---|---|
| Production manifest | `composition/production.v1.json` |
| Immutable adapter catalog | `composition/create-adapters.v1.json` |
| Catalog validation | `bin/lib/create-adapters.mjs` |
| Renderer domain and provider boundary | `workers/quests/src/marketing-renderer.ts` |
| D1 claim/fence authority | `workers/quests/src/marketing-render-store.ts` |
| D1 migration | `workers/quests/migrations/0005_marketing_create_renderer.sql` |
| Schema mirror | `workers/quests/schema/bridge.sql` |
| Authenticated routes and runtime binding | `workers/quests/src/handler.ts`, `workers/quests/src/index.ts` |
| Composition verification | `bin/create-adapters.test.mjs`, `bin/compose.test.mjs` |
| Renderer and state-machine verification | `workers/quests/src/marketing-renderer.test.ts`, `workers/quests/src/marketing-render-store.test.ts`, `workers/quests/src/migration.test.ts` |
| Route and signed-gate verification | `workers/quests/src/handler.test.ts` |

The implementation evidence record is
`docs/evidence/2026-07-18-marketing-create-renderer-implementation.json`. Its verification fields remain pending
until the branch owner runs and records the complete final test and security audit.
