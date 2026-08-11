import type {
  ContextProviderMetadata,
  RoutineContextItem,
  RoutineContextLike,
  RoutineContextSection,
} from './context-routes.ts';

export interface GithubKnowledgeSlice {
  id: string;
  title: string;
  paths?: string[];
}

export type GithubKnowledgeAllowlist = Record<string, GithubKnowledgeSlice[]>;

export interface CreateGithubRoutineContextArgs {
  token?: string;
  repository?: string;
  ref?: string;
  allowlist?: GithubKnowledgeAllowlist;
  fetchImpl?: typeof fetch;
}

const MAX_SECTIONS = 8;
const MAX_ITEMS_PER_SECTION = 8;
const MAX_PATH_LENGTH = 300;
const MAX_FILE_BYTES = 64 * 1024;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REF = /^(?:[a-f0-9]{40}|[A-Za-z0-9][A-Za-z0-9._/-]{0,119})$/;
const PATH = /^[A-Za-z0-9][A-Za-z0-9._/@:=+\-]{0,299}$/;

function safeText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\b(secret|token|api[_-]?key)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function isSafeGithubKnowledgePath(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_PATH_LENGTH
    && !value.startsWith('/')
    && !value.endsWith('/')
    && !value.includes('..')
    && !value.includes('//')
    && !value.includes('\\')
    && !/[?#*\s]/.test(value)
    && PATH.test(value);
}

export function parseGithubKnowledgeAllowlistJson(raw: string | null | undefined): GithubKnowledgeAllowlist | undefined {
  if (!raw?.trim()) return undefined;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return undefined; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  const result: GithubKnowledgeAllowlist = {};
  for (const [routine, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^[a-z0-9][a-z0-9_-]{1,119}$/.test(routine) || !Array.isArray(value)) continue;
    const slices = value.flatMap((candidate) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
      const record = candidate as Record<string, unknown>;
      const id = safeText(record.id, 160);
      const title = safeText(record.title ?? id, 160);
      const paths = Array.isArray(record.paths)
        ? [...new Set(record.paths.filter(isSafeGithubKnowledgePath))].slice(0, MAX_ITEMS_PER_SECTION)
        : [];
      return id && title ? [{ id, title, ...(paths.length ? { paths } : {}) }] : [];
    }).slice(0, MAX_SECTIONS);
    if (slices.length) result[routine] = slices;
  }
  return Object.keys(result).length ? result : undefined;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function decodeBase64(content: string): string | null {
  try {
    const binary = atob(content.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function markdownSummary(markdown: string): string {
  const summary = markdown
    .replace(/^---\s*[\s\S]*?\s*---\s*/, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[\s>*-]+/gm, '')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\|/g, ' ');
  return safeText(summary, 500) || 'No readable markdown summary.';
}

function titleFor(markdown: string, path: string): string {
  const heading = markdown.match(/^#{1,6}\s+(.+)$/m)?.[1];
  return safeText(heading ?? path.split('/').pop()?.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') ?? path, 160);
}

function noSignal(slice: GithubKnowledgeSlice, reason: string): RoutineContextItem {
  return {
    title: `No verified ${safeText(slice.title || slice.id, 160)} signal`,
    summary: `Blocked/no-signal: ${safeText(reason, 500)}`,
    signalState: 'blocked-no-signal',
  };
}

async function resolvedCommit(fetchImpl: typeof fetch, repository: string, ref: string, headers: HeadersInit): Promise<string | null> {
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/commits/${encodeURIComponent(ref)}`, { headers });
  if (!response.ok) return null;
  const value = await response.json() as { sha?: unknown };
  return typeof value.sha === 'string' && /^[a-f0-9]{40}$/.test(value.sha) ? value.sha : null;
}

export function createGithubRoutineContext({
  token,
  repository,
  ref = 'main',
  allowlist = {},
  fetchImpl = fetch,
}: CreateGithubRoutineContextArgs = {}): RoutineContextLike {
  const configured = Boolean(token && repository && REPOSITORY.test(repository) && REF.test(ref));
  const metadata: ContextProviderMetadata = {
    provider: 'github-contents-api',
    source: 'github-private-repository',
    index: repository,
    plane: 'github-knowledge-plane',
    mode: configured ? 'direct-read' : 'not-configured',
  };

  return {
    async getSnapshot({ routine }) {
      const slices = (allowlist[routine] ?? []).slice(0, MAX_SECTIONS);
      if (!configured || !token || !repository) {
        return {
          sections: slices.map((slice) => ({
            id: slice.id,
            title: slice.title,
            items: [noSignal(slice, 'GitHub knowledge source is not configured.')],
            signalState: 'blocked-no-signal',
            exactKeyCount: (slice.paths ?? []).length,
            resolvedKeyCount: 0,
            missingKeyCount: (slice.paths ?? []).length,
          } satisfies RoutineContextSection)),
          metadata,
        };
      }
      const headers = {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      };
      const commit = await resolvedCommit(fetchImpl, repository, ref, headers);
      if (!commit) {
        return {
          sections: slices.map((slice) => ({
            id: slice.id,
            title: slice.title,
            items: [noSignal(slice, 'GitHub source revision could not be resolved.')],
            signalState: 'blocked-no-signal',
            exactKeyCount: (slice.paths ?? []).length,
            resolvedKeyCount: 0,
            missingKeyCount: (slice.paths ?? []).length,
          } satisfies RoutineContextSection)),
          metadata: { ...metadata, mode: 'source-unavailable' },
        };
      }

      const sections: RoutineContextSection[] = [];
      for (const slice of slices) {
        const paths = [...new Set(slice.paths ?? [])].filter(isSafeGithubKnowledgePath).slice(0, MAX_ITEMS_PER_SECTION);
        const items: RoutineContextItem[] = [];
        let missing = 0;
        for (const path of paths) {
          const response = await fetchImpl(`https://api.github.com/repos/${repository}/contents/${encodePath(path)}?ref=${commit}`, { headers });
          if (!response.ok) { missing += 1; continue; }
          const value = await response.json() as { type?: unknown; content?: unknown; size?: unknown; sha?: unknown };
          if (value.type !== 'file' || typeof value.content !== 'string' || (typeof value.size === 'number' && value.size > MAX_FILE_BYTES)) {
            missing += 1;
            continue;
          }
          const markdown = decodeBase64(value.content);
          if (markdown === null) { missing += 1; continue; }
          const sha = typeof value.sha === 'string' && /^[a-f0-9]{40}$/.test(value.sha) ? value.sha : commit;
          items.push({
            title: titleFor(markdown, path),
            summary: markdownSummary(markdown),
            sourceKey: `github://${repository}/${path}@${sha}`,
            signalState: 'current',
          });
        }
        if (missing) items.push(noSignal(slice, `${missing} of ${paths.length} exact allowlisted GitHub files are unavailable or invalid.`));
        sections.push({
          id: slice.id,
          title: slice.title,
          items: items.length ? items : [noSignal(slice, 'No allowlisted GitHub files produced a readable signal.')],
          signalState: missing ? (items.some((item) => item.signalState === 'current') ? 'mixed' : 'blocked-no-signal') : 'current',
          exactKeyCount: paths.length,
          resolvedKeyCount: paths.length - missing,
          missingKeyCount: missing,
        });
      }
      return { sections, metadata: { ...metadata, source: `github:${repository}@${commit}` } };
    },
  };
}
