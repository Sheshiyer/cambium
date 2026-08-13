---
schema: cambium.product_branch_packet.v1
product_id: fitcheck
canonical_work_id: sapling:fitcheck
identity_scope: canonical-work-object
branch_kind: product
name: Fitcheck
role: Supervised product branch
promotion_state: supervised-branch
current_gate: Shopify QA, pricing listing, privacy/payment, CRM destination, and approved distribution
packet_owner: cambium
---

# Fitcheck Branch Packet

Fitcheck is the first Cambium product branch packet normalized from the existing proof packet at `docs/archive/plans/2026-06-23-fitcheck-product-branch-proof-packet.md`. This file is the reusable Cambium packet view; the dated packet remains the source evidence trail.

Fitcheck is one WorkObject implemented by several systems. `sapling:fitcheck` owns the product identity and supervised product plan; it does not absorb every repository or capability it uses. `program:hdilint` remains a separate Internal Program and owns the backend capability consumed by Fitcheck.

## Product Seed

| Field | Value |
| --- | --- |
| product_id | `fitcheck` |
| branch_kind | `product` |
| one_sentence_seed | Done-for-you AI virtual try-on launch service for Shopify fashion brands. |
| founder_intent | Use the Thoughtseed growth engine to run Fitcheck as the first supervised product branch. |
| target_customer | Shopify fashion brands that need shoppers to visualize fit before purchase. |
| pain_or_desire | Product pages lose conversion because shoppers cannot picture garments on their own body. |
| offer | Managed virtual try-on pilot with personalized renders, Shopify widget, credits, and launch support. |
| survival_metric | One qualified merchant completes a demo or reservation flow. |
| better_than_survival_metric | One merchant pilot goes live with tracked widget events and branch proof packet. |
| GTM_channel | Shopify-first outbound, founder-led demo renders, cofounder-operated pilot sales. |
| constraints | ROI-first, privacy-aware, no fake lift claims, no app-store approval claim until approved. |
| third_party_apps | Shopify, Vercel, GitHub, AWS App Runner, Cloudflare/R2/Cortex, Dodo Payments, Composio when brokered or portable. |
| autonomy_boundary | Semi-autonomous routines can recommend and draft; founder approval gates remain required for submission, payments, customer contact, spend, and public claims. |
| approvals | Shopify submission, privacy/legal wording, Dodo activation/refunds, customer outreach, live merchant install, public proof/case-study claims. |

## System Topology

| Component | Role | Owning WorkObject | Repository / Service | Authority | Current State |
| --- | --- | --- | --- | --- | --- |
| Fitcheck landing | experience surface | `sapling:fitcheck` | `Sheshiyer/fitcheck-landing` · `R_kgDOSzF56w` | Fitcheck product planning and frontend evidence | mapping receipt issued and read back |
| HDILINT backend | backend capability | `program:hdilint` | `Sheshiyer/HDILINT-backend-aleph` · `R_kgDOS4jKmg` | HDILINT backend planning and implementation evidence | repository identity verified; linked operational access remains separately governed |
| Shopify | commerce channel | external service | Shopify demo/storefront | merchant product-page and widget evidence | credentials and live QA held |
| AWS App Runner | backend runtime | `program:hdilint` | deployed HDILINT API runtime | runtime health and upload-wrapper evidence | health proof exists; paid/live generation remains gated |
| Vercel | frontend runtime | `sapling:fitcheck` | Fitcheck landing deployment | landing artifact and environment evidence | production artifact reconciliation pending |
| Dodo Payments | payment service | external service | reservation/payment environment | payment intent and refund-policy evidence | activation held |
| Cortex / R2 | evidence infrastructure | Cambium shared infrastructure | receipt and derived-memory projections | immutable evidence only; never product or D1 identity | Fitcheck mapping receipt written; foldback writes held |

Typed relationship: `sapling:fitcheck --uses-backend--> program:hdilint`. This relationship does not merge the two WorkObjects, transfer tenant authority, or allow a Fitcheck receipt to stand in for HDILINT repository authority.

## Knowledge / Evidence Map

The Thoughtseed Labs vault is the durable, founder-readable index; this packet
is the active Cambium organ and quest projection. Neither stores raw provider
lead data or replaces execution-system authority.

| Project or data domain | Canonical owner | Current status | Source pointer | Boundary |
| --- | --- | --- | --- | --- |
| Fitcheck founder context | Thoughtseed Labs vault | active and mapped | `40-products/fitcheck/operating-status.md` | Vault-relative pointer only; status/index, not live work state. |
| Fitcheck organ and quest state | Cambium | locally synchronized; no deploy implied | this packet | Mini App renders this packet's non-terminal quest states. |
| Public landing | GitHub / `sapling:fitcheck` | existing public surface | `Sheshiyer/fitcheck-landing` | GitHub/deployment evidence governs implementation state. |
| Private wiki | GitHub / `sapling:fitcheck` | existing product documentation | `Sheshiyer/fitcheck-wiki` | Private repository policy governs access. |
| Backend capability | `program:hdilint` | separate mapped capability | `Sheshiyer/HDILINT-backend-aleph` | Fitcheck uses the capability without absorbing its authority. |
| Shopify listing and widget | Shopify | pricing reconciliation and authenticated QA unfinished | `apps.shopify.com/fitcheck-try-on` | External account and storefront gates remain. |
| Campaign aggregates | Cambium redacted evidence | current bounded readback complete | `docs/evidence/2026-08-11-fitcheck-explee-inbox-readback.v1.json` | Raw contacts, threads, and payloads remain in Explee. |
| Backup durability | vault/R2 backup policy | existing guarded policy; no new write implied | vault Fitcheck operating-status map | R2 is one-way encrypted backup, never operational truth or two-way sync. |

## Organ Routing

| Organ | Owner | Input | Output | Proof Path | Current Gate | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Genesis | Fitcheck/HDILINT source docs | Existing brand DNA and service promise | `brand_system`, `copy_system`, `visual_system` | Existing dated packet plus HDILINT source material | verified, do not regenerate unless Taste fails current assets | complete |
| Taste | Cambium taste/audit loop | Landing, widget, copy, privacy wording, demo renders | Taste verdict and reroll list | Approved Fitcheck taste brief and sourcebook | completed; rerun only when current brand evidence changes | complete |
| Hands | Fitcheck landing/widget/backend repos | Scoped gates from Taste and QA | Code/docs patches with proof | `docs/evidence/2026-08-10-fitcheck-build-closure.v1.json` | completed with deferred release work | complete |
| Will | Snow Gloves OS / GTM routines | Approved product and proof bundle | Outreach, CRM, payment, pilot reporting | Founder-approved action logs | manual readiness reviewed; ready to propose, external execution remains approval-bound | ready-for-review |
| Cortex | Cambium/Cortex memory | Redacted branch lessons and proof summaries | Searchable branch memory and next-intent candidates | `docs/evidence/2026-08-12-cambium-branch-cortex-ingestion.v1.json` | receipt-derived ingestion and semantic recall verified; future foldback remains separately governed | complete |
| Hermes | Hermes routes | Founder-facing actions | Telegram/Plexus reports | Hermes proof receipts | pending, policy-aware recommendation only | pending |
| Garden | Branch health cadence | Branch evidence and outcomes | Daily/weekly pulses | Routine proof packet | blocked until pilot begins | blocked |

## Variable Contract Payload

| Group | Current Source | Status |
| --- | --- | --- |
| `brand_system` | Existing Fitcheck brand DNA and HDILINT brand/GTM docs | verified |
| `copy_system` | Fitcheck landing copy and HDILINT product spec | verified |
| `visual_system` | Landing, Shopify widget, demo render assets | verified by approved Taste pass; rerun only when evidence changes |
| `asset_plan` | Shopify widget assets, demo images, product screenshots | pending QA proof |
| `section_plan` | Landing/product-page flow from current Fitcheck packet | verified for supervised packet |
| `interaction_plan` | Lead capture, reservation CTA, widget upload/consent/result events | pending production proof |
| `acceptance_checks` | Existing QA checklist, App Runner health, landing tests | verified for local/proof packet; blocked for public launch gates |

## Adapter / Service Map

`Tenant Mapping` values below are packet-local context namespaces. Canonical runtime tenant authority remains `cambium` as Fitcheck's catalog parent and must be joined through the exact `sapling:fitcheck` WorkObject identity.

| Provider / Route | Inputs | Outputs | Failure Modes | Tenant Mapping | Privacy Boundary |
| --- | --- | --- | --- | --- | --- |
| Vercel landing | Fitcheck source and env values | Public landing and serverless lead handler | Artifact drift, protected preview, missing reservation env | `fitcheck` | No provider secrets in packet |
| Shopify demo store | Product page, widget assets, storefront access | Product-page try-on proof | Password page, App Store review pending | `fitcheck` | Customer media/consent wording requires approval |
| HDILINT / AWS App Runner API | Upload intent and demo wrapper calls | Health, signed upload, demo API wrapper | Live generation cost, backend access, or provider failure | `program:hdilint` used by `sapling:fitcheck` | Retention/deletion/no-training wording remains approval-gated |
| Dodo Payments | Reservation or pilot payment link | Paid pilot intent | Missing production env/payment link/refund policy | `fitcheck` | Payment activation and refund language require approval |
| Composio | GitHub/Gmail/Google Calendar actions | Branch action portability | Local-only auth or missing EC2/broker route | `fitcheck` | App actions require approved runtime sessioning |

## Evidence Ledger

| Status | Evidence |
| --- | --- |
| verified | Existing dated packet: `docs/archive/plans/2026-06-23-fitcheck-product-branch-proof-packet.md`. |
| verified | Local packet recorded Fitcheck landing repo HEAD `f1b8d88`, `npm test` passing `7/7`, live landing HTTP `200`, and App Runner health `ok: true`. |
| verified | Launch hardening pass recorded lead handler, local browser proof, Vercel preview readiness, App Runner signed-upload proof, and widget harness events. |
| verified | Cortex receipt-derived read model records Fitcheck among five canonical packets, 81 total vector chunks, semantic recall for every packet, and idempotent Fitcheck replay. Redacted summary: `docs/evidence/2026-08-12-cambium-branch-cortex-ingestion.v1.json`. |
| blocked | Live production Vercel artifact drift and missing Dodo/Fitcheck reservation URL env. |
| blocked | Shopify demo product route requires storefront password/session/admin access for live widget QA. |
| pending | Shopify App Store approval, privacy/legal wording, refund wording, and customer outreach approval. |
| no-signal | No real merchant pilot proof packet exists yet. |

## Gate Ledger

| Gate | Status | Required Proof |
| --- | --- | --- |
| Human approvals | pending | Founder approval for Shopify submission, privacy/refund wording, real outreach, and public claims. |
| Spend approvals | blocked | Explicit approval before live metered try-on generation. |
| Privacy/legal | pending | Approved retention, deletion, no-training, consent, and refund language. |
| Payment | blocked | Dodo payment/reservation link and production env proof. |
| Customer contact | blocked | Approved outbound copy and first merchant target list. |
| Public claims | blocked | No app-store approval or conversion lift claim until evidenced. |
| Credentials | blocked | Shopify storefront/admin access and approved runtime action route. |

## Quest Queue

Every row below is rendered by the Telegram Mini App. Only `complete` and
`superseded` are terminal; `external-wait`, `blocked`, `proposed`, and
`ready-for-review` remain visible unfinished work.

| quest_id | title | status | owner | next_action | proof_required |
| --- | --- | --- | --- | --- | --- |
| fitcheck-shopify-listing-price-submission | Confirm Shopify pricing-listing submission outcome | external-wait | Shopify / founder | Capture the reviewer outcome after the submitted price change is processed. | Shopify listing readback showing the approved commercial display. |
| fitcheck-shopify-widget-qa | Run authenticated Shopify widget QA | blocked | founder/codex | Obtain the approved authenticated QA route and execute the existing proof plan. | Screenshot plus widget event log. |
| fitcheck-privacy-consent-review | Review privacy, consent, retention, and deletion wording | blocked | founder / legal reviewer | Review existing wording before changing public product or tracking surfaces. | Approved policy wording receipt. |
| fitcheck-dodo-payment-activation | Activate approved Dodo reservation/payment path | external-wait | founder/codex | Confirm the approved production URL and environment scope. | Environment receipt plus checkout smoke. |
| fitcheck-public-claims-evidence | Reconcile Shopify/landing claims against proof | blocked | founder / product | Keep unproven claims unchanged until separate review; collect evidence before correction. | Claim review and approved public correction or evidence receipt. |
| fitcheck-outreach-pilot-approval | Review first merchant / LaCleo distribution packet | ready-for-review | founder | Choose the exact ICP, sample-data acceptance, contact volume, sender setup, and stop rule. | Founder-approved action packet; no send is implied. |
| fitcheck-search-measurement-foundation | Establish Search Console and GA4 measurement ownership | external-wait | founder / account owner | Name owners and approve consent plus conversion-event plan. | Access readback and approved measurement plan. |
| fitcheck-technical-search-baseline | Record technical search baseline | proposed | product / SEO reviewer | Capture a public crawl of canonical URLs, sitemap, robots, titles, and schema. | Source-linked baseline receipt. |
| fitcheck-icp-query-evidence-map | Map ICP search queries from evidence | proposed | research reviewer | Produce a source-linked query and question map by merchant ICP. | Reviewed research ledger with confidence labels. |
| fitcheck-answer-library | Prepare claim-safe answer library | blocked | content / founder | Build an answer outline only from product and policy evidence. | Founder-reviewed source map and answer brief. |
| fitcheck-editorial-pilot | Prepare one evidence-backed editorial pilot | blocked | content / founder | Select one merchant-education topic and prepare a channel-native draft. | Approved draft, source links, destination, and publish receipt. |
| fitcheck-link-relationship-research | Research relevant editorial/partner relationships | proposed | SEO reviewer | Identify public-fit relationships; exclude purchased or automated links. | Reviewed prospect rationale and no-contact receipt. |
| fitcheck-attribution-readback | Read aggregate acquisition and qualified-demo signals | external-wait | analytics owner | Read aggregate acquisition, query, CTA, and qualified-demo data after instrumentation approval. | Dated aggregate receipt with caveats. |
| fitcheck-campaign-reply-triage | Review redacted campaign reply/hot-lead demand | ready-for-review | founder / operator | Review the aggregate Explee observation; do not alter a lead. | Redacted inbox observation and human triage policy. |
| fitcheck-crm-minimum-viable-flow | Select a minimum viable CRM destination and owner | ready-for-review | founder | Review CRM handoff, then choose one destination and owner before implementation. | Founder-reviewed CRM contract and privacy boundary. |
| fitcheck-campaign-learning-foldback | Fold verified aggregate learning into Cortex | proposed | Cortex reviewer | Propose one bounded experiment from a redacted outcome receipt. | Receipt references, caveats, and one successor quest. |
| fitcheck-garden-health-pulse | Schedule Garden health cadence after first pilot proof | blocked | Garden | Wait for first merchant pilot proof before arming health cadence. | First merchant proof packet and routine receipt. |

Current frontier: Shopify QA, pricing listing, privacy/payment, CRM destination, and approved distribution—not autonomy.

Garden cadence: daily branch health pulse only after pilot proof begins.

Cortex ingestion targets: this normalized packet, the dated Fitcheck packet, HDILINT source maps, QA receipts, and launch lessons.

First real pilot proof: one merchant seed from intake to launch/garden with archived proof packet.

## Loop Control Inputs

| loop_id | title | cadence | objective | metric | boundary_color | one_change_rule | state_file | stop_rule | model_route | proof_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fitcheck-launch-gate-loop | Fitcheck launch gate loop | manual weekly until first merchant proof begins | Move one Fitcheck launch blocker from blocked to evidenced or return a founder approval request. | One gate changes status or one approval request is recorded per round. | yellow | Select exactly one of Shopify QA, Dodo reservation env, privacy copy, outreach approval, or first merchant proof. | .operator/branch-loops/fitcheck-launch-gate-loop.md | Stop after 3 rounds, after first merchant proof is archived, or when missing credentials prevent the selected gate twice. | cheap-first; escalate only when validator or proof command fails | Updated Evidence Ledger row, Gate Ledger row, or founder approval request pasted into the loop state file. |

## Branch Story Controls

| Control | Value |
| --- | --- |
| arc_title | `Supervised Launch Hardening` |
| vision | Fitcheck becomes the first proof-bound Cambium product branch that can move a Shopify fashion merchant from demo interest to supervised pilot. |
| icp | Shopify fashion brand founder or ecommerce operator who needs visual fit confidence before committing to a pilot. |
| current_frontier | Supervised launch hardening: Shopify QA, pricing listing, privacy/payment, CRM destination, approved distribution, and first merchant proof remain the live gates. |
| narrative_voice | Precise operator voice: launch pilot, prove every claim, and keep approvals visible. |
| anti_claims | Do not claim app-store approval, conversion lift, unattended operation, or real merchant outcome until evidenced. |

## Mission Control Inputs

| mission_id | title | type | owner | gate | proof_required | dispatch_target |
| --- | --- | --- | --- | --- | --- | --- |
| fitcheck-shopify-qa | Run authenticated Shopify widget QA | proof | founder/codex | Credentials | screenshot plus widget event log | hermes |
| fitcheck-dodo-reservation | Wire Dodo reservation URL into production env | implementation | founder/codex | Payment | env receipt plus checkout smoke | cambium |
| fitcheck-outreach-approval | Approve first merchant outreach packet | approval | founder | Customer contact | approved copy plus target list note | plexus-agent-fabric |

## KPI Control Inputs

| kpi_id | label | survival | better_than_survival | source | current_state |
| --- | --- | --- | --- | --- | --- |
| fitcheck-qualified-demo | Qualified merchant demo | one qualified merchant completes demo or reservation flow | one merchant schedules supervised pilot from the flow | lead handler and founder note | pending |
| fitcheck-first-merchant-proof | First merchant pilot proof | pilot proof packet exists | tracked widget events and customer proof fold into Cambium | Shopify widget QA and pilot packet | blocked by access and approvals |

## Policy / Permission Inputs

| permission | status | required_approval | failure_mode |
| --- | --- | --- | --- |
| Shopify storefront/admin access | blocked | founder provides authenticated route/session | widget QA cannot be verified live |
| Dodo production payment link | blocked | founder approves reservation/payment activation | payment mission cannot dispatch |
| customer outreach | blocked | founder approves copy and recipient list | no live merchant contact |
| public claims | blocked | founder approves claim after proof packet | mini app must show supervised state only |

## Dispatch Inputs

| route | payload_hint | allowed_when | blocked_when |
| --- | --- | --- | --- |
| hermes-topic-assignment | `fitcheck-shopify-qa` with branchMission metadata | Shopify access and QA scope are approved | credentials or privacy wording missing |
| cambium-bridge-assignment | `fitcheck-dodo-reservation` as supervised implementation task | Dodo URL/env target is approved | payment activation remains unapproved |
| plexus-agent-fabric | `fitcheck-outreach-approval` for member approval workflow | outreach copy exists and founder review is requested | public claim proof is missing |

## Proof Foldback

| proof_id | source_path | validates | promotes |
| --- | --- | --- | --- |
| fitcheck-mapping-readback | R2 thoughtseed-vault portfolio/thoughtseed/workobjects/sapling:fitcheck/mapping/pmr_9de251ce89564f07f3e4c510.json | Fitcheck repository mapping receipt was issued and read back byte-identically | unlocks the separate D1 Mission to Task proposal gate |
| fitcheck-shopify-widget-proof | future Shopify QA screenshot and event receipt | product-page try-on works under authenticated conditions | keeps supervised branch active; no autonomy promotion |
| fitcheck-payment-proof | Dodo/Vercel env receipt plus checkout smoke | reservation/payment path is live enough for supervised pilot | unlocks customer-contact gate only after approval |
| fitcheck-first-merchant-packet | future first merchant proof packet | real merchant pilot outcome | candidate for later autonomous review after app-action portability |

## Promotion Rule

Fitcheck is currently `supervised-branch`. The ladder remains `proof-only -> supervised branch -> autonomous branch`.

Do not call Fitcheck autonomous until Shopify review, QA, privacy/payment/onboarding, branch routines, app-action portability, and one real merchant proof packet are complete.
