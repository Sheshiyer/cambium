import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGithubCommandExecutor, parseAllowedRepos, validateGithubCommand } from './github-command.ts';

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
