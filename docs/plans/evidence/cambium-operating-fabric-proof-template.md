# Cambium Operating Fabric Promotion Evidence — Template

Lifecycle: historical/template; non-operational. Copy this file to
`docs/plans/evidence/cambium-operating-fabric-<date>.md`, fill every slot with
real values, and delete any slot that does not apply. Do not treat a copy of
this file with slots left unfilled as evidence.

Source: [Task 13 and Task 14](../2026-07-28-cambium-operating-fabric-implementation-plan.md)
of the Cambium operating-fabric implementation plan. Contract references:
[`cambium-operating-fabric.md`](../../architecture/cambium-operating-fabric.md),
[`mission-fabric-v1.md`](../../architecture/contracts/mission-fabric-v1.md),
[`branch-mission-fabric-contract.md`](../../architecture/contracts/branch-mission-fabric-contract.md),
[`operating-fabric-visual-budget.md`](../../architecture/contracts/operating-fabric-visual-budget.md).

## Redaction invariants

- No raw Telegram `initData`, bot token, provider credential, private prompt
  body, or founder/user real identifier appears anywhere in this document.
- Telegram-shaped fields (`user`, `auth_date`, `hash`, `signature`, `query_id`)
  must be replaced with `[REDACTED]` or a synthetic placeholder, never a real
  captured value.
- Only digests, counts, statuses, and redacted/synthetic identifiers are
  recorded as proof. A screenshot or command transcript that would expose a
  live secret must not be attached; describe it in words instead.

## 0. Candidate identification

- Candidate git SHA: `[SHA]`
- Branch: `[BRANCH]`
- Plan reference: `docs/plans/2026-07-28-cambium-operating-fabric-implementation-plan.md`
- Evidence author: `[NAME/ROLE]`
- Evidence date: `[YYYY-MM-DD]`
- Tenant under proof: `[TENANT-ID or "synthetic-only"]`

## 1. Deterministic local gate (Task 13)

Run the complete gate on the candidate SHA and record exit status and counts
for each command. Do not paste full stdout; record pass/fail and the summary
line only.

| Command | Expected | Result | Summary |
| --- | --- | --- | --- |
| `npm test` | exit 0 | `[PASS/FAIL]` | `[N passed, N failed]` |
| `npm run render-docs:check` | exit 0 | `[PASS/FAIL]` | `[clean/drift]` |
| `npm run drift:audit` | exit 0 | `[PASS/FAIL]` | `[clean/drift-count]` |
| `npm run audit:text-density` | exit 0 | `[PASS/FAIL]` | `[clean/violations]` |
| `npm run proof:tg-mobile-contract` | exit 0 | `[PASS/FAIL]` | `[widths checked]` |
| `npm run standalone:audit` | exit 0 | `[PASS/FAIL]` | `[summary]` |
| `npm run standalone:smoke` | exit 0 | `[PASS/FAIL]` | `[summary]` |
| `npm run verify:release` | exit 0 | `[PASS/FAIL]` | `[summary]` |
| `node --test workers/quests/src/mission-fabric-integration.test.ts` | exit 0 | `[PASS/FAIL]` | `[N passed, N failed]` |

All rows must be `PASS` before Task 14 proceeds. A single `FAIL` blocks
promotion; do not average or waive a failing row.

## 2. Proof-chain trace (mission-fabric-integration.test.ts)

Record the redacted identifiers actually produced by the fixture chain, not
the schema shape. Use `[REDACTED]` where a real run would carry a live value.

- Company program packet ID: `[program-id]`
- Sapling/branch story ID: `[branch-id]`
- Goal Graph mission ID: `[mission-id]`
- Goal Graph task ID: `[task-id]`
- Fenced run ID + fence/generation: `[run-id] / fence [N]`
- Durable receipt ID + status: `[receipt-id] / [complete|failed|reconciliation-required]`
- Mission Fabric projection `graphVersion`: `[N]`
- Mission Fabric projection `graphDigest` (redacted/truncated form, e.g.
  `sha256:ab12…`): `[digest-prefix]`
- Authenticated route path exercised: `/v1/mission-fabric/[tenant]`
- Route response status: `[200/401/403/…]`
- Scene node rendered (Canopy or other): `[node-kind]: [redacted-id]`
- Contextual Inspect sheet fields observed: `sourceOfTruth`, `graphVersion`,
  `graphDigest`, `asOf`, gaps — `[present/absent]`

## 3. Stable digest across delivery timestamps and freshness

From `mission-fabric-integration.test.ts::graphDigest stays stable...`:

- First request `servedAt`: `[timestamp-1]`
- Second request `servedAt`: `[timestamp-2]` (must differ from the first)
- `graphDigest` request 1: `[digest]`
- `graphDigest` request 2: `[digest]` — must equal request 1
- Stale-freshness request `delivery.freshness`: `[stale]`
- `graphDigest` under stale freshness: `[digest]` — must equal request 1
- Confirms digest excludes `generatedAt`/`servedAt`/derived freshness: `[YES/NO]`

## 4. Zero-gap shadow parity

From `mission-fabric-integration.test.ts::zero-gap shadow parity`:

- `shadow.branchFacts`: `[N]`
- `shadow.representedFacts`: `[N]` — must equal `branchFacts`
- `shadow.missingIds`: `[[] expected]`
- `shadow.unexpectedIds`: `[[] expected]`
- `promotionBlocked` value: `[should be false on zero-gap; production intentionally returns false, not undefined/absent]`

## 5. Zero D1/KV writes

- D1 write count across full chain (including shadow diagnostics and repeated
  reads): `[N]` — must be `0`
- KV write count across full chain: `[N]` — must be `0`
- Read-only projection confirmed for: `[list of endpoints/queries exercised]`

## 6. Allowlist, auth, and tenant fail-closed checks

| Check | Expected | Result |
| --- | --- | --- |
| `MISSION_FABRIC_TENANTS` allowlist empty → route closed, legacy UI served | closed / legacy | `[PASS/FAIL]` |
| Allowlist-off → zero D1 reads, zero KV reads | 0 / 0 | `[PASS/FAIL]` |
| Invalid/forged Telegram auth → bundle never activates, regardless of allowlist | closed | `[PASS/FAIL]` |
| Tenant scoping → request for tenant B never returns tenant A projection | scoped | `[PASS/FAIL]` |
| Non-allowlisted tenant with valid auth → legacy behavior | legacy | `[PASS/FAIL]` |

## 7. Task 12 mobile/accessibility proof (carried forward)

Reference: `npm run proof:tg-mobile-contract` output and
[`operating-fabric-visual-budget.md`](../../architecture/contracts/operating-fabric-visual-budget.md).

| Width | No horizontal overflow | Sheet close/back visible | 44px targets | Focus + tab order | Reduced motion honored |
| --- | --- | --- | --- | --- | --- |
| 320px | `[PASS/FAIL]` | `[PASS/FAIL]` | `[PASS/FAIL]` | `[PASS/FAIL]` | `[PASS/FAIL]` |
| 390px | `[PASS/FAIL]` | `[PASS/FAIL]` | `[PASS/FAIL]` | `[PASS/FAIL]` | `[PASS/FAIL]` |
| 430px | `[PASS/FAIL]` | `[PASS/FAIL]` | `[PASS/FAIL]` | `[PASS/FAIL]` | `[PASS/FAIL]` |

- Text density audit for all five scenes + both sheets: `[clean/violations]`
- Graph linear fallback present: `[YES/NO]`
- Loading/empty/stale/unauthorized/error states rendered safely: `[YES/NO]`

## 8. Real Telegram device proof (Task 14 — approval-gated)

> **DEPLOYMENT AND ALLOWLIST ACTIVATION: NOT PERFORMED.**
> Everything in this section requires explicit founder approval before any
> staging deploy, allowlist change, or tenant promotion. Completing Sections
> 1–7 above does NOT constitute this approval. Do not fill this section from a
> local or synthetic run — it is device-only evidence.

Founder approval recorded before device capture:

- Approver: `[NAME]`
- Approval date/time: `[timestamp]`
- Approval scope: `[staging capture only | staging capture + pilot promotion]`

Device capture (320px-class and 390px-class real Telegram client):

- Device/platform: `[e.g., iOS Telegram x.y / Android Telegram x.y]`
- Authenticated route status + digest prefix observed: `[status] / [digest-prefix]`
- All five scenes visited: `[YES/NO]` — `Canopy / Mission / Flow / Workforce / Forge`
- One sapling shown: `[redacted-id]`
- One company program shown: `[redacted-id]`
- One Task → Run → Receipt trace shown: `[task-id] → [run-id] → [receipt-id]`
- One agent/skill assignment shown: `[agent-id] ↔ [cluster-id]`
- One missing-data gap shown: `[gap description, no secret content]`
- One valid contextual Gate proposal shown (preflight/consequence/reversibility,
  not submitted unless separately approved): `[YES/NO]`
- One rejected replay or stale-fence attempt shown: `[YES/NO]` — `[409 stale_fence / replay rejected]`
- Reduced-motion behavior confirmed on device: `[YES/NO]`
- Zero-gap shadow comparison confirmed on device: `[YES/NO]`

Two independent acceptance gates (neither substitutes for the other):

- [ ] Founder-device read proof accepted — signed by: `[NAME]`, date: `[date]`
- [ ] Signed Gate proof accepted — signed by: `[NAME]`, date: `[date]`

## 9. Tenant promotion record (approval-gated, NOT PERFORMED until sign-off)

> **NOT PERFORMED.** Fill only after both Section 8 gates are signed and a
> separate founder promotion approval is recorded.

- Promotion approver: `[NAME]`
- Promotion approval date/time: `[timestamp]`
- Pilot tenant added to `MISSION_FABRIC_TENANTS`: `[tenant-id]`
- Post-promotion re-run results:
  - `npm run standalone:smoke`: `[PASS/FAIL]`
  - `npm run proof:tg-mobile-contract`: `[PASS/FAIL]`
  - `npm run verify:release`: `[PASS/FAIL]`
- Non-allowlisted tenant confirmed on legacy behavior: `[YES/NO]`

## 10. Rollback rehearsal (approval-gated, NOT PERFORMED until sign-off)

> **NOT PERFORMED.** Fill only after a rehearsal is actually run under
> founder supervision.

- Pilot tenant removed from `MISSION_FABRIC_TENANTS`: `[YES/NO]`
- Legacy five-scene page active post-rollback: `[YES/NO]`
- Mission-fabric route closed post-rollback: `[YES/NO]`
- No data or schema operation required: `[YES/NO]`
- Signed Gate and existing quest routes remain healthy: `[YES/NO]`
- Pilot re-added only after rehearsal pass + founder confirmation: `[YES/NO/N-A]`

## 11. Reviewer and founder sign-off

| Role | Name | Scope reviewed | Verdict | Date |
| --- | --- | --- | --- | --- |
| Reviewer | `[NAME]` | Sections 1–7 (local, pre-deploy) | `[ACCEPT/REJECT]` | `[date]` |
| Founder | `[NAME]` | Section 8 (device read proof) | `[ACCEPT/REJECT]` | `[date]` |
| Founder | `[NAME]` | Section 8 (signed Gate proof) | `[ACCEPT/REJECT]` | `[date]` |
| Founder | `[NAME]` | Section 9 (tenant promotion) | `[ACCEPT/REJECT/NOT REQUESTED]` | `[date]` |

Code availability alone is not promotion. Sections 9 and 10 remain
`NOT PERFORMED` until every prior gate above is signed `ACCEPT`.
