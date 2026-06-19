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
- **in** `idea` — a `brand-config.yaml` (name, category, mission, audience) — the seed idea.
- **out** `brand-dna` — `brand-spec.json` (validated) + `brand-docs/` (persona, positioning, voice,
  messaging) + `assets/` (logo, palette, hero). The canonical brand registration.
- **fulfilled by** `brandmint launch --waves 1-8` (CLI: `brandmint.cli.app:main`) · buildable alias `skill-clusters taste/scripts/brandmint.mjs (runBrandKit)`.

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

## Variable contract vocabulary

The stage tokens above say **which hand-off exists** (`idea` → `brand-dna` → `taste-brief` → `artifact` →
`business`). The variable contract layer says **which seeded variables must survive those hand-offs**.
Stages must pass these groups forward as structured data, not prose-only summaries, so downstream stages do
not invent critical decisions ad hoc.

See [`../examples/sample-variable-contract.json`](../examples/sample-variable-contract.json) for the
canonical compact payload that carries these groups through a full hand-off. The sample is intentionally
small enough for tests and agents to inspect, but complete enough to prove the downstream-sensitive seams:
brand, copy, visuals, assets, sections, interactions, and acceptance checks.

> **Task 1 scope:** this document defines the canonical vocabulary and expected hand-off shape at the
> documentation layer today. Runtime fail-closed validation of these variable groups lands in a later task;
> for now, these entries describe the contract downstream work will enforce.

### `brand_system`
- **Variables**: `brand_id`, `brand_name`, `category`, `audience`, `positioning`, `promise`,
  `differentiators`, `voice_principles`.
- **Owned by**: `genesis`.
- **Consumed by**: `taste`, `build`, `ops`, and `cortex`.
- **Required**: `brand_name`, `audience`, `positioning`, `promise`, `voice_principles`.
- **Optional**: `brand_id`, `category`, `differentiators`.
- **If required fields are missing**: treat the hand-off as contract drift to repair; downstream stages
  should not infer the missing brand core from prose alone.

### `copy_system`
- **Variables**: a top-level `copy_system` group containing a `copy_slots` map for reusable messaging
  surfaces (`hero_headline`, `hero_subhead`,
  `cta_primary`, `cta_secondary`, proof points, offer text, and channel-specific variants) plus shared tone
  notes.
- **Owned by**: `genesis` seeds it; `ops` may extend it with approved campaign variants.
- **Consumed by**: `taste`, `build`, `ops`.
- **Required**: `copy_slots.hero_headline`, `copy_slots.hero_subhead`, `copy_slots.cta_primary`.
- **Optional**: secondary CTAs, campaign variants, channel notes, proof libraries.
- **If required fields are missing**: mark the seam incomplete; `build` should not synthesize new canonical
  messaging from scratch.

### `visual_system`
- **Variables**: palette tokens, typography tokens, logo usage rules, composition motifs, imagery direction,
  reference cues, and visual anti-patterns.
- **Owned by**: `genesis`, with `taste` allowed to sharpen style constraints against the shared cortex.
- **Consumed by**: `taste`, `build`, `ops`, and `cortex`.
- **Required**: palette, typography direction, imagery direction, logo usage baseline.
- **Optional**: component motifs, animation cues, anti-pattern lists, reference sets.
- **If required fields are missing**: treat the hand-off as contract drift; `taste` cannot score
  on-brandness reliably and `build` should not invent the aesthetic system.

### `asset_plan`
- **Variables**: required assets, aspect ratios, formats, render priorities, ownership/source notes, and
  approval state for each asset.
- **Owned by**: `taste` seeds the on-brand asset intent; `build` updates execution status.
- **Consumed by**: `build`, `ops`, and `cortex`.
- **Required**: asset list, intended use, priority, and status per required asset.
- **Optional**: format hints, source refs, production notes, budget notes.
- **If required fields are missing**: surface the missing plan; `build` should not assume which assets exist
  or should be generated.

### `section_plan`
- **Variables**: page/surface sections, section goals, required inputs per section, section-level owners,
  and mapping from sections to assets + copy.
- **Owned by**: `taste` seeds the narrative structure; `build` refines it into executable work.
- **Consumed by**: `build` and `ops`.
- **Required**: ordered sections, a goal per section, and bindings to the relevant `copy_slots` /
  `asset_plan` entries.
- **Optional**: layout hints, responsive notes, conditional sections, fallback sections.
- **If required fields are missing**: request a seeded plan; `build` should not hallucinate IA or screen
  flow.

### `interaction_plan`
- **Variables**: interaction states, transitions, triggers, motion intent, validation rules, and explicit
  user actions that matter to the experience.
- **Owned by**: `taste` seeds experiential intent; `build` specifies implementation details.
- **Consumed by**: `build`, `ops`, and `cortex`.
- **Required**: primary interactions, trigger/state pairs, and any blocking validation or approval points.
- **Optional**: micro-animation detail, advanced gestures, recovery states, instrumentation hooks.
- **If required fields are missing**: downstream stages should fall back to safe static behavior or pause
  the interaction-specific branch, rather than invent motion logic that changes product meaning.

### `acceptance_checks`
- **Variables**: contract assertions, brand-fit gates, content/asset completeness checks, and
  launch-critical pass conditions.
- **Owned by**: `taste` defines the brand-fit gates; `build` and `ops` append implementation/launch checks.
- **Consumed by**: `build`, `ops`, `cortex`, and `I4` homeostasis flows.
- **Required**: named checks, pass/fail criteria, owning stage, and the consequence of failure.
- **Optional**: scoring thresholds, human-review notes, environment-specific checks.
- **If required fields are missing**: the seam should be flagged for verification, because the system cannot
  distinguish deliberate change from drift from documentation alone.

## Cross-cutting: `cortex` — Aesthetic memory · organ: **cortex** (`taste-nim` + `DESIGN_MEMORY_WORKER`) · *paid*
- Not a stage — it **feeds all four**. The 1024-dim NIM memory: taste index + the brand's own assets +
  design-memory. Genesis writes the brand's seed taste; taste reads/scores against it; build pulls
  on-brand references; ops feeds outcomes back. **It learns across stages and across tenants — the moat.**
- Currently duplicated across two Workers; **I3** unifies them into one shared aesthetic-memory Worker.

## Invariant
Cambium **plans + validates** (`compose plan/validate`) and now **calls** each organ along the contract
(`compose run`, via [`../adapters.json`](../adapters.json) + `bin/lib/invoke.mjs`) — **fail-closed on
spend**: a spend-gated stage (taste, genesis) never spawns without an explicit `--approve <stage>`
(constitution #4). Executable-as-a-plan, as-gated-calls, and with the **live output→input hand-off**
(`runPipeline` threads stage N's output → N+1's `{input}`): the no-spend **hands** stage runs end-to-end
today; the full chain runs once the gated stages (genesis, taste) are approved. For the variable contract
vocabulary above, Cambium currently defines and documents the canonical groups those stages should pass
forward. Runtime enforcement of those groups is a later step; today this file is the canonical reference.
