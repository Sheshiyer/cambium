# Owned-email prong map (organ integration)

**Updated:** 2026-09-11T13:57:15.609711+00:00  
**Not a one-off skill** — route via `growth-content` (`email-sequence` / `cold-email`) + Cambium **Will** adapters; brand packet = Meristem `brands/iverif`.

## Intent
Same Meristem FR email sequences / Hands drafts deliver through **owned email**, not only Explee.

## Current inventory (this pass)
| Candidate | Status |
|---|---|
| Cloudflare `[[send_email]]` on Thoughtseed Labs | **Not found** in labs wrangler.toml this scan |
| Tirak `send_email` bindings | Exists (product-specific — do not hijack for iverif) |
| Zoho / Composio `wave@thoughtseed.space` | Documented in Thoughtseed Labs growth ops as publish/mail adapter |
| Cambium Will `brand_to_gtm` / explee-proxy | Explee prong only (spend-gated) |

## Organ routing (target state)
1. **Genesis** ← Meristem packet (already)
2. **Hands** ← `bin/lib/iverif-draft-package.mjs` drafts (`hands/emails.fr.mjml`, etc.)
3. **Will** chooses delivery adapter:
   - `explee-read` / future gated write — surgical AutogTM campaign `159036`
   - **owned-email** — CF send_email worker **or** Zoho/Composio until CF asset path is confirmed
   - LinkedIn FR — growth-content / social spokes
4. Spend on any prong requires explicit `--approve` / operator gate

## Operator ask
Point Cambium at the CF email wrangler path (repo + worker name). Until then, treat Zoho `wave@` as interim owned-email adapter for manual/approved sends of Meristem FR sequences.

## Explee FR CEE campaign (applied)
- Project `35674` campaign `159036` retargeted from Meristem packet
- Name: `FR CEE — Délégataires & ops (Meristem)`
- language=`fr`, geo=`France`
- **Not started**; spend later on your approve
- Other clones remain stopped — UI-archive when convenient
