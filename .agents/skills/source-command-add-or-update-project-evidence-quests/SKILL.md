---
name: "source-command-add-or-update-project-evidence-quests"
description: "Workflow scaffold for the opt-in /cambium-evidence-quests command. Opens the project evidence and quests workflow and grants no deployment authority."
---

# source-command-add-or-update-project-evidence-quests

Use this skill when the installed command `/cambium-evidence-quests` asks for the migrated source workflow `add-or-update-project-evidence-quests`.

## Command

`/cambium-evidence-quests` is the opt-in sapling wrapper. It opens this skill. The historical source command name is `add-or-update-project-evidence-quests`.

## Goal

Update project evidence and quests logic in the quine/hyphae and operator/quests subsystems, including tests.

## Common files

- `bin/quine/hyphae/project-evidence.ts`
- `bin/quine/hyphae/project-evidence.test.ts`
- `bin/quine/hyphae/quests.ts`
- `bin/quine/hyphae/quests.test.ts`
- `bin/operator/quests/quests.ts`
- `bin/operator/quests/quests.test.ts`

Update `package.json` only when the change needs a script or dependency that those files already use.

## Suggested sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Authority

This scaffold grants no publication, scheduling, spend, admission, migration, provider change, or deployment. A named command is not owner approval.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.
