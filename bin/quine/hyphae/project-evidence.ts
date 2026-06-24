// Quine hypha · project-evidence — derives the project arcs' contract input
// (`${tenant}.project.json`) from live signals gathered across the other hyphae.
// Pure assembly here; I/O sits in `gatherProjectSignals` below. The shape MUST
// match QuestInputs.project at ../../operator/quests/quests.ts.
//
// House invariant: NO FAKE PROGRESS. A signal that is missing is read as the
// honest "not done" state, never invented. A gather error degrades to empty
// signals — the arc shows `unreachable`, never `complete`.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { QuineCtx } from '../types.ts';

export interface ProjectSignals {
  vault?: {
    briefStatus?: 'draft' | 'accepted' | 'rejected';
    contractFound?: boolean;
    depositRecorded?: boolean;
    specFound?: boolean;
    signOffRecorded?: boolean;
    projectArchived?: boolean;
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
    projectArchived: s.skills?.archived === true || s.vault?.projectArchived === true,
    source: 'project-evidence@v1',
    updatedAt: nowIso ?? new Date().toISOString(),
  };
}

// ───────────────────────────────────────────────────────────────────────
// I/O layer — gathers signals from existing hyphae. Each block try/catch'd.
// ───────────────────────────────────────────────────────────────────────

/** Vault project root convention (see PHASE-Q-BRIDGE.md). */
const VAULT_PROJECT_ROOTS = (process.env.CAMBIUM_VAULT_PROJECT_ROOTS || join(homedir(), 'client-ecosystem'))
  .split(':')
  .map((root) => root.trim())
  .filter(Boolean);

const TENANT_REPO_ROOTS: Record<string, string[]> = {
  cambium: [],
};

const CAMBIUM_SPEC_PROOFS = [
  'cortex/cambium/contracts/acceptance_checks.json',
  'cortex/cambium/contracts/interaction_plan.json',
  'docs/plans/assets/cambium-r3f-implementation/shared-contract-packet.md',
  'docs/plans/assets/cambium-r3f-implementation/validation-gate.md',
];

const CAMBIUM_REVIEW_PROOF_DIRS = [
  'docs/plans/assets/cambium-r3f-implementation',
  'docs/plans/assets/cambium-r3f-game-engine-realignment',
];

const CAMBIUM_GATE_PROOFS = [
  'docs/plans/assets/cambium-r3f-game-engine-realignment/art-pass-02-verification.md',
];

function countExisting(ctx: QuineCtx, rels: string[]): number {
  return rels.filter((rel) => existsSync(join(ctx.root, rel))).length;
}

function countNamedFiles(dir: string, pattern: RegExp): number {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile() && pattern.test(entry.name)).length;
  } catch { return 0; }
}

function countJsonl(path: string): number {
  try {
    return readFileSync(path, 'utf8').split('\n').filter(Boolean).length;
  } catch { return 0; }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function vaultProjectRoots(ctx: QuineCtx): string[] {
  return unique([
    ctx.vaultRoot ? join(ctx.vaultRoot, '60-client-ecosystem') : '',
    ...VAULT_PROJECT_ROOTS,
  ].filter(Boolean));
}

function projectDirs(ctx: QuineCtx, tenant: string): string[] {
  return vaultProjectRoots(ctx).flatMap((root) => [join(root, tenant), join(root, `${tenant}-portal-reskin`)]);
}

function firstProjectDir(ctx: QuineCtx, tenant: string): string | undefined {
  return projectDirs(ctx, tenant).find((dir) => existsSync(dir));
}

function readVaultSignals(ctx: QuineCtx, tenant: string): ProjectSignals['vault'] {
  const dir = firstProjectDir(ctx, tenant);
  if (dir) {
    const has = (rel: string): boolean => existsSync(join(dir, rel));
    return {
      briefStatus: has('proposal.md') || has('brief.md') ? 'accepted' : 'draft',
      contractFound: has('contract.md') || has('agreement.md'),
      depositRecorded: has('deposit-received.flag') || has('payments/deposit.json') || has('commitment.json'),
      specFound: has('tech-spec.md') || has('spec.md') || (tenant === 'cambium' && countExisting(ctx, CAMBIUM_SPEC_PROOFS) > 0),
      signOffRecorded: has('signoff.md') || has('handoff.md'),
      projectArchived: has('archive.md') || has('closeouts/archive.md'),
    };
  }
  if (tenant === 'cambium' && countExisting(ctx, CAMBIUM_SPEC_PROOFS) > 0) {
    return { briefStatus: 'draft', specFound: true };
  }
  return undefined;
}

function git(root: string, args: string[]): string | undefined {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim();
  } catch { return undefined; }
}

function gitCommitCount(root: string): number {
  for (const ref of ['origin/main', 'main', 'HEAD']) {
    const raw = git(root, ['rev-list', '--count', ref]);
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function candidateRepoRoots(ctx: QuineCtx, tenant: string): string[] {
  const fromTable = TENANT_REPO_ROOTS[tenant] ?? [];
  const localTenantRoot = tenant === 'cambium' ? [ctx.root] : [];
  const vaultRoots = projectDirs(ctx, tenant);
  return [...localTenantRoot, ...fromTable, ...vaultRoots];
}

function readRepoSignals(ctx: QuineCtx, tenant: string): ProjectSignals['repo'] {
  for (const root of candidateRepoRoots(ctx, tenant)) {
    if (git(root, ['rev-parse', '--is-inside-work-tree']) !== 'true') continue;
    return { exists: true, commitsOnMain: gitCommitCount(root) };
  }
  return { exists: false, commitsOnMain: 0 };
}

function readTenantSignals(ctx: QuineCtx, tenant: string): ProjectSignals['tenant'] {
  return { worldExists: existsSync(join(ctx.root, '.operator', `${tenant}.world.json`)) };
}

function readReviewSignals(ctx: QuineCtx, tenant: string): ProjectSignals['reviews'] {
  // Tenant-scoped only — the root deviations.jsonl is cross-tenant noise and
  // would bleed into per-tenant evidence (e.g. inflate arc XIII before any
  // tenant build has begun). Honest zero when the tenant has no review log.
  const tenantReviews = countJsonl(join(ctx.root, 'cortex', tenant, 'deviations.jsonl'));
  if (tenant !== 'cambium') return { count: tenantReviews };
  const proofReviews = CAMBIUM_REVIEW_PROOF_DIRS.reduce(
    (sum, rel) => sum + countNamedFiles(join(ctx.root, rel), /(?:verification|review).*\.md$/i),
    0,
  );
  return { count: tenantReviews + proofReviews };
}

function readGateSignals(ctx: QuineCtx, tenant: string): ProjectSignals['gate'] {
  let approvals = 0;
  if (tenant === 'cambium') {
    for (const rel of CAMBIUM_GATE_PROOFS) {
      try {
        const text = readFileSync(join(ctx.root, rel), 'utf8');
        if (/explicit approval|founder approval|approved/i.test(text)) approvals++;
      } catch { /* absent proof means no approval signal */ }
    }
  }
  try {
    const data = JSON.parse(readFileSync(join(ctx.root, '.operator', `${tenant}.skills.json`), 'utf8'));
    const skills = Array.isArray(data) ? data : Array.isArray(data.skills) ? data.skills : [];
    const scenarios = skills.flatMap((skill: any) => skill?.telemetry?.scenarios ?? []);
    approvals += scenarios.filter((scenario: any) =>
      scenario?.ok === true && /founder|approve|approval|gate/i.test(String(scenario.note ?? '')),
    ).length;
  } catch { /* no skill-forge telemetry yet */ }
  return { approvals };
}

function readDeploySignals(ctx: QuineCtx, tenant: string): ProjectSignals['deploys'] {
  const dir = firstProjectDir(ctx, tenant);
  if (!dir) return { count: 0 };
  return { count: countNamedFiles(join(dir, 'deploys'), /\.json$/i) };
}

function readSkillSignals(ctx: QuineCtx, tenant: string): ProjectSignals['skills'] {
  try {
    const path = join(ctx.root, '.operator', `${tenant}.skills.json`);
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (Array.isArray(data)) {
      const lessonRecords = data.filter((skill) => String(skill?.skill_id ?? '').startsWith('lesson-'));
      const validatedLegacySkills = data.filter((skill) => ['validated', 'production'].includes(String(skill?.status ?? '')));
      return {
        lessonsMinted: lessonRecords.length || validatedLegacySkills.length,
        archived: false,
      };
    }
    return {
      lessonsMinted: Array.isArray(data.lessons) ? data.lessons.length : 0,
      archived: data.archived === true,
    };
  } catch { return { lessonsMinted: 0, archived: false }; }
}

export function gatherProjectSignals(ctx: QuineCtx, tenant: string): ProjectSignals {
  return {
    vault: readVaultSignals(ctx, tenant),
    repo: readRepoSignals(ctx, tenant),
    tenant: readTenantSignals(ctx, tenant),
    reviews: readReviewSignals(ctx, tenant),
    gate: readGateSignals(ctx, tenant),
    deploys: readDeploySignals(ctx, tenant),
    skills: readSkillSignals(ctx, tenant),
  };
}

/** Write `.operator/${tenant}.project.json` from fresh signals. Atomic via temp+rename. */
export function refreshProjectEvidence(ctx: QuineCtx, tenant: string): ProjectEvidence {
  const signals = gatherProjectSignals(ctx, tenant);
  const evidence = assembleProjectEvidence(signals);
  const path = join(ctx.root, '.operator', `${tenant}.project.json`);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(evidence, null, 2) + '\n');
  renameSync(tmp, path);
  return evidence;
}
