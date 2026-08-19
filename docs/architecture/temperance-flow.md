# Cambium Temperance Flow

> Read-only projection. This artifact cannot plan, dispatch, persist work, mutate D1, or resolve providers.

- Schema: `cambium.temperance-flow-projection.v1`
- Projection authority: `read_only`
- Source-set digest: `sha256:0d8a8cea74c8919801daf4450bc280ed2970d52dadd2bcdc114141672d226fb0`
- Flow digest: `sha256:47d5cfc212403e53e901f4d0d5538830901d52c01934d0187f7db1c54a3f3e77`
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
| GSD state | `.planning/STATE.md#markdown.heading:Operator Next Step@sha256:25ac5c3c1a2e47b639a209fd25b84e67a31e69dbe15fafd51d5e7a2c90d33062` |
| Active plan | `.planning/phases/05-ralph-and-temperance-flow-projection/05-03-PLAN.md#frontmatter.plan@sha256:975e3ce7895709086885a1273896c35226eac177d62b417f47ff5c301af91502` |
| Intent Graph | `docs/architecture/intent-graph.v1.json#cambium.intent-graph-projection.v1@sha256:4eedd6d5868c20eb4dfbccfbcb9bfe25175b7fdfd782d98145bf94f3c899c1c7` |
| Supporting evidence | `.planning/phases/05-ralph-and-temperance-flow-projection/05-01-SUMMARY.md#markdown.heading:Self-Check: PASSED@sha256:25f36a44be0521ae96aad2d9cc918ab9ffe7c88b588ee0fb411505e8784180db` |
| Supporting evidence | `.project/HANDOFF.md#markdown.list-item:- This checkpoint contains planning and acceptance artifacts only.@sha256:29534505390bea7223b7cd476c5af2edd993eb81d948fffb058c2068aef9cc01` |
| Supporting evidence | `.project/HANDOFF.md#markdown.list-item:- Exact continuation is `/gsd:execute-phase 5`;@sha256:8a1d11934b5d10b39e1930eb8624d00eadc3332c76ba5de4fc81565bbd407794` |
| Supporting evidence | `ISA.md#markdown.list-item:- 2026-08-19 11:06: refined:@sha256:c2d03b18eb3e9725e1f1e498b17d2a394a3c5a9a5a4dc4932c45f8bb5bc447ba` |
| Supporting evidence | `.project/HANDOFF.md#markdown.list-item:- Isolated branch `codex/phase-5-decisions`@sha256:ff708ba71645e20ec0e1c26acf0d730c08b907e043fe7ba95075841202be8529` |

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

- `active_plan_not_unique_or_active`: .planning/phases/05-ralph-and-temperance-flow-projection/05-03-PLAN.md#frontmatter.plan@sha256:975e3ce7895709086885a1273896c35226eac177d62b417f47ff5c301af91502
- `no_dependency_ready_task`: source unavailable

Source bodies and host routing policy remain in their owning systems.
