# Hermes receipt v2: native 768 replacement approval packet

The real approved admin-self growth request returned a durable draft, but its
runner is correctly holding ACK at `outcome_posted`: legacy Cortex embedding
returns provider HTTP 410. The configured `nvidia/nv-embedqa-e5-v5` hosted endpoint
is deprecated. This candidate gives **only the original runner's canonical
terminal growth receipts** a separate embedding space. It does not replace or
re-embed the existing Cortex index.

The prior 2048-dimensional NVIDIA plan is infeasible: Cloudflare rejected index creation with code 3003, supported range 32–1536. Independent readback confirmed no index. No Worker or runner changed. This replacement requires fresh approval because model, bundle, dimensions and binding additions changed.

## Exact reviewed candidate

- Source commit: `3851c65dfaeecf3ab73756fe635f5af6dd4e7e14`.
- Compiled `index.js` SHA-256:
  `88c2788e875a5fc49bd4c2ce6e265cb847ab0d924e4268b1556a32e160ad4131`.
- Verification: 526/526 focused and boundary tests; Wrangler 4.124.0 dry-run
  compilation passes. The preserved authorization, redaction and float32 readback boundaries were
  previously reviewed independently; the replacement binding adapter is covered
  by focused shape/value and invocation tests.
- No new index, uploaded version, production promotion, or runner URL change has
  been performed for this candidate. Production remains the approved growth
  version `b33a1a6e-6edc-412d-b974-10e437379dc0`.

## Exact resource and configuration additions

```json
{
  "index": {
    "name": "cambium-hermes-receipts-v2",
    "dimensions": 768,
    "metric": "cosine"
  },
  "workerOverlay": {
    "vectorize": [{
      "binding": "CAMBIUM_HERMES_RECEIPTS_V2",
      "index_name": "cambium-hermes-receipts-v2"
    }],
    "ai": {"binding": "HERMES_RECEIPTS_AI"},
    "vars": {"HERMES_RECEIPTS_V2_ENABLED": "true"}
  },
  "runnerOverlay": {
    "HERMES_CORTEX_INGESTION_URL": "https://curious.thoughtseed.space/v1/context/hermes-receipts"
  }
}
```

These are additive overlays, **not replacement configuration files**. Preserve
all 43 current Worker bindings, including growth limits 3 pending/10 daily,
all secrets, runtime date `2026-05-01`, `nodejs_compat`, routes, logging, and
schedules. The dedicated AI binding, new index binding and feature flag make 46 bindings. Keep the existing
`CAMBIUM_CORTEX` binding and legacy embedding configuration byte-for-byte.

The feature defaults off. Missing flag, AI binding, D1 authority, new index, or vector
readback support fails closed. There is no fallback to the legacy index. The
existing protected Cortex ingestion credential is reused; no credential rotates.
No D1 migration is required.

## Fixed semantic-space contract

- Model: `@cf/baai/bge-base-en-v1.5`.
- Provider: Cloudflare Workers AI through dedicated `HERMES_RECEIPTS_AI` binding.
- Native dimensions: 768; finite, nonzero float32 values. No truncation or splitting.
- Space ID: `cloudflare-bge-base-en-v1.5-768-hermes-receipts-v2`.
- Dedicated protected route: `POST /v1/context/hermes-receipts`.
- Exact runner member `hermes-runner`, runner ID `hermes-ec2-runner-01`, tenant `cambium`.

A public-input probe using the Labs account returned HTTP 200, shape `[1,768]`,
768 finite nonzero values in 481ms. No private content or credentials were recorded.
The native Workers AI invocation pins the model argument; its result returns
shape/data rather than a model identity. The adapter checks that exact shape and
values and rejects a conflicting model field if one is present.

Cloudflare documents [the native 768 model and 512-token input limit](https://developers.cloudflare.com/workers-ai/models/bge-base-en-v1.5/),
[Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/),
[Vectorize's 1536-dimension maximum](https://developers.cloudflare.com/vectorize/platform/limits/),
and [Vectorize readback value types](https://developers.cloudflare.com/vectorize/reference/client-api/).
The fixed canonical receipt contains only terminal IDs, times, digests and a
bounded error code; growth prose and vault excerpts are excluded before embedding.

## Admission, redaction, and storage proof

A valid Cortex ingestion credential is checked before any provider request. The
new route accepts only evidence from `hermes-runner`, path
`executions/exec_<32 lowercase hex>`, and matching `hermes:<execution ID>`
idempotency key. Unknown fields and other tenants are rejected.

D1 must contain the original runner's terminal growth execution and matching
immutable directive. The Worker reconstructs the exact redacted receipt from
that attestation and compares the submitted content before embedding. Arbitrary
chat text, canonical vault notes, or model-supplied receipt prose cannot pass.

The embedder invokes the fixed model and verifies shape, exact dimensions, finite float32
range, and a nonzero vector. Upsert metadata pins the source, content digest,
model, dimensions, index, and space. An `ingested` receipt is returned only after
`getByIds` independently reads the same vector IDs, metadata, and float32-
quantized values. Delayed indexing or a mismatch returns 502 and preserves ACK
hold. Retried writes retain deterministic IDs.

Legacy `/v1/context/cortex-ingest` and semantic recall keep their current
embedding space. **There is no semantic-query route for the new receipt index in
this change.** This is receipt ingestion and verified storage, not a claim of
new-space semantic retrieval.

## Approved rollout sequence

Proceed only after the owner approves this exact source/bundle/configuration
packet. Approval applies only to the immutable uploaded version independently
verified against these exact source, bundle and configuration pins. Stop on an
unexplained mismatch before changing traffic.

1. Refresh production traffic and bindings. Expect growth version `b33a1a6e` at
   100%, 43 bindings, and the existing legacy index at 1024/cosine. Stop on an
   unexplained mismatch. Record the pending original request/attempt/phase.
2. Create exactly `cambium-hermes-receipts-v2`, 768 dimensions, cosine, using the
   explicit `thoughtseed-labs` account/profile. Do not modify or delete an
   existing index. Confirm the new index configuration independently.
3. Compile the pinned source and compare the exact bundle hash above. Upload
   with a live-preserving overlay plus only the three approved additions. Record
   the resulting immutable version ID and independently compare all bindings,
   runtime settings, and exact bundle/source pins before any traffic change.
4. Under the owner approval for this pinned packet, promote only the resulting
   version whose immutable source, bundle and settings readback match step 3.
   Read back 100% traffic and all preserved settings.
5. Change only `HERMES_CORTEX_INGESTION_URL` to the new route. Keep global native
   execution disabled, growth-only execution enabled, and legacy ACK disabled.
   Keep current protected tokens and the immutable runner source.
6. Let the existing `outcome_posted` execution retry ingestion. Do not submit
   another draft, regenerate model output, reset local state, or manually ACK.
7. Read back the new-space vectors/metadata and stored receipt. Verify the same
   original execution remains attempt 1, the local phase advances, and
   `bridge_directives.delivered=1` with `delivered_at` populated. The unused
   `bridge_executions.acknowledged_at` column is not ACK proof.
8. Re-read the original requesting member's draft and confirm its output digest
   is unchanged. Native UI and ordinary-employee acceptance remain separate.

## Rollback and limits

Rollback traffic to `b33a1a6e-6edc-412d-b974-10e437379dc0` and restore the prior
runner ingestion URL. Retain the new index and any receipt vectors for audit;
do not delete vectors, the additive growth table, task results, or execution
history. The legacy endpoint's known 410 will hold ACK again, which is safer
than bypassing receipt storage. No existing provider configuration, credentials, DNS, client project,
publication, vault policy, or legacy semantic-space migration is included.
