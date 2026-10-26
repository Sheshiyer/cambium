// Cut registry (DOM-free so bun tools can import it). A cut is one edit of the
// reel: its length, tempo, labelled sections, cut-impact frames and sound cues.
import { ACT_LABELS, ACTS, BPM, CUES, IMPACT_FRAMES, TOTAL_FRAMES, type ActId, type Cue } from '../timeline.ts';
import { LONG } from './long/timeline.ts';

export interface Section {
  id: string;
  label: string;
  start: number;
  end: number;
}

export interface CutSpec {
  id: 'reel' | 'long';
  /** deliverable file stem */
  stem: string;
  total: number;
  bpm: number;
  sections: Section[];
  impacts: number[];
  cues: readonly Cue[];
  /** finishing-pass grain amplitude (default 0.022) */
  grain?: number;
  /** x264 CRF for the master (default 14) */
  crf?: number;
  /** web-copy max bitrate (default: CRF only) */
  webMaxrate?: string;
}

export const REEL: CutSpec = {
  id: 'reel',
  stem: 'cambium-showreel-v1',
  total: TOTAL_FRAMES,
  bpm: BPM,
  sections: (Object.keys(ACTS) as ActId[]).map((id) => ({ id, label: ACT_LABELS[id], start: ACTS[id][0], end: ACTS[id][1] })),
  impacts: IMPACT_FRAMES,
  cues: CUES,
};

export const CUTS = { reel: REEL, long: LONG } as const;

export function cutSpec(id: string | null | undefined): CutSpec {
  return id === 'long' ? LONG : REEL;
}

export function sectionAt(spec: CutSpec, f: number) {
  return spec.sections.find((s) => f >= s.start && f < s.end) ?? spec.sections[spec.sections.length - 1];
}
