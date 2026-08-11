import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createGithubRoutineContext,
  isSafeGithubKnowledgePath,
  parseGithubKnowledgeAllowlistJson,
} from './github-knowledge.ts';

const REPO = 'Sheshiyer/thoughtseed-labs';
const COMMIT = 'a'.repeat(40);
const FILE_SHA = 'b'.repeat(40);

function githubFetch(markdown = '# System of records\nGitHub is the source. token=must-not-leak'): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.endsWith('/commits/main')) return new Response(JSON.stringify({ sha: COMMIT }), { status: 200 });
    if (url.includes('/contents/00-meta/system-of-records.md?ref=' + COMMIT)) {
      return new Response(JSON.stringify({
        type: 'file',
        size: markdown.length,
        sha: FILE_SHA,
        content: btoa(markdown),
      }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };
}

test('github routine context resolves one revision then reads exact allowlisted files', async () => {
  const context = createGithubRoutineContext({
    token: 'read-only-token',
    repository: REPO,
    ref: 'main',
    fetchImpl: githubFetch(),
    allowlist: {
      'daily-standup-digest': [{
        id: 'system-records',
        title: 'System of records',
        paths: ['00-meta/system-of-records.md'],
      }],
    },
  });

  const snapshot = await context.getSnapshot({ tenant: 'cambium', routine: 'daily-standup-digest' });
  const section = snapshot.sections[0] as any;
  assert.equal(snapshot.metadata?.provider, 'github-contents-api');
  assert.equal(snapshot.metadata?.source, `github:${REPO}@${COMMIT}`);
  assert.equal(section.signalState, 'current');
  assert.equal(section.items[0].title, 'System of records');
  assert.match(section.items[0].summary, /GitHub is the source/);
  assert.doesNotMatch(section.items[0].summary, /must-not-leak/);
  assert.equal(section.items[0].sourceKey, `github://${REPO}/00-meta/system-of-records.md@${FILE_SHA}`);
});

test('github routine context fails closed for unavailable source and never returns document bodies', async () => {
  const context = createGithubRoutineContext({
    token: 'read-only-token',
    repository: REPO,
    fetchImpl: async () => new Response('{"message":"private body"}', { status: 500 }),
    allowlist: {
      'daily-standup-digest': [{ id: 'records', title: 'Records', paths: ['00-meta/system-of-records.md'] }],
    },
  });
  const snapshot = await context.getSnapshot({ tenant: 'cambium', routine: 'daily-standup-digest' });
  assert.match(JSON.stringify(snapshot), /Blocked\/no-signal/);
  assert.doesNotMatch(JSON.stringify(snapshot), /private body/);
  assert.equal(snapshot.metadata?.mode, 'source-unavailable');
});

test('github knowledge allowlist accepts exact safe paths and rejects broad or unsafe paths before fetch', () => {
  assert.equal(isSafeGithubKnowledgePath('00-meta/system-of-records.md'), true);
  for (const path of ['../secret.md', '00-meta/', '/00-meta/a.md', '00-meta/*.md', '00 meta/a.md']) {
    assert.equal(isSafeGithubKnowledgePath(path), false, path);
  }
  const parsed = parseGithubKnowledgeAllowlistJson(JSON.stringify({
    'daily-standup-digest': [{
      id: 'records', title: 'Records',
      paths: ['00-meta/system-of-records.md', '../secret.md', '00-meta/*.md'],
    }],
  }));
  assert.deepEqual(parsed?.['daily-standup-digest']?.[0]?.paths, ['00-meta/system-of-records.md']);
});
