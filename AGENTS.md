# Agent operating contract

This repository is `cambium`.

1. Read `PROJECT.md` and the first 12 lines of `.project/HANDOFF.md` before
   starting work. Follow PROJECT's bounded pickup: select current fields and
   the relevant continuation from `.planning/HANDOFF.json`. The remaining
   human handoff is history to search on demand, not a startup read.
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
6. Update the matching structured continuation and record a bounded checkpoint
   below the human handoff's pickup pointer when a reviewed change is ready
   for another client. Preserve the pointer and historical body.

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
| Pickup / history | `.planning/HANDOFF.json` / `.project/HANDOFF.md` |
| Parallel execute | `noesis-execute` / `temperance-batch` |

`/gsd:*` binds the workflow. Use bounded Alchemy orientation from the existing
session and project state; do not inject a PAI mode quiz or reopen a mode picker.

### Repository pickup

Vestibule may show up to three sourced candidates from current project handoff,
validated planning state and cached issue metadata. Missing or stale sources stay
unavailable. A displayed wave is a proposal; revalidate its source and approval.
Do not dispatch until a matching approval receipt has been atomically claimed
by the swarm control ledger.

```bash
temperance-next-wave --cwd .
temperance-project-init --cwd . --check
manifest-bridge init --cwd .
manifest-bridge sync --cwd .
temperance-swarm-dispatch --request .planning/swarm-claim.json --dry-run
```

Manifest: `.temperance/project.json` (schema temperance.project.v1)
<!-- temperance:project-rail:end -->

