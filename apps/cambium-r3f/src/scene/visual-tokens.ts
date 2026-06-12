const brandColors = {
  ink: '#00272B',
  substrate: '#012F34',
  signal: '#E0FF4F',
  mist: '#D6FFF6',
  depth: '#231651',
} as const;

export const visualTokens = {
  colors: brandColors,
  alpha: {
    hairline: 0.18,
    grid: 0.26,
    ghost: 0.34,
    secondary: 0.62,
    strong: 0.86,
  },
  typography: {
    display: '"Arial Narrow", "Aptos Display", "Satoshi", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  motion: {
    orbitSeconds: 90,
    packetSeconds: 18,
    reducedMotionQuery: '(prefers-reduced-motion: reduce)',
    allowedProperties: ['transform', 'opacity'],
  },
  materials: {
    substrate: { color: brandColors.substrate, roughness: 0.92, metalness: 0.02 },
    nodeComplete: { color: brandColors.mist, emissive: brandColors.substrate, emissiveIntensity: 0.08 },
    nodeActive: { color: brandColors.signal, emissive: brandColors.signal, emissiveIntensity: 0.18 },
    nodePending: { color: brandColors.depth, emissive: brandColors.substrate, emissiveIntensity: 0.05 },
    rail: { color: brandColors.mist, opacity: 0.58 },
    packet: { color: brandColors.signal, opacity: 0.88 },
    fog: { color: brandColors.ink, near: 8, far: 24 },
  },
  glyphs: {
    genesis: { glyph: 'seed', coolshapeIntent: 'soft seed shard object for idea intake' },
    taste: { glyph: 'taste', coolshapeIntent: 'curved resonance object for taste memory' },
    build: { glyph: 'hands', coolshapeIntent: 'faceted tool object for artifact making' },
    ops: { glyph: 'will', coolshapeIntent: 'looping operating object for heartbeat and GTM' },
    cortex: { glyph: 'cortex', coolshapeIntent: 'orbital memory object linking every island' },
  },
} as const;

export type VisualTokens = typeof visualTokens;
export type BrandColor = keyof typeof brandColors;

export const allowedBrandHexes = Object.values(brandColors);
