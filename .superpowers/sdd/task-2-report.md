# Task 2 Report: Validator Loop Guards

## What I implemented

Updated `scripts/validate-product-branch-packets.mjs` to fail closed on the new `Loop Control Inputs` table.

The validator now checks:
- `boundary_color` is one of `green`, `yellow`, or `red`
- `state_file` starts with `.operator/branch-loops/`
- `state_file` does not contain `..` or `\`
- `one_change_rule` includes the phrase `exactly one`
- `stop_rule` includes `stop`

The new loop-row validation is called from `validatePacket()` immediately after the existing control-table checks.

## Tests and results

### TDD RED evidence

Before editing the validator, I ran the invalid-boundary fixture command from the brief.

Result:
- `validated 4 product branch packet(s) against cambium.product_branch_packet.v1`

That confirmed the validator still passed the malformed `blue` boundary row before implementation.

### TDD GREEN evidence

After the change:

- Invalid boundary fixture: failed with `has invalid boundary_color "blue"`
- Unsafe state-file fixture: failed with `has unsafe state_file "../fitcheck-loop.md"`
- `npm run validate:product-branches`: passed
- `npm test`: passed

## Files changed

- `scripts/validate-product-branch-packets.mjs`
- `.superpowers/sdd/task-2-report.md`

## Self-review findings

- The helper is narrowly scoped to the packet validator and does not introduce new dependencies.
- The failure messages are specific enough for the requested fixtures and remain fail-closed.
- The state-file guard is strict about traversal and backslashes, which is appropriate for the loop-state path contract.

## Concerns

None at this time.

## Review Fix Addendum

Implemented the review findings by tightening `validateLoopControlRows()` in `scripts/validate-product-branch-packets.mjs`.

What changed:
- Added a required-field check for every loop row across `loop_id`, `title`, `cadence`, `objective`, `metric`, `boundary_color`, `one_change_rule`, `state_file`, `stop_rule`, `model_route`, and `proof_required`
- Switched `boundary_color` validation to the trimmed raw literal, accepting only exact lowercase `green`, `yellow`, or `red`
- Strengthened `one_change_rule` to require `exactly one`, one of the task-specified action words, and no batching language such as `multiple`, `several`, `batch`, or `all gates`

Evidence from coverage runs:
- Blank required loop field fails: `Loop Control Inputs row 1 missing required loop field(s): proof_required`
- `Green` boundary fails: `Loop Control Inputs row 1 has invalid boundary_color "Green"`
- Batching-style one_change_rule fails: `Loop Control Inputs row 1 one_change_rule must not suggest batching`
- `npm run validate:product-branches`: passed
- `npm test`: passed

## Review Fix Addendum 2

Removed the hard-coded action-word allowlist from `one_change_rule` validation and replaced it with a focused fail-closed guard for second-count / batching phrasing only.

What changed:
- Added explicit rejection for `and one`, `and exactly one`, `plus`, `then also`, `also select/choose/record/write/draft/create/return/run`, `then select/choose/record/write/draft/create/return/run`, plus `multiple`, `several`, `batch`, and `all gates`
- Kept valid coordinating text such as `and keep ... approval-gated`, `and never execute ...`, and `and write only the finding to .operator/branch-loops/...`
- Removed the prior action-word allowlist so future valid rules like `Select exactly one remediation` are not blocked

Evidence from coverage runs:
- `Select exactly one gate and one approval request` fails: `Loop Control Inputs row 1 one_change_rule must not suggest batching`
- `Select exactly one remediation` passes the one-change-rule check when the rest of the row remains valid
- `npm run validate:product-branches`: passed
- `npm test`: passed

## Review Fix Addendum 3

Added a targeted request/decision second-action guard so decision-request batching is rejected only when it is appended as a second action.

What changed:
- Rejected added-action phrasing like `then request`, `also request`, `and request`, `then decide`, `also decide`, `and decide`, `then approve`, `also approve`, `and approve`
- Rejected added-action `request one decision` and `one decision request` when they follow an `exactly one` rule
- Kept standalone `Select exactly one decision request.` valid

Evidence from coverage runs:
- `Select exactly one remediation, then request one decision` fails: `Loop Control Inputs row 1 one_change_rule must not suggest batching`
- `Select exactly one decision request.` passes when the rest of the row is valid
- `npm run validate:product-branches`: passed
- `npm test`: passed

## Review Fix Addendum 4

Replaced the narrow verb denylist with a structural connector rule that looks only at the text after the first `exactly one`.

What changed:
- Rejects repeated `exactly one`
- Rejects follow-on connectors `plus`, `then`, and `also`
- Rejects `and ...` clauses after the chosen item unless they are the contract-allowed guardrails `and keep`, `and never`, or `and write only`
- Continues rejecting broad batching words `multiple`, `several`, `batch`, and `all gates`

Evidence from coverage runs:
- `Select exactly one gate and file a founder approval request.` fails
- `Select exactly one gate, then escalate another blocker.` fails
- `Select exactly one remediation, then request one decision.` fails
- `Select exactly one decision request.` passes when the rest of the row is valid
- Current packet rows, including `and keep ...`, `and never ...`, and `and write only ...`, still pass
- `npm run validate:product-branches`: passed
- `npm test`: passed

## Review Fix Addendum 5

Added automated regression coverage for the validator logic and wired it into `npm test`.

What changed:
- Added `scripts/validate-product-branch-packets.test.mjs` with focused node:test coverage for the validator
- Updated `package.json` test script to include `scripts/*.test.mjs`
- Covered uppercase boundary, blank required field, unsafe state file, punctuation-separated follow-on actions, standalone decision request pass, and current packet validation

Evidence from coverage runs:
- Focused validator test command `node --test scripts/validate-product-branch-packets.test.mjs`: passed
- `npm run validate:product-branches`: passed
- `npm test`: passed

## Review Fix Addendum 6

Closed the remaining punctuation and guardrail bypasses in `one_change_rule`.

What changed:
- Rejected comma-separated second actions like `Select exactly one gate, file a founder approval request.`
- Rejected guardrail-clause follow-ons like `Select exactly one claim and write only the finding to .operator/branch-loops/demo.md; request one decision.`
- Kept existing valid enumerations and current packet rows passing

Evidence from coverage runs:
- `Select exactly one gate, file a founder approval request.` fails
- `Select exactly one claim and write only the finding to .operator/branch-loops/demo.md; request one decision.` fails
- `node --test scripts/validate-product-branch-packets.test.mjs`: passed
- `npm run validate:product-branches`: passed
- `npm test`: passed

## Review Fix Addendum 7

Replaced the comma bypass handling with an allowlist-shaped clause split that matches the packet contract.

What changed:
- Split `one_change_rule` after the first `exactly one` into a selected-item clause and optional guardrail clause
- Allowed commas only in explicit `exactly one of A, B, or C` / `exactly one of A, B or C` enumeration shapes
- Kept `and keep`, `and never`, and `and write only` as the only allowed guardrail clause starters
- Kept path dots in `.operator/...` intact when they are part of the value, not sentence punctuation

Evidence from coverage runs:
- `Select exactly one gate, one approval request.` fails
- `Select exactly one gate, submit a founder approval request.` fails
- Focused validator test command `node --test scripts/validate-product-branch-packets.test.mjs`: passed
- `npm run validate:product-branches`: passed
- `npm test`: passed

## Review Fix Addendum 8

Replaced the remaining `exactly one of ...` enumeration handling with a stricter single-clause grammar.

What changed:
- `one_change_rule` now parses only the text after the first `exactly one`
- The remainder rejects sentence-separator punctuation `;`, `:`, and `. `, while still allowing `.operator/...` path dots and a final terminal period
- The remainder rejects follow-on connectors `plus`, `then`, and `also`
- Only one `and` is allowed, and only when it starts one of the contract guardrails `and keep`, `and never`, or `and write only`
- Selected clauses with commas are accepted only for explicit enumeration shapes like `of A, B or C` and `of A, B, or C`

Evidence from coverage runs:
- `Select exactly one of gate A or gate B and file a founder approval request.` fails
- `Select exactly one of gate A, gate B, or gate C then request one decision.` fails
- `Select exactly one of gate A, gate B or gate C.` passes when the rest of the row is valid
- `npm run validate:product-branches`: passed
- `npm test`: passed

## Review Fix Addendum 9

Closed the last separator bypasses and expanded the allowed recording guardrails.

What changed:
- Rejected spaced symbolic batching separators ` & `, ` / `, and ` + ` after `exactly one`
- Kept unspaced ordinary token slashes like `route/domain` untouched
- Added recording guardrails for `and document the finding in` and `and record the finding in`
- Kept `and file a founder approval request` rejected and preserved the existing packet rows

Evidence from coverage runs:
- `Select exactly one gate & file a founder approval request.` fails
- `Select exactly one gate / request one decision.` fails
- `Select exactly one remediation and document the finding in .operator/branch-loops/demo.md.` passes
- `Select exactly one remediation and record the finding in .operator/branch-loops/demo.md.` passes
- `node --test scripts/validate-product-branch-packets.test.mjs`: passed
- `npm run validate:product-branches`: passed
- `npm test`: passed

## Review Fix Addendum 10

Closed the remaining unspaced symbolic separator bypasses in `one_change_rule`.

What changed:
- Rejected raw `&` and `+` anywhere after `exactly one`
- Rejected `/` only when it starts a second action/request phrase such as `request`, `file`, `submit`, `approve`, `decide`, `escalate`, `select`, `choose`, `record`, `write`, `draft`, `create`, `return`, or `run`
- Kept ordinary slash compounds like `route/domain` and `.operator/branch-loops/...` valid

Evidence from coverage runs:
- `Select exactly one gate/request one decision.` fails
- `Select exactly one gate+file approval request.` fails
- `Select exactly one gate&request approval.` fails
- `node --test scripts/validate-product-branch-packets.test.mjs`: passed
- `npm run validate:product-branches`: passed
- `npm test`: passed
