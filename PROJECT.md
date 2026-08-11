# Cambium

## Packet status

This is the canonical project entry point for the `cambium`
repository. This packet is **reviewed-held** — reviewed from registry,
repository, and owner approval evidence. No path move, registry write,
session migration, or provider change is implied by this packet.

## Registry evidence

- Portfolio: `thoughtseed`
- Repository: `cambium`
- Registry WorkObject: `sapling:cambium` (`Cambium`, kind: sapling)
- GitHub: `Sheshiyer/cambium` (identity_status: verified, portfolio-catalog-authority)
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

### Doctrine & planning maps (additive indexes)

| Map | Path |
|---|---|
| Root doctrine catalog | [`docs/doctrine/README.md`](./docs/doctrine/README.md) |
| Docs discovery index | [`docs/README.md`](./docs/README.md) |
| Lifecycle (current vs historical) | [`docs/LIFECYCLE.md`](./docs/LIFECYCLE.md) |
| GSD `.planning/` map | [`.planning/README.md`](./.planning/README.md) |
| Loops → graphs (quests) | [`docs/architecture/loops-to-graphs.md`](./docs/architecture/loops-to-graphs.md) |

## Local commands

```bash
npm install
npm run test
```

`npm run test` is the current deterministic verification
command.
