---
phase: 04-provenance-preserving-intent-graph
plan: 01
subsystem: architecture
tags: [intent-graph, provenance, sha256, node-test, read-only-projection]

requires:
  - phase: 03-canonical-infinite-game-anchors
    provides: Canonical root Vision and renewable Repository Mission with explicit authority boundaries
provides:
  - Pure content-addressed intent-graph compiler and projection validator
  - Closed selector, provenance, lifecycle, state, and edge-direction contracts
  - Read-only Markdown renderer and human architecture contract
affects: [04-02-intent-graph-readbacks, 04-03-phase-closeout, phase-5-flow-projection]

tech-stack:
  added: []
  patterns: [node-builtins-only compiler, exact source selectors, canonical JSON hashing, realpath containment]

key-files:
  created:
    - scripts/intent-graph.test.mjs
    - scripts/intent-graph.mjs
    - docs/architecture/contracts/intent-graph-v1.md
  modified: []

key-decisions:
  - "Node identity binds kind, repository-relative path, selector, and authority while the source digest carries mutable revision."
  - "Overlay anchor references use full-file root-anchor digests while intent nodes may select exact doctrine sections."
  - "The intent projection remains read_only and rejects both intent and D1 Goal Graph projection foldback."

patterns-established:
  - "Exact selectors: source content is hashed only after a closed selector resolves exactly once."
  - "Fail-closed validation: unsafe paths, authority drift, invalid relations, stale digests, and contradictory state never compile."

requirements-completed: [GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04, GRAPH-05]

duration: 18min
completed: 2026-08-18
---

# Phase 4 Plan 1: Provenance-Preserving Intent Graph Contract Summary

**A pure Node-built-in compiler now produces deterministic read-only intent projections with exact provenance, closed graph semantics, and fail-closed authority boundaries.**

## Performance

- **Duration:** 18 minutes
- **Started:** 2026-08-18T04:35:20Z
- **Completed:** 2026-08-18T04:53:47Z
- **Tasks:** 2
- **Files modified:** 3 implementation/contract files plus this summary

## Accomplishments

- Committed one adversarial RED boundary mapping GRAPH-01 through GRAPH-05 to ISC-1277 through ISC-1281, including all ten allowed relation rows, projection foldback, selector stability, exclusions, and source preservation.
- Implemented deterministic node/edge identity, canonical source-set and graph digests, realpath containment, six exact selector forms, complete state validation, overlay-only anchor references, and typed evidence/learning transitions.
- Documented the distinction between the read-only intent projection, root doctrine anchors, ISA/GSD authorities, and the D1 Goal Graph as sole operational writer.
- Kept compilation and rendering read-only: no package, lockfile, Worker, D1, Telegram, provider, deployment, connected-repository, or generated projection mutation occurred.

## Task Commits

Each task was committed atomically:

1. **Task 1: Commit the RED adversarial intent-graph contract** — `66bd34e` (`test`)
2. **Task 2: Implement the pure compiler and authority contract** — `f13773f` (`feat`)

The initial RED proof failed through named GRAPH assertions because the compiler was absent and contained none of `SyntaxError`, `ERR_MODULE_NOT_FOUND`, `ENOENT`, or missing-file failures. After the test-fixture consistency repair, the committed test-only archive was executed without the implementation and re-proved the same semantic RED gate before GREEN.

## Public Exports

The implementation exports the required public boundary:

- `INTENT_GRAPH_SCHEMA`
- `compileIntentGraph`
- `validateIntentGraphProjection`
- `renderIntentGraphMarkdown`

It also exports the closed node-kind, source-authority, lifecycle, completion, approval, freshness, stop-condition, edge-kind, and direction-matrix constants under both explicit `INTENT_GRAPH_*` names and concise aliases for Plan 04-02 source-model authors.

## Files Created/Modified

- `scripts/intent-graph.test.mjs` — real temporary-repository and adversarial semantic contract using Node built-ins only.
- `scripts/intent-graph.mjs` — pure compiler, validator, closed selector engine, canonical digester, and Markdown renderer.
- `docs/architecture/contracts/intent-graph-v1.md` — human authority, provenance, edge, overlay, foldback, and state contract.

## Verification Evidence

- Prerequisite `node --test scripts/infinite-game-anchors.test.mjs`: **5/5 passed** before RED and after GREEN; the file remained byte-untouched.
- RED archive gate: **failed semantically as required**, with named GRAPH assertions and no syntax/module/missing-file failure.
- Focused `node --test scripts/intent-graph.test.mjs`: **12/12 passed**.
- Combined anchor and intent command: **17/17 passed**.
- Full `npm test`: **1798/1798 passed**.
- Required export import probe: **passed**.
- `git diff --check` for compiler and contract: **passed**.
- Vision, Mission, ISA, Roadmap, State, package manifests, lockfiles, Worker, D1, and generated readback paths: **no diff**.

## Threat Mitigations

| Threat | Mitigation delivered |
| --- | --- |
| T-04-01 authority spoofing | Closed kind/authority mappings plus exact root overlay targets and digest validation. |
| T-04-02 path or digest tampering | Repository-relative normalization, realpath containment, exact selectors, canonical UTF-8/LF hashing, and deterministic IDs/order. |
| T-04-03 transition repudiation | Source-backed typed edges with stable identities and an entire-projection graph digest. |
| T-04-04 source disclosure | Output contains paths, selectors, state facts, and digests only; renderer never emits selected source bodies. |
| T-04-05 unbounded or invalid topology | Bounded arrays, unique semantic IDs, endpoint/self-edge checks, and the closed ten-row direction matrix. |
| T-04-06 projection foldback or false completion | Both projection schemas are rejected as fresh authority; blocked/satisfied, stale/satisfied, and approval contradictions fail closed. |
| T-04-SC supply chain | No dependency or manifest change; implementation imports Node crypto, fs, and path only. |

## Decisions Made

- Mutable selected content changes its digest and graph digest but not a node's semantic identity; this permits stable references without hiding revision.
- Overlay references carry full canonical anchor digests because the referenced authority is the entire root anchor, while the vision/mission intent nodes may select exact sections.
- Closed/renewal relations remain read-only graph facts. Only an ISA-sourced gate may represent renewal, and learning never exercises ISA authority.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test fixture bug] Kept duplicate source declarations digest-consistent during selector mutation**

- **Found during:** Task 2 GREEN run
- **Issue:** The Roadmap Goal mutation refreshed the node's declared digest but left the edge declaring the same path/selector on the old digest, so the fixture represented internally inconsistent provenance.
- **Fix:** Refreshed both declarations from one hand-derived literal digest; no semantic assertion was weakened or removed.
- **Files modified:** `scripts/intent-graph.test.mjs`
- **Verification:** Re-ran the amended test-only commit from an archive without the compiler to prove semantic RED, then passed focused and full GREEN gates.
- **Committed in:** `66bd34e`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 test-fixture bug)
**Impact on plan:** The repair strengthened the planned inconsistent-digest rejection and added no scope.

## Issues Encountered

- The assigned linked worktree initially used a branch name rejected by the mandatory executor commit guard. The orchestrator renamed it to the permitted `worktree-agent-*` namespace before any edit or commit.
- The first GREEN run correctly rejected overlay reference edges because node section digests differ from full-root anchor reference digests. Validation was corrected to bind the edge to the declared canonical anchor path while the separately verified full-file anchor digest remains authoritative.

## User Setup Required

None — no dependency, service, credential, provider, or deployment configuration was added.

## Next Phase Readiness

Plan 04-02 can now declare one repository source model against the committed compiler exports and generate deterministic JSON/Markdown readbacks. This summary does not claim Phase 4 complete; Plans 04-02 and 04-03 remain pending and dependency-ordered.

## Self-Check: PASSED

All three created contract files and this summary exist, and commits `66bd34e` and `f13773f` resolve as repository commits.

## Base-Sync Reconciliation

PR #350 (`36087111d48bf298443fc427eb32baad6bed11bd`) became the new `main` base after this plan completed. The isolated Phase 4 branch was rebased onto that squash merge; `git range-diff` mapped the original task commits `080793b` and `d7c4958` patch-equivalently to `66bd34e` and `f13773f`. PR #350 changed only disjoint Portfolio skill-repository resolution paths, so no Plan 04-01 acceptance claim or authority boundary changed.

---
*Phase: 04-provenance-preserving-intent-graph*
*Completed: 2026-08-18*
