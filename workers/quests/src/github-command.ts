export type GithubAgentCommandId =
  | 'github.repo.inspect'
  | 'github.issue.read'
  | 'github.issue.create'
  | 'github.issue.comment'
  | 'github.issue.label';

export interface GithubAgentCommandRequest {
  schema: 'hermes.github-agent-command.v1';
  skillId: 'github-repo-issue-ops';
  commandId: GithubAgentCommandId;
  source: 'telegram-manual';
  actorId: string;
  topicKey?: string;
  threadId?: number;
  sourceMessageId?: string;
  repo: string;
  issueNumber?: number;
  title?: string;
  body?: string;
  label?: string;
  dryRun?: boolean;
  // `approvalRequired` is a non-authoritative client intent flag: the caller must
  // acknowledge that a mutating verb is intended. It is NOT an authorization control —
  // the real authorization boundary is the admin BRIDGE_TOKEN gate on the route.
  // (The former `approvedBy`/`approvalReason` free-text fields were removed: they were
  // unvalidated and could be mistaken for a dual-control sign-off that was never enforced.)
  approvalRequired?: boolean;
  idempotencyKey: string;
}

export interface GithubCommandResult {
  ok: boolean;
  commandId: GithubAgentCommandId;
  repo: string;
  issueNumber?: number;
  dryRun: boolean;
  url?: string | null;
  status?: number;
  error?: string;
  result?: Record<string, unknown>;
}

export type GithubCommandExecutor = (command: GithubAgentCommandRequest) => Promise<GithubCommandResult>;

export interface GithubCommandExecutorOptions {
  token: string;
  allowedRepos?: string[];
  fetch?: typeof fetch;
}

// A repo segment must start and end with [A-Za-z0-9_-]; dots are allowed only internally.
// This rejects dot-only segments (".", "..") and leading/trailing-dot names (".x", "x."),
// which would otherwise smuggle path traversal into the GitHub API path (e.g. `owner/..`
// → `/repos/owner/../issues`).
const REPO_SEGMENT = '[A-Za-z0-9_-](?:[A-Za-z0-9_.-]*[A-Za-z0-9_-])?';
const REPO_RE = new RegExp(`^${REPO_SEGMENT}\\/${REPO_SEGMENT}$`);
const WRITE_COMMANDS = new Set<GithubAgentCommandId>([
  'github.issue.create',
  'github.issue.comment',
  'github.issue.label',
]);

export function isGithubWriteCommand(commandId: GithubAgentCommandId): boolean {
  return WRITE_COMMANDS.has(commandId);
}

export function parseAllowedRepos(raw: string | undefined): string[] {
  return (raw ?? 'Sheshiyer/*')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateGithubCommand(value: unknown, allowedRepos: string[] = ['Sheshiyer/*']): GithubAgentCommandRequest | { error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'GitHub command body must be an object' };
  const command = value as Partial<GithubAgentCommandRequest>;
  if (command.schema !== 'hermes.github-agent-command.v1') return { error: 'GitHub command schema mismatch' };
  if (command.skillId !== 'github-repo-issue-ops') return { error: 'GitHub command skill mismatch' };
  if (command.source !== 'telegram-manual') return { error: 'GitHub command source mismatch' };
  if (!command.commandId || !isGithubCommandId(command.commandId)) return { error: 'GitHub commandId unsupported' };
  if (!text(command.actorId)) return { error: 'GitHub command needs actorId' };
  if (!text(command.idempotencyKey)) return { error: 'GitHub command needs idempotencyKey' };
  const repo = text(command.repo);
  if (!REPO_RE.test(repo)) return { error: 'GitHub command repo must be owner/name' };
  if (!repoAllowed(repo, allowedRepos)) return { error: 'repo not allowlisted for GitHub agent command' };
  if (command.commandId.includes('.issue.') && command.commandId !== 'github.issue.create') {
    if (!Number.isInteger(command.issueNumber) || Number(command.issueNumber) < 1) return { error: 'GitHub issue command needs issueNumber' };
  }
  if (command.commandId === 'github.issue.create' && !text(command.title)) return { error: 'GitHub issue create needs title' };
  if ((command.commandId === 'github.issue.create' || command.commandId === 'github.issue.comment') && !text(command.body)) return { error: 'GitHub issue write needs body' };
  if (command.commandId === 'github.issue.label' && !text(command.label)) return { error: 'GitHub issue label needs label' };
  // Mutating verbs must carry the explicit intent flag. This is a confirm-intent guard,
  // not authorization — the admin BRIDGE_TOKEN gate is the actual authorization boundary.
  if (WRITE_COMMANDS.has(command.commandId) && command.approvalRequired !== true) return { error: 'GitHub write commands must be approval-gated' };
  return {
    schema: 'hermes.github-agent-command.v1',
    skillId: 'github-repo-issue-ops',
    commandId: command.commandId,
    source: 'telegram-manual',
    actorId: text(command.actorId),
    topicKey: optionalText(command.topicKey),
    threadId: Number.isFinite(Number(command.threadId)) ? Number(command.threadId) : undefined,
    sourceMessageId: optionalText(command.sourceMessageId),
    repo,
    issueNumber: Number.isInteger(command.issueNumber) ? Number(command.issueNumber) : undefined,
    title: optionalText(command.title, 180),
    body: optionalText(command.body, 4000),
    label: optionalText(command.label, 120),
    dryRun: command.dryRun === true,
    approvalRequired: command.approvalRequired === true,
    idempotencyKey: text(command.idempotencyKey, 240),
  };
}

export function createGithubCommandExecutor(options: GithubCommandExecutorOptions): GithubCommandExecutor {
  const allowedRepos = options.allowedRepos?.length ? options.allowedRepos : ['Sheshiyer/*'];
  const f = options.fetch ?? fetch;
  return async (command) => {
    const valid = validateGithubCommand(command, allowedRepos);
    if ('error' in valid) return failure(command, valid.error, 400);
    if (valid.dryRun) {
      return {
        ok: true,
        commandId: valid.commandId,
        repo: valid.repo,
        issueNumber: valid.issueNumber,
        dryRun: true,
        url: null,
        result: { wouldCall: githubApiPath(valid) },
      };
    }

    const request = githubApiRequest(valid);
    let response: Response;
    try {
      response = await f(`https://api.github.com${request.path}`, {
        method: request.method,
        headers: {
          authorization: `Bearer ${options.token}`,
          accept: 'application/vnd.github+json',
          'content-type': 'application/json',
          'user-agent': 'cambium-hermes-github-agent',
          'x-github-api-version': '2022-11-28',
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
      });
    } catch {
      return failure(valid, 'GitHub API request failed', 502);
    }
    const raw = await response.text();
    const parsed = parseJson(raw);
    if (!response.ok) {
      return failure(valid, githubError(parsed, raw), response.status);
    }
    return {
      ok: true,
      commandId: valid.commandId,
      repo: valid.repo,
      issueNumber: valid.issueNumber,
      dryRun: false,
      status: response.status,
      url: typeof parsed.html_url === 'string' ? parsed.html_url : null,
      result: publicGithubResult(parsed),
    };
  };
}

export function repoAllowed(repo: string, allowedRepos: string[]): boolean {
  // Split on '/' and match the owner segment EXACTLY (case-insensitive). Whole-string
  // prefix matching let `owner/*` leak adjacent owners; exact owner comparison denies
  // `owner-evil/repo` while still honoring `owner/*` wildcards and exact `owner/name`.
  const [repoOwner, repoName, ...rest] = repo.toLowerCase().split('/');
  if (!repoOwner || !repoName || rest.length) return false;
  return allowedRepos.some((pattern) => {
    if (pattern === '*') return true;
    const [owner, name, ...patternRest] = pattern.toLowerCase().split('/');
    if (!owner || !name || patternRest.length) return false;
    if (name === '*') return owner === repoOwner;
    return owner === repoOwner && name === repoName;
  });
}

function isGithubCommandId(value: string): value is GithubAgentCommandId {
  return [
    'github.repo.inspect',
    'github.issue.read',
    'github.issue.create',
    'github.issue.comment',
    'github.issue.label',
  ].includes(value);
}

function githubApiPath(command: GithubAgentCommandRequest): string {
  const repo = encodeRepo(command.repo);
  switch (command.commandId) {
    case 'github.repo.inspect':
      return `/repos/${repo}`;
    case 'github.issue.read':
      return `/repos/${repo}/issues/${command.issueNumber}`;
    case 'github.issue.create':
      return `/repos/${repo}/issues`;
    case 'github.issue.comment':
      return `/repos/${repo}/issues/${command.issueNumber}/comments`;
    case 'github.issue.label':
      return `/repos/${repo}/issues/${command.issueNumber}/labels`;
  }
}

function githubApiRequest(command: GithubAgentCommandRequest): { method: string; path: string; body?: Record<string, unknown> } {
  switch (command.commandId) {
    case 'github.repo.inspect':
    case 'github.issue.read':
      return { method: 'GET', path: githubApiPath(command) };
    case 'github.issue.create':
      return { method: 'POST', path: githubApiPath(command), body: { title: command.title, body: command.body } };
    case 'github.issue.comment':
      return { method: 'POST', path: githubApiPath(command), body: { body: command.body } };
    case 'github.issue.label':
      return { method: 'POST', path: githubApiPath(command), body: { labels: [command.label] } };
  }
}

function encodeRepo(repo: string): string {
  return repo.split('/').map(encodeURIComponent).join('/');
}

function publicGithubResult(value: Record<string, unknown>): Record<string, unknown> {
  const allowed = ['id', 'number', 'title', 'state', 'html_url', 'full_name', 'name', 'private', 'default_branch'];
  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    if (value[key] !== undefined) result[key] = value[key];
  }
  return result;
}

function failure(command: Pick<GithubAgentCommandRequest, 'commandId' | 'repo' | 'issueNumber' | 'dryRun'>, error: string, status?: number): GithubCommandResult {
  return {
    ok: false,
    commandId: command.commandId,
    repo: command.repo,
    issueNumber: command.issueNumber,
    dryRun: command.dryRun === true,
    status,
    error,
  };
}

function githubError(value: Record<string, unknown>, raw: string): string {
  return text(value.message, 300) || raw.slice(0, 300) || 'GitHub API request failed';
}

function parseJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function optionalText(value: unknown, max = 160): string | undefined {
  const cleaned = text(value, max);
  return cleaned || undefined;
}

function text(value: unknown, max = 160): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}
