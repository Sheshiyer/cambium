# The connected system — visual source edition

[Interactive guide](index.html) · [Static organ map](system-atlas.svg) · [Architecture readback](../../architecture/system-atlas.md).

Four views share the exact Mini App model and renderer: eleven organs, connected
system, six growth desks and evidence. Existing portraits are bundled as small,
hash-bound derivatives. The guide needs no external script, font or image service.

Run `node scripts/preview-system-atlas.mjs` from the repository root to review the
generated guide locally. This server binds only to `127.0.0.1` and serves an explicit
public-document allowlist. No live account or authenticated fixture is required.

The same server offers labeled loopback fixtures at
`/miniapp/legacy?scene=inspect&pane=system` and `/miniapp/fabric` for verifying
both existing inspection seams. The Fabric fixture uses a synthetic bridge and
canonical populated source fixtures. All writes return405; account and provider requests are never
proxied. Those fixtures establish local presentation only.

The working app now uses the same visual language across all five scenes in
each shell. Review `/miniapp/browser` for a simulated verified browser response;
`/miniapp/auth`, `/miniapp/service`, `/miniapp/offline` and `/miniapp/empty` begin
with a valid synthetic hydration and then exercise their unavailable read.
See [Curious workbench review](../curious-workbench-2026-10-07.md) and the
[interaction contract](../../architecture/contracts/curious-workbench-v1.md).

Generate with `node scripts/generate-system-atlas.mjs --write`; verify without
writing with `node scripts/generate-system-atlas.mjs --check`. Source contract:
[system-atlas-v1](../../architecture/contracts/system-atlas-v1.md). Portrait ownership:
[PORTRAITS.v1.json](../../assets/visual-flow/system-atlas/PORTRAITS.v1.json).

The private growth whitepaper companion remains in its vault. This public
edition contains reviewed topology and portable contracts, not private prose.
Access membership, actual callbacks, containment, usefulness, delivery and soak
require fresh owner receipts. Publication and deployment remain separate actions.
