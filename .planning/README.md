# `.planning/` — map (non-destructive)

Authority for *how planning works* remains [docs/LIFECYCLE.md](../docs/LIFECYCLE.md).
This folder is the **GSD / phase spine** plus dated planning receipts.

## Live vs historical (do not mix)

| Class | Files | Follow as instructions? |
|---|---|---|
| **Live spine** | `STATE.md`, `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `ROADMAP-v0.4-continuation.md`, `config.json`, `phases/` | Only when `STATE.md` says the slice is **Active** |
| **Bridge / doctrine** | `PHASE-Q-BRIDGE.md` | Context for phase Q; not a task queue |
| **TE runtime** | `NEXT-WAVE.json`, (optional) `next-wave-tasks.json` | Machine output from `temperance-next-wave`; not human prose authority |
| **Historical receipts** | `2026-08-10-*`, `FITCHECK-RELEASE-HANDOFF-*`, retention manifests | **No** — evidence / audit only |

Current status and the next finite transition belong solely to live
[`STATE.md`](STATE.md). Re-read it directly; this index intentionally caches
neither value.

## Reading order for humans / agents

1. Root [PROJECT.md](../PROJECT.md) + [.project/HANDOFF.md](../.project/HANDOFF.md)
2. This folder's live [`STATE.md`](STATE.md)
3. Follow only the phase and transition selected there
4. Use [docs/runbooks/](../docs/runbooks/) and [ISA.md](../ISA.md) for their
   bounded current authority; use dated files here only as audit history

## Config (GSD + Temperance)

See `config.json`:

- `workflow.auto_advance` — keep `false` for human gates on GSD transitions
- `parallelization.task_level` — `true` when a wave has independent `[P]` tasks
- `temperance.next_wave` — project rail uses host TE for fleet combo only

## Commands

```bash
temperance-next-wave --cwd .
temperance-project-init --cwd . --check
quine quests --tenant cambium   # evidence-derived quest ledger (no fake tracker)
```
