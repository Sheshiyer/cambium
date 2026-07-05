# Cambium Branch Loop Library

This library adapts the loop principle to Cambium product branches. A branch loop is not a scheduler by itself. It is a proof-bound routine contract stored in the product packet and run manually until a founder approves scheduling.

## Boundary Colors

| color | autonomy | allowed action |
| --- | --- | --- |
| green | safe alone | Read packet/repo/runtime state and write `.operator/branch-loops/*` state files. |
| yellow | approval required | Draft one action, PR, assignment, or approval request; a human ships it. |
| red | never alone | Stop before money, production, outbound, credentials, spend, customer-visible claims, or high-risk tenant operations. |

## Required Loop Shape

Every loop has one objective, one metric, one boundary color, one state file, one stop rule, and one proof requirement.

Every round changes exactly one thing or records exactly one blocked approval request.

## Initial Library

| product | loop | boundary | state file |
| --- | --- | --- | --- |
| Fitcheck | `fitcheck-launch-gate-loop` | yellow | `.operator/branch-loops/fitcheck-launch-gate-loop.md` |
| Vantyx | `vantyx-second-tenant-loop` | yellow | `.operator/branch-loops/vantyx-second-tenant-loop.md` |
| Snow Gloves OS | `snow-gloves-os-approval-loop` | red | `.operator/branch-loops/snow-gloves-os-approval-loop.md` |
| IVerif | `iverif-claim-proof-loop` | green | `.operator/branch-loops/iverif-claim-proof-loop.md` |

## Scheduling Rule

Do not schedule any loop until it has passed one manual run with a readable state file and a reviewer accepts the stop rule.
