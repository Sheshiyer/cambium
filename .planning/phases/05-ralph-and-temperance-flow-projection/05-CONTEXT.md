# Phase 5: Ralph and Temperance Flow Projection - Context

**Gathered:** 2026-08-19 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Derive one dependency-safe next GSD action, one bounded Ralph iteration lifecycle, route intent plus fresh host resolution evidence, and deterministic machine/human flow readbacks from durable authorities. This phase references the shipped Phase 4 Intent Graph but does not extend its closed vocabulary, create another goal or planning authority, mutate D1 or external runtime state, copy doctrine, or vendor host routing policy.
</domain>

<decisions>
## Implementation Decisions

### Authority and Next-Action Precedence
- **D-01:** Read the approved goal from root `ISA.md`, the exact transition from live `.planning/STATE.md`, and executable work only from the active phase plan. Supporting prose and generated outputs never outrank those authorities.
- **D-02:** When the approved goal, GSD transition, or active-plan frontier disagrees, is stale, or does not resolve uniquely, every generated flow surface reports `blocked` and exposes the conflicting evidence instead of inventing a next action.

### Ralph Iteration Lifecycle
- **D-03:** Ralph is a stateless outer loop. Every fresh iteration rereads durable goal, GSD state, active plan, verified evidence, and reviewed handoff before selecting work.
- **D-04:** One iteration selects exactly one dependency-ready unit, runs that unit's declared verification, persists the result through existing GSD summary/state and project handoff surfaces, then exits at a source-backed verification, approval, or finite-goal stop condition.
- **D-05:** Ralph owns no independent mutable task ledger and cannot self-certify completion, revive terminal work, or dispatch dependency-blocked work.

### Skill, Combo, and Provider Attribution
- **D-06:** Cambium records repository-owned skill-cluster route intent, the declared OmniRoute combo, and the native-orchestration versus paid-execution boundary.
- **D-07:** Only a fresh host Temperance receipt supplies actually resolved provider attribution and runtime freshness. The repository never copies provider stacks, credentials, quotas, failover order, or host policy.
- **D-08:** `temperance-next-wave` remains proposal-only and requires a fresh matching approval before dispatch; bounded parallel execution uses `te-dispatch-paid` rather than the retired legacy dispatch route.

### Dedicated Read-Only Flow Projection
- **D-09:** Phase 5 creates a separate deterministic, read-only flow projection with matching machine and human readbacks.
- **D-10:** The flow projection references Phase 4 Intent Graph identities and digests but does not add sources to, extend, or reinterpret the closed Intent Graph vocabulary.
- **D-11:** Both readbacks expose digest-bound references, exactly one next action or an explicit blocked state, route intent, fresh resolution evidence, gates, freshness, and stop conditions without copying doctrine or writing operational authority.

### the agent's Discretion
- Choose the smallest schema and filenames consistent with the existing Phase 4 compiler/readback pattern.
- Choose concise human-readback wording and stable sorting rules, provided machine/human parity is deterministic and testable.
- Reuse existing source-digest, projection-digest, freshness, privacy, and foldback-guard helpers where they preserve the Phase 5 boundary.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `ISA.md` — approved project goal, acceptance ledger, and Phase 5 refined decision.
- `.planning/ROADMAP.md` — Phase 5 boundary, dependencies, and success criteria.
- `.planning/REQUIREMENTS.md` — FLOW-01 through FLOW-04 acceptance contract.
- `.planning/STATE.md` — exact current GSD transition and session continuation authority.
- `.planning/PROJECT.md` — v0.4 scope, authority decisions, and exclusions.
- `.planning/README.md` — live-versus-historical planning rules and generated-output status.
- `.planning/config.json` — explicit human gates, auto-advance policy, and governed execution combo intent.
- `PROJECT.md` — repository authority and pickup contract.
- `AGENTS.md` — host/repository ownership split and Temperance rails.
- `.temperance/project.json` — stable project-local host-runtime pointers and ownership boundaries.
- `VISION.md` — canonical enduring doctrine anchor, referenced but never copied.
- `MISSION.md` — canonical renewable doctrine anchor, referenced but never copied.
- `docs/architecture/loops-to-graphs.md` — bounded loop lifecycle, external exit, and ISA/GSD authority boundaries.
- `docs/architecture/contracts/intent-graph-v1.md` — closed Phase 4 source vocabulary and read-only projection contract.
- `scripts/intent-graph.mjs` — established pure compiler and deterministic projection patterns.
- `scripts/intent-graph-sources.mjs` — declared source-selection and digest patterns.
- `.planning/phases/04-provenance-preserving-intent-graph/04-VERIFICATION.md` — verified machine/human parity, freshness, privacy, and foldback evidence.
- `.planning/execution/2026-08-12-source-reconciliation.v1.json` — existing distinction between backlog and dependency-safe ready frontier.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 4 already provides a pure intent compiler, declared source selection, stable identity/content-digest separation, deterministic JSON/Markdown generation, drift checks, and projection foldback guards.
- The source-reconciliation receipt already distinguishes all residual work from the dependency-safe ready frontier; Phase 5 should reuse that semantic distinction instead of equating incomplete with executable.
- Temperance manifest events already carry status, freshness, evidence pointers, routes, and redacted provider attribution; Phase 5 should consume receipts by reference rather than duplicate host schemas or policy.

### Established Patterns
- One declared source model feeds one compiler invocation and both committed readbacks.
- Mutable progress fields are excluded from content-addressed identity unless they are part of an explicit selected-source contract.
- Derived projections are inspection evidence only and are rejected from authoritative D1 Goal Graph intake.
- Runtime state outranks copied issue or index prose; stale supporting prose must be regenerated or reconciled.

### Integration Points
- Read root `ISA.md`, live `.planning/STATE.md`, the active Phase 5 plan, verified summaries/evidence, and `.project/HANDOFF.md` through a bounded declared-source adapter.
- Reference Phase 4 Intent Graph nodes and digests without modifying `intent-graph-v1` sources or vocabulary.
- Consume repository-owned route intent plus fresh redacted host receipts at the projection boundary.
- Publish one machine-readable flow artifact and one human readback from the same in-memory model, with deterministic parity and blocked-state tests.
</code_context>

<specifics>
## Specific Ideas

- A successful fresh-context iteration should be disposable: deleting its process-local memory must not change the next action reconstructed from durable sources.
- “One next action” means one exact GSD command or one explicit `blocked` result with named conflicting evidence, never a ranked menu that becomes a competing planner.
- Provider attribution should distinguish declared combo intent from actually resolved provider evidence so operators never mistake routing policy for execution fact.
</specifics>

<deferred>
## Deferred Ideas

- Full root, `MEMORY/`, and `docs/` corpus inventory and disposition mapping belong to Phase 6.
- Cross-cutting duplication, freshness, privacy, and final-handoff enforcement beyond the Phase 5 artifact contract belong to Phase 7.
- Connected-repository overlays, live provider-policy management, fleet dispatch, runtime mutation, and production deployment remain outside v0.4 Phase 5.
</deferred>
