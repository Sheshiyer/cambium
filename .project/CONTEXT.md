# Bounded project context

## Registry evidence

- Registry WorkObject: `sapling:cambium` (`Cambium`)
- Knowledge pointer: `00-meta/entity-registry.md`
- Repository: `cambium`

## Operating invariants

- Use Codex as the default local approval governor; other clients consume
  the same packet rather than creating competing project state.
- OmniRoute is a model-call transport beneath the project rail, not a
  project or session store.

## Fields needing review

No fields were flagged during drafting — every field in this packet came from a real, sourced value.

## Relocation boundary

This packet is reviewed-held. The separately approved Cambium Phase 1 and
Temperance Phase 2 archive-first promotions are complete and recorded by their
apply receipts. Those consumed approvals do not authorize another move,
rollback, or relocation; any further filesystem change remains blocked until an
exact manifest and a new live-apply approval exist.
