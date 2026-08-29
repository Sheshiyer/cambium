import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

test('FLOW-02 / CR-03: one locked CAS wins and the stale expected version conflicts', async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'cambium-versioned-cas-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, 'checkpoint.md');
  const marker = path.join(root, 'writer-paused');
  writeFileSync(target, 'version-one\n');
  const moduleUrl = new URL('./versioned-file-cas.mjs', import.meta.url).href;
  const childScript = (next, pause) => `
    import { writeFileSync } from 'node:fs';
    const { compareAndSwapTextFile } = await import(${JSON.stringify(moduleUrl)});
    const result = await compareAndSwapTextFile({
      target: ${JSON.stringify(target)},
      expectedDigest: ${JSON.stringify(digest('version-one\n'))},
      buildNext: async () => {
        ${pause ? `writeFileSync(${JSON.stringify(marker)}, 'paused'); await new Promise((resolve) => setTimeout(resolve, 400));` : ''}
        return ${JSON.stringify(next)};
      },
    });
    process.stdout.write(JSON.stringify(result));
  `;
  const run = (script) => new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '--eval', script]);
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
  const first = run(childScript('winner\n', true));
  for (let attempt = 0; attempt < 100 && !existsSync(marker); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(existsSync(marker), true);
  const second = run(childScript('stale-overwrite\n', false));
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.code, 0, firstResult.stderr);
  assert.equal(secondResult.code, 0, secondResult.stderr);
  assert.equal(JSON.parse(firstResult.stdout).status, 'applied');
  assert.equal(JSON.parse(secondResult.stdout).status, 'cas_conflict');
  assert.equal(readFileSync(target, 'utf8'), 'winner\n');
  assert.equal(existsSync(`${target}.cambium-cas.lock`), false);
});
