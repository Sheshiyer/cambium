---
schema: cambium.product_branch_packet.v1
product_id: client-delivery
canonical_work_id: none
identity_scope: template
branch_kind: client
name: Client Delivery
role: Client delivery branch template
promotion_state: supervised-branch
current_gate: Client scope acceptance and handoff proof
packet_owner: cambium
---

# Client Delivery Branch Packet

Client Delivery is the non-canonical Cambium template for active client work. It does not claim a WorkObject identity; each instantiated client branch must bind its own exact `branch:<slug>` ID before an operational join. The template treats client scope, delivery, acceptance, and handoff as first-class branch proof without pretending every branch is a product or new productized offer.

## Product Seed

| Field | Value |
| --- | --- |
| product_id | `client-delivery` |
| branch_kind | `client` |
| one_sentence_seed | Supervised client delivery branch that moves a scoped client outcome from acceptance criteria to proof-backed handoff. |
| founder_intent | Include client work in the Cambium ecosystem map so delivery, signoff, and follow-through are governed by branch loops. |
| target_customer | Active or prospective clients with a defined scope, delivery artifact, acceptance gate, and handoff path. |
| pain_or_desire | Client work can disappear into ad hoc execution unless scope, proof, handoff, and approval boundaries stay visible. |
| offer | Managed delivery loop with scope packet, implementation proof, acceptance receipt, and handoff summary. |
| survival_metric | One client scope has accepted criteria and a named proof path. |
| better_than_survival_metric | One client delivery closes with acceptance, handoff proof, and reusable lessons folded into Cambium. |
| GTM_channel | Founder-led client delivery, referrals, partner work, and existing account expansion. |
| constraints | Do not expose private client identifiers, contracts, pricing, credentials, or contact data in packets. |
| third_party_apps | GitHub, Vercel, Cloudflare, Slack/Gmail/Calendar, client-approved project tools, and redacted proof archives when authorized. |
| autonomy_boundary | Client work remains supervised; AI may draft, inspect, and summarize, but scope changes, client messages, spend, credentials, and signoff requests require approval. |
| approvals | Scope acceptance, delivery artifact acceptance, client-facing messages, production changes, public references, and handoff completion. |

## Organ Routing

| Organ | Owner | Input | Output | Proof Path | Current Gate |
| --- | --- | --- | --- | --- | --- |
| Genesis | Client brief and founder context | Scope, promise, constraints, and success definition | `client_scope`, `delivery_intent`, `handoff_shape` | Redacted scope note or approved brief | pending |
| Taste | Client-facing quality loop | Delivery artifact, copy, UX, or report surface | Reroll list and acceptance critique | Future client QA note | pending |
| Hands | Delivery repo or artifact surface | Scoped implementation and proof tasks | Code/docs/artifact changes with receipts | PRs, build logs, screenshots, or redacted handoff artifacts | pending |
| Will | Account and approval routines | Approved next action and communication boundary | Client update, approval request, or hold decision | Founder-approved action log | blocked until approval |
| Cortex | Cambium memory | Redacted scope, proof, lessons, and reusable patterns | Searchable delivery memory | Future sanitized ingestion | pending |
| Hermes | Founder-facing routing | Client branch status and blockers | Report or recommendation | Hermes proof receipt | pending |
| Garden | Delivery health cadence | Acceptance gates and open blockers | Manual delivery pulse | Future client-delivery pulse | blocked until first accepted scope |

## Variable Contract Payload

| Group | Current Source | Status |
| --- | --- | --- |
| `client_scope` | Redacted scope brief or founder-approved client notes | pending |
| `delivery_intent` | Accepted outcome, artifact boundary, and acceptance criteria | pending |
| `handoff_shape` | Handoff summary, owner, archive path, and next-step agreement | pending |
| `asset_plan` | Client-approved assets, repo paths, screenshots, or docs | no-signal |
| `section_plan` | Scope, build/proof, QA, acceptance, handoff, and follow-up | pending |
| `interaction_plan` | Client update, review request, signoff request, and delivery archive | blocked until approval |
| `acceptance_checks` | Build/test/proof commands plus client acceptance receipt | pending |

## Adapter / Service Map

| Provider / Route | Inputs | Outputs | Failure Modes | Tenant Mapping | Privacy Boundary |
| --- | --- | --- | --- | --- | --- |
| GitHub repo or worktree | Scoped delivery task and implementation proof | PR, commit, or code review packet | Wrong repo, dirty worktree, unreviewed client change | client/project slug when approved | No client secrets, contracts, or private contact data in packet |
| Vercel/Cloudflare preview | Approved artifact and env boundary | Preview URL or deploy receipt | Protected preview, stale deploy, missing env | project or client-owned deployment | Never expose credentials or private data in public routes |
| Slack/Gmail/Calendar | Approved client communication | Update, meeting note, or approval request | Unapproved send, wrong recipient, stale context | client contact only when authorized | Draft-only until founder approves exact message |
| Hermes | Branch status and blocker summary | Founder-facing handoff report | Missing proof, stale status, unowned blocker | Cambium client branch | Redacted summaries only |
| Cortex memory | Sanitized lessons and proof paths | Reusable client delivery memory | Sensitive data leakage or noisy ingestion | redacted client slug | Strip client identifiers unless explicitly approved |

## Evidence Ledger

| Status | Evidence |
| --- | --- |
| pending | Client branch packet exists as a reusable contract for scope, delivery, acceptance, and handoff proof. |
| blocked | No specific client scope, approval boundary, or acceptance receipt is bound in this generic packet yet. |
| no-signal | No public case-study claim or reusable client result is evidenced here. |

## Gate Ledger

| Gate | Status | Required Proof |
| --- | --- | --- |
| Scope acceptance | pending | Founder-approved scope summary with acceptance criteria. |
| Client communication | blocked | Approval before any message, invite, or signoff request is sent. |
| Production change | blocked | Approved target, rollback note, and deploy proof. |
| Privacy/legal | blocked | Redaction and publication boundary for any client-identifying material. |
| Public claims | blocked | Client-approved reference or case-study permission. |
| Handoff completion | pending | Handoff artifact, owner confirmation, and next-step agreement. |

## Quest Queue

1. Bind one client scope to this branch with redacted acceptance criteria.
2. Identify the delivery artifact, repo, preview, or document surface.
3. Run the narrowest proof check that demonstrates delivery progress.
4. Request approval before client-facing communication or production change.
5. Capture acceptance or blocked-feedback proof.
6. Produce handoff summary and next-step owner.
7. Fold sanitized delivery lessons into Cortex after approval.

Current frontier: client scope acceptance and handoff proof, not autonomous client operations.

Garden cadence: manual client delivery pulse only after a real client scope is accepted.

Cortex ingestion targets: redacted scope, delivery proof, acceptance receipt, handoff summary, and reusable lessons.

First real client proof: one scoped client delivery reaches accepted handoff with approved evidence and no private-data leakage.

## Loop Control Inputs

| loop_id | title | cadence | objective | metric | boundary_color | one_change_rule | state_file | stop_rule | model_route | proof_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| client-delivery-handoff-loop | Client delivery handoff loop | manual weekly while a client scope is active | Move one client delivery gate from pending or blocked to evidenced, or return one founder approval request. | One scope, proof, acceptance, or handoff gate changes status per round. | yellow | Select exactly one of scope acceptance, delivery receipt, signoff proof, or blocked-client decision. | .operator/branch-loops/client-delivery-handoff-loop.md | Stop after 3 rounds, after accepted handoff is archived, or when client approval is unavailable for the selected gate twice. | cheap-first; escalate only when proof is client-sensitive or repo access is missing | Redacted scope note, delivery receipt, acceptance receipt, handoff summary, or founder approval request pasted into the loop state file. |

## Branch Story Controls

| Control | Value |
| --- | --- |
| arc_title | `Client Delivery Handoff` |
| vision | Client delivery becomes a supervised Cambium branch where scope, proof, acceptance, and handoff are visible without leaking private client data. |
| icp | Founder, operator, or client stakeholder who needs delivery progress tied to explicit acceptance criteria and proof. |
| current_frontier | Scope acceptance, delivery proof, client communication approval, and handoff artifact remain the live gates. |
| narrative_voice | Client operator voice: bind scope, prove the artifact, ask before messaging, and archive the handoff. |
| anti_claims | Do not claim client approval, production delivery, public case-study permission, or autonomous account action until evidenced. |

## Mission Control Inputs

| mission_id | title | type | owner | gate | proof_required | dispatch_target |
| --- | --- | --- | --- | --- | --- | --- |
| client-delivery-scope-bind | Bind client scope and acceptance criteria | proof | founder/codex | Scope acceptance | redacted scope note plus acceptance criteria | cambium |
| client-delivery-proof-run | Produce delivery proof for one artifact | proof | codex | Delivery artifact | build/test/screenshot/doc receipt | hermes |
| client-delivery-handoff-approval | Request handoff or client-message approval | approval | founder | Client communication | approved draft or hold decision | plexus-agent-fabric |

## KPI Control Inputs

| kpi_id | label | survival | better_than_survival | source | current_state |
| --- | --- | --- | --- | --- | --- |
| client-scope-accepted | Client scope accepted | one redacted scope has acceptance criteria | scope links to proof path and owner | client-delivery branch state | pending |
| client-handoff-closed | Client handoff closed | handoff summary exists | acceptance receipt and reusable lesson are archived | handoff artifact and approval log | pending |

## Policy / Permission Inputs

| permission | status | required_approval | failure_mode |
| --- | --- | --- | --- |
| client-facing message | blocked | founder approves exact message and recipient boundary | no send or calendar action |
| production deploy/change | blocked | founder approves target, rollback, and timing | delivery remains draft or preview-only |
| private client data | blocked | founder approves redaction and storage boundary | packet must omit identifiers and sensitive material |
| public reference | blocked | client and founder approve reference wording | no public claim or case study |

## Dispatch Inputs

| route | payload_hint | allowed_when | blocked_when |
| --- | --- | --- | --- |
| cambium-bridge-assignment | `client-delivery-scope-bind` with redacted branch metadata | scope source is approved for internal handling | client identity or contract data is unredacted |
| hermes-topic-assignment | `client-delivery-proof-run` with proof path | artifact surface and proof command are named | repo access or deploy target is missing |
| plexus-agent-fabric | `client-delivery-handoff-approval` for member approval workflow | handoff draft is ready for review | client-facing message has not been approved |

## Proof Foldback

| proof_id | source_path | validates | promotes |
| --- | --- | --- | --- |
| client-delivery-scope-proof | future redacted scope note | client scope has accepted criteria | keeps client branch supervised and actionable |
| client-delivery-artifact-proof | future build/test/screenshot/doc receipt | delivery artifact moved under proof | unlocks handoff review only after approval |
| client-delivery-handoff-proof | future handoff summary and acceptance receipt | client handoff completed without private-data leakage | candidate for reusable client delivery playbook after review |

## Promotion Rule

Client Delivery is currently `supervised-branch`. The ladder remains `proof-only -> supervised branch -> autonomous branch`.

Do not promote client delivery toward autonomous operation until scoped client approval, delivery proof, communication approval, privacy/redaction proof, and handoff acceptance are complete.
