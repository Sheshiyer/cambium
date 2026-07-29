# Organ Update Delivery v1

Status: local zero-traffic candidate

Authority: D1 Goal Graph and durable branch-transition receipts remain the
operational source of truth. Cambium compiles a read-only delivery instruction;
Hermes owns Telegram transport. Neither the portfolio registry nor this
contract can activate a tenant, approve a client consequence, or arm a
recurring schedule.

## Purpose

One authoritative organ update becomes one content-addressed, topic-aware
delivery instruction:

```text
WorkObject → Mission → Task → Run → Receipt
                                      ↓
                            organ update signal
                                      ↓
                 deterministic delivery instruction
                                      ↓
                 Hermes validation + Telegram topic
                                      ↓
                       bounded delivery receipt
```

“Proactive” is event-driven here. A new verified receipt, meaningful failure,
blocker, or drift signal may produce an update. Time passing by itself does
not. The contract therefore adds no cron and does not change the Phase 7
scheduling gate.

## Canonical organ routes

All destinations resolve through the pinned Hermes topic-map snapshot in
`workers/quests/src/telegram-routing.ts`. Topic labels in this table are
descriptive; that module remains the only Cambium runtime copy of the chat and
thread identifiers.

| Organ | Receipt-backed triggers | Default topic | Approval boundary | Capability hints |
|---|---|---|---|---|
| Genesis | brand intake, brand proof | Inbox | internal delivery | brand discovery, visual identity |
| Taste | brief, QA, reroll | Digests | review before consequential reroll | critique, quality review |
| Hands | build, verification, ship | Dev | ship remains separately gated | engineering, verification |
| Will | approved business, client delivery | Clients | client-audience delivery requires approval | proposals, delivery operations |
| Cortex | evidence, learning, drift | Agent Ops | derived learning cannot write Goal Graph | evidence, systems learning |

Statuses `blocked`, `failed`, and `drifted` override the default destination and
route only to Alerts. A mismatch never falls back to General, another topic,
another chat, or an unthreaded send.

Capability names are hints, not assignments. The Mini App may display them,
but only explicit Mission Fabric edges can claim an assigned agent, required
cluster, or pinned loadout.

## Cambium boundary

`workers/quests/src/organ-update-delivery.ts` owns normalization, deterministic
identity, digesting, workflow metadata, and topic selection. Its compiler:

- requires tenant, WorkObject, organ, trigger, status, summary, observed time,
  and proof identity;
- accepts only the five canonical organs and their declared triggers;
- resolves topics from the pinned routing snapshot;
- covers normalized input, workflow, topic-map digest, and exact message bytes
  in the delivery digest;
- returns the same delivery ID and digest for the same canonical signal;
- makes no Telegram API call and stores no bot credential.

Founder Mission Fabric responses may include the complete workflow plan and
compiled delivery detail. The current browser admits the exact pinned,
receipt-empty plan; dynamic delivery detail stays hidden until a browser
verifier can recompute its delivery and plan digests. Other authorized viewers
receive fixed aggregate counts only. Supplying malformed or digest-drifted
detail fails Mini App activation closed, leaving the legacy shell visible and
interactive.

## Hermes boundary

Hermes validates the exact v1 schema, delivery identity and digest, canonical
topic key and thread, proof identity, approval state, and message bounds before
calling Telegram. It passes the validated thread as `message_thread_id`.

The transport accepts one previously unseen delivery ID. A replay produces no
second send. A transport failure produces no delivered receipt. A successful
send returns a bounded receipt containing the delivery ID, Telegram message ID,
topic key, thread, and digest. Dry-run validates and projects the same route
without network traffic.

Will updates addressed to a client remain blocked until Cambium resolves their
`gate:<id>` reference to a founder-signed Gate record for the exact `cambium`
tenant and WorkObject in a queued or consumed state. Presence of an arbitrary
approval string is insufficient. Telegram buttons and topic messages cannot
substitute for the Mini App Gate.

## Staging and promotion

Repository tests and a zero-traffic Worker version may prove compilation,
rendering, binding parity, and rollback inputs. They do not prove a Telegram
WebView session or a live topic send.

Production traffic, bot menu configuration, and recurring schedules remain
unchanged until the founder-device read proof and signed Gate proof complete.
Promotion and rollback rehearsal stay separate operations with separate
receipts.
