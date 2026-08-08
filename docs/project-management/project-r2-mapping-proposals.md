# Project/R2 mapping proposals — gap settlement

Status: founder-review proposal for the 11 unmapped physical gaps plus the 1 mapped identity gap found on 2026-08-08.

Source evidence:

- `docs/evidence/2026-08-08-project-r2-folder-inventory.json`
- `docs/evidence/2026-08-08-project-r2-folder-inventory.md`
- `docs/project-management/portfolio-root-ingestion-issue.md`
- `docs/plans/2026-08-08-project-r2-mapping-execution.md`

This proposal does not move folders, write R2 objects, update vault registries, mutate GitHub issues, or change Workbench runtime behavior. It only settles how each gap should be treated by the next mapping action.

## Grammar applied

- Thoughtseed-originated ventures may be Saplings.
- Client-originated work remains Client Branch, even when new.
- Shared capability tooling, brand systems, and operator surfaces are Internal Programs.
- Cleanup archives, temporary checkouts, external/vendor clones, and unowned dependency references do not become WorkObjects.

## Settlement table

| Folder | Settlement | Workbench grammar | Repository identity | Planning authority | Next action |
| --- | --- | --- | --- | --- | --- |
| `Airdronauts` | Admit nested repository | Client Branch: `branch:airdronauts-panorama-viewer-delivery` | `Sheshiyer/airdronauts-nextjs` | `Airdronauts/website-alpha/airdronauts-nextjs/PROJECT.md` | Map nested repo to the existing Airdronauts branch; later resolve overlap with `panaroma-webapp`. |
| `_home-cleanup-2026-08-08` | Exclude cleanup archive | None | nested external `garrytan/gstack` reference only | `_home-cleanup-2026-08-08/CLEANUP-LOG.md` | Keep out of Workbench; handle in a separate cleanup/archive pass. |
| `brandmint-oracle-aleph` | Admit exact repository | Internal Program: `program:meristem-brand-system` | `Sheshiyer/brandmint-oracle-aleph` | `brandmint-oracle-aleph/docs/plans/` | Attach as exact repo under Meristem / brand-system planning. |
| `cambium` | Resolve mapped identity gap | Sapling: `sapling:cambium`; Program: `program:cambium-operating-fabric` | canonical repo is `Sheshiyer/cambium`; physical folder is not Git | `cambium-authoritative/.project/HANDOFF.md` | Use `cambium-authoritative` as repo authority until founder approves a physical promote/swap. |
| `cambium-authoritative` | Exclude as temp authority checkout | None | `Sheshiyer/cambium` | `cambium-authoritative/PROJECT.md` | Do not create second WorkObject; use only as temporary exact checkout. |
| `motionsites-skills` | Admit exact repository | Internal Program: `program:meristem-brand-system`; `program:skill-clusters` | `Sheshiyer/motionsites-skills` | `motionsites-skills/SKILL-SPEC.md` | Attach as internal capability/corpus repository. |
| `openfang` | Exclude external vendor/reference | None | `RightNow-AI/openfang` | `openfang/README.md` | Keep out of WorkObjects; track later only as dependency/reference evidence if needed. |
| `plugins` | Defer Git identity | Internal Program candidate: `program:operator-utilities`; `program:engineering-orchestration` | no exact Git identity | `plugins/conducty-codex/README.md` | Founder decision: create/attach repo or fold into existing operator utility/skill-clusters infrastructure. |
| `professional-headshot-suite` | Admit exact repository | Internal Program: `program:explee-capabilities`; `program:skill-clusters` | `Sheshiyer/professional-headshot-suite` | `professional-headshot-suite/skills/professional-headshot-suite/SKILL.md` | Attach as internal capability/skill repository. |
| `readme-skill` | Admit exact repository | Internal Program: `program:explee-capabilities`; `program:operator-utilities`; `program:skill-clusters` | `Sheshiyer/readme-skill` | `readme-skill/SKILL.md` | Attach as internal capability/operator utility repository. |
| `safvr` | Approved closed client website branch | Client Branch: `branch:safvr-landing-page` | observed remote `SAFVR-SG/Landingpage2.0`, not resolvable by current GitHub account | `docs/evidence/2026-08-06-classification-needed-findings.md`; `safvr/Landingpage2.0/README.md`; `docs/project-management/closeouts/safvr-landing-page-handoff.md` | Seed as completed/closed and remove from active workflow. Do not admit as Sapling. |
| `website` | Exclude container; map nested repository | Internal Program: `program:temperance-hermes` | nested `Sheshiyer/temperance_engine_landing_page` | `website/temperance-engine-landing-page/ISA.md` | Bind nested repo to the existing Temperance internal-program row; later de-duplicate physical placement. |

## What is actually resolved

The previous inventory had 12 explicit gaps:

- 11 unmapped physical folders;
- 1 mapped identity gap: `cambium`.

After this settlement, none of the 12 should be treated as unknown by Workbench:

- 7 can be admitted or linked to existing WorkObjects with explicit grammar;
- 4 are excluded from WorkObjects because they are cleanup, external reference, container, or temporary checkout;
- 1 still requires founder review before action payloads are generated: `plugins`.
- SAFVR is approved as a Client Branch and is seeded as completed/closed, so it should not appear in the active workflow.

The apparent count is larger than 12 because `cambium` and `cambium-authoritative` are one identity problem expressed through two folders, and `website` is a container whose nested exact repository belongs to an existing Temperance program row.

## Required founder decisions before Workbench action wiring

1. Cambium physical authority: should `cambium-authoritative` be promoted into the canonical `cambium` path, or should the stale `cambium` folder be archived separately first?
2. Plugins: should `plugins/conducty-codex` get its own GitHub repo, or should it be folded into `skill-clusters` / operator utilities?
3. SAFVR: closed/completed as a Client Branch. Verify GitHub access later only if the relationship reopens.
4. Airdronauts: confirm whether `Airdronauts/website-alpha/airdronauts-nextjs` and `panaroma-webapp` are two WorkObjects or one overloaded client delivery record.
5. Temperance landing page: confirm whether to promote the nested `website/temperance-engine-landing-page` exact repo to the existing shallow `temperance-engine-landing-page` mapped folder in a later filesystem-safe pass.

## Proposed R2 evidence prefix shape

For rows that are admitted or held for review, Workbench should write bounded evidence under this prefix shape only after founder approval:

```text
portfolio/thoughtseed/workobjects/<work-id>/mapping/<receipt-id>.json
portfolio/thoughtseed/workobjects/<work-id>/intake/<receipt-id>.json
portfolio/thoughtseed/workobjects/<work-id>/closeout/<receipt-id>.json
portfolio/thoughtseed/workobjects/<work-id>/finished-index/<receipt-id>.json
```

R2 remains immutable/idempotent evidence and durability. It is not the live project state, code history, planning authority, Goal Graph writer, or source of truth for local folder moves.

The SAFVR mapping prefix is approved for the closed client branch. The closeout prefix is represented by the source-controlled closeout seed until a live R2 write records or reconciles the durable evidence object.
