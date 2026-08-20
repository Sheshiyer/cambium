import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildDocumentationInventorySources } from './documentation-inventory-sources.mjs';

const compilerUrl = new URL('./deterministic-safety.mjs', import.meta.url);
const cambiumRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const unixUserRoot = ['/', 'Users/'].join('');
const unixVolumeRoot = ['/', 'Volumes/'].join('');
const promptBodyToken = ['prompt', 'Body='].join('');
const WORKER_VERSION = '089181f6-ed60-4710-aab6-cd10855360e0';
const CLOUDFLARE_ACCOUNT = '0123456789abcdef0123456789abcdef';
const SHA256_IDENTITY = `sha256:${'ab'.repeat(32)}`;

let subject = null;
try {
  subject = await import(compilerUrl);
} catch {
  // RED must be a named contract failure, never an unhandled module error.
}

function requireSubject(requirement) {
  assert.ok(subject, `${requirement}: deterministic safety compiler contract is not implemented`);
  assert.equal(typeof subject.compileDeterministicSafety, 'function',
    `${requirement}: compileDeterministicSafety must be exported`);
  return subject;
}

function canonicalText(value) {
  return String(value).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
}

function digestText(value) {
  return `sha256:${createHash('sha256').update(canonicalText(value), 'utf8').digest('hex')}`;
}

function digestBuffer(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function runGit(repositoryRoot, args, { succeeds = true, encoding = 'utf8' } = {}) {
  const result = spawnSync('/usr/bin/git', ['-C', repositoryRoot, ...args], {
    encoding: encoding === null ? null : encoding,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2026-08-20T00:00:00Z',
      GIT_COMMITTER_DATE: '2026-08-20T00:00:00Z',
    },
  });
  if (succeeds) assert.equal(result.status, 0, Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, 'git command was expected to fail');
  return encoding === null ? result.stdout : String(result.stdout).trim();
}

function writeFixtureFile(repositoryRoot, relativePath, content) {
  const absolute = path.join(repositoryRoot, ...relativePath.split('/'));
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

function walkFiles(root, current = root) {
  const results = [];
  for (const name of readdirSync(current).sort()) {
    if (current === root && name === '.git') continue;
    const target = path.join(current, name);
    const relativePath = path.relative(root, target).split(path.sep).join('/');
    const entry = lstatSync(target, { bigint: true });
    if (entry.isDirectory()) results.push(...walkFiles(root, target));
    else {
      results.push({
        path: relativePath,
        mode: entry.mode.toString(),
        mtimeNs: entry.mtimeNs.toString(),
        bytes: digestBuffer(readFileSync(target)),
      });
    }
  }
  return results.sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
}

function snapshot(root) {
  const indexPath = path.join(root, '.git/index');
  return {
    files: walkFiles(root),
    index: digestBuffer(readFileSync(indexPath)),
    indexMode: lstatSync(indexPath, { bigint: true }).mode.toString(),
    status: runGit(root, ['status', '--porcelain=v1', '-z']),
  };
}

function enumerateCorpus(repositoryRoot, revision) {
  const names = String(runGit(repositoryRoot, ['ls-tree', '-r', '-z', '--name-only', revision]))
    .split('\0')
    .filter(Boolean);
  return names
    .filter((relativePath) => (
      (!relativePath.includes('/') && relativePath.endsWith('.md'))
      || relativePath.startsWith('docs/')
      || relativePath.startsWith('.planning/')
    ))
    .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
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

function createRepository(files = baseCorpus()) {
  const repositoryRoot = mkdtempSync(path.join(os.tmpdir(), 'cambium-det-safety-'));
  runGit(repositoryRoot, ['init', '--quiet']);
  runGit(repositoryRoot, ['config', 'user.name', 'Cambium Test']);
  runGit(repositoryRoot, ['config', 'user.email', 'cambium@example.invalid']);
  for (const [relativePath, content] of Object.entries(files)) writeFixtureFile(repositoryRoot, relativePath, content);
  runGit(repositoryRoot, ['add', '--', '.']);
  runGit(repositoryRoot, ['commit', '--quiet', '-m', 'fixture-base']);
  const first = runGit(repositoryRoot, ['rev-parse', 'HEAD']);
  writeFixtureFile(repositoryRoot, 'docs/evidence/second.md', '# Second commit\nLater committed evidence.\n');
  runGit(repositoryRoot, ['add', '--', 'docs/evidence/second.md']);
  runGit(repositoryRoot, ['commit', '--quiet', '-m', 'fixture-second']);
  const second = runGit(repositoryRoot, ['rev-parse', 'HEAD']);
  return { repositoryRoot, first, second, sourceRevision: second };
}

function commitFiles(fixture, files, message = 'fixture-overlay') {
  for (const [relativePath, content] of Object.entries(files)) {
    writeFixtureFile(fixture.repositoryRoot, relativePath, content);
  }
  runGit(fixture.repositoryRoot, ['add', '--', '.']);
  runGit(fixture.repositoryRoot, ['commit', '--quiet', '-m', message]);
  fixture.sourceRevision = runGit(fixture.repositoryRoot, ['rev-parse', 'HEAD']);
  return fixture.sourceRevision;
}

function compile(fixture, sourceRevision = fixture.sourceRevision) {
  const { compileDeterministicSafety } = requireSubject('SAFE-01');
  return compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision,
  });
}

function assertSafeThrow(fn, gate, pathFragment) {
  const before = snapshot(fn.fixture.repositoryRoot);
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert.equal(thrown instanceof TypeError, true, `${gate} must throw TypeError`);
  assert.match(thrown.message, new RegExp(gate));
  assert.match(thrown.message, pathFragment);
  assert.doesNotMatch(thrown.message, new RegExp(unixUserRoot));
  assert.doesNotMatch(thrown.message, new RegExp(unixVolumeRoot));
  assert.deepEqual(snapshot(fn.fixture.repositoryRoot), before, `${gate} must not rewrite the fixture tree or Git index`);
  return thrown;
}

function checkoutHeadSha() {
  const resolved = runGit(cambiumRoot, ['rev-parse', '--verify', 'HEAD^{commit}']);
  assert.match(resolved, /^[0-9a-f]{40}$/);
  return resolved;
}

test('SAFE-01 compiler module is a named contract, not an import crash', () => {
  requireSubject('SAFE-01');
});

test('SAFE-01 copied VISION.md paragraph in a committed overlay fails closed', (t) => {
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  commitFiles(fixture, {
    'docs/doctrine/README.md': `# Overlay\n\n${visionParagraph()}\n`,
  });
  const run = () => compile(fixture);
  run.fixture = fixture;
  assertSafeThrow(run, 'SAFE-01', /docs\/doctrine\/README\.md/);
});

test('SAFE-01 copied MISSION.md paragraph in a committed overlay fails closed', (t) => {
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  commitFiles(fixture, {
    'PROJECT.md': `# Project\n\n${missionParagraph()}\n`,
  });
  const run = () => compile(fixture);
  run.fixture = fixture;
  assertSafeThrow(run, 'SAFE-01', /PROJECT\.md/);
});

test('SAFE-01 titles, filenames, and sha256 digest references are allowed', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-01');
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  commitFiles(fixture, {
    'docs/doctrine/README.md': [
      '# Cambium Vision',
      '',
      'Canonical anchors remain VISION.md and MISSION.md.',
      '',
      SHA256_IDENTITY,
      '',
    ].join('\n'),
  });
  const receipt = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  assert.equal(receipt.projectionAuthority, 'read_only');
  assert.deepEqual(receipt.hits, []);
});

test('SAFE-01 ATX headings, link-only lines, and short folded blocks do not match', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-01');
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  commitFiles(fixture, {
    'README.md': [
      '# Cambium Vision',
      '',
      '- [`MISSION.md`](./MISSION.md)',
      '',
      'Keep going.',
      '',
    ].join('\n'),
  });
  const receipt = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  assert.deepEqual(receipt.hits, []);
});

test('SAFE-01 dirty worktree and staged doctrine copies do not change the SHA-bound result', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-01');
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  const clean = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  writeFixtureFile(fixture.repositoryRoot, 'docs/doctrine/README.md', `${visionParagraph()}\n`);
  writeFixtureFile(fixture.repositoryRoot, 'README.md', `${missionParagraph()}\n`);
  runGit(fixture.repositoryRoot, ['add', '--', 'README.md']);
  const dirty = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  assert.deepEqual(dirty, clean);
  assert.deepEqual(clean.hits, []);
});

test('SAFE-01 untracked MEMORY/private.md is absent from the scan set and diagnostics', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-01');
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  writeFixtureFile(fixture.repositoryRoot, 'MEMORY/private.md', `${visionParagraph()}\nraw private memory\n`);
  const receipt = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  assert.equal(receipt.rootMemoryTracked, false);
  assert.equal(receipt.corpusPaths.includes('MEMORY/private.md'), false);
  assert.doesNotMatch(JSON.stringify(receipt), /raw private memory|MEMORY\/private\.md/);
});

test('SAFE-01 path set equals inventory corpusPaths at the same SHA', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-01');
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  const sources = buildDocumentationInventorySources({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  const receipt = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  const independent = enumerateCorpus(fixture.repositoryRoot, fixture.sourceRevision);
  assert.deepEqual(receipt.corpusPaths, sources.corpusPaths);
  assert.deepEqual(receipt.corpusPaths, independent);
  assert.equal(receipt.sourceRevision, sources.sourceRevision);
  assert.equal(receipt.entryCount, sources.corpusPaths.length);
});

test('SAFE-01 replacement refs cannot substitute another tree', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-01');
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  const original = fixture.sourceRevision;
  commitFiles(fixture, {
    'docs/doctrine/README.md': `${visionParagraph()}\n`,
  }, 'replacement candidate');
  const replacementRevision = fixture.sourceRevision;
  runGit(fixture.repositoryRoot, ['replace', original, replacementRevision]);
  const receipt = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: original,
  });
  assert.equal(receipt.sourceRevision, original);
  assert.deepEqual(receipt.hits, []);
});

test('SAFE-01 binary blobs are skipped even when they contain doctrine bytes', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-01');
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  commitFiles(fixture, {
    'docs/evidence/proof.bin': Buffer.concat([Buffer.from(visionParagraph()), Buffer.from([0, 255, 1])]),
  });
  const receipt = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  assert.deepEqual(receipt.hits, []);
});

test('SAFE-01 unmodified checkout SHA produces zero SAFE-01 hits', () => {
  const { compileDeterministicSafety } = requireSubject('SAFE-01');
  const sourceRevision = checkoutHeadSha();
  try {
    const receipt = compileDeterministicSafety({
      repositoryRoot: cambiumRoot,
      sourceRevision,
    });
    assert.equal(receipt.sourceRevision, sourceRevision);
    assert.deepEqual(receipt.hits, []);
  } catch (error) {
    assert.equal(error instanceof TypeError, true);
    assert.doesNotMatch(error.message, /SAFE-01/);
  }
});

test('SAFE-02 projectionAuthority other than read_only fails closed', (t) => {
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  commitFiles(fixture, {
    'docs/architecture/intent-graph.v1.json': `${JSON.stringify({
      schema: 'cambium.intent-graph-projection.v1',
      projectionAuthority: 'planning',
    }, null, 2)}\n`,
  });
  const run = () => compile(fixture);
  run.fixture = fixture;
  assertSafeThrow(run, 'SAFE-02', /docs\/architecture\/intent-graph\.v1\.json/);
});

test('SAFE-02 role, active_planner, and sourceOfTruth claims fail on D-05 surfaces', (t) => {
  const fixture = createRepository({
    ...baseCorpus(),
    '.temperance/project.json': `${JSON.stringify({
      schema: 'temperance.project.v1',
      active_planner: 'ralph',
      role: 'sole_operational_writer',
      sourceOfTruth: 'ISA.md',
    }, null, 2)}\n`,
  });
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  const run = () => compile(fixture);
  run.fixture = fixture;
  assertSafeThrow(run, 'SAFE-02', /\.temperance\/project\.json/);
});

test('SAFE-02 self-claim this file is the planning authority fails', (t) => {
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  commitFiles(fixture, {
    'PROJECT.md': '# Project\nthis file is the planning authority\n',
  });
  const run = () => compile(fixture);
  run.fixture = fixture;
  assertSafeThrow(run, 'SAFE-02', /PROJECT\.md/);
});

test('SAFE-02 ISA.md and live STATE.md remain allowed claimants', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-02');
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  const receipt = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  assert.deepEqual(receipt.hits, []);
});

test('SAFE-02 LIFECYCLE denial and gsd_planning legend pass', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-02');
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  commitFiles(fixture, {
    'docs/LIFECYCLE.md': 'Generated readbacks recency never grants release or planning authority.\n',
    'docs/architecture/intent-graph.md': '`gsd_planning` | GSD finite-planning authority\n',
  });
  const receipt = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  assert.deepEqual(receipt.hits, []);
});

test('SAFE-02 .temperance/project.json active_planner isa or omitted planning metadata passes', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-02');
  const withIsa = createRepository({
    ...baseCorpus(),
    '.temperance/project.json': `${JSON.stringify({
      schema: 'temperance.project.v1',
      active_planner: 'isa',
      ownership: { planning: 'project' },
    }, null, 2)}\n`,
  });
  t.after(() => rmSync(withIsa.repositoryRoot, { recursive: true, force: true }));
  assert.deepEqual(compileDeterministicSafety({
    repositoryRoot: withIsa.repositoryRoot,
    sourceRevision: withIsa.sourceRevision,
  }).hits, []);

  const omitted = createRepository({
    ...baseCorpus(),
    '.temperance/project.json': `${JSON.stringify({
      schema: 'temperance.project.v1',
      ownership: { planning: 'project' },
    }, null, 2)}\n`,
  });
  t.after(() => rmSync(omitted.repositoryRoot, { recursive: true, force: true }));
  assert.deepEqual(compileDeterministicSafety({
    repositoryRoot: omitted.repositoryRoot,
    sourceRevision: omitted.sourceRevision,
  }).hits, []);
});

test('SAFE-02 committed cambium.ralph-iteration.v1 writer fields fail', (t) => {
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  commitFiles(fixture, {
    'docs/architecture/temperance-flow.v1.json': `${JSON.stringify({
      schema: 'cambium.ralph-iteration.v1',
      projectionAuthority: 'read_only',
      queue: [],
      dispatch: true,
      selfCertified: true,
    }, null, 2)}\n`,
  });
  const run = () => compile(fixture);
  run.fixture = fixture;
  assertSafeThrow(run, 'SAFE-02', /docs\/architecture\/temperance-flow\.v1\.json/);
});

test('SAFE-02 historical docs/plans planning-authority mentions are outside D-05', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-02');
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  const receipt = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  assert.deepEqual(receipt.hits, []);
  assert.equal(receipt.corpusPaths.includes('docs/plans/legacy.md'), true);
});

test('SAFE-02 unmodified checkout SHA produces zero SAFE-02 hits', () => {
  const { compileDeterministicSafety } = requireSubject('SAFE-02');
  const sourceRevision = checkoutHeadSha();
  try {
    const receipt = compileDeterministicSafety({
      repositoryRoot: cambiumRoot,
      sourceRevision,
    });
    assert.deepEqual(receipt.hits, []);
  } catch (error) {
    assert.equal(error instanceof TypeError, true);
    assert.doesNotMatch(error.message, /SAFE-02/);
  }
});

test('SAFE-03 stale intent-graph selector digest fails with path#selector', (t) => {
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  commitFiles(fixture, {
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
  const run = () => compile(fixture);
  run.fixture = fixture;
  assertSafeThrow(run, 'SAFE-03', /ISA\.md#frontmatter\.task/);
});

test('SAFE-03 matching selector digest passes and missing projections skip freshness', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-03');
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  const skipped = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  assert.deepEqual(skipped.hits, []);

  const isa = runGit(fixture.repositoryRoot, ['show', `${fixture.sourceRevision}:ISA.md`]);
  const selected = canonicalText('task: Build the provenance intent graph');
  commitFiles(fixture, {
    'docs/architecture/intent-graph.v1.json': `${JSON.stringify({
      schema: 'cambium.intent-graph-projection.v1',
      projectionAuthority: 'read_only',
      nodes: [{
        id: `intent_${'b'.repeat(64)}`,
        kind: 'goal',
        source: {
          path: 'ISA.md',
          authority: 'isa_acceptance',
          selector: 'frontmatter.task',
          digest: digestText(selected),
        },
        lifecycle: 'finite',
        state: {
          completion: 'pending',
          approval: 'approved',
          freshness: 'fresh',
          blockedReason: null,
          stopCondition: { kind: 'none', sourcePath: null, selector: null, satisfied: false },
        },
      }],
      overlayAnchors: [
        { path: 'VISION.md', digest: digestText(runGit(fixture.repositoryRoot, ['show', `${fixture.sourceRevision}:VISION.md`])) },
      ],
    }, null, 2)}\n`,
  });
  assert.equal(typeof isa, 'string');
  const receipt = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  assert.deepEqual(receipt.hits, []);
});

test('SAFE-03 inventory stdout is not a freshness corpus (D-10)', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-03');
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  commitFiles(fixture, {
    'docs/architecture/documentation-inventory.v1.json': `${JSON.stringify({
      schema: 'cambium.documentation-inventory.v1',
      projectionAuthority: 'read_only',
      sourceRevision: 'not-a-freshness-gate',
      entries: [{ path: 'VISION.md', provenance: { contentDigest: `sha256:${'1'.repeat(64)}` } }],
    }, null, 2)}\n`,
  });
  const receipt = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  assert.deepEqual(receipt.hits, []);
});

test('SAFE-03 privacy fails on Unix roots and prompt bodies in generated projections', (t) => {
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  commitFiles(fixture, {
    'docs/architecture/intent-graph.v1.json': `${JSON.stringify({
      schema: 'cambium.intent-graph-projection.v1',
      projectionAuthority: 'read_only',
      note: `${unixUserRoot}example/private`,
    }, null, 2)}\n`,
  });
  const usersHit = () => compile(fixture);
  usersHit.fixture = fixture;
  assertSafeThrow(usersHit, 'SAFE-03', /docs\/architecture\/intent-graph\.v1\.json/);

  commitFiles(fixture, {
    'docs/architecture/intent-graph.v1.json': `${JSON.stringify({
      schema: 'cambium.intent-graph-projection.v1',
      projectionAuthority: 'read_only',
      note: `${unixVolumeRoot}madara/checkout`,
    }, null, 2)}\n`,
  }, 'volumes-hit');
  const volumesHit = () => compile(fixture);
  volumesHit.fixture = fixture;
  assertSafeThrow(volumesHit, 'SAFE-03', /docs\/architecture\/intent-graph\.v1\.json/);

  commitFiles(fixture, {
    'docs/architecture/temperance-flow.v1.json': `${JSON.stringify({
      schema: 'cambium.temperance-flow-projection.v1',
      projectionAuthority: 'read_only',
      note: `${promptBodyToken}secret`,
    }, null, 2)}\n`,
  }, 'prompt-hit');
  const promptHit = () => compile(fixture);
  promptHit.fixture = fixture;
  assertSafeThrow(promptHit, 'SAFE-03', /docs\/architecture\/temperance-flow\.v1\.json/);
});

test('SAFE-03 Worker UUID, Cloudflare account ids, and sha256 identities are not privacy hits', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-03');
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  commitFiles(fixture, {
    'docs/architecture/intent-graph.v1.json': `${JSON.stringify({
      schema: 'cambium.intent-graph-projection.v1',
      projectionAuthority: 'read_only',
      workerVersion: WORKER_VERSION,
      cloudflareAccountId: CLOUDFLARE_ACCOUNT,
      graphDigest: SHA256_IDENTITY,
    }, null, 2)}\n`,
  });
  const receipt = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  assert.deepEqual(receipt.hits, []);
});

test('SAFE-03 reviewed_handoff redaction is applied before digest compare', (t) => {
  const { compileDeterministicSafety } = requireSubject('SAFE-03');
  const fixture = createRepository();
  t.after(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
  const handoff = [
    '## 2026-08-19 reviewed handoff',
    '',
    'The reviewed `implementation_head` is `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`.',
    '',
    '- Generated flowDigest: sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '',
  ].join('\n');
  commitFiles(fixture, { '.project/HANDOFF.md': handoff });
  const selected = canonicalText([
    '## 2026-08-19 reviewed handoff',
    '',
    'The reviewed `implementation_head` is `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`.',
    '',
    '- Generated flowDigest: sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '',
  ].join('\n'));
  const redacted = selected
    .replace(/(`implementation_head` is `)[a-f0-9]{40}(`)/, '$1<reviewed-implementation-head>$2')
    .replace(/^(- Generated (?:flowDigest|sourceSetDigest): )sha256:[a-f0-9]{64}$/gm, '$1<reviewed-generated-digest>');
  commitFiles(fixture, {
    'docs/architecture/temperance-flow.v1.json': `${JSON.stringify({
      schema: 'cambium.temperance-flow-projection.v1',
      projectionAuthority: 'read_only',
      references: {
        supporting: [{
          path: '.project/HANDOFF.md',
          kind: 'reviewed_handoff',
          selector: 'markdown.heading:2026-08-19 reviewed handoff',
          digest: digestText(redacted),
        }],
        intentGraph: {
          path: 'docs/architecture/intent-graph.v1.json',
          schema: 'cambium.intent-graph-projection.v1',
          digest: digestText('{"schema":"cambium.intent-graph-projection.v1"}\n'),
        },
      },
    }, null, 2)}\n`,
    'docs/architecture/intent-graph.v1.json': '{"schema":"cambium.intent-graph-projection.v1"}\n',
  }, 'handoff-fresh');
  const receipt = compileDeterministicSafety({
    repositoryRoot: fixture.repositoryRoot,
    sourceRevision: fixture.sourceRevision,
  });
  assert.deepEqual(receipt.hits, []);
});

test('SAFE-03 unmodified checkout SHA does not privacy-fail D-11 allowlists', () => {
  const { compileDeterministicSafety } = requireSubject('SAFE-03');
  const sourceRevision = checkoutHeadSha();
  try {
    const receipt = compileDeterministicSafety({
      repositoryRoot: cambiumRoot,
      sourceRevision,
    });
    assert.deepEqual(receipt.hits, []);
  } catch (error) {
    assert.equal(error instanceof TypeError, true);
    assert.match(error.message, /SAFE-03/);
    assert.doesNotMatch(error.message, new RegExp(unixUserRoot));
    assert.doesNotMatch(error.message, new RegExp(unixVolumeRoot));
    assert.doesNotMatch(error.message, new RegExp(WORKER_VERSION));
    assert.doesNotMatch(error.message, /promptBody/i);
  }
});
