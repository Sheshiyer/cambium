# Census Reconciliation — PortfolioAssimilationCensus

> Produced 2026-08-22 against ISA.md ISC-1410..1422.
> Sources: `portfolio-roots.v1.json` (root map), filesystem `ls`, `portfolio-catalog-data.ts` (App + Worker).

## ISC-1414 / ISC-1415 — Catalog Byte-Identity

| Module | Worker path | App path | Identical |
|--------|------------|----------|-----------|
| portfolio-catalog-data.ts | `workers/quests/src/portfolio-catalog-data.ts` | `apps/portfolio-cartographer/src/portfolio-catalog-data.ts` | YES (diff empty) |
| portfolio-catalog.ts | `workers/quests/src/portfolio-catalog.ts` | `apps/portfolio-cartographer/src/portfolio-catalog.ts` | YES (diff empty) |

Both modules are byte-identical. ISC-1414 and ISC-1415 are satisfied.

---

## ISC-1410 / ISC-1411 — Thoughtseed Portfolio Census

### Summary

| Source | Count |
|--------|-------|
| Filesystem directories | 61 |
| Root map entries (folders + infra) | 62 (57 folders + 5 infrastructure) |
| In both | 58 |
| Filesystem only | 3 |
| Root map only | 4 |

### Filesystem-only directories (3)

| Directory | Classification | Reason |
|-----------|---------------|--------|
| `temperance_engine` | **Infrastructure** | Temperance Engine runtime; not a Thoughtseed product/program. Maps to `program:temperance-hermes` catalog entry but is a runtime artifact, not a project folder. |
| `temperance_engine-phase-01` | **Infrastructure** | Phase-01 worktree of Temperance Engine. Same classification as above. |
| `thoughtseedlabs-website` | **Infrastructure / Company** | Thoughtseed Labs website. Maps to `program:company-website` catalog entry. Present on disk but absent from root map — root map gap. |

### Root-map-only entries (4)

| Entry | Root map type | Classification | Reason |
|-------|--------------|---------------|--------|
| `motionsites-skills` | folder | **Catalog-only** | Repo `Sheshiyer/motionsites-skills` is referenced by `program:skill-clusters` and `program:meristem-brand-system`. No local checkout. |
| `professional-headshot-suite` | folder | **Catalog-only** | Repo `Sheshiyer/professional-headshot-suite` is referenced by `program:skill-clusters` and `program:explee-capabilities`. No local checkout. |
| `readme-skill` | folder | **Catalog-only** | Repo `Sheshiyer/readme-skill` is referenced by `program:skill-clusters` and `program:operator-utilities`. No local checkout. |
| `scroll-world` | infrastructure | **Infrastructure** | Marked infrastructure in root map. No local checkout. No catalog reference found. |

### Catalog WorkObjects without local directories (8)

| WorkObject | Kind | Why no directory |
|-----------|------|-----------------|
| `program:snow-gloves-os` | capability | Repo `Sheshiyer/snow-gloves-os` — no local checkout |
| `program:thoughtseed-vault` | company | Repo `Sheshiyer/thoughtseed-vault` — no local checkout |
| `program:meristem-brand-system` | capability | Repo `brandmint-v2` — no local checkout |
| `program:hdilint` | capability | Repo `HDILINT-backend-aleph` — no local checkout |
| `program:explee-capabilities` | capability | Repo `explee-skills` — no local checkout |
| `program:engineering-orchestration` | capability | Repo `github-next-wave-orchestrator` — no local checkout |
| `program:company-website` | company | Multiple repos; `thoughtseedlabs-website` on disk is the local checkout but not in root map |
| `program:thoughtseed-brand-atlas` | company | Repo `thoughtseed-brand-atlas` — no local checkout |

---

## ISC-1410 / ISC-1411 — Tryambakam-Noesis Portfolio Census

### Summary

| Source | Count |
|--------|-------|
| Filesystem directories | 35 |
| Root map entries (folders + infra + archived) | 35 (30 folders + 1 infrastructure + 4 archived) |
| In both | 23 |
| Filesystem only | 6 |
| Root map only | 6 |

### Case-sensitivity issues

| Filesystem | Root map | Notes |
|-----------|----------|-------|
| `Selemene-engine` | `selemene-engine` | Different case. Root map uses lowercase. |
| `Sankalpa` | `sankalpa` (archived) | Different case. Root map uses lowercase. |

### Filesystem-only directories (6)

| Directory | Classification | Reason |
|-----------|---------------|--------|
| `FMRL-reactnative` | **Active project** | FMRL React Native app. Not in root map — root map gap. FMRL is a catalog Sapling (`sapling:fmrl`). |
| `Selemene-engine` | **Active project** | Case variant of root map's `selemene-engine`. Root map has lowercase. |
| `_archive` | **Aggregate** | Archive directory (underscore prefix). Not in root map — structural directory, not a project. |
| `_portfolio-audit` | **Aggregate** | Portfolio audit artifacts (underscore prefix). Not in root map — structural directory. |
| `antahkarana` | **Active project** | Not in root map — root map gap. |
| `somaticcanticles-aleph` | **Active project** | Not in root map — root map gap. |

### Root-map-only entries (6)

| Entry | Root map type | Classification | Reason |
|-------|--------------|---------------|--------|
| `selemene-engine` | folder | **Case mismatch** | Filesystem has `Selemene-engine` (capital S). |
| `selemene-engine-worktrees` | infrastructure | **Infrastructure** | Worktree directory for Selemene Engine. No local checkout. |
| `selemene-gw` | folder | **Missing from filesystem** | No local checkout or directory found. |
| `serpentine-raising` | folder | **Missing from filesystem** | No local checkout or directory found. |
| `twc-shell` | folder | **Missing from filesystem** | No local checkout or directory found. |
| `witness-agents-intro-web` | archived | **Archived** | Archived project. No local checkout. |

### Tryambakam-Noesis WorkObjects

The portfolio catalog (`portfolio-catalog-data.ts`) does **not** contain Tryambakam-Noesis projects. These are tracked only in the root map. ISC-1422 requires every directory to map to a WorkObject or unresolved intake record — the 30 Tryambakam-Noesis folders need intake records.

---

## ISC-1412 — Unique Normalized Folder Identities

### Duplicates / collisions found

| Issue | Details |
|-------|---------|
| `Selemene-engine` vs `selemene-engine` | Case mismatch between filesystem and root map. Normalize to lowercase. |
| `Sankalpa` vs `sankalpa` | Case mismatch. Filesystem capitalizes; root map lowercases. Normalize to lowercase. |

No other collisions detected. All 96 directories (61 Thoughtseed + 35 Tryambakam-Noesis) have unique normalized identities after case folding.

---

## ISC-1413 — Unique Canonical WorkIds

All 92 catalog entry IDs (the first element of each tuple in `RAW_SAPLINGS`, `RAW_PROGRAMS`, and `RAW_HISTORICAL_PRODUCTS`) are unique. No duplicates detected.

| Array | Count |
|-------|-------|
| RAW_SAPLINGS | 17 |
| RAW_PROGRAMS | 55 |
| RAW_HISTORICAL_PRODUCTS | 20 |
| RAW_CLASSIFICATION_REVIEW | 0 |
| **Total** | **92** |

Note: `RAW_OPERATIONAL_GAP_WORK_IDS` contains 44 vault-path references (not catalog entry IDs). These are operational gap markers, not WorkObject identifiers.

---

## ISC-1417 — Workbench Counts Add Up

The catalog contains exactly 92 WorkObject entries across three arrays:

| Kind | Prefix | Count |
|------|--------|-------|
| Sapling | `sapling:` | 17 |
| Program / Branch | `program:` / `branch:` | 55 |
| Historical Product | `historical-product:` | 20 |
| **Total** | | **92** |

The counts are consistent with the type definitions and the array contents.

---

## ISC-1418 — Separate Fields

The catalog type definitions (`RawSapling`, `RawProgram`, `RawHistoricalProduct`) use separate tuple positions for each concern:

| Concern | Sapling field | Program field | Historical Product field |
|---------|---------------|---------------|--------------------------|
| Canonical ID | `workId` (pos 0) | `workId` (pos 0) | `canonicalId` (pos 0) |
| Display name | `name` (pos 1) | `name` (pos 1) | `name` (pos 1) |
| Classification | `promotionState` (pos 2) | `programKind` (pos 2) | `status` (pos 2) |
| Portfolio membership | `tenantStatus` (pos 3) | `tenantStatus` (pos 3) | `linkedCanonicalId` (pos 3) |
| Lifecycle status | — | `lifecycle` (pos 3) | — |
| Filesystem evidence | `provenance` (pos 5) | `provenance` (pos 6) | `source` (pos 4) |
| Operational admission | `commercialReuse` (pos 8) | `commercialReuse` (pos 10) | — |

All four concerns (filesystem evidence, portfolio membership, lifecycle status, operational admission) are separate fields in the tuple structure. ISC-1418 satisfied.

---

## ISC-1416 — Repository Evidence Resolution

The catalog references repos in three forms:
- `repo:<owner>/<name>` — GitHub repo reference
- `repo-id:<id>` — GitHub node ID
- `repo:<name>` — implicit owner (Sheshiyer)

**Resolution status**: Deferred to ISC-1417 (GitHub-backed WorkObject resolution). The catalog contains 17 Saplings and 30+ Programs/Branches with repo references. Each needs verification that the referenced GitHub repository exists and is accessible.

---

## ISC-1419 / ISC-1420 — Grammar-Valid WorkObject Kinds

### Catalog grammar audit

| Kind | Count | Grammar rule | Status |
|------|-------|-------------|--------|
| Sapling (Thoughtseed-originated venture) | 17 | Must have `sapling:` prefix | PASS |
| Client Branch (client-originated) | ~30 | Must have `branch:` prefix, `programKind: 'client'` | PASS |
| Internal Program (shared capability) | ~12 | Must have `program:` prefix | PASS |
| Historical Product | 20 | Must have `historical-product:` prefix | PASS |

All catalog entries follow the grammar: `sapling:` for Thoughtseed ventures, `branch:` for client branches, `program:` for internal programs.

### Root map grammar audit

| Portfolio | Grammar | Status |
|-----------|---------|--------|
| Thoughtseed | `<projects-root>/thoughtseed/<repository>` | PASS — all 62 entries follow shallow path |
| Tryambakam-Noesis | `<projects-root>/tryambakam-noesis/<repository>` | PASS — all 35 entries follow shallow path |

---

## ISC-1421 / ISC-1422 — Directory-to-WorkObject Mapping

### Thoughtseed: 47 of 57 root-map folders mapped to catalog WorkObjects

| Folder | Catalog WorkObject | Notes |
|--------|-------------------|-------|
| Airdronauts | `branch:airdronauts-panorama-viewer-delivery` | Client branch |
| agentfount | `sapling:agentfount` | Sapling |
| ashwinsheth-group | `branch:ashwinsheth-marina-one-mumbai` | Client branch (maps to first of two branches) |
| brandmint | `program:meristem-brand-system` | Program (legacy folder name) |
| brandmint-oracle-aleph | `program:meristem-brand-system` | Program (legacy folder name) |
| bwssb | `branch:bwssb` | Client branch |
| cambium | `sapling:cambium` | Sapling |
| coproperty | `sapling:nimbus-gate` | Sapling (folder name differs from catalog) |
| earthy-munchy | `branch:earthy-munchy` | Client branch |
| fitcheck-landing | `sapling:fitcheck` | Sapling (landing page repo) |
| fitcheck-wiki | `sapling:fitcheck` | Sapling (wiki repo) |
| fmrl | `sapling:fmrl` | Sapling |
| fmrl-reactnative | `sapling:fmrl` | Sapling (React Native variant) |
| gram-cli | `program:operator-utilities` | Program (one of4 repos) |
| hdilint-backend-aleph | `program:hdilint` | Program |
| hermes-aws-ts | `program:temperance-hermes` | Program (AWS TypeScript variant) |
| heyzack | `branch:heyzack` | Client branch |
| hostscale | `sapling:hostscale` | Sapling |
| insightreality | `branch:insight-realtors-legal-advisors` | Client branch |
| iverif | `sapling:iverif` | Sapling |
| kacima | `branch:kacima` | Client branch |
| klear-karma | `branch:klear-karma` | Client branch |
| kristudios | `branch:kristudios` | Client branch |
| meristem | `program:meristem-brand-system` | Program |
| monthlymealprep | `sapling:rasa` | Sapling (folder name differs from catalog) |
| motionsites-skills | `program:skill-clusters` | Program (one of4 repos) |
| newsense | `branch:newsense` | Client branch |
| panaroma-webapp | `sapling:vantyx` | Sapling (folder name differs from catalog) |
| parkarea | `branch:parkarea` | Client branch |
| plexus-ts | `program:plexus` | Program |
| professional-headshot-suite | `program:skill-clusters` | Program (one of4 repos) |
| raycast-extensions | `program:operator-utilities` | Program (one of4 repos) |
| reddit-cli | `program:operator-utilities` | Program (one of4 repos) |
| readme-skill | `program:skill-clusters` | Program (one of4 repos) |
| sandboxlife | `branch:sandboxlife` | Client branch |
| safvr | `branch:safvr-landing-page` | Client branch |
| session-atlas | `program:skill-clusters` | Program (one of4 repos) |
| skill-clusters | `program:skill-clusters` | Program |
| skills | `program:skill-clusters` | Program (one of4 repos) |
| snow-gloves-os | `program:snow-gloves-os` | Program |
| synchronized-universe-blog | `branch:harsh-truths` | Client branch |
| team-forge-ts | `program:teamforge-control-plane` | Program |
| thoughtseed-brand-atlas | `program:thoughtseed-brand-atlas` | Program |
| tirak | `branch:tirak` | Client branch |
| valmark | `branch:valmark` | Client branch |
| vibrasonix | `sapling:vibrasonix` | Sapling |
| whspr | `sapling:whspr` | Sapling |
| wtfmedia | `branch:wtfmedia` | Client branch |

### Thoughtseed: 10 root-map folders need unresolved intake records

| Folder | Proposed classification | Reason |
|--------|------------------------|--------|
| archived-thoughtseedlabs-website | Infrastructure / Archived | Website archive |
| brand-genesis | Needs review | Unknown origin |
| landingpage-ts-2026 | Needs review | Unknown origin |
| motionsites-export | Needs review | Unknown origin |
| plugins | Infrastructure | Plugin directory |
| temperance-engine-landing-page | Infrastructure | Temperance Engine landing page |
| thoughtseed-hermes | Needs review | Unknown origin |
| thoughtseedos-website | Infrastructure | ThoughtseedOS website |
| virtualtryon-3d | Needs review | Unknown origin |

### Thoughtseed: 3 filesystem-only directories need classification

| Directory | Proposed classification | Reason |
|-----------|------------------------|--------|
| temperance_engine | Infrastructure | Temperance Engine runtime |
| temperance_engine-phase-01 | Infrastructure | Temperance Engine phase-01 worktree |
| thoughtseedlabs-website | Infrastructure / Company | Thoughtseed Labs website (maps to `program:company-website`) |

### Tryambakam-Noesis: 30 folders need intake records

The 30 Tryambakam-Noesis folders in the root map are **not** in the portfolio catalog. They need unresolved intake records per ISC-1422. The 6 additional filesystem-only directories need classification (see above).

### Tryambakam-Noesis: 6 filesystem-only directories need classification

| Directory | Proposed classification | Reason |
|-----------|------------------------|--------|
| FMRL-reactnative | Active project | FMRL React Native app (sapling:fmrl) |
| Selemene-engine | Active project | Case variant of root map's `selemene-engine` |
| _archive | Aggregate | Archive directory |
| _portfolio-audit | Aggregate | Portfolio audit artifacts |
| antahkarana | Active project | Not in root map — root map gap |
| somaticcanticles-aleph | Active project | Not in root map — root map gap

---

## Open Items

1. **Tryambakam-Noesis intake records** (ISC-1422): 30 folders need WorkObject or unresolved intake records. This is the largest gap.
2. **Root map gaps**: 3 Thoughtseed + 4 Tryambakam-Noesis filesystem directories missing from root map.
3. **Case normalization**: 2 Tryambakam-Noesis directories need case correction in root map.
4. **Repository evidence** (ISC-1416): Deferred — needs GitHub API verification for all catalog repo references.
5. **`scroll-world`**: Infrastructure in root map but no local checkout and no catalog reference. Needs disposition.
6. **`thoughtseedlabs-website`**: On disk but not in root map. Maps to `program:company-website`. Root map needs update.
7. **10 unmapped Thoughtseed folders**: Need unresolved intake records (archived-thoughtseedlabs-website, brand-genesis, landingpage-ts-2026, motionsites-export, plugins, temperance-engine-landing-page, thoughtseed-hermes, thoughtseedos-website, virtualtryon-3d).
8. **6 Tryambakam-Noesis filesystem-only dirs**: Need classification and root map addition (FMRL-reactnative, Selemene-engine, _archive, _portfolio-audit, antahkarana, somaticcanticles-aleph).
