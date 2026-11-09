# Cambium Branch Loop Library

This library adapts the loop principle to Cambium ecosystem branches: products, client delivery streams, and internal services. A branch loop is not a scheduler by itself. It is a proof-bound routine contract stored in the branch packet and run manually until a founder approves scheduling.

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

| branch | kind | loop | boundary | state file |
| --- | --- | --- | --- | --- |
| Fitcheck | product | `fitcheck-launch-gate-loop` | yellow | `.operator/branch-loops/fitcheck-launch-gate-loop.md` |
| Vantyx | product | `vantyx-second-tenant-loop` | yellow | `.operator/branch-loops/vantyx-second-tenant-loop.md` |
| Snow Gloves OS | internal-service | `snow-gloves-os-approval-loop` | red | `.operator/branch-loops/snow-gloves-os-approval-loop.md` |
| IVerif | product | `iverif-claim-proof-loop` | green | `.operator/branch-loops/iverif-claim-proof-loop.md` |
| LumenBar | product | `lumenbar-launch-loop` | yellow | `.operator/branch-loops/lumenbar-launch-loop.md` |
| Temperance Engine | product | `temperance-draft-proof-review` | yellow | `.operator/branch-loops/temperance-draft-proof-review.md` |
| Client Delivery | client | `client-delivery-handoff-loop` | yellow | `.operator/branch-loops/client-delivery-handoff-loop.md` |

## Scheduling Rule

Do not schedule any loop until it has passed one manual run with a readable state file and a reviewer accepts the stop rule.


## 4 November2026 unfinished-product graph planning

The current source review links25 sourced Sapling identities and six existing disabled nightly candidates to owner readiness and canonical review. It also retains separate ParkArea/Tirak/LumenBar/Relovo source questions. Fitcheck's existing launch-gate loop remains linked while its duplicate task identity is held. Use the single plan at `temperance:.planning/quick/261104-30y-implement-approved-j1-readiness-and-lean/NEXT-FABRIC-SAPLING-BATCH.md`. “Nightly builds” is the unfinished-product cohort here, not an enabled schedule. No loop invocation, state write, build, Work execution, lease or subscription is authorized by this planning index.
