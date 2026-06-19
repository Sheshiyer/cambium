// Quine hypha · project-evidence — derives the project arcs' contract input
// (`${tenant}.project.json`) from live signals gathered across the other hyphae.
// Pure assembly here; I/O sits in `gatherProjectSignals` below. The shape MUST
// match QuestInputs.project at ../../operator/quests/quests.ts.
//
// House invariant: NO FAKE PROGRESS. A signal that is missing is read as the
// honest "not done" state, never invented. A gather error degrades to empty
// signals — the arc shows `unreachable`, never `complete`.

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { QuineCtx } from '../types.ts';

export interface ProjectSignals {
  vault?: {
    briefStatus?: 'draft' | 'accepted' | 'rejected';
    contractFound?: boolean;
    depositRecorded?: boolean;
    specFound?: boolean;
    signOffRecorded?: boolean;
  };
  repo?: { exists: boolean; commitsOnMain: number };
  tenant?: { worldExists: boolean };
  reviews?: { count: number };
  gate?: { approvals: number };
  deploys?: { count: number };
  skills?: { lessonsMinted: number; archived: boolean };
}

export interface ProjectEvidence {
  briefStatus: 'draft' | 'accepted' | 'rejected';
  contractExists: boolean;
  depositReceived: boolean;
  repoExists: boolean;
  tenantProvisioned: boolean;
  specsFrozen: boolean;
  buildCommits: number;
  reviewEvents: number;
  gateApprovals: number;
  deployEvents: number;
  clientSignOff: boolean;
  lessonsMinted: number;
  projectArchived: boolean;
  source: string;
  updatedAt: string;
}

export function assembleProjectEvidence(s: ProjectSignals, nowIso?: string): ProjectEvidence {
  return {
    briefStatus: s.vault?.briefStatus ?? 'draft',
    contractExists: s.vault?.contractFound ?? false,
    depositReceived: s.vault?.depositRecorded ?? false,
    repoExists: s.repo?.exists ?? false,
    tenantProvisioned: s.tenant?.worldExists ?? false,
    specsFrozen: s.vault?.specFound ?? false,
    buildCommits: s.repo?.commitsOnMain ?? 0,
    reviewEvents: s.reviews?.count ?? 0,
    gateApprovals: s.gate?.approvals ?? 0,
    deployEvents: s.deploys?.count ?? 0,
    clientSignOff: s.vault?.signOffRecorded ?? false,
    lessonsMinted: s.skills?.lessonsMinted ?? 0,
    projectArchived: s.skills?.archived ?? false,
    source: 'project-evidence@v1',
    updatedAt: nowIso ?? new Date().toISOString(),
  };
}

// ───────────────────────────────────────────────────────────────────────
// I/O layer — gathers signals from existing hyphae. Each block try/catch'd.
// ───────────────────────────────────────────────────────────────────────

/** Vault project root convention (see PHASE-Q-BRIDGE.md). */
const VAULT_PROJECT_ROOTS = [
  '/Volumes/madara/2026/twc-vault/60-client-ecosystem',
];

function readVaultSignals(tenant: string): ProjectSignals['vault'] {
  for (const root of VAULT_PROJECT_ROOTS) {
    for (const name of [tenant, `${tenant}-portal-reskin`]) {
      const dir = join(root, name);
      if (!existsSync(dir)) continue;
      const has = (rel: string): boolean => existsSync(join(dir, rel));
      return {
        briefStatus: has('proposal.md') || has('brief.md') ? 'accepted' : 'draft',
        contractFound: has('contract.md') || has('agreement.md'),
        depositRecorded: has('deposit-received.flag') || has('payments/deposit.json'),
        specFound: has('tech-spec.md') || has('spec.md'),
        signOffRecorded: has('signoff.md') || has('handoff.md'),
      };
    }
  }
  return undefined;
}

function git(ctxRoot: string, args: string[]): string | undefined {
  try {
    return execFileSync('git', ['-C', ctxRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return undefined; }
}

function readRepoSignals(ctx: QuineCtx): ProjectSignals['repo'] {
  const insideWorktree = git(ctx.root, ['rev-parse', '--is-inside-work-tree']);
  if (insideWorktree !== 'true') return { exists: false, commitsOnMain: 0 };

  const defaultBranch =
    git(ctx.root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])
      ?.replace(/^origin\//, '') ||
    git(ctx.root, ['branch', '--show-current']) ||
    'main';
  const candidateRefs = [`origin/${defaultBranch}`, defaultBranch, 'origin/main', 'main'];
  const ref = candidateRefs.find((r) => git(ctx.root, ['rev-parse', '--verify', r]));
  if (!ref) return { exists: true, commitsOnMain: 0 };

  const count = Number(git(ctx.root, ['rev-list', '--count', ref]) ?? 0);
  return { exists: true, commitsOnMain: Number.isFinite(count) ? count : 0 };
}

function readTenantSignals(ctx: QuineCtx, tenant: string): ProjectSignals['tenant'] {
  return { worldExists: existsSync(join(ctx.root, '.operator', `${tenant}.world.json`)) };
}

function readReviewSignals(ctx: QuineCtx, tenant: string): ProjectSignals['reviews'] {
  // Tenant-scoped only — the root deviations.jsonl is cross-tenant noise and
  // would bleed into per-tenant evidence (e.g. inflate arc XIII before any
  // tenant build has begun). Honest zero when the tenant has no review log.
  try {
    const path = join(ctx.root, 'cortex', tenant, 'deviations.jsonl');
    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
    return { count: lines.length };
  } catch { return { count: 0 }; }
}

const QUESTS_PUSH_URL_DEFAULT = 'https://curious.thoughtseed.space';

function questsPushToken(): string | undefined {
  if (process.env.QUESTS_PUSH_TOKEN) return process.env.QUESTS_PUSH_TOKEN;
  try {
    const txt = readFileSync(join(process.env.HOME ?? '', '.claude', '.env'), 'utf8');
    const line = txt.split('\n').find((l) => l.startsWith('QUESTS_PUSH_TOKEN='));
    return line?.slice('QUESTS_PUSH_TOKEN='.length).replace(/^["']|["']$/g, '').trim() || undefined;
  } catch { return undefined; }
}

function readGateSignals(tenant: string): ProjectSignals['gate'] {
  const token = questsPushToken();
  if (!token) return { approvals: 0 };

  try {
    const base = (process.env.QUESTS_PUSH_URL || QUESTS_PUSH_URL_DEFAULT).replace(/\/+$/, '');
    const stdout = execFileSync('curl', ['-fsS', '-H', `Authorization: Bearer ${token}`, `${base}/internal/gate/${tenant}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const json = JSON.parse(stdout);
    const actions = Array.isArray(json?.actions) ? json.actions : [];
    return { approvals: actions.filter((a: any) => a?.status === 'queued' && a?.kind === 'approve').length };
  } catch { return { approvals: 0 }; }
}

function stripJsonComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function readWorkerScriptName(ctx: QuineCtx): string | undefined {
  if (process.env.CAMBIUM_DEPLOY_SCRIPT) return process.env.CAMBIUM_DEPLOY_SCRIPT;
  if (process.env.CLOUDFLARE_WORKER_SCRIPT) return process.env.CLOUDFLARE_WORKER_SCRIPT;
  try {
    const config = JSON.parse(stripJsonComments(readFileSync(join(ctx.root, 'workers', 'quests', 'wrangler.jsonc'), 'utf8')));
    return typeof config.name === 'string' && config.name ? config.name : undefined;
  } catch { return undefined; }
}

function readDeploySignals(ctx: QuineCtx): ProjectSignals['deploys'] {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '9d9d23b27f32e70ae3afb6a1aa2c0f10';
  const scriptName = readWorkerScriptName(ctx);
  if (!apiToken || !accountId || !scriptName) return { count: 0 };

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${encodeURIComponent(scriptName)}/deployments`;
    const stdout = execFileSync('curl', ['-fsS', '-H', `Authorization: Bearer ${apiToken}`, '-H', 'Content-Type: application/json', url], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const json = JSON.parse(stdout);
    const deployments = Array.isArray(json?.result)
      ? json.result
      : Array.isArray(json?.result?.deployments)
        ? json.result.deployments
        : [];
    return { count: deployments.length };
  } catch { return { count: 0 }; }
}

function readSkillSignals(ctx: QuineCtx, tenant: string): ProjectSignals['skills'] {
  let lessonsMinted = 0;
  let archived = false;
  try {
    const path = join(ctx.root, '.operator', `${tenant}.skills.json`);
    const data = JSON.parse(readFileSync(path, 'utf8'));
    lessonsMinted = Array.isArray(data) ? data.length : Array.isArray(data.lessons) ? data.lessons.length : 0;
    archived = data.archived === true;
  } catch { /* no skill registry yet */ }
  try {
    const path = join(ctx.root, '.operator', `${tenant}.skills.archive.json`);
    const data = JSON.parse(readFileSync(path, 'utf8'));
    archived ||= Array.isArray(data.archives) && data.archives.some((a: any) => a?.archived === true);
  } catch { /* no archive receipt yet */ }
  return { lessonsMinted, archived };
}

export function gatherProjectSignals(ctx: QuineCtx, tenant: string): ProjectSignals {
  return {
    vault: readVaultSignals(tenant),
    repo: readRepoSignals(ctx),
    tenant: readTenantSignals(ctx, tenant),
    reviews: readReviewSignals(ctx, tenant),
    gate: readGateSignals(tenant),
    deploys: readDeploySignals(ctx),
    skills: readSkillSignals(ctx, tenant),
  };
}

/** Write `.operator/${tenant}.project.json` from fresh signals. Atomic via temp+rename. */
export function refreshProjectEvidence(ctx: QuineCtx, tenant: string): ProjectEvidence {
  const signals = gatherProjectSignals(ctx, tenant);
  const evidence = assembleProjectEvidence(signals);
  const dir = join(ctx.root, '.operator');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${tenant}.project.json`);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(evidence, null, 2) + '\n');
  renameSync(tmp, path);
  return evidence;
}
