# curious-api

Draft Worker for the Curious sprint. It lives in this repository and is not published.

`curious-api-dev` is the Wrangler name. It is a non-production name. `workers_dev` is off, and there are no routes. The D1 binding `CURIOUS_DB` uses the database name `curious`. Mage will create that database at deploy. The `database_id` in config is a placeholder, not a database. This package does not create a Worker, a D1 database, a KV namespace, an R2 bucket, an Access application, a zone, or a secret.

Mage's live read-only check on 17 Nov 2026 places `cambium-quests` on account `9d7cec1b` (Thoughtseed Labs), the same account recorded for this Worker. The quests call is therefore a Worker service binding, `CAMBIUM_QUESTS`, with `service` set to `cambium-quests`. The binding is declared in `wrangler.jsonc` only. This package does not publish, and it does not change bindings on the live account.

The client is a thin wrapper around that binding. Tests pass a stub. A missing binding, a 401 or 403, a redirect, or a thrown binding call fails closed and does not retry. There is no `CF-Access-Client-Id` or `CF-Access-Client-Secret` placeholder on this path.

`GET /v1/quests/health` calls `/healthz` through the binding and returns 503 `fail_closed` when the binding is absent.

Installed Wrangler 3.74 reads this config with `-c wrangler.jsonc -j`. It does not accept an `observability` field, so that field is omitted. The same version warns that a service binding names the deployed `cambium-quests` Worker. Do not call `/v1/quests/health` from `wrangler dev` during this sprint. Tests stub the binding. Local dev of that route can reach the deployed Worker, and this package does not change it.

## Tokens

Aletheios is the only issuer and holds only `tokens:issue`. It cannot mint `tokens:issue`, and it cannot grant issuing or approving rights. The catalog has no `approve` scope. Personal-save scopes may be minted only for the agent `aletheios`. That allowlist is `PERSONAL_SCOPE_AGENTS` in `src/scopes.ts`. There is no API to add a name. A token lasts 12 hours unless a shorter or equal term is requested, and never more than 7 days. One token names one agent. Revocations are checked on every token request. Audit rows are append-only for issue, use, deny, and revoke.

`POST /v1/approve` accepts Mage's Access identity from `Cf-Access-Jwt-Assertion` when `MAGE_ACCESS_IDENTITY` and `CURIOUS_ACCESS_HMAC_KEY` are set outside the repository. A bearer token is refused even if that assertion is also present. The Access policy is described in `docs/access-policy.md` and is not attached.

The first `tokens:issue` credential is the Wrangler secret `CURIOUS_ISSUER_TOKEN`. Mage installs it himself at deploy time. There is no HTTP install path. See `docs/issuer-credential.md`. Tests still call `installIssuerCredential`.

## Library

D1 is the library record. `POST /v1/library/nodes`, `GET`, and `DELETE` plus `POST /mcp` expose the same writes. Personal fields are encrypted with `CURIOUS_FIELD_KEY` before they are stored. `library:*` does not include `library:personal:*`. A deleted shared or personal node is tombstoned for 30 days and then wiped. Tombstoning a shared node requires `library:write`. A personal-only token cannot delete a shared item. Credentials, cookies, and birth data are rejected and are not stored. Browser storage is only a cache plus an offline queue.

## Field Report

`POST /api/library/sync` accepts `field-report-library-sync.v1`. It is a dry run unless `apply` is `true`, and the response is a diff. The committed Field Report worker on main has no such route: `serve.py` answers POST with 405, and `hosting/worker/field-report.js` serves `/api/plan` rather than `/api/library/sync`. The live server of `POST /api/library/sync` is unknown. Plan rows store `body` and `previous` byte for byte. There is no `bodies` column. The bundled fixture is synthetic. Field Report's site stays an editor. This is the test import before a live export.

## Local checks

```bash
npm test
npm run typecheck
npm run dev
npm run d1:apply:local
```

`d1:apply:local` passes `--local`. Do not remove that flag. Do not run `wrangler deploy` or `wrangler secret put`.

Library truth is D1. Browser storage is a cache with an offline queue; that cache is added with the library piece. Deleted library items, shared and personal, are tombstoned for 30 days, then wiped. Field Report's site stays an editor.
