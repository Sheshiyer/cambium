// Quine hypha · multica — the org gateway (M5 Phase R: READ the new home).
// MultiCA is where the Thoughtseed agent org lives (agents · issues · runs on a local
// daemon). This hypha reads it: status, the agent roster, and recent ACTIVITY — which
// the quests push turns into source:"multica" narrative beats (the org's life joins
// the story feed). Config from ~/.multica/config.json, read in-process; token never
// printed. Phase G (the model-gateway provider branch) is a later wing.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Hypha } from '../types.ts';
import { flag } from '../types.ts';
import type { StoryBeat } from '../../operator/narrative/narrative.ts';

interface MulticaConfig { server_url: string; workspace_id: string; token: string }

function config(): MulticaConfig | null {
  try {
    return JSON.parse(readFileSync(join(homedir(), '.multica', 'config.json'), 'utf8'));
  } catch { return null; }
}

async function api(resource: string, params = ''): Promise<any> {
  const cfg = config();
  if (!cfg) throw new Error('no ~/.multica/config.json');
  const base = cfg.server_url.replace(/\/+$/, '');
  const res = await fetch(`${base}/api/${resource}?workspace_id=${cfg.workspace_id}${params}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`multica ${resource} → ${res.status}`);
  return res.json();
}

const asList = (raw: any, key: string): any[] => (Array.isArray(raw) ? raw : raw?.[key] ?? []);

/** Open work items needing a founder decision — for the W4 gate (agent-assigned, not done). */
export async function multicaOpenItems(limit = 12): Promise<Array<{ id: string; title: string; status: string }>> {
  const issues = asList(await api('issues', '&limit=50'), 'issues');
  return issues
    .filter((i: any) => i.assignee_type === 'agent' && !['done', 'cancelled'].includes(i.status))
    .slice(0, limit)
    .map((i: any) => ({ id: i.identifier, title: i.title, status: i.status }));
}

/** Recent org activity as narrative beats (source: "multica") — REAL records only. */
export async function multicaActivityBeats(limit = 8): Promise<StoryBeat[]> {
  const issues = asList(await api('issues', '&limit=50'), 'issues');
  const agents = asList(await api('agents'), 'agents');
  const nameOf = new Map(agents.map((a: any) => [a.id, a.name]));
  return issues
    .filter((i: any) => i.updated_at || i.created_at)
    .sort((a: any, b: any) => Date.parse(a.updated_at ?? a.created_at) - Date.parse(b.updated_at ?? b.created_at))
    .slice(-limit)
    .map((i: any): StoryBeat => {
      const who = i.assignee_type === 'agent' ? (nameOf.get(i.assignee_id) ?? 'an agent') : 'a founder';
      const state = i.status === 'done' ? 'completed' : i.status === 'in_progress' ? 'is working' : 'queued';
      return {
        n: null,
        text: `${who} ${state === 'completed' ? 'completed' : state}: ${i.title} (${i.identifier}).`,
        lane: 'multica',
        noesis: false,
        source: 'multica',
        raw: `${i.identifier} ${i.status}`,
      };
    });
}

export const multica: Hypha = {
  name: 'multica',
  describe: 'the org gateway — agents · issues · activity from MultiCA (Phase R: read)',
  help: 'quine multica [agents|issues|activity] [--limit n]',

  async status() {
    const cfg = config();
    if (!cfg) return { name: 'multica', reachable: false, detail: 'no ~/.multica/config.json' };
    try {
      const base = cfg.server_url.replace(/\/+$/, '');
      const res = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(6000) });
      const health = await res.json();
      return { name: 'multica', reachable: res.ok, detail: `gateway ${health.status} · workspace ${cfg.workspace_id.slice(0, 8)}…` };
    } catch (e) {
      return { name: 'multica', reachable: false, detail: (e as Error).message };
    }
  },

  async read(args) {
    const what = args.find((a) => !a.startsWith('--')) ?? 'activity';
    const limit = Number(flag(args, '--limit', '8'));
    if (what === 'agents') {
      const agents = asList(await api('agents'), 'agents');
      return { hypha: 'multica', agents: agents.map((a: any) => ({ name: a.name, description: (a.description ?? '').slice(0, 70) })) };
    }
    if (what === 'issues') {
      const issues = asList(await api('issues', `&limit=${limit}`), 'issues');
      return { hypha: 'multica', issues: issues.map((i: any) => ({ id: i.identifier, title: i.title, status: i.status })) };
    }
    const beats = await multicaActivityBeats(limit);
    return { hypha: 'multica', activity: beats.map((b) => b.text) };
  },
};
