// The 120 s cut: 80 BPM, 1 beat = 45 frames, 1 bar = 180 frames = 3 s,
// 40 bars. Every section boundary sits on a bar line; text lands on beats.
import type { Cue } from '../../timeline.ts';
import type { CutSpec } from '../spec.ts';

export const L_FPS = 60;
export const L_BPM = 80;
export const L_BEAT = 45;
export const L_BAR = 180;
export const L_TOTAL = 7200;
/** frame at the start of bar n (1-indexed) */
export const bar = (n: number) => (n - 1) * L_BAR;

export const L = {
  ignite: [bar(1), bar(5)], //      0 –  720
  title: [bar(5), bar(7)], //     720 – 1080
  halves: [bar(7), bar(9)], //   1080 – 1440
  organs: [bar(9), bar(21)], //  1440 – 3600  (5 organs x 2 bars, then strip 2 bars)
  flow: [bar(21), bar(29)], //   3600 – 5040
  motion: [bar(29), bar(33)], // 5040 – 5760
  surfaces: [bar(33), bar(37)], // 5760 – 6480
  resolve: [bar(37), bar(41)], // 6480 – 7200
} as const;

export type LongSection = keyof typeof L;

export const L_LABELS: Record<LongSection, string> = {
  ignite: '01 / IGNITE',
  title: '02 / CAMBIUM',
  halves: '03 / TWO HALVES',
  organs: '04 / ORGANS',
  flow: '05 / ONE GOVERNED FLOW',
  motion: '06 / MOTION NAMES',
  surfaces: '07 / SURFACES',
  resolve: '08 / RESOLVE',
};

/** Organ chapters: two bars each from bar 9; the strip holds bars 19–20. */
export const ORGAN_START = (i: number) => L.organs[0] + i * 2 * L_BAR;
export const STRIP_START = ORGAN_START(5); // 3240

export const L_IMPACTS = [
  bar(5), bar(7), bar(9), ORGAN_START(1), ORGAN_START(2), ORGAN_START(3), ORGAN_START(4),
  STRIP_START, bar(21), bar(29), bar(33), bar(37), bar(38),
];

const cues: Cue[] = [
  // 01 ignite
  { f: 20, kind: 'ping', v: 0.8, p: 0 },
  ...[0, 1, 2, 3, 4].map((i) => ({ f: 300 + i * 18, kind: 'tick' as const, v: 0.5, p: i })),
  { f: 420, kind: 'blip', v: 0.3, p: 2 },
  { f: 465, kind: 'blip', v: 0.3, p: 4 },
  { f: bar(4) - 60, kind: 'riser', v: 0.8, d: 240 },
  // 02 title
  { f: bar(5), kind: 'impact', v: 1, p: 0 },
  { f: bar(5) + 90, kind: 'chime', v: 0.6, p: 0 },
  { f: bar(6) + 45, kind: 'blip', v: 0.3, p: 5 },
  { f: bar(7) - 24, kind: 'whoosh', v: 0.6, d: 30 },
  // 03 halves
  { f: bar(7), kind: 'impact', v: 0.6, p: 2 },
  { f: bar(7) + 45, kind: 'blip', v: 0.35, p: 2 },
  { f: bar(8), kind: 'blip', v: 0.35, p: 4 },
  { f: bar(9) - 24, kind: 'whoosh', v: 0.6, d: 30 },
  // 04 organs: impact on each chapter downbeat, a blip as each detail lands
  ...[0, 1, 2, 3, 4].flatMap((i) => [
    { f: ORGAN_START(i), kind: 'impact' as const, v: i === 0 ? 1 : 0.85, p: i },
    { f: ORGAN_START(i) + 90, kind: 'blip' as const, v: 0.28, p: i + 1 },
    { f: ORGAN_START(i) + 180, kind: 'blip' as const, v: 0.28, p: i + 3 },
  ]),
  { f: STRIP_START - 20, kind: 'whoosh', v: 0.6, d: 30 },
  ...[0, 1, 2, 3, 4].map((i) => ({ f: STRIP_START + 10 + i * 8, kind: 'blip' as const, v: 0.35, p: i })),
  // 05 flow
  { f: bar(21), kind: 'boom', v: 0.9 },
  ...[0, 1, 2, 3, 4, 5].map((i) => ({ f: bar(21) + 90 + i * 240, kind: 'tick' as const, v: 0.4, p: i + 2 })),
  { f: bar(23) + 30, kind: 'chime', v: 0.5, p: 0 },
  { f: bar(25) + 20, kind: 'chime', v: 0.6, p: 1 },
  { f: bar(27) + 20, kind: 'warn', v: 0.5 },
  { f: bar(28) + 45, kind: 'resolve', v: 0.6 },
  { f: bar(29) - 20, kind: 'whoosh', v: 0.5, d: 26 },
  // 06 motion names
  { f: bar(29), kind: 'impact', v: 0.5, p: 3 },
  ...[0, 1, 2, 3, 4].map((i) => ({ f: bar(29) + 45 + i * 45, kind: 'blip' as const, v: 0.5, p: i + 2 })),
  { f: bar(32), kind: 'dropout', d: 10 },
  { f: bar(32) + 14, kind: 'impact', v: 0.5, p: 5 },
  // 07 surfaces
  { f: bar(33), kind: 'whoosh', v: 0.7, d: 30 },
  { f: bar(34) + 90, kind: 'whoosh', v: 0.6, d: 30 },
  ...[0, 1, 2].map((i) => ({ f: bar(35) + 30 + i * 45, kind: 'flip' as const, v: 0.5, p: i })),
  { f: bar(36) - 30, kind: 'whoosh', v: 0.65, d: 34 },
  { f: bar(37) - 70, kind: 'swell', v: 0.8, d: 70 },
  // 08 resolve
  { f: bar(37) + 60, kind: 'ping', v: 0.9, p: 1 },
  { f: bar(38), kind: 'final', v: 1, d: 540 },
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ f: bar(38) + i * 6, kind: 'tick' as const, v: 0.3, p: 5 + i })),
  { f: bar(39) + 90, kind: 'chime', v: 0.4, p: 1 },
];

export const LONG: CutSpec = {
  id: 'long',
  stem: 'cambium-showreel-v1-long',
  total: L_TOTAL,
  bpm: L_BPM,
  sections: (Object.keys(L) as LongSection[]).map((id) => ({ id, label: L_LABELS[id], start: L[id][0], end: L[id][1] })),
  impacts: L_IMPACTS,
  cues: cues.sort((a, b) => a.f - b.f),
  grain: 0.014,
  crf: 17,
  webMaxrate: '8M',
};
