# The Infinite Game — Cambium as a viable, evolving, never-terminating operator

> *Companion to [HOMEOSTASIS.md](./HOMEOSTASIS.md). Where Homeostasis gives the math of a **single
> finite run** (converge to the brand-DNA fixed point and stop), this document gives the math of the
> **layer above it**: the unbounded game of keeping a business alive and evolving — forever.*
>
> **Thesis.** A business is an **infinite game** (Carse; Sinek): there is no final whistle, the rules
> mutate, players enter and leave, and the only way to lose is to *stop being able to play.* A system
> built to *win* a business — to converge to a fixed answer and go dormant — is therefore built for the
> **wrong game**. Cambium's organs are correct as **finite-game players** (mint a brand, build a site —
> bounded games that *should* end). What was missing is the **infinite-game operator** that sits above
> them: it never terminates, it keeps the business inside the *set of states from which play can
> continue* (the **viability kernel**), it lets the brand-DNA setpoint **move** (allostasis) instead of
> defending a frozen one, it **co-evolves** strategy against a moving market (Red Queen), and it
> optimizes the **vision → mission → goal** cascade so that **revenue and growth fall out downstream**
> as regulated fuel — never as the target.

---

## 0. TL;DR — the spine in one screen

| | **Finite layer** (the organs — already built) | **Infinite layer** (the operator — to build) |
|---|---|---|
| Plays | a *bounded* game: mint · build · market · operate | the *unbounded* game: stay alive, keep advancing |
| Lifecycle | run → **converge → dormant** ✅ (correct) | **never terminates**; dormant *between events*, never *done* |
| Objective | hit the brief (reach this run's `x*`) | **never leave the viability kernel**; advance the Just Cause |
| Physics | **Banach contraction** ([HOMEOSTASIS.md](./HOMEOSTASIS.md)) | **viability + allostasis + co-evolution** (§5) |
| Setpoint | fixed `x*` for the run | `x*` **moves** (predictive, evidence-gated) |
| Optimizes | the artifact | the **vision→mission→goal cascade** (§6) |
| Treats revenue as | n/a | a **downstream regulated output** + a **solvency *bound*** — never the objective |
| Time | a line that ends | a loop that doesn't |

**One sentence:** *Keep the organs as finite-game players; build one operator above them whose physics is
viability + allostasis + co-evolution (not convergence), that optimizes the vision→mission→goal cascade so
revenue/growth are regulated downstream with solvency as a viability bound — grown from `bin/compose.mjs`,
with the **vision as the near-invariant anchor** that keeps the evolution coherent.*

---

## 1. The diagnosis — why a compiler is the wrong machine

Cambium today is a **compiler**: `Φ = Φ_ops ∘ Φ_build ∘ Φ_taste ∘ Φ_genesis` runs **once**, left-to-right,
idea → business, and each organ — a typed morphism — **fires, emits a frozen artifact, and goes dormant.**
Downstream organs *read* that artifact; nothing *writes back*. After six months of building the organs in
silos, the limitation is now concrete and lived:

1. **Unidirectional.** Genesis (meristem) mints a brand; the brand-spec is then **write-once / read-only.**
   The feedback edges in the README diagram (`BIZ -.learnings.-> BM`) are *drawn but cannot fire* — you
   cannot write into a dormant organ.
2. **Terminal.** Even the homeostasis loop *converges to `x*` and stops.* "Run to completion, then sleep."
   A correct play of a **finite** game.
3. **No meta-player.** Nothing decides *when to play which finite game next*, carries learning *across*
   runs, or asks *are we still viable?* There is no layer whose job is **to keep the business in the
   game.**

A compiler produces a binary and the binary is dead. A business must stay **alive.** That is not a bug in
the organs; it is a **missing layer.**

---

## 2. Finite & infinite games (the frame)

| | **Finite game** | **Infinite game** |
|---|---|---|
| Players | known, fixed | known **and unknown**; they enter/leave |
| Rules | fixed, agreed | **mutable** over time |
| Boundaries | time/space bounded | unbounded |
| Purpose | **to win** (and end) | **to keep playing** (perpetuate) |
| You lose by | being out-scored at the whistle | **running out of will or resources** (dropping out) |
| Winning | exists | **does not exist** — there is only *staying in, well-positioned* |

*(Carse, "Finite and Infinite Games", 1986; Sinek, "The Infinite Game", 2019.)*

**Business is an infinite game.** No competitor "wins" capitalism; firms simply **drop out** when they run
out of will or resources. The implication for architecture is total: a system that **optimizes a finite
metric** (this quarter's revenue) inside an infinite game **games the metric and erodes the game** (Goodhart).
The winning posture is to **advance a Just Cause** (a vision larger than any finite win) and to **stay
solvent enough to keep playing** — revenue is the *fuel*, not the *finish line*.

> **Corollary (resolves the homeostasis tension).** In an infinite game, **convergence to a fixed point is
> death** — equilibrium is the end of play. The "moving setpoint breaks Banach" objection is not a defect to
> patch; **perpetual, bounded motion is the objective.** Banach is retained, but *demoted* to the physics of
> the finite runs (§5.1).

---

## 3. The structural move — finite games nested inside an infinite one

The reconciliation that makes everything fit:

```
                ┌──────────────────────────────────────────────────────────────┐
                │            INFINITE GAME  —  the operator (new)                │
                │  • never terminates   • holds the evolving vision/mission/goal │
                │  • keeps state inside the viability kernel  • carries learning │
                │  • decides WHICH finite game to play next, and WHEN            │
                │                                                                │
                │     ┌────────────┐  ┌────────────┐  ┌──────────┐  ┌─────────┐  │
                │     │  genesis   │  │   taste    │  │  hands   │  │  will   │  │  ← FINITE games
                │     │ (meristem) │  │ (cortex)   │  │ clusters │  │ snow-gl │  │    run → converge
                │     └────────────┘  └────────────┘  └──────────┘  └─────────┘  │    → dormant ✅
                │            ▲ re-invoke as the game evolves; learning flows back │
                └──────────────────────────────────────────────────────────────┘
```

- **The organs are finite-game players, and they are correct as-is.** Minting a brand *is* a finite game
  with an end; converging and going dormant is the *right* behaviour. **We do not rewrite them into
  always-on systems.**
- **The operator is the infinite-game layer above them.** It never terminates. It is the only thing that
  holds the *evolving* vision/mission/goal, watches viability, **re-invokes** finite games as the game
  changes, and carries learning across runs.

This dissolves the original complaint without fighting the architecture: *dormancy was never the problem —
the **absent meta-player** was.*

---

## 4. The operator — anatomy

The infinite-game operator is a single long-lived process (grown from `bin/compose.mjs`) with these parts:

| Part | Role |
|---|---|
| **World-state** (typed, event-sourced) | the authoritative, *mutable*, replayable state of the venture — entities (Brand, Artifacts, Goals, NPCs, Business) with typed components. **Not** the embedding; the embedding is one derived field on it (§5, §11). |
| **Cortex bridge** | read/write the 1024-dim NIM metric space; turns artifacts/positions into points `x ∈ X` and answers "distance to setpoint." |
| **Wake loop** | event-driven: dormant → an event arrives → one tick → persist → dormant (§9). |
| **Router** | classifies each event on the **micro/meso/macro** Venn → which subsystem, which tick-rate, which gate (§7). |
| **Viability monitor** | the infinite-game physics: is the state inside the *keep-playing* set? how much margin? (§5.2) |
| **Cascade controller** | regulates **vision→mission→goal**; revenue/growth are its *downstream regulated outputs*; solvency is a *bound* (§6). |
| **NPC sims** (Founder + ICP) | self-play / exploration; emit pain-vectors, resonance directions, and the *error-vs-intent* bit — grounded by real-player signal (§8). |
| **Fail-closed gate** | no irreversible/paid move (a finite-game run, a setpoint move) fires off the approved, viable trajectory (inherits `gateStage`). |
| **Replay log** | the event log (`deviations.jsonl` → the unified cortex transport) — full deterministic replay of the venture's life. |

---

## 5. The math — from convergence to *staying in the game*

### 5.1 Banach is demoted, not deleted (finite-run physics)

Each organ run is a finite game with a *fixed* setpoint `x*_run`. Within a run, [HOMEOSTASIS.md](./HOMEOSTASIS.md)
holds **exactly**: every stage is a contraction (`Lᵢ < 1`), the composition has a unique fixed point, and
`d(xₙ, x*_run) ≤ Lⁿ d(x₀, x*_run) → 0`. **Banach is the correct physics *inside* a finite run.** What changes
is that the operator may, *between* runs, **move the setpoint itself** — which Banach neither permits nor
describes. That is the infinite layer's job, and it needs different mathematics.

### 5.2 Viability theory — the keep-playing set (Aubin)

Let the venture's state be `s ∈ S` evolving under chosen controls `u ∈ U` (which finite game to run, how to
move the setpoint, etc.): `ṡ = f(s, u)`. Define the **constraint set** `K ⊆ S` — the states that are
*acceptable to keep playing in* (solvent, on-mission, legally clear, not burned-out). The **viability kernel**
is

```
Viab(K) = { s₀ ∈ K : ∃ a control trajectory u(·) keeping s(t) ∈ K  for ALL t ≥ 0 }
```

— the largest set of states from which the game **can be continued forever.** The control law is not "minimize
distance to a point"; it is:

```
stay inside Viab(K);  on its boundary, choose u that points the state back inward (a viable control).
```

This is, literally, the mathematics of *an infinite game*: **winning = never leaving `Viab(K)` = never being
forced to drop out.** Sustainability/ecology/economics use it for exactly the "can we keep going indefinitely?"
question. *(Aubin, "Viability Theory", 1991.)*

> **Honest caveat (a real risk, §13).** Computing `Viab(K)` exactly in 1024-D is intractable. We do **not**
> compute it. We **approximate** it with (a) a handful of *hard bounds* (solvency floor, mission-coherence
> floor, legal/ethical bounds) and (b) a *learned* viability boundary in the NIM space. The doctrine is:
> *act to keep visible margin to every bound positive; treat margin collapse as the only true emergency.*

### 5.3 Allostasis — stability *through* change, not *through* constancy

Homeostasis defends a **fixed** setpoint. **Allostasis** (Sterling & Eyer) *predictively moves the setpoint*
to meet anticipated demand — "stability through change." For the operator: the brand-DNA / mission setpoint
`x*` is **not** defended as constant; it is **allostatically re-aimed** to keep the venture viable as the
world moves:

```
x*(t+1) = x*(t) + α · g(t)            (the setpoint itself is a controlled variable)
   g(t) = a bounded, evidence-gated step  (resonance direction from real signal; §8)
   α    = a trust-region: how far the setpoint may move per wake (a hard cap)
```

The setpoint move is **always** trust-region-bounded and **evidence-gated** (it requires *real* signal, not
just a simulation — §8). This is the engineering form of "evolve with it."

### 5.4 Co-evolution — the Red Queen (evolutionary game theory)

Fitness is **relative to a moving population** (market, customers, rivals). The "Red Queen": *it takes all the
running you can do to stay in the same place* — you must keep evolving merely to hold position. Strategy is
therefore not optimized once; it is **co-evolved** against a population that is itself adapting. Mechanically:
treat the live mix of strategies/messages as a population under **replicator-style dynamics** — variants that
resonate (win real attention/adoption) gain weight; variants that don't decay — with the fitness landscape
*itself shifting* as rivals respond. The operator runs a continual *vary → test-against-reality → reweight*
loop, never a one-shot optimization.

### 5.5 The combined objective

The operator does **not** maximize revenue, growth, or `−d(x, x*)`. It maximizes, roughly:

```
maximize    "time-in-game"  ≈  ∫ (viability margin) dt        (keep playing, forever)
subject to  s(t) ∈ Viab(K)  ∀t                                 (never forced out)
            solvency(t) ≥ 0                                     (the hard bound — fuel)
while       advancing the Just-Cause vector  v_vision          (the direction of play)
```

Revenue/growth appear only as (i) **regulated downstream outputs** of mission-coherence and (ii) a **solvency
bound** inside `K`. *Optimize the source (mission), bound the fuel (solvency), and the metrics follow.*

---

## 6. The cascade — optimize the source, regulate the outputs

```
VISION   ── the Just Cause; near-invariant; the slow anchor (changes on the order of years)
  │  regulates ↓                                                ↑ informs (signal up)
MISSION  ── how we pursue the vision now; evolves allostatically (quarters)
  │  regulates ↓                                                ↑
GOALS    ── current finite games, nested; come and go (weeks–months)
  │  regulates ↓                                                ↑
REVENUE / GROWTH  ── regulated DOWNSTREAM outputs (the fuel) — NEVER the optimization target
                     (solvency is a viability BOUND, crossed = out of the game)
```

- **Control flows down; signal flows up.** The vision regulates the mission, which regulates goals, which
  regulate tactics. Real-world signal (adoption, revenue, market) flows *up* to tell the operator whether the
  current pursuit is viable — not to *become* the objective.
- **Goodhart-safety.** Because the optimization target is **mission-coherence**, not the metric, the metric
  cannot be gamed into hollow growth. Revenue is *evidence of* and *fuel for* the mission, not its purpose.
- **Why this is "the way to win."** In an infinite game there is no winning — there is *staying in, advancing.*
  Optimizing the cascade's **source** (vision/mission coherence) is what keeps the venture **both viable and
  advancing**, and revenue/growth are the regulated outputs that keep it fuelled. That is the only "win"
  available.

---

## 7. micro / meso / macro — the operator's control hierarchy

The interaction taxonomy is the **router** and a **multi-rate control stack.** Every event is positioned on the
Venn; its position decides *which subsystem*, *which rate*, *which gate*.

| Aspect | Is | Control role | Setpoint effect | Rate · gate |
|---|---|---|---|---|
| **MICRO** | fine-tune / update | tactical, on-mission moves | none (stay within `x*`) | fast · auto · reversible |
| **MESO** | situational · human behaviour · psychology | **co-evolution**: read real + simulated players, decide *error-vs-intent*, propose direction | proposes `g(t)` | event-driven · reactive |
| **MACRO** | vision / mission / goal | viability + Just-Cause regulation | **moves `x*`** (allostasis, trust-region) | slow · deliberate · **gated** |

**Why a Venn (the overlaps carry the value):** `micro∩meso` = situational fine-tune; `macro∩meso` = a goal
reframed by human reality; `macro∩micro` = goal-aligned autopilot; **center (all three)** = the rarest,
highest-leverage move — a psychology-driven signal that adjusts the artifact *and* moves the goal *and*
teaches the operator. Meso is the **soul**: the bridge between rigid vision (macro) and mechanical tweaks
(micro); it is the layer that makes the operator *adaptive* rather than merely convergent.

**The mid-brain bypass → noesis.** Beyond the three lanes, the *vertical* Octalysis axis — `1` Epic
Meaning (top) ↕ `8` Loss & Avoidance (bottom), i.e. **meaning ↔ survival** — is the **mid-brain**. Events
on it **bypass the routine tick and invoke `noesis`** (the operator's higher meaning / intuition layer):
the existential moments — the calling, and the threat of dropping out of the game — get the deepest,
most-considered response, escalating to the real human when the stakes are real. See
[ONBOARDING-OCTALYSIS.md](./ONBOARDING-OCTALYSIS.md).

---

## 8. The two NPCs — self-play, grounded by reality

Meso runs two LLM-driven agents bridged into the cortex space. They are **self-play** (cheap, fallible
exploration — like the rollouts in a game-playing engine), **never** ground truth.

- **ICP NPC** — conditioned on the buyer persona. Interrogated against any artifact/positioning, it returns:
  **pain-point vectors** (where the customer hurts, embedded in `X`), a **resonance direction** `g` (which way
  to move positioning so the pain resolves), and objection signals. These propose the allostatic setpoint step
  (§5.3).
- **Founder NPC** — conditioned on operating logic / taste / risk appetite. It is the **intent oracle** for the
  *error-vs-intent* one-bit (is a deviation a bad step to reroll, or the founder's new intent to absorb?), and
  it gates taste/risk on proposed moves.

> **Anti-echo-chamber doctrine (the §C2 fix, mandatory).** A simulation optimized against itself collapses
> into a confident fantasy (model collapse). Therefore: **the NPCs may *propose* but may not *commit*.** A
> setpoint move (`x*` change) requires **real-player evidence** — a real reply, a real metric, a real
> conversation — before the gate opens. Self-play explores the tree; **reality is the evaluation function.**
> Escalate to the *real* human only when the NPCs disagree or confidence is low.

---

## 9. The wake loop — one move in the infinite game

```
[dormant] ──────── event arrives (founder action · customer signal · metric · scheduled probe) ───────▶ WAKE
   │
   1. INGEST     parse the event → embed into cortex → upsert the affected world-state entity (x)
   2. ROUTE      classify on the micro∩meso∩macro Venn  →  (subsystem, rate, gate)
   3. ACT (one tick, by class):
        micro →  apply the on-mission tactical correction        (auto, reversible)        ; verify it didn't
                                                                                              lower viability
        meso  →  run ICP + Founder NPCs  →  pain-vectors, resonance direction g, intent-bit ; propose
        macro →  if INTENT and REAL evidence present and within trust-region:
                    move x* ← x* + α·g ; update mission/goal & contracts ; possibly RE-INVOKE a finite-game
                    organ (re-mint / re-build / re-GTM)                                       ; GATED (fail-closed)
   4. VIABILITY  recompute margins to every bound (solvency, mission-coherence, …) ; if any margin < 0 → EMERGENCY
                 control (defensive move back inside Viab(K)) instead of the planned act
   5. LEARN      carry the resolution into the cortex so the next finite-run starts smarter (cross-run learning)
   6. PERSIST    append the event + the decision to the replay log ; checkpoint world-state
   │
   └────────────────────────────────────────────────────────────────────────────────▶ [dormant]  (until next event)
```

The game **never ends**; each wake is one **move**. Between moves the operator sleeps (cheap). Because every
move is logged, the venture's entire life is **deterministically replayable** — the defining property we want.

---

## 10. Invariants & the contract (before any code)

**The operator MUST:**
1. **Never terminate.** Dormant between events; never "done."
2. **Keep state inside (the approximation of) `Viab(K)`.** Treat margin-to-bound collapse as the only true
   emergency, pre-empting any planned act.
3. **Hold the vision as a near-invariant.** The vision is the slowest variable — the anchor that makes the
   evolution *coherent and ours.* Mission/goals evolve freely; the vision barely moves.
4. **Optimize the cascade source (vision→mission→goal), never a downstream metric.** Revenue/growth are
   regulated outputs; **solvency is a bound.**
5. **Gate every setpoint move and every irreversible/paid finite-run** on the fail-closed gate **and on real
   evidence** (not simulation alone).
6. **Bound every setpoint move by a trust-region** `α`.
7. **Log every event + decision** to the replay buffer (full replay).
8. **Carry learning across finite runs** (each re-invocation starts smarter).

**The operator MUST NOT:**
1. **Rewrite organs into always-on systems.** Organs stay finite-game players, invoked as services.
2. **Commit a setpoint move on simulated (NPC) signal alone** (anti-echo-chamber).
3. **Optimize revenue/growth directly** (Goodhart).
4. **Converge to and rest at a fixed point** (that is finite-game death).
5. **Claim to compute the exact viability kernel** (it approximates, and says so).

---

## 11. Map — infinite-game object ⇄ Cambium artifact

| Infinite-game object | Definition | Cambium artifact |
|---|---|---|
| Finite-run physics | converge to `x*_run` | [HOMEOSTASIS.md](./HOMEOSTASIS.md) (scoped to a run) |
| Viability kernel `Viab(K)` | the keep-playing set | **new**: viability monitor (approx: hard bounds + learned boundary in NIM) |
| Setpoint `x*` (allostatic) | moving brand-DNA / mission | genesis `brand-spec.json` made *mutable* + the cascade |
| Trust-region `α` | cap on setpoint motion / wake | **new**: operator config |
| State space `(X,d)` | embedding vector space, cosine | the cortex (`CortexStore` / `makeCortex` transport) |
| World-state | typed, event-sourced venture state | **new**: operator store (embedding is one derived field) |
| Organs Φᵢ | finite-game players | `registry.json` + `adapters.json` (invoked as services) |
| Router (micro/meso/macro) | event classifier | **new**: extends `bin/compose.mjs` |
| Meso / NPCs | self-play + intent oracle | **new**: extends `whyhandler.mjs` (1-bit → 2 NPCs) |
| Cascade controller | vision→mission→goal→revenue | **new** |
| Fail-closed gate | safety + spend | `gateStage` (`bin/lib/invoke.mjs`) |
| Replay log | event sourcing | `deviations.jsonl` → unified cortex transport |
| Self-similarity | same shape at every scale | the fractal repo pattern (the operator is itself self-similar across venture/portfolio) |

---

## 12. Language & build strategy (flexible — not Rust-bent)

Pick the layer that must evolve fastest, and grow what already breathes:

- **Operator core: TypeScript**, grown directly from `bin/compose.mjs` (already the Node conductor). Native
  LLM/agent glue, shares the Node organ ecosystem (`skill-clusters`), fastest iteration on the meso/NPC layer —
  exactly where the value and the churn live. Contracts as **runtime-validated schemas** (zod), so they can
  change daily without a recompile + type-surgery tax.
- **Organs stay where they are** (Python/Node/Workers), invoked as services — *do not* port them.
- **Harden later, only if needed.** Once the contracts stop moving, lift the *stable* kernel (event store,
  viability monitor, gate, replay) to **Go or Rust** for a durable single binary. Lead with iteration speed
  now; buy invariants later.

*(Rejected for now: Rust + `bevy_ecs` as the spine — premature; typestate-encoded contracts ossify the very
layer that must stay fluid, and an ECS's cache-iteration win is irrelevant at this entity-count/cost-profile.)*

---

## 13. Risks & open questions (kept honest)

1. **Viability is intractable; we approximate.** The kernel is never computed. Risk: a learned boundary is
   wrong near a real cliff. Mitigation: a few *hard, conservative* bounds (solvency above all) dominate the
   learned one; margin-collapse pre-empts everything.
2. **Evolve-into-incoherence.** Allostasis can wander the brand into nonsense. Mitigation: the **vision is the
   slow anchor** (Invariant 3); the trust-region `α` caps per-wake motion.
3. **Simulated players ≠ real players.** Anti-echo-chamber doctrine (§8): NPCs propose, reality commits.
4. **What emits events, and at what cadence?** Event-driven = blind while asleep. Need **scheduled probe /
   heartbeat events** (a viability sweep on a timer) or the operator is reactive-only. *Open.*
5. **Does the Venn actually partition?** If most real interactions sit in the center, the router under-routes.
   *Test on ~20 real interactions before trusting it.* *Open.*
6. **Multi-tenancy.** One operator / many ventures (`snow-gloves` tenants) — one world per tenant, shared
   cortex/learning. Topology *open.*
7. **Who owns the "intent" bit at scale?** Founder-NPC vs the real founder — escalation policy *open.*

---

## 14. Glossary

- **Finite game** — bounded, played to win and end (a brand mint, a launch). The organs.
- **Infinite game** — unbounded, played to keep playing (the business). The operator.
- **Just Cause / vision** — the near-invariant aspiration that gives continuity; the slow anchor.
- **Viability kernel `Viab(K)`** — the set of states from which play can continue forever.
- **Allostasis** — stability *through change*: predictively moving the setpoint to stay viable.
- **Homeostasis** — stability *through constancy*: defending a fixed setpoint (the *finite-run* physics).
- **Red Queen** — you must keep evolving merely to hold relative position against a moving market.
- **Cascade** — vision→mission→goal→revenue; control down, signal up; optimize the source, regulate the output.
- **Trust-region `α`** — the hard cap on how far the setpoint may move per wake.
- **NPC (Founder / ICP)** — a simulated player for self-play exploration; proposes, never commits.

---

*Status: architecture contract, pre-code. Companion to ARCHITECTURE.md (the constellation), HOMEOSTASIS.md
(the finite-run physics), and INTEGRATION.md (the wiring roadmap). The operator is the next organ Cambium
grows — the one that keeps all the others playing.*

## Multi-tenancy — one operator, many gardens (M3)

The operator hosts MANY ventures. The contract, proven adversarially by
`bin/operator/tenant.test.ts`:

- **Identity** — tenant ids are **portable org slugs** (lowercase kebab). They are NEVER invented
  ad-hoc: the registry (`.operator/tenants.json`) derives
  from worlds that already exist (*registration-from-reality*), and `registerTenant` rejects ids
  with no world behind them.
- **Isolation** — no event, vector, deviation, contract, or setpoint move crosses tenants:
  worlds live at `.operator/<tenant>.*`; cortex contracts + deviation ledgers are path-namespaced
  under `cortex/<tenant>/…`; vector search through `tenantScopedStore` is FORCE-filtered to the
  active tenant (an explicit filter override is ignored — A ∩ B = ∅ by construction).
- **Runtime** — `operator … --tenant <id>` routes a wake to that venture's world (registry-
  validated); the heartbeat sweeps **every** registered tenant each tick (`runHeartbeatMulti`),
  so no garden goes blind while another is tended.

The quest log's arc VII (*Many Gardens*) flips on exactly this evidence — more than one garden
AND the isolation suite green. No fake progress applies to tenancy too.
