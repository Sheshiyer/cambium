# Homeostasis — keeping a finite run coherent

Homeostasis is Cambium's doctrine for a bounded organ run: preserve declared intent, detect divergence, stop unsafe propagation, and turn a justified redirect into a new proposal. It is not a claim that the current runtime has mathematically proved contraction in a 1024-dimensional semantic space.

The operational reference is the [Fitcheck golden path](./docs/architecture/fitcheck-golden-path.md).

## 1. State, setpoint, and evidence

For a finite run, let:

- `x` be the current artifact state;
- `x*` be the admitted task's intended state, assembled from versioned contracts and acceptance criteria;
- `d(x, x*)` be an evaluation of divergence;
- `V(x) = d(x, x*)` be the run's error signal.

An embedding distance may contribute to `d`, but it cannot be the whole judgment. Identity, required fields, claims, legal limits, spend bounds, accessibility, and human approval are typed constraints that must remain independently inspectable.

## 2. The finite operator

```text
Φ = verify ∘ operate ∘ build ∘ taste ∘ genesis
```

Each stage is a typed transformation. Composition is valid only when the previous output satisfies the next input contract. A JSON-shape check can catch a structural seam failure; it does not prove semantic quality or on-brand convergence.

## 3. Contraction as a design requirement

If every stage were a contraction around a fixed setpoint,

```text
d(Φᵢ(x), x*) ≤ Lᵢ · d(x, x*)  where 0 ≤ Lᵢ < 1,
```

then their composition would contract with `L = ∏Lᵢ`, and Banach's fixed-point result would justify convergence within that finite run.

Cambium uses this as a **design obligation**, not as current empirical proof. To claim measured contraction, a run must expose:

1. a stable, versioned setpoint;
2. a declared metric with calibrated thresholds;
3. before/after measurements for every stage;
4. evidence that the metric captures semantic and policy constraints;
5. repeated results sufficient to estimate a local bound.

Until then, UI language should say “checked against the packet/contract” or “structural verification passed,” not “mathematically converged” or “self-healed.”

## 4. Two kinds of drift

| Drift class | Signal | Safe response |
|---|---|---|
| Contract drift | required identity, field, type, bound, or provenance is missing or contradictory | stop; do not feed the output forward |
| Semantic drift | artifact conflicts with the admitted story, claims, audience, or success criteria | hold for evidence-backed review or reroll |
| Execution drift | actual run differs from its admitted task/loadout/version | fail closed and preserve the mismatch receipt |
| Intent change | founder deliberately changes the target | prepare a new versioned proposal; never rewrite history |

Fitcheck's original “fitness instead of virtual try-on” failure is a semantic drift lesson. The current catalog and packet fix the identity and intended story, but they do not prove that a future artifact will preserve it.

## 5. The why-handler

The same divergence can mean a bad step or a changed intent:

```text
detect deviation
  → default to ERROR and hold/reroll
  → if the founder asserts INTENT, capture the reason and evidence
  → prepare x*' as a new versioned proposal
  → pass a signed Gate
  → commit through the owning authority
  → run again against x*'
```

The why-handler therefore does not “learn” by silently absorbing a redirect. It records a classified deviation and produces a bounded next-intent candidate. Learning becomes operational only after the appropriate authority accepts it.

## 6. The safety gate

No irreversible, paid, public, or externally visible step should fire while identity, intent, divergence, or authority is unresolved.

| Move | Minimum gate evidence |
|---|---|
| reversible local proposal | exact WorkObject and packet version |
| provider/spend action | admitted task, explicit approval, budget, rollback |
| public claim or publication | claim-specific proof and named owner |
| Goal Graph change | signed action, current graph version, D1 CAS |
| skill/loadout promotion | governed catalog decision and apply receipt |

## 7. Evidence and foldback

A completed run emits facts:

- the exact task, WorkObject, graph version, and loadout;
- inputs and output digests, without secret or private prompt bodies;
- terminal state and failure class;
- gate and spend receipts;
- proof that may support or falsify the packet hypothesis.

Those facts may produce `proves` and `informs-next-intent` edges in Mission Fabric. They do not directly move `x*`, promote a skill, or mutate D1.

## 8. Fitcheck as the first honest loop

Fitcheck's current state is:

```text
identity exact ✓
systems graph exact ✓
packet exact ✓
UI projection exact ✓
mapping receipt readback unproved
live D1 task anchor unproved
live loadout pin unproved
Hermes execution unproved
terminal foldback unproved
```

The first homeostatic proof is therefore not “the system autonomously healed Fitcheck.” It is:

1. Fitcheck's landing and HDILINT backend remain distinct, typed, and authority-bound;
2. the exact Fitcheck mapping receipt is issued and read back;
3. only then is one exact Fitcheck task admitted;
4. one governed loadout is pinned;
5. one bounded run returns a terminal receipt;
6. the receipt is reconciled against the admitted criteria;
7. any divergence becomes a new gated proposal;
8. no surface skips or relabels a missing stage.

## 9. Implementation map

| Concept | Current artifact | Truth level |
|---|---|---|
| typed pipeline | `composition/pipeline.json`, `composition/CONTRACTS.md` | local |
| invocation/spend gate | `adapters.json`, `bin/lib/invoke.mjs` | local |
| structural output check | `verifyOutput` path in the conductor | local, bounded |
| deviation classifier | `bin/lib/whyhandler.mjs` | local seam |
| memory transport | provider-neutral cortex interface + local ledgers | local interface |
| operational intent | D1 Goal Graph | runtime authority |
| read reconciliation | Mission Fabric | local/read-only projection |
| semantic contraction proof | calibrated multi-constraint evaluation | held |
| autonomous setpoint movement | none by design | prohibited |

Homeostasis protects a finite run. [The Infinite Game](./INFINITE-GAME.md) explains how verified finite runs become moves in a venture that never has a final fixed point.
