# Architecture — the constellation

## The self-similar pattern

Every organ is **the same machine**: `hub-and-spoke clusters + a conductor (conducty) loop + a spec-kit + a 1024-dim NIM memory`. That's why they compose cleanly and why the system is **fractal** — the same shape recurs at six scales: *skill → cluster → organ → venture → company → portfolio.*

- **brandmint** = hub-and-spoke clusters + conducty + spec-kit, pointed at *minting a brand*.
- **skill-clusters** = hub-and-spoke clusters + conducty + spec-kit, pointed at *running the business*.
- **snow-gloves-os** = the same, pointed at *operating a portfolio of businesses*.

They are not a stack glued together — they are **one organism expressed at different scales.**

## Organs ↔ repos

| Organ | Repo | State |
|---|---|---|
| 🧬 brand brain (genesis) | `brandmint-oracle-aleph` (+ `brandmint-showcase` = its product site) | **Live** — 6–7 waves, YAML → full brand system + wiki |
| 🛠️ hands + 🧠 conductor + 🎨 taste cortex | `skill-clusters` | **Live** — 40 clusters, conductor, brandmint *flow*, taste-resolve, noesis, reroll, two render backends (gpt-image-2 + Nano Banana) |
| 📡 distribution / GTM | `explee-skills` | **Live** — wired into snow-gloves' dispatcher |
| 👔 the OS / will / portfolio | `snow-gloves-os` | **Building** — 7-agent C-suite, multi-tenant, orchestration specs |
| 🧠 shared cortex (NIM) | `taste-nim` (own repo) + `DESIGN_MEMORY_WORKER` (logic in `brandmint/core/design_memory.py`) | **Duplicated** — two copies of one organ; *to unify* |

## The composition layer (live — 2026-06-08)

Cambium is no longer only a description — it has a **machine-readable composition layer** that makes the
pipeline executable-as-a-plan:

| Artifact | Role |
|---|---|
| [`registry.json`](./registry.json) | the 5 organs — repo · role · entrypoint · tier (free/paid) |
| [`composition/pipeline.json`](./composition/pipeline.json) | the ordered stages `genesis→taste→build→ops` + cross-cutting `cortex` |
| [`composition/CONTRACTS.md`](./composition/CONTRACTS.md) | the stage I/O interfaces every wire implements against |
| [`bin/compose.mjs`](./bin/compose.mjs) | the zero-dep dry-run **conductor** — `compose plan <tenant>` / `compose validate` (8/8 tests) |

`node bin/compose.mjs plan acme` prints the per-tenant plan: each stage → its organ, repo, entrypoint,
and free/paid tier, with the cortex feeding all four. It **plans + validates** the composition; it does
not execute the organs end-to-end yet (that is **I2** — see [INTEGRATION.md](./INTEGRATION.md)).

**snow-gloves is one organ here (`will` = business-ops), not "the OS."** The composition lives in Cambium.

## Wiring audit (built vs stubbed) — as of 2026-06-08

**snow-gloves-os already has:**
- the **7-agent C-suite** — `ceo · chief-of-staff · cto · dispatcher · interpreter · librarian · sentinel`.
- **`002-orchestration-wiring`** (Explee → Dispatcher + the *tryambakam-noesis* tenant) — **19/21 tasks done.** The GTM path is real.
- **multi-tenant** — `tenants/`: `_demo`, `acme`, `tryambakam-noesis`.
- the `g-stack` connector.

**The gaps (the integration work):**
1. ✅ **`004-brand-enriched-autogtm`** (brand-docs → Explee ICP) — **shipped** ([snow-gloves PR #4](https://github.com/Sheshiyer/snow-gloves-os/pull/4)). The brand DNA now drives the go-to-market (the ICP, the messaging) instead of being hand-fed. This is wire **I1**.
2. **Organs as services (I2)** — the composition layer above now *names + validates* every organ's entrypoint, but genesis / hands / taste are still invoked by hand, not as live services the conductor calls. **I2a/b/c** wire them — see [INTEGRATION.md](./INTEGRATION.md).
3. **One cortex, not two** — `taste-nim` and `DESIGN_MEMORY_WORKER` are the same organ duplicated. Merge into one **aesthetic-memory Worker** (Codrops taste index + the brand's own assets + the design-memory), shared by every organ.

## Integration roadmap

The roadmap now lives in **[INTEGRATION.md](./INTEGRATION.md)** (re-homed here, since Cambium is the
composition layer). In brief: **I1** (brand→GTM) is ✅ **shipped**; **I2a/b/c** turn genesis / hands /
taste into live services the conductor calls; **I3** unifies the NIM cortex; **B1–B3** are the Fitcheck
engine lessons. Together they take Cambium from *"composes in principle"* → *"runs a business
end-to-end, on-brand, per tenant."*

## Proof
The **Fitcheck** tracer slice ran the brand-brain → taste → hands path end-to-end (waves 0-8): brand-spec → logo/voice/positioning → real imagery (two backends) → on-brand score → reroll → pack → register → persist. It surfaced the B1–B3 gaps. Full retrospective: [`skill-clusters/docs/LESSONS-FITCHECK-RUN.md`](https://github.com/Sheshiyer/skill-clusters/blob/main/docs/LESSONS-FITCHECK-RUN.md).
