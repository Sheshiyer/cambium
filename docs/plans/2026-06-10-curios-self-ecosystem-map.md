# curios.self — the ecosystem map (pre-code dossier for the quest-miniapp wing)

> Status: DISCOVERY (decide-before-code). Companion to
> [2026-06-10-thalia-wing-quest-miniapp.md](./2026-06-10-thalia-wing-quest-miniapp.md) and the
> reference set in the founder vault (`03-Resources/Design/Curios-Self-Quest-Miniapp/`).
> Sources: vault `CLAUDE.md`, `00-meta/*` (command-center MOC, system-of-records, sync contract +
> R2 amendment, r2-persistence-runbook, entity-registry), `docs/telegram-commands.md`,
> `~/.hermes/` config + thoughtseed-telegram plugin. No secrets in this file — token NAMES only.

## 1 · What curios.self is

**Founder definition (2026-06-10): curios.self is the existing Telegram bot wired to the whole
ecosystem — the frontend touchpoint for both Thoughtseed co-founders.** It is the human face of
Bridge D: Hermes (the comms agent) speaks through it; the 13 `/ts-*` commands run through it;
standups, blockers, skill results and vault activity arrive through it. It is NOT a new product
to define — the quest miniapp is a new *surface* attached to this existing identity.

- Group chat (sole command channel): `-1003698657291`
- Co-founders (equal approval authority): `1371522080` · `926168615`
- Plugin: `~/.hermes/plugins/thoughtseed-telegram/` (13 namespaced commands, v1.0.0)
- Bot runtime wiring: see §2 (Hermes sweep)
- Note: the vault itself contains **no** "curios" entity yet — the name lives in founder intent +
  the bot config. A one-line entity-registry row should be added when the wing lands (vault-first
  authorship; no TeamForge slug needed unless it becomes a billable project).

## 2 · Bot wiring (Hermes layer) — as it runs today

- **Identity:** the bot's handle is not stored in config — it derives from the token at runtime
  (`getMe`). "curios.self" is the founder-given name for this identity. Token env name:
  `TELEGRAM_BOT_TOKEN` (paperclip `.env`). One-time confirm of the public @handle via `getMe`
  belongs in W0.
- **Transport:** **long-polling, not webhook** — `hermes-tg-poller.sh` curls
  `getUpdates` (30s timeout); no TG library anywhere; messages sent by raw curl to
  `sendMessage`. There is **no public HTTP listener** on the Hermes side.
- **Command path:** poller → `hermes-tg-dispatcher.sh` → per-command handlers: vault reads
  (`/ts-vault`, `/ts-handoffs`), external health (`/ts-status` → MultiCA `/healthz`, TeamForge
  `/api/health`, **Cambium Bridge**), agent routing (`/ts-run` → `_bridge()` → the Cambium
  Bridge TypeScript runner + CEO INBOX write for approval).
- **Already true:** cambium is wired into the bot today — the miniapp's gate actions can reuse
  the same bridge + INBOX pattern instead of inventing a path.
- **Whitelists:** users `1371522080`/`926168615` + group `-1003698657291` (config.yaml:469-476),
  enforced in the plugin layer.
- **Miniapp readiness: NONE.** Zero matches for `web_app`/`menu_button`/`inline_keyboard` across
  the plugin + dispatcher. W0 adds: BotFather web-app domain, `setChatMenuButton`, and (optional)
  inline `web_app` buttons on bot messages.

## 3 · Vision & goals this surface serves

- **Mission (vault):** "Empowering Creativity and Efficiency Through Knowledge… consciousness
  research and technological advancement… enhance human potential."
- **Operating model:** four planes — client delivery · product/IP portfolio (Cambium, Vibrasonix,
  Tirak, Seedforge…) · research-to-product lab · **agent-assisted operating system (Paperclip +
  Telegram-first command interface)**. The miniapp upgrades plane 4's interface from text
  commands to a visual, ongoing surface.
- **Telegram-first interface goals (vault):** single command channel for co-founder approvals ·
  focused, not bloated — every command earns its place · **read-heavy, write-careful** (most
  surfaces show state; mutations require confirmation) · Hermes is the sole external interface.
  → The quest log is read-heavy by construction (derived ledger); the founder gate is the ONE
  write path, and it already requires evidence + confirmation. The wing fits the doctrine.

## 4 · Master inventory — endpoints · services · auth

| Service | Role | Endpoint / id | Auth (names only) | Layer |
|---|---|---|---|---|
| Telegram Bot API | curios.self bot — co-founder touchpoint | group `-1003698657291`; founders `1371522080`/`926168615` | bot token (Hermes config; see §2) | Bridge D |
| Hermes runtime | comms agent: TG in/out, email, webhooks | local runtime `~/.hermes/` | local | Bridge D |
| Paperclip | agent plane: CEO/Scientist/Engineer/Designer/Synthesist/Hermes | local repo + scripts | allowlisted scripts (fail-closed) | Bridge A/B/D |
| TeamForge Worker | control plane: slugs, mapping, webhooks | `https://forge.thoughtseed.space` (HTTP `/v1` + HMAC) | CF Access service token `teamforge-multica-bridge-v2` | Bridge B/C |
| Cloudflare D1 | TeamForge primary DB | `teamforge-primary` | via Worker | control plane |
| Cloudflare R2 (TeamForge) | artifacts | `teamforge-artifacts` | via Worker | control plane |
| Cloudflare Queues | sync queue | `teamforge-sync` | via Worker | control plane |
| Durable Objects | workspace coordination | `WorkspaceLock` | via Worker | control plane |
| Cloudflare Vectorize | cambium production cortex | index `cambium-cortex` (1024-d cosine) + `witness-wisdom-corpus` | CF API token (`CF_API_TOKEN` in `~/.claude/.env` — **expired 2026-06-10**, wrangler OAuth works) | cambium M2 |
| Cloudflare R2 (vault) | **backup only** — encrypted vault mirror | bucket `thoughtseed-vault` @ `https://9d9d…0f10.r2.cloudflarestorage.com` | S3-style keys (`Access_Key_ID`/`Secret_Access_Key` block in `~/.claude/.env`) + rclone-crypt passphrase (out-of-band) | durability |
| MultiCA | AI gateway + agent session backend | `https://multica.thoughtseed.space` · GA `a2d8a7ed58f172583.awsglobalaccelerator.com` · IPs `166.117.29.182`/`76.223.32.238` · workspace `Thoughtseedlabs` (`e0ffc9e2-…`) | workspace auth (MultiCA config `~/.multica/config.json`) | gateway |
| NVIDIA NIM | live model calls (chat + 1024-d embeddings) | `https://integrate.api.nvidia.com/v1/*` | `NVIDIA_API_KEY` (`~/.claude/.env`) | models |
| Moonshot/Kimi | fallback chat models | `https://api.moonshot.ai/v1/*` | `KIMI_API_KEY` / `MOONSHOT_API_KEY` | models |
| GitHub | code execution + history | `Sheshiyer/*` repos (cambium, thoughtseed-vault, skill-clusters…) | gh auth (founder) | ops |
| Huly | human tasks/planning | (workspace) | API token | ops |
| Clockify | time + employee state | (workspace) | API token | ops |
| Slack | day-to-day signal + escalations | (workspace) | bot token | ops |
| Email | CA packets, client delivery | via Hermes outbound | provider creds (Hermes) | Bridge D |

## 5 · The R2 persistence layer — what "aligning" means

The amended sync contract + runbook are unambiguous:

1. `thoughtseed-vault` R2 is a **one-way encrypted mirror** (rclone crypt: filenames AND contents).
2. **Backup, not sync/transport** — git steward remains the only note transport between founders.
3. Never configure anything that reads R2 back into a live system (disaster restore only).
4. Daily 21:15 cron from founder-1's machine; `current/` mirror + `archive/<ts>/` point-in-time.

**Consequences for the miniapp (hard rules):**
- The miniapp must NEVER read from or write to the `thoughtseed-vault` bucket. It is encrypted
  and contractually sealed. "Alignment" = staying out of its way.
- Quest/narrative data needs its **own serving store** (§7) — on the same Cloudflare account is
  fine; in the vault-backup bucket is not.
- Anything the miniapp eventually persists that belongs in the vault (e.g., closeout notes)
  routes through **Bridge A's allowlisted write zones** via Paperclip — never directly.

## 6 · The moving-parts round trip (target shape)

```
founder taps menu button in curios.self (TG)
  → Telegram WebApp opens (Cloudflare Pages, initData signed by bot token)
    → miniapp GET quest ledger + narrative beats   [serving store, §7 — read-heavy]
    → founder reviews quest log / fractal map / story feed
  → founder taps a gate action (approve macro move · error-vs-intent · reroll)
    → POST → cambium Worker: validates initData via Telegram's Ed25519
      third-party signature (public key + bot_id — ZERO secrets on the Worker),
      re-checks founder id allowlist, enqueues {id: uuid, ts, founderId, kind,
      payload} with an auth_date freshness window; miniapp shows "queued"
      → a paperclip consumer polls the queue (closeout-poll.sh etag-dedup
        pattern, launchd plist like com.thoughtseed.hermes-tg-poller.plist;
        telegram-tenant-guard validate before sends)
        → posts the group audit message AS the bot (token never left home)
        → CEO INBOX / operator event  [write-careful]
        → records the outcome via `quine write skills record` (forge telemetry)
          → operator folds the event (wake loop) → world/ledger updates
            → serving store refreshes (envelope: {schema, derivedAt, source})
              → miniapp shows the new ring + freshness chip
```

Identity = Telegram initData Ed25519 third-party validation + the SAME founder-id whitelist the
commands use (`1371522080`/`926168615`). No new auth system, no secrets on the Worker, no inbound
HTTP added to Hermes. Second-pass hardening detail: wing plan §Second pass (F7, F8, F10, F3).

## 7 · Quest-data serving store — the decision

| Option | Verdict |
|---|---|
| vault R2 bucket | ❌ forbidden (encrypted, one-way, contract) |
| local `.operator/` files over a tunnel | ❌ founder-machine dependency, offline = dead surface |
| TeamForge Worker (`forge.thoughtseed.space/v1/...`) | �ېpossible but wrong owner — TeamForge owns ids/mapping, not operator world-state |
| **new `cambium` Worker + KV namespace (same CF account)** | ✅ RECOMMENDED — `GET /api/quests/:tenant` + `GET /api/narrative/:tenant`; repo pushes derived ledger JSON (a `quine` write verb) on change + heartbeat; later upgraded to the Beyond-M3 Durable-Object operator with no API change |
| Vectorize | ❌ wrong shape (vector recall, not documents) |

Plain-data discipline: the store holds **derived, non-secret** ledgers only (quest statuses,
evidence strings, narrative beats). Brand vectors, tokens, and vault content never transit.

## 8 · Gaps & risks (severity)

| # | Gap / risk | Severity | Note |
|---|---|---|---|
| 1 | Miniapp prerequisites on the bot: BotFather web-app domain, menu button, AND zero keyboard wiring exists today (§2) | HIGH | blocks W2 until configured |
| 1b | Hermes has no inbound HTTP — gate writes must buffer in the Worker and be POLLED (house pattern) | HIGH | shapes W4 design (§6) |
| 2 | `CF_API_TOKEN` re-minted ✅ Vectorize REST live | — | restored 2026-06-11 |
| 3 | No `telegram-miniapp` capability in skill-clusters (40 clusters surveyed) | MED | add spoke under `frontend-web` (TMA SDK) |
| 4 | Quest ledger currently local-only (`.operator/`) | MED | W1 serving store (§7) |
| 5 | curios.self absent from entity-registry | LOW | one-line vault row when wing lands |
| 6 | End-user (non-founder) access is out of scope for this wing | — | founders only; end-user surface = separate decision |
| 7 | M3 multi-tenancy open (C1–C4) — miniapp tenant switcher should not ship before isolation suite | MED | sequence after M3 |

## 9 · Decide before code (founder checklist)

1. **Serving store:** approve the new cambium Worker + KV lane (§7) — or name another owner.
2. **Bot surface:** confirm the miniapp attaches to the existing curios.self bot (menu button)
   vs. a separate bot identity for it.
3. **Gate scope v1:** which writes ship first — approve/reject handoffs (`/ts-approve` parity)?
   macro-move gate? error-vs-intent? (Recommendation: handoff approvals first — exact parity
   with an existing, trusted command.)
4. **Tenant scope v1:** cambium only (dogfood) until M3 isolation lands?
5. **Token hygiene:** re-mint `CF_API_TOKEN` (restores Vectorize REST for the forge/cortex lane).

## 10 · Wing-plan amendments (applied)

- **W0 rewritten:** ~~define curios.self + mint slug~~ → curios.self EXISTS (the wired TG bot);
  W0 = configure miniapp prerequisites on it (BotFather web-app domain, menu button), add the
  entity-registry row, decide gate scope v1 (§9.3).
- **W1 clarified:** serving store = cambium Worker + KV on the existing CF account (§7); R2
  vault bucket explicitly out of bounds (§5).
- All other waves and the Telegram rules section stand.

---

### Appendix A · Hermes sweep detail

| Component | Location | Finding |
|---|---|---|
| Bot token | `TELEGRAM_BOT_TOKEN` (paperclip `.env`) | name only; handle via `getMe` in W0 |
| Transport | `scripts/hermes-tg-poller.sh` | long-poll `getUpdates`, 30s, raw curl |
| Dispatcher | `scripts/hermes-tg-dispatcher.sh` | 13 `/ts-*` handlers; sends via raw `sendMessage` |
| Webhook handler | `scripts/hermes-webhook-handler.sh` | consumes TeamForge events → TG + Slack + CEO INBOX (invoked by TeamForge side, not a public Hermes port) |
| Whitelists | `~/.hermes/config.yaml:469-476` | users `1371522080`,`926168615` · group `-1003698657291` |
| Cambium Bridge | dispatcher `_bridge()` | `/ts-run` + `/ts-project` route through a Cambium Bridge TS runner; `/ts-status` health-checks it |
| Hermes model | config.yaml | `kimi-k2.6:cloud` via local Ollama (`127.0.0.1:11434/v1`) |
| Vault write path | `obsidian-vault-write.sh` | fail-closed allowlist from agent CONTEXT.md (e.g. `20-operations/proposals/**`) |
| Vault read path | `vault-sync.sh` | per-agent read allowlists → `MEMORY/vault-index.<agent>.json` |
| Miniapp wiring | everywhere | **zero** `web_app`/`menu_button`/`inline_keyboard` matches |
