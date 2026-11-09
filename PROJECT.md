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
- Current pickup: `.planning/HANDOFF.json`; history: `.project/HANDOFF.md`

## Authority and pickup

Codex is the default interactive governor for this repository. Claude,
OpenCode, and Kimi may pick up the bounded files listed in
`.project/project.yaml`. OmniRoute may route model calls beneath that
control rail; it does not own project identity, repository history, native
sessions, or vault knowledge.

Read `AGENTS.md`, `CLAUDE.md`, `.project/CONTEXT.md`, and only the first
12 lines of `.project/HANDOFF.md` before changing the repository. Follow
the bounded pickup below. Native client sessions, Paseo workspaces,
provider stores, and credentials are intentionally outside this packet.

### Bounded session pickup

Use the existing `.planning/HANDOFF.json` for current pickup. Paths in
the project packet are references, not a request to preload every file.
Start with the root summary and continuation names:

```bash
python3 - <<'PY'
import json
with open('.planning/HANDOFF.json') as source:
    handoff = json.load(source)
fields = ('updated', 'status', 'active_task', 'next_action', 'next_command')
print(json.dumps({key: handoff.get(key) for key in fields}, indent=2))
print('continuations:', ', '.join(handoff.get('continuations', {})))
PY
```

Then print only the continuation matching the user's task. Follow its
owning handoff or proof only as needed to establish status, holds and the
next safe action; other streams remain unloaded. Hash a cited artifact
without printing its body, and select needed JSON fields or source ranges.
Use ISA/GSD for the relevant acceptance or planning question. A handoff
pointer or proposed command does not authorize execution. If structured
state or local proof is missing, stale or conflicting, report that limit.

`.project/HANDOFF.md` preserves historical checkpoints. Do not `cat` it,
read it in full, or load it into startup context. For a specific missing
fact, locate a matching heading with bounded `rg -n` output and read only
that section with `sed -n`; expand further only when that fact requires it.
If no continuation matches, show the available names and report the gap
rather than scanning all history. Record future pickup state in the existing
structured continuation and retain only a bounded historical checkpoint.

### Canonical doctrine anchors

| Anchor | Path | Authority |
|---|---|---|
| Enduring Vision | [`VISION.md`](./VISION.md) | Canonical near-invariant doctrine |
| Current Repository Mission | [`MISSION.md`](./MISSION.md) | Canonical renewable doctrine horizon |

The root anchors own doctrine only. [`ISA.md`](./ISA.md) owns approved goals and acceptance; GSD under [`.planning/`](./.planning/) owns finite planning state. Supporting and generated surfaces link to those authorities rather than copying them.

### Doctrine & planning maps (additive indexes)

| Map | Path |
|---|---|
| Root doctrine catalog | [`docs/doctrine/README.md`](./docs/doctrine/README.md) |
| Docs discovery index | [`docs/README.md`](./docs/README.md) |
| On-demand documentation inventory | [`docs/architecture/contracts/documentation-inventory-v1.md`](./docs/architecture/contracts/documentation-inventory-v1.md) |
| Lifecycle (current vs historical) | [`docs/LIFECYCLE.md`](./docs/LIFECYCLE.md) |
| On-demand documentation inventory | [`docs/architecture/contracts/documentation-inventory-v1.md`](./docs/architecture/contracts/documentation-inventory-v1.md) |
| GSD `.planning/` map | [`.planning/README.md`](./.planning/README.md) |
| Loops → graphs (quests) | [`docs/architecture/loops-to-graphs.md`](./docs/architecture/loops-to-graphs.md) |

## Local commands

```bash
npm install
npm run test
```

`npm run test` is the current deterministic verification
command.

## Sapling lifecycle pack

The repository-owned `sapling-lifecycle` skill composes the existing product,
delivery, launch, growth, and learning workflows. Start with its repo-local
skill entrypoint; `references/commands.md` documents client syntax and install
rollback. Reports are local review projections, never operational admission.

```bash
npm run sapling -- review all
npm run sapling -- status fitcheck
npm run sapling -- run fitcheck
npm run sapling:adapters -- dry-run
npm run sapling:adapters -- install
npm run sapling:adapters -- check
npm run sapling:test
```

Supply private vault and skill-library roots through local configuration or
helper flags. Generated reports remain ignored. A generic run requests one
step selection; the calling agent performs only that authorized action and
verifies its outcome. No scheduler or external publisher is installed.
