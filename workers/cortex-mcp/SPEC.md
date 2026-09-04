# SPEC-KIT: Stateless Cortex & Taste MCP + Telegram Capability-Hit Engine

**Document ID:** `SPEC-CORTEX-MCP-001`  
**Schema:** `thoughtseed.spec-kit.v1`  
**Status:** `RFC / Research-Grounded Specification`  
**Author:** Hermes / Cambium Engine Architecture  
**Target Repositories:** `Sheshiyer/cambium` (`workers/cortex-mcp`), `Sheshiyer/hermes-aws-ts`  
**Date:** 2026-09-04  

---

## 1. Specification Overview & Problem Statement

### 1.1 Context
In the Thoughtseed / Cambium architecture, **Cortex** is the shared memory and retrieval seam across the 5 finite operating organs (`Genesis`, `Taste`, `Hands`, `Will`, `Cortex`) and the 6 cognitive lifecycle organs (`Vestibule`, `Adytum`, `Nutrix`, `Auspex`, `Circulator`, `Praeceptor`).
Currently:
1. **Taste Cortex** (aesthetic prompts, techniques, media references, 231 blobs) is locked in local SQLite on EC2 (`embeddings.db`, 768-dim `@cf/baai/bge-base-en-v1.5`), queried via brute-force Python loop.
2. **Cambium Cortex** (1024-dim NVIDIA NIM) is provisioned on Cloudflare Vectorize (`cambium-cortex`), but resides on the legacy Personal CF account (CF-0 migration target `A17`).
3. **Telegram Capability Hits** (`telegram-capability-hit-system.v1.json`, reviewed 2026-09-03 in vault) defines a strict task-aware founder capability card with a mathematical threshold gate ($S \ge 0.68$) and silent refusal, but lacks an automated, stateless edge evaluator.

### 1.2 Objective
Build and deploy `workers/cortex-mcp`: a **stateless, read-only MCP (Model Context Protocol) server** hosted on Cloudflare Workers (Thoughtseed Labs account: `9d7cec1b5a32b2df8c6cdc1321ccd00b`), exposing:
- Semantic kNN search across Taste Cortex (768-dim).
- Tenant-isolated semantic recall across Cambium operator memory (1024-dim).
- Direct markdown blob retrieval from R2 storage.
- Task-aware capability hit evaluation against the 2026-09-03 selection formula.
- Authoritative organ atlas lookups for all 11 organs across the 9 canonical Telegram routes.

---

## 2. Research Spike & Architectural Constraints (Pre-Implementation)

Before mutating production Cloudflare resources or deploying code, 5 critical research questions must be answered and bounded:

### 🔬 Research Spike 1: Vectorize v2 API & Workers AI Binding Performance
- **Question:** Can `@cf/baai/bge-base-en-v1.5` run synchronously inside a Cloudflare Worker request handler with sub-50ms latency before piping into Vectorize query?
- **Grounding:**
  - Workers AI text embedding input shape: `env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [query] })`.
  - Output vector format: `res.data[0]` (array of 768 floats).
  - Vectorize v2 query: `env.TASTE_CORTEX.query(queryVector, { topK, returnMetadata: 'all', filter })`.
- **Constraint:** Free tier Cloudflare Workers AI has burst limits. The MCP must handle 429/timeout gracefully and fallback to cached R2/KV metadata if necessary.

### 🔬 Research Spike 2: Dual Vector Index Dimension Segregation
- **Question:** Why can't Taste Cortex (768-dim) and Cambium Cortex (1024-dim) be combined into a single index?
- **Finding:** Cloudflare Vectorize enforces strict fixed dimension schemas upon index creation. An index created with `--dimensions=1024` hard-fails on 768-dim vector queries.
- **Architectural Decision:** Two separate Vectorize bindings:
  1. `TASTE_CORTEX`: 768 dimensions, cosine metric, metadata on `category`, `author`, `slug`.
  2. `CAMBIUM_CORTEX`: 1024 dimensions, cosine metric, metadata on `tenant`, `kind`.

### 🔬 Research Spike 3: R2 Blob Storage vs In-Memory Vector Metadata
- **Question:** Should full blob markdown be stored inside Vectorize metadata or R2?
- **Finding:** Vectorize metadata has a strict **10 KiB per vector** limit. Markdown files for techniques and prompts frequently reach 15–30 KiB.
- **Architectural Decision:** Vectorize metadata stores only indices (`category`, `author`, `title`, `slug`, `content_hash`). Full content is stored in R2 bucket `thoughtseed-context-projections` at key `taste/{category}/{slug}.md`. The MCP provides `taste_cortex_get_blob` to fetch directly from R2.

### 🔬 Research Spike 4: MCP Protocol over HTTP (Streamable JSON-RPC)
- **Question:** How do agents connect to an MCP server running on Cloudflare Workers without persistent WebSocket/SSE connections?
- **Finding:** Modern MCP clients (including Hermes native MCP and Claude Code) support HTTP POST JSON-RPC (`tools/list`, `tools/call`).
- **Constraint:** Stateless HTTP execution matches the Cloudflare Worker serverless isolate model perfectly. Zero session stickiness, zero shared memory between requests.

### 🔬 Research Spike 5: Whitepaper Authority & Mutation Boundaries
- **Grounding (`infinite-engine-full.html` & `cambium-temperance-organ-atlas.md`):**
  - "Cortex retrieval can help an operator reason; it cannot revise Vision, Mission, ISA acceptance, GSD planning, or D1 status."
  - "A provider catalog may list future tools while granting network authority to none."
- **Enforcement:** `cortex-mcp` has **zero D1 write bindings**. It possesses no database write authority. It is physically impossible for the MCP to mutate operational state.

---

## 3. End-to-End Infra-Flow Architecture

```
                       ┌────────────────────────────────────────────────────────┐
                       │                     CLIENT PLANE                       │
                       │   Hermes Desktop / OpenCode / Claude Code / Telegram   │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                     HTTP POST JSON-RPC 2.0
                                (Bearer CONTEXT_ROUTE_TOKEN)
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │           CLOUDFLARE WORKERS EDGE (LABS)               │
                       │                 workers/cortex-mcp                     │
                       │             (cortex.thoughtseed.space)                 │
                       └─────┬───────────────────┬───────────────────┬──────────┘
                             │                   │                   │
         1. Embed Query      │                   │ 2. Scored kNN     │ 3. Fetch Full Text
               ▼             │                   ▼                   ▼
    ┌──────────────────────┐ │      ┌──────────────────────┐ ┌──────────────────────┐
    │  Cloudflare AI       │ │      │ Cloudflare Vectorize │ │ Cloudflare R2        │
    │  @cf/baai/bge-base   │ │      │                      │ │                      │
    │  (768-dim Float32)   │ │      │ • taste-cortex (768) │ │ thoughtseed-context- │
    └──────────────────────┘ │      │ • cambium-cortex     │ │ projections          │
                             │      │   (1024-dim NIM)     │ │                      │
                             │      └──────────────────────┘ └──────────────────────┘
                             │
                             │ 4. Read Active Tasks / State
                             ▼
                    ┌──────────────────────┐
                    │ Cloudflare D1        │
                    │ cambium-bridge       │
                    │ (READ-ONLY Query)    │
                    └──────────────────────┘
```

### Detailed Execution Trace (e.g. `taste_cortex_query`):
1. **Client Request:** Hermes issues MCP `tools/call` for `taste_cortex_query` with `{"intent": "luxury dark brutalist motion"}`.
2. **Workers AI Ingestion:** Worker passes intent text to `@cf/baai/bge-base-en-v1.5`. Sub-40ms generation of 768-dimensional float array.
3. **Vectorize Edge Lookup:** Vector array passed to `env.TASTE_CORTEX.query()` with `topK: 6, returnMetadata: 'all'`. Vectorize traverses index trees via cosine similarity.
4. **Metadata Assembly:** Matches returned with IDs, scores, and lightweight metadata (slug, author, title, category).
5. **Response:** Sanitized JSON-RPC response returned to client.

---

## 4. Work Breakdown & Task Decompositions (Spec-Kit Style)

```
Phase 1: Research & Pre-Flight Validation ───────────────────── [x]
Phase 2: Edge Infrastructure Provisioning (Cloudflare Labs) ─── [ ]
Phase 3: Data Migration & R2 Hydration ──────────────────────── [ ]
Phase 4: Stateless MCP Implementation & Test Suite ──────────── [x]
Phase 5: Cloudflare Deployment & Access Verification ────────── [ ]
Phase 6: Hermes Native Integration & Capability Routing ─────── [ ]
```

### 📋 Phase 1: Research & Grounding (COMPLETED)
- [x] **T1.1:** Audit live vault whitepaper review cut (2026-09-03) via Obsidian MCP.
- [x] **T1.2:** Map the 5 Cambium + 6 Temperance organs and their authority fences.
- [x] **T1.3:** Extract and verify `telegram-capability-hit-system.v1.json` scoring contract.
- [x] **T1.4:** Export all 231 Taste Cortex blobs into `taste-blobs-manifest.json`.

### 📋 Phase 2: Cloudflare Labs Edge Provisioning
- [ ] **T2.1:** Verify Cloudflare Labs Account credentials (`CLOUDFLARE_ACCOUNT_ID=9d7cec1b5a32b2df8c6cdc1321ccd00b`).
- [ ] **T2.2:** Provision Vectorize index `taste-cortex` (768-dim, cosine):
  ```bash
  npx wrangler vectorize create taste-cortex --dimensions=768 --metric=cosine
  ```
- [ ] **T2.3:** Provision Vectorize metadata indexes on `taste-cortex`:
  ```bash
  npx wrangler vectorize create-metadata-index taste-cortex --property-name=category --type=string
  npx wrangler vectorize create-metadata-index taste-cortex --property-name=author --type=string
  ```
- [ ] **T2.4:** Verify `cambium-cortex` (1024-dim) replication status on Labs account (per CF-0 `A17`).
- [ ] **T2.5:** Configure R2 bucket `thoughtseed-context-projections` binding in `wrangler.jsonc`.

### 📋 Phase 3: Data Ingestion & Storage Pipeline
- [ ] **T3.1:** Write bulk ingestion script `scripts/ingest-taste-vectorize.ts`:
  - Batches 231 items from `taste-blobs-manifest.json` in chunks of 25.
  - Calls Cloudflare Workers AI embedding for each blob text.
  - Uploads vectors + metadata to `taste-cortex`.
- [ ] **T3.2:** Write R2 mirroring script `scripts/sync-blobs-to-r2.ts`:
  - Uploads raw markdown files to `r2://thoughtseed-context-projections/taste/{category}/{slug}.md`.
- [ ] **T3.3:** Run readback verification script to assert 231 vectors exist and match content hashes.

### 📋 Phase 4: MCP Core Implementation & Verification (COMPLETED IN CODE)
- [x] **T4.1:** Scaffold Worker structure in `workers/cortex-mcp` with `@modelcontextprotocol/sdk`.
- [x] **T4.2:** Implement `organ-atlas.ts` containing typed definitions for all 11 organs.
- [x] **T4.3:** Implement `capability-hits.ts` implementing the mathematical selection formula ($S \ge 0.68$) and silent refusal logic.
- [x] **T4.4:** Implement `index.ts` mounting the 6 MCP tools over HTTP JSON-RPC 2.0.
- [x] **T4.5:** Write comprehensive test suite in `src/mcp.test.ts` (4/4 tests green).

### 📋 Phase 5: Deployment & DNS Routing
- [ ] **T5.1:** Execute staging deployment:
  ```bash
  cd workers/cortex-mcp && npx wrangler deploy --config wrangler.jsonc
  ```
- [ ] **T5.2:** Bind custom domain route `cortex.thoughtseed.space` in Cloudflare DNS.
- [ ] **T5.3:** Configure Cloudflare Access service token policy for `cortex.thoughtseed.space` (or Bearer token validation matching `CONTEXT_ROUTE_TOKEN`).
- [ ] **T5.4:** Probe edge health endpoint `GET https://cortex.thoughtseed.space/health` $\to$ `200 OK`.

### 📋 Phase 6: Hermes & Multi-Agent Consumption
- [ ] **T6.1:** Register `cortex-mcp` in `/home/ubuntu/.hermes/config.yaml`:
  ```yaml
  mcp_servers:
    cortex:
      url: https://cortex.thoughtseed.space/mcp
      headers:
        Authorization: Bearer ${CONTEXT_ROUTE_TOKEN}
  ```
- [ ] **T6.2:** Verify Hermes tool discovery via `tool_search(queries=['taste_cortex_query', 'organ_atlas_lookup'])`.
- [ ] **T6.3:** Wire capability hit evaluation into Hermes Telegram cron jobs (`digests` topic).
- [ ] **T6.4:** Record complete execution and deployment receipt in `thoughtseed-vault`.

---

## 5. Security & Boundary Fences

| Boundary Concern | Mechanism | Hard Constraint |
|---|---|---|
| **Operational Mutation** | No D1 Write Bindings | Worker environment only binds read-only D1/Vectorize/R2. Cannot insert/update Goal Graph. |
| **Tenant Isolation** | Forced Query Filter | `semantic_recall` strictly enforces `{ tenant: { $eq: tenant } }` on Vectorize. Overrides rejected. |
| **Data Leakage** | Payload Truncation & Redaction | Output bodies run through `redactObviousSecrets()`; raw vectors are never returned (`omitted.rawVectors=true`). |
| **Noise & Broadcast** | Silence on Low Confidence | Capability hits with score $< 0.68$ return structured refusal; zero Telegram traffic. |
| **Account Segregation** | Labs Pinned (`9d7cec1b...`) | Built natively on Labs Cloudflare account to eliminate future relocation debt. |

---

## 6. Acceptance Criteria

1. `npx wrangler vectorize info taste-cortex` reports `vectorCount: 231`.
2. Calling `taste_cortex_query` with `"luxury brutalist motion"` returns $\ge 3$ relevant scored blobs with cosine similarity $> 0.70$.
3. Calling `taste_cortex_get_blob` returns verbatim markdown matching local disk source.
4. Calling `semantic_recall` with an unlisted tenant throws `Unauthorized tenant`.
5. Calling `capability_hit_evaluate` with an irrelevant task returns `refusalReason: "score_below_threshold_silence_preferred"`.
6. Node.js unit test suite runs clean with 100% pass rate.
