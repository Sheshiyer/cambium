# Architecture — the constellation

## The self-similar pattern

Every organ is **the same machine**: `hub-and-spoke clusters + a conductor (conducty) loop + a spec-kit + a 1024-dim NIM memory`. That's why they compose cleanly and why the system is **fractal** — the same shape recurs at six scales: *skill → cluster → organ → venture → company → portfolio.*

- **brandmint** = hub-and-spoke clusters + conducty + spec-kit, pointed at *minting a brand*.
- **skill-clusters** = hub-and-spoke clusters + conducty + spec-kit, pointed at *running the business*.
- **snow-gloves-os** = the same, pointed at *operating a portfolio of businesses*.

They are not a stack glued together — they are **one organism expressed at different scales.** See
**[`docs/organs.html`](./docs/organs.html)** for each organ's internal structure rendered as that same Φ
(the fractal claim, made literal — with each organ's real internals), plus a **dedicated full page per
organ** in [`docs/organs/`](./docs/organs/) (genesis · hands · taste · will · cortex).

## Organs ↔ repos

| Organ | Repo | State |
|---|---|---|
| 🧬 brand brain (genesis) | `brandmint-oracle-aleph` (+ `brandmint-showcase` = its product site) | **Live** — 6–7 waves, YAML → full brand system + wiki |
| 🛠️ hands + 🧠 conductor + 🎨 taste cortex | `skill-clusters` | **Live** — 40 clusters, conductor, brandmint *flow*, taste-resolve, noesis, reroll, two render backends (gpt-image-2 + Nano Banana) |
| 📡 distribution / GTM | `explee-skills` | **Live** — wired into snow-gloves' dispatcher |
| 👔 the OS / will / portfolio | `snow-gloves-os` | **Building** — 7-agent C-suite, multi-tenant, orchestration specs |
| 🧠 shared cortex (memory adapter) | provider-neutral `CortexStore` / `makeCortex` transports, with local SQLite/contract ledgers and optional hosted embedding/search providers | **Boundary defined** — product memory is the interface; taste/design memory workers are adapters behind it |

## The composition layer (live — 2026-07-22)

Cambium is no longer only a description — it has a **machine-readable composition layer** that makes the
pipeline executable-as-a-plan:

| Artifact | Role |
|---|---|
| [`registry.json`](./registry.json) | the 5 organs — repo · role · entrypoint · tier (free/paid) |
| [`composition/pipeline.json`](./composition/pipeline.json) | the ordered stages `genesis→taste→build→ops` + cross-cutting `cortex` |
| [`composition/CONTRACTS.md`](./composition/CONTRACTS.md) | the stage I/O interfaces **and canonical variable contracts** every wire implements against |
| [`bin/compose.mjs`](./bin/compose.mjs) | the zero-dep contract conductor — `compose plan`, `compose validate`, and gated `compose run` |

`node bin/compose.mjs plan acme` prints the per-tenant plan: each stage → its organ, repo, entrypoint,
and free/paid tier, with the cortex feeding all four. It **plans + validates** the composition and can
execute declared adapters through an explicit, fail-closed gate; it is not a claim that every organ is
deployed as a live service. See [INTEGRATION.md](./INTEGRATION.md). The
composition layer governs not only stage order but also the **canonical variable-contract vocabulary**
for the seeded variables with downstream consequences (`brand_system`, `copy_system` with its
`copy_slots` map, `visual_system`,
`asset_plan`, `section_plan`, `interaction_plan`, `acceptance_checks`) that downstream wiring will
preserve and enforce in later tasks.

**snow-gloves is one organ here (`will` = business-ops), not "the OS."** The composition lives in Cambium.

## Current runtime surfaces (2026-07-22)

The repository now contains a maintained operational plane in addition to the composition/operator model:

| Surface | Current truth | Primary source |
|---|---|---|
| `workers/quests` | Cloudflare Worker boundary with tenant-scoped D1, KV, R2, Vectorize, RBAC filtering, action receipts, and bounded runtime contracts | [`workers/quests/src/index.ts`](./workers/quests/src/index.ts) · [`workers/quests/wrangler.jsonc`](./workers/quests/wrangler.jsonc) |
| Goal Graph contract | Deterministic compiler/projections plus approval-bound D1 CAS store and bounded Telegram intake; Worker/Telegram route wiring remains deferred | [`docs/architecture/goal-graph-operating-model.md`](./docs/architecture/goal-graph-operating-model.md) |
| Branch traversal map | D1 append-only transition receipts feed an authenticated GET projection and bounded Telegram sheet; live founder-device proof remains deferred | [`docs/architecture/branch-traversal-map.md`](./docs/architecture/branch-traversal-map.md) |
| Lead runtime | Fixed-tenant manual IVerif capture/enrich proof; durable leases, spend receipts, immutable observations, no recurring schedules | [`docs/architecture/lead-runtime-spine.md`](./docs/architecture/lead-runtime-spine.md) |
| IVerif | Redacted, GET-only observer; send remains ineligible until a separately reviewed promotion gate passes | [`docs/adapters/iverif-explee.md`](./docs/adapters/iverif-explee.md) |
| Marketing Create | Review-only founder-article drafts; registered disabled, not deployed, and not publication-authoritative | [`docs/architecture/marketing-create-worker-renderer.md`](./docs/architecture/marketing-create-worker-renderer.md) |
| `apps/cambium-r3f` | Desktop-oriented constellation visual engine consuming shared surface contracts and synthetic fallback data | [`apps/cambium-r3f/README.md`](./apps/cambium-r3f/README.md) |
| `apps/cambium-r3f/desktop` | Electron main/preload shell around the local R3F build; custom protocol, sandbox, navigation and permission policy | [`apps/cambium-r3f/desktop/main.cjs`](./apps/cambium-r3f/desktop/main.cjs) · [`apps/cambium-r3f/package.json`](./apps/cambium-r3f/package.json) |

These surfaces are implemented and testable from the repository, but deployment, paid-provider access,
publishing, outreach, and recurring scheduling remain independently gated.

## Wiring audit (built vs stubbed) — as of 2026-07-22

**snow-gloves-os already has:**
- the **7-agent C-suite** — `ceo · chief-of-staff · cto · dispatcher · interpreter · librarian · sentinel`.
- **`002-orchestration-wiring`** (Explee → Dispatcher + the *tryambakam-noesis* tenant) — **19/21 tasks done.** The GTM path is real.
- **multi-tenant** — `tenants/`: `_demo`, `acme`, `tryambakam-noesis`.
- the `g-stack` connector.

**The gaps (the integration work):**
1. ✅ **`004-brand-enriched-autogtm`** (brand-docs → Explee ICP) — **shipped** ([snow-gloves PR #4](https://github.com/Sheshiyer/snow-gloves-os/pull/4)). The brand DNA now drives the go-to-market (the ICP, the messaging) instead of being hand-fed. This is wire **I1**.
2. **Organs as services (I2)** — the composition layer names, validates, and invokes declared adapters through explicit gates. The separate Worker/runtime plane is implemented, but external organ repositories are still separately governed and are not implied to be continuously deployed by this checkout. See [INTEGRATION.md](./INTEGRATION.md).
3. **One memory boundary, many adapters** — the standalone product owns the tenant-scoped `CortexStore` / `makeCortex` contract. Hosted NIM, design-memory workers, Codrops indexes, and brand-asset recall are adapter implementations behind that contract, not product identity.

## Integration roadmap

The roadmap now lives in **[INTEGRATION.md](./INTEGRATION.md)** (re-homed here, since Cambium is the
composition layer). In brief: **I1** (brand→GTM) and bounded **I2a/b/c** invocation are ✅ **shipped**; **I3** defines the provider-neutral cortex seam; **B1–B3** are the Fitcheck
engine lessons. Together they take Cambium from *"composes in principle"* → *"runs a business
end-to-end, on-brand, per tenant."*

## Proof
The **Fitcheck** tracer slice ran the brand-brain → taste → hands path end-to-end (waves 0-8): brand-spec → logo/voice/positioning → real imagery (two backends) → on-brand score → reroll → pack → register → persist. It surfaced the B1–B3 gaps. Full retrospective: [`skill-clusters/docs/LESSONS-FITCHECK-RUN.md`](https://github.com/Sheshiyer/skill-clusters/blob/main/docs/LESSONS-FITCHECK-RUN.md).
