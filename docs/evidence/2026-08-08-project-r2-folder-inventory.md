# Project/R2 folder inventory evidence — 2026-08-08

Status: read-only evidence for the first project/R2 mapping batch.

## Scope

- Portfolio: `thoughtseed`
- Folder grammar: `$PROJECTS_ROOT/thoughtseed/<folder>`
- Root-map digest: `588f136a14cac55dbba30b11394288943c56bfebba2b700b4c2d25590747c52b`
- Root-map file SHA-256 in this checkout: `f2f7385405754a913bcf4f11443ce86f6c3e18483f978c674e29180b68578aff`
- Inventory JSON: `docs/evidence/2026-08-08-project-r2-folder-inventory.json`

No folders were moved, renamed, nested, archived, deleted, or written by this probe.

## Reconciled counts

| Measure | Count |
| --- | ---: |
| Depth-one physical folders | 59 |
| Folders mapped by `portfolio-roots.v1.json` | 47 |
| Infrastructure folders present | 1 |
| Exact root Git repositories | 8 |
| Linked worktree `.git` files | 0 |
| Root `.git` directories | 8 |
| Folders with nested repositories | 8 |
| Nested repositories observed | 10 |
| Non-Git folders | 43 |
| Unmapped physical gaps | 11 |
| Mapped-folder identity gaps | 1 |
| Missing mapped folders | 0 |
| Explicit gaps total | 12 |

## Authority-sensitive findings

- `thoughtseed-labs` is present and recorded only as `infrastructure:r2-vault-context`.
- The existing shallow `cambium` folder is mapped as `sapling:cambium`, but it is not an exact Git checkout. Do not treat it as the authoritative repository.
- The fresh `cambium-authoritative` checkout is an exact Git repository for `https://github.com/Sheshiyer/cambium.git`, but it is currently an unmapped physical gap until the founder approves how to promote or swap it into the shallow grammar.
- No mapped folder from the current root-map is missing from the physical Thoughtseed root.

## Explicit gaps

### Unmapped physical folders

- `Airdronauts` — nested Git evidence at `website-alpha/airdronauts-nextjs`
- `_home-cleanup-2026-08-08` — nested Git evidence at `agents-backups/skills-archive/gstack`
- `brandmint-oracle-aleph` — exact Git root `https://github.com/Sheshiyer/brandmint-oracle-aleph.git`
- `cambium-authoritative` — exact Git root `https://github.com/Sheshiyer/cambium.git`
- `motionsites-skills` — exact Git root `https://github.com/Sheshiyer/motionsites-skills.git`
- `openfang` — exact Git root `https://github.com/RightNow-AI/openfang.git`
- `plugins` — no Git identity observed
- `professional-headshot-suite` — exact Git root `https://github.com/Sheshiyer/professional-headshot-suite.git`
- `readme-skill` — exact Git root `https://github.com/Sheshiyer/readme-skill.git`
- `safvr` — nested Git evidence at `Landingpage2.0`
- `website` — nested Git evidence at `temperance-engine-landing-page`

### Mapped folder identity gap

- `cambium` — mapped in root-map, but current physical folder has no exact root Git identity.

## Nested repository containers

| Folder | Nested repositories |
| --- | --- |
| `Airdronauts` | `website-alpha/airdronauts-nextjs` |
| `_home-cleanup-2026-08-08` | `agents-backups/skills-archive/gstack` |
| `archived-thoughtseedlabs-website` | `landing-page`; `thoughtseed-2026/site` |
| `klear-karma` | `kkv2-wiki-v2/wiki-site` |
| `parkarea` | `parkarea-aleph`; `parkarea-aleph.pre-restore-20260807-0627/.claude/worktrees/production-test-data-scrub` |
| `raycast-extensions` | `noesis` |
| `safvr` | `Landingpage2.0` |
| `website` | `temperance-engine-landing-page` |

## Next mapping implications

The next batch should not reorganize folders. It should propose repository identities and founder decisions from this evidence:

1. promote/swap strategy for the Cambium authoritative checkout;
2. whether exact Git roots that are not in the root-map become WorkObjects, infrastructure/programs, or ignored local tooling;
3. whether nested repository containers remain as containers or split into explicit mapping rows.
