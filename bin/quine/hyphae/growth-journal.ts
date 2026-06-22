// Quine hypha · growth journal — append-only full-chain truth snapshots.
//
// The journal is deliberately operational state, not another planning doc:
// each entry derives from the same organ registry, pipeline, quest fold, and
// handoff files the system already uses. It exists to keep active topology,
// retired surfaces, and current gaps from drifting apart across older docs.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Hypha, QuineCtx } from '../types.ts';
import { flag } from '../types.ts';
import { questLedger } from '../../operator/quests/quests.ts';
import type { QuestInputs, QuestLedgerRow } from '../../operator/quests/quests.ts';
import { gatherPaperclipInputs, gatherQuestInputs } from './quests.ts';
import { refreshProjectEvidence } from './project-evidence.ts';
import { cloudflareEnvReady } from './cloudflare-env.ts';

const JOURNAL_SCHEMA = 'cambium.growth-journal.v1';
const DEFAULT_TENANT = 'cambium';

export interface GrowthJournalEntry {
  schema: typeof JOURNAL_SCHEMA;
  id: string;
  tenant: string;
  createdAt: string;
  note: string;
  topology: {
    organs: Array<{ id: string; role: string; tier: string; repo: string }>;
    stages: Array<{ id: string; organ: string; title: string }>;
    crosscutting: string[];
    visibleEngine: { package: string; source: string; status: string };
  };
  quest: {
    completed: number;
    total: number;
    current: null | { arc: string; id: string; title: string; evidence: string };
    rows: Array<{ arc: string; id: string; title: string; status: string; evidence: string }>;
  };
  surfaces: {
    active: string[];
    retired: Array<{ id: string; status: 'retired'; guard: string }>;
    pending: Array<{ id: string; status: string; next: string }>;
  };
  driftGuards: {
    canonicalFiles: string[];
    staleDocGuard: string;
    noFakeProgress: string;
  };
  gaps: Array<{ id: string; status: string; evidence: string; next: string }>;
}

const tenantOf = (args: string[]): string => flag(args, '--tenant', process.env.TENANT || DEFAULT_TENANT);

function readJson(path: string): any | undefined {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return undefined; }
}

function rel(ctx: QuineCtx, path: string): string {
  const relativePath = relative(ctx.root, path);
  return relativePath.startsWith('..') ? path : relativePath;
}

function journalPath(ctx: QuineCtx, tenant: string): string {
  return join(ctx.root, '.operator', `${tenant}.growth-journal.jsonl`);
}

function entryId(nowIso: string): string {
  return `gj-${nowIso.replace(/[-:.]/g, '').replace('T', '-').replace('Z', 'Z')}`;
}

function rowForCurrent(rows: QuestLedgerRow[], id: string): QuestLedgerRow | undefined {
  return rows.find((row) => row.quest.id === id);
}

function topology(ctx: QuineCtx): GrowthJournalEntry['topology'] {
  const registry = readJson(join(ctx.root, 'registry.json')) ?? {};
  const pipeline = readJson(join(ctx.root, 'composition', 'pipeline.json')) ?? {};
  const organs = Object.entries(registry.organs ?? {}).map(([id, organ]: [string, any]) => ({
    id,
    role: String(organ.role ?? id),
    tier: String(organ.tier ?? 'unknown'),
    repo: String(organ.repo ?? 'unknown'),
  }));
  const stages = (Array.isArray(pipeline.stages) ? pipeline.stages : []).map((stage: any) => ({
    id: String(stage.id ?? ''),
    organ: String(stage.organ ?? ''),
    title: String(stage.title ?? ''),
  }));
  const crosscutting = (Array.isArray(pipeline.crosscutting) ? pipeline.crosscutting : [])
    .map((item: any) => String(item.id ?? item.organ ?? ''))
    .filter(Boolean);
  const r3fPkg = readJson(join(ctx.root, 'apps', 'cambium-r3f', 'package.json'));
  return {
    organs,
    stages,
    crosscutting,
    visibleEngine: {
      package: String(r3fPkg?.name ?? '@cambium/r3f-visual-engine'),
      source: 'apps/cambium-r3f/src/generated/source-contract.ts',
      status: existsSync(join(ctx.root, 'apps', 'cambium-r3f', 'src', 'generated', 'source-contract.ts'))
        ? 'source-contract-present'
        : 'source-contract-missing',
    },
  };
}

function retiredSurfaces(): GrowthJournalEntry['surfaces']['retired'] {
  return [
    { id: 'teamforge', status: 'retired', guard: 'not an active hypha or tenant boundary' },
    { id: 'multica', status: 'retired', guard: 'superseded by Thoughtseed Paperclip/Hermes bridge' },
  ];
}

function pendingSurfaces(ctx: QuineCtx): GrowthJournalEntry['surfaces']['pending'] {
  const plexusDoc = join(ctx.root, '..', 'plexus-ts', 'docs', 'THOUGHTSEED_BRIDGE_HANDOFF.md');
  const plexusSmoke = join(ctx.root, '..', 'plexus-ts', 'docs', 'evidence', '2026-06-21-thoughtseed-bridge-smoke.md');
  const cloudflareProof = join(ctx.vaultRoot, '60-client-ecosystem', 'cambium', 'cloudflare', '2026-06-21-cloudflare-shell-proof.json');
  const plexusStatus = existsSync(plexusSmoke)
    ? 'confirmed'
    : existsSync(plexusDoc) ? 'handoff-doc-present' : 'handoff-doc-missing';
  const cloudflareStatus = existsSync(cloudflareProof)
    ? 'proof-file-present'
    : cloudflareEnvReady() ? 'token-proven' : 'missing-env-token';
  return [
    {
      id: 'plexus',
      status: plexusStatus,
      next: plexusStatus === 'confirmed'
        ? 'keep member token rotation and bridge smoke evidence current'
        : 'wait for Plexus bridge confirmation, then run readback smoke',
    },
    {
      id: 'cloudflare-cli-probe',
      status: cloudflareStatus,
      next: cloudflareStatus === 'missing-env-token'
        ? 'export canonical CLOUDFLARE_* env or add redacted shell proof'
        : 'keep canonical CLOUDFLARE_* env and proof packet fresh',
    },
  ];
}

function activeSurfaces(): string[] {
  return [
    'cambium composition registry',
    'curios.self Telegram miniapp worker',
    'Thoughtseed Telegram tenant',
    'Thoughtseed Paperclip org',
    'Hermes founder gate',
    'Cambium R3F visual engine',
  ];
}

function canonicalFiles(ctx: QuineCtx): string[] {
  return [
    rel(ctx, join(ctx.root, 'registry.json')),
    rel(ctx, join(ctx.root, 'composition', 'pipeline.json')),
    rel(ctx, join(ctx.root, 'bin', 'operator', 'quests', 'quests.ts')),
    rel(ctx, join(ctx.root, 'bin', 'quine', 'hyphae', 'quests.ts')),
    rel(ctx, join(ctx.root, '..', 'INFRA_STATUS.md')),
    rel(ctx, join(ctx.root, '..', 'plexus-ts', 'docs', 'THOUGHTSEED_BRIDGE_HANDOFF.md')),
  ];
}

function gapList(entryQuest: GrowthJournalEntry['quest'], surfaces: GrowthJournalEntry['surfaces']): GrowthJournalEntry['gaps'] {
  const gaps: GrowthJournalEntry['gaps'] = [];
  if (entryQuest.current) {
    gaps.push({
      id: `quest-${entryQuest.current.id}`,
      status: 'active-frontier',
      evidence: entryQuest.current.evidence,
      next: entryQuest.current.id === 'the-brief'
        ? 'capture accepted brief, signed contract, and deposit proof'
        : 'advance the current quest with source-backed evidence',
    });
  }
  const plexus = surfaces.pending.find((surface) => surface.id === 'plexus');
  if (plexus?.status !== 'confirmed') {
    gaps.push({
      id: 'plexus-readback',
      status: plexus?.status ?? 'unknown',
      evidence: 'Plexus is a handoff until its bridge thread returns confirmation',
      next: 'consume PLEXUS BRIDGE CONFIRMATION and run readback smoke',
    });
  }
  const cf = surfaces.pending.find((surface) => surface.id === 'cloudflare-cli-probe');
  if (cf && !['token-proven', 'proof-file-present'].includes(cf.status)) {
    gaps.push({
      id: 'cloudflare-cli-probe',
      status: cf?.status ?? 'unknown',
      evidence: 'local quine cf status cannot prove Cloudflare reachability without CLOUDFLARE_* env or a redacted proof packet',
      next: 'load canonical CLOUDFLARE_* env or refresh the Cloudflare shell proof',
    });
  }
  return gaps;
}

export async function buildGrowthJournalEntry(
  ctx: QuineCtx,
  tenant: string,
  options: { note?: string; nowIso?: string; refreshEvidence?: boolean; paperclip?: QuestInputs['paperclip'] } = {},
): Promise<GrowthJournalEntry> {
  if (options.refreshEvidence) refreshProjectEvidence(ctx, tenant);
  const inputs = gatherQuestInputs(ctx, tenant);
  inputs.paperclip = options.paperclip ?? await gatherPaperclipInputs();
  const ledger = questLedger(inputs);
  const currentRow = ledger.current ? rowForCurrent(ledger.rows, ledger.current.id) : undefined;
  const quest: GrowthJournalEntry['quest'] = {
    completed: ledger.completed,
    total: ledger.total,
    current: ledger.current ? {
      arc: ledger.current.arc,
      id: ledger.current.id,
      title: ledger.current.title,
      evidence: currentRow?.evidence ?? '',
    } : null,
    rows: ledger.rows.map((row) => ({
      arc: row.quest.arc,
      id: row.quest.id,
      title: row.quest.title,
      status: row.status,
      evidence: row.evidence,
    })),
  };
  const surfaces: GrowthJournalEntry['surfaces'] = {
    active: activeSurfaces(),
    retired: retiredSurfaces(),
    pending: pendingSurfaces(ctx),
  };
  const now = options.nowIso ?? new Date().toISOString();
  return {
    schema: JOURNAL_SCHEMA,
    id: entryId(now),
    tenant,
    createdAt: now,
    note: options.note || 'full-chain organ audit',
    topology: topology(ctx),
    quest,
    surfaces,
    driftGuards: {
      canonicalFiles: canonicalFiles(ctx),
      staleDocGuard: 'journal entries are append-only snapshots; update canonical files before citing older docs',
      noFakeProgress: 'quest progress is derived from world, cortex, Paperclip, and project evidence',
    },
    gaps: gapList(quest, surfaces),
  };
}

export function appendGrowthJournalEntry(ctx: QuineCtx, entry: GrowthJournalEntry): string {
  const path = journalPath(ctx, entry.tenant);
  mkdirSync(join(ctx.root, '.operator'), { recursive: true });
  appendFileSync(path, JSON.stringify(entry) + '\n');
  return path;
}

function readEntries(ctx: QuineCtx, tenant: string): GrowthJournalEntry[] {
  try {
    return readFileSync(journalPath(ctx, tenant), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as GrowthJournalEntry);
  } catch {
    return [];
  }
}

function renderEntry(entry: GrowthJournalEntry): string {
  const current = entry.quest.current
    ? `${entry.quest.current.arc} · ${entry.quest.current.title} (${entry.quest.current.evidence})`
    : 'all quests complete';
  const gaps = entry.gaps.map((gap) => `${gap.id}:${gap.status}`).join(' · ') || 'none';
  return [
    `${entry.createdAt} · ${entry.tenant} · ${entry.quest.completed}/${entry.quest.total}`,
    `  note: ${entry.note}`,
    `  frontier: ${current}`,
    `  active: ${entry.surfaces.active.join(' · ')}`,
    `  retired guards: ${entry.surfaces.retired.map((surface) => surface.id).join(' · ')}`,
    `  gaps: ${gaps}`,
  ].join('\n');
}

export const growthJournal: Hypha = {
  name: 'journal',
  describe: 'growth journal — append-only full-chain organ snapshots and drift guards',
  help: 'quine journal [--tenant t] [--limit n] [--json]\n' +
        '       quine write journal entry [--tenant t] [--note "..."] [--refresh-evidence]',

  async status(ctx) {
    const entries = readEntries(ctx, DEFAULT_TENANT).length;
    return { name: 'journal', reachable: true, detail: entries ? `${entries} cambium entr${entries === 1 ? 'y' : 'ies'}` : 'ready · no cambium entries yet' };
  },

  async read(args, ctx) {
    const tenant = tenantOf(args);
    const limit = Number(flag(args, '--limit', '5'));
    const entries = readEntries(ctx, tenant).slice(-Math.max(1, limit));
    if (args.includes('--json')) return { hypha: 'journal', tenant, entries };
    if (entries.length === 0) return `growth journal: no entries for ${tenant}`;
    return entries.map(renderEntry).join('\n\n');
  },

  async write(args, ctx) {
    const sub = args.find((arg) => !arg.startsWith('--'));
    if (sub !== 'entry') return 'journal: unknown write. Try: entry [--tenant t] [--note "..."] [--refresh-evidence]';
    const tenant = tenantOf(args);
    const entry = await buildGrowthJournalEntry(ctx, tenant, {
      note: flag(args, '--note', 'full-chain organ audit'),
      refreshEvidence: args.includes('--refresh-evidence'),
    });
    const path = appendGrowthJournalEntry(ctx, entry);
    return {
      hypha: 'journal',
      wrote: rel(ctx, path),
      tenant,
      id: entry.id,
      completed: `${entry.quest.completed}/${entry.quest.total}`,
      current: entry.quest.current ? `${entry.quest.current.arc} · ${entry.quest.current.title}` : null,
      gaps: entry.gaps.map((gap) => `${gap.id}:${gap.status}`),
    };
  },
};
