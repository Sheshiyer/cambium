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

## Fix round 1 — live form recovery

### RED

The focused page test was revised to re-query the live controls after local
validation and after an ambiguous network error. Before the fix it failed
because `showMessage` appended through `sheetBody.innerHTML +=`, replacing the
form while the submit closure still held detached controls.

### GREEN

`showMessage` now updates the sole existing live status region with
`textContent`, an explicit status state, and a class. It never replaces the
form. Non-receipt failures re-enable the existing submit control, preserving
the form values and the stable `clientRequestId` for retry.

```text
node --test --test-name-pattern='Fitcheck founder outcome' workers/quests/src/handler.test.ts
```

Result: exit 0; 4 passed, 0 failed. `git diff --check` passed.
