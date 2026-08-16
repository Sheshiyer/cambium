import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generate-docs-retention-manifest.mjs');
const defaultOutput = '.planning/2026-08-10-documentation-retention-manifest.per-file.v1.json';

function createFixtureRepo(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Retention Fixture'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'retention-fixture@example.com'], { cwd: root });
  return root;
}

function writeFixtureFile(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function commitAll(root, message) {
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', message], {
    cwd: root,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2026-08-16T00:00:00Z',
      GIT_COMMITTER_DATE: '2026-08-16T00:00:00Z',
    },
  });
}

function runGenerator(root, args = []) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

function spawnGenerator(root, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

test('retention manifest regeneration is deterministic and excludes itself from HEAD references', () => {
  const root = createFixtureRepo('cambium-retention-manifest-');
  try {
    writeFixtureFile(root, 'docs/plans/example.md', '# Example\n');
    writeFixtureFile(root, 'notes.md', 'See docs/plans/example.md.\n');
    commitAll(root, 'fixture');

    runGenerator(root);
    const output = path.join(root, defaultOutput);
    commitAll(root, 'retention receipt');
    const first = fs.readFileSync(output, 'utf8');

    writeFixtureFile(root, defaultOutput, '{"generatedAt":"2099-01-01"}\n');
    runGenerator(root);
    const second = fs.readFileSync(output, 'utf8');
    const manifest = JSON.parse(second);

    assert.equal(second, first);
    assert.equal(Object.hasOwn(manifest, 'generatedAt'), false);
    assert.equal(manifest.decisionOriginDate, '2026-08-10');
    assert.equal(manifest.inventoryAsOfRevision, 'HEAD');
    assert.equal(manifest.inventoryAsOfCommitDate, '2026-08-16');
    assert.equal(manifest.entryCount, 1);
    assert.deepEqual(manifest.entries[0].inboundReferences.samplePaths, ['notes.md']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('retention manifest accepts a repository-contained absolute output path deterministically', () => {
  const root = createFixtureRepo('cambium-retention-absolute-');
  try {
    writeFixtureFile(root, 'docs/plans/example.md', '# Example\n');
    commitAll(root, 'fixture');

    const output = path.join(root, '.planning', 'manifest.json');
    runGenerator(root, ['--out', output]);
    commitAll(root, 'absolute retention receipt');
    const first = fs.readFileSync(output, 'utf8');

    runGenerator(root, ['--out', output]);
    const second = fs.readFileSync(output, 'utf8');
    const manifest = JSON.parse(second);

    assert.equal(second, first);
    assert.equal(Object.hasOwn(manifest, 'generatedAt'), false);
    assert.equal(manifest.inventoryAsOfCommitDate, '2026-08-16');
    assert.equal(manifest.entryCount, 1);
    assert.equal(manifest.entries[0].path, 'docs/plans/example.md');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('retention manifest rejects outputs outside the repository, including symlink escapes', () => {
  const root = createFixtureRepo('cambium-retention-boundary-');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cambium-retention-outside-'));
  try {
    writeFixtureFile(root, 'docs/plans/example.md', '# Example\n');
    commitAll(root, 'fixture');

    const direct = spawnGenerator(root, ['--out', path.join(outside, 'direct.json')]);
    assert.notEqual(direct.status, 0);
    assert.match(direct.stderr, /must stay within the repository/);

    fs.symlinkSync(outside, path.join(root, 'linked-output'), 'dir');
    const linked = spawnGenerator(root, ['--out', path.join(root, 'linked-output', 'linked.json')]);
    assert.notEqual(linked.status, 0);
    assert.match(linked.stderr, /must stay within the repository/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('retention manifest rejects an existing symbolic link at the exact output path', () => {
  const root = createFixtureRepo('cambium-retention-output-link-');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cambium-retention-output-target-'));
  try {
    writeFixtureFile(root, 'docs/plans/example.md', '# Example\n');
    commitAll(root, 'fixture');

    const target = path.join(outside, 'external-target.json');
    const original = '{"preserve":"external target"}\n';
    fs.writeFileSync(target, original);
    fs.symlinkSync(target, path.join(root, defaultOutput), 'file');

    const result = spawnGenerator(root);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /output path must not be a symbolic link/i);
    assert.equal(fs.readFileSync(target, 'utf8'), original);
    assert.equal(fs.readlinkSync(path.join(root, defaultOutput)), target);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('retention manifest output is derived from exact HEAD despite dirty and staged worktree changes', () => {
  const root = createFixtureRepo('cambium-retention-head-only-');
  try {
    writeFixtureFile(root, 'docs/plans/example.md', '# Example\n');
    writeFixtureFile(root, 'notes.md', 'See docs/plans/example.md.\n');
    commitAll(root, 'fixture');

    runGenerator(root);
    const output = path.join(root, defaultOutput);
    commitAll(root, 'retention receipt');
    const expected = fs.readFileSync(output, 'utf8');

    writeFixtureFile(root, defaultOutput, '{"generatedAt":"2099-01-01"}\n');
    writeFixtureFile(root, 'docs/plans/example.md', '# Working tree rewrite\n');
    writeFixtureFile(root, 'docs/plans/added.md', '# Staged addition\n');
    writeFixtureFile(root, 'notes.md', 'See docs/plans/added.md instead.\n');
    execFileSync('git', ['add', 'docs/plans/added.md', 'notes.md'], { cwd: root });

    runGenerator(root);
    const actual = fs.readFileSync(output, 'utf8');
    const manifest = JSON.parse(actual);

    assert.equal(actual, expected);
    assert.equal(manifest.entryCount, 1);
    assert.deepEqual(manifest.entries.map((entry) => entry.path), ['docs/plans/example.md']);
    assert.deepEqual(manifest.entries[0].inboundReferences.samplePaths, ['notes.md']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('canonical receipt check rejects stale Markdown counts and misleading generatedAt metadata', () => {
  const root = createFixtureRepo('cambium-retention-canonical-check-');
  try {
    writeFixtureFile(root, 'docs/plans/example.md', '# Example\n');
    writeFixtureFile(root, '.planning/2026-08-10-documentation-retention-manifest.v1.json', `${JSON.stringify({
      schema: 'cambium.docs-retention.v1',
      generatedAt: '2026-08-10',
      entries: [
        { path: 'docs/plans/**/*.md', bytes: 0 },
        { path: 'docs/plans/**/*.json', bytes: 0 },
        { path: 'docs/plans/assets/**', bytes: 0 },
      ],
    }, null, 2)}\n`);
    writeFixtureFile(root, '.planning/2026-08-10-documentation-retention-inventory.md', `# Documentation retention inventory — 2026-08-10

**Status:** stale fixture

## Decision

Retain the evidence.

## Footprint

| Surface | Evidence | Interpretation |
| --- | --- | --- |
| Markdown files | 0 files, 0 bytes | stale |

## Reference safety findings

Retain exact paths.

\`\`\`json
{
  "generatedAt": "ISO-8601"
}
\`\`\`
`);
    commitAll(root, 'canonical fixture');

    const backdatedOverride = spawnGenerator(root, ['--generated-at', '2026-08-10']);
    assert.notEqual(backdatedOverride.status, 0);
    assert.match(backdatedOverride.stderr, /inventoryAsOfCommitDate is derived from HEAD/);

    runGenerator(root);
    const check = spawnGenerator(root, ['--check']);
    assert.equal(check.status, 0, check.stderr);
    commitAll(root, 'generated canonical receipts');
    runGenerator(root);
    execFileSync('git', ['diff', '--exit-code'], { cwd: root });
    const committedHeadCheck = spawnGenerator(root, ['--check']);
    assert.equal(committedHeadCheck.status, 0, committedHeadCheck.stderr);

    const perFile = JSON.parse(fs.readFileSync(path.join(root, defaultOutput), 'utf8'));
    const aggregatePath = path.join(root, '.planning', '2026-08-10-documentation-retention-manifest.v1.json');
    const inventoryPath = path.join(root, '.planning', '2026-08-10-documentation-retention-inventory.md');
    const aggregate = JSON.parse(fs.readFileSync(aggregatePath, 'utf8'));
    const inventory = fs.readFileSync(inventoryPath, 'utf8');
    assert.equal(Object.hasOwn(perFile, 'generatedAt'), false);
    assert.equal(Object.hasOwn(aggregate, 'generatedAt'), false);
    assert.equal(perFile.inventoryAsOfCommitDate, '2026-08-16');
    assert.equal(aggregate.inventoryAsOfCommitDate, '2026-08-16');
    assert.doesNotMatch(inventory, /"generatedAt"/);
    assert.match(inventory, /Markdown files \| 1 files, 10 bytes/);

    fs.writeFileSync(inventoryPath, inventory.replace('Markdown files | 1 files, 10 bytes', 'Markdown files | 2 files, 999 bytes'));
    const staleMarkdown = spawnGenerator(root, ['--check']);
    assert.notEqual(staleMarkdown.status, 0);
    assert.match(staleMarkdown.stderr, /retention receipt is stale/);

    runGenerator(root);
    const misleading = JSON.parse(fs.readFileSync(aggregatePath, 'utf8'));
    misleading.generatedAt = '2026-08-10';
    fs.writeFileSync(aggregatePath, `${JSON.stringify(misleading, null, 2)}\n`);
    const staleMetadata = spawnGenerator(root, ['--check']);
    assert.notEqual(staleMetadata.status, 0);
    assert.match(staleMetadata.stderr, /retention receipt is stale/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
