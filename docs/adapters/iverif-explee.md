# IVerif Explee Adapter Contract

This contract grounds one product and one campaign before Cambium generalizes an AutoGTM scaffold. It defines an **observe-only** provider boundary for IVerif's Public Agencies campaign. It does not add an Explee client, a live route, a credential, or a campaign mutation.

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

## Port

The future adapter implements a bounded campaign-observation port. Cambium owns policy, redaction, freshness, and the fixed provider binding. Hermes may render Cambium's safe projection; Hermes must not call Explee directly.

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

The future adapter must fail closed when its dedicated read token, Explee secret, fixed grounding contract, or provider response is unavailable. Provider response bodies and credentials must never reach logs or caller-visible errors. Rate limiting may expose bounded retry metadata, but must not start an unbounded retry loop.

The campaign currently presents a one-writer conflict: live activity exists while Cambium still marks operator outreach blocked, and provider auto-reply ownership has not been reconciled. Every projection therefore reports `sendEligible=false`.

## Tenant Mapping

Explee project `16763` and campaign `45711` map only to the portable product slug `iverif`. This is not a generic multi-tenant Explee proxy and must not be reused by accepting caller-selected identifiers.

## Privacy Boundary

Provider payloads are evidence, not memory by default. Raw lead identity and message content stay inside the provider boundary. Telegram receives only the redacted Cambium projection. No provider payload, API key, lead identity, or message body belongs in source control, D1, R2, routine reports, or error telemetry in this observer slice.

## Promotion Gate

Read parity must match direct Explee GET truth before any drafting slice begins. Reply execution remains blocked until Explee auto-reply is disabled, one-writer ownership is proven, reply identity and staleness are bound in an immutable intent, ambiguous POST outcomes can be reconciled, and signed approval covers the full action identity.

Source and experiment details are pinned in [the Public Agencies evidence packet](../evidence/2026-07-16-iverif-public-agencies-experiment.md).
