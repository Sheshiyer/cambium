# Cambium Temperance Flow

> Read-only projection. This artifact cannot plan, dispatch, persist work, mutate D1, or resolve providers.

- Schema: `cambium.temperance-flow-projection.v1`
- Projection authority: `read_only`
- Source-set digest: `sha256:fe621307b020cfe5423a2e21bd861bb7853af9b59af5e5a7a80bf82fc5f3576d`
- Flow digest: `sha256:407df726a144aaec0350839fa4a9a4331e53ef62546fbc78dbe651b15c913e99`
- Result: `blocked`
- Command: `—`
- Selected task: `—`

## Authority precedence

1. `isa_goal`
2. `gsd_state`
3. `active_plan`

## References

| Role | Reference |
| --- | --- |
| ISA | `ISA.md#frontmatter.task@sha256:6b14cd9a8118f0d0c44375d6446373cc429da72dc96826b253951dff8f9f153e` |
| GSD state | `.planning/STATE.md#markdown.heading:Operator Next Step@sha256:91f2284945b4bfb5a95e4ffdcb7c1ce9aa339bf11740154c947a90f1b990a6e3` |
| Active plan | `.planning/phases/05-ralph-and-temperance-flow-projection/05-02-PLAN.md#frontmatter.plan@sha256:4999d3c4a78b6df5c7fb319715fb152753c8f04e5ace52a676d92ef129fd3b83` |
| Intent Graph | `docs/architecture/intent-graph.v1.json#cambium.intent-graph-projection.v1@sha256:4eedd6d5868c20eb4dfbccfbcb9bfe25175b7fdfd782d98145bf94f3c899c1c7` |
| Supporting evidence | `.project/HANDOFF.md#markdown.list-item:- Exact continuation is `/gsd:execute-phase 5`;@sha256:2123b640e300f4495aefe8658531ae095b193a679c757117f8542dcb71e28a11` |
| Supporting evidence | `.planning/phases/05-ralph-and-temperance-flow-projection/05-01-SUMMARY.md#markdown.heading:Self-Check: PASSED@sha256:25f36a44be0521ae96aad2d9cc918ab9ffe7c88b588ee0fb411505e8784180db` |
| Supporting evidence | `.project/HANDOFF.md#markdown.list-item:- This checkpoint contains planning and acceptance artifacts only.@sha256:29534505390bea7223b7cd476c5af2edd993eb81d948fffb058c2068aef9cc01` |
| Supporting evidence | `ISA.md#markdown.list-item:- 2026-08-19 11:06: refined:@sha256:dde018fc50690e3b3a1370c365167c84e3d5c9a239146e41250f97b5fd18cab7` |
| Supporting evidence | `.project/HANDOFF.md#markdown.list-item:- Isolated branch `codex/phase-5-decisions`@sha256:ff708ba71645e20ec0e1c26acf0d730c08b907e043fe7ba95075841202be8529` |

## Lifecycle

1. `reread`
2. `select_one`
3. `execute_external`
4. `verify_declared`
5. `persist_existing_surfaces`
6. `exit_external_condition`

## Route

- Skill cluster: `gsd-execute-phase`
- Combo: `te-dispatch-paid`
- Lane: `paid_execution`
- Approval required: `true`
- Receipt reference: `—`
- Resolved provider: `—`
- Resolved model: `—`

## Gates and stops

| Type | Kind | Satisfied | Source |
| --- | --- | --- | --- |
| Gate | approval_boundary | false | `.planning/phases/05-ralph-and-temperance-flow-projection/05-02-PLAN.md#xml.task-name:Task 1: Commit RED source, generator, receipt, parity, and foldback contracts@sha256:1b57692db7d941b99581341421b089eb57ae91b432e45d47bba21f97839c4695` |
| Gate | declared_verification | false | `.planning/phases/05-ralph-and-temperance-flow-projection/05-02-PLAN.md#xml.task-name:Task 1: Commit RED source, generator, receipt, parity, and foldback contracts@sha256:1b57692db7d941b99581341421b089eb57ae91b432e45d47bba21f97839c4695` |
| Stop | external_verification | false | `.planning/phases/05-ralph-and-temperance-flow-projection/05-02-PLAN.md#xml.task-name:Task 1: Commit RED source, generator, receipt, parity, and foldback contracts@sha256:1b57692db7d941b99581341421b089eb57ae91b432e45d47bba21f97839c4695` |

## Blocked reasons

- `selected_command_conflicts_with_gsd_transition`: .planning/STATE.md#markdown.heading:Operator Next Step@sha256:91f2284945b4bfb5a95e4ffdcb7c1ce9aa339bf11740154c947a90f1b990a6e3, .planning/phases/05-ralph-and-temperance-flow-projection/05-02-PLAN.md#xml.task-name:Task 1: Commit RED source, generator, receipt, parity, and foldback contracts@sha256:1b57692db7d941b99581341421b089eb57ae91b432e45d47bba21f97839c4695

Source bodies and host routing policy remain in their owning systems.
