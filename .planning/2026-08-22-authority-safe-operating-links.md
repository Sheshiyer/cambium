# AuthoritySafeOperatingLinks — ISC-1423..1444 Evidence

> Produced 2026-08-22 against ISA.md ISC-1423..1444.
> Source: `scripts/audit-portfolio-miniapp-linkage.ts` + `scripts/portfolio-miniapp-linkage.mjs`
> Audit run: `npx tsx scripts/audit-portfolio-miniapp-linkage.ts` — status **aligned**, zero release blockers.

## Audit Summary

| Metric | Value |
|--------|-------|
| Total WorkObjects | 72 |
| Packet-backed Story Arcs | 5 |
| Explicit Story Arc Gaps | 67 |
| Packet-backed Quest Rows | 48 |
| Organ Workflow IDs | 5 (cortex, genesis, hands, taste, will) |
| Active Organ Assignments | 0 |
| Mirror Status | All aligned (catalogData, catalogModule, rootMap) |
| Pin Status | All reviewed pins match current pins |
| Release Blockers | 0 |
| Report Status | aligned |

## ISC-1423 — Every visible WorkObject has explicit operating coverage row

The `operatingCoverage.rows` array in the report contains exactly one entry per catalog WorkObject (72 total). Each row carries `workId`, `classification`, `filesystem`, `storyArc`, `quests`, `organs`, `miniApp`, and `telegramTransport` fields. No WorkObject is omitted.

**Evidence**: Report field `operatingCoverage.totalWorkObjects === 72`, matching `catalogVisibility.recordCount === 72`.

## ISC-1424 — Authority boundary between catalog visibility and operational admission

The report declares `missionAdmission.authorityBoundary: "catalog-visibility-does-not-grant-operational-admission"` and `operatingCoverage.authorityBoundary: "explicit-gaps-never-grant-goal-graph-admission"`. Catalog visibility is read-only; operational admission requires explicit packet and goal graph admission.

**Evidence**: Report fields `missionAdmission.authorityBoundary` and `operatingCoverage.authorityBoundary`.

## ISC-1425 — Classification visible for every WorkObject

Each `operatingCoverage.rows[]` entry carries a `classification` field with value `'sapling' | 'client-branch' | 'internal-program'`. The `catalogVisibility.classificationDigest` is pinned and reviewed.

**Evidence**: Report field `catalogVisibility.classificationDigest` matches `reviewedPins.reviewedClassificationDigest`.

## ISC-1426 — WorkId and classification in every coverage row

Every row in `operatingCoverage.rows[]` has `workId` (string) and `classification` (string). No row is missing either field.

**Evidence**: Report structure — `buildPortfolioMiniappLinkageReport()` maps `catalog.records` to coverage rows, copying `record.workId` and `record.classification`.

## ISC-1427 — Filesystem mapping state for every WorkObject

Each coverage row has `filesystem.state` = `'mapped'` (with `folders[]`) or `'explicit-folderless-gap'` (with empty `folders[]`). The `filesystemAssimilation` section provides aggregate counts: `mappedFolderCount`, `catalogWorkIdsWithoutFolders`, `unresolvedFolders`.

**Evidence**: Report field `filesystemAssimilation.catalogWorkIdsWithoutFolders` lists WorkObjects without folder mapping.

## ISC-1428 — Catalog visibility is read-only

The report declares `catalogVisibility.authority: "portfolio-catalog-read-only-visibility"`. The `readOnly: true` field is set on the report. The `buildPortfolioMiniappLinkageReport()` function performs no mutations — it reads from `PORTFOLIO_CATALOG`, `loadBranchStories()`, and `ORGAN_UPDATE_PLAN`, all of which are pure read-only modules.

**Evidence**: Report field `catalogVisibility.authority` and `readOnly: true`.

## ISC-1429 — Release blockers catch missing/duplicate/ambiguous/stale mappings

The `releaseBlockers` array catches:
- `catalog-data-mirror-drift`, `catalog-module-mirror-drift`, `portfolio-root-map-mirror-drift` (mirror drift)
- `portfolio-classification-pin-drift`, `portfolio-catalog-pin-drift`, `portfolio-root-map-pin-drift` (pin drift)
- `unknown-packet-work-id:*` (packet references WorkObject not in catalog)
- `unknown-root-map-work-id:*` (root map references WorkObject not in catalog)
- `missing-working-folder:*` (expected folder not on disk)
- `unmapped-working-folder:*` (folder on disk not in root map)

**Evidence**: Report field `releaseBlockers` — currently empty (0 blockers).

## ISC-1430 — Packet WorkIds resolve to catalog WorkObjects

`missionAdmission.packetWorkIdsMissingFromCatalog` lists packet WorkIds not found in the catalog. Currently empty — all packet WorkIds resolve.

**Evidence**: Report field `missionAdmission.packetWorkIdsMissingFromCatalog` = `[]`.

## ISC-1431 — Story Arc state per WorkObject

Each coverage row has `storyArc.state` = `'packet-backed'` (with `arcId`) or `'explicit-unadmitted-gap'` (with `arcId: null`). 5 WorkObjects are packet-backed; 67 are explicit gaps.

**Evidence**: Report field `operatingCoverage.packetBackedStoryArcs` = 5, `operatingCoverage.explicitStoryArcGaps` = 67.

## ISC-1432 — Story Arc identity (arcId)

Packet-backed Story Arcs carry an `arcId` derived from `productId-slugify(arcTitle)` in `branch-stories.ts:392`. The arcId is deterministic and unique per packet.

**Evidence**: `branch-stories.ts:392` — `arcId: \`${productId}-${slugify(arcTitle)}\``.

## ISC-1433 — Explicit gap marking for unmapped WorkObjects

WorkObjects without a packet have `storyArc.state: 'explicit-unadmitted-gap'` and `storyArc.arcId: null`. The gap is explicit, not silent.

**Evidence**: Report structure — `storyArc` field in coverage rows.

## ISC-1434 — No orphaned packet references

`missionAdmission.packetWorkIdsMissingFromCatalog` is empty. Every packet WorkId resolves to a catalog WorkObject.

**Evidence**: Report field `missionAdmission.packetWorkIdsMissingFromCatalog` = `[]`.

## ISC-1435 — Template packet IDs separated from canonical

`missionAdmission.templatePacketIds` lists non-canonical packet IDs (e.g., "client-delivery"). These are separated from `canonicalPacketWorkIds`.

**Evidence**: Report field `missionAdmission.templatePacketIds`.

## ISC-1436 — Quest row state per WorkObject

Each coverage row has `quests.state` = `'packet-backed'` (with `count`) or `'explicit-unadmitted-gap'` (with `count: 0`). 48 quest rows are packet-backed.

**Evidence**: Report field `operatingCoverage.packetBackedQuestRows` = 48.

## ISC-1437 — Quest compilation does not mutate Goal Graph

Quest rows are derived from `questlineFromSection()` in `branch-stories.ts:245-260`, which reads from the "Quest Queue" section of packet markdown files. This is a pure parse operation.

`compileGoalGraph()` in `goal-graph/compiler.ts` produces `GoalChangeSet` objects (nodesToCreate, nodesToUpdate, nodesToRemove) but does NOT write to storage. The actual mutation happens in `goal-graph-store.ts` via `targetNodes()` and `expectedHeadDigest()`.

Quest rendering code in `page/scenes/mission.ts` only reads from branch data via `mcQuestline(branch)` — it does not write to Goal Graph.

**Evidence**:
- `bin/quine/hyphae/branch-stories.ts:245-260` — `questlineFromSection()` reads packet markdown
- `workers/quests/src/goal-graph/compiler.ts` — `compileGoalGraph()` returns `GoalChangeSet`, no storage write
- `workers/quests/src/page/scenes/mission.ts` — reads `mcQuestline(branch)`, no Goal Graph mutation

## ISC-1438 — Organ workflow IDs listed

`operatingCoverage.organWorkflowIds` lists all 5 organ workflow IDs: cortex, genesis, hands, taste, will.

**Evidence**: Report field `operatingCoverage.organWorkflowIds`.

## ISC-1439 — Organ state per WorkObject

Each coverage row has `organs.state` = `'receipt-backed'` (with `linked[]`) or `'workflow-available-unassigned'` (with `linked: []`). Currently 0 active organ assignments.

The `organ-update-delivery.ts` module is explicitly "Pure, read-only compiler for receipt-backed organ updates" that "performs no network, storage, scheduling, tenant activation, or approval mutation."

**Evidence**:
- Report field `operatingCoverage.activeOrganAssignments` = 0
- `workers/quests/src/organ-update-delivery.ts:1-7` — read-only declaration

## ISC-1440 — Mission Fabric projection per WorkObject

Each coverage row has `miniApp.mission` = `'packet-projected'` or `'explicit-gap'`. 5 WorkObjects are packet-projected; 67 are explicit gaps.

**Evidence**: Report structure — `miniApp.mission` field in coverage rows.

## ISC-1441 — Canopy visibility does not grant operational admission

Each coverage row has `miniApp.canopy: 'catalog-visible'`. The `operatingCoverage.authorityBoundary` declares "explicit-gaps-never-grant-goal-graph-admission". Catalog visibility is a canopy property, not an operational admission.

**Evidence**: Report field `miniApp.canopy` in coverage rows and `operatingCoverage.authorityBoundary`.

## ISC-1442 — Operational mirrors aligned

`operationalMirrors.catalogData`, `operationalMirrors.catalogModule`, and `operationalMirrors.rootMap` are all `true`. App and Worker modules are byte-identical.

**Evidence**: Report field `operationalMirrors` — all three mirrors aligned.

## ISC-1443 — Deterministic linkage audit

The `buildPortfolioMiniappLinkageReport()` function in `portfolio-miniapp-linkage.mjs` produces a deterministic report from:
- `PORTFOLIO_CATALOG` (catalog records)
- `loadBranchStories()` (packet-backed story arcs)
- `ORGAN_UPDATE_PLAN` (organ workflow assignments)
- Root map (filesystem assimilation)
- Pin digests (reviewed vs current)

The report includes `catalogVisibility.recordCount`, `operatingCoverage.totalWorkObjects`, `operatingCoverage.packetBackedStoryArcs`, `operatingCoverage.packetBackedQuestRows`, and `operatingCoverage.activeOrganAssignments`.

**Evidence**: Report structure — all coverage counts present and deterministic.

## ISC-1444 — Release blocker and status reporting

The `releaseBlockers` array catches all mapping issues (missing folders, orphaned references, mirror drift, pin drift). The `status` field reports `'blocked'` (any blockers), `'drift-observed'` (observations differ), or `'aligned'` (all clear).

Currently: 0 release blockers, status = `'aligned'`.

**Evidence**: Report fields `releaseBlockers` and `status`.

---

## Open Items

1. **ISC-1416 (deferred)**: Repository evidence resolution needs GitHub API verification for all catalog repo references. Not part of this task.
2. **67 explicit Story Arc gaps**: Most WorkObjects lack packet-backed story arcs. This is expected — packets are created per-product, not per-WorkObject.
3. **0 active organ assignments**: No WorkObject currently has receipt-backed organ linkage. Organ workflows exist but are unassigned.
