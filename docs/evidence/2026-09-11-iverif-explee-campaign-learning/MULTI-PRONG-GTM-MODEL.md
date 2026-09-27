# IVerif GTM multi-prong operating model (locked)

**Locked:** 2026-09-11T13:51:38.115212+00:00  
**Operator confirmation:** Meristem/brand docs are source of truth; Explee is one surgical channel; CF Thoughtseed Labs email wrangler is a second delivery prong; organs compose from brand packet — **not AutoGTM defaults**. Spend only on manual approve.

## Clarity statement (yes — we are clear)

1. **Brand packet owns copy**  
   Meristem `brands/iverif` outputs + wiki + evidence ledger + FR campaign template drive what is said. AutoGTM-generated default campaigns/ICPs are scaffolding to discard or heavily rewrite — never the authority.

2. **Explee is a channel, not the brain**  
   Project `35674` (`iverif.fr`) is the clean Explee container. Old `16763` is historical learning only. Clone campaigns from AutoGTM defaults are stopped and must not be restarted as-is.

3. **Multi-prong delivery**  
   - Prong A: Explee AutoGTM (surgical FR CEE campaign, manual spend arm)  
   - Prong B: Cloudflare / Thoughtseed Labs wrangler email asset (owned delivery)  
   - Prong C: LinkedIn FR / other organs from CRM export + Meristem social-growth  
   Cambium orchestrates; no single-vendor dependency.

4. **Learn from old sectors without reusing their stats**  
   Historical pack (`CAMPAIGN-LEARNING.md`) informs ICP: avoid broad Public Agencies / OOO-heavy pools; thin relative signal from Grant-Making Foundations efficiency only; FR délégataire/CEE ops is the intended wedge.

5. **Spend gate**  
   You manually approve spend later. Autopilot/auto-reply remain OFF unless you flip them.

## Project 35674 actions this pass
- Autopilot OFF / Auto-reply OFF (done earlier)
- POST `/stop` accepted for clone campaigns `159032`–`159037` (API has no archive route; stop is the public equivalent — UI archive still recommended for cleanliness)
- FR CEE campaign template ready — create in UI from Meristem fields, not AutoGTM defaults
- Budget left for your manual control

## Source map (campaign docs must cite these)
| Asset | Path |
|---|---|
| Brand brief | meristem `brands/iverif/BRAND-BRIEF.md` |
| Evidence ledger | `brands/iverif/research/EVIDENCE-LEDGER.md` |
| Channel plan | `brands/iverif/research/channel-plan.md` |
| Landing/email/ad JSON | `brands/iverif/.brandmint/outputs/*` |
| Wiki FR/EN | `brands/iverif/wiki/src/content/docs/{en,fr}/**` |
| FR CEE Explee template | `playbooks/FR-CEE-CAMPAIGN-TEMPLATE.md` |
| Old sector learning | `CAMPAIGN-LEARNING.md` |
| CRM organ export | `crm/organ-export.json` (historical contacts; hot queue dropped) |

## Next build slices
1. UI-archive the six stopped clones (optional hygiene)
2. Create **one** FR CEE campaign in UI using Meristem fields from the template
3. Inventory CF Thoughtseed Labs email wrangler worker and map FR sequence → CF send path
4. Cambium organ recipe: brand packet → Hands drafts → Explee **or** CF email **or** LinkedIn FR

## Skill / organ integration (not a one-off)

Do **not** invent parallel skills for this model. Execute through:

| Concern | Surface |
|---|---|
| Explee project/campaign ops | `explee-master-orchestrator` → `explee-product-autogtm` (and repo mirror `skills/explee-skills`) |
| Multi-channel campaign assets | `marketing-campaign` + `growth-content` (reads Meristem packet / product-marketing-context) |
| Conductor | Cambium `genesis` ← Meristem, `hands` drafts, `will` gated delivery adapters |
| Evidence receipts | this folder — receipts only, not an alternate runtime |

The former `~/.grok/skills/explee-autogtm-project-onboard` is a **pointer** to the cluster above.
## Repeatable SOP
See `docs/runbooks/sapling-multi-prong-gtm-sop.md` + `shared/sapling-gtm-loop-pack.ts` + `.grok/workflows/sapling-multi-prong-gtm.rhai`.
