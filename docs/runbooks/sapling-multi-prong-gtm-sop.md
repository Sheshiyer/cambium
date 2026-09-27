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

## Delivery surfaces (interim · approved 2026-09-11)

Until the Mini App / portfolio UI is fully built, operate on this contract:

| Surface | Role now | Notes |
|---|---|---|
| **Telegram channels / topics (via Hermes)** | **Primary delivery**, **workflow handoff board**, and **self-learning board** | Activity lights up here between Bind/Route/Verify/Learn workflows. Hermes Bot API posts with `message_thread_id`. |
| **Mini App** | Optional first-response / signed Gate when available | Interchangeable with FIFO for “who answers first” on a spend/high-risk option. |
| **FIFO (first-response queue)** | Optional first-response when Mini App UI is incomplete | Same gate semantics as Mini App for high-risk resolve; whichever surface responds first wins. |

**Rule:** Mini App ↔ TG topic card ↔ FIFO are **replaceable first-response surfaces**. Spend/outreach still requires an explicit gate — not silent Will. Do not block the workflow on unfinished Mini App UI when a TG board or FIFO can carry the same ActionRequest.

### TG handoff board map (Hermes transport)

| Topic | Thread | Board role |
|---|---|---|
| `clients` | 9 · `the-handoff` | Workflow handoff + delivery activity pulse |
| `agent_ops` | 7 · `living-org` | Self-learning / Cortex foldback |
| `alerts` | 8 · `the-ship-gate` | Hygiene / spend-risk escalations |
| `dev` | 4 · `the-build` | Hands compose signals (optional) |

Compiler: `shared/sapling-gtm-tg-handoff.ts` → `.state/sapling-<slug>/tg-handoff/board.json` → Hermes EC2 Bot API (SSM/`safvr` admin only for host access — never send identity).

### Semantic stack (TG boards → quest → organ → skill → delivery)

```
Telegram topic (clients:9 = primary GTM board; also internal workflow board)
    → Hermes semantic classify
        → ActionRequest / Goal Graph intent (binding_required until branch+quest set)
            → First-response gate (TG board | Mini App | FIFO — whichever answers first)
                → Cambium quests Worker + loadout pin
                    → Hub agent (Hands/Superset) with skill-cluster route
                        → Org specialist profile (narrate/plan only unless Hands path)
                            → Delivery prongs (Explee surgical | owned email | LinkedIn/organs)
                                → Foldback receipt → Cortex / TG board update
```

### Telegram topic → task type (from `telegram-topic-map.v1.json`)

| Topic | Thread | Typical sapling GTM use |
|---|---|---|
| `clients` | 9 | **Main delivery + workflow board** — GTM signals, Explee observe, campaign hygiene, ActionRequests |
| `agent_ops` | 7 | Loadout / Hermes routine / living-org (internal board) |
| `dev` | 4 | Meristem/wiki/code Hands work (internal board) |
| `alerts` | 8 | Spend/autopilot drift, provider errors |
| `hermes` | 2 | Orchestrator narration |

### Semantic intents → routes

| Operator / Hermes intent (examples) | Skill cluster | Hub agent posture | Hermes profile | Cambium organ | Delivery |
|---|---|---|---|---|---|
| “Clean Explee project / stop clone ICPs / bind domain” | `explee-master` → `explee-product-autogtm` | Hands execute (Mac) | CEO narrates; Engineer if code bind | `hands` + evidence | Explee GET/PATCH stop only |
| “Write FR campaign from brand packet” | `marketing-campaign` + Meristem packet / `growth-content` | Hands | Designer/Synthesist for docs | `hands` | Drafts only |
| “Multi-channel assets (email/LI/ads)” | `growth-content` | Hands | Synthesist | `hands` | Owned email / LI — not AutoGTM defaults |
| “Send owned email as wave@” | `growth-content` email spokes | **Blocked** until first-response gate + `--approve will`; Hermes Composio Zoho | CEO on TG board | `will` | `wave@` via Zoho (CF routing plane) |
| “Draft package for review” | Cambium Hands tooling (`iverif-draft-package` pattern) | Hands | — | `hands` | `.state/<sapling>/hands/**` |
| “Arm spend / start campaign / reply” | `explee-master` (mutating) | **Blocked** until first-response gate (TG / Mini App / FIFO) + `--approve will` | CEO surfaces gate on TG board | `will` | Explicit spend |
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
| B — Owned email (`wave@`) | `growth-content` email spokes + Will → Hermes Composio Zoho | Drafts until first-response gate + `--approve will`; no silent send |
| C — LinkedIn FR / other organs | `growth-content` / social | Drafts from packet only |

### Prong B — owned email (named infra · approved 2026-09-11)

| Plane | Authority | Role |
|---|---|---|
| Cloudflare Email Routing | Thoughtseed Labs **wrangler** profile · zone `thoughtseed.space` | Domain + inbound routing (Status/DNS Enabled). Verified destinations: `shesh@thoughtseed.space`, `wave@thoughtseed.space`. Catch-all → `shesh@`. |
| Zoho mailbox | Connected to Hermes via **Composio** | Actual send/read store for GTM outbound |
| Hermes on EC2 | Runtime uses Composio Zoho tools | Executes gated send after Will approve; narrates on TG boards |
| AWS profile `safvr` | Human/admin CLI only | EC2 inventory/deploy — **not** an org agent and **not** the send identity |
| GTM-facing address | `wave@thoughtseed.space` | Verified CF destination; interim sapling outbound identity |
| Operator boards | TG topics (`clients:9` default) | Delivery + workflow message boards; foldback receipts |

**Will adapter (typed + Hermes stub · approved):** Hands produces draft fields → `compileOwnedEmailWillDispatch` (`shared/owned-email-will-adapter.ts`) → stub at `.state/sapling-<slug>/will/owned-email.hermes-dispatch.json` (`liveSend: false`) → first-response gate (TG \| Mini App \| FIFO) → Will approve → Hermes may later consume via Composio Zoho as `wave@` → receipt → TG board + Cortex. CF Email Routing is the domain plane; it is **not** a substitute for the Zoho send adapter. Stub never sends; `safvr` is never send identity.

## Repeatable phase checklist (per sapling)

### P0 — Bind identity
- [ ] `sapling:<slug>` WorkObject / packet exists under Cambium parent tenant `cambium`
- [ ] Meristem brand dir or PMC context present
- [ ] TG topic for signals known (default `clients:9`)

### P1 — Observe & learn (no spend) · continuous loop
- [ ] Inventory prior GTM (Explee projects/campaigns GET-only)
- [ ] Archive/stop polluted projects/campaigns; do not reuse stats denominators
- [ ] Compile continuous learning receipt via `shared/sapling-gtm-learning-loop.ts` (historical lessons + live clean-project GET)
- [ ] Fold targeting rules into next Intent on TG board (`clients`) + Cortex — ban money-guzzler/clone ICPs; prefer Meristem FR wedge; fan packet to prongs B/C
- [ ] Write/append learning receipt under `docs/evidence/`

## Continuous learning system (pipeline)

This SOP is not a one-shot cutover. Each sapling runs a **closed loop**:

```
GET Explee (clean project) + historical learning pack
    → compileSaplingGtmLearning (targeting rules + next hypotheses)
        → TG board foldback (clients) / Cortex
            → Hands retarget drafts from Meristem packet
                → Prong A Explee surgical | B wave@ Will stub | C LinkedIn FR
                    → first-response gate → Will approve (optional arm)
                        → receipts → next GET observe
```

**Iverif calibration pins:** historical `16763` lessons never become success stats; clean `35674` is the only Explee container; campaign **`159185`** is the Meristem FR CEE wedge (armed $10/day; needs FR ICP lead upload if `lead_pool_exhausted`); owned-email uses `wave@` stub (`liveSend: false`) while Explee auto-reply is ON (one-writer).

### P2 — Clean channel container
- [ ] UI-create Explee project if needed (API cannot create)
- [ ] Bind `{projectId, domain}` via GET
- [ ] Autopilot OFF; auto-reply OFF unless an explicit operator approval declares the sole reply writer
- [ ] Stop AutoGTM clone ICPs; retarget **one** campaign from Meristem fields or create new in UI

### P3 — Compose drafts (Hands)
- [ ] Genesis from Meristem packet (`MERISTEM_V2` when available)
- [ ] Hands drafts: landing/ads/emails/press with evidence receipts
- [ ] Will payload stays `*.draft.json` / `do_not_post` until approved

### P4 — Hermes / first-response gate (TG primary)
- [ ] ActionRequest with branch + quest coordinates (else `binding_required`)
- [ ] Post ActionRequest + options to the **TG workflow board** (default `clients:9`)
- [ ] High-risk options → first-response gate: **TG operator resolve | Mini App signed | FIFO** (interchangeable; first valid response wins)
- [ ] Do not stall the loop waiting on unfinished Mini App UI when TG/FIFO can gate
- [ ] Low-risk observe/task queue only without spend

### P5 — Arm (operator)
- [ ] Explicit spend approve (via whichever first-response surface answered)
- [ ] Choose prong(s); start only the intended campaign/channel
- [ ] Foldback receipt to **TG board** + Cortex

## Worked example: iverif

| Item | Value |
|---|---|
| Sapling | `sapling:iverif` |
| Old Explee | `16763` archived historical |
| Clean Explee | `35674` `iverif.fr` |
| FR campaign | `159185` Meristem FR CEE — **armed** `$10/day` (`outreach` / `user_resume`); auto-reply ON; autopilot OFF. Prior `159036` archived. Receipt: `SPEND-ARM-10USD.json`. |
| Evidence | `docs/evidence/2026-09-11-iverif-explee-campaign-learning/` |
| Loop pack | `shared/sapling-gtm-loop-pack.ts` |
| Local workflow | `.grok/workflows/sapling-multi-prong-gtm.rhai` |
| Prong B email | `wave@thoughtseed.space` · CF Email Routing (Labs wrangler) · Zoho via Composio on Hermes · `safvr` admin-only |
| Prong B Will adapter | `shared/owned-email-will-adapter.ts` · stub `.state/sapling-iverif/will/owned-email.hermes-dispatch.json` · `liveSend: false` |
| Continuous learning | `shared/sapling-gtm-learning-loop.ts` · receipt `docs/evidence/.../CONTINUOUS-LEARNING-RECEIPT.json` |
| Live GET (dry-run) | `docs/evidence/.../live-get-35674-dryrun.json` · autopilot/auto-reply OFF · 6 campaigns listening |
| TG handoff board | `shared/sapling-gtm-tg-handoff.ts` · live post receipt `tg-handoff-post-receipt.json` (clients 312/314, agent_ops 313, alerts 315) |


## Overall vision (founder intent)

Cambium is the **conductor of saplings**. Every sapling (iverif, fitcheck, dlock, …) runs the **same SOP shape**:

1. **Brand packet is the brain** (Meristem / product-marketing-context) — never AutoGTM defaults.
2. **Multi-prong delivery** — Explee is surgical, not exclusive; owned email (`wave@` / CF routing / Zoho+Composio on Hermes) + LinkedIn/organs share the same packet.
3. **Skill clusters → hub agents → Hermes org profiles → Cambium organs → TG boards / quests** are one mapped stack, not parallel one-offs.
4. **Hermes (EC2, admin via AWS profile `safvr`)** understands TG semantics, narrates ActionRequests onto **TG channels as the main delivery + internal workflow boards**, and never becomes the silent spender.
5. **First-response gates** arm spend and high-risk actions: **Mini App, TG board resolve, and FIFO are interchangeable** wherever the first valid response lands (UI incomplete → prefer TG/FIFO). Hands does Mac/repo work; Will dispatches gated delivery.
6. **Learn from polluted history without reusing its stats** — archive old Explee projects; clean containers get clean denominators.
7. **Quests + Cortex foldback** close the loop on the TG board so the org remembers what worked.

Iverif is the **worked example** of that vision, not a special snowflake path.

### Gaps often missed (explicitly in scope of the vision)
- D1 / admitted / loadout pin before claiming “live sapling execution”
- One-writer ownership (Explee auto-reply vs Cambium Will)
- PII redaction at provider→CRM→TG boundaries
- Evidence ledger claim classes before public copy
- FR/native HITL for localized campaigns
- Prong B **live** Composio Zoho send arm (flip `liveSend` only after explicit approve) — typed compiler + Hermes stub exist; live send still off
- Mini App / portfolio canopy as a **future** operator UI — **until built, TG topics are the boards** (not a blocker)
- FIFO ↔ Mini App ↔ TG first-response parity (same ActionRequest id, same consequence/reversibility)
- Foldback learning into Cortex + next Intent, not just a markdown receipt

## Related contracts

- **Anti-drift seam map (iverif calibration):** `docs/evidence/2026-09-11-iverif-explee-campaign-learning/SEAMS.md`
- `hermes-aws-ts/docs/contracts/thoughtseed-profile-routing.md`
- `hermes-aws-ts/docs/contracts/hermes-cambium-action-request-contract.md`
- `docs/architecture/three-sapling-operational-cohort.md`
- `workers/quests/src/telegram-topic-map.v1.json`
- Skill clusters: `explee-master`, `growth-content`, `marketing-campaign`
