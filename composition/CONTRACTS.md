# Composition contracts — the stage interfaces

Cambium is the **conductor-of-conductors**: it does not contain organ code, it composes the organs
as services along a per-tenant pipeline. For that to work, each organ must expose a **stable I/O
contract** — what it takes in, what it hands to the next stage. This file is that contract. Every
wire in [`../INTEGRATION.md`](../INTEGRATION.md) implements one stage against the interface below.

The pipeline is the same self-similar shape at every scale (*skill → cluster → organ → venture →
company → portfolio*): **genesis → taste → build → ops**, with the **cortex** feeding all four.

## Why JSON (not YAML) for `registry.json` / `pipeline.json`

The organs are polyglot — Node (skill-clusters), shell/Node shims (Meristem), Python (snow-gloves), Workers. JSON parses
**zero-dep and natively** in all of them (`JSON.parse`, `json.load`), so the registry is one source of
truth no organ needs a dependency to read. The human-readable rationale lives here in Markdown; the
machine-readable wiring lives in JSON. (YAML would force a parser dependency into the zero-dep conductor.)

## Stage contracts

Each stage is owned by one organ (`pipeline.json → stages[].organ`, resolved against `registry.json`).
The `input`/`output` tokens below are the contract identifiers referenced by the pipeline.

### 1. `genesis` — Mint the brand · organ: **genesis** (`meristem`) · *free*
- **in** `idea` — a Meristem checkout path whose `brands/thoughtseed/brand-config.yaml` and `.brandmint`
  outputs carry the seed idea.
- **out** `brand-dna` — structured Cambium JSON containing `brand_system`, `copy_system`, and
  `visual_system`. The canonical brand registration.
- **fulfilled by** Cambium's Meristem contract shim:
  `node scripts/meristem-genesis-contract.mjs --meristem-root <meristem-root> --brand-dir brands/thoughtseed --out -`.
  The shim maps existing Meristem `.brandmint` outputs rather than running paid generation.

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

## Lead ecosystem catalog

The versioned machine contract for the lead operating slice is
[`contracts/lead-ecosystem.v1.json`](contracts/lead-ecosystem.v1.json). It sits beneath `ops`; it does not
add another top-level pipeline or grant a provider permission to run. The catalog is intentionally
zero-dependency and closed: every record has a unique `name@version` identifier, a bounded tenant envelope,
local-only schema references, bounded arrays and strings, and `additionalProperties: false` at every object
boundary.

### Lifecycle records

- `lead_record`, `source_alias`, and `identity_resolution` preserve a tenant-scoped canonical lead while
  source aliases evolve. Identity resolution is continuous, confidence-bearing, observed, and CAS-revisioned
  through ambiguous, matched, merged, split, and human-review states. Merge/split lineage is mandatory;
  stale revisions, cross-tenant aliases, and self-merges fail closed.
- `provider_observation`, `signal_batch`, and `icp_score` separate observed evidence from derived scoring.
  Every score binds its evidence, rule version, and model version. Provider payloads cannot supply tenant,
  account, project, or campaign authority.
- `suppression_state` is authoritative and dominates enrichment, approval, create, and engage decisions.
  An opt-out, hard bounce, complaint, legal hold, expiry, or tenant policy cannot be widened away by a newer
  provider observation. Consent basis, affected channels, retention disposition, alias/channel propagation,
  and the non-clearable provider-refresh rule travel with every revision.
- `content_asset` contains only bounded classification, provenance, rights, approval, digest, and expiry at
  this boundary. Rendered body content and raw contact identity do not enter the catalog record.
- `action_request` binds tenant, provider capability, exact endpoint/tool/method, adapter and canonicalization
  versions, payload and credential-binding digests, budget reservation, actor, expiry, idempotency key,
  suppression revision, and eligibility into one canonical SHA-256 action digest.
- `approval_decision` is scoped to `exact_action`, names its approver and expiry, and must carry that exact
  digest. Changing any bound field invalidates the approval rather than broadening it to a campaign.
- `execution_attempt`, `outcome_event`, `reconciliation`, and `compensation` form the eventual action audit
  trail: attempts retain request/response/provider-receipt digests, prior-attempt lineage, fencing and timing;
  outcomes retain provider event identity and attribution; reconciliation compares expected and observed
  states; compensation binds retry eligibility, repair, escalation, deadline, and receipt.
- A `writer_lease` explicitly scopes tenant, campaign, and channel. Its monotonically fenced token makes
  Cambium the one writer; provider systems never become task, approval, or receipt authorities.
- `operator_receipt` exposes only bounded state, artifact count, next action, replay truth, and timestamp.
  Redaction is mandatory; identity, provider payloads, document content, credentials, and URLs are forbidden.
- `derived_learning` is the only cortex foldback record. It accepts allowlisted numeric aggregate metrics,
  a privacy-reviewed transformation version, source outcome references, and a minimum cohort of ten. Raw
  observations, aliases, contact identity, arbitrary prose, and provider payloads cannot cross that seam.

### Provider records

`provider_contract`, `provider_permission`, and `provider_binding` keep four concerns separate:

1. The contract pins API schema and adapter versions, exact local endpoint/tool/method allowlists, bounded
   timeout/retry policy, exact-key idempotency, error classification, redaction, reconciliation, receipt, and
   fail-closed schema drift behavior.
2. The permission lists explicit scopes and a closed data policy: classification, region, purpose, and
   retention.
3. The binding points at those immutable records and a typed `secretref://` identifier. Secret values are
   rejected recursively and never belong in JSON contracts, fixtures, logs, or receipts.
4. Mutation defaults to disabled and the kill switch defaults to engaged. A packet or caller cannot widen
   either default.

The executable proof is
[`../examples/provider-conformance/synthetic-observation.json`](../examples/provider-conformance/synthetic-observation.json).
It contains synthetic facts, no provider hostname, and no network behavior. The conformance test supplies a
network sentinel that throws on any attempted call and asserts that the validator makes zero calls. Live
provider routing, credentials, spend, and outbound mutation remain later, separately authorized slices.

## Marketing capability and asset records

The pinned capability catalog is
[marketing-capabilities.v1.json](marketing-capabilities.v1.json), with six internal create-stage schemas in
[contracts/marketing-assets.v1.json](contracts/marketing-assets.v1.json). It compiles curated
coreyhaines31/marketingskills expertise into review-only plans; it does not install upstream Markdown as
runtime policy. All eight outcome recipes compile through the pinned semantic projection; only one has a
synthetic deterministic draft proof. Canonical runtime spend remains `none`; low-budget quotes are inert data.

The internal records are asset_brief, asset_recipe, asset_draft, asset_variant, asset_quality_report, and
channel_package. They remain in the non-authoritative capability plane. The existing
content_asset@1.0.0 record is the intended graph bridge, using asset_kind marketing_review_package. The bridge
is explicitly blocked until canonical approval is wired; the lead graph, twenty lead records, engage authority
gates, and provider permissions remain unchanged.

See
[the capability orchestration architecture](../docs/architecture/marketing-capability-asset-orchestration.md)
for recipe status, manual-loop behavior, accessibility, low-budget declarations, and future activation gates.

## Cross-cutting: `cortex` — Aesthetic memory · organ: **cortex** (`taste-nim` + `DESIGN_MEMORY_WORKER`) · *paid*
- Not a stage — it **feeds all four**. The 1024-dim NIM memory: taste index + the brand's own assets +
  design-memory. Genesis writes the brand's seed taste; taste reads/scores against it; build pulls
  on-brand references; ops feeds outcomes back. **It learns across stages and across tenants — the moat.**
- Currently duplicated across two Workers; **I3** unifies them into one shared aesthetic-memory Worker.

## Invariant
Cambium **plans + validates** (`compose plan/validate`) and now **calls** each organ along the contract
(`compose run`, via [`../adapters.json`](../adapters.json) + `bin/lib/invoke.mjs`) — **fail-closed on
spend**: a spend-gated stage (such as `taste`) never spawns without an explicit `--approve <stage>`
(constitution #4). Executable-as-a-plan, as-gated-calls, and with the **live output→input hand-off**
(`runPipeline` threads stage N's output → N+1's `{input}`): the no-spend **genesis** Meristem shim and
the no-spend **hands** stage can run end-to-end today; the full chain still requires approval for gated
stages such as `taste`. For the variable contract vocabulary above, Cambium defines and documents the
canonical groups those stages should pass forward, and `json:*` stages are checked for declared produced
groups at runtime.
