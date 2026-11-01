# Taste→Hands v0.1 adoption review

This directory is the review copy. Draft pull request #414 stays unmerged. The location stylesheet is not in this change.

## Plates

Opened before any of them were used as component evidence.

- `docs/assets/visual-flow/0063--telegram-mini-app--cambium-design-system-source.png` shows a condensed sans type scale, including BODY 14/20, plus controls and panel patterns. Ink `#00272B`, substrate `#012F34`, mist `#D6FFF6`, and depth `#231651` match `visual-tokens.ts`. The plate's accent swatch is `#E0FFAF`. It also shows paper and warning `#FFC7A1`. Those three are visible and are not canonical tokens. Signal stays `#E0FF4F`.
- `docs/assets/visual-flow/0062--telegram-mini-app--cambium-atlas-source.png` shows genesis, taste, build, ops, and cortex glyphs on a dark field with a yellow wordmark. It has no hex legend and no type specimen.
- `apps/cambium-r3f/public/assets/meshy/islands/taste/thumbnail.png` is a 3D island with looping tubes on white and teal terrain against black. It supports the taste glyph intent. It is not a component or color source.

The body face added to `visual-tokens.ts` is the existing condensed sans stack, named `body` because the design-system plate has a BODY role in that same sans. It is not a new family. The location tagline can now bind `type.body`. Its 12px size is unchanged. The plate's 14/20 is not applied here.

## Blind score

An independent rater scored two unlabeled specimens against the palette and the named faces, without being told which one this review prefers. The rater did not open the repository.

| Specimen | What it is | Score |
|---|---|---|
| 1 | Contract binding: signal rail and index, mist district and tagline, named sans and mono, no shadow | 5 |
| 2 | Production location paints: copper rail, peach index, Georgia district, near-mist tagline, off-palette shadow | 1 |

The rater's sentences were: Specimen 1 keeps every paint inside the palette and both faces on the named stacks. Specimen 2 places text, the rail, and the shadow outside the palette, and the faces do not match the named stacks.

This is a model score, not the owner's. The mechanical checker on the earlier experiment scored the same pair 4 and 2 under a different rubric that treated contrast-clean drift as a 2. The owner score is still blank.

| Rater | Run A / production | Run B / binding |
|---|---|---|
| Mechanical checker | 2 | 5 on this review copy, after the body face closed the tagline gap |
| Independent blind model | 1 | 5 |
| Owner | | |

## Held

Gates are unchanged. `render_proof` stays candidate-held. No viewport capture was taken.
