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

Current `STATE.md` (as of last read): **Status: Complete** (Telegram Operator Intake 100%).
When STATE is Complete, Temperance next-wave **ignores orphan open checkboxes** in historical plan docs and reports `action=complete`.

## Reading order for humans / agents

1. Root [PROJECT.md](../PROJECT.md) + [.project/HANDOFF.md](../.project/HANDOFF.md)
2. This folder’s **STATE.md** (is the planning slice open?)
3. If Active → current phase under `phases/`, then open tasks
4. If Complete → jump to [docs/runbooks/](../docs/runbooks/) + [ISA.md](../ISA.md) for *current* work; use dated files here only as audit

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
