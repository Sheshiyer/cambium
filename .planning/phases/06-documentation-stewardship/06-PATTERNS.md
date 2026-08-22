# Phase 6: Documentation Stewardship - Pattern Map

**Mapped:** 2026-08-20
**Files classified:** 14 likely new/modified files
**Analogs found:** 14 / 14

## Planning Boundary

Phase 6 is a read-only documentation inventory and navigation pass. It may
classify, link, and render repository evidence, but it does not relocate,
delete, archive, externalize, deploy, modify connected repositories, inspect
provider-owned runtime state, or create a new doctrine, goal, planning, or
operational authority.

The filenames below are the smallest pattern-compatible shape inferred from
`06-CONTEXT.md` and the approved repository-only redesign. The planner retains
naming discretion, but should preserve the same roles: a pure compiler, one
commit-tree source adapter, one zero-write CLI with machine and human stdout
formats, adversarial tests, one committed contract, and additive index edits.

The inventory readbacks are deliberately **not committed files**. A caller
supplies an explicit committed revision, the adapter resolves it to one full
40-hex commit SHA, and both JSON and Markdown are generated on demand from the
same validated object. This avoids recursively stale generated artifacts and
requires no special GSD execution route or closeout behavior.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/documentation-inventory.mjs` | utility/compiler/renderer | transform + file-I/O validation | `scripts/temperance-flow.mjs` | exact structural match |
| `scripts/documentation-inventory-sources.mjs` | source adapter | deterministic batch file-I/O | `scripts/temperance-flow-sources.mjs` + `scripts/generate-docs-retention-manifest.mjs` | exact composite match |
| `scripts/generate-documentation-inventory.mjs` | zero-write CLI renderer | request-response + batch commit-tree I/O | `scripts/generate-temperance-flow.mjs` + `scripts/proactive-loop-tick.mjs` | exact composite match |
| `scripts/documentation-inventory.test.mjs` | test | transform + adversarial file-I/O | `scripts/temperance-flow.test.mjs` | role match |
| `scripts/generate-documentation-inventory.test.mjs` | test | end-to-end batch file-I/O | `scripts/generate-temperance-flow.test.mjs` | exact match |
| `docs/architecture/contracts/documentation-inventory-v1.md` | contract | request-response/readback contract | `docs/architecture/contracts/temperance-flow-v1.md` | role match |
| `docs/LIFECYCLE.md` | canonical lifecycle map | navigation/reference | existing `docs/LIFECYCLE.md` + `docs/plans/README.md` | exact extension point |
| `PROJECT.md` | reviewed repository entry | navigation | existing `PROJECT.md` additive map | exact extension point |
| `README.md` | product discovery overlay | navigation | existing `README.md` Documentation section | exact extension point |
| `docs/README.md` | documentation index | navigation | existing `docs/README.md` | exact extension point |
| `docs/doctrine/README.md` | doctrine catalog | navigation | existing `docs/doctrine/README.md` | exact extension point |
| `.planning/README.md` | planning index | live-state delegation | existing `.planning/README.md` with stale-status line removed | exact repair point |
| `package.json` | config/scripts | command dispatch | existing root scripts and test glob | exact extension point |
| `scripts/infinite-game-anchors.test.mjs` | lifecycle acceptance sentinel | validation | Phase 4/5 coherent-state sentinel | role match |

Closure artifacts such as `ISA.md`, `.project/HANDOFF.md`, Phase 6 summaries,
and `.planning/STATE.md` follow the normal GSD execution/verification lifecycle;
they are not implementation analogs for the inventory itself.

## Pattern Assignments

### `scripts/documentation-inventory.mjs` (utility/compiler/renderer, transform)

**Primary analog:** `scripts/temperance-flow.mjs`

**Imports and closed vocabulary pattern** (`scripts/temperance-flow.mjs:1-15`):

```javascript
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export const TEMPERANCE_FLOW_SCHEMA = 'cambium.temperance-flow-projection.v1';
export const TEMPERANCE_FLOW_PROJECTION_AUTHORITY = 'read_only';
export const TEMPERANCE_FLOW_STATUSES = Object.freeze(['ready', 'blocked']);
```

Copy the shape, not the Flow vocabulary. Phase 6 needs its own schema and the
exact closed lifecycle set `canonical`, `derived`, `historical`, `evidentiary`,
and `local-only`. Reject extra keys and unknown classes; do not silently coerce
a near-match.

**Canonicalization and safe repository path pattern**
(`scripts/temperance-flow.mjs:94-147`):

```javascript
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function canonicalText(value) {
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
}

function normalizeRelativePath(value, label) {
  if (!nonEmptyString(value) || path.isAbsolute(value) || value.includes('\\') || value.includes('\0')) {
    throw new TypeError(`${label} must be a safe repository-relative POSIX path`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new TypeError(`${label} must not contain traversal or normalization drift`);
  }
  return normalized;
}
```

Every entry should expose repository-relative provenance and a canonical
content digest without carrying document bodies. Resolve symlinks and fail
closed on escape, missing files, normalization drift, or machine-local paths.

**Compile, sort, and digest once pattern** (`scripts/temperance-flow.mjs:394-415`,
`500-515`):

```javascript
const unique = new Map(values.map((value) => [canonicalJson(value), value]));
return [...unique.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([, value]) => value);

const sourceSetDigest = digestObject(canonicalSourceSet(references, tasks));
const withoutDigest = {
  schema: TEMPERANCE_FLOW_SCHEMA,
  projectionAuthority: TEMPERANCE_FLOW_PROJECTION_AUTHORITY,
  // validated projection facts
  sourceSetDigest,
};
const projection = { ...withoutDigest, flowDigest: digestObject(withoutDigest) };
return validateTemperanceFlowProjection(projection);
```

For Phase 6, sort inventory entries by normalized path and exceptions by their
stable identity. The inventory digest must exclude only itself. Because JSON
and Markdown are ephemeral stdout renderings rather than tracked sources,
there is no output-file exclusion rule or self-referential freshness cycle.

**Human readback from the validated object**
(`scripts/temperance-flow.mjs:705-715`, `724-732`, `758-760`):

```javascript
export function renderTemperanceFlowMarkdown(value) {
  const flow = validateTemperanceFlowProjection(value);
  const lines = [
    '# Cambium Temperance Flow',
    '',
    '> Read-only projection. This artifact cannot plan, dispatch, persist work, mutate D1, or resolve providers.',
    '',
    `- Schema: \`${flow.schema}\``,
    `- Projection authority: \`${flow.projectionAuthority}\``,
    `- Source-set digest: \`${flow.sourceSetDigest}\``,
    // tables rendered from the same object
  ];
  lines.push('', 'Source bodies and host routing policy remain in their owning systems.', '');
  return lines.join('\n');
}
```

The Markdown stdout format should visibly say it is an inventory, not an
authority or action queue. It should render the same full revision, inventory
digest, provenance, present purpose, overlap, lifecycle, disposition,
exception reason, and canonical-anchor links carried by the JSON object.

---

### `scripts/documentation-inventory-sources.mjs` (source adapter, batch file-I/O)

**Primary analogs:** `scripts/temperance-flow-sources.mjs` and
`scripts/generate-docs-retention-manifest.mjs`

**Contained reader and explicit source reference pattern**
(`scripts/temperance-flow-sources.mjs:61-87`, `169-172`):

```javascript
function normalizeRelativePath(value) {
  if (!nonEmpty(value) || path.isAbsolute(value) || value.includes('\\') || value.includes('\0')) {
    throw new TypeError('declared source path must be repository-relative POSIX text');
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === '..' || normalized.startsWith('../') || FLOW_OUTPUTS.has(normalized)) {
    throw new TypeError(`source path ${value} is outside the declared source boundary`);
  }
  return normalized;
}

function sourceReference(reader, relativePath, kind, selector) {
  const raw = reader.read(relativePath);
  return { path: relativePath, kind, selector, digest: digestText(select(raw, selector, relativePath)) };
}
```

Use an explicit declared set for named root documents and well-defined roots.
Do not recursively scan arbitrary ignored files, the user workspace, vault,
provider stores, `.operator/`, `.codegraph/`, or host runtime directories.

**Reviewed-revision tracked-file pattern**
(`scripts/generate-docs-retention-manifest.mjs:60-87`, `125-129`):

```javascript
function listHeadFiles(...scopes) {
  return runGit(['ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', ...scopes])
    .split('\0')
    .filter(Boolean)
    .sort();
}

function readHeadBlob(file) {
  if (!headBlobCache.has(file)) {
    headBlobCache.set(file, runGit(['show', `HEAD:${file}`], null));
  }
  return headBlobCache.get(file);
}
```

Copy the commit-tree operations but replace every literal `HEAD` with the one
resolved full SHA supplied to the source adapter. The adapter must never read
inventory bodies from the working tree or index.

**Commit-object validation pattern** (`scripts/verify-production-candidate.mjs:25-27`):

```javascript
run('git', ['rev-parse', '--verify', `${baseRef}^{commit}`])
const head = run('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']
})
```

For Phase 6, accept `--source-revision REV`, resolve it exactly once using
`git rev-parse --verify REV^{commit}`, validate the result against
`/^[0-9a-f]{40}$/`, and then use only that full SHA in every `ls-tree` and
`show SHA:path` call. `HEAD` may be accepted as caller input, but the output
must record the resolved full SHA, never the alias. Reject a missing revision,
ambiguous/non-commit revision, abbreviated output, or revision drift between
enumeration and reads.

At the selected revision, `git ls-tree -r --name-only SHA -- MEMORY` determines
the bounded root-memory fact. When it returns zero paths, record
`rootMemoryTracked: false`. Do not probe ignored files, treat `docs/memory/` as
a root `MEMORY/` substitute, or infer anything about provider-owned memory.

The complete corpus is the union of the committed named root-document set and
all tracked entries under `docs/` and `.planning/` at that same SHA. No tracked
path within those declared scopes may be silently excluded because it looks
generated, historical, binary, large, or callable. Classification may use
bounded metadata for non-text blobs; it must not emit their bodies.

**Classification and exception pattern**
(`scripts/generate-docs-retention-manifest.mjs:137-177`):

```javascript
const entries = tracked.map((file) => {
  const blob = readHeadBlob(file);
  const hash = sha256(blob);
  const inbound = corpus
    .filter(({ file: source, body }) => referencesFile(source, body, file))
    .map(({ file: source }) => source)
    .sort();
  const retentionClass = file.includes('/product-branches/')
    ? 'retain-active'
    : duplicate || (file.includes('/assets/') && !inbound.length)
      ? 'review-required'
      : file.includes('/assets/') ? 'retain-proof' : 'retain-historical';
  return { path: file, bytes: blob.length, sha256: hash, gitTracked: true,
    retentionClass, restorationMethod: 'Git history', decision: 'retain' };
});
```

Replace these retention classes with the Phase 6 five-class vocabulary. Keep
the useful patterns: deterministic inbound references, content digests,
restoration evidence, and item-level classification. Implement precedence as
explicit item/index-backed exception over directory default. In particular,
`docs/plans/README.md:8-11` says an active branch packet is an exception only
when listed in `product-branches/index.md`; the directory name alone is not
sufficient evidence.

The source adapter should define bounded rules for each inventory field:

- `provenance`: safe path, reviewed revision/blob digest, and source-backed rule;
- `presentPurpose`: closed concise purpose, never copied mutable status;
- `overlap`: bounded path references or stable category identifiers;
- `recommendedDisposition`: non-destructive values only for this phase;
- `canonicalAnchors`: direct repository-relative links, not copied doctrine;
- `lifecycle`: one of the exact five classes;
- `exception`: nullable, explicit, evidence-backed override of a directory default.

---

### `scripts/generate-documentation-inventory.mjs` (zero-write CLI renderer, request-response)

**Analogs:** `scripts/generate-temperance-flow.mjs` and
`scripts/proactive-loop-tick.mjs`

**Argument validation pattern** (`scripts/generate-temperance-flow.mjs:18-52`):

```javascript
function usage(message) {
  throw new TypeError(message ?? 'usage: generate-temperance-flow.mjs (--write|--check|--json) ...');
}

if (['--write', '--check', '--json'].includes(argument)) {
  if (options.mode) usage('exactly one mutually exclusive mode is required');
  options.mode = argument.slice(2);
}
```

Copy the strict parser, not its write modes. Phase 6 should require exactly:

```text
generate-documentation-inventory.mjs --source-revision REV --format (json|markdown)
```

An optional `--root PATH` is acceptable only for isolated test repositories.
There is no default revision and no `--write`, `--check`, `--output`,
`--json-output`, `--markdown-output`, staged/index mode, or runtime/provider
argument. Requiring the revision makes provenance deliberate; requiring one
format keeps stdout a single parseable document.

**Stdout format-selection pattern** (`scripts/proactive-loop-tick.mjs:19`,
`scripts/generate-temperance-flow.mjs:136-144`):

```javascript
const asJson = args.includes('--json');

const projection = compile(options);
const json = `${JSON.stringify(projection, null, 2)}\n`;
if (options.mode === 'json') process.stdout.write(json);
```

For Phase 6, compile and validate one inventory object, then select exactly one
pure renderer:

```javascript
const inventory = validateDocumentationInventory(compileDocumentationInventory(source));
const output = options.format === 'json'
  ? `${JSON.stringify(inventory, null, 2)}\n`
  : renderDocumentationInventoryMarkdown(inventory);
process.stdout.write(output);
```

Successful execution writes only the selected representation to stdout. It
must not write files, make directories, update Git, touch mtimes, invoke GSD,
or create temporary publication residue. Failures are nonzero with bounded,
repository-relative diagnostics on stderr and no partial stdout document.

Package scripts may expose both formats without pinning mutable state:

```json
{
  "docs:inventory:json": "node scripts/generate-documentation-inventory.mjs --format json",
  "docs:inventory:markdown": "node scripts/generate-documentation-inventory.mjs --format markdown"
}
```

The caller still supplies `--source-revision <REV>` after `--`; scripts must
not hardcode `HEAD`, a planning SHA, or an output destination. A separate
`docs:inventory:check` command may run both formats twice for the caller's
revision and assert determinism/parity, but it also remains zero-write.

---

### Inventory tests (test, transform and file-I/O)

**Analog:** `scripts/generate-temperance-flow.test.mjs`

**Temporary-root and source-preservation pattern**
(`scripts/generate-temperance-flow.test.mjs:46-103`):

```javascript
function runGenerator(root, args, { succeeds = true } = {}) {
  const result = spawnSync(process.execPath, [generatorPath, '--root', root, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (succeeds) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, 'generator was expected to fail');
  return result;
}

function snapshot(root, excluded = new Set()) {
  return Object.fromEntries(walkFiles(root)
    .filter((relativePath) => !excluded.has(relativePath))
    .map((relativePath) => [relativePath, readFileSync(path.join(root, relativePath))]));
}
```

**Determinism, parity, and source-preservation adaptation**
(`scripts/generate-temperance-flow.test.mjs:154-208`):

```javascript
const before = snapshot(fixture.root);
const firstJson = runGenerator(fixture.root,
  ['--source-revision', fixture.sha, '--format', 'json']).stdout;
const secondJson = runGenerator(fixture.root,
  ['--source-revision', fixture.sha, '--format', 'json']).stdout;
const markdown = runGenerator(fixture.root,
  ['--source-revision', fixture.sha, '--format', 'markdown']).stdout;
assert.equal(secondJson, firstJson);
assert.deepEqual(snapshot(fixture.root), before);
// parse JSON and assert Markdown carries the same SHA, digest, and entry set
```

Phase 6 tests should name `DOCS-01` through `DOCS-04` and cover:

- exact five-class rejection/acceptance and closed-field validation;
- an explicit revision is mandatory and resolves once to one full 40-hex commit SHA;
- every enumeration/read uses that SHA; dirty working-tree and staged bytes are ignored;
- identical stdout bytes across input order, checkout path, clock, locale, and repeated runs;
- JSON/Markdown parity for the full SHA, inventory digest, entry count, entry paths,
  lifecycle values, and exception facts;
- missing, ambiguous, abbreviated, or non-commit revisions fail before output;
- a second commit produces a distinct source revision without making the first stale;
- no tracked root `MEMORY/` represented explicitly, without reading ignored memory;
- explicit item exceptions outrank directory defaults; unindexed packets do not;
- every entry includes provenance, purpose, overlap, disposition, and anchor links;
- every tracked path in named root documents, `docs/`, and `.planning/` at the
  selected SHA appears exactly once; non-text files receive metadata, not bodies;
- stdout readbacks, indexes, and lifecycle prose cannot claim ISA/GSD authority;
- JSON stdout parses as exactly one object and Markdown stdout is one complete document;
- no source mutation, relocation, deletion, file creation, temporary output,
  Git index update, external write, or other side effect;
- rejection of absolute paths, secrets, credentials, session IDs, prompt/response bodies, and raw private memory;
- rejected invocations emit no partial stdout and bounded repository-relative stderr.

Use Node built-ins and `node:test`; no dependency or lockfile change is needed.
The root `package.json:9` test glob already includes all `scripts/*.test.mjs`.

---

### On-demand machine/human formats and committed contract (model/contract)

**Analogs:** `docs/architecture/temperance-flow.v1.json`,
`docs/architecture/temperance-flow.md`, and
`docs/architecture/contracts/temperance-flow-v1.md`

The Phase 4/5 readbacks remain structural renderer analogs only. Phase 6 does
not add either generated artifact to Git. Its committed contract should state:

- one inventory schema and `read_only` authority;
- explicit-revision input, full-SHA resolution, commit-tree-only reads, and
  source-set/inventory digest semantics;
- JSON and Markdown are on-demand stdout formats derived from one validated
  object, never durable authorities or freshness ledgers;
- the five lifecycle classes and exception precedence;
- required per-entry fields for DOCS-02;
- `rootMemoryTracked: false` (or equivalent closed fact) when proven for the
  selected revision, not as a timeless repository claim;
- references to root anchors, ISA, GSD state, contracts, and runbooks by safe path;
- historical/evidentiary recovery semantics;
- no action queue, relocation decision, deletion decision, provider/runtime
  configuration, deployment instruction, copied doctrine, copied live status,
  output-file publication, or hidden write behavior.

Avoid calling either stdout representation “canonical.” They are ephemeral
views of canonical and non-canonical sources at one commit, not new sources.

---

### `docs/LIFECYCLE.md` (canonical lifecycle map, navigation/reference)

**Analog:** existing `docs/LIFECYCLE.md`

The current table already establishes one owner per truth class and the
authority split (`docs/LIFECYCLE.md:3-20`):

```markdown
Cambium keeps one owner for each kind of truth:

| Surface | Meaning | May contain current instructions? |
| --- | --- | --- |
| [`VISION.md`](../VISION.md) | Near-invariant doctrine | Doctrine only |
| `ISA.md` | Current implementation acceptance and verification | Yes, while active |
| `docs/runbooks/` | Current operator procedures | Yes |
| `docs/evidence/` | Immutable dated proof | No |
| `docs/plans/` | Historical implementation records | No |
```

Extend this file rather than adding another authority map. Preserve the live
state rule at `docs/LIFECYCLE.md:22-28`: current procedures discover live state;
committed temporal artifacts do not become authority because they are newer.
Add the exact five-class legend, directory defaults, item exceptions, root
`MEMORY/` absence semantics, and direct copyable commands for producing JSON
or Markdown at a caller-selected commit. Link to the committed inventory
contract, not to nonexistent generated files. Wording must distinguish the
current selected revision from a timeless absence claim.

Use the explicit exception wording from `docs/plans/README.md:3-11`:

```markdown
Date-stamped plans in this directory are historical implementation records.
...
`product-branches/` is the explicit exception. Its indexed branch packets,
schema, and evidence inventory are active, machine-validated operating data.
```

Prefer a small exception manifest/rule table over inserting banners into many
historical files. Callable-looking history may receive a targeted
non-operational label, but Phase 6 must not bulk-rewrite evidence bodies.

---

### Additive indexes (component/config, navigation)

**Analogs:** existing `PROJECT.md`, `README.md`, `docs/README.md`,
`docs/doctrine/README.md`, and `.planning/README.md`

`PROJECT.md:32-49` is the strongest navigation pattern: name the authority,
then link to additive maps without copying their contents.

```markdown
The root anchors own doctrine only. [`ISA.md`](./ISA.md) owns approved goals and acceptance;
GSD under [`.planning/`](./.planning/) owns finite planning state.
Supporting and generated surfaces link to those authorities rather than copying them.

### Doctrine & planning maps (additive indexes)
```

`docs/README.md:1-4` supplies the index disclaimer; `docs/README.md:23-32`
demonstrates direct links to ISA, GSD, contracts, runbooks, and architecture;
`docs/README.md:38-48` keeps historical and proof navigation separate from
current operating truth. Add inventory discovery as a link to the committed
contract plus copyable JSON/Markdown commands that require an explicit
revision. Do not add links that imply generated output files exist in Git.

`docs/doctrine/README.md:6-21` is a catalog table, not a doctrine restatement.
Preserve that role and add only direct lifecycle/inventory discovery links.

`README.md:257-286` is a product discovery table. Add one concise route to the
documentation map/lifecycle/on-demand inventory contract; do not turn the
product README into a second lifecycle map or copy the current GSD command.

`.planning/README.md:20-23` already has the correct reading-order pattern:
read `STATE.md` directly. Remove or replace the frozen claim at
`.planning/README.md:15-16` (“Status: Complete” and its derived action), because
it contradicts the locked decision that live `.planning/STATE.md` outranks
copied prose. Do not generate a new status sentence in its place.

## Shared Patterns

### Authority and lifecycle precedence

Apply to the compiler, source model, stdout renderers, lifecycle map, and every index:

1. `VISION.md` and `MISSION.md` own doctrine.
2. `ISA.md` owns approved goals and acceptance.
3. live `.planning/STATE.md` owns the current finite transition.
4. contracts and runbooks own bounded operating instructions.
5. on-demand inventory representations are `derived`, ephemeral, and read-only.
6. directory defaults yield to explicit, source-backed item exceptions.

### Repository-relative provenance and privacy

Use the safe-path and redaction style in `scripts/temperance-flow.mjs:46-63`
and `122-147`. Outputs may contain safe relative paths, stable digests, and
bounded classifications. They must not contain document bodies, vault notes,
raw memory, machine-local absolute paths, credentials, provider stacks, native
session identifiers, prompt/response bodies, or runtime identifiers.

### Non-destructive inventory

The 2026-08-10 inventory is evidence and a technique source, not the new
authority. Its operative precedent is explicit (`.planning/2026-08-10-documentation-retention-inventory.md:11-13`):

```markdown
Do not delete, move, merge, externalize, or auto-deduplicate any documentation
asset in this pass.
```

The Phase 6 disposition vocabulary must remain recommendations only. There is
no file operation or external action behind a classification.

### Package scripts and verification

`package.json:8-9` makes `npm test` the aggregate deterministic gate and already
discovers new script tests. Add JSON and Markdown convenience scripts whose
fixed portion selects only the format; the caller must append
`-- --source-revision <REV>`. If a named `docs:inventory:check` is added, it
must independently generate both formats twice for that caller-supplied
revision, compare determinism and parity in memory, and perform zero writes.
Keep the dependency set unchanged.

## Implementation Landmines

- Do not call either on-demand inventory format, its renderer, or an index a new
  authority. `docs/LIFECYCLE.md` is the human map; source authorities remain in
  their existing owners.
- Do not infer current instructions from file recency, an unchecked box, a
  historical command, or a dated handoff. Inventory classification is not
  execution readiness.
- Do not classify all `docs/plans/` uniformly. Indexed product-branch packets
  are an explicit item-level exception; unindexed lookalikes do not inherit it.
- Do not conflate missing tracked root `MEMORY/` with `docs/memory/`, and do not
  probe ignored/provider-owned runtime memory to fill the gap.
- Do not add committed inventory JSON/Markdown files, output selectors, staged
  or index modes, or a publication helper. Ephemeral stdout avoids recursive
  freshness by construction.
- Do not copy mutable `.planning/STATE.md` status or next-command prose into an
  index. Link to the file directly.
- Do not use timestamps, filesystem traversal order, locale-sensitive implicit
  ordering, checkout paths, or Git commit dates as semantic identity.
- Do not allow JSON and Markdown to compile different models. Each invocation
  selects one pure renderer over the same validated inventory contract, and
  parity tests compare their shared revision, digest, and entry identity.
- Do not assume `execution_mode: sequential-in-place`, suppress normal GSD
  summaries/state/roadmap updates, or require a host workflow change. These
  plans must run through the installed GSD lifecycle unchanged.
- Do not reuse the 2026-08-10 retention classes as the lifecycle vocabulary.
  They solve a narrower evidence-retention question.
- Do not modify the historical evidence bodies in bulk, relocate paths, delete
  duplicates, update external systems, or mutate provider/runtime state.

## No Analog Found

None. The complete Phase 6 shape is covered by the shipped Phase 4/5 pure
compiler/renderers, the 2026-08-10 commit-tree retention generator, strict CLI
parsers and stdout commands, and the existing lifecycle/index files. The exact
Phase 6 schema and explicit-revision interface are new, but their implementation
roles are not.

## Metadata

**Analog search scope:** `scripts/`, named root documents, `docs/`, `.planning/`,
Phase 4/5 planning and verification artifacts

**Repository files scanned:** 1,077 tracked files; 573 under `scripts/`, `docs/`,
and `.planning/`

**Strong analogs read:** 5 implementation/test files plus lifecycle, memory,
retention, and navigation contracts

**Pattern extraction date:** 2026-08-20
