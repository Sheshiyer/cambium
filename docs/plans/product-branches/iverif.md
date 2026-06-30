---
schema: cambium.product_branch_packet.v1
product_id: iverif
name: IVerif
role: Compliance and proof product candidate
promotion_state: proof-only
current_gate: Claim/proof separation before automation
packet_owner: cambium
---

# IVerif Product Branch Packet

IVerif is a proof-only Cambium product candidate for AI document validation in EU energy subsidy workflows. Current evidence supports a brand/wiki/research packet, not live product readiness, compliance readiness, or branch promotion readiness.

## Product Seed

| Field | Value |
| --- | --- |
| product_id | `iverif` |
| one_sentence_seed | AI document validation for EU energy subsidy operators, focused on catching dossier errors before subsidy submission. |
| founder_intent | Preserve IVerif as a proof-only candidate until public claims, compliance evidence, and route/build proof are separated and verified. |
| target_customer | Energy subsidy operators, compliance teams, and regulatory auditors handling CEE, BEG, ECO4, and related EU subsidy dossiers. |
| pain_or_desire | Operators need to reduce dossier errors and produce auditable validation before subsidy submission. |
| offer | SaaS/API dossier validation with AI document checks, programme-rule validation, audit trails, managed onboarding, and reporting/export workflows. |
| survival_metric | One source-linked claim review identifies which claims are supportable, blocked, or no-signal. |
| better_than_survival_metric | Wiki/product route builds cleanly and one operator-approved validation workflow is evidenced without compliance overclaim. |
| GTM_channel | Compliance/operator research and proof-led pilot conversations only after claim review. |
| constraints | No automation before claim/proof separation; no compliance/security/performance claim without direct evidence. |
| third_party_apps | Brandmint, NotebookLM, Vercel/GitHub, Astro/MDX/GSAP, fal.ai/nano-banana-pro, GPT Image, OpenAI, OpenRouter, Replicate, inference providers mentioned by config/scripts. |
| autonomy_boundary | Proof-only sidecar; Cambium may record evidence but must not automate outreach or validation claims. |
| approvals | Source-linked claim review, privacy/security evidence, operator approval, build/route proof, and compliance wording approval. |

## Organ Routing

| Organ | Owner | Input | Output | Proof Path | Current Gate |
| --- | --- | --- | --- | --- | --- |
| Genesis | Brandmint/IVerif source | Brand, wiki, and research assets | `brand_system`, `copy_system`, `visual_system` | Brandmint outputs and wiki artifacts | verified for packet only |
| Taste | Cambium taste/compliance review | Public claims and product copy | Claim/reroll verdict | Future source-linked review | blocked |
| Hands | IVerif repo/wiki site | Build/route verification tasks | Build proof and route proof | Future wiki commands | blocked |
| Will | GTM/operator routines | Approved claims and operator targets | Pilot outreach/tasking | Future approval log | blocked |
| Cortex | Cambium/Cortex memory | Claim map and evidence ledger | Searchable proof memory | Future ingestion | pending |
| Hermes | Hermes reports | Review tasks only | Founder-facing proof summary | Future report | pending |
| Garden | Proof cadence | Claim review and build proof outcomes | Follow-up routine | Future pulse | pending |

## Variable Contract Payload

| Group | Current Source | Status |
| --- | --- | --- |
| `brand_system` | `brand-config.yaml`, `.brandmint-state.json`, `.brandmint/outputs/*.json` | verified for brand packet |
| `copy_system` | Wiki output, brand outputs, NotebookLM artifacts | pending claim/proof review |
| `visual_system` | Website assets guide, generated/publish manifests, image provider references | pending asset/source review |
| `asset_plan` | NotebookLM artifacts and website assets | pending |
| `section_plan` | Astro wiki-site source and wiki-output docs | pending build proof |
| `interaction_plan` | SaaS/API validation flow appears as copy/spec, not proven runtime | no-signal |
| `acceptance_checks` | `wiki-site/package.json` commands are present, but route/build proof is missing | blocked |

## Adapter / Service Map

| Provider / Route | Inputs | Outputs | Failure Modes | Tenant Mapping | Privacy Boundary |
| --- | --- | --- | --- | --- | --- |
| Brandmint | Brand config and generation state | Brand/copy/visual outputs | Generated claims outpace evidence | `iverif` brand seed | Source sanitization required |
| NotebookLM artifacts | Research/source material | Explainer and knowledge artifacts | Unsourced or stale claims | proof packet source | Sanitize source material before publication |
| Astro wiki-site | Wiki source | Static site/routes | `dist` missing, verify scripts missing | `iverif` docs site | No sensitive source leakage |
| Inference/image providers | Prompt/config inputs | Images or generated content | Missing API tokens, unverified provider output | brand/wiki artifacts | Do not record provider keys |
| Future SaaS/API | Dossier documents and rules | Validation results and audit trail | Compliance/security/performance overclaim | future tenant/account | GDPR, residency, encryption, DPA, and audit evidence required |

## Evidence Ledger

| Status | Evidence |
| --- | --- |
| verified | Product-context agent found `brand-config.yaml`, `.brandmint-state.json`, seven `.brandmint/outputs/*.json` outputs, `wiki-output/*.md`, `deliverables/notebooklm/artifacts/*`, `wiki-site` Astro source, `WEBSITE_ASSETS_GUIDE.md`, and generation/publish manifests. |
| verified | `wiki-site/package.json` declares `dev`, `build`, `preview`, `verify:data`, and `verify:routes`. |
| blocked | `wiki-site/dist` is missing, and `verify:*` points at a missing `scripts/` directory, so build/route proof is not established. |
| blocked | GDPR, ISO 27001, SOC 2, EU residency, encryption, SAML/OAuth, SLA, and DPA claims are copy/spec claims unless separately evidenced. |
| blocked | Performance and market claims need source-linked review before public use. |
| no-signal | No live SaaS/API validation workflow proof was found in this packet pass. |

## Gate Ledger

| Gate | Status | Required Proof |
| --- | --- | --- |
| Human approvals | blocked | Operator approval before promotion, outreach, or public proof claims. |
| Spend approvals | pending | Approval before provider-backed generation or validation runs. |
| Privacy/legal | blocked | GDPR, residency, encryption, DPA, audit trail, and source-sanitization evidence. |
| Payment | no-signal | No payment or billing route evidenced. |
| Customer contact | blocked | No outreach until claim/proof review is complete. |
| Public claims | blocked | Separate claims such as only AI platform, leading operators, 90 percent error reduction, <5 min processing, <200ms API, 99.9 percent uptime, <2 percent rejection, compliance certifications, and market-volume numbers. |
| Credentials | blocked | Config references external env/provider token surfaces; no key values belong in packets. |

## Quest Queue

1. Create a source-linked claim table for every public/compliance/performance claim.
2. Mark each claim verified, blocked, pending, or no-signal.
3. Repair or replace missing wiki-site verification scripts.
4. Run wiki build and route proof.
5. Produce privacy/security evidence for any compliance statement.
6. Get explicit operator approval before any product-branch promotion.
7. Keep Cambium sidecar disabled/proof-only until the above gates close.

Current frontier: claim/proof separation before automation.

Garden cadence: weekly proof review only; no autonomous execution cadence.

Cortex ingestion targets: this packet, claim table, sanitized source list, build/route proof, and compliance evidence.

First real pilot proof: one operator-approved validation workflow with sourced rules, audit trail, privacy/security evidence, and no unsupported public claim.

## Branch Story Controls

| Control | Value |
| --- | --- |
| arc_title | `Claim Proof Separation` |
| vision | IVerif becomes a proof-only compliance candidate whose public claims, build routes, and privacy statements are separated before any automation. |
| icp | Compliance operator or subsidy workflow owner who needs source-linked validation claims and auditable dossier checks. |
| current_frontier | Claim table, wiki build/route proof, privacy/security evidence, and explicit operator approval. |
| narrative_voice | Compliance reviewer voice: cite the claim, prove the route, block unsupported automation. |
| anti_claims | Do not claim compliance certification, performance, uptime, market leadership, or live SaaS validation before direct evidence. |

## Mission Control Inputs

| mission_id | title | type | owner | gate | proof_required | dispatch_target |
| --- | --- | --- | --- | --- | --- | --- |
| iverif-claim-table | Build source-linked claim table | proof | founder/codex | Public claims | claim table with status per claim | cambium |
| iverif-wiki-proof | Repair and run wiki build/route proof | implementation | codex | Build proof | `verify:data`, `verify:routes`, and build receipt | hermes |
| iverif-privacy-evidence | Produce privacy/security evidence map | proof | founder/codex | Privacy/legal | evidence map or blocked-control list | plexus-agent-fabric |

## KPI Control Inputs

| kpi_id | label | survival | better_than_survival | source | current_state |
| --- | --- | --- | --- | --- | --- |
| iverif-claim-map-complete | Source-linked claim map | every public claim is marked verified, blocked, pending, or no-signal | unsupported claims are removed or rewritten | claim table | blocked |
| iverif-build-route-proof | Wiki build and route proof | wiki route builds without missing script errors | product route plus claim-safe copy are ready for review | wiki-site commands | blocked |

## Policy / Permission Inputs

| permission | status | required_approval | failure_mode |
| --- | --- | --- | --- |
| public/compliance claims | blocked | founder approves source-linked claim table | no public route or outreach automation |
| provider-backed generation | pending | founder approves spend and source sanitation | generation remains disabled |
| privacy/security wording | blocked | evidence exists for each claim | mini app must show proof-only state |
| operator outreach | blocked | operator approval after proof separation | no GTM dispatch |

## Dispatch Inputs

| route | payload_hint | allowed_when | blocked_when |
| --- | --- | --- | --- |
| cambium-bridge-assignment | `iverif-claim-table` as proof-only review task | source list is available and claim scope is defined | claims remain unsourced |
| hermes-topic-assignment | `iverif-wiki-proof` for repair/build proof | repo path and missing scripts are confirmed | provider secrets or publication claims are needed |
| plexus-agent-fabric | `iverif-privacy-evidence` as member review task | privacy/security claims are enumerated | legal/compliance evidence is missing |

## Proof Foldback

| proof_id | source_path | validates | promotes |
| --- | --- | --- | --- |
| iverif-claim-proof | future claim table | public claims are separated by evidence state | remains proof-only until operator approval |
| iverif-wiki-route-proof | future wiki build and route receipt | site can build and routes can verify | unlocks review, not automation |
| iverif-privacy-proof | future privacy/security evidence map | compliance statements have supporting evidence or are blocked | supports supervised-branch review only after approval |

## Promotion Rule

IVerif is currently `proof-only`. The ladder remains `proof-only -> supervised branch -> autonomous branch`.

Do not promote or automate IVerif until claim/proof separation, privacy/security evidence, successful wiki build/route proof, and explicit operator approval are complete.
