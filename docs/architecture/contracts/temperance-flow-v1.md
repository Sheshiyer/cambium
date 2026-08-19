# Temperance Flow Projection v1

## Status and authority

`cambium.temperance-flow-projection.v1` is a deterministic `read_only`
projection. It explains one dependency-safe GSD action, or why no action is
authorized. It cannot execute a command, dispatch work, persist state, approve
work, mutate D1, select a provider, or write any source it reads.

The compiler and renderer use Node built-ins only. They expose no network,
clock, provider, deployment, D1, callback, or write API.

## Authority precedence

The precedence order is closed and exact:

1. `isa_goal` — the approved goal in root `ISA.md`.
2. `gsd_state` — the live transition and canonical command in
   `.planning/STATE.md`.
3. `active_plan` — one dependency-ready unit from the active plan.

Verified evidence and a reviewed handoff may establish readiness, blocking,
gates, and stops. They cannot define a goal, transition, plan, or command.
Missing, stale, conflicting, or ambiguous authority produces `blocked`; it
never falls through to supporting prose or a generated projection.

## Closed result union

The `result` field is one of:

- `ready`: exactly one selected task and exactly one canonical GSD command,
  with no blocked reasons.
- `blocked`: no selected task, no command, and one or more source-backed
  reasons.

Only `/gsd:execute-phase N`, `/gsd:verify-phase N`, and
`/gsd:plan-phase N` are accepted. Shell suffixes, flags, traversal, alternate
dispatch spellings, multiple dependency-ready tasks, blocked dependencies,
and terminal-work revival fail closed.

## Finite Ralph lifecycle

The ordered lifecycle is:

1. `reread`
2. `select_one`
3. `execute_external`
4. `verify_declared`
5. `persist_existing_surfaces`
6. `exit_external_condition`

This describes one disposable iteration. Ralph owns no queue, scheduler,
mutable ledger, checkpoint database, or self-certification path. Execution,
verification, persistence through existing GSD summary/state and reviewed
handoff surfaces, and exit evaluation remain external effects.

## Route intent and host receipts

Repository-owned route intent contains only:

- skill cluster;
- OmniRoute combo;
- `native_orchestrator` or `paid_execution` lane;
- approval requirement; and
- receipt reference.

Route intent is inspectable without a receipt and never proves which provider
ran. Resolved provider/model attribution appears only when a bounded source
adapter supplies a `verified`, `fresh` result bound to the exact task, command,
route, and receipt reference. That result carries an observed time or age,
evidence pointer, and redacted attribution. Cryptographic issuer, audience,
signature, freshness, and replay verification belong to the fixed host-owned
Manifest adapter introduced separately; the compiler neither accepts trust
material nor performs host verification.

Missing or unverified receipt results leave `resolved` null. Stale or
mismatched verified results block the action and expose no resolved provider.
Provider stacks, credentials, API keys, quotas, failover policy, prompt or
response bodies, native session identifiers, and secret-shaped attribution are
forbidden.

## References, digests, and paths

Every repository source is a reference containing a repository-relative POSIX
path, closed source kind, bounded selector, and lowercase `sha256:` digest.
Paths must resolve by realpath to files beneath the supplied repository root;
absolute paths, traversal, missing files, directories, and symlink escapes are
rejected. Source bodies never enter the projection.

Unordered semantic collections are sorted before digesting. Lifecycle order is
preserved. Text is normalized to LF with one trailing newline. `sourceSetDigest`
addresses the unique referenced source set and `flowDigest` addresses all other
validated projection facts. Markdown is rendered only from the validated
object, so machine and human readbacks carry the same semantic facts.

## Intent Graph boundary

Phase 4 is linked by exactly one `{path, schema, digest}` reference to
`cambium.intent-graph-projection.v1`. The flow schema does not import, copy,
extend, or reinterpret any Intent Graph node kind, edge kind, lifecycle,
authority, or transition.

Intent Graph, Goal Graph, and Temperance Flow projections are evidence for
inspection only. A projection-shaped value is rejected from ISA, GSD, plan,
doctrine, or D1 authority input. No projection can fold back to certify itself
or become an operational writer.

## Held boundaries

- Root `VISION.md` and `MISSION.md` retain doctrine authority and are referenced,
  never copied.
- Root `ISA.md` retains approved-goal and acceptance authority.
- GSD retains finite planning and transition authority.
- D1 Goal Graph retains its existing operational writer.
- Temperance and OmniRoute retain runtime, provider, budget, routing-policy,
  credential, and dispatch authority.
- Production deployment and external-state mutation remain separately
  owner-approved.
