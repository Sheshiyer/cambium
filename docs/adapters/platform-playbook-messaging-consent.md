# Platform-playbook messaging consent adapter

**Status:** controlled dry-run only
**Authority:** Cambium validates local consent and policy readiness. Hermes retains Telegram route and future transport ownership.
**Official policy input:** WhatsApp Business Messaging Policy, updated 2026-09-23 and reviewed 2026-09-27.

## Boundary

The adapter reads a bounded local intent and emits one redacted readiness receipt. It does not make a network request, connect an account, verify a provider record, send a message, create a template, modify a recipient preference, schedule work, or store durable state.

Recipients are represented only by opaque `recipient:<hex>` references. The receipt excludes recipient reference and message body while retaining deterministic message and intent digests.

## Channel rules

### Telegram internal

The intent contains a valid Stage 3 readiness receipt for the same Agent Ops route and message digest. Stage 4 preserves the `networkSend: false` transport boundary.

### WhatsApp Business

The adapter requires active consent with evidence references, category-scoped opt-in with a separate evidence reference for each selected category, a fresh clear opt-out check, source proof, approved template conditions, human escalation, business profile, privacy notice, and an evidence-backed `general` content-classification reference. An opt-out, stale preference, missing category evidence, missing required template, missing escalation/profile/privacy/classification reference, or regulated/restricted classification fails closed.

WhatsApp transport remains unconfigured even when a local receipt is eligible.

## Verification

```bash
node --test workers/quests/src/platform-playbook-messaging-consent.test.ts
```

The tests verify redaction, deterministic digest receipts, strict keys, no direct recipient identifier, opt-out enforcement, stale preference handling, category consent, template and service-window behavior, human escalation, business profile, privacy notice, policy freshness, regulated-content refusal, and zero transport capability.
