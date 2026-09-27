# Website Intake Runtime

## Ownership

The public Thoughtseed site owns presentation and in-memory conversation state. Cambium owns the AI proxy, consented lead persistence, retention, and the protected `/ops/leads` inbox. The site has no separate lead database, CRM API, or operator UI. Its `/ops/leads` route forwards to Cambium; its Vite-only `/api` proxy strips that prefix before forwarding to the local Cambium Worker.

`website_intake_leads` is a Cambium-owned intake table, separate from the Goal Graph and provider CRM records. This is deliberate: `lead-runtime-spine.md` and `contracts/fitcheck-crm-handoff.v1.md` keep external CRM handoff review-gated and prohibit direct Goal Graph writes from this website intake. Any later promotion into the core CRM must use the approved Cambium proposal/review flow.

## Routes

| Route | Purpose | Boundary |
| --- | --- | --- |
| `POST /v1/intake/turn` | Consent-gated OpenAI Responses request with strict JSON output | Eight assistant responses maximum; no tools; `store: false`; contact data redacted and never sent |
| `POST /v1/leads` | Save a complete brief after a distinct storage-consent action | Requires a valid selected email/WhatsApp reply contact; never sends a message |
| `GET /ops/leads` | Serve the Cambium-hosted operator inbox | Cloudflare Access JWT and exact operator email allowlist required |
| `GET /v1/admin/leads` | List unexpired inquiries | Access identity and allowlist rechecked on every request |
| `GET /v1/admin/leads/{id}` | Read one inquiry | Access identity and allowlist rechecked on every request |
| `DELETE /v1/admin/leads/{id}` | Delete one inquiry | Access identity and allowlist rechecked on every request; browser confirmation |

The inbox stores only final structured fields, the visitor-selected reply contact/channel, consent version/time, creation time, and expiry time. It does not store transcripts, IP addresses, or user-agent strings. Records expire after 90 days; the daily `0 0 * * *` scheduled event removes expired rows.

## Local Run

Start the Cambium Worker from this repository:

```sh
npx wrangler dev --config workers/quests/wrangler.jsonc --local --port 8787
```

Start the site from `landingpage-ts-2026` on port 5176. Its Vite `/api` proxy targets the local Worker and rewrites `/api/v1/...` to `/v1/...`; the local ops target is `/api/ops/leads`. Wrangler applies the local D1 migration. Without the OpenAI secret, AI turns return an unavailable response and the visitor can use the deterministic intake. Without Access audience, team domain, email allowlist, and D1 bindings, lead storage and the inbox fail closed.

## Preview Readiness

Before a Cloudflare preview, set `WEBSITE_ACCESS_TEAM_DOMAIN`, `WEBSITE_ACCESS_AUDIENCE`, and `WEBSITE_OPS_EMAILS` only to the intended operator identities, then create Access path policies covering `/ops/leads*` and `/v1/admin/leads*`. Store `OPENAI_API_KEY` as a Worker secret, never as a `VITE_` variable. Confirm `WEBSITE_ORIGINS` matches the preview origin. Verify the configured rate-limit namespace IDs are unique in the target account before publishing either Wrangler configuration.

Preview and production changes are separate approvals. This local implementation does not configure Access, set secrets, publish a Worker, send email/WhatsApp, or write into the Goal Graph.
