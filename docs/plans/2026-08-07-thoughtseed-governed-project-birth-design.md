# Thoughtseed Governed Project Birth Design

**Date:** 2026-08-07
**Status:** founder-approved for local implementation; production held
**Scope:** make every new Thoughtseed repository begin through one typed,
ingestion-aware creation contract while removing Tryambakam · Noesis from the
active Portfolio Workbench.

## Founder decision

The Workbench now focuses only on Thoughtseed. The reviewed Tryambakam · Noesis
snapshot and root headers remain preserved evidence, but no selector, card,
drawer, action, or count for that portfolio appears in the active UI.

Project creation uses one authority rule:

- an explicit local founder command may execute immediately;
- `agent`, `rbac`, `dgchat`, and `system` requests are proposals until a Founder
  Gate approval is resolved from the authoritative Thoughtseed Gate store and
  binds the normalized intent digest;
- no browser or remote caller writes the local filesystem.

## Placement and grammar

Every repository remains shallow:

```text
<projects-root>/thoughtseed/<repository>
```

Client Branch is a logical project-index classification, not a container and
not a Git branch. The executor never creates `clients/`, `branches/`,
`saplings/`, or `programs/` around repositories.

Classification is derived only from explicit origin evidence:

| Origin | Derived kind | Additional requirement |
|---|---|---|
| `thoughtseed-venture` | `sapling` | none |
| `thoughtseed-internal` | `internal-program` | none |
| `client` | `client-branch` | exact `clientFamilyId` |
| `unknown` | `needs-review` | creation remains blocked |

A caller supplies a repository slug, not a path. The server and local executor
derive `thoughtseed/<slug>` and reject absolute, nested, traversal, symlink,
existing, or non-empty destinations.

## Authority flow

```text
Founder UI / local founder / agent / RBAC / dgchat / system
  -> thoughtseed.project-creation-intent.v1
  -> closed validation and origin-derived kind
  -> local-founder: execution-ready
     non-founder source: founder-gate-pending
  -> immutable R2 evidence
  -> bounded pending-governed-project-creation trigger
  -> authoritative Founder Gate resolution when required
  -> trusted local executor
  -> shallow Git repository + seven-document project/workflow packet
  -> project-local ingestion receipt and project-index proposal
  -> later Cambium reconciliation and repository-owned GitHub planning
```

The hosted Worker cannot create host filesystem folders. It records an
idempotent intent and queues the next governed flow. The trusted local executor
is the only filesystem writer. Its standalone CLI executes only explicit
local-founder intents; non-founder execution requires a host-supplied resolver
capability backed by the authoritative Gate store. R2 remains evidence; it does
not become a filesystem, project-index, or Goal Graph authority.

## Workbench interaction

The Thoughtseed header exposes one `New Thoughtseed project` action. It opens a
bounded intent form for project name, safe repository slug, explicit origin,
and a client family only when origin is `client`. The founder UI fixes the
request source to `local-founder`, displays the derived kind as read-only, and
never asks for a destination path. Submission records the hosted intent and
shows the returned execution or Founder Gate state; it does not pretend the
local folder already exists.

## Project packet

Successful local execution creates the repository atomically enough to fail
before exposing a partial project wherever practical. The initial packet is:

- `PROJECT.md`
- `AGENTS.md`
- `CLAUDE.md`
- `.project/project.yaml`
- `.project/CONTEXT.md`
- `.project/HANDOFF.md`
- `.project/WORKFLOW.md`
- `.project/project-ingestion-receipt.v1.json`
- `.project/project-index-proposal.v1.json`

The executor consumes an explicitly supplied workflow registry, records the
selected workflow in `.project/WORKFLOW.md`, and creates one safe project-local
directory per selected stage. No machine-local registry path is committed.

Git is initialized locally. GitHub repository creation, issue creation, remote
push, Vault registry writes, R2 mutation, production deployment, and project
folder relocation are separate governed operations and are not performed by
the local executor.

## Index and ingestion contract

The machine-readable policy lives at
`docs/project-management/thoughtseed-project-birth.v1.json`. The reviewed
existing-folder snapshot remains `portfolio-roots.v1.json`; the birth contract
defines how a future repository can enter that index without treating folder
creation as canonical reconciliation.

The project-local index proposal is the durable bridge to Cambium. It records
the derived relative path, classification, client family where applicable,
request source, approval evidence class, and intent digest. It contains no
machine-local absolute path.

Creation is not treated as fully ingested. The receipt explicitly says
`pending-cambium-ingestion` until repository identity, GitHub planning
authority, and the root portfolio index are reconciled. This prevents a new
directory from silently becoming an authoritative WorkObject.

## Failure boundaries

- Unknown origins never create repositories.
- Non-founder requests without Gate approval never create repositories.
- An inline Gate claim cannot authorize execution; the Worker resolves the
  record from `gate:thoughtseed:<id>` and verifies approve kind, founder,
  active status, and exact intent digest.
- The executor rejects root-map or catalog digests that differ from the exact
  reviewed snapshots, even when they are valid SHA-256 strings.
- Existing, nested, traversal, symlink, or non-empty destinations fail closed.
- A failed project packet or Git initialization does not update the portfolio
  index or claim ingestion success.
- No active UI route or action exposes Tryambakam · Noesis.
- Production remains blocked by packet review #292 and promotion #293.

## Verification

- Focused UI tests prove the Thoughtseed-only header and absence of every
  Tryambakam active marker.
- Contract tests prove closed fields, origin-derived grammar, authoritative
  Gate resolution, exact snapshot pinning, R2-before-queue ordering, replay
  safety, and Goal Graph isolation.
- Temporary-root executor tests prove local-founder execution, non-founder
  denial, approved non-founder execution, path safety, packet completeness,
  Git initialization, and index/receipt output.
- The complete Workbench and repository release suites must pass before handoff.
