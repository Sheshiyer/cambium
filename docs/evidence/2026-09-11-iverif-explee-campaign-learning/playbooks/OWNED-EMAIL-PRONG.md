# Owned-email prong map (organ integration)

**Updated:** 2026-09-11  
**Not a one-off skill** — route via `growth-content` (`email-sequence` / `cold-email`) + Cambium **Will** adapters; brand packet = Meristem `brands/iverif`.

## Intent
Same Meristem FR email sequences / Hands drafts deliver through **owned email**, not only Explee.

## Named infra (approved)

| Plane | Authority | Role |
|---|---|---|
| Cloudflare Email Routing | Thoughtseed Labs wrangler · zone `thoughtseed.space` | Domain + inbound routing; verified `shesh@`, `wave@`; catch-all → `shesh@` |
| Zoho mailbox | Composio on Hermes EC2 | Actual send/read adapter |
| GTM-facing address | `wave@thoughtseed.space` | Outbound identity |
| AWS profile `safvr` | Human admin CLI | EC2 inventory/deploy — **not** send identity |
| Operator boards | TG topics (`clients:9`) | Delivery + workflow boards |

## Will adapter (typed + Hermes stub)

| Artifact | Path |
|---|---|
| Compiler | `shared/owned-email-will-adapter.ts` |
| Schema | `cambium.owned-email-will-adapter.v1` |
| Hermes consume stub (local) | `.state/sapling-iverif/will/owned-email.hermes-dispatch.json` |
| Committed fixture | `playbooks/owned-email.hermes-dispatch.stub.json` |

Flow: Hands draft → `compileOwnedEmailWillDispatch` → stub (`liveSend: false`, `do_not_post` until gate) → first-response gate (TG \| Mini App \| FIFO) → Will approve → Hermes may later consume via Composio Zoho as `wave@` → TG/Cortex receipt.

**No live send in this pass.** Stub is file-shaped for Hermes; flipping `liveSend` requires a later explicit arm.

## Organ routing
1. **Genesis** ← Meristem packet
2. **Hands** ← draft package / outreach frames
3. **Will** chooses delivery adapter:
   - `explee-read` / gated write — surgical AutogTM (e.g. campaign `159036`)
   - **owned-email** — Zoho/Composio via `owned-email-will-adapter` (`wave@`)
   - LinkedIn FR — growth-content / social spokes
4. Spend/send on any prong requires explicit first-response gate + `--approve will`

## Explee FR CEE campaign (applied)
- Project `35674` campaign `159036` retargeted from Meristem packet
- Name: `FR CEE — Délégataires & ops (Meristem)`
- language=`fr`, geo=`France`
- **Not started**; spend later on your approve
- Other clones remain stopped — UI-archive when convenient
