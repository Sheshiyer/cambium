# curious-api

Draft Worker for the Curious sprint. It lives in this repository and is not published.

`curious-api-dev` is the Wrangler name. It is a non-production name. `workers_dev` is off, and there are no routes. The D1 binding `CURIOUS_DB` uses the database name `curious`. Mage will create that database at deploy. The `database_id` in config is a placeholder, not a database. This package does not create a Worker, a D1 database, a KV namespace, an R2 bucket, an Access application, a zone, or a secret.

Mage's live read-only check on 17 Nov 2026 places `cambium-quests` on account `9d7cec1b` (Thoughtseed Labs), the same account recorded for this Worker. The quests call is therefore a Worker service binding, `CAMBIUM_QUESTS`, with `service` set to `cambium-quests`. The binding is declared in `wrangler.jsonc` only. This package does not publish, and it does not change bindings on the live account.

The client is a thin wrapper around that binding. Tests pass a stub. A missing binding, a 401 or 403, a redirect, or a thrown binding call fails closed and does not retry. There is no `CF-Access-Client-Id` or `CF-Access-Client-Secret` placeholder on this path.

`GET /v1/quests/health` calls `/healthz` through the binding and returns 503 `fail_closed` when the binding is absent.

Installed Wrangler 3.74 reads this config with `-c wrangler.jsonc -j`. It does not accept an `observability` field, so that field is omitted. The same version warns that a service binding names the deployed `cambium-quests` Worker. Do not call `/v1/quests/health` from `wrangler dev` during this sprint. Tests stub the binding. Local dev of that route can reach the deployed Worker, and this package does not change it.

## Tokens

Aletheios is the only issuer and holds only `tokens:issue`. It cannot mint `tokens:issue`, and it cannot grant issuing or approving rights. The catalog has no `approve` scope. A token lasts 12 hours unless a shorter or equal term is requested, and never more than 7 days. One token names one agent. Revocations are checked on every token request. Audit rows are append-only for issue, use, deny, and revoke.

`POST /v1/approve` accepts Mage's Access identity from `Cf-Access-Jwt-Assertion` when `MAGE_ACCESS_IDENTITY` and `CURIOUS_ACCESS_HMAC_KEY` are set outside the repository. A bearer token is refused even if that assertion is also present. The Access policy is described in `docs/access-policy.md` and is not attached.

The first `tokens:issue` credential is the Wrangler secret `CURIOUS_ISSUER_TOKEN`. Mage installs it himself at deploy time. There is no HTTP install path. See `docs/issuer-credential.md`. Tests still call `installIssuerCredential`.

## Local checks

```bash
npm test
npm run typecheck
npm run dev
npm run d1:apply:local
```

`d1:apply:local` passes `--local`. Do not remove that flag. Do not run `wrangler deploy` or `wrangler secret put`.

Library truth is D1. Browser storage is a cache with an offline queue; that cache is added with the library piece. Deleted library items, shared and personal, are tombstoned for 30 days, then wiped. Field Report's site stays an editor.
