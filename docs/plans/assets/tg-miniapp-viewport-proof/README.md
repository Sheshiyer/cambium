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
- Browser: Google Chrome
- Captured scenes: tapestry audit, no-fake-progress map, policy gap, gate priority, skill promotion map, skill promotion sheet, Mira relationship, and gate consequence.

These screenshots prove local layout only. They do not prove live Telegram WebView chrome, safe-area behavior, real `initData`, or production signed actions.
