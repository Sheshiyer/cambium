# Workflow / clean-start learnings (iverif)

**Workflow displays:** `sapling-multi-prong-gtm-2` → continuation `sapling-multi-prong-gtm-3`  
**Seam map:** `SEAMS.md` · **Clean start:** `CLEAN-START.md` · **Continuation:** `FULL-FLOW-CONTINUATION.md`

## Workflow result (Bind → Route → Verify)

### Bind
- Brand: `meristem/brands/iverif`
- TG board: Clients (primary delivery / workflow handoff)
- No D1 admission claimed

### Route (8 — seam-aligned)
| Intent | Cluster | Organ | Prong |
|---|---|---|---|
| Explee hygiene / bind | explee-master | hands | A |
| FR copy from Meristem | marketing-campaign/growth-content | hands | A |
| Multi-prong drafts do_not_post | marketing-campaign/growth-content | hands | telegram-board |
| Hermes CEO narration on TG | conductor | will | telegram-board |
| First-response gate TG\|MiniApp\|FIFO | conductor | will | telegram-board |
| Send wave@ (Zoho/Composio) | growth-content | will | B |
| Arm Explee spend after approve | explee-master | will | A |
| Continuous learning foldback | explee-master | cortex | telegram-board |

### Verify flags (all true)
| Flag | Value |
|---|---|
| `aws_safvr_is_admin_only` | true |
| `auto_gtm_defaults_are_not_authority` | true |
| `tg_is_handoff_and_learning_board` | true |
| `owned_email_wave_named` | true |
| `learning_loop_compiler_present` | true |

## Clean-start overlay (after UI archive)

Operator archived campaigns → GET empty → import+stop → wedge **`159185`**.

| Item | Status now |
|---|---|
| Project `35674` | bound · autopilot/auto-reply OFF |
| Wedge campaign | **`159185`** Meristem FR CEE · `user_pause` · do not start |
| Clone ICPs on 35674 | **cleared** (workflow gap that said “clones still present” is **stale**) |
| TG lit | clients 316/318 · agent_ops 317 |
| Owned-email | stub `do_not_post` / `liveSend=false` |

## `sapling-multi-prong-gtm-3` verify (post-arm continuation)

All seam flags true again. Gaps called out by verify (post-fix):

| Gap | Disposition |
|---|---|
| `159185` lead_pool_exhausted | **Real blocker** — upload FR ICP leads in Explee UI |
| Auto-reply ON vs wave@ path | **Declared** `oneWriterOwner=explee-auto-reply`; wave@ stays stub |
| Loop-pack context stale vs arm | **Fixed** — live calibration now spendApproved+campaignStarted |
| SEAMS expected auto-reply OFF | **Fixed** — checklist allows ON with one-writer |
| actionRequestBound / D1 / FIFO parity | Still open |
| Pointer-only iverif CWD | By design |

## Gaps — keep vs stale

**Still real**
- **Lead pool empty** on armed campaign — UI lead upload required  
- Iverif CWD POINTER-only (Cambium remains SoR) — by design  
- `actionRequestBound=false` — no live ActionRequest yet  
- D1 admitted + loadout pin before claiming live execution  
- Prong B live Zoho send unarmed (correct while Explee owns replies)  
- PII redaction / evidence claim classes / FR HITL / FIFO↔MiniApp↔TG parity E2E  

**Stale after clean start / continuation**
- “Clone AutoGTM ICP names still present on 35674”  
- “spend not approved / campaign not started” in loop-pack calibration  
- “auto-reply must be OFF” as hard hygiene (now one-writer aware)

## API lessons (anti-drift)

- Import needs: `email`, `first_name`, `last_name`, `company_domain`, `job_title`  
- Import → immediate `POST /stop`  
- Messaging PATCH: `customer_problem` / `target_role` / `positive_criteria`  
- Import campaigns: `targeting_editable=false`

## Next Intent (gated)

1. Optional UI refine lead list for `159185`  
2. Explicit spend approve before Start  
3. Bind ActionRequest on TG clients when ready to arm  
