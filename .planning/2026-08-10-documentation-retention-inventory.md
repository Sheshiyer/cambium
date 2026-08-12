# Documentation retention inventory — 2026-08-10

**Status:** evidence-safe inventory complete; no cleanup approved
**Scope:** `docs/` and `.planning/` only
**Snapshot refreshed:** 2026-08-12
**Method:** read-only size, type, checksum, and inbound-reference review

## Decision

Do not delete, move, merge, externalize, or auto-deduplicate any documentation asset in this pass. The only exact duplicate found has distinct evidence names and active test/manifest references. The primary result is a bounded retention proposal for owner review.

## Footprint

| Surface | Evidence | Interpretation |
| --- | --- | --- |
| `docs/` | 406 tracked files, 112,684,141 bytes (107.46 MiB) | the documentation tree is not broadly text-bloated |
| `docs/plans/` | 175 files, 110,393,121 bytes (105.28 MiB) | dominant historical/proof payload |
| `docs/plans/assets/` | 127 files, 109,947,001 bytes (104.85 MiB) | generated/reference proof assets |
| PNG files | 85 files, 109,774,126 bytes (99.44% of `docs/plans`) | primary future retention-review surface |
| Markdown files | 79 files, 541,382 bytes | low-cost decision/history context |
| JSON files | 11 files, 77,613 bytes | manifests and structured proof context |

Largest asset families are the Telegram Mini App viewport proof, Cambium R3F screenshots, Cambium R3F game-engine realignment, Telegram Mini App mission-control references, and constellation UI references.

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
  "generatedAt": "ISO-8601",
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
