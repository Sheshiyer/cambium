// Quine hypha · multica — the org gateway (M5 Phase R: READ the new home; Phase G: model-gateway wiring).
// MultiCA is where the Thoughtseed agent org lives (agents · issues · runs on a local
// daemon). This hypha reads it: status, the agent roster, and recent ACTIVITY — which
// the quests push turns into source:"multica" narrative beats (the org's life joins
// the story feed). Config from ~/.multica/config.json, read in-process; token never
// printed. Phase G wires each agent's `model` to the token factory configured in
// opencode (Nebius Token Factory preferred, NVIDIA fallback), so MultiCA's gateway
// owns centralized keys/billing/observability.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import type { Hypha } from '../types.ts';
import { flag } from '../types.ts';
import type { StoryBeat } from '../../operator/narrative/narrative.ts';

interface MulticaConfig { server_url: string; workspace_id: string; token: string }

function config(): MulticaConfig | null {
  try {
    return JSON.parse(readFileSync(join(homedir(), '.multica', 'config.json'), 'utf8'));
  } catch { return null; }
}

async function api(resource: string, params = '', init?: RequestInit): Promise<any> {
  const cfg = config();
  if (!cfg) throw new Error('no ~/.multica/config.json');
  const base = cfg.server_url.replace(/\/+$/, '');
  const { headers: initHeaders, ...restInit } = init ?? {};
  const res = await fetch(`${base}/api/${resource}?workspace_id=${cfg.workspace_id}${params}`, {
    headers: { Authorization: `Bearer ${cfg.token}`, ...initHeaders },
    signal: AbortSignal.timeout(10000),
    ...restInit,
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

/** Agent roster count — for Phase Q quest evidence. */
export async function multicaAgentCount(): Promise<number> {
  const agents = asList(await api('agents'), 'agents');
  return agents.length;
}

/** Completed issues count — for Phase Q quest evidence. */
export async function multicaIssuesDone(): Promise<number> {
  const issues = asList(await api('issues', '&limit=50'), 'issues');
  return issues.filter((i: any) => i.status === 'done').length;
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

/**
 * Read-only command data for the miniapp Commands panel (status / agents / work).
 * One pass over issues + agents — REAL records only. Handoffs come from openItems
 * (gathered separately by the push). Fail-soft: caller try/catch drops the block.
 */
export async function multicaCommandsData(arcs: string): Promise<{
  status: { agents: number; issuesDone: number; issuesOpen: number; arcs: string };
  agents: Array<{ name: string; model: string }>;
  work: Array<{ id: string; title: string; status: string; who: string }>;
}> {
  const [issuesRaw, agentsRaw] = await Promise.all([api('issues', '&limit=50'), api('agents')]);
  const issues = asList(issuesRaw, 'issues');
  const agents = asList(agentsRaw, 'agents');
  const nameOf = new Map(agents.map((a: any) => [a.id, a.name]));
  const done = issues.filter((i: any) => i.status === 'done').length;
  return {
    status: { agents: agents.length, issuesDone: done, issuesOpen: issues.length - done, arcs },
    agents: agents.map((a: any) => ({ name: a.name ?? a.id, model: a.model ?? '' })),
    work: issues
      .sort((a: any, b: any) => Date.parse(b.updated_at ?? b.created_at ?? 0) - Date.parse(a.updated_at ?? a.created_at ?? 0))
      .slice(0, 12)
      .map((i: any) => ({
        id: i.identifier,
        title: i.title,
        status: i.status,
        who: i.assignee_type === 'agent' ? (nameOf.get(i.assignee_id) ?? 'an agent') : 'a founder',
      })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Phase G · token-factory wiring (Nebius preferred, NVIDIA fallback)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

interface TokenModel { id: string; name?: string; provider: string }

function stripJsonComments(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === '"') break;
        j++;
      }
      out += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function readOpenCodeConfigModels(): TokenModel[] {
  const cfgDir = join(homedir(), '.config', 'opencode');
  const candidates = [
    join(cfgDir, 'opencode.json'),
    join(cfgDir, 'opencode.jsonc'),
    join(cfgDir, 'opencode.json.cli-backup'),
  ];
  const all: TokenModel[] = [];
  for (const path of candidates) {
    let parsed: any;
    try {
      const raw = readFileSync(path, 'utf8');
      parsed = JSON.parse(stripJsonComments(raw));
    } catch { continue; }
    const providers = parsed?.provider ?? {};
    for (const [providerName, provider] of Object.entries(providers)) {
      const models = (provider as any)?.models;
      if (!models || typeof models !== 'object') continue;
      for (const [id, meta] of Object.entries(models)) {
        const m = meta as any;
        all.push({ id, name: m?.name ?? id, provider: providerName });
      }
    }
  }
  return all;
}

function readOpenCodeCliModels(provider: string): TokenModel[] {
  try {
    const binary = join(homedir(), '.opencode', 'bin', 'opencode');
    const out = execSync(`"${binary}" models ${provider}`, { encoding: 'utf8', timeout: 15000, stdio: ['pipe', 'pipe', 'ignore'] });
    const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.map((id) => {
      const parts = id.split('/');
      const name = parts.slice(1).join('/') || id;
      return { id, name, provider };
    });
  } catch {
    return [];
  }
}

function readOpenCodeModels(provider?: string): TokenModel[] {
  const fromCli = provider ? readOpenCodeCliModels(provider) : [];
  if (fromCli.length > 0) return fromCli;
  const fromConfig = readOpenCodeConfigModels();
  if (provider) return fromConfig.filter((m) => m.provider === provider);
  return fromConfig;
}

/** Role-aware mapping from agent name → preferred model id in the token factory. */
const ROLE_MODELS_NEBIUS: Record<string, string> = {
  CEO: 'nebius/zai-org/GLM-5',
  Scientist: 'nebius/moonshotai/Kimi-K2.5',
  Engineer: 'nebius/Qwen/Qwen3-235B-A22B-Thinking-2507-fast',
  Designer: 'nebius/zai-org/GLM-5',
  Synthesist: 'nebius/moonshotai/Kimi-K2.5',
  Hermes: 'nebius/moonshotai/Kimi-K2.5-fast',
};

const ROLE_MODELS_NVIDIA: Record<string, string> = {
  CEO: 'deepseek-ai/deepseek-v4-pro',
  Scientist: 'moonshotai/kimi-k2-thinking',
  Engineer: 'qwen/qwen3-coder-480b-a35b-instruct',
  Designer: 'mistralai/mistral-large-3-675b-instruct-2512',
  Synthesist: 'moonshotai/kimi-k2.6',
  Hermes: 'openai/gpt-oss-20b',
};

function pickModel(name: string, available: TokenModel[], fallbackToNvidia = false): TokenModel {
  const preferred = ROLE_MODELS_NEBIUS[name] ?? (fallbackToNvidia ? ROLE_MODELS_NVIDIA[name] : undefined);
  if (preferred) {
    const exact = available.find((m) => m.id === preferred);
    if (exact) return exact;
  }
  if (fallbackToNvidia) {
    const nvidiaPreferred = ROLE_MODELS_NVIDIA[name];
    if (nvidiaPreferred) {
      const exact = available.find((m) => m.id === nvidiaPreferred);
      if (exact) return exact;
    }
  }
  const byName = available.find((m) => m.name?.toLowerCase().includes(name.toLowerCase()));
  if (byName) return byName;
  const general = available.find((m) => m.id.includes('llama-3.3-70b')) ?? available[0];
  return general;
}

export interface WiredAgent { id: string; name: string; model: string; modelName: string; provider: string; updated: boolean }

export async function wireAgentModels(opts: { dryRun?: boolean; provider?: string; fallback?: boolean } = {}): Promise<{ factory: string; associations: WiredAgent[] }> {
  const provider = opts.provider ?? 'nebius';
  const models = readOpenCodeModels(provider);
  if (models.length === 0) {
    // If nebius empty and fallback allowed, try NVIDIA from config
    if (opts.fallback !== false) {
      const nvModels = readOpenCodeModels('nvidia');
      if (nvModels.length > 0) {
        return wireAgentModels({ ...opts, provider: 'nvidia', fallback: false });
      }
    }
    throw new Error(`no models found for provider "${provider}"`);
  }
  const factory = [...new Set(models.map((m) => m.provider))].sort().join(' · ');
  const agents = asList(await api('agents'), 'agents');
  const associations: WiredAgent[] = [];
  for (const a of agents) {
    const choice = pickModel(a.name, models, opts.fallback !== false);
    const before: string = a.model ?? '';
    const changed = before !== choice.id;
    let updated = false;
    if (!opts.dryRun && changed) {
      await api(`agents/${a.id}`, '', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: choice.id }),
      });
      updated = true;
    }
    associations.push({
      id: a.id,
      name: a.name,
      model: choice.id,
      modelName: choice.name ?? choice.id,
      provider: choice.provider,
      updated: opts.dryRun ? false : updated,
    });
  }
  return { factory, associations };
}

export const multica: Hypha = {
  name: 'multica',
  describe: 'the org gateway — agents · issues · activity from MultiCA (Phase R read + Phase G model wiring)',
  help: 'quine multica [agents|issues|activity|models] [--limit n]   ·   quine write multica wire-models [--dry-run] [--provider nebius|nvidia]',

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
      return { hypha: 'multica', agents: agents.map((a: any) => ({ name: a.name, description: (a.description ?? '').slice(0, 70), model: a.model ?? '' })) };
    }
    if (what === 'issues') {
      const issues = asList(await api('issues', `&limit=${limit}`), 'issues');
      return { hypha: 'multica', issues: issues.map((i: any) => ({ id: i.identifier, title: i.title, status: i.status })) };
    }
    if (what === 'models') {
      const provider = flag(args, '--provider', 'nebius');
      const models = readOpenCodeModels(provider);
      return { hypha: 'multica', provider, models };
    }
    const beats = await multicaActivityBeats(limit);
    return { hypha: 'multica', activity: beats.map((b) => b.text) };
  },

  async write(args) {
    const what = args.find((a) => !a.startsWith('--')) ?? '';
    if (what === 'wire-models') {
      const dryRun = args.includes('--dry-run');
      const provider = flag(args, '--provider', 'nebius');
      const result = await wireAgentModels({ dryRun, provider });
      return { hypha: 'multica', op: 'wire-models', dryRun, provider, ...result };
    }
    throw new Error(`unknown multica write command: ${what}. Try: wire-models [--dry-run] [--provider nebius|nvidia]`);
  },
};
