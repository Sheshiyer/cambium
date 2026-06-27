// Cambium operator · skills — the forge (M4 / W2).
// Repetitive processes BECOME skills: the forge detects recurring signatures in the
// operator's real signals (deviations.jsonl · world.log), and mints each into a skill
// spec aligned with the company skill-registry schema (vault: 20-operations/skill-registry/
// skill-spec-schema.md) — lifecycle candidate → validated → production. Minting follows
// skill-creator methodology: a slightly-pushy description with USE WHEN + NOT FOR,
// verification steps defined at mint time, and a gotchas/amendments loop fed by telemetry.
// Pure module — no I/O; the quine hypha reads the signal files and persists the registry.

export type SkillStatus = 'candidate' | 'validated' | 'production';

export interface RepetitionSignal {
  source: 'deviations' | 'world-log';
  signature: string;   // e.g. 'build|error|reroll' or 'meso|reroll'
  sample: string;      // one raw line, for trigger context
}

export interface SkillCandidate {
  signature: string;
  source: RepetitionSignal['source'];
  occurrences: number;
  samples: string[];   // up to 3 raw lines
}

export interface UseScenario { ts: number; ok: boolean; note?: string }
export interface Amendment { ts: number; reason: string; proposal: string }

/** A minted skill — vault skill-spec-schema fields + runtime telemetry. */
export interface SkillRecord {
  skill_id: string;                    // cambium-<kebab>
  status: SkillStatus;
  category: 'delivery' | 'governance';
  description: string;                 // USE WHEN … NOT FOR … (for the routing model)
  trigger_signals: string[];
  required_inputs: Array<{ name: string; source: string; required: boolean }>;
  output_contract: { format: string; location: string; [key: string]: unknown };
  verification_steps: string[];
  promotion_rule: string;
  source: { signature: string; from: RepetitionSignal['source']; occurrences: number };
  telemetry: {
    uses: number;
    successes: number;
    failures: number;
    scenarios: UseScenario[];
    gotchas: string[];
    amendments: Amendment[];
  };
  created: number;                     // epoch ms
  updated: number;
}

/** The action HEAD — first segment before '·', first word, alphanumerics only. Keeps
 *  signatures (and the skill ids minted from them) short and stable. */
const actionHead = (action: string): string =>
  (action.split('·')[0].trim().split(/\s+/)[0] ?? '?').replace(/[^A-Za-z0-9-]/g, '') || '?';

/** deviations.jsonl lines → signals. Tolerant: skips unparseable lines. */
export function signaturesFromDeviations(lines: string[]): RepetitionSignal[] {
  const out: RepetitionSignal[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try {
      const d = JSON.parse(t) as { stage?: string; kind?: string; action?: string };
      if (!d.stage && !d.kind && !d.action) continue;
      out.push({
        source: 'deviations',
        signature: `${d.stage ?? '?'}|${d.kind ?? '?'}|${actionHead(d.action ?? '?')}`,
        sample: t.slice(0, 160),
      });
    } catch { /* not a JSON line — skip */ }
  }
  return out;
}

/** ONE log grammar, two consumers (forge signatures + the narrative mapper — M4 second
 *  pass F2). Parses "#n step-id → <lane> · <action…> (note)" world-log lines. */
export interface ParsedLogLine {
  n: number | null;        // step number when present
  stepId: string | null;   // e.g. onb-08-booster
  lane: string;            // micro | meso | macro | heartbeat | noesis | …
  action: string;          // full action text (before any trailing parenthetical)
  note: string | null;     // trailing parenthetical, if any
  raw: string;
}

export function parseWorldLogLine(line: string): ParsedLogLine | null {
  const m = line.match(/→\s*(\w+)\s*·\s*([^(]+)(?:\(([^)]*)\))?/);
  if (!m) return null;
  const head = line.match(/^#(\d+)\s+([\w·-]+)?/);
  return {
    n: head ? Number(head[1]) : null,
    stepId: head?.[2] ?? null,
    lane: m[1].trim(),
    action: m[2].trim(),
    note: m[3]?.trim() || null,
    raw: line,
  };
}

/** world.log entries → signals, keyed by lane + action head. */
export function signaturesFromWorldLog(log: string[]): RepetitionSignal[] {
  const out: RepetitionSignal[] = [];
  for (const line of log) {
    const parsed = parseWorldLogLine(line);
    if (!parsed) continue;
    const action = parsed.action.split(/\s+/).slice(0, 2).join(' ');   // action head, e.g. 'reroll', 'tweak applied'
    out.push({ source: 'world-log', signature: `${parsed.lane}|${action}`, sample: line.slice(0, 160) });
  }
  return out;
}

/** Group signals by signature; signatures repeating ≥ threshold become skill candidates. */
export function detectCandidates(signals: RepetitionSignal[], threshold = 3): SkillCandidate[] {
  const groups = new Map<string, SkillCandidate>();
  for (const s of signals) {
    const key = `${s.source}::${s.signature}`;
    const g = groups.get(key);
    if (g) {
      g.occurrences += 1;
      if (g.samples.length < 3 && !g.samples.includes(s.sample)) g.samples.push(s.sample);
    } else {
      groups.set(key, { signature: s.signature, source: s.source, occurrences: 1, samples: [s.sample] });
    }
  }
  return [...groups.values()]
    .filter((c) => c.occurrences >= threshold)
    .sort((a, b) => b.occurrences - a.occurrences);
}

const kebab = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Mint a candidate into a skill spec (skill-creator methodology + vault schema). */
export function mintSkill(c: SkillCandidate, now: number): SkillRecord {
  const id = `cambium-${kebab(c.signature)}`;
  const [head, ...tail] = c.signature.split('|');
  const pattern = tail.join(' · ') || head;
  return {
    skill_id: id,
    status: 'candidate',
    category: c.source === 'deviations' ? 'delivery' : 'governance',
    description:
      `Handle the recurring "${c.signature}" pattern (seen ${c.occurrences}× in ${c.source}). ` +
      `USE WHEN a ${head} signal repeats with "${pattern}". ` +
      'NOT FOR fresh, one-off deviations — those route to the error-vs-intent why-handler.',
    trigger_signals: [c.signature, ...c.samples.slice(0, 2)],
    required_inputs: [
      { name: 'world-state', source: '.operator/<tenant>.world.json', required: true },
      { name: 'signal sample', source: c.source === 'deviations' ? 'deviations.jsonl' : 'world.log', required: true },
    ],
    output_contract: { format: 'decision', location: 'world.log + deviations.jsonl' },
    verification_steps: [
      'outcome recorded via telemetry (ok | fail) with a scenario note',
      'success rate ≥ 0.5 over the last 5 uses',
      'no repeat of an already-recorded gotcha',
    ],
    promotion_rule:
      'candidate → validated on first verified ok use; validated → production requires founder approval (never automatic)',
    source: { signature: c.signature, from: c.source, occurrences: c.occurrences },
    telemetry: { uses: 0, successes: 0, failures: 0, scenarios: [], gotchas: [], amendments: [] },
    created: now,
    updated: now,
  };
}

/** Merge freshly-minted skills into an existing registry — re-forging NEVER resets telemetry. */
export function upsertSkills(existing: SkillRecord[], minted: SkillRecord[]): SkillRecord[] {
  const byId = new Map(existing.map((s) => [s.skill_id, s]));
  for (const m of minted) {
    const prior = byId.get(m.skill_id);
    if (prior) {
      byId.set(m.skill_id, { ...prior, source: { ...m.source }, updated: m.updated });   // refresh evidence only
    } else {
      byId.set(m.skill_id, m);
    }
  }
  return [...byId.values()];
}
