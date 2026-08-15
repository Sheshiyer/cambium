import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generate-docs-retention-manifest.mjs');

test('retention manifest regeneration is deterministic and excludes itself from references', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cambium-retention-manifest-'));
  try {
    fs.mkdirSync(path.join(root, '.planning'));
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'plans', 'example.md'), '# Example\n');
    fs.writeFileSync(path.join(root, 'notes.md'), 'See docs/plans/example.md.\n');
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['add', 'docs/plans/example.md', 'notes.md'], { cwd: root });

    execFileSync(process.execPath, [script, '--generated-at', '2026-08-12'], { cwd: root });
    const output = path.join(root, '.planning', '2026-08-10-documentation-retention-manifest.per-file.v1.json');
    execFileSync('git', ['add', path.relative(root, output)], { cwd: root });
    const first = fs.readFileSync(output, 'utf8');

    execFileSync(process.execPath, [script], { cwd: root });
    const second = fs.readFileSync(output, 'utf8');
    const manifest = JSON.parse(second);

    assert.equal(second, first);
    assert.equal(manifest.generatedAt, '2026-08-12');
    assert.equal(manifest.entryCount, 1);
    assert.deepEqual(manifest.entries[0].inboundReferences.samplePaths, ['notes.md']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('retention manifest accepts an absolute output path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cambium-retention-absolute-'));
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cambium-retention-output-'));
  try {
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'plans', 'example.md'), '# Example\n');
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['add', 'docs/plans/example.md'], { cwd: root });

    const output = path.join(outputDir, 'manifest.json');
    execFileSync(process.execPath, [script, '--generated-at', '2026-08-15', '--out', output], { cwd: root });
    const manifest = JSON.parse(fs.readFileSync(output, 'utf8'));

    assert.equal(manifest.generatedAt, '2026-08-15');
    assert.equal(manifest.entryCount, 1);
    assert.equal(manifest.entries[0].path, 'docs/plans/example.md');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
