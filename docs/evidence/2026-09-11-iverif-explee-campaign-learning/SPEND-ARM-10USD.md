# Spend arm — $10/day (operator approved)

**When:** 2026-09-11T14:47Z  
**Machine receipt:** `SPEND-ARM-10USD.json`

## Approved settings

| Setting | Value |
|---|---|
| Project | `35674` · `iverif.fr` |
| Campaign | `159185` FR CEE — Délégataires & ops (Meristem) |
| Daily budget | **$10** (project + campaign limit) |
| Start | `POST /campaigns/159185/start` → accepted |
| Live status | **`outreach`** / `user_resume` |
| Autopilot | **OFF** |
| Auto-reply | **ON** (operator choice) · delay 1440m · CC shesh@gmail |
| Language / copy | `fr` · Meristem offer/role/problem |

## One-writer rule while armed

Explee **auto-reply owns inbound replies**. Do **not** also send via Cambium Will / `wave@` Composio on the same threads unless auto-reply is turned OFF first.

## TG foldback

| Topic | message_id |
|---|---|
| clients | 319, 321 |
| agent_ops | 320 |
| alerts (spend arm) | 322 |

## Browser / IAB note

Local IAB `127.0.0.1:5173` was down; Explee UI session not available in Playwright (auth wall). Arm was completed via AutogTM API with operator approve.

## Pause

`POST /public/api/v1/autogtm/campaigns/159185/stop` if drift / spend risk.
