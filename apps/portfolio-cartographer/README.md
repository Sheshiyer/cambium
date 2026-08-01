# Thoughtseed Portfolio Workbench

A proposal-only founder workbench for scanning, tagging, sequencing, and
focusing the Thoughtseed WorkObject portfolio before any runtime integration.

The artifact contains the verified 54-object catalog snapshot and the five
canonical organ workflows. Seven smart views reveal ongoing, paused,
white-labelable, review-needed, unplanned, and historical work. Local signals,
five intentional horizons, priorities, tags, next actions, evidence, and
optional delivery previews stay in browser storage until exported.

Untouched work remains explicitly Unscheduled. Source facts, source-derived
overlays, and reversible local intent are always labeled separately.

## Use

```bash
pnpm install
pnpm dev
```

For the portable artifact:

```bash
pnpm check
python3 -m http.server 4176 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4176/bundle.html`. The local HTTP path is the
verified preview surface; direct `file://` persistence is browser-dependent.

`bundle.html` contains its own CSS, JavaScript, and portfolio data. It makes
no network requests and cannot activate tenants, assign agents, mint receipts,
or send Telegram traffic. Valid v1 Cartographer packets migrate locally;
unreadable or unknown-WorkObject packets pause autosave until explicit Import
or Reset, preserving the original payload.

## Authority boundary

- Vault owns canonical classification.
- Cambium Goal Graph/D1 remains the operational writer.
- Hermes remains the Telegram transport.
- Workbench exports proposal packets for review and later integration.
