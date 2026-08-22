# Deterministic Safety v1

## Status and authority

`cambium.deterministic-safety.v1` is a deterministic, ephemeral,
`read_only` inspection receipt over one committed repository tree. It is not
doctrine, acceptance, planning state, an action queue, a relocation
decision, or a deletion authority. Existing owners remain unchanged:

- root `VISION.md` and `MISSION.md` own repository doctrine;
- root `ISA.md` owns approved goals and acceptance;
- live `.planning/STATE.md` owns the current finite planning transition; and
- generated projections remain `projectionAuthority: "read_only"`.

No JSON or Markdown safety report is committed. The compiler returns a
validated receipt object or throws. The CLI lands in plan 07-02.

## Explicit revision input

The caller must provide `--source-revision <REV>`. The compiler resolves that
value exactly once with:

```text
git rev-parse --verify REV^{commit}
```

The resolved value must be a full lowercase 40-hex commit SHA. Every later
tree enumeration and blob read uses only that SHA through `git ls-tree` and
`git show FULL_SHA:path` spawned as `/usr/bin/git --no-replace-objects
--no-optional-locks`. Worktree files, staged bytes, untracked `MEMORY/`, host
Temperance state, filesystem mtimes, locale, clock time, and checkout location
do not enter the model.

Public invocation after the 07-02 CLI lands:

```bash
npm run --silent safety:check -- --source-revision <REV>
```

The `--silent` flag is part of the public example so package-manager banners
cannot corrupt the single stdout receipt. There is no implicit revision,
`--write`, `--fix`, `--output`, `--outputFile`, staged/index mode, deployment
mode, provider argument, or external-effect mode.

## Corpus and extra SAFE-02 surface

The path set is exactly the Phase 6 documentation-inventory corpus at the
resolved SHA:

1. every tracked root Markdown file;
2. every tracked blob under `docs/`; and
3. every tracked blob under `.planning/`.

The compiler independently enumerates the same commit tree and requires exact
sorted `corpusPaths` equality with `buildDocumentationInventorySources`.
Untracked `MEMORY/` is recorded only as the bounded `rootMemoryTracked` fact.

`.temperance/project.json` is a named extra SAFE-02 surface. When that path
exists at the SHA it is read with `git show`; it is never added to
`corpusPaths`.

## Locked gates

Gates are exactly `SAFE-01`, `SAFE-02`, and `SAFE-03`.

### SAFE-01 doctrine duplication

Extract `VISION.md` and `MISSION.md` paragraphs after `canonicalText`,
whitespace and punctuation fold, dropping ATX-heading-only blocks, link-only
lines, and folded blocks shorter than 80 characters. Match those paragraphs
against every other corpus path. Titles, filenames, and `sha256:` digest
references are allowed. Binary blobs are skipped. A hit throws `TypeError`
containing `SAFE-01` and the repository-relative overlay path.

### SAFE-02 authority drift

Scan only the closed D-05 list plus the named extra Temperance manifest:

- `docs/architecture/intent-graph.v1.json`, `docs/architecture/intent-graph.md`
- `docs/architecture/temperance-flow.v1.json`, `docs/architecture/temperance-flow.md`
- `.temperance/project.json`
- overlays: `PROJECT.md`, `README.md`, `docs/README.md`,
  `docs/doctrine/README.md`, `docs/LIFECYCLE.md`, `.planning/README.md`,
  `INFINITE-GAME.md`

Do not substring-scan historical `docs/plans/` or `docs/project-management/`.
Allowed claimants are `ISA.md` and `.planning/STATE.md`.

Schema/role fields are primary: `projectionAuthority` other than `read_only`;
`role` in `{sole_operational_writer, planning authority, goal-setting}`;
`active_planner` other than `isa` / `gsd` / omitted; `sourceOfTruth` claiming
ISA/GSD; Ralph `cambium.ralph-iteration.v1` writer fields `queue`, `dispatch`,
or `selfCertified`. Prose fails only on self-claims or unattributed assertions
of `source of record`, `planning authority`, or `goal-setting`. Denials,
`gsd_planning` legends, and attributions to `ISA.md` / `.planning/STATE.md`
are allowed.

### SAFE-03 freshness and privacy

Freshness applies only to generated projections that already declare source
digests. Intent Graph JSON is the digest source of truth: recompute each
declared `path#selector` with `selectIntentGraphContent` / `digestText` over
`git show` bytes; overlay anchors are whole-file `digestText`. Temperance Flow
JSON recomputes with `selectTemperanceFlowContent`, applies
`redactReviewedHandoffForDigest` when `kind` is `reviewed_handoff`, and treats
`intentGraph.digest` as `digestText` of the Intent Graph JSON blob. Markdown
byte parity remains complementary `generate-intent-graph.mjs --check` /
`generate-temperance-flow.mjs --check`. Do not freshness-check ephemeral
documentation-inventory stdout. Do not compare recorded digests to Git SHA-1
or inventory `digestBuffer`.

Privacy scans the four Intent Graph / Temperance Flow paths when present.
Case-exact Unix user-root and volume-root prefixes, prompt/request/response
bodies, native session identifiers, and key material fail. Cloudflare
account-id-shaped 32-hex values, Worker Version UUIDs, and 64-hex `sha256:` /
graph digests are not privacy hits. Historical D1 Telegram refs inside
`docs/evidence/` receipts are outside this privacy corpus.

## Zero-write prohibition

The compiler is a pure module. It has no CLI, no `writeFileSync`, no `mkdir`,
and no network. On any hit it throws `TypeError` containing the gate id and a
repository-relative path, does not rewrite the offending file, and does not
publish a replacement projection. Successful receipts have empty `hits` and a
`safetyDigest` of the canonical object without `safetyDigest`. Writer fields
(`write`, `fix`, `output`, `outputFile`, `queue`, `dispatch`, `command`,
`relocate`, `delete`) are rejected.
