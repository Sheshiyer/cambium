// Quine hypha · paperclip — the live Thoughtseed org plane.
// Paperclip is the local company/team management runtime: agents, issues,
// approvals, and activity. Cambium reads it into the quest miniapp instead of
// the retired TeamForge/MultiCA lanes. Default target is the private local
// Paperclip core at 127.0.0.1:3100; no secrets are printed.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Hypha } from '../types.ts';
import { flag } from '../types.ts';
import type { QuestInputs } from '../../operator/quests/quests.ts';
import type { StoryBeat } from '../../operator/narrative/narrative.ts';

interface PaperclipCompany {
  id: string;
  name: string;
  status: string;
  issuePrefix?: string;
  issueCounter?: number;
}

interface PaperclipAgent {
  id: string;
  name: string;
  role?: string;
  status?: string;
  model?: string | null;
}

export interface PaperclipIssue {
  id: string;
  identifier?: string;
  title: string;
  status: string;
  assigneeAgentId?: string | null;
  updatedAt?: string;
  createdAt?: string;
}

interface PaperclipApproval {
  id: string;
  title?: string;
  status: string;
}

interface PaperclipSnapshot {
  company: PaperclipCompany;
  agents: PaperclipAgent[];
  issues: PaperclipIssue[];
  approvals: PaperclipApproval[];
}

interface HermesService {
  name: string;
  label: string;
  status: 'running' | 'ok' | 'failed' | 'missing';
  detail: string;
}

export interface PaperclipOpenItem {
  id: string;
  title: string;
  status: string;
  owner: string;
  updatedAt: string;
  evidence: string;
  consequence: string;
  approveConsequence: string;
  rerollConsequence: string;
  reversibility: string;
  idempotencyHint: string;
  priority: {
    source: 'paperclip-priority@v1';
    risk: 'low' | 'medium' | 'high' | 'critical';
    dependency: 'none' | 'blocks-delivery' | 'blocked-by-external';
    score: number;
    reasons: string[];
  };
}

const doneStatuses = new Set(['done', 'completed', 'succeeded']);
const closedStatuses = new Set([...doneStatuses, 'cancelled', 'canceled', 'archived']);
const paperclipRoot =
  process.env.PAPERCLIP_ROOT ||
  join(homedir(), 'Projects', 'thoughtseed-paperclip');
const archiveNotes = [
  join(paperclipRoot, 'tasks', '2026-06-21-tho-1-mathis-archive-note.md'),
];

const HERMES_SERVICES: Array<{ name: string; label: string }> = [
  { name: 'Telegram brain', label: 'ai.hermes.gateway' },
  { name: 'Quest refresh', label: 'ai.hermes.cambium-quests-refresh' },
  { name: 'Founder gate', label: 'ai.hermes.gate-consumer' },
  { name: 'Vault sync', label: 'ai.hermes.vault-sync' },
  { name: 'Forge Aura', label: 'ai.hermes.forge-aura' },
];

function apiBase(): string {
  return (process.env.PAPERCLIP_API_BASE || 'http://127.0.0.1:3100/api').replace(/\/+$/, '');
}

async function api(path: string): Promise<any> {
  const res = await fetch(`${apiBase()}${path}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`paperclip ${path} -> ${res.status}`);
  return res.json();
}

function asList(raw: any): any[] {
  return Array.isArray(raw) ? raw : raw?.data ?? raw?.items ?? [];
}

async function resolveCompany(): Promise<PaperclipCompany> {
  const companies = asList(await api('/companies')) as PaperclipCompany[];
  const requested = process.env.PAPERCLIP_COMPANY_ID || process.env.THOUGHTSEED_PAPERCLIP_COMPANY_ID || '';
  const found =
    (requested && companies.find((c) => c.id === requested)) ||
    companies.find((c) => c.issuePrefix === 'THO') ||
    companies.find((c) => /thoughtseed/i.test(c.name));
  if (!found) throw new Error('Thoughtseed Labs company not found in Paperclip');
  return found;
}

async function snapshot(limit = 50): Promise<PaperclipSnapshot> {
  const company = await resolveCompany();
  const [agentsRaw, issuesRaw, approvalsRaw] = await Promise.all([
    api(`/companies/${company.id}/agents`),
    api(`/companies/${company.id}/issues`),
    api(`/companies/${company.id}/approvals`).catch(() => []),
  ]);
  return {
    company,
    agents: asList(agentsRaw) as PaperclipAgent[],
    issues: (asList(issuesRaw) as PaperclipIssue[]).slice(0, limit),
    approvals: asList(approvalsRaw) as PaperclipApproval[],
  };
}

function issueId(issue: PaperclipIssue): string {
  return issue.identifier || issue.id;
}

function issueTime(issue: PaperclipIssue): number {
  return Date.parse(issue.updatedAt ?? issue.createdAt ?? '') || 0;
}

function paperclipPriorityForIssue(issue: PaperclipIssue): PaperclipOpenItem['priority'] {
  const status = String(issue.status ?? '').toLowerCase();
  const title = String(issue.title ?? '').toLowerCase();
  const text = `${status} ${title}`;
  const reasons: string[] = [];
  let risk: PaperclipOpenItem['priority']['risk'] = 'low';
  if (/(blocked|stuck|failed|outage|critical|urgent)/.test(text)) {
    risk = 'critical';
    reasons.push('status/title indicates blocked or critical risk');
  } else if (/(launch|deploy|ship|gate|approval|sign.?off|payment|deposit|contract|production|client)/.test(text)) {
    risk = 'high';
    reasons.push('title touches launch, approval, revenue, or client risk');
  } else if (/(review|handoff|proof|spec|copy|follow.?up)/.test(text)) {
    risk = 'medium';
    reasons.push('title needs review, proof, spec, copy, or handoff attention');
  } else {
    reasons.push('no high-risk keywords served');
  }

  let dependency: PaperclipOpenItem['priority']['dependency'] = 'none';
  if (/(launch|deploy|ship|gate|approval|handoff|sign.?off|blocks?|unblocks?)/.test(text)) {
    dependency = 'blocks-delivery';
    reasons.push('item can block delivery or founder handoff');
  } else if (/(waiting|blocked.?by|depends? on|dependency)/.test(text)) {
    dependency = 'blocked-by-external';
    reasons.push('item is waiting on an external dependency');
  } else {
    reasons.push('no dependency keyword served');
  }

  const riskScore = { low: 1, medium: 2, high: 3, critical: 4 }[risk];
  const dependencyScore = { none: 0, 'blocked-by-external': 1, 'blocks-delivery': 2 }[dependency];
  return {
    source: 'paperclip-priority@v1',
    risk,
    dependency,
    score: dependencyScore * 10 + riskScore,
    reasons,
  };
}

export function paperclipOpenItemForIssue(
  issue: PaperclipIssue,
  nameOf = new Map<string, string>(),
): PaperclipOpenItem {
  const id = issueId(issue);
  const status = String(issue.status ?? 'unknown');
  const owner = issue.assigneeAgentId ? (nameOf.get(issue.assigneeAgentId) ?? 'Paperclip') : 'Paperclip';
  const time = issue.updatedAt ?? issue.createdAt ?? 'undated';
  return {
    id,
    title: issue.title,
    status,
    owner,
    updatedAt: time,
    evidence: `${id} is ${status} · owner ${owner} · updated ${time}`,
    consequence: `founder decision changes Paperclip handling for ${id}`,
    approveConsequence: `approve ${id} for Paperclip execution`,
    rerollConsequence: `reroll ${id} and request revision before execution`,
    reversibility: 'queued action can be superseded until consumed; reroll keeps the item open',
    idempotencyHint: `${id}:${status}:${time}`,
    priority: paperclipPriorityForIssue(issue),
  };
}

function launchdDomain(): string {
  const uid = typeof process.getuid === 'function' ? process.getuid() : Number(process.env.UID ?? 501);
  return `gui/${uid}`;
}

export function hermesServiceStatuses(): HermesService[] {
  return HERMES_SERVICES.map((service) => {
    try {
      const out = execFileSync('/bin/launchctl', ['print', `${launchdDomain()}/${service.label}`], {
        encoding: 'utf8',
        timeout: 2000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const state = out.match(/state = ([^\n]+)/)?.[1]?.trim() ?? 'unknown';
      const pid = out.match(/pid = ([0-9]+)/)?.[1]?.trim();
      const lastExit = out.match(/last exit code = ([^\n]+)/)?.[1]?.trim();
      const running = state === 'running' || Boolean(pid);
      const healthy = running || lastExit === '0' || lastExit === '(never exited)';
      const detail = [
        `state ${state}`,
        pid ? `pid ${pid}` : '',
        lastExit ? `last exit ${lastExit}` : '',
      ].filter(Boolean).join(' · ');
      return { ...service, status: running ? 'running' : healthy ? 'ok' : 'failed', detail };
    } catch (err) {
      const e = err as { stderr?: Buffer; message?: string };
      const detail = e.stderr?.toString('utf8').trim() || e.message || 'launchd status unavailable';
      return { ...service, status: 'missing', detail };
    }
  });
}

function doneCount(issues: PaperclipIssue[]): number {
  return activePaperclipIssues(issues).filter((issue) => doneStatuses.has(String(issue.status ?? '').toLowerCase())).length;
}

function openIssues(issues: PaperclipIssue[]): PaperclipIssue[] {
  return activePaperclipIssues(issues).filter((issue) => !closedStatuses.has(String(issue.status ?? '').toLowerCase()));
}

export function archivedPaperclipIssueIds(): Set<string> {
  const ids = new Set<string>();
  for (const notePath of archiveNotes) {
    if (!existsSync(notePath)) continue;
    const note = readFileSync(notePath, 'utf-8');
    if (/THO-1/i.test(note) && /archived\/audit-only/i.test(note)) ids.add('THO-1');
  }
  return ids;
}

export function activePaperclipIssues(
  issues: PaperclipIssue[],
  archived = archivedPaperclipIssueIds()
): PaperclipIssue[] {
  return issues.filter((issue) => !archived.has(issueId(issue)));
}

export async function paperclipQuestInputs(): Promise<QuestInputs['paperclip']> {
  try {
    const s = await snapshot();
    const agentErrors = s.agents.filter((agent) => String(agent.status ?? '').toLowerCase() === 'error').length;
    return {
      reachable: true,
      agents: s.agents.length,
      issuesDone: doneCount(s.issues),
      issuesOpen: openIssues(s.issues).length,
      agentErrors,
      pendingApprovals: s.approvals.filter((approval) => String(approval.status ?? '').toLowerCase() === 'pending').length,
    };
  } catch {
    return { reachable: false, agents: 0, issuesDone: 0, issuesOpen: 0, agentErrors: 0, pendingApprovals: 0 };
  }
}

export async function paperclipOpenItems(limit = 12): Promise<PaperclipOpenItem[]> {
  const s = await snapshot();
  const nameOf = new Map(s.agents.map((agent) => [agent.id, agent.name]));
  return openIssues(s.issues)
    .sort((a, b) => issueTime(b) - issueTime(a))
    .slice(0, limit)
    .map((issue) => paperclipOpenItemForIssue(issue, nameOf));
}

export async function paperclipActivityBeats(limit = 8): Promise<StoryBeat[]> {
  const s = await snapshot();
  const nameOf = new Map(s.agents.map((agent) => [agent.id, agent.name]));
  return s.issues
    .filter((issue) => activePaperclipIssues([issue]).length > 0)
    .filter((issue) => issue.updatedAt || issue.createdAt)
    .sort((a, b) => issueTime(a) - issueTime(b))
    .slice(-limit)
    .map((issue): StoryBeat => {
      const who = issue.assigneeAgentId ? (nameOf.get(issue.assigneeAgentId) ?? 'Paperclip') : 'Paperclip';
      const status = String(issue.status ?? '').toLowerCase();
      const verb = doneStatuses.has(status) ? 'completed' : status === 'blocked' ? 'is blocked on' : 'is carrying';
      return {
        n: null,
        text: `${who} ${verb}: ${issue.title} (${issueId(issue)}).`,
        lane: 'paperclip',
        noesis: status === 'blocked',
        source: 'paperclip',
        raw: `${issueId(issue)} ${issue.status}`,
      };
    });
}

export async function paperclipCommandsData(arcs: string): Promise<{
  status: { agents: number; issuesDone: number; issuesOpen: number; arcs: string; hermes: string };
  agents: Array<{ name: string; model: string }>;
  work: Array<{ id: string; title: string; status: string; who: string }>;
  services: HermesService[];
}> {
  const s = await snapshot();
  const nameOf = new Map(s.agents.map((agent) => [agent.id, agent.name]));
  const activeIssues = activePaperclipIssues(s.issues);
  const done = doneCount(activeIssues);
  const services = hermesServiceStatuses();
  const hermesRunning = services.filter((service) => service.status === 'running' || service.status === 'ok').length;
  return {
    status: { agents: s.agents.length, issuesDone: done, issuesOpen: openIssues(activeIssues).length, arcs, hermes: `${hermesRunning}/${services.length}` },
    agents: s.agents.map((agent) => ({ name: agent.name ?? agent.id, model: agent.model || agent.status || '' })),
    work: activeIssues
      .sort((a, b) => issueTime(b) - issueTime(a))
      .slice(0, 12)
      .map((issue) => ({
        id: issueId(issue),
        title: issue.title,
        status: issue.status,
        who: issue.assigneeAgentId ? (nameOf.get(issue.assigneeAgentId) ?? 'Paperclip') : 'Paperclip',
      })),
    services,
  };
}

export const paperclip: Hypha = {
  name: 'paperclip',
  describe: 'the live Thoughtseed Paperclip org — agents · issues · approvals · activity',
  help: 'quine paperclip [status|agents|issues|activity] [--limit n]   (PAPERCLIP_API_BASE optional)',

  async status() {
    try {
      const health = await api('/health');
      const company = await resolveCompany();
      return { name: 'paperclip', reachable: true, detail: `${company.name} (${company.issuePrefix}) · ${health.status}` };
    } catch (e) {
      return { name: 'paperclip', reachable: false, detail: (e as Error).message };
    }
  },

  async read(args) {
    const what = args.find((a) => !a.startsWith('--')) ?? 'status';
    const limit = Number(flag(args, '--limit', '8'));
    const s = await snapshot(Math.max(limit, 50));
    if (what === 'agents') {
      return { hypha: 'paperclip', company: s.company.name, agents: s.agents.map((a) => ({ name: a.name, role: a.role, status: a.status })) };
    }
    if (what === 'issues') {
      return { hypha: 'paperclip', company: s.company.name, issues: s.issues.slice(0, limit).map((i) => ({ id: issueId(i), title: i.title, status: i.status })) };
    }
    if (what === 'activity') {
      return { hypha: 'paperclip', company: s.company.name, beats: await paperclipActivityBeats(limit) };
    }
    const activeIssues = activePaperclipIssues(s.issues);
    const open = openIssues(activeIssues);
    return {
      hypha: 'paperclip',
      company: { id: s.company.id, name: s.company.name, prefix: s.company.issuePrefix, status: s.company.status },
      agents: s.agents.length,
      issues: { total: activeIssues.length, open: open.length, done: doneCount(activeIssues) },
      approvals: { total: s.approvals.length, pending: s.approvals.filter((a) => a.status === 'pending').length },
    };
  },
};
