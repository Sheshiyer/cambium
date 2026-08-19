# Cambium Temperance Flow

> Read-only projection. This artifact cannot plan, dispatch, persist work, mutate D1, or resolve providers.

- Schema: `cambium.temperance-flow-projection.v1`
- Projection authority: `read_only`
- Source-set digest: `sha256:0fb8238ba40db2c805e357658e23491cc7d06a23330d7e4518a18352a66a31ba`
- Flow digest: `sha256:415ba6af4be5b2e0429da564aaa896f91b4efc9ed26845c8e1b988db4213e9e5`
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
| ISA | `ISA.md#markdown.heading:Active Phase 5 acceptance@sha256:264114bc093ab190200c0f3ca851b381682ac6c61f0ee854f1a431bd8ee98dd6` |
| GSD state | `.planning/STATE.md#markdown.heading:Operator Next Step@sha256:25ac5c3c1a2e47b639a209fd25b84e67a31e69dbe15fafd51d5e7a2c90d33062` |
| Active plan | `.planning/phases/05-ralph-and-temperance-flow-projection/05-03-PLAN.md#whole-file@sha256:7b2b8ea730319f0a0bf00a0e7142aba5c61d1aab848a8ea37564bec004f56d4c` |
| Intent Graph | `docs/architecture/intent-graph.v1.json#cambium.intent-graph-projection.v1@sha256:4eedd6d5868c20eb4dfbccfbcb9bfe25175b7fdfd782d98145bf94f3c899c1c7` |
| Supporting evidence | `.planning/phases/05-ralph-and-temperance-flow-projection/05-01-SUMMARY.md#markdown.heading:Self-Check: PASSED@sha256:25f36a44be0521ae96aad2d9cc918ab9ffe7c88b588ee0fb411505e8784180db` |
| Supporting evidence | `.planning/phases/05-ralph-and-temperance-flow-projection/05-03-SUMMARY.md#markdown.heading:Self-Check: PASSED@sha256:27343c0d8e4f6757f35dd803bb456638f3a894ec5ac5569863e37c53d7dae3f9` |
| Supporting evidence | `.project/HANDOFF.md#markdown.heading:2026-08-19 Phase 5 decisions and reviewed planning checkpoint — verified implementation candidate@sha256:305c910cc008678545dee619746611dff528473dcb63d6ce5da8e1cbc50459fa` |
| Supporting evidence | `.planning/STATE.md#text.line:Phase:@sha256:46a18b363a9c891c55e15dc593f9c74e14396d81b6aa6c7c8e0139c630adf0c0` |
| Supporting evidence | `.planning/phases/05-ralph-and-temperance-flow-projection/05-02-SUMMARY.md#markdown.heading:Self-Check: PASSED@sha256:8b9cb73161e7932994b9362203f6a9a773a8fb14a33bef791b91edf09d94bf74` |
| Supporting evidence | `ISA.md#markdown.list-item:- 2026-08-19 11:06: refined:@sha256:c2d03b18eb3e9725e1f1e498b17d2a394a3c5a9a5a4dc4932c45f8bb5bc447ba` |

## Lifecycle

1. `reread`
2. `select_one`
3. `execute_external`
4. `verify_declared`
5. `persist_existing_surfaces`
6. `exit_external_condition`

## Route

- Skill cluster: `—`
- Combo: `—`
- Lane: `—`
- Approval required: `—`
- Receipt reference: `—`
- Resolved provider: `—`
- Resolved model: `—`

## Gates and stops

| Type | Kind | Satisfied | Source |
| --- | --- | --- | --- |

## Blocked reasons

- `active_plan_not_unique_or_active`: .planning/phases/05-ralph-and-temperance-flow-projection/05-03-PLAN.md#whole-file@sha256:7b2b8ea730319f0a0bf00a0e7142aba5c61d1aab848a8ea37564bec004f56d4c
- `no_dependency_ready_task`: source unavailable

Source bodies and host routing policy remain in their owning systems.
