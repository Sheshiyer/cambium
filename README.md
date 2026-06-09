<div align="center">

# 🌱 Cambium

**An idea goes in. A self-running, on-brand business comes out.**

*The autonomous, on-brand venture operator — the "company compiler."*

</div>

---

> In a tree, the **cambium** is the one thin living layer where *all* growth happens — it turns the seed's potential into bark, wood, and leaves. This is that layer for a business: it takes an idea (a *thoughtseed*) and grows it into a living company — branded, built, marketed, operated — and keeps it growing **on-brand, forever.**

Cambium is **not a monorepo**. It is the **front door + nervous system** for a constellation of self-similar organ-repos. Each organ is *the same machine* (hub-and-spoke clusters + a conductor loop + a spec-kit + a 1024-dim memory) pointed at a different job. They compose — and the **composition layer** ([`registry.json`](./registry.json) + [`composition/`](./composition/) + the [`bin/compose.mjs`](./bin/compose.mjs) conductor) makes that wiring machine-readable and runnable: `node bin/compose.mjs plan <tenant>`.

## The four organs (+ the cortex)

| Organ | Role | Repo |
|---|---|---|
| 🧬 **Brand brain** | *genesis* — idea → full brand system (persona, positioning, voice, logo, palette, copy, wiki), 6–7 waves | [`brandmint-oracle-aleph`](https://github.com/Sheshiyer/brandmint-oracle-aleph) |
| 🛠️ **The hands** + 🧠 **the conductor** + 🎨 **the taste cortex** | *build · maintain · market · operate*, on-brand, closed-loop | [`skill-clusters`](https://github.com/Sheshiyer/skill-clusters) |
| 📡 **Distribution / GTM** | *take it to market* | [`explee-skills`](https://github.com/Sheshiyer/explee-skills) |
| 👔 **The OS / will / portfolio** | *the C-suite* — multi-tenant orchestration of the organs into a running business | [`snow-gloves-os`](https://github.com/Sheshiyer/snow-gloves-os) |
| 🧠 **Shared sensory cortex** | the 1024-dim NIM aesthetic memory (taste + design-memory) — *to unify* | `taste-nim` (own repo) + `DESIGN_MEMORY_WORKER` (`brandmint/core/design_memory.py`) |

```mermaid
graph LR
  IDEA[💡 idea<br/>brand-config.yaml] --> BM[🧬 brand brain<br/>brandmint]
  BM -->|brand DNA| TASTE[🎨 taste cortex<br/>je-ne-sais-quoi · noesis]
  BM -->|what to build/run| OS[👔 the OS<br/>snow-gloves · C-suite]
  TASTE -->|how it should feel| OS
  OS -->|resolve each task → cluster| HANDS[🛠️ 40 skill clusters<br/>build · maintain · market · ops]
  HANDS --> BIZ[🏢 a living, on-brand business]
  BIZ -.outcomes / metrics.-> TASTE
  BIZ -.learnings.-> BM
  classDef k fill:#8b5cf6,color:#fff; class BM,TASTE,OS,HANDS k;
```

## The business model, in one line

**The left brain is free. The right brain is the subscription.**
- **Free** — *genesis + the build*: mint a brand, the 40 skill clusters, the conductor. Adoption flywheel.
- **Paid** — *the ongoing taste*: the aesthetic conscience that keeps every artifact on-brand and **learns your brand's taste over time**. The moat. → see **[BUSINESS-MODEL.md](./BUSINESS-MODEL.md)**.

## Read next
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — the constellation, the self-similar pattern, the **composition layer**, the wiring audit.
- **[INTEGRATION.md](./INTEGRATION.md)** — the wiring roadmap: **I1** (brand→GTM) ✅ shipped, **I2a/b/c** organs-as-services **wired (gated)**, **I3** unify the cortex, **I4** self-healing.
- **[HOMEOSTASIS.md](./HOMEOSTASIS.md)** + **[`docs/architecture.html`](./docs/architecture.html)** — the **math of self-healing**: the engine as a Banach contraction toward the brand-DNA fixed point, *drift = a non-contractive step or a contract violation*, and the why-handler that turns each deviation into learning. The diagram visualizes the whole flow + the loop.
- **[`docs/organs.html`](./docs/organs.html)** — **per-organ structure**: each organ (genesis · hands · taste · will · cortex) rendered as the *same* self-similar Φ with its real internals (waves, the 41 clusters, the 7-agent C-suite, the NIM). The detail behind the tapestry diagram.
- **[`bin/compose.mjs`](./bin/compose.mjs)** — the **conductor**: `compose plan <tenant>` prints the pipeline; `compose run <tenant>` **calls** each organ — **fail-closed on spend** (`--execute --approve <stage>` is the only path that spends). It **hands off** each stage's output → the next stage's input; the no-spend **hands** stage (`resolve-task`) runs live: `compose run acme --stage build --execute --input examples/sample-tasks.md`. `adapters.json` + `bin/lib/invoke.mjs` are the I2 invocation layer.
- **[BUSINESS-MODEL.md](./BUSINESS-MODEL.md)** — free left brain / paid right brain, why it compounds, the packaging.

*Proven on the first tracer slice — Fitcheck (AI virtual try-on for fashion) — minted, built, and rendered end-to-end. Lessons: [`skill-clusters/docs/LESSONS-FITCHECK-RUN.md`](https://github.com/Sheshiyer/skill-clusters/blob/main/docs/LESSONS-FITCHECK-RUN.md).*
