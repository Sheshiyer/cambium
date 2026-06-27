---
name: add-or-upgrade-r3f-feature
description: Workflow command scaffold for add-or-upgrade-r3f-feature in cambium.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-or-upgrade-r3f-feature

Use this workflow when working on **add-or-upgrade-r3f-feature** in `cambium`.

## Goal

Implements or upgrades a feature in the cambium-r3f visual engine, including code, tests, and documentation/artifacts.

## Common Files

- `apps/cambium-r3f/src/scene/*.tsx`
- `apps/cambium-r3f/src/scene/*.ts`
- `apps/cambium-r3f/src/scene/*.test.ts`
- `apps/cambium-r3f/src/world/*.ts`
- `apps/cambium-r3f/src/world/*.test.ts`
- `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/*`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit or add implementation files in apps/cambium-r3f/src/scene/ and/or apps/cambium-r3f/src/world/
- Add or update corresponding test files (*.test.ts) in the same directories
- Update or add documentation or verification artifacts in docs/plans/assets/cambium-r3f-game-engine-realignment/verification/
- Update tasks/todo.md or tasks/lessons.md as needed

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.