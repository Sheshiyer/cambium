# Implementation Plan: Stateless Cortex & Taste MCP + Telegram Capability-Hit Engine

**Status:** Updated & Grounded against Vault Whitepaper (2026-09-03 Review Cut)  
**Target Repository:** `Sheshiyer/cambium`  
**Deploy Path:** `workers/cortex-mcp` (Cloudflare Workers, Thoughtseed Labs Account: `9d7cec1b5a32b2df8c6cdc1321ccd00b`)  
**Authority Reference:** `20-operations/growth/whitepaper/` (Obsidian Vault via Local REST API / HTTPS Tunnel)  
**Date:** 2026-09-04  

---

## 1. Deep Pass Insights from the Vault (2026-09-03 Review Cut)

The live Obsidian MCP connection to `/Volumes/madara/2026/Projects/thoughtseed/thoughtseed-labs/20-operations/growth/whitepaper` revealed crucial architecture contracts updated on **2026-09-03** that directly elevate the Stateless MCP implementation:

### 1.1 The Dual Organ Hierarchy (5 Cambium + 6 Temperance)
The internal organ atlas (`cambium-temperance-organ-atlas.md`) defines the complete split between operating and cognitive bodies:
- **5 Cambium Operating Organs:**
  1. `Genesis` (Brand intake, brief formation, non-operational output).
  2. `Taste` (Evaluator/conscience, acceptance checks, spend-gated).
  3. `Hands` (Skill-cluster resolver, execution envelopes, tests).
  4. `Will` (Governed GTM, C-suite desks, strictly approval-gated).
  5. `Cortex` (Cross-cutting evidence retrieval, derived memory, foldback proposals).
- **6 Temperance Cognitive Lifecycle Organs:**
  1. `Vestibule` (Orientation at session start, reads federated memory).
  2. `Adytum` (Inner chamber, subconscious next-action card across 4 planes).
  3. `Nutrix` (Harvests session learning at session end into local signals).
  4. `Auspex` (Substrate health probes, heal reports, failure classification).
  5. `Circulator` (Weekly synthesis, recommendation ranking, review queues).
  6. `Praeceptor` (Daily advisory drafts under `PROPOSED/`, fence-enforced).
- **Support Surfaces:**
  `VAS` (manifest bridge), `Athanor` (notifications), `Mercurius/OmniRoute` (model transport), `Speculum` (glass projection), `Constellation` (companion view).

### 1.2 The Telegram Capability-Hit Contract (`thoughtseed.telegram-capability-hit-system.v1`)
A task-aware capability relay that transforms how agents interact with the founder:
- **Operating Promise:** "When there is a current, source-backed task, the system may prepare one founder-only capability card. If there is no active task, only stale/no-signal evidence, a route mismatch, or an external action without a gate, the correct output is **silence**."
- **Selection Formula:** `0.35 relevance + 0.20 freshness + 0.15 readiness + 0.15 ownerMatch + 0.10 novelty + 0.05 evidenceQuality` (Threshold: `0.68`).
- **Deduplication:** `sha256(schema + capabilityId + taskFingerprint + topicKey + cadenceWindow + sourceDigest)`.
- **Topic Map Alignment (9 canonical routes):**
  `hermes`, `digests`, `dev`, `inbox`, `calendar`, `agent_ops`, `alerts`, `clients`, `adytum`.

### 1.3 Memory Doctrine & Prohibited Capabilities
From `infinite-engine-full.html` and `organ-update-delivery-v1.md`:
- "A provider catalog may list future tools while granting network authority to none."
- "Cortex retrieval can help an operator reason; it cannot revise Vision, Mission, ISA acceptance, GSD planning, or D1 status."
- Transport receipts (`sent`) $\neq$ semantic proof ($\text{completed}$).
- Manifest bridge health must be verified, never assumed.

---

## 2. Stateless Cloudflare MCP Architecture (`workers/cortex-mcp`)

To expose the Cortex organ without violating doctrine, the MCP server is designed as a **strictly read-only, retrieval, and capability-proposal engine**.

### 2.1 Edge Bindings (Cloudflare Labs Account `9d7cec1b5a32b2df8c6cdc1321ccd00b`)
- `AI`: `@cf/baai/bge-base-en-v1.5` (native 768-dim embeddings for Taste).
- `TASTE_CORTEX`: Vectorize index `taste-cortex` (768-dim, cosine, metadata on `category`, `author`, `slug`).
- `CAMBIUM_CORTEX`: Vectorize index `cambium-cortex` (1024-dim, cosine, metadata on `tenant`, `kind`).
- `TASTE_BLOBS`: R2 bucket `thoughtseed-context-projections` (stores raw `.md` content for payload resolution).
- `BRIDGE_DB`: D1 database `cambium-bridge` (read-only queries for active task fingerprints).

---

## 3. Tool Surface Definition (Enhanced Context)

The MCP server exposes 6 high-signal tools:

### Tool 1: `taste_cortex_query`
- **Purpose:** Search 231 curated aesthetic references (prompts, techniques, media-refs).
- **Inputs:** `intent` (string), `category` (optional enum: prompts, techniques, media-refs), `top_k` (number, default: 6).
- **Execution:** Generates 768-dim embedding via Workers AI $\to$ Vectorize kNN query on `taste-cortex` $\to$ returns scored matches.

### Tool 2: `taste_cortex_get_blob`
- **Purpose:** Fetch full markdown text and frontmatter of a design reference.
- **Inputs:** `id` (string), `category` (enum).
- **Execution:** Resolves key `taste/{category}/{id}.md` against R2 `TASTE_BLOBS`.

### Tool 3: `semantic_recall`
- **Purpose:** Retrieve past operator situations, why-handler errors, and decisions.
- **Inputs:** `tenant` (string, validated against allowlist), `query` (string), `kind` (optional enum: decision, evidence, handoff, heartbeat, memory, note, routine, standup, task), `top_k` (number).
- **Execution:** Generates embedding $\to$ Vectorize kNN query on `CAMBIUM_CORTEX` with `{ tenant: { $eq: tenant } }` enforced.

### Tool 4: `capability_hit_evaluate`
- **Purpose:** Evaluates whether a capability card should be proposed for a current task based on the 2026-09-03 selection formula.
- **Inputs:**
  - `taskSummary` (string)
  - `topicKey` (enum across the 9 canonical topics)
  - `candidateCapabilities` (array of organ capability IDs, e.g. `cambium.taste`, `temperance.adytum`)
- **Execution:** Runs the scoring contract (`0.35 rel + 0.20 fresh + 0.15 ready + 0.15 owner + 0.10 novelty + 0.05 evidence`). If score $\ge 0.68$, returns the rendered card format (`CAPABILITY HIT`, `TASK`, `CAN DO NOW`, `WHY THIS IS RELEVANT`, `NEXT`, `BOUNDARY`, `EVIDENCE`, `PROVENANCE`). If $< 0.68$, returns structured **silence refusal** (`refusalReason: "score_below_threshold"`).

### Tool 5: `organ_atlas_lookup`
- **Purpose:** Authoritative lookup of any of the 5 Cambium or 6 Temperance organs.
- **Inputs:** `organId` (e.g. `cambium.will`, `temperance.praeceptor`).
- **Execution:** Returns role, inputs, outputs, canDo, cannotDo, handoffs, and topic routes directly from the atlas.

### Tool 6: `cortex_health`
- **Purpose:** Probes Vectorize indexes, Workers AI, R2, and D1 readiness.

---

## 4. Phase-by-Phase Execution Roadmap

### Phase 1: Repository Scaffolding & Contract Verification (Complete)
- [x] Scaffolding created in `/home/ubuntu/repos/cambium/workers/cortex-mcp`.
- [x] `package.json`, `wrangler.jsonc`, and base `src/index.ts` written.
- [x] Extracted 231 taste blobs into `taste-blobs-manifest.json`.

### Phase 2: Ingest Taste Cortex to Cloudflare (Labs Account)
1. Provision `taste-cortex` on Cloudflare Vectorize:
   ```bash
   wrangler vectorize create taste-cortex --dimensions=768 --metric=cosine
   wrangler vectorize create-metadata-index taste-cortex --property-name=category --type=string
   wrangler vectorize create-metadata-index taste-cortex --property-name=author --type=string
   ```
2. Ingest 231 vectors from `taste-blobs-manifest.json` via Workers AI batch embedding or bulk NDJSON upload.
3. Mirror the markdown files to R2 bucket `thoughtseed-context-projections` under prefix `taste/`.

### Phase 3: Implement Capability Hit Evaluator & Organ Atlas
1. Port `telegram-capability-hit-system.v1.json` scoring and refusal logic into `workers/cortex-mcp/src/capability-hits.ts`.
2. Port organ definitions from `cambium-temperance-organ-atlas.md` into `workers/cortex-mcp/src/organ-atlas.ts`.
3. Mount the MCP endpoints (`tools/list`, `tools/call`) handling JSON-RPC over Streamable HTTP.

### Phase 4: Staging Deployment & Hermes Verification
1. Deploy worker to `cortex-mcp.thoughtseedlabs.workers.dev` (and custom domain `cortex.thoughtseed.space`).
2. Add `cortex-mcp` to `/home/ubuntu/.hermes/config.yaml` as a native MCP server:
   ```yaml
   mcp_servers:
     cortex:
       url: https://cortex.thoughtseed.space/mcp
       headers:
         Authorization: Bearer ${CONTEXT_ROUTE_TOKEN}
   ```
3. Test tool discovery and end-to-end execution from Hermes desktop.

---

## 5. Verification Gates
- **G1 (Zero Operational Writes):** Proved by test that `cortex-mcp` makes zero D1 `INSERT`/`UPDATE` calls; all writes are held behind Cambium Goal Graph Gate.
- **G2 (Hermetic Tenant Isolation):** Querying with `tenant: "codigo-olimpo"` never returns `cambium` or `thoughtseed` records.
- **G3 (Silence on Low Signal):** `capability_hit_evaluate` returns silent refusal when task relevance $< 0.68$.
- **G4 (Zero-Dependency Latency):** Sub-150ms round-trip for `taste_cortex_query` directly against edge Vectorize + Workers AI.
