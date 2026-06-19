# The Quest Log & The Skill Forge

> *Companion to [INFINITE-GAME.md](./INFINITE-GAME.md) and [ONBOARDING-OCTALYSIS.md](./ONBOARDING-OCTALYSIS.md).
> The onboarding is the tutorial. This is the rest of the game: the startup flow as a **quest line**
> (a visual "you are here" map of the venture), and repetition as a **skill forge** (recurring
> processes minted into self-improving skills). M4.*

---

## 1. The Quest Log — progress that cannot lie

Like all good game engines, the venture's progression is a quest log. But the operator's doctrine
(INFINITE-GAME.md) forbids fake engagement: scarcity is *real* solvency, unpredictability is the
*real* market — so progress must be **real progress**. There is **no stored quest tracker** to
drift out of sync. The quest fold (`bin/operator/quests/quests.ts`) is a pure function:

```
QuestInputs (world-state · onboarding session · cortex count · tenants on disk) → QuestLedger
```

Empty inputs derive **zero** complete quests — an invariant under test. Every status line carries
the evidence it derived from.

### The quest line (seven arcs, dependency-ordered)

| Arc | Quest | Done when (derived from) | Reveals |
|---|---|---|---|
| I | **The Calling** | first session 20/20 · 8/8 drives · noesis ≥3 (`<t>.onboarding.json`) | the onboarding organ |
| II | **First Mint** | seed · positioning · cta claimed, placeholder-free (world artifacts) | genesis + world mutability |
| III | **Taste & Resonance** | meso ×3+ in the log — the ICP pushed back | the ICP-NPC + meso lane |
| IV | **The Loop** | micro AND meso AND macro each exercised (log) | all three tick-rates + the gate |
| V | **Viability** | a heartbeat / viability sweep ran (log) | the margins board |
| VI | **Memory** | ≥1 cortex record for the tenant (cortex.db) | the semantic cortex |
| VII | **Many Gardens** | >1 tenant world AND the isolation suite green (M3) | multi-tenancy |

Statuses: `✓ complete` · `▸ active` (the frontier — first incomplete quest) · `· locked`.

```
quine quests --tenant cambium        # the panel: markers · evidence · progress bar · you-are-here
```

The I/O lives in the hypha (`bin/quine/hyphae/quests.ts`): it gathers inputs **fail-soft** (a
missing cortex reads as "cortex unreachable", never a crash) and **never writes** state.

## 2. The Skill Forge — repetition becomes capability

Every process the operator repeats is a skill waiting to be minted. The forge
(`bin/operator/skills/forge.ts`) detects recurring **signatures** in the real signals:

- `deviations.jsonl` → `stage|kind|action` (e.g. `build|error|reroll`)
- `world.log` → `lane|action` (e.g. `meso|reroll`, `micro|tweak applied`)

A signature seen **≥3×** becomes a candidate; `mintSkill` turns it into a spec. The minted format
follows skill-creator methodology — a slightly-pushy `description` with **USE WHEN** triggers and a
**NOT FOR** clause (fresh one-off deviations route to the error-vs-intent why-handler, not a skill),
plus `verification_steps` defined at mint time.

### Self-improvement (the telemetry loop)

`bin/operator/skills/telemetry.ts` — a skill learns from being used:

- `record <skill-id> ok|fail [--scenario "…"]` → usage scenarios accumulate
- failures with notes become **gotchas** (deduped — the highest-density knowledge a skill carries)
- success rate < 0.5 over the last 5 uses ⇒ **declining** ⇒ ONE **amendment proposal** appended per
  decline streak (tighten triggers · split the skill · absorb the latest failure into gotchas)
- recovery and a new decline ⇒ a new amendment — the failure→lesson loop never closes

### Lifecycle (aligned with the company skill registry)

The spec fields and lifecycle mirror Cambium's portable skill-registry contract:

```
candidate ──first verified ok use──▶ validated ──founder approval (never automatic)──▶ production
```

Registry: `.operator/<tenant>.skills.json` — tenant-keyed, its own file; world/onboarding state is
never touched by the forge.

```
quine skills --tenant cambium                                  # the panel
quine write skills forge --tenant cambium                      # detect + mint from real logs
quine write skills record cambium-meso-reroll ok --scenario "…"
```

## 3. Design notes

- **Pure fold + renderer split** mirrors the Octalysis meter (`octalysisLedger` →
  `renderOctalysisPanel`); both new panels take an `out` sink for tests.
- **Re-forging never resets telemetry** — `upsertSkills` refreshes the repetition evidence and
  keeps everything a skill has learned.
- **No fake progress / no dark patterns**: the quest log can only show what the world-state proves;
  arc VII honestly reads `isolation suite pending (M3 open: C1–C4)` until M3 lands.
- Zero dependencies · Node 26 native TS · `node:test` + `assert/strict`, like everything beside it.
