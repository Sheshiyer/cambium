---
quick_id: 260907-3vu
status: complete
implementation_commit: 1be492a
---

# Cambium Website and nested Codigo proposal correction

The owning source `docs/project-management/portfolio-roots.v1.json` now describes
Cambium Website separately from the historical `cambium-telegram-showcase` folder.
The existing `sapling:cambium` relationship is unchanged. Codigo retains client
`codigo-olimpo` and both existing branch IDs; Decodik is nested repository evidence
at `research/Decodik`, inheriting those relationships without a new WorkObject.

The root-map generator validates optional display names and nested evidence,
renders them in Markdown/JSON, and regenerates identical browser/worker modules.
The domain projection retains the optional metadata. Only the queue's current
root digest and Batch 1 current default are synchronized; historical evidence and
reviewed execution approval pins are preserved.

## Verification

- Focused root-map suite: 25 passed, including exact source/module parity, legacy
  compatibility, unchanged shallow census, unsafe path and invented-ID rejection.
- Combined root-map, domain, mapping queue, receipt compiler, and Worker catalog:
  96 tests, 95 passed, one existing skip, zero failures.
- `git diff --check`: passed.
- Snapshot digest: `aadaf3ddc0ba602089342147456d1e33d46d02b5ca0c969745c1cad00a2e4f69`.
- Broader linkage audit fixture still reports `blocked` where the test expects
  `drift-observed`. The reviewed foundation pin remains `e2abef8080c6ababab7a41e1803fa1eccc08b58a4dbf7876e586df78493bf351`;
  it already differed from this branch's pre-task snapshot digest
  `d900a024b8b07c122cd7896fbc166814be78d162ccfff7f297116448799059f4`.
  Advancing an execution approval pin is outside this proposal correction.

## Scope and continuation

Implementation commit: `1be492a`. Work stays on the assigned isolated branch
`codex/cambium-portfolio-mapping-20260906`. This is a local proposal candidate.
No external root header, enrollment, move, runtime, vault, deployment, publishing,
merge, or primary working-tree mutation occurred. The existing Phase 9 planning
and authenticated-read gates remain unchanged.
