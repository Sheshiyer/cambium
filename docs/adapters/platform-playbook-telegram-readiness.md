# Platform-playbook Telegram readiness adapter

**Status:** controlled dry-run only
**Authority:** Cambium owns readiness validation; Hermes owns the topic map and any future Telegram transport.
**Effective date:** 2026-09-27

## Boundary

This adapter converts one source-backed Cambium platform-playbook proposal into a deterministic, local `cambium.platform-playbook-telegram-readiness-receipt.v1` record. It performs zero network, Telegram, Bot API, bridge, queue, schedule, D1, KV, or Goal Graph operations.

The adapter accepts only the Hermes-pinned **Agent Ops** topic route. It requires an exact thread ID, a bounded plain-text message containing an existing `/ts-*` next action, and a proof reference plus SHA-256 digest. It strips the message body from its output receipt.

## Future transport approval

A future-send approval must bind all of these fields:

- a stable approval reference and named approver;
- approval timestamp and expiry within 30 minutes;
- exact proposal ID and proposal digest;
- `telegram:send:agent_ops` scope;
- exact Agent Ops topic and thread;
- exact message digest.

Even a valid approval leaves `networkSend: false` and `executionAllowed: false` in this implementation. A future Hermes-owned transport task must separately prove managed credential readiness and store a transport response receipt.

## Verification

```bash
node --test workers/quests/src/platform-playbook-telegram-readiness.test.ts
```

The deterministic tests cover missing/invalid/expired approval, strict topic/thread routing, next-action requirement, secret-shaped input rejection, message size limit, body-redacted receipts, and transport denial.
