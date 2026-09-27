---
phase: "09"
name: Source Inventory and Classification
created: 2026-09-23
status: pending
---

# Phase 9: Source Inventory and Classification — Context

## Decisions

- The phase lookup failed before the plan was created because ROADMAP.md had only a summary checkbox for the active milestone and omitted GSD's required current-milestone and Phase 9 detail headings. Those headings are now present; Phase 9 scope and requirements are unchanged.
- `thoughtseed-labs` and `workers/quests/wrangler.labs.jsonc` remain the only production authority. `9d9d` and `workers/quests/wrangler.jsonc` are read-only source and rollback evidence.
- Inventory is limited to the two approved prefixes in the Cambium Cloudflare resource map: `portfolio/thoughtseed/workobjects/` and `context/v1/daily-standup-digest/standups/`, in their mapped R2 buckets. Do not list other prefixes or whole-bucket contents.
- Compare each approved source prefix with the identical bucket and prefix in the Labs target account so every relevant key can be classified.
- Record exact key, size, last-modified time, ETag, and SHA-256 content digest. Do not treat ETag as a content digest. If no trustworthy SHA-256 checksum is available in metadata, stream each object through a hash operation and discard the bytes without writing payload files.
- Keep exact inventory output outside both repositories and the Labs vault, in a private temporary directory with restrictive permissions. Retain no object bodies. Repository evidence contains only redacted counts, inventory digest, scope, timestamps, and classification totals.
- Follow pagination to completion and fail closed on repeated or missing cursors, duplicate keys, API errors, changed objects during hashing, or inconsistent metadata. A partial listing is not a complete inventory.
- Classify matching key and digest as identical; a differing object with a newer target timestamp as target-newer; source-only objects as source-only; other same-key digest differences as conflicting; known projection records as derived-rebuild. Report target-only objects separately.
- No object copy, overwrite, delete, upload, D1/KV/Vectorize operation, Worker change, Access change, DNS change, tunnel change, deployment, source retirement, or merge is part of Phase 9. Phase 10 remains separately gated.
- Preserve both repositories' existing dirty work and exact checkout heads. Do not stage or commit generated planning files while either checkout contains pre-existing user changes.

## Discretion Areas

- Use the Cloudflare authenticated read method supported by the available local credentials. Never print, persist, or request secrets in chat. If read credentials are unavailable or lack the required account/prefix scope, stop with a sanitized blocker.
- Hashing may read object bytes only to compute the digest. It must not create persistent payload copies, write to a repository, or expose content in stdout or logs.
- If metadata changes between listing and digest read, re-list the affected prefix once and retry the affected object. If it changes again, classify the affected record as unresolved and do not claim Phase 9 complete.

## Deferred Ideas

- Per-key allowlisting and copying of source-only objects.
- Production parity proof, source-writer/traffic shutdown, rollback observation, and retirement.
- Cambium/Hermes Telegram incident remediation, which resumes only after Phase 9 inventory and classification are complete.
