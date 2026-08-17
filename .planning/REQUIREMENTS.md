# Requirements: Cambium Infinite-Game Doctrine and Intent Graph

**Defined:** 2026-08-17
**Core Value:** An operator action counts only when its authoritative task, lease, artifact, outcome, and readback are durable and replay-safe.

## Milestone v0.4 Requirements

### Canonical Anchors

- [x] **ANCHOR-01**: A maintainer can read one canonical root `VISION.md` that states Cambium's enduring Just Cause, infinite-game commitments, and non-goals without prescribing a finite product endpoint.
- [x] **ANCHOR-02**: A maintainer can read one canonical root `MISSION.md` that states the current renewable mission, its horizon, evidence of progress, renewal triggers, and conditions for retirement or replacement.
- [x] **ANCHOR-03**: A maintainer can distinguish repository-level Mission from bounded `FabricMission` records through explicit naming, scope, inheritance, and authority rules.
- [x] **ANCHOR-04**: A maintainer can trace every normative vision and mission claim to its canonical anchor instead of encountering copied doctrine in generated or operational files.

### Intent Graph

- [ ] **GRAPH-01**: An operator can inspect a deterministic graph that maps vision → renewable mission → finite goals → tasks → evidence → learning with stable node and edge semantics.
- [ ] **GRAPH-02**: Every graph node exposes its source path, source authority, lifecycle state, and content digest so the projection preserves provenance.
- [ ] **GRAPH-03**: The graph represents inherited overlays as references to canonical root anchors and never as independent vision or mission authorities.
- [ ] **GRAPH-04**: Evidence and learning edges can close or renew finite goals without mutating the canonical vision or silently rewriting the mission.
- [ ] **GRAPH-05**: The graph explicitly represents approval gates, freshness, stop conditions, and blocked states without treating a blocked action as complete.

### Ralph and Temperance Flow

- [ ] **FLOW-01**: An operator can identify the exact next GSD command from current durable planning state, with no competing planner or invented third goal.
- [ ] **FLOW-02**: A fresh Ralph iteration can read durable goal, plan, task, evidence, and handoff state; select one dependency-ready unit; verify it; persist its outcome; and stop at an external completion condition.
- [ ] **FLOW-03**: An operator can inspect the selected skill-cluster route and OmniRoute combo for a task, including provider attribution and the boundary between native orchestration and paid execution.
- [ ] **FLOW-04**: A generated manifest exposes references, digests, routes, next actions, gates, freshness, and stop conditions without copying doctrine or becoming an operational writer.

### Documentation Stewardship

- [ ] **DOCS-01**: A maintainer can use one authority and lifecycle map to determine which root, `docs/`, `MEMORY/`, and planning documents are canonical, derived, historical, evidentiary, or local-only.
- [ ] **DOCS-02**: The named doctrine corpus is inventoried with provenance, present purpose, overlap, recommended disposition, and links to canonical anchors before any relocation or deletion.
- [ ] **DOCS-03**: Root and documentation indexes lead maintainers from vision and mission through architecture, operating doctrine, lifecycle, evidence, and current GSD next steps without circular authority.
- [ ] **DOCS-04**: Historical evidence remains recoverable and clearly labeled while stale plans and memory artifacts cannot masquerade as current instructions.

### Safety and Verification

- [ ] **SAFE-01**: Deterministic validation fails when canonical vision or mission doctrine is duplicated outside its allowed anchors.
- [ ] **SAFE-02**: Deterministic validation fails when a manifest, Ralph state file, generated graph, or documentation overlay claims goal-setting or planning authority.
- [ ] **SAFE-03**: Deterministic validation fails when generated projections are stale relative to their source digests or contain secrets, session identifiers, prompt bodies, or machine-local absolute paths.
- [ ] **SAFE-04**: A reviewed handoff records the bounded write set, verification evidence, unresolved approval boundaries, and the exact next GSD command.

## Future Requirements

- **FUTURE-01**: Project overlays in connected repositories inherit Cambium's canonical anchors through pinned, repository-specific contracts.
- **FUTURE-02**: The intent graph incorporates authenticated runtime and deployment evidence from external repositories and providers.
- **FUTURE-03**: Maintainers can perform approved document relocation or archival after the inventory has been reviewed.

## Out of Scope

| Capability | Reason |
|------------|--------|
| D1, Cloudflare, Telegram, Hermes, provider, or deployment mutation | Runtime and production writes remain separately owner-approved and rollback-gated. |
| Mutating connected repositories | This milestone establishes Cambium's canonical contract before consumer repositories inherit it. |
| Replacing ISA, GSD, Goal Graph, or existing runtime authorities | The work clarifies and projects authority; it does not create another writer. |
| Wholesale document movement or deletion | Inventory and lifecycle classification must be reviewed before destructive reorganization. |
| Copying Thoughtseed vault notes or private seed corpora | The vault is referenced knowledge and never a repository runtime dependency. |
| Executing unrelated Mini App or runtime backlog | v0.4 is bounded to doctrine, graph, flow projection, documentation stewardship, and validation. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ANCHOR-01 | Phase 3 | Complete |
| ANCHOR-02 | Phase 3 | Complete |
| ANCHOR-03 | Phase 3 | Complete |
| ANCHOR-04 | Phase 3 | Complete |
| GRAPH-01 | Phase 4 | Pending |
| GRAPH-02 | Phase 4 | Pending |
| GRAPH-03 | Phase 4 | Pending |
| GRAPH-04 | Phase 4 | Pending |
| GRAPH-05 | Phase 4 | Pending |
| FLOW-01 | Phase 5 | Pending |
| FLOW-02 | Phase 5 | Pending |
| FLOW-03 | Phase 5 | Pending |
| FLOW-04 | Phase 5 | Pending |
| DOCS-01 | Phase 6 | Pending |
| DOCS-02 | Phase 6 | Pending |
| DOCS-03 | Phase 6 | Pending |
| DOCS-04 | Phase 6 | Pending |
| SAFE-01 | Phase 7 | Pending |
| SAFE-02 | Phase 7 | Pending |
| SAFE-03 | Phase 7 | Pending |
| SAFE-04 | Phase 7 | Pending |

**Coverage:** 21/21 mapped ✓

---
*Requirements defined: 2026-08-17*
*Last updated: 2026-08-18 after v0.4 roadmap creation*
