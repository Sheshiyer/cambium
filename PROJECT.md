# Cambium

## Packet status

This is the canonical project entry point for the `cambium`
repository. This packet is **draft-held** — drafted from registry and
repository evidence, not yet reviewed by a human. No path move, registry
write, session migration, or provider change is implied by this packet.

## Registry evidence

- Portfolio: `thoughtseed`
- Repository: `cambium`
- Registry WorkObject: `sapling:cambium` (`Cambium`, kind: sapling)
- GitHub: `Sheshiyer/cambium` (identity_status: pending-teamforge-verification)
- Knowledge authority: `00-meta/entity-registry.md`
- Current packet checkpoint: `.project/HANDOFF.md`

## Authority and pickup

Codex is the default interactive governor for this repository. Claude,
OpenCode, and Kimi may pick up the bounded files listed in
`.project/project.yaml`. OmniRoute may route model calls beneath that
control rail; it does not own project identity, repository history, native
sessions, or vault knowledge.

Read `AGENTS.md`, `CLAUDE.md`, `.project/CONTEXT.md`, and
`.project/HANDOFF.md` before changing the repository. Native client
sessions, Paseo workspaces, provider stores, and credentials are
intentionally outside this packet.

## Current continuity lane

The unfinished brand, Cloudflare, Hermes, and website-delivery board is
preserved in `docs/continuity/unfinished-brand-cf-hermes-board.md` and tracked
under GitHub issue #285. Its 23 open source IDs are routed into bounded outcome
issues and Phase 9 of `.planning/ROADMAP-v0.4-continuation.md`.

This is a coordination pointer only. It does not change the packet's
`draft-held` status or authorize provider, runtime, registry, session, or
deployment mutations.

## Relocation preparation lane

The observed-current-state supplement at
`docs/continuity/cambium-relocation-portfolio-reconciliation-prep.md` corrects
the stale portfolio-worktree handoff, maps the destination as 32 logical
repositories across 25 top-level directories, and separates physical relocation
from Phase B reconciliation. GitHub issue #287 owns the future readiness and
closure sequence.

Cambium remains at its current path. Its proposed destination is absent, its Git
common directory has four linked worktrees, and protected working bytes remain.
This lane is preparation only and does not change `draft-held` status or
authorize relocation, branch/worktree mutation, registry closure, R2 restore,
session migration, provider changes, or deployment.

## Local commands

```bash
npm install
npm run test
```

`npm run test` is the current deterministic verification
command.
