// Cambium operator · narrative — the story mapper (Thalia wing W3).
// The operator's life, told as PROSE: world-log lines and deviation records become
// story beats (noesis set apart; nothing fabricated — every beat derives from a real
// record, and the raw line rides along for audit). Shares ONE log grammar with the
// forge (parseWorldLogLine — M4 second pass F2). Pure module: no I/O; the quine
// hypha gathers inputs and ships beats inside the push envelope.

import { parseWorldLogLine } from '../skills/forge.ts';

export interface StoryBeat {
  n: number | null;          // step number when the source line carried one
  text: string;              // the prose
  lane: string;              // micro | meso | macro | heartbeat | noesis | multica | quest …
  noesis: boolean;
  source: 'world-log' | 'deviations' | 'multica' | 'teamforge';
  raw?: string;              // the underlying record, for audit
}

/** Prose templates per lane/action — derived strictly from the parsed parts. */
function prose(lane: string, action: string, note: string | null): string {
  const a = action.toLowerCase();
  if (lane === 'noesis' || a.startsWith('noesis')) {
    if (a.includes('defensive') || a.includes('drift') || (note ?? '').includes('drift')) {
      return 'The mid-brain woke at the edge — drift sensed, the moment handed to the founder.';
    }
    return 'The mid-brain woke — the calling reaffirmed; this was bigger than the task.';
  }
  if (lane === 'micro') return 'A micro move — a reversible fine-tune landed; the setpoint never stirred.';
  if (lane === 'meso') {
    if (a.includes('absorb') || a.includes('intent')) {
      return 'A redirect carried real intent — absorbed through the gate; the goal moved, clamped.';
    }
    return 'A wobble in the lane — the operator rerolled toward the same goal.';
  }
  if (lane === 'macro') {
    if (a.includes('hold')) return 'The gate held — no real evidence, no move. The echo chamber stays locked out.';
    return 'The setpoint moved through the evidence gate — clamped to the trust region.';
  }
  if (lane === 'heartbeat') return 'The heartbeat swept the board — solvency and coherence, eyes open while dormant.';
  return `${action}${note ? ` (${note})` : ''}`;   // honest fallback: the action itself
}

/** world.log lines → beats (only lines the shared grammar recognizes). */
export function beatsFromWorldLog(log: string[]): StoryBeat[] {
  const beats: StoryBeat[] = [];
  for (const line of log) {
    const parsed = parseWorldLogLine(line);
    if (!parsed) continue;
    const noesis = parsed.lane === 'noesis' || parsed.action.toLowerCase().includes('noesis');
    beats.push({
      n: parsed.n,
      text: prose(parsed.lane, parsed.action, parsed.note),
      lane: noesis ? 'noesis' : parsed.lane,
      noesis,
      source: 'world-log',
      raw: line,
    });
  }
  return beats;
}

/** deviations.jsonl lines → beats, reasons carried into the prose. */
export function beatsFromDeviations(lines: string[]): StoryBeat[] {
  const beats: StoryBeat[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    let d: { stage?: string; kind?: string; action?: string; reason?: string; rationale?: string | null };
    try { d = JSON.parse(t); } catch { continue; }
    if (!d.kind && !d.action) continue;
    const lane = (d.action ?? '').split('·')[0].trim().split(/\s+/)[0] || d.kind || 'deviation';
    const noesis = /noesis/i.test(d.action ?? '');
    const why = d.reason || d.rationale || null;
    beats.push({
      n: null,
      text: prose(noesis ? 'noesis' : lane, d.action ?? d.kind ?? '', null) + (why ? ` Why: ${why}` : ''),
      lane: noesis ? 'noesis' : lane,
      noesis,
      source: 'deviations',
      raw: t.slice(0, 200),
    });
  }
  return beats;
}

/** The narrative: world-log beats then deviation beats, capped to the latest `limit`. */
export function narrate(log: string[], deviationLines: string[], limit = 40): StoryBeat[] {
  const all = [...beatsFromWorldLog(log), ...beatsFromDeviations(deviationLines)];
  return all.slice(-limit);
}
