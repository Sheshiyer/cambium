---
quick_id: 260907-5gp
status: complete
implementation_commit: 3fb6d9f
---

# Cambium Website semantics worktree classification

The only new Thoughtseed census entry, `cambium-website-semantics`, is now an
explicit infrastructure exclusion. Local Git evidence identifies it as a linked
worktree of the existing `cambium-telegram-showcase` checkout, which the source
map already presents as Cambium Website. It does not create a WorkObject,
product, client, or repository identity.

The earlier correction remains intact: Cambium Website retains
`sapling:cambium` at its historical physical folder, and Decodik remains nested
evidence under the already mapped Codigo client application at
`codigo/research/Decodik`.

The root-map generator regenerated both identical checked-in projections. The
queue's current root-map digest and Batch 1 default now match the source digest
`af47cc75f373414ab7dae230e90f3884ca850028211753c98c32bc2f07af9312`.
Historical receipt and approval pins were not advanced.

## Verification

- Focused root-map suite: 25 passed, 0 failed.
- Full related source suite: 95 passed, 1 existing skip, 0 failed.
- Source digest and both queue references match exactly.
- `git diff --check` passed before the implementation commit.
- Read-only header preflight found Thoughtseed 75/75 and Tryambakam-Noesis
  38/38 directories. It returned a plan only (`write: false`) and did not write
  any external header.
- Independent Astra review found no actionable issue and no other current root
  that needs classification.

## Scope and continuation

Implementation commit: `3fb6d9f`. The change remains in the assigned isolated
candidate branch `codex/cambium-portfolio-mapping-20260906`. No live
`PORTFOLIO.md` or `portfolio-map.v1.json` was regenerated, and no Superset
record, GitHub state, provider, service, filesystem root, primary worktree,
merge, push, or publication changed. A later review/publish decision is still
required before applying the generated root headers.
