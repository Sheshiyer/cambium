# Lead ecosystem integration review — contract-first, not ad hoc

> **Status (2026-07-18):** review complete; integration sequenced as L0–L5 below. Nothing in this
> document authorizes a live wire by itself — every L-wire lands behind the same fail-closed spend
> and approval gates as the existing I-wires.

## 1. Why this review exists

The lead ecosystem (iBerev/Expelli, AISEO, GEO + the subscribed tool stack) has been mapped
visually (Lead Ecosystem Map widget). This review audits that map against the **actual** Cambium
composition layer so integration proceeds as declared contracts — not ad-hoc wires.

## 2. What already exists (verified inventory)

### 2.1 The composition layer (this repo)

| Artifact | State | Verified |
|---|---|---|
| `registry.json` | 5 organs — genesis, hands, taste (paid), will (paid), cortex (paid) | ✅ read |
| `adapters.json` | 4 live adapters (genesis/hands `spend: none`, taste/will `spend: gated`) + 1 disabled rollback | ✅ read |
| `composition/pipeline.json` | 4 stages genesis→taste→build→ops + cross-cutting cortex | ✅ read |
| `composition/CONTRACTS.md` | stage I/O + variable contract vocabulary (7 groups) | ✅ read |
| `bin/compose.mjs` + `bin/lib/invoke.mjs` | plan/validate/run; fail-closed spend gate; `runPipeline` output→input threading | ✅ per INTEGRATION.md |
| I1 brand→GTM | **shipped** — snow-gloves PR #4 | ✅ per INTEGRATION.md |
| I2a genesis / I2b hands as services | wired, `spend: none`, run live | ✅ per INTEGRATION.md |
| I2c taste as a service | wired, approval-gated | ✅ per INTEGRATION.md |
| I3 unified cortex | client interface shipped; unifying Worker pending | 🟡 partial |
| I4 homeostasis | why-handler wired; checks `json:*` shape drift only; cortex-write stubbed | 🟡 partial |

### 2.2 The product-branch packet system (the tenant manifest already exists)

`docs/plans/product-branches/` + `schema.json` (`cambium.product_branch_packet.v1`) + local
fail-closed validator (`npm run validate:product-branches`). Each packet already declares:
Product Seed, Organ Routing, Variable Contract Payload, Adapter/Service Map, Evidence Ledger,
Gate Ledger, Quest Queue, **Loop Control Inputs** (cadence, stop rule, state file), KPI, Policy /
Permission, Dispatch Inputs, Proof Foldback, and the promotion ladder
`proof-only -> supervised branch -> autonomous branch`.

Current packets: `fitcheck` (supervised), `vantyx` (supervised), `snow-gloves-os` (organ-service),
`iverif` (proof-only). **No packet exists for iBerev, AISEO, or GEO.**

### 2.3 The Explee wire already runs inside `will`

`adapters.json → will` invokes `scripts/lib/gtm.py brand_to_gtm` — **paid Explee search/enrich via
the explee-proxy, approval-gated** (`EXPLEE_PROXY_TOKEN`, approved Brief required). Explee is not a
new integration; it is an existing gated capability currently trapped inside one organ's GTM
function.

## 3. The lead ecosystem as mapped

Six lead stages as a per-tenant decomposition of the `ops` stage:

`discover → capture → enrich → understand → create → engage`

Four lanes: **iB** (iBerev/Expelli), **AS** (AISEO), **GE** (GEO), **SH** (shared stack).
Four adapter layers: **internal organ** / **API-MCP** (ours) / **third-party SaaS** / **external source**.

| Tool | Layer | Stage(s) | Spend policy (proposed) |
|---|---|---|---|
| ScrapeGraphAI | API | discover (SH) | minimal |
| Explee search | third-party | capture (SH) | minimal — subscription active; **wire exists in will** |
| Apollo database | third-party | capture (SH) | minimal — subscription active |
| getleads.io MCP | API (ours) | capture + enrich (iB) | minimal |
| Apollo enrich | third-party | enrich (SH) | minimal |
| Explee verify | third-party | enrich (SH) | minimal |
| ICP scorer | API | enrich (AS) | minimal |
| Astro wiki graph | internal | understand (AS/GE) | none |
| Article engine (hands+taste) | internal | create (AS/GE) | minimal |
| Genesis assets | internal | create (iB) | gated (taste-stage spend) |
| ElevenLabs | third-party | create (SH) | gated — usage credits |
| Runway | third-party | create (SH) | gated — highest per-render cost |
| Expelli sequences | internal | engage (iB) | minimal — live |
| Apollo sequences | third-party | engage (SH) | minimal |
| Composio actions | API | engage (SH) | minimal |
| Community placement | third-party | engage (GE) | gated |
| agency-agents | capability | conductor skills | none |
| marketingskills | capability | conductor skills + loop anatomy | none |

## 4. Findings

- **F1 — The lead pipeline is not a new stack; it is the `ops` stage decomposed per tenant.**
  genesis→taste→build→ops stays the one self-similar shape. The six lead stages are sub-stages of
  `ops`, executed per branch. One conductor, one contract discipline, no parallel orchestrator.
- **F2 — The tenant manifest already exists: it is the product-branch packet.** iBerev, AISEO, and
  GEO should enter as packets under `cambium.product_branch_packet.v1`, starting at `proof-only`.
  Do not invent `tenants.json`; extend the packet system (schema v1.1 with lead-stage bindings) if
  the packet needs a lead-stage section.
- **F3 — Explee is already wired but not reusable.** Promote it from `will`'s internal
  `brand_to_gtm` into a first-class shared adapter (`capture`/`enrich` stages) so any branch can
  call it through the same approval gate.
- **F4 — The capability repos are conductor competencies, not pipeline tools.** agency-agents
  personas and marketingskills skills install into the conductor; `marketing-loops`' nine-part
  loop anatomy maps directly onto the packet's Loop Control Inputs table.
- **F5 — Three lead databases need a job split and a dedupe seam.** Explee = discover/TAM +
  verify; Apollo = engage backbone + enrichment; getleads.io = the MCP capture path that proves
  our wrapper pattern. Dedupe happens once, at `enrich`, before scoring — never in three places.

## 5. Gaps

| # | Gap | Consequence if wired ad hoc |
|---|---|---|
| G1 | No lead-domain variable contracts (`lead_record`, `icp_spec`, `signal_batch`, `topic_graph`, `sequence_state`, `conversation`) | stages pass prose; downstream invents fields |
| G2 | No packets for iBerev / AISEO / GEO | branches have no proof ledger, gate ledger, or promotion boundary |
| G3 | No adapters for Apollo, getleads MCP, Composio, ScrapeGraphAI, ElevenLabs, Runway | unlogged spend, no fail-closed gate, no drift detection |
| G4 | Explee locked inside `will` | other branches can't reuse the paid capability safely |
| G5 | No canonical lead store of record | three databases diverge; no single `lead_record` truth |
| G6 | No spend-tier policy distinguishing flat subscriptions vs usage credits | gated/none mapping becomes arbitrary per wire |
| G7 | Lead outcomes (replies, conversions) have no cortex feedback path | the moat learns brand taste but not market response |
| G8 | I4 drift checks cover `json:*` shape only | third-party API schema changes pass silently |

## 6. Integration sequence (L-wires, mirroring I-wire discipline)

- **L0 — Contracts first (no code):** lead variable-contract vocabulary (extends CONTRACTS.md),
  spend-tier policy (flat sub = `minimal`, usage credits = `gated`, internal = `none`), packets
  for iBerev + AISEO + GEO at `proof-only`. Exit: `npm run validate:product-branches` green with 7 packets.
- **L1 — Shared capture wire:** promote Explee to a first-class adapter; add getleads.io MCP
  adapter; define canonical `lead_record`. Pilot tenant: **iBerev** (Expelli is already live).
- **L2 — Discover wire:** ScrapeGraphAI adapter → `signal_batch` → `topic_graph` feeding the
  AISEO/GEO Astro wiki.
- **L3 — Engage wire:** Apollo sequences + Composio action adapter, approval-gated; reply data
  written to cortex (closes G7).
- **L4 — Create wire:** article engine through existing hands+taste organs; ElevenLabs/Runway as
  gated asset adapters inside `asset_plan`.
- **L5 — Loops + homeostasis:** marketing-loops anatomy → packet Loop Control Inputs; extend I4
  drift checks to lead-stage adapters (closes G8).

Each L-wire ships like an I-wire: thin contract, dry-run first, `spend` declared, approval gate
for anything that costs, evidence recorded in the branch packet's Evidence Ledger.

## 7. Decisions needed before L0

- **D1 — Lead store of record:** snow-gloves DB (will owns `lead_record`) vs a lightweight
  lead-store service. Recommendation: snow-gloves owns it; other organs read/write via contract.
- **D2 — Dedupe precedence:** on conflict, which source wins per field? Recommendation: Explee
  wins company identity + email validity; Apollo wins engagement metadata; getleads wins
  capture provenance.
- **D3 — Spend mapping for flat subscriptions:** count active flat subs as `minimal` (log-only)
  and reserve `gated` for usage-credit burn (ElevenLabs, Runway, placement). Confirm.
- **D4 — Pilot branch:** iBerev recommended (Expelli live, getleads MCP in progress). Confirm,
  and confirm iBerev is distinct from the existing `iverif` packet (IVerif = EU subsidy
  compliance product — different venture).

## 8. Non-goals (held from the packet system's anti-claims)

- No branch claims `autonomous-branch` without live customer proof and app-action portability.
- No secrets, provider keys, or credential values in any contract, packet, or adapter file.
- No wire without a declared `spend` tier and a failure mode.
- No parallel orchestrator, no `tenants.json`, no second registry.
