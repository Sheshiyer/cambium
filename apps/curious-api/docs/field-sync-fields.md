# Field Report sync field names

Checked against `apps/cambium-library` on draft #440 (`sync-model.js`, `sync-engine.js`, `host-runtime.js`). No sign-in was made.

The extension posts `{ schema, cursor, operations }` and requires a response `{ schema, cursor, hasMore, receipts, changes }`. Each operation is `{ id, key, patch, base }`. Each receipt is `{ id, conflicts, record }`. Each change is `{ record }`. A record is `{ key, data, fields, revision }`. `context` is optional and is not sent by this Worker.

These names are on the earlier curious-api envelope and are not sent or required by the extension:

- request: `apply`, `snapshot`, `observedAt`, `products`, `drafts`, `repositories`, `hosts`, `boards`, `ideas`, `editorial`, `workItems`, `edges`, `from`, `to`, `type`, `plan`, `body`, `previous`
- response: `dryRun`, `applied`, `diff`, `records`, `add`, `change`, `same`

`POST /api/library/sync` now accepts the extension shape. The earlier envelope remains for the bundled plan fixture, which stores `body` and `previous` byte for byte. The extension does not send those names.
