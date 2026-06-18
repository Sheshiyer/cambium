import { test } from 'node:test';
import assert from 'node:assert/strict';

test('skills archive writes a non-destructive archive receipt', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-skills-archive-');
  const { skills } = await import('./skills.ts');

  const out = await skills.write!(
    ['archive', 'paperclip', '--tenant', 'mathis', '--evidence', '~/.paperclip/instances/archive.tar.zst', '--repo', 'thoughtseed-paperclip', '--note', 'one week soak complete'],
    { root: tmp, vaultRoot: tmp },
  );

  assert.match(String(out), /archived: paperclip/);
  const receipt = JSON.parse(fs.readFileSync(path.join(tmp, '.operator', 'mathis.skills.archive.json'), 'utf8'));
  assert.equal(receipt.tenant, 'mathis');
  assert.equal(receipt.archives[0].routineId, 'paperclip');
  assert.equal(receipt.archives[0].archived, true);
  assert.equal(receipt.archives[0].evidencePath, '~/.paperclip/instances/archive.tar.zst');
  assert.equal(receipt.archives[0].repoPath, 'thoughtseed-paperclip');
  assert.match(receipt.archives[0].ceremony.join('\n'), /process soak must be verified/);
  assert.match(receipt.archives[0].ceremony.join('\n'), /Hermes channel layer/);
});

test('skills archive runtime status blocks closure when Paperclip processes are active', async () => {
  const { assessArchiveRuntimeStatus } = await import('./skills.ts');
  const status = assessArchiveRuntimeStatus(
    ['40145 bash /path/to/thoughtseed-paperclip/scripts/loop-runner.sh _run'],
    ['1571\t0\tai.hermes.forge-aura'],
  );

  assert.equal(status.retired, false);
  assert.equal(status.activeProcesses.length, 1);
  assert.equal(status.activeServices.length, 0);
  assert.equal(status.hermesServices.length, 1);
});

test('skills archive runtime status clears when no Paperclip runtime is active', async () => {
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
