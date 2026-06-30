# TG Mini App Release-Readiness Architecture Spec

Date: 2026-06-30
Status: ready for release sequencing
Scope: staged Telegram mini app Mission Control bundle, release gates, issue bookkeeping, and page execution order.

## Problem

The TG mini app component foundation is staged, but the release path was weaker than CI: `.github/workflows/release.yml` only ran `npm test`, while CI also ran `standalone:audit` and `standalone:smoke`. The release path also did not record non-strict TG readiness, so a tagged release could ship without the current readiness ledger being regenerated.

## Goal

Make the release path at least as strong as CI, preserve honest TG readiness boundaries, close only the component issues that the staged bundle actually implements, and sequence broader page execution after Mission defines the shared branch packet/state contract.

## Release Pipeline Contract

- `release.yml` runs `npm test`.
- `release.yml` runs `npm run standalone:audit`.
- `release.yml` runs `npm run standalone:smoke`.
- `release.yml` runs `npm run proof:tg-live-readiness` in non-strict mode.
- The local release script runs the same gates before creating and pushing a tag.
- Strict TG readiness remains reserved for the moment live Telegram initData, founder-device WebView proof, and production signed-action proof are intentionally required.
- Browser viewport proof and Playwright/e2e screenshots are deferred until explicitly requested.

## Foundation Bookkeeping Contract

Close or mark done after verification:

- `#201` VisualTokens
- `#202` MissionGlyph
- `#203` StateToken
- `#208` BranchArcChip
- `#209` MissionCard
- `#210` QuestlineTimeline
- `#211` ProofList
- `#213` GateActionRow
- `#217` warningAttention
- `#219` ComponentGalleryProof

Keep open for refinement:

- `#200` ComponentRegistry
- `#204` OrbitProgress
- `#205` SelectedHalo
- `#206` SignalRail
- `#207` PacketFlow
- `#212` KpiPulse
- `#214` orbitSweep
- `#215` packetDrift
- `#216` glyphBreathe
- `#218` reducedMotion

## Page Execution Order

1. Mission first: it owns the branch packet and state contract.
2. Gate and Tools next: they may overlap only with one integration owner because `workers/quests/src/page.ts` is shared.
3. Story after link routes and cross-page navigation stabilize.
4. Inspect last as the proof/debug rollup after the primary surfaces settle.

## Verification Plan

- Run `npm test`.
- Run `npm run validate`.
- Run `npm run validate:product-branches`.
- Run `npm run standalone:audit`.
- Run `npm run standalone:smoke`.
- Run `npm run proof:tg-live-readiness`.
- Do not run Playwright/e2e screenshot proof in this release-readiness pass.

## Acceptance

- Release workflow and local release script include CI-equivalent gates plus non-strict TG readiness.
- Non-strict readiness can exit successfully while still reporting live blockers.
- No issue is closed without a matching code or test probe.
- Page issue execution remains sequenced by dependency order rather than broad parallel edits to `page.ts`.
