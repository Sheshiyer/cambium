# Portfolio Catalog Projection Contract v1

Date: 2026-07-29

Schema: `cambium.portfolio-catalog.v1`

Status: read-only candidate contract; no tenant activation or production traffic authority

Local verification: [`cambium-portfolio-catalog-2026-07-29.md`](../../plans/evidence/cambium-portfolio-catalog-2026-07-29.md)

## Purpose

The portfolio catalog makes the Vault's classified WorkObjects visible in the
Cambium Telegram Mini App without pretending that classification is live
operational state. It is an additive sidecar to the Mission Fabric projection,
not a new node source and not a workflow writer.

The initial snapshot contains:

- 12 Saplings
- 28 client Branches
- 14 internal Programs
- 16 classification-review records
- 19 historical product surfaces
- 47 explicit operational-admission gaps

The source classification digest is
`93b90ed7cee268ac7ee87321a88efefced7980349658cf3c640657a71c361281`.
Cambium also computes a digest over its normalized, bounded catalog artifact.
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
`workId`. The adapter may normalize the known legacy wire forms by WorkObject
type:

- Sapling `sapling-<slug>` becomes `sapling:<slug>`.
- Client Program `<slug>` becomes `branch:<slug>`.
- Internal Program `<slug>` becomes `program:<slug>`.
- An already canonical identifier remains unchanged only when its prefix
  matches its type.

Names, aliases, folder names, account labels, and unresolved tenant identities
never participate in a join. Every response includes a bidirectional join
report so catalog-only and runtime-only objects remain visible.

Fitcheck is always `sapling:fitcheck` under canonical parent tenant `cambium`.
`FitCheck` and `getfitcheck` are display aliases with
`tenantAuthority: false`; neither may become a tenant selector.

ParkArea and Tirak retain separately linked product and client WorkObjects.
SeedForge retains separately linked Sapling and capability Program
WorkObjects. A linked pair never becomes one dual-kind record.

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
