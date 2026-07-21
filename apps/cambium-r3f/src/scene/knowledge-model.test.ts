import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { KNOWLEDGE_SECTIONS } from './knowledge-model.ts';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');

test('exactly five knowledge sections', () => {
  assert.equal(KNOWLEDGE_SECTIONS.length, 5);
  assert.deepEqual(
    KNOWLEDGE_SECTIONS.map((section) => section.id),
    ['boot', 'modes', 'map', 'settings', 'docs'],
  );
});

test('every row has non-empty label and value', () => {
  for (const section of KNOWLEDGE_SECTIONS) {
    assert.ok(section.kicker.length > 0);
    assert.ok(section.title.length > 0);
    assert.ok(section.rows.length > 0, `section ${section.id} has rows`);
    for (const row of section.rows) {
      assert.ok(row.label.length > 0, `${section.id}/${row.id} label`);
      assert.ok(row.value.length > 0, `${section.id}/${row.id} value`);
    }
  }
});

test('boot commands literally exist in package.json scripts', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = pkg.scripts ?? {};
  const boot = KNOWLEDGE_SECTIONS.find((section) => section.id === 'boot');
  assert.ok(boot);
  const commands = boot.rows.map((row) => row.value);
  assert.ok(commands.includes('npm test'));
  for (const scriptName of ['r3f:dev', 'demo:tenant', 'demo:quests', 'tapestry:snapshot', 'test']) {
    assert.ok(scriptName in scripts, `script ${scriptName} exists`);
  }
});

test('docs pointers reference files that exist on disk', () => {
  const docs = KNOWLEDGE_SECTIONS.find((section) => section.id === 'docs');
  assert.ok(docs);
  for (const row of docs.rows) {
    assert.ok(fs.existsSync(path.join(repoRoot, row.value)), `${row.value} exists`);
  }
});
