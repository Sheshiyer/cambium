# TG Mini App — 2026-07-26 · Production deploy + founder-device proof v2

This directory is the canonical evidence for the mobile-first redesign ship
(plan: `docs/plans/2026-07-24-tg-miniapp-mobile-redesign-swarm-plan.md`, issues #266/#267/#268).

## What this proves

| Artifact | Proves |
|---|---|
| `deploy-evidence.json` | **T-033** — version `203803d4-1b53-4974-85d4-4fe4e3583ef8` (git `88307e9`) at 100% traffic on `https://curious.thoughtseed.space`; post-deploy health checks per `workers/quests/DEPLOY.md` (redesigned bundle served, `/healthz/gate` 200 `gateConfigured:true`, auth-boundary probe 401 fail-closed) |
| `signed-action-smoke.json` | **T-034 / ISC-281** — founder-device proof v2: one in-app signed gate action (`confirm-action-request` on the redesign sign-off) performed by the founder in the Telegram WebView on production; hash-only receipt; server record `queued` with gate receipt `Signed confirmation queued: Sign off redesign.` at 2026-07-26T11:03:36.129Z |

## Lineage

- Supersedes `../2026-06-30/` (manual env-initData capture era; ritual retired 2026-07-24 — current Telegram desktop exposes no WebView inspect).
- Closes **ISC-279** (superseded by ISC-281 at contract freeze) and satisfies **ISC-281**: the redesigned UI performed a real signed action; this redacted receipt *is* the device proof.
- Runtime initData auth inside the WebView is unchanged and server-validated; no raw initData, user ids, tokens, founder ids, or bot ids appear in any artifact here.

## Pre-deploy verification (git `88307e9`)

`npm test` 1055/1055 · `verify:release` green · `audit:text-density` clean ·
viewport proof exit 0 (manifest + mobile screenshots under
`docs/plans/assets/tg-miniapp-viewport-proof/`).
