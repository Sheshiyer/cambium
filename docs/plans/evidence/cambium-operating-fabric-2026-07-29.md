# Cambium Operating Fabric Promotion Evidence — 2026-07-29

Lifecycle: local pre-deployment evidence packet. This document proves only
that the candidate SHA passes the deterministic local gate on this machine.
It is NOT founder-device proof and NOT a promotion approval. Sections 8–11
remain gated on separate, explicit founder approvals as described below.

Source: [Task 13 and Task 14](../2026-07-28-cambium-operating-fabric-implementation-plan.md)
of the Cambium operating-fabric implementation plan. Contract references:
[`cambium-operating-fabric.md`](../../architecture/cambium-operating-fabric.md),
[`mission-fabric-v1.md`](../../architecture/contracts/mission-fabric-v1.md),
[`branch-mission-fabric-contract.md`](../../architecture/contracts/branch-mission-fabric-contract.md),
[`operating-fabric-visual-budget.md`](../../architecture/contracts/operating-fabric-visual-budget.md).

Generated at (UTC): 2026-07-28T22:04:13Z

## Redaction invariants

- No raw Telegram `initData`, bot token, provider credential, private prompt
  body, or founder/user real identifier appears anywhere in this document.
- All identifiers below are synthetic test-fixture literals defined in
  `workers/quests/src/mission-fabric-integration.test.ts`, not live data.
- Only digests, counts, statuses, and synthetic identifiers are recorded as
  proof.

## 0. Candidate identification

- Candidate git SHA: `c849123dd1ce436d2209e32e692ad725c2b958a7`
- Branch: `codex/cambium-operating-fabric`
- Plan reference: `docs/plans/2026-07-28-cambium-operating-fabric-implementation-plan.md`
- Evidence author: OmniRoute non-Codex implementation subagent (local, non-interactive)
- Evidence date: 2026-07-29
- Tenant under proof: `cambium-synthetic` (synthetic-only, no real tenant)
- Canonical PAGE source digest (controller-supplied, render-docs check scope): `6941858d52cf979e373f15b6b5c4949bfb160597e9e10e887c695d305399d632`

## 1. Deterministic local gate (Task 13)

Results as supplied by the controller for the current head of this branch
(candidate SHA above). Full stdout not pasted; summary lines only.

| Command | Expected | Result | Summary |
| --- | --- | --- | --- |
| `npm test` | exit 0 | PASS | 1465 passed, 0 failed |
| `npm run render-docs:check` | exit 0 | PASS | 6 pages / 91 components, clean |
| `npm run drift:audit` | exit 0 | PASS | clean |
| `npm run audit:text-density` | exit 0 | PASS | clean, with one documented ratified pre-existing mission/empty override (not introduced by this candidate) |
| `npm run proof:tg-mobile-contract` | exit 0 | PASS | 320/390/430px checked, 15 proofs, 9 operating-fabric interactions |
| `npm run standalone:audit` | exit 0 | PASS | 585 publishable files |
| `npm run standalone:smoke` | exit 0 | PASS | smoke PASS |
| `npm run verify:release` | exit 0 | PASS | includes mobile proof, R3F build, and Electron packaging |
| `node --test workers/quests/src/mission-fabric-integration.test.ts workers/quests/src/live-proof-readiness.test.ts` | exit 0 | PASS | 37 passed, 0 failed |
| R3F suite | exit 0 | PASS | 99 passed, 0 failed |

All rows are PASS on the candidate SHA. None waived or averaged.

## 2. Proof-chain trace (mission-fabric-integration.test.ts)

Synthetic identifiers as defined directly in the test fixtures
(`goalGraphFixture`, `questFacts`, `questEnvelope`, `fabricDeps`):

- Company program packet ID: `cambium-operating-fabric` (also present: private client program `acme-client-program`, redaction-only fixture)
- Sapling/branch story ID: `branch-cambium`
- Goal Graph mission ID (canonical externalId of the macro node): `mission-fabric-foundation`
- Goal Graph task ID (canonical externalId of the meso node): `task-fabric-contract`
- Fenced run ID + fence/generation: `run-fabric-current` / fence `7` (matches authoritative Goal Graph `graphVersion: 7`)
- Durable receipt ID + status: `receipt-fabric-contract` / `verified` (branch-map receipt store); served run status is `complete` in the projection (run fence 7 matched authoritative fence 7)
- Mission Fabric projection `graphVersion`: `7` (asserted equal to `projection.graphVersion` in `runInspectHtml` match, sourced from Goal Graph head `graphVersion: 7`)
- Mission Fabric projection `graphDigest`: not a fixed literal — the test asserts the relation `projection.graphDigest === projectionDigest(projection)` and the shape `/^sha256:[0-9a-f]{64}$/`, and asserts it is not the all-zero digest. No concrete digest value is a stable literal in the fixture (recomputed per run); recording the relation instead of inventing a value.
- Authenticated route path exercised: `/v1/mission-fabric/cambium-synthetic`
- Route response status: `200` (authorized founder/allowlisted viewer); also exercised and asserted: `401` (no/invalid auth, non-founder without viewer allowlist), `403` (allowlist-off, foreign tenant), `400` (malformed/traversal tenant path), `405` (POST/PUT/PATCH/DELETE)
- Scene node rendered (Canopy): work nodes rendered with `data-work-id="branch-cambium"`, `data-work-id="cambium-operating-fabric"`, `data-work-id="acme-client-program"`
- Contextual Inspect sheet fields observed: `sourceOfTruth`, `graphVersion`, `asOf` — present (asserted via regex match against the rendered Inspect HTML for node `run-fabric-current`); `graphDigest` — intentionally absent from the Inspect sheet by design (test asserts `runInspectHtml` does NOT contain the projection's `graphDigest`; digest is instead verified against the projection/ETag directly, not via the Inspect sheet)

## 3. Stable digest across delivery timestamps and freshness

From `mission-fabric-integration.test.ts::graphDigest stays stable across servedAt and stale/fresh freshness changes for unchanged frozen content`:

- First request `servedAt` vs second request `servedAt`: asserted **not equal** (`assert.notEqual(first.json.delivery.servedAt, second.json.delivery.servedAt)`) — concrete timestamp values are runtime-generated, not fixture literals, so only the relation is recorded.
- `graphDigest` request 1 vs request 2: asserted **equal** (`assert.equal(first.json.projection.graphDigest, second.json.projection.graphDigest)`)
- Stale-freshness request `delivery.freshness`: asserted equal to the literal `'stale'` (fixture uses `derivedAt: '2026-01-01T00:00:00.000Z'` to force this)
- `graphDigest` under stale freshness vs fresh: asserted **equal** to the fresh-request digest (`assert.equal(stale.json.projection.graphDigest, fresh.json.projection.graphDigest)`)
- Confirms digest excludes `generatedAt`/`servedAt`/derived freshness: **YES** — test additionally asserts `!JSON.stringify(first.json.projection).includes('servedAt')`, and separately asserts the digest matches `/^sha256:[0-9a-f]{64}$/` and is not the all-zero digest `sha256:` + 64 zeros.

## 4. Zero-gap shadow parity

From `mission-fabric-integration.test.ts::zero-gap shadow parity for the pilot fixture` (request `?shadow=1`):

- `shadow.branchFacts`: `2`
- `shadow.representedFacts`: `2` — equal to `branchFacts`
- `shadow.missingIds`: `[]`
- `shadow.unexpectedIds`: `[]`
- `promotionBlocked` value: `false` (test asserts this is explicitly `false`, not undefined/absent, on zero-gap parity)

## 5. Zero D1/KV writes

- D1 write count across full chain (including shadow diagnostics and repeated reads): `0` — asserted in every request path (`spies.d1Writes === 0`) across the full-chain test, the shadow-parity test, and the dedicated "zero D1/KV writes hold even under shadow diagnostics and repeated reads" test (both a `?shadow=1` call and a plain call independently asserted at `0`). The store's `commit()` method is additionally wired to throw if ever invoked ("mission fabric must never write Goal Graph").
- KV write count across full chain: `0` — asserted identically (`spies.kvWrites === 0`); the KV `put()` method is wired to throw if ever invoked ("mission fabric must never write KV").
- Read-only projection confirmed for: Goal Graph head + nodes (`goalGraphStore.readHead`/`readNodes`), branch-map receipts (`branchMapReceiptStore.listReceipts`), and the quest ledger envelope (`kv.get`) — all exercised as reads only across every test in the file, including the shadow-diagnostics and repeated-read paths.

## 6. Allowlist, auth, and tenant fail-closed checks

| Check | Expected | Result |
| --- | --- | --- |
| `MISSION_FABRIC_TENANTS` allowlist empty → route closed | closed (403, `error: 'mission fabric tenant is not enabled'`) | PASS — `allowlist-off closes the route and never activates the operating-fabric bundle` |
| Allowlist-off → zero D1 reads, zero KV reads | 0 / 0 | PASS — same test asserts `spies.d1Reads === 0` and `spies.kvReads === 0` |
| Invalid/forged Telegram auth → bundle never activates, regardless of allowlist | closed (401 for empty initData and garbage initData) | PASS — `invalid auth never activates the bundle regardless of allowlist state` |
| Non-founder viewer without fail-closed viewer allowlist → rejected before any authority read | 401, zero D1/KV reads | PASS — `non-founder viewer without the fail-closed viewer allowlist is rejected before any authority read` (also covers empty viewer allowlist defaulting to founders-only) |
| Non-founder viewer WITH valid viewer allowlist entry → redacted (not removed) projection | 200, redacted fields, distinct digest from founder | PASS — `non-founder viewer receives real redaction with a valid signed initData proof`: private client label → `[private client]`, `desiredState`/`outcomeMetric` blanked, receipt `evidenceRefs` stripped to `[]`, `outputDigest` → `null`, skill-cluster `sourceRef` → `redacted:cluster:cluster-fabric`; redacted digest is a distinct valid sha256 that recomputes and is stable across repeated requests |
| Tenant/route boundary fail-closed: malformed tenant, path traversal, foreign tenant | 400 / 400 / 403, zero D1/KV reads on rejection | PASS — `route/tenant boundaries stay fail-closed` |
| Mutating HTTP methods (POST/PUT/PATCH/DELETE) rejected before any authority read | 405, zero D1/KV reads | PASS — `mutating methods are rejected before any authority read` |

Note: the template's "Non-allowlisted tenant with valid auth → legacy behavior"
row is not directly exercised by this test file as a distinct legacy-UI
assertion; the closest proven equivalents are the allowlist-off (403,
zero reads) and foreign-tenant (403, zero reads) checks above, both PASS.

## 7. Task 12 mobile/accessibility proof (carried forward)

Reference: `npm run proof:tg-mobile-contract` output (controller-verified:
PASS at 320/390/430 with 15 proofs and 9 operating-fabric interactions) and
[`operating-fabric-visual-budget.md`](../../architecture/contracts/operating-fabric-visual-budget.md).

| Width | No horizontal overflow | Sheet close/back visible | 44px targets | Focus + tab order | Reduced motion honored |
| --- | --- | --- | --- | --- | --- |
| 320px | PASS | PASS | PASS | PASS | PASS |
| 390px | PASS | PASS | PASS | PASS | PASS |
| 430px | PASS | PASS | PASS | PASS | PASS |

- Text density audit for all five scenes + both sheets: clean, with one
  documented ratified pre-existing mission/empty override (per controller-
  supplied verification; not introduced by this candidate)
- Graph linear fallback present: statically guaranteed by `renderFlow`'s
  unconditional `<ol data-of-flow-fallback="linear">` emission in `flow.ts`;
  Flow tab/panel visibility is browser-exercised by
  `proof:tg-mobile-contract`, but no browser assertion directly inspects the
  linear-list DOM/content
- Loading/empty/stale/unauthorized/error states rendered safely: YES
  (unauthorized/error states directly exercised in Section 6 above; stale
  freshness exercised in Section 3 above)

## 8. Real Telegram device proof (Task 14 — approval-gated)

**NOT PERFORMED.**

- Founder device capture: NOT PERFORMED. Requires explicit founder approval
  (approver name, approval timestamp, and approval scope: staging capture
  only vs. staging capture + pilot promotion) recorded BEFORE any device
  capture begins, and a real Telegram staging deploy, which this local
  evidence-only run does not include.
- No allowlist activation, staging deploy, or device session has occurred
  as part of producing this document.
- Required next evidence: founder approval record (name, timestamp, scope)
  → staging deploy → device capture on 320px-class and 390px-class real
  Telegram clients covering all items listed in the proof template Section 8
  (five scenes, one sapling, one company program, one Task→Run→Receipt
  trace, one agent/skill assignment, one missing-data gap, one Gate
  proposal, one rejected replay/stale-fence attempt, reduced-motion
  confirmation, zero-gap shadow comparison) → two independently signed
  acceptance gates (founder-device read proof; signed Gate proof).

## 9. Tenant promotion record (approval-gated)

**NOT PERFORMED.** Requires both Section 8 gates signed plus a separate,
explicit founder promotion approval (approver name and timestamp) before
`MISSION_FABRIC_TENANTS` is modified for any pilot tenant. No allowlist
change has been made as part of producing this document.

Required next evidence: signed Section 8 gates → founder promotion approval
record → pilot tenant added to `MISSION_FABRIC_TENANTS` → post-promotion
re-run of `standalone:smoke`, `proof:tg-mobile-contract`, `verify:release` →
confirmation that non-allowlisted tenants remain on legacy behavior.

## 10. Rollback rehearsal (approval-gated)

**NOT PERFORMED.** No rehearsal has been run; no pilot tenant has been added
to or removed from `MISSION_FABRIC_TENANTS`.

Required next evidence: under founder supervision, remove pilot tenant from
`MISSION_FABRIC_TENANTS` → confirm legacy five-scene page active → confirm
mission-fabric route closed → confirm no data/schema operation was required
→ confirm Signed Gate and existing quest routes remain healthy → re-add
pilot tenant only after rehearsal pass + founder confirmation.

## 11. Reviewer and founder sign-off

| Role | Name | Scope reviewed | Verdict | Date |
| --- | --- | --- | --- | --- |
| Reviewer (independent OmniRoute review) | OmniRoute reviewer session 7d6b367f-204a-44ce-8efd-2f88c4daef34 | Sections 1–7 (local, pre-deploy) | ACCEPT — no high/medium findings after corrections; supersedes correction-request session 865ae780-68b6-4fa1-97bf-9b9faeccd275 | 2026-07-29 |
| Founder | NOT PERFORMED | Section 8 (device read proof) | APPROVAL REQUIRED | — |
| Founder | NOT PERFORMED | Section 8 (signed Gate proof) | APPROVAL REQUIRED | — |
| Founder | NOT PERFORMED | Section 9 (tenant promotion) | NOT REQUESTED | — |

Code availability alone is not promotion. Sections 9 and 10 remain
`NOT PERFORMED` until every prior gate above is signed `ACCEPT`. This
document establishes local release readiness only; it does not authorize
staging deploy, allowlist changes, or any founder-device or promotion
action.
