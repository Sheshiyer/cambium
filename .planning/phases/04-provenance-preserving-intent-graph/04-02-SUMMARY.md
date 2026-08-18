---
phase: 04-provenance-preserving-intent-graph
plan: 02
subsystem: architecture
tags: [intent-graph, provenance, deterministic-generation, read-only-projection, node-test]

requires:
  - phase: 04-provenance-preserving-intent-graph/04-01
    provides: Pure content-addressed compiler, closed selectors, and read-only Markdown renderer
provides:
  - Single repository source model for Vision through verified learning
  - Byte-stable JSON and Markdown intent-graph readbacks
  - Read-only stale-source, stale-output, missing-source, and parity checks
affects: [04-03-phase-closeout, phase-5-flow-projection, documentation-discovery]

tech-stack:
  added: []
  patterns: [node-builtins-only generator, atomic contained writes, exact selector digests, shared-object dual rendering]

key-files:
  created:
    - scripts/generate-intent-graph.test.mjs
    - scripts/intent-graph-sources.mjs
    - scripts/generate-intent-graph.mjs
    - docs/architecture/intent-graph.v1.json
    - docs/architecture/intent-graph.md
  modified: []

key-decisions:
  - "One declared repository source model feeds one compiler invocation and both committed readbacks."
  - "D1 Goal Graph remains the sole operational writer; generated intent-graph outputs remain read_only projections."
  - "Mutable Roadmap and ISA tracking fields are excluded while exact Phase Goal, ISA task, and reviewed-decision selectors remain content-addressed."

patterns-established:
  - "Contained output: absolute or relative output paths are canonicalized through existing ancestors and rejected outside the real repository root."
  - "Actionable drift: stale checks name both generated artifacts and any changed repository path/selector tuple."

requirements-completed: [GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04, GRAPH-05]

duration: 9min
completed: 2026-08-18
---

# Phase 4 Plan 2: Canonical Intent-Graph Readbacks Summary

**A single source declaration now compiles 19 provenance-bound nodes and 25 labeled edges into byte-identical-current JSON and Markdown readbacks with fail-closed stale checks.**

## Performance

- **Duration:** 9 minutes
- **Started:** 2026-08-18T05:04:11Z
- **Completed:** 2026-08-18T05:12:43Z
- **Tasks:** 2
- **Files modified:** 5 implementation/test/readback files plus this summary and GSD progress artifacts

## Accomplishments

- Declared the complete Vision → Mission → finite goals → plan tasks → Phase 3 evidence → verified learning → reviewed ISA gate chain without copying source bodies or accepting generated foldback.
- Generated matching machine and human projections from the same validated object with deterministic ordering, canonical digests, contained atomic writes, and zero-write checks.
- Proved Roadmap checkbox/status and ISA phase/progress/updated changes do not perturb intent, while selected Phase Goal or ISA task changes fail stale with exact path/selector diagnostics.
- Preserved the doctrine, ISA, GSD, D1 Goal Graph, runtime, provider, package, deployment, and connected-repository authority boundaries.

## Task Commits

Each task was committed atomically:

1. **Task 1: Commit the RED generator and readback-parity contract** — `20f5a61` (`test`)
2. **Task 2: Generate the canonical repository projection and matching readback** — `976854a` (`feat`)

## Projection Receipt

- **Graph digest:** `sha256:e307dece6e2a47b3b9700a34b529fa0309d91e6757ba9992f7e9d0f0358aea45`
- **Source-set digest:** `sha256:9959596e0a3aab54b8244524172dadc210a1563ae98cd572a379f1455bfe465a`
- **Nodes:** 19
- **Edges:** 25
- **Projection authority:** `read_only`

Exact selected source paths:

- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/phases/03-canonical-infinite-game-anchors/03-01-PLAN.md`
- `.planning/phases/03-canonical-infinite-game-anchors/03-02-PLAN.md`
- `.planning/phases/03-canonical-infinite-game-anchors/03-VERIFICATION.md`
- `.planning/phases/04-provenance-preserving-intent-graph/04-01-PLAN.md`
- `.planning/phases/04-provenance-preserving-intent-graph/04-02-PLAN.md`
- `.planning/phases/04-provenance-preserving-intent-graph/04-03-PLAN.md`
- `ISA.md`
- `MISSION.md`
- `PROJECT.md`
- `VISION.md`

## Files Created/Modified

- `scripts/generate-intent-graph.test.mjs` — real-root and temporary-root generator, parity, stale-output, stale-source, privacy, exclusion, and source-preservation contract.
- `scripts/intent-graph-sources.mjs` — one closed source declaration plus explicit D1/intent-projection authority registry.
- `scripts/generate-intent-graph.mjs` — deterministic `--write`, `--check`, and JSON-only stdout CLI with contained atomic outputs.
- `docs/architecture/intent-graph.v1.json` — canonical machine-readable read-only projection.
- `docs/architecture/intent-graph.md` — canonical human readback rendered from the same compiled object.

## Verification Evidence

- Required RED gate: **10 named semantic failures**, with no `SyntaxError`, `ERR_MODULE_NOT_FOUND`, `ENOENT`, or missing-file exception.
- `node scripts/generate-intent-graph.mjs --check` twice: **PASS**.
- Focused compiler/generator suite: **22/22 passed**.
- Canonical anchor suite: **5/5 passed**.
- Complete `npm test`: **1808/1808 passed**.
- Selector-mutation, stale-output, missing-source, source-preservation, output-containment, forbidden-source, privacy, and JSON/Markdown parity probes: **PASS**.
- Plan 04-02 boundary contains no Vision, Mission, ISA, Roadmap, State, package, lockfile, Worker, D1, provider, deployment, `.temperance`, or connected-repository change.

## Decisions Made

- The repository source model carries stable semantic keys only until compilation; committed node and edge IDs remain compiler-derived from source semantics.
- Complete Phase 3 plan tasks share the exact verified Probe Execution evidence node, which alone closes Phase 3 and produces the verified Gaps Summary learning signal.
- The reviewed ISA decision remains blocked and approval-required inside the projection because execution approval is external evidence and this generated source model cannot write it.
- Overlay nodes select bounded sections of `PROJECT.md` and `.planning/PROJECT.md`, then reference full-file canonical anchor digests without storing anchor prose.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Output containment bug] Canonicalized symlinked temporary-root paths**

- **Found during:** Task 2 GREEN focused tests
- **Issue:** Absolute outputs inside a temporary repository were compared lexically against its realpath, so macOS temporary-directory aliases were incorrectly rejected as external.
- **Fix:** Reconstructed the candidate path from the nearest existing ancestor's realpath before applying the repository containment boundary.
- **Files modified:** `scripts/generate-intent-graph.mjs`
- **Verification:** Temporary-root write/idempotence/check tests and external-output rejection both pass.
- **Committed in:** `976854a`

**2. [Rule 1 - Missing-source diagnostic bug] Replaced raw filesystem errors with bounded provenance diagnostics**

- **Found during:** Task 2 GREEN focused tests
- **Issue:** A deleted declared source surfaced a raw `ENOENT` path instead of the required repository-relative path and selector.
- **Fix:** The source resolver now reports `source <path>#<selector> is missing` and fails closed before compilation.
- **Files modified:** `scripts/intent-graph-sources.mjs`
- **Verification:** Missing-source integration test passes and reports the exact Phase 3 verification path.
- **Committed in:** `976854a`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 correctness bugs)
**Impact on plan:** Both fixes enforce the planned containment and diagnostic contracts without adding scope.

## Issues Encountered

- A first post-commit scope probe compared the entire Phase 4 branch to `origin/main`, so it correctly included Plan 04-01 planning-state changes. Re-running the same forbidden-path assertion across exact Plan 04-02 boundary `79c44bd..976854a` passed.

## User Setup Required

None — no dependency, service, credential, provider, or deployment configuration was added.

## Next Phase Readiness

- Plan 04-03 can publish discovery links, distinguish the generated projection from the D1 Goal Graph, close ISA criteria from committed evidence, and run Phase 4 completion gates.
- This summary does not claim Phase 4 complete. The next dependency-safe plan is `04-03-PLAN.md`.

## Self-Check: PASSED

All five created implementation/readback files and this summary exist. Commits `20f5a61ee325af828dfad891b46009f102cedce6` and `976854a21286343680d0df631ba4ea85ef000121` resolve as repository commits, and the committed generator reports both readbacks current.

---
*Phase: 04-provenance-preserving-intent-graph*
*Completed: 2026-08-18*
