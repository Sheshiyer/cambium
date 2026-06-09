# Versions — the Muses

Cambium releases are codenamed after the **nine Muses** of Greek myth — the daughters of
**Mnemosyne** (Memory) and Zeus, each presiding over an art. A fitting lineage: an operator whose
whole edge is *remembering* is, quite literally, a child of Memory.

We assign a Muse to each release whose domain fits what that release brings to life — not a rigid
alphabetical march, but a chosen patron for each chapter.

---

## Current

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
