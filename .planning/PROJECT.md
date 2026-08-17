# Cambium Managerial Control Loop

## What This Is

Cambium is the operator-facing projection and durable control plane for Thoughtseed's living venture system. Milestone v0.3 proved one synthetic, internal-only service-agreement flow from typed intake through D1 leasing, Hermes execution, Temperance rendering, durable storage, and authenticated readback. The next milestone makes the enduring vision, renewable mission, finite goals, and evidence feedback loop explicit without creating another operational writer.

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

## Current State

- **Shipped:** v0.3 Managerial Control Loop on 2026-08-17.
- **Historical proof:** two completed phases, two plans, and eleven checked requirements.
- **Accepted process debt:** the historical phases predate current GSD `VERIFICATION.md` files; their live evidence remains summary-attested and is archived in the milestone audit.
- **Active authority:** the root `ISA.md` owns the approved infinite-game documentation goal. This planning file does not replace it.

## Next Milestone Goals

- Establish canonical root `VISION.md` and renewable root `MISSION.md`.
- Keep ISA and GSD as the only goal and planning authorities.
- Model vision → mission → finite goals → tasks → evidence → learning as a provenance-preserving fractal graph.
- Distinguish the repository-level Mission from bounded `FabricMission` nodes.
- Expose Ralph next actions, skill-cluster and OmniRoute routes, gates, freshness, and stop conditions through Temperance without copying doctrine into the manifest.
- Consolidate and reorganize the named root, `MEMORY/`, and `docs/` corpus without deleting historical evidence or promoting plans into current instructions.

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
*Last updated: 2026-08-17 after v0.3 milestone archival*
