# IVerif Live Operator Workflow Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect Cambium's fixed-tenant Explee read observer to a hardened Hermes `/ts-iverif` founder workflow while preserving proof-only, no-mutation, one-writer authority.

**Architecture:** Cambium is the only process that holds the Explee API key and calls the fixed project/campaign GET endpoints. Hermes holds only a namespaced read token, accepts exact redacted Cambium DTOs, and renders receipts that disclose safety and completeness. The two changes ship as stacked `codex/*` branches; activation is allowed only after secret-name preflight and a bounded read-only canary.

**Tech Stack:** Cloudflare Workers, TypeScript, Node test runner, Python 3, `unittest`, `aiohttp`, Telegram plugin commands, Wrangler, GitHub stacked pull requests.

---

### Task 1: Establish clean stacked branches and baselines

**Files:**
- Verify: the Cambium `codex/iverif-live-observer-wiring` worktree
- Create worktree: a sibling Hermes `codex/iverif-live-operator-workflow` worktree
- Source commits: Cambium `761bda6`, Hermes `5f75574`, Hermes base `e41065a`

**Step 1: Prove Cambium ancestry and cleanliness**

Run: `git merge-base --is-ancestor origin/codex/lead-ecosystem-contracts HEAD && git status --short --branch`

Expected: exit 0 and no worktree changes other than this plan before its commit.

**Step 2: Rehearse the Hermes integration**

Run: `git merge-tree $(git merge-base codex/operator-intake-service-agreement codex/iverif-ts-commands) codex/operator-intake-service-agreement codex/iverif-ts-commands`

Expected: conflict markers only in the known command registry and test files; no hidden config or deployment conflict.

**Step 3: Create the Hermes stacked worktree**

Run: `git worktree add -b codex/iverif-live-operator-workflow "$HERMES_WORKTREE" codex/operator-intake-service-agreement`

Expected: new clean branch with `codex/operator-intake-service-agreement` as ancestor.

**Step 4: Record baseline tests**

Run Cambium: `node --test workers/quests/src/iverif-grounding.test.ts workers/quests/src/iverif-explee.test.ts workers/quests/src/handler.test.ts`

Run Hermes: `python3 -m unittest ops/hermes/plugins/thoughtseed-telegram/test_ts_commands.py ops/hermes/plugins/thoughtseed-telegram/test_action_callbacks.py`

Expected: both baselines pass before new hardening tests.

### Task 2: Harden Cambium's credential and observation boundary with TDD

**Files:**
- Modify: `workers/quests/src/handler.test.ts`
- Modify: `workers/quests/src/handler.ts`
- Modify: `workers/quests/src/index.ts`
- Modify: `workers/quests/src/iverif-explee.test.ts`
- Modify: `workers/quests/src/iverif-explee.ts`

**Step 1: Write failing collision and message-reference tests**

Add route tests proving the observer is unconfigured when `IVERIF_READ_TOKEN` equals the Explee provider key, and proving a mocked non-hash message identifier projects as `null` rather than leaving the Worker.

**Step 2: Write failing impossible-analytics tests**

Add provider fixture cases for reply rate above 100, replies above sends, hot leads above replies, and pool used above pool total. Each must reject with `upstream_invalid_response`.

**Step 3: Run red tests**

Run: `node --test workers/quests/src/iverif-explee.test.ts workers/quests/src/handler.test.ts`

Expected: failures specifically identify missing semantic validation, provider-key collision detection, and raw message-reference projection.

**Step 4: Implement minimal safety checks**

Pass the provider key to the in-memory handler dependency only for equality checking. Extend the credential collision list. Add semantic analytics validators and a `sha256:[a-f0-9]{64}` projection guard at the handler boundary.

**Step 5: Run green tests**

Run: `node --test workers/quests/src/iverif-grounding.test.ts workers/quests/src/iverif-explee.test.ts workers/quests/src/handler.test.ts`

Expected: all targeted tests pass.

**Step 6: Commit Cambium hardening**

Run: `git add workers/quests/src/handler.test.ts workers/quests/src/handler.ts workers/quests/src/index.ts workers/quests/src/iverif-explee.test.ts workers/quests/src/iverif-explee.ts && git commit -m "fix(iverif): harden live observer boundary"`

### Task 3: Converge the Hermes agreement and IVerif command histories

**Files:**
- Modify: `ops/hermes/plugins/thoughtseed-telegram/__init__.py`
- Modify: `ops/hermes/plugins/thoughtseed-telegram/ts_commands.py`
- Modify: `ops/hermes/plugins/thoughtseed-telegram/test_ts_commands.py`

**Step 1: Cherry-pick the existing command commit**

Run: `git cherry-pick 5f7557401d93e457927eca67709d8c81e17ac936`

Expected: known conflicts in the three shared plugin files.

**Step 2: Resolve by retaining both command families**

Keep agreement default-off configuration, agreement draft/status handlers, IVerif dedicated-token configuration, IVerif formatter/command, both imports, both command registrations, and both help entries exactly once.

**Step 3: Continue and prove convergence**

Run: `git add ops/hermes/plugins/thoughtseed-telegram/__init__.py ops/hermes/plugins/thoughtseed-telegram/ts_commands.py ops/hermes/plugins/thoughtseed-telegram/test_ts_commands.py && git cherry-pick --continue`

Run: `python3 -m unittest ops/hermes/plugins/thoughtseed-telegram/test_ts_commands.py ops/hermes/plugins/thoughtseed-telegram/test_action_callbacks.py`

Expected: agreement and IVerif tests both pass.

### Task 4: Make Hermes receipts exact, non-amplifying, and truthful with TDD

**Files:**
- Modify: `ops/hermes/plugins/thoughtseed-telegram/test_ts_commands.py`
- Modify: `ops/hermes/plugins/thoughtseed-telegram/ts_commands.py`

**Step 1: Write failing origin and redirect tests**

Test rejection of HTTP, userinfo, query, fragment, and non-root-path bridge URLs. Patch the HTTP session and assert `allow_redirects=False` is supplied.

**Step 2: Write failing contract and completeness tests**

Use representative status, inbox, thread, and optimize DTOs containing exact grounding and policy. Assert every receipt includes source, observed time, proof-only state, blocked send, and one-writer reason. Assert inbox/thread disclose provider omission/truncation and receipt clipping, and inbox rows include reusable thread commands.

**Step 3: Write failing drift, logging, and amplification tests**

Remove or mutate grounding, set `sendEligible=true`, change allowed provider methods, remove the conflict reason, and pass a raw message reference. Each formatter call must fail closed and emit only a bounded classification. A retryable Worker failure must result in exactly one HTTP request. Repeating the same command inside a short monotonic-time cooldown must perform zero further requests.

**Step 4: Run red tests**

Run: `python3 -m unittest ops/hermes/plugins/thoughtseed-telegram/test_ts_commands.py -k IVerif`

Expected: failures cover strict origin, safe contract validation, completeness rendering, hash-only message references, and one-request behavior.

**Step 5: Implement minimal formatter and transport hardening**

Validate the URL with `urllib.parse.urlsplit`; prohibit redirects; validate exact IVerif binding and policy before rendering; use a dedicated hash-reference validator; render omission/truncation/clipping; set one command to one Cambium attempt; apply a bounded process-local cooldown to identical reads; preserve explicit no-fallback failure text; log only error classes, never payloads or person references.

**Step 6: Run green tests and commit**

Run: `python3 -m unittest ops/hermes/plugins/thoughtseed-telegram/test_ts_commands.py ops/hermes/plugins/thoughtseed-telegram/test_action_callbacks.py`

Expected: all plugin tests pass.

Run: `git add ops/hermes/plugins/thoughtseed-telegram/ts_commands.py ops/hermes/plugins/thoughtseed-telegram/test_ts_commands.py && git commit -m "fix(iverif): harden founder read receipts"`

### Task 5: Verify cross-repository contract and regressions

**Files:**
- Create: `docs/evidence/2026-07-18-iverif-live-operator-workflow.md` in Cambium
- Modify: `docs/adapters/iverif-explee.md` in Cambium
- Modify: `docs/runbooks/hermes-ec2-runner-bootstrap.md` in Hermes only if secret-name setup is missing

**Step 1: Run Cambium focused and full suites**

Run: `node --test workers/quests/src/iverif-grounding.test.ts workers/quests/src/iverif-explee.test.ts workers/quests/src/handler.test.ts`

Run: `npm test`

Run: `npm run standalone:audit`

Run: `npm run standalone:smoke`

Expected: all four gates pass with zero failures.

**Step 2: Run Hermes focused and full available plugin suites**

Run: `python3 -m unittest ops/hermes/plugins/thoughtseed-telegram/test_ts_commands.py ops/hermes/plugins/thoughtseed-telegram/test_action_callbacks.py`

Expected: all tests pass, including service agreement regression coverage.

**Step 3: Audit exact safety invariants**

Run: `rg -n "session\.(post|put|patch|delete)|providerMutationEnabled: true|sendEligible: true|EXPLEE_API_KEY=.*|IVERIF_READ_TOKEN=.*" workers/quests/src docs`

Expected: no live mutation route, enabled-send state, or committed secret assignment in the delta.

**Step 4: Record evidence and commit documentation**

Document branch ancestry, exact test counts, source URLs, secret-name preflight, activation verdict, and rollback command without recording any secret values or raw provider payload. Document the provider credential honestly: the published OpenAPI defines `X-API-Key` but does not publish read-only key scopes, so method safety is enforced by the isolated adapter surface rather than falsely attributed to a provider-side scope.

### Task 6: Activate only when the secret boundary is complete

**Files:**
- Inspect: `workers/quests/wrangler.jsonc`
- Inspect: Hermes EC2 secret/environment mechanism documented in `docs/runbooks/hermes-ec2-runner-bootstrap.md`
- Record: Cambium evidence document from Task 5

**Step 1: Verify secret presence by name only**

Run: `wrangler secret list --config workers/quests/wrangler.jsonc`

Expected: both `EXPLEE_API_KEY` and `IVERIF_READ_TOKEN` are present before deployment. Do not print values.

**Step 2: Verify Hermes has the matching read-token binding by name only**

Use the existing production secret-management path. Expected: `HERMES_IVERIF_READ_TOKEN` and the pinned Cambium HTTPS origin are configured without shell history or evidence leakage.

**Step 3: Validate authentication and choose the truthful terminal path**

If either secret is absent, do not deploy or call Explee; record `credential-blocked` with the missing names. If both are present, deploy the reviewed Worker version, run one `/status` canary to validate authentication and the fixed project/campaign binding, then run one Telegram `/ts-iverif status`, compare the redacted semantics, and stop. A present-but-invalid or wrong-binding secret fails the canary and triggers rollback.

**Step 4: Roll back on any mismatch**

Use the prior known-good Worker deployment and prior Hermes checkout/service version. Record only version identifiers, health outcomes, and redacted receipt digests.

**Step 5: Publish reviewable branches**

Push `codex/iverif-live-observer-wiring` and `codex/iverif-live-operator-workflow`; open stacked pull requests against `codex/lead-ecosystem-contracts` and `codex/operator-intake-service-agreement` respectively.

Merge order is base-first within each repository: Cambium PR #256 before the live-observer PR; Hermes agreement PR before the live-operator PR. Do not force-push a reviewed base. If either base advances, rebase the child, re-prove ancestry, and rerun every focused/full gate before merge.
