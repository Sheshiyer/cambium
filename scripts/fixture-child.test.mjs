import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startFixtureChild } from './fixture-child.mjs';

test('fixture cleanup reuses completion after an already signalled exit', async () => {
  const owned = startFixtureChild(process.execPath, ['-e', "process.kill(process.pid, 'SIGTERM')"]);
  assert.equal((await owned.done).signal, 'SIGTERM');
  await owned.stop(200);
});

test('fixture cleanup handles failed spawn with a captured close result', async () => {
  const owned = startFixtureChild(join(tmpdir(), 'cambium-missing-fixture-executable'), []);
  await owned.stop(1000);
  assert.ok((await owned.done).error);
});

test('fixture cleanup stops its live child and collects streams through close', async () => {
  const owned = startFixtureChild(process.execPath, ['-e', 'setInterval(()=>{},1000)']);
  await owned.stop(1000);
  assert.equal((await owned.done).signal, 'SIGKILL');
  const finished = startFixtureChild(process.execPath, ['-e', "process.stdout.write('out');process.stderr.write('err')"]);
  assert.deepEqual(await finished.done, { code: 0, signal: null, stdout: 'out', stderr: 'err', error: null });
  await finished.stop(200);
});
