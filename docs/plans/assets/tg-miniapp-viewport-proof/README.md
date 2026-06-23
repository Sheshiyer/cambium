# TG Mini App Viewport Proof

This directory contains local mobile layout proof for the Cambium Telegram mini app.

Authoritative layout proof is `manifest.json` plus the PNG files it lists. `failure.json` and `browser-diagnostics.json` are diagnostic history only; they do not prove layout and they supersede the manifest only when `failure.json` is newer.

## Commands

- Diagnose browser/CDP support: `npm run proof:tg-viewport:diagnose`
- Capture screenshots: `npm run proof:tg-viewport`
- Use a specific browser: `CHROME_BIN="/path/to/chromium" npm run proof:tg-viewport`

The capture runner tries Chromium-family app bundles and cached Playwright headless-shell binaries. It attempts both `--headless=new` and `--headless` before declaring the local viewport proof blocked.

## Current Proof

- Latest manifest: `manifest.json`
- Manifest schema: `cambium.tg-viewport-proof-manifest.v1`
- Browser: Google Chrome
- Browser mode: recorded in `manifest.json`
- Captured scenes: Quests, Map, Story, Gate, and Commands.

These screenshots prove local layout only. They do not prove live Telegram WebView chrome, safe-area behavior, real `initData`, or production signed actions.

## Clickability Matrix

| Scene | Fixture | Artifact | Interaction kind | Clickability proof status |
|---|---|---|---|---|
| Quests | `no-fake-progress` | `quests-line-mobile.png` | `layout-proof` | Layout only; quest row sheets are reviewed product behavior, not captured in this manifest. |
| Story | `fresh` | `story-feed-mobile.png` | `layout-proof` | Layout only for this manifest; product story beats are sheet-backed, but a scripted story-beat sheet capture is still future proof work. |
| Commands | `fresh` | `commands-mobile.png` | `layout-proof` | Layout only for the Commands scene. |
| Commands | `fresh` | `sheet-command-chat-mobile.png` | `clickability-proof` | Captures tapping `/ts-run` and the resulting `#sheet` command metadata. |
| Map | `no-fake-progress` | `map-tapestry-audit-mobile.png` | `layout-proof` | Layout proof with `clickTargetCount: 14`; not a scripted sheet click. |
| Map | `no-fake-progress` | `map-no-fake-progress-mobile.png` | `layout-proof` | Layout proof for explicit gaps and no invented progress. |
| Map | `no-fake-progress` | `map-policy-gap-mobile.png` | `layout-proof` | Layout proof for blocked policy guidance. |
| Map | `no-fake-progress` | `map-live-proof-mobile.png` | `layout-proof` | Layout proof for live-proof capture guidance; not live Telegram proof. |
| Map | `gate` | `map-gate-priority-mobile.png` | `layout-proof` | Layout proof for gate priority card; signed choice remains in Gate sheet captures. |
| Map | `skill` | `map-skill-promotion-mobile.png` | `layout-proof` | Layout proof for skill promotion cards. |
| Map | `skill` | `sheet-skill-promotion-mobile.png` | `clickability-proof` | Captures tapping `[data-skill="0"]` and the clipped founder-review sheet. |
| Map | `mira` | `map-mira-relationship-mobile.png` | `layout-proof` | Layout proof for tenant-scoped Mira evidence. |
| Map | `mira` | `map-companions-mobile.png` | `layout-proof` | Layout proof for companion rows; no relationship overclaim. |
| Gate | `gate` | `gate-consequence-mobile.png` | `layout-proof` | Layout proof for consequence and idempotency copy. |
| Gate | `gate` | `sheet-gate-approve-preflight-mobile.png` | `clickability-proof` | Captures tapping approve and the clipped signed-action preflight sheet. |
| Gate | `gate` | `sheet-gate-reroll-preflight-mobile.png` | `clickability-proof` | Captures tapping reroll and the clipped signed-action preflight sheet. |

`failure.json` and `browser-diagnostics.json` remain diagnostic history. A newer failure receipt blocks readiness until `npm run proof:tg-viewport` regenerates `manifest.json` and the PNGs successfully.
