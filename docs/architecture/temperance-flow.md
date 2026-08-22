# Cambium Temperance Flow

> Read-only projection. This artifact cannot plan, dispatch, persist work, mutate D1, or resolve providers.

- Schema: `cambium.temperance-flow-projection.v1`
- Projection authority: `read_only`
- Source-set digest: `sha256:c998b126231d45552d3f09f8a4f6f9fb12acf0a397e1210b7c114730b90fde6d`
- Flow digest: `sha256:2a4714cc8621137bb3358926fb7fad1bba3c9b7b50ab7877baccf032c883f879`
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
| GSD state | `.planning/STATE.md#markdown.heading:Operator Next Step@sha256:698af6a87462eeccb58d4f8e556b3eff709332cb597f33a5b0db733608a0db48` |
| Active plan | `.planning/phases/05-ralph-and-temperance-flow-projection/05-03-PLAN.md#whole-file@sha256:7b2b8ea730319f0a0bf00a0e7142aba5c61d1aab848a8ea37564bec004f56d4c` |
| Intent Graph | `docs/architecture/intent-graph.v1.json#cambium.intent-graph-projection.v1@sha256:be4b69075c46870ac8681445c3fa5180c6133d4bb4094bcca31ac1cb260460c0` |
| Supporting evidence | `.project/HANDOFF.md#markdown.heading:2026-08-19 Phase 5 decisions and reviewed planning checkpoint — review-fix iteration 3@sha256:16f7a9499b80fd70deef93870997270847600296208e7dfd24492050aec80710` |
| Supporting evidence | `.planning/phases/05-ralph-and-temperance-flow-projection/05-01-SUMMARY.md#markdown.heading:Self-Check: PASSED@sha256:25f36a44be0521ae96aad2d9cc918ab9ffe7c88b588ee0fb411505e8784180db` |
| Supporting evidence | `.planning/phases/05-ralph-and-temperance-flow-projection/05-03-SUMMARY.md#markdown.heading:Self-Check: PASSED@sha256:27343c0d8e4f6757f35dd803bb456638f3a894ec5ac5569863e37c53d7dae3f9` |
| Supporting evidence | `ISA.md#markdown.heading:Completed Phase 5 acceptance@sha256:289e496ae6dff3b641505e34711c5b55bf666b71a06122995779cf1877d3ade9` |
| Supporting evidence | `.planning/phases/05-ralph-and-temperance-flow-projection/05-02-SUMMARY.md#markdown.heading:Self-Check: PASSED@sha256:8b9cb73161e7932994b9362203f6a9a773a8fb14a33bef791b91edf09d94bf74` |
| Supporting evidence | `.planning/STATE.md#text.line:Phase:@sha256:9efa1d4e16f2ca9a94ebfdf15bcec9d9025ee5fc5546782095e6fa215dcca192` |
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
- `gsd_state_not_live`: .planning/STATE.md#markdown.heading:Operator Next Step@sha256:698af6a87462eeccb58d4f8e556b3eff709332cb597f33a5b0db733608a0db48
- `no_dependency_ready_task`: source unavailable

Source bodies and host routing policy remain in their owning systems.
