---
name: "source-command-feature-development"
description: "Workflow scaffold for the opt-in /cambium-feature command. Opens the feature-development workflow and grants no deployment authority."
---

# source-command-feature-development

Use this skill when the installed command `/cambium-feature` asks for the migrated source workflow `feature-development`.

## Command

`/cambium-feature` is the opt-in sapling wrapper. It opens this skill. The historical source command name is `feature-development`.

## Goal

Make the smallest coherent feature change in the touched Cambium subsystem, with tests beside the code.

## Common files

- `apps/cambium-r3f/src/scene/`
- `apps/cambium-r3f/src/world/`
- `apps/cambium-r3f/src/engine/`
- `apps/cambium-r3f/src/generated/`
- test files beside the code they cover (`*.test.ts`)

Stay inside the subsystem the request names. Do not treat a glob such as every API route as an edit surface.

## Suggested sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files. `npm test` is the repository verification command.
4. Summarize what changed and what still needs review.

## Authority

This scaffold grants no publication, scheduling, spend, admission, migration, provider change, or deployment. A named command is not owner approval.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.
