# Intent Graph v1 contract

## Purpose

`cambium.intent-graph-projection.v1` is a deterministic, read-only view of how Cambium's enduring purpose relates to renewable mission, finite goals, planned tasks, evidence, learning, overlays, and gates. It is an inspection contract. It is not a planner, approval ledger, doctrine writer, runtime command, or operational graph writer.

The authority boundary is closed:

- Root [`VISION.md`](../../../VISION.md) and [`MISSION.md`](../../../MISSION.md) are the only doctrine authorities.
- [`ISA.md`](../../../ISA.md) remains the only approved-goal and acceptance authority.
- GSD under [`.planning/`](../../../.planning/) remains the only finite-planning authority.
- The **D1 Goal Graph** under `cambium.goal-graph-projection.v1` remains the sole operational writer.
- The intent graph may reference all of those authorities, but it cannot replace, mutate, approve, or feed commands into any of them.

## Projection shape

Every projection contains:

| Field | Contract |
| --- | --- |
| `schema` | Exact `cambium.intent-graph-projection.v1` discriminator. |
| `projectionAuthority` | Exact `read_only`. |
| `sourceSetDigest` | SHA-256 over the sorted unique source path, selector, and digest tuples. |
| `graphDigest` | SHA-256 over the complete canonical projection except `graphDigest` itself. |
| `nodes` | Strictly ID-sorted, content-addressed provenance records. |
| `edges` | Strictly ID-sorted, typed and source-backed relations. |

Object keys are canonicalized recursively; array order is retained where it carries contract meaning. Source text is decoded as UTF-8, an initial BOM is removed, CRLF and CR are normalized to LF, and exactly one terminal LF is hashed. Digests use `sha256:` followed by 64 lowercase hexadecimal characters.

Node IDs bind kind, normalized repository-relative path, selector, and source authority. They deliberately exclude mutable content so a stable semantic source retains its identity while its content digest reports revision. Edge IDs bind the resolved endpoint IDs, closed relation kind, and edge source selector.

## Closed node provenance

Node kinds are `vision`, `mission`, `goal`, `task`, `evidence`, `learning`, `overlay`, and `gate`. Source authorities are `vision_anchor`, `repository_mission`, `isa_acceptance`, `gsd_planning`, `verification_evidence`, `historical_learning`, and `derived_reference`. Lifecycles are `enduring`, `renewable`, `finite`, `planned`, `verified`, `historical`, `derived`, and `gated`.

Every node carries exactly:

- `id`, `kind`, and `lifecycle`;
- `source.path`, `source.authority`, `source.selector`, and `source.digest`; and
- the complete state object described below.

Source paths must be normalized repository-relative paths whose real path remains within the supplied repository root. Absolute paths, traversal, symlink escapes, missing or non-file sources, ambiguous selectors, and digest drift fail closed. `.planning/STATE.md`, the generated intent JSON and Markdown, whole-file Roadmap and ISA selection, Roadmap tracking fields, and ISA `phase`, `progress`, or `updated` fields are excluded from node authority.

The selector vocabulary is closed:

- `whole-file`
- `markdown.heading:<exact heading>`
- `markdown.bold-field:<exact heading>#<exact field>`
- `frontmatter.<exact field>`
- `markdown.list-item:<exact unique prefix>`
- `xml.task-name:<exact task name>`

Each selector must resolve exactly once. Roadmap goals use only the exact `Goal` bold field within one exact Phase heading. The approved ISA goal uses only `frontmatter.task`. Reviewed ISA gates use one exact uniquely prefixed list item.

## Closed edge matrix

Every other source-kind, relation, and target-kind tuple is invalid.

| Source | Relation | Target |
| --- | --- | --- |
| vision | directs | mission |
| mission | scopes | goal |
| goal | decomposes | task |
| task | proves | evidence |
| evidence | produces | learning |
| evidence | closes | goal |
| gate | renews | goal |
| learning | informs | gate |
| overlay | references | vision or mission |
| gate | gates | goal or task |

Endpoints must exist, self-edges and duplicate semantic identities are rejected, and every edge carries an independently checked path, selector, and digest. `closes` and `renews` target finite goals. Learning can inform an ISA gate but never acquires ISA authority. Only a reviewed `isa_acceptance` gate sourced from `ISA.md` may represent renewal.

## Overlay and foldback rules

An overlay has `derived_reference` authority and may carry only digest-bound references that point directly to root `VISION.md` or `MISSION.md`. It cannot contain copied anchor prose, claim `vision_anchor` or `repository_mission` authority, or point at another doctrine surface. Its `references` edges must agree with those declared anchor paths and digests.

Both `cambium.intent-graph-projection.v1` and `cambium.goal-graph-projection.v1` are derived projection markers. Valid, malformed, or projection-shaped values bearing either identity are rejected when offered as fresh authority input. The intent graph never folds back into the D1 Goal Graph and never presents its own output as new ISA, GSD, Vision, Mission, evidence, or learning authority.

## State and fail-closed semantics

Every node state contains:

- `completion`: `not_applicable`, `pending`, `satisfied`, `blocked`, `stopped`, or `retired`;
- `approval`: `not_required`, `required`, `approved`, or `denied`;
- `freshness`: `fresh`, `stale`, or `missing`;
- `blockedReason`: null unless completion is `blocked`, in which case it is a non-empty source-backed reason; and
- `stopCondition`: a `kind`, source path, selector, and boolean `satisfied` value.

Stop kinds are `none`, `external_verification`, `approval_boundary`, `mission_review`, and `finite_goal`. `none` alone has null source path and selector. Other stop kinds must select one exact repository source. A blocked node cannot have a satisfied stop condition, a denied or still-required approval cannot be rendered satisfied, and stale or missing provenance cannot be rendered satisfied.

Evidence, learning, and gates remain graph facts. They may express a reviewed close or renewal path for a finite goal, but compilation and rendering perform no writes and never mutate Vision, Mission, ISA, GSD, D1, deployment state, providers, or connected repositories.
