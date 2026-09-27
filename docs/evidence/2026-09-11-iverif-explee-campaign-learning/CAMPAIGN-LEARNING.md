# IVerif Explee campaign learning pack

**Observed at:** 2026-09-11T10:17:03.310Z
**Project:** `16763`
**Posture:** GET-only · mutation_enabled=false · spend freeze · no POST
**Network:** 60 calls, non-GET=0, failures=0

## Executive verdict

- Project spend **$194.52** across **14** campaigns.
- Sends **6484**, replies **33**, overall reply rate **0.51%**, provider hot leads **5**.
- Autopilot enabled: **False**. Auto-reply enabled: **True** (one-writer conflict still live if Cambium also considers outreach).
- Only **Grant-Making Foundations (`56316`)** clears a thin relative-winner bar (1.70% / 5 replies / $8.61). Absolute pipeline value is still weak (0 provider-hot).
- Dominant failure mode: **broad public-sector / funding ICPs + high send volume + weak qualification**, with spend concentrated in Public Agencies.

## Ranking (spend descending)

| ID | Campaign | Status / reason | Spend | Sent | Replies | Rate | Hot | $/reply | Label |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 45711 | Public Agencies | listening/user_pause | $88.02 | 2934 | 19 | 0.60% | 5 | $4.63 | `money_guzzler` |
| 45709 | Energy Consultants | listening/agent_stop | $23.10 | 770 | 2 | 0.30% | 0 | $11.55 | `mixed_low_yield` |
| 45710 | Utility Providers | listening/lead_pool_exhausted | $14.58 | 486 | 1 | 0.20% | 0 | $14.58 | `mixed_low_yield` |
| 50767 | RGE Renovation Installers | listening/lead_pool_exhausted | $11.16 | 372 | 1 | 0.30% | 0 | $11.16 | `mixed_low_yield` |
| 51190 | Research Funding Councils | listening/agent_stop | $9.81 | 327 | 2 | 0.60% | 0 | $4.91 | `mixed_low_yield` |
| 45708 | Subsidy Aggregators | listening/lead_pool_exhausted | $9.09 | 303 | 1 | 0.30% | 0 | $9.09 | `mixed_low_yield` |
| 56316 | Grant-Making Foundations | listening/agent_stop | $8.61 | 287 | 5 | 1.70% | 0 | $1.72 | `relative_winner` |
| 45712 | Energy Lenders | listening/lead_pool_exhausted | $8.07 | 269 | 0 | 0.00% | 0 | — | `low_spend_low_yield` |
| 56828 | Structural Fund Authorities | listening/agent_stop | $6.96 | 232 | 1 | 0.40% | 0 | $6.96 | `mixed_low_yield` |
| 45707 | Energy EPC Firms | listening/user_pause | $6.42 | 214 | 1 | 0.50% | 0 | $6.42 | `mixed_low_yield` |
| 60825 | National Funding Agencies | listening/lead_pool_exhausted | $3.96 | 132 | 0 | 0.00% | 0 | — | `low_spend_low_yield` |
| 52261 | Innovation Enterprise Agencies | listening/agent_stop | $2.61 | 87 | 0 | 0.00% | 0 | — | `low_spend_low_yield` |
| 63001 | Public Agencies South | listening/user_pause | $1.32 | 44 | 0 | 0.00% | 0 | — | `low_spend_low_yield` |
| 60150 | Education Fund Administrators | listening/agent_stop | $0.81 | 27 | 0 | 0.00% | 0 | — | `low_spend_low_yield` |

## What failed

### Public Agencies (`45711`)
- **Label:** `money_guzzler` · spend $88.02 · sent 2934 · replies 19 (0.60%) · hot 5
- **Target:** role=`we look for program managers responsible for reviewing subsidy applications and preventing fraud at public agencies` · geo=`France, Germany, Belgium, Netherlands` · lang=`auto`
- **Problem framing:** Fraud and errors waste budgets
- **Offer framing:** Review applications, cross-check supporting evidence, and prevent fraudulent payouts
- **Inbox intents (sample tabs):** {'hot_lead': 2, 'not_interested': 3, 'out_of_office': 42, 'email_changed': 1, 'recipient_gone': 2} · replied-tab total=169
- **Failure read:** Highest burn. July 2026 snapshot already showed ~0.6% reply rate; live now ~19 replies / ~2934 sends / $88 with only 5 provider-hot and 1 unqualified. Public-agency ICP is too diffuse for dossier-validation SaaS; auto-reply may inflate activity without qualified pipeline.

### Energy Consultants (`45709`)
- **Label:** `mixed_low_yield` · spend $23.10 · sent 770 · replies 2 (0.30%) · hot 0
- **Target:** role=`we look for consulting leads who oversee client subsidy files and approval quality` · geo=`France, Germany, Belgium, Netherlands` · lang=`auto`
- **Problem framing:** Clients lose subsidies from errors
- **Offer framing:** Audit client documents, verify eligibility evidence, and strengthen approval rates
- **Inbox intents (sample tabs):** {'email_changed': 3, 'out_of_office': 3, 'not_interested': 1, 'unknown': 1} · replied-tab total=8
- **Failure read:** Spend without meaningful reply density. Likely ICP/message mismatch or exhausted/poor pool quality (`lead_pool_exhausted` / `agent_stop` common).

### Utility Providers (`45710`)
- **Label:** `mixed_low_yield` · spend $14.58 · sent 486 · replies 1 (0.20%) · hot 0
- **Target:** role=`we look for those who manage customer grant processing and onboarding operations at utilities` · geo=`France, Germany, Belgium, Netherlands` · lang=`auto`
- **Problem framing:** Backlogs slow customer onboarding
- **Offer framing:** Check customer files, validate program rules, and speed grant processing
- **Inbox intents (sample tabs):** {'unknown': 1, 'not_interested': 1, 'email_changed': 3, 'out_of_office': 20} · replied-tab total=25
- **Failure read:** Spend without meaningful reply density. Likely ICP/message mismatch or exhausted/poor pool quality (`lead_pool_exhausted` / `agent_stop` common).

### RGE Renovation Installers (`50767`)
- **Label:** `mixed_low_yield` · spend $11.16 · sent 372 · replies 1 (0.30%) · hot 0
- **Target:** role=`we look for those who own subsidy claim filing and administrative back-office at installer companies` · geo=`France, Italy, Germany, Spain, Belgium` · lang=`auto`
- **Problem framing:** Rejected energy claims erode installer margins
- **Offer framing:** Validate CEE and renovation grant files per project before submitting them
- **Inbox intents (sample tabs):** {'out_of_office': 3, 'email_changed': 2, 'recipient_gone': 2} · replied-tab total=7
- **Failure read:** Spend without meaningful reply density. Likely ICP/message mismatch or exhausted/poor pool quality (`lead_pool_exhausted` / `agent_stop` common).

### Research Funding Councils (`51190`)
- **Label:** `mixed_low_yield` · spend $9.81 · sent 327 · replies 2 (0.60%) · hot 0
- **Target:** role=`we look for programme officers who own grant application review and award quality` · geo=`Netherlands, Germany, France, United Kingdom, Belgium` · lang=`auto`
- **Problem framing:** High application volumes hide eligibility errors
- **Offer framing:** Review research grant applications, cross-check eligibility evidence, and prevent erroneous awards
- **Inbox intents (sample tabs):** {'not_interested': 2, 'out_of_office': 25, 'recipient_gone': 2, 'email_changed': 2} · replied-tab total=31
- **Failure read:** Spend without meaningful reply density. Likely ICP/message mismatch or exhausted/poor pool quality (`lead_pool_exhausted` / `agent_stop` common).

### Subsidy Aggregators (`45708`)
- **Label:** `mixed_low_yield` · spend $9.09 · sent 303 · replies 1 (0.30%) · hot 0
- **Target:** role=`we look for operations leaders responsible for dossier review workflows at subsidy aggregators` · geo=`France, Germany, Belgium, Netherlands` · lang=`auto`
- **Problem framing:** Manual review misses costly errors
- **Offer framing:** Screen high volumes, standardize claim files, and flag incomplete dossiers
- **Inbox intents (sample tabs):** {'email_changed': 1, 'out_of_office': 2, 'not_interested': 1} · replied-tab total=4
- **Failure read:** Spend without meaningful reply density. Likely ICP/message mismatch or exhausted/poor pool quality (`lead_pool_exhausted` / `agent_stop` common).

### Energy Lenders (`45712`)
- **Label:** `low_spend_low_yield` · spend $8.07 · sent 269 · replies 0 (0.00%) · hot 0
- **Target:** role=`we look for credit or underwriting leads who validate grant-backed financing dossiers at energy lenders` · geo=`France, Germany, Belgium, Netherlands` · lang=`auto`
- **Problem framing:** Unverified dossiers stall financing
- **Offer framing:** Verify financing files, confirm grant eligibility, and avoid deal delays
- **Inbox intents (sample tabs):** {'out_of_office': 10, 'unknown': 2} · replied-tab total=12
- **Failure read:** Spend without meaningful reply density. Likely ICP/message mismatch or exhausted/poor pool quality (`lead_pool_exhausted` / `agent_stop` common).

### Structural Fund Authorities (`56828`)
- **Label:** `mixed_low_yield` · spend $6.96 · sent 232 · replies 1 (0.40%) · hot 0
- **Target:** role=`we look for programme managers who own beneficiary claim verification and first-level control at managing authorities` · geo=`Italy, Spain, France, Germany, Belgium` · lang=`auto`
- **Problem framing:** Ineligible claims cause audits and financial corrections
- **Offer framing:** Review beneficiary claims and cross-check eligibility for ERDF and ESF cohesion programmes
- **Inbox intents (sample tabs):** {'not_interested': 1, 'recipient_gone': 1, 'out_of_office': 11} · replied-tab total=13
- **Failure read:** Spend without meaningful reply density. Likely ICP/message mismatch or exhausted/poor pool quality (`lead_pool_exhausted` / `agent_stop` common).

### Energy EPC Firms (`45707`)
- **Label:** `mixed_low_yield` · spend $6.42 · sent 214 · replies 1 (0.50%) · hot 0
- **Target:** role=`we look for those who own subsidy claim submissions and project administration at EPC firms` · geo=`France, Germany, Belgium, Netherlands` · lang=`auto`
- **Problem framing:** Rejected claims delay cashflow
- **Offer framing:** Validate project dossiers, catch missing proofs, and reduce submission rejections
- **Inbox intents (sample tabs):** {'out_of_office': 7, 'email_changed': 1} · replied-tab total=8
- **Failure read:** Spend without meaningful reply density. Likely ICP/message mismatch or exhausted/poor pool quality (`lead_pool_exhausted` / `agent_stop` common).

## What relatively worked

- Best reply rate observed: **Grant-Making Foundations** (`56316`) at **1.70%** with 5 replies on $8.61 spend.
- Public Agencies still has the only meaningful provider-hot cluster (**5 hot**, intents `{'hot_lead': 2, 'not_interested': 3, 'out_of_office': 42, 'email_changed': 1, 'recipient_gone': 2}`), but cost/lead ~$17.60 and overall rate remains sub-1%. Treat hot as **review queue**, not demand proof.

## Cross-campaign patterns

1. **Almost all campaigns are `listening`** with stop reasons `agent_stop`, `lead_pool_exhausted`, or `user_pause` — active burn appears historically front-loaded, not currently blasting (verify in UI).
2. **Auto-reply is ON** project-wide while Cambium policy wants observe-only / sendEligible=false → ownership conflict remains.
3. **Geography/language** in campaign specs often English/international public funding; FR CEE operator ICP from Meristem v2 is not what these campaigns optimized for.
4. **Reply inventory exists** (CRM export sampled opaque IDs), but need_reply tab is empty — conversations are in replied/historical state needing classification, not urgent reply drafting.

## Recommendations (still no Explee POST)

1. Keep **spend freeze**; do not restart pools.
2. Disable or reconcile **auto-reply** ownership before any new outreach.
3. Classify Public Agencies replied-tab intents (hot/not_interested/etc.) into CRM stages for non-Explee follow-up.
4. Next GTM tests should use **FR délégataire / CEE back-office ICP** from Meristem iverif pack, not broad Public Agencies.
5. Use `crm/contacts.json` as the portable contact graph for LinkedIn FR / email / Telegram organs — opaque IDs + intents only.

## Artifacts

- `inventory.json` — full GET-only inventory
- `network-log.json` — method/status proof (GET only)
- `crm/contacts.json` — redacted CRM export
- `fetch-read-only.mjs` — reproducible puller



## Cutover decision (2026-09-11)
Operator decision: **archive project 16763** and run future IVerif Explee GTM in a **new project** so stats are not polluted. Old hot queue **dropped**. Public API cannot create projects — UI create required, then bind new `project_id`.
