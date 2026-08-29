# Cambium Temperance Flow

> Read-only projection. This artifact cannot plan, dispatch, persist work, mutate D1, or resolve providers.

- Schema: `cambium.temperance-flow-projection.v1`
- Projection authority: `read_only`
- Source-set digest: `sha256:4dff53f49303b429cbfa31e2b49fcddbc5752bce41732303dddd5474a64eaa76`
- Flow digest: `sha256:56131dedeeda5e5c10dacee2ad48902dd652048fb197af0f7e0cd7056d3050b1`
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
| GSD state | `.planning/STATE.md#markdown.heading:Operator Next Step@sha256:711ff6b6d22f5269814c0662525db53ca5a60ac24abc1dd447728123a883a5e5` |
| Active plan | `.planning/phases/05-ralph-and-temperance-flow-projection/05-03-PLAN.md#whole-file@sha256:7b2b8ea730319f0a0bf00a0e7142aba5c61d1aab848a8ea37564bec004f56d4c` |
| Intent Graph | `docs/architecture/intent-graph.v1.json#cambium.intent-graph-projection.v1@sha256:300beff7eeaa22d3e27e0848f8308e1337fbb4cfcc72450340759f49e8073b1e` |
| Supporting evidence | `.project/HANDOFF.md#markdown.heading:2026-08-19 Phase 5 decisions and reviewed planning checkpoint — review-fix iteration 3@sha256:16f7a9499b80fd70deef93870997270847600296208e7dfd24492050aec80710` |
| Supporting evidence | `.planning/phases/05-ralph-and-temperance-flow-projection/05-01-SUMMARY.md#markdown.heading:Self-Check: PASSED@sha256:25f36a44be0521ae96aad2d9cc918ab9ffe7c88b588ee0fb411505e8784180db` |
| Supporting evidence | `.planning/phases/05-ralph-and-temperance-flow-projection/05-03-SUMMARY.md#markdown.heading:Self-Check: PASSED@sha256:27343c0d8e4f6757f35dd803bb456638f3a894ec5ac5569863e37c53d7dae3f9` |
| Supporting evidence | `.planning/STATE.md#text.line:Phase:@sha256:278f741ba04302bdd7a6f3ff3c9c99ef10c46bb80885cf8f62fc9d683c0f2ecf` |
| Supporting evidence | `ISA.md#markdown.heading:Completed Phase 5 acceptance@sha256:289e496ae6dff3b641505e34711c5b55bf666b71a06122995779cf1877d3ade9` |
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
- `gsd_state_not_live`: .planning/STATE.md#markdown.heading:Operator Next Step@sha256:711ff6b6d22f5269814c0662525db53ca5a60ac24abc1dd447728123a883a5e5
- `no_dependency_ready_task`: source unavailable

Source bodies and host routing policy remain in their owning systems.
