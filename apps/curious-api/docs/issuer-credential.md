# First Aletheios credential

Aletheios holds only `tokens:issue`. The first credential of that kind is installed by Mage at deploy time as a Wrangler secret.

| Name | Role |
| --- | --- |
| `CURIOUS_ISSUER_TOKEN` | The raw issuer token. The value is not stored in this repository |

Mage sets it himself with `wrangler secret put CURIOUS_ISSUER_TOKEN` when he deploys. That command publishes a Worker version, so this draft does not run it and does not create the secret.

There is no HTTP route that accepts, stores, or rotates the issuer credential. `installIssuerCredential` in `src/tokens.ts` inserts a hash into a local test database. The Worker fetch handler does not call it.
