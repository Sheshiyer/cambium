# curious-api

Draft Worker for the Curious sprint. It lives in this repository and is not published.

`curious-api-dev` is the Wrangler name. It is a non-production name. `workers_dev` is off, and there are no routes. The D1 binding `CURIOUS_DB` uses the local name `curious-api-dev` and a sentinel `database_id`. That sentinel is not a database. This package does not create a Worker, a D1 database, a KV namespace, an R2 bucket, an Access application, a zone, or a secret.

Mage's live read-only check on 17 Nov 2026 places `cambium-quests` on account `9d7cec1b` (Thoughtseed Labs), the same account recorded for this Worker. The quests call is therefore a Worker service binding, `CAMBIUM_QUESTS`, with `service` set to `cambium-quests`. The binding is declared in `wrangler.jsonc` only. This package does not publish, and it does not change bindings on the live account.

The client is a thin wrapper around that binding. Tests pass a stub. A missing binding, a 401 or 403, a redirect, or a thrown binding call fails closed and does not retry. There is no `CF-Access-Client-Id` or `CF-Access-Client-Secret` placeholder on this path.

`GET /v1/quests/health` calls `/healthz` through the binding and returns 503 `fail_closed` when the binding is absent.

## Local checks

```bash
npm test
npm run typecheck
npm run dev
npm run d1:apply:local
```

`d1:apply:local` passes `--local`. Do not remove that flag. Do not run `wrangler deploy` or `wrangler secret put`.

Library truth is D1. Browser storage is a cache with an offline queue; that cache is added with the library piece. Deleted library items, shared and personal, are tombstoned for 30 days, then wiped. Field Report's site stays an editor.
