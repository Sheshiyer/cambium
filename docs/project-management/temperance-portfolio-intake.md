# Temperance portfolio intake generator

`scripts/generate-temperance-portfolio-intake.mjs` builds a versioned,
read-only `temperance.portfolio-intake.v1` snapshot from the existing root map,
reviewed repository mapping queue, an authenticated GitHub/local Git audit,
optional exact GitHub Project item links, optional host enrollment records,
and optional reviewed source holds. It performs no GitHub calls or Git
mutations.

The full snapshot is host-private: it can contain names and links to private
repositories and Projects. The generator refuses a destination inside this
public repository and writes output with mode `0600`. Keep raw audits, board
item exports, enrollment records, reviewed hold details, and generated
snapshots outside public Git. The checked-in tests use synthetic identities.

```sh
node scripts/generate-temperance-portfolio-intake.mjs \
  --audit /path/to/private-audit.json \
  --board-items /path/to/private-board-items.json \
  --enrollments /path/to/private-host-enrollments.json \
  --admission-evidence /path/to/private-resolver-audit.json \
  --holds /path/to/private-reviewed-holds.json \
  --manual-associations /path/to/private-reviewed-associations.json \
  --folder-observations /path/to/private-folder-observations.json \
  --out /path/to/private-intake.json
node --test scripts/generate-temperance-portfolio-intake.test.mjs
```

The snapshot includes stable repository identities, pseudonymous local
worktree records, WorkObject links only where supported by reviewed evidence,
exact board item repository links, PR URLs, explicit review holds, and
freshness. Folder proposals and unmatched local origins remain held. Existing
host enrollment records are shown as observed baseline rows. Their admission
field reflects a separate source-resolver receipt against Git identity and
live Superset project/workspace binding. A board link or observed enrollment
is not Hands authority.

A reviewed manual association can connect a local Git identity with no origin
to a private GitHub repository. The input must carry the exact Git common
directory, immutable GitHub repository IDs, a user ownership decision, and a
source intake receipt. The generator cross-checks the repository against the
authenticated audit and the source PR URL and head against audited PR evidence.
Duplicate or conflicting associations fail generation. The resulting entries
remain held for source PR review and separate manual enrollment.

The same private association input can instead contain a `verified-duplicate`
receipt for an archived checkout with no origin. It must identify one live
checkout with an authenticated origin and prove equal branch tips, worktree
heads, dirty change hashes, and full file inventories. The receipt also binds
the GitHub repository's immutable IDs and observed remote branch tip. Both
worktrees remain in the snapshot, linked to one repository identity; the
archive stays unenrollable and dirty work stays held for reconciliation.

Private folder observations cover newly discovered top-level recovery folders,
plain source folders, and folders with external Git origins without publishing
their names or paths. The generator checks each observation against the audit
when Git identity exists, emits a pseudonymous root context row, and keeps
the mapping and admission on hold. A root map archive container is represented
as an archive context row. Transient task worktrees remain in the worktree
audit rather than becoming permanent portfolio roots.

Review the private audit and snapshot before using them in Manifest. Resolve
scan errors, missing worktrees, source ownership questions, and PR overlap
through the owning repository's issue/PR workflow. Preserve original dirty
trees until remote results and byte or patch equivalence are verified.
The aggregate review queue is [Cambium issue #375](https://github.com/Sheshiyer/cambium/issues/375).
