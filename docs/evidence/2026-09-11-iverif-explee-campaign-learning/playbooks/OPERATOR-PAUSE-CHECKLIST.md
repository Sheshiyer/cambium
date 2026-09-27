# Operator pause / auto-reply checklist (Explee UI)

**Date:** 2026-09-11  
**Project:** 16763  
**Agent posture:** GET-only — this checklist is for **you in the Explee UI**. No PATCH/POST from agents.

## Current API truth (GET)
- Autopilot: **False**
- Auto-reply: **True** (delay minutes: 1440)
- Public Agencies `45711`: status **listening** / **user_pause**

## Do this in Explee UI
1. Open project **16763**.
2. **Turn OFF Auto-reply** (project autopilot/settings). Leave it off until one-writer ownership is explicit.
3. For every campaign below with daily budget > 0, set **daily budget = 0** and confirm status stays paused/stopped/listening without send:

| Campaign ID | Name | Status reason | Daily budget (API) |
|---|---|---|---:|
| 45709 | Energy Consultants | agent_stop | $10 |
| 45707 | Energy EPC Firms | user_pause | $10 |
| 63001 | Public Agencies South | user_pause | $10 |
| 45711 | Public Agencies | user_pause | $9 |
| 51190 | Research Funding Councils | agent_stop | $4 |
| 56828 | Structural Fund Authorities | agent_stop | $4 |
| 56316 | Grant-Making Foundations | agent_stop | $3 |
| 60150 | Education Fund Administrators | agent_stop | $2 |
| 52261 | Innovation Enterprise Agencies | agent_stop | $1 |

4. Confirm no campaign shows active **outreach/searching** send state.
5. Reply in chat when auto-reply is off and budgets are zeroed.


## Re-verify note (2026-09-11T13:32:39.988Z)
Operator reported checklist done. Fresh GET still showed:
- auto_reply_enabled: **True**
- budgets > 0 on: 45707, 45709, 63001, 45711, 51190, 56828, 56316, 60150, 52261

Please re-open Explee project settings and campaign budgets; agent will not PATCH.
