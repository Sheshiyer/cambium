# Explee project cutover — archive 16763, fresh IVerif project

**Decided:** 2026-09-11T13:36:22.452002+00:00  
**Decision:** Do **not** reuse project `16763` for new FR GTM. Archive it as a learning corpus so new campaign stats are not polluted/deflated.

## Why
Historical project burned **~$194.52** across 14 campaigns at **~0.51%** overall reply rate, dominated by Public Agencies noise (OOO-heavy). Reusing it would mix dead pool dynamics and contaminated denominators into the next FR test.

## Old project (`16763`) — historical only
| Allowed | Disallowed |
|---|---|
| Learning pack, failure modes, redacted CRM history | New sends / new campaigns |
| Evidence receipts for governance | Using its reply rate as success baseline for new FR GTM |
| | Importing old hot leads into the fresh project |

## Hot queue from Public Agencies
**Dropped from active queue** (per operator). Outreach pack under `playbooks/outreach-pack/` is **archived / do not send**.

## New project
Public Explee API **cannot** create projects (`GET /projects` only; no create route).  
**You create it in the Explee UI**, then paste the new `project_id` here.

Suggested name: `iverif-fr-gtm` or `iverif-fr-cee-clean`  
Suggested first campaign ICP: FR délégataire / CEE back-office (Marie Durand), language `fr`, not multi-country public agencies.

## Agent follow-up after you paste the ID
1. Write `NEW-PROJECT-BINDING.md` with the ID
2. Retarget draft package / playbooks to the new project
3. Keep Cambium observer hard-bind update as a **separate governed change** (today still documents 16763/45711 for historical observe)
4. Never merge old 16763 analytics into new project dashboards

## API note on archive
There is no dedicated “archive project” public route either; archive/stop is an **Explee UI** (or campaign stop) operator action. Agent stays GET-only on 16763 thereafter.


## Binding update
New active project discovered via GET `/autogtm/projects`:

| Field | Value |
|---|---|
| project_id | `35674` |
| domain | `iverif.fr` |
| status | bound |
| sends/spend | 0 / $0 |
| autopilot / auto-reply | ON / ON |
| clone campaigns | 6 (same names as old set) |

See `NEW-PROJECT-BINDING.md`.
