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
| 🧠 shared cortex (NIM) | `taste-nim` (in skill-clusters) + `DESIGN_MEMORY_WORKER` (in brandmint) | **Duplicated** — two copies of one organ; *to unify* |

## Wiring audit (built vs stubbed) — as of 2026-06-08

**snow-gloves-os already has:**
- the **7-agent C-suite** — `ceo · chief-of-staff · cto · dispatcher · interpreter · librarian · sentinel`.
- **`002-orchestration-wiring`** (Explee → Dispatcher + the *tryambakam-noesis* tenant) — **19/21 tasks done.** The GTM path is real.
- **multi-tenant** — `tenants/`: `_demo`, `acme`, `tryambakam-noesis`.
- the `g-stack` connector.

**The gaps (the integration work):**
1. **`004-brand-enriched-autogtm`** (brand-docs → Explee ICP) — **0/17.** The **brandmint → GTM bridge is stubbed.** This is the single most valuable wire: it makes the *brand* DNA drive the *go-to-market* (the ICP, the messaging) instead of being hand-fed.
2. **brandmint ↔ OS as services** — brandmint-oracle-aleph + skill-clusters aren't yet called as service endpoints from snow-gloves; the organs are spec'd to compose but not service-wired.
3. **One cortex, not two** — `taste-nim` and `DESIGN_MEMORY_WORKER` are the same organ duplicated. Merge into one **aesthetic-memory Worker** (Codrops taste index + the brand's own assets + the design-memory), shared by every organ.

## Integration roadmap

| # | Wire | Why | Where |
|---|---|---|---|
| **I1** | **brand-docs → GTM ICP** | the brand brain should drive distribution, not be re-typed | snow-gloves `004` |
| **I2** | **brandmint + skill-clusters as services** | the OS dispatches genesis + build per-tenant via real endpoints | snow-gloves connectors |
| **I3** | **unify the NIM cortex** | one aesthetic memory across all organs; the moat lives here | new shared Worker |
| **B1** | **name-validation gate** | a brand name must be ownable before asset spend (Fitcheck lesson) | brandmint / skill-clusters |
| **B2** | **semantic visual-QA** | gate renders on brief-match, not just palette (Fitcheck lesson) | skill-clusters reroll |
| **B3** | **reference-anchored campaigns** | one brand character across the whole asset set (Fitcheck lesson) | skill-clusters / nanobanana |

I1–I3 wire the constellation; B1–B3 are the engine lessons from the first real brand run. Together they take Cambium from *"composes in principle"* to *"runs a business end-to-end, on-brand, per tenant."*

## Proof
The **Fitcheck** tracer slice ran the brand-brain → taste → hands path end-to-end (waves 0-8): brand-spec → logo/voice/positioning → real imagery (two backends) → on-brand score → reroll → pack → register → persist. It surfaced the B1–B3 gaps. Full retrospective: [`skill-clusters/docs/LESSONS-FITCHECK-RUN.md`](https://github.com/Sheshiyer/skill-clusters/blob/main/docs/LESSONS-FITCHECK-RUN.md).
