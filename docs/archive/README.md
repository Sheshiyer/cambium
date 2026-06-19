# Project Archive Ceremony

Cambium treats archive as a product event, not as a shutdown script for one provider. Any organization should be able to close a project, preserve the evidence needed for learning, and mark the quest ledger honestly without depending on a specific agent plane, chat system, or local machine path.

## Contract

An archive receipt says:

- the project has a durable evidence artifact or evidence reference.
- repo/runtime state has been captured or linked.
- surviving adapters are documented separately from retired runtime.
- the quest ledger may treat the project archive as complete.

The receipt is tenant-scoped and lives in ignored runtime state:

```text
.operator/<tenant>.skills.archive.json
```

Committed examples must be synthetic only.

## Command

```bash
npm run quine -- write skills archive project-closeout \
  --tenant demo-org \
  --evidence "~/.config/cambium/archive/demo-org/project-closeout.tar.zst" \
  --repo "example-project" \
  --note "synthetic archive receipt for docs"
```

Read the close gate:

```bash
npm run quine -- read skills archive project-closeout --tenant demo-org
```

Refresh project evidence:

```bash
npm run quine -- write quests evidence --tenant demo-org
```

## Adapter Examples

Agent-plane, repository, deployment, CRM, and chat systems may all provide archive evidence. They remain adapters. The archive ceremony itself is the neutral receipt contract above.

An agent-plane adapter may additionally verify that worker processes have retired and that channel adapters survived. That verification belongs in adapter evidence, not in the generic product contract.

## No-Fake-Progress Rule

Cambium marks `projectArchived: true` only when a receipt exists. Missing receipts mean the archive arc stays pending.

## Privacy Boundary

Do not commit:

- raw instance archives.
- private workspace paths.
- customer transcripts.
- live runtime identifiers.
- direct account identifiers.

If a real closure teaches a reusable lesson, commit a synthetic fixture or adapter doc, not the real archive payload.
