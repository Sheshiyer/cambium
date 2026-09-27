---
quick_id: 260912-pk8
status: complete
completed: 2026-09-12
scope: visual-flow-source-library
---

# Organized the existing Cambium visual-flow images

## Result

- Preserved all 46 numbered source images at the root of `docs/assets/visual-flow/`.
- Added 46 deterministic aliases under `docs/assets/visual-flow/source-library/`: 10 Telegram Mini App assets and 36 R3F assets.
- Segregated explicit organ adaptations, semantic components, Genesis and Rail Arc turntables, product pages, brand material, contact sheets, and motion/state studies.
- Retained four duplicate relationships in the machine map instead of silently removing files.
- Kept five visually distinct but unnamed models under `r3f/unresolved-models/`; no organ identity was invented.
- Generated `SOURCE-ASSET-MAP.v1.json` and the human-readable `README.md` from `scripts/organize-visual-flow-source-library.mjs`.

## Verification

- `node --check scripts/organize-visual-flow-source-library.mjs`
- `node scripts/organize-visual-flow-source-library.mjs --check`
- JSON structure, unique IDs, unique organized paths, counts, hashes, dimensions, duplicates, unresolved labels, and root-source preservation were checked.
- The existing Organ Console package was independently rechecked and not modified.
- No runtime, deployment, provider, credential, or external state changed.
- No commit was created because the primary checkout remains dirty with unrelated user-owned work and is four commits behind `origin/main`.
