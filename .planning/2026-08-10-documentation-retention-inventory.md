<!-- retention-inventory:head:start -->
# Documentation retention inventory — current HEAD inventory

**Status:** evidence-safe inventory complete; no cleanup approved
**Decision origin:** 2026-08-10 retention review
**Inventory basis:** exact committed `HEAD` tree and blobs
**Inventory as of HEAD commit date:** `2026-08-16`
**Scope:** `docs/` and `.planning/` only
**Method:** deterministic size, type, checksum, and inbound-reference generation plus release-gated consistency verification

## Decision

Do not delete, move, merge, externalize, or auto-deduplicate any documentation asset in this pass. The only exact duplicate found has distinct evidence names and active test/manifest references. The primary result is a bounded retention proposal for owner review.

## Footprint

| Surface | Evidence | Interpretation |
| --- | --- | --- |
| `docs/plans/` | 177 files, 110,765,479 bytes (105.63 MiB) | dominant historical/proof payload measured from HEAD |
| `docs/plans/assets/` | 127 files, 110,295,071 bytes (105.19 MiB) | generated/reference proof assets |
| PNG files | 85 files, 110,122,195 bytes (99.42% of `docs/plans`) | primary future retention-review surface |
| Markdown files | 81 files, 565,595 bytes | low-cost decision/history context |
| JSON files | 11 files, 77,689 bytes | manifests and structured proof context |

Largest asset families are the Telegram Mini App viewport proof, Cambium R3F screenshots, Cambium R3F game-engine realignment, Telegram Mini App mission-control references, and constellation UI references.
<!-- retention-inventory:head:end -->

## Reference safety findings

- `docs/LIFECYCLE.md` is authoritative: runbooks are current procedures; evidence is immutable dated proof; plans and plan assets are historical/generated proof, not active operator authority.
- At least 98 files outside `docs/plans` mention plan paths. Generated organs, project-management records, handoff notes, and dated evidence retain direct references.
- Plan-asset manifests and readiness receipts use paths and hashes as provenance. Moving files without coordinated manifest/link regeneration would damage replay and audit claims.
- A distinct duplicate pair exists: `mission-actions-mobile.png` and `mission-utilities-mobile.png` share one checksum and dimensions, but both names are referenced by proof manifests and worker test/fixture code. It is **review-required**, not reclaimable storage.
- All plan files are younger than 90 days; age is not a useful retention signal.

## Proposed retention manifest

Create this before any cleanup; it is a proposal, not an action queue:

```json
{
  "schema": "cambium.docs-retention.v1",
  "decisionOriginDate": "2026-08-10",
  "inventoryAsOfRevision": "HEAD",
  "inventoryAsOfCommitDate": "YYYY-MM-DD",
  "scopeRoot": "docs/plans",
  "entries": [
    {
      "path": "docs/plans/assets/example.png",
      "kind": "asset",
      "bytes": 0,
      "sha256": "…",
      "gitTracked": true,
      "referenceCount": 0,
      "references": [],
      "generatedBy": null,
      "hasIntegrityLink": false,
      "retentionClass": "review-required",
      "replacementPath": null,
      "restorationMethod": null,
      "owner": null,
      "decision": null,
      "decisionEvidence": null,
      "reviewedAt": null
    }
  ]
}
```

Allowed `retentionClass` values: `retain`, `keep-with-manifest`, `dedupe-candidate`, `externalize-candidate`, and `review-required`.

## Realignment proposal

1. Keep active authority where it is: `docs/runbooks/`, current contracts, and architecture documents.
2. Keep dated proof where it is until a reviewed manifest supplies a restoration method and all inbound references are updated.
3. Add a small canonical documentation map and reconcile contradictory archive/plans wording in a separate docs-only change; use indexes or redirects, not path moves.
4. Generate a read-only manifest with checksums, dimensions, manifest validation, and bounded inbound references.
5. Review each potential duplicate/externalization individually; update tests, manifests, links, and generated organs together only after approval.

## Exclusions

Do not automatically process `.planning`, `.project/HANDOFF.md`, current runbooks/contracts, receipts, evidence, or raw Cortex/provider state. This inventory does not authorize an R2 migration, Git history rewrite, registry change, or deployment.
