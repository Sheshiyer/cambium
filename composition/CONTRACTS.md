# Composition contracts — the stage interfaces

Cambium is the **conductor-of-conductors**: it does not contain organ code, it composes the organs
as services along a per-tenant pipeline. For that to work, each organ must expose a **stable I/O
contract** — what it takes in, what it hands to the next stage. This file is that contract. Every
wire in [`../INTEGRATION.md`](../INTEGRATION.md) implements one stage against the interface below.

The pipeline is the same self-similar shape at every scale (*skill → cluster → organ → venture →
company → portfolio*): **genesis → taste → build → ops**, with the **cortex** feeding all four.

## Why JSON (not YAML) for `registry.json` / `pipeline.json`

The organs are polyglot — Node (skill-clusters), Python (brandmint, snow-gloves), Workers. JSON parses
**zero-dep and natively** in all of them (`JSON.parse`, `json.load`), so the registry is one source of
truth no organ needs a dependency to read. The human-readable rationale lives here in Markdown; the
machine-readable wiring lives in JSON. (YAML would force a parser dependency into the zero-dep conductor.)

## Stage contracts

Each stage is owned by one organ (`pipeline.json → stages[].organ`, resolved against `registry.json`).
The `input`/`output` tokens below are the contract identifiers referenced by the pipeline.

### 1. `genesis` — Mint the brand · organ: **genesis** (`brandmint-oracle-aleph`) · *free*
- **in** `idea` — a `brand-config.yaml` (name, category, mission, audience) — the thoughtseed.
- **out** `brand-dna` — `brand-spec.json` (validated) + `brand-docs/` (persona, positioning, voice,
  messaging) + `assets/` (logo, palette, hero). The canonical brand registration.
- **fulfilled by** `brandmint launch --waves 0-8` (CLI: `brandmint.cli.app:main`) · buildable alias `skill-clusters taste/scripts/brandmint.mjs (runBrandKit)`.

### 2. `taste` — Set the taste · organ: **taste** (`skill-clusters/taste`) · *paid*
- **in** `brand-dna` (+ an artifact to check, on later passes).
- **out** `taste-brief` — the injected on-brand brief ("make it feel … conform to <brand>'s DNA …")
  + an on-brand **verdict** (pass / reroll) for any artifact submitted.
- **fulfilled by** `taste/scripts/taste-resolve.mjs --brand <id>`; reads/writes the shared **cortex**.

### 3. `build` — Build on-brand · organ: **hands** (`skill-clusters`) · *free*
- **in** `taste-brief` + `brand-dna` + a `build-spec` (the spec-kit tasks).
- **out** `artifact` — the built surface (landing / app / widget / campaign), each task resolved to a
  real dev cluster and **taste-injected**, gated by the fail-closed `ship-battery`.
- **fulfilled by** `scripts/resolve-task.mjs` (task → cluster) → `<cluster>-orchestrator` → `scripts/ship-battery.mjs`.

### 4. `ops` — Operate + GTM · organ: **will** (`snow-gloves-os`) · *paid (Portfolio)*
- **in** `artifact` + `brand-docs` (+ an approved GTM Brief).
- **out** `business` — a running, multi-tenant business: GTM candidate lists (brand-fit scored),
  distribution, the C-suite operating loop.
- **fulfilled by** `agents/dispatcher/` (agent spec) + `scripts/lib/gtm.py brand_to_gtm` (brand-docs → Explee ICP,
  approval-gated). This is the **I1** wire — shipped (snow-gloves PR #4).

## Cross-cutting: `cortex` — Aesthetic memory · organ: **cortex** (`taste-nim` + `DESIGN_MEMORY_WORKER`) · *paid*
- Not a stage — it **feeds all four**. The 1024-dim NIM memory: taste index + the brand's own assets +
  design-memory. Genesis writes the brand's seed taste; taste reads/scores against it; build pulls
  on-brand references; ops feeds outcomes back. **It learns across stages and across tenants — the moat.**
- Currently duplicated across two Workers; **I3** unifies them into one shared aesthetic-memory Worker.

## Invariant
Cambium **plans and validates** this composition (`bin/compose.mjs`); it does **not** execute the organs
end-to-end yet (that is **I2**). The contract is executable-as-a-plan today, executable-as-a-runtime next.
