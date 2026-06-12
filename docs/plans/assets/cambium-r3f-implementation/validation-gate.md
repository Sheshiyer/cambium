# Validation Gate — Cambium R3F Visual Engine

## Gate Level

Prototype implementation with production-grade reference and regression gates.

## Required Checks

- Existing Cambium checks remain green:
  - `npm run validate`
  - `npm run render-docs:check`
  - `npm test`
- App-specific checks are added once the app scaffold exists:
  - dependency install succeeds,
  - app build succeeds,
  - route smoke test passes,
  - browser screenshots are captured.
- R3F-specific checks:
  - canvas is nonblank on every route,
  - camera framing does not crop the primary glyph,
  - packet/ring motion disables under reduced motion.
- Visual reference checks:
  - each route has a screenshot proof,
  - each route has a checklist against its frozen image,
  - each route preserves palette, glyph vocabulary, route hierarchy, and user-position signal.

## Pass / Fail

Pass when all owning issue acceptance criteria have attached evidence and no frozen contract drift remains.

Fail when:
- an implementation omits its frozen reference,
- shared material/camera/data contracts change without `T001` review,
- existing Cambium operator tests regress,
- R3F canvas is blank or inaccessible,
- or visual output returns to HTML-flat, city/building, or generic neon AI direction.
