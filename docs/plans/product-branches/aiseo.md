---
schema: cambium.product_branch_packet.v1
product_id: aiseo
branch_kind: product
name: AISEO
role: AI-assisted SEO proof candidate
promotion_state: proof-only
current_gate: Source-bound search workflow proof
packet_owner: cambium
---

# AISEO Branch Packet

AISEO is a proof-only branch candidate for source-bound search discovery, intent analysis, and content planning. It installs no capability, calls no scraper, publishes nothing, and grants no provider or mutation authority.

## Product Seed

| Field | Value |
| --- | --- |
| product_id | `aiseo` |
| branch_kind | `product` |
| one_sentence_seed | Prove a traceable SEO research-to-content contract using synthetic observations. |
| founder_intent | Turn marketing methods into governed Cambium tasks rather than a second scheduler. |
| target_customer | Teams needing repeatable SEO research tied to citations and approval gates. |
| pain_or_desire | Automated SEO output becomes unsafe when sources, freshness, and publication authority disappear. |
| offer | Offline market observations, intent hypotheses, and draft content-asset contracts. |
| survival_metric | One source-linked synthetic research packet validates. |
| better_than_survival_metric | One draft asset carries provenance, rights, expiry, and approval state. |
| GTM_channel | None while proof-only. |
| constraints | No scraping, provider spend, public claims, publishing, or outreach. |
| third_party_apps | ScrapeGraphAI and marketingskills are future provider/capability candidates only. |
| autonomy_boundary | Cambium schedules and approves; capabilities advise; providers remain unbound. |
| approvals | Source use, spend, asset rights, public claims, and publication require separate approval. |

## Organ Routing

| Organ | Owner | Input | Output | Proof Path | Current Gate |
| --- | --- | --- | --- | --- | --- |
| Genesis | Cambium | Synthetic market question | Research intent | Offline fixture | pending |
| Taste | Marketing review | Sources and draft brief | Quality verdict | Review note | pending |
| Hands | Local tests | Contract fixtures | Validation receipt | Node test output | pending |
| Will | Disabled | No approved publication | No action | Policy table | blocked |
| Cortex | Derived-only foldback | Sanitized aggregate | Non-authoritative learning | Future approved receipt | blocked |
| Hermes | Founder-facing intake | Redacted recommendation | Status only | Future receipt | pending |
| Garden | Manual cadence | Source drift | One review task | Loop state file | pending |

## Variable Contract Payload

| Group | Current Source | Status |
| --- | --- | --- |
| `market_observation` | Synthetic search surface | pending |
| `intent_hypothesis` | Source-linked offline analysis | pending |
| `content_asset` | Draft-only contract | pending |
| `provider_binding` | None | verified |
| `acceptance_checks` | Packet and catalog validators | pending |

## Adapter / Service Map

| Provider / Route | Inputs | Outputs | Failure Modes | Tenant Mapping | Privacy Boundary |
| --- | --- | --- | --- | --- | --- |
| Offline source fixture | Synthetic query and citations | Market observation | Stale or missing provenance | Fixed synthetic tenant | Public synthetic data only |
| Future scrape adapter | Not bound | No runtime output | Must fail closed | Server-side only | No credentials or caller routing |
| Capability methods | Version-pinned methods | Draft critique | Stale or conflicting guidance | Non-authoritative | No task or provider authority |

## Evidence Ledger

| Status | Evidence |
| --- | --- |
| verified | Packet policy sets provider binding and adapter version to none, with mutation false. |
| pending | Source-linked research and content fixtures remain offline. |
| blocked | Scraping, generation spend, publishing, and public claims are not authorized. |

## Gate Ledger

| Gate | Status | Required Proof |
| --- | --- | --- |
| Source provenance | pending | Citation, observation time, and freshness receipt. |
| Asset rights | blocked | Rights and source-use review. |
| Provider binding | blocked | Versioned adapter and separate authorization. |
| Publication | blocked | Exact asset digest and founder approval. |

## Quest Queue

1. Validate one synthetic search observation.
2. Produce one source-linked intent hypothesis.
3. Validate one draft content-asset contract.
4. Stop before provider access or publication.

## Loop Control Inputs

| loop_id | title | cadence | objective | metric | boundary_color | one_change_rule | state_file | stop_rule | model_route | proof_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| aiseo-source-proof-loop | AISEO source proof loop | manual | Improve one source-bound SEO contract. | One source finding per round. | green | Select exactly one source fixture. | .operator/branch-loops/aiseo-source-proof-loop.md | Stop after one finding or missing provenance. | local deterministic validator | Source receipt or blocked-control note. |

## Branch Story Controls

| Control | Value |
| --- | --- |
| arc_title | `Search Evidence Before Content` |
| vision | SEO research becomes a governed, cited input to draft assets. |
| icp | Operator needing traceable SEO decisions without autonomous publishing. |
| current_frontier | Offline source, intent, asset, and approval contract proof. |
| narrative_voice | Research editor: cite sources, expose uncertainty, hold publication. |
| anti_claims | Do not claim rankings, traffic lift, source coverage, or live automation. |

## Mission Control Inputs

| mission_id | title | type | owner | gate | proof_required | dispatch_target |
| --- | --- | --- | --- | --- | --- | --- |
| aiseo-offline-research | Prove source-bound research contract | proof | codex | Source provenance | Deterministic offline receipt | cambium |

## KPI Control Inputs

| kpi_id | label | survival | better_than_survival | source | current_state |
| --- | --- | --- | --- | --- | --- |
| aiseo-source-valid | Source contract validity | one fixture validates | draft asset preserves citations | local tests | pending |

## Policy / Permission Inputs

| permission | status | required_approval | failure_mode |
| --- | --- | --- | --- |
| provider observation | blocked | founder approves fixed adapter | remain offline |
| asset publication | blocked | founder approves exact digest and destination | draft only |

## Dispatch Inputs

| route | payload_hint | allowed_when | blocked_when |
| --- | --- | --- | --- |
| cambium-local-proof | Synthetic source fixture only | local validator is available | network, spend, or publication is requested |

## Proof Foldback

| proof_id | source_path | validates | promotes |
| --- | --- | --- | --- |
| aiseo-offline-proof | future fixture receipt | source and content contract boundary | review only; no runtime authority |

## Provider / Data Policy

| Field | Value |
| --- | --- |
| subgraph_version | `lead-ops@1.0.0` |
| stage_capabilities | `discover:market-observation@1.0.0, understand:search-intent@1.0.0, create:content-asset@1.0.0` |
| provider_binding | `none` |
| adapter_version | `none` |
| mutation_enabled | `false` |
| data_classification | `synthetic` |
| processing_region | `none` |
| purpose | Offline synthetic search and content contract proof only. |
| retention | `none` |
| suppression_policy | No contacts or outbound actions; suppression dominates every later stage. |

## Promotion Rule

AISEO remains `proof-only`. The ladder is `proof-only -> supervised branch -> autonomous branch`.

Do not promote it before source provenance, asset rights, versioned bindings, exact publication approval, and separate live proof.
