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

## Cursor Cloud

Cloud Agent images ship Node 22. This repository runs its operator and `npm test` entrypoints as native TypeScript on Node 26. The environment install puts Node 26.13.0, pnpm 10.15.1, and Bun 1.4.4 first on the login `PATH`.

Root `npm install` has no packages. App dependencies come from each lockfile: `apps/cambium-r3f` (npm), `apps/portfolio-cartographer` (pnpm), `workers/cortex-mcp` (npm), and `apps/cambium-showreel` (Bun). Showreel mattes are gitignored and regenerated with `bun run prep`.

On boot, three local servers start from synthetic data, with no provider credentials:

| App | URL |
|---|---|
| Constellation visual engine | http://127.0.0.1:5173 |
| Portfolio workbench | http://127.0.0.1:5174 |
| Showreel scrubber | http://127.0.0.1:4789/?dev |

The showreel display face is DIN Condensed Bold on macOS. Linux sets `REEL_DISPLAY_FONT` to Bebas Neue. The scrubber stays hidden for several seconds while WebGL boots. The Electron shell is macOS-only and is not started here.

`node bin/operator/cli.ts demo` runs the operator offline with stub embeddings. Do not deploy Workers or read vault, Paseo, or provider state from this environment.

