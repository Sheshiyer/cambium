# Thoughtseed Lead Ecosystem Contract Foundation Implementation Plan

> **For Codex:** Execute this plan test-first, preserve the dirty root byte-for-byte, and stop before provider calls, credentials, deployments, or outbound mutations.

**Goal:** Land the L-1/L0 foundation that makes the reviewed Thoughtseed lead ecosystem machine-checkable and reviewable without activating a vendor.

**Architecture:** Keep `genesis -> taste -> build -> ops` as the only top-level pipeline. Add a versioned DAG contract beneath `ops`, a versioned lead/provider lifecycle catalog, optional product-packet bindings, and fail-closed spend vocabulary. Cambium owns task/lease/fencing/approval/receipt authority; Hermes remains default-off intake; provider and capability planes remain non-authoritative.

**Tech stack:** Zero-dependency Node ESM, Node test runner, JSON contracts, Markdown product packets, TypeScript/D1 SQL parity tests, Git worktrees, GitHub pull requests.

## Commitment-boundary clarifications

- DAG validation is automated and blocking: production `compose validate` resolves the file and runs the same pure semantic validator exercised by negative fixtures. No manual sign-off substitutes for it.
- Each lead node declares entry contracts, exit contracts, owner, eligibility gate, failure policy, and terminal reachability; those fields are validated before handoff.
- Migration parity means normalized `bridge_business_tasks` table and index definitions in migration `0004` must equal the canonical definitions in `workers/quests/schema/bridge.sql`, including CHECK and UNIQUE clauses.
- `subscription` and `metered` rejection creates no queue row, retry, runner call, or rollback obligation because execution never starts. The gate returns a structured refusal naming the missing reservation/usage ledger prerequisite.
- Provider integration proof in L0 is an offline deterministic conformance fixture with an injected network sentinel. Live routing is deliberately deferred to the named L1 slice.
- Pull requests are review surfaces, not a claim of approval. This tranche records CI/review state and stops before merge; no approval count is used as a substitute for tests.

---

## Task 1: Make the lead subgraph part of production composition validation

**Files:**

- Modify: `composition/pipeline.json`
- Create: `composition/lead-ops.v1.json`
- Create: `bin/lib/lead-ops.mjs`
- Create: `bin/lead-ops.test.mjs`
- Modify: `bin/compose.mjs`
- Modify: `bin/compose.test.mjs`

**Steps:**

1. Add failing tests that require the production loader to resolve the referenced subgraph and reject a missing file.
2. Add semantic graph fixtures/tests for exact stages, cycles, dangling/unreachable nodes, illegal order, duplicate ownership, unsatisfied joins, missing terminal paths, unknown contract versions, and absent entry/exit eligibility gates.
3. Run `node --test bin/lead-ops.test.mjs bin/compose.test.mjs` and record the expected failures.
4. Add one `ops` subgraph reference to `pipeline.json` and implement the pure graph validator plus production file resolution.
5. Define `discover,capture,enrich,understand,create,engage`, authority primitives, typed ports, fan-out/join/partial-failure/reconciliation semantics, and derived-only learning foldback.
6. Re-run the targeted tests until green.

## Task 2: Add lead lifecycle and provider contract catalogs

**Files:**

- Create: `composition/contracts/lead-ecosystem.v1.json`
- Create: `bin/lib/lead-contracts.mjs`
- Create: `bin/lead-contracts.test.mjs`
- Create: `bin/provider-conformance.test.mjs`
- Create: `examples/provider-conformance/synthetic-observation.json`
- Modify: `composition/CONTRACTS.md`

**Steps:**

1. Add failing tests for unique versioned contract IDs, bounded tenant envelopes, local references, closed shapes, and every required lifecycle record.
2. Add negative fixtures in tests for recursive inline secrets, caller-owned tenant/account/campaign overrides, raw-identity learning, unsafe provider targets, mutation-default widening, bad approval digests, and missing permission/data policy.
3. Add an executable offline provider-conformance test that validates a deterministic synthetic observation while an injected network sentinel throws on every attempted call.
4. Run `node --test bin/lead-contracts.test.mjs bin/provider-conformance.test.mjs` and observe failures before production code exists.
5. Implement a zero-dependency catalog validator and semantic fixture validator.
6. Define `lead_record`, `provider_observation`, `source_alias`, `identity_resolution`, `suppression_state`, `icp_score`, `signal_batch`, `content_asset`, `action_request`, `approval_decision`, `execution_attempt`, `outcome_event`, `reconciliation`, `compensation`, `operator_receipt`, `provider_binding`, `provider_contract`, `provider_permission`, `writer_lease`, and `derived_learning`.
7. Document ownership, tenant isolation, exact-action approval, continuous identity resolution, suppression dominance, provider observation/mutation separation, and cortex foldback.
8. Re-run targeted tests until green.

## Task 3: Extend spend vocabulary without granting runtime authority

**Files:**

- Create: `bin/lib/spend-policy.mjs`
- Create: `bin/spend-policy.test.mjs`
- Modify: `bin/lib/invoke.mjs`
- Modify: `bin/invoke.test.mjs`

**Steps:**

1. Add failing tests for the exact `none,subscription,metered,gated` schema vocabulary.
2. Add negative tests for unknown tiers, malformed windows/limits, `none` plus provider I/O, and execution attempts for subscription/metered without reservation/usage ledgers; assert zero queue, retry, runner, or rollback side effects.
3. Preserve existing `none` and exact-organ `gated` behavior for local process adapters.
4. Implement validation and normalize legacy scalar adapter values.
5. Keep subscription and metered runtime-refused with an explicit ledger prerequisite.
6. Run `node --test bin/spend-policy.test.mjs bin/invoke.test.mjs` until green.

## Task 4: Extend packet policy compatibly and add three proof-only branches

**Files:**

- Modify: `docs/plans/product-branches/schema.json`
- Modify: `scripts/validate-product-branch-packets.mjs`
- Modify: `scripts/validate-product-branch-packets.test.mjs`
- Modify: `docs/plans/product-branches/index.md`
- Create: `docs/plans/product-branches/iberev.md`
- Create: `docs/plans/product-branches/aiseo.md`
- Create: `docs/plans/product-branches/geo.md`

**Steps:**

1. Add failing packet tests for an optional `Provider / Data Policy` table, catalog/version references, proof-only mutation rejection, zero-authority defaults, duplicate IDs/paths, and caller override fields.
2. Preserve all existing positive and negative packet regression tests.
3. Implement optional table validation: `subgraph_version`, `stage_capabilities`, `provider_binding`, `adapter_version`, `mutation_enabled`, `data_classification`, `processing_region`, `purpose`, `retention`, and `suppression_policy`.
4. Add distinct iBerev, AISEO, and GEO packets in `proof-only`, each with no active provider binding and mutation disabled.
5. Run `node --test scripts/validate-product-branch-packets.test.mjs` and `npm run validate:product-branches` until all eight packets pass: existing `fitcheck`, `vantyx`, `snow-gloves-os`, `iverif`, `client-delivery`, plus new `iberev`, `aiseo`, and `geo`.

## Task 5: Add migration 0004 parity coverage

**Files:**

- Modify: `workers/quests/src/migration.test.ts`
- Verify (modify only if parity exposes drift): `workers/quests/schema/bridge.sql`

**Steps:**

1. Confirm the agreement baseline already contains `bridge_business_tasks` and both indexes in canonical `schema/bridge.sql`; fail before Build if they are absent.
2. Add a failing parity test that extracts the `bridge_business_tasks` table and both indexes from `0004_business_artifacts.sql` and canonical `schema/bridge.sql`.
3. Normalize whitespace without weakening CHECK, UNIQUE, or index semantics.
4. Run `node --test workers/quests/src/migration.test.ts` and confirm parity passes only when definitions match.

## Task 6: Record baseline provenance, integration compatibility, and L1 handoff

**Files:**

- Create: `docs/evidence/2026-07-18-lead-ecosystem-baseline.json`
- Create: `docs/architecture/lead-ecosystem-contract-foundation.md`
- Modify: `docs/superpowers/plans/2026-07-18-lead-ecosystem-contract-foundation.md`

**Steps:**

1. Record exact Cambium agreement, Hermes agreement, IVerif observer, and lead branch commits plus branch/PR identities.
2. Validate recorded commit objects locally and compare PR head SHAs after publication.
3. Rehearse integration among agreement, lead, and observer tips in a disposable worktree or via `git merge-tree`; record conflicts or resolved compatibility truthfully.
4. Name the next authorized L1 slice: one fixed-tenant, read-only Explee observation adapter with typed endpoints, caller-override rejection, offline fixtures, redaction, and no mutation/spend execution.
5. Document that agency-agents and marketingskills are curated/version-pinned conductor capabilities and that marketing loops compile into scheduled Cambium tasks rather than a second scheduler.

## Task 7: Verify, commit, publish, and request review

**Files:** all changed files above; no dirty-root files.

**Steps:**

1. Run targeted suites for graph, contracts, spend, packets, and migration.
2. Run `npm run validate`, `npm run validate:product-branches`, and full `npm test`.
3. Audit the diff for secrets, provider hostnames in runtime code, `fetch`/SDK provider calls, executable provider adapters, Wrangler/deploy/cron/env mutations, and unexpected files.
4. Recompute the original dirty-root tracked/staged/status/untracked hashes and require exact equality.
5. Run Hermes JavaScript and Telegram plugin suites; reassert the operator feature defaults off.
6. Commit only the isolated worktree changes.
7. Push the Cambium and Hermes agreement branches and create reviewable PRs to `main` if absent.
8. Push `codex/lead-ecosystem-contracts` and create its PR against `codex/operator-intake-service-agreement` while that prerequisite remains unmerged.
9. Do not merge or deploy.
