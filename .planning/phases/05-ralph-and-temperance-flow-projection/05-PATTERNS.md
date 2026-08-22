# Phase 5: Ralph and Temperance Flow Projection - Pattern Map

## Planning boundary

Phase 5 should extend the repository's shipped projection pattern, not invent an
operational scheduler. The repository owns deterministic intent and readback;
the host owns live routing, provider resolution, dispatch, and credentials.

## Closest shipped analogs

### Pure closed-schema compiler

- `scripts/intent-graph.mjs` is the primary structural analog. Reuse its pure
  Node-built-in compiler/validator/renderer shape, canonical JSON ordering,
  stable SHA-256 digests, repository-root containment, closed vocabularies, and
  fail-closed validation.
- `scripts/intent-graph.test.mjs` is the adversarial contract analog. Reuse its
  named requirement tests, temporary-root fixtures, path and selector attacks,
  deterministic permutation probes, contradiction rejection, and foldback
  tests.
- The new flow projection must remain a separate schema. It may reference the
  committed Phase 4 Intent Graph by safe path and digest, but it must not add a
  node kind, edge kind, lifecycle, authority, or transition to that graph.

### Declared-source adapter and deterministic generator

- `scripts/intent-graph-sources.mjs` is the declared-source analog. Phase 5
  needs a bounded adapter for root `ISA.md`, live `.planning/STATE.md`, the
  active Phase 5 plan, verified summaries/evidence, reviewed handoff, the Phase
  4 Intent Graph, and fresh host receipt input supplied explicitly at compile
  time. Source authority and precedence must be data, not prose conventions.
- `scripts/generate-intent-graph.mjs` and
  `scripts/generate-intent-graph.test.mjs` are the generator analogs. Reuse
  `--root`, contained output paths, mutually exclusive write/check/JSON modes,
  atomic sibling rename, compile-once JSON/Markdown parity, double `--check`,
  stale-source/output rejection, and byte-preservation assertions.
- Default readbacks should follow the existing architecture layout:
  `docs/architecture/temperance-flow.v1.json` for machines and
  `docs/architecture/temperance-flow.md` for humans, with one contract document
  under `docs/architecture/contracts/`.

### Authority and foldback guards

- `workers/quests/src/goal-graph/projection-contract.ts` and its tests are the
  production authority-boundary analog. Reuse the family-discriminator and
  `validateAuthoritativeInput` pattern so a Phase 5 flow projection cannot be
  accepted as fresh ISA, GSD, D1, or doctrine input.
- The Plan 04-04 source-order proof is the standard for any shared guard change:
  rejection must happen before reads or durable writes, with bounded redacted
  evidence and preserved ordinary-input behavior.
- Phase 5 should add its own projection marker to the shared derived-projection
  family without importing the repository compiler into Worker runtime code.

### Acceptance lifecycle and closure

- `scripts/infinite-game-anchors.test.mjs` is the lifecycle-sentinel analog. It
  currently admits only Phase 3/4 coherent states and is the one known baseline
  failure after the approved Phase 5 `phase: plan` transition. Update it through
  RED/GREEN tests to admit only coherent Phase 5 pending/executing/verified
  states; do not broaden it to arbitrary progress values.
- Phase 4 plan/summary/verification conventions establish the closure pattern:
  immutable RED boundary, focused GREEN implementation, generated readback,
  exact allowed-path checks, full regression, ISA evidence, reviewed handoff,
  then independent verification.

## Phase 5-specific rules

1. Authority precedence is exact: approved goal from `ISA.md`, exact transition
   from live `.planning/STATE.md`, then the dependency-ready unit from the
   active plan. Missing, stale, conflicting, or ambiguous inputs yield one
   `blocked` result and no command.
2. The result contains exactly one next GSD command or a blocked reason. It is
   never a queue and never an unordered list of candidates.
3. Ralph is a stateless lifecycle description: reread durable sources, select
   one ready unit, execute through the declared lane, run its verification,
   persist only through existing GSD summary/state and reviewed handoff, then
   exit at a source-backed stop condition.
4. Cambium stores route intent: skill cluster, combo, and native-orchestrator vs
   paid-execution boundary. Resolved provider/model attribution is accepted only
   from an explicitly supplied, authenticated, fresh, task-and-route-bound host
   receipt and is never inferred from a copied combo stack. Verification belongs
   to the fixed host-owned Manifest verification boundary; Cambium retains only
   its bounded verified result and evidence reference, never trust material.
5. Machine and human readbacks must render from the same validated object and
   expose references, digests, route intent, fresh resolution evidence, gates,
   stop conditions, and the single action-or-blocked result without source
   bodies, absolute paths, prompts, session identifiers, credentials, quotas,
   or failover policy.
6. Every compiler/generator/readback API is read-only. There is no dispatch,
   shell execution, D1 write, provider call, deployment call, or independent
   mutable Ralph state.

## Plan decomposition

- Wave 1: RED contract plus pure flow compiler/validator/renderer and human
  contract; update the ISA lifecycle sentinel as a distinct prerequisite.
- Wave 2: declared repository sources, explicit host-receipt adapter, generator,
  deterministic JSON/Markdown readbacks, and shared projection-family guard.
- Wave 3: Ralph iteration contract/readback integration, complete adversarial
  regression, ISA evidence, and reviewed handoff. This wave must not implement
  dispatch; it proves how one external executor consumes and stops.

## Anti-patterns to reject

- A new `ralph-state.json`, queue, task ledger, checkpoint database, or mutable
  manifest that competes with GSD.
- Choosing work from unchecked roadmap items without active-plan dependency
  validation, or treating incomplete as dependency-ready.
- Copying host combo stacks, credentials, quotas, provider policy, or treating
  repository route intent as proof of actual provider resolution.
- Reading provider attribution from stale, missing, unauthenticated, unbound,
  wrong-issuer, replay-conflicting, or mismatched receipts.
- Copying Vision/Mission/ISA/plan bodies into the projection, emitting absolute
  machine paths, or placing prompts/responses/session identifiers in outputs.
- Extending or mutating the closed Phase 4 Intent Graph vocabulary.
- Accepting any generated flow projection into an authority or operational
  writer lane.
- Self-certifying completion, reviving terminal work, dispatching blocked work,
  or producing multiple next actions.

## Verification conventions

- Use Node built-ins and `node:test`; add no dependency or lockfile change.
- Commit a semantic RED boundary before implementation for each major contract.
- Run focused flow/compiler/generator/guard tests, the anchor and Intent Graph
  suites, generator `--check` twice, full `npm test`, privacy/path scans, exact
  allowed-file checks, and generated-source byte-preservation probes.
- A fresh host receipt may be fixture data in repository tests; production host
  resolution and deployment remain separately owner-approved and out of scope.
