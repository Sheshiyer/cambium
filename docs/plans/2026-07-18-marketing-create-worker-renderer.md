# Fixed-Tenant Marketing Create Worker Renderer Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Register one canonical founder-article create adapter and implement one production-disabled, fixed-tenant Cloudflare Worker renderer whose exclusive provider key never leaves Worker secret storage.

**Architecture:** A new immutable `production-composition@1.0.0` manifest references unchanged `lead-ops@1.0.0` plus `create-adapters@1.0.0`. The adapter converts one bounded, prepared Thoughtseed brief into `asset_draft@1.0.0`; a Telegram-signed founder gate persists exact approval before the admin-only execute route can acquire a D1 fence. Provider egress occurs only after durable `invoking` readback, and ambiguous outcomes are never retried automatically.

**Tech Stack:** Node ESM composition validators, TypeScript Cloudflare Worker, D1 SQL, Web Crypto SHA-256, NVIDIA NIM OpenAI-compatible chat completions, `node:test`.

---

## Immutable constants

```text
tenant                  thoughtseed
adapter                 founder-article-nvidia@1.0.0
recipe                  founder-article-draft@1.0.0
provider                nvidia
provider URL            https://integrate.api.nvidia.com/v1/chat/completions
model                   meta/llama-3.1-70b-instruct
secret binding          NVIDIA_MARKETING_CREATE_API_KEY
prompt template         thoughtseed-founder-article@1.0.0
stream                   false
temperature              0.2
maximum output tokens    1800
network attempts         1
maximum response bytes   65536
timeout                  30000ms
external action          none
publication authority    false
```

The activation value is exactly `<adapter-id>:<create-adapter-catalog-digest>`. An absent or different value refuses before secret lookup, D1 mutation, or network egress.

### Task 1: Preserve the baseline and add failing production-composition tests

**Files:**

- Create: `docs/evidence/2026-07-18-marketing-create-renderer-baseline.md`
- Create: `bin/create-adapters.test.mjs`
- Modify: `bin/compose.test.mjs`

**Step 1: Record isolation evidence**

Record the dirty root HEAD/status/diff hashes, this worktree branch/base, and unchanged SHA-256 values for `composition/lead-ops.v1.json` and `composition/contracts/lead-ecosystem.v1.json`. Never copy user file contents.

**Step 2: Write failing adapter-catalog tests**

Tests import the wished-for `validateCreateAdapterCatalog` and assert:

- exactly one adapter;
- exact tenant, recipe, provider, URL, model, parameters, secret descriptor, gated spend, output contracts, attempt count, disabled registration;
- catalog digest recomputes from canonical JSON excluding `catalog_digest`;
- unknown recipes/contracts, duplicate IDs, caller override fields, shared secret names, non-POST endpoints, changed model/URL, non-gated spend, enabled registration, and extra adapters fail.

**Step 3: Write failing production-loader tests**

Tests require `composition/production.v1.json`, verify unchanged lead graph identity, and fail when manifest, adapter catalog, marketing catalog, asset catalog, or authority catalog references are missing or drifted.

**Step 4: Run RED tests**

Run:

```bash
node --test bin/create-adapters.test.mjs bin/compose.test.mjs
```

Expected: FAIL because the manifest, adapter catalog, and validator do not exist.

**Step 5: Commit only after Task 2 turns these tests green**

Commit message: `feat(composition): register fixed marketing create adapter`

### Task 2: Implement immutable production composition and adapter validation

**Files:**

- Create: `composition/production.v1.json`
- Create: `composition/create-adapters.v1.json`
- Create: `bin/lib/create-adapters.mjs`
- Modify: `bin/compose.mjs`

**Step 1: Define the versioned production manifest**

The manifest references local paths only:

```json
{
  "id": "production-composition",
  "version": "1.0.0",
  "pipeline": {"path": "pipeline.json"},
  "lead_ops": {"id": "lead-ops", "version": "1.0.0", "path": "lead-ops.v1.json"},
  "create_adapter_catalog": {"id": "create-adapters", "version": "1.0.0", "path": "create-adapters.v1.json"}
}
```

`loadComposition` verifies that the manifest lead reference equals the existing pipeline `ops.subgraph`; it does not edit pipeline or lead graph files.

**Step 2: Define one closed adapter record**

The catalog references:

- `marketing-capabilities@1.0.0`;
- `marketing-assets@1.0.0`;
- `lead-ecosystem@1.0.0` for `approval_decision@1.0.0` and `operator_receipt@1.0.0`;
- one inline bounded invocation schema with no tenant/provider/model/URL/prompt/credential fields.

The renderer consumes a prepared bounded input derived from `asset_brief@1.0.0`; it does not mutate the recipe’s existing `network:none`, `spend:none`, or `live_adapters:[]` semantics.

**Step 3: Implement pure semantic validation**

Export:

```js
validateCreateAdapterCatalog(catalog, {
  recipeIds,
  marketingContractIds,
  authorityContractIds,
}) -> { valid, catalog_id, catalog_digest, adapter_ids }
```

Reject unknown keys, non-local references, inline secret values, shared secret binding names, any caller-owned routing field, or any execution authority beyond one review-only draft.

**Step 4: Run GREEN tests**

Run the Task 1 command until it reports zero failures, then run `npm run validate`.

**Step 5: Commit**

Commit the Task 1–2 files with the composition commit message.

### Task 3: Add failing renderer-domain and D1 state-machine tests

**Files:**

- Create: `workers/quests/src/marketing-renderer.test.ts`
- Modify: `workers/quests/src/migration.test.ts`

**Step 1: Specify the pure renderer API first**

Tests import these wished-for exports:

```ts
buildMarketingRenderAction(input): Promise<PreparedMarketingRenderAction>
parseMarketingPrepareInput(raw): MarketingPrepareInput | null
renderPreparedMarketingAction(prepared, approval, claim, config): Promise<RenderResult>
```

Input permits only request ID, idempotency key, actor, budget reservation, expiry, and bounded brief facts/digests. It rejects tenant, provider, model, URL, endpoint, raw prompt, generation parameters, credentials, unknown fields, confidential classifications, oversized text, duplicate claims, and malformed digests.

**Step 2: Specify exact action identity**

Tests prove the Worker-computed digest changes for every immutable field: tenant, request, adapter, catalog digest, recipe, provider, URL, model, fixed parameters, prompt-template digest, input digest, evidence digest, product digest, budget reservation, actor, idempotency key, expiry, or credential descriptor name.

**Step 3: Specify provider safety**

Tests prove:

- activation mismatch causes zero store calls and zero fetches;
- missing dedicated secret causes zero fetches;
- one authorized run sends the exclusive secret only in upstream memory;
- response output and recursively serialized store calls contain no secret;
- timeout/fetch exception becomes `indeterminate`;
- HTTP error, oversized body, or malformed content becomes terminal failed without raw body persistence;
- success normalizes only title/body/claim IDs into a review-only asset and redacted receipt.

**Step 4: Specify D1 migration parity and concurrency**

Migration/schema tests require prepared actions, immutable approvals, fixed tenant/adapter checks, unique tenant/idempotency key, one attempt, lease/fence fields, closed statuses, and artifact requirements. Store tests cover duplicate prepare, drift conflict, concurrent claim, reclaim only from expired `claimed`, no reclaim from `invoking`/`indeterminate`, stale fence refusal, invoking CAS readback, and terminal replay.

**Step 5: Run RED tests**

```bash
node --test workers/quests/src/marketing-renderer.test.ts workers/quests/src/migration.test.ts
```

Expected: FAIL because renderer module, migration, and D1 store are absent.

### Task 4: Implement the renderer domain and durable D1 authority

**Files:**

- Create: `workers/quests/src/marketing-renderer.ts`
- Create: `workers/quests/migrations/0005_marketing_create_renderer.sql`
- Modify: `workers/quests/schema/bridge.sql`
- Modify: `workers/quests/src/index.ts`

**Step 1: Implement strict input parsing and canonical digesting**

Construct all provider-routing fields inside `buildMarketingRenderAction`. Store the bounded input and digests, never the provider secret. Build the system prompt from a fixed template and user facts only after authority validation.

**Step 2: Implement the D1 interfaces**

```ts
prepare(input) -> prepared | duplicate | conflict
approvePrepared(requestId, founderId, now) -> approval | duplicate | conflict
getPrepared(requestId)
getApproval(approvalDecisionId)
claim(requestId, approvalDecisionId, claimId, lease) -> claimed | busy | terminal | reconciliation_required
beginInvocation(requestId, claimId, fence) -> confirmed | reconciliation_required
complete(requestId, claimId, fence, artifact, receipt)
fail(requestId, claimId, fence, errorCode)
markIndeterminate(requestId, claimId, fence, errorCode)
```

Every state update uses request ID, claim ID, and fencing token predicates. `beginInvocation` must perform a second read and compare all three values before returning confirmed.

**Step 3: Implement one bounded provider call**

Use one `AbortController`, the exact constants above, and no retry. Mark `invoking` durably before calling `fetch`. Treat any uncertainty after that point as reconciliation-required.

**Step 4: Run GREEN tests**

Run Task 3 tests until zero failures. Inspect `index.ts` to prove the new secret never enters `providers` or `contextRoutes`.

**Step 5: Commit**

Commit message: `feat(worker): add fenced fixed-tenant renderer`

### Task 5: Add failing prepare, signed-approval, execute, and replay route tests

**Files:**

- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Specify admin-only prepare**

Tests require `POST /v1/bridge/marketing-renders/prepare`, reject assignment/member credentials, reject body overrides, and return only safe action identity plus founder-gate next action.

**Step 2: Specify founder-signed approval**

Extend the existing Ed25519 fixture to post `kind=approve-marketing-render` to `/api/gate/thoughtseed`. Tests prove non-founder, stale, wrong tenant, bad signature, missing prepared action, and duplicate approval behavior.

**Step 3: Specify ID-only execute**

Tests require `POST /v1/bridge/marketing-renders/:id/execute` body to contain exactly `approvalDecisionId`. Approval JSON, tenant, provider, model, URL, prompt, secret, or any unknown field fails. Expired, rejected, mismatched, or missing persisted approval causes zero fetches.

**Step 4: Specify replay and crash boundaries**

Parallel identical execute calls perform one fetch. Completed replay returns the stored asset. `invoking` and `indeterminate` replay returns reconciliation-required. Ambiguous CAS/readback performs zero fetches.

**Step 5: Run RED tests**

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: new route tests fail because handler integration is absent.

### Task 6: Wire authenticated routes and founder approval

**Files:**

- Modify: `workers/quests/src/handler.ts`
- Modify: `workers/quests/src/index.ts`

**Step 1: Add renderer dependencies**

Add `marketingRenderer`, `marketingRenderStore`, and exact activation configuration to `HandlerDeps`. `index.ts` passes `NVIDIA_MARKETING_CREATE_API_KEY` directly into only this renderer configuration.

**Step 2: Wire prepare under the bridge admin principal**

The route runs only when `principal.admin === true`; assignment and member principals receive 403.

**Step 3: Wire signed founder approval**

Add `approve-marketing-render` to the existing gate kind union. After `validateInitData`, require tenant `thoughtseed`, load the prepared action, and call `approvePrepared` using the verified founder Telegram ID.

**Step 4: Wire ID-only execution**

Load prepared action plus stored approval, verify exact authority and expiry, claim D1, confirm durable invoking readback, perform the injected renderer call, and return a bounded asset/receipt. Never log request, draft, upstream response, or secret.

**Step 5: Run GREEN tests and commit**

Run the Task 5 command plus Task 3 tests. Commit message: `feat(worker): gate founder article rendering`

### Task 7: Document operator workflow and verify the complete branch

**Files:**

- Create: `docs/architecture/marketing-create-worker-renderer.md`
- Create: `docs/evidence/2026-07-18-marketing-create-worker-renderer.json`
- Modify: this plan only if implementation decisions changed materially

**Step 1: Write the operational runbook**

Document:

- issue a distinct NVIDIA key restricted to this renderer;
- from a trusted operator machine run `npx wrangler secret put NVIDIA_MARKETING_CREATE_API_KEY` interactively;
- never paste the key into EC2, repo files, Wrangler `vars`, requests, D1, logs, receipts, or evidence;
- inspect secret names only with `wrangler secret list`;
- set exact adapter-plus-catalog activation only in a separately reviewed deployment;
- prepare → signed founder approval → execute → review receipt;
- rotate by replacing the Worker secret with no EC2 change;
- rollback by removing activation or Worker version rollback;
- reconcile `invoking`/`indeterminate` manually before any new adapter version;
- provision a new immutable adapter version for provider/model changes.

**Step 2: Run targeted verification**

```bash
node --test bin/create-adapters.test.mjs bin/compose.test.mjs bin/marketing-orchestration.test.mjs workers/quests/src/marketing-renderer.test.ts workers/quests/src/migration.test.ts workers/quests/src/handler.test.ts
npm run validate
git diff --check
```

**Step 3: Run full verification**

```bash
npm test
```

Read the complete output and record exact pass/fail counts.

**Step 4: Run security and immutable-baseline audits**

Confirm:

- unchanged SHA-256 for pipeline, lead graph, lead catalog, and marketing recipe semantics;
- no added secret values, `.env`, Wrangler `vars`, deploy commands, migrations applied, or live provider calls;
- the dedicated secret name is absent from generic/context provider maps;
- all provider tests use injected offline fetch doubles;
- worktree ancestry and dirty-root hashes still match baseline.

**Step 5: Independent reviews**

Run Temperance read-only contract/secret and D1/concurrency audits. Re-dispatch failed external tasks to Codex reviewers. Obtain final spec-compliance review, then code-quality/security review.

**Step 6: Commit and publish review surface**

Commit docs/evidence as `docs(marketing): record renderer safety proof`, push `codex/marketing-create-worker-renderer`, and open a pull request based on `codex/marketing-capability-orchestration`. Do not merge or deploy.

