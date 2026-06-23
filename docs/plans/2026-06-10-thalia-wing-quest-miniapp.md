# Thalia wing — the Quest Log goes visual: curios.self Telegram miniapp

> Status: PLANNED (wing of the Thalia release line — current shipped release is v0.2.0 · Thalia;
> this wing targets the next Thalia point release, number assigned at cut time).
> Companion to [QUESTLOG.md](../../QUESTLOG.md) (M4 — the quest fold + skill forge this wing surfaces).

## Why

M4 gave the operator a real quest log and skill forge — derived, honest, CLI-rendered. The next
wing gives them a **visual, ongoing, trackable surface**: a **Telegram miniapp** under the
**curios.self** product surface, where founders (and later end users) can *see where in the
fractal the venture is* — the quest line, the growth-ring fractal map, a continuous narrative
feed of the operator's life, and an interaction layer beyond chat for the moments that need a
human (gated macro moves, error-vs-intent, escalations).

Visual direction locked by reference set (below): **"Living Blueprint"** — Swiss-grid precision
holding bioluminescent living elements; the fractal map is a **tree-ring cross-section** where
completed arcs are inner rings and the glowing outer growth edge is literally *cambium — you are
here*. Palette from the design library: gunmetal `#00272B` · chartreuse `#E0FF4F` · mint
`#D6FFF6` · violet `#231651`; Euclid/Sprig-class geometric sans.

## Reference images (nano-banana · generated 2026-06-10)

Stored in the founder vault: `03-Resources/Design/Curios-Self-Quest-Miniapp/`

1. `01-quest-log-home.png` — the quest line as a growing stem, arcs I–VII with REAL evidence captions
2. `02-fractal-map.png` — tree-ring "where in the fractal" map, cambium edge = you-are-here
3. `03-narrative-engine.png` — the continuous story feed, noesis beats set apart
4. `04-founder-gate.png` — beyond-chat interaction layer: evidence-gated macro move + skill telemetry

## Gaps found (honest blockers)

- ~~curios.self is undefined~~ **CORRECTED (founder, 2026-06-10): curios.self IS the existing
  Telegram bot wired to the whole ecosystem** — the co-founder frontend touchpoint (Bridge D:
  Hermes poller/dispatcher, group `TELEGRAM_GROUP_ID`, the 13 `/ts-*` commands). Full wiring map +
  endpoint inventory: [2026-06-10-curios-self-ecosystem-map.md](./2026-06-10-curios-self-ecosystem-map.md).
  No new product, no new slug — the miniapp attaches to this identity. The bot currently has
  **zero** web_app/menu/keyboard wiring and Hermes has **no inbound HTTP** (long-polling only) —
  both shape W0/W4 below.
- **No `telegram`/`miniapp` capability exists in skill-clusters** (40 clusters surveyed; resolver
  has zero telegram tokens — "build a Telegram miniapp quest log UI" resolves to
  `creative-frontend`/`frontend-web` at ~0.65–0.80 confidence). A **`telegram-miniapp` spoke**
  (TMA SDK · @telegram-apps) should be added under `frontend-web`.
- Quest fold currently reads local `.operator/` files — the miniapp needs a **served ledger**.

## Waves × cluster assignments (hands organ: ~/.agents/skill-clusters)

| Wave | Work | Cluster(s) | Notes |
|---|---|---|---|
| W0 | Miniapp prerequisites on the EXISTING curios.self bot: confirm @handle (`getMe`), BotFather web-app domain, `setChatMenuButton`; entity-registry row; gate-scope v1 decision | — (governance + BotFather) | no new identity, no new slug |
| W1 | Quest ledger API: cambium Worker + KV serving `questLedger` JSON per tenant (`/api/quests/:tenant`, `/api/narrative/:tenant`); repo pushes derived JSON via a quine write verb; DO upgrade later (Beyond-M3) | `cloudflare` (active) | same CF account as cambium-cortex; vault R2 bucket is OUT OF BOUNDS (backup-only contract) |
| W2 | Miniapp UI: quest line · fractal ring map · panels, per the reference set | `creative-frontend` (resolver pick) + `frontend-web` + `design` (taste · swiss · theme-factory spokes) + NEW `telegram-miniapp` spoke | Telegram WebApp SDK; hosted on Cloudflare Pages |
| W3 | Narrative engine: pure mapper `bin/operator/narrative/` (world.log + deviations → story beats; noesis → set-apart frames), served on the same API; feed UI | cambium repo + `growth-content` (voice) | same fold-purity discipline as quests (tested, no fake beats) |
| W4 | Founder gate: approve/reroll round-trip — miniapp POST (initData-auth) → cambium Worker buffers action + posts group audit message → agent-plane poller consumes queue (closeout-poll pattern) → CEO INBOX / operator event | `agentic-ops` + Hermes plugin | Hermes has NO inbound HTTP — polling is the house style; v1 recommendation: handoff approvals (`/ts-approve` parity) |
| W5 | In-app visual lane: generated imagery for narrative chapters | `media-gen` (activate deferred) → `nano-banana-2` spoke | the same model that made the references |

## Telegram architecture rules (must hold)

- **Hermes stays the sole external channel** (vault CLAUDE.md, Bridge D). The miniapp is a UI
  surface attached to the Hermes bot (menu button / `web_app` keyboard), NOT a new command path.
- `/ts-*` commands and the co-founder whitelist are untouched; the miniapp's founder actions
  (W4) route through Hermes → CEO INBOX like any external signal.
- An end-user-facing curios.self bot (beyond founders) is a SEPARATE identity decided in W0 —
  not the pilot org co-founder group bot.
- Companion docs to update when W1+ lands: `00-meta/mocs/command-center-architecture.md`,
  `docs/telegram-commands.md` (vault), per the architecture contract.

## Alignment notes

- skill-clusters' runtime skill-health (`lib/skill-evolution/health`) is explicitly "adopt
  later / phase 4" — **cambium's M4 forge telemetry (uses · success-rate · decline → amendments)
  is that machinery, live today.** When the miniapp surfaces skill panels, it reads the forge
  registry; skill-clusters can adopt the same shape rather than building a second tracker.
- The quest ledger is already pure + serializable (`questLedger(inputs) → JSON`) — W1 is
  transport, not rework.
- No fake progress survives the wire: the API serves derived ledgers only; the miniapp renders
  evidence strings verbatim.

## Definition of done (wing)

Founder opens the Hermes bot → menu button "curios.self" → quest log renders the LIVE tenant
ledger (same numbers as `quine quests`) → fractal map zooms arcs→quests → narrative feed streams
real beats with noesis frames → a gated macro move can be approved from the gate card and the
operator's world reflects it — and every screen matches the Living Blueprint reference set.

---

## Second pass (2026-06-10) — gaps closed, built tooling bound

Adversarial review (RedTeam, five lenses) + a reuse sweep across cambium · agent-plane ·
team-forge-ts · ~/.hermes/skills. The first pass's ownership lines and R2 rules survived attack;
what follows strengthens it. Severity-ranked findings with dispositions:

| # | Sev | Finding | Disposition |
|---|---|---|---|
| F7 | HIGH | First-pass W4 put the bot token in the Worker (audit post + classic initData HMAC both need it) | **Fixed:** Worker validates initData via Telegram's **Ed25519 third-party signature** (public key + bot_id — zero secrets on the Worker); audit message is posted by the agent-plane consumer, which already holds the token at home. Miniapp shows optimistic "queued" state; audit lands at poll latency. |
| F1 | HIGH | W1 proposed new push/provision scripts — the `cf` hypha already has the authed `api()` helper + a `provision` write-verb pattern (`bin/quine/hyphae/cf.ts`) | **Fixed:** KV namespace provisioning joins `quine write cf provision`; ledger pushes ship as `quine write quests push` reusing the same helper. Zero new scripts. |
| F10 | MED | KV snapshots go stale — serving yesterday's ledger as live violates no-fake-progress | **Fixed:** ledger envelope `{schema: 1, derivedAt, source: "push"\|"heartbeat", tenant}` + a freshness chip in the miniapp with staleness styling. House precedent: `project-feed-feed-sync.sh` already runs etag + 900s freshness. |
| F2 | MED | W3 would re-write log parsing the forge already owns (`signaturesFromWorldLog`, `signaturesFromDeviations` in `bin/operator/skills/forge.ts`) | **Fixed:** one log grammar, two consumers — narrative mapper imports/extracts the forge parsers. |
| F3 | MED | Gate outcomes had no recording path — while the skill forge telemetry shipped today | **Fixed:** the W4 consumer records every gate action via `quine write skills record <skill-id> ok\|fail --scenario …` — the self-improvement loop closes through the gate. |
| F4 | MED | W1 ignored the deployed project-feed worker scaffold | **Fixed:** scaffold the cambium worker FROM `team-forge-ts/cloudflare/worker/` — wrangler.jsonc binding style (+ add `kv_namespaces`), `src/lib/auth.ts` structured bearer middleware (wrap the Ed25519 check in its shape), `src/lib/db.ts` if D1 ever needed, `/healthz` + route layout, CI publish pattern from `.github/workflows/release.yml`. |
| F8 | MED | Action queue lacked idempotency/anti-replay | **Fixed:** action `{id: uuid, ts, founderId, kind, payload}` + initData `auth_date` freshness window + consumer dedup by processed-id (etag-dedup precedent: `closeout-poll.sh`). |
| F12 | MED | No execution lane — the plan names clusters but not WHO executes | **Fixed:** waves dispatch through the org itself — `/ts-run` → Cambium Bridge → conductor/skill-clusters; founder approvals ride the existing handoff flow. The org builds its own UI. |
| F14 | MED | Tenant switcher only soft-sequenced after M3 | **Fixed (self-gating):** the API rejects `tenant ≠ cambium` until the quest log's own arc VII evidence reads isolation-green. The quest log gates its feature. |
| F6 | LOW | Consumer scheduling unspecified | **Fixed:** launchd plist cloned from `com.pilot-org.hermes-tg-poller.plist` (KeepAlive daemon, state-file offset pattern); `telegram-tenant-guard.py validate` runs before any send. |
| F9 | LOW | Founder allowlist enforced client-side only | **Fixed:** Worker re-checks `initData.user.id ∈ {FOUNDER_ID_1, FOUNDER_ID_2}` after signature validation. |
| F13 | LOW | W5 activation unnamed | **Fixed:** `node scripts/tier.mjs --activate media-gen --apply` (skill-clusters). |
| F5 | LOW | `render-docs.mjs` unused for narrative HTML | **Deferred:** noted as the template engine for future narrative chapter pages (pure render fns + esc()); not v1. |
| F15 | LOW | Gate scope v1 | **Stands:** handoff approvals first (`/ts-approve` parity). |

**Event-bus note (W4 implementation time):** the existing skill
`~/.hermes/skills/devops/telegram-channel-ops-connectors` documents the event-bus alignment
(Hermes `:4100` · agent-plane `:3100` · TG layer) and warns *"do NOT build standalone — discover
the existing event bus first."* The consumer should land as a member of that bus (and the
`devops/webhook-subscriptions` skill — `hermes webhook` CLI — is the evaluate-option for
triggering agent runs off queue events instead of pure polling).

**Net effect:** W1/W3/W4 build *almost nothing new* — one Worker (scaffolded from project-feed's),
one KV namespace, one quine write verb, one launchd plist, one shared-parser refactor. Everything
else is binding to tooling that already exists.

**Cost note:** Worker (free tier: 100k req/day) + one KV namespace (free: 100k reads/day, 1k
writes/day) + Pages hosting — founder-only traffic rounds to **$0/month**, same posture as the
vault R2 backup (~4G, free tier).

**Command ↔ view parity (deferred, explicit):** the 13 `/ts-*` commands are NOT being ported
wholesale in this wing. v1 surfaces quests/narrative/skills + ONE write (handoff approvals).
A later wing may map `/ts-status` → health view, `/ts-projects` → portfolio rings,
`/ts-standup` → narrative chapter — decided after v1 usage, not before.
