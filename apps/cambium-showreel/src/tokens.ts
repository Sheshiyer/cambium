// Brand tokens. Core palette is imported from the canonical R3F module so the
// reel can never drift from the product; paper/warning come from the frozen
// Mission Control tokens (docs/plans/assets/tg-miniapp-mission-control-reference/frozen/design-tokens.json).
import { Color } from 'three';
import { visualTokens } from '../../cambium-r3f/src/scene/visual-tokens.ts';

export const HEX = {
  ink: visualTokens.colors.ink, // #00272B deep base
  substrate: visualTokens.colors.substrate, // #012F34 surface
  signal: visualTokens.colors.signal, // #E0FF4F accent
  mist: visualTokens.colors.mist, // #D6FFF6 highlight
  depth: visualTokens.colors.depth, // #231651 void
  paper: '#F5F3E8',
  warning: '#FFC7A1', // peach: warning / review states only
} as const;

export type Swatch = keyof typeof HEX;

/** Linear-space colours for shaders (three's ColorManagement converts sRGB hex). */
export const COL: Record<Swatch, Color> = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, new Color(v)]),
) as Record<Swatch, Color>;

export const ALPHA = visualTokens.alpha; // hairline .18 grid .26 ghost .34 secondary .62 strong .86

export const GRID = 8;

export const FONT = {
  display: 'ReelDisplay', // DIN Condensed Bold (macOS system font) — the boards' condensed caps
  mono: 'ReelMono', // JetBrains Mono (OFL), already in Mission Control's mono stack
} as const;

/** Favicon geometry from docs/assets/visual-flow/1085--r3f--favicon.svg (64x64 viewBox). */
export const FAVICON = {
  flag: [
    [18, 10],
    [46, 10],
    [46, 31],
    [31, 48],
    [18, 48],
  ] as [number, number][],
  facet: [
    [46, 31],
    [31, 48],
    [31, 31],
  ] as [number, number][],
  ring: { cx: 32, cy: 32, r: 26, stroke: 2, opacity: 0.55 },
  facetOpacity: 0.68,
};
