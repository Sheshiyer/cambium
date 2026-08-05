# Classification-Needed Backlog — Investigation Findings

All 16 folders the registry flags `classification-needed` were investigated
directly: git remotes, commit history, README/package.json contents,
design specs, and any docs found — not guessed from folder names. Every
"suggested read" below is evidence-based but explicitly a suggestion, not
a decision — classification is the founder's call per the registry's own
operating model.

---

## Clean single-project reads (10 folders)

| Folder | Real repo? | Last activity | Named client/brand | Suggested read |
|---|---|---|---|---|
| `10869` | Own repo, `10869-space-v1` | 2026-07-15 | None — founder's own personal portfolio site | **Sapling** (owned) |
| `Insightreality` | Own repo | 2026-06-06 (stale) | "Insight Realtors and Legal Advisors" — real logo/team portraits extracted from client's existing brand | **Client Branch** |
| `Kacima` | Own repo, most recently active of batch 1 | 2026-07-23 | "Kācima" — private nature retreat near Bangalore, real pricing/location docs | **Client Branch** |
| `hostscalev0` | Own repo | 2025-04-01 (16+ months stale) | None — generic vertical-SaaS concept, fictional personas only | **Sapling** (dormant prototype) |
| `earthy-munchy` | No own repo (content only, no code) | ~2 months stale | "Earthy Munchy... A Yamuna Foods Brand" | **Client Branch** (thin — brand/content only, no build yet) |
| `monthlymealprep` | Own repo, `rasa.git` | 2026-07-06 | None — "Rasa" is the product's real name; proprietary license names the founder personally | **Sapling** (strongest evidence in the batch — working code, own brand, own IP claim) |
| `rssfeedscrapper` | Own repo, `agentfount.git` | 2026-06-05 | None — "AgentFount" is the real product name, own domain (`agentfount.space`) | **Sapling** |
| `synchronized-universe-blog` | Own repo, `harshtruths-blog-v1.git` | 2026-06-29 | **"Harshita"** — named explicitly in the design spec as `content_owner`, her real Substack handle given | **Client Branch** (named individual) |
| `wtfmedia` | Own repo | 2026-06-02 | **"WTF" / "Nikhil Kamath"** — license line attributes content IP to them; built under the "spaceblanket.ai" delivery brand | **Client Branch** or pitch/PoC (content ownership is unambiguous either way) |
| `kristudios` | 1 sub-repo, unpushed/stale since 2025-12-08 | Mixed — legal docs recent, code dormant | **"Kristudios (OPC) Private Limited"** — a real, separately incorporated company; directors named in filed MCA documents | **Client Branch** for a distinct legal entity — worth confirming the actual ownership relationship, since the entity is separately incorporated |

---

## Multi-project containers — need splitting before classification (4 folders)

These four folders each hold more than one distinct brand/product and
shouldn't get a single classification as-is.

### `Coproperty` — 3 unrelated brands
- **Co.Property** (Bangkok short-term rental management, real Next.js app, deployed, but its GitHub repo was deleted — current state is a recovery snapshot with 3,671 uncommitted files)
- **Nimbus Gate** (separate product — guest Wi-Fi management for property managers)
- **WanderFruit** (separate brand — docs site only)
- Plus `sheets-sync` (internal ops tooling for Co.Property) and `wiki` (Co.Property-branded knowledge base)
- → Likely 2-3 separate Client Branch entries, not one.

### `Pineapple` — one evolving brand, duplicated/fragmented
- Two different implementations of the same brand: a v0.dev-generated Next.js app (deployed to the founder's personal Vercel account) and an older, separate WebGL static site
- Brand name evolved: "Pineapple Innovation Labs" → "Pineapple Labs"
- Self-description reads as agency/consulting positioning ("full-spectrum digital transformation partner"), not client-specific work — no external client ever named
- → Leans **Sapling or internal venture**, but genuinely low-confidence; needs the founder to say what this actually is. Also needs de-duplication (literal near-identical copies exist in two places).

### `ashwinsheth-group` — account container, HeyZack-style
- Real client: **"Ashwin Sheth Group"** (real-estate developer, `shethdevelopers.com`)
- Two distinct sub-deliverables: a Mumbai panorama viewer and an independently-git-tracked Bangalore panorama viewer (`marina1-k`), both under one shared Cloudflare account
- → Same pattern as the existing HeyZack registry entry (one account, multiple Branches). Suggest 2 Client Branches under one account grouping.

### `klear-karma` — 5+ sub-repos, one real product, one contamination
- Real product, no external client — "Klear Karma" is the brand itself (India-first wellness/practitioner marketplace), very actively developed (mobile app, API, admin panel, marketing site, wiki all in separate repos)
- → Leans **Sapling**, but structurally needs disentangling from one specific thing found inside it:
- **Contamination found:** `klear-karma/snowglobe/` is not part of Klear Karma at all — its git remote points to `snow-gloves-os.git`, the same repo as the existing top-level `thoughtseed/snow-gloves-os` Program. It's Thoughtseed's internal ops-automation product, configured as a *tenant instance* for the Klear Karma client. Recommend excluding it from whatever Klear Karma classification lands, and leaving it attributed to the existing `program:snow-gloves-os` entry instead.

---

## Deferred pending a direct founder conversation

### `safvr`
- Git remote org is `SAFVR-SG`, not the founder's personal `Sheshiyer` account (every other folder in this whole investigation is on `Sheshiyer`)
- Every commit in the repo's history is authored by someone else (`psychon7`, personal email redacted, plus bots) — the founder has zero commits in the actual application code
- No mention of "Thoughtseed" or "spaceblanket" anywhere in the repo (checked directly)
- Alongside the app code sits a large amount of local growth/GTM material — prospect lists, ICP contact sheets, a GTM business plan, a financial model — none of which is part of SAFVR's own product
- Flagged, not investigated further at the founder's direction — the relationship type itself needs a direct conversation before any classification, not just more file-reading.

---

## The pipeline relationship: `ratan-pitch` ↔ `ratandevelopers`

The registry's own framing ("one client account mapping and project split")
is directionally right but slightly imprecise. Real relationship, confirmed
by direct cross-references in both repos:

- **`ratandevelopers`** — a docs-only research/strategy corpus for a named
  client, **"Ratan Developers"** (a North Bangalore real-estate developer,
  specific plot at Sahakara Nagar/Kodigehalli with GPS coordinates given).
  Thin history (3 commits), effectively frozen since 2026-07-06.
- **`ratan-pitch`** — the live interactive pitch prototype built *from*
  that research (85 commits, active through 2026-07-29, the most recently
  touched folder in this whole investigation). Its brand skin evolved
  three times: "Akshara" → "Ratan Builders" → **"Valmark"** (its current,
  public-facing name) — while the underlying client relationship and deal
  terms throughout are still Ratan Developers.

Not really two peer client accounts — more like **one client (Ratan
Developers), two sequential WorkObjects** (research phase, then build
phase), with a wrinkle worth flagging explicitly: the build's current
public name ("Valmark") no longer matches the client's real name, which
is exactly the kind of drift that would mislead a future skim of folder
names alone.

---

## Summary — suggested groupings (founder's call on all of it)

**Sapling (owned product) candidates:** `10869`, `hostscalev0` (dormant), `monthlymealprep` ("Rasa"), `rssfeedscrapper` ("AgentFount"), `klear-karma` (minus the Snow Gloves OS contamination), possibly `Pineapple` (low confidence)

**Client Branch candidates:** `Insightreality`, `Kacima`, `earthy-munchy`, `synchronized-universe-blog` (Harshita), `wtfmedia` (WTF/Nikhil Kamath), `kristudios`, `ashwinsheth-group` (→ split into 2), `Coproperty` (→ split into 2-3), `ratandevelopers` + `ratan-pitch` (one client, two sequential WorkObjects)

**Deferred pending a direct conversation:** `safvr` (relationship type itself is unclear — not just which category it falls into)

**Needs de-duplication/disentangling before classification, not just a label:** `Coproperty`, `Pineapple`, `klear-karma` (the Snow Gloves OS piece specifically)
