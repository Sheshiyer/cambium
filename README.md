<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=200&text=Cambium&fontSize=52&fontAlignY=32&desc=An%20idea%20goes%20in.%20A%20self-running%2C%20on-brand%20business%20comes%20out.&descAlignY=58&fontColor=ffffff" width="100%" />

**An idea goes in. A self-running, on-brand business comes out.**

*The autonomous, on-brand venture operator — the "company compiler."*

</div>

---

> In a tree, the **cambium** is the thin living layer where *all* growth happens. This is that layer for business: take a raw idea (a *thoughtseed*) and grow it into a living, branded, operating company — then keep it growing **on-brand, forever**, with almost no manual intervention.

Cambium has **two halves**:

1. **The composition layer** — *mints and ships* the business. It composes specialized organs (Genesis → Taste → Hands → Will) into one reliable, contract-driven pipeline: idea → brand system → on-brand surfaces → live go-to-market.
2. **The operator** — *runs* the business as an **infinite game**. An event-sourced wake loop that routes every move through micro/meso/macro control, gates real changes, guards solvency, and **remembers across runs** through a shared cortex.

The composition layer makes the first launch. The operator keeps the venture alive and on-brand after the launch — which is the part that actually compounds.

> **Who this is for.** If you're a **founder**, the promise *is* the product — an idea goes in, a self-running, on-brand business comes out, and you never touch the machinery. Everything from **"Under the hood"** onward is *how* that's true, written for the **builders and AI agents** who run it. Read as much or as little as you like.

---

## What's real today

| Capability | Status | Where |
|---|---|---|
| **Composition pipeline** (Genesis/Taste/Hands/Will + variable contracts) | ✅ live | [`bin/compose.mjs`](./bin/compose.mjs) |
| **The operator** — the infinite-game wake loop (micro/meso/macro + mid-brain→noesis, viability, NPC self-play) | ✅ live | [`bin/operator/`](./bin/operator/) |
| **Onboarding** — the 20-interaction Octalysis first session | ✅ shipped (M1) | `operator onboard` |
| **Cortex · semantic memory** — recall across runs (NIM 1024-d; node:sqlite local · **Cloudflare Vectorize** prod) | ✅ shipped (M2) | `cortex-memory.ts` · `cortex-sqlite.ts` · `vectorize-cortex.ts` |
| **Cortex · structural memory** — CodeGraph code-recall lane | ✅ shipped (M2) | `operator coderecall` |
| **Multi-tenancy** — one operator, many ventures | 🔜 next (M3) | [#20–#23](https://github.com/Sheshiyer/cambium/milestone/3) |

**171 tests green** (`npm test`). Node **v26** runs the operator's TypeScript natively — zero build, zero dependencies.

**The business model, in one line:** the **left brain (build) is free**; the **right brain (taste + memory) is the subscription** — because the memory that learns *your* specific brand is the moat that compounds.

---

## Quick start

```bash
# ── The composition layer: mint + ship a brand ───────────────────────────────
node bin/compose.mjs plan acme                 # see exactly what will happen
node bin/compose.mjs run acme --stage build --execute --input examples/sample-tasks.md
node bin/compose.mjs run acme --execute --approve taste   # only spend on gated stages

# ── The operator: run the business as an infinite game ───────────────────────
node bin/operator/cli.ts onboard               # play the 20-interaction first session
node bin/operator/cli.ts demo                  # a sample stream of moves through the loop
node bin/operator/cli.ts coderecall "wake"     # structural recall of code the operator ships
```

Full product blueprint + agent guides: **[Cambium Composition Layer Technical Reference →](./docs/cambium-composition-technical-reference.html)**

---

## Under the hood — for builders & agents

*Founders never see any of this. It's the machinery that makes "an idea goes in, a business comes out" actually true — the part the abstraction exists to hide.*

## The operator — the infinite game

> Finite games are played to win; the infinite game is played to keep playing. A business is infinite — so the operator doesn't optimize for a single outcome, it optimizes to **stay in the game** while staying **on-brand**. Full contract: **[INFINITE-GAME.md](./INFINITE-GAME.md)**.

The operator wakes on one **move** at a time and folds it through a six-step loop:

```
ingest → route → act → viability → learn → persist
```

It's **event-sourced** — the world-state's version equals the number of events folded in, so any run replays deterministically. The core `wake` is a **pure function**; all the async work (LLM NPCs, NIM embeddings, the cortex) lives in `wakeAsync` around it.

### The micro / meso / macro router (+ the mid-brain bypass)

Every move is classified into one **lane** — or escalated past the lanes entirely:

| Class | Trigger | What happens |
|---|---|---|
| **micro** | a `tweak` | reversible fine-tune, applied instantly, no setpoint move |
| **meso** | a `redirect` / `objection` / `metric` | the **error-vs-intent** why-handler decides: reroll toward the same goal, or absorb a new intent (gated) |
| **macro** | a `reposition` | a setpoint move — **fail-closed**: needs real evidence, clamped to the trust-region α (allostasis) |
| **mid-brain → noesis** | drives **1 (Epic Meaning)** or **8 (Loss)**, or a `calling`/`drift` | bypasses the routine tick and invokes **noesis** — the operator's meaning-making layer, handing the existential moment to the human |
| **heartbeat** | a `probe` | a self-scheduled **viability sweep** so the operator isn't blind while dormant |

### Viability — staying in the game

The operator guards two hard bounds and pulls itself back inside them on a breach (an **emergency override** that pre-empts the planned act):

- **Solvency** — runway days above the floor (30); warns early inside a 15-day band.
- **Mission-coherence** — the brand stays coherent above the floor (0.40).

### NPC self-play — grounded by reality

Two simulated characters keep the loop honest (NVIDIA **NIM** → **Kimi** → deterministic stub, never OpenRouter/OpenAI):

- **ICP-NPC ("Mira")** — role-plays your Ideal Customer: surfaces real **pain-points** and the **resonance gradient** (the direction to move positioning so the pain resolves), grounded in real NIM embeddings.
- **Founder-NPC** — the **intent oracle**: judges whether a deviation is a bad step to *reroll* or *your* new intent to move the goal. Fail-closed (defaults to "error").

The math behind the loop — the Banach contraction toward a brand-DNA fixed point, the viability kernel, the why-handler — is in **[HOMEOSTASIS.md](./HOMEOSTASIS.md)**.

---

## The cortex — memory that compounds

The operator **remembers**. Two complementary lanes, both behind one injected seam (so the backend swaps with zero call-site change):

### Semantic memory — "have I seen this situation before?"

Every wake embeds its *situation* (event + positioning) via **NIM** (1024-d `nv-embedqa-e5-v5`) and writes a `MemoryRecord`. Before acting on a meso/macro move, the operator searches the **k nearest past situations** and surfaces them on the decision — *"seen 3× before; last time → reroll"* — feeding the why-handler.

| Transport | When | Properties |
|---|---|---|
| **node:sqlite** | local / offline / tests | persistent, WAL, instant recall, zero-dep (Node built-in) |
| **Cloudflare Vectorize** | production | native kNN at scale, shared across organs, `tenant`/`kind` metadata filters |

The operator **auto-selects Vectorize** when `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (+ `NVIDIA_API_KEY` for 1024-d) are in its env; otherwise it uses node:sqlite. Provision the production index once:

```bash
export CLOUDFLARE_API_TOKEN=…   CLOUDFLARE_ACCOUNT_ID=…   # never commit these
node scripts/provision-vectorize.mjs                       # 1024-d cosine + tenant/kind metadata indexes
```

Recall is **tenant-isolated** (no venture sees another's memory) and **best-effort** (a cortex hiccup never crashes a wake). Run `operator demo` twice and watch the `↺` markers — the second run recalls the first.

### Structural memory — "what did we build?"

A separate lane: when the operator ships software, it remembers that code **structurally** by querying the venture's **CodeGraph** (symbols / call-graph). Different math — codegraph can't do cosine kNN; the cortex can't do call-graph traversal. Two lanes, one operator.

```bash
node bin/operator/cli.ts coderecall "wake"     # → real symbols: method wake_up, function wakeAsync, …
```

---

## The onboarding — the first session

If the operator is a game, the founder is the **player**, and every good game opens with a **tutorial** that teaches the loop while it hooks. `operator onboard` is that tutorial — the **first 20 interactions**, each engineered against one of Yu-kai Chou's **Octalysis** 8 core drives, each teaching one piece of the micro/meso/macro loop.

```bash
node bin/operator/cli.ts onboard            # walk it, pausing at each step
node bin/operator/cli.ts onboard --auto     # autoplay the whole session
```

It opens and closes on **Epic Meaning** (the White-Hat bookends of an infinite game), holds a distinct **noesis frame** at the existential beats (the calling, drift, the game continuing), and ends on a full **Octalysis panel** (which of the 8 drives lit, the White/Black/mid-brain balance). Design: **[ONBOARDING-OCTALYSIS.md](./ONBOARDING-OCTALYSIS.md)**.

The onboarding is the tutorial; the rest of the game is the **quest log + skill forge** (`quine quests` · `quine skills` — the venture's "you are here" map, derived from real world-state, and repetitive processes minted as self-improving skills). Design: **[QUESTLOG.md](./QUESTLOG.md)**.

---

## The composition layer — reliable variable contracts

Cambium doesn't pass fuzzy instructions between stages. It passes structured **variable groups** so every downstream organ (and every agent) knows exactly what to preserve:

| Group | Carries | Why it matters |
|---|---|---|
| `brand_system` | identity, positioning, voice | stays consistent with who you are |
| `copy_system` | headlines, CTAs, proof, tone | messaging never drifts |
| `visual_system` | palette, typography, motion | the look & feel is protected |
| `asset_plan` | required media + specs | no missing or inconsistent assets |
| `section_plan` | narrative + copy/asset bindings | pages stay coherent |
| `interaction_plan` | states, triggers, validation | UX feels like *your* brand |
| `acceptance_checks` | brand-fit gates + launch criteria | nothing ships that breaks the promise |

The pipeline: **Genesis** mints the brand system → **Taste** turns it into creative direction (scored against the growing aesthetic memory) → **Hands** build on-brand with hard gates → **Will** ships live GTM. The composition layer is the conductor that defines the contracts, enforces the gates, and hands off cleanly.

**Built for agents & orchestration (first-class):** explicit "For Agents & Conductors" guidance, consumption checklists (preserve the groups, check viability before spend, record intent on deviations), and machine-readable artifacts — the same patterns work whether a human or an agent is driving.

**Real proof:** *Fitcheck* (AI virtual try-on) was the first full end-to-end tracer — idea → brand system across 7+ waves → real generated imagery on two backends → on-brand scoring + intelligent reroll → packaged, registered, ready. The contracts and gates did the coordination, not heroic oversight.

---

## CLI reference — `node bin/operator/cli.ts <cmd>`

| Command | What it does |
|---|---|
| `onboard [--auto] [--restart]` | the 20-interaction Octalysis first session |
| `demo` | run a sample stream of moves through the loop |
| `wake '{"id":"x","kind":"tweak"}'` | wake on a single event |
| `heartbeat` | one viability sweep |
| `run [ms] [maxTicks]` | the heartbeat daemon |
| `icp ["positioning"]` | ask the ICP-NPC (pains + resonance) |
| `resonance ["positioning"]` | the ICP gradient — pains + real cosine resonance (NIM) |
| `coderecall "<query>" [--project <path>]` | structural code-recall (CodeGraph lane) |
| `state` | dump the current world-state |

---

## Roadmap

| Milestone | Status |
|---|---|
| **M1 · Onboarding Loop** ([#9–#14](https://github.com/Sheshiyer/cambium/milestone/1)) | ✅ complete — `operator onboard`, held noesis frames, Octalysis panel |
| **M2 · Cortex Search** ([#15–#19, #24](https://github.com/Sheshiyer/cambium/milestone/2)) | ✅ complete — semantic (sqlite/Vectorize) + structural (codegraph), Vectorize **live** |
| **M3 · Multi-Tenancy** ([#20–#23](https://github.com/Sheshiyer/cambium/milestone/3)) | 🔜 next — one operator, many ventures (the cortex is already tenant-isolated) |
| **M4 · Quest Log & Skill Forge** | ✅ complete — **v0.2.1 · Thalia .1**: `quine quests`/`skills`, the forge telemetry loop, and the **curios.self miniapp** live at [curious.thoughtseed.space](https://curious.thoughtseed.space) |

**Beyond M3** — the operator goes fully cloud-native on the same Cloudflare account that already hosts the cortex: the wake loop as a **Durable-Object agent** (persistent state + scheduled heartbeat), **DNS + Registrar** so the operator registers and configures domains for ventures it ships, **Email** delivery, and **Browser Rendering** for the Hands organ. Track it on the **[issues board](https://github.com/Sheshiyer/cambium/issues)**.

---

## Documentation

| Doc | What it covers |
|---|---|
| [INFINITE-GAME.md](./INFINITE-GAME.md) | the operator contract — wake loop, router, viability, NPCs, noesis |
| [ONBOARDING-OCTALYSIS.md](./ONBOARDING-OCTALYSIS.md) | the 20-interaction first session, drive by drive |
| [QUESTLOG.md](./QUESTLOG.md) | the quest line (you-are-here map) + the skill forge (repetition → self-improving skills) |
| [HOMEOSTASIS.md](./HOMEOSTASIS.md) | the math — Banach contraction, viability kernel, why-handler |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | the organ constellation + composition layer |
| [BUSINESS-MODEL.md](./BUSINESS-MODEL.md) | free build, subscription taste + memory |
| [INTEGRATION.md](./INTEGRATION.md) | how organs and agents wire together |
| [Technical Reference](./docs/cambium-composition-technical-reference.html) | the canonical product + agent-consumption guide |

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=80&section=footer" width="100%" />

**For the businesses that never stop growing on-brand.**

[Thoughtseed constellation](https://github.com/Sheshiyer)

</div>
