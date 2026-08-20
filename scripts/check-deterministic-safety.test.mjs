import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { compileDeterministicSafety } from './deterministic-safety.mjs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkerPath = path.join(repositoryRoot, 'scripts/check-deterministic-safety.mjs');
const checkerUrl = new URL('./check-deterministic-safety.mjs', import.meta.url);
const unixUserRoot = ['/', 'Users/'].join('');
const unixVolumeRoot = ['/', 'Volumes/'].join('');
const promptBodyToken = ['prompt', 'Body='].join('');
const receiptPattern = (sha = '[0-9a-f]{40}') => new RegExp(
  `^deterministic safety check passed: ${sha} sha256:[a-f0-9]{64} entries=\\d+\\n$`,
);

let subject = null;
try {
  subject = await import(checkerUrl);
} catch {
  // RED must be a named contract failure, never an unhandled module error.
}

function requireSubject() {
  assert.ok(subject, 'deterministic safety checker CLI is not implemented');
  assert.equal(typeof subject.parseDeterministicSafetyCheckArguments, 'function',
    'parseDeterministicSafetyCheckArguments must be exported');
  assert.equal(typeof subject.checkDeterministicSafety, 'function',
    'checkDeterministicSafety must be exported');
  assert.equal(typeof subject.runDeterministicSafetyCheckCli, 'function',
    'runDeterministicSafetyCheckCli must be exported');
  return subject;
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function git(root, ...args) {
  const result = spawnSync('/usr/bin/git', ['-C', root, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function write(root, relativePath, bytes, mode = null) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  if (mode !== null) chmodSync(target, mode);
}

function commit(root, message, isoDate) {
  git(root, 'add', '--', '.');
  const result = spawnSync('/usr/bin/git', ['-C', root, 'commit', '-qm', message], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_DATE: isoDate,
      GIT_COMMITTER_DATE: isoDate,
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return git(root, 'rev-parse', 'HEAD');
}

function visionParagraph() {
  return "Cambium's singular, near-invariant Just Cause is continued meaningful play through coordinated finite games: a fractal tapestry in which ventures, programs, people, agents, and tools can keep learning, adapting, and contributing without collapsing into one final product or one permanent center.";
}

function missionParagraph() {
  return 'Establish a provenance-preserving infinite-game architecture in which canonical doctrine, finite goals, planning, evidence, and learning stay connected without copying authority or erasing historical context.';
}

function baseCorpus() {
  return {
    'VISION.md': [
      '# Cambium Vision',
      '',
      '## Just Cause',
      '',
      visionParagraph(),
      '',
      '## Supporting references',
      '',
      '- [`MISSION.md`](./MISSION.md) — the renewable Repository Mission serving this Vision now.',
      '',
    ].join('\n'),
    'MISSION.md': [
      '# Cambium Mission',
      '',
      '## Current pursuit',
      '',
      missionParagraph(),
      '',
    ].join('\n'),
    'ISA.md': [
      '---',
      'task: Build the provenance intent graph',
      'phase: plan',
      '---',
      '',
      'ISA.md is the source of record for approved goals and goal-setting.',
      'GSD remains the planning authority for the finite transition.',
      '',
    ].join('\n'),
    'PROJECT.md': '# Project\nPickup entry. See VISION.md and MISSION.md.\n',
    'README.md': '# README\nDiscovery overlay.\n',
    'INFINITE-GAME.md': '# Infinite game\nTheory overlay.\n',
    'docs/README.md': '# Docs\n',
    'docs/doctrine/README.md': '# Doctrine catalog\n',
    'docs/LIFECYCLE.md': 'Generated readbacks recency never grants release or planning authority.\n',
    'docs/plans/legacy.md': 'Historical note: GitHub remains the planning authority for portfolio intake.\n',
    '.planning/STATE.md': [
      '# Project State',
      '',
      '## Operator Next Step',
      '',
      'Live GSD owns the finite planning authority and current goal-setting transition.',
      '',
    ].join('\n'),
    '.planning/README.md': '# Planning map\n',
  };
}

function makeFixture(files = baseCorpus()) {
  const root = mkdtempSync(path.join(tmpdir(), 'cambium-safety-check-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'fixture@example.invalid');
  git(root, 'config', 'user.name', 'Fixture');
  for (const [relativePath, body] of Object.entries(files)) write(root, relativePath, body);
  const first = commit(root, 'fixture first', '2026-01-01T00:00:00Z');
  write(root, 'docs/evidence/second.md', '# Second\nLater committed evidence.\n');
  const second = commit(root, 'fixture second', '2026-01-02T00:00:00Z');
  return {
    root,
    first,
    second,
    cleanup() { rmSync(root, { recursive: true, force: true }); },
  };
}

function commitFiles(fixture, files, message = 'fixture-overlay', isoDate = '2026-01-03T00:00:00Z') {
  for (const [relativePath, body] of Object.entries(files)) write(fixture.root, relativePath, body);
  fixture.second = commit(fixture.root, message, isoDate);
  return fixture.second;
}

function walk(root, current = root) {
  const results = [];
  for (const name of readdirSync(current)) {
    if (current === root && name === '.git') continue;
    const target = path.join(current, name);
    const relativePath = path.relative(root, target).split(path.sep).join('/');
    const entry = lstatSync(target, { bigint: true });
    if (entry.isDirectory()) results.push(...walk(root, target));
    else {
      results.push({
        path: relativePath,
        mode: entry.mode.toString(),
        mtimeNs: entry.mtimeNs.toString(),
        bytes: digest(readFileSync(target)),
      });
    }
  }
  return results.sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
}

function snapshot(root) {
  const indexPath = path.join(root, '.git/index');
  const index = statSync(indexPath, { bigint: true });
  return {
    files: walk(root),
    index: {
      mode: index.mode.toString(),
      bytes: digest(readFileSync(indexPath)),
    },
    status: git(root, 'status', '--porcelain=v1', '-z'),
  };
}

function runNode(script, root, args, { succeeds = true, env = {} } = {}) {
  assert.equal(typeof script, 'string');
  const result = spawnSync(process.execPath, [script, '--root', root, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C', ...env },
  });
  if (succeeds) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, 'invocation was expected to fail');
  return result;
}

function runChecker(root, args, options) {
  assert.equal(
    statSync(checkerPath, { throwIfNoEntry: false })?.isFile(),
    true,
    'deterministic safety checker is not implemented',
  );
  return runNode(checkerPath, root, args, options);
}

function runNpm(script, args, { succeeds = true, cwd = repositoryRoot } = {}) {
  const result = spawnSync('npm', ['run', '--silent', script, '--', ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
  });
  if (succeeds) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, `${script} was expected to fail`);
  return result;
}

const SAFETY_DISPATCH_SCRIPTS = [
  'check-deterministic-safety.mjs',
  'deterministic-safety.mjs',
  'documentation-inventory-sources.mjs',
  'intent-graph.mjs',
  'temperance-flow.mjs',
];

function materializeNpmDispatch(root, scriptValue) {
  const scriptsDir = path.join(root, 'scripts');
  mkdirSync(scriptsDir, { recursive: true });
  for (const name of SAFETY_DISPATCH_SCRIPTS) {
    copyFileSync(path.join(repositoryRoot, 'scripts', name), path.join(scriptsDir, name));
  }
  writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({
    name: 'cambium-safety-check-fixture',
    private: true,
    type: 'module',
    scripts: { 'safety:check': scriptValue },
  }, null, 2)}\n`);
}

function assertFailedClosed(result, args, before, fixtureRoot) {
  const label = args.join(' ') || '(empty argv)';
  assert.equal(result.stdout, '', label);
  assert.ok(result.stderr.length > 0 && result.stderr.length <= 320, `${label}: stderr length ${result.stderr.length}`);
  assert.doesNotMatch(result.stderr, new RegExp(`${unixUserRoot}|${unixVolumeRoot}`), label);
  assert.deepEqual(snapshot(fixtureRoot), before, label);
}

test('SAFE CLI module is a named contract, not an import crash', () => {
  requireSubject();
});

test('parser requires --source-revision once and rejects write-capable argv', () => {
  const { parseDeterministicSafetyCheckArguments } = requireSubject();
  const absoluteRoot = path.join(tmpdir(), 'cambium-safety-root');
  const parsed = parseDeterministicSafetyCheckArguments(
    ['--source-revision', 'HEAD', '--root', absoluteRoot],
  );
  assert.equal(parsed.sourceRevision, 'HEAD');
  assert.equal(parsed.repositoryRoot, absoluteRoot);

  const failures = [
    [],
    ['--source-revision'],
    ['--source-revision', 'abc', '--source-revision', 'def'],
    ['--write'],
    ['--source-revision', 'abc', '--output', path.join(absoluteRoot, 'leak.json')],
    ['--source-revision', 'abc', '--fix'],
    ['--source-revision', 'abc', '--check'],
    ['--source-revision', 'abc', '--format', 'json'],
    ['--source-revision', 'abc', '--unknown', 'value'],
    ['--source-revision', 'abc', '--provider', 'openai'],
    ['--source-revision', 'abc', '--staged'],
    ['--source-revision', 'abc', '--index'],
    ['--source-revision', 'abc', '--root', 'relative'],
    ['--source-revision', path.join(absoluteRoot, 'abs-rev')],
  ];
  for (const argv of failures) {
    assert.throws(
      () => parseDeterministicSafetyCheckArguments(argv, { repositoryRoot: absoluteRoot }),
      TypeError,
      argv.join(' ') || '(empty argv)',
    );
  }
});

test('malformed and write-capable requests fail before stdout and preserve source plus index', (t) => {
  const fixture = makeFixture();
  const outside = mkdtempSync(path.join(tmpdir(), 'cambium-safety-check-outside-'));
  t.after(() => {
    fixture.cleanup();
    rmSync(outside, { recursive: true, force: true });
  });
  const cases = [
    [],
    ['--source-revision', 'missing-revision'],
    ['--source-revision', fixture.second, '--source-revision', fixture.first],
    ['--source-revision', `${fixture.second}^{tree}`],
    ['--source-revision', fixture.second, '--write'],
    ['--source-revision', fixture.second, '--output', path.join(outside, 'leak.json')],
    ['--source-revision', fixture.second, '--fix'],
    ['--source-revision', fixture.second, '--check'],
    ['--source-revision', fixture.second, '--format', 'json'],
    ['--source-revision', fixture.second, '--unknown', 'value'],
    ['--source-revision', fixture.second, '--provider', 'openai'],
    ['--source-revision', fixture.second, '--staged'],
    ['--source-revision', fixture.second, '--index'],
    ['--source-revision', path.join(outside, 'abs-rev')],
  ];
  for (const args of cases) {
    const before = snapshot(fixture.root);
    const result = runChecker(fixture.root, args, { succeeds: false });
    assertFailedClosed(result, args, before, fixture.root);
  }
  assert.equal(statSync(path.join(outside, 'leak.json'), { throwIfNoEntry: false }), undefined);

  const beforeRelative = snapshot(fixture.root);
  const relative = spawnSync(
    process.execPath,
    [checkerPath, '--root', 'relative', '--source-revision', fixture.second],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
    },
  );
  assert.notEqual(relative.status, 0);
  assertFailedClosed(relative, ['--root', 'relative', '--source-revision', fixture.second], beforeRelative, fixture.root);
});

test('explicit SHA and HEAD print one SHA-bound receipt and are byte-stable', (t) => {
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  const before = snapshot(fixture.root);
  const bySha = runChecker(fixture.root, ['--source-revision', fixture.second]);
  const byHead = runChecker(fixture.root, ['--source-revision', 'HEAD']);
  const repeated = runChecker(fixture.root, ['--source-revision', fixture.second]);
  assert.match(bySha.stdout, receiptPattern(fixture.second));
  assert.equal(byHead.stdout, bySha.stdout);
  assert.equal(repeated.stdout, bySha.stdout);
  assert.equal(bySha.stderr, '');
  assert.equal(byHead.stderr, '');
  assert.doesNotMatch(bySha.stdout, new RegExp(`${unixUserRoot}|${unixVolumeRoot}`));
  assert.deepEqual(snapshot(fixture.root), before);

  const { checkDeterministicSafety } = requireSubject();
  const receipt = checkDeterministicSafety({
    repositoryRoot: fixture.root,
    sourceRevision: fixture.second,
  });
  assert.equal(receipt.sourceRevision, fixture.second);
  assert.match(receipt.safetyDigest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(receipt.hits, []);
});

test('dirty worktree doctrine copies do not change the SHA-bound receipt', (t) => {
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  const clean = runChecker(fixture.root, ['--source-revision', fixture.second]);
  write(fixture.root, 'docs/doctrine/README.md', `${visionParagraph()}\n`);
  write(fixture.root, 'VISION.md', `${visionParagraph()}\nextra dirty bytes\n`);
  const afterDirty = snapshot(fixture.root);
  const dirty = runChecker(fixture.root, ['--source-revision', fixture.second]);
  assert.equal(dirty.stdout, clean.stdout);
  assert.match(dirty.stdout, receiptPattern(fixture.second));
  assert.deepEqual(snapshot(fixture.root), afterDirty);
});

test('hostile overlays exit non-zero, name the relative path, and stay zero-write', (t) => {
  const copiedVision = makeFixture();
  t.after(copiedVision.cleanup);
  commitFiles(copiedVision, {
    'docs/doctrine/README.md': `# Overlay\n\n${visionParagraph()}\n`,
  });
  const visionBefore = snapshot(copiedVision.root);
  const visionHit = runChecker(copiedVision.root, ['--source-revision', copiedVision.second], { succeeds: false });
  assertFailedClosed(visionHit, ['copied-vision'], visionBefore, copiedVision.root);
  assert.match(visionHit.stderr, /docs\/doctrine\/README\.md/);
  assert.doesNotMatch(visionHit.stderr, /deterministic safety check passed:/);

  const selfClaim = makeFixture();
  t.after(selfClaim.cleanup);
  commitFiles(selfClaim, {
    'PROJECT.md': '# Project\nthis file is the planning authority\n',
  });
  const claimBefore = snapshot(selfClaim.root);
  const claimHit = runChecker(selfClaim.root, ['--source-revision', selfClaim.second], { succeeds: false });
  assertFailedClosed(claimHit, ['self-claim'], claimBefore, selfClaim.root);
  assert.match(claimHit.stderr, /PROJECT\.md/);

  const stale = makeFixture();
  t.after(stale.cleanup);
  commitFiles(stale, {
    'docs/architecture/intent-graph.v1.json': `${JSON.stringify({
      schema: 'cambium.intent-graph-projection.v1',
      projectionAuthority: 'read_only',
      nodes: [{
        id: `intent_${'a'.repeat(64)}`,
        kind: 'goal',
        source: {
          path: 'ISA.md',
          authority: 'isa_acceptance',
          selector: 'frontmatter.task',
          digest: `sha256:${'0'.repeat(64)}`,
        },
        lifecycle: 'finite',
      }],
    }, null, 2)}\n`,
  });
  const staleBefore = snapshot(stale.root);
  const staleHit = runChecker(stale.root, ['--source-revision', stale.second], { succeeds: false });
  assertFailedClosed(staleHit, ['stale-digest'], staleBefore, stale.root);
  assert.match(staleHit.stderr, /ISA\.md#frontmatter\.task/);

  const prompt = makeFixture();
  t.after(prompt.cleanup);
  commitFiles(prompt, {
    'docs/architecture/temperance-flow.v1.json': `${JSON.stringify({
      schema: 'cambium.temperance-flow-projection.v1',
      projectionAuthority: 'read_only',
      note: `${promptBodyToken}secret`,
    }, null, 2)}\n`,
  });
  const promptBefore = snapshot(prompt.root);
  const promptHit = runChecker(prompt.root, ['--source-revision', prompt.second], { succeeds: false });
  assertFailedClosed(promptHit, ['prompt-body'], promptBefore, prompt.root);
  assert.match(promptHit.stderr, /docs\/architecture\/temperance-flow\.v1\.json/);
});

test('package.json safety:check is the caller-revision dispatcher with no lockfile delta', (t) => {
  const packageJson = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['safety:check'], 'node scripts/check-deterministic-safety.mjs');
  assert.match(packageJson.scripts.test, /scripts\/\*\.test\.mjs/);
  assert.doesNotMatch(packageJson.scripts['safety:check'], /HEAD|--source-revision|--output|[>]{1,2}/);
  assert.equal(!packageJson.dependencies || Object.keys(packageJson.dependencies).length === 0, true);
  const verifyRelease = readFileSync(path.join(repositoryRoot, 'scripts/verify-release.mjs'), 'utf8');
  assert.equal(verifyRelease.includes('safety:check'), false);

  const lockNames = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
  const beforeLock = lockNames
    .filter((name) => statSync(path.join(repositoryRoot, name), { throwIfNoEntry: false })?.isFile())
    .map((name) => [name, digest(readFileSync(path.join(repositoryRoot, name)))]);
  const checkoutRevision = git(repositoryRoot, 'rev-parse', '--verify', 'HEAD^{commit}');
  let checkoutSafe = false;
  try {
    compileDeterministicSafety({
      repositoryRoot,
      sourceRevision: checkoutRevision,
    });
    checkoutSafe = true;
  } catch {
    checkoutSafe = false;
  }

  let checked;
  if (checkoutSafe) {
    checked = runNpm('safety:check', ['--source-revision', checkoutRevision]);
    assert.match(checked.stdout, receiptPattern(checkoutRevision));
  } else {
    const fixture = makeFixture();
    t.after(fixture.cleanup);
    materializeNpmDispatch(fixture.root, packageJson.scripts['safety:check']);
    checked = runNpm('safety:check', ['--source-revision', fixture.second], { cwd: fixture.root });
    assert.match(checked.stdout, receiptPattern(fixture.second));
  }
  assert.equal(checked.stderr, '');
  assert.doesNotMatch(checked.stdout, new RegExp(`${unixUserRoot}|${unixVolumeRoot}`));

  for (const [name, hash] of beforeLock) {
    assert.equal(digest(readFileSync(path.join(repositoryRoot, name))), hash);
  }
  const lockDiff = spawnSync('/usr/bin/git', ['diff', '--name-only', '--', ...lockNames], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(lockDiff.status, 0, lockDiff.stderr);
  assert.equal(lockDiff.stdout.trim(), '');
});

