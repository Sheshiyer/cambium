// Quine hypha · lessons — proposed lessons minted from founder operating memory.
// This is the local, privacy-shaped write surface for the Lesson-Miner plan:
// Telegram/Hermes can arrive later, but mined lessons already land in the
// existing skill forge registry so arc XVII can count real proposed lessons.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Hypha, QuineCtx } from '../types.ts';
import { flag } from '../types.ts';
import type { SkillRecord } from '../../operator/skills/forge.ts';
import { upsertSkills } from '../../operator/skills/forge.ts';

type LessonKind = 'repeatable' | 'self-heal';

const DEFAULT_TENANT = 'demo-org';

const tenantOf = (args: string[]): string => flag(args, '--tenant', process.env.TENANT || DEFAULT_TENANT);
const registryPath = (ctx: QuineCtx, tenant: string): string => join(ctx.root, '.operator', `${tenant}.skills.json`);

function loadRegistry(ctx: QuineCtx, tenant: string): SkillRecord[] {
  try {
    const data = JSON.parse(readFileSync(registryPath(ctx, tenant), 'utf8'));
    return Array.isArray(data) ? data as SkillRecord[] : [];
  } catch { return []; }
}

function saveRegistry(ctx: QuineCtx, tenant: string, skills: SkillRecord[]): void {
  mkdirSync(join(ctx.root, '.operator'), { recursive: true });
  writeFileSync(registryPath(ctx, tenant), JSON.stringify(skills, null, 2) + '\n');
}

const kebab = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'lesson';

function evidenceRefs(args: string[]): string[] {
  const refs: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--evidence' && args[i + 1]) refs.push(args[i + 1]);
  }
  const csv = flag(args, '--evidence-list', '');
  if (csv) refs.push(...csv.split(',').map((s) => s.trim()).filter(Boolean));
  return [...new Set(refs)];
}

function mintLesson(args: string[], now: number): SkillRecord | string {
  const title = flag(args, '--title', '').trim();
  const kind = flag(args, '--kind', 'repeatable') as LessonKind;
  const summary = flag(args, '--summary', '').trim();
  const proposed = flag(args, '--proposed', '').trim();
  const arc = flag(args, '--arc', 'XVII').trim();
  const evidence = evidenceRefs(args);

  if (!title || !summary || !proposed) {
    return 'usage: quine write lessons mint --title "…" --kind repeatable|self-heal --summary "…" --proposed "…" [--evidence ref] [--arc XVII] [--tenant t]';
  }
  if (!['repeatable', 'self-heal'].includes(kind)) {
    return 'lessons: --kind must be repeatable or self-heal';
  }

  const slug = kebab(title);
  const signature = `lesson|${kind}|${slug}`;
  return {
    skill_id: `lesson-${slug}`,
    status: 'candidate',
    category: kind === 'self-heal' ? 'delivery' : 'governance',
    description:
      `Lesson: ${title}. USE WHEN ${summary}. ` +
      'NOT FOR automatic execution; proposed self-heals must go through the founder gate.',
    trigger_signals: [signature, ...evidence],
    required_inputs: [
      { name: 'lesson summary', source: 'lesson-miner digest or @bot pickup queue', required: true },
      { name: 'evidence reference', source: 'message link, digest id, or operator log pointer', required: evidence.length > 0 },
    ],
    output_contract: { format: 'lesson', location: `.operator/<tenant>.skills.json#lesson-${slug}` },
    verification_steps: [
      'founder can review the lesson without raw private group text leaking into the miniapp',
      'evidence references point back to the pickup queue, digest, or operator log',
      kind === 'self-heal' ? 'self-heal remains proposed until the founder gate approves it' : 'repeatable process has a clear proposed automation or routine',
    ],
    promotion_rule:
      'candidate → validated after founder review; validated → production only after explicit gate approval',
    source: { signature, from: 'world-log', occurrences: Math.max(1, evidence.length) },
    telemetry: { uses: 0, successes: 0, failures: 0, scenarios: [], gotchas: [], amendments: [] },
    created: now,
    updated: now,
  };
}

function renderLessons(skills: SkillRecord[], tenant: string): string {
  const lessons = skills.filter((s) => s.skill_id.startsWith('lesson-'));
  const lines = [
    '',
    '  ════════ Lessons · operating memory becomes capability ════════',
    '',
    `  tenant: ${tenant}`,
    '',
  ];
  if (lessons.length === 0) {
    lines.push('  no lessons minted yet — run: quine write lessons mint --title "…" --summary "…" --proposed "…"');
  } else {
    lines.push('  lesson                                 status      evidence');
    for (const lesson of lessons.sort((a, b) => b.updated - a.updated)) {
      const id = lesson.skill_id.length > 38 ? lesson.skill_id.slice(0, 37) + '…' : lesson.skill_id;
      lines.push(`  ${id.padEnd(40)}${lesson.status.padEnd(12)}${lesson.source.occurrences}`);
    }
  }
  return lines.join('\n');
}

export const lessons: Hypha = {
  name: 'lessons',
  describe: 'proposed lessons mined from founder operating memory',
  help: [
    'quine lessons [--tenant t]                              lesson panel',
    '       quine write lessons mint --title "…" --kind repeatable|self-heal --summary "…" --proposed "…" [--evidence ref] [--tenant t]',
  ].join('\n'),

  async status(ctx) {
    const tenants = ['cambium', DEFAULT_TENANT].filter((t) => existsSync(registryPath(ctx, t)));
    const total = tenants.reduce((n, t) => n + loadRegistry(ctx, t).filter((s) => s.skill_id.startsWith('lesson-')).length, 0);
    return { name: 'lessons', reachable: true, detail: total > 0 ? `${total} lesson(s) minted` : 'lesson mint ready' };
  },

  async read(args, ctx) {
    const tenant = tenantOf(args);
    return renderLessons(loadRegistry(ctx, tenant), tenant);
  },

  async write(args, ctx) {
    const tenant = tenantOf(args);
    const sub = args.find((a) => !a.startsWith('--'));
    if (sub !== 'mint') return 'lessons: unknown write. Try: mint --title "…" --summary "…" --proposed "…"';
    const lesson = mintLesson(args, Date.now());
    if (typeof lesson === 'string') return lesson;
    const existing = loadRegistry(ctx, tenant);
    const merged = upsertSkills(existing, [lesson]);
    saveRegistry(ctx, tenant, merged);
    return [
      `lesson minted: ${lesson.skill_id}`,
      `tenant: ${tenant}`,
      `kind: ${lesson.source.signature.split('|')[1]}`,
      `registry: .operator/${tenant}.skills.json`,
    ].join('\n');
  },
};
