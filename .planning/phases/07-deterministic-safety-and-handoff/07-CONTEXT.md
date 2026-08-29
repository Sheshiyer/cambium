# Phase 7: Deterministic Safety and Handoff - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add deterministic, fail-closed validation so maintainers can prove generated projections preserve authority, freshness, and privacy, and so a reviewed handoff records the bounded write set, verification evidence, unresolved approvals, and the exact next GSD command. This phase does not relocate or delete corpus files, does not upload Workers, does not CAS D1, does not ingest vault markdown into Vectorize, and does not mint tenants or TeamForge project ids.

</domain>

<decisions>
## Implementation Decisions

### Doctrine-duplication scan bounds (SAFE-01)
- **D-01:** Scan only the Phase 6 inventory corpus: committed named root documents, `docs/`, and `.planning/`. Ignore untracked `MEMORY/`, host Temperance state, and dirty cwd files.
- **D-02:** Duplication is a normalized paragraph match of `VISION.md` and `MISSION.md` bodies after whitespace and punctuation fold. Titles, filenames, and digest references are allowed.
- **D-03:** Only `VISION.md` and `MISSION.md` may contain those bodies. Every other file references or digests the anchors.
- **D-04:** On a hit, the validator exits non-zero, prints the path, and does not rewrite. Repair is a later owner-approved docs change.

### Authority-drift fail-closed (SAFE-02)
- **D-05:** Check manifests, Ralph state files, graph projections, and documentation overlays.
- **D-06:** Illegal claims are a closed vocabulary: schema/role fields plus phrases `source of record`, `planning authority`, and `goal-setting`.
- **D-07:** Allowed claimants are `ISA.md` for goals/acceptance and live `.planning/STATE.md` for the finite GSD transition.
- **D-08:** On a hit, fail closed with a non-zero exit, do not rewrite, and do not publish the projection.

### Freshness and privacy gates (SAFE-03)
- **D-09:** Freshness fails when a generated projection's recorded source digest does not equal the current source blob digest.
- **D-10:** Freshness applies only to generated projections that already declare source digests.
- **D-11:** Privacy fails on secrets, native session identifiers, prompt or response bodies, and machine-local absolute paths. Cloudflare account IDs, Worker Version UUIDs, and historical D1 Telegram source refs in existing receipts are not privacy hits.
- **D-12:** On a stale or privacy hit, fail closed with a non-zero exit, do not rewrite, and do not publish the projection.

### Reviewed handoff and continuation command (SAFE-04)
- **D-13:** The reviewed handoff lives in `.project/HANDOFF.md` plus `07-SUMMARY.md`. No third status writer.
- **D-14:** Exact next GSD command after this discuss: `/gsd:plan-phase 7` on branch `codex/phase-5-decisions`.
- **D-15:** Unresolved approval boundaries: D1 CAS, wrangler versions upload, Vectorize ingest, `getfitcheck` tenant mint, invented TeamForge slugs.
- **D-16:** The handoff must name the validator command, failing fixtures for SAFE-01..03, passing fixtures, and the live probe identities recorded 2026-08-20: Worker Version `089181f6-ed60-4710-aab6-cd10855360e0` at 100 percent (`git-21d4908`), D1 graph_digest `846400e1fa23704849d48a3ae0d3bf26b7e96d47e353abc0e26075f1cf89b05e`.

### Discretion
- Choose the smallest validator CLI and fixture layout that reuses the Phase 6 inventory compiler and Phase 4/5 digest pattern.
- Prefer one command that covers SAFE-01..03 over three unrelated scripts.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Doctrine and acceptance
- `VISION.md` — Canonical enduring Just Cause; SAFE-01 body source.
- `MISSION.md` — Canonical renewable Repository Mission; SAFE-01 body source.
- `ISA.md` — Goals and acceptance source of record (SAFE-02 allowed claimant).
- `PROJECT.md` — Reviewed repository and pickup entry.
- `.project/HANDOFF.md` — Packet pickup and SAFE-04 human handoff surface.

### Planning
- `.planning/ROADMAP.md` — Phase 7 goal and success criteria.
- `.planning/REQUIREMENTS.md` — SAFE-01 through SAFE-04.
- `.planning/STATE.md` — Live finite planning transition (SAFE-02 allowed claimant).
- `.planning/phases/06-documentation-stewardship/06-CONTEXT.md` — Locked inventory, lifecycle, and navigation decisions.
- `.planning/phases/06-documentation-stewardship/06-SECURITY.md` — Phase 6 threat register, 25 closed, zero open @ `95634db`.
- `.planning/phases/05-ralph-and-temperance-flow-projection/05-CONTEXT.md` — Read-only projection and authority-precedence decisions.

### Lifecycle and memory
- `docs/LIFECYCLE.md` — Human authority-and-lifecycle map.
- `docs/memory/boundary.json` — Committed memory-surface classification.
- `docs/doctrine/README.md` — Root doctrine catalog.

### Runtime probe (discuss-time, not a deploy)
- Live Worker Version `089181f6-ed60-4710-aab6-cd10855360e0` @ 100 percent, git `21d49089ae2a1344317fc92a83a0ac828f577806`.
- Live D1 `cambium-bridge` tenant `cambium` graph_version 1 digest `846400e1…`.
- Compile-only Fitcheck proposal on `docs/safe-r2-mapping-receipts` @ `7852fb3`: `docs/evidence/2026-08-20-fitcheck-d1-compile-only.v1.json`. Not CAS.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 6 inventory compiler already enumerates the committed named root, `docs/`, and `.planning/` without reading file bodies into an authority.
- Phase 4/5 generators already pin source digests on derived projections.
- Goal Graph compile on origin/main can produce a Fitcheck Mission→Task change-set without writing D1.

### Established Patterns
- Fail closed. Do not rewrite historical evidence.
- Indexes link; they do not copy doctrine or freeze live GSD status.
- Runtime outranks copied prose. Live Worker Version outranks cwd git.

### Integration Points
- Validator should consume the Phase 6 inventory as its path set.
- Handoff writes only `.project/HANDOFF.md` and `07-SUMMARY.md`.

</code_context>

<specifics>
## Specific Ideas

- Reuse Phase 6 path-set equality tests so SAFE-01 cannot silently scan a dirty tree.
- Add fixtures that copy a VISION paragraph into a fake overlay and expect non-zero exit.
- Add fixtures that set a Temperance manifest `active_planner` to something other than a reference to ISA/GSD and expect non-zero exit, while allowing `.temperance/project.json` to record `active_planner: isa` as metadata rather than a claim.

</specifics>

<deferred>
## Deferred Ideas

- Owner-approved D1 CAS for `sapling:fitcheck` against live head `846400e1…`.
- Wrangler versions upload; cwd SHA `8360c04` remains rejected.
- ParkArea / Tirak / Cambium WorkObject kind before a second TeamForge slug.
- Connected-repository inheritance of anchors (FUTURE-01).

</deferred>

---

*Phase: 07-deterministic-safety-and-handoff*
*Context gathered: 2026-08-20 via discuss-phase*
