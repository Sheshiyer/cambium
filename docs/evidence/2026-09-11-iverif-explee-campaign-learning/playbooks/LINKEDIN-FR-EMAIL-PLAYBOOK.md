# Non-Explee playbook — LinkedIn FR + manual email

**Date:** 2026-09-11
**Source of truth:** `crm/organ-export.json` + Meristem FR GTM pack
**Explee posture:** do not send / do not auto-reply / spend freeze

## Goal

## Cutover lock (2026-09-11)
Project **16763** is **historical only**. Do not send from the old hot queue. Create a **new Explee project** in the UI and paste the ID before any new Explee-bound GTM. Non-Explee FR frames below remain usable only for **future** clean-ICP contacts — not the dropped Public Agencies hot set.

Reuse Explee-learned contacts on channels Cambium organs can operate without Explee write:
1. LinkedIn FR (manual or approved social-growth drafts)
2. Manual email outside Explee
3. Telegram operator escalation for qualified only

## Queue rules
| Stage | Count (current export) | Channel action |
|---|---:|---|
| `qualify` | 6 | **Active** after operator verdict `qualified_fr_operator` only |
| `nurture_later` | 159 | No outreach until OOO window passed; optional LinkedIn FR soft touch later |
| `closed_lost` | 13 | Mine objections; do not contact |
| `data_repair` / `suppress` / `classify` | see organ-export summary | Repair or ignore |

## Active qualify queue (hot intents — pending your FR-operator verdict)

| personId | campaign | replies | latestReplyAt | LinkedIn FR? | Manual email? | Verdict |
|---|---|---:|---|---|---|---|
| `40b873da-d4dc-4ea3-8a8b-5a74af73f7ea` | Public Agencies (45711) | 2 | 2026-07-17T09:44:06Z |  |  | pending |
| `0ae6da64-ff7a-47a3-92ec-7e8aa83edb00` | Public Agencies (45711) | 2 | 2026-07-17T06:17:06Z |  |  | pending |
| `27f0b52c-005b-4a14-bfb7-334d72a60a65` | Public Agencies (45711) | 1 | 2026-07-09T15:33:59Z |  |  | pending |
| `4d2abc82-9bc3-41c4-85a2-c5bbd6588f2b` | Public Agencies (45711) | 1 | 2026-07-07T12:40:56Z |  |  | pending |
| `c04b057b-82b4-40da-9d8e-e41da41f321a` | Public Agencies (45711) | 1 | 2026-06-25T09:12:42Z |  |  | pending |
| `6b737f33-8c14-4751-a008-d75940f70cd6` | Public Agencies (45711) | 1 | 2026-06-22T08:52:59Z |  |  | pending |

## LinkedIn FR message frames (from Meristem FR ICP — not Public Agencies fraud pitch)

Use only after `qualified_fr_operator`. Vouvoiement. No hype. No rejection-rate claims.

### Connection note
> Bonjour {{prenom}}, je travaille sur la validation de dossiers CEE / Primes Énergie avant dépôt (contrôles inter-documents + piste d’audit). Si vous gérez un back-office délégataire / ops, je serais preneur d’un échange court.

### Follow-up (if accepted)
> Contexte: beaucoup d’équipes perdent du temps sur des incohérences de pièces découvertes trop tard. iverif.fr aide à signaler les écarts avant dépôt — sans se substituer à l’obligé / délégataire. Seriez-vous ouvert à une démo de 20 minutes sur un dossier type ?

### Anti-patterns (from Explee learning)
- Do not lead with “fraud prevention for public agencies” to FR CEE ops.
- Do not reuse multi-country public-funding ICPs that burned $194.
- Do not claim PNCEE endorsement or outcome %.

## Manual email frames (outside Explee)

Subject options:
1. `Validation dossiers CEE avant dépôt`
2. `Back-office Primes Énergie — contrôle inter-documents`

Body spine:
1. Role accuracy (ops / délégataire back-office)
2. Problem: 10–20 pièces, règles programme, audit fragile
3. Offer: pre-submission checks + audit trail on iverif.fr
4. CTA: demo FR
5. Evidence discipline: no invented KPIs

## Organ / skill routing
| Step | Owner | Input | Output |
|---|---|---|---|
| Qualify hot threads | Operator (you) | `HOT-LEAD-QUALIFICATION.md` | verdicts in table |
| Refresh CRM stages | Agent | your verdicts | patched `organ-export.json` |
| LinkedIn FR drafts | Meristem social-growth / growth-content | qualified subset + FR voice | draft notes only |
| Manual email send | Operator | drafts | sent outside Explee |
| Learning loop | Cambium Cortex | replies/objections | append CAMPAIGN-LEARNING |

## Explicit bans
- Explee reply / start / budget PATCH from agents
- Auto-reply left on
- Restarting Public Agencies pool
- Using EN-overlay heroes in FR outbound

## Files
- `../crm/organ-export.json`
- `../crm/hot-lead-qualification.json`
- `HOT-LEAD-QUALIFICATION.md`
- `OPERATOR-PAUSE-CHECKLIST.md`
- Meristem: `brands/iverif/research/EVIDENCE-LEDGER.md`, `channel-plan.md`, FR landing copy outputs
