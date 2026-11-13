import assert from 'node:assert/strict';
import { startFixtureChild } from './fixture-child.mjs';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

test('FLOW-02 / CR-03: one locked CAS wins and the stale expected version conflicts', async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'cambium-versioned-cas-'));
  const target = path.join(root, 'checkpoint.md');
  const marker = path.join(root, 'writer-paused');
  const release = path.join(root, 'writer-release');
  const children = [];
  t.after(async () => {
    if (existsSync(root)) writeFileSync(release, 'release');
    await Promise.all(children.map(owned => owned.stop()));
    rmSync(root, { recursive: true, force: true });
  });
  writeFileSync(target, 'version-one\n');
  const moduleUrl = new URL('./versioned-file-cas.mjs', import.meta.url).href;
  const childScript = (next, pause) => `
    import { existsSync, writeFileSync } from 'node:fs';
    const { compareAndSwapTextFile } = await import(${JSON.stringify(moduleUrl)});
    const result = await compareAndSwapTextFile({
      target: ${JSON.stringify(target)},
      expectedDigest: ${JSON.stringify(digest('version-one\n'))},
      lockOptions: { waitMs: 0 },
      buildNext: async () => {
        ${pause ? `writeFileSync(${JSON.stringify(marker)}, 'paused');
          const deadline = Date.now() + 15000;
          while (!existsSync(${JSON.stringify(release)})) {
            if (Date.now() >= deadline) throw new Error('writer release handshake timed out');
            await new Promise(resolve => setTimeout(resolve, 10));
          }` : ''}
        return ${JSON.stringify(next)};
      },
    });
    process.stdout.write(JSON.stringify(result));
  `;
  const run = script => {
    const owned = startFixtureChild(process.execPath, ['--input-type=module', '--eval', script]);
    children.push(owned);
    return owned.done;
  };
  const first = run(childScript('winner\n', true));
  const deadline = Date.now() + 10000;
  while (!existsSync(marker) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(existsSync(marker), true, 'first writer reached the locked builder');
  const secondResult = await run(childScript('stale-overwrite\n', false));
  assert.equal(secondResult.code, 0, secondResult.stderr);
  assert.equal(JSON.parse(secondResult.stdout).status, 'cas_conflict');
  assert.equal(readFileSync(target, 'utf8'), 'version-one\n', 'live transaction remains unpublished');
  writeFileSync(release, 'release');
  const firstResult = await first;
  assert.equal(firstResult.code, 0, firstResult.stderr);
  assert.equal(secondResult.code, 0, secondResult.stderr);
  assert.equal(JSON.parse(firstResult.stdout).status, 'applied');
  assert.equal(JSON.parse(secondResult.stdout).status, 'cas_conflict');
  assert.equal(readFileSync(target, 'utf8'), 'winner\n');
  const stale = await run(childScript('stale-after-commit\n', false));
  assert.equal(stale.code, 0, stale.stderr);
  assert.equal(JSON.parse(stale.stdout).status, 'cas_conflict');
  assert.equal(readFileSync(target, 'utf8'), 'winner\n');
  assert.equal(existsSync(`${target}.cambium-cas.lock`), false);
});
