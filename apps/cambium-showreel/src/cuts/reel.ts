// The 15 s reel: six acts on a 120 BPM grid (one organ per beat).
import type { Act, Ctx, Shot, Transition } from '../engine.ts';
import { ACTS, BEAT, ROLLCALL_START, TOTAL_FRAMES } from '../timeline.ts';
import { ease, range } from '../lib/ease.ts';
import { IgniteAct } from '../acts/act1-ignite.ts';
import { RollcallAct } from '../acts/act2-rollcall.ts';
import { ConstellationAct } from '../acts/act3-constellation.ts';
import { VocabularyAct } from '../acts/act4-vocabulary.ts';
import { SurfacesAct } from '../acts/act5-surfaces.ts';
import { ResolveAct } from '../acts/act6-resolve.ts';
import { Hud } from '../layers/hud.ts';
import { REEL } from './spec.ts';
import type { Composition } from './compose.ts';

export async function buildReel(ctx: Ctx): Promise<Composition> {
  const acts = {
    ignite: new IgniteAct(),
    rollcall: new RollcallAct(),
    constellation: new ConstellationAct(),
    vocabulary: new VocabularyAct(),
    surfaces: new SurfacesAct(),
    resolve: new ResolveAct(),
  };
  for (const a of Object.values(acts) as Act[]) await a.init(ctx);

  const shots: Shot[] = [{ act: acts.ignite, variant: 0, start: 0, end: ACTS.ignite[1] }];
  for (let i = 0; i < 5; i++) {
    shots.push({ act: acts.rollcall, variant: i, start: ROLLCALL_START + i * BEAT, end: ROLLCALL_START + (i + 1) * BEAT });
  }
  shots.push({ act: acts.rollcall, variant: 5, start: ROLLCALL_START + 5 * BEAT, end: ACTS.rollcall[1] });
  shots.push({ act: acts.constellation, variant: 0, start: ACTS.constellation[0], end: ACTS.constellation[1] });
  shots.push({ act: acts.vocabulary, variant: 0, start: ACTS.vocabulary[0], end: ACTS.vocabulary[1] });
  shots.push({ act: acts.surfaces, variant: 0, start: ACTS.surfaces[0], end: ACTS.surfaces[1] });
  shots.push({ act: acts.resolve, variant: 0, start: ACTS.resolve[0], end: TOTAL_FRAMES });

  const transitions: Transition[] = [
    { at: 120, len: 10, kind: 'grid' },
    { at: 150, len: 8, kind: 'grid' },
    { at: 180, len: 8, kind: 'grid' },
    { at: 210, len: 8, kind: 'grid' },
    { at: 240, len: 8, kind: 'grid' },
    { at: 510, len: 10, kind: 'grid' },
    { at: 750, len: 24, kind: 'iris' },
  ];

  const hud = new Hud(REEL, (f) => ({
    nodes: f < ACTS.rollcall[0] ? 0 : f < ACTS.constellation[0] ? Math.min(5, 1 + Math.floor((f - ACTS.rollcall[0]) / 30)) : 9,
    packets: Math.round(1248 * ease(range(f, 60, ACTS.constellation[1]))),
  }));
  return { spec: REEL, acts: Object.values(acts), shots, transitions, overlays: [hud] };
}
