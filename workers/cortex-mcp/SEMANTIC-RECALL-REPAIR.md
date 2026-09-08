# Operator semantic recall repair

Landed on PR 370 after Mini-4 review. Operator recall uses the producer 1024-d NIM path; Taste stays on 768-d Workers AI. MCP `/mcp` requires `CONTEXT_ROUTE_TOKEN`. Live secret provision, known-record ingest, and edge deploy remain separate gates.

The failing regression calls the actual Worker MCP handler and demonstrates the
768-dimensional Taste embedder being passed to the 1024-dimensional operator
index. The candidate routes `semantic_recall` through the existing
`createProviderEmbedder` seam from `workers/quests/src/context-bindings.ts`, using
the documented operator producer model `nvidia/nv-embedqa-e5-v5` and its query
input contract. Taste stays on its existing 768-dimensional Workers AI path.

The Worker requires an explicit `CORTEX_EMBED_MODEL=nvidia/nv-embedqa-e5-v5` setting
and a Worker-owned `NVIDIA_API_KEY` secret. Neither is provisioned by this patch.
Unconfigured, unauthorized, malformed-vector and provider-error paths return
bounded unavailable results; no zero-padding, replacement embedding model, dummy
vector or silent fallback is used. Results enforce tenant/kind again at the
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
