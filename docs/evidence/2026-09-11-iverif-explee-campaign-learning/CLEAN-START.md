# IVerif clean start (from beginning)

**When:** 2026-09-11  
**Trigger:** Operator UI-archived all campaigns on Explee project `35674`; restart Path A from empty.

## Observed after archive

| Field | Value |
|---|---|
| Project | `35674` · `iverif.fr` |
| Campaigns | **0** (confirmed GET) |
| Autopilot | OFF |
| Auto-reply | OFF |

## Path A actions this pass

1. **Import** Meristem-named campaign via `POST /campaigns/import` (operator-authorized) with internal placeholder lead `wave+iverif-gtm-placeholder@thoughtseed.space` (required fields: email, first_name, last_name, company_domain, job_title).  
2. **Immediate stop** — `POST /campaigns/{id}/stop` accepted → `status_reason=user_pause`.  
3. **PATCH messaging** from Meristem packet (`language`, `offer`, `customer_problem`, `target_role`, criteria).  
   - Note: imported campaigns have `targeting_editable=false` — geo/list targeting cannot be changed via API.  
4. **Recompile** learning receipt + owned-email Will stub (`do_not_post`) + TG handoff board.  
5. **Light TG boards** via Hermes EC2 (SSM): clients 316/318, agent_ops 317.

## New wedge campaign

| Field | Value |
|---|---|
| ID | **`159185`** (replaces archived `159036`) |
| Name | FR CEE — Délégataires & ops (Meristem) |
| Language | `fr` |
| Status | `listening` / `user_pause` (**do not start**) |
| Offer / problem / role | Meristem FR CEE copy applied |
| Daily limit | $10 (project default; still paused) |
| Spend | **Approved $10/day** — see `SPEND-ARM-10USD.md` (`outreach`) |

## Seams to remember

- Import without valid lead fields → `campaign_id: null` (no shell created).  
- Import can auto-engage budget — **stop immediately** after create.  
- Do not reuse `16763` stats; do not restart archived clone ICPs.  
- Owned-email + LinkedIn still draft-only until Will gate.  
- Anti-drift map: `SEAMS.md` (update campaign id to `159185`).

## Machine receipts

- `live-get-35674-post-archive.json` — empty project  
- `CLEAN-START-IMPORT-STOP.json` / `fr-cee-campaign-159185-clean-start.json`  
- `live-get-35674-clean-start.json`  
- `CONTINUOUS-LEARNING-RECEIPT.json`  
- `tg-handoff-post-receipt.json` (316–318)
