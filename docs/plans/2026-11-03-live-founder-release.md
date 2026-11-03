# Live-only Founder release review

This isolated release restores the 114 source inputs recovered from the active
Worker source map. Before changes, the rebuilt 3,147,389-byte Worker matches
production byte for byte: SHA-256
`5497731ae358724a1bfe4a38eb20e6ebc5cc65e50bbf7e66b25ff95a4b91e764`.
The Git/test lineage is `67a7aee2eba391eb07f94e02b11060647bbc4c7f`;
it is not asserted to be the production Git revision. Three serving source
files differ from that ancestor. This is a release snapshot, not an instruction
to merge older backend code over newer main or unpublished native work.

## Reviewed change boundary

- Field Atlas is the sole default document, including legacy world/scene queries.
  Mission Control and its five-scene shell are absent from the emitted bundle.
  Historical fixtures remain test-only and absent from the build graph.
- Ordinary web Founder pages do not load or initialize the Telegram SDK.
  The existing Telegram transport remains available in its actual context.
- Verified, enrolled Founder Access can prepare bounded bookkeeping proposals
  for the two existing LumenBar/Temperance WorkObject references in Cambium.
  The existing canonical review, confirmation and Gate CAS decide them.
  No loadout, execution admission, product tenant or publishing grant is added.
- The maintained Gate folio shows the actual canonical graph through a
  read-only product hierarchy. Source observations and planning prerequisites
  remain distinct from D1 bookkeeping decisions and execution/publication.
- Retained serving backend modules are unchanged except `handler.ts` and
  `goal-graph-intake.ts`; the new parser is `native-goal-intake.ts`.

## Evidence and limits

The six native JPEG captures and strict receipt live in
`docs/plans/assets/field-atlas-viewport-proof/`. The local IAB capture is explicitly
synthetic; it proves source layout/interaction at desktop and CSS width 320,
not production authentication, live D1 acceptance or execution. The receipt
binds PAGE SHA-256 `024c0d61d56607c45b0221a97fe2b0f322ad9ad51bc2c452176058eacea7687e`.
Source security review exercised the real Worker entrypoint and signed identity
boundary. No deployment, enrollment, migration, provider or credential change
was performed by this release preparation.

The recovered baseline whole suite had 19 failures. The live-only candidate
introduces no backend failure identities. Eleven deferred membership/planning/
workbench expectations and two privacy/history gates remain inherited holds.
Full release verification is not green; those holds are not skipped or deleted.
The reviewed source, focused regressions, real local viewport proof, generated
docs and R3F checks are separate evidence.

## Exact one-off configuration

`workers/quests/wrangler.labs.live-inherit.jsonc` is a reviewed value-free overlay
for this one candidate. The original Labs resolver/account/Worker authority and
original config remain intact. It inherits exactly 47 existing binding names,
preserves the sole six-hour cron, runtime compatibility and existing preview
exposure. The standalone audit rejects plaintext bindings or another owner.

Before any separately approved upload, re-read the active deployment, latest
uploaded version,47 binding names and non-secret configuration fingerprint.
Inheritance resolves the latest uploaded version: it must still equal the
reviewed serving version. Installed Wrangler uploads with strict inheritance.
After upload, inspect actual bindings/runtime/preview exposure before any
separately approved traffic assignment. Never stock-deploy the original config.

Production remains on `cf48e6d0-1721-456f-a170-ad0e2c5ca2b8` until an approved
traffic change. That version is the recorded rollback target. Traffic rollback
does not reverse any subsequently approved D1 bookkeeping or resource state.
The upload and traffic gates in `workers/quests/DEPLOY-LABS.md` remain explicit.
