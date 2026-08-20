# Phase 7: Deterministic Safety and Handoff - Pattern Map

**Mapped:** 2026-08-21
**Files classified:** 11 likely new/modified files
**Analogs found:** 11 / 11

## Planning Boundary

Phase 7 is a **zero-write, commit-tree validator** plus a **reviewed-held
handoff**. It may inspect one explicit committed revision, fail closed on
SAFE-01..03 hits, and append one human checkpoint. It does not relocate or
delete corpus files, does not publish a third projection family, and does not
mutate D1, Workers, Vectorize, tenants, TeamForge, host Temperance, or
provider state.

The filenames below are the smallest pattern-compatible shape inferred from
`07-CONTEXT.md` and `07-RESEARCH.md`. The planner retains naming discretion
inside the locked public command `npm run --silent safety:check --
--source-revision <REV>`, but should preserve the same roles: a pure compiler,
one zero-write CLI, adversarial synthetic-Git tests, one package-level CLI
test, one committed contract, ISA/handoff closeout, and an extended Phase 6
lifecycle/privacy sentinel.

Do **not** commit a generated safety JSON/Markdown pair. Follow the inventory:
ephemeral stdout receipt only. `07-SUMMARY.md` is created by execute-plan, not
precreated. `.planning/STATE.md`, `.planning/ROADMAP.md`, and
`.planning/REQUIREMENTS.md` remain orchestrator closeout, not this phase's
implementation write set.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/deterministic-safety.mjs` | utility/compiler | transform + commit-tree I/O | `scripts/documentation-inventory.mjs` + digest/select helpers from `scripts/intent-graph.mjs` and `scripts/temperance-flow.mjs` | exact composite |
| `scripts/check-deterministic-safety.mjs` | zero-write CLI | request-response | `scripts/check-documentation-inventory.mjs` | exact |
| `scripts/deterministic-safety.test.mjs` | test | transform + adversarial file-I/O | `scripts/documentation-inventory.test.mjs` | exact |
| `scripts/check-deterministic-safety.test.mjs` | test | request-response + package CLI | `scripts/generate-documentation-inventory.test.mjs` | exact |
| `docs/architecture/contracts/deterministic-safety-v1.md` | contract | request-response/readback contract | `docs/architecture/contracts/documentation-inventory-v1.md` | exact |
| `package.json` | config/scripts | command dispatch | existing `docs:inventory:check` script | exact extension |
| `ISA.md` | acceptance model | request-response | existing Phase 6 `ISC-1286..1289` slice | exact extension |
| `.project/HANDOFF.md` | reviewed-held checkpoint | event-driven append | 2026-08-20 Phase 6 checkpoint + 06-04 Task 2 | exact extension |
| `scripts/infinite-game-anchors.test.mjs` | lifecycle/privacy sentinel | validation | existing Phase 6 `isCoherentIsaPhaseState` + `privacyViolations` | exact extension |
| `scripts/intent-graph.mjs` (optional export only) | utility | transform | existing file-private `digestText` / `selectContent` | exact extension |
| `scripts/temperance-flow.mjs` (optional export only) | utility | transform | existing file-private `digestText` / `selectContent` / handoff redaction | exact extension |

Reuse, do not fork: `scripts/documentation-inventory-sources.mjs` remains the
SAFE-01 path-set authority. Complementary Wave 3 evidence (not the SHA-bound
gate): `node scripts/generate-intent-graph.mjs --check` and
`node scripts/generate-temperance-flow.mjs --check`. Do not add
`safety:check` to `scripts/verify-release.mjs` this phase.

## Pattern Assignments

### `scripts/deterministic-safety.mjs` (utility/compiler, transform)

**Primary analog:** `scripts/documentation-inventory.mjs`
**Digest/selector analogs:** `scripts/intent-graph.mjs`, `scripts/temperance-flow.mjs`
**Path-set analog (reuse, do not reimplement):** `scripts/documentation-inventory-sources.mjs`

This file is a **pure** SAFE-01..03 compiler: no CLI, no writes, no
`readFileSync` of worktree bodies for the SHA-bound gate. Consume
`buildDocumentationInventorySources`, then re-read the same blobs via
`git show FULL_SHA:path` for paragraph/privacy scans. Do not feed bodies into
`compileDocumentationInventory` (that compiler is body-free and rejects
private-shaped text).

**Closed schema and forbidden-key pattern**
(`scripts/documentation-inventory.mjs:1-32`):

```javascript
import { createHash } from 'node:crypto';
import path from 'node:path';

export const DOCUMENTATION_INVENTORY_SCHEMA = 'cambium.documentation-inventory.v1';
export const DOCUMENTATION_INVENTORY_AUTHORITY = 'read_only';

const FORBIDDEN_KEYS = new Set([
  'archive', 'command', 'credential', 'credentials', 'delete', 'dispatch',
  'externalize', 'move', 'output', 'outputFile', 'promptBody', 'provider',
  'providerStack', 'queue', 'relocate', 'requestBody', 'responseBody',
  'runtime', 'scheduler', 'sessionId', 'write',
]);
const PRIVATE_TEXT = /(?:\/(?:Users|Volumes)\/|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|Bearer\s+[A-Za-z0-9._~-]{8,}|\b(?:api[_-]?key|credential|secret|token)[=:][^\s]+)/i;
```

Copy the shape, not the inventory vocabulary. Phase 7 needs its own closed
hit-object (path, gate `SAFE-01|SAFE-02|SAFE-03`, reason) plus
`projectionAuthority: "read_only"`. Reject extra keys and writer fields
(`write`, `fix`, `output`, `queue`, `dispatch`). Keep Unix roots case-exact
(`/Users/`, `/Volumes/`) like inventory `PRIVATE_TEXT` and Temperance
`SECRET_TEXT` (`scripts/temperance-flow.mjs:48`).

**Commit-tree isolation pattern**
(`scripts/documentation-inventory-sources.mjs:39-57`, `108-153`):

```javascript
function runGit(root, args, { encoding = 'utf8' } = {}) {
  const result = spawnSync('/usr/bin/git', [
    '--no-replace-objects',
    '--no-optional-locks',
    '-C', root,
    ...args,
  ], {
    encoding: encoding === null ? null : encoding,
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' },
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new TypeError(`Git revision read failed: ${bounded}`);
  }
  return result.stdout;
}

const resolved = String(runGit(root, ['rev-parse', '--verify', `${options.sourceRevision}^{commit}`])).trim();
if (!FULL_COMMIT_SHA.test(resolved)) throw new TypeError('sourceRevision must resolve exactly once to a full commit SHA');
const body = runGit(root, ['show', `${resolved}:${entry.path}`], { encoding: null });
```

Every SAFE-01..03 read uses that one resolved SHA. Path-set equality with
`buildDocumentationInventorySources(...).corpusPaths` is mandatory. Untracked
`MEMORY/` is a bounded `rootMemoryTracked` fact only; never probe ignored
files.

**Canonical text and selector digest pattern**
(`scripts/intent-graph.mjs:102-121`, `228-298`;
`scripts/temperance-flow.mjs:102-112`, `183-234`, `243-252`):

```javascript
function canonicalText(value) {
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
}

function digestText(value) {
  return `sha256:${createHash('sha256').update(canonicalText(value), 'utf8').digest('hex')}`;
}

function digestObject(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

// Intent Graph freshness: digestText(selectContent(blob, recordedSelector))
const actualDigest = digestText(selected);
if (actualDigest !== source.digest) {
  throw new TypeError(`source digest mismatch for ${normalized}#${source.selector}`);
}

// Temperance Flow reviewed_handoff redaction BEFORE hashing
const digestable = value.kind === 'reviewed_handoff'
  ? selected
    .replace(/(`implementation_head` is `)[a-f0-9]{40}(`)/, '$1<reviewed-implementation-head>$2')
    .replace(/^(- Generated (?:flowDigest|sourceSetDigest): )sha256:[a-f0-9]{64}$/gm, '$1<reviewed-generated-digest>')
  : selected;

// Intent Graph overlay anchors are whole-file digestText, not Git SHA-1
const actualDigest = digestText(readFileSync(actual, 'utf8'));

// Temperance intentGraph.digest is digestText of JSON file bytes, NOT graphDigest
const actualDigest = digestText(readFileSync(actual, 'utf8'));
```

These helpers are **file-private today**. Prefer exporting them (or one shared
`scripts/source-digest.mjs` moved from existing code) over copy-paste.
`text.line:` exists only in Temperance (`scripts/temperance-flow.mjs:202-205`).
Intent Graph also has `markdown.bold-field:` (`scripts/intent-graph.mjs:239-253`).
Inventory `contentDigest` is raw-blob `digestBuffer`
(`scripts/documentation-inventory-sources.mjs:74-76`); D-10 says **do not**
freshness-check ephemeral inventory stdout.

**SAFE-03 freshness diagnostic analog**
(`scripts/generate-intent-graph.mjs:90-127`;
`scripts/generate-intent-graph.test.mjs:156-174`):

```javascript
byIdentity.set(`${tuple.path}#${tuple.selector}`, tuple.digest);
diagnostics.push(`source changed: ${identity}`);
// test asserts:
assert.match(result.stderr, /\.planning\/ROADMAP\.md/);
assert.match(result.stderr, /markdown\.bold-field:Phase 4: Provenance-Preserving Intent Graph#Goal/);
```

SHA-bound freshness must print the same `path#selector` form, sourced from
committed blobs, not worktree `readFileSync`. Tracking-only ISA `progress`
edits must not fail Intent Graph freshness
(`scripts/generate-intent-graph.test.mjs:186-206`).

**SAFE-02 overlay analog** (`scripts/intent-graph.test.mjs:366-383`;
`scripts/intent-graph.mjs:413-426`, `434-460`):

```javascript
assert.equal(overlay.source.authority, 'derived_reference');
assert.equal('content' in overlay, false);
(node) => { node.source.authority = 'vision_anchor'; }  // throws
(node) => { node.content = 'Continue meaningful play.'; } // throws
```

SAFE-02 extends this from compiler-internal fields to committed overlay
prose/manifests. Schema/role fields are primary:

- `projectionAuthority` other than `read_only`
- `role` in `{sole_operational_writer, planning authority, goal-setting}`
- `active_planner` other than `isa` / `gsd` / omitted
- `sourceOfTruth` claiming ISA/GSD
- Ralph `cambium.ralph-iteration.v1` writer fields (`queue`, `dispatch`,
  `selfCertified`) — persistence is already closed to `summary`, `state`,
  `handoff` (`scripts/ralph-iteration.mjs:103-105`)

Scan **only** the D-05 surface list (see Shared Patterns). Do not substring
the whole inventory corpus. Allowed claimants: `ISA.md`, `.planning/STATE.md`.
Allow denials such as `docs/LIFECYCLE.md:45` (“recency never grants release or
planning authority”) and legends that define `gsd_planning`.

**Compile once, validate closed, no stdout document on failure**
(`scripts/documentation-inventory.mjs:166-229`, `289-319`):

```javascript
assertClosed(input, ['sourceRevision', 'corpusPaths', ...], 'documentation inventory source model');
if (!FULL_COMMIT_SHA.test(input.sourceRevision)) throw new TypeError('sourceRevision must be a full lowercase 40-hex commit SHA');
const withoutDigest = { schema, projectionAuthority: 'read_only', sourceRevision, ... };
return validateDocumentationInventory({ ...withoutDigest, inventoryDigest: digestObject(withoutDigest) });
```

Phase 7 returns a validated receipt object (resolved SHA, path-set digest or
entry count, empty hits) or throws with repository-relative paths. It never
rewrites the offending file.

---

### `scripts/check-deterministic-safety.mjs` (zero-write CLI, request-response)

**Analog:** `scripts/check-documentation-inventory.mjs`
**Parser sibling:** `scripts/generate-documentation-inventory.mjs:15-67`

Copy the closed grammar, not inventory double-generation of JSON/Markdown.
`safety:check` is one command covering SAFE-01..03 internally.

**Argument validation pattern**
(`scripts/check-documentation-inventory.mjs:15-56`):

```javascript
function usage(message) {
  throw new TypeError(message ?? 'usage: check-documentation-inventory.mjs --source-revision REV');
}

export function parseDocumentationInventoryCheckArguments(argv, { repositoryRoot = defaultRepositoryRoot } = {}) {
  const options = { repositoryRoot, sourceRevision: null };
  // --source-revision exactly once; optional --root at most once for fixtures
  // unknown or forbidden argument ${String(argument).slice(0, 80)}
  if (options.sourceRevision === null) usage('--source-revision is required');
  if (!REVISION_TEXT.test(options.sourceRevision) || path.isAbsolute(options.sourceRevision)) {
    usage('--source-revision must be bounded revision text');
  }
}
```

Reject `--write`, `--output`, `--fix`, `--check`, `--format`, provider, and
staged/index flags. `HEAD` is valid only when explicitly supplied and is
immediately serialized as the resolved SHA. Optional `--root PATH` is
acceptable only for contained fixture repositories and must be absolute.

**Receipt and fail-closed CLI pattern**
(`scripts/check-documentation-inventory.mjs:123-149`):

```javascript
function safeDiagnostic(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/Git revision read failed|resolve exactly once to a full commit SHA/i.test(message)) {
    return 'source revision could not be resolved to one commit';
  }
  if (/ENOENT|ENOTDIR|repositoryRoot|repository root|realpath/i.test(message)) return 'repository root is invalid';
  return message
    .replace(/(?:\/(?:Users|Volumes|private|tmp|var|home)(?:\/[^\s:]+)+)/gi, '<redacted-path>')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer <redacted>')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 300);
}

io.stdout.write(`documentation inventory check passed: ${result.sourceRevision} ${result.inventoryDigest} entries=${result.entryCount}\n`);
// on catch: stderr safeDiagnostic; process.exitCode = 1; no partial stdout document
```

Adapt the success line to:

```text
deterministic safety check passed: <FULL_SHA> sha256:<digest> entries=<N>
```

On any SAFE-01..03 hit: non-zero exit, print repository-relative path(s) on
stderr, no rewrite, no publish. Tests assert stderr does not match
`/Users/|/Volumes/` (`scripts/generate-documentation-inventory.test.mjs:270`).

---

### `scripts/deterministic-safety.test.mjs` (test, transform + adversarial file-I/O)

**Analog:** `scripts/documentation-inventory.test.mjs`

Copy the synthetic two-commit Git fixture, dirty/staged/`MEMORY/` isolation,
and replacement-ref denial. Name tests `SAFE-01`, `SAFE-02`, `SAFE-03`.

**Fixture and isolation pattern**
(`scripts/documentation-inventory.test.mjs:1-57`, `139-180`, `182-204`):

```javascript
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function createRepository(files = {}) {
  const repositoryRoot = mkdtempSync(path.join(os.tmpdir(), 'cambium-doc-inventory-'));
  runGit(repositoryRoot, ['init', '--quiet']);
  // commit fixture; return { repositoryRoot, sourceRevision: rev-parse HEAD }
}

// DOCS-02 dirty/staged/MEMORY isolation — copy for SAFE-01:
writeFixtureFile(fixture.repositoryRoot, 'docs/guide.md', '# Guide\ndirty-body\nsecret=do-not-read\n');
writeFixtureFile(fixture.repositoryRoot, 'MEMORY/private.md', 'raw private memory\n');
const sources = buildDocumentationInventorySources({
  repositoryRoot: fixture.repositoryRoot,
  sourceRevision: 'HEAD',
});
assert.doesNotMatch(JSON.stringify(inventory), /dirty-body|raw private memory/i);
assert.equal(inventory.rootMemory.tracked, false);

// replacement refs cannot substitute another tree
runGit(fixture.repositoryRoot, ['replace', fixture.sourceRevision, replacementRevision]);
```

Phase 7 adaptations:

- SAFE-01: copy a VISION/MISSION paragraph into a fake overlay at SHA → non-zero;
  titles, filenames, and `sha256:` digests allowed; dirty worktree ignored;
  path set equals inventory `corpusPaths`; untracked `MEMORY/` absent.
- SAFE-02: hostile `active_planner` / `projectionAuthority: planning` /
  self-claim “this file is the planning authority” fails; `ISA.md` and
  `.planning/STATE.md` allowed; LIFECYCLE denial passes;
  `.temperance/project.json` with `active_planner: "isa"` passes;
  `active_planner: "ralph"` fails.
- SAFE-03: recorded source digest ≠ recomputed SHA blob digest fails with
  `path#selector`; `/Users/`, `/Volumes/`, `promptBody=` fail; Worker UUID
  `089181f6-ed60-4710-aab6-cd10855360e0` and CF account IDs do not.
- Split hostile fixture strings like T-06-22 (`scripts/infinite-game-anchors.test.mjs:139-165`).
- Use `node:test` / `node:assert/strict`; no new packages.
- Wave 0 is RED-first (`scripts/intent-graph.test.mjs:8-13` lazy import so
  missing modules fail as named contract assertions).

Paragraph-match rule to lock in Wave 1 against the real SHA (RESEARCH A3):
normalize with `canonicalText`, fold whitespace/punctuation, drop ATX
headings, link-only lines, and blocks with folded length &lt; 80. HEAD
currently has 0 hits at that threshold.

---

### `scripts/check-deterministic-safety.test.mjs` (test, request-response)

**Analog:** `scripts/generate-documentation-inventory.test.mjs`

This is the package-level CLI suite (parser, stdout receipt, zero-write,
fail-closed paths, `npm run --silent safety:check`).

**Spawn, snapshot, and package-command pattern**
(`scripts/generate-documentation-inventory.test.mjs:142-168`, `246-291`, `322-348`):

```javascript
function runNode(script, root, args, { succeeds = true, env = {} } = {}) {
  const result = spawnSync(process.execPath, [script, '--root', root, ...args], {
    cwd: repositoryRoot, encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C', ...env },
  });
}

function runNpm(script, args, { succeeds = true } = {}) {
  return spawnSync('npm', ['run', '--silent', script, '--', ...args], { cwd: repositoryRoot, encoding: 'utf8' });
}

// malformed / write-capable requests fail before stdout and preserve source plus index
const cases = [
  [],
  ['--source-revision', 'missing-revision'],
  ['--source-revision', `${fixture.second}^{tree}`],
  ['--source-revision', fixture.second, '--write'],
  ['--source-revision', fixture.second, '--output', path.join(outside, 'leak.json')],
  ['--source-revision', fixture.second, '--unknown', 'value'],
];
assert.equal(result.stdout, '');
assert.ok(result.stderr.length > 0 && result.stderr.length <= 320);
assert.doesNotMatch(result.stderr, /\/Users\/|\/Volumes\//);
assert.deepEqual(snapshot(fixture.root), before);

// checker receipt
assert.match(result.stdout, new RegExp(`^documentation inventory check passed: ${fixture.first} sha256:[a-f0-9]{64} entries=\\d+\\n$`));

// package scripts do not hardcode HEAD
assert.equal(packageJson.scripts['docs:inventory:check'], 'node scripts/check-documentation-inventory.mjs');
const checked = runNpm('docs:inventory:check', ['--source-revision', revision]);
```

Adapt:

- Assert `package.json` script `safety:check` equals
  `node scripts/check-deterministic-safety.mjs`.
- Success stdout matches
  `^deterministic safety check passed: <40-hex> sha256:[a-f0-9]{64} entries=\d+\n$`.
- Hostile overlay at SHA exits non-zero and names the repository-relative path.
- Lockfiles (`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`) are
  byte-unchanged (`scripts/generate-documentation-inventory.test.mjs:329-348`).

---

### `docs/architecture/contracts/deterministic-safety-v1.md` (contract)

**Analog:** `docs/architecture/contracts/documentation-inventory-v1.md`
**Authority wording also from:** `docs/architecture/contracts/intent-graph-v1.md:7-13`
and `docs/architecture/contracts/temperance-flow-v1.md:1-12`

Copy the inventory contract's status/authority, explicit-revision, corpus,
zero-write, and no-committed-readback sections. Replace lifecycle vocabulary
with SAFE-01..03 surfaces, selectors, and fail-closed behavior.

Must state:

- schema/authority: inspection-only, `read_only`, not doctrine/ISA/GSD;
- `--source-revision <REV>` required; `git rev-parse --verify REV^{commit}`
  once; full 40-hex SHA thereafter;
- public invocation:

```bash
npm run --silent safety:check -- --source-revision <REV>
```

- corpus = Phase 6 inventory path set (root `*.md` + `docs/` + `.planning/`);
  `.temperance/project.json` is a **named extra SAFE-02 surface** (not in the
  inventory corpus);
- SAFE-01: normalized paragraph match of `VISION.md` / `MISSION.md` only;
  titles, filenames, digest references allowed;
- SAFE-02: closed D-05 list + schema/role fields + claim-vs-denial grammar;
  allowed claimants `ISA.md` and live `.planning/STATE.md`;
- SAFE-03: freshness only for generated projections that already declare
  source digests (Intent Graph JSON/MD, Temperance Flow JSON/MD); recompute
  with recorded selector + same digest function; privacy on those projections
  plus Phase 7 changed-path sentinel; D-11 allowlists;
- no `--write` / `--fix` / committed safety report;
- on hit: non-zero exit, print path, do not rewrite.

---

### `package.json` (config, command dispatch)

**Analog:** `package.json:8-9`, `53-55`

```json
"test": "node --test 'scripts/*.test.mjs' ...",
"docs:inventory:json": "node scripts/generate-documentation-inventory.mjs --format json",
"docs:inventory:markdown": "node scripts/generate-documentation-inventory.mjs --format markdown",
"docs:inventory:check": "node scripts/check-documentation-inventory.mjs"
```

Add only:

```json
"safety:check": "node scripts/check-deterministic-safety.mjs"
```

Caller still supplies `-- --source-revision <REV>`. Do not hardcode `HEAD`.
Do not change `dependencies` (empty) or any lockfile (T-06-SC analog T-07-SC).
The existing `scripts.test` glob already picks up `scripts/*.test.mjs`.
Do **not** add this command to `scripts/verify-release.mjs:5-27`; Wave 3 ISA
evidence runs `safety:check` explicitly, same as Phase 6 did for inventory
check.

---

### `ISA.md` (acceptance model)

**Analog:** existing Phase 6 slice (`ISA.md:213-226`, `1574`, `1691`) plus
06-01 Task 1 (`06-01-PLAN.md:97-105`) and 06-04 Task 2.

Preserve completed Phase 3–6 headings. Add exactly one Phase 7 slice:

```markdown
### Active Phase 7 acceptance
- [ ] ISC-1290: SAFE-01 proves deterministic validation fails when canonical vision or mission doctrine is duplicated outside its allowed anchors.
- [ ] ISC-1291: SAFE-02 proves deterministic validation fails when a manifest, Ralph state file, generated graph, or documentation overlay claims goal-setting or planning authority.
- [ ] ISC-1292: SAFE-03 proves deterministic validation fails when generated projections are stale relative to their source digests or contain secrets, session identifiers, prompt bodies, or machine-local absolute paths.
- [ ] ISC-1293: SAFE-04 proves a reviewed handoff records the bounded write set, verification evidence, unresolved approval boundaries, and the exact next GSD command.
```

Wave 1 starts at `phase: plan`, `progress: 0/4` with all four unchecked.
Implementation close (Wave 3) checks them and moves to `verify` / `4/4` only
after gates pass, recording observed commands like Phase 6
(`ISA.md:220-226`).

Features line analog (`ISA.md:1688-1691`):

```text
`DeterministicSafetyAndHandoff` | fail-closed commit-tree validation plus reviewed-held handoff without creating another authority | satisfies ISC-1290..1293 | depends_on DocumentationStewardship | parallelizable false
```

Test Strategy analog (`ISA.md:1571-1574`):

```text
- ISC-1290..1293 | deterministic safety and handoff | doctrine-duplication, authority-drift, freshness/privacy, reviewed handoff | each criterion maps one-to-one to SAFE-01..04 | Phase 7 anchor sentinel plus focused safety suites
```

ISC-1290..1293 numbering is sequential after ISC-1286..1289 and does not
collide with historical ISC-129. Lock the IDs in Wave 1.

---

### `.project/HANDOFF.md` (reviewed-held checkpoint, append-only)

**Analog:** `.project/HANDOFF.md:1794-1823` and 06-04 Task 2
(`06-04-PLAN.md:122-138`). Persistence analog:
`scripts/ralph-iteration.mjs:103-105` (`summary` → `state` → `handoff`).

Append one dated checkpoint. Do not rewrite earlier checkpoints. Do not
precreate `07-SUMMARY.md`. Do not edit STATE/ROADMAP/REQUIREMENTS.

Phase 6 shape to copy:

```markdown
### 2026-08-20 Phase 6 documentation stewardship implementation checkpoint

- The reviewed repository-only implementation head before acceptance edits is
  `3e9deef38450ba3eb9dc1917481cd7a030912e8a`. ...
- Pre-acceptance verification passes: focused ...; complete repository tests
  1895/1895; drift audit; rendered-document synchronization ...; standalone
  audit ...; `git diff --check`; ... T-06-22 ...
- ISA now records bounded Phase 6 implementation acceptance at `verify` / 4/4.
  ... Independent verification is still required; continue with
  `/gsd:verify-work 6` after execute-phase closeout.
- Relocation, deletion, archival or externalization, host/runtime/provider
  configuration, deployment, credentials, Vault or native-client stores,
  connected repositories, and every production or external mutation remain
  explicitly held and unauthorized by this checkpoint.
```

Phase 7 checkpoint must additionally name (D-16 / D-15):

- validator command `npm run --silent safety:check -- --source-revision <FULL_SHA>`
- failing fixtures for SAFE-01..03 and passing fixtures
- live Worker Version `089181f6-ed60-4710-aab6-cd10855360e0` at 100 percent
  (`git-21d4908`)
- D1 `graph_digest` `846400e1fa23704849d48a3ae0d3bf26b7e96d47e353abc0e26075f1cf89b05e`
- unresolved: D1 CAS, wrangler versions upload (cwd SHA `8360c04` remains
  rejected), Vectorize ingest, `getfitcheck` tenant mint, invented TeamForge
  slugs
- shipped next command **`/gsd:verify-work 7`** (do not freeze discuss-time
  `/gsd:plan-phase 7`)

Handoff must not outrank live `.planning/STATE.md` (D-07).

---

### `scripts/infinite-game-anchors.test.mjs` (lifecycle + T-07 privacy sentinel)

**Analog:** the same file's Phase 6 matrix and T-06-22
(`scripts/infinite-game-anchors.test.mjs:167-189`, `255-315`, `317-366`,
`436-446`, `665-692`).

**Lifecycle extension pattern:**

```javascript
const PHASE6_CRITERIA = ['ISC-1286', 'ISC-1287', 'ISC-1288', 'ISC-1289'];
function isCoherentIsaPhaseState(..., phase6Checks = {}, phase6AcceptanceHeading = null) { ... }

assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 0/4', ..., phase6Pending, 'Active Phase 6 acceptance'), true);
assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', ..., phase6Complete, 'Completed Phase 6 acceptance'), true);
assert.match(isa, /DocumentationStewardship[^\n]*satisfies ISC-1286\.\.1289[^\n]*depends_on RalphAndTemperanceFlowProjection/);
```

Add `PHASE7_CRITERIA = ['ISC-1290', 'ISC-1291', 'ISC-1292', 'ISC-1293']`.
Admit `plan 0/4` then `verify 4/4` only after Phase 6 is complete. Preserve
every previously valid Phase 3–6 state. Require Feature
`DeterministicSafetyAndHandoff satisfies ISC-1290..1293 depends_on
DocumentationStewardship`.

**T-07 privacy pattern** (copy T-06-22, retarget Phase 7 path union):

```javascript
function privacyViolations(relativePath, source) {
  const patterns = [
    new RegExp(`(?:file:\\/\\/(?:\\/|[A-Za-z]:)|\\/(?:${'Us' + 'ers'}|${'Vol' + 'umes'}|home)\\/[A-Za-z0-9._~-][^\\s'\"]*|[A-Za-z]:\\\\${'Us' + 'ers'}\\\\)`),
    new RegExp(`\\/(?:${'pri' + 'vate'}\\/(?:tmp|var\\/folders)|tmp)\\/[A-Za-z0-9._~-][^\\s'\"]*`),
    /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/i,
    /\b(?:authorization\s*[:=]\s*|bearer\s+)[A-Za-z0-9._~-]{12,}/i,
    /["']?(?:prompt|request|response|message)[_-]?(?:body|content|payload)["']?\s*[:=]\s*['"{\[]/i,
    new RegExp(`(?:\\.${'claude'}\\/${'MEMORY'}|${'MEMORY'}\\/(?:LEARNING|SIGNALS|STATE))`, 'i'),
  ];
}
```

Keep Unix roots case-exact via split literals. Allow D-11 carve-outs (Worker
Version UUID, Cloudflare account IDs, 64-hex `sha256:` / graph digests,
historical D1 Telegram refs inside existing `docs/evidence/` receipts). Do
not treat `docs/evidence/` as the SAFE-03 privacy corpus. Split hostile
fixture strings. Parse one unique `phase_base_sha` from `07-01-SUMMARY.md`
the same way Phase 6 reads `06-01-SUMMARY.md:109-114`.

Named tests: `SAFE-01 / D-01` … `SAFE-04 / D-04` and `SAFE-PRIVACY / T-07`.

---

### Optional helper exports (`scripts/intent-graph.mjs`, `scripts/temperance-flow.mjs`)

**Analog:** the existing file-private functions listed above.

If Wave 1 chooses export over duplication, export the smallest set:

- from `intent-graph.mjs`: `canonicalText`, `digestText`, `selectContent`
  (or `resolveSelection` without the worktree `containedFile` path — Phase 7
  must hash `git show` bytes)
- from `temperance-flow.mjs`: `selectContent` including `text.line:`, plus
  the `reviewed_handoff` redaction in `compileSource`

Do not switch the SHA-bound gate onto `buildIntentGraphSources` /
`buildTemperanceFlowSources`; those use worktree `readFileSync`
(`scripts/temperance-flow.mjs:223`).

## Shared Patterns

### Authentication / authority

**Source:** `docs/LIFECYCLE.md:22-32`, `docs/architecture/contracts/documentation-inventory-v1.md:10-15`,
`ISA.md:213-218`

Apply to compiler, CLI, contract, indexes, ISA, and handoff:

1. `VISION.md` and `MISSION.md` own doctrine (SAFE-01 bodies).
2. `ISA.md` owns approved goals and acceptance (SAFE-02 allowed claimant).
3. live `.planning/STATE.md` owns the current finite GSD transition (SAFE-02
   allowed claimant).
4. generated projections stay `projectionAuthority: "read_only"`
   (`docs/architecture/intent-graph.v1.json:2-3`,
   `docs/architecture/temperance-flow.v1.json:2`).
5. `.temperance/project.json` `ownership.planning: "project"` is host/repo
   split metadata, not a goal-setting claim (`/.temperance/project.json:13-18`).
   Allow `active_planner: "isa"`; fail any other `active_planner`.
6. Handoff does not outrank STATE.

### Error handling and diagnostics

**Source:** `scripts/check-documentation-inventory.mjs:123-148`
**Apply to:** CLI and any thrown compiler errors that reach stderr.

Redact `/Users|/Volumes|/private|/tmp|/var|/home` to `<redacted-path>`. Cap
stderr at 300–320 characters. No partial stdout document on failure.
Standalone audit additionally forbids `/Users/`+`sheshnarayaniyer` and
`/Volumes/`+`madara` (`scripts/standalone-audit.mjs:52-54`).

### Validation

**Source:** inventory `assertClosed` / `rejectForbiddenDeep`
(`scripts/documentation-inventory.mjs:42-60`); CLI closed parser
(`scripts/check-documentation-inventory.mjs:27-56`).

**Apply to:** compiler input, CLI argv, hit objects.

### Privacy

**Source:** T-06-22 `privacyViolations`
(`scripts/infinite-game-anchors.test.mjs:167-189`); inventory `PRIVATE_TEXT`;
Temperance `SECRET_TEXT`; standalone `privatePatterns`.

**Apply to:** SAFE-03 projection scan, T-07 Phase 7 path union, CLI
diagnostics. D-11 allowlists are mandatory so the handoff can name live
Worker/D1 identities.

### Package scripts and verification

**Source:** `package.json:8-9,53-55`; 06-04 Task 2 gates.

Per-task: focused `node --test` on touched files.
Wave merge: `node --test scripts/deterministic-safety.test.mjs
scripts/check-deterministic-safety.test.mjs
scripts/infinite-game-anchors.test.mjs`.
Phase gate: `npm test` plus `safety:check` at the committed SHA, plus
complementary `docs:inventory:check`, `generate-intent-graph --check`,
`generate-temperance-flow --check`, `drift:audit`, `render-docs:check`,
`standalone:audit`, `git diff --check`.

### D-05 SAFE-02 surface list (closed)

| Class | Paths |
|---|---|
| Graph projections | `docs/architecture/intent-graph.v1.json`, `docs/architecture/intent-graph.md` |
| Flow projections | `docs/architecture/temperance-flow.v1.json`, `docs/architecture/temperance-flow.md` |
| Temperance project manifest | `.temperance/project.json` (named extra; not in inventory corpus) |
| Ralph state | no committed `ralph-iteration` JSON; fixture `cambium.ralph-iteration.v1` with writer fields fails |
| Documentation overlays | `PROJECT.md`, `README.md`, `docs/README.md`, `docs/doctrine/README.md`, `docs/LIFECYCLE.md`, `.planning/README.md`, `INFINITE-GAME.md` |

Do not scan historical `docs/plans/` or `docs/project-management/` for D-06
phrases.

### SAFE-03 generated projections that declare source digests

| Projection | Path | Recompute |
|---|---|---|
| Intent Graph JSON | `docs/architecture/intent-graph.v1.json` | `digestText(selectContent(git-show, selector))`; overlay anchors whole-file `digestText` |
| Intent Graph MD | `docs/architecture/intent-graph.md` | JSON is source of digest truth; MD byte parity is complementary `--check` |
| Temperance Flow JSON | `docs/architecture/temperance-flow.v1.json` | same selectors plus `text.line:`; `reviewed_handoff` redaction; `intentGraph.digest` = `digestText` of JSON file bytes |
| Temperance Flow MD | `docs/architecture/temperance-flow.md` | same as Intent Graph MD |
| Documentation inventory | ephemeral stdout | **D-10: do not freshness-check** |

## Implementation Landmines

- Do not invent a third checker family (`scan-doctrine.mjs` +
  `scan-privacy.mjs` + `scan-freshness.mjs`). One CLI, three internal
  functions.
- Do not use worktree `readFileSync` for the SHA-bound gate. Phase 4/5
  generators are worktree compilers; D-01 forbids dirty cwd.
- Do not feed bodies into `compileDocumentationInventory`.
- Do not naive-substring D-06 phrases over the whole corpus; `docs/LIFECYCLE.md:45`
  and `docs/architecture/intent-graph.md` would false-fail HEAD.
- Do not compare recorded digests to Git SHA-1 or inventory `digestBuffer`
  unless the recorded selector is whole-file raw bytes (it is not, for
  projections).
- Do not flag D-16 Worker UUID, D1 64-hex digest, CF account IDs, or
  `sha256:` identities in HANDOFF.
- Do not scan untracked `MEMORY/` or host `~/.temperance_engine`.
- Do not commit a safety JSON artifact that then needs its own freshness
  selector.
- Do not invoke wrangler, D1 CAS, Vectorize, or tenant mint. `8360c04`
  remains a rejected upload SHA.
- Do not freeze discuss-time `/gsd:plan-phase 7` into the shipped handoff.
- Do not precreate `07-SUMMARY.md` or suppress GSD closeout.
- Do not add npm packages or edit lockfiles.
- Do not revive `CONTEXT_PROJECTIONS` except as historical evidence.

## No Analog Found

All Phase 7 **files** have role+data-flow analogs. Two **behaviors** have no
in-repo function to copy and must be designed in Wave 1 against HEAD plus
hostile fixtures:

| Behavior | Role | Data Flow | Reason |
|---|---|---|---|
| VISION/MISSION paragraph fold (whitespace + punctuation, drop headings/short blocks, allow titles/filenames/digests) | transform | SAFE-01 | `canonicalText` exists; no paragraph matcher exists. RESEARCH A3 threshold (≥80 folded chars) is assumed until Wave 1 locks it. |
| SAFE-02 claim-vs-denial/attribution grammar | transform | SAFE-02 | Schema/role field checks have analogs; prose self-claim vs denial/legend/attribution does not. Raw substring fails HEAD. |

Planner should use RESEARCH.md Pitfalls 2 and A3–A4 rather than inventing a
fourth scanner family.

## Metadata

**Analog search scope:** `scripts/`, named root documents, `docs/architecture/`,
`.planning/phases/06-documentation-stewardship/`, `ISA.md`, `.project/HANDOFF.md`,
`package.json`, `.temperance/project.json`

**Strong analogs read:** documentation inventory compiler/sources/CLI/tests
and contract; Intent Graph / Temperance Flow digest and selector helpers;
generate-intent-graph `--check` freshness diagnostics; infinite-game-anchors
lifecycle + T-06-22; Ralph persistence surfaces; standalone-audit private
paths; Phase 6 06-01/06-02/06-04 plans and 06-04-SUMMARY; ISA Phase 6 slice;
HANDOFF Phase 6 checkpoint

**Pattern extraction date:** 2026-08-21

**This worktree:** branch `codex/phase-5-decisions`. Do not switch branches.
Do not deploy, wrangler upload, D1 CAS, Vectorize ingest, or mint
tenants/TeamForge ids.
