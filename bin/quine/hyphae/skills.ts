// Quine hypha · skills — the skill forge surface: repetitive processes become skills.
// Read = the skill panel (uses · success rate · status · amendments). Write = `forge`
// (detect repetition in REAL signals and mint) or `record <skill-id> ok|fail` (usage
// telemetry → promotion / gotchas / amendment proposals). Registry persists tenant-keyed
// at .operator/<tenant>.skills.json — its own file; world/onboarding are never written.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import type { Hypha, QuineCtx } from '../types.ts';
import { flag } from '../types.ts';
import {
  signaturesFromDeviations, signaturesFromWorldLog, detectCandidates, mintSkill, upsertSkills,
} from '../../operator/skills/forge.ts';
import type { SkillRecord } from '../../operator/skills/forge.ts';
import { recordUse, successRate, recentRate, isDeclining } from '../../operator/skills/telemetry.ts';

const DEFAULT_TENANT = 'demo-org';

const tenantOf = (args: string[]): string => flag(args, '--tenant', process.env.TENANT || DEFAULT_TENANT);
const registryPath = (ctx: QuineCtx, tenant: string): string => join(ctx.root, '.operator', `${tenant}.skills.json`);
const archivePath = (ctx: QuineCtx, tenant: string): string => join(ctx.root, '.operator', `${tenant}.skills.archive.json`);

interface ArchiveReceipt {
  tenant: string;
  archives: Array<{
    routineId: string;
    archived: true;
    archivedAt: string;
    evidencePath?: string;
    repoPath?: string;
    note?: string;
    ceremony: string[];
  }>;
}

interface ArchiveRuntimeStatus {
  retired: boolean;
  activeProcesses: string[];
  activeServices: string[];
  hermesServices: string[];
}

function loadRegistry(ctx: QuineCtx, tenant: string): SkillRecord[] {
  try { return JSON.parse(readFileSync(registryPath(ctx, tenant), 'utf8')) as SkillRecord[]; } catch { return []; }
}

function saveRegistry(ctx: QuineCtx, tenant: string, skills: SkillRecord[]): void {
  mkdirSync(join(ctx.root, '.operator'), { recursive: true });
  writeFileSync(registryPath(ctx, tenant), JSON.stringify(skills, null, 2));
}

function loadArchive(ctx: QuineCtx, tenant: string): ArchiveReceipt {
  try {
    const data = JSON.parse(readFileSync(archivePath(ctx, tenant), 'utf8')) as ArchiveReceipt;
    const receipt = { tenant, archives: Array.isArray(data.archives) ? data.archives : [] };
    return receipt.archives.length > 0 ? receipt : loadPaperclipArchiveFallback(tenant);
  } catch { return loadPaperclipArchiveFallback(tenant); }
}

function loadPaperclipArchiveFallback(tenant: string): ArchiveReceipt {
  const archivesRoot = join(process.env.PAPERCLIP_ARCHIVES_ROOT || join(homedir(), '.paperclip', 'archives'));
  try {
    const dirs = readdirSync(archivesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(archivesRoot, entry.name))
      .filter((dir) => existsSync(join(dir, 'instances.tar.gz')) && existsSync(join(dir, 'repo-state.txt')))
      .sort();
    const latest = dirs.at(-1);
    if (!latest) return { tenant, archives: [] };
    const evidencePath = join(latest, 'instances.tar.gz');
    const repoStatePath = join(latest, 'repo-state.txt');
    const repoLine = readFileSync(repoStatePath, 'utf8').split('\n').find((line) => line.startsWith('repo='));
    return {
      tenant,
      archives: [{
        routineId: 'paperclip',
        archived: true,
        archivedAt: statSync(evidencePath).mtime.toISOString(),
        evidencePath,
        repoPath: repoLine?.slice('repo='.length),
        note: 'W6 archive artifact discovered from ~/.paperclip/archives fallback',
        ceremony: [
          'Paperclip archive artifact exists in the durable local archive directory',
          'repo-state.txt is stored beside the archive artifact',
          'Hermes channel layer remains the live external interface',
          'runtime retirement must still be verified before closing issue #26',
        ],
      }],
    };
  } catch { return { tenant, archives: [] }; }
}

function saveArchive(ctx: QuineCtx, tenant: string, receipt: ArchiveReceipt): void {
  mkdirSync(join(ctx.root, '.operator'), { recursive: true });
  writeFileSync(archivePath(ctx, tenant), JSON.stringify(receipt, null, 2) + '\n');
}

function activeProcessLines(pattern = 'paperclip|loop-runner'): string[] {
  try {
    return execFileSync('pgrep', ['-fl', pattern], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !isArchiveRuntimeInspector(line));
  } catch { return []; }
}

function activeLaunchdServices(): string[] {
  try {
    return execFileSync('launchctl', ['list'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /paperclip|ai\.hermes\./i.test(line));
  } catch { return []; }
}

export function assessArchiveRuntimeStatus(processes: string[], services: string[]): ArchiveRuntimeStatus {
  const activeProcesses = processes.filter((line) => /paperclip|loop-runner/i.test(line) && !isArchiveRuntimeInspector(line));
  const activeServices = services.filter((line) => /paperclip/i.test(line));
  const hermesServices = services.filter((line) => /ai\.hermes\./i.test(line));
  return {
    retired: activeProcesses.length === 0 && activeServices.length === 0,
    activeProcesses,
    activeServices,
    hermesServices,
  };
}

function isArchiveRuntimeInspector(line: string): boolean {
  return [
    /pgrep\s+-fl\s+/i,
    /ps\s+-axo\s+/i,
    /\brg\b.*(?:paperclip|loop-runner|forge-aura)/i,
    /npm\s+run\s+quine\s+--\s+read\s+skills\s+archive/i,
    /node\s+bin\/quine\/quine\.ts\s+read\s+skills\s+archive/i,
  ].some((pattern) => pattern.test(line));
}

function renderArchiveStatus(ctx: QuineCtx, tenant: string, routineId?: string): string {
  const receipt = loadArchive(ctx, tenant);
  const archives = routineId ? receipt.archives.filter((a) => a.routineId === routineId) : receipt.archives;
  const latest = archives.at(-1);
  const runtime = assessArchiveRuntimeStatus(activeProcessLines(), activeLaunchdServices());
  const lines = [
    '',
    '  ════════ Skill Archive · retirement evidence ════════',
    '',
    `  tenant: ${tenant}`,
    `  routine: ${routineId ?? 'all'}`,
    '',
  ];
  if (!latest) {
    lines.push('  receipt: missing');
  } else {
    lines.push('  receipt: found');
    lines.push(`  archivedAt: ${latest.archivedAt}`);
    lines.push(`  evidence: ${latest.evidencePath ?? 'not attached'}`);
    lines.push(`  repo: ${latest.repoPath ?? 'not attached'}`);
    if (latest.note) lines.push(`  note: ${latest.note}`);
  }
  lines.push('');
  lines.push(`  runtime retired: ${runtime.retired ? 'yes' : 'no'}`);
  if (runtime.activeProcesses.length > 0) {
    lines.push('  active processes:');
    for (const line of runtime.activeProcesses) lines.push(`    ${line}`);
  }
  if (runtime.activeServices.length > 0) {
    lines.push('  active services:');
    for (const line of runtime.activeServices) lines.push(`    ${line}`);
  }
  if (runtime.hermesServices.length > 0) {
    lines.push('  hermes services observed:');
    for (const line of runtime.hermesServices) lines.push(`    ${line}`);
  }
  lines.push('');
  lines.push(runtime.retired && latest ? '  issue #26 close gate: clear' : '  issue #26 close gate: blocked');
  return lines.join('\n');
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
    '       quine read skills archive [routine-id] [--tenant t]       archive receipt + runtime close gate',
    '       quine write skills forge [--tenant t]                    detect repetition + mint',
    '       quine write skills record <skill-id> ok|fail [--scenario "…"] [--tenant t]',
    '       quine write skills archive <routine-id> [--evidence path] [--repo path] [--note "…"] [--tenant t]',
  ].join('\n'),

  async status(ctx) {
    const tenants = ['cambium', DEFAULT_TENANT].filter((t) => existsSync(registryPath(ctx, t)));
    const total = tenants.reduce((n, t) => n + loadRegistry(ctx, t).length, 0);
    return { name: 'skills', reachable: true, detail: total > 0 ? `${total} skill(s) across ${tenants.length} registr(y/ies)` : 'forge ready — nothing minted yet' };
  },

  async read(args, ctx) {
    const tenant = tenantOf(args);
    const sub = args.find((a) => !a.startsWith('--'));
    if (sub === 'archive') {
      const rest = args.filter((a) => !a.startsWith('--') && args.indexOf(a) > args.indexOf('archive'));
      return renderArchiveStatus(ctx, tenant, rest[0]);
    }
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

    if (sub === 'archive') {
      const rest = args.filter((a) => !a.startsWith('--') && args.indexOf(a) > args.indexOf('archive'));
      const routineId = rest[0];
      if (!routineId) {
        return 'usage: quine write skills archive <routine-id> [--evidence path] [--repo path] [--note "…"] [--tenant t]';
      }
      const receipt = loadArchive(ctx, tenant);
      const next = {
        routineId,
        archived: true as const,
        archivedAt: new Date().toISOString(),
        evidencePath: flag(args, '--evidence', '') || undefined,
        repoPath: flag(args, '--repo', '') || undefined,
        note: flag(args, '--note', '') || undefined,
        ceremony: [
          'Paperclip process soak must be verified before issue closure',
          'instances and repo state archived or referenced by evidencePath/repoPath',
          'Hermes channel layer remains the live external interface',
          'quest evidence may now treat the project archive as complete',
        ],
      };
      receipt.archives = [...receipt.archives.filter((a) => a.routineId !== routineId), next];
      saveArchive(ctx, tenant, receipt);
      return [
        `archived: ${routineId} for tenant ${tenant}`,
        `receipt: .operator/${tenant}.skills.archive.json`,
        next.evidencePath ? `evidence: ${next.evidencePath}` : 'evidence: not attached',
        next.repoPath ? `repo: ${next.repoPath}` : 'repo: not attached',
      ].join('\n');
    }

    return 'skills: unknown write. Try: forge · record <skill-id> ok|fail · archive <routine-id>';
  },
};
