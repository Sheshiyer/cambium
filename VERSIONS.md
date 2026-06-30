# Versions — the Muses

Cambium releases are codenamed after the **nine Muses** of Greek myth — the daughters of
**Mnemosyne** (Memory) and Zeus, each presiding over an art. A fitting lineage: an operator whose
whole edge is *remembering* is, quite literally, a child of Memory.

We assign a Muse to each release whose domain fits what that release brings to life — not a rigid
alphabetical march, but a chosen patron for each chapter.

---

## Current

### v0.2.7 · **Thalia .7** — *the root takes Meristem*

> Live proof: 8 ready / 2 blocked (see [readiness.json](docs/plans/assets/tg-miniapp-live-proof/readiness.json))

The composition update: Cambium's active Genesis stage now runs through Meristem.
The conductor calls a no-spend Cambium contract shim that maps Meristem sidecar
outputs into the structured `brand_system`, `copy_system`, and `visual_system`
groups the downstream stages consume.

- **Meristem as active Genesis** — `adapters.genesis` now runs
  `scripts/meristem-genesis-contract.mjs` from the Cambium checkout and accepts
  a Meristem checkout path as the stage input.
- **Rollback preserved** — the legacy Brandmint command remains in
  `candidate_adapters.genesis_brandmint_legacy.disabled`, so rollback is explicit
  and review-gated instead of hidden in the active path.
- **Contract provenance** — the shim sources brand identity from Meristem
  `brands/thoughtseed/brand-config.yaml`, consumes 26 Meristem skill outputs, and
  fails closed on missing outputs, incomplete status, malformed JSON, missing
  asset manifest paths, or empty required Cambium fields.
- **Active-flow proof** — `compose run thoughtseed --stage genesis --execute
  --input /tmp/meristem-sidecar-proof` spawned the Meristem shim with exit 0
  against Meristem SHA `d447fb9c8dd3a5c1c4846f271b20bea6e421ce7f`.
- **Verified main** — PR #94 passed CI, local release gates passed
  `npm test` (600 tests), `validate`, `standalone:audit`, and `standalone:smoke`.

### v0.2.5 · **Thalia .5** — *the tapestry stands alone*

> Live proof: 8 ready / 2 blocked (see [readiness.json](docs/plans/assets/tg-miniapp-live-proof/readiness.json))

The product update: Cambium's fractal tapestry is now release-safe as a standalone
project. The repo keeps the reusable company-compiler/operator architecture while
removing pilot-specific defaults, private topology, live tenant assumptions, and
company-bound adapter names from active product surfaces.

- **Standalone defaults** — local/operator/cortex/quine flows now default to `demo-org`,
  example URLs, synthetic gate fixtures, and portable org slugs instead of live pilot
  tenants or deployment hosts.
- **Adapter boundary** — pilot-specific project-feed and agent-plane concepts now read
  as optional adapters. The old named feed surface was generalized to `project-feed`;
  the archive ceremony now targets a generic `agent-plane` routine.
- **Leakage gate** — `npm run standalone:audit` checks tracked files for private paths,
  live payment/session IDs, private export UUIDs, live deployment URLs, and checked-in
  founder Telegram IDs.
- **Sanitized planning history** — historical planning docs keep the lessons and runbooks
  but no longer carry private pilot topology, local machine paths, bot handles, live
  hostnames, or company-specific memory assumptions.
- **Verified main** — post-merge release gates passed: 273 core tests, 46 R3F tests,
  `validate`, `standalone:audit`, `render-docs:check`, and `r3f:build`.

### v0.2.4 · **Thalia .4** — *the bridge becomes release-testable*

> Live proof: 8 ready / 2 blocked (see [readiness.json](docs/plans/assets/tg-miniapp-live-proof/readiness.json))

The org update: Cambium's post-Thalia bridge is now testable from a clean checkout. The quest
surface, project evidence, archive gate, lesson-mint surface, and R3F tactical-map scaffold all
have release-path evidence instead of relying on private local state.

- **M5 Phase Q · Bridge evidence** — the quest fold now carries current project evidence from the
  MultiCA bridge path, with issue/PR reality preserved as explicit evidence rather than inferred
  status.
- **W6 · Agent-plane archive ceremony** — archive receipt discovery and runtime retirement checks are
  wired into the release review so the ceremony can separate receipt presence from live-process
  retirement.
- **Lesson mint hypha** — operator learning now has a dedicated quine surface for minting repeatable
  lessons back into the system.
- **R3F release testability** — the visual engine contract sync fallback now works from a fresh
  checkout, so R3F tests and builds can run in the release path.
- 273 core tests green · 43 R3F tests green · Node v26 native TypeScript for the core operator.

### v0.2.3 · **Thalia .3** — *the game sees the org live*

> Live proof: 8 ready / 2 blocked (see [readiness.json](docs/plans/assets/tg-miniapp-live-proof/readiness.json))

The org update: the quest log now reads the real pulse of the agent plane — MultiCA-derived
 evidence joins the fold, and every quest arc derives from actual operations.

- **M5 Phase Q · Quest surface** — `bin/operator/quests/quests.ts` grows Arcs VIII–IX:
  - **VIII · The Living Org** — derives from live MultiCA agent count + issue flow
  - **IX · The Gate** — derives from real gate handoffs resolved through the founder approval lane
  - `gatherQuestInputs()` now queries the MultiCA gateway fail-soft; unreachable → honest
    "MultiCA gateway unreachable" evidence (no fake progress).
- **M5 Phase R + G** (shipped in v0.2.2) — multica hypha reads the org; agent models wired to
  the Nebius Token Factory via opencode.
- 240 tests green · Node v26 native TypeScript (zero build, zero deps).

### v0.2.2 · **Thalia .2** — *the game becomes many, and writes back*

> Live proof: 8 ready / 2 blocked (see [readiness.json](docs/plans/assets/tg-miniapp-live-proof/readiness.json))

The org update: the quest game gains a story it tells in prose, the venture becomes *many*
ventures, and the founder can finally act from inside the map.

- **M3 · Multi-tenancy** ([#20–23](https://github.com/Sheshiyer/cambium/milestone/3)) — one
  operator, many gardens: a portable org-slug tenant registry (registration-from-reality), per-tenant
  isolation of world-state AND cortex (adversarially proven — A ∩ B = ∅, incl. a filter-override
  attack), `--tenant` routing + an all-tenant heartbeat. **Quest arc VII flipped: 7/7.**
- **W3 · The narrative engine** — `bin/operator/narrative/`: the operator's life told as PROSE
  beats (noesis set apart), sharing one log grammar with the forge. The Story scene reads like a
  story.
- **M5 · MultiCA hypha (Phase R)** — `quine multica`: the agent org's life (agents · issues ·
  activity) joins the story feed as `source:"multica"` beats; open work items ride the envelope.
- **W4 · The founder gate** — the curios.self miniapp's ONE write: approve/reroll an open item,
  validated by Telegram **Ed25519 third-party signature** (zero secrets on the Worker, founder
  allowlist, auth_date window), executed on MultiCA by the gate-consumer (approve → done, reroll →
  rerun) with a Telegram audit + a forge skill-record. The fractal also grew **heartwood** (W2.5
  taste pass).
- 236 tests green · Node v26 native TypeScript (zero build, zero deps).

### v0.2.1 · **Thalia .1** — *the game becomes visible*

> Live proof: 8 ready / 2 blocked (see [readiness.json](docs/plans/assets/tg-miniapp-live-proof/readiness.json))

The quest update: Thalia's game gets its surfaces — a quest log that cannot lie, a forge that
learns from repetition, and the first living UI in the founders' pocket.

- **M4 · Quest Log & Skill Forge** — `quine quests`: seven arcs derived purely from real
  world-state (empty inputs ⇒ zero complete — the no-fake-progress invariant, under test);
  `quine skills`: repetition in the operator's own logs minted into **self-improving skills**
  (usage scenarios → gotchas → decline → ONE amendment per streak; lifecycle aligned with the
  company skill registry, production stays founder-gated).
- **The Thalia wing (W1+W2)** — the ledger goes live: `cambium-quests` Worker + KV, fed by
  `quine write quests push` inside a freshness envelope
  `{schema, derivedAt, source, beats}`; the **curios.self Telegram miniapp** (menu button) —
  three scenes: Quests · the **tree-ring fractal map** ("cambium — you are here") · Story with
  set-apart noesis frames. Liquid-glass sheets, haptics, reduced-motion.
- **The real first session** — `scripts/onboard-live.ts`: cambium onboarded *itself* with live
  NIM founder answers; the session and its cortex receipt live in production memory.
- 209 tests green · Node v26 native TypeScript (zero build, zero deps).

### v0.2.0 · **Thalia** — *muse of comedy, festivity, and play*

> Live proof: 8 ready / 2 blocked (see [readiness.json](docs/plans/assets/tg-miniapp-live-proof/readiness.json))

The operator comes alive and becomes **playable**. Thalia presides over the game.

- **M1 · Onboarding Loop** — `operator onboard`: the 20-interaction Octalysis first session over the
  real wake loop; held **noesis** frames at the existential beats; the Octalysis end panel.
- **M2 · Cortex Search** — the operator **remembers and matches across runs**. Semantic memory
  (NIM 1024-d; **node:sqlite** local · **Cloudflare Vectorize** production — *live*) + the structural
  **CodeGraph** code-recall lane.
- 171 tests green · Node v26 native TypeScript (zero build, zero deps).

### v0.1.0 — *pre-codename*
The operator skeleton: the wake loop, the micro/meso/macro router + mid-brain→noesis bypass,
viability, NPC self-play (ICP + Founder), the composition layer.

---

## The roster (the nine Muses)

| Muse | Domain | Release |
|---|---|---|
| **Thalia** | comedy · festivity · play | ✅ **v0.2.0** — the operator becomes a playable infinite game |
| **Urania** | astronomy · the heavens | → *proposed next* — **M3 multi-tenancy**: one operator, a constellation of ventures |
| Calliope | epic poetry (the eldest, "beautiful-voiced") | — |
| Clio | history | — *(the replay log / cross-run learning)* |
| Erato | love / lyric poetry | — |
| Euterpe | music | — |
| Melpomene | tragedy | — |
| Polyhymnia | sacred hymn · eloquence | — |
| Terpsichore | dance | — |

---

## How we cut a release

```bash
# bump package.json (version + codename), gate on tests, commit, tag, push the tag:
bash scripts/release.sh 0.3.0 Urania
```

Pushing the `vX.Y.Z` tag triggers **`.github/workflows/release.yml`** — it runs the full suite, then
creates the GitHub Release titled `vX.Y.Z · <Muse>` with auto-generated notes. CI
(**`.github/workflows/ci.yml`**) runs the same suite on every push to `main` and every PR.

Before tagging, add the release's stanza to the **Current** section above (the Muse + what shipped).
