# Portfolio Hosted Admin Actions Implementation

> Execute only inside the reviewed Cambium repository branch. Production
> promotion remains a separate owner-reviewed task.

**Goal:** make repository intake and Project ingestion durable, authenticated,
idempotent, and ready for the next governed flow without introducing a second
operational writer.

> **Founder Gate refinement (2026-08-07):** Tasks 1–4 below record the first
> hosted-action implementation. The active Workbench subsequently retired
> Tryambakam UI/actions and superseded `start-project-ingestion` with the
> Thoughtseed-only `create-thoughtseed-project` contract documented in
> `2026-08-07-thoughtseed-governed-project-birth-implementation.md`.

## Task 1: Freeze the action contract

- Add focused tests for Thoughtseed reconciliation and Tryambakam Project
  ingestion.
- Require closed fields, bounded text, exact shipped digests,
  grammar/portfolio pairing, shipped WorkObject identity, reviewed shallow
  Project identity/path/status, and deterministic receipts.
- Prove malformed input performs no R2 or queue write.

**Execution:** complete. Eight focused action/store tests pass, including
server-side stale/invented digest, WorkObject, Project, nested-path, and status
rejection before any durable write.

## Task 2: Record evidence before triggering flow

- Add the R2-backed action store using conditional `etagDoesNotMatch: '*'`
  writes.
- Add deterministic conflict and exact-replay behavior.
- Add the pending-intake queue adapter.
- Prove event ordering is R2 first, queue second.
- Return a durable retry receipt when only queue creation fails.

**Execution:** complete. R2 is immutable evidence only; queue records contain no
R2 object key; the Goal Graph is not written.

## Task 3: Add the authenticated Worker route

- Add `POST /v1/admin/portfolio/actions` with a 16 KiB body ceiling.
- Reuse Cloudflare Access + Plexus founder resolution for browser requests.
- Reuse signed Telegram founder validation for WebApp requests.
- Keep the three page routes GET-only and make the action route POST-only.
- Fail closed when authentication, R2, or the action queue is unavailable.

**Execution:** complete. Ten focused Workbench route tests pass, including both
founder authentication paths, ordering, malformed input, oversize rejection,
bundle parity, and denial behavior.

## Task 4: Replace export controls with real admin actions

- Remove Import, Copy, JSON, Markdown, and Reset from the header.
- Show hosted connection/receipt status instead.
- Add `Save & queue repository review` to Thoughtseed intake.
- Add `Start project ingestion` to Tryambakam Project intake.
- Disable writes in local preview while preserving browser-draft recovery.
- Update CSP to same-origin connect and retain all other egress denials.

**Execution:** complete. The generated hosted artifact is 352,037 bytes with
SHA-256 `a195927aaa9dff17326e52022a1f868a13e375456ff2e2df911124fe460b2348`;
the Worker embed is byte-equivalent.

## Task 5: Verify and hand off

- Run the app check, focused Worker/action tests, full deterministic release
  suite, responsive browser proof, and independent review.
- Correct every stale artifact receipt in docs and handoff.
- Commit, push, and open a PR attached to Project #14.
- Do not deploy while packet review #292 and promotion #293 remain open.

**Execution:** complete before PR. `pnpm check` passes 47 active Workbench
tests with one historical skip; the combined action/store and exact route suite
passes 18/18; `npm run verify:release` passes the deterministic repository,
standalone, mobile, R3F, build, and desktop packaging gates. Independent
re-audit reports no remaining P0-P2 findings. Production remains untouched.
