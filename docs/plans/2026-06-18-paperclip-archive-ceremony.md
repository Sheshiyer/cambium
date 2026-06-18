# W6 Paperclip Archive Ceremony

Issue: <https://github.com/Sheshiyer/cambium/issues/26>

Status: ready for execution after the 2026-06-18 soak checkpoint. This document defines the safe ceremony; it does not by itself delete or move Paperclip runtime state.

## Goal

Retire Paperclip as the active agent plane while preserving its operating memory, instance state, and Hermes channel lessons. After the ceremony, Cambium should treat the project archive as real evidence only when an archive receipt exists.

## Invariants

- No fake progress: if the archive receipt is absent, `projectArchived` remains false.
- No destructive first step: archive before deleting or stopping anything else.
- Hermes remains the external channel layer; Paperclip's Hermes scripts are extracted or referenced before retirement.
- Vault docs are updated in the Thoughtseed vault, not silently inferred from Cambium state.

## Ceremony

1. Confirm the soak: one week of org operations with Paperclip processes off and no regressions.
2. Archive `~/.paperclip/instances` into a timestamped artifact outside the active runtime tree.
3. Capture the Paperclip repo state: current commit, dirty status, and any local-only env/config inventory without secrets.
4. Extract or point to the Hermes channel layer home:
   - Telegram command handler
   - TeamForge webhook handler
   - outbound document/email delivery scripts
   - poller/queue consumer pattern
5. Record the receipt through Cambium:

```sh
npm run quine -- write skills archive paperclip \
  --tenant cambium \
  --evidence "~/.paperclip/archives/<timestamp>-instances.tar.zst" \
  --repo "/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-paperclip" \
  --note "W6 soak complete; Hermes layer extracted"
```

6. Refresh project evidence:

```sh
npm run quine -- write quests evidence --tenant cambium
```

7. Update companion vault docs:
   - `thoughtseed-labs/CLAUDE.md`
   - `thoughtseed-labs/00-meta/mocs/command-center-architecture.md`
   - `docs/telegram-commands.md`

## Exit Test

- Archive artifact exists and is referenced in `.operator/<tenant>.skills.archive.json`.
- Paperclip repo state is captured in the receipt or linked note.
- `npm run quine -- write quests evidence --tenant <tenant>` reports `projectArchived: true` only after the receipt exists.
- Hermes command routing is documented as the surviving channel layer.
- Issue #26 can be closed with links to the archive receipt and companion docs.

## Notes From This PR

This PR adds the receipt mechanism:

- `quine write skills archive <routine-id>`
- `.operator/<tenant>.skills.archive.json`
- project evidence reads archive receipts into `projectArchived`

## Operations Pass - 2026-06-18

The non-destructive archive portion of the ceremony has been executed locally:

- Archive artifact: `/Users/sheshnarayaniyer/.paperclip/archives/20260618T063755Z/instances.tar.gz`
- Repo state: `/Users/sheshnarayaniyer/.paperclip/archives/20260618T063755Z/repo-state.txt`
- Checksums: `/Users/sheshnarayaniyer/.paperclip/archives/20260618T063755Z/SHA256SUMS`
- Verification: `shasum -a 256 -c SHA256SUMS` returned `OK` for the archive and repo-state files.
- Receipt command: `npm run quine -- write skills archive paperclip --tenant cambium ...`
- Project evidence refresh: `npm run quine -- write quests evidence --tenant cambium` reported `projectArchived: true`.

Companion documentation was updated in the dirty external vault worktrees without staging unrelated edits:

- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/CLAUDE.md`
- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/00-meta/mocs/command-center-architecture.md`
- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/docs/telegram-commands.md`

Current blocker for closing issue #26: a process check still found active Paperclip-adjacent execution (`scripts/loop-runner.sh _run`) and Hermes services (`ai.hermes.*`, including `forge-aura`). Do not close the issue until the active runtime owner confirms these can be stopped or migrated without interrupting live work.
