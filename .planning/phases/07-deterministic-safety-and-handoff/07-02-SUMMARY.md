---
phase: 07-deterministic-safety-and-handoff
plan: 02
subsystem: deterministic-safety
tags: [node, cli, fail-closed-validation, tdd, npm-script, sha256]

requires:
  - phase: 07-deterministic-safety-and-handoff
    provides: SHA-bound compileDeterministicSafety / validateDeterministicSafetyReceipt compiler
provides:
  - closed --source-revision zero-write safety:check CLI
  - npm run --silent safety:check -- --source-revision REV dispatcher
  - adversarial parser, snapshot, fail-closed, and package-command tests
affects: [07-03-handoff]

tech-stack:
  added: []
  patterns: [closed argv --source-revision, safeDiagnostic redaction, ephemeral stdout receipt, fixture npm cwd when HEAD is not SAFE-clean]

key-files:
  created:
    - scripts/check-deterministic-safety.mjs
    - scripts/check-deterministic-safety.test.mjs
  modified:
    - package.json

key-decisions:
  - "The CLI is a closed adapter over compileDeterministicSafety; one command covers SAFE-01..03 with no write/output/fix mode."
  - "package.json scripts.safety:check equals node scripts/check-deterministic-safety.mjs with no hardcoded HEAD, SHA, or output path."
  - "Checkout HEAD still fails SAFE-03 freshness on the live Temperance selector; the npm assertion uses a contained clean fixture cwd."

patterns-established:
  - "Spawn the public binary with --root for fixtures; npm run --silent safety:check never embeds --root or a revision."
  - "On throw: redacted stderr, empty stdout, exitCode 1, unchanged files/modes/mtimes/index."

requirements-completed: [SAFE-01, SAFE-02, SAFE-03]

duration: 10min
completed: 2026-08-20
---

# Phase 7 Plan 2: Deterministic Safety Check CLI Summary

**Closed `--source-revision` `safety:check` CLI over `compileDeterministicSafety` with one SHA-bound receipt line and an npm dispatcher that never hardcodes HEAD**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-20T20:21:37Z
- **Completed:** 2026-08-20T20:31:39Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Exposed `scripts/check-deterministic-safety.mjs` as a zero-write adapter: `--source-revision` exactly once, optional absolute `--root`, unknown/write flags rejected before Git access.
- Successful stdout is exactly `deterministic safety check passed: <40-hex> sha256:<64-hex> entries=<N>`. Hits and malformed argv exit non-zero with empty stdout and redacted stderr.
- Added `package.json` `safety:check` as `node scripts/check-deterministic-safety.mjs` with no lockfile or production-dependency change.

## Task Commits

Each task was committed through its TDD gates:

1. **Task 1: Implement the zero-write safety:check CLI**
   - `f7167bb` — RED named CLI/parser/spawn/hostile-overlay suite (checker absent)
   - `69a964f` — GREEN closed CLI over `compileDeterministicSafety`
2. **Task 2: Add the caller-revision package command**
   - `d6c4e7f` — RED package dispatcher and lockfile assertions
   - `fbbc391` — GREEN `scripts.safety:check` node dispatcher

**Plan metadata:** pending this summary commit.

## Files Created/Modified

- `scripts/check-deterministic-safety.test.mjs` — parser, spawn, dirty-tree, fail-closed overlay, and package-command tests.
- `scripts/check-deterministic-safety.mjs` — `parseDeterministicSafetyCheckArguments`, `checkDeterministicSafety`, `runDeterministicSafetyCheckCli`, copied `safeDiagnostic`.
- `package.json` — `safety:check` only; `dependencies` remain empty; `docs:inventory:*` and `verify:release` untouched.

## Decisions Made

- Copy the inventory checker grammar, not inventory double-generation. The CLI never reimplements SAFE-01..03.
- Reject `--write`, `--output`, `--fix`, `--check`, `--format`, `--provider`, `--staged`, and `--index` as unknown or forbidden.
- When `compileDeterministicSafety` of this checkout SHA throws SAFE-03 freshness, npm is asserted from a temporary fixture whose cwd is the fixture root, using the real `scripts.safety:check` value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Split Unix-root literals in CLI stderr assertions**
- **Found during:** Task 1 (RED tests)
- **Issue:** A contiguous `/\/Users\/|\/Volumes\//` regex in a new Phase 7 path would itself contain T-07 privacy sentinels. 07-01 already split those roots.
- **Fix:** Assert `new RegExp(\`${unixUserRoot}|${unixVolumeRoot}\`)` with `['/', 'Users/'].join('')` / `['/', 'Volumes/'].join('')`. Behavior matches the plan's forbidden stderr shapes.
- **Files modified:** `scripts/check-deterministic-safety.test.mjs`
- **Verification:** focused CLI suite 7/7 after GREEN; compiler SAFE-0 suite still 27/27.
- **Committed in:** `f7167bb` (Task 1 RED)

---

**Total deviations:** 1 auto-fixed (1 privacy-literal split).
**Impact on plan:** Required for T-07 / T-06-22 path-union hygiene. No CLI, lockfile, or authority change.

## Issues Encountered

- Live checkout SHA still fails SAFE-03 freshness (`ISA.md#markdown.heading:Active Phase 5 acceptance` recorded by Temperance Flow while ISA now has Active Phase 7). The CLI correctly fail-closes on that SHA. Package `npm run --silent safety:check` is proven on a contained clean fixture, as the plan required. Regenerating Temperance Flow remains 07-03 / out of this write set.

## Verification Evidence

- `node --test scripts/check-deterministic-safety.test.mjs scripts/deterministic-safety.test.mjs` — 34/34 pass.
- `node -e "const p=require('./package.json'); if (p.scripts['safety:check']!=='node scripts/check-deterministic-safety.mjs') process.exit(1); if (p.dependencies && Object.keys(p.dependencies).length) process.exit(1);"` exits 0.
- `test -z "$(git diff --name-only -- package-lock.json pnpm-lock.yaml yarn.lock)"` succeeds.
- `rg -n "safety:check" scripts/verify-release.mjs` is empty.
- `rg -n "export function parseDeterministicSafetyCheckArguments" scripts/check-deterministic-safety.mjs` equals 1; `compileDeterministicSafety` is imported and called.

## Known Stubs

None.

## Authentication Gates

None.

## Threat Flags

None beyond the plan's T-07-01..T-07-07 register. The new CLI argv surface, redacted stderr, and package script were the mitigations assigned to this plan. No new network endpoints, auth paths, or schema writes at operational trust boundaries.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 07-03: reviewed HANDOFF checkpoint, ISA 4/4 closeout, and `/gsd:verify-work 7`.
- Public command: `npm run --silent safety:check -- --source-revision <REV>`.
- Relocation, deletion, wrangler upload, D1 CAS, Vectorize ingest, and tenant mint remain held.

## TDD Gate Compliance

- Task 1: RED `f7167bb` then GREEN `69a964f`.
- Task 2: RED `d6c4e7f` then GREEN `fbbc391`.

## Self-Check: PASSED

- Created files exist: `scripts/check-deterministic-safety.mjs`, `scripts/check-deterministic-safety.test.mjs`.
- `package.json` `scripts.safety:check` equals `node scripts/check-deterministic-safety.mjs`; production dependencies are empty.
- Commits exist: `f7167bb`, `69a964f`, `d6c4e7f`, `fbbc391`.

---
*Phase: 07-deterministic-safety-and-handoff*
*Completed: 2026-08-20*
