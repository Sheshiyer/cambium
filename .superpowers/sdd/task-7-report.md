# Task 7 Report: Mini App Loop Visibility

## What I Implemented

- Added a new Mission Control page test covering manual-first branch loop visibility and loop-sheet focus behavior in `workers/quests/src/handler.test.ts`.
- Added the `branch-loops` ecosystem target and subsection contract entry in `workers/quests/src/mini-app-surface-contract.ts`.
- Updated `workers/quests/src/page.ts` to:
  - read branch loop rows from `visual.branchLoops`,
  - merge them with branch-local `loops` metadata for sheet narrative continuity,
  - render a founder-visible `BranchLoopControls` block in Mission Control,
  - route the loop button into the existing branch mission sheet with a `loops` focus,
  - keep copy manual-first and avoid any autonomous scheduling language.

## TDD RED/GREEN Evidence

### RED

Command:

```bash
node --test workers/quests/src/handler.test.ts --test-name-pattern "branch loop controls"
```

Result:

- Failed as expected before page implementation.
- Initial failure showed Mission Control was not yet exposing the loop controls content required by the new test.

### GREEN

Command:

```bash
node --test workers/quests/src/handler.test.ts --test-name-pattern "branch loop controls"
```

Result:

- Passed after the Mission Control rendering, surface-contract, and sheet-focus changes landed.

## Tests and Results

1. `node --test workers/quests/src/handler.test.ts --test-name-pattern "branch loop controls"`
   - PASS
2. `node --test workers/quests/src/handler.test.ts --test-name-pattern "surface contract|Mission scene renders branch arcs|builds Mission Control view from branchStories"`
   - PASS
3. `npm test`
   - PASS (`653` tests passed, `0` failed)

## Files Changed

- `workers/quests/src/handler.test.ts`
- `workers/quests/src/mini-app-surface-contract.ts`
- `workers/quests/src/page.ts`

## Self-Review Findings

- Mission Control now surfaces loop state as visibility-only founder context, not as autonomous execution.
- The loop CTA reuses the existing branch sheet interaction path, so page behavior stays aligned with the current interaction model.
- The rendered copy prefers loop titles over slug ids where available, which reads better in the mini app while preserving exact run-mode and cadence detail.
- No new dependencies were added.

## Concerns

- No functional concerns from the implemented scope.
- The original brief’s sample test targeted `mapwrap`; in this codebase the Mission Control loop UI lives on the Mission scene (`stem`), so the final test was adjusted to assert against the correct rendered surface while preserving the intended manual-first behavior check.

## Fix Report Addendum

### Review Fixes Applied

- Switched the branch-local fallback contract path from `branch.loops` to `branch.controls.loops` first, with `branch.loops` retained only as a compatibility fallback.
- Added derived manual-first `runMode` mapping for fallback rows that do not provide it:
  - `green -> read-only`
  - `yellow -> approval-required`
  - `red -> never-alone`
  - default -> `approval-required`
- Normalized fallback loop rows before rendering so Mission Control does not emit `undefined` when `visual.branchLoops` is absent or partial.
- Updated the Task 7 fixture so the branch-local data lives in `controls.loops`, matching the declared interface.

### Additional Coverage Added

- The main Task 7 Mission Control test now exercises `controls.loops`.
- Added fallback coverage proving Mission Control still renders manual-first loop status from `branch.controls.loops` when top-level `visual.branchLoops` is absent, and that the rendered UI does not contain `undefined`.

### Fix Verification

1. `node --test workers/quests/src/handler.test.ts --test-name-pattern "branch loop controls"`
   - PASS
2. `node --test workers/quests/src/handler.test.ts --test-name-pattern "surface contract|Mission scene renders branch arcs|builds Mission Control view from branchStories"`
   - PASS
3. `npm test`
   - PASS (`653` passed, `0` failed)

## Re-Review Fix Report Addendum

### Re-Review Fixes Applied

- Added `branch-loops` to the canonical `MINI_APP_MAP_SUBSECTION_IDS` inventory so the subsection registry and subsection definitions now agree.
- Changed the loop-sheet narrative to use the same normalized merged loop rows as the Mission Control card, so visual-only `branchLoops` rows still populate the sheet when branch-local loop arrays are absent.
- Hardened `mcLoopRunMode()` so only founder-safe values can render:
  - `read-only`
  - `approval-required`
  - `never-alone`
- Any other upstream run mode value now falls back to a safe manual-first value derived from `boundaryColor`, preventing `scheduled` or `autonomous` from becoming visible UI copy.

### Re-Review Coverage Added

- Surface-contract inventory coverage now asserts `branch-loops` is present in both the canonical subsection id list and the subsection records.
- Added a visual-only loop-row test proving the card renders and the loop sheet does not fall back to `loop controls missing`.
- Added a run-mode sanitization test proving unsafe top-level `scheduled`/`autonomous` values do not render and instead map to safe manual-first labels.

### Re-Review Verification

1. `node --test workers/quests/src/handler.test.ts --test-name-pattern "branch loop controls"`
   - PASS
2. `node --test workers/quests/src/handler.test.ts --test-name-pattern "surface contract|Mission scene renders branch arcs|builds Mission Control view from branchStories"`
   - PASS
3. `npm test`
   - PASS (`654` passed, `0` failed)
