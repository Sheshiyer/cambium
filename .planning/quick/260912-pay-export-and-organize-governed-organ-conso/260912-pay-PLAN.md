---
quick_id: 260912-pay
status: complete
created: 2026-09-12
scope: docs-assets-only
---

# Export governed Organ Console visual assets

## Goal

Create a self-contained, public-safe Cambium export of the accepted Organ Console visual studies under `docs/assets/visual-flow/organ-console/`, organized by organ, semantic feature, view, and variation.

## Scope

- Read the Thoughtseed Labs generation manifest as source evidence.
- Copy, rather than destructively relocate, every asset currently marked `selected` or `generated`.
- Rename each exported file to its local variation name while retaining the canonical `TSOC-*` asset ID in a sanitized map.
- Organize assets under `organs/`, `features/`, and `views/`; keep review boards under `reviews/`.
- Add a human-readable index and machine-readable SHA-256 mapping.

## Exclusions

- Do not copy raw prompts, provider responses, generated-image session paths, private notes, or the imported Cambium seed corpus.
- Do not copy rejected or dependency-held drafts.
- Do not modify or delete the existing flat files in `docs/assets/visual-flow/`.
- Do not delete or move the authoritative Thoughtseed Labs package.
- Do not change runtime code, deployment state, provider configuration, or credentials.

## Verification

- Export count equals the source manifest's `selected + generated` count.
- Each destination hash equals its source output hash.
- Every exported path is unique and owner-segregated.
- Sanitized metadata contains no absolute paths, prompts, provider transcripts, or secrets.
- Existing flat visual-flow file hashes remain unchanged.
- JSON validation and `git diff --check` pass.
