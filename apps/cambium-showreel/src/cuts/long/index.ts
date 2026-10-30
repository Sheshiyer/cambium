// The 120 s cut: same concept as the reel, at 80 BPM with chapter text.
import type { Act, Ctx, Shot, Transition } from '../../engine.ts';
import { ease, range } from '../../lib/ease.ts';
import { Hud } from '../../layers/hud.ts';
import type { Composition } from '../compose.ts';
import { LONG, L, ORGAN_START, STRIP_START } from './timeline.ts';
import { LongIgnite } from './acts/l1-ignite.ts';
import { LongTitle } from './acts/l2-title.ts';
import { LongHalves } from './acts/l3-halves.ts';
import { LongOrgans } from './acts/l4-organs.ts';
import { LongFlow } from './acts/l5-flow.ts';
import { LongMotion } from './acts/l6-motion.ts';
import { LongSurfaces } from './acts/l7-surfaces.ts';
import { LongResolve } from './acts/l8-resolve.ts';

export async function buildLong(ctx: Ctx): Promise<Composition> {
  const a = {
    ignite: new LongIgnite(),
    title: new LongTitle(),
    halves: new LongHalves(),
    organs: new LongOrgans(),
    flow: new LongFlow(),
    motion: new LongMotion(),
    surfaces: new LongSurfaces(),
    resolve: new LongResolve(),
  };
  for (const act of Object.values(a) as Act[]) await act.init(ctx);

  const shots: Shot[] = [
    { act: a.ignite, variant: 0, start: L.ignite[0], end: L.ignite[1] },
    { act: a.title, variant: 0, start: L.title[0], end: L.title[1] },
    { act: a.halves, variant: 0, start: L.halves[0], end: L.halves[1] },
  ];
  for (let i = 0; i < 5; i++) shots.push({ act: a.organs, variant: i, start: ORGAN_START(i), end: ORGAN_START(i + 1) });
  shots.push({ act: a.organs, variant: 5, start: STRIP_START, end: L.organs[1] });
  shots.push({ act: a.flow, variant: 0, start: L.flow[0], end: L.flow[1] });
  shots.push({ act: a.motion, variant: 0, start: L.motion[0], end: L.motion[1] });
  shots.push({ act: a.surfaces, variant: 0, start: L.surfaces[0], end: L.surfaces[1] });
  shots.push({ act: a.resolve, variant: 0, start: L.resolve[0], end: L.resolve[1] });

  const transitions: Transition[] = [
    { at: L.title[0], len: 14, kind: 'grid' },
    { at: L.halves[0], len: 14, kind: 'grid' },
    { at: L.organs[0], len: 14, kind: 'grid' },
    ...[1, 2, 3, 4].map((i) => ({ at: ORGAN_START(i), len: 12, kind: 'grid' as const })),
    { at: L.motion[0], len: 14, kind: 'grid' },
    { at: L.resolve[0], len: 40, kind: 'iris' },
  ];

  const hud = new Hud(
    LONG,
    (f) => ({
      nodes: f < L.organs[0] ? 0 : f < L.flow[0] ? Math.min(5, 1 + Math.floor((f - L.organs[0]) / 360)) : 9,
      packets: Math.round(1248 * ease(range(f, 300, L.flow[1]))),
    }),
    { fadeIn: [60, 120], brackets: [50, 110], ruler: [70, 200], spec: [100, 220], brand: [120, 220] },
  );
  return { spec: LONG, acts: Object.values(a), shots, transitions, overlays: [hud] };
}
