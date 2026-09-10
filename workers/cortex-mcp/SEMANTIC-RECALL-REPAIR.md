# Operator semantic recall repair

Landed on PR 370 after Mini-4 review. Hosted `nvidia/nv-embedqa-e5-v5` reached EOL 2026-08-25 (integrate.api.nvidia.com HTTP 410). Operator recall now uses the surviving NVIDIA text embedder `nvidia/nemotron-3-embed-1b` (native 2048-d). Cloudflare Vectorize rejects dimensions above 1536, so the Worker stores NVIDIA's documented first-1024 slice after L2-normalize in Vectorize `cambium-cortex-n3`. The original `cambium-cortex` 1024-d e5 index stays frozen (82 vectors, tenant `cambium`) and remains the `cambium-quests` binding — do not mix producers in one index. Taste stays on 768-d Workers AI. MCP `/mcp` requires `CONTEXT_ROUTE_TOKEN`.

The failing regression calls the actual Worker MCP handler and demonstrates the
768-dimensional Taste embedder being passed to the 1024-dimensional operator
index. The candidate routes `semantic_recall` through the existing
`createProviderEmbedder` seam from `workers/quests/src/context-bindings.ts`, using
the live operator producer model `nvidia/nemotron-3-embed-1b` and its query
input contract. Taste stays on its existing 768-dimensional Workers AI path.

The Worker requires an explicit `CORTEX_EMBED_MODEL=nvidia/nemotron-3-embed-1b`
setting, a 1024-d `CAMBIUM_CORTEX` binding (`cambium-cortex-n3`), and a
Worker-owned `NVIDIA_API_KEY` secret. Native embeddings must be 2048-d; the
stored query vector is the first 1024 dimensions, L2-normalized. Do not write
those slices into the frozen e5 `cambium-cortex` index. Unconfigured, unauthorized,
malformed-vector and provider-error paths return bounded unavailable results;
no zero-padding, dummy vector or silent fallback is used. Results enforce tenant/kind again at the
readback boundary and return allowlisted metadata rather than raw payloads.

The response is a status envelope with `hits`, `embedding_model`, `dimensions`
and `mutation_enabled:false`; any client that assumed a bare match array must be
updated/reviewed before deployment.

## Checks

```bash
cd workers/cortex-mcp
node --experimental-strip-types --test src/*.test.ts
node_modules/.bin/tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions --skipLibCheck src/semantic-recall.ts
```

Mocks in tests are synthetic fixtures only. No production known-record recall or
embedding request was made by these tests. Real acceptance must verify the exact
Cloudflare account, index dimensions, metadata indexes, existing corpus model
and vector population before an approved source/version deployment. Historical
operator code can emit stub vectors on errors; inspect actual corpus provenance
rather than treating dimension equality as sufficient. Any re-ingestion needs
its own sanitized source allowlist and approval. Never populate the index with
private vault dumps or raw prompt/session bodies.

Keep current deployment/version and secret-state rollback receipts before any
change. After deployment, retrieve a known approved record, prove tenant-negative
behavior, and verify Taste non-regression. A healthy binding check is insufficient.
