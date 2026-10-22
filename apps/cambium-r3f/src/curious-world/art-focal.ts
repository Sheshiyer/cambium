import { carve, radialPoints, seedValue, tube, globe, type ArtBuilder, type V3 } from './art-geometry.ts';

/** Scenic minerals only. These silhouettes carry no source identity or operational state. */
export const SCENIC_FOCALS = Object.freeze([
  Object.freeze({ id: 'eastern-cleft', x: Math.cos(Math.PI / 8) * 13.5, z: Math.sin(Math.PI / 8) * 13.5,
    radius: 2.05, height: 6.45, turn: Math.PI / 8 + Math.PI / 2, seed: 73 }),
  Object.freeze({ id: 'western-cleft', x: Math.cos(Math.PI + Math.PI / 8) * 13.5, z: Math.sin(Math.PI + Math.PI / 8) * 13.5,
    radius: 2.05, height: 5.8, turn: Math.PI + Math.PI / 8 + Math.PI / 2, seed: 127 }),
]);

function cleftOutline(radius: number, innerRadius: number, seed: number, skew: number): Array<[number, number]> {
  const steps = 12;
  const start = .30 * Math.PI + skew, sweep = 1.48 * Math.PI;
  const outline: Array<[number, number]> = [];
  // An open, scalloped C section creates an actual deep cavity, rather than a painted recess.
  for (let i = 0; i <= steps; i++) {
    const angle = start + sweep * i / steps;
    const r = radius * (.97 + seedValue(seed, i) * .025) + Math.sin(angle * 3 + seed) * .025;
    outline.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  for (let i = steps; i >= 0; i--) {
    const angle = start + sweep * i / steps;
    const r = innerRadius * (.88 + seedValue(seed + 1, i) * .12);
    outline.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return outline;
}

export function buildFocalGeology(art: ArtBuilder): void {
  for (const focal of SCENIC_FOCALS) {
    const origin: V3 = [focal.x, 0, focal.z], rotation: V3 = [0, focal.turn, 0];
    // Narrow sea-bed root and fractured terraces remain entirely outside the walking floors.
    art.add(carve(radialPoints(1.77, focal.seed, 12, .025), 5.14, -5), 'basalt', origin, undefined, rotation);
    const bands = [
      { base: .02, top: 2.06, radius: 1.97, cavity: .63, shift: 0, skew: 0, surface: 'stone' as const },
      { base: 1.99, top: 4.06, radius: 1.70, cavity: .69, shift: .13, skew: .08, surface: 'basalt' as const },
      { base: 3.99, top: focal.height, radius: 1.35, cavity: .48, shift: .43, skew: -.10, surface: 'stone' as const },
    ];
    bands.forEach((band, index) => {
      const leanX = Math.cos(focal.turn) * band.shift, leanZ = -Math.sin(focal.turn) * band.shift;
      art.add(carve(cleftOutline(band.radius, band.cavity, focal.seed + index * 7, band.skew), band.top - band.base, band.base),
        band.surface, [focal.x + leanX, 0, focal.z + leanZ], undefined, rotation);
    });
    // One mineral seam follows the changing outer contour; copper is a material, never a traffic signal.
    const seam: V3[] = [[-.60, .26, -1.74], [-.75, 1.48, -1.68], [-.58, 2.19, -1.57],
      [-.51, 3.55, -1.51], [-.37, 4.20, -1.22], [-.08, focal.height - .18, -1.11]];
    art.add(tube(seam, .025, false, 12), 'copper', origin, undefined, rotation, false);
    // Quiet, faceted mineral visible inside the carved opening. No neon rings or added lights.
    art.add(globe(.42), 'mint', [focal.x, 2.67, focal.z], [.54, 2.5, .72], rotation);
    art.add(globe(.24), 'patina', [focal.x + .10, 4.18, focal.z - .05], [.7, 2.2, .9], rotation);
  }
}
