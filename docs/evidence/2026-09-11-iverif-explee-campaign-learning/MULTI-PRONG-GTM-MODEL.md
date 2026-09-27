# IVerif GTM multi-prong operating model (locked)

**Locked:** 2026-09-11T13:51:38.115212+00:00  
**Operator confirmation:** Meristem/brand docs are source of truth; Explee is one surgical channel; CF Thoughtseed Labs email wrangler is a second delivery prong; organs compose from brand packet — **not AutoGTM defaults**. Spend only on manual approve.

## Clarity statement (yes — we are clear)

1. **Brand packet owns copy**  
   Meristem `brands/iverif` outputs + wiki + evidence ledger + FR campaign template drive what is said. AutoGTM-generated default campaigns/ICPs are scaffolding to discard or heavily rewrite — never the authority.

2. **Explee is a channel, not the brain**  
   Project `35674` (`iverif.fr`) is the clean Explee container. Old `16763` is historical learning only. Clone campaigns from AutoGTM defaults are stopped and must not be restarted as-is.

3. **Multi-prong delivery**  
   - Prong A: Explee AutoGTM (surgical FR CEE campaign `159036`, manual spend arm)  
   - Prong B: `wave@thoughtseed.space` — CF Email Routing (Labs wrangler) + Zoho via Composio on Hermes; Will adapter stub `liveSend: false`  
   - Prong C: LinkedIn FR / other organs from CRM export + Meristem social-growth  
   Cambium orchestrates; TG topics are operator boards; no single-vendor dependency.

4. **Continuous learning (not one-shot)**  
   Historical pack (`CAMPAIGN-LEARNING.md`) + live GET on `35674` compile into `CONTINUOUS-LEARNING-RECEIPT.json` via `shared/sapling-gtm-learning-loop.ts`: ban money-guzzler/clone ICPs; prefer Meristem FR wedge; fan the same packet to A/B/C; never reuse `16763` denominators. Foldback → TG `clients` + Cortex → next Intent.

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
1. UI-archive clone ICPs still named on `35674` (Energy EPC / Consultants / …) — learning ban active
2. Keep **one** Meristem FR CEE campaign (`159036`) — do not start without spend approve
3. Re-run GET observe → `compileSaplingGtmLearning` after any campaign change (continuous loop)
4. Owned-email: Hermes may later consume `.state/sapling-iverif/will/owned-email.hermes-dispatch.json` only after live arm
5. Cambium organ recipe: brand packet → Hands drafts → Explee **or** wave@ **or** LinkedIn FR

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

**Anti-drift:** `SEAMS.md` in this folder — authority / pipeline / file / TG / skill seams + checklist.
