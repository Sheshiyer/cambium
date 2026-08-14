# Task 4 — Fitcheck Mission founder action sheet report

## Scope

Implemented the exact Fitcheck founder evidence sheet and Mission readback only.
The UI has two fixed actions, two receipt references, an observed outcome,
optional note, validation/focus preservation, replay-safe client request ID,
and runtime-only Telegram `initData` at the POST boundary. It consumes the
Task 2/3 server envelope for pending, committed, and expired states.

## RED

```text
node --test --test-name-pattern='Fitcheck founder outcome' workers/quests/src/handler.test.ts
```

Inherited result: exit 1; 0 passed, 4 failed. The sheet controls, envelope
projection, and Mission/Gate refresh behavior did not exist.

## GREEN

```text
node --test --test-name-pattern='Fitcheck founder outcome' workers/quests/src/handler.test.ts
```

Result: exit 0; 4 passed, 0 failed.

- Exact Fitcheck actions render the bounded accessible sheet.
- Validation retains safe entries, focuses the missing field, and reuses the
  request ID across an ambiguous retry.
- Pending, committed, and expired server-envelope states render correctly.
- Signed goal approval refreshes Mission readback while retaining Fitcheck
  branch focus; the existing Gate refresh path is invoked as well.

## Boundaries

No authority, writer, transport, execution, external state, or deployment
behavior was added. `initData` is not put in markup or persisted client state.
Only the fixed Fitcheck identity can render this action surface.

## Verification

`git diff --check` passed for all Task 4 files.
