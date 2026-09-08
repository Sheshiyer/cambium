# Approved ownership mapping — local reviewed overlay

Source checkpoint: `e93fade5b780123f9c4e9fa57e4b0899aaa2216a`.
Independent Astra review PASS; coordinator independently reran all 110 tests
(109 passed, one existing skip) and the read-only publication census.

The coordinator then published exactly four existing local root headers through
`writeRootHeaders`: Thoughtseed and Tryambakam Noesis each received `PORTFOLIO.md`
and `portfolio-map.v1.json`. All four read back as the exact reviewed bytes with
their prior modes preserved. The root-map digest below matches both published
JSON headers. The writer rechecked all 75 Thoughtseed and 38 Noesis entries.

Before publication, all four prior files were backed up and restored into a
separate proof directory, verifying byte hashes and modes. Publication checked
the source commit/digest and each current header against its backup before any
write; compensation would restore only unchanged source-owned outputs. Backup
and read-back evidence is retained under
`~/.codex/backups/portfolio-ownership-20260907T151238471Z/`, including
`manifest.json` and `publication-receipt.json`.

After publication, `temperance-hands open thoughtseed-labs --check --json`
returned `ok: true`, `check: true`, and admission `admitted` for the existing
Thoughtseed Labs root. This was read-only; no navigation, worker dispatch or
provider canary was performed. The agent-only boundaries below describe the
worker's scope; these coordinator actions complete the approved publication.

Session Atlas remains the distinct `program:session-atlas` mapping node, explicitly `reviewed-local-node` pending canonical registry promotion. Meristem reuses `program:meristem-brand-system`. Both carry explicit `modular-organ-of` relations to `sapling:cambium` in root JSON, root Markdown and browser/worker projections. Somatic Canticles reuses `branch:somatic-canticles` under Tryambakam Noesis. Synchronocities remains the distinct reviewed local mapping node `program:synchronocities-blog`, partner-owned/personal-affiliated with null client account. Its existing Noesis folder listing describes placement, not Thoughtseed ownership; it is not an instantiated canonical Thoughtseed WorkObject. No partner identity was invented.

The additive optional `ownershipDecisions` field is local owner-review evidence, not a prepared or issued remote receipt. Immutable observed IDs, root mappings, relationship tuples, local conflicts and exact folder status are validated. Remote rows retain null local observations and null proposed folders. The three historical Batch-3 prepared receipts, corrected Cambium Website and nested Codigo/Decodik semantics remain intact. Canonical reviewed72 catalog and all foundation approval pins remain unchanged. Current action-queue root digest tracks the updated proposal; no catalog/classification digest or issued receipt was modified.

Root capturedAt is refreshed to2026-09-07T15:13:26Z for this reconciled snapshot after parent reported the fresh full owner census75 Thoughtseed/38 Noesis (including infrastructure/archive). Intake observedAt/cutoff/activity timestamps remain their original evidence.

## Validation

- Focused intake23/23 passed, including immutable identity, conflicts, ownership/relationship, authority/path regressions, exact held-folder protection, and order independence.
- Whole portfolio suite109 passed, one existing skip, zero failures (110 tests).
- Browser/worker root and intake exact generation parity passed; root JSON/Markdown ownership rendering regression passed; git diff --check passed.
- Broader read-only linkage report remains blocked by the unchanged reviewed root pin and unresolved root IDs (including the intentionally unpromoted Session Atlas node). No catalog mirror drift remains. The broader linkage fixture test expecting drift-observed still fails on that known blocked foundation boundary; no approval pin was relaxed to make it green.

## Digests

- rootMapDigest: `52a106d39fe92ac84f6ff47362845fbcd1c5a0c7d11d9a1cd1e24729bdf678a0`
- sourceDigest: `58c414493ac4bf0494165f0a3b9219f8c252ba8a53365cbd76ed58da0f06cca7`
- observationDigest: `55026c14c4f088aecd6ab9443cc5df7e6fd5d5ce91a35ed3fd125963e8aeef5e`

## Remaining boundaries

Meristem, Somatic trilogy and Synchronocities lack local observations in intake. Somatic book/webapp folder holds remain separate from the approved trilogy identity; no path association was invented. Unrelated missing immutable identities and infrastructure observation-only gaps remain. Parent owns independent review, exact commit, STATE and publication. This agent performed no live header publication, GitHub/R2 writes, issuance, relocation, registry mutation, runtime changes or commits.

A registry-source worktree was created before parent superseded canonical promotion: branch codex/approved-cambium-organ-registry-20260907 at4e014764154ea34407fc79550d7e512b72bf61c5. It remains clean and unused; no canonical registry writes occurred. The original dirty vault checkout was preserved.
