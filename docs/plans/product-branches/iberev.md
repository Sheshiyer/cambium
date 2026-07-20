---
schema: cambium.product_branch_packet.v1
product_id: iberev
branch_kind: product
name: iBerev
role: Typed lead-capture proof candidate
promotion_state: proof-only
current_gate: Offline capture and identity contract proof
packet_owner: cambium
---

# iBerev Branch Packet

iBerev is a proof-only branch candidate for admitting bounded lead observations through a Thoughtseed-owned adapter contract. This packet describes offline evidence and grants no provider, credential, spend, contact, or mutation authority.

## Product Seed

| Field | Value |
| --- | --- |
| product_id | `iberev` |
| branch_kind | `product` |
| one_sentence_seed | Prove a typed capture and enrichment boundary for tenant-scoped lead observations. |
| founder_intent | Keep the getleads-style wrapper pattern inspectable before any provider is bound. |
| target_customer | Founder-led teams that need traceable prospect inputs without hidden provider authority. |
| pain_or_desire | Lead sources overlap and drift unless provenance, identity, and suppression stay explicit. |
| offer | Offline capture-contract fixtures, identity-resolution evidence, and operator-safe receipts. |
| survival_metric | One deterministic synthetic observation validates without network access. |
| better_than_survival_metric | Replay preserves provenance, tenant boundary, and suppression state. |
| GTM_channel | None while proof-only. |
| constraints | No live lookup, enrichment, spend, credentials, contact, or mutation. |
| third_party_apps | getleads.io MCP is a future adapter candidate, not an active dependency. |
| autonomy_boundary | Cambium owns tasks and receipts; the packet records evidence only. |
| approvals | Separate founder approval is required for any provider binding or live proof. |

## Organ Routing

| Organ | Owner | Input | Output | Proof Path | Current Gate |
| --- | --- | --- | --- | --- | --- |
| Genesis | Cambium | Synthetic ICP and source fixture | Bounded capture intent | Offline fixture | pending |
| Taste | Cambium review | Contract and redaction rules | Review verdict | Validator receipt | pending |
| Hands | Local tests | Deterministic fixtures | Test proof | Node test output | pending |
| Will | Disabled | No approved action | No provider call | Policy table | blocked |
| Cortex | Derived-only foldback | Sanitized aggregate | Non-authoritative learning | Future approved receipt | blocked |
| Hermes | Founder-facing intake | Redacted status | Recommendation only | Future receipt | pending |
| Garden | Manual proof cadence | Contract drift | Review task | Loop state file | pending |

## Variable Contract Payload

| Group | Current Source | Status |
| --- | --- | --- |
| `capture_contract` | Synthetic observation fixture | pending |
| `identity_contract` | Tenant-scoped alias and suppression rules | pending |
| `provider_binding` | None | verified |
| `adapter_version` | None | verified |
| `acceptance_checks` | Packet validator and offline conformance tests | pending |

## Adapter / Service Map

| Provider / Route | Inputs | Outputs | Failure Modes | Tenant Mapping | Privacy Boundary |
| --- | --- | --- | --- | --- | --- |
| Offline fixture | Synthetic company facts | Typed provider observation | Schema drift or invalid provenance | Fixed synthetic tenant | No raw contact data |
| Future getleads wrapper | Not bound | No runtime output | Must fail closed | Server-side only | Credentials and caller routing forbidden |

## Evidence Ledger

| Status | Evidence |
| --- | --- |
| verified | This packet declares no active provider binding, adapter version, or mutation authority. |
| pending | Deterministic capture and identity fixtures remain to be bound to an L1 adapter slice. |
| blocked | Live provider traffic, paid enrichment, and contact actions are outside L0 scope. |

## Gate Ledger

| Gate | Status | Required Proof |
| --- | --- | --- |
| Contract fixture | pending | Offline deterministic capture receipt. |
| Provider binding | blocked | Versioned adapter review and separate authorization. |
| Privacy | blocked | Data classification, retention, suppression, and redaction proof. |
| Mutation | blocked | Exact action approval plus writer and reconciliation controls. |

## Quest Queue

1. Validate one synthetic capture observation offline.
2. Prove caller routing overrides are rejected.
3. Preserve suppression through identity replay.
4. Request separate approval before any live provider proof.

## Loop Control Inputs

| loop_id | title | cadence | objective | metric | boundary_color | one_change_rule | state_file | stop_rule | model_route | proof_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iberev-contract-proof-loop | iBerev contract proof loop | manual | Improve one offline capture boundary. | One contract finding per round. | green | Select exactly one contract fixture. | .operator/branch-loops/iberev-contract-proof-loop.md | Stop after one finding or missing evidence. | local deterministic validator | Test receipt or blocked-control note. |

## Branch Story Controls

| Control | Value |
| --- | --- |
| arc_title | `Capture Without Authority` |
| vision | Lead observations enter a typed tenant boundary without granting provider control. |
| icp | Founder-led operator needing traceable lead capture. |
| current_frontier | Offline capture, identity, suppression, and replay proof. |
| narrative_voice | Contract reviewer: bind provenance, reject overrides, preserve suppression. |
| anti_claims | Do not claim live provider access, verified contacts, deliverability, or enrichment. |

## Mission Control Inputs

| mission_id | title | type | owner | gate | proof_required | dispatch_target |
| --- | --- | --- | --- | --- | --- | --- |
| iberev-offline-capture | Prove synthetic capture contract | proof | codex | Contract fixture | Deterministic offline receipt | cambium |

## KPI Control Inputs

| kpi_id | label | survival | better_than_survival | source | current_state |
| --- | --- | --- | --- | --- | --- |
| iberev-contract-valid | Capture contract validity | one fixture validates | replay preserves suppression | local tests | pending |

## Policy / Permission Inputs

| permission | status | required_approval | failure_mode |
| --- | --- | --- | --- |
| provider observation | blocked | founder approves fixed-tenant L1 adapter | remain offline |
| provider mutation | blocked | exact-action approval and writer controls | no mutation |

## Dispatch Inputs

| route | payload_hint | allowed_when | blocked_when |
| --- | --- | --- | --- |
| cambium-local-proof | Synthetic observation fixture only | local validator is available | network, credentials, or caller routing are requested |

## Proof Foldback

| proof_id | source_path | validates | promotes |
| --- | --- | --- | --- |
| iberev-offline-proof | future local fixture receipt | capture boundary and replay behavior | review only; no runtime authority |

## Provider / Data Policy

| Field | Value |
| --- | --- |
| subgraph_version | `lead-ops@1.0.0` |
| stage_capabilities | `capture:lead-admission@1.0.0, enrich:identity-resolution@1.0.0` |
| provider_binding | `none` |
| adapter_version | `none` |
| mutation_enabled | `false` |
| data_classification | `synthetic` |
| processing_region | `none` |
| purpose | Offline synthetic capture and identity contract proof only. |
| retention | `none` |
| suppression_policy | No contact; suppression always dominates identity and approval. |

## Promotion Rule

iBerev remains `proof-only`. The ladder is `proof-only -> supervised branch -> autonomous branch`.

Do not promote it before offline conformance, fixed-tenant binding, privacy controls, founder approval, and a separately authorized live proof.
