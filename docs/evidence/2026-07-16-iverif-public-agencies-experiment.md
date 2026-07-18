# IVerif Public Agencies Experiment — 2026-07-16

## Decision

Treat the current IVerif campaign as observed production drift, not proof that the product or its automation gates are ready. The next useful experiment changes one discovery variable while preserving the `proof-only`, `observe-only`, and `sendEligible=false` controls in Cambium.

No campaign edit or dispatch is authorized by this packet.

## Fixed Campaign

| Field | Value |
| --- | --- |
| Product | IVerif |
| Cambium branch | `iverif` |
| Explee project | `16763` |
| Explee campaign | `45711` (`Public Agencies`) |
| Founder surface | Telegram `clients:804` |
| Working persona | Regulatory Auditor / Programme Administrator |
| Current policy | `proof-only`, customer contact blocked |

## Source Snapshot

The source snapshot is version `2026-07-16`. Its composite SHA-256 is `61eb4fc915b4b50b73a1ac7eeee7d425abf8f4f55d332089933d230993fa113e`, calculated from newline-delimited `<portable source path> <sha256>` records in the exact order stored by `workers/quests/src/iverif-grounding.ts`.

| Source path | What it contributes | Evidence limit |
| --- | --- | --- |
| `iverif/wiki-output/audience/primary-persona.md` | Dossier-review pressure, audit concerns, and buyer decision criteria | Frontmatter source list is empty; figures are not market facts |
| `iverif/wiki-output/audience/secondary-personas.md` | Regulatory Auditor / Programme Administrator and Programme Director hypotheses for public agencies | Frontmatter source list is empty; roles remain hypotheses until lead and reply reconciliation |
| `iverif/wiki-output/product/overview.md` | Product framing and intended workflow | Outcomes and support claims are unsourced |
| `iverif/wiki-output/product/features.md` | Intended feature and programme vocabulary | Feature availability and compliance wording are unverified |
| `iverif/wiki-output/brand/voice-tone.md` | Precise, problem-aware, non-hyped tone | Quantified capability language still requires proof |
| `iverif/wiki-output/marketing/campaign-copy.md` | Existing rejection, operator, and audit framing | Customer proof, exclusivity, and outcomes are unsourced |
| `iverif/wiki-output/marketing/email-templates.md` | Email asset lineage checkpoint | The page explicitly reports no source outputs |

The wiki is a hypothesis source, not a claim authority. None of its product claims is promoted to `verified` by this packet.

## Observed Campaign Baseline

The direct Explee read observation recorded on 2026-07-16 showed:

- 2,921 sends;
- 17 replies;
- 0.6% provider-reported reply rate;
- six provider-labelled hot leads;
- $87.63 spend;
- 2,779 of 2,887 campaign-pool records used.

All 17 replies are unclassified in the reviewed Cambium evidence. Reply count and provider hot-lead labels do not establish qualified demand. Classify every existing reply before calculating a qualified baseline or declaring a winning treatment.

## Claim Ledger

| Claim family | Status | Reason |
| --- | --- | --- |
| Manual exception/review-trail pain | `hypothesis` | The wiki describes related pressure but links no source |
| Review-trail framing improves qualified replies | `hypothesis` | This is the variable under test |
| Performance and accuracy | `blocked` | No direct benchmark or production receipt |
| Certifications, security, residency, GDPR | `blocked` | No certification or control evidence |
| Customer or regulatory-body outcomes | `blocked` | No named customer, receipt, or source |
| CEE, BEG, ECO4 programme support | `blocked` | No rule corpus or operator validation |
| One-week onboarding | `blocked` | No dated implementation evidence |
| Market volumes, rejection rates, backlogs | `blocked` | Persona figures are unsourced |
| Only, leading, complete, audit-ready | `blocked` | No comparative or completeness proof |
| Compliance or audit guarantees | `blocked` | No legal, regulatory, or product proof |

The machine-readable ledger is `workers/quests/src/iverif-grounding.ts`.

## One-Variable Experiment

**Variable:** discovery framing.

**Control:** operator workload and dossier-rejection framing.

**Treatment:** manual exception review and defensible review-trail discovery framing.

**Proof-safe treatment frame:**

> When a subsidy dossier needs manual exception review, how does your team reconstruct the evidence behind the decision? I am researching where that review trail becomes difficult to defend. If someone else owns that process, could you route me to them?

This is a discovery question. It does not claim that IVerif is live, supported for a programme, compliant, faster, more accurate, or used by another organization.

**Routing CTA:** “Route me to whoever reviews manual dossier exceptions and their supporting evidence trail.”

## Measurement Contract

The primary metric is **classified qualified reply rate**. Provider reply rate is descriptive, not the success criterion. Guardrails are negative reply rate, unsupported-claim incidence, and routing accuracy.

A treatment observation requires at least 100 sends and seven elapsed days, plus complete classification of replies in both the historical baseline and treatment. Those thresholds do not authorize dispatch; an operator must approve the later campaign change after read parity and one-writer reconciliation.

Stop the experiment if:

- any treatment message introduces a blocked product claim;
- any privacy, consent, routing, or recipient-scope concern is reported;
- provider ownership or auto-reply state becomes ambiguous;
- reply classification remains incomplete at the observation threshold.

## Live Drift and Next Gate

The live campaign state conflicts with the IVerif packet's blocked customer-contact gate. That is a reconciliation requirement, not evidence that the packet should silently become permissive. Cambium remains the policy boundary and the provider adapter remains GET-only.

The next reviewable slice may expose redacted snapshot, inbox, thread, and optimization reads through Cambium and Hermes. Drafting starts only after those views match direct provider truth. Sending remains a later signed-action slice.
