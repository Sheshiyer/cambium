# Fitcheck release handoff — 2026-08-11

## Current state

- Isolated candidate worktree: `/tmp/cambium-fitcheck-release.aTYxcV`.
- Candidate branch: `codex/fitcheck-quests-release-candidate` at `c185e18788733c991cc9bf20866598ae4384ca02` before the uncommitted sidecar slice.
- The legacy Mini App shell is byte-pinned and must remain unchanged. Its pinned digest test passes.
- A previous canonical proof succeeded with 47 unique paths, but the sidecar changes the served page; regenerate canonical viewport evidence after committing the sidecar.

## Completed in the uncommitted sidecar slice

- Added a closed, bounded Fitcheck operational-state sidecar derived only from the exact stored Branch Story identity (`branchId: fitcheck`, `canonicalWorkId: sapling:fitcheck`).
- Handler emits it only for founder portfolio detail. It is read-only and does not enter Mission Fabric nodes, Goal Graph truth, D1, or write paths.
- Client rejects absent or malformed sidecar data and renders nothing in that case; valid state appears only after authenticated Operating Fabric activation.
- Focused verification passed: 246 tests and `git diff --check`.

## Next session sequence

1. Review `git -C /tmp/cambium-fitcheck-release.aTYxcV diff` and commit only the sidecar files into the candidate.
2. Run the canonical viewport capture in that clean candidate; require a 47-row manifest whose page digest matches the candidate.
3. Run `npm run verify:release`. The inherited `docs/project-management/project-intake-workflows.v1.json` prerequisite still needs its own baseline commit if the full verifier requires it.
4. Only after all deterministic gates pass, follow `workers/quests/DEPLOY.md` using version upload/deploy with captured rollback baseline. No production action has occurred.

## Non-negotiable boundaries

- Do not alter the `LEGACY_PAGE` digest or weaken its test.
- Do not render packet text as runtime quest state.
- Do not expose this founder-only state to aggregate/non-founder viewers.
- Do not deploy, write provider state, or change traffic without a fresh preflight and rollback proof.
