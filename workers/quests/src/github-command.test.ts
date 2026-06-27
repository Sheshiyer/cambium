import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGithubCommandExecutor, parseAllowedRepos, repoAllowed, validateGithubCommand } from './github-command.ts';

const command = {
  schema: 'hermes.github-agent-command.v1',
  skillId: 'github-repo-issue-ops',
  commandId: 'github.issue.create',
  source: 'telegram-manual',
  actorId: 'shesh',
  repo: 'Sheshiyer/hermes-aws-ts',
  title: 'Manual command proof',
  body: 'Create the audit route',
  dryRun: true,
  approvalRequired: true,
  idempotencyKey: 'github.issue.create:sheshiyer/hermes-aws-ts:manual-command-proof',
} as const;

test('github command · validates Hermes command envelope and repo allowlist', () => {
  const valid = validateGithubCommand(command, ['Sheshiyer/*']);
  assert.equal('error' in valid, false);
  if ('error' in valid) return;
  assert.equal(valid.commandId, 'github.issue.create');
  assert.equal(valid.repo, 'Sheshiyer/hermes-aws-ts');
  assert.equal(valid.approvalRequired, true);

  const rejected = validateGithubCommand({ ...command, repo: 'Other/repo' }, ['Sheshiyer/*']);
  assert.deepEqual(rejected, { error: 'repo not allowlisted for GitHub agent command' });

  const customAllowed = validateGithubCommand({ ...command, repo: 'ThoughtseedLabs/hermes' }, ['ThoughtseedLabs/*']);
  assert.equal('error' in customAllowed, false);
});

test('github command · rejects ungated writes', () => {
  const rejected = validateGithubCommand({ ...command, approvalRequired: false }, ['Sheshiyer/*']);
  assert.deepEqual(rejected, { error: 'GitHub write commands must be approval-gated' });
});

test('github command · dry-run executor returns intended GitHub path without token use', async () => {
  const executor = createGithubCommandExecutor({
    token: 'not-used-in-dry-run',
    allowedRepos: parseAllowedRepos('Sheshiyer/*'),
    fetch: async () => {
      throw new Error('dry-run must not call fetch');
    },
  });

  const result = await executor(command);
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.commandId, 'github.issue.create');
  assert.equal(result.repo, 'Sheshiyer/hermes-aws-ts');
  assert.deepEqual(result.result, { wouldCall: '/repos/Sheshiyer/hermes-aws-ts/issues' });
});

test('github command · executor returns bounded failure when GitHub API is unreachable', async () => {
  const executor = createGithubCommandExecutor({
    token: 'not-returned',
    allowedRepos: parseAllowedRepos('Sheshiyer/*'),
    fetch: async () => {
      throw new Error('network unavailable');
    },
  });

  const result = await executor({ ...command, dryRun: false });
  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
  assert.equal(result.error, 'GitHub API request failed');
  assert.equal(JSON.stringify(result).includes('not-returned'), false);
});

test('github command · executor performs the real issue-create write and never leaks the token', async () => {
  const calls: Array<{ url: string; init: any }> = [];
  const executor = createGithubCommandExecutor({
    token: 'ghs_SECRET_TOKEN_LEAK_CHECK',
    allowedRepos: parseAllowedRepos('Sheshiyer/*'),
    fetch: async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          id: 4242,
          number: 7,
          title: 'Manual command proof',
          state: 'open',
          html_url: 'https://github.com/Sheshiyer/hermes-aws-ts/issues/7',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      );
    },
  });

  const result = await executor({ ...command, dryRun: false });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.github.com/repos/Sheshiyer/hermes-aws-ts/issues');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { title: 'Manual command proof', body: 'Create the audit route' });
  assert.equal(calls[0].init.headers.authorization, 'Bearer ghs_SECRET_TOKEN_LEAK_CHECK');
  assert.equal(result.ok, true);
  assert.equal(result.status, 201);
  assert.equal(result.commandId, 'github.issue.create');
  assert.equal(result.repo, 'Sheshiyer/hermes-aws-ts');
  assert.equal(result.url, 'https://github.com/Sheshiyer/hermes-aws-ts/issues/7');
  assert.deepEqual(result.result, {
    id: 4242,
    number: 7,
    title: 'Manual command proof',
    state: 'open',
    html_url: 'https://github.com/Sheshiyer/hermes-aws-ts/issues/7',
  });
  assert.equal(JSON.stringify(result).includes('ghs_SECRET_TOKEN_LEAK_CHECK'), false);
});

test('github command · issue comment posts to the numbered issue with a body-only payload', async () => {
  const calls: Array<{ url: string; init: any }> = [];
  const executor = createGithubCommandExecutor({
    token: 'ghs_COMMENT_TOKEN',
    allowedRepos: parseAllowedRepos('Sheshiyer/*'),
    fetch: async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ id: 99, html_url: 'https://github.com/Sheshiyer/hermes-aws-ts/issues/12#issuecomment-99' }), { status: 201 });
    },
  });

  const result = await executor({
    schema: 'hermes.github-agent-command.v1',
    skillId: 'github-repo-issue-ops',
    commandId: 'github.issue.comment',
    source: 'telegram-manual',
    actorId: 'shesh',
    repo: 'Sheshiyer/hermes-aws-ts',
    issueNumber: 12,
    body: 'Proof attached',
    dryRun: false,
    approvalRequired: true,
    idempotencyKey: 'github.issue.comment:sheshiyer/hermes-aws-ts:12',
  });

  assert.equal(calls[0].url, 'https://api.github.com/repos/Sheshiyer/hermes-aws-ts/issues/12/comments');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { body: 'Proof attached' });
  assert.equal(result.ok, true);
  assert.equal(result.url, 'https://github.com/Sheshiyer/hermes-aws-ts/issues/12#issuecomment-99');
  assert.equal(JSON.stringify(result).includes('ghs_COMMENT_TOKEN'), false);
});

test('github command · surfaces GitHub API error status and message without leaking token', async () => {
  const executor = createGithubCommandExecutor({
    token: 'ghs_ERROR_PATH_TOKEN',
    allowedRepos: parseAllowedRepos('Sheshiyer/*'),
    fetch: async () => new Response(JSON.stringify({ message: 'Validation Failed', errors: [{ field: 'title' }] }), { status: 422 }),
  });

  const result = await executor({ ...command, dryRun: false });
  assert.equal(result.ok, false);
  assert.equal(result.status, 422);
  assert.equal(result.error, 'Validation Failed');
  assert.equal(result.commandId, 'github.issue.create');
  assert.equal(result.repo, 'Sheshiyer/hermes-aws-ts');
  assert.equal(JSON.stringify(result).includes('ghs_ERROR_PATH_TOKEN'), false);
});

test('github command · enforces per-command required fields', () => {
  const base = {
    schema: 'hermes.github-agent-command.v1',
    skillId: 'github-repo-issue-ops',
    source: 'telegram-manual',
    actorId: 'shesh',
    repo: 'Sheshiyer/hermes-aws-ts',
    approvalRequired: true,
    idempotencyKey: 'required-field-branch',
  } as const;

  assert.deepEqual(validateGithubCommand({ ...base, commandId: 'github.issue.read' }), { error: 'GitHub issue command needs issueNumber' });
  assert.deepEqual(validateGithubCommand({ ...base, commandId: 'github.issue.comment', body: 'hi' }), { error: 'GitHub issue command needs issueNumber' });
  assert.deepEqual(validateGithubCommand({ ...base, commandId: 'github.issue.label', label: 'bug' }), { error: 'GitHub issue command needs issueNumber' });
  assert.deepEqual(validateGithubCommand({ ...base, commandId: 'github.issue.create', body: 'b' }), { error: 'GitHub issue create needs title' });
  assert.deepEqual(validateGithubCommand({ ...base, commandId: 'github.issue.create', title: 't' }), { error: 'GitHub issue write needs body' });
  assert.deepEqual(validateGithubCommand({ ...base, commandId: 'github.issue.comment', issueNumber: 5 }), { error: 'GitHub issue write needs body' });
  assert.deepEqual(validateGithubCommand({ ...base, commandId: 'github.issue.label', issueNumber: 5 }), { error: 'GitHub issue label needs label' });
});

test('github command · repoAllowed matches owner exactly, case-insensitively, with wildcard boundaries', () => {
  assert.equal(repoAllowed('Sheshiyer/hermes-aws-ts', ['Sheshiyer/*']), true);
  assert.equal(repoAllowed('sheshiyer/HERMES', ['Sheshiyer/*']), true); // case-insensitive
  assert.equal(repoAllowed('ThoughtseedLabs/hermes', ['thoughtseedlabs/hermes']), true); // exact, case-insensitive
  assert.equal(repoAllowed('ThoughtseedLabs/other', ['ThoughtseedLabs/hermes']), false); // exact name mismatch
  assert.equal(repoAllowed('owner-evil/repo', ['owner/*']), false); // owner boundary — no startsWith leak
  assert.equal(repoAllowed('owner/repo', ['owner/*']), true);
  assert.equal(repoAllowed('Other/repo', ['Sheshiyer/*']), false);
  assert.equal(repoAllowed('anything/here', ['*']), true); // global wildcard
});

test('github command · rejects path-traversal and dot-only repo segments', () => {
  const base = {
    schema: 'hermes.github-agent-command.v1',
    skillId: 'github-repo-issue-ops',
    commandId: 'github.repo.inspect',
    source: 'telegram-manual',
    actorId: 'shesh',
    approvalRequired: true,
    idempotencyKey: 'traversal-check',
  } as const;

  for (const repo of ['Sheshiyer/..', 'Sheshiyer/.', '../Sheshiyer', 'Sheshiyer/.hidden', 'Sheshiyer/trailing.']) {
    const res = validateGithubCommand({ ...base, repo }, ['Sheshiyer/*']);
    assert.deepEqual(res, { error: 'GitHub command repo must be owner/name' }, `expected reject for ${repo}`);
  }
});
