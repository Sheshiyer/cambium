# Visual Release Scope

Cambium's standalone release gate is the portable six-scale fractal tapestry:
`skill -> cluster -> organ -> venture -> company -> portfolio`.

The R3F visual engine is the spatial rendering of that tapestry. It matters, and
it should keep its own quality bar, but final game-engine visual parity is not
the same gate as standalone product portability.

`docs/visual/release-scope.json` records the release decision:

- `standaloneReleaseGate.status = "satisfied"` means the non-visual standalone
  product can be released once the final audit passes from `main`.
- `r3fGameEngineRealignment.releaseBlocker = false` means GitHub issues #44-#52
  remain the visual-product acceptance roadmap, not blockers for tagging the
  provider-neutral standalone release.
- the final audit must still run `npm run r3f:test` and `npm run r3f:build` so
  the shipped R3F scaffold does not regress.
- release-facing docs must not claim final R3F visual parity until the game
  engine realignment milestone is actually closed.

This split keeps two truths intact: Cambium can be cloned and emulated by a new
organization without private company state, and the visual engine still has a
clear road to the lush tactical-map product target.
