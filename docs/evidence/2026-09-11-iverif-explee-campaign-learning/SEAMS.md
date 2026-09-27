# IVerif multi-prong GTM — seam map (anti-drift)

**Purpose:** Lock the seams of the iverif GTM pipeline so later runs reuse the same contracts and do not invent parallel paths.  
**SoR:** Cambium · calibration `sapling:iverif` · 2026-09-11  
**Workflow:** `sapling-multi-prong-gtm` (`.grok/workflows/` + `~/.grok/workflows/`)

---

## 1. Authority seams (do not cross)

| Seam | Authority | Drift if… |
|---|---|---|
| Brand packet | Meristem `brands/iverif` (else PMC) | AutoGTM default copy used as brief |
| Explee container | Clean project **`35674`** only | Reuse / restart stats from historical **`16763`** |
| Meristem wedge campaign | **`159185`** FR CEE — Délégataires & ops (clean start; archived prior `159036`) | Restart clone ICP names (Energy EPC, Consultants, …) |
| Owned email | **`wave@thoughtseed.space`** · CF Email Routing (Labs wrangler) · Zoho via Composio on Hermes | Treat CF routing as send adapter, or use `safvr` as sender |
| Operator boards | TG via Hermes | Invent Mini App / portfolio UI as a hard blocker |
| AWS `safvr` | EC2 / SSM admin CLI only | Listed as org agent or send identity |
| Spend / send | First-response gate (TG \| Mini App \| FIFO) + Will approve | Silent Explee start or Zoho send |
| Live arm (2026-09-11) | Explee `159185` @ `$10/day` · auto-reply **ON** (Explee owns replies) · autopilot **OFF** | Double-send from Cambium Will / wave@ while Explee auto-reply is ON |

---

## 2. Pipeline seams (ordered)

```
Meristem packet
  → Hands drafts (do_not_post)
  → compileSaplingGtmLearning          [historical 16763 + live GET 35674]
  → compileSaplingGtmTgHandoff         [clients / agent_ops / alerts cards]
  → Hermes Bot API transport (EC2)     [SSM/safvr host access only]
  → TG boards light up                 [handoff + learning + activity]
  → compileOwnedEmailWillDispatch      [wave@ stub, liveSend=false]
  → first-response gate
  → optional Will arm (Explee | wave@ | LinkedIn)
  → foldback receipt → Cortex / TG
  → GET observe again
```

---

## 3. File seams (canonical paths)

| Concern | Path |
|---|---|
| SOP | `docs/runbooks/sapling-multi-prong-gtm-sop.md` |
| Loop pack | `shared/sapling-gtm-loop-pack.ts` |
| Learning compiler | `shared/sapling-gtm-learning-loop.ts` |
| TG handoff compiler | `shared/sapling-gtm-tg-handoff.ts` |
| Owned-email Will | `shared/owned-email-will-adapter.ts` |
| Workflow | `.grok/workflows/sapling-multi-prong-gtm.rhai` |
| Preflight | `docs/project-management/sapling-multi-prong-gtm-preflight.v1.json` |
| Evidence root | `docs/evidence/2026-09-11-iverif-explee-campaign-learning/` |
| Learning receipt | `…/CONTINUOUS-LEARNING-RECEIPT.json` |
| TG post receipt | `…/tg-handoff-post-receipt.json` |
| Local Will stub | `.state/sapling-iverif/will/owned-email.hermes-dispatch.json` |
| Local TG board | `.state/sapling-iverif/tg-handoff/board.json` |
| Iverif pointer | `iverif/docs/sapling-multi-prong-gtm-sop.POINTER.md` → Cambium SoR |

---

## 4. Telegram seams (Hermes transport)

| Topic | Thread | Quest | Role |
|---|---|---|---|
| `clients` | 9 | `the-handoff` | Workflow handoff + delivery activity |
| `agent_ops` | 7 | `living-org` | Self-learning / Cortex foldback |
| `alerts` | 8 | `the-ship-gate` | Hygiene / spend-risk |
| `dev` | 4 | `the-build` | Hands compose (optional) |

Chat: `-1003942929819`. Transport: Hermes Bot API `sendMessage` + `message_thread_id` on EC2.  
Live light-up example: message_ids 312–315 (2026-09-11).

---

## 5. Skill / organ seams (no one-offs)

| Intent | Skill cluster | Organ | Hermes profile |
|---|---|---|---|
| Explee hygiene / bind | `explee-master` → `explee-product-autogtm` | hands | engineer / CEO narrate |
| Campaign copy | `marketing-campaign` + `growth-content` | hands | designer / synthesist |
| Owned-email send | `growth-content` + Will adapter | will | CEO on TG |
| Learning foldback | `explee-master` observe | cortex | scientist |
| Spend/start arm | gated `explee-master` mutating | will | CEO |

Do **not** create parallel one-off skills for this loop.

---

## 6. Anti-drift checklist (every run)

- [ ] Brand packet = Meristem/PMC — not AutoGTM defaults  
- [ ] Explee project = `35674` — never claim wins from `16763`  
- [ ] Campaign `159185` is the only Meristem wedge — clones banned; imported targeting not editable via API  

- [ ] Autopilot OFF · auto-reply OFF **or** auto-reply ON with `oneWriterOwner=explee-auto-reply` (live iverif)  

- [ ] Learning receipt recompiled after any campaign change  
- [ ] TG handoff board cards compiled (and posted via Hermes when lighting up)  
- [ ] Owned-email stub `liveSend: false` until explicit Will approve  
- [ ] `safvr` never appears as send actor / org agent  
- [ ] Gaps that are “Mini App unfinished” are **not** blockers if TG/FIFO gate exists  
- [ ] Workflow CWD may be iverif (pointer-only) — SoR remains Cambium paths above  

---

## 7. How to re-run without drift

```bash
# From a seat that can launch Grok workflows:
# /workflow sapling-multi-prong-gtm  with args.sapling = iverif
#
# Or tool: workflow name/script_path + args { "sapling": "iverif" }
```

After the run: append learnings to this evidence folder; recompile learning + TG handoff; do not invent new SoR files outside the seams table.
