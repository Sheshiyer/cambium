# Integration roadmap — wiring the constellation

Cambium is the **composition layer** (the conductor-of-conductors). The organs stay separate repos;
Cambium composes them as services along the pipeline in [`composition/CONTRACTS.md`](./composition/CONTRACTS.md).
This file tracks the wires that take Cambium from *"composes in principle"* → *"runs a business
end-to-end, on-brand, per tenant."*

> **Status (2026-06-08):** the composition layer itself is **live** — `registry.json` (5 organs),
> `composition/pipeline.json` (genesis→taste→build→ops + cortex), the contracts, and a zero-dep
> dry-run conductor (`bin/compose.mjs`, 8/8 tests). It **plans + validates** the composition today.
> **I1 (brand→GTM) is shipped.** Next: turn each stage from a *plan* into a *live service* (I2).

## The composition layer (this is the home now)

| Artifact | What it is |
|---|---|
| [`registry.json`](./registry.json) | the 5 organs — repo · role · entrypoint · tier (free/paid) |
| [`composition/pipeline.json`](./composition/pipeline.json) | the ordered stages + the cross-cutting cortex |
| [`composition/CONTRACTS.md`](./composition/CONTRACTS.md) | the stage I/O interfaces every wire implements against |
| [`bin/compose.mjs`](./bin/compose.mjs) | the dry-run conductor — `compose plan <tenant>` / `compose validate` |

Run it: `node bin/compose.mjs plan acme`. Test it: `npm test` (or `node --test 'bin/*.test.mjs'`).

### The invocation layer (I2 — live, fail-closed)

`adapters.json` + `bin/lib/invoke.mjs` + `compose run` turn the *planned* stages into **calls the
conductor actually makes** — gated on spend (constitution #4):

| Artifact | Role |
|---|---|
| [`adapters.json`](./adapters.json) | per-organ invocation spec: `cmd` · `args` (with `{tenant}`/`{input}`) · `root_id` · `spend` (none/gated) |
| [`bin/lib/invoke.mjs`](./bin/lib/invoke.mjs) | `resolveRoot` · `buildInvocation` (pure) · **`gateStage`** (the fail-closed gate) · `runStage` (injected runner — never spawns in tests) |
| `compose run <tenant>` | dry-run prints the exact command per stage; **`--execute` spawns ONLY `--approve <stage>` stages**; gated stages otherwise refuse (exit ≠ 0) |

```
node bin/compose.mjs run acme                       # dry-run — prints, spawns nothing
node bin/compose.mjs run acme --execute             # refuses every spend-gated stage (fail-closed)
node bin/compose.mjs run acme --execute --approve taste   # the ONE path that spends (you, deliberately)
```

Roots resolve via `CAMBIUM_ORGAN_ROOTS` (JSON map override) → an adapter `local_dir` → the sibling-dir
convention (the `local_dir`/env override matter on case-sensitive filesystems). Both
taste + genesis are `spend: gated` (taste embeds via the paid NIM; genesis runs the brand-mint waves),
so **nothing spawns without an explicit per-stage approval.**

**The pipeline hand-off (live).** `compose run` threads each stage's output → the next stage's `{input}`
(`runPipeline`); a refused/gated stage breaks the chain (the next falls back to its `input_default`).
Dry-run prints the declared contract flow `[idea → brand-dna → taste-brief → artifact → business]`. The
**hands** stage (`resolve-task`, `spend: none`) **runs live with zero spend** —
`compose run acme --stage build --execute --input examples/sample-tasks.md` executes a real organ
end-to-end (exit 0). Flags: `--stage <id>` (one stage), `--input <value>` (seed stage 1). The full
spend-bearing chain still needs `--approve` on genesis + taste.

## Wires

| # | Wire | From → To | State | Where |
|---|---|---|---|---|
| **I1** | brand-docs → GTM ICP | genesis brand-docs → `ops` (Explee) | ✅ **shipped** — [snow-gloves PR #4](https://github.com/Sheshiyer/snow-gloves-os/pull/4) | snow-gloves `004` |
| **I2a** | genesis **as a service** | `idea` → `brand-dna` on demand | 🟡 **wired (gated)** — `adapters.json` + `compose run`; spawn `--approve`-gated | brandmint ← conductor |
| **I2b** | hands **as a service** | `taste-brief` → `artifact` (resolve-task + ship-battery) | ✅ **wired** — resolve-task adapter (`spend: none`, **runs live**); the build *dispatch* is the gated extension | skill-clusters ← conductor |
| **I2c** | taste **as a service** | `brand-dna` → `taste-brief` + on-brand verdict | 🟡 **wired (gated)** — `adapters.json` + `compose run`; spawn `--approve`-gated | skill-clusters taste-resolve ← conductor |
| **I3** | unify the NIM cortex | one aesthetic memory across all organs | ⏳ pending | merge `taste-nim` + `DESIGN_MEMORY_WORKER` |
| **B1** | name-validation gate | a name must be ownable before asset spend | ⏳ pending (Fitcheck lesson) | brandmint / skill-clusters |
| **B2** | semantic visual-QA | gate renders on brief-match, not just palette | ⏳ pending (Fitcheck lesson) | skill-clusters reroll |
| **B3** | reference-anchored campaigns | one brand character across the whole asset set | ⏳ pending (Fitcheck lesson) | skill-clusters / nanobanana |

**I1** proved the pattern: a stage doesn't get crammed into snow-gloves — it stays its organ, and the
wire is a thin contract (the Brief *is* the brand→GTM interface). **I2a/b/c** repeat that for genesis,
the build hands, and the taste cortex: each becomes a callable service the conductor invokes, fulfilling
its stage contract. **I3** unifies the memory the paid tier is built on. **B1–B3** are the engine
lessons from the first real brand run ([Fitcheck](https://github.com/Sheshiyer/skill-clusters/blob/main/docs/LESSONS-FITCHECK-RUN.md)).

## Why not "wire everything into snow-gloves"

snow-gloves is the **business-ops organ** (`will`) — C-suite + 61 business-advisory skills + GTM +
multi-tenant. Its skills are *advisory/strategy*, **not** the 40 technical build clusters. Folding
genesis + the hands + taste into it would overload its scope, duplicate skill-clusters' conductor, and
collapse the self-similar separation. So the composition lives **here**, in Cambium; snow-gloves stays
one organ that the `ops` stage resolves to.
