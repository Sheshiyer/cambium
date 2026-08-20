# Documentation Inventory v1

## Status and authority

`cambium.documentation-inventory.v1` is a deterministic, ephemeral,
`read_only` projection of one committed repository tree. It is an inspection
surface, not doctrine, acceptance, planning state, an action queue, a
relocation decision, or a deletion authority.

Existing owners remain unchanged:

- root `VISION.md` and `MISSION.md` own repository doctrine;
- root `ISA.md` owns approved goals and acceptance;
- live `.planning/STATE.md` owns the current finite planning transition; and
- contracts and runbooks own their bounded operating instructions.

No JSON or Markdown inventory readback is committed. Both formats are produced
on demand and therefore create no recursive freshness selector or durable
inventory ledger.

## Explicit revision input

The caller must provide `--source-revision <REV>`. The source adapter resolves
that value exactly once with:

```text
git rev-parse --verify REV^{commit}
```

The resolved value must be a full lowercase 40-hex commit SHA. Every later
tree enumeration and blob read uses only that SHA through `git ls-tree` and
`git show FULL_SHA:path`. Worktree files, staged bytes, filesystem mtimes,
locale, clock time, and checkout location do not enter the model.

Once the Phase 6 CLI wiring is installed, the public invocations are:

```bash
npm run --silent docs:inventory:json -- --source-revision <REV>
npm run --silent docs:inventory:markdown -- --source-revision <REV>
npm run --silent docs:inventory:check -- --source-revision <REV>
```

The `--silent` flag is part of the public examples so package-manager banners
cannot corrupt the single stdout document. There is no implicit revision,
output-file option, write mode, staged/index mode, deployment mode, provider
argument, or external-effect mode.

## Corpus and source boundary

At the resolved SHA, the corpus is exactly:

1. every tracked root Markdown file;
2. every tracked blob under `docs/`; and
3. every tracked blob under `.planning/`.

Every corpus path appears exactly once. Generated, historical, evidentiary,
binary, large, summary, state, roadmap, requirement, plan, and context files
remain included. Binary material contributes bounded byte count, content kind,
and content digest, never its body.

Tracked root `MEMORY/` is queried separately at the same SHA. The projection
records whether that surface exists at the selected revision. A false value is
revision-bounded evidence, not a timeless absence claim. The adapter never
probes ignored files, provider-owned memory, `.operator/`, `.codegraph/`, vault
content, or host runtime stores, and it never substitutes `docs/memory/` for
root `MEMORY/`.

## Closed inventory object

The top-level object has exactly these fields:

| Field | Meaning |
| --- | --- |
| `schema` | Exact value `cambium.documentation-inventory.v1` |
| `projectionAuthority` | Exact value `read_only` |
| `sourceRevision` | Resolved full commit SHA |
| `lifecycleClasses` | Exact ordered five-class vocabulary |
| `rootMemory` | Revision-bounded root-memory fact and local-only policy |
| `entries` | Bytewise path-sorted, unique corpus entries |
| `sourceSetDigest` | SHA-256 of path/provenance facts plus root-memory fact |
| `inventoryDigest` | SHA-256 of every inventory field except itself |

Each entry has exactly:

- `path` — safe repository-relative POSIX provenance;
- `provenance` — source SHA, SHA-256 content digest, byte count, and
  `text`/`binary` kind;
- `presentPurpose` — concise body-free role at the selected revision;
- `overlap` — bounded repository-relative related surfaces;
- `recommendedDisposition` — advisory retain-only guidance;
- `canonicalAnchors` — direct paths to owning sources, never copied doctrine;
- `lifecycle` — one exact lifecycle class; and
- `exception` — null or explicit source-backed item evidence.

Unknown fields, incomplete path coverage, duplicate paths, unsafe paths,
unknown lifecycle values, authority escalation, destructive dispositions,
secret-shaped output, prompt/request/response bodies, provider/runtime state,
and action or write fields fail closed.

## Lifecycle vocabulary

The vocabulary is closed and ordered:

1. `canonical` — current authority inside the source's bounded domain;
2. `derived` — navigation, explanation, or generated inspection material;
3. `historical` — recoverable non-operational implementation history;
4. `evidentiary` — recoverable proof or proof-bound operating evidence; and
5. `local-only` — ignored or owner-protected state that must not enter the
   committed corpus.

Classification never grants new authority. Directory defaults yield only to
explicit source-backed item evidence. In particular, a packet under
`docs/plans/product-branches/` receives the indexed packet exception only when
`docs/plans/product-branches/index.md` lists that exact packet. A directory
name or lookalike filename is insufficient.

## Recovery and disposition semantics

Every recommendation is non-destructive and begins with `retain`. Historical
and evidentiary paths remain recoverable through Git history and their owning
indexes. The inventory never moves, deletes, archives, externalizes, rewrites,
deduplicates, dispatches, or queues a path. Any later relocation or deletion
requires a separate reviewed task and owner approval.

## Machine and human parity

`renderDocumentationInventoryJson` and
`renderDocumentationInventoryMarkdown` accept the same validated object. Both
carry the same full source revision, source-set digest, inventory digest, entry
identities, lifecycle facts, dispositions, provenance, and exceptions.

Successful generation writes exactly one selected representation to stdout.
Failures produce no partial document. Generation performs no file creation,
directory creation, Git-index update, mtime change, GSD mutation, network call,
provider lookup, runtime write, or external action.
