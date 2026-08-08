---
schema: cambium.product_branch_packet.v1
product_id: dlock
branch_kind: product
name: DLOCK
role: Smart lock and self-storage software product candidate
promotion_state: proof-only
current_gate: Map live landing, repository, hardware assets, and TUYA integration evidence before supervised launch work
packet_owner: cambium
---

# DLOCK Branch Packet

DLOCK is a proof-only Cambium Sapling for smart digital locks and self-storage
management software. The current evidence supports a live landing page,
hardware-resource catalog, and repository identity, not yet live product
operations, billing readiness, access-control correctness, or customer proof.

## Product Seed

| Field | Value |
| --- | --- |
| product_id | `dlock` |
| branch_kind | `product` |
| one_sentence_seed | Bluetooth and IoT keypad locks plus a self-storage facility dashboard for units, tenants, billing, payments, and physical access. |
| founder_intent | Treat DLOCK as a new Sapling and map resources like Fitcheck and IVerif before active execution. |
| target_customer | Self-storage facility owners and operators managing unit access, tenants, billing, and staff operations. |
| pain_or_desire | Operators need to remove physical key handling, reduce spreadsheet drift, automate access changes, and keep unit/payment state synchronized. |
| offer | Smart keypad lock hardware, TUYA/Bluetooth access foundation, facility dashboard, tenant records, billing, payments, access logs, and staff permissions. |
| survival_metric | One operator joins early access or confirms a pilot facility workflow with required hardware and access-control assumptions. |
| better_than_survival_metric | One pilot facility proves unit rental, payment state, PIN issuance, access logging, and move-out access removal end to end. |
| GTM_channel | Live Vercel waitlist page, founder-led storage-operator conversations, and hardware-backed pilot qualification. |
| constraints | Do not claim access-control reliability, billing readiness, security certification, or TUYA production integration until each is evidenced. |
| third_party_apps | Vercel, GitHub, TUYA, Bluetooth/IoT lock hardware, future billing/payment provider, future notification/provider integrations. |
| autonomy_boundary | Proof-only until access-control, billing/payment, privacy/security, and pilot-operation proof are separated and reviewed. |
| approvals | Hardware model approval, TUYA/native integration plan, payment provider approval, privacy/security wording, pilot facility approval, and public claim approval. |

## Organ Routing

| Organ | Owner | Input | Output | Proof Path | Current Gate |
| --- | --- | --- | --- | --- | --- |
| Genesis | DLOCK landing and repository evidence | Live product promise, hardware models, facility-management flow | `brand_system`, `copy_system`, `hardware_resource_map` | Live landing page and `lockwell-portal` repository identity | verified for packet only |
| Taste | Cambium taste/product review | Landing copy, hardware gallery, page hierarchy, trust claims | Copy and claim review | Future source-linked claim review | pending |
| Hands | DLOCK repository and future native/TUYA work | Repo review, build proof, TUYA/native integration plan | Implementation proof and adapter boundary | Future repository commands and integration receipt | blocked |
| Will | Founder/operator GTM | Approved pilot offer and lead workflow | Pilot outreach and waitlist follow-up | Future approval log | blocked |
| Cortex | Cambium evidence memory | Resource map, claim table, pilot learnings | Searchable DLOCK proof memory | Future ingestion | pending |
| Hermes | Founder-facing reports | Mapping decisions and action requests | Proof summary and next gate | Future report | pending |
| Garden | Product cadence | Evidence state and pilot blockers | Weekly proof loop | Future pulse | pending |

## Variable Contract Payload

| Group | Current Source | Status |
| --- | --- | --- |
| `brand_system` | Live DLOCK landing page at `https://dlock-lp.vercel.app/` | verified for packet |
| `copy_system` | Landing page product, FAQ, waitlist, and facility-management copy | pending claim review |
| `visual_system` | Live page hardware photos and self-storage imagery | pending asset provenance review |
| `hardware_resource_map` | Landing page model families `EKPL2`, `EKKB2-TY`, and `SMKB2-BT` | verified as page resources only |
| `section_plan` | Landing sections for smart lock, specifications, software, remote access, workflow, scale, security, FAQ, waitlist, and contact | verified for page map |
| `interaction_plan` | Waitlist form and contact path | pending lead-handler proof |
| `acceptance_checks` | Repository identity and live HTTP 200 page read | pending repository build/test proof |

## Adapter / Service Map

| Provider / Route | Inputs | Outputs | Failure Modes | Tenant Mapping | Privacy Boundary |
| --- | --- | --- | --- | --- | --- |
| Vercel landing | DLOCK landing source and deployment env | Public page, waitlist/contact surface, hardware gallery | Artifact drift, missing lead handler, unreviewed claims | `dlock` | No provider secrets or submitted lead data in packet |
| GitHub repository | `thoughtseed-labs/lockwell-portal` | Source/planning authority candidate | Private repo not yet locally checked out, missing build proof | `sapling:dlock` | Repository metadata only |
| TUYA platform | Device pairing, gateway, remote access, activity sync | Lock connectivity and access events | Wrong device binding, gateway unavailable, unverifiable remote unlock, overbroad permissions | future `dlock` integration | Do not store TUYA credentials or device secrets in docs |
| Bluetooth lock hardware | Keypad/PIN, BLE commands, battery, access logs | Local unlock and event capture | Device mismatch, battery/runtime drift, unlock latency claims without proof | hardware resource map | Do not expose device identifiers or tenant PINs |
| Future billing/payment provider | Rental, invoice, payment state | Payment status that can affect access | Access revoked incorrectly, billing provider drift, refund/legal gaps | future pilot tenant | Payment data and PII stay outside packet |

## Evidence Ledger

| Status | Evidence |
| --- | --- |
| verified | Live page `https://dlock-lp.vercel.app/` returns HTTP 200 from Vercel and identifies the product as "Smart Digital Locks + Self-Storage Software." |
| verified | Live page states DLOCK pairs Bluetooth and IoT keypad locks with self-storage management, unit tracking, tenant billing, rent collection, and physical access. |
| verified | Live page lists hardware/resource families `EKPL2`, `EKKB2-TY`, and `SMKB2-BT`, plus `/dlock/...` image resource paths and `/self-storage/...` imagery. |
| verified | GitHub repository `thoughtseed-labs/lockwell-portal` resolves as private, non-fork, not GitHub-archived, default branch `main`, repository id `R_kgDOP5AZyQ`, pushed `2025-09-29T12:52:14Z`. |
| blocked | No local shallow Project folder named `dlock` or `lockwell` exists under `$PROJECTS_ROOT/thoughtseed`; root-map folder admission is not yet evidenced. |
| blocked | Repository build/test, lead-handler proof, TUYA integration proof, billing/payment proof, and access-control safety proof are not yet established. |
| no-signal | No pilot facility proof, customer payment proof, or live lock-operation receipt exists in this packet pass. |

## Gate Ledger

| Gate | Status | Required Proof |
| --- | --- | --- |
| Human approvals | pending | Founder approval for DLOCK Sapling mapping, pilot scope, and public claims. |
| Hardware model approval | pending | Confirm approved lock/key-box models and source of product photos/specs. |
| TUYA/native integration | blocked | Architecture note for TUYA API/native SDK boundary, credential handling, and device testing. |
| Privacy/security | blocked | Access logs, tenant data, staff permissions, PIN handling, and audit-log wording need evidence. |
| Payment | blocked | Payment provider, billing state model, refund/late-fee handling, and access revocation proof. |
| Customer contact | blocked | Approved waitlist follow-up or pilot outreach copy and target list. |
| Public claims | blocked | No reliability, encryption, battery-life, unlock-latency, uptime, or billing automation claim without direct proof. |
| Credentials | blocked | TUYA, payment, deployment, and lead-handler credentials stay outside the packet. |

## Quest Queue

1. Clone or attach the canonical DLOCK/lockwell repository checkout.
2. Prove the landing build/test route and waitlist/contact handler.
3. Create a source-linked claim table for security, battery, unlock latency, remote access, and billing claims.
4. Map hardware resources for `EKPL2`, `EKKB2-TY`, and `SMKB2-BT` with source provenance.
5. Write the TUYA/native integration boundary before any SDK or credential work.
6. Define payment-state to access-state safety invariants.
7. Approve pilot outreach only after claim review and privacy/security wording.

Current frontier: resource mapping and proof separation, not supervised launch.

Garden cadence: weekly proof review after repository checkout and claim table exist.

Cortex ingestion targets: this packet, live landing capture, repository evidence, hardware resource map, TUYA boundary, and future pilot receipts.

First real pilot proof: one facility workflow proving rental creation, payment state, lock/PIN activation, access log capture, and move-out access removal.

## Loop Control Inputs

| loop_id | title | cadence | objective | metric | boundary_color | one_change_rule | state_file | stop_rule | model_route | proof_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dlock-resource-proof-loop | DLOCK resource proof loop | manual weekly until repository and hardware proofs exist | Move one DLOCK resource or claim from no-signal/blocked to evidenced, or record why it remains blocked. | One resource, claim, or integration boundary changes status per round. | blue | Select exactly one of repository checkout, landing build, hardware resource provenance, TUYA boundary, billing/access invariant, or pilot proof. | .operator/branch-loops/dlock-resource-proof-loop.md | Stop after 4 rounds, after first pilot proof exists, or when credentials/hardware block two consecutive rounds. | cheap-first; escalate only for conflicting integration evidence | Updated Evidence Ledger row, claim-table row, or integration-boundary receipt. |

## Branch Story Controls

| Control | Value |
| --- | --- |
| arc_title | `Resource Mapping And Access Proof` |
| vision | DLOCK becomes a proof-bound smart-lock Sapling whose hardware, TUYA, software, billing, and access-control claims are separated before launch. |
| icp | Self-storage facility owner or operator who wants unit access, tenant billing, and facility visibility in one workflow. |
| current_frontier | Map repository, landing, hardware photos/specs, TUYA/native integration, and payment/access safety claims. |
| narrative_voice | Operator product voice: show the lock, prove the access boundary, and avoid unsupported reliability claims. |
| anti_claims | Do not claim certified security, production TUYA integration, billing readiness, unlock reliability, or pilot outcomes before direct proof. |

## Mission Control Inputs

| mission_id | title | type | owner | gate | proof_required | dispatch_target |
| --- | --- | --- | --- | --- | --- | --- |
| dlock-resource-map | Map DLOCK repository, live page, and hardware resources | proof | founder/codex | Resource provenance | live page capture plus repository evidence and asset list | cambium |
| dlock-tuya-boundary | Define TUYA/native SDK integration boundary | proof | founder/codex | TUYA/native integration | architecture note with credential and device-test boundary | hermes |
| dlock-landing-proof | Prove landing build and waitlist/contact behavior | implementation | codex | Build proof | build/test receipt and lead-handler smoke | cambium |

## KPI Control Inputs

| kpi_id | label | survival | better_than_survival | source | current_state |
| --- | --- | --- | --- | --- | --- |
| dlock-qualified-operator | Qualified storage operator | one operator confirms the workflow problem and pilot interest | one facility provides unit/access/payment flow details | waitlist or founder note | pending |
| dlock-access-proof | Access workflow proof | one lock/PIN/access-log flow is evidenced safely | payment state drives access changes in a reviewed pilot workflow | TUYA/native and hardware receipts | blocked |

## Policy / Permission Inputs

| permission | status | required_approval | failure_mode |
| --- | --- | --- | --- |
| hardware/device testing | blocked | founder approves device model and test scope | access claims remain page-only |
| TUYA credentials | blocked | founder approves secret handling and environment | integration cannot be exercised |
| payment/billing provider | blocked | founder approves provider and legal copy | access/payment automation cannot be claimed |
| pilot outreach | blocked | founder approves operator target and copy | waitlist follow-up remains internal |
| public claims | blocked | founder approves source-linked claim table | page copy remains proof-only |

## Dispatch Inputs

| route | payload_hint | allowed_when | blocked_when |
| --- | --- | --- |
| cambium-bridge-assignment | `dlock-resource-map` as proof-only mapping task | live page and repository identity are available | hardware provenance or repo checkout is missing for deeper proof |
| hermes-topic-assignment | `dlock-tuya-boundary` for integration-boundary review | TUYA/native scope is known | secrets, hardware, or production device access is requested |
| cambium-bridge-assignment | `dlock-landing-proof` as implementation task | canonical repository checkout is attached | no repository checkout or env boundary exists |

## Proof Foldback

| proof_id | source_path | validates | promotes |
| --- | --- | --- |
| dlock-resource-proof | future resource map receipt | repository, landing, and hardware resource provenance are linked | keeps proof-only Sapling mapped |
| dlock-tuya-boundary-proof | future TUYA/native architecture note | integration boundary and secret handling are explicit | unlocks implementation review, not deployment |
| dlock-pilot-access-proof | future pilot receipt | unit rental, payment state, lock activation, access logs, and move-out removal work end to end | supports supervised-branch review only after approval |

## Promotion Rule

DLOCK is currently `proof-only`. The ladder remains `proof-only -> supervised branch -> autonomous branch`.

Do not promote or automate DLOCK until repository proof, hardware provenance, TUYA/native integration boundary, privacy/security review, payment/access safety invariants, and explicit pilot approval are complete.
