# Plexus WorkObject graph reference v1

Status: local prerequisite contract for P7-CAMBIUM #371. No route, deployed
adapter, identity binding or integrated Plexus ISC-277 acceptance is supplied.
Implementation: [`plexus-work-reference.ts`](../../../workers/quests/src/plexus-work-reference.ts).
Fixtures: [`plexus-work-reference.test.ts`](../../../workers/quests/src/plexus-work-reference.test.ts).

## Purpose and authority

`resolvePlexusWorkReference` verifies that an explicitly requested active node
with an exact canonical WorkObject identity appears in a consistent committed
tenant Goal Graph read. Its success status is **graph-reference-verified**.
It does not classify work as admitted/executable, authorize an action, inspect
approval/lease/loadout eligibility, or produce a reusable authorization token.

The existing [portfolio catalog](portfolio-catalog-v1.md) supplies the identity
allowlist only. Exact `canonicalId` and `workId` must agree with the request.
Saplings use `sapling`; client programs use `branch`; other programs use
`program`. Aliases, inferred slugs and unknown IDs are rejected. Catalog
lifecycle, tenant descriptions, classification and presence do not grant access
or prove execution admission. A catalog record without a matching committed
active graph anchor cannot produce a successful receipt.

## Trusted inputs and adapter prerequisite

The function takes a `PlexusWorkReferenceInput` with:

| Input | Required binding |
| --- | --- |
| `principal` | A server-authenticated `Principal`, role `team` or `founder`, with exact canonical tenant slug, nonempty safe identity/creator, valid subsection array and unexpired UTC `expiresAt` when supplied. Consultant or wildcard principals fail closed. |
| `resourceGrant` | Server-resolved `plexus.work-reference-resource-grant.v1`: exact `principalId`, exact `tenantId`, nonempty unique `workObjectIds` containing the requested exact ID, and mandatory future UTC `expiresAt`. Wildcards and missing/malformed scope are rejected. |
| `request` | Exact `tenantId`, `workObjectId`, matching `workObjectKind`, explicit `nodeId`, mandatory `expectedGraphDigest` and positive safe-integer `expectedGraphVersion`. |
| `store` | Only `Pick<GoalGraphStoreLike, 'readHead' \| 'readNodes'>`; each read receives the exact validated tenant. No writer is accessed. |
| `clock` | Optional trusted UTC clock dependency; defaults to the current time. It is not a client timestamp. Invalid, throwing or backwards clocks fail closed. |

The module validates structural consistency; it cannot authenticate a caller's
claim that a principal or resource grant is trusted. The future server adapter
must obtain both from the authenticated identity/resource authority, bind them
to the current request, and re-resolve revocation according to that authority's
freshness policy. Never deserialize request JSON into these trusted parameters.

The existing Plexus principal resolver emits tenant `*`; it cannot satisfy this
contract. An adapter must resolve a real tenant/member/resource binding rather
than replace `*` with the requested tenant. `Principal.allow` contains Mini App
subsection IDs and is never read as a WorkObject grant. Founder role also needs
the explicit resource grant. The module creates no principal, grant or cache.

## Read and consistency procedure

1. Snapshot and validate request/principal/grant before any graph read. Reject
   unauthorized actors or scope before looking up graph existence.
2. Require the exact catalog identity. Read the tenant head and match both caller
   expectations. Goal Graph digest uses the existing bare 64-character lowercase
   hex encoding; the catalog's `sha256:` encoding is a separate contract.
3. Read all tenant nodes, then reread the head. Snapshot results to detect in-place
   mutation. Require the same tenant, version, digest, node inventory, source
   fields and commit timestamp before/after. Recheck grant/principal expiry.
4. Validate node shapes and JSON metadata, unique IDs, exact tenant, singleton
   root and connected acyclic parent references. Node versions may be older than
   the head, since unchanged nodes retain their own version; future versions are
   rejected. Reject malformed timestamps and mismatched WorkObject ID/kind pairs.
5. Recompute the head with the existing `makeGoalGraphHead` algorithm and require
   equality. This reuses its content-digest semantics, including its deliberate
   excluded node provenance/timestamp fields; it does not define a new graph hash.
6. Find the exact node ID, require its exact WorkObject ID/kind and `active`
   status. Draft, blocked, paused and retired targets fail. Multiple distinct
   goals may legitimately reference one WorkObject; the explicit node selects
   one. Duplicate node IDs, even byte-identical duplicates, fail closed.

Pinned loadout syntax is checked as part of node shape, but loadout eligibility
is not resolved or implied. Other inactive nodes may remain in the graph without
making the requested active reference invalid. A failure returns only
`{ status: 'rejected', code }`; store exception text and private values are never
returned. Codes distinguish invalid input, principal/resource denial, unknown
identity, unavailable/missing/invalid/changing/stale graph and missing,
mismatched or inactive target nodes.

## Successful receipt

The only returned fields are:

```typescript
{
  schema: 'plexus.work-reference.v1',
  status: 'graph-reference-verified',
  tenantId, workObjectId, workObjectKind, nodeId,
  graphDigest, graphVersion, checkedAt
}
```

`checkedAt` records the post-read check time. The receipt excludes principal,
grants, tokens, cached authority, goals/private bodies, metadata, owner, source
paths, loadouts and action permissions. Every invocation performs new reads;
there is no successful-result cache or fallback to a prior receipt.

The head/nodes/head sequence is a consistency check, not a transactional read
snapshot. Graph or identity state can change after the final read or response;
the unchanged-head check cannot eliminate that residual TOCTOU window or prove
the honesty/freshness of an injected store. Any future execution boundary must
independently revalidate live identity/resource authority and the owning Goal
Graph approval, CAS, lease and action contracts. This receipt cannot serve as
their substitute.

## Verification and handoff

Run the deterministic local suites:

```bash
node --test workers/quests/src/plexus-work-reference.test.ts
node --test workers/quests/src/goal-graph/compiler.test.ts workers/quests/src/goal-graph-store.test.ts workers/quests/src/plexus-gate.test.ts
```

Fixtures cover role/tenant/grant denial, expiry, exact identities, valid repeated
WorkObject anchors, malformed/duplicate graph data, stale and changing heads,
digest inconsistency, unavailable stores, minimal disclosure, no network/writer,
and fresh reads after state changes. They establish the local resolver contract.
The endpoint/adapter, authoritative resource-grant producer, deployed revision,
revocation behavior and installed Plexus integration remain separate acceptance
work. No catalog, principal resolver, handler, store, deployment or external
system is changed by this prerequisite.
