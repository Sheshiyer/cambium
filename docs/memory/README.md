# Cambium Memory Portability

Cambium's memory is product capability, not host-company data. A clean clone must run without any real cortex state, while a real adopter must be able to export, reset, migrate, or delete org-specific memory without crossing tenant boundaries.

This guide covers the standalone contract for semantic memory. Structural memory remains a separate CodeGraph lane and should be regenerated from the adopter's own repository.

## Memory Surfaces

| Surface | Default location | Product role | Commit policy |
|---|---|---|---|
| Local semantic cortex | `.operator/cortex.db` plus SQLite sidecars | local recall across operator wakes | never commit |
| Variable contracts and deviations | `cortex/<tenant>/...` when using local composition transport | stage handoff and why-handler ledger | never commit unless explicitly converted to a synthetic fixture |
| Vectorize cortex | Cloudflare Vectorize index | production kNN memory store | never export raw payloads into repo |
| Synthetic fixtures | `docs/memory/fixtures/*.json` | tests and adopter examples | only fake records with fake vectors |

The common record shape is `MemoryRecord`: `{ id, kind, tenant, vector, payload, ts }`. The `tenant` field is mandatory and is the isolation key for every search and reset operation.

## Export

Use export when an adopter needs to back up or migrate memory. The export artifact must be tenant-scoped and reviewed before it leaves the runtime boundary.

Recommended export shape:

```json
{
  "schema": "cambium.memory-export.v1",
  "tenant": "demo-org",
  "generatedFrom": "synthetic-fixture",
  "records": [
    {
      "id": "demo-org:v1:example",
      "kind": "decision",
      "tenant": "demo-org",
      "vector": [1, 0, 0, 0],
      "payload": {
        "eventKind": "tweak",
        "action": "hold generic position"
      },
      "ts": 0
    }
  ]
}
```

Rules:

- Export one tenant at a time.
- Preserve `tenant` on every record.
- Keep vectors numeric and bounded.
- Redact payload text before sharing.
- Store real exports outside the repository, for example under an encrypted backup location.
- Convert reusable lessons into synthetic fixtures or docs, not raw memory dumps.

## Import

Import should be explicit, reviewed, and reversible.

Before import:

- validate every record with the `MemoryRecord` contract.
- reject records whose `tenant` does not match the target org slug.
- reject records with provider secrets, private paths, live customer identifiers, or raw chat transcripts.
- confirm the embedding dimensionality matches the target store.
- stage into a non-production tenant first when possible.

For local SQLite, import tooling should write through `sqliteCortex().upsert(record)` after `init()`. For Vectorize, import tooling should write through `vectorizeCortex().upsert(record)` after `init()`. Do not bypass the `CortexStore` interface; it is the seam that keeps local and production memory behavior aligned.

## Reset and Deletion

Reset is for local rehearsal. Deletion is for an adopter's data-governance request.

Local reset:

```bash
rm -f .operator/cortex.db .operator/cortex.db-shm .operator/cortex.db-wal
rm -rf cortex/<tenant>
```

Then reseed the synthetic baseline if needed:

```bash
npm run demo:tenant -- --tenant demo-org --force
```

Production deletion:

- delete or tombstone only records for the requested tenant.
- delete Vectorize records by tenant-filtered ids, not by clearing the whole index unless every tenant is in scope.
- record a deletion receipt outside this repository.
- rerun a tenant-scoped recall check after deletion.

## Threat Model

| Risk | Control |
|---|---|
| cross-tenant recall | use `tenantScopedStore`; force `tenant` in every search |
| private memory committed to git | keep `.operator/` and `cortex/` ignored; run `npm run standalone:audit` |
| provider lock-in | treat NIM and Vectorize as adapters behind `CortexStore` |
| raw customer data in payloads | summarize and redact before writing `payload.text` |
| embedding mismatch during migration | validate vector dimensions before import |
| deletion that misses sidecars | remove SQLite `db`, `db-shm`, and `db-wal` together |

## Acceptance Checks

- `npm test` validates the synthetic memory fixture and docs.
- `npm run standalone:audit` scans publishable files for private paths, credentials, and live host defaults.
- real memory exports are absent from source control.
- adapter docs explain provider failure modes before live memory is enabled.
