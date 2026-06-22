---
name: add-or-update-project-evidence-quests
description: Workflow command scaffold for add-or-update-project-evidence-quests in cambium.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-or-update-project-evidence-quests

Use this workflow when working on **add-or-update-project-evidence-quests** in `cambium`.

## Goal

Implements or updates project evidence and quests logic in the quine/hyphae and operator/quests subsystems, including tests.

## Common Files

- `bin/quine/hyphae/project-evidence.ts`
- `bin/quine/hyphae/project-evidence.test.ts`
- `bin/quine/hyphae/quests.ts`
- `bin/quine/hyphae/quests.test.ts`
- `bin/operator/quests/quests.ts`
- `bin/operator/quests/quests.test.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit or add implementation files in bin/quine/hyphae/ (e.g., project-evidence.ts, quests.ts)
- Add or update corresponding test files (*.test.ts) in the same directories
- Edit or add bin/operator/quests/quests.ts and its tests
- Update package.json if needed

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.