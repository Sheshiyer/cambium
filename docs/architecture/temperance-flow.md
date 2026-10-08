# Cambium Temperance Flow

> Read-only projection. This artifact cannot plan, dispatch, persist work, mutate D1, or resolve providers.

- Schema: `cambium.temperance-flow-projection.v1`
- Projection authority: `read_only`
- Source-set digest: `sha256:13dad92b9825035ebc6061871ef99d27c23d280db97356f89ba0389c337f6245`
- Flow digest: `sha256:a280be0d60a58d9cbcc7e6dc18623e831dfef4aa47392a00179bfe44a8bba758`
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
| ISA | `ISA.md#frontmatter.task@sha256:90c1c52ae605489d9d34e8ddedbed9a9f7b745b6b7bf3f47cd52edeaae376fca` |
| GSD state | `.planning/STATE.md#markdown.heading:Operator Next Step@sha256:eaa1557d42e18b09575ddc5f662894875162227f19673f284396937934bd7737` |
| Active plan | `.planning/phases/05-ralph-and-temperance-flow-projection/05-03-PLAN.md#whole-file@sha256:7b2b8ea730319f0a0bf00a0e7142aba5c61d1aab848a8ea37564bec004f56d4c` |
| Intent Graph | `docs/architecture/intent-graph.v1.json#cambium.intent-graph-projection.v1@sha256:edb371814fa32acbeac62b4bfc23ca0a8af65b76859f13f16f2bdc9b27ea21d4` |
| Supporting evidence | `.project/HANDOFF.md#markdown.heading:2026-08-19 Phase 5 decisions and reviewed planning checkpoint — review-fix iteration 3@sha256:16f7a9499b80fd70deef93870997270847600296208e7dfd24492050aec80710` |
| Supporting evidence | `.planning/phases/05-ralph-and-temperance-flow-projection/05-01-SUMMARY.md#markdown.heading:Self-Check: PASSED@sha256:25f36a44be0521ae96aad2d9cc918ab9ffe7c88b588ee0fb411505e8784180db` |
| Supporting evidence | `.planning/phases/05-ralph-and-temperance-flow-projection/05-03-SUMMARY.md#markdown.heading:Self-Check: PASSED@sha256:27343c0d8e4f6757f35dd803bb456638f3a894ec5ac5569863e37c53d7dae3f9` |
| Supporting evidence | `ISA.md#markdown.heading:Completed Phase 5 acceptance@sha256:289e496ae6dff3b641505e34711c5b55bf666b71a06122995779cf1877d3ade9` |
| Supporting evidence | `.planning/phases/05-ralph-and-temperance-flow-projection/05-02-SUMMARY.md#markdown.heading:Self-Check: PASSED@sha256:8b9cb73161e7932994b9362203f6a9a773a8fb14a33bef791b91edf09d94bf74` |
| Supporting evidence | `ISA.md#markdown.list-item:- 2026-08-19 11:06: refined:@sha256:c2d03b18eb3e9725e1f1e498b17d2a394a3c5a9a5a4dc4932c45f8bb5bc447ba` |
| Supporting evidence | `.planning/STATE.md#text.line:Phase:@sha256:de38d75e438fc5c7187c0fcdea41a26c8639074e99f9808f63714a78e74cda77` |

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
- `gsd_state_not_live`: .planning/STATE.md#markdown.heading:Operator Next Step@sha256:eaa1557d42e18b09575ddc5f662894875162227f19673f284396937934bd7737
- `no_dependency_ready_task`: source unavailable

Source bodies and host routing policy remain in their owning systems.
