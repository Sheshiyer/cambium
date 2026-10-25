# Founder Gate CLI

The current CLI uses the canonical Founder Gate proposal, decision and status routes. See [the canonical CLI contract](docs/architecture/contracts/founder-gate-cli-v1.md) for the exact authenticated flow, confirmation envelope and receipt requirements, and [the renewal and 3D contract](docs/architecture/contracts/founder-proposal-renewal-v1.md) for renewal and runtime prerequisites.

Run `node bin/founder-gate.mjs --help` for a zero-network smoke. For authenticated use, explicitly set the reviewed deployment's `CAMBIUM_ORIGIN` and `CAMBIUM_TENANT`, and privately supply an existing verified founder session through `CAMBIUM_ACCESS_JWT`. The client has no live deployment or tenant default. Never put credentials in command arguments, logs or review artifacts.

Read displays the complete server-owned proposal and exact approval/rejection confirmation strings. A decision rechecks that entire review and sends one exact tuple. An uncertain result causes one canonical status read of the original tuple; it never automatically submits another decision. Settlement requires a fully bound D1 receipt and `canonicalReadback:true`. A projected history row alone is insufficient.

The CLI grants no enrollment or deployment authority. Voice and plugins remain optional thin clients over the same decision service. Source and synthetic tests do not establish production identity, enrollment, execution or live acceptance.
