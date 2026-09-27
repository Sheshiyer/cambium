# Public Agencies hot-lead qualification worksheet

**Observed:** 2026-09-11T13:28:35.079Z
**Campaign:** 45711 Public Agencies
**Scanned replied contacts:** 169
**Hot intents found:** 6 (provider analytics hot_leads=5)
**Need-reply tab:** 0
**PII policy:** opaque person IDs only in git; open the thread in Explee UI to see identity.

## How to qualify (operator)
For each row, open Explee → project 16763 → Public Agencies → search person ID → read thread, then mark:

| Verdict | Meaning | Next channel |
|---|---|---|
| `qualified_fr_operator` | CEE/Primes / délégataire-relevant; real interest | LinkedIn FR or manual email (not Explee send) |
| `wrong_icp` | Public agency / fraud reviewer not dossier-ops buyer | close; log objection |
| `ooo_noise` | OOO / auto / bounce mislabeled hot | suppress / nurture_later |
| `nurture` | Soft interest, not now | LinkedIn FR later |
| `suppress` | Gone / changed / hostile | suppress |

## Queue

| # | personId | intent | sent | replies | latestReplyAt | canReply | blockedReason | msgCount | Your verdict | Notes |
|---|---|---|---:|---:|---|---|---|---:|---|---|
| 1 | `40b873da-d4dc-4ea3-8a8b-5a74af73f7ea` | hot_lead | 3 | 2 | 2026-07-17T09:44:06Z | False | mailbox_unavailable | 5 |  |  |
| 2 | `0ae6da64-ff7a-47a3-92ec-7e8aa83edb00` | hot_lead | 3 | 2 | 2026-07-17T06:17:06Z | True | None | 5 |  |  |
| 3 | `27f0b52c-005b-4a14-bfb7-334d72a60a65` | hot_lead | 2 | 1 | 2026-07-09T15:33:59Z | True | None | 3 |  |  |
| 4 | `4d2abc82-9bc3-41c4-85a2-c5bbd6588f2b` | hot_lead | 2 | 1 | 2026-07-07T12:40:56Z | False | mailbox_unavailable | 3 |  |  |
| 5 | `c04b057b-82b4-40da-9d8e-e41da41f321a` | hot_lead | 2 | 1 | 2026-06-25T09:12:42Z | True | None | 3 |  |  |
| 6 | `6b737f33-8c14-4751-a008-d75940f70cd6` | hot_lead | 2 | 1 | 2026-06-22T08:52:59Z | True | None | 3 |  |  |

## Message timeline (type/intent/time only)

### `40b873da-d4dc-4ea3-8a8b-5a74af73f7ea`
- None · type=`sent` · intent=`None` · status=`sent`
- None · type=`reply` · intent=`hot_lead` · status=`None`
- None · type=`sent` · intent=`None` · status=`sent`
- None · type=`reply` · intent=`hot_lead` · status=`None`
- None · type=`sent` · intent=`None` · status=`sent`

### `0ae6da64-ff7a-47a3-92ec-7e8aa83edb00`
- None · type=`sent` · intent=`None` · status=`sent`
- None · type=`reply` · intent=`hot_lead` · status=`None`
- None · type=`sent` · intent=`None` · status=`sent`
- None · type=`reply` · intent=`hot_lead` · status=`None`
- None · type=`sent` · intent=`None` · status=`sent`

### `27f0b52c-005b-4a14-bfb7-334d72a60a65`
- None · type=`sent` · intent=`None` · status=`sent`
- None · type=`reply` · intent=`hot_lead` · status=`None`
- None · type=`sent` · intent=`None` · status=`sent`

### `4d2abc82-9bc3-41c4-85a2-c5bbd6588f2b`
- None · type=`sent` · intent=`None` · status=`sent`
- None · type=`reply` · intent=`hot_lead` · status=`None`
- None · type=`sent` · intent=`None` · status=`sent`

### `c04b057b-82b4-40da-9d8e-e41da41f321a`
- None · type=`sent` · intent=`None` · status=`sent`
- None · type=`reply` · intent=`hot_lead` · status=`None`
- None · type=`sent` · intent=`None` · status=`sent`

### `6b737f33-8c14-4751-a008-d75940f70cd6`
- None · type=`sent` · intent=`None` · status=`sent`
- None · type=`reply` · intent=`hot_lead` · status=`None`
- None · type=`sent` · intent=`None` · status=`sent`

## After you mark verdicts
1. Update `crm/organ-export.json` stages for these personIds (or tell me the table and I will patch).
2. Only `qualified_fr_operator` enters the LinkedIn FR / manual email playbook active queue.
3. Do **not** reply from Explee until auto-reply is off and Path B is separately approved.
