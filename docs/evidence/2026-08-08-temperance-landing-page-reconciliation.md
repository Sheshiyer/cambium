# Temperance landing-page reconciliation evidence

Status: Phase 2 preflight passed; no live filesystem apply is authorized.

## Authority

- The shallow `$PROJECTS_ROOT/thoughtseed/temperance-engine-landing-page`
  directory is real, non-symlinked, and not a Git repository. It is local state,
  not repository authority.
- The nested
  `$PROJECTS_ROOT/thoughtseed/website/temperance-engine-landing-page` checkout is
  the exact `Sheshiyer/temperance_engine_landing_page` Git root on `main` at
  `488f8b7d945b7a8c07ce51a253e3f559149108e8`.
- The nested checkout has one untracked `_PROJECT-STATUS.md`. Its 1,103 bytes
  are identical to the shallow counterpart at SHA-256
  `9ef2133d3e8a25ea9184ddc38f9d44979dbd03a9718d4c7e3a44b314d71ed9c3`.

## Content comparison

The comparison covered regular files and symbolic links while excluding `.git`.
Sensitive ignored content was not opened, hashed, named, or copied into this
repository; only aggregate metadata was compared.

| Evidence | Result |
|---|---|
| Non-sensitive files identical on both sides | 50 |
| Shallow-only non-sensitive files | `public/.DS_Store` only |
| Nested-only non-sensitive files | none |
| Changed non-sensitive files | `.DS_Store`, `.gitignore` |
| Sensitive ignored files common to both trees | 1, matching size and mode |
| Symbolic links | 0 in both trees |

The tracked authority `.gitignore` is 44 bytes with SHA-256
`1efe91a6dca729ea4a2e90c19e466a0b07d29394a41b5e989a9c19178b2f4da9`.
The shallow policy copy is 2,401 bytes with SHA-256
`6abf5a209913101e79c5292b5f02648ad76fc6f5fc6f96ba6e21fa2531911e96`.
Relocation will not merge them. The broader shallow policy remains recoverable
inside the displaced-tree archive; any authority policy expansion belongs to a
separate reviewed commit in that repository.

## Container and root map

`$PROJECTS_ROOT/thoughtseed/website` contains only the nested checkout. The
selected post-promotion disposition is to preserve the resulting empty
directory as infrastructure. This keeps the accepted root-map membership at 58
directories and preserves snapshot digest
`8a3b3bb07018ebbf44f4ad13e88b3f48f616d43daa1b7faf7d03f4ddfc6dafbe`.

## Proposed live apply

The exact archive-first sequence and checkpoint-specific rollback steps are in
`docs/project-management/relocation-manifests/2026-08-08-thoughtseed-physical-lane-phase-2-preflight.v1.json`.
It preserves the shallow tree intact, moves the nested untracked status file to
a dedicated archive target, requires a clean Git authority, promotes that exact
checkout, and preserves the empty `website` container.

No operation above has been executed. The next gate requires this exact text:

`approve live apply phase 2 Temperance archive-first promote preserve website container`

## Boundaries

No folder was moved, archived, created, deleted, or overwritten. No sensitive
content, R2 object, GitHub state, registry row, Goal Graph row, provider setting,
production deployment, Symphonics state, or `thoughtseed-labs` state changed.
