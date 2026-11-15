---
name: "source-command-add-or-upgrade-r3f-feature"
description: "Workflow scaffold for the opt-in /cambium-r3f-feature command. Opens the R3F feature workflow and grants no deployment authority."
---

# source-command-add-or-upgrade-r3f-feature

Use this skill when the installed command `/cambium-r3f-feature` asks for the migrated source workflow `add-or-upgrade-r3f-feature`.

## Command

`/cambium-r3f-feature` is the opt-in sapling wrapper. It opens this skill. The historical source command name is `add-or-upgrade-r3f-feature`.

## Goal

Add or upgrade a feature in the cambium-r3f visual engine, including the code, the tests beside it, and any existing visual notes that already cover that surface.

## Common files

- `apps/cambium-r3f/src/scene/`
- `apps/cambium-r3f/src/world/`
- `*.test.ts` files in those same directories
- `docs/plans/assets/cambium-r3f-game-engine-realignment/` when the change belongs to that existing asset set
- `tasks/lessons.md` when a lesson from the change belongs there

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
