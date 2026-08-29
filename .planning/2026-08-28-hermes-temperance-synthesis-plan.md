# Hermes ↔ Temperance Engine synthesis: scoping the EC2 renewal

**Status: research + plan only.** No relocation, registry, session, provider, Telegram, or
EC2 mutation was performed to produce this document, per `CLAUDE.md` / `AGENTS.md` — this
packet is reviewed-held and this pass adds one file. Everything below is either read directly
from checked-in repo content, read from `~/.temperance_engine` docs, pulled live and read-only
via `aws --profile safvr`, or from read-only DNS/HTTP probes of public hostnames (no
authentication attempted or credentials handled).

**Trigger:** founder intends to "surgically replace" the Hermes EC2 host and re-provision its
Telegram identity from scratch (the prior TG account is gone), while preserving system
principles, quest continuity, and the infinite-game flow — and wants to know exactly what
Hermes vs. Temperance Engine each do before touching anything.

---

## 1. Terminology corrections (read this before the rest)

Two assumptions in the original framing don't match what's on disk. Both matter for scoping.

### 1a. `thoughtseed-hermes` is not Hermes

`/Volumes/madara/2026/Projects/thoughtseed/thoughtseed-hermes/` looks like the Hermes repo by
name but isn't. It has no `.git` directory at all, and its own `README.md` / `PROJECT.md` /
`AGENTS.md` self-identify as **"Paperclip"** (`program:paperclip-retired`, status
`draft-held`) — a separate, retired personal-agent-orchestration prototype where "Hermes" is
just one of six agent personas (external comms). Hermes's real repo explicitly disowns it:

> "Thoughtseed Paperclip ... Retired/provenance source; active Hermes runtime must not depend
> on this checkout." — `hermes-aws-ts/docs/connected-repos.md:10`

Cambium's own census already flags this folder as `Needs review / Unknown origin`
(`.planning/2026-08-22-census-reconciliation.md:268`) — the mapping was never resolved. **The
real Hermes is `hermes-aws-ts`.**

### 1b. "noesis-cambium" is not a live alternative to Hermes — it's an unbuilt roadmap phase

`~/.temperance_engine/.planning/ROADMAP.md` names "Noesis-Cambium" once, as **Phase 23, "v6.1
· Noesis-Cambium Governed-Loop Operator Surface"** — 0/4 sub-phases complete, status
**"Discussed 2026-08-28"** (today). It's a planned future capability (evidence organs,
webhooks, operator-authorship hint files), not a shipped system with existing capabilities to
compare against Hermes. There is currently nothing running that goes by that name.

Separately, `~/.temperance_engine/docs/ECOSYSTEM.md`'s "four verbs" table uses bare
**"Cambium"** for yet a third thing — the Goal Graph / Workbench / Mini App system (this
repo), distinct from "Temperance / Noesis" in the same table. So "Cambium" legitimately names
two different things in this ecosystem (this repo, and the unbuilt Phase 23 surface inside
Temperance Engine) — worth being deliberate about which one is meant going forward.

**Why the confusion is understandable:** the portfolio registry groups Hermes, Temperance
Engine, and the Temperance landing page under one program identity,
`program:temperance-hermes` (`.project/HANDOFF.md:676-679`), because they were founded
together and share provenance. But registry grouping ≠ functional overlap — see §3.

---

## 2. What Hermes actually is

Canonical source confirmed: `/Volumes/madara/2026/Projects/thoughtseed/hermes-aws-ts/`
(remote `github.com/Sheshiyer/hermes-aws-ts`, branch `main`, HEAD `e09ebfe`, 2026-08-24 — 4
days old, actively maintained).

Hermes is a small EC2 host running several `systemd` units:

| Unit | Cadence | Job |
|---|---|---|
| `hermes-runner.timer` → `.service` | 30s | canary loop: poll → claim → execute → outcome → ACK |
| `hermes-agent.service` | durable | Telegram bot / interactive gateway |
| `hermes-proactive-loop.timer` | 6h | pulls Cambium pending deliveries, posts to TG topics |
| `hermes-gateway-watchdog.timer` | 2min | health |
| `hermes-repo-sync.timer` | 10min | code sync |
| `hermes-token-rotate.timer` | daily | credential rotation |
| `hermes-vault-sync.timer` / `-writeback.timer` | hourly / 15min | R2 vault sync |
| cron-prompts | scheduled | `morning-brief` / `midday-pulse` / `evening-wrap` IST briefs → Cambium quest topic 798 |

The canary loop (`src/runner.ts`) is idempotent and replay-safe:
`claimed → executed → outcome_posted → acked`, ACK only after a durable terminal outcome.
Goal Graph (D1, owned by Cambium) issues admitted/pinned directives; **Hermes can execute but
can never write the graph back** — only the Worker's signed Gate + graph-head compare-and-swap
can (`ARCHITECTURE.md:89`, `INTEGRATION.md:185-187`). Execution results fold back through
`workers/quests/src/hermes-execution-foldback.ts` as a **proposal**
(`approvalRequired:true, goalGraphAuthority:false`) — Hermes literally cannot self-admit new
work, only suggest it.

**Config surface** (names only — no values were read or reproduced): ~40 `HERMES_*` /
`TELEGRAM_*` env vars (base URL, tenant/member IDs, bearer tokens, Cloudflare Access
service-token pair loaded via `systemd LoadCredential`, AWS profile/region, plus
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_CHATS`, `TELEGRAM_CRON_THREAD_ID`,
`TELEGRAM_GROUP_ALLOWED_CHATS`, `TELEGRAM_HOME_CHANNEL(+NAME+THREAD_ID)`). The two live env
files (`/etc/hermes/hermes-runner.env`, `/etc/hermes/.env`) exist **only on the EC2 host** —
not in the local repo, not readable from here.

**Deployment is scripted, not IaC.** A CDK synth stub exists but is documentation-only, never
`cdk deploy`ed. Real path: `ops/ec2/bootstrap-ubuntu.sh` for first bring-up, then
`scripts/deploy-ec2-release.sh` (rsync → atomic swap → systemd restart) for releases.

**Default posture is fail-closed**: the checked-in template ships
`HERMES_RUNNER_EXECUTE_DIRECTIVES=false`. Whether the *live* host currently has execution
enabled is not knowable from this repo — see open question in §11.

A real end-to-end canary (D1 lease → EC2 Hermes runner → foldback → R2 → terminal ACK) is
proven, dated **2026-07-17**, twice (`cambium/.planning/phases/01-.../01-01-SUMMARY.md`,
`02-.../02-01-SUMMARY.md`).

---

## 3. What Temperance Engine (`~/.temperance_engine`) actually does — and doesn't

Confirmed live via `ls ~/Library/LaunchAgents/` (namespace `com.temperance.*`, ~19 jobs) and
the routing corpus docs:

**Does:** model routing across 48 providers through OmniRoute (`:20128`) via named "combos"
(`noesis-observe/plan/build/execute/verify/full`); 3-vector failover doctrine (task-fit,
reliability, quota-spread); always-on local services — OmniRoute gateway, an OpenAI-compat
proxy (`:20129`), a manifest bridge (`:8766`), Pulse voice-notify compat (`:31337`), a portless
proxy (`:1355`); periodic reconcilers (session-rebalance, promo-flip crons, plan-issue-sync);
health/self-heal probes (Auspex, Circulator, self-heal, island-watch); documents/points at the
skill-cluster system (`~/.agents/skill-clusters`) though the dispatch code itself lives in a
separate repo; serves as an MCP server (108 tools) that Claude Code itself is talking to right
now.

**Explicitly does not:** own any Telegram transport, run any cron-based proactive
user-facing messaging, or serve any end-user Mini App. Direct quote:

> "That is the Phloem / Hermes plane — company-agent delivery (Krebs, Telegram leases) running
> against the Hermes plant, not the Mac plant." — `PROVIDER-FLEET-RUNBOOK.md:240`

A local dev-tooling doctor check literally named `superset-hermes-not-hands` **deliberately
deleted** a Hermes project reference from local databases, asserting Hermes is not something
to operate as local hands-on work. This is a designed boundary, not an accident.

## 4. Side by side

| | **Hermes** (`hermes-aws-ts`, EC2) | **Temperance Engine** (`~/.temperance_engine`, this Mac) |
|---|---|---|
| Runs where | Remote — `t3.medium`, us-east-1 | Local — launchd on this Mac |
| Owns Telegram | Yes — sole owner of TG transport + topic topology | No — zero Telegram code |
| Proactive/cron user messaging | Yes — 6h delivery loop, IST cron-prompt briefs | No — its crons only reconcile its own state |
| End-user surface | Telegram Mini App, TG channels | None — MCP server + CLI/skill routing only |
| Executes Goal-Graph directives | Yes — the only executor | No — not wired to D1 at all |
| Model/provider routing | No | Yes — its entire job |
| Voice notify (Pulse) | No | Yes, local-only |

**Conclusion: these are not substitutes.** You cannot "replace Hermes with Temperance Engine"
because Temperance Engine has deliberately never grown Telegram/cron/proactive-messaging
capability — that gap is Hermes's entire reason to exist. What "surgically replacing Hermes"
actually means, given this, is standing up a **new instance of Hermes's own role** (same
contract, same code, new host and/or new Telegram identity) — not migrating that role onto
Temperance Engine. Temperance Engine stays exactly what it already is: the local orchestration
substrate you use to build, test, and dispatch the work that produces the new Hermes release.

---

## 5. Infrastructure bindings — plants, doors, and Phloem

OmniRoute — the router software behind both §2 and §3 — doesn't run in just one place. Each
binding has a settled name; source of truth is `thoughtseed-labs/00-meta/inference-bindings.md`
and `entity-registry.md`, formalized 2026-08-21 (vault decision log,
`00-meta/decision-log.md:45`) to replace two retired names, "company OmniRoute" and "tapestry
edge."

The naming extends the tree metaphor "Cambium" already carries — stated directly in the vault
glossary: *"Cambium is the living layer that produces tissues: xylem inward, phloem outward."*
Phloem is outward conduction — off-box workers reaching in. ("Xylem" is reserved for the
inward/loopback bindings but not yet adopted as a name.)

| Name | Path | Reaches | Used by |
|---|---|---|---|
| Mac plant | `127.0.0.1:20128` + `:20129` | this Mac's OmniRoute | Superset / Hands coding (§3) |
| Hermes plant | `127.0.0.1:20128` on the EC2 box | same software, on-box | Hermes agent sessions running there directly |
| **Phloem** (name: "clio-relay") | Custom domain `strength-08.thoughtseed.space` (alias `omniroute.thoughtseed.space`) → Cloudflare Tunnel `company-omniroute` → Hermes plant `:20128` | Hermes plant, from outside | off-box company workers/agents, Plexus desktop's in-app agent ("Clio") |

Corrected 2026-08-29 by founder direction: **"clio-relay" is the relay's name; `strength-08` is
the custom domain it runs on — one relay, not two.** An earlier read of this table (and of
`thoughtseed-labs/00-meta/inference-bindings.md`) treated "Clio door" as a second, distinct
binding on `:20130` under a separate Cloudflare Access org (`red-queen-4dfa`). That org's local
session has since been removed (§6) and should not be used going forward — see the full
correction under "Clio door" below.

This explains the Elastic IP tag found in §6 (`Purpose: stable-ip-for-deploy-and-omniroute`) —
Hermes's own host runs its own OmniRoute binding (the Hermes plant), separate from the
systemd/Telegram units documented in §2.

### Phloem

Not a separate service — the same OmniRoute software already running on the Hermes box,
exposed publicly through a Cloudflare Tunnel + Cloudflare Access. Live-verified read-only,
2026-08-28: `strength-08.thoughtseed.space` resolves to Cloudflare anycast IPs
(`104.21.39.57` / `172.67.169.177`); a plain GET 302s to `thoughtseedlabs.cloudflareaccess.com`
— Cloudflare Access is actively gating it right now, exactly as documented. Not attempted past
that login. Its auth (Cloudflare Access + Bearer service token, team `thoughtseedlabs`) is
entirely independent of the Telegram bot token — renewing Telegram does not touch it.

### Clio door — corrected 2026-08-29 by founder direction

**Founder correction, overriding the doctrine-vs-doctrine contradiction below:** "clio-relay"
is the *name* of the relay; `strength-08.thoughtseed.space` is the *custom domain it runs on*.
These are **one relay, not two** — the "Clio door / Phloem are distinct, different ports,
different Access teams" doctrine in `thoughtseed-labs/00-meta/inference-bindings.md` does not
match current intent. Per this session's own injected guardrail — *"Runtime state outranks
issue prose; issue prose must be regenerated or reconciled when runtime state changes"* — this
correction is treated as authoritative going forward in this document; the vault doctrine
itself may need reconciling separately (that's a `thoughtseed-labs` edit, out of scope here).

**What this resolves:** open question 5 (the `clio-relay` vs `strength-08` contradiction) is
answered directly by the founder, not by the `CF-Access-Client-Id`/`Secret` probe — no live
probe needed. It also explains why the *older* `~/.temperance_engine` docs (`RUNTIME.md`,
`PROVIDER-FLEET-RUNBOOK.md` — *"company edge (clio-relay) re-enabled as the `company-omniroute`
provider mapping... formerly strength-08"*) read as correct: they were describing the same
single relay under its two names, not describing a stale fallback.

**What's now being retired, per this session's actions:** the separate `red-queen-4dfa`
Cloudflare Access org — the org that older evidence tied to a genuinely distinct `:20130` Clio
door setup — has had its local session token removed (§6). Going forward, `thoughtseedlabs` is
the only Cloudflare Access org this plan should reference for Hermes/Phloem/Clio-relay work.

**Still worth checking, not yet verified (needs the EC2 box, not just docs):** earlier evidence
described dedicated systemd units on the Hermes box — `clio-omniroute-relay.service` +
`cloudflared-clio-relay.service`, under a separate `clio-relay` OS user, bound to `:20130` —
plus `hermes-aws-ts` deploy scripts `infra:clio-relay:{status,deploy,rollback}`. If a genuinely
separate `:20130` process is still running there, it may be legacy scaffolding from before the
consolidation the founder just described, and worth tearing down in Phase 2 rather than
re-provisioning. Not confirmed either way from this read-only pass.

Also resolved in passing: **TeamForge is not a separate service** — `thoughtseed-labs/ISA.md`
states directly that TeamForge is Cloudflare API/asset naming only; the real operator work is
Clio inside Plexus, and `team-forge-ts/` is "not a separate operator repo" (matches §9 census:
present as a folder, not a git checkout).

### Effect on Phase 2

A surgical (new-instance) EC2 replacement touches **three independent things**, not four
(revised 2026-08-29 — Phloem and the Clio door are one relay, see correction above):

1. Telegram bot/account (Phase 1)
2. The Hermes app + systemd units (redeploy via `scripts/deploy-ec2-release.sh`)
3. The Phloem/clio-relay tunnel (`company-omniroute` connector needs to point at the new host)

None of these fixes the others — Telegram renewal doesn't touch the tunnel; redeploying Hermes
doesn't move it either. Worth also checking, while on the box, whether a legacy separate
`:20130` clio-relay process (§ below) is still running and should be torn down rather than
carried forward.

---

## 6. Live infrastructure snapshot

- Identity: IAM user `shesh`, account `992382756552` (`arn:aws:iam::992382756552:user/shesh`).
- **Hermes EC2 is running right now**: `i-056c5f1d3a9f74190` (`hermes-runner-01`), `t3.medium`,
  state `running`, launched `2026-07-25T13:14:18Z` (~34 days up), public IP `32.199.4.57`
  (private `172.31.43.244`). It's the **only** EC2 instance in this account/region — no hidden
  extra compute to account for.
- Elastic IP `eipalloc-0a787318e4bc654e7` (32.199.4.57) is associated with that instance, tagged
  `Purpose: stable-ip-for-deploy-and-omniroute`. A second, unassociated EIP
  (`eipalloc-05e9604096a273d3d`, 54.225.186.185, `ServiceManaged: rds`) exists with no attached
  instance — likely leftover RDS networking; flagging only because unassociated EIPs accrue
  cost, not otherwise in scope here.
- Real AWS S3 (this profile, default endpoint) shows 3 unrelated buckets:
  `fitcheck-uploads-992382756552`, `rankflowai`, `rfdetr-training-transfer-...`. None is the R2
  vault.
- **R2 vault bucket is NOT reachable via the AWS S3-compatible endpoint with `--profile safvr`
  as configured**: `Credential access key has length 20, should be 32` — the `safvr` profile
  holds a standard AWS IAM key; R2's S3-compatible API wants a different (Cloudflare-issued)
  key pair. **Resolved via a different path, see below** — R2 is reachable, just not through
  that specific profile/endpoint combination.

### Cloudflare (read-only, via `wrangler`, profile `thoughtseed-labs`)

Confirmed 2026-08-29: `wrangler whoami` shows an active OAuth session as
`thoughtseedlabs@gmail.com`, account `9d7cec1b5a32b2df8c6cdc1321ccd00b` — the exact Labs
account ID cited throughout this doc. Extracted read-only via native `wrangler` subcommands
(no raw token extraction, no API calls outside wrangler's own CLI surface):

- **R2 — `thoughtseed-vault` confirmed to exist and be reachable** (created 2026-08-05),
  alongside 8 other buckets in the same account: `thoughtseed-context-projections` (also
  bound in `wrangler.labs.jsonc`), `brandbooks`, `moltbot-data`, `nova-mail-threads(-staging)`,
  `plexus-updates`, `teamforge-artifacts`, `urania-137-corpus`. **This resolves open question 2
  below**: the vault is accessible, just via the Cloudflare/wrangler auth path rather than the
  AWS CLI's S3-compatible path. Bucket *listing* was confirmed; object contents inside the
  vault were not read (out of scope unless a later verification step needs a specific key).
- **D1 — `cambium-bridge`** confirmed live (`c0aba88a-5c83-4481-b625-50356d8c98e8`, matches the
  `BRIDGE_DB` binding exactly), plus a previously-unseen second database,
  `teamforge-primary` (`613f3e80-...`). Both list `num_tables: 0` in `wrangler d1 list`'s
  summary view — likely just how that command reports without a direct schema query, not
  necessarily meaningful; not investigated further.
- **KV** — 19 namespaces total in this account; only `QUESTS` (`439547e6...`) and
  `cambium-secrets`/`SECRETS` (`3ab08249...`) match cambium's bindings. The rest
  (`gmail_*`, `dezinerai-api-*`, `BRANDBOOK_*`, `teamforge-secrets`, etc.) belong to other
  programs sharing the account — noted for completeness, not investigated.
- **Worker deployment — resolved definitively.** `cambium-quests` on the Labs account
  (`wrangler.labs.jsonc`, route `curious.thoughtseed.space`) is currently live at version
  **`fd8b6555-c286-4df6-a3cc-ec99895dbb68`**, 100% traffic, deployed 2026-08-23T03:29:40Z,
  commit `b68d39a` ("ISC-1466..1476 RollbackGatedPromotion"). This matches
  `.planning/NEXT-WAVE.json`'s promotion record (`base_commit=b68d39a`, `traffic_pct=100`)
  exactly — that file is current, not stale. **This supersedes both older version claims in
  this repo's history** (`c30ee312-...` from a 2026-08-08 checkpoint, and "Version 42" /
  `86112412-...` from 2026-08-13 — both real, both since superseded by normal deploys). The
  legacy personal-account `wrangler.jsonc` config was not queried (different account, outside
  the `thoughtseed-labs` profile given for this check).
- **Tunnel listing was not directly obtainable** — local `cloudflared` lacks the separate
  `cert.pem` needed for `cloudflared tunnel list` (a different auth flow than wrangler's OAuth
  session). `~/.cloudflared/` contained separately-stored Access org tokens for **both**
  `thoughtseedlabs.cloudflareaccess.com` and `red-queen-4dfa.cloudflareaccess.com` (plus
  per-app tokens for `plexus-api.thoughtseed.space` and a previously-unseen
  `forge.thoughtseed.space`). **Per founder direction (2026-08-29), the `red-queen-4dfa` local
  session token has been removed** — `thoughtseedlabs` is now the only Cloudflare Access org
  this plan references; see the corrected Clio-door read below (one relay, not two).
- **Account-drift risk found and flagged, not yet acted on**: `~/Library/Preferences/.wrangler/config/`
  holds six stored profiles — `thoughtseed-labs` (active, correct), `default`, `personal`,
  `9d9d` (almost certainly the legacy personal-account credentials behind the retired
  `wrangler.jsonc`, account prefix `9d9d23b2...` matches), plus `klear-karma` and `tirak`
  (other client work, unrelated to Hermes). None were deleted — `klear-karma`/`tirak` are
  likely still needed for their own projects, and removing `default`/`personal`/`9d9d` wasn't
  asked for. Flagging as the concrete drift risk behind "make sure we don't drift to another or
  older CF account": any command that doesn't explicitly target `thoughtseed-labs` (or that
  runs after some other tool switches the active profile) could silently land on one of these.
  `wrangler whoami` always shows "Active profile: X" as a quick check.

**Bottom line for the "can I still control the hosted version" question:** yes — nothing here
touched the running instance, and it isn't going anywhere until you deliberately redeploy or
re-associate the EIP. The thing that's actually broken isn't Hermes's health, it's that its
Telegram counterpart (bot/account) no longer exists — Hermes has no one to talk to on that
side until §12 Phase 1 happens. Local control via the Mac-side surfaces (Temperance Engine,
the `portfolio-cartographer` web admin, the `cambium-r3f` desktop app — see §10) is unaffected.

---

## 7. Why the Telegram wipe doesn't erase quest / infinite-game progress

This is worth stating plainly because it changes the urgency calculus. `QUESTLOG.md`'s
governing rule: **there is no stored quest tracker.** Quest completion
(`bin/operator/quests/quests.ts`, `questLedger()`) is a pure fold computed fresh, every read,
from real world-state signals — onboarding session file, `world.log`, cortex memory count,
git commit counts, tenant folder evidence (`project-evidence.ts`). None of those signals live
in Telegram. So re-pointing Hermes at a brand-new bot/account does not reset or lose "quest
progress" — the seventeen arcs (I–XVII) re-derive identically from the same evidence the
moment Hermes can reach D1/R2 again.

One pre-existing gap, unrelated to the TG wipe but worth fixing in the same pass: arcs VIII
("Living Org") and IX ("The Gate") derive from a `paperclip` input signal, and Paperclip is
already retired per a 2026-08-10 `.project/HANDOFF.md` checkpoint. Those two founder arcs are
keyed to a subsystem that no longer runs — they'll likely read as permanently stuck rather
than reflecting real state, independent of anything in this plan.

---

## 8. Kanban and the "projects sync folder"

**Kanban already exists — GitHub Project #14.** `Sheshiyer/cambium`, "Cambium —
Repository-First Portfolio & Relocation," `https://github.com/users/Sheshiyer/projects/14`,
and it's already registered as the planning surface of record in
`.temperance/project.json` (`planning.github_project` block). Kanban-as-a-feature was
explicitly designed *against* inside the app itself (`docs/plans/2026-08-01-portfolio-workbench-redesign.md:30`:
"forces incompatible Sapling and Program states into shared columns") — so the recommendation
is to track "Hermes EC2 renewal" as a card/issue on the existing Project #14 rather than stand
up a second board.

**"Projects sync folder"** doesn't correspond to any documented mechanism anywhere in this
repo (`grep` for "sync folder" / "projects sync" / "project sync" returns zero hits). The most
literal reading is what you pointed at directly: the
`/Volumes/madara/2026/Projects/thoughtseed/` directory itself, which is exactly what §9 below
inventories. If you meant something more specific (an actual file-sync service, e.g. across
machines), that's not visible from inside any repo here — flagging as an open question rather
than guessing further (§11).

---

## 9. Non-destructive census: `/Volumes/madara/2026/Projects/thoughtseed/`

62 immediate subdirectories, read-only (`status`/`log`/`remote` only — nothing that mutates
state). 16 are git checkouts; the rest are plain folders (several contain nested repos one
level deeper — e.g. `klear-karma/kkv2-*`, `parkarea/parkarea-aleph` — not expanded here since
the ask was the top-level folder).

| Folder | Git? | Remote | Branch | Last commit | Uncommitted |
|---|---|---|---|---|---|
| Airdronauts | No | — | — | not a git checkout | — |
| _physical-relocation-archive-2026-08-08 | No | — | — | not a git checkout | — |
| agentfount | No | — | — | not a git checkout | — |
| archived-thoughtseedlabs-website | No | — | — | not a git checkout | — |
| ashwinsheth-group | No | — | — | not a git checkout | — |
| brand-genesis | No | — | — | not a git checkout | — |
| brandmint-oracle-aleph | Yes | Sheshiyer/brandmint-oracle-aleph | main | 2026-06-05 `e5c8ca2` feat(template): refero-design v2 | 63 |
| brandmint | No | — | — | not a git checkout | — |
| bwssb | No | — | — | not a git checkout | — |
| **cambium** | Yes | Sheshiyer/cambium | codex/project-r2-mapping-plan | 2026-08-26 `b8a07db` docs(cross-tree): reference Temperance Engine v4/v5 | 51 |
| coproperty | No | — | — | not a git checkout | — |
| earthy-munchy | No | — | — | not a git checkout | — |
| fitcheck-landing | No | — | — | not a git checkout | — |
| fitcheck-wiki | Yes | Sheshiyer/fitcheck-wiki | main | 2026-08-10 `e52e2a2` Create Fitcheck private Astro wiki | 4 |
| fmrl-reactnative | No | — | — | not a git checkout | — |
| fmrl | No | — | — | not a git checkout | — |
| gram-cli | No | — | — | not a git checkout | — |
| hdilint-backend-aleph | No | — | — | not a git checkout | — |
| **hermes-aws-ts** | Yes | Sheshiyer/hermes-aws-ts | main | 2026-08-24 `e09ebfe` fix(ec2): correct install-vault-writeback-key.sh default PUSH_URL (#147) | 5 |
| heyzack | No | — | — | not a git checkout | — |
| hostscale | No | — | — | not a git checkout | — |
| insightreality | No | — | — | not a git checkout | — |
| iverif | No | — | — | not a git checkout | — |
| kacima | No | — | — | not a git checkout | — |
| klear-karma | No | — | — | not a git checkout | — |
| kristudios | No | — | — | not a git checkout | — |
| landingpage-ts-2026 | Yes | Sheshiyer/landingpage-ts-2026 | website-flow-v2 | 2026-08-22 `94f9dec` v2: alternate Website flow.md picks | 9 |
| meristem | Yes | Sheshiyer/meristem | main | 2026-08-07 `fc71aff` chore: commit outstanding working tree changes | 42 |
| monthlymealprep | No | — | — | not a git checkout | — |
| motionsites-export | No | — | — | not a git checkout | — |
| newsense | No | — | — | not a git checkout | — |
| omniroute-governed | Yes | diegosouzapw/OmniRoute (3rd-party fork) | memory-repair | 2026-07-29 `c9d4a45f1` Release v3.8.49 (#7076) | 7 |
| openfang | Yes | RightNow-AI/openfang | main | 2026-05-12 `acf2587` bump v0.6.9 | 8 |
| panaroma-webapp | No | — | — | not a git checkout | — |
| parkarea | No | — | — | not a git checkout | — |
| **plexus-ts** | Yes | Sheshiyer/plexus-ts | fix/cleanup-r2-nopython | 2026-08-11 `8e4c609` fix: remove setup-python dependency in cleanup-r2 | 9 |
| plugins | No | — | — | not a git checkout | — |
| raycast-extensions | No | — | — | not a git checkout | — |
| reddit-cli | No | — | — | not a git checkout | — |
| safvr | No | — | — | not a git checkout | — |
| sandboxlife | No | — | — | not a git checkout | — |
| session-atlas | Yes | Sheshiyer/session-atlas | feat/session-atlas-implementation | 2026-08-09 `c0f99d5` fix: accept observed FSEvents event size | 8 |
| skill-clusters | No | — | — | not a git checkout | — |
| skills | No | — | — | not a git checkout | — |
| snow-gloves-os | No | — | — | not a git checkout | — |
| synchronized-universe-blog | No | — | — | not a git checkout | — |
| team-forge-ts | No | — | — | not a git checkout (see §5 — TeamForge is naming only, not a separate service) | — |
| **temperance-engine-landing-page** | Yes | Sheshiyer/temperance_engine_landing_page | main | 2026-08-22 `8fde29a` feat: complete landing page redesign | 8 |
| **temperance_engine-phase-01** | Yes | Sheshiyer/temperance_engine (2nd checkout) | gsd/phase-01-provenance-control-plane | 2026-08-20 `43148e5` docs(01): verify provenance control plane | 5 |
| **temperance_engine** | Yes | Sheshiyer/temperance_engine | main | 2026-08-26 `d0aeeb8` chore(release): 0.5.4 — v5 arc closed | 6 |
| thoughtseed-brand-atlas | No | — | — | not a git checkout | — |
| thoughtseed-hermes | No | — | — | not a git checkout (see §1a — this is retired Paperclip, not Hermes) | — |
| thoughtseed-labs | Yes | Sheshiyer/thoughtseed-vault | main | 2026-08-22 `156706a` docs(gtm): promotion bundle receipt | 46 |
| thoughtseedlabs-website | Yes | Sheshiyer/thoughtseed-digital-wilderness | main | 2026-08-22 `8df2bfb` chore: add .gitignore, remove node_modules/dist | 0 |
| thoughtseedos-website | No | — | — | not a git checkout | — |
| tirak | No | — | — | not a git checkout | — |
| valmark | No | — | — | not a git checkout | — |
| vibrasonix | No | — | — | not a git checkout | — |
| virtualtryon-3d | No | — | — | not a git checkout | — |
| website | No | — | — | not a git checkout | — |
| whspr | No | — | — | not a git checkout | — |
| wtfmedia | Yes | Sheshiyer/wtfmedia | main | 2026-08-27 `ced3e83` feat(ops): visually align Phase 2 screens | 27 |

Notably present as real repos: **`plexus-ts`** (Node 6, the identity gateway, and the source of
the Clio agent — §5) and two **`temperance_engine`** checkouts (`temperance_engine` on `main`,
plus a second worktree-like checkout `temperance_engine-phase-01` on a GSD phase branch) — the
actual source that gets installed as `~/.temperance_engine`.

This table is the concrete answer to "scan for git repos... non-destructively" — nothing here
mutated any of these repos.

---

## 10. Local app surfaces (answering "the mac mini app")

No component anywhere is literally named "Mac mini app." The only "Mac mini" hits in the whole
repo (`.planning/ROADMAP-v0.4-continuation.md:18,148`) describe a **target founder posture**:
*"2–3 hrs/day, Telegram-first, display-closed Mac mini"* — i.e., the intent is for the Mac
mini to run headless in the background while you interact mostly through Telegram (via
Hermes), with local daemons doing orchestration work unattended. That's a posture, not a
product. The actual local surfaces that make up that posture:

- **`.temperance/`** (project.json/goal.json/manifest.json) — the real local daemon
  registration point: `omniroute: http://127.0.0.1:20128`, `proxy: :20129`,
  `bridge_url: http://127.0.0.1:8766`. This is the closest thing to "the app running on the
  Mac mini" — matches "Mac plant" in §5.
- **`.superset/`** — a separate local bootstrap harness (`run.sh` → `npm run dev`), explicit
  anti-list (no `wrangler deploy`, no sourcing `~/.claude/.env`, no Codex App as worker).
- **`apps/portfolio-cartographer`** — the founder-only web admin (builds to `bundle.html`,
  served at `/admin/portfolio/web` — Node 1 of the spine).
- **`apps/cambium-r3f`** — `@cambium/r3f-visual-engine`, an Electron-packaged desktop app
  (the "Urania constellation" visual engine, MAP/SHEETS/WORKFORCE modes).

One documentation hygiene note surfaced in passing: `docs/architecture/SERVICES.md` and
`DEPENDENCY-GRAPH.md` are auto-generated from `package.json` scanning only and currently claim
**"No external services detected"** — silently wrong now that Hermes/Plexus/Telegram exist as
real dependencies. That's because `INTEGRATION.md`'s whole 8-node section is still uncommitted
in this working tree. Worth regenerating those two docs once INTEGRATION.md lands, so they
stop contradicting it.

---

## 11. Open questions — need your input before Phase 1+ can be scoped precisely

1. **`temperance-ec2-headless-shadow`** — `.planning/config.json`'s `planning.sub_repos` list
   already references two sibling repos: `../hermes-service-agreement-slice` and
   `../temperance-ec2-headless-shadow`. Neither exists under
   `/Volumes/madara/2026/Projects/thoughtseed/` today (confirmed against the §9 census — not
   present). The second name in particular sounds like it could *already be* a prior scoping
   of exactly this kind of shadow/staging EC2 environment. Do you know if this was scoped
   elsewhere (another machine, a private gist, a conversation in `temperance_engine`'s own
   planning) and just never cloned here? If so, that may already contain the plan this
   document is trying to reconstruct.
2. ~~**R2 credential mismatch**~~ — **Resolved (§6).** The `safvr` AWS profile doesn't work
   against R2's S3-compatible endpoint, but the `thoughtseed-labs` wrangler/CF profile reaches
   the vault directly (`wrangler r2 bucket list` confirms `thoughtseed-vault` exists). Use that
   path for Phase 3 verification (foldback receipts land in R2) instead of the AWS CLI route.
3. **Live `HERMES_RUNNER_EXECUTE_DIRECTIVES` state** — unknown from this read-only pass since
   the real env files live only on the EC2 host. Worth confirming (e.g. via SSH, which this
   pass deliberately did not attempt) before assuming the current host's actual execution
   posture.
4. Do you want the **in-place** renewal (reconfigure the running instance, same EIP, Phloem/
   Clio door untouched) or the literal **surgical replacement** (new instance, validate, then
   cut the EIP over, re-point Phloem and optionally Clio door, then decommission the old one)
   described in Phase 2 below? Both are viable; they trade blast radius against
   confidence-in-clean-state.
5. ~~**Clio-relay vs. strength-08 contradiction**~~ — **Resolved 2026-08-29, by founder
   direction rather than the CF-Access probe.** "clio-relay" is the relay's name;
   `strength-08.thoughtseed.space` is the custom domain it runs on — one relay, not two. The
   `red-queen-4dfa` Cloudflare Access org (tied to the "separate Clio door" reading) has had
   its local session removed. See §5.

---

## 12. Phased plan

Every phase below is scoped so that **only Phase 0 and the "fold into planning" step were
actually executed by this pass** — everything from Phase 1 onward touches Telegram, EC2, or
credentials and needs your explicit go-ahead per action, consistent with `AGENTS.md`'s "no
provider/session/credential mutation without a separate owner-approved task."

- **Phase 0 — terminology reconciliation.** *(This document.)* Correct the
  Hermes-vs-Paperclip and Hermes-vs-noesis-cambium confusion in the record so future sessions
  don't re-derive it from scratch.
- **Phase 1 — new Telegram identity** *(you, not me — account/credential creation is outside
  what I can do)*. Create the new bot via @BotFather, rebuild the group/channel/topic
  structure, capture the new bot token + chat IDs + topic/thread IDs (these replace the old
  numeric topic-map entries, e.g. quest-topic 798, gate-topic 797, build-topic 862 —
  `src/telegram-topic-map.ts` — all of which are almost certainly invalid once the old account
  is gone).
- **Phase 2 — Hermes host renewal**, pick one (open question 4), touching up to four
  independent bindings (§5):
  - *In place:* push new Telegram env values to `/etc/hermes/*.env` on the existing running
    instance (`i-056c5f1d3a9f74190`), redeploy current `main` via the existing
    `scripts/deploy-ec2-release.sh`. Phloem and the Clio door keep pointing at the same host —
    nothing to re-bind. Lowest blast radius, same stable EIP.
  - *Surgical:* bootstrap a fresh instance (`ops/ec2/bootstrap-ubuntu.sh`), validate the
    canary loop end-to-end against the new bot on the new host, then re-associate
    `eipalloc-0a787318e4bc654e7` and re-point the Phloem/clio-relay tunnel connector
    (`company-omniroute`), then decommission the old instance. Higher confidence in a clean
    state; three things to re-provision instead of two. Worth checking on the box whether a
    legacy separate `:20130` clio-relay process predates the consolidation and should be torn
    down rather than carried forward (§5). Either way, "porting configs/agents/skill clusters"
    is mostly redeploying code already in `hermes-aws-ts` to a re-authenticated host — not
    rebuilding from scratch.
- **Phase 3 — continuity verification.** Re-run a synthetic canary equivalent to the one
  proven 2026-07-17 (D1 lease → Hermes → foldback → R2 → ACK) against the renewed host/bot
  before trusting it with real directives. Confirm quest-ledger arcs re-derive correctly
  (§7) and separately track the pre-existing Paperclip-keyed arc VIII/IX gap.
- **Phase 4 — documentation reconciliation.** Commit `INTEGRATION.md`'s 8-node section,
  regenerate `docs/architecture/SERVICES.md`/`DEPENDENCY-GRAPH.md`, and clean up the older
  checkpoint text that still cites superseded Worker versions (`c30ee312-...`, "Version 42") —
  **resolved (§6)**: `wrangler.labs.jsonc` on the Thoughtseed Labs account is confirmed
  production, currently live at `fd8b6555-c286-4df6-a3cc-ec99895dbb68` (commit `b68d39a`,
  matches `NEXT-WAVE.json`); `wrangler.jsonc` (personal account) stays legacy.
- **Kanban track (parallel, low-risk):** file this work as a card/issue on the existing
  GitHub Project #14 rather than a new tracker (§8).
- **Planning-fold track (parallel, low-risk, done by this pass):** this document itself is the
  non-destructive fold of the `/Volumes/madara/2026/Projects/thoughtseed/` census into
  `.planning/`, per the request — additive only, nothing relocated or mutated.

---

## What this pass did and did not do

**One mutation, explicitly directed, local-only:** the `red-queen-4dfa.cloudflareaccess.com`
local Cloudflare Access session token (+ lock file) was deleted from `~/.cloudflared/`, per
founder instruction, to stop referencing that org going forward. This is a local, regenerable
login cache — not a remote/server-side change, not user data, and not reversible only in the
trivial sense that logging into that org again would recreate it. Nothing else was deleted
anywhere in this pass.

Otherwise: no file outside `cambium/.planning/` was written. No git command beyond read-only
`status`/`log`/`remote`/`branch --show-current` ran anywhere. No AWS call beyond
`sts get-caller-identity`, `ec2 describe-instances`, `ec2 describe-addresses`, and `s3 ls` ran
— nothing that starts, stops, or modifies any resource. The only network calls beyond that
were unauthenticated, read-only DNS lookups and plain HTTP `GET`/`HEAD`/`curl -I` probes of
two already-public hostnames (`strength-08.thoughtseed.space`, `clio-relay.thoughtseed.space`)
— no credentials were supplied, requested, or handled, and both probes stopped at Cloudflare
Access's login/deny response. The `wrangler` calls in §6 used the founder's own pre-existing
`thoughtseed-labs` OAuth session (never extracted, read, or reused outside wrangler's own CLI
subcommands) and were all list/status reads — `whoami`, `r2 bucket list`, `kv namespace list`,
`d1 list`, `deployments list`/`status` — nothing that creates, writes, or deletes any
Cloudflare resource. No Telegram, R2 write, or credential action was attempted.
`temperance-next-wave` / `temperance-batch` dispatch (which `AGENTS.md`'s project-rail block
says a session should normally run automatically on start) was deliberately **not** invoked,
since this request was explicitly scoped as research-and-plan rather than execution.
