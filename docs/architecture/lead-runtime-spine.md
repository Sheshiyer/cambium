# Lead Runtime Spine

Status: implemented for one fixed-tenant, manual, read-only IVerif capture/enrich proof. Higher-risk providers and every recurring schedule remain registered but disabled.

## Runtime boundary

Cambium is the only runtime writer. The D1 spine owns canonical identity, immutable observation receipts, task leases and fencing, reservation/usage settlement, and derived foldback. Provider adapters return observations; they do not own workflow, identity, spend, or scheduling state.

The one executable route is:

```text
POST /v1/bridge/lead-runs/iverif/capture-enrich
Authorization: Bearer <admin BRIDGE_TOKEN>
{"idempotencyKey":"<operator-owned stable key>"}
```

The body is closed. Tenant, product, provider, project, campaign, method, stages, and spend tier are server-owned and cannot be overridden by the caller. Scoped assignment/member credentials receive `403`.

## Bounded execution

```text
durable task + lease
  -> zero-unit Explee reservation
  -> GET need-reply inbox
  -> select one contact by stable person-id order
  -> canonical lead + unique source alias
  -> GET that contact's thread
  -> immutable redacted observation receipt
  -> zero-unit usage settlement
  -> durable terminal operator receipt
  -> derived numeric cortex foldback (repaired on terminal replay)
```

The stage graph is validated before execution, bounded to 16 stages and eight dependencies per stage, and run in deterministic topological order. A failed dependency blocks descendants. A stop rule is checked immediately before each adapter invocation. A metered stage without a reservation fails before its adapter function can run.

Reusing the same idempotency key returns the stored terminal receipt. It does not repeat an Explee read, create another lead, reserve spend again, write another usage record, or emit another foldback.

## Durable records

| D1 record | Authority and invariant |
|---|---|
| `lead_records` | One tenant-scoped canonical lead; normalized-email conflicts fail closed. |
| `lead_source_aliases` | One unique `(tenant, provider, source)` mapping to a canonical lead. |
| `lead_observation_receipts` | Immutable GET-only provenance and content digest; no raw provider body. |
| `lead_loop_tasks` | Pending, running, completed, failed, or stopped; lease and fencing required while running; terminal rows immutable. |
| `lead_spend_reservations` | Idempotent reservation identity; settlement cannot exceed reserved units; settled rows immutable. |
| `lead_provider_usage` | Immutable usage/receipt digest bound to one reservation. |
| `lead_cortex_foldbacks` | Immutable numeric derived projection with no lead ID, email, phone, alias, message, or payload column. |

## Provider risk order

The executable catalog is `composition/lead-adapters.v1.json`:

1. Explee read observer — active, GET-only, no spend, no schedule.
2. ScrapeGraphAI discover — registered disabled.
3. getleads capture/enrich — registered disabled.
4. Apollo enrichment — registered disabled.
5. Apollo engagement — registered disabled; approval, reservation, settlement, and receipt required.
6. Composio engagement — registered disabled; approval, reservation, settlement, and receipt required.
7. ElevenLabs create — registered disabled; provider side effect, approval, reservation, settlement, and receipt required.
8. Runway create — registered disabled; provider side effect, approval, reservation, settlement, and receipt required.

Catalog registration grants no network authority. Only the existing fixed Explee observer has network access in this milestone.

## Recurring schedules

`recurring_schedule.armed` and every adapter's `schedule_enabled` remain `false`. Policy evaluation refuses arming unless durable task state, idempotency keys, provider receipts, stop rules, and spend accounting all have explicit evidence. Even when those prerequisites are supplied, evaluation still returns `schedule_armed: false` and requires a separate reviewed catalog change.

This milestone does not deploy a scheduler, enable paid enrichment, generate media, enroll a sequence, send a message, or perform a live paid-provider call.
