---
schema: cambium.product_branch_packet.v1
product_id: vantyx
name: Vantyx
role: Tenant onboarding and publishing branch
promotion_state: supervised-branch
current_gate: Tenant proof and rollback proof
packet_owner: cambium
---

# Vantyx Product Branch Packet

Vantyx is a supervised Cambium product-branch candidate for a multi-tenant immersive SaaS branch. The inspected product surface is `Panaroma-Webapp`, with brand source in `brandmint-v2/brands/vantyx`; `10869` and `10869-space-v1` are portfolio repos rather than the current Vantyx surface.

## Product Seed

| Field | Value |
| --- | --- |
| product_id | `vantyx` |
| one_sentence_seed | Living 360 degree tour platform for view-led real-estate developers selling floor-by-floor views before and during construction. |
| founder_intent | Turn Vantyx into a repeatable tenant onboarding and publish/rollback branch inside Cambium. |
| target_customer | View-led property developers and sales or marketing teams; secondary users are visualization and digital marketing agencies serving developers. |
| pain_or_desire | Development teams need immersive sales tours that can be updated without downtime as views, plans, or content change. |
| offer | Premium branded tour per project on `<slug>.tryvantyx.space`, with public viewer, per-tenant admin, operator console, upload/draft/publish/rollback, and Cloudflare edge hosting. |
| survival_metric | One real second tenant is onboarded through the documented tenant flow and served publicly. |
| better_than_survival_metric | Second tenant deploys with health proof, rollback proof, analytics confirmation, and Cambium/Plexus proof reporting. |
| GTM_channel | Developer-led demos, project-specific immersive references, and agency/developer partnerships. |
| constraints | Keep tenant config scoped; do not read local env files into packets; treat production secrets as Wrangler secrets only. |
| third_party_apps | Cloudflare Workers, KV, R2, Access, Custom Domains, Turnstile, Wrangler, PostHog, Resend, GitHub Actions, Bun, React/Vite/Tailwind/Zod, Pannellum. |
| autonomy_boundary | Supervised SaaS branch until second-client dogfood, live login checks, and proof reporting exist. |
| approvals | New tenant creation, custom domain changes, production deploy, analytics/email activation, customer-facing claims. |

## Organ Routing

| Organ | Owner | Input | Output | Proof Path | Current Gate |
| --- | --- | --- | --- | --- | --- |
| Genesis | Vantyx brand source | Brand brief and product positioning | `brand_system`, `copy_system`, `visual_system` | `brandmint-v2/brands/vantyx/BRAND-BRIEF.md` | verified for seed |
| Taste | Cambium taste loop | Tour viewer, admin flow, developer-facing copy | Visual/copy QA and reroll list | Future Taste review | pending |
| Hands | `Panaroma-Webapp` | Tenant onboarding and publish/rollback tasks | Code/config changes and deploy receipts | Product repo PRs and command receipts | pending second tenant proof |
| Will | GTM/operator routines | Approved sales/demo packet | Outreach and follow-up tasks | Founder-approved action log | pending |
| Cortex | Cambium/Cortex memory | Tenant proof, deploy health, rollback lessons | Searchable branch memory | Cortex ingestion target | pending |
| Hermes | Hermes/Plexus reports | Health and next actions | Founder-visible recommendation and proof report | Future report packet | pending |
| Garden | Branch cadence | Tenant health and proof outcomes | Branch health pulse | Future Garden routine | blocked until second tenant exists |

## Variable Contract Payload

| Group | Current Source | Status |
| --- | --- | --- |
| `brand_system` | Vantyx brand brief and product docs | verified |
| `copy_system` | README/development docs and product positioning | verified for packet |
| `visual_system` | Existing tour UI and brand source | pending Taste audit |
| `asset_plan` | 360 tour slots, floor/time/view media, tenant assets | pending second tenant proof |
| `section_plan` | Public viewer, per-tenant admin, operator console | verified from docs |
| `interaction_plan` | Upload, draft, publish, rollback, public viewer navigation | pending live second tenant run |
| `acceptance_checks` | Typecheck/test/deploy/new-client commands from docs plus live public route probe | pending local build proof |

## Adapter / Service Map

| Provider / Route | Inputs | Outputs | Failure Modes | Tenant Mapping | Privacy Boundary |
| --- | --- | --- | --- | --- | --- |
| Cloudflare Worker `vantyx` | Tenant config and deploy bundle | Public viewer and APIs | Broken deploy, wrong tenant binding, route mismatch | tenant slug, e.g. `marina-one-ka` | Secrets remain in Wrangler, not packet files |
| Cloudflare KV/R2 | Tour config and panoramic media | Tenant data and assets | Missing assets, stale config, wrong bucket binding | per-tenant keys/assets | Do not expose source media beyond intended public assets |
| Cloudflare Access/Turnstile | Admin login and bot protection | Protected admin path | Login or Turnstile not verified live | tenant admin context | Admin credentials not recorded in packet |
| PostHog | Product analytics | Event proof and usage reports | Not configured or unverified | tenant/project events | Analytics activation needs consent boundary |
| Resend | Email notifications | Tenant/admin emails | Domain not ready or mail not verified | tenant/project messages | Production sender setup remains approval-gated |

## Evidence Ledger

| Status | Evidence |
| --- | --- |
| verified | `INFRA_STATUS.md` maps GetVantyx/Vantyx to `Panaroma-Webapp`. |
| verified | `Panaroma-Webapp/README.md` names Vantyx and the Marina One live reference. |
| verified | `Panaroma-Webapp/docs/DEVELOPMENT.md` documents stack, commands, architecture, deploy, and secrets boundaries. |
| verified | `Panaroma-Webapp/worker/wrangler.toml` names Worker `vantyx`. |
| verified | Public probe reported `https://marina-one-ka.tryvantyx.space/` returned HTTP 200 and `/api/config` returned JSON with `schemaVersion: 1`, `version: 1`, and tenant `marina-one-ka`. |
| pending | Local `bun run typecheck`, `bun test`, deploy, and `bun run new-client ...` were documented but not run in this Cambium packet pass. |
| blocked | Second-client dogfood, PostHog confirmation, Resend domain readiness, and Turnstile live-login checks remain unproven. |
| no-signal | No Cambium/Plexus proof reporting integration is present in this packet yet. |

## Gate Ledger

| Gate | Status | Required Proof |
| --- | --- | --- |
| Human approvals | pending | Approve target second tenant and public claims. |
| Spend approvals | pending | Approve any paid Cloudflare/domain/email actions beyond existing config. |
| Privacy/legal | pending | Confirm analytics/email consent language for tenant operators and visitors. |
| Payment | no-signal | No payment flow evidenced in this packet. |
| Customer contact | pending | Approve developer/agency outreach and tenant onboarding copy. |
| Public claims | blocked | Do not claim repeatable multi-tenant readiness until second tenant proof and rollback proof pass. |
| Credentials | blocked | Production secrets remain Wrangler-managed; no local env file was read for this packet. |

## Quest Queue

1. Create a second-tenant candidate and approval note.
2. Run `bun run new-client ...` in the product repo with proof capture.
3. Deploy or stage the second tenant and capture `/api/config` health.
4. Prove publish and rollback on a non-destructive tenant update.
5. Confirm PostHog event capture for the tenant.
6. Confirm Resend domain/email readiness if email is part of the tenant flow.
7. Wire tour/deployment health into Cambium/Plexus proof reporting.

Current frontier: tenant proof and rollback proof.

Garden cadence: weekly tenant health after second tenant proof exists.

Cortex ingestion targets: this packet, Vantyx brand brief, product README/development docs, deploy receipts, and second-tenant proof.

First real pilot proof: a real second tenant onboarded through `new-client --apply` with public health and rollback evidence.

## Branch Story Controls

| Control | Value |
| --- | --- |
| arc_title | `Second Tenant Publish Proof` |
| vision | Vantyx becomes a repeatable supervised tenant branch that can onboard, publish, roll back, and report proof for immersive real-estate tours. |
| icp | View-led developer or agency operator who needs a branded tour live under a tenant slug with safe updates. |
| current_frontier | Second-tenant onboarding, publish health, rollback proof, analytics confirmation, and customer-claim approval. |
| narrative_voice | Deployment operator voice: create tenant, prove route health, prove rollback, then report evidence. |
| anti_claims | Do not claim repeatable SaaS readiness, live admin readiness, or analytics proof until the second tenant path is evidenced. |

## Mission Control Inputs

| mission_id | title | type | owner | gate | proof_required | dispatch_target |
| --- | --- | --- | --- | --- | --- | --- |
| vantyx-second-tenant | Create and health-check second tenant | proof | founder/codex | Tenant proof | `new-client` receipt plus `/api/config` health | cambium |
| vantyx-rollback-proof | Prove non-destructive publish and rollback | proof | codex | Rollback proof | deploy log plus before/after health receipt | hermes |
| vantyx-analytics-proof | Confirm tenant analytics event capture | proof | founder/codex | Analytics consent | PostHog event receipt without secret values | plexus-agent-fabric |

## KPI Control Inputs

| kpi_id | label | survival | better_than_survival | source | current_state |
| --- | --- | --- | --- | --- | --- |
| vantyx-second-tenant-live | Second tenant public health | one real second tenant serves `/api/config` successfully | tenant has publish and rollback receipts | Worker route probe and config receipt | pending |
| vantyx-repeatable-deploy-proof | Repeatable deploy proof | documented tenant creation works once | deploy, rollback, analytics, and proof report all close | product repo commands and Cambium proof packet | blocked by second-client proof |

## Policy / Permission Inputs

| permission | status | required_approval | failure_mode |
| --- | --- | --- | --- |
| target second tenant | pending | founder approves tenant/project candidate | no real onboarding mission dispatch |
| production deploy/custom domain | pending | founder approves Cloudflare route/domain change | no public proof claim |
| analytics/email activation | pending | founder approves consent boundary | analytics and email proof stay blocked |
| public SaaS readiness claims | blocked | second-tenant, login, rollback, analytics proof accepted | mini app must show supervised branch only |

## Dispatch Inputs

| route | payload_hint | allowed_when | blocked_when |
| --- | --- | --- | --- |
| cambium-bridge-assignment | `vantyx-second-tenant` with branchMission metadata | target tenant and proof scope are approved | no tenant candidate or route approval |
| hermes-topic-assignment | `vantyx-rollback-proof` as supervised proof task | staging or production target is named | deploy permissions are missing |
| plexus-agent-fabric | `vantyx-analytics-proof` for member proof report | analytics boundary is approved | consent or PostHog access is missing |

## Proof Foldback

| proof_id | source_path | validates | promotes |
| --- | --- | --- | --- |
| vantyx-tenant-health-proof | future route probe and `/api/config` receipt | second tenant serves correct config | keeps supervised branch active |
| vantyx-rollback-proof | future publish/rollback command receipts | tenant updates can be reversed safely | unlocks repeatability review |
| vantyx-analytics-proof | future analytics receipt | tenant events are captured without leaking secrets | supports later GTM/reporting gate |

## Promotion Rule

Vantyx is currently `supervised-branch`. The ladder remains `proof-only -> supervised branch -> autonomous branch`.

Do not call Vantyx autonomous until second-client dogfood, tenant proof, live admin/login checks, analytics/email proof, and Cambium/Plexus foldback are complete.
