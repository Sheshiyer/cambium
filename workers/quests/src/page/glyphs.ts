// cambium-quests · miniapp page chunk — MC_GLYPH_SVG glyph atlas (8 glyph variants)
// Frozen anatomy (frozen/01-component-anatomy.md, ratified): genesis six-pointed star + glowing
// round core · taste horizontal capsule/loop ring · build upright triangle slab + inner embossed
// triangle + glow dot · ops folded slab (open tray + folded lid) · cortex outer disc + 8 spokes to
// glowing hub · arc crescent C · proof curled receipt with dotted rows · gate warning aperture
// (triangle outline + inner triangle, ALWAYS peach — enforced via [data-glyph-kind="gate"] CSS).
// Class hooks consumed by styles/components.ts: mc-fill (body), mc-core (glow), mc-soft (shadow), mc-dash (dotted print).
export const GLYPHS = `const MC_GLYPH_SVG = {
  genesis:'<svg viewBox="0 0 32 32"><path class="mc-fill" d="M16 3.8 19.5 11.2 27.4 8.8 23.8 16 27.4 23.2 19.5 20.8 16 28.2 12.5 20.8 4.6 23.2 8.2 16 4.6 8.8 12.5 11.2Z"/><path d="M16 6.8 18.1 12.6 24.2 12.1 19.4 16 24.2 19.9 18.1 19.4 16 25.2 13.9 19.4 7.8 19.9 12.6 16 7.8 12.1 13.9 12.6Z"/><circle class="mc-core" cx="16" cy="16" r="2.1"/><path class="mc-soft" d="M7 27c4.2-.6 6.8-.6 9.2.1 2.8.8 5.2.7 8.8-.4"/></svg>',
  taste:'<svg viewBox="0 0 32 32"><path class="mc-fill" d="M11 9.5h10a6.5 6.5 0 0 1 0 13H11a6.5 6.5 0 0 1 0-13Z"/><path d="M11 12.8h10a3.2 3.2 0 0 1 0 6.4H11a3.2 3.2 0 0 1 0-6.4Z"/><circle class="mc-core" cx="21" cy="16" r="1.4"/><path class="mc-soft" d="M8.2 26c3.8.7 7.6.7 11.4 0 1.7-.3 3.1-.3 4.2.1"/></svg>',
  build:'<svg viewBox="0 0 32 32"><path class="mc-fill" d="M16 4.7 27.5 25.2H4.5Z"/><path d="M16 7.6 24.9 23H7.1Z"/><path d="M16 12.6 20.8 20.4H11.2Z"/><circle class="mc-core" cx="16" cy="18" r="1.5"/><path class="mc-soft" d="M9.2 25.2h13.6M12 22.6h8"/></svg>',
  ops:'<svg viewBox="0 0 32 32"><path class="mc-fill" d="M6 13.6 16 9.4l10 4.2-10 4.2Z"/><path d="M6 13.6v7.2l10 4.2v-7.2"/><path d="M26 13.6v7.2l-10 4.2v-7.2"/><path class="mc-dash" d="M11 15.4v4.8M16 17.6v4.8M21 15.4v4.8"/><path class="mc-soft" d="M10.8 11.8 21 15.9"/></svg>',
  cortex:'<svg viewBox="0 0 32 32"><circle class="mc-fill" cx="16" cy="16" r="10.8"/><circle cx="16" cy="16" r="10.3"/><circle cx="16" cy="16" r="4.1"/><circle class="mc-core" cx="16" cy="16" r="1.6"/><path d="M16 5.7v6.1M16 20.2v6.1M5.7 16h6.1M20.2 16h6.1M8.7 8.7l4.3 4.3M19 19l4.3 4.3M23.3 8.7 19 13M13 19l-4.3 4.3"/></svg>',
  arc:'<svg viewBox="0 0 32 32"><path class="mc-fill" d="M24 7.2a9.8 9.8 0 1 0 0 17.6 11.6 11.6 0 1 1 0-17.6Z"/><path d="M24 7.2a9.8 9.8 0 1 0 0 17.6"/><path d="M22.1 11.7a5.7 5.7 0 1 0 0 8.6"/><path class="mc-soft" d="M6.8 27.1c2.4-.8 4.8-.8 7.3 0 2 .6 4 .5 6.4-.4"/></svg>',
  proof:'<svg viewBox="0 0 32 32"><path class="mc-fill" d="M10.2 5.4c3.6 1.7 6.7 1.8 9.8.4 1.7-.7 3.3.5 3.2 2.3l-1 14.7c-.1 1.9-1.9 3-3.6 2.1-3.1-1.6-6.2-1.8-9.5-.5Z"/><path d="M10.2 5.4c3.6 1.7 6.7 1.8 9.8.4 1.7-.7 3.3.5 3.2 2.3l-1 14.7c-.1 1.9-1.9 3-3.6 2.1-3.1-1.6-6.2-1.8-9.5-.5Z"/><path class="mc-dash" d="M12.4 11.4c2.3.8 4.6.8 7.1.1M12.1 15.4c2.8.9 5.5.9 8.2 0M11.8 19.3c2.1.7 4.4.8 6.8.2"/><path class="mc-soft" d="M7.2 27.2c5.9-2 11.8-1.9 17.6.1"/></svg>',
  gate:'<svg viewBox="0 0 32 32"><path class="mc-fill" d="M16 4.8 27 24.8H5Z"/><path d="M16 6.8 24.7 23H7.3Z"/><path d="M16 12.8 20.8 20.8H11.2Z"/><path class="mc-core" d="M15.9 17.2 17.9 20.2H13.9Z"/><path class="mc-soft" d="M8.2 27.2c2.2-2.8 4.6-3.2 7.8-1.2 3.2-2 5.6-1.6 7.8 1.2"/></svg>'
};
`;
