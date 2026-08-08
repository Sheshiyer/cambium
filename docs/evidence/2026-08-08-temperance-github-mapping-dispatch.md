# Temperance dispatch receipt — GitHub repository mapping

Status: completed read-only dispatch.

Date: 2026-08-08

Scope:

- Portfolio: `thoughtseed`
- Branch: `codex/project-r2-mapping-plan`
- Skill: `temperance-parallel-dispatch`
- Input audit: `docs/evidence/2026-08-08-github-repository-mapping-audit.v1.json`
- Output queue: `docs/project-management/github-repository-mapping-action-queue.v1.json`

## Rail selection

The requested Temperance rail was evaluated before accepting worker output.

| Rail | Result | Decision |
| --- | --- | --- |
| `temperance-batch` | Installed, but unusable: printed `dispatch-tasklist.sh not found (madara unmounted and no local copy)` | Rejected for this turn; no batch output accepted |
| `temperance-claude` | Missing | Unavailable |
| `te-dispatch-paid` | Missing | Unavailable |
| `te-dispatch` | Missing and deprecated by skill instructions | Unavailable |
| `clinepass` | Missing | Unavailable |
| `omniroute` | Installed | Not used directly because the required governed batch wrapper was unavailable |
| `ollama` | Installed | Not used for this evidence-only mapping pass |
| In-session subagent rail | Available | Used for four independent read-only audits |

No Sol-family model was used.

## Parallel work split

| Lane | Scope | Result |
| --- | --- | --- |
| `batch_thoughtseed_org_history` | `thoughtseedlabs` / `thoughtseed-labs` history | Completed; 20 repos classified with immutable GitHub IDs |
| `batch_client_branch_clusters` | Client branch clusters | Completed; 70 candidate client-branch rows grouped, 6 holds, zero Sapling promotions |
| `batch_sapling_provenance` | Sapling provenance and root-map/catalog repair | Completed; direct Sapling candidates separated from ambiguous origin rows; VirtualTryOn later retired by founder decision |
| `batch_internal_programs_vault` | Internal programs, vault context, R2 receipt boundary | Completed; internal program mappings and evidence-only R2 boundary confirmed |

## Accepted findings

### Batch 1 — Thoughtseed org history

- 20 repositories reviewed.
- 16 non-forks and 4 forks.
- All 20 resolved to immutable GitHub node IDs by the worker's bounded query.
- Recommended dispositions:
  - 11 historical product/research evidence rows, including founder-resolved `thoughtseed-labs/DezinerAI`;
  - 2 Sapling evidence rows: `thoughtseedlabs/Vibrasonix-Website` → `sapling:vibrasonix` as fork/site evidence only, and founder-resolved `thoughtseed-labs/lockwell-portal` → `sapling:dlock`;
  - 3 external fork/reference rows;
  - 4 archive-only rows;
  - 0 needs-review rows.

Post-dispatch founder resolution: `thoughtseed-labs/DezinerAI` is not an active Project row. A live read confirmed the private non-fork repository still exists and is not GitHub-archived, while the local shallow Project folder is absent. The queue therefore preserves it as `program:thoughtseed-vault` archive evidence.

Post-dispatch founder resolution: `thoughtseed-labs/lockwell-portal` is the repository evidence for the new DLOCK Sapling. The live page `https://dlock-lp.vercel.app/` presents DLOCK as smart digital locks plus self-storage management software, with hardware/resource families `EKPL2`, `EKKB2-TY`, `SMKB2-BT`, TUYA/Bluetooth access language, billing/unit/customer workflows, and waitlist/contact surfaces. The queue maps the repository to `sapling:dlock` and records the product packet at `docs/plans/product-branches/dlock.md`; root-map folder admission stays blocked until a shallow `dlock`/`lockwell` folder exists or the owner approves creating one.

### Batch 2 — Client branch clusters

- 10 client families reviewed.
- All targets remain Client Branches.
- 70 candidate client-branch evidence rows identified/grouped.
- 6 hold/exclude rows:
  - HeyZack forks as dependency/reference only;
  - `pineappleinnovationlabs/chakra-shine-admin` as a same-owner false positive until repo-local planning confirms;
  - Co.Property Sapling-bound refs left to Sapling provenance;
  - panorama false positive held outside Ashwin Sheth.
- Symphonics received post-retirement follow-up review: catalog row exists and the GitHub repository is a planning/documentation repository, but `$PROJECTS_ROOT/thoughtseed/symphonics` is absent. Keep Symphonics as missing client-account coverage until the founder approves an exact shallow-folder/repository disposition.

### Batch 3 — Sapling provenance and catalog repair

Direct Sapling evidence can proceed only after immutable repository resolution:

- `sapling:10869-space`
- `sapling:effort-glyph`
- `sapling:fmrl`
- `sapling:iverif`
- `sapling:vantyx`
- `sapling:vibrasonix`
- `sapling:wanderfruit`
- `sapling:whspr`

Founder-review holds:

- Klear Karma: current catalog says Sapling, but prior evidence found `snowglobe` contamination that belongs under `program:snow-gloves-os`.
- Kristudios: prior evidence says a distinct legal entity may exist; likely Client Branch unless founder confirms Thoughtseed origin.
- ParkArea and Tirak: split product/IP evidence from client-delivery evidence deliberately.
- `virtualtryon-3d`: post-dispatch founder decision retires/ignores the surface. Keep it as root-map empty-hold evidence with no active WorkObject id; do not create `sapling:virtualtryon`.

### Batch 4 — Internal programs and vault context

- `thoughtseed-labs` remains R2/vault infrastructure context, not an active WorkObject folder.
- `program:thoughtseed-vault` can receive evidence for vault/repository context only.
- `website` remains a container; only `website/temperance-engine-landing-page` maps to `program:temperance-hermes`.
- `plugins` remains deferred because it has no Git identity; founder must create/attach a repo or fold it into operator utilities.
- Multi-bind internal capability rows need one idempotent receipt per WorkObject binding.

## Mutation gate

Before any Workbench runtime, catalog, R2, GitHub issue, or folder mutation:

1. founder approves a specific batch or row set;
2. each repository is resolved to immutable GitHub identity where possible;
3. client-originated repositories remain Client Branches;
4. ambiguous origin rows stay `needs-review`;
5. completed/closed rows produce handoff, closeout receipt, memory projection, and finished-index delta;
6. each R2 receipt is immutable/idempotent and uses the WorkObject-specific prefix;
7. VirtualTryOn remains retired/ignored and is not recreated as an active WorkObject during broad action wiring.

## Non-actions

This dispatch did not:

- move, copy, rename, delete, or reorganize folders;
- write GitHub issues, GitHub Project items, labels, milestones, or repository settings;
- write R2, D1, Goal Graph, registry, provider, or deployment state;
- modify Workbench runtime/catalog/generated UI;
- accept any external Temperance batch output.
