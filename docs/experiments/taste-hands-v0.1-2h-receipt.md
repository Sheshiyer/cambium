# Taste→Hands v0.1 — two-hour experiment receipt

Status: local experiment. Draft visibility only. Do not merge.

## Identity

| Field | Value |
|---|---|
| Branch | `cursor/experiment-taste-hands-v0.1-2h-e7e3` |
| Palette `source_sha` | `8261d4840988e2e1c6fa6c2eb85cee96d4344b58` |
| Research `source_sha` | `1a97cd396709357cffaf45f417dde40c84a50b9a` |
| Implementation commit | filled in the stamp commit after the first commit on this branch |
| Contract | `docs/experiments/taste-hands-v0.1/cambium.taste-hands.v0.1.md` |
| Example | `docs/experiments/taste-hands-v0.1/DESIGN.md` |
| Checker | `docs/experiments/taste-hands-v0.1/check.mjs` |
| Report | `docs/experiments/taste-hands-v0.1/ab-report.json` |
| Surface | `curious-world.location-readout` |

`main` at the start of this experiment is the palette `source_sha` above. This branch does not move `main`.

The 2026-10-28 proposal named `1a97cd396709357cffaf45f417dde40c84a50b9a` as main. That commit is still in history and is an ancestor of the palette sha. Main has moved forward. The proposal's commit message in this clone is `docs: record 2026-10-26 worktree and branch reconciliation (#406)`.

## Path adaptation

The repo has no `docs/contracts/` directory. Adopted contracts live under `docs/architecture/contracts/`. This packet stays under `docs/experiments/` until Mage accepts it. The branch name includes `experiment` and `taste-hands` and follows the required `cursor/…-e7e3` form. The example name `experiment/taste-hands-v0.1-2h` was not created.

The Oct 28 example was seeded from atlas CSS. This packet is seeded from `apps/cambium-r3f/src/scene/visual-tokens.ts`, the palette owner-approved on 2026-10-31. Signal is `#E0FF4F`. Ink is `#00272B`.

## What was checked

`node docs/experiments/taste-hands-v0.1/check.mjs` exited 0. `node --test docs/experiments/taste-hands-v0.1/check.test.mjs` passed 4/4.

- Frontmatter parses. `version` is `cambium.taste-hands.v0.1`. `source_sha` resolves to a commit. `research_sha` is an ancestor.
- Token groups match `visual-tokens.ts` (color, alpha, type, motion, glyphs, materials).
- Provenance entries cover every token leaf. Kinds are `repo`, `supplied`, or `inferred`.
- Seven reference paths resolve at `source_sha`. Three are uninspected: `docs/assets/visual-flow/0063--telegram-mini-app--cambium-design-system-source.png`, `docs/assets/visual-flow/0062--telegram-mini-app--cambium-atlas-source.png`, and `apps/cambium-r3f/public/assets/meshy/islands/taste/thumbnail.png`.
- Gates read as exact claim review, phase verify, explicit viewport hold, explicit screenshot/touch hold, and marketing create/send/spend/publish disabled.
- The checker rejects a `publish` key and a `render_proof.viewport` value of `passed`.
- `styles.css`, `index.ts`, and `gate-decision-chamber.ts` match the palette sha. Production was not edited.

## Contrast (WCAG, from the checker)

Text AA is 4.5:1. Large text and non-text UI are 3:1. Ratios are relative luminance, two decimals.

| Pair | Ratio | Result |
|---|---|---|
| signal on ink | 14.03 | text AA |
| mist on ink | 14.71 | text AA |
| signal on substrate | 12.75 | text AA |
| mist on substrate | 13.38 | text AA |
| depth on mist | 14.94 | text AA |
| signal on depth | 14.24 | text AA |
| substrate on ink | 1.10 | fails non-text UI |
| depth on ink | 1.02 | fails non-text UI |
| signal on mist | 1.05 | fails non-text UI |
| depth on substrate | 1.12 | fails non-text UI |

Signal on ink is legal for 11px text and for a 1px rail. Signal on mist is illegal for text and for a UI boundary. Substrate and depth are field colors on ink, not strokes or type. There is no separate line token, so the atlas "line on paper is borders only" limit does not transfer.

Off-palette paints on the baseline chip, measured on ink, already pass: copper rail 5.17, peach index 10.52, tagline `#D3E9E0` 12.45. Contrast and palette drift are different metrics on this surface.

## A/B

Surface: the curious-world location chip (index, district, tagline, rail, text-shadow). Markup is `apps/cambium-r3f/src/curious-world/index.ts`. Paints are `apps/cambium-r3f/src/curious-world/styles.css`. The chip has no fill, so contrast uses viewport ink `#00272B`.

Run A reads those production paints and does not bind the contract. Run B binds the same roles through `surface_bindings` in `DESIGN.md`. One author wrote both sides. This is a measured binding difference, not two independent agents, and not a blind owner review.

Mechanical adherence, scored by `scoreSurface` in the checker:

- 1 when contrast failures are 2 or more
- 2 when there is one contrast failure, or contrast is clean and token drift is 3 or more
- 3 when contrast is clean and token drift is 1 or 2
- 4 when token drift is 0 and a type gap remains
- 5 when token drift and type gaps are both 0

| Metric | Run A | Run B |
|---|---|---|
| Color drift | 3 (`#B58B65`, `#FFC7A1`, `#D3E9E0`) | 0 (signal `#E0FF4F`, mist `#D6FFF6`) |
| Effect drift | 1 (`#00191D` shadow) | 0 (shadow omitted; the authority has no shadow hex) |
| Token drift | 4 | 0 |
| Contrast failures | 0 | 0 |
| Type gaps | 3 (Georgia display, shorthand mono, body stack) | 1 (tagline falls back to `type.display`) |
| Mechanical adherence | 2 | 4 |
| Revision rounds | 0 | 0 |
| Blind owner score | not collected | not collected |

Revision rounds are 0. Contrast was computed before the binding was written, and the checker accepted that first binding. District text was already mist, which is on palette. The binding changes the index to signal, the tagline to mist, the rail to signal, and drops the shadow.

`render_proof.status` is `candidate-held`. Viewport and screenshot/touch stay `held`. No browser capture was taken.

## Stop rules

Pass. The diff is confined to `docs/experiments/`. Gate decision chamber source is untouched. Marketing create/send/spend/publish stays disabled. The packet does not claim viewport or touch proof.

## Counts requested for awareness

Re-run this session, `node --test 'src/**/*.test.ts'` in `apps/cambium-r3f` (pretest contract sync was not run): **184 pass, 0 fail, 0 skip**. That matches the 2026-10-25 app count of 184/184.

Root `npm test` on this dirty worktree, before the experiment commit: **2526 tests, 2503 pass, 23 fail, 0 skip**, exit 1. The known stale viewport assertion is still among them (`drift audit · current repository has one canonical operational surface`). Test numbers 2452 and 2453 in that run passed and are atlas identity and typed-connection tests, so they are not the 2026-10-25 frozen-core tally. The frozen-core record remains **2452 pass / 1 fail** in `docs/evidence/2026-10-25-gate-chamber-live.v1.json`. This session did not reproduce that tally. One current failure, `every relationship binds its own literal source and fingerprint`, compares committed atlas bytes (`sha256:a33642a31272256d1d5d3a63e10d021d35ccda4f385650559bb308d2143831d9`) with the pinned `sha256:4ad9ac6768a0250d2392d65c198129b597d79db524e19648a946a6360d4d26cc`. This experiment did not edit those files.

## Hypothesis

Verified for color-token drift on this one surface: four off-palette paints went to zero under the thin contract, with the checker green on the first binding. The same run leaves a type gap, because `visual-tokens.ts` has no body face, and it leaves contrast failures unchanged at zero. A sole palette file plus this contract is enough to cut color drift on the location chip. It is not a finished type system and it is not a Gate redesign.

## What Mage decides next

1. Leave this packet under `docs/experiments/`, or adopt it into `docs/architecture/contracts/` under a separate review.
2. Apply the location-readout binding to production CSS, or keep it as a candidate. This branch does not apply it.
3. Add a body type stack to `visual-tokens.ts`, or keep the tagline fallback explicit.
4. Open the three uninspected plates before anyone uses them as component evidence.
5. Score adherence blind, on a scale of 1 to 5. The mechanical scores above are 2 and 4.
6. Keep the branch unmerged. A draft pull request, if one is open, is for reading the diff.
