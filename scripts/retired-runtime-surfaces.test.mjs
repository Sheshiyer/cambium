import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { findRetiredRuntimeViolations } from './retired-runtime-surfaces.mjs';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const RETIRED_SURFACE = ['multi', 'ca'].join('');
const RETIRED_DISPLAY = ['Multi', 'CA'].join('');
const RETIRED_ENV = `${RETIRED_SURFACE.toUpperCase()}_BASE`;

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'cambium-retired-runtime-'));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

test('retired runtime guard accepts the current repository', () => {
  assert.deepEqual(findRetiredRuntimeViolations(REPO_ROOT), []);
});

test('retired runtime guard rejects restored clients, imports, and configuration', () => {
  const root = fixture({
    [`bin/quine/hyphae/${RETIRED_SURFACE}.ts`]: `export const ${RETIRED_SURFACE} = {};\n`,
    'workers/quests/src/router.ts': `import { gateway } from './${RETIRED_SURFACE}.ts';\n`,
    'wrangler.toml': `${RETIRED_ENV} = "https://${RETIRED_SURFACE}.example"\n`,
  });

  const failures = findRetiredRuntimeViolations(root);
  assert.ok(failures.some((failure) => /retired runtime filename/.test(failure)));
  assert.ok(failures.some((failure) => /workers\/quests\/src\/router\.ts/.test(failure)));
  assert.ok(failures.some((failure) => /wrangler\.toml/.test(failure)));
});

test('retired runtime guard scans root configs, future runtime directories, env examples, compose files, and imported tests', () => {
  const root = fixture({
    'adapters.json': `{"adapter":"${RETIRED_SURFACE}"}\n`,
    '.env.production.example': `${RETIRED_ENV}=https://${RETIRED_SURFACE}.example\n`,
    'docker-compose.yml': `services:\n  gateway:\n    image: thoughtseed/${RETIRED_SURFACE}\n`,
    'services/gateway.ts': `export const gateway = '${RETIRED_SURFACE}';\n`,
    'bin/runtime.ts': `import './runtime.test.ts';\n`,
    'bin/runtime.test.ts': `export const restoredGateway = '${RETIRED_SURFACE}';\n`,
  });

  const failures = findRetiredRuntimeViolations(root);
  for (const path of ['adapters.json', '.env.production.example', 'docker-compose.yml', 'services/gateway.ts', 'bin/runtime.test.ts']) {
    assert.ok(failures.some((failure) => failure.includes(path)), `expected violation for ${path}`);
  }
});

test('retired runtime guard scans tracked and nonignored untracked files while skipping ignored generated output', () => {
  const root = fixture({
    '.gitignore': 'dist/\n',
    'adapters.json': '{}\n',
    'services/tracked.ts': `export const tracked = '${RETIRED_SURFACE}';\n`,
    'ops/untracked.ts': `export const untracked = '${RETIRED_SURFACE}';\n`,
    [`dist/${RETIRED_SURFACE}.ts`]: `export const generated = '${RETIRED_SURFACE}';\n`,
  });
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: root }).status, 0);
  assert.equal(spawnSync('git', ['add', '.gitignore', 'adapters.json', 'services/tracked.ts'], { cwd: root }).status, 0);

  const failures = findRetiredRuntimeViolations(root);
  assert.ok(failures.some((failure) => failure.includes('services/tracked.ts')));
  assert.ok(failures.some((failure) => failure.includes('ops/untracked.ts')));
  assert.equal(failures.some((failure) => failure.includes('dist/')), false);
});

test('retired runtime guard allows containing words that are not the retired token', () => {
  const root = fixture({
    'src/multicast.ts': 'export const multicast = true;\nexport const MULTICAST = true;\n',
    'src/network.ts': 'export const multicall = () => [];\nexport const MULTICALL = true;\n',
  });
  assert.deepEqual(findRetiredRuntimeViolations(root), []);
});

test('retired runtime guard recognizes camel-case and constant token boundaries', () => {
  const root = fixture({
    'src/gateway.ts': `export const legacy${RETIRED_SURFACE[0].toUpperCase()}${RETIRED_SURFACE.slice(1)}Client = true;\n`,
    'config/runtime.toml': `${RETIRED_ENV} = "disabled"\n`,
  });
  const failures = findRetiredRuntimeViolations(root);
  assert.ok(failures.some((failure) => failure.includes('src/gateway.ts')));
  assert.ok(failures.some((failure) => failure.includes('config/runtime.toml')));
});

test('retired runtime guard allows historical docs and only the exact retirement record', () => {
  const exactRecord = `{ id: '${RETIRED_SURFACE}', status: 'retired', guard: 'superseded by Thoughtseed Paperclip/Hermes bridge' },`;
  const exactReadmeRecord = `| **M5 · Historical ${RETIRED_DISPLAY} Wiring (retired)** ([#28+](https://github.com/Sheshiyer/cambium/milestone/5)) | 🗄️ historical — Phase R, G, Q, and bridge writers were delivered on 2026-06-16. The runtime was later retired in favor of Paperclip/Hermes; this row preserves release history and is not a callable surface. |`;
  const allowed = fixture({
    'docs/plans/2026-06-16-followons.md': `# Historical ${RETIRED_SURFACE} delivery\n`,
    'bin/quine/hyphae/growth-journal.ts': `${exactRecord}\n`,
    'README.md': `${exactReadmeRecord}\n`,
  });
  assert.deepEqual(findRetiredRuntimeViolations(allowed), []);

  writeFileSync(
    join(allowed, 'bin/quine/hyphae/growth-journal.ts'),
    `${exactRecord}\nexport const restored = '${RETIRED_SURFACE}';\n`,
  );
  assert.ok(findRetiredRuntimeViolations(allowed).some((failure) => /growth-journal\.ts:2/.test(failure)));

  writeFileSync(
    join(allowed, 'README.md'),
    `${exactReadmeRecord}\nCurrent authority: ${RETIRED_SURFACE}\n`,
  );
  assert.ok(findRetiredRuntimeViolations(allowed).some((failure) => /README\.md:2/.test(failure)));
});

test('retired runtime guard rejects the retired token in new active documentation', () => {
  const root = fixture({
    'docs/runtime-authority.md': `Current authority: ${RETIRED_SURFACE}\n`,
  });
  assert.ok(findRetiredRuntimeViolations(root).some((failure) => failure.includes('docs/runtime-authority.md')));
});

test('quine registry omits the retired hypha and all command forms fail closed', () => {
  for (const command of [['map'], ['self']]) {
    const result = spawnSync(process.execPath, ['bin/quine/quine.ts', ...command], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    const names = command[0] === 'map'
      ? payload.hyphae.map((hypha) => hypha.name)
      : Object.keys(payload.hyphae);
    assert.equal(names.includes(RETIRED_SURFACE), false);
  }

  for (const args of [[RETIRED_SURFACE], ['read', RETIRED_SURFACE], ['write', RETIRED_SURFACE]]) {
    const result = spawnSync(process.execPath, ['bin/quine/quine.ts', ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, `expected failure for quine ${args.join(' ')}`);
    assert.match(result.stderr, /unknown (command|hypha)/);
    assert.equal(result.stdout, '');
  }
});
