# Mission Fabric Projection Contract v1

Date: 2026-07-28
Schema: `cambium.mission-fabric-projection.v1`
Status: frozen for the first deterministic compiler slice
Runtime source: `workers/quests/src/mission-fabric.ts`

## Purpose

The Mission Fabric is a versioned, read-only projection compiled from
authoritative source facts: the D1 Goal Graph, branch packets, company program
packets, agent and skill registries, run ledgers, and receipt stores. It is
never a second workflow engine and never acquires write authority over any
source. Consumers render it; they may not mutate it or treat it as evidence of
a state transition.

This contract freezes the public projection shape so that the compiler, the
Worker route, and the Telegram Mini App can be built in parallel without
renaming fields or edge vocabulary.

The complete Vault-classified portfolio is transported as the independently
digested, read-only sidecar defined by
[`portfolio-catalog-v1.md`](./portfolio-catalog-v1.md). Catalog records never
enter `nodes` merely to look operational. The route pairs the graph and catalog
digests, and the client decorates a catalog record only after an exact
canonical-identifier join.

## Projection Shape

```ts
export type FabricNode =
  | { kind: 'work'; value: SaplingWork | ProgramWork }
  | { kind: 'mission'; value: FabricMission }
  | { kind: 'task'; value: FabricTask }
  | { kind: 'agent'; value: FabricAgent }
  | { kind: 'skill-cluster'; value: FabricSkillCluster }
  | { kind: 'run'; value: FabricRun }
  | { kind: 'receipt'; value: FabricReceipt };

export type FabricEdgeKind =
  | 'contains'
  | 'depends-on'
  | 'assigned-to'
  | 'requires-cluster'
  | 'pins-loadout'
  | 'executes'
  | 'produces'
  | 'proves'
  | 'informs-next-intent';

export interface FabricEdge {
  kind: FabricEdgeKind;
  fromId: string;
  toId: string;
}

export interface FabricGap {
  gapId: string;
  kind: string;
  subjectId: string | null;
  detail: string;
  evidenceRef: string | null;
}

export interface MissionFabricProjectionV1 {
  schema: 'cambium.mission-fabric-projection.v1';
  projectionVersion: 1;
  tenantId: string;
  graphVersion: number;
  graphDigest: string;
  generatedAt: string;
  asOf: string;
  sourceOfTruth: 'd1-goal-graph';
  readOnly: true;
  nodes: readonly FabricNode[];
  edges: readonly FabricEdge[];
  gaps: readonly FabricGap[];
}

export type FabricWorkNode = Extract<FabricNode, { kind: 'work' }>;
```

Node value shapes (`SaplingWork`, `ProgramWork`, `FabricMission`, `FabricTask`,
`FabricAgent`, `FabricSkillCluster`, `FabricRun`, `FabricReceipt`) are the
ontology frozen in `docs/architecture/cambium-operating-fabric.md` [OF-C1].
The compiler must not rename those fields or invent peer root types.

## Compiler Rules

- **Determinism.** Identical source facts compile to an identical projection
  and an identical `graphDigest`, regardless of the ordering of source
  collections. Nodes, edges, and gaps are sorted canonically before digesting.
- **Canonical JSON.** Digest input is canonical stable JSON: object keys
  sorted lexicographically, arrays in sorted graph order, UTF-8, no
  whitespace. The digest is `sha256:` plus the lowercase hex SHA-256 of that
  canonical string.
- **Digest scope.** `graphDigest` hashes the viewer-redacted canonical graph
  content: `projectionVersion`, `tenantId`, `graphVersion`,
  `sourceOfTruth`, `readOnly`, `nodes`, `edges`, and `gaps`. It excludes
  `schema`, `graphDigest`, `generatedAt`, `asOf`, and any transport metadata,
  so the digest can later be recomputed after redaction without volatile
  material.
- **Timestamps.** `asOf` is the newest authoritative input timestamp and is
  deterministic input. Every `asOf` candidate (`facts.asOf`, receipt
  `verifiedAt`, evidence `observedAt`) and the injected `generatedAt` must be
  a canonical ISO-8601 UTC timestamp (`…T…Z`); the compiler validates each
  candidate and fails closed on malformed or non-UTC values before taking
  the lexicographic maximum, because lexicographic ordering is only
  chronologically sound within the canonical UTC form. `generatedAt` comes
  only from an injected compiler clock; the compiler never reads a wall
  clock. Wall-clock `servedAt` and derived `freshness: 'fresh' | 'stale'`
  live only in the route's `delivery` envelope and never enter the
  projection.
- **Authority.** The compiler rejects projection-shaped input as an authority
  source (`sourceKind: 'projection'`). Source facts are read, never mutated;
  all compiler output is fresh objects.
- **Joins.** Relationships join only on explicit typed identifiers from
  source facts. Missing or dangling joins become typed gaps, never invented
  relationships. An edge is never emitted merely to make a vocabulary member
  appear used: `requires-cluster`, `pins-loadout`, and
  `informs-next-intent` require authoritative task/cluster/loadout joins,
  and a self-edge is never legitimate. Field mappings likewise carry source
  semantics only: a source field that does not exist (for example a task
  proof requirement) projects as the honest empty value, never a
  repurposed neighbor such as a blocker.

## Bounds

| Material | Cap |
| --- | --- |
| nodes | 512 |
| edges | 1,024 |
| gaps | 128 |
| evidence references per node | 32 |
| display string length | 512 characters |

Overflow is never silently dropped: when a bound would be exceeded the
compiler records a deterministic `projection-truncated` gap naming the
material and observed count. Display strings longer than 512 characters are
truncated deterministically with a `…[truncated]` marker, and a
`projection-truncated` gap is recorded. A bound that cannot be honored (for
example the `projection-truncated` gap itself exceeding the gap cap) fails
closed with an error instead of producing an unbounded projection.

## Redaction and Recomputation

Viewer redaction removes unauthorized material from `nodes`, `edges`, and
`gaps` only, then `graphDigest` is recomputed over the redacted canonical
graph content. For a fixed viewer the recomputed digest is stable across
compilations of identical source facts. `graphVersion`, `generatedAt`, and
`asOf` are carried through unchanged.
