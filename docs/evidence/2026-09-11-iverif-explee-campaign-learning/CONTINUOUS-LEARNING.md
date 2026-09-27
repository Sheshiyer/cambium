# Continuous learning receipt (iverif)

**Compiled from:** historical `CAMPAIGN-LEARNING.md` (project `16763`) + live GET project `35674`  
**Compiler:** `shared/sapling-gtm-learning-loop.ts`  
**Machine receipt:** `CONTINUOUS-LEARNING-RECEIPT.json`  
**Live GET:** `live-get-35674-dryrun.json` (autopilot OFF, auto-reply OFF)

## Live posture (GET-only dry-run)

| ID | Name | Status | Note |
|---|---|---|---|
| 159036 | FR CEE — Délégataires & ops (Meristem) | listening | Meristem wedge · language `fr` · **do not start** without spend approve |
| 159032 | Energy EPC Firms | listening | Clone ICP · **ban restart** · UI-archive |
| 159033 | Subsidy Aggregators | listening | Clone ICP · ban |
| 159034 | Energy Consultants | listening | Clone ICP · ban |
| 159035 | Utility Providers | listening | Clone ICP · ban |
| 159037 | Energy Lenders | listening | Clone ICP · ban |

## Targeting rules (from receipt)

1. **Ban** AutoGTM clone ICPs on the clean project  
2. **Ban** reusing `16763` stats as success proof  
3. **Prefer** FR / France / délégataire-CEE back-office ICP from Meristem  
4. **Watch** Grant-Making Foundations — efficiency-only, not a new ICP  
5. **Prefer** fan-out same packet to `wave@` + LinkedIn FR  
6. **Ban** spend/start/send without first-response gate + Will approve  
7. **Ban** Public Agencies money-guzzler pattern

## Next hypotheses (multi-prong)

| Prong | Action | Gate |
|---|---|---|
| A Explee | Keep `159036` Meristem FR CEE; archive clones | Spend approve later |
| B owned-email | Will stub → Composio Zoho as `wave@` | `liveSend: false` until approve |
| C LinkedIn FR | Meristem frames from outreach-pack | Drafts only |

## Loop

Observe (GET) → Learn (compile receipt) → **TG handoff board lights up via Hermes** → Foldback (TG `clients` + `agent_ops` + Cortex) → Compose (Hands from packet) → Gate → optional Arm → receipts → Observe again.

## TG handoff board (live)

Compiler: `shared/sapling-gtm-tg-handoff.ts`  
Board stub: `.state/sapling-iverif/tg-handoff/board.json`  
Live post (Hermes EC2 Bot API via SSM/`safvr`): `tg-handoff-post-receipt.json`

| Card | Topic | message_id |
|---|---|---|
| workflow-handoff | clients:9 | 312 |
| self-learning | agent_ops:7 | 313 |
| delivery-activity | clients:9 | 314 |
| hygiene-alert | alerts:8 | 315 |
