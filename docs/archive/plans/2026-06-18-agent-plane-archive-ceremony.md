# W6 Agent-Plane Archive Ceremony

Issue: <https://github.com/Sheshiyer/cambium/issues/26>

Status: sanitized standalone runbook. The original pilot note proved the archive
receipt mechanism; this version describes the portable ceremony for any external
agent plane.

## Goal

Retire an agent plane as an active runtime while preserving enough operating
memory, instance state, and channel lessons for Cambium to treat the project as
archived. Cambium must only mark `projectArchived` true when a receipt exists.

## Invariants

- No fake progress: missing receipt means `projectArchived: false`.
- No destructive first step: archive before deleting or stopping runtime state.
- Channel adapters survive independently of the retired agent plane.
- Private vaults and customer worktrees are never inferred from Cambium state.

## Ceremony

1. Confirm the soak period: the org can operate without the runtime.
2. Archive instance state into a timestamped artifact outside the active tree.
3. Capture repo/runtime state without secrets.
4. Extract or document surviving channel adapters.
5. Record the receipt:

```sh
npm run quine -- write skills archive agent-plane \
  --tenant demo-org \
  --evidence "~/.config/cambium/agent-plane/<timestamp>-instances.tar.zst" \
  --repo "sample-agent-plane" \
  --note "soak complete; channel layer extracted"
```

6. Refresh project evidence:

```sh
npm run quine -- write quests evidence --tenant demo-org
```

7. Check the runtime retirement gate:

```sh
npm run quine -- read skills archive agent-plane --tenant demo-org
```

## Exit Test

- Archive artifact exists and is referenced in `.operator/<tenant>.skills.archive.json`.
- Repo/runtime state is captured in the receipt or linked note.
- `quine write quests evidence` reports `projectArchived: true` only after the receipt exists.
- Active runtime processes are stopped or explicitly migrated.
- The issue can be closed with links to the receipt and migration notes.

## Implemented Mechanism

- `quine write skills archive <routine-id>`
- `quine read skills archive [routine-id]`
- `.operator/<tenant>.skills.archive.json`
- project evidence reads archive receipts into `projectArchived`
