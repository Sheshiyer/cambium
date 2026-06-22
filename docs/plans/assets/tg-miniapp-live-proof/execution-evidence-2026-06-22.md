# TG Mini App Execution Evidence - 2026-06-22

## Completed Locally

- Targeted TG proof tests passed: `node --test workers/quests/src/handler.test.ts workers/quests/src/live-proof-readiness.test.ts bin/operator/quests/operator-policy.test.ts` (`87` passed, `0` failed).
- Readiness regenerated with `npm run proof:tg-live-readiness`.
- Strict readiness was run with `npm run proof:tg-live-readiness:strict`; it exited blocked as expected because live Telegram inputs are absent.
- Viewport diagnostics regenerated with `npm run proof:tg-viewport:diagnose`.
- Viewport screenshots regenerated with `npm run proof:tg-viewport` (`8` screenshots in `manifest.json`).
- Priority audit confirmed no authoritative `.operator/cambium.priority-source.json` exists.
- Docs check passed: `npm run render-docs:check`.
- R3F tests passed: `npm run r3f:test` (`47` passed, `0` failed).
- R3F build passed: `npm run r3f:build`.
- Full test gate passed: `npm test` (`377` passed, `0` failed).
- A recoverable patch checkpoint was written outside the repo at `/tmp/cambium-tg-miniapp-visual-engine-20260622T1943Z.patch`.

## Current Readiness

- Summary: `ready: 8`, `blocked: 2`, `total: 10`, `liveProofReady: false`.
- Ready local rows include Worker token availability, redacted Worker list proof, page initData forwarding, Worker initData validation, promotion consumer, side-quest consumer, deterministic NPC smoke, and fresh viewport layout proof.
- Blocked rows are real Telegram `initData` and founder device WebView artifact.

## Remaining Live Inputs

- Fresh `TELEGRAM_INIT_DATA` or `TG_INIT_DATA` from a founder Telegram WebView session.
- Founder-device screenshot saved under `docs/plans/assets/tg-miniapp-live-proof/`.
- Device platform and safe-area notes for the redacted WebView artifact.
- A real signed action lifecycle to produce `signed-action-smoke.json`.

## Invariants

- Raw Telegram `initData`, Worker credentials, raw user ids, queued ids, idempotency keys, and response bodies must not be written to proof artifacts.
- Templates and capture plans are guidance only; they do not count as live proof.
- Viewport screenshots prove local layout only, not Telegram WebView provenance.
