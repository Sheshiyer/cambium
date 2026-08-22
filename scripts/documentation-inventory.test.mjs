import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const inventoryUrl = new URL('./documentation-inventory.mjs', import.meta.url);
const sourcesUrl = new URL('./documentation-inventory-sources.mjs', import.meta.url);

async function loadImplementation() {
  assert.equal(existsSync(inventoryUrl), true, 'documentation inventory compiler must exist');
  assert.equal(existsSync(sourcesUrl), true, 'documentation inventory source adapter must exist');
  const [inventory, sources] = await Promise.all([import(inventoryUrl), import(sourcesUrl)]);
  return { ...inventory, ...sources };
}

function runGit(repositoryRoot, args, { succeeds = true } = {}) {
  const result = spawnSync('/usr/bin/git', ['-C', repositoryRoot, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2026-08-20T00:00:00Z',
      GIT_COMMITTER_DATE: '2026-08-20T00:00:00Z',
    },
  });
  if (succeeds) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, 'git command was expected to fail');
  return result.stdout.trim();
}

function writeFixtureFile(repositoryRoot, relativePath, content) {
  const absolute = path.join(repositoryRoot, ...relativePath.split('/'));
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

function createRepository(files = {}) {
  const repositoryRoot = mkdtempSync(path.join(os.tmpdir(), 'cambium-doc-inventory-'));
  runGit(repositoryRoot, ['init', '--quiet']);
  runGit(repositoryRoot, ['config', 'user.name', 'Cambium Test']);
  runGit(repositoryRoot, ['config', 'user.email', 'cambium@example.invalid']);
  for (const [relativePath, content] of Object.entries(files)) writeFixtureFile(repositoryRoot, relativePath, content);
  runGit(repositoryRoot, ['add', '--', '.']);
  runGit(repositoryRoot, ['commit', '--quiet', '-m', 'fixture']);
  return { repositoryRoot, sourceRevision: runGit(repositoryRoot, ['rev-parse', 'HEAD']) };
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value)
    .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function refreshInventoryDigest(inventory) {
  const { inventoryDigest: _ignored, ...withoutDigest } = inventory;
  inventory.inventoryDigest = sha256(Buffer.from(canonicalJson(withoutDigest), 'utf8'));
  return inventory;
}

function visibleFiles(repositoryRoot) {
  const values = [];
  function walk(directory) {
    for (const name of readdirSync(directory).sort()) {
      if (name === '.git') continue;
      const absolute = path.join(directory, name);
      if (statSync(absolute).isDirectory()) walk(absolute);
      else values.push(path.relative(repositoryRoot, absolute).split(path.sep).join('/'));
    }
  }
  walk(repositoryRoot);
  return values;
}

function fixtureCorpus() {
  return {
    'VISION.md': '# Vision\nCanonical doctrine.\n',
    'README.md': '# Discovery\n',
    'package.json': '{}\n',
    'src/not-corpus.md': '# Not in the named corpus\n',
    'docs/guide.md': '# Guide\ncommitted-body\n',
    'docs/evidence/proof.bin': Buffer.from([0, 255, 1, 2]),
    'docs/plans/product-branches/index.md': [
      '# Packets',
      '',
      '| name | packet |',
      '| --- | --- |',
      '| active | active.md |',
      '',
    ].join('\n'),
    'docs/plans/product-branches/active.md': '# Active packet\n',
    'docs/plans/product-branches/unindexed.md': '# Lookalike only\n',
    '.planning/STATE.md': '# State\ncommitted-state\n',
    '.planning/phases/01-old/01-01-PLAN.md': '# Historical plan\n',
    '.planning/phases/01-old/01-SUMMARY.md': '# Historical summary\n',
    'docs/plans/legacy/REVIEW.md': '# Historical review\n',
  };
}

test('DOCS-01 / D-01: compiler accepts exactly the five lifecycle classes', async (t) => {
  const { buildDocumentationInventorySources, compileDocumentationInventory, validateDocumentationInventory } = await loadImplementation();
  const fixture = createRepository(fixtureCorpus());
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));

  const inventory = compileDocumentationInventory(buildDocumentationInventorySources({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  }));

  assert.deepEqual(inventory.lifecycleClasses, ['canonical', 'derived', 'historical', 'evidentiary', 'local-only']);
  assert.equal(inventory.projectionAuthority, 'read_only');
  assert.equal(validateDocumentationInventory(inventory), inventory);
  for (const lifecycle of inventory.lifecycleClasses) {
    const tampered = structuredClone(inventory);
    tampered.lifecycleClasses = inventory.lifecycleClasses.map((value) => value === lifecycle ? `${value}-other` : value);
    assert.throws(() => validateDocumentationInventory(tampered), /lifecycle/i);
  }
  const elevated = structuredClone(inventory);
  elevated.projectionAuthority = 'planning';
  assert.throws(() => validateDocumentationInventory(elevated), /read_only|authority/i);
});

test('DOCS-02 / D-02: one full commit SHA exhaustively supplies body-free corpus facts', async (t) => {
  const { buildDocumentationInventorySources, compileDocumentationInventory } = await loadImplementation();
  const fixture = createRepository(fixtureCorpus());
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));

  writeFixtureFile(fixture.repositoryRoot, 'docs/guide.md', '# Guide\ndirty-body\nsecret=do-not-read\n');
  writeFixtureFile(fixture.repositoryRoot, '.planning/STATE.md', '# State\nstaged-state\n');
  runGit(fixture.repositoryRoot, ['add', '--', '.planning/STATE.md']);
  writeFixtureFile(fixture.repositoryRoot, 'MEMORY/private.md', 'raw private memory\n');
  const beforeFiles = visibleFiles(fixture.repositoryRoot);
  const beforeStatus = runGit(fixture.repositoryRoot, ['status', '--short']);

  const sources = buildDocumentationInventorySources({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: 'HEAD',
  });
  const inventory = compileDocumentationInventory(sources);

  assert.match(inventory.sourceRevision, /^[0-9a-f]{40}$/);
  assert.equal(inventory.sourceRevision, fixture.sourceRevision);
  assert.deepEqual(inventory.entries.map(({ path: entryPath }) => entryPath), [
    '.planning/STATE.md',
    '.planning/phases/01-old/01-01-PLAN.md',
    '.planning/phases/01-old/01-SUMMARY.md',
    'README.md',
    'VISION.md',
    'docs/evidence/proof.bin',
    'docs/guide.md',
    'docs/plans/legacy/REVIEW.md',
    'docs/plans/product-branches/active.md',
    'docs/plans/product-branches/index.md',
    'docs/plans/product-branches/unindexed.md',
  ]);
  assert.equal(new Set(inventory.entries.map(({ path: entryPath }) => entryPath)).size, inventory.entries.length);
  assert.equal(inventory.entries.find(({ path: entryPath }) => entryPath === 'docs/guide.md').provenance.contentDigest,
    sha256(Buffer.from('# Guide\ncommitted-body\n')));
  assert.equal(inventory.entries.find(({ path: entryPath }) => entryPath === 'docs/evidence/proof.bin').provenance.contentKind, 'binary');
  assert.equal(inventory.rootMemory.tracked, false);
  assert.doesNotMatch(JSON.stringify(inventory), /committed-body|dirty-body|staged-state|raw private memory|secret=|\/tmp\//i);
  assert.deepEqual(visibleFiles(fixture.repositoryRoot), beforeFiles);
  assert.equal(runGit(fixture.repositoryRoot, ['status', '--short']), beforeStatus);
});

test('DOCS-02: replacement refs cannot substitute another tree beneath the selected commit', async (t) => {
  const { buildDocumentationInventorySources, compileDocumentationInventory } = await loadImplementation();
  const originalBody = '# Original committed tree\n';
  const replacementBody = '# Replacement tree\n';
  const fixture = createRepository({ 'README.md': originalBody });
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));

  writeFixtureFile(fixture.repositoryRoot, 'README.md', replacementBody);
  runGit(fixture.repositoryRoot, ['add', '--', 'README.md']);
  runGit(fixture.repositoryRoot, ['commit', '--quiet', '-m', 'replacement candidate']);
  const replacementRevision = runGit(fixture.repositoryRoot, ['rev-parse', 'HEAD']);
  runGit(fixture.repositoryRoot, ['replace', fixture.sourceRevision, replacementRevision]);

  assert.equal(runGit(fixture.repositoryRoot, ['show', `${fixture.sourceRevision}:README.md`]), replacementBody.trim());
  const inventory = compileDocumentationInventory(buildDocumentationInventorySources({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  }));

  assert.equal(inventory.sourceRevision, fixture.sourceRevision);
  assert.equal(inventory.entries.find(({ path: entryPath }) => entryPath === 'README.md').provenance.contentDigest,
    sha256(Buffer.from(originalBody)));
});

test('DOCS-02: input order, checkout path, clock, locale, and repeated compilation do not affect bytes', async (t) => {
  const { buildDocumentationInventorySources, compileDocumentationInventory, renderDocumentationInventoryJson } = await loadImplementation();
  const fixture = createRepository(fixtureCorpus());
  const cloneRoot = mkdtempSync(path.join(os.tmpdir(), 'cambium-doc-inventory-clone-'));
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  t.after(() => rmSync(cloneRoot, { recursive: true, force: true }));
  runGit(path.dirname(cloneRoot), ['clone', '--quiet', fixture.repositoryRoot, cloneRoot]);

  const firstSources = buildDocumentationInventorySources({ repositoryRoot: fixture.repositoryRoot, sourceRevision: fixture.sourceRevision });
  const cloneSources = buildDocumentationInventorySources({ repositoryRoot: cloneRoot, sourceRevision: fixture.sourceRevision });
  const reversedSources = { ...structuredClone(firstSources), corpusPaths: [...firstSources.corpusPaths].reverse(), blobs: [...firstSources.blobs].reverse() };
  const first = renderDocumentationInventoryJson(compileDocumentationInventory(firstSources));
  const second = renderDocumentationInventoryJson(compileDocumentationInventory(firstSources));
  const cloned = renderDocumentationInventoryJson(compileDocumentationInventory(cloneSources));
  const reversed = renderDocumentationInventoryJson(compileDocumentationInventory(reversedSources));

  assert.equal(second, first);
  assert.equal(cloned, first);
  assert.equal(reversed, first);
  assert.doesNotMatch(first, /20\d\d-\d\d-\d\dT|cambium-doc-inventory-/);
});

test('DOCS-04 / D-04: indexed packet evidence alone overrides historical directory defaults', async (t) => {
  const { buildDocumentationInventorySources, compileDocumentationInventory } = await loadImplementation();
  const fixture = createRepository(fixtureCorpus());
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  const inventory = compileDocumentationInventory(buildDocumentationInventorySources({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  }));
  const active = inventory.entries.find(({ path: entryPath }) => entryPath.endsWith('/active.md'));
  const unindexed = inventory.entries.find(({ path: entryPath }) => entryPath.endsWith('/unindexed.md'));

  assert.equal(active.lifecycle, 'evidentiary');
  assert.deepEqual(active.exception, {
    kind: 'indexed-product-branch-packet',
    evidencePath: 'docs/plans/product-branches/index.md',
    directoryDefault: 'historical',
  });
  assert.equal(unindexed.lifecycle, 'historical');
  assert.equal(unindexed.exception, null);
  assert.equal(inventory.entries.find(({ path: entryPath }) => entryPath === '.planning/phases/01-old/01-SUMMARY.md').lifecycle,
    'historical');
  assert.equal(inventory.entries.find(({ path: entryPath }) => entryPath === 'docs/plans/legacy/REVIEW.md').lifecycle,
    'historical');
  for (const entry of inventory.entries) {
    assert.ok(entry.provenance && entry.presentPurpose && Array.isArray(entry.overlap));
    assert.ok(Array.isArray(entry.canonicalAnchors));
    assert.match(entry.recommendedDisposition, /^retain/);
    assert.doesNotMatch(entry.recommendedDisposition, /delete|move|relocate|externalize|archive/i);
  }
});

test('DOCS-02 / DOCS-04: validators reject unsafe, incomplete, destructive, private, or open inputs', async (t) => {
  const { buildDocumentationInventorySources, compileDocumentationInventory, validateDocumentationInventory } = await loadImplementation();
  const fixture = createRepository(fixtureCorpus());
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  assert.throws(() => buildDocumentationInventorySources({ repositoryRoot: fixture.repositoryRoot }), /sourceRevision|required/i);
  const blob = runGit(fixture.repositoryRoot, ['rev-parse', 'HEAD:README.md']);
  assert.throws(() => buildDocumentationInventorySources({ repositoryRoot: fixture.repositoryRoot, sourceRevision: blob }), /commit|revision/i);

  const sources = buildDocumentationInventorySources({ repositoryRoot: fixture.repositoryRoot, sourceRevision: fixture.sourceRevision });
  assert.throws(() => compileDocumentationInventory({ ...sources, write: true }), /forbidden|field/i);
  assert.throws(() => compileDocumentationInventory({ ...sources, blobs: sources.blobs.slice(1) }), /coverage|path/i);
  assert.throws(() => compileDocumentationInventory({ ...sources, corpusPaths: ['../escape.md', ...sources.corpusPaths.slice(1)] }), /path|safe|traversal/i);

  const inventory = compileDocumentationInventory(sources);
  const destructive = structuredClone(inventory);
  destructive.entries[0].recommendedDisposition = 'delete';
  assert.throws(() => validateDocumentationInventory(destructive), /disposition|retain|destructive/i);
  const secret = structuredClone(inventory);
  secret.entries[0].presentPurpose = 'Bearer abcdefghijklmnop';
  assert.throws(() => validateDocumentationInventory(secret), /redacted|private|secret/i);
  const open = structuredClone(inventory);
  open.entries[0].promptBody = 'private prompt';
  assert.throws(() => validateDocumentationInventory(open), /forbidden|field/i);
});

test('DOCS-04: validator rejects digest-refreshed semantic tampering', async (t) => {
  const { buildDocumentationInventorySources, compileDocumentationInventory, validateDocumentationInventory } = await loadImplementation();
  const fixture = createRepository(fixtureCorpus());
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  const inventory = compileDocumentationInventory(buildDocumentationInventorySources({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  }));
  const visionIndex = inventory.entries.findIndex(({ path: entryPath }) => entryPath === 'VISION.md');

  const mutations = [
    ['lifecycle', (entry) => { entry.lifecycle = 'historical'; }, /lifecycle/i],
    ['purpose', (entry) => { entry.presentPurpose = 'Forged purpose.'; }, /purpose/i],
    ['overlap', (entry) => { entry.overlap = ['docs/README.md']; }, /overlap/i],
    ['anchors', (entry) => { entry.canonicalAnchors = ['VISION.md']; }, /anchor/i],
    ['disposition', (entry) => { entry.recommendedDisposition = 'retain-history'; }, /disposition/i],
  ];
  for (const [label, mutate, expected] of mutations) {
    const tampered = structuredClone(inventory);
    mutate(tampered.entries[visionIndex]);
    assert.throws(() => validateDocumentationInventory(refreshInventoryDigest(tampered)), expected, label);
  }

  const misplacedException = structuredClone(inventory);
  const guide = misplacedException.entries.find(({ path: entryPath }) => entryPath === 'docs/guide.md');
  guide.exception = {
    kind: 'indexed-product-branch-packet',
    evidencePath: 'docs/plans/product-branches/index.md',
    directoryDefault: 'historical',
  };
  guide.lifecycle = 'evidentiary';
  assert.throws(() => validateDocumentationInventory(refreshInventoryDigest(misplacedException)), /exception|product-branch|path/i);
});

test('DOCS-02: JSON and Markdown render the same immutable inventory identity', async (t) => {
  const {
    buildDocumentationInventorySources,
    compileDocumentationInventory,
    renderDocumentationInventoryJson,
    renderDocumentationInventoryMarkdown,
  } = await loadImplementation();
  const fixture = createRepository(fixtureCorpus());
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));

  const firstInventory = compileDocumentationInventory(buildDocumentationInventorySources({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  }));
  const firstJson = renderDocumentationInventoryJson(firstInventory);
  const markdown = renderDocumentationInventoryMarkdown(firstInventory);
  const parsed = JSON.parse(firstJson);
  assert.equal(parsed.inventoryDigest, firstInventory.inventoryDigest);
  assert.match(markdown, new RegExp(firstInventory.sourceRevision));
  assert.match(markdown, new RegExp(firstInventory.inventoryDigest));
  for (const entry of firstInventory.entries) {
    assert.match(markdown, new RegExp(entry.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(markdown, new RegExp(entry.lifecycle));
  }

  writeFixtureFile(fixture.repositoryRoot, 'docs/second.md', '# Second revision\n');
  runGit(fixture.repositoryRoot, ['add', '--', 'docs/second.md']);
  runGit(fixture.repositoryRoot, ['commit', '--quiet', '-m', 'second']);
  const secondRevision = runGit(fixture.repositoryRoot, ['rev-parse', 'HEAD']);
  const secondInventory = compileDocumentationInventory(buildDocumentationInventorySources({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: secondRevision,
  }));
  assert.notEqual(secondInventory.inventoryDigest, firstInventory.inventoryDigest);
  assert.equal(renderDocumentationInventoryJson(compileDocumentationInventory(buildDocumentationInventorySources({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  }))), firstJson);
});
