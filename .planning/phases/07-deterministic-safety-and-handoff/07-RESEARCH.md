# Phase 7: Deterministic Safety and Handoff - Research

**Researched:** 2026-08-21
**Domain:** Commit-tree fail-closed validation (doctrine duplication, authority drift, freshness, privacy) plus reviewed-held handoff
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Doctrine-duplication scan bounds (SAFE-01)
- **D-01:** Scan only the Phase 6 inventory corpus: committed named root documents, `docs/`, and `.planning/`. Ignore untracked `MEMORY/`, host Temperance state, and dirty cwd files.
- **D-02:** Duplication is a normalized paragraph match of `VISION.md` and `MISSION.md` bodies after whitespace and punctuation fold. Titles, filenames, and digest references are allowed.
- **D-03:** Only `VISION.md` and `MISSION.md` may contain those bodies. Every other file references or digests the anchors.
- **D-04:** On a hit, the validator exits non-zero, prints the path, and does not rewrite. Repair is a later owner-approved docs change.

#### Authority-drift fail-closed (SAFE-02)
- **D-05:** Check manifests, Ralph state files, graph projections, and documentation overlays.
- **D-06:** Illegal claims are a closed vocabulary: schema/role fields plus phrases `source of record`, `planning authority`, and `goal-setting`.
- **D-07:** Allowed claimants are `ISA.md` for goals/acceptance and live `.planning/STATE.md` for the finite GSD transition.
- **D-08:** On a hit, fail closed with a non-zero exit, do not rewrite, and do not publish the projection.

#### Freshness and privacy gates (SAFE-03)
- **D-09:** Freshness fails when a generated projection's recorded source digest does not equal the current source blob digest.
- **D-10:** Freshness applies only to generated projections that already declare source digests.
- **D-11:** Privacy fails on secrets, native session identifiers, prompt or response bodies, and machine-local absolute paths. Cloudflare account IDs, Worker Version UUIDs, and historical D1 Telegram source refs in existing receipts are not privacy hits.
- **D-12:** On a stale or privacy hit, fail closed with a non-zero exit, do not rewrite, and do not publish the projection.

#### Reviewed handoff and continuation command (SAFE-04)
- **D-13:** The reviewed handoff lives in `.project/HANDOFF.md` plus `07-SUMMARY.md`. No third status writer.
- **D-14:** Exact next GSD command after this discuss: `/gsd:plan-phase 7` on branch `codex/phase-5-decisions`.
- **D-15:** Unresolved approval boundaries: D1 CAS, wrangler versions upload, Vectorize ingest, `getfitcheck` tenant mint, invented TeamForge slugs.
- **D-16:** The handoff must name the validator command, failing fixtures for SAFE-01..03, passing fixtures, and the live probe identities recorded 2026-08-20: Worker Version `089181f6-ed60-4710-aab6-cd10855360e0` at 100 percent (`git-21d4908`), D1 graph_digest `846400e1fa23704849d48a3ae0d3bf26b7e96d47e353abc0e26075f1cf89b05e`.

### Claude's Discretion
- Choose the smallest validator CLI and fixture layout that reuses the Phase 6 inventory compiler and Phase 4/5 digest pattern.
- Prefer one command that covers SAFE-01..03 over three unrelated scripts.

### Deferred Ideas (OUT OF SCOPE)
- Owner-approved D1 CAS for `sapling:fitcheck` against live head `846400e1…`.
- Wrangler versions upload; cwd SHA `8360c04` remains rejected.
- ParkArea / Tirak / Cambium WorkObject kind before a second TeamForge slug.
- Connected-repository inheritance of anchors (FUTURE-01).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAFE-01 | Deterministic validation fails when canonical vision or mission doctrine is duplicated outside its allowed anchors. | Reuse Phase 6 commit-tree path set; scan `git show FULL_SHA:path` bodies; normalized paragraph match of `VISION.md`/`MISSION.md` after canonicalText + punctuation fold; titles/filenames/digests allowed; print path; no rewrite. |
| SAFE-02 | Deterministic validation fails when a manifest, Ralph state file, generated graph, or documentation overlay claims goal-setting or planning authority. | Closed D-05 surface list (not the whole corpus). Detect schema/role fields (`projectionAuthority`, `role`, `active_planner`, `sourceOfTruth`) plus the three locked phrases with denial/attribution exceptions so current overlays do not false-fail. Allowed claimants: `ISA.md`, live `.planning/STATE.md`. |
| SAFE-03 | Deterministic validation fails when generated projections are stale relative to their source digests or contain secrets, session identifiers, prompt bodies, or machine-local absolute paths. | Recompute selector-aware `sha256:` digests from committed blobs using existing Phase 4/5 digest/selector rules. Privacy scan generated projections with T-06-22 patterns, excluding CF account IDs, Worker Version UUIDs, and historical D1 Telegram refs in receipts. |
| SAFE-04 | A reviewed handoff records the bounded write set, verification evidence, unresolved approval boundaries, and the exact next GSD command. | Append one checkpoint to `.project/HANDOFF.md`; let execute-plan create `07-SUMMARY.md`. Name validator command, fail/pass fixtures, live Worker/D1 identities, D-15 holds. After this phase ships, name the then-current next command (`/gsd:verify-work 7` at implementation close). Do not freeze discuss-time `/gsd:plan-phase 7` into the shipped handoff. |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

Treat these with the same authority as locked CONTEXT decisions. [VERIFIED: AGENTS.md, Claude.md, PROJECT.md]

- Start from `PROJECT.md`, `.project/CONTEXT.md`, `.project/HANDOFF.md`.
- Vault is referenced knowledge, never a runtime dependency or seed corpus.
- Keep changes scoped to this repository. Do not edit vault registries, native client stores, Paseo, OmniRoute, provider credentials, or external deployment state.
- Never add secrets, `.env` material, native session identifiers, prompt or response bodies, or machine-local absolute checkout paths.
- Record a bounded checkpoint in `.project/HANDOFF.md` when a reviewed change is ready for pickup.
- This packet is reviewed-held. Identity recording does not authorize relocation, registry writes, session migration, provider changes, D1 CAS, wrangler upload, or Vectorize ingest.
- Use commands declared in `PROJECT.md`. `npm test` is the current deterministic verification command. Generated output stays ignored except the already-committed Intent Graph and Temperance Flow readbacks.
- Node built-ins only for this phase. No package/lockfile change. [VERIFIED: Phase 6 06-01-PLAN.md T-06-SC; package.json has empty `dependencies`]

## Summary

Phase 7 is a **zero-write, commit-tree validator** plus a **reviewed-held handoff**. It does not relocate corpus files, does not publish a third projection family, and does not mutate D1, Workers, Vectorize, tenants, or TeamForge.

Phase 6 already enumerates the exact SAFE-01 corpus from one immutable Git commit (`buildDocumentationInventorySources` → `cambium.documentation-inventory.v1`) and proves dirty worktree/staged/`MEMORY/` isolation. Phase 4/5 already pin selector-scoped `sha256:` digests on committed generated readbacks and fail `--check` on stale bytes. Privacy scanners already exist in the inventory compiler (`PRIVATE_TEXT`), Temperance compiler (`SECRET_TEXT`), T-06-22 (`privacyViolations`), and `standalone-audit.mjs`. Phase 7 must **compose those three families into one CLI**, not invent a fourth checker.

**Primary recommendation:** Add one SHA-bound, stdout-receipt, zero-write command `npm run --silent safety:check -- --source-revision <REV>` implemented as `scripts/check-deterministic-safety.mjs` over a pure `scripts/deterministic-safety.mjs`. Consume the Phase 6 inventory path set, read bodies only via `git show FULL_SHA:path`, fail closed with repository-relative paths, and never rewrite. Close ISA as `ISC-1290..1293` (SAFE-01..04) and append one HANDOFF checkpoint naming fixtures, the validator command, D-15 holds, and `/gsd:verify-work 7`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Doctrine-duplication scan (SAFE-01) | Git object database + repository tooling | — | D-01 binds the scan to one committed tree. Worktree/index/`MEMORY/` are untrusted. |
| Authority-drift scan (SAFE-02) | Repository tooling | Committed derived docs | Claims live in committed manifests/projections/overlays. Validator is inspection-only. |
| Freshness (SAFE-03) | Git object database | Generated docs (`docs/architecture/*`) | Compare recorded source digests in committed projections to committed source blobs at the same SHA. |
| Privacy (SAFE-03) | Repository tooling | Generated projections | Scan projection bytes and Phase 7 changed paths. Do not treat historical receipts as the privacy corpus. |
| Reviewed handoff (SAFE-04) | Planning / pickup docs | GSD execute-plan closeout | Human surfaces are `.project/HANDOFF.md` + `07-SUMMARY.md`. Live next command remains `.planning/STATE.md`. |
| Live Worker/D1 identities | External runtime (read-only naming) | — | D-16 records discuss-time probe IDs. This phase does not upload, CAS, or ingest. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `node:test` / `node:assert/strict` | Node 26 (CI `node-version: '26'`; local v26.7.0) | Adversarial suites | Same runner as Phases 3–6. `scripts/*.test.mjs` is already in `npm test`. [VERIFIED: package.json, .github/workflows/ci.yml] |
| Node.js `node:crypto` SHA-256 | built-in | `sha256:` digests | Existing `digestText` / `digestObject` / `digestBuffer`. Never hand-roll hashing. [VERIFIED: scripts/intent-graph.mjs, scripts/documentation-inventory.mjs] |
| `/usr/bin/git` with `--no-replace-objects --no-optional-locks` | Apple Git 2.54.0 | Commit-tree enumeration and blob reads | Phase 6 adapter already isolates dirty/staged bytes this way. [VERIFIED: scripts/documentation-inventory-sources.mjs] |
| Existing Cambium modules | this checkout `09ee656` | Path set, selectors, privacy patterns, handoff analog | Reuse, do not fork a third generator family. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `scripts/documentation-inventory-sources.mjs` | in-repo | Corpus path set + `rootMemoryTracked` | Always. SAFE-01 path-set equality must match `corpusPaths`. |
| `scripts/documentation-inventory.mjs` | in-repo | Closed schema, `contentDigest`, privacy field reject | Compare path-set/digest identity; do not feed bodies into this compiler. |
| `scripts/intent-graph.mjs` | in-repo | `canonicalText`, `digestText`, closed selectors, overlay anchor digests | Recompute Intent Graph source/anchor digests. |
| `scripts/temperance-flow.mjs` | in-repo | Selectors including `text.line:`, reviewed_handoff redaction, `SECRET_TEXT` | Recompute Flow source digests with the same redaction. |
| `scripts/check-documentation-inventory.mjs` | in-repo | Closed `--source-revision` parser, `safeDiagnostic`, zero-write CLI | Copy parser/diagnostic/exit shape. |
| `scripts/infinite-game-anchors.test.mjs` | in-repo | ISA lifecycle sentinel + T-06-22 privacy | Extend for Phase 7 ISC slice and T-07 privacy over Phase 7 path union. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One `safety:check` CLI | Three scripts (`dup`, `authority`, `freshness`) | Forbidden by discretion. One command, three internal functions. |
| Commit-tree freshness | Reuse `generate-intent-graph.mjs --check` as the SAFE-03 gate | Those checkers read the **worktree** via `readFileSync`. D-01 forbids dirty cwd. Keep them as extra Wave 3 evidence, not the SHA-bound gate. |
| Naive substring of D-06 phrases over the whole inventory | Closed D-05 surface list + schema/role fields | Whole-corpus phrase scan false-fails historical `docs/` and current overlays. See Pitfall 2. |
| New npm package (zod, ajv, micromatch) | Node built-ins + existing compilers | Phase 6 accepted T-06-SC: no lockfile change. |

**Installation:** none. No new packages.

**Version verification:** Node v26.7.0, npm 11.19.0, git 2.54.0 probed in this worktree on 2026-08-21. No registry packages to `npm view`.

## Package Legitimacy Audit

This phase installs **zero** external packages. Node built-ins and in-repo scripts only.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| — | — | — | — | — | — | none |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

`slopcheck` is installed locally but had no candidate names to run. Do not add dependencies in the plan.

## Architecture Patterns

### System Architecture Diagram

```text
caller
  --source-revision REV
        |
        v
git rev-parse --verify REV^{commit}     --> full 40-hex SHA
        |
        v
buildDocumentationInventorySources()    --> corpusPaths[] (root *.md + docs/ + .planning/)
                                            rootMemoryTracked (MEMORY/ fact only)
                                            blobs[].contentDigest (body-free)
        |
        +-- path-set equality with independent git ls-tree (fail if unequal)
        |
        v
for path in corpusPaths:
  git show SHA:path                     --> committed bytes (never worktree)
        |
        +-- SAFE-01: paragraph-normalize VISION.md + MISSION.md;
        |            match against every other corpus path;
        |            allow titles, filenames, sha256: digests
        |
        +-- SAFE-02: only D-05 surfaces (see table);
        |            schema/role fields + closed phrases
        |            with denial/attribution exceptions;
        |            allow ISA.md and .planning/STATE.md
        |
        +-- SAFE-03 freshness: only committed generated projections
        |            that already declare source digests;
        |            recompute selector digest from SHA blobs
        |
        +-- SAFE-03 privacy: generated projections (+ Phase 7
                     changed-path sentinel); redact diagnostics
        |
        v
hits? --yes--> stderr: repository-relative path(s)  exit 1  (no rewrite, no publish)
      --no---> stdout: "deterministic safety check passed: SHA digest entries=N"  exit 0
```

File-to-implementation mapping is in Component Responsibilities below, not in this diagram.

### Recommended Project Structure

```
scripts/
├── deterministic-safety.mjs                 # pure SAFE-01..03 compiler (no CLI, no writes)
├── deterministic-safety.test.mjs            # synthetic Git fixtures (dirty/staged/MEMORY isolation)
├── check-deterministic-safety.mjs           # --source-revision CLI + safeDiagnostic
├── check-deterministic-safety.test.mjs      # parser, package stdout, zero-write, fail-closed paths
├── documentation-inventory-sources.mjs      # REUSE path set
├── documentation-inventory.mjs              # REUSE schema/digests (do not put bodies here)
├── intent-graph.mjs                         # REUSE canonicalText/digestText/selectors
├── temperance-flow.mjs                      # REUSE text.line: + handoff redaction
└── infinite-game-anchors.test.mjs           # EXTEND ISA lifecycle + SAFE/T-07 sentinels
docs/architecture/contracts/
└── deterministic-safety-v1.md               # closed contract, surfaces, selectors, no-write
package.json                                 # safety:check only; no deps
ISA.md                                       # ISC-1290..1293 slice
.project/HANDOFF.md                          # additive checkpoint only
.planning/phases/07-deterministic-safety-and-handoff/
└── 07-SUMMARY.md                            # created by execute-plan, not precreated
```

Do **not** commit a generated safety report JSON/Markdown pair. Follow the inventory: ephemeral stdout receipt only. [VERIFIED: docs/architecture/contracts/documentation-inventory-v1.md]

### Component Responsibilities

| File | Role | Analog |
|------|------|--------|
| `scripts/deterministic-safety.mjs` | Pure compiler: duplication, authority, freshness, privacy | `scripts/documentation-inventory.mjs` + digest helpers from intent-graph/temperance-flow |
| `scripts/check-deterministic-safety.mjs` | Closed CLI, zero-write, redacted stderr | `scripts/check-documentation-inventory.mjs` |
| `scripts/deterministic-safety.test.mjs` | Synthetic two-commit Git fixtures | `scripts/documentation-inventory.test.mjs` |
| `scripts/check-deterministic-safety.test.mjs` | Package-level CLI | `scripts/generate-documentation-inventory.test.mjs` |
| `docs/architecture/contracts/deterministic-safety-v1.md` | Public contract | `documentation-inventory-v1.md` |
| `scripts/infinite-game-anchors.test.mjs` | ISA coherence + phase-wide SAFE-01..04 + T-07 privacy | Phase 6 DOCS/T-06-22 sentinels |
| `.project/HANDOFF.md` | Additive reviewed-held checkpoint | 06-04 Task 2 |
| `07-SUMMARY.md` | Execute-plan closeout | 06-04-SUMMARY.md |

### Pattern 1: Explicit-revision commit-tree adapter (reuse, do not reimplement)

**What:** Resolve `REV` once with `git rev-parse --verify REV^{commit}`, then `git ls-tree` / `git show FULL_SHA:path` only.
**When to use:** Every SAFE-01..03 read.
**Example:**

```javascript
// Source: scripts/documentation-inventory-sources.mjs
const resolved = String(runGit(root, ['rev-parse', '--verify', `${options.sourceRevision}^{commit}`])).trim();
if (!FULL_COMMIT_SHA.test(resolved)) throw new TypeError('sourceRevision must resolve exactly once to a full commit SHA');
const scopedTree = parseTree(String(runGit(root, ['ls-tree', '-r', '-z', '--full-tree', resolved, '--', 'docs', '.planning'])));
const body = runGit(root, ['show', `${resolved}:${entry.path}`], { encoding: null });
```

The inventory compiler then **discards bodies** after `contentDigest`. Phase 7 must read those same blobs again for paragraph/privacy scans, but must still assert `corpusPaths` equality with `buildDocumentationInventorySources`. [VERIFIED: scripts/documentation-inventory-sources.mjs, scripts/documentation-inventory.test.mjs]

Public inventory commands already required by Phase 6:

```bash
npm run --silent docs:inventory:json -- --source-revision <REV>
npm run --silent docs:inventory:markdown -- --source-revision <REV>
npm run --silent docs:inventory:check -- --source-revision <REV>
```

Phase 7 public command (discretion — smallest sibling):

```bash
npm run --silent safety:check -- --source-revision <REV>
```

Parser rules to copy: `--source-revision` exactly once; optional `--root` only for contained fixtures; reject `--write`, `--output`, `--fix`, `--check`, provider, and staged/index flags; `HEAD` is valid only when explicitly supplied and is immediately serialized as the resolved SHA. [VERIFIED: scripts/check-documentation-inventory.mjs]

### Pattern 2: Selector-aware source digests (Phase 4/5)

Generated projections already declare source digests. D-09 “current source blob digest” means **recompute the same digest function over the committed blob at that SHA**, not Git SHA-1 and not a whole-file hash unless the recorded selector is `whole-file`.

| Projection | Path | Recorded digest fields | How to recompute |
|------------|------|------------------------|------------------|
| Intent Graph JSON | `docs/architecture/intent-graph.v1.json` | `sourceSetDigest`, `graphDigest`, `nodes[].source.{path,authority,selector,digest}`, `edges[].source.{path,selector,digest}`, overlay `anchorReferences[].{path,digest}` | `digestText(selectContent(git-show, selector))`. Overlay anchors are whole-file `digestText`. [VERIFIED: scripts/intent-graph.mjs compileAnchorReferences, resolveSelection] |
| Intent Graph MD | `docs/architecture/intent-graph.md` | Same identities in prose | Byte/identity parity already owned by `generate-intent-graph.mjs --check`. SHA-bound gate should parse JSON as source of digest truth. |
| Temperance Flow JSON | `docs/architecture/temperance-flow.v1.json` | `sourceSetDigest`, `flowDigest`, `references.{isa,gsd,plan,supporting}[].{path,kind,selector,digest}`, `references.intentGraph.{path,schema,digest}`, gates/stops sources | Same `digestText(selectContent(...))`. Extra selector: `text.line:`. `reviewed_handoff` redacts ``implementation_head`` and generated flow/sourceSet digest lines **before** hashing. `intentGraph.digest` is `digestText` of the JSON file bytes, **not** `graphDigest`. [VERIFIED: scripts/temperance-flow.mjs compileSource / compileIntentGraphReference] |
| Temperance Flow MD | `docs/architecture/temperance-flow.md` | matching identities | Same as Intent Graph MD. |
| Documentation inventory | ephemeral stdout only | `entries[].provenance.contentDigest` = `sha256` of **raw git blob bytes** (`digestBuffer`), plus `sourceSetDigest` / `inventoryDigest` | D-10: **do not** freshness-check the inventory. It is not a committed generated projection. |

Canonical text rule (Intent Graph contract): UTF-8, strip BOM, CRLF/CR → LF, exactly one terminal LF, then `sha256:` + 64 lowercase hex. [VERIFIED: docs/architecture/contracts/intent-graph-v1.md]

Closed selectors:

- Intent Graph: `whole-file`, `markdown.heading:`, `markdown.bold-field:H#F`, `frontmatter.F`, `markdown.list-item:`, `xml.task-name:`
- Temperance Flow: those plus `text.line:`
- Reviewed handoff redaction (must reuse or freshness false-fails):

```javascript
// Source: scripts/temperance-flow.mjs compileSource
const digestable = value.kind === 'reviewed_handoff'
  ? selected
    .replace(/(`implementation_head` is `)[a-f0-9]{40}(`)/, '$1<reviewed-implementation-head>$2')
    .replace(/^(- Generated (?:flowDigest|sourceSetDigest): )sha256:[a-f0-9]{64}$/gm, '$1<reviewed-generated-digest>')
  : selected;
```

Schemas / authority literals:

- `cambium.intent-graph-projection.v1` / `projectionAuthority: "read_only"`
- `cambium.temperance-flow-projection.v1` / `projectionAuthority: "read_only"`
- `cambium.documentation-inventory.v1` / `projectionAuthority: "read_only"`
- `cambium.ralph-iteration.v1` (interpreter schema; persistence surfaces are `summary`, `state`, `handoff` — no committed ralph ledger file) [VERIFIED: scripts/ralph-iteration.mjs]

### Pattern 3: D-05 surfaces for SAFE-02 (closed list)

Do **not** scan the entire inventory corpus for D-06 phrases. `docs/` contains dozens of historical “planning authority” mentions (portfolio intake). Scan only:

| Class | Paths | Notes |
|-------|-------|-------|
| Graph projections | `docs/architecture/intent-graph.v1.json`, `docs/architecture/intent-graph.md` | Must stay `read_only`. Overlay nodes already reject `vision_anchor` / copied `content`. [VERIFIED: scripts/intent-graph.test.mjs GRAPH-03] |
| Flow / Ralph manifests | `docs/architecture/temperance-flow.v1.json`, `docs/architecture/temperance-flow.md` | `projectionAuthority` must remain `read_only`. No `active_planner` field today. |
| Temperance project manifest | `.temperance/project.json` | Tracked. Not in the Phase 6 corpus. Include as a **named extra surface** for SAFE-02 only (CONTEXT specific idea). Current file has `ownership.planning: "project"` (host/repo split metadata), not a goal-setting claim. Allow `active_planner: "isa"` as metadata; fail any other `active_planner`. [VERIFIED: .temperance/project.json] |
| Ralph state | no committed `ralph-iteration` JSON | Persistence is GSD summary + `.planning/STATE.md` + `.project/HANDOFF.md`. If a fixture injects `cambium.ralph-iteration.v1` with writer fields (`queue`, `dispatch`, `selfCertified`), fail. Allowed claimant for live transition prose remains STATE.md. |
| Documentation overlays | `PROJECT.md`, `README.md`, `docs/README.md`, `docs/doctrine/README.md`, `docs/LIFECYCLE.md`, `.planning/README.md`, `INFINITE-GAME.md` | Phase 6 additive indexes. Must link, not claim ISA/GSD authority. |

Allowed claimants (D-07): `ISA.md`, `.planning/STATE.md`. They may contain `source of record` / `planning authority` / `goal-setting`.

### Pattern 4: Fail-closed CLI and handoff (no rewrite)

On any hit: non-zero exit, print repository-relative path, no file writes, no `--fix`, no publishing a replacement projection (D-04, D-08, D-12). Copy `safeDiagnostic` redaction of `/Users|/Volumes|/private|/tmp` from the inventory checker. [VERIFIED: scripts/check-documentation-inventory.mjs]

SAFE-04 handoff analog is 06-04 Task 2:

- Append one dated checkpoint to `.project/HANDOFF.md`. Do not rewrite earlier checkpoints.
- Do not precreate `07-SUMMARY.md`. Execute-plan owns it.
- Do not have the executor edit `.planning/STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` (orchestrator closeout).
- Record: implementation head, bounded write set, exact commands/exits, fail/pass fixtures, validator command, D-15 unresolved boundaries, live probe IDs (D-16), next GSD command.
- Discuss-time next command `/gsd:plan-phase 7` is already consumed by this research/plan cycle. Shipped handoff names **`/gsd:verify-work 7`** at implementation close, matching Phase 6’s `/gsd:verify-work 6`. [VERIFIED: .project/HANDOFF.md 2026-08-20 Phase 6 checkpoint; 06-04-PLAN.md]

### Anti-Patterns to Avoid

- **Third checker family:** do not add unrelated `scan-doctrine.mjs` + `scan-privacy.mjs` + `scan-freshness.mjs` CLIs.
- **Worktree reads for the SHA-bound gate:** `buildIntentGraphSources` / `buildTemperanceFlowSources` use `readFileSync`. That is correct for `--write/--check` of live generated files, wrong for D-01.
- **Feeding bodies into `compileDocumentationInventory`:** that compiler is body-free by contract and will fail closed on private-shaped text.
- **Rewriting historical evidence** to make the scanner pass. Fail and print the path (D-04).
- **Scanning untracked `MEMORY/`** or host `~/.temperance_engine`. Inventory already records `rootMemoryTracked` from `git ls-tree SHA -- MEMORY` only. [VERIFIED: scripts/documentation-inventory-sources.mjs]
- **Committing a safety JSON artifact** that then needs its own freshness selector (the Phase 6 reason inventory stdout is ephemeral).
- **Deploy/CAS/upload** from this phase. Wrangler is installed locally and must not be invoked. `8360c04` remains a rejected upload SHA (D-15 / deferred).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Corpus enumeration | Custom `fs.walk` / `git ls-files` | `buildDocumentationInventorySources` | Dirty/staged isolation and replacement-ref denial already proven. |
| SHA-256 / canonical JSON | New hash helper | Existing `digestText` / `digestObject` / `digestBuffer` | Selector vs raw-blob semantics differ; mixing them false-fails freshness. |
| Markdown selectors | Ad-hoc regex | Intent Graph + Temperance `selectContent` | Unique-match, heading bounds, `text.line:`, handoff redaction. |
| Privacy regex | New token list | T-06-22 `privacyViolations` + `PRIVATE_TEXT` / `SECRET_TEXT`, plus D-11 exclusions | Phase 6 already lost a week to `/users/` GitHub-route false positives. |
| CLI parser / diagnostics | New flag grammar | Copy inventory check parser + `safeDiagnostic` | Closed grammar is a security control (T-06-09). |
| Handoff persistence | New status file / ledger | Append `.project/HANDOFF.md`; execute-plan writes `07-SUMMARY.md` | D-13: no third status writer. Ralph already persists `summary` → `state` → `handoff`. |
| Authority foldback | Let projections claim ISA/GSD | Keep `projectionAuthority: read_only`; reject writer keys (`command`, `queue`, `dispatch`, `write`) | Already enforced in inventory/flow compilers. |
| Package install | zod/ajv/minimatch | Node built-ins | T-06-SC accepted; empty `dependencies`. |

**Key insight:** The hard parts (immutable tree isolation, selector digests, privacy false positives, handoff CAS-ish append) are already paid for. Phase 7’s job is a **composing fail-closed gate** over those contracts.

## Common Pitfalls

### Pitfall 1: Dirty worktree / `8360c04` / `CONTEXT_PROJECTIONS`

**What goes wrong:** Scanner reads cwd files and either false-fails on dirty primary-checkout material or false-passes because uncommitted overlay copies are missed.
**Why it happens:** Phase 4/5 generators are worktree compilers. The user-owned dirty checkout at `8360c04` (`feat(quests): add founder-gated HR workflows`, 2026-08-18) still carries retired `CONTEXT_PROJECTIONS` binding prose in historical ISA/HANDOFF/tests. This worktree is isolated `codex/phase-5-decisions` at `09ee656`, ahead 96 of `origin/main`. [VERIFIED: git log 8360c04; git rev-parse HEAD]
**How to avoid:** Every SAFE read is `git show FULL_SHA:path` after one `rev-parse --verify REV^{commit}`. Tests must dirty the fixture worktree and prove the SHA result is unchanged (copy documentation-inventory.test.mjs DOCS-02).
**Warning signs:** Diagnostics contain `/private/tmp` checkout paths; results change after `echo >> VISION.md` without commit.

### Pitfall 2: Naive D-06 phrase scan false-fails current overlays

**What goes wrong:** `docs/LIFECYCLE.md` says generated readbacks’ “recency never grants release or planning authority.” `docs/architecture/intent-graph.md` documents ``gsd_planning` | GSD finite-planning authority``. Historical `docs/plans/` and `docs/project-management/` repeat “planning authority” for GitHub-vs-Cambium portfolio intake. A substring scan of D-05 overlays or the whole corpus exits 1 on HEAD.
**Why it happens:** D-06 locked the phrases without a claim-vs-mention grammar.
**How to avoid:**
1. Restrict phrase/schema scans to the D-05 list, not all of `docs/`.
2. Treat schema/role fields as primary: `projectionAuthority` other than `read_only`; `role` in {`sole_operational_writer`, `planning authority`, `goal-setting`}; `active_planner` other than `isa` / `gsd` / omitted; `sourceOfTruth` claiming ISA/GSD.
3. For prose, fail only **self-claims** (this file/manifest/projection “is/owns/claims” the phrase) or unattributed assertions. Allow denials (“never grants planning authority”), legends that define `gsd_planning`, and attributions to `ISA.md` / `.planning/STATE.md`.
4. Fixture: overlay that copies “this file is the planning authority” fails; LIFECYCLE.md denial passes; `.temperance/project.json` with `active_planner: "isa"` passes; `active_planner: "ralph"` fails.
**Warning signs:** `safety:check` fails on unmodified HEAD before any hostile fixture.

### Pitfall 3: Freshness compares the wrong digest

**What goes wrong:** Compare recorded `source.digest` to Git blob SHA-1, or to whole-file `contentDigest`, or skip handoff redaction / `text.line:` / `intentGraph.digest ≠ graphDigest`.
**Why it happens:** D-09 says “blob digest.” Inventory uses raw-byte `digestBuffer`; projections use `digestText(canonicalText(selected))`.
**How to avoid:** Recompute with the **recorded selector and the same function that wrote the field**. Table in Pattern 2 is normative. Do not freshness-check ephemeral inventory stdout (D-10).
**Warning signs:** Every projection fails freshness on a clean SHA; or tracking-only ISA `progress` edits fail Intent Graph freshness (Phase 4 already proves those selectors exclude mutable tracking fields). [VERIFIED: scripts/generate-intent-graph.test.mjs “tracking-only ROADMAP and ISA mutations”]

### Pitfall 4: Privacy false positives (CF IDs, Worker UUIDs, GitHub `/users/`, fixture literals)

**What goes wrong:** Worker Version `089181f6-ed60-4710-aab6-cd10855360e0`, D1 digest `846400e1…`, Cloudflare account IDs, and historical Telegram source refs in `docs/evidence/` trip UUID/token regexes. GitHub URL `/users/` trips user-root detectors. Synthetic test strings trip T-06-22.
**Why it happens:** D-11 explicitly carves these out. Phase 6 already special-cased Unix roots as case-exact and listed synthetic fixture literals. [VERIFIED: 06-04-SUMMARY.md deviation 1; scripts/infinite-game-anchors.test.mjs privacyViolations]
**How to avoid:** Reuse T-06-22 patterns; keep Unix roots case-exact (`/Users/`, `/Volumes/`); allow UUID-shaped Worker Version IDs and 64-hex `sha256:` / graph digests; do not treat `docs/evidence/` receipts as the privacy corpus for SAFE-03 (scope privacy to generated projections + Phase 7 changed-path sentinel). Split hostile fixture strings like existing tests.
**Warning signs:** Handoff that names D-16 identities cannot be committed because the scanner flags them.

### Pitfall 5: Scanning untracked `MEMORY/` or rewriting history

**What goes wrong:** Validator probes ignored runtime memory, or “fixes” a duplicated paragraph in a historical plan.
**Why it happens:** Root `MEMORY/` is not tracked at this SHA (`git ls-tree HEAD -- MEMORY` is empty). `.gitignore` does not even name it; it is simply absent from the commit tree. [VERIFIED: git ls-tree]
**How to avoid:** Adapter already queries MEMORY as a bounded fact and never reads ignored files. Tests write `MEMORY/private.md` untracked and assert it is absent from the scan set. On SAFE-01 hits, print path and stop. Repair is a later owner-approved docs change (D-04).

### Pitfall 6: Machine-local `/Volumes` paths leaking through diagnostics

**What goes wrong:** Failures print `/Volumes/madara/...` or `/Users/sheshnarayaniyer/...`.
**Why it happens:** `spawnSync` stderr and `Error.message` include `repositoryRoot`. `standalone-audit.mjs` already forbids those literals in publishable files. [VERIFIED: scripts/standalone-audit.mjs privatePatterns]
**How to avoid:** Inventory `safeDiagnostic` already redacts `/(Users|Volumes|private|tmp|var|home)/...`. Copy it. Tests assert stderr does not match `/Users/|/Volumes/`.

### Pitfall 7: Freezing discuss-time `/gsd:plan-phase 7` into the shipped handoff

**What goes wrong:** SAFE-04 requires the exact next GSD command. D-14’s discuss-time command is already the command that produced this research.
**How to avoid:** Implementation-close handoff names `/gsd:verify-work 7`, same shape as Phase 6. Live STATE remains the planning authority for the finite transition (D-07). Handoff must not outrank STATE.

## Code Examples

Verified patterns from this repository:

### Inventory path-set equality (SAFE-01 corpus)

```javascript
// Source: scripts/documentation-inventory.test.mjs
writeFixtureFile(fixture.repositoryRoot, 'docs/guide.md', '# Guide\ndirty-body\nsecret=do-not-read\n');
writeFixtureFile(fixture.repositoryRoot, 'MEMORY/private.md', 'raw private memory\n');
const sources = buildDocumentationInventorySources({
  repositoryRoot: fixture.repositoryRoot,
  sourceRevision: 'HEAD',
});
const inventory = compileDocumentationInventory(sources);
assert.equal(inventory.entries.find(({ path }) => path === 'docs/guide.md').provenance.contentDigest,
  sha256(Buffer.from('# Guide\ncommitted-body\n')));
assert.equal(inventory.rootMemory.tracked, false);
assert.doesNotMatch(JSON.stringify(inventory), /dirty-body|raw private memory/i);
```

### Stale generated output with source identity (Phase 4 analog for SAFE-03)

```javascript
// Source: scripts/generate-intent-graph.test.mjs
writeFileSync(fixture.markdown, `${readFileSync(fixture.markdown, 'utf8')}stale\n`, 'utf8');
let result = runGenerator(fixture.root, outputArgs(fixture, '--check'), { succeeds: false });
assert.match(result.stderr, /docs\/architecture\/intent-graph\.md/);
// selected-source drift names path#selector
assert.match(result.stderr, /\.planning\/ROADMAP\.md/);
assert.match(result.stderr, /markdown\.bold-field:Phase 4: Provenance-Preserving Intent Graph#Goal/);
```

Phase 7 SHA-bound freshness should print the same `path#selector` form, sourced from committed blobs.

### Overlay cannot copy Vision authority (SAFE-02 analog)

```javascript
// Source: scripts/intent-graph.test.mjs GRAPH-03
assert.equal(overlay.source.authority, 'derived_reference');
assert.equal('content' in overlay, false);
(node) => { node.source.authority = 'vision_anchor'; }  // throws
(node) => { node.content = 'Continue meaningful play.'; } // throws
```

SAFE-02 extends this from compiler-internal fields to committed overlay prose/manifests.

### T-06-22 privacy patterns to reuse (SAFE-03)

```javascript
// Source: scripts/infinite-game-anchors.test.mjs
const patterns = [
  new RegExp(`(?:file:\\/\\/(?:\\/|[A-Za-z]:)|\\/(?:Users|Volumes|home)\\/[A-Za-z0-9._~-][^\\s'\"]*|[A-Za-z]:\\\\Users\\\\)`),
  new RegExp(`\\/(?:private\\/(?:tmp|var\\/folders)|tmp)\\/[A-Za-z0-9._~-][^\\s'\"]*`),
  /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/i,
  /\b(?:authorization\s*[:=]\s*|bearer\s+)[A-Za-z0-9._~-]{12,}/i,
  /["']?(?:prompt|request|response|message)[_-]?(?:body|content|payload)["']?\s*[:=]\s*['"{\[]/i,
  new RegExp(`(?:\\.claude\\/MEMORY|MEMORY\\/(?:LEARNING|SIGNALS|STATE))`, 'i'),
];
```

Add D-11 allowlists: Cloudflare account ID shape, Worker Version UUID, historical D1 Telegram source refs inside existing `docs/evidence/` receipts. Do not flag `sha256:[0-9a-f]{64}` or the D-16 identities when named in HANDOFF.

### Handoff write-set analog (SAFE-04)

Phase 6 06-04-SUMMARY recorded:

- Files: `scripts/infinite-game-anchors.test.mjs`, `ISA.md`, `.project/HANDOFF.md`, one compatibility test, the summary itself
- Gates: focused 24/24, `docs:inventory:check` at full SHA, `npm test` 1895/1895, drift/render-docs/standalone, `git diff --check`, T-06-22
- Next: `/gsd:verify-work 6`
- Holds: relocation, deletion, host/runtime/provider, deployment, credentials, Vault, connected repos

Phase 7 handoff must add: validator command, failing fixtures SAFE-01..03, passing fixtures, Worker `089181f6-ed60-4710-aab6-cd10855360e0` @ 100% (`git-21d4908`), D1 `graph_digest` `846400e1fa23704849d48a3ae0d3bf26b7e96d47e353abc0e26075f1cf89b05e`, D-15 unresolved list. [VERIFIED: 07-CONTEXT.md D-16; .project/HANDOFF.md Phase 6 checkpoint]

### ISA slice analog

```text
### Active Phase 7 acceptance
- [ ] ISC-1290: SAFE-01 ...
- [ ] ISC-1291: SAFE-02 ...
- [ ] ISC-1292: SAFE-03 ...
- [ ] ISC-1293: SAFE-04 ...
Feature: DeterministicSafetyAndHandoff satisfies ISC-1290..1293 depends_on DocumentationStewardship
frontmatter: phase: plan, progress: 0/4  → later verify 4/4
```

Preserve completed Phase 3–6 headings. Extend `isCoherentIsaPhaseState` exactly as 06-01 did for Phase 6. [VERIFIED: ISA.md Criteria; scripts/infinite-game-anchors.test.mjs]

ISC-1290..1293 numbering is sequential after ISC-1286..1289 and does not collide with historical ISC-129 (git inventory). Tag: [ASSUMED] until planner locks the IDs in the plan.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ANCHOR-04: discovery files must *link* to VISION/MISSION | SAFE-01: normalized paragraph match over commit-tree corpus | Phase 3 vs Phase 7 | Links are necessary but not sufficient; copied Just Cause paragraphs fail. |
| Worktree `generate-*-graph --check` | SHA-bound digest recompute over `git show` | Phase 4/5 vs Phase 7 | Dirty cwd cannot masquerade as committed freshness. |
| Per-compiler `PRIVATE_TEXT` / T-06-22 on phase-range diffs | One safety CLI plus T-07 sentinel on Phase 7 path union | Phase 6 vs Phase 7 | Same patterns, wider but still non-rewriting gate. |
| Inventory ephemeral stdout | Safety ephemeral stdout (no committed report) | Phase 6 pattern reused | Avoids recursive freshness on the validator’s own output. |

**Deprecated/outdated:**

- Treating `CONTEXT_PROJECTIONS` as a live knowledge writer. Retired; route 410. Do not revive in safety tests except as historical evidence. [VERIFIED: docs/architecture/github-backed-knowledge-plane.md]
- Scanning the dirty primary checkout at `8360c04` as if it were this branch.
- Whole-file doctrine copy checks that would flag titles (`# Cambium Vision`) or `VISION.md` filenames (D-02 allows those).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ISA IDs are `ISC-1290..1293` | Code Examples / Validation | Wrong IDs break the lifecycle sentinel; planner should confirm in Wave 1. |
| A2 | Public script name is `safety:check` | Standard Stack | Harmless rename; keep `--source-revision` grammar either way. |
| A3 | Paragraph matcher drops ATX headings, link-only lines, and blocks with folded length &lt; 80 characters | SAFE-01 | Too low → title false positives; too high → misses short copied paragraphs. HEAD currently has **0** hits at ≥80 after dropping headings (305 markdown corpus files probed 2026-08-21). |
| A4 | SAFE-02 prose uses claim-vs-denial/attribution, not raw substring | Pitfall 2 | Raw substring fails HEAD on LIFECYCLE.md and intent-graph.md. |
| A5 | Shipped next command is `/gsd:verify-work 7` | SAFE-04 | If GSD closeout already advanced, handoff must name the live STATE command instead. |
| A6 | Privacy corpus is generated projections + Phase 7 changed paths, not all of `docs/evidence/` | SAFE-03 | Scanning all evidence will fight D-11 carve-outs. |
| A7 | `.temperance/project.json` is a SAFE-02 extra surface even though it is outside the inventory corpus | Pattern 3 | If planner excludes it, drop the `active_planner` fixture or add the file to a named extra-set in the contract. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

A3–A4 are the only decisions that can make HEAD fail before hostile fixtures exist. Planner should lock them in Wave 1 tests against the real SHA, not only synthetic repos.

## Open Questions

1. **Should `safety:check` be added to `scripts/verify-release.mjs`?**
   - What we know: `verify:release` already runs `npm test` (which will pick up `scripts/*.test.mjs`) plus drift/render-docs/standalone. It does **not** currently invoke `docs:inventory:check` or `generate-intent-graph --check`. [VERIFIED: scripts/verify-release.mjs]
   - What's unclear: whether CI must run the SHA-bound CLI in addition to unit tests.
   - Recommendation: **do not** modify `verify-release.mjs` in this phase. Wave 3 ISA evidence runs `npm run --silent safety:check -- --source-revision <full-sha>` explicitly, same as Phase 6 did for inventory check.

2. **Export `selectContent` / `digestText` vs duplicate?**
   - What we know: both functions are file-private today.
   - Recommendation: export small helpers from `intent-graph.mjs` and `temperance-flow.mjs` (or one shared `scripts/source-digest.mjs` moved from existing code). Do not copy-paste selectors; `text.line:` and handoff redaction will drift.

3. **Fitcheck compile-only receipt named in CONTEXT**
   - What we know: CONTEXT cites `docs/evidence/2026-08-20-fitcheck-d1-compile-only.v1.json` @ `7852fb3`. That file is **not** in this worktree.
   - Recommendation: HANDOFF may name the discuss-time compile-only probe as unresolved/not-CAS (D-15). Do not invent the file.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | validator + `node --test` | ✓ | v26.7.0 | — |
| npm | `npm test`, `npm run --silent` | ✓ | 11.19.0 | — |
| git (`/usr/bin/git`) | commit-tree adapter | ✓ | 2.54.0 | — |
| Python 3 | none for this phase | ✓ | 3.14.7 | unused |
| wrangler | **must not be used** | ✓ (present) | 4.124.0 | Do not invoke. D-15. |
| slopcheck | package legitimacy | ✓ | installed | No packages to check. |
| ctx7 | library docs | ✗ | — | Not needed (in-repo patterns). |
| D1 / Vectorize / Cloudflare deploy | deferred | n/a | — | Name identities only. |

**Missing dependencies with no fallback:** none for repository-only execution.

**Missing dependencies with fallback:** ctx7 (unused).

**Blocked by policy (present but forbidden):** wrangler upload, D1 CAS, Vectorize ingest.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node --test`) on Node 26 |
| Config file | none — `package.json` `scripts.test` glob `scripts/*.test.mjs` … |
| Quick run command | `node --test scripts/deterministic-safety.test.mjs scripts/check-deterministic-safety.test.mjs scripts/infinite-game-anchors.test.mjs` |
| Full suite command | `npm test` |

CI `deterministic release verification · node 26` runs `npm run verify:release`, which includes `npm test`. [VERIFIED: .github/workflows/ci.yml]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAFE-01 | Copied VISION/MISSION paragraph in overlay at SHA fails; titles/filenames/digests allowed; dirty worktree ignored | unit | `node --test scripts/deterministic-safety.test.mjs --test-name-pattern='SAFE-01'` | ❌ Wave 0 |
| SAFE-01 | Path set equals inventory `corpusPaths`; untracked MEMORY/ not scanned | unit | same | ❌ Wave 0 |
| SAFE-02 | Hostile `active_planner` / `projectionAuthority: planning` / self-claim phrase fails; ISA.md and STATE.md allowed; LIFECYCLE denial passes | unit | `node --test scripts/deterministic-safety.test.mjs --test-name-pattern='SAFE-02'` | ❌ Wave 0 |
| SAFE-03 | Recorded source digest ≠ recomputed SHA blob digest fails with `path#selector` | unit | `node --test scripts/deterministic-safety.test.mjs --test-name-pattern='SAFE-03'` | ❌ Wave 0 |
| SAFE-03 | `/Users/`, `/Volumes/`, `promptBody=`, native session id fail; Worker UUID and CF account id do not | unit | same | ❌ Wave 0 |
| SAFE-01..03 | CLI `--source-revision` required; unknown flags rejected; zero writes; redacted stderr; non-zero on hit | integration | `node --test scripts/check-deterministic-safety.test.mjs` | ❌ Wave 0 |
| SAFE-01..03 | Package command `npm run --silent safety:check -- --source-revision <REV>` | integration | same | ❌ Wave 0 |
| SAFE-04 | ISA ISC-1290..1293 coherent 0/4 then 4/4; HANDOFF names write set, fixtures, D-15, D-16, next command | unit + manual review | `node --test --test-name-pattern='SAFE-0|Phase 7' scripts/infinite-game-anchors.test.mjs` | ❌ Wave 0 (extend existing file) |
| T-07 | Phase 7 changed-path privacy union (copy T-06-22) | unit | `node --test --test-name-pattern='T-07' scripts/infinite-game-anchors.test.mjs` | ❌ Wave 0 |

Existing complementary gates (keep in Wave 3, do not replace):

- `npm run --silent docs:inventory:check -- --source-revision <SHA>`
- `node scripts/generate-intent-graph.mjs --check`
- `node scripts/generate-temperance-flow.mjs --check`
- `npm run drift:audit`
- `npm run render-docs:check`
- `npm run standalone:audit`
- `git diff --check`

### Sampling Rate

- **Per task commit:** focused `node --test` on the files the task touched
- **Per wave merge:** quick run command above
- **Phase gate:** `npm test` plus `safety:check` at the committed SHA, plus the complementary gates listed above, before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `scripts/deterministic-safety.test.mjs` — RED for SAFE-01..03 synthetic Git fixtures
- [ ] `scripts/check-deterministic-safety.test.mjs` — RED for CLI/package/zero-write
- [ ] `docs/architecture/contracts/deterministic-safety-v1.md` — contract committed with implementation, not before RED
- [ ] Extend `scripts/infinite-game-anchors.test.mjs` Phase 6 lifecycle matrix to admit Phase 7 `plan 0/4` then `verify 4/4`
- [ ] Framework install: none — Node 26 already required by CI

Wave 0 means write failing tests first (Phase 6 06-01 Task 2 style). No new test harness.

## Security Domain

`security_enforcement` is enabled (config default).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface. Live Worker identity is named, not contacted. |
| V3 Session Management | no (privacy yes) | Native session identifiers in projections are SAFE-03 hits. |
| V4 Access Control | yes | Closed authority: only ISA.md and live STATE.md may claim goal/planning. Projections stay `read_only`. |
| V5 Input Validation | yes | Closed CLI grammar; `REV^{commit}` once; path safety; closed schemas. Copy inventory parser. |
| V6 Cryptography | yes | SHA-256 via `node:crypto` only. Never hand-roll and never compare Git SHA-1 to `sha256:`. |
| V1 Architecture | yes | Zero-write, no network, no provider, no D1/wrangler. |
| V7 Error Handling | yes | Redacted diagnostics; no partial stdout document on failure. |
| V13 API | no | Local CLI only. |
| V14 Config | yes | No secrets in repo; `.temperance/project.json` host pointers stay `host-managed`. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Dirty worktree substitution | Tampering | Commit-tree only; path-set equality with inventory |
| Git replace-refs swapping trees | Spoofing | `--no-replace-objects`; Phase 6 already tests this |
| Validator becomes a writer (`--fix`) | Elevation of Privilege | Closed parser; no write APIs; snapshot tests |
| Copied doctrine as silent second vision | Tampering | SAFE-01 paragraph match |
| Manifest claims planning authority | Elevation of Privilege | SAFE-02 schema/role + phrase claims |
| Stale projection presented as current | Tampering / Repudiation | SAFE-03 selector digest recompute |
| Secrets / `/Volumes` / prompt bodies in projections | Information Disclosure | SAFE-03 + T-07; `safeDiagnostic` |
| Scanning ignored MEMORY/ | Information Disclosure | Never probe ignored/provider memory |
| False-fail DoS via UUID/CF ID | Denial of Service | D-11 allowlist |
| Supply chain | Tampering | No new packages (accept T-07-SC analog of T-06-SC) |
| Runtime mutation (wrangler/D1/Vectorize) | Elevation of Privilege | Out of scope; handoff names as unresolved |

Phase 6 closed 25 threats @ `95634db` / 06-SECURITY.md. Phase 7 should add a T-07-* register in plan threat models (revision spoofing, dirty tree, phrase false-fail, digest mismatch, privacy leak, write-on-hit, GSD closeout spoofing) and keep T-07-SC accepted: Node built-ins only.

## Sources

### Primary (HIGH confidence)

- `scripts/documentation-inventory-sources.mjs` — commit-tree corpus, MEMORY fact, `contentDigest`
- `scripts/documentation-inventory.mjs` — schema `cambium.documentation-inventory.v1`, `PRIVATE_TEXT`, retain-only
- `scripts/check-documentation-inventory.mjs` / `generate-documentation-inventory.mjs` — CLI grammar
- `docs/architecture/contracts/documentation-inventory-v1.md` — public inventory contract
- `scripts/intent-graph.mjs` / `generate-intent-graph.mjs` / `docs/architecture/contracts/intent-graph-v1.md` — selectors, digests, overlay rules
- `scripts/temperance-flow.mjs` / `generate-temperance-flow.mjs` / `docs/architecture/contracts/temperance-flow-v1.md` — `text.line:`, handoff redaction, `intentGraph.digest`
- `scripts/ralph-iteration.mjs` — persistence surfaces `summary`, `state`, `handoff`; schema `cambium.ralph-iteration.v1`
- `scripts/infinite-game-anchors.test.mjs` — T-06-22 privacy + ISA lifecycle
- `scripts/standalone-audit.mjs` — `/Users/sheshnarayaniyer`, `/Volumes/madara`
- `.planning/phases/06-documentation-stewardship/{06-01-PLAN.md,06-02-PLAN.md,06-04-PLAN.md,06-04-SUMMARY.md,06-SECURITY.md,06-VERIFICATION.md}`
- `.project/HANDOFF.md` Phase 6 checkpoint
- `ISA.md` ISC-1273..1289
- `package.json`, `.github/workflows/ci.yml`
- `.planning/phases/07-deterministic-safety-and-handoff/07-CONTEXT.md` (locked D-01..D-16)
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/config.json`
- `AGENTS.md`, `Claude.md` / `CLAUDE.md`, `PROJECT.md`

### Secondary (MEDIUM confidence)

- HEAD paragraph-collision probe (305 markdown inventory files, 0 hits at folded length ≥80 after dropping headings) — informs A3, not a locked threshold
- Phrase occurrence survey in `docs/LIFECYCLE.md` and historical `docs/plans/` — informs Pitfall 2

### Tertiary (LOW confidence)

- ISC-1290..1293 numbering (A1)
- Exact shipped next command if GSD closeout order changes (A5)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — in-repo modules and Node 26 verified in this checkout
- Architecture: HIGH — inventory + digest + handoff analogs are complete and tested
- Pitfalls: HIGH for dirty tree / wrong digest / MEMORY / `/Volumes`; MEDIUM for phrase-claim grammar (A4) until Wave 1 locks HEAD-passing fixtures

**Research date:** 2026-08-21
**Valid until:** 2026-09-20 (internal contracts; 30 days)

**This worktree:** branch `codex/phase-5-decisions`, HEAD `09ee656de595facab3d85c057f1f59628224aa4b`. Do not switch branches. Do not deploy, wrangler upload, D1 CAS, Vectorize ingest, or mint tenants/TeamForge ids.
