#!/usr/bin/env node
// Clean-copy acceptance smoke for standalone Cambium.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...opts });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`${cmd} ${args.join(' ')} failed with exit ${result.status}`);
  }
  if (opts.echo !== false) process.stdout.write(result.stdout ?? '');
  return result.stdout ?? '';
}

function unpackCleanCopy(sourceRoot, targetRoot) {
  const archive = join(targetRoot, 'repo.tar');
  const repo = join(targetRoot, 'repo');
  run('git', ['archive', '--format=tar', 'HEAD', '-o', archive], { cwd: sourceRoot, echo: false });
  run('mkdir', ['-p', repo], { echo: false });
  run('tar', ['-xf', archive, '-C', repo], { echo: false });
  return repo;
}

export function runStandaloneSmoke({ sourceRoot = process.cwd(), tenant = 'demo-org', keep = false } = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'cambium-standalone-smoke-'));
  const snapshot = join(temp, 'tapestry.snapshot.json');
  try {
    const repo = unpackCleanCopy(sourceRoot, temp);
    const commands = [
      ['npm', ['test']],
      ['npm', ['run', 'validate']],
      ['npm', ['run', 'standalone:audit']],
      ['npm', ['run', 'demo:tenant', '--', '--tenant', tenant, '--force']],
      ['npm', ['run', 'demo:quests', '--', '--tenant', tenant]],
      ['npm', ['run', 'tapestry:snapshot', '--', '--tenant', tenant, '--out', snapshot]],
    ];

    for (const [cmd, args] of commands) {
      console.log(`$ ${cmd} ${args.join(' ')}`);
      run(cmd, args, { cwd: repo });
    }

    const check = run('node', ['-e', `const fs=require('fs'); const s=JSON.parse(fs.readFileSync(${JSON.stringify(snapshot)}, 'utf8')); if (s.tenant.id !== ${JSON.stringify(tenant)} || !s.standalone || s.nodes.length < 5) process.exit(1); console.log(s.schema + ' ' + s.tenant.id + ' nodes=' + s.nodes.length);`], { echo: false });
    process.stdout.write(check);
    return { repo, snapshot, temp };
  } finally {
    if (!keep) rmSync(temp, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const args = { sourceRoot: process.cwd(), tenant: 'demo-org', keep: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tenant') args.tenant = argv[++i];
    else if (arg === '--keep') args.keep = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('usage: npm run standalone:smoke -- [--tenant demo-org] [--keep]');
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = runStandaloneSmoke(parseArgs(process.argv.slice(2)));
    console.log(`standalone smoke passed: ${result.snapshot}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
