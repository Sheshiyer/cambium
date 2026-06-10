// Quine hypha · quests — the quest log: where this venture stands in the infinite game.
// Read = render the quest panel for a tenant. This hypha is the I/O layer for the PURE
// quest fold (bin/operator/quests/quests.ts): it gathers inputs fail-soft (missing files
// → honest "unplayed"/"unreachable" states) and NEVER writes world or onboarding state.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Hypha, QuineCtx } from '../types.ts';
import { flag } from '../types.ts';
import { questLedger } from '../../operator/quests/quests.ts';
import type { QuestInputs } from '../../operator/quests/quests.ts';
import { renderQuestLog } from '../../operator/quests/panel.ts';

const tenantOf = (args: string[]): string => flag(args, '--tenant', process.env.TENANT || 'thoughtseed');

const readJson = (path: string): any | undefined => {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return undefined; }
};

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
  return inputs;
}

// The push lane (Thalia wing W1): derive the ledger and POST it inside a freshness
// envelope to the serving Worker (curious.thoughtseed.space). Token read IN-PROCESS
// from the founder env file — never shell-sourced, never echoed (house pattern,
// see scripts/onboard-live.ts). The vault R2 backup bucket is not involved.
const PUSH_URL_DEFAULT = 'https://curious.thoughtseed.space';

function pushTokenFromEnvFile(): string | undefined {
  if (process.env.QUESTS_PUSH_TOKEN) return process.env.QUESTS_PUSH_TOKEN;
  try {
    const txt = readFileSync(join(process.env.HOME ?? '', '.claude', '.env'), 'utf8');
    const line = txt.split('\n').find((l) => l.startsWith('QUESTS_PUSH_TOKEN='));
    return line?.slice('QUESTS_PUSH_TOKEN='.length).replace(/^["']|["']$/g, '').trim() || undefined;
  } catch { return undefined; }
}

export const quests: Hypha = {
  name: 'quests',
  describe: 'the quest log — where this venture stands in the infinite game (derived, never stored)',
  help: 'quine quests [--tenant t]            the quest log panel\n' +
        '       quine write quests push [--tenant t] [--url base]   derive + push the ledger envelope to the serving worker',

  async status(ctx) {
    const opDir = join(ctx.root, '.operator');
    if (!existsSync(opDir)) return { name: 'quests', reachable: false, detail: 'no .operator state yet' };
    const tenants = gatherQuestInputs(ctx, 'thoughtseed').tenants ?? [];
    return { name: 'quests', reachable: true, detail: `quest fold ready · ${tenants.length} tenant(s)` };
  },

  async read(args, ctx) {
    const tenant = tenantOf(args);
    const ledger = questLedger(gatherQuestInputs(ctx, tenant));
    const lines: string[] = [];
    renderQuestLog(ledger, tenant, (s) => lines.push(s));
    return lines.join('\n');
  },

  async write(args, ctx) {
    const sub = args.find((a) => !a.startsWith('--'));
    if (sub !== 'push') return 'quests: unknown write. Try: quine write quests push [--tenant t]';
    const tenant = tenantOf(args);
    const base = flag(args, '--url', PUSH_URL_DEFAULT).replace(/\/+$/, '');
    const token = pushTokenFromEnvFile();
    if (!token) return 'quests push: no QUESTS_PUSH_TOKEN (env or ~/.claude/.env) — refusing.';

    const inputs = gatherQuestInputs(ctx, tenant);
    const L = questLedger(inputs);
    // narrative beats v0.5 (full W3 mapper later): the last world-log lines, lane-tagged
    const beats = (inputs.world?.log ?? []).slice(-40).map((line) => ({
      text: line,
      lane: line.match(/→\s*(\w+)/)?.[1] ?? 'beat',
      noesis: line.includes('noesis'),
    }));
    const envelope = {
      schema: 1,
      derivedAt: new Date().toISOString(),
      source: 'push',
      tenant,
      beats,
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
    return {
      hypha: 'quests', pushed: res.ok, status: res.status, url: `${base}/api/quests/${tenant}`,
      tenant, derivedAt: envelope.derivedAt, completed: `${L.completed}/${L.total}`, bytes: j.bytes ?? null,
      ...(res.ok ? {} : { error: j.error ?? 'push failed' }),
    };
  },
};
