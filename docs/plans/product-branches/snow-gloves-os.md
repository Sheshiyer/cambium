---
schema: cambium.product_branch_packet.v1
product_id: snow-gloves-os
canonical_work_id: program:snow-gloves-os
identity_scope: canonical-work-object
branch_kind: internal-service
name: Snow Gloves OS
role: Will-organ service
promotion_state: organ-service
current_gate: Service contract and GTM approval gate
packet_owner: cambium
---

# Snow Gloves OS Branch Packet

Snow Gloves OS is represented in Cambium as a Will-organ service packet, not a standalone app autonomy packet. The inspected evidence supports a tenant-scoped operations service candidate with alpha/proof gates still open.

Owning repository task: [`Sheshiyer/snow-gloves-os#8`](https://github.com/Sheshiyer/snow-gloves-os/issues/8). Cambium retains cross-portfolio sequencing; the owning repository now holds implementation and local proof.

## Product Seed

| Field | Value |
| --- | --- |
| product_id | `snow-gloves-os` |
| branch_kind | `internal-service` |
| one_sentence_seed | Tenant-scoped business-operations layer that routes apps, knowledge, judgment, and orchestration through auditable approval-gated flows. |
| founder_intent | Bind Snow Gloves OS into Cambium as the Will-organ service for tenant operations and GTM routines. |
| target_customer | Internal operator/founder plus tenant businesses; inspected tenant surfaces include `tryambakam-noesis` and a provisioned `mathis` property-listing use case. |
| pain_or_desire | Tenant operations need scoped connectors, audit logs, task routing, and human approval before high-risk actions. |
| offer | Onboard a tenant, bind scoped connectors, ingest sources, route events through agents, create Hermes tasks, queue when Hermes is down, redact audit logs, and require approvals. |
| survival_metric | One tenant runs through a clean smoke with approval-gated task creation and redacted audit evidence. |
| better_than_survival_metric | One tenant runs a live approved GTM routine with Hermes proof foldback. |
| GTM_channel | Internal Will-organ enablement first, then tenant-specific GTM operation after approval. |
| constraints | Treat as organ-service; no standalone app autonomy claim; tenant isolation and approvals remain non-negotiable. |
| third_party_apps | Gmail, Google Calendar, Google Drive, Slack, PMS, accounting, HRIS, Explee proxy, NVIDIA NIM embeddings, Hermes local bus, GitHub Actions/Releases, Tauri updater/signing. |
| autonomy_boundary | Agents can route and queue work; high-risk capabilities require human approval and runtime proof. |
| approvals | Connector activation, tenant source binding, high-risk actions, live GTM sends, spend, and production release. |

## Organ Routing

| Organ | Owner | Input | Output | Proof Path | Current Gate |
| --- | --- | --- | --- | --- | --- |
| Genesis | Tenant manifests and source maps | Tenant/service seed | Tenant operating context | Tenant manifest and config docs | pending explicit Will binding |
| Taste | Cambium taste/operator review | Tenant-facing messages and GTM assets | Fit/reroll verdict | Future review packet | pending |
| Hands | Snow Gloves OS repo | Service wiring and connector tasks | Code/tests/release changes | Repo tests and CI | pending clean test proof |
| Will | Snow Gloves OS | Events, sources, approvals, tenant capabilities | Routed operations and GTM actions | Smoke, audit logs, approval proof | blocked by live approval proof |
| Cortex | Cambium/Cortex memory | Tenant lessons and operational proof | Searchable operations memory | `docs/evidence/2026-08-12-cambium-branch-cortex-ingestion.v1.json` | complete |
| Hermes | Hermes local bus | Task/report events | Founder-facing proof and route summaries | Hermes proof receipts | pending |
| Garden | Operating cadence | Tenant health and GTM outcomes | Follow-up routines | Future pulse log | pending |

## Variable Contract Payload

| Group | Current Source | Status |
| --- | --- | --- |
| `brand_system` | Tenant manifests and brand-enriched AutoGTM specs | pending per tenant |
| `copy_system` | AutoGTM and tenant messaging docs | pending approval |
| `visual_system` | Not primary for Will-organ service | no-signal |
| `asset_plan` | Tenant source artifacts and GTM collateral | pending |
| `section_plan` | Service flow, event routing, Hermes task creation | verified from inspected docs |
| `interaction_plan` | Approval gates, event routing, queue fallback, redacted audit logs | pending live approval proof |
| `acceptance_checks` | `make doctor`, `make smoke`, `make test`, CI smoke/test references | pending clean checkout run |

## Adapter / Service Map

| Provider / Route | Inputs | Outputs | Failure Modes | Tenant Mapping | Privacy Boundary |
| --- | --- | --- | --- | --- | --- |
| Capability registry | OAuth/API-key refs and tenant config | Scoped connector access | Missing runtime secret bind, overbroad capability | tenant manifest and capability scope | Secret values stay in vault refs |
| Hermes | Approved task payloads | Tasks and reports | Hermes down, queue fallback needed | tenant and task id | PII and tokens redacted in audit logs |
| Hermes local bus | Events and branch reports | Founder delivery and proof summaries | Bus unavailable or stale routing | tenant/service topic | Approval policy must survive routing |
| Explee proxy / AutoGTM | Brand docs and GTM input | GTM candidates and outputs | Unapproved live sends, stale tenant source | tenant-specific sources | High-risk actions require approval |
| NVIDIA NIM embeddings | Source text and retrieval requests | Semantic retrieval | Missing provider config or privacy mismatch | tenant index | Tenant isolation required |

## Evidence Ledger

| Status | Evidence |
| --- | --- |
| verified | `snow-gloves-os/README.md`, `docs/explainer.md`, `config/snowgloves.yaml`, orchestration specs, AutoGTM specs, and tenant manifest were inspected read-only by the product-context agent. |
| verified | Docs define `make doctor`, `make smoke`, `make test`, `make app-build`; CI references `pytest -q tests/` and `make smoke` with stub embeddings. |
| verified | Specs show AutoGTM deterministic wiring has evidence, but not full live tenant operations. |
| verified | Cortex receipt-derived read model records Snow Gloves OS among five canonical packets with semantic recall verified. Redacted summary: `docs/evidence/2026-08-12-cambium-branch-cortex-ingestion.v1.json`. |
| pending | The commands were not run in this Cambium packet pass because the checkout reportedly had runtime/generated dirt. |
| blocked | Runtime secret bind, live approval enforcement, clean smoke/test proof, and distribution OS proof remain open. |
| no-signal | No proof supports autonomous standalone product readiness. |

## Gate Ledger

| Gate | Status | Required Proof |
| --- | --- | --- |
| Human approvals | blocked | Live approval-gate test for high-risk capabilities. |
| Spend approvals | pending | Approval before paid provider or distribution actions. |
| Privacy/legal | pending | Tenant isolation, redaction, and source-retention proof. |
| Payment | no-signal | No payment flow evidenced for this service packet. |
| Customer contact | blocked | Approved tenant GTM send and audit trail. |
| Public claims | blocked | Do not claim production OS readiness until clean test, smoke, connector, and approval evidence exist. |
| Credentials | blocked | Runtime secret binding must be proven without exposing secret values. |

## Quest Queue

1. Clean or isolate the Snow Gloves OS checkout for proof.
2. Run `pytest`, `make smoke`, and relevant service checks with receipts.
3. Prove runtime secret binding with redacted output.
4. Run a live approval-gate test for a high-risk capability.
5. Bind the Will-organ tenant/source contract explicitly in Cambium.
6. Prove Hermes queue fallback and recovery.
7. Archive the first tenant GTM proof with Hermes proof foldback.

Current frontier: service contract and GTM approval gate.

Garden cadence: tenant operations pulse only after live approval proof exists.

Cortex ingestion targets: this packet, Snow Gloves OS README/explainer/config/spec receipts, tenant manifests, and approved GTM proof.

First real pilot proof: one tenant operation routed through approval, Hermes proof foldback, redacted audit log, and smoke/test receipts.

## Loop Control Inputs

| loop_id | title | cadence | objective | metric | boundary_color | one_change_rule | state_file | stop_rule | model_route | proof_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| snow-gloves-os-approval-loop | Snow Gloves OS approval-gate loop | manual weekly until Will-organ approval proof exists | Prove one clean service, approval-gate, or Hermes foldback condition for the Will-organ service packet. | One clean smoke receipt, approval audit receipt, or foldback receipt is captured per round. | red | Select exactly one proof action and never execute high-risk tenant operations without explicit approval. | .operator/branch-loops/snow-gloves-os-approval-loop.md | Stop after 2 blocked approval checks, after a live approval-gate proof is archived, or before any connector activation request. | cheap-first; escalate for approval-policy reasoning only | Redacted smoke/test receipt, approval decision, queued task receipt, or foldback report path. |

## Branch Story Controls

| Control | Value |
| --- | --- |
| arc_title | `Will Organ Service Binding` |
| vision | Snow Gloves OS becomes the approval-gated Will-organ service that routes tenant operations with auditable proof and no standalone autonomy claim. |
| icp | Internal founder/operator or tenant operations lead who needs scoped connectors and approval-backed GTM or service actions. |
| current_frontier | Clean smoke/test proof, runtime secret binding, approval-gate proof, Hermes foldback, and tenant source binding. |
| narrative_voice | Operations controller voice: bind capabilities, request approval, run the route, redact the evidence. |
| anti_claims | Do not claim production OS readiness, autonomous GTM, or connector safety until clean proof and approval enforcement exist. |

## Mission Control Inputs

| mission_id | title | type | owner | gate | proof_required | dispatch_target |
| --- | --- | --- | --- | --- | --- | --- |
| snow-gloves-os-clean-smoke | Run clean service smoke and tests | proof | codex | Clean checkout proof | `make smoke` and test receipts with generated dirt isolated | cambium |
| snow-gloves-os-approval-gate | Prove live high-risk approval gate | proof | founder/codex | Human approvals | redacted audit log plus approval decision | hermes |
| snow-gloves-os-hermes-foldback | Prove Hermes queue and recovery foldback | proof | codex | Foldback proof | task queue receipt plus Hermes report | plexus-agent-fabric |

## KPI Control Inputs

| kpi_id | label | survival | better_than_survival | source | current_state |
| --- | --- | --- | --- | --- | --- |
| snow-gloves-os-approval-proof | Approval-gated operation proof | one high-risk action is blocked until approval | approved action runs and emits redacted audit evidence | service smoke and audit log | blocked |
| snow-gloves-os-tenant-foldback | Tenant operation foldback | one tenant operation reports through Hermes | queue fallback and recovery are proven | Hermes receipts | pending |

## Policy / Permission Inputs

| permission | status | required_approval | failure_mode |
| --- | --- | --- | --- |
| connector activation | blocked | founder approves scoped connector capability | no live connector action dispatch |
| high-risk action | blocked | founder approves exact action and tenant scope | operation must remain queued/blocked |
| tenant source binding | pending | founder approves source map and retention boundary | context ingestion stays incomplete |
| public OS claims | blocked | clean proof and approval enforcement accepted | packet remains organ-service only |

## Dispatch Inputs

| route | payload_hint | allowed_when | blocked_when |
| --- | --- | --- | --- |
| cambium-bridge-assignment | `snow-gloves-os-clean-smoke` as organ-service proof task | clean checkout or isolated worktree exists | runtime/generated dirt cannot be isolated |
| hermes-topic-assignment | `snow-gloves-os-approval-gate` with approval boundary | high-risk action scope is explicit | approval policy is not available |
| plexus-agent-fabric | `snow-gloves-os-hermes-foldback` for report workflow | Hermes route and recovery target are named | Hermes is unavailable without queue proof |

## Proof Foldback

| proof_id | source_path | validates | promotes |
| --- | --- | --- | --- |
| snow-gloves-os-smoke-proof | future smoke/test receipt | service can run checks in clean state | keeps organ-service candidate active |
| snow-gloves-os-approval-proof | future redacted approval audit | high-risk actions require approval | unlocks Will-organ service confidence, not standalone autonomy |
| snow-gloves-os-foldback-proof | future Hermes report | task/report events survive queue and recovery | supports branch service proof ledger |

## Promotion Rule

Snow Gloves OS is currently `organ-service`. The product ladder remains `proof-only -> supervised branch -> autonomous branch`, but this packet is an internal Will-organ service and should not be promoted as standalone app autonomy.

Do not promote Snow Gloves OS beyond organ-service until clean test/smoke proof, runtime secret bind, live approval enforcement, and tenant/source binding are complete.
