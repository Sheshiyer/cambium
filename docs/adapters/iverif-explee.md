# IVerif Explee Adapter Contract

This contract grounds one product and one campaign before Cambium generalizes an AutoGTM scaffold. It defines an **observe-only** provider boundary for IVerif's Public Agencies campaign. The evidence layer introduced no client or route; the observer layer now implements four dedicated GET routes without adding a campaign mutation.

## Official Vendor Surface

This slice is pinned to Explee's published public API surface as verified on 2026-07-18:

- Human docs: <https://api.explee.com/public/api/docs>
- OpenAPI schema: <https://api.explee.com/public/api/openapi.json>

The current implementation uses only documented `GET` endpoints under `/public/api/v1/autogtm/...` and keeps every `POST` mutation route out of Cambium's exposed boundary.

## Fixed Binding

| Surface | Fixed value |
| --- | --- |
| Cambium product branch | `iverif` |
| Explee project | `16763` |
| Explee campaign | `45711` (`Public Agencies`) |
| Telegram topic | `clients` |
| Telegram thread | `804` |
| Promotion state | `proof-only` |
| Provider mode | `observe-only` |

These values are versioned in `workers/quests/src/iverif-grounding.ts`. A caller must never be able to replace the origin, project, campaign, provider path, or HTTP method.

## Read Routes

All four routes require the dedicated `IVERIF_READ_TOKEN`. Its value must use the `iverif-read-v1.` namespace followed by at least 32 random characters, and must differ from every other Worker bearer credential. Configuration fails closed on a bridge, assignment, push, provider-broker, or context-route token collision. The namespace also keeps the credential disjoint from generated hexadecimal member tokens. Broad bridge, assignment, and member credentials are not accepted.

- `GET /v1/bridge/iverif/status`
- `GET /v1/bridge/iverif/inbox`
- `GET /v1/bridge/iverif/thread/:personId`
- `GET /v1/bridge/iverif/optimize`

## Candidate Configuration and Parity

Do not place secret values in command arguments, shell history, source control, or deployment receipts. Rotate any previously disclosed Explee key before candidate deployment, then enter the new value through the interactive `wrangler secret put EXPLEE_API_KEY` prompt. Create a separate read credential using the required `iverif-read-v1.` namespace and enter it through `wrangler secret put IVERIF_READ_TOKEN`.

Hermes receives only that dedicated read credential as `HERMES_IVERIF_READ_TOKEN` plus the existing Cambium base URL. Hermes never receives `EXPLEE_API_KEY`.

Candidate parity is field-by-field, not a successful-status check:

1. Compare direct Explee project, campaign, autopilot, inbox, and thread GET results with the four redacted Cambium projections.
2. Confirm project `16763`, campaign `45711`, aggregate counts, freshness, pagination, provider auto-reply state, and opaque thread state match.
3. Confirm every Cambium response reports `sendEligible=false`, and that no identity, address, subject, body, credential, or raw RFC message identifier leaves the adapter.
4. Exercise `/ts-iverif status`, `inbox`, `thread`, and `optimize` against the candidate Worker; verify Hermes distinguishes provider reply eligibility from system send eligibility.
5. Keep production deployment, drafting, and every provider mutation disabled until the parity receipt is reviewed.

## Port

The adapter implements a bounded campaign-observation port. Cambium owns policy, redaction, freshness, and the fixed provider binding. Hermes may render Cambium's safe projection; Hermes must not call Explee directly.

## Inputs

The observation slice may accept only:

- a fixed snapshot, inbox, or optimization-read operation;
- a bounded opaque person identifier for one thread observation;
- a dedicated read token at the Cambium boundary.

The Explee API key remains a Cloudflare Worker secret. It is never an input supplied by Hermes or an operator command.

## Outputs

Only redacted observation DTOs may leave Cambium. They may include aggregate analytics, opaque person or message identifiers, timestamps, intent labels, reply eligibility, policy conflict, freshness, and source provenance. They must exclude names, email addresses, message bodies, subjects, phone numbers, postal addresses, LinkedIn details, and arbitrary provider fields.

## Mutation Boundary

The permitted upstream method set is exactly `GET`. This contract does not permit or expose:

- reply drafting or sending;
- start or stop operations;
- budget or autopilot changes;
- lead imports;
- scheduled provider polling;
- generic provider proxying;
- D1 intent or execution writes.

There is deliberately no inert reply endpoint. A write-shaped route can be mistaken for readiness, so it belongs in a later, separately reviewed slice after live read parity.

## Failure Mode

The adapter fails closed when its dedicated read token, Explee secret, fixed grounding contract, or provider response is unavailable. Provider response bodies and credentials never reach logs or caller-visible errors. Rate limiting may expose bounded retry metadata, but does not start an unbounded retry loop.

The campaign currently presents a one-writer conflict: live activity exists while Cambium still marks operator outreach blocked, and provider auto-reply ownership has not been reconciled. Every projection therefore reports `sendEligible=false`.

## Tenant Mapping

Explee project `16763` and campaign `45711` map only to the portable product slug `iverif`. This is not a generic multi-tenant Explee proxy and must not be reused by accepting caller-selected identifiers.

## Privacy Boundary

Provider payloads are evidence, not memory by default. Raw lead identity and message content stay inside the provider boundary. Every RFC message identifier is projected as a SHA-256 pseudonym before leaving the adapter. Telegram receives only the redacted Cambium projection. No provider payload, API key, lead identity, or message body belongs in source control, D1, R2, routine reports, or error telemetry in this observer slice.

## Promotion Gate

Read parity must match direct Explee GET truth before any drafting slice begins. Reply execution remains blocked until Explee auto-reply is disabled, one-writer ownership is proven, reply identity and staleness are bound in an immutable intent, ambiguous POST outcomes can be reconciled, and signed approval covers the full action identity.

Source and experiment details are pinned in [the Public Agencies evidence packet](../evidence/2026-07-16-iverif-public-agencies-experiment.md).
