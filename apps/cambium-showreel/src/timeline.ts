// Single source of truth for timing. Video and audio both read from here,
// so every cut, cue and counter stays frame-locked.

export const FPS = 60;
export const TOTAL_FRAMES = 900; // 15.000 s
export const BPM = 120;
export const BEAT = (FPS * 60) / BPM; // 30 frames
export const W = 1920;
export const H = 1080;

export const ACTS = {
  ignite: [0, 120],
  rollcall: [120, 300],
  constellation: [300, 510],
  vocabulary: [510, 630],
  surfaces: [630, 750],
  resolve: [750, 900],
} as const;

export type ActId = keyof typeof ACTS;

export const ACT_LABELS: Record<ActId, string> = {
  ignite: '01 / IGNITE',
  rollcall: '02 / ROLL-CALL',
  constellation: '03 / CONSTELLATION',
  vocabulary: '04 / MOTION NAMES',
  surfaces: '05 / SURFACES',
  resolve: '06 / RESOLVE',
};

/** Organs in roll-call order. Roles come from the system field guide (sources 11-15). */
export const ORGANS = [
  { id: 'genesis', label: 'GENESIS', role: 'BRAND REFERENCE — WHO IT SERVES, HOW IT SPEAKS' },
  { id: 'taste', label: 'TASTE', role: 'BRAND INTENT → A TESTABLE BRIEF' },
  { id: 'build', label: 'BUILD', role: 'FINITE WORK → AN INSPECTABLE ARTIFACT' },
  { id: 'ops', label: 'OPS', role: 'AUDIENCE · OFFER · DISTRIBUTION' },
  { id: 'cortex', label: 'CORTEX', role: 'TENANT-SCOPED MEMORY FOR EVERY ISLAND' },
] as const;

export type OrganId = (typeof ORGANS)[number]['id'];

/** Temperance-family organs ringed around the constellation (field guide 16-21). */
export const TEMPERANCE = ['VESTIBULE', 'ADYTUM', 'NUTRIX', 'AUSPEX', 'CIRCULATOR', 'PRAECEPTOR'] as const;

export const ROLLCALL_START = ACTS.rollcall[0];
export const ROLLCALL_STRIP = ROLLCALL_START + BEAT * 5; // 270

export type CueKind =
  | 'ping'
  | 'riser'
  | 'tick'
  | 'impact'
  | 'whoosh'
  | 'boom'
  | 'chime'
  | 'warn'
  | 'resolve'
  | 'blip'
  | 'dropout'
  | 'flip'
  | 'swell'
  | 'final';

export interface Cue {
  f: number;
  kind: CueKind;
  /** 0..1 strength */
  v?: number;
  /** pitch / variant parameter */
  p?: number;
  /** duration in frames for sustained cues */
  d?: number;
}

const cues: Cue[] = [
  { f: 6, kind: 'ping', v: 0.8, p: 0 },
  { f: 10, kind: 'riser', v: 0.6, d: 110 },
  // fission: five packets leave the core
  ...[62, 66, 70, 74, 78].map((f, i) => ({ f, kind: 'tick' as const, v: 0.55, p: i })),
  // roll-call: one impact per organ beat
  ...[0, 1, 2, 3, 4].map((i) => ({ f: ROLLCALL_START + i * BEAT, kind: 'impact' as const, v: i === 0 ? 1 : 0.85, p: i })),
  { f: ROLLCALL_STRIP, kind: 'whoosh', v: 0.6, d: 24 },
  ...[0, 1, 2, 3, 4].map((i) => ({ f: ROLLCALL_STRIP + 4 + i * 2, kind: 'blip' as const, v: 0.35, p: i })),
  { f: 300, kind: 'boom', v: 0.9 },
  { f: 400, kind: 'chime', v: 0.7, p: 0 },
  { f: 452, kind: 'warn', v: 0.55 },
  { f: 492, kind: 'resolve', v: 0.6 },
  { f: 506, kind: 'whoosh', v: 0.5, d: 14 },
  // vocabulary cells pop in
  ...[0, 1, 2, 3, 4].map((i) => ({ f: 516 + i * 8, kind: 'blip' as const, v: 0.55, p: i + 2 })),
  { f: 598, kind: 'dropout', d: 4 },
  { f: 604, kind: 'impact', v: 0.55, p: 5 },
  // surfaces: three dolly stops + blueprint flips
  { f: 630, kind: 'whoosh', v: 0.7, d: 20 },
  { f: 668, kind: 'whoosh', v: 0.6, d: 18 },
  ...[676, 684, 692].map((f, i) => ({ f, kind: 'flip' as const, v: 0.5, p: i })),
  { f: 706, kind: 'whoosh', v: 0.65, d: 26 },
  { f: 736, kind: 'swell', v: 0.8, d: 36 },
  // resolve
  { f: 772, kind: 'ping', v: 0.9, p: 1 },
  { f: 800, kind: 'final', v: 1, d: 100 },
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ f: 800 + i * 3, kind: 'tick' as const, v: 0.3, p: 5 + i })),
  { f: 860, kind: 'chime', v: 0.45, p: 1 },
];

export const CUES: readonly Cue[] = cues.sort((a, b) => a.f - b.f);

/** Frames at which a hard cut lands; the final pass adds a tiny chromatic hit there. */
export const IMPACT_FRAMES = [120, 150, 180, 210, 240, 300, 510, 630, 750, 800];

export function actAt(f: number): ActId {
  for (const id of Object.keys(ACTS) as ActId[]) {
    const [a, b] = ACTS[id];
    if (f >= a && f < b) return id;
  }
  return 'resolve';
}
