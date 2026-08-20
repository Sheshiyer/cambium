import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DOCUMENTATION_INVENTORY_SCHEMA,
  DOCUMENTATION_LIFECYCLE_CLASSES,
  renderDocumentationInventoryMarkdown,
  validateDocumentationInventory,
} from './documentation-inventory.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatorPath = path.join(repositoryRoot, 'scripts/generate-documentation-inventory.mjs');
const checkerPath = path.join(repositoryRoot, 'scripts/check-documentation-inventory.mjs');
const digest = (value) => createHash('sha256').update(value).digest('hex');

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
  git(root, 'add', '.');
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

function makeFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'cambium-doc-inventory-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'fixture@example.invalid');
  git(root, 'config', 'user.name', 'Fixture');
  const files = {
    'VISION.md': '# Vision\nEnduring doctrine.\n',
    'MISSION.md': '# Mission\nRenewable mission.\n',
    'ISA.md': '# ISA\nAcceptance authority.\n',
    'AGENTS.md': '# Agents\nRepository operating contract.\n',
    'PROJECT.md': '# Project\nReviewed pickup entry.\n',
    'README.md': '# Product\nDiscovery overlay.\n',
    'docs/LIFECYCLE.md': '# Lifecycle\nHuman lifecycle map.\n',
    'docs/README.md': '# Documentation\nDerived navigation.\n',
    'docs/runbooks/operator.md': '# Runbook\nCurrent bounded procedure.\n',
    'docs/architecture/contracts/example-v1.md': '# Contract\nBounded contract.\n',
    'docs/evidence/receipt.md': '# Evidence\nImmutable proof.\n',
    'docs/archive/old.md': '# Archive\nRecoverable history.\n',
    'docs/plans/old-plan.md': '# Old plan\nHistorical only.\n',
    'docs/plans/product-branches/index.md': '| Packet | File |\n| --- | --- |\n| Active | `active.md` |\n',
    'docs/plans/product-branches/active.md': '# Active packet\nIndexed evidence.\n',
    'docs/plans/product-branches/lookalike.md': '# Unindexed packet\nHistorical by default.\n',
    'docs/memory/boundary.json': '{"schema":"fixture.memory-boundary.v1"}\n',
    'docs/private-shaped-body.md': 'Bearer fixture-private-value\npromptBody=never-emit\n/Users/example/private\n',
    '.planning/STATE.md': '# State\nLive finite transition.\n',
    '.planning/PROJECT.md': '# Planning project\n',
    '.planning/ROADMAP.md': '# Roadmap\n',
    '.planning/REQUIREMENTS.md': '# Requirements\n',
    '.planning/phases/01-old/01-SUMMARY.md': '# Summary\nEvidence.\n',
  };
  for (const [relativePath, body] of Object.entries(files)) write(root, relativePath, body);
  write(root, 'docs/assets/binary.dat', Buffer.from([0, 255, 1, 2, 3]), 0o640);
  const first = commit(root, 'fixture first', '2026-01-01T00:00:00Z');
  write(root, 'docs/second.md', '# Second\nLater committed document.\n');
  const second = commit(root, 'fixture second', '2026-01-02T00:00:00Z');
  write(root, 'docs/README.md', '# Dirty worktree body that must be ignored.\n');
  write(root, 'docs/staged-only.md', '# Staged bytes that must be ignored.\n');
  git(root, 'add', 'docs/staged-only.md');
  return {
    root,
    first,
    second,
    cleanup() { rmSync(root, { recursive: true, force: true }); },
  };
}

function walk(root, current = root) {
  const results = [];
  for (const name of readdirSync(current)) {
    if (current === root && name === '.git') continue;
    const target = path.join(current, name);
    const relativePath = path.relative(root, target).split(path.sep).join('/');
    const entry = lstatSync(target, { bigint: true });
    if (entry.isDirectory()) results.push(...walk(root, target));
    else results.push({
      path: relativePath,
      mode: entry.mode.toString(),
      mtimeNs: entry.mtimeNs.toString(),
      bytes: digest(readFileSync(target)),
    });
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
      mtimeNs: index.mtimeNs.toString(),
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

function runGenerator(root, args, options) {
  assert.equal(statSync(generatorPath, { throwIfNoEntry: false })?.isFile(), true, 'documentation inventory CLI is not implemented');
  return runNode(generatorPath, root, args, options);
}

function assertMarkdownParity(inventory, markdown) {
  for (const value of [
    inventory.schema,
    inventory.projectionAuthority,
    inventory.sourceRevision,
    inventory.sourceSetDigest,
    inventory.inventoryDigest,
    String(inventory.rootMemory.tracked),
    ...inventory.lifecycleClasses,
  ]) assert.equal(markdown.includes(value), true, `Markdown omits ${value}`);
  for (const entry of inventory.entries) {
    assert.equal(markdown.includes(`\`${entry.path}\``), true, `Markdown omits ${entry.path}`);
    assert.equal(markdown.includes(`\`${entry.lifecycle}\``), true, `Markdown omits lifecycle for ${entry.path}`);
    for (const anchor of entry.canonicalAnchors) assert.equal(markdown.includes(anchor), true, `Markdown omits ${anchor}`);
    if (entry.exception) {
      for (const value of Object.values(entry.exception)) assert.equal(markdown.includes(value), true, `Markdown omits exception ${value}`);
    }
  }
}

test('DOCS-01 / DOCS-02: explicit commit alias resolves once and both stdout formats have complete parity', (t) => {
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  const before = snapshot(fixture.root);
  const jsonOne = runGenerator(fixture.root, ['--source-revision', 'HEAD', '--format', 'json']);
  const jsonTwo = runGenerator(fixture.root, ['--source-revision', fixture.second, '--format', 'json'], { env: { TZ: 'Asia/Kolkata' } });
  const markdownOne = runGenerator(fixture.root, ['--source-revision', fixture.second, '--format', 'markdown']);
  const markdownTwo = runGenerator(fixture.root, ['--source-revision', 'HEAD', '--format', 'markdown'], { env: { TZ: 'Pacific/Honolulu' } });
  assert.equal(jsonOne.stderr, '');
  assert.equal(markdownOne.stderr, '');
  assert.equal(jsonTwo.stdout, jsonOne.stdout);
  assert.equal(markdownTwo.stdout, markdownOne.stdout);
  const inventory = validateDocumentationInventory(JSON.parse(jsonOne.stdout));
  assert.equal(inventory.schema, DOCUMENTATION_INVENTORY_SCHEMA);
  assert.equal(inventory.sourceRevision, fixture.second);
  assert.deepEqual(inventory.lifecycleClasses, [...DOCUMENTATION_LIFECYCLE_CLASSES]);
  assert.equal(inventory.rootMemory.tracked, false);
  assert.equal(inventory.rootMemory.lifecycle, 'local-only');
  assert.equal(inventory.entries.some(({ path: pathname }) => pathname === 'docs/staged-only.md'), false);
  assert.equal(inventory.entries.find(({ path: pathname }) => pathname.endsWith('/active.md'))?.lifecycle, 'evidentiary');
  assert.equal(inventory.entries.find(({ path: pathname }) => pathname.endsWith('/lookalike.md'))?.lifecycle, 'historical');
  assert.equal(inventory.entries.find(({ path: pathname }) => pathname === 'docs/assets/binary.dat')?.provenance.contentKind, 'binary');
  assertMarkdownParity(inventory, markdownOne.stdout);
  assert.equal(markdownOne.stdout, renderDocumentationInventoryMarkdown(inventory));
  assert.deepEqual(snapshot(fixture.root), before);
});

test('DOCS-02: an earlier commit remains reproducible after later commits, dirty files, and staged files exist', (t) => {
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  const first = runGenerator(fixture.root, ['--source-revision', fixture.first, '--format', 'json']).stdout;
  const repeated = runGenerator(fixture.root, ['--source-revision', fixture.first, '--format', 'json']).stdout;
  const later = runGenerator(fixture.root, ['--source-revision', fixture.second, '--format', 'json']).stdout;
  assert.equal(repeated, first);
  assert.notEqual(later, first);
  const firstInventory = JSON.parse(first);
  assert.equal(firstInventory.sourceRevision, fixture.first);
  assert.equal(firstInventory.entries.some(({ path: pathname }) => pathname === 'docs/second.md'), false);
  assert.doesNotMatch(first, /Dirty worktree|Staged bytes|fixture-private-value|promptBody|\/Users\/|\/Volumes\//i);
});

test('DOCS-02 / DOCS-04: output is checkout-, clock-, locale-, and source-body-independent', (t) => {
  const fixture = makeFixture();
  const copyParent = mkdtempSync(path.join(tmpdir(), 'cambium-doc-inventory-copy-'));
  const copiedRoot = path.join(copyParent, 'different-checkout');
  t.after(() => { fixture.cleanup(); rmSync(copyParent, { recursive: true, force: true }); });
  cpSync(fixture.root, copiedRoot, { recursive: true, preserveTimestamps: true });
  const args = ['--source-revision', fixture.first, '--format', 'json'];
  const original = runGenerator(fixture.root, args, { env: { TZ: 'UTC', LC_ALL: 'C' } });
  const copied = runGenerator(copiedRoot, args, { env: { TZ: 'Asia/Tokyo', LC_ALL: 'C' } });
  assert.equal(copied.stdout, original.stdout);
  assert.equal(copied.stderr, '');
  assert.doesNotMatch(original.stdout, new RegExp(fixture.root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(original.stdout, /credential|sessionId|promptBody|responseBody|providerStack|BEGIN PRIVATE KEY|Bearer\s/i);
});

test('DOCS-02 / DOCS-04: malformed and write-capable requests fail before stdout and preserve source plus index', (t) => {
  const fixture = makeFixture();
  const outside = mkdtempSync(path.join(tmpdir(), 'cambium-doc-inventory-outside-'));
  t.after(() => { fixture.cleanup(); rmSync(outside, { recursive: true, force: true }); });
  const link = path.join(outside, 'fixture-link');
  symlinkSync(fixture.root, link);
  const cases = [
    [],
    ['--source-revision', fixture.second],
    ['--format', 'json'],
    ['--source-revision', fixture.second, '--source-revision', fixture.first, '--format', 'json'],
    ['--source-revision', fixture.second, '--format', 'json', '--format', 'markdown'],
    ['--source-revision', fixture.second, '--format', 'yaml'],
    ['--source-revision', 'missing-revision', '--format', 'json'],
    ['--source-revision', `${fixture.second}^{tree}`, '--format', 'json'],
    ['--source-revision', fixture.second, '--format', 'json', '--write'],
    ['--source-revision', fixture.second, '--format', 'json', '--output', path.join(outside, 'leak.json')],
    ['--source-revision', fixture.second, '--format', 'json', '--unknown', 'value'],
  ];
  for (const args of cases) {
    const before = snapshot(fixture.root);
    const result = runGenerator(fixture.root, args, { succeeds: false });
    assert.equal(result.stdout, '', args.join(' '));
    assert.ok(result.stderr.length > 0 && result.stderr.length <= 320, args.join(' '));
    assert.doesNotMatch(result.stderr, /\/Users\/|\/Volumes\/|fixture-private-value|promptBody|responseBody|Bearer\s/i);
    assert.deepEqual(snapshot(fixture.root), before, args.join(' '));
  }
  assert.equal(statSync(path.join(outside, 'leak.json'), { throwIfNoEntry: false }), undefined);
  assert.notEqual(runNode(generatorPath, fixture.root, ['--root', 'relative', '--source-revision', fixture.second, '--format', 'json'], { succeeds: false }).status, 0);
  assert.equal(statSync(checkerPath, { throwIfNoEntry: false }), undefined, 'Task 2 checker must not exist during Task 1 RED/GREEN');
});

