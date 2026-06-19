// Quine hypha · quests — the quest log: where this venture stands in the infinite game.
// Read = render the quest panel for a tenant. This hypha is the I/O layer for the PURE
// quest fold (bin/operator/quests/quests.ts): it gathers inputs fail-soft (missing files
// → honest "unplayed"/"unreachable" states) and NEVER writes world or onboarding state.

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Hypha, QuineCtx } from '../types.ts';
import { flag } from '../types.ts';
import { questLedger } from '../../operator/quests/quests.ts';
import type { QuestInputs } from '../../operator/quests/quests.ts';
import { renderQuestLog } from '../../operator/quests/panel.ts';
import { narrate } from '../../operator/narrative/narrative.ts';
import { multicaActivityBeats, multicaOpenItems, multicaAgentCount, multicaIssuesDone, multicaCommandsData } from './multica.ts';
import { teamforgeActivityBeats } from './teamforge.ts';
import { refreshProjectEvidence } from './project-evidence.ts';

const tenantOf = (args: string[]): string => flag(args, '--tenant', process.env.TENANT || 'thoughtseed');

const readJson = (path: string): any | undefined => {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return undefined; }
};

// Founder-inheritance reducer. Root tenants (cambium/thoughtseed) earn the I–IX
// "founder tutorial" arcs once; every client tenant inherits those completions
// via founder.json. Non-root tenants never write to founder.json — their
// progress lives in ${tenant}.project.json instead.
const ROOT_TENANTS = new Set(['cambium', 'thoughtseed']);

export interface FounderState { completedArcs: string[]; derivedFrom: string; derivedAt: string }

export function reconcileFounder(
  prev: FounderState,
  ledger: { rows: Array<{ quest: { id: string }; status: 'complete' | 'active' | 'locked' }> },
  tenant: string,
  nowIso?: string,
): FounderState | null {
  if (!ROOT_TENANTS.has(tenant)) return null;
  const completed = ledger.rows.filter((r) => r.status === 'complete').map((r) => r.quest.id);
  const merged = Array.from(new Set([...prev.completedArcs, ...completed]));
  if (merged.length === prev.completedArcs.length) return prev;        // no change
  return { completedArcs: merged, derivedFrom: tenant, derivedAt: nowIso ?? new Date().toISOString() };
}

function cortexCountFor(opDir: string, tenant: string): number | undefined {
  try {
    // node:sqlite is the local transport's engine (see ../../operator/cortex-sqlite.ts)
    const db = new DatabaseSync(join(opDir, 'cortex.db'), { readOnly: true });
    try {
      const row = db.prepare('SELECT COUNT(*) AS n FROM memory WHERE tenant = ?').get(tenant) as { n: number };
      return Number(row?.n ?? 0);
    } finally { db.close(); }
  } catch { return undefined; }
}

/** Gather everything the quest fold may look at — every source fail-soft. */
export function gatherQuestInputs(ctx: QuineCtx, tenant: string): QuestInputs {
  const opDir = join(ctx.root, '.operator');
  const onb = readJson(join(opDir, `${tenant}.onboarding.json`));
  const main = readJson(join(opDir, `${tenant}.world.json`));

  const inputs: QuestInputs = {};
  if (onb && typeof onb.stepIndex === 'number') {
    inputs.onboarding = {
      stepIndex: onb.stepIndex,
      drivesActivated: Array.isArray(onb.drivesActivated) ? onb.drivesActivated : [],
      noesisMoments: Number(onb.noesisMoments ?? 0),
    };
  }
  const worlds = [onb?.world, main].filter(Boolean);
  if (worlds.length > 0) {
    inputs.world = {
      version: Math.max(...worlds.map((w: any) => Number(w.version ?? 0))),
      artifacts: Object.assign({}, ...worlds.map((w: any) => w.artifacts ?? {})),
      log: worlds.flatMap((w: any) => (Array.isArray(w.log) ? w.log : [])),
    };
  }
  inputs.cortexCount = cortexCountFor(opDir, tenant);
  try {
    inputs.tenants = readdirSync(opDir)
      .map((f) => f.match(/^(.+)\.world\.json$/)?.[1])
      .filter((t): t is string => !!t && !t.startsWith('_'));
  } catch { /* no .operator dir yet */ }
  try {
    inputs.isolationSuite = readdirSync(join(ctx.root, 'bin', 'operator'))
      .some((f) => /tenan/i.test(f) && /\.test\.ts$/.test(f));      // flips true when M3 C4 lands
  } catch { inputs.isolationSuite = false; }
  // M5 Phase Q Bridge: founder-level completion (arcs I–IX inherited by all tenants)
  const founder = readJson(join(opDir, 'founder.json'));
  if (founder && Array.isArray(founder.completedArcs)) {
    inputs.founder = { completedArcs: founder.completedArcs };
  }
  // M5 Phase Q Bridge: project/delivery evidence (arcs X+)
  const proj = readJson(join(opDir, `${tenant}.project.json`));
  if (proj && typeof proj === 'object') {
    inputs.project = proj;
  }
  return inputs;
}

/** Gather MultiCA-derived quest inputs — async because it calls the gateway. Fail-soft. */
export async function gatherMulticaInputs(): Promise<QuestInputs['multica']> {
  try {
    const [agents, issuesDone, issuesOpen] = await Promise.all([
      multicaAgentCount(),
      multicaIssuesDone(),
      multicaOpenItems(12).then((items) => items.length),
    ]);
    return { reachable: true, agents, issuesDone, issuesOpen };
  } catch {
    return { reachable: false, agents: 0, issuesDone: 0, issuesOpen: 0 };
  }
}

// The push lane: derive the ledger and POST it inside a freshness envelope to a
// configured serving Worker. Token read IN-PROCESS from a Cambium env file —
// never shell-sourced, never echoed. The vault R2 backup bucket is not involved.
const PUSH_URL_DEFAULT = process.env.CAMBIUM_PUBLIC_BASE_URL || 'https://cambium.example.com';

function pushTokenFromEnvFile(): string | undefined {
  if (process.env.QUESTS_PUSH_TOKEN) return process.env.QUESTS_PUSH_TOKEN;
  try {
    const txt = readFileSync(process.env.CAMBIUM_ENV_FILE || join(process.env.HOME ?? '', '.config', 'cambium', '.env'), 'utf8');
    const line = txt.split('\n').find((l) => l.startsWith('QUESTS_PUSH_TOKEN='));
    return line?.slice('QUESTS_PUSH_TOKEN='.length).replace(/^["']|["']$/g, '').trim() || undefined;
  } catch { return undefined; }
}

// The push lane body, extracted from `write` so the dispatcher below can compose
// it with the new `evidence` and `activate-tenant` subverbs. Behavior unchanged.
async function pushLedger(args: string[], ctx: QuineCtx, tenant: string): Promise<unknown> {
  const base = flag(args, '--url', PUSH_URL_DEFAULT).replace(/\/+$/, '');
  const token = pushTokenFromEnvFile();
  if (!token) return 'quests push: no QUESTS_PUSH_TOKEN (env or ~/.claude/.env) — refusing.';

  const inputs = gatherQuestInputs(ctx, tenant);
  inputs.multica = await gatherMulticaInputs();
  const L = questLedger(inputs);
  // W3: the narrative mapper turns logs + deviations into PROSE beats; M5 Phase R
  // appends the org's live activity (source:"multica") — fail-soft if unreachable.
  const devLines: string[] = [];
  for (const p of [join(ctx.root, 'cortex', tenant, 'deviations.jsonl'), join(ctx.root, 'deviations.jsonl')]) {
    try { devLines.push(...readFileSync(p, 'utf8').split('\n')); } catch { /* absent */ }
  }
  const beats = narrate(inputs.world?.log ?? [], devLines, 40);
  let openItems: Array<{ id: string; title: string; status: string }> = [];
  try { beats.push(...await multicaActivityBeats(8)); openItems = await multicaOpenItems(12); }
  catch { /* gateway unreachable — story stays local, gate stays empty */ }
  // The TeamForge emitter (projects · sync journal · conflicts) joins the feed as
  // the source:"teamforge" lane — fail-soft if the feed token/URL are unset.
  try { beats.push(...await teamforgeActivityBeats(6)); }
  catch { /* forge feed unreachable — story keeps its other lanes */ }
  // Read-only command data for the miniapp Commands panel (status/agents/work/handoffs).
  let commands: Record<string, unknown> | null = null;
  try {
    commands = await multicaCommandsData(`${L.completed}/${L.total}`);
    commands.handoffs = openItems;
  } catch { /* multica unreachable — commands cards show 'unavailable' */ }
  const envelope = {
    schema: 1,
    derivedAt: new Date().toISOString(),
    source: flag(args, '--source', 'push'),
    tenant,
    beats,
    openItems,
    commands,
    ledger: {
      completed: L.completed,
      total: L.total,
      current: L.current ? { arc: L.current.arc, id: L.current.id, title: L.current.title, narration: L.current.narration } : null,
      rows: L.rows.map((r) => ({ arc: r.quest.arc, id: r.quest.id, title: r.quest.title, status: r.status, evidence: r.evidence })),
    },
  };
  const res = await fetch(`${base}/internal/ledger/${tenant}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
  });
  const j: any = await res.json().catch(() => ({}));
  if (res.ok) {
    // Founder-inheritance side-effect (root tenants only). Only fires when the
    // upstream push succeeded — we never let founder.json drift ahead of what
    // the worker has accepted.
    const founderPath = join(ctx.root, '.operator', 'founder.json');
    const prevFounder: FounderState =
      readJson(founderPath) ?? { completedArcs: [], derivedFrom: tenant, derivedAt: new Date().toISOString() };
    const nextFounder = reconcileFounder(prevFounder, L, tenant);
    if (nextFounder && nextFounder !== prevFounder) {
      writeFileSync(founderPath, JSON.stringify(nextFounder, null, 2) + '\n');
    }
  }
  return {
    hypha: 'quests', pushed: res.ok, status: res.status, url: `${base}/api/quests/${tenant}`,
    tenant, derivedAt: envelope.derivedAt, completed: `${L.completed}/${L.total}`, bytes: j.bytes ?? null,
    ...(res.ok ? {} : { error: j.error ?? 'push failed' }),
  };
}

export const quests: Hypha = {
  name: 'quests',
  describe: 'the quest log — where this venture stands in the infinite game (derived, never stored)',
  help: 'quine quests [--tenant t]            the quest log panel\n' +
        '       quine write quests push [--tenant t] [--url base]      derive + push the ledger envelope\n' +
        '       quine write quests evidence [--tenant t]               refresh ${tenant}.project.json from real sources\n' +
        '       quine write quests activate-tenant --tenant <id>       bootstrap a new tenant world + project',

  async status(ctx) {
    const opDir = join(ctx.root, '.operator');
    if (!existsSync(opDir)) return { name: 'quests', reachable: false, detail: 'no .operator state yet' };
    const tenants = gatherQuestInputs(ctx, 'thoughtseed').tenants ?? [];
    return { name: 'quests', reachable: true, detail: `quest fold ready · ${tenants.length} tenant(s)` };
  },

  async read(args, ctx) {
    const tenant = tenantOf(args);
    const inputs = gatherQuestInputs(ctx, tenant);
    inputs.multica = await gatherMulticaInputs();
    const ledger = questLedger(inputs);
    const lines: string[] = [];
    renderQuestLog(ledger, tenant, (s) => lines.push(s));
    return lines.join('\n');
  },

  async write(args, ctx) {
    const sub = args.find((a) => !a.startsWith('--'));
    const tenant = tenantOf(args);

    if (sub === 'push') {
      return await pushLedger(args, ctx, tenant);
    }

    if (sub === 'evidence') {
      const evidence = refreshProjectEvidence(ctx, tenant);
      return { hypha: 'quests', op: 'evidence', tenant, evidence };
    }

    if (sub === 'activate-tenant') {
      const opDir = join(ctx.root, '.operator');
      mkdirSync(opDir, { recursive: true });
      const worldPath = join(opDir, `${tenant}.world.json`);
      const worldAlreadyExisted = existsSync(worldPath);
      if (!worldAlreadyExisted) {
        writeFileSync(worldPath, JSON.stringify({
          version: 1,
          artifacts: { tenant },
          log: [`${new Date().toISOString()} → tenant activated via quine write quests activate-tenant`],
        }, null, 2) + '\n');
      }
      const evidence = refreshProjectEvidence(ctx, tenant);
      return { hypha: 'quests', op: 'activate-tenant', tenant, worldCreated: !worldAlreadyExisted, evidence };
    }

    return 'quests: unknown write. Try: push | evidence | activate-tenant [--tenant t]';
  },
};
