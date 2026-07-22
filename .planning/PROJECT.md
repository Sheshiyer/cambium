# Cambium Managerial Control Loop

## What This Is

Cambium is the operator-facing projection and durable Cloudflare control plane for Thoughtseed managerial workflows. This recovery milestone proves one real business flow—a synthetic, internal-only service-agreement draft—from typed intake through D1 leasing, Hermes execution, Temperance policy and rendering, durable artifact storage, and authenticated readback.

## Core Value

An operator action counts only when its authoritative task, lease, artifact, outcome, and readback are durable and replay-safe.

## Requirements

### Validated

- ✓ D1 owns native execution claims, fencing, terminal outcomes, and ACK eligibility — native execution proof release.
- ✓ Hermes polls the Worker on a durable timer and persists local attempt state — native execution proof release.
- ✓ REQ-01–REQ-06 prove one replay-safe D1-leased synthetic service-agreement draft from strict intake through immutable artifact readback.
- ✓ REQ-07–REQ-11 expose that same slice through feature-gated Telegram intake and a redacted D1 status projection, with live replay, rollback, allowlist, and access-revocation proof.

### Out of Scope

- External delivery, email, publication, e-signature, or signature requests — this slice stops at awaiting human approval.
- A real client agreement — the live canary uses a synthetic counterparty and creates no legal commitment.
- General-purpose shell or model execution — only one typed document command is enabled.
- Replacing Hermes, D1, Cambium, GSD, or the existing headless Temperance shadow runtime.

## Context

The July ecosystem audit found that direct agent and CLI primitives work while the operator path breaks at routing, state, renderer selection, and proof foldback. Native D1 claim/outcome and a route-only Temperance release are already live; this milestone connects the next bounded business command across those existing seams.

## Constraints

- **Authority**: D1 owns task identity, lease, fencing, and terminal status.
- **Execution**: Hermes remains the only durable EC2 poller and supervisor.
- **Rendering**: Temperance must pin the Thoughtseed Contract Generator and DOCX renderer policies.
- **Safety**: The canary must remain synthetic, non-signable, and internal-only.
- **Storage**: D1 stores metadata and R2 stores immutable document bytes.
- **Compatibility**: Existing `canary.record` behavior and all legacy Worker routes must remain green.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use one typed `service_agreement.draft.render` command | Prevents general executor scope and makes validation exhaustive | ✓ Proven |
| Stop at `awaiting_human_approval` | Proves the business pipeline without authorizing a legal side effect | ✓ Proven |
| Store bytes in `thoughtseed-vault` R2 and receipts in D1 | Separates artifact storage from transactional authority | ✓ Proven |
| Keep legacy `.planning` GSD for this milestone | Matches existing project and recovery architecture | ✓ Proven |
| Treat Telegram as an adapter over the existing D1 loop | Avoids creating another orchestrator or execution authority | ✓ Proven |

---
*Last updated: 2026-07-17 after Telegram operator-intake proof*
