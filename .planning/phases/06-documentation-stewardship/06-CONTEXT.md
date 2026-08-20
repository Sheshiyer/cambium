# Phase 6: Documentation Stewardship - Context

**Gathered:** 2026-08-20 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Classify and connect Cambium's named root, `docs/`, root `MEMORY/`, and `.planning/` doctrine corpus so maintainers can distinguish current authority from derived, historical, evidentiary, and local-only material. This phase inventories and indexes the corpus without relocating, deleting, deploying, mutating connected repositories, or creating a new goal, planning, runtime, or documentation authority.

</domain>

<decisions>
## Implementation Decisions

### Authority and Lifecycle Precedence
- **D-01:** Expand `docs/LIFECYCLE.md` as the single human authority-and-lifecycle map using the exact classes `canonical`, `derived`, `historical`, `evidentiary`, and `local-only`. Classification does not change authority: root `VISION.md` and `MISSION.md` own doctrine, root `ISA.md` owns approved goals and acceptance, live `.planning/STATE.md` owns the current finite transition, and contracts and runbooks own their bounded operating instructions.

### Corpus Inventory and Memory Boundary
- **D-02:** Produce one deterministic, read-only inventory covering the committed named root documents, `docs/`, and `.planning/`, and explicitly record that no tracked root `MEMORY/` directory exists at the reviewed source revision. Keep `docs/memory/` as the neutral product memory contract, classify ignored or provider-owned runtime memory as `local-only`, and treat the 2026-08-10 `docs/plans/` retention inventory as evidentiary input rather than the new corpus-wide lifecycle authority.

### Navigation Without Circular Authority
- **D-03:** Preserve additive navigation with distinct roles: `PROJECT.md` is the reviewed repository and pickup entry, `README.md` is the product discovery overlay, `docs/README.md` is the documentation index, `docs/doctrine/README.md` catalogs root doctrine, and `.planning/README.md` routes readers to live `.planning/STATE.md`. Indexes link directly to authoritative sources and never copy doctrine or mutable current status.

### Historical Evidence and Item-Level Exceptions
- **D-04:** Apply non-destructive, exception-aware classification. Dated plans and completed phase records remain recoverable historical or evidentiary material; generated Intent Graph and Temperance Flow readbacks are derived; ignored runtime memory is local-only; and current contracts, runbooks, ISA, and live GSD state retain bounded authority. Directory defaults cannot override explicit item exceptions such as indexed `docs/plans/product-branches/` packets. Callable-looking historical material receives visible non-operational classification without bulk rewriting, relocation, or deletion.

### the agent's Discretion
- Choose the smallest deterministic inventory schema, generator/check command, and matching human readback consistent with the Phase 4 and Phase 5 projection pattern.
- Choose concise lifecycle labels and index wording, provided every classification and navigation claim is source-backed and no index freezes mutable state.
- Prefer targeted labels or manifest exceptions over modifying historical evidence bodies.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Doctrine, acceptance, and repository entry
- `VISION.md` — Canonical enduring Just Cause.
- `MISSION.md` — Canonical renewable Repository Mission.
- `ISA.md` — Approved goals, acceptance, and verification source of record.
- `PROJECT.md` — Reviewed repository and pickup entry.
- `README.md` — Product-facing discovery overlay.

### Documentation lifecycle and navigation
- `docs/LIFECYCLE.md` — Existing authority and lifecycle map to extend.
- `docs/README.md` — Documentation discovery index.
- `docs/doctrine/README.md` — Root doctrine catalog and authority flow.
- `docs/plans/README.md` — Historical-plan default and active product-branch exception.
- `docs/evidence/README.md` — Immutable evidence contract.
- `docs/archive/README.md` — Archive and historical-recovery contract.
- `docs/memory/README.md` — Neutral committed memory boundary.
- `docs/memory/boundary.json` — Machine-readable memory-surface classification.

### Planning authority and current transition
- `.planning/PROJECT.md` — Milestone scope, constraints, and locked decisions.
- `.planning/ROADMAP.md` — Phase 6 goal, dependency, and success criteria.
- `.planning/REQUIREMENTS.md` — DOCS-01 through DOCS-04 acceptance requirements.
- `.planning/STATE.md` — Live finite planning transition.
- `.planning/README.md` — Planning discovery index requiring live-state delegation.

### Retention and prior-phase evidence
- `.planning/2026-08-10-documentation-retention-inventory.md` — Evidence-safe `docs/plans/` retention review.
- `.planning/2026-08-10-documentation-retention-manifest.v1.json` — Bounded retention-family manifest.
- `.planning/2026-08-10-documentation-retention-manifest.per-file.v1.json` — Per-file retention evidence.
- `.planning/phases/03-canonical-infinite-game-anchors/03-CONTEXT.md` — Locked anchor and non-destructive discoverability decisions.
- `.planning/phases/03-canonical-infinite-game-anchors/03-VERIFICATION.md` — Anchor verification evidence.
- `.planning/phases/05-ralph-and-temperance-flow-projection/05-CONTEXT.md` — Locked authority precedence and read-only projection decisions.
- `.planning/phases/05-ralph-and-temperance-flow-projection/05-VERIFICATION.md` — Flow verification evidence.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/LIFECYCLE.md` already separates doctrine, current instructions, evidence, and plans, and is the natural home for the complete five-class vocabulary.
- The 2026-08-10 retention inventory and manifests demonstrate deterministic, digest-bound, non-destructive inventory patterns for `docs/plans/`.
- Phase 4 and Phase 5 generators demonstrate one declared source model feeding matching deterministic machine and human readbacks while generated outputs remain read-only.

### Established Patterns
- Root doctrine, ISA acceptance, GSD finite planning, bounded operational contracts, and generated inspection surfaces remain separate authorities.
- Historical evidence is preserved rather than rewritten to represent current truth.
- Runtime state outranks copied prose; stale index text must be removed or replaced with a direct live-state reference.
- Directory-level lifecycle defaults permit explicit, source-backed item exceptions.

### Integration Points
- `PROJECT.md`, `README.md`, `docs/README.md`, `docs/doctrine/README.md`, and `.planning/README.md` form the maintainer navigation path.
- `docs/LIFECYCLE.md` supplies human classification; the new deterministic inventory supplies corpus-wide machine and human readback.
- `docs/memory/boundary.json` supplies the committed memory contract while the inventory records the absence of a tracked root `MEMORY/` surface.

</code_context>

<specifics>
## Specific Ideas

- Make live `.planning/STATE.md` outrank every copied status sentence; indexes should point, not summarize mutable status.
- Record the absence of root `MEMORY/` explicitly rather than inventing provenance or treating `docs/memory/` as a substitute.
- Keep exception handling visible so active proof-bound packets under a historically classified directory are not silently demoted.

</specifics>

<deferred>
## Deferred Ideas

- Approved relocation, archival, externalization, or deletion remains future work after the Phase 6 inventory is reviewed.
- Connected-repository inheritance and host/provider/runtime mutations remain outside this phase.

</deferred>

---

*Phase: 06-documentation-stewardship*
*Context gathered: 2026-08-20 via assumptions mode*
