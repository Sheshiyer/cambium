// cambium-quests · the miniapp page (Thalia wing W2 — the Living Blueprint, v2 "100%").
// One served file, zero build step, zero dependencies. AAA mobile feel within doctrine:
// White-Hat juice only — glow means growth, never urgency. Taste cortex rules applied:
//   · transform/opacity animations exclusively (60fps, hardware-accelerated)
//   · house easing cubic-bezier(.16,1,.3,1); overshoot pop cubic-bezier(.34,1.56,.64,1)
//   · liquid-glass = 1px inner border + inset highlight; inner/tinted glow, never outer neon
//   · mono numerals; staggered cascades; full skeleton/empty/error/offline states
//   · prefers-reduced-motion kills every loop AND gesture inertia
// v2 adds the interaction layer: finger-tracked scene swipe (axis-locked, momentum, snap,
// rubber-band, live indicator), drag-to-dismiss sheet, pull-to-refresh, fractal arc
// drill-down (tap ring → zoom + parsed evidence facets), count-up numerals, tactile haptics.
//
// T-009 modularization (pure refactor): the bundle source now lives in ./page/** and is
// assembled by ./page/index.ts. This file is a stable barrel — the export surface is
// unchanged (`PAGE`, same value), so handler.ts, handler.test.ts, visual-viewport-proof.mjs,
// live-proof-readiness.mjs, and drift-audit.mjs import it exactly as before. Served HTML is
// byte-identical to the former monolith (sha256(PAGE) pinned).
// Module map: page/styles/* (tokens + per-scene CSS), page/scaffold.ts (static shell),
// page/glyphs.ts (glyph atlas), page/components/* (component builders + gallery),
// page/client/* (core, boot, scene engine, gestures, sheet, freshness, data, and
// signed-action — which reads TG && TG.initData for gate posts), page/scenes/*
// (mission, gate→client/signed-action, tools, story, inspect).
export { PAGE } from './page/index.ts';
