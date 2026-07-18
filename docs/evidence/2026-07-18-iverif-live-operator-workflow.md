# IVerif Live Operator Workflow Evidence

Date: 2026-07-18  
Activation verdict: `credential-blocked`  
Follow-up: `followup-iverif-live-canary-20260718`

## Delivered Boundary

Cambium is the only component permitted to hold `EXPLEE_API_KEY`. It calls four fixed, documented Explee GET observations for Cambium product `iverif`, project `16763`, campaign `45711`, and returns closed, redacted DTOs through:

- `GET /v1/bridge/iverif/status`
- `GET /v1/bridge/iverif/inbox`
- `GET /v1/bridge/iverif/thread/:personId`
- `GET /v1/bridge/iverif/optimize`

Hermes holds only a distinct `iverif-read-v1.*` credential and renders the DTOs through `/ts-iverif`. The command is default-off behind `HERMES_IVERIF_OPERATOR_ENABLED=false`. It exposes no provider key, mutation route, reply drafting, sending, campaign start/stop, budget change, autopilot change, lead import, scheduled poll, or generic proxy.

All receipts require the exact grounding digest, schema version, provider binding, proof-only policy, `sendEligible=false`, and the one-writer conflict reason. They disclose pagination, provider omission or truncation, and Telegram receipt clipping. Message references may leave Cambium only as `sha256:<64 lowercase hexadecimal characters>`; otherwise they become `null` and Hermes renders them as redacted.

## Branch Ancestry

| Repository | Branch | Proven base |
| --- | --- | --- |
| Cambium | `codex/iverif-live-observer-wiring` | `origin/codex/lead-ecosystem-contracts` at `761bda6b272cb792899b55ae036a24b59c975466` |
| Hermes | `codex/iverif-live-operator-workflow` | `codex/operator-intake-service-agreement` at `e41065aecaba6291579860a6a49a78d0259fff21` |

Both bases were verified with `git merge-base --is-ancestor`.

## Test Evidence

### Cambium

- TDD red: 273 focused tests ran; five new safety assertions failed for provider-key collision, raw message-reference leakage, and impossible analytics.
- Focused green: 279/279 tests passed across grounding, provider adapter, and HTTP handler.
- Full suite: 833/833 tests passed.
- Standalone publish audit: 377 publishable files passed.
- Standalone smoke: passed, including the copied-repo smoke suite at 830/830.
- Registry validation: passed with four top-level stages, six lead stages, and five resolved organs.
- Product branch packets: 8/8 validated.
- TypeScript module import and `git diff --check`: passed.

### Hermes

- TDD red: strict-origin, redirect refusal, grounding, policy, clipping, hash-reference, no-amplification, cooldown, and default-off registration assertions failed before implementation.
- Focused IVerif suite: 18/18 passed after the final handler-level feature-gate test.
- Full Hermes Node suite: 153/153 passed.
- Full Telegram plugin regression: 49/49 passed.
- Repository `npm test`, local bridge smoke, Python compilation, deploy-script syntax, and `git diff --check`: passed.

Representative status, inbox, thread, and optimize DTOs matching Cambium's closed projections all render through Hermes. Drifted grounding, unsafe policy, raw message identifiers, redirects, invalid origins, and malformed payloads fail closed.

## Vendor Source and Credential Semantics

The implementation was checked against Explee's published [human API documentation](https://api.explee.com/public/api/docs) and [OpenAPI document](https://api.explee.com/public/api/openapi.json). Authentication uses `X-API-Key`. The published contract does not document read-only API-key scopes, so this evidence does not claim one. Method safety is instead enforced by Cambium's isolated, fixed-origin, fixed-path GET-only adapter and the absence of any caller-selected provider route. This provider-scope limitation remains an explicit residual risk for `followup-iverif-live-canary-20260718`: activation must not assume the installed provider key is read-scoped.

## Production Secret-Name Preflight

A production `wrangler secret list --config workers/quests/wrangler.jsonc` was performed by name only. As of this evidence:

| Required name | Production status |
| --- | --- |
| `EXPLEE_API_KEY` | missing |
| `IVERIF_READ_TOKEN` | missing |
| `HERMES_IVERIF_READ_TOKEN` | not probed because the upstream Worker prerequisite already blocks activation |

No secret value was read, printed, copied, or committed. Because the two Worker secrets are missing, no Worker deploy, Explee request, or Telegram canary was attempted. This is the intended fail-closed terminal path, not a successful live-provider claim.

## Parallel Audit Rail

`temperance-parallel-dispatch` was used for two independent validation tasks:

- `explee-scope-audit`
- `hermes-read-boundary-audit`

The external rail launched successfully, but it did not emit the normalized `index.json` / `SUMMARY.md` handoff artifacts needed for trusted synthesis during this execution window. The work therefore failed open to the local test-backed review above and did not block delivery.

## Activation and Rollback

Follow-up `followup-iverif-live-canary-20260718` may proceed only after an operator installs the missing Worker secrets interactively, verifies the Hermes secret name without exposing its value, proves the dedicated read credential differs from every broad bearer, and re-runs all focused gates.

The bounded activation sequence is:

1. deploy the reviewed Cambium commit;
2. call only `/v1/bridge/iverif/status` once;
3. verify exact product/project/campaign grounding and `sendEligible=false`;
4. enable `HERMES_IVERIF_OPERATOR_ENABLED=true`;
5. restart the Hermes gateway and run one allowlisted `/ts-iverif status`;
6. compare the redacted receipt, then stop.

Any authentication, grounding, freshness, schema, policy, or receipt mismatch requires disabling the Hermes flag, restarting the gateway, and restoring the prior known-good Worker deployment and Hermes release. Version identifiers and redacted receipt digests are evidence; provider payloads and credentials are not.
