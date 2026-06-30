---
schema: cambium.product_branch_packet.v1
product_id: fitcheck
name: Fitcheck
role: Supervised product branch
promotion_state: supervised-branch
current_gate: Shopify Dodo privacy QA outreach and first merchant proof
packet_owner: cambium
---

# Fitcheck Product Branch Packet

Fitcheck is the first Cambium product branch packet normalized from the existing proof packet at `docs/plans/2026-06-23-fitcheck-product-branch-proof-packet.md`. This file is the reusable Cambium packet view; the dated packet remains the source evidence trail.

## Product Seed

| Field | Value |
| --- | --- |
| product_id | `fitcheck` |
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

## Organ Routing

| Organ | Owner | Input | Output | Proof Path | Current Gate |
| --- | --- | --- | --- | --- | --- |
| Genesis | Fitcheck/HDILINT source docs | Existing brand DNA and service promise | `brand_system`, `copy_system`, `visual_system` | Existing dated packet plus HDILINT source material | verified, do not regenerate unless Taste fails current assets |
| Taste | Cambium taste/audit loop | Landing, widget, copy, privacy wording, demo renders | Taste verdict and reroll list | Future visual/copy/privacy audit packet | pending |
| Hands | Fitcheck landing/widget/backend repos | Scoped gates from Taste and QA | Code/docs patches with proof | Fitcheck PRs and command receipts | pending |
| Will | Snow Gloves OS / GTM routines | Approved product and proof bundle | Outreach, CRM, payment, pilot reporting | Founder-approved action logs | blocked until outreach/payment approvals |
| Cortex | Cambium/Cortex memory | Branch lessons and proof summaries | Searchable branch memory | Cortex ingestion targets | pending |
| Hermes | Hermes/Paperclip routes | Founder-facing actions | Telegram/Plexus reports | Hermes/Paperclip proof receipts | pending, policy-aware recommendation only |
| Garden | Branch health cadence | Branch evidence and outcomes | Daily/weekly pulses | Routine proof packet | blocked until pilot begins |

## Variable Contract Payload

| Group | Current Source | Status |
| --- | --- | --- |
| `brand_system` | Existing Fitcheck brand DNA and HDILINT brand/GTM docs | verified |
| `copy_system` | Fitcheck landing copy and HDILINT product spec | verified |
| `visual_system` | Landing, Shopify widget, demo render assets | pending Taste audit |
| `asset_plan` | Shopify widget assets, demo images, product screenshots | pending QA proof |
| `section_plan` | Landing/product-page flow from current Fitcheck packet | verified for supervised packet |
| `interaction_plan` | Lead capture, reservation CTA, widget upload/consent/result events | pending production proof |
| `acceptance_checks` | Existing QA checklist, App Runner health, landing tests | verified for local/proof packet; blocked for public launch gates |

## Adapter / Service Map

| Provider / Route | Inputs | Outputs | Failure Modes | Tenant Mapping | Privacy Boundary |
| --- | --- | --- | --- | --- | --- |
| Vercel landing | Fitcheck source and env values | Public landing and serverless lead handler | Artifact drift, protected preview, missing reservation env | `fitcheck` | No provider secrets in packet |
| Shopify demo store | Product page, widget assets, storefront access | Product-page try-on proof | Password page, App Store review pending | `fitcheck` | Customer media/consent wording requires approval |
| AWS App Runner API | Upload intent and demo wrapper calls | Health, signed upload, demo API wrapper | Live generation cost or provider failure | `fitcheck` | Retention/deletion/no-training wording remains approval-gated |
| Dodo Payments | Reservation or pilot payment link | Paid pilot intent | Missing production env/payment link/refund policy | `fitcheck` | Payment activation and refund language require approval |
| Composio | GitHub/Gmail/Google Calendar actions | Branch action portability | Local-only auth or missing EC2/broker route | `fitcheck` | App actions require approved runtime sessioning |

## Evidence Ledger

| Status | Evidence |
| --- | --- |
| verified | Existing dated packet: `docs/plans/2026-06-23-fitcheck-product-branch-proof-packet.md`. |
| verified | Local packet recorded Fitcheck landing repo HEAD `f1b8d88`, `npm test` passing `7/7`, live landing HTTP `200`, and App Runner health `ok: true`. |
| verified | Launch hardening pass recorded lead handler, local browser proof, Vercel preview readiness, App Runner signed-upload proof, and widget harness events. |
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

1. Confirm Shopify submission status and capture reviewer outcome.
2. Run Taste audit on landing, Shopify widget, copy, privacy wording, and demo renders.
3. Patch only issues found by Taste and QA.
4. Wire Dodo payment/reservation link into production env.
5. Run authenticated Shopify product-page widget QA.
6. Ingest branch packet, HDILINT source map, and launch lessons into Cortex.
7. Schedule Garden branch health pulse after the first pilot begins.

Current frontier: supervised launch hardening, not autonomy.

Garden cadence: daily branch health pulse only after pilot proof begins.

Cortex ingestion targets: this normalized packet, the dated Fitcheck packet, HDILINT source maps, QA receipts, and launch lessons.

First real pilot proof: one merchant seed from intake to launch/garden with archived proof packet.

## Branch Story Controls

| Control | Value |
| --- | --- |
| arc_title | `Supervised Launch Hardening` |
| vision | Fitcheck becomes the first proof-bound Cambium product branch that can move a Shopify fashion merchant from demo interest to supervised pilot. |
| icp | Shopify fashion brand founder or ecommerce operator who needs visual fit confidence before committing to a pilot. |
| current_frontier | Supervised launch hardening: Shopify, Dodo, privacy, QA, outreach, and first merchant proof remain the live gates. |
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
| fitcheck-shopify-widget-proof | future Shopify QA screenshot and event receipt | product-page try-on works under authenticated conditions | keeps supervised branch active; no autonomy promotion |
| fitcheck-payment-proof | Dodo/Vercel env receipt plus checkout smoke | reservation/payment path is live enough for supervised pilot | unlocks customer-contact gate only after approval |
| fitcheck-first-merchant-packet | future first merchant proof packet | real merchant pilot outcome | candidate for later autonomous review after app-action portability |

## Promotion Rule

Fitcheck is currently `supervised-branch`. The ladder remains `proof-only -> supervised branch -> autonomous branch`.

Do not call Fitcheck autonomous until Shopify review, QA, privacy/payment/onboarding, branch routines, app-action portability, and one real merchant proof packet are complete.
