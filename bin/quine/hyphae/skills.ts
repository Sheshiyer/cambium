// Quine hypha · skills — the skill forge surface: repetitive processes become skills.
// Read = the skill panel (uses · success rate · status · amendments). Write = `forge`
// (detect repetition in REAL signals and mint) or `record <skill-id> ok|fail` (usage
// telemetry → promotion / gotchas / amendment proposals). Registry persists tenant-keyed
// at .operator/<tenant>.skills.json — its own file; world/onboarding are never written.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Hypha, QuineCtx } from '../types.ts';
import { flag } from '../types.ts';
import {
  signaturesFromDeviations, signaturesFromWorldLog, detectCandidates, mintSkill, upsertSkills,
} from '../../operator/skills/forge.ts';
import type { SkillRecord } from '../../operator/skills/forge.ts';
import { recordUse, successRate, recentRate, isDeclining } from '../../operator/skills/telemetry.ts';

const tenantOf = (args: string[]): string => flag(args, '--tenant', process.env.TENANT || 'thoughtseed');
const registryPath = (ctx: QuineCtx, tenant: string): string => join(ctx.root, '.operator', `${tenant}.skills.json`);

function loadRegistry(ctx: QuineCtx, tenant: string): SkillRecord[] {
  try { return JSON.parse(readFileSync(registryPath(ctx, tenant), 'utf8')) as SkillRecord[]; } catch { return []; }
}

function saveRegistry(ctx: QuineCtx, tenant: string, skills: SkillRecord[]): void {
  mkdirSync(join(ctx.root, '.operator'), { recursive: true });
  writeFileSync(registryPath(ctx, tenant), JSON.stringify(skills, null, 2));
}

const readJson = (path: string): any | undefined => {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return undefined; }
};

/** All real repetition signals for a tenant: deviations (tenant-scoped per M3/C2,
 *  plus the legacy root ledger as heritage) + both world logs. */
function gatherSignals(ctx: QuineCtx, tenant: string) {
  const opDir = join(ctx.root, '.operator');
  const devLines: string[] = [];
  for (const devPath of [join(ctx.root, 'cortex', tenant, 'deviations.jsonl'), join(ctx.root, 'deviations.jsonl')]) {
    if (existsSync(devPath)) devLines.push(...readFileSync(devPath, 'utf8').split('\n'));
  }
  const onb = readJson(join(opDir, `${tenant}.onboarding.json`));
  const main = readJson(join(opDir, `${tenant}.world.json`));
  const log = [
    ...(Array.isArray(onb?.world?.log) ? onb.world.log : []),
    ...(Array.isArray(main?.log) ? main.log : []),
  ];
  return [...signaturesFromDeviations(devLines), ...signaturesFromWorldLog(log)];
}

function bar(rate: number, width = 8): string {
  const filled = Math.round(rate * width);
  return '█'.repeat(filled) + '·'.repeat(Math.max(0, width - filled));
}

function renderSkillPanel(skills: SkillRecord[], tenant: string): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('  ════════ Skill Forge · repetition becomes capability ════════');
  lines.push('');
  lines.push(`  tenant: ${tenant}`);
  lines.push('');
  if (skills.length === 0) {
    lines.push('  no skills minted yet — run: quine write skills forge --tenant ' + tenant);
  } else {
    lines.push('  skill                                   status      uses  rate            seen');
    for (const s of [...skills].sort((a, b) => b.source.occurrences - a.source.occurrences)) {
      const rate = successRate(s);
      const declining = isDeclining(s) ? ' ⚠ declining' : '';
      const id = s.skill_id.length > 38 ? s.skill_id.slice(0, 37) + '…' : s.skill_id;
      lines.push(
        `  ${id.padEnd(40)}${s.status.padEnd(12)}${String(s.telemetry.uses).padEnd(6)}` +
        `${bar(rate)} ${rate.toFixed(2)}${declining}  ${s.source.occurrences}×`,
      );
      if (s.telemetry.amendments.length > 0) {
        const a = s.telemetry.amendments.at(-1)!;
        lines.push(`      ↳ amendment: ${a.reason} — ${a.proposal.slice(0, 80)}…`);
      }
      if (s.telemetry.gotchas.length > 0) {
        lines.push(`      ↳ gotchas: ${s.telemetry.gotchas.length} (latest: "${s.telemetry.gotchas.at(-1)}")`);
      }
    }
    lines.push('');
    lines.push('  lifecycle: candidate → validated (first verified use) → production (founder approval)');
  }
  return lines.join('\n');
}

export const skills: Hypha = {
  name: 'skills',
  describe: 'the skill forge — repetitive processes minted as self-improving skills',
  help: [
    'quine skills [--tenant t]                                the skill panel',
    '       quine write skills forge [--tenant t]                    detect repetition + mint',
    '       quine write skills record <skill-id> ok|fail [--scenario "…"] [--tenant t]',
  ].join('\n'),

  async status(ctx) {
    const tenants = ['cambium', 'thoughtseed'].filter((t) => existsSync(registryPath(ctx, t)));
    const total = tenants.reduce((n, t) => n + loadRegistry(ctx, t).length, 0);
    return { name: 'skills', reachable: true, detail: total > 0 ? `${total} skill(s) across ${tenants.length} registr(y/ies)` : 'forge ready — nothing minted yet' };
  },

  async read(args, ctx) {
    const tenant = tenantOf(args);
    return renderSkillPanel(loadRegistry(ctx, tenant), tenant);
  },

  async write(args, ctx) {
    const tenant = tenantOf(args);
    const sub = args.find((a) => !a.startsWith('--'));

    if (sub === 'forge') {
      const existing = loadRegistry(ctx, tenant);
      const candidates = detectCandidates(gatherSignals(ctx, tenant));
      const now = Date.now();
      const minted = candidates.map((c) => mintSkill(c, now));
      const merged = upsertSkills(existing, minted);
      saveRegistry(ctx, tenant, merged);
      const fresh = merged.length - existing.length;
      return [
        `forged: ${candidates.length} candidate(s) from real signals · ${fresh} new skill(s) minted · registry ${merged.length}`,
        ...minted.map((m) => `  ${m.skill_id}  (${m.source.signature} ×${m.source.occurrences}, ${m.source.from})`),
        `registry: .operator/${tenant}.skills.json`,
      ].join('\n');
    }

    if (sub === 'record') {
      const rest = args.filter((a) => !a.startsWith('--') && args.indexOf(a) > args.indexOf('record'));
      const [skillId, outcome] = rest;
      if (!skillId || !['ok', 'fail'].includes(outcome ?? '')) {
        return 'usage: quine write skills record <skill-id> ok|fail [--scenario "…"] [--tenant t]';
      }
      const scenario = flag(args, '--scenario', '') || undefined;
      const registry = loadRegistry(ctx, tenant);
      const i = registry.findIndex((s) => s.skill_id === skillId);
      if (i < 0) return `skills: unknown skill "${skillId}" for tenant ${tenant} — run forge first`;
      registry[i] = recordUse(registry[i], outcome === 'ok', scenario, Date.now());
      saveRegistry(ctx, tenant, registry);
      const s = registry[i];
      const { rate, n } = recentRate(s);
      return [
        `recorded: ${skillId} ${outcome}${scenario ? ` ("${scenario}")` : ''}`,
        `  status ${s.status} · uses ${s.telemetry.uses} · lifetime rate ${successRate(s).toFixed(2)} · recent ${rate.toFixed(2)}/${n}`,
        ...(isDeclining(s) ? [`  ⚠ declining — amendment proposed: ${s.telemetry.amendments.at(-1)?.proposal.slice(0, 100)}`] : []),
      ].join('\n');
    }

    return 'skills: unknown write. Try: forge · record <skill-id> ok|fail';
  },
};
