# Versions — the Muses

Cambium releases are codenamed after the **nine Muses** of Greek myth — the daughters of
**Mnemosyne** (Memory) and Zeus, each presiding over an art. A fitting lineage: an operator whose
whole edge is *remembering* is, quite literally, a child of Memory.

We assign a Muse to each release whose domain fits what that release brings to life — not a rigid
alphabetical march, but a chosen patron for each chapter.

---

## Current

### v0.2.2 · **Thalia .2** — *the game becomes many, and writes back*

The org update: the quest game gains a story it tells in prose, the venture becomes *many*
ventures, and the founder can finally act from inside the map.

- **M3 · Multi-tenancy** ([#20–23](https://github.com/Sheshiyer/cambium/milestone/3)) — one
  operator, many gardens: a TeamForge-slug tenant registry (registration-from-reality), per-tenant
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

The quest update: Thalia's game gets its surfaces — a quest log that cannot lie, a forge that
learns from repetition, and the first living UI in the founders' pocket.

- **M4 · Quest Log & Skill Forge** — `quine quests`: seven arcs derived purely from real
  world-state (empty inputs ⇒ zero complete — the no-fake-progress invariant, under test);
  `quine skills`: repetition in the operator's own logs minted into **self-improving skills**
  (usage scenarios → gotchas → decline → ONE amendment per streak; lifecycle aligned with the
  company skill registry, production stays founder-gated).
- **The Thalia wing (W1+W2)** — the ledger goes live: `cambium-quests` Worker + KV at
  **curious.thoughtseed.space**, fed by `quine write quests push` inside a freshness envelope
  `{schema, derivedAt, source, beats}`; the **curios.self Telegram miniapp** (menu button) —
  three scenes: Quests · the **tree-ring fractal map** ("cambium — you are here") · Story with
  set-apart noesis frames. Liquid-glass sheets, haptics, reduced-motion.
- **The real first session** — `scripts/onboard-live.ts`: cambium onboarded *itself* with live
  NIM founder answers; the session and its cortex receipt live in production memory.
- 209 tests green · Node v26 native TypeScript (zero build, zero deps).

### v0.2.0 · **Thalia** — *muse of comedy, festivity, and play*

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
