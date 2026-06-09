# Homeostasis — the math of a self-healing, drift-resistant fractal engine

> *Derived from first principles. Every object below maps to a concrete Cambium artifact (last table).
> The thesis: **drift is not the inevitable cost of long autonomous runs — it is the detectable
> signature of a non-contractive step or a contract violation.** Make every stage a measured contraction
> toward the brand-DNA fixed point, gate the irreversible steps, and treat each deviation as a one-bit
> "error-or-new-intent?" question whose answer updates the invariant. Then the engine converges by
> construction and **learns** its way to staying on-brand — homeostasis.*

## 1. The state space (X, d)

A business, projected onto what matters for *brand*, is a point **x ∈ X** — a vector in the **1024-dim
NIM embedding space** (the cortex). The metric is **cosine distance d(a, b) = 1 − cos(a, b)**. "On-brand"
is not a vibe; it is **small d**. *(Artifact: the shared cortex — `taste-nim` + `DESIGN_MEMORY_WORKER`.)*

## 2. The setpoint x\* (the brand-DNA)

The brand-DNA — persona, positioning, voice, palette, the ISC — is itself a point **x\* ∈ X**: the
**target** we want every artifact to be near, and (claim §4) the **unique fixed point** of the engine.
*(Artifact: genesis output `brand-spec.json` + `brand-docs/`; the ISC criteria.)*

## 3. The operator Φ (the pipeline)

Each stage is a map on X. The engine is their composition:

```
Φ  =  Φ_ops ∘ Φ_build ∘ Φ_taste ∘ Φ_genesis
      idea ─▶ brand-dna ─▶ taste-brief ─▶ artifact ─▶ business
```

A stage is a **typed morphism**: `Φᵢ : Inputᵢ → Outputᵢ`. Composition is **well-defined iff
`Outputᵢ ⊑ Inputᵢ₊₁`** (the output satisfies the next stage's input contract). This typing is a *hard*
constraint — you cannot feed a logo into a GTM filter. *(Artifact: `pipeline.json` stages + their
`input`/`output` contract tokens; `composition/CONTRACTS.md`.)*

## 4. Convergence — why it does NOT drift (Banach fixed-point)

**Definition (contraction).** Φᵢ is a contraction toward x\* with modulus Lᵢ if
`d(Φᵢ(x), x*) ≤ Lᵢ · d(x, x*)`.

**Theorem (Banach, applied).** If every stage is a contraction with `Lᵢ < 1`, then `Φ` is a contraction
with `L = ∏ Lᵢ < 1`. By the Banach fixed-point theorem, **Φ has a unique fixed point x\*** and the iteration
`xₙ₊₁ = Φ(xₙ)` converges geometrically:

```
d(xₙ, x*)  ≤  Lⁿ · d(x₀, x*)   →  0
```

So a *correctly built* engine **cannot drift**: every stage pulls the state closer to brand-DNA, and the
composition is a strict contraction with a single attractor. **The taste cortex is, mathematically, the
operator that makes Φ_taste contractive** — "make it feel on-brand" *is* re-projection toward x\*.

## 5. Drift, formally

**Drift at stage i ⟺ the contraction condition fails locally:**

```
d(Φᵢ(x), x*)  >  d(x, x*)        i.e.  local Lipschitz  Lᵢ ≥ 1
```

the stage pushed the state **away** from the brand-DNA. (The "Fitcheck reads as fitness" miss was exactly
this: `Φ_genesis` dropped the mission, so its output moved away from x\* — `L ≥ 1`.) The second species
of drift is a **contract violation**: `Outputᵢ ⋢ Inputᵢ₊₁` — composition becomes undefined and garbage
propagates. *(`verifyOutput` detects the contract-violation species at the seam.)*

## 6. The Lyapunov function — the engineering form of self-healing

Let **V(x) = d(x, x\*) ≥ 0**, with `V = 0` only at x\*. Then:

```
self-healing   ⟺   V strictly decreasing along the run   ⟺   V(xₙ₊₁) < V(xₙ)   ⟺   Φ contractive
```

The **verify gate's** job is a Lyapunov check: **refuse to advance if a step did not lower V** — reroll /
re-ground until the step is contractive. This is "self-healing" made mechanical: *never accept an
expansive step.* *(Artifact: the on-brand QA + reroll loop; the ISC verification.)*

## 7. The why-handler — the adaptive control law (the heart)

A `V`-spike has **two causes that look identical but are opposite**:

| Cause | What it is | Correct response |
|---|---|---|
| **Error** | the world is unchanged; the step was just bad (`Φᵢ` drifted) | **reject + reroll** toward the *same* x\* — automatic, fail-closed |
| **Intent-change** | the user moved the target (`x* → x*'`) — e.g. *"the logo should contain a garment"* | **absorb**: update x\* and re-converge to the *new* fixed point |

**"Ask why" is precisely the one-bit disambiguation between these** — a recursive system-identification
query. The control law:

```
measure V
  if  V decreased            → accept, continue                      (silent convergence)
  if  V increased  (deviation Δ):
        default = ERROR       → reject, reroll toward x*             (automatic, fail-closed)
        if flagged INTENT
           (user redirect, or a consistent/repeated Δ the cortex
            recognises as a new attractor):
              → ASK WHY  → capture rationale r
              → x*' ← incorporate(Δ, r)                              (move the setpoint)
              → update the contract / ISC / θ                        (so Δ is now on-brand)
              → re-converge to x*'
  always: log (Δ, classification, resolution) to the cortex          (the learning trace)
```

The crucial property: once an intentional deviation is absorbed, **the contract/ISC is updated so the
same deviation never reads as drift again** — it has become part of the invariant. That is the difference
between *obeying* a redirect and *understanding* it: the engine encodes the *why*, so it has **learned**.
This is textbook **adaptive control** (gain-scheduling on a moving setpoint) + **recursive system
identification** (θ updates from observed deviations). *(Artifact to build: wire **I4** — the
drift-classifier + the `AskUserQuestion` "why" prompt + the cortex write-back. `verifyOutput` is its
first seam.)*

## 8. The fail-closed gate — the safety constraint

No irreversible / paid stage (`Φ_genesis` waves, `Φ_taste` NIM, `Φ_ops` Explee) may fire while V is
unresolved or unapproved. Convergence happens on cheap, reversible steps first; **spend only on an
approved, on-track trajectory.** Formally a constrained controller: minimize V subject to "no irreversible
action off the convergence path without approval." *(Artifact: `gateStage` — fail-closed; `spend: gated`.)*

## 9. Self-similarity — the fractal (renormalization fixed point)

Φ has the **same form at every scale**:

```
Φ_skill  ≈  Φ_cluster  ≈  Φ_organ  ≈  Φ_venture  ≈  Φ_company  ≈  Φ_portfolio
            (each: genesis→taste→build→ops + cortex, converging to that scale's brand-DNA)
```

This is a **renormalization-group fixed point**: the operator is scale-invariant, so the convergence and
self-healing properties hold at *every* level — a drifting skill is corrected within its cluster; a
drifting organ within the OS; a drifting venture within the portfolio. **Homeostasis at every scale.**
Because the cortex (the metric space) is *shared* across scales, a lesson learned at one scale propagates
to all. *(Artifact: the self-similar repo pattern — hub-and-spoke + conductor + spec-kit + cortex.)*

## 10. The map — math ⇄ Cambium artifact

| Math object | Definition | Cambium artifact |
|---|---|---|
| State space (X, d) | NIM 1024-dim, cosine distance | the cortex (`taste-nim` + `DESIGN_MEMORY_WORKER`) |
| Setpoint x\* | the brand-DNA fixed point | genesis `brand-spec.json` + ISC |
| Operator Φ | the staged pipeline | `pipeline.json` |
| Stage Φᵢ (typed morphism) | one organ's transform | `registry.json` organ + `adapters.json` |
| Contract `Outputᵢ ⊑ Inputᵢ₊₁` | composition well-definedness | `CONTRACTS.md` + `pipeline.json` tokens |
| Contraction `Lᵢ < 1` | on-brand convergence | the taste cortex (re-projection) |
| Drift `Lᵢ ≥ 1` ∥ contract break | distance increases ∥ type mismatch | `verifyOutput` (seam) + the verify gate |
| Lyapunov V = d(x, x\*) | the error to minimize | the ISC / on-brand score |
| Why-handler (control law) | error-vs-intent → update x\*/θ | **I4** (to wire) — `AskUserQuestion` + cortex write-back |
| Fail-closed gate | safety constraint | `gateStage` (`bin/lib/invoke.mjs`) |
| Scale-invariance | renormalization fixed point | the self-similar repo pattern |

## 11. The minimal first step (this turn): `verifyOutput`

`verifyOutput(adapter, result)` checks a stage's output against its **declared output contract** (a
`json:*` stage must emit parseable JSON). A failure is **drift detected at the seam** — surfaced
(non-fatal) and ready to feed the why-handler. It is the smallest honest piece of §5–§7 made real.

## 12. The why-handler (I4 — wired)

`bin/lib/whyhandler.mjs` turns the §5 drift signal into the §7 loop. `compose run` routes every drifted
stage through it:
- **classify** (`classifyDeviation`) — the one-bit error-vs-intent question. Default **error**
  (fail-closed → reroll toward the same x*); **intent** only when the stage is flagged `--intent <stage>`
  (the operator's redirect; later, a cortex-recognised repeated attractor).
- **resolve** (`resolveDeviation`) — error → **reroll** toward x*; intent → **absorb** Δ into x* and the
  contract (carrying the rationale) so it never reads as drift again.
- **record** (`recordDeviation`) — every deviation is appended to `deviations.jsonl` — the **cortex-write
  STUB**; **I3** swaps in the real NIM Worker so the learning is shared across organs and scales.

**The interactive "ask why" is the orchestration layer.** A CLI can't ask the operator; so when a run
surfaces a drift, the agent driving it calls `AskUserQuestion` using `buildWhyPrompt(deviation)`
(*error → reroll* vs *intent → new direction*), captures the rationale, and feeds it to
`resolveDeviation`. The code ships the mechanism + the seam; the agent supplies the one bit + the why.
