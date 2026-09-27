# Sapling multi-prong GTM SOP (repeatable)

**SoR:** Cambium  
**Example calibration:** `sapling:iverif` (2026-09-11 cutover → Explee `35674`, Meristem packet authority)  
**Applies to:** every Cambium sapling (`fitcheck`, `iverif`, `dlock`, future)  
**Not a one-off skill.** Execution uses skill clusters + Cambium organs + Hermes org profiles.

## Disambiguation (read first)

| Name | Meaning |
|---|---|
| **AWS profile `safvr`** | Human/admin CLI for Hermes EC2 inventory/deploy (`aws --profile safvr`). **Never** runtime credentials and **not** an org agent. |
| **Hermes org profiles** | `thoughtseed-ceo`, `thoughtseed-scientist`, `thoughtseed-engineer`, `thoughtseed-designer`, `thoughtseed-synthesist` under `hermes-aws-ts/ops/hermes/profiles`. |
| **Hub agents** | Temperance / Superset / Grok hub seats that load skill-cluster hubs (`explee-master`, `growth-content`, …). |
| **Cambium organs** | `genesis` → `taste` → `hands` → `will` (+ `cortex` cross-cut). |

## Semantic stack (TG → quest → organ → skill → delivery)

```
Telegram topic (clients:9 for sapling GTM signals)
    → Hermes (default founder-facing identity) semantic classify
        → ActionRequest / Goal Graph intent (binding_required until branch+quest set)
            → Mini App signed gate (high-risk / spend / outreach)
                → Cambium quests Worker + loadout pin
                    → Hub agent (Hands/Superset) with skill-cluster route
                        → Org specialist profile (narrate/plan only unless Hands path)
                            → Delivery prongs (Explee surgical | owned email | LinkedIn/organs)
                                → Foldback receipt → Cortex / TG card update
```

### Telegram topic → task type (from `telegram-topic-map.v1.json`)

| Topic | Thread | Typical sapling GTM use |
|---|---|---|
| `clients` | 9 | Sapling GTM signals, Explee observe, campaign hygiene, ActionRequests |
| `agent_ops` | 7 | Loadout / Hermes routine / living-org |
| `dev` | 4 | Meristem/wiki/code Hands work |
| `alerts` | 8 | Spend/autopilot drift, provider errors |
| `hermes` | 2 | Orchestrator narration |

### Semantic intents → routes

| Operator / Hermes intent (examples) | Skill cluster | Hub agent posture | Hermes profile | Cambium organ | Delivery |
|---|---|---|---|---|---|
| “Clean Explee project / stop clone ICPs / bind domain” | `explee-master` → `explee-product-autogtm` | Hands execute (Mac) | CEO narrates; Engineer if code bind | `hands` + evidence | Explee GET/PATCH stop only |
| “Write FR campaign from brand packet” | `marketing-campaign` + Meristem packet / `growth-content` | Hands | Designer/Synthesist for docs | `hands` | Drafts only |
| “Multi-channel assets (email/LI/ads)” | `growth-content` | Hands | Synthesist | `hands` | Owned email / LI — not AutoGTM defaults |
| “Draft package for review” | Cambium Hands tooling (`iverif-draft-package` pattern) | Hands | — | `hands` | `.state/<sapling>/hands/**` |
| “Arm spend / start campaign / reply” | `explee-master` (mutating) | **Blocked** until Mini App + `--approve will` | CEO surfaces gate | `will` | Explicit spend |
| “Learn from dead campaigns” | `explee-master` observe + Cortex | Hands read-only | Scientist | `cortex` | Evidence pack |

## Brand-packet authority (all saplings)

1. Prefer Meristem `brands/<slug>/` when present (brief, ledger, `.brandmint/outputs`, wiki, channel plan).  
2. Else `product-marketing-context`.  
3. **Never** treat Explee AutoGTM default campaign text as the brief.  
4. Same packet fans out to every prong.

## Multi-prong delivery

| Prong | Owner | Gate |
|---|---|---|
| A — Explee surgical | `explee-master` + Will | Autopilot/auto-reply off unless approved; no start without spend approve |
| B — Owned email (CF wrangler / Zoho) | `growth-content` email spokes + Will adapter | Path TBD until CF worker named; interim Zoho/`wave@` documented |
| C — LinkedIn FR / other organs | `growth-content` / social | Drafts from packet only |

## Repeatable phase checklist (per sapling)

### P0 — Bind identity
- [ ] `sapling:<slug>` WorkObject / packet exists under Cambium parent tenant `cambium`
- [ ] Meristem brand dir or PMC context present
- [ ] TG topic for signals known (default `clients:9`)

### P1 — Observe & learn (no spend)
- [ ] Inventory prior GTM (Explee projects/campaigns GET-only)
- [ ] Archive/stop polluted projects/campaigns; do not reuse stats denominators
- [ ] Write/append learning receipt under `docs/evidence/`

### P2 — Clean channel container
- [ ] UI-create Explee project if needed (API cannot create)
- [ ] Bind `{projectId, domain}` via GET
- [ ] Autopilot OFF, auto-reply OFF
- [ ] Stop AutoGTM clone ICPs; retarget **one** campaign from Meristem fields or create new in UI

### P3 — Compose drafts (Hands)
- [ ] Genesis from Meristem packet (`MERISTEM_V2` when available)
- [ ] Hands drafts: landing/ads/emails/press with evidence receipts
- [ ] Will payload stays `*.draft.json` / `do_not_post` until approved

### P4 — Hermes / Mini App
- [ ] ActionRequest with branch + quest coordinates (else `binding_required`)
- [ ] High-risk options → Mini App signed confirmation
- [ ] Low-risk observe/task queue only without spend

### P5 — Arm (operator)
- [ ] Explicit spend approve
- [ ] Choose prong(s); start only the intended campaign/channel
- [ ] Foldback receipt to TG + Cortex

## Worked example: iverif

| Item | Value |
|---|---|
| Sapling | `sapling:iverif` |
| Old Explee | `16763` archived historical |
| Clean Explee | `35674` `iverif.fr` |
| FR campaign | `159036` retargeted Meristem FR CEE (stopped; not started) |
| Evidence | `docs/evidence/2026-09-11-iverif-explee-campaign-learning/` |
| Loop pack | `shared/sapling-gtm-loop-pack.ts` |
| Local workflow | `.grok/workflows/sapling-multi-prong-gtm.rhai` |


## Overall vision (founder intent)

Cambium is the **conductor of saplings**. Every sapling (iverif, fitcheck, dlock, …) runs the **same SOP shape**:

1. **Brand packet is the brain** (Meristem / product-marketing-context) — never AutoGTM defaults.
2. **Multi-prong delivery** — Explee is surgical, not exclusive; owned email + LinkedIn/organs share the same packet.
3. **Skill clusters → hub agents → Hermes org profiles → Cambium organs → TG/Mini App quests** are one mapped stack, not parallel one-offs.
4. **Hermes (EC2, admin via AWS profile `safvr`)** understands TG semantics, narrates ActionRequests, and never becomes the silent spender.
5. **Mini App / founder gates** arm spend and high-risk actions; Hands does Mac/repo work; Will dispatches gated delivery.
6. **Learn from polluted history without reusing its stats** — archive old Explee projects; clean containers get clean denominators.
7. **Quests + Cortex foldback** close the loop so the org remembers what worked.

Iverif is the **worked example** of that vision, not a special snowflake path.

### Gaps often missed (explicitly in scope of the vision)
- D1 / admitted / loadout pin before claiming “live sapling execution”
- One-writer ownership (Explee auto-reply vs Cambium Will)
- PII redaction at provider→CRM→TG boundaries
- Evidence ledger claim classes before public copy
- FR/native HITL for localized campaigns
- CF/Zoho owned-email worker bind (prong B) as a first-class Will adapter
- Portfolio canopy / organ-update cards as the operator UI, not ad-hoc chat only
- Foldback learning into Cortex + next Intent, not just a markdown receipt

## Related contracts

- `hermes-aws-ts/docs/contracts/thoughtseed-profile-routing.md`
- `hermes-aws-ts/docs/contracts/hermes-cambium-action-request-contract.md`
- `docs/architecture/three-sapling-operational-cohort.md`
- `workers/quests/src/telegram-topic-map.v1.json`
- Skill clusters: `explee-master`, `growth-content`, `marketing-campaign`
