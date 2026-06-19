import { test } from 'node:test';
import assert from 'node:assert/strict';

test('skills archive writes a non-destructive archive receipt', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-skills-archive-');
  const { skills } = await import('./skills.ts');

  const out = await skills.write!(
    ['archive', 'agent-plane', '--tenant', 'demo-org', '--evidence', '~/.config/cambium/agent-plane/archive.tar.zst', '--repo', 'sample-agent-plane', '--note', 'one week soak complete'],
    { root: tmp, vaultRoot: tmp },
  );

  assert.match(String(out), /archived: agent-plane/);
  const receipt = JSON.parse(fs.readFileSync(path.join(tmp, '.operator', 'demo-org.skills.archive.json'), 'utf8'));
  assert.equal(receipt.tenant, 'demo-org');
  assert.equal(receipt.archives[0].routineId, 'agent-plane');
  assert.equal(receipt.archives[0].archived, true);
  assert.equal(receipt.archives[0].evidencePath, '~/.config/cambium/agent-plane/archive.tar.zst');
  assert.equal(receipt.archives[0].repoPath, 'sample-agent-plane');
  assert.match(receipt.archives[0].ceremony.join('\n'), /process soak must be verified/);
  assert.match(receipt.archives[0].ceremony.join('\n'), /channel layer/);
});

test('skills archive read falls back to the durable agent-plane archive directory', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-skills-archive-fallback-');
  const archiveDir = path.join(tmp, 'agent-plane-archives', '20260618T063755Z');
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(path.join(archiveDir, 'instances.tar.gz'), 'archive');
  fs.writeFileSync(path.join(archiveDir, 'repo-state.txt'), 'repo=/tmp/sample-agent-plane\n');
  const prior = process.env.AGENT_PLANE_ARCHIVES_ROOT;
  process.env.AGENT_PLANE_ARCHIVES_ROOT = path.join(tmp, 'agent-plane-archives');
  try {
    const { skills } = await import('./skills.ts');
    const out = await skills.read(['archive', 'agent-plane', '--tenant', 'cambium'], { root: tmp, vaultRoot: tmp });

    assert.match(String(out), /receipt: found/);
    assert.match(String(out), /instances\.tar\.gz/);
    assert.match(String(out), /repo: \/tmp\/sample-agent-plane/);
  } finally {
    if (prior === undefined) delete process.env.AGENT_PLANE_ARCHIVES_ROOT;
    else process.env.AGENT_PLANE_ARCHIVES_ROOT = prior;
  }
});

test('skills archive runtime status blocks closure when agent-plane processes are active', async () => {
  const { assessArchiveRuntimeStatus } = await import('./skills.ts');
  const status = assessArchiveRuntimeStatus(
    ['40145 bash /path/to/sample-agent-plane/scripts/loop-runner.sh _run'],
    ['1571\t0\tai.hermes.forge-aura'],
  );

  assert.equal(status.retired, false);
  assert.equal(status.activeProcesses.length, 1);
  assert.equal(status.activeServices.length, 0);
  assert.equal(status.hermesServices.length, 1);
});

test('skills archive runtime status ignores its own inspection commands', async () => {
  const { assessArchiveRuntimeStatus } = await import('./skills.ts');
  const status = assessArchiveRuntimeStatus(
    [
      '111 pgrep -fl agent-plane|loop-runner',
      '222 /bin/zsh -lc ps -axo pid=,command= | rg -i sample-agent-plane',
      '333 rg -i sample-agent-plane|agent-plane|loop-runner|forge-aura',
      '444 npm run quine -- read skills archive agent-plane --tenant cambium',
      '555 node bin/quine/quine.ts read skills archive agent-plane --tenant cambium',
      '666 bash /path/to/sample-agent-plane/scripts/loop-runner.sh _run',
    ],
    [],
  );

  assert.equal(status.retired, false);
  assert.deepEqual(status.activeProcesses, ['666 bash /path/to/sample-agent-plane/scripts/loop-runner.sh _run']);
});

test('skills archive runtime status clears when no agent-plane runtime is active', async () => {
  const { assessArchiveRuntimeStatus } = await import('./skills.ts');
  const status = assessArchiveRuntimeStatus(
    ['123 /usr/bin/node unrelated-worker.js'],
    ['456\t0\tai.hermes.gateway'],
  );

  assert.equal(status.retired, true);
  assert.deepEqual(status.activeProcesses, []);
  assert.deepEqual(status.activeServices, []);
  assert.equal(status.hermesServices.length, 1);
});
