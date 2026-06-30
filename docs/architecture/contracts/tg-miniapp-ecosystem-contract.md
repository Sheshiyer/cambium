# Cambium TG Mini App Ecosystem Contract

Status: v1 active
Owner: Cambium operator / Telegram mini app
Runtime source: `workers/quests/src/page.ts`
Proof sources: `workers/quests/src/visual-viewport-proof.mjs`, `workers/quests/src/live-proof-readiness.mjs`

## Purpose

The Telegram mini app is Cambium's pocket ecosystem surface. It may render engine state, open inspection sheets, and queue founder-signed actions only when the source data is present in the quest envelope, operator ledgers, Worker receipts, or proof artifacts named below. It must show explicit gaps when evidence is missing.

## Scene Ownership

| Scene | Owns | Allowed interactions | Non-authority |
|---|---|---|---|
| Mission | Product-branch arcs, missions, KPIs, gate ledger, branch proof foldback, and promotion state via `product-branch-packets@v1` plus `quest-ledger-envelope@v1` | Mission rows may open branch sheets (`branch-arc`, `branch-mission`, `branch-gate`, `branch-proof`) when the served packet has inspectable detail | Branch KPI chips and stale freshness are not live proof; promotion state cannot be mutated from this scene |
| Gate | Founder approval and reroll preflight backed by `telegram initData` plus Worker gate queue | Approve and reroll buttons may open signed action sheets with consequence, reversibility, and idempotency | The scene does not mutate Paperclip or operator files directly |
| Tools | Operator toolbelt: `paperclipCommandsData` live command sheets plus `curios.self` typed chat-command and command-reference surface | Live command cards may open inspection sheets; typed chat-command rows remain user-executed commands | Reference commands and digest rows are not background automations; the scene does not execute commands on the founder's behalf |
| Story | Narrative and Noesis/Paperclip/forge beats from served beats or complete quest rows (`world.log`, `paperclipActivityBeats`, `deviations`, `operator-narrative`, `quest-ledger`) | Story beat cards open inspection sheets with lane, source, target, and no-execution copy; current viewport proof captures layout only | Story cards must not imply completed work or emotional relationship state |
| Inspect | Ecosystem inspection: tapestry audit, wake loop, lanes, stance, policy, decision context, live proof, side quests, coordination, senses, stages, evidence boxes, skill labors, companions, and packet rails per `MINI_APP_MAP_SUBSECTIONS` | Source-backed cards and rails may open inspection sheets; skill founder-review cards may open a signed preflight sheet | Subsections are inspection-only and still need scripted viewport clickability proof; sheets do not mutate authority |

Branch arcs, missions, KPIs, gates, and proof are owned by Mission — anything that mutates branch promotion state must originate there or in Gate, not in Inspect. The Inspect subsections (tapestry / wake / lanes / stance / policy / decision context / live proof / evidence boxes / skills / companions / rails) replace the legacy Map ecosystem language; the Map scene no longer exists in the deployed surface.

## Ecosystem Targets

Every ecosystem target must identify the source that owns its truth:

| Target | Authority | Mini app rendering rule |
|---|---|---|
| Quest frontier | Pure quest ledger and pushed visual envelope | Show current state or explicit missing frontier |
| Wake loop | Served wake rows and optional operator wake-event history | Latest served row wins; history explains but never overrides current state |
| Skill labors | `.operator/<tenant>.skills.json` and promotion consumer evidence | Production requires registry authority; founder-review cards stay approval-gated |
| Gate queue | Paperclip-enriched open items and Worker gate queue | Review-only on Inspect; signed choice only inside Gate |
| Decision context | `operator-priority-signals@v1` and source/audit artifacts | Context may explain ranking; incomplete signals block policy authority |
| Mira and companions | Tenant-scoped cortex/NPC event rows | Stages describe evidence depth, not affinity or trust |
| Live proof | Redacted readiness and live-proof receipts | Readiness guides capture; only complete validated live receipts mark live proof ready |
| Mobile viewport | `tg-miniapp-viewport-proof/manifest.json` and listed PNGs | Local screenshots prove local layout only, never Telegram WebView provenance |

## Interaction Kinds

- `layout-proof`: a PNG from the real `PAGE` export under mobile emulation. It proves visible layout for the captured fixture only.
- `clickability-proof`: a scripted click against a real selector that waits for a visible sheet or preflight state before capture.
- `inspection-sheet`: a bottom sheet that exposes source, proof, evidence rows, provenance, or command metadata without mutating authority.
- `signed-action-preflight`: a sheet opened from Gate or eligible skill/side-quest actions before a Telegram-signed Worker request.
- `chat-command`: a visible command row that the founder can copy or run in chat; it is not an automatic execution.
- `rail-inspection-sheet`: visual topology, route, or relationship line that opens a source/proof sheet without mutation authority.
- `capture-plan-guidance`: a readiness step that explains how to capture proof; it is not evidence until its receipt validates ready.

## No-Fake-Progress Rules

- Never count templates, capture plans, stale screenshots, browser diagnostics, or local Chrome layout captures as live Telegram proof.
- Never infer completion, reward, popularity, social proof, NPC affinity, founder stance, or skill mastery from missing data.
- Never let a newer `failure.json` or diagnostic receipt be treated as a passing viewport manifest.
- Never store raw Telegram `initData`, WebView query parameters, Worker bearer tokens, raw founder ids, raw action subjects, or raw queued ids in proof artifacts.
- Never mutate Paperclip, skill registries, side-quest ledgers, or NPC history from the mini app UI directly; queue or consume through the owning operator/Worker path.
- Never add a clickable-looking row unless it is either backed by a sheet/action selector or visibly marked as read-only/gap guidance.

## Evidence Paths

- Local viewport manifest: `docs/plans/assets/tg-miniapp-viewport-proof/manifest.json`
- Local viewport screenshots: `docs/plans/assets/tg-miniapp-viewport-proof/*.png`
- Viewport diagnostic history: `docs/plans/assets/tg-miniapp-viewport-proof/failure.json` and `browser-diagnostics.json`
- Live readiness manifest: `docs/plans/assets/tg-miniapp-live-proof/readiness.json`
- Worker list proof: `docs/plans/assets/tg-miniapp-live-proof/worker-network-probe.json`
- Device proof target: `docs/plans/assets/tg-miniapp-live-proof/telegram-webview.json`
- Signed smoke target: `docs/plans/assets/tg-miniapp-live-proof/signed-action-smoke.json`
- Schema/test guard: `workers/quests/src/live-proof-readiness.test.ts`
