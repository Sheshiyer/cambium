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
- Captured scenes: Mission, Story, Tools, Inspect, and Gate.
- Root shell proof: every current scene capture includes the component-system `MissionControlShell` and glyph-backed `RootNav`.

These screenshots prove local layout only. They do not prove live Telegram WebView chrome, safe-area behavior, real `initData`, or production signed actions.

## Clickability Matrix

| Scene | Fixture | Artifact | Interaction kind | Clickability proof status |
|---|---|---|---|---|
| Mission | `branch-stories` | `mission-control-320-mobile.png`, `mission-control-mobile.png`, `mission-control-430-mobile.png` | `layout-proof` | Browser-asserted 320/390/430 px layout proof for the packet-backed Mission Control first screen, contained branch rail, mission panel, proof rows, and single-row questline. |
| Mission | `branch-stories` | `mission-actions-mobile.png` | `layout-proof` | Layout proof for the componentized state stack, proof rows, and non-floating `GateActionRow` so Review Gate/Open Proof do not cover the flow. |
| Mission | `branch-stories` | `sheet-mission-review-gate-mobile.png` | `clickability-proof` | Captures tapping Review Gate and the componentized branch-gate sheet. |
| Mission | `branch-stories` | `sheet-mission-open-proof-mobile.png` | `clickability-proof` | Captures tapping Open Proof and the componentized branch-proof sheet. |
| Mission | `branch-stories` | `mission-vantyx-selected-mobile.png` | `clickability-proof` | Captures tapping the Vantyx branch tab, updating the mission panel in place, and keeping the sheet closed. |
| Story | `fresh` | `story-feed-mobile.png` | `layout-proof` | Layout only for this manifest; product story beats are sheet-backed, but a scripted story-beat sheet capture is still future proof work. |
| Tools | `fresh` | `tools-mobile.png` | `layout-proof` | Layout proof for the operator toolbelt scene. |
| Tools | `fresh` | `sheet-tools-command-chat-mobile.png` | `clickability-proof` | Captures tapping `/ts-run` and the resulting `#sheet` command metadata. |
| Inspect | `no-fake-progress` | `inspect-tapestry-audit-mobile.png` | `layout-proof` | Layout proof with `clickTargetCount: 14`; not a scripted sheet click. |
| Inspect | `no-fake-progress` | `inspect-proof-320-mobile.png` | `layout-proof` | Browser-asserted 320 px proof for the persistent summary, Proof/System switcher, and contained single-column evidence groups. |
| Inspect | `no-fake-progress` | `inspect-system-overview-mobile.png` | `layout-proof` | Browser-asserted proof that System content replaces Proof content in place without opening a drawer. |
| Inspect | `no-fake-progress` | `inspect-no-fake-progress-mobile.png` | `layout-proof` | Layout proof for explicit gaps and no invented progress. |
| Inspect | `no-fake-progress` | `inspect-policy-gap-mobile.png` | `layout-proof` | Layout proof for blocked policy guidance. |
| Inspect | `no-fake-progress` | `inspect-live-proof-mobile.png` | `layout-proof` | Layout proof for live-proof capture guidance; not live Telegram proof. |
| Inspect | `gate` | `inspect-gate-priority-mobile.png` | `layout-proof` | Layout proof for gate priority card; signed choice remains in Gate sheet captures. |
| Inspect | `skill` | `inspect-skill-promotion-mobile.png` | `layout-proof` | Layout proof for skill promotion cards. |
| Inspect | `skill` | `sheet-inspect-skill-promotion-mobile.png` | `clickability-proof` | Captures tapping `[data-skill="0"]` and the clipped founder-review sheet. |
| Inspect | `mira` | `inspect-mira-relationship-mobile.png` | `clickability-proof` | Captures tapping the Mira companion row and the clipped tenant-scoped relationship evidence sheet. |
| Inspect | `mira` | `inspect-companions-mobile.png` | `layout-proof` | Layout proof for companion rows; no relationship overclaim. |
| Gate | `no-fake-progress` | `gate-empty-mobile.png` | `layout-proof` | Layout proof for the componentized empty decision lane: glyph root nav, state rail, decision lane, and founder action copy. |
| Gate | `gate` | `gate-consequence-mobile.png` | `layout-proof` | Layout proof for the componentized signed-action cards, visible approve/reroll controls, consequence, and idempotency copy. |
| Gate | `gate` | `sheet-gate-approve-preflight-mobile.png` | `clickability-proof` | Captures tapping approve and the clipped signed-action preflight sheet. |
| Gate | `gate` | `sheet-gate-reroll-preflight-mobile.png` | `clickability-proof` | Captures tapping reroll and the clipped signed-action preflight sheet. |

`failure.json` and `browser-diagnostics.json` remain diagnostic history. A newer failure receipt blocks readiness until `npm run proof:tg-viewport` regenerates `manifest.json` and the PNGs successfully.
