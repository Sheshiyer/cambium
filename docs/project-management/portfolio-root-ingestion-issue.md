## Outcome

Ingest the shallow destination portfolio roots into repository-owned GitHub planning without changing the filesystem grammar or losing the relocation evidence.

## Current reviewed input

- Root-map schema: `thoughtseed.portfolio-root-map.v1`
- Digest: `baec8991188eb7f4f3aed07f55b5ca74441c2fa7386b0b66b5a6358010795962`
- Prior physical-apply receipts remain correctly bound to the accepted
  `8a3b3bb07018ebbf44f4ad13e88b3f48f616d43daa1b7faf7d03f4ddfc6dafbe`
  snapshot; the current digest advances only the reviewed Klear Karma
  classification from `needs-review` to `sapling`.
- Thoughtseed: 54 mapped folder proposals; `thoughtseed-labs` is R2-synced vault infrastructure, while `_physical-relocation-archive-2026-08-08`, `openfang`, and `website` are explicit non-WorkObject infrastructure/exclusions. The former `cambium-authoritative` checkout has been promoted into the canonical `cambium` slot and is no longer a separate depth-one folder.
- Tryambakam · Noesis: 30 active Projects; four archived projects; one worktree-infrastructure folder.
- Path grammar: `<projects-root>/<portfolio>/<repository>`.

## Flow

1. Inspect the exact GitHub repository identity for each shallow folder.
2. Read repo-owned issues, plans, and roadmap before classifying or scheduling it.
3. For Thoughtseed, derive grammar from origin: Thoughtseed venture → Sapling; client work → Client Branch; shared company work → Internal Program; unknown → Needs Review.
4. For Tryambakam · Noesis, retain Project grammar and never infer Client Branch.
5. Extract durable intent from tool/session/date files into the owning repository; retain those files as historical evidence.
6. Resolve explicit mapping gaps and only then admit the folder into ongoing portfolio planning.

## Acceptance

- Each active folder has immutable GitHub repository identity or an explicit gap.
- Each folder names its repository-local planning authority.
- Ambiguous Thoughtseed proposals remain reviewable and are not silently rewritten.
- The R2-synced vault contributes context without becoming a runtime dependency or project folder.
- No `client-branches`, `saplings`, `programs`, or `projects` nesting directory is created.
- No dirty or nested repository is relocated by this issue.

## Links

- Repository/origin audit: #290
- Planning-authority migration: #291
- Packet review gate: #292
- Production promotion gate: #293
- Design: `docs/plans/2026-08-07-portfolio-ingestion-headers-design.md`
- Snapshot: `docs/project-management/portfolio-roots.v1.json`
