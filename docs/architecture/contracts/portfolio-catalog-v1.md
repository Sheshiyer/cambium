# Portfolio Catalog Projection Contract v1

Date: 2026-08-09

Schema: `cambium.portfolio-catalog.v1`

Status: active read-only projection contract; no tenant activation or production traffic authority

Local verification: run `npm run validate:portfolio-foundation` and read the
[current foundation checkpoint](../../../.project/HANDOFF.md). The
[`2026-07-29 evidence packet`](../../plans/evidence/cambium-portfolio-catalog-2026-07-29.md)
is retained only as a historical snapshot.

## Purpose

The portfolio catalog makes the Vault's classified WorkObjects visible in the
Cambium Telegram Mini App without pretending that classification is live
operational state. It is an additive sidecar to the Mission Fabric projection,
not a new node source and not a workflow writer.

The current checked-in snapshot contains:

- 20 Saplings
- 39 client Branches
- 15 internal Programs
- 0 classification-review records
- 20 historical product surfaces
- 49 known operational-admission gaps

The source classification digest is
`18d5efd69376923be383043894124e7cdda27958a5f47aafe4a6db6342afe542`.
Cambium also computes a digest over its normalized, bounded catalog artifact.
The current catalog digest is
`sha256:0aa1e7a1b4bdfcd82571509b693fca90a0dc8a6901f539980ebe1c5b34be275a`.
The route emits a pair digest over the served Mission Fabric graph digest and
that catalog digest so a client never combines unpinned versions silently.

## Authority boundary

| Concern | Authority |
| --- | --- |
| Portfolio classification | Vault registry |
| Durable project and client identifiers | TeamForge primary D1 |
| Desired/current state, goals, tasks, approvals, runs, receipts | Cambium D1 Goal Graph and execution stores |
| Runtime projection | Cambium Mission Fabric |
| Code execution | GitHub/runtime controls |

Catalog presence cannot activate a tenant, admit a WorkObject to operations,
approve a lifecycle transition, assign an agent, pin a skill loadout, or prove
completion. Missing live evidence is rendered as a gap.

## Identity and joins

Catalog records join to Mission Fabric only through an exact canonical
`workId`. Legacy, bare, or prefix-translated wire forms are rejected and
reported as runtime-only gaps; the adapter does not normalize them into a
canonical identity.

Names, aliases, folder names, account labels, and unresolved tenant identities
never participate in a join. Every response includes a bidirectional join
report so catalog-only and runtime-only objects remain visible.

The 49 checked-in gap rows are bounded, known-source evidence. Runtime join
reports remain authoritative for whether an exact Mission Fabric work identity
exists; catalog absence from that static list never proves operational
admission. D1 operational admission additionally requires a typed D1
WorkObject anchor. Until that anchor exists, a Mission Fabric identity match is
not labeled or treated as a Goal Graph match.

Fitcheck is always `sapling:fitcheck` under canonical parent tenant `cambium`.
`FitCheck` and `getfitcheck` are display aliases with
`tenantAuthority: false`; neither may become a tenant selector.
Fitcheck links to the distinct `program:hdilint` WorkObject because HDILINT
owns its backend capability. The relationship does not merge their identities:
`Sheshiyer/fitcheck-landing` remains Fitcheck planning authority, while
`Sheshiyer/HDILINT-backend-aleph` remains HDILINT program authority.

ParkArea and Tirak retain separately linked product and client WorkObjects.
SeedForge retains separately linked Sapling and capability Program
WorkObjects. A linked pair never becomes one dual-kind record.

## Repository mapping receipts

The Batch 3 compiler prepares 39 deterministic mapping receipts across 13
reviewed WorkObjects. Every receipt binds the full catalog digest,
classification digest, root-map digest, repository-evidence digest, exact
WorkObject identity, immutable GitHub repository identity, root context, and
founder decision identifier. The checked-in bundle digest is
`sha256:2a391022bf581771d03ddba8e092b7fe0d111b93a5003e4d1742d6022b3b5e3f`.

`prepared-not-issued` is an evidence state, not a mutation. The bundle writes
no R2 object, admits no D1 row, activates no tenant, promotes no Sapling, and
changes no GitHub repository. Issuance requires its separate apply manifest
and founder approval; exact replay is idempotent and semantic drift conflicts.

## Lifecycle templates

The templates explain the kind-specific operating path. They do not report
the WorkObject's live position unless Goal Graph evidence supplies it.

### Sapling

`Idea → Proposal → Evidence → Proof only → Supervised branch → Autonomous branch → Product review → outcome`

### Client Branch

`Lead → Qualified outcome → Scope/proposal → Approval → Kickoff → Delivery → Acceptance → Handoff → close/renew/expand`

### Internal Program

`Proposed → Approved → Executing → Verifying → Complete/Retired`

`Paused` is an overlay on the internal Program path, not a successful terminal
state.

## Route visibility

`GET /v1/mission-fabric/cambium` remains Telegram-authenticated,
tenant-allowlisted, bounded, `private, no-store`, and GET-only.

- A founder receives `portfolioCatalog` detail plus
  `portfolioCatalogSummary`.
- An explicitly allowlisted non-founder viewer receives only
  `portfolioCatalogSummary`.
- Other tenants do not receive the Cambium portfolio catalog.
- A catalog validation or digest failure fails closed before catalog detail is
  served.
- Existing exact-200 and `delivery.operatingFabricEnabled === true`
  activation rules remain the client kill switch; absent catalog material
  preserves the prior Mission Fabric scenes.

The detailed catalog allowlist excludes operational fields such as desired or
current state, goals, missions, tasks, runs, receipts, assignments, loadouts,
approvals, tenant activation, RBAC, billing, health, and readiness.

## Mini App views

Canopy groups classification records into Saplings, Branches · Clients,
Programs, and Review with compact filters and progressive disclosure.
Selection may decorate Mission, Flow, Workforce, Forge, Gate, and Inspect only
through an exact joined identifier.

For catalog-only objects:

- Mission says `Goal Graph missing`.
- Flow shows the relevant lifecycle template without fabricated graph nodes.
- Workforce shows assignments only for explicit `assigned-to` edges.
- Forge shows clusters/loadouts only for explicit `requires-cluster` and
  `pins-loadout` edges; otherwise it says `skills unmapped`.
- Gate does not synthesize an approval action.
- Inspect preserves source, digest, identity, and gap provenance without
  exposing absolute filesystem paths.

## Promotion boundary

This contract and its tests authorize local candidate implementation only.
They do not authorize Cloudflare deployment, Telegram menu/origin changes,
allowlist changes, D1/KV/schema writes, traffic promotion, or founder-device
proof. Those actions remain separately approval-gated by the operating-fabric
promotion evidence packet.
