# TG Mini App — Live Proof Unblock Runbook

> Source action: `TG-MC-406` in `docs/superpowers/specs/2026-06-30-tg-miniapp-plan-vs-code-critique.md`.
> Capture engine: `workers/quests/src/live-proof-readiness.mjs` (1511 lines, do not modify here).
> Readiness manifest: `docs/plans/assets/tg-miniapp-live-proof/readiness.json`.

## 1. Status

Pending founder slot. Target: clear 2 top-level blockers + 1 followup in a single ~1h session.

- Current top-level: **8 ready / 2 blocked** (`readiness.json` summary at `generatedAt 2026-06-30T08:51:08.667Z`).
- Blocked top-level items: `telegram-init-data`, `telegram-device-artifact`.
- Followup: `signed-action-smoke` (under `capturePlan.steps`, currently blocked because the prior two are blocked).
- Post-session target: **10 ready / 0 blocked** at the top level, plus `signed-action-smoke` state `ready`.

## 2. Why this matters

T5 of the critique flags this as the only outstanding live-proof gap blocking the mini-app readiness flip. The capture engine and validators are already shipped — what is missing is real founder-device evidence that satisfies the **no-fake-progress invariant** from `docs/architecture/contracts/tg-miniapp-ecosystem-contract.md` (line 49 onward): no raw `initData`, no bearer tokens, no founder ids, no raw subjects, no queued ids — redacted hashes only.

## 3. Pre-flight checklist

Have all of these ready **before** the session starts. Each line maps to a validator gate that will reject a partial capture.

- [ ] **Real Telegram client** open on a real device — iOS, Android, or Desktop. (`webView.platform` is required; see `live-proof-readiness.mjs:510`.)
- [ ] **`curios.self` bot launched**, mini app opened on the production surface (`https://curious.thoughtseed.space`). The Worker rejects any other origin (`live-proof-readiness.mjs:507`).
- [ ] **Founder Telegram user id is in the founder allowlist** on the Worker (the Worker re-checks after `validateInitData`; if your id was rotated, refresh it before opening the WebView).
- [ ] **`QUESTS_PUSH_TOKEN` present** in `~/.claude/.env` (line `QUESTS_PUSH_TOKEN=...`) OR exported in the shell. Resolver order: env first, then file (`live-proof-readiness.mjs:62-65`). Required for Steps 2 and 3.
- [ ] **Founder-device screenshot saved** under `docs/plans/assets/tg-miniapp-live-proof/` (any name, e.g. `founder-device.png`). The validator requires the path to live under that dir and the file to exist (`live-proof-readiness.mjs:518-528`).
- [ ] **`TELEGRAM_INIT_DATA`** (or alias `TG_INIT_DATA`) **exported in the same shell** that runs the capture command. Pulled from the active Telegram WebView session. Max age 600s by the time Step 1 runs (`WORKER_INITDATA_MAX_AGE_SEC = 600`, `live-proof-readiness.mjs:25`).
- [ ] **`TELEGRAM_WEBVIEW_PLATFORM`** noted: one of `ios`, `android`, `desktop`. (Pass via `--platform` flag.)
- [ ] **`TELEGRAM_WEBVIEW_SAFE_AREA`** noted as `"top-right-bottom-left"` or a short note (e.g. `"47-0-34-0"`). (Pass via `--safe-area` flag.)
- [ ] For Step 3 only: **operator audit file** and **mini app envelope file** already on disk locally (see Step 3 prereqs).

## 4. Step 1 — Device proof capture

Clears: `telegram-device-artifact` (and contributes to `telegram-init-data` being scored ready once env is exported in the same shell).

Source flags: `live-proof-readiness.mjs:119-122, 141, 333-361`.

```bash
TELEGRAM_INIT_DATA="<raw initData from active WebView>" \
TELEGRAM_WEBVIEW_PLATFORM="<ios|android|desktop>" \
TELEGRAM_WEBVIEW_SAFE_AREA="<top-right-bottom-left>" \
npm run proof:tg-live-readiness -- \
  --capture-device-proof \
  --screenshot docs/plans/assets/tg-miniapp-live-proof/<founder-device>.png \
  --platform <ios|android|desktop> \
  --safe-area "<top-right-bottom-left>"
```

Required env vars:
- `TELEGRAM_INIT_DATA` (or `TG_INIT_DATA` alias).
- `QUESTS_PUSH_TOKEN` not strictly required for this step but harmless if present.

Output artifact (written automatically because the npm script passes `--write`): `docs/plans/assets/tg-miniapp-live-proof/telegram-webview.json` — schema `cambium.tg-device-proof.v1`, stores `userIdHash`, `initDataHash`, `screenshot.sha256` only.

## 5. Step 2 — Worker network probe

Clears: backstop for `worker-network-probe` freshness (current artifact ages out after 24h — `DEFAULT_WORKER_PROBE_MAX_AGE_SEC`, `live-proof-readiness.mjs:24`). Re-run during the session so the receipt is fresh against the same Worker state Step 3 will mutate.

Source flags: `live-proof-readiness.mjs:143, 145, 740-793`.

```bash
npm run proof:tg-live-readiness -- \
  --capture-worker-probe \
  --allow-network
```

Required env vars:
- `QUESTS_PUSH_TOKEN` (will throw `QUESTS_PUSH_TOKEN is required to capture the Worker probe`, `live-proof-readiness.mjs:747`).
- `QUESTS_WORKER_URL` optional, defaults to `https://curious.thoughtseed.space`.

Output artifact: `docs/plans/assets/tg-miniapp-live-proof/worker-network-probe.json` — schema `cambium.worker-network-probe.v1`, stores response status + `bodySha256` only.

## 6. Step 3 (followup) — Signed action smoke

Clears: `signed-action-smoke` followup. **NOTE: This step mutates production state — it submits a real signed action to the Worker queue. Do not run unless the founder has cleared the action shape, subject, and idempotency key. The artifact only validates if an operator command then actually consumes the queued action.**

Source flags: `live-proof-readiness.mjs:100-148, 809-919`.
Allowed `action-kind` values (`GATE_ACTION_KINDS`, `live-proof-readiness.mjs:29`): `approve`, `reroll`, `promote-skill`, `queue-side-quest`.
Allowed `smoke-kind` values (`SIGNED_SMOKE_KINDS`, `live-proof-readiness.mjs:28`, derived if omitted): `skill-promotion`, `side-quest`, `npc-history`, `gate-approval`.

```bash
TELEGRAM_INIT_DATA="<raw initData from active WebView>" \
npm run proof:tg-live-readiness -- \
  --capture-signed-smoke \
  --allow-network \
  --allow-mutation \
  --action-kind <approve|reroll|promote-skill|queue-side-quest> \
  --action-subject "<redacted subject string>" \
  --action-idempotency-key "<unique idempotency key>" \
  --operator-command "<exact operator command run, e.g. quine:write-skills:apply-promotions>" \
  --operator-audit <path to local operator audit log file> \
  --operator-checked <integer >= 0> \
  --operator-consumed <integer >= 1> \
  --operator-rejected <integer >= 0> \
  --miniapp-envelope <path to refreshed mini app envelope file> \
  --visible-marker "<string that appears in the envelope file>"
```

Optional (validators apply defaults from `live-proof-readiness.mjs:842-845` if omitted):
- `--action-evidence`, `--action-consequence`, `--action-reversibility`.
- `--smoke-kind` (auto-derived from `--action-kind` via `defaultSmokeKindForAction`, `live-proof-readiness.mjs:795-799`).

Order of operations during the run (the capture handles all four phases in one call, but the founder still has to execute the operator consume between when the Worker queues and when this command checks):
1. Capture command submits to `POST /api/gate/{tenant}` with the signed initData.
2. Capture command lists `GET /internal/gate/{tenant}` and verifies the queued id or idempotency key appears.
3. **Founder runs the operator command** (e.g. `quine:write-skills:apply-promotions`) outside this script and saves the audit log to `--operator-audit`.
4. Founder refreshes the mini app, saves the visible envelope to `--miniapp-envelope`, and confirms `--visible-marker` is in that file (validator enforces this, `live-proof-readiness.mjs:836`).

Output artifact: `docs/plans/assets/tg-miniapp-live-proof/signed-action-smoke.json` — schema `cambium.signed-action-smoke.v1`, stores hashes + counts only (no `queuedId`, no `subject`, no `idempotencyKey`).

## 7. Verification

After all three captures complete:

```bash
npm run proof:tg-live-readiness
```

Then open `docs/plans/assets/tg-miniapp-live-proof/readiness.json` and confirm:

- `summary.ready` is `10`, `summary.blocked` is `0`, `summary.liveProofReady` is `true`, `status` is not `blocked`.
- Item `telegram-init-data` → `state: "ready"`.
- Item `telegram-device-artifact` → `state: "ready"` with evidence including `docs/plans/assets/tg-miniapp-live-proof/telegram-webview.json`.
- Item `worker-network-probe` → `state: "ready"` with a `capturedAt` from this session.
- `capturePlan.steps[*].state` for `signed-action-smoke` → `ready`.

## 8. Rollback

If a capture fails mid-flight or the validator rejects the receipt:

1. Delete the partial JSON from `docs/plans/assets/tg-miniapp-live-proof/` (only `telegram-webview.json`, `worker-network-probe.json`, or `signed-action-smoke.json` — never delete the `.template.json` files or `readiness.json`).
2. Re-export env vars (the original `TELEGRAM_INIT_DATA` may have aged out — 600s window).
3. Re-run the same step command.

The validator rejects template artifacts (`writesAuthority === false` short-circuit, `live-proof-readiness.mjs:472-480, 566-574, 650-658`) and rejects partial captures (every required hash, count, and timestamp is checked). A failed capture cannot accidentally promote to `ready` — the worst case is the file is absent or the item stays `blocked`.

## 9. Schedule slot

Pending founder calendar.
