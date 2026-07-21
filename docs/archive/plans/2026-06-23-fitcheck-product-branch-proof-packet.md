# Fitcheck Product Branch Proof Packet

Date: 2026-06-23
Status: branch packet initialized; supervised launch hardening advanced; external public launch gates remain explicit
Branch: `fitcheck`
Mode: Shopify-first pilot, offline retail/Android checkout as expansion path

## Verdict

Fitcheck is ready to enter the Cambium product-branch loop as the first supervised Thoughtseed branch.

It is not ready to be treated as unattended 24/7 company-operation autonomy. The current strength is that the launch surface, Shopify demo store, deployed API wrapper, brand/copy system, and proof ledger are coherent enough for cofounder-operated execution. The remaining gaps are review completion, QA, privacy/payment/onboarding wiring, legacy provider-language cleanup, and the first real pilot proof packet.

## Current Source Of Truth

- Landing/product repo: `fitcheck-landing`
- GitHub remote: `https://github.com/Sheshiyer/fitcheck-landing.git`
- Local HEAD checked in this pass: `f1b8d88`
- Live landing: `https://fitcheck-landing-gamma.vercel.app/`
- Shopify demo store: `https://fitcheck-dev-jqw2bgvy.myshopify.com`
- Demo product proof page: `https://fitcheck-dev-jqw2bgvy.myshopify.com/products/full-dress`
- App Runner API origin: `https://tzqr9rgi3h.us-east-1.awsapprunner.com`
- Product context folders:
  - `HDILINT`
  - `HDILINT-backend-aleph`
  - `Skill-clusters/docs/LESSONS-FITCHECK-RUN.md`
- Growth readiness handoff: `thoughtseed-labs/hermes-aws-ts/docs/evidence/2026-06-22-growth-branch-readiness-audit.md`

## Product Seed

```yaml
product_id: fitcheck
name: Fitcheck
one_sentence_seed: Done-for-you AI virtual try-on launch service for Shopify fashion brands.
founder_intent: Use the full Thoughtseed growth engine to turn Fitcheck into the first supervised product branch.
target_customer: Shopify fashion brands that need shoppers to see fit before buying.
pain_or_desire: Product pages lose sales because shoppers cannot picture garments on their own body.
offer: Managed virtual try-on pilot with personalized renders, Shopify widget, credits, and launch support.
survival_metric: One qualified merchant completes demo or reservation flow.
better_than_survival_metric: One merchant pilot goes live with tracked widget events and branch proof packet.
ecosystem_inputs:
  - Fitcheck landing repo and live Vercel deployment
  - Shopify demo store and App Store review-ready evidence
  - HDILINT brand/GTM/widget/privacy/runbook docs
  - App Runner demo API wrapper health
  - Cambium quest/proof ledger
  - Hermes/Paperclip routing and reports
ecosystem_outputs:
  - Launch-ready copy/design/code improvements
  - Shopify QA proof
  - Privacy/payment/onboarding hardening
  - Outreach-ready proof packet
  - Lessons captured into Cortex/branch memory
gtm_channel: Shopify-first outbound, founder-led demo renders, cofounder-operated pilot sales.
brand_constraints: ROI-first, pragmatic, privacy-aware, no fake lift claims, no app-store approval claim until approved.
technical_constraints: Use live proof only; avoid provider-secret exposure; keep EC2 out of canonical Cloudflare/R2 ownership.
third_party_apps_needed:
  - Shopify
  - Vercel
  - GitHub
  - AWS App Runner
  - Cloudflare/R2/Cortex memory surfaces
  - Dodo Payments
  - Composio actions for GitHub/Gmail/Google Calendar when brokered or EC2-portable
autonomy_boundary: Semi-autonomous routines can recommend and draft; founder approval gates remain required for submission, payments, customer contact, spend, and public claims.
human_approval_required_for:
  - Shopify App Store submission and final listing claims
  - Privacy/legal wording
  - Dodo payment activation and refunds
  - Customer outreach sends
  - Live merchant install
  - Public proof/case-study claims
```

## Organ Routing

1. Genesis: use the existing Fitcheck brand DNA and HDILINT brand-kit as the branch seed. Do not regenerate brand identity unless a gate says current assets fail.
2. Taste: audit landing, Shopify widget visuals, copy, brand proof, privacy wording, and demo renders against the Fitcheck mission. Block fitness/gym semantic drift.
3. Hands: make code/copy/design/QA changes in `fitcheck-landing`, Shopify widget/backend surfaces, and deployment configs only after a scoped gate.
4. Cortex: store branch lessons, source maps, proof summaries, and launch outcomes as searchable memory. Treat Vectorize/Cortex as semantic answer memory and R2/vault as archive/backup unless a later contract changes that.
5. Will: operate GTM, outreach, CRM, cofounder approvals, payment flow, and pilot reporting.
6. Hermes: deliver founder-facing actions and proof summaries through Telegram/Plexus channels without bypassing policy gates.
7. Garden: schedule lessons, routine pulses, branch health, usage evidence, and archive/reseed decisions.

## Skill Cluster Routing

| Cluster | Use In This Branch | Evidence / Source |
|---|---|---|
| `design-core` / `design-orchestrator` | Taste audit for brand, visual hierarchy, proof, and widget polish. | HDILINT brand-kit, live landing, Shopify widget. |
| `creative-frontend-core` / `frontend-web-core` | Landing and product-page experience changes. | `fitcheck-landing`, Shopify app block/widget assets. |
| `backend-architecture-core` | API wrapper, upload intent, event, retention, and provider-router contracts. | App Runner health, HDILINT backend docs. |
| `devops-infra-core` | Vercel, App Runner, Cloudflare/R2 boundaries, scheduled cleanup. | Live landing, App Runner health, growth audit. |
| `cloudflare-core` | Broker/source-of-truth boundary, R2 archive, future app-action broker. | Cambium/Hermes architecture and readiness audit. |
| `databases-data-core` | Lead/CRM/event/credit ledgers and pilot reporting. | HDILINT source-of-truth map and product spec. |
| `growth-content-core` | Outreach, sales assets, launch copy, and merchant proof packet. | HDILINT GTM docs and landing copy. |
| `git-pr-ops-core` | Branch hygiene, PRs, proof-linked changes, release notes. | Fitcheck GitHub repo and Hermes/Cambium evidence style. |
| `browser-automation-core` | Live landing, Shopify product, widget, and payment/onboarding QA. | Vercel route, Shopify demo product route, future Dodo flow. |
| `agentic-ops-core` | Scheduled cofounder routines and policy-aware next actions. | Hermes runner, Paperclip routines, Cambium operator policy. |

## Connected Services Map

| Service | Current Role | Status |
|---|---|---|
| Cambium | Quest/proof ledger, organ architecture, policy-aware next actions. | Wired for supervised branch operation. |
| Hermes EC2 | Runner, gateway, bridge polling, founder delivery. | Wired; branch-specific routines pending. |
| Paperclip | Six-agent inherited org and skill/report source contracts. | Wired; EC2 routine promotion pending. |
| Cloudflare | Worker/D1/KV/R2/Vectorize/provider-broker boundary. | Wired for core architecture; branch truth contract still needs proof. |
| AWS App Runner | Fitcheck demo API wrapper. | Live health returns `ok: true`. |
| Vercel | Fitcheck landing deployment. | Live route returns `200`. |
| Shopify | Demo store, app block/widget, App Store review flow. | Demo-store live and review-ready; approval pending. |
| GitHub | Fitcheck source repo and future PR proof path. | Remote configured; local `main` clean in this pass. |
| Dodo Payments | Reservation and paid pilot flow. | Pending wiring. |
| Composio | GitHub/Gmail/Google Calendar app actions. | Local discovery works; EC2/brokered portability pending. |
| Telegram / curious.self bot | Founder approval and visual output layer. | Boundary clean; live WebView proof remains a separate gate. |

## Verified In This Pass

- `fitcheck-landing` local repo was on `main...origin/main` with no local dirty output before `npm test`.
- `npm test` in `fitcheck-landing` passed `7/7` and rebuilt `dist/index.html`.
- Live landing `https://fitcheck-landing-gamma.vercel.app/` returned HTTP `200`.
- Live landing HTML contains the Fitcheck Shopify fashion title and description.
- App Runner health returned `ok: true`, product `Fitcheck`, service `demo-api-wrapper`, provider `vertex-virtual-try-on`, signed upload intents enabled, JPEG/PNG/WebP allowlist, and `retentionDays: 7`.
- HDILINT source-of-truth map frames Fitcheck as a done-for-you Shopify virtual try-on launch service, not just a static page or pure API wrapper.
- HDILINT product spec allows concierge/manual MVP operation but forbids pretending the product is fully automated before it is.
- Shopify QA checklist exists and defines the exact visual, interaction, fallback, cart/analytics, performance, privacy, and go/no-go checks.

## Full Launch Execution Pass - 2026-06-23

This pass moved Fitcheck from initialized branch proof into supervised launch hardening. It did not complete public production launch because several external gates still require founder approval, credentials, or reviewer access.

### Safe Changes Completed

- `fitcheck-landing` now supports a real reservation next step through `FITCHECK_RESERVATION_URL`, `DODO_RESERVATION_URL`, or `DODO_PAYMENT_LINK`.
- `fitcheck-landing` no longer treats lead-submit network failure as success; it now returns an honest retryable error state.
- `fitcheck-landing` gallery proof images are eager-loaded so first-scroll/mobile proof capture is stable.
- `HDILINT-backend-aleph` docs now describe the live provider as `vertex-virtual-try-on` and keep FASHN language as legacy/comparison-only.
- `HDILINT-backend-aleph` launch/payment docs now point at Dodo reservation/payment wiring rather than Stripe.

### Launch Evidence Collected

- Landing local tests passed `7/7` after the lead-flow and gallery changes.
- Landing syntax checks passed for `api/lead.js`, `src/lead-capture.js`, and `build.mjs`.
- Serverless lead-handler mock returned `ok: true`, `nextStep: reservation`, and a configured reservation URL.
- Local browser proof showed the reservation CTA rendered after successful lead submission.
- Local landing desktop/mobile browser proof loaded with no console errors or failed requests.
- Vercel preview deployment `dpl_3ouLmCuxh9oAYQoDrehyyPufihCz` completed successfully and built `dist/index.html` at `41,477` bytes.
- Vercel inspect reports preview URL `https://fitcheck-landing-bbugfln7s-sheshiyers-projects.vercel.app` as `Ready`, target `preview`, with `api/lead` included.
- Live App Runner `/health` returned `ok: true`, product `Fitcheck`, service `demo-api-wrapper`, provider `vertex-virtual-try-on`, and signed upload intents enabled.
- Live App Runner signed-upload path was proven with a 1x1 PNG: intent created, upload received, then delete returned `deleted: true`.
- Local Shopify widget harness using the real widget assets and mock backend emitted `fitcheck:widget_loaded`, `fitcheck:cta_clicked`, `fitcheck:upload_selected`, `fitcheck:consent_checked`, `fitcheck:job_created`, `fitcheck:result_rendered`, and `fitcheck:add_to_cart_clicked`.
- Widget harness browser proof had no console errors or failed requests.

### Launch Blockers Found

- Live Vercel deployment is reachable but appears artifact-drifted from the local `fitcheck-landing` source; the live page loads bundled Vite assets and shows a different hero with a large blank band.
- Vercel preview is deployment-protected and redirects unauthenticated browser access to Vercel SSO, so it is not usable as public shopper proof.
- Vercel production env currently lacks a Dodo/Fitcheck reservation URL variable, so the public payment/reservation step is not yet configured.
- Shopify demo product route redirects to the storefront password page, so full live product/widget QA needs storefront password, an authenticated session, or Shopify admin access.
- Shopify App Store submission/approval remains a human approval gate.
- Privacy/legal wording and refund wording remain human approval gates.
- Live metered try-on generation was intentionally not triggered without explicit approval.
- Customer outreach and public proof/case-study claims were intentionally not sent or published.

### Next Approval Bundle

1. Provide the Dodo reservation/payment link or approve the exact Vercel env value.
2. Approve production Vercel deployment of the hardened `fitcheck-landing` source.
3. Provide Shopify storefront password/session/admin access for live product-page widget QA.
4. Approve privacy, deletion, no-training, consent, and refund language.
5. Approve any real Vertex try-on generation or merchant-facing outreach.

## Pending Gates Before Public Launch

1. Shopify App Store review: submit and record approval/rejection evidence when available.
2. Shopify theme QA: run the full demo-store product flow on desktop/mobile and record widget event evidence.
3. Privacy/legal: approve merchant-facing retention, deletion, no-training, and consent wording.
4. Payment: wire Dodo reservation and pilot payment flow, including refund policy evidence.
5. AI-chat onboarding: connect onboarding flow to intake, product assets, store URL, and pilot gating.
6. Provider-language scrub: remove or quarantine old FASHN references from public/operator product docs; live health now identifies `vertex-virtual-try-on`.
7. Offline retail/Android: keep as expansion path until implementation evidence exists.
8. Composio portability: make app-action awareness available to Hermes through EC2 sessioning or Cloudflare/MCP broker.
9. Branch routines: decide which Fitcheck/Paperclip routines run on EC2/systemd, Mac launchd, or Cloudflare Cron.
10. First pilot proof: run one real merchant seed from intake to launch/garden and archive the proof packet.

## Cofounder Action Queue

1. Gate: confirm Shopify submission status and capture reviewer outcome.
2. Taste: run visual/copy/privacy audit on landing plus Shopify widget.
3. Hands: patch only the issues found by Taste and QA.
4. Will: wire Dodo payment links and AI-chat intake copy.
5. Cortex: ingest this packet, HDILINT source map, and launch lessons into branch memory.
6. Hermes: publish the next founder action as a policy-aware recommendation, not an autonomous send.
7. Garden: schedule daily Fitcheck branch health pulse once the first pilot begins.

## Go / No-Go Rule

Proceed with supervised cofounder-operated launch work now.

Do not call Fitcheck a fully autonomous branch until Shopify review, QA, privacy/payment/onboarding, branch routines, app-action portability, and one real merchant proof packet are complete.
