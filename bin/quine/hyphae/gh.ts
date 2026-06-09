// Quine hypha · gh — GitHub. Read = issues / milestones / search; write = create an issue.
// Shells the authenticated `gh` CLI. Repo via QUINE_GH_REPO (default Sheshiyer/cambium).

import { execFile } from 'node:child_process';
import type { Hypha } from '../types.ts';

const REPO = process.env.QUINE_GH_REPO || 'Sheshiyer/cambium';

function gh(args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile('gh', args, { maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => resolve({ ok: !err, stdout: stdout ?? '', stderr: stderr ?? '' }));
  });
}
const parse = (s: string, fallback: unknown) => { try { return JSON.parse(s || ''); } catch { return fallback; } };

export const github: Hypha = {
  name: 'gh',
  describe: `GitHub (${REPO}) — issues, milestones (read) · create an issue (write)`,
  help: 'quine read gh [issues|milestones|"<search>"]\n       quine write gh issue "<title>" "<body>"',

  async status() {
    const r = await gh(['auth', 'status']);
    return { name: 'gh', reachable: r.ok, detail: r.ok ? `gh authed · ${REPO}` : 'gh not authenticated' };
  },

  async read(args) {
    const what = args[0] ?? 'issues';
    if (what === 'milestones') {
      const r = await gh(['api', `repos/${REPO}/milestones`, '--jq', '.[] | {title,open:.open_issues,closed:.closed_issues}']);
      return { hypha: 'gh', repo: REPO, milestones: r.stdout.trim().split('\n').filter(Boolean).map((l) => parse(l, l)) };
    }
    if (what === 'issues') {
      const r = await gh(['issue', 'list', '-R', REPO, '--limit', '30', '--json', 'number,title,state']);
      return { hypha: 'gh', repo: REPO, issues: parse(r.stdout, []) };
    }
    const r = await gh(['issue', 'list', '-R', REPO, '--search', args.join(' '), '--limit', '30', '--json', 'number,title,state']);
    return { hypha: 'gh', repo: REPO, query: args.join(' '), issues: parse(r.stdout, []) };
  },

  async write(args) {
    if (args[0] !== 'issue') return { hypha: 'gh', error: 'usage: quine write gh issue "<title>" "<body>"' };
    const title = args[1] || '(untitled)';
    const body = args[2] || '';
    const r = await gh(['issue', 'create', '-R', REPO, '--title', title, '--body', body]);
    return { hypha: 'gh', created: r.ok ? r.stdout.trim() : `FAILED: ${r.stderr.trim().slice(0, 120)}` };
  },
};
