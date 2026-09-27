# Agent operating contract

This repository is `cambium`.

1. Read `PROJECT.md` and `.project/HANDOFF.md` before starting work.
2. Treat the Thoughtseed Labs vault as referenced knowledge, never as a
   runtime dependency or a place to copy private notes, transcripts, or
   seed corpora.
3. Preserve the existing tooling and deployment boundaries. Use the
   commands declared in `PROJECT.md` and keep generated output ignored.
4. Keep changes scoped to this repository. Do not edit vault registries,
   native client stores, Paseo, OmniRoute configuration, provider
   credentials, or external deployment state without a separate
   owner-approved task.
5. Never add secrets, `.env` material, native session identifiers, prompt
   or response bodies, or machine-local absolute checkout paths.
6. Record a bounded checkpoint in `.project/HANDOFF.md` when a reviewed
   change is ready for another client to pick up.

This packet is reviewed-held. Identity recording still does not
authorize relocation, registry writes, session migration, or provider
changes; those remain manifest-gated. Production deployment remains
separately owner-approved and rollback-gated.

<!-- temperance:project-rail:start -->
## Temperance project rail

This repository is registered with **Temperance Engine** as a project rail.
Host runtime (models, OmniRoute, OpenCode plugins) lives under `~/.temperance_engine`
and `~/.config/opencode`; this repo owns planning and acceptance.

| Concern | Authority |
|---|---|
| Models / failover / budgets | Host OmniRoute + temperance combos |
| Planning spine | `.planning/` (GSD) + `temperance-next-wave` |
| Human roadmap | one GitHub Project per repo (`temperance-gh-plan`) |
| Acceptance | `ISA.md` when present |
| Session loop | `/gsd:goal` → `.temperance/goal.json` (not a second planner) |
| Handoff (if present) | `.project/HANDOFF.md` |
| Parallel execute | `noesis-execute` / `temperance-batch` |

`/gsd:*` binds the mode. A card only on a bare first prompt with no saved session/cwd mode.

### Auto next-wave

When an agent session starts in this cwd, enrich injects `dispatch: NEXT-WAVE …`.
The injected next-wave is a proposal only. Do not dispatch until a matching
approval receipt has been atomically claimed by the swarm control ledger.

```bash
temperance-next-wave --cwd .
temperance-project-init --cwd . --check
manifest-bridge init --cwd .
manifest-bridge sync --cwd .
temperance-swarm-dispatch --request .planning/swarm-claim.json --dry-run
```

Manifest: `.temperance/project.json` (schema temperance.project.v1)
<!-- temperance:project-rail:end -->


<!-- coord:start -->
## Team coordination

This repo is set up for team coordination between agents working in shared
sessions. Follow these rules:

- Before starting non-trivial work, publish a plan with `publish_plan`.
- Keep step status current as you go, using `update_step`.
- If the injected context shows an overlap warning, coordinate before you
  edit (spec Law 3, Rev 28) — never silently duplicate the work. If it is the
  same task and you have not started, join their session: register on their
  branch, or offer `propose_work_request` — the server auto-accepts only
  when every step is provably unstarted and unassigned, so a safe join needs
  no human. If the work is related, claim only unstarted, unassigned steps
  the same way. Never take started or assigned work. Stop and ask your human
  only when your permission mode requires approval or no safe action exists.
- When you discover something non-obvious (a gotcha, a decision, a fact
  someone else would need), write it down with `remember` so the team
  keeps it.
- When something is a teammate’s job rather than yours — their area, their
  decision, a question only they can answer — hand it to them with
  `assign_work` instead of asking your human to relay a message. Use
  `list_people` to turn a name into an assignee id, put the whole brief
  in the note, and tell your human who you handed it to. Their own agent is
  told at its next prompt. This is free: no model call, no sponsor, nothing
  to pay for.
- When you hit a bug, a blocker, or something that plainly wants a different
  specialist, open it with `report_opportunity` and close it with
  `resolve_opportunity` when it is handled. Nothing reads your transcript
  looking for these, so a problem you only describe in your answer reaches
  nobody; reporting it is what lets the team's Brain offer it to whoever fits.
  Reporting is not notifying — it may reach no one — so do not tell your human
  a teammate was alerted.
<!-- coord:end -->
