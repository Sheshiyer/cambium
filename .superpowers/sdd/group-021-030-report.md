# Task Group 021-030 Report

Status: DONE_WITH_CONCERNS

## Implemented Tasks

- Task 021: `#progress` now declares a sheet interaction and opens a progress sheet with completed count, total count, source, and active quest id.
- Task 022: `#here` now declares a sheet interaction and opens a frontier sheet with current arc, quest title, and evidence.
- Task 023: every rendered `.q` quest row now includes `data-ecosystem-target="quine"`.
- Task 024: the quest detail sheet now includes source, status, arc, quest id, and evidence.
- Task 025: active quest detail sheets now include `next action source`, using the policy source when ready or an explicit `policy gap:` value when not ready.
- Task 026: the empty ledger state shows `quine write quests push --tenant cambium` and states that no quest rows are rendered until a real ledger arrives.
- Task 027: the unreachable ledger state names `/api/quests/cambium`, tells the operator to retry, and states that retry performs no local write.
- Task 028: the viewport proof manifest capture list now includes `quests-line-mobile.png` from `?scene=quests`; no live browser proof was run.
- Task 029: `.mapbadge` is now a sheet interaction that opens active arc, active organ, quest title, and `shared/cambium-visual-contract` source.
- Task 030: every `.rail` is now a sheet interaction with stable `data-rail` and opens a rail sheet with rail id, source, organs, lane, active arc, and active rail state.

## Files Changed

- `workers/quests/src/page.ts`
- `workers/quests/src/handler.test.ts`
- `workers/quests/src/visual-viewport-proof.mjs`
- `workers/quests/src/live-proof-readiness.test.ts`
- `.superpowers/sdd/group-021-030-report.md`

## Commands Run

- `node --test workers/quests/src/handler.test.ts workers/quests/src/live-proof-readiness.test.ts`
  - Result: pass, 110 tests passed, 0 failed.
- `git diff --check`
  - Result: pass, no whitespace errors.

## Test Results

- Added handler coverage for progress summary sheet, frontier sheet, quest row Quine targets, quest sheet provenance, empty ledger state, unreachable ledger state, map header sheet, and rail sheets.
- Updated pseudo-button interaction assertions so rendered rails are sheet interactions rather than read-only rows.
- Updated viewport manifest unit coverage so the manifest includes a quests-scene layout proof entry for `quests-line-mobile.png` from `?scene=quests`.

## Commits

- Grouped commit is created after this report file is written so the final worker response can report the resulting short SHA and subject.

## Concerns

- `workers/quests/src/mini-app-surface-contract.ts` still describes the `rails` subsection as read-only, but that file is outside this task group's allowed write set. The rendered page and allowed tests now treat rails as sheet interactions.
