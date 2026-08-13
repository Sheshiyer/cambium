# portfolio-miniapp-linkage.mjs — Implementation Guidance

**Status**: TDD red (5 failing tests at `scripts/portfolio-miniapp-linkage.test.mjs`)
**Schema**: `cambium.portfolio-miniapp-linkage.v1`
**Owner**: Forge (primary implementation); this document is guidance only.

---

## Architecture map

```
                     ┌─────────────────────────────────────┐
                     │  portfolio-miniapp-linkage.mjs       │
                     │  (pure-function transformer)         │
                     │                                      │
                     │  exports:                            │
                     │   compareWorkObjectSets(left, right) │
                     │   buildPortfolioMiniappLinkageReport │
                     └───┬──────────────┬──────────────────┘
                         │              │
          ┌──────────────┘              └──────────────┐
          ▼                                             ▼
   ┌──────────────────┐                    ┌─────────────────────────┐
   │  Catalog data    │                    │  Branch stories         │
   │  (passed in,     │                    │  (passed in,            │
   │   never imported)│                    │   never imported)       │
   │                  │                    │                         │
   │  Source:         │                    │  Source:                │
   │  portfolio-      │                    │  docs/plans/product-    │
   │  catalog.ts      │                    │  branches/index.md      │
   └──────────────────┘                    └─────────────────────────┘
          │                                              │
          ▼                                              ▼
   ┌──────────────────────────────────────────────────────────┐
   │               buildPortfolioMiniappLinkageReport         │
   │                                                          │
   │  ┌─────────────────────┐   ┌──────────────────────────┐  │
   │  │ catalogVisibility   │   │ missionAdmission         │  │
   │  │ (Canopy — what      │   │ (Mission — what packets   │  │
   │  │  records exist)     │   │  explicitly request       │  │
   │  │                     │   │  admission)               │  │
   │  │  · recordCount      │   │  · canonicalPacketWorkIds│  │
   │  │                     │   │  · templatePacketIds     │  │
   │  │                     │   │  · catalogWorkIds        │  │
   │  │                     │   │    WithoutPackets        │  │
   │  │                     │   │  · packetWorkIds         │  │
   │  │                     │   │    MissingFromCatalog    │  │
   │  │                     │   │  · policy                │  │
   │  └─────────────────────┘   └──────────────────────────┘  │
   │                                                          │
   │  ┌─────────────────────┐   ┌──────────────────────────┐  │
   │  │ mirrors + pins      │   │ observations (optional)  │  │
   │  │ · mirror drift      │   │ · vault diff             │  │
   │  │ · pin drift         │   │ · live diff              │  │
   │  │                     │   │ · source labels stripped │  │
   │  └─────────────────────┘   └──────────────────────────┘  │
   │                                                          │
   │  ┌─────────────────────┐                                 │
   │  │ release blockers    │                                 │
   │  │ (computed, never    │                                 │
   │  │  hardcoded)         │                                 │
   │  └─────────────────────┘                                 │
   └──────────────────────────────────────────────────────────┘
```

**Design invariants**:
- Module is a **pure-function library** — all data arrives via parameters; nothing is imported from `workers/quests/`.
- **Canopy visibility ≠ Mission admission** — catalog records exist regardless of whether a branch story packet admits them.
- Inputs are **never mutated** (freeze/deep-compare safety).
- Output emits **no absolute paths, secrets, or env material**.

---

## Safe observation shape

The full report shape (all keys, all conditions):

```typescript
interface PortfolioMiniappLinkageReport {
  schema: 'cambium.portfolio-miniapp-linkage.v1';
  generatedAt: string;                         // ISO 8601

  // ── Canopy: what the catalog sees ──
  catalogVisibility: {
    recordCount: number;
  };

  // ── Mission: what packets explicitly request ──
  missionAdmission: {
    canonicalPacketWorkIds: string[];           // sorted; branchStories with canonicalWorkId ∈ catalog
    templatePacketIds: string[];                // sorted; branchStories without canonicalWorkId (e.g. client-delivery)
    catalogWorkIdsWithoutPackets: string[];     // sorted; catalog records not referenced by any branch story
    packetWorkIdsMissingFromCatalog?: string[]; // sorted; only present when non-empty
    policy: 'explicit-packet-and-goal-graph-admission-only';
  };

  // ── Mirror/pin evidence ──
  mirrors: {
    catalogData: boolean;
    catalogModule: boolean;
    rootMap: boolean;
  };
  pins: {
    reviewedRootMapDigest: string;
    currentRootMapDigest: string;
    reviewedCatalogDigest: string;
    currentCatalogDigest: string;
    reviewedClassificationDigest: string;
    currentClassificationDigest: string;
  };

  // ── Status ──
  status: 'aligned' | 'drift-observed' | 'blocked';

  // ── Observations (present when vaultRegistry or liveSnapshot provided) ──
  observations?: {
    vault?: {
      recordCount: number;
      diff: { onlyLeft: string[]; onlyRight: string[] };
    };
    live?: {
      recordCount: number;
      diff: { onlyLeft: string[]; onlyRight: string[] };
    };
  };

  // ── Blockers (present when status === 'blocked') ──
  releaseBlockers?: string[];

  // ── Mutation attestation ──
  mutationsPerformed: [];
}
```

### Observation diff semantics

| Direction | Meaning |
|-----------|---------|
| `onlyLeft` | Present in observation (vault/live), **missing** from catalog |
| `onlyRight` | Present in catalog, **missing** from observation |

This is the set-difference: `diff = setSubtract(observationWorkIds, catalogWorkIds)`.

---

## Implementation guidance

### `compareWorkObjectSets(left, right)`

**Contract** (from test line 36-49):
- Input: two `string[]` of `kind:slug` workIds.
- Output: `{ onlyLeft, onlyRight, kindSetDifferences }`.
- `onlyLeft`/`onlyRight`: sorted set differences.
- `kindSetDifferences`: per-slug comparison of `Set<kind>`. Only slugs whose kind sets differ appear in the output. Sorted by slug.

**Algorithm**:

```
1. Parse each workId as kind:slug (split on first ':').
2. Build Map<slug, {leftKinds: Set, rightKinds: Set}>.
3. For each slug where the sorted kind arrays differ,
   emit {slug, leftKinds: [...].sort(), rightKinds: [...].sort()}.
4. Sort kindSetDifferences by slug.
5. Compute symmetric set differences for onlyLeft/onlyRight.
```

**Edge cases**:
- Malformed IDs (no colon): treat whole string as slug with empty kind. The test data uses valid `kind:slug` forms throughout.
- Empty arrays: return `{onlyLeft:[], onlyRight:[], kindSetDifferences:[]}`.

### `buildPortfolioMiniappLinkageReport(opts)`

**Parameters** (required):
- `catalog` — `{ records: [{workId, ...}], summary: {total} }`
- `branchStories` — `{ productId, canonicalWorkId? }[]`
- `mirrors` — `{ catalogData: boolean, catalogModule: boolean, rootMap: boolean }`
- `pins` — `{ reviewedRootMapDigest, currentRootMapDigest, reviewedCatalogDigest, currentCatalogDigest, reviewedClassificationDigest, currentClassificationDigest }`

**Parameters** (optional):
- `vaultRegistry` — `{ workObjects: [{workId}] }` (or undefined)
- `liveSnapshot` — `{ workIds: string[] }` (or undefined)
- `sourceLabels` — `{ vault?: string, live?: string }` (NEVER embedded in output)

#### Step-by-step report construction

**1. Catalog visibility**
```
catalogVisibility = { recordCount: catalog.records.length }
```

**2. Mission admission**
```
catalogWorkIdSet = new Set(catalog.records.map(r => r.workId))

canonicalPacketWorkIds = branchStories
  .filter(bs => bs.canonicalWorkId && catalogWorkIdSet.has(bs.canonicalWorkId))
  .map(bs => bs.canonicalWorkId)
  .sort()

templatePacketIds = branchStories
  .filter(bs => !bs.canonicalWorkId)
  .map(bs => bs.productId)
  .sort()

packetReferencedIds = new Set(branchStories
  .filter(bs => bs.canonicalWorkId)
  .map(bs => bs.canonicalWorkId))

catalogWorkIdsWithoutPackets = catalog.records
  .filter(r => !packetReferencedIds.has(r.workId))
  .map(r => r.workId)
  .sort()

packetWorkIdsMissingFromCatalog = branchStories
  .filter(bs => bs.canonicalWorkId && !catalogWorkIdSet.has(bs.canonicalWorkId))
  .map(bs => bs.canonicalWorkId)
  .sort()
```

**3. Release blockers**
```
blockers = []

if (mirrors.catalogData === false) blockers.push('catalog-data-mirror-drift')

if (pins.reviewedCatalogDigest !== pins.currentCatalogDigest)
  blockers.push('portfolio-catalog-pin-drift')

if (pins.reviewedRootMapDigest !== pins.currentRootMapDigest)
  blockers.push('portfolio-root-map-pin-drift')

for (const missingId of packetWorkIdsMissingFromCatalog)
  blockers.push(`unknown-packet-work-id:${missingId}`)
```

**4. Observations** (only when vaultRegistry or liveSnapshot provided)
```
function buildObservationDiff(observedWorkIds, catalogWorkIds) {
  const obsSet = new Set(observedWorkIds)
  const catSet = new Set(catalogWorkIds)
  return {
    recordCount: observedWorkIds.length,
    diff: {
      onlyLeft: observedWorkIds.filter(id => !catSet.has(id)).sort(),
      onlyRight: [...catSet].filter(id => !obsSet.has(id)).sort(),
    }
  }
}
```
- `vault`: extract `workObjects.map(wo => wo.workId)`, compare with `catalog.records.map(r => r.workId)`
- `live`: extract `workIds`, compare with catalog workIds

**5. Status**
```
if (blockers.length > 0) → 'blocked'
else if (observations present and any diff has non-empty onlyLeft or onlyRight) → 'drift-observed'
else → 'aligned'
```

**6. Mutations**
```
mutationsPerformed = []   // always empty; module is read-only
```

**7. Source labels** — accept `sourceLabels` parameter but NEVER stringify it into the report output. The test asserts `doesNotMatch(JSON.stringify(report), /\/Volumes\/|\/Users\//)`.

---

## Integration points with existing modules

| Existing module | How linkage consumes it |
|---|---|
| `portfolio-catalog.ts` (`PORTFOLIO_CATALOG`) | Passed via `catalog` parameter (caller imports, linkage transforms) |
| `docs/plans/product-branches/index.md` | Parsed by caller into `branchStories[]`; linkage receives structured data |
| `portfolio-roots.v1.json` | Root map digest pins flow through `pins` parameter |
| `portfolio-foundation-pins.mjs` | Digest values for pin comparison flow through `pins` parameter |
| `validate-product-branch-packets.mjs` | Packet index parsing already exists; linkage receives parsed rows |
| `drift-audit.mjs` | Orthogonal concern — drift-audit checks file existence/patterns; linkage checks data alignment |

**No direct imports from `workers/quests/`** — the module stays portable and testable.

---

## Invariants and edge cases

1. **Empty catalog**: `recordCount=0`, `catalogWorkIdsWithoutPackets=[]`, all packet workIds missing → blocked.
2. **All pins match, all mirrors true, no observations**: status = `aligned`.
3. **Vault/live observations with zero diff**: status stays `aligned` (no drift-observed without actual diff).
4. **Branch story with `canonicalWorkId` matching catalog record with different kind prefix**: still counts as canonical admission — the workId string matches exactly.
5. **`sourceLabels` with absolute paths**: accepted but never appears in output.
6. **Frozen inputs**: module must not mutate `opts`, `opts.catalog`, `opts.branchStories`, etc. The test verifies with deep `JSON.stringify` before/after equality.
7. **Schema string**: always `'cambium.portfolio-miniapp-linkage.v1'` (not a variable or configurable).

---

## File to create

`scripts/portfolio-miniapp-linkage.mjs` — single file, no dependencies beyond Node.js stdlib. Two exports: `compareWorkObjectSets` and `buildPortfolioMiniappLinkageReport`.

No new npm packages. No `.d.ts` companion needed (the module is consumed by test only; types are documented in this guidance).

---

## Verification

```bash
node --test scripts/portfolio-miniapp-linkage.test.mjs
```

Expected: 5/5 pass.
