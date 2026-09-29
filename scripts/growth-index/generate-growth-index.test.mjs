import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseFrontmatter,
  parseInboxItems,
  parseCalendar,
  parseGatesFromLane,
  buildDepartments,
  parseTable
} from './generate-growth-index.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');
const GENERATOR = join(SCRIPT_DIR, 'generate-growth-index.mjs');
const SCHEMA_PATH = join(SCRIPT_DIR, 'growth-index.schema.json');
const FIXTURE_VAULT = join(SCRIPT_DIR, 'fixtures', 'vault');
const FIXTURE_LANE1 = join(SCRIPT_DIR, 'fixtures', 'lanes', 'lane1-growth-vault.md');
const FIXTURE_LANE6 = join(SCRIPT_DIR, 'fixtures', 'lanes', 'lane6-hitl.md');

test('parseFrontmatter extracts scalars, lists, and body', () => {
  const source = [
    '---',
    'type: growth-cell',
    'status: graded',
    'tags: [growth, calendar, x]',
    'related:',
    '  - a.md',
    '  - b.md',
    '---',
    '',
    '# Body'
  ].join('\n');
  const { frontmatter, body } = parseFrontmatter(source);
  assert.equal(frontmatter.type, 'growth-cell');
  assert.equal(frontmatter.status, 'graded');
  assert.deepEqual(frontmatter.tags, ['growth', 'calendar', 'x']);
  assert.deepEqual(frontmatter.related, ['a.md', 'b.md']);
  assert.match(body, /# Body/);
});

test('parseFrontmatter tolerates missing frontmatter', () => {
  const { frontmatter, body } = parseFrontmatter('# No frontmatter\n');
  assert.deepEqual(frontmatter, {});
  assert.match(body, /No frontmatter/);
});

test('parseInboxItems reads dated bullets with continuation fields', () => {
  const body = [
    '# Inbox',
    '',
    '- 2026-08-21 | cell:social-posts | score:4 | src:department/execute-plan.md move 3',
    '  quote: none (quotes insufficient)',
    '  draft_path: social-posts/current.md',
    '  status: fed',
    '',
    '- 2026-09-21 | cell:social-posts | score:4 | src:https://x.com/example',
    '  note: teardown only',
    '  status: inbox'
  ].join('\n');

  const items = parseInboxItems(body);
  assert.equal(items.length, 2);
  assert.equal(items[0].date, '2026-08-21');
  assert.equal(items[0].cell, 'social-posts');
  assert.equal(items[0].score, 4);
  assert.equal(items[0].status, 'fed');
  assert.equal(items[0].draftPath, 'social-posts/current.md');
  assert.equal(items[1].status, 'inbox');
  assert.equal(items[1].note, 'teardown only');
});

test('parseTable parses a markdown table into header-keyed rows', () => {
  const lines = [
    '| date | channel | status |',
    '|---|---|---|',
    '| 2026-08-24 | x | queued |'
  ];
  const table = parseTable(lines);
  assert.deepEqual(table.headers, ['date', 'channel', 'status']);
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0].date, '2026-08-24');
});

test('parseCalendar reads week-scoped rows from the fixture calendar', () => {
  const calendar = parseCalendar(FIXTURE_VAULT);
  assert.equal(calendar.frontmatter.type, 'calendar');
  assert.equal(calendar.rows.length, 4);
  assert.equal(calendar.rows[0].week, 1);
  assert.equal(calendar.rows[0].date, '2026-08-24');
  assert.equal(calendar.rows[0].channel, 'x');
  assert.equal(calendar.rows[0].status, 'queued');

  const approvedRow = calendar.rows.find((row) => row.status === 'approved');
  assert.ok(approvedRow);
  assert.equal(approvedRow.week, 2);
  assert.equal(approvedRow.composioJobId, 'job-123');
  assert.equal(approvedRow.permalink, 'https://example.com/post');
});

test('buildDepartments walks desk folders for cells and inbox items', () => {
  const departments = buildDepartments(FIXTURE_VAULT);
  const ids = departments.map((d) => d.id).sort();
  assert.deepEqual(ids, ['02-copywriter', '06-analyst']);

  const copywriter = departments.find((d) => d.id === '02-copywriter');
  assert.equal(copywriter.role, 'copywriter');
  assert.equal(copywriter.inbox.length, 2);
  assert.equal(copywriter.cells.length, 1);
  assert.equal(copywriter.cells[0].frontmatter.cell, 'social-posts');
  assert.equal(copywriter.cells[0].frontmatter.status, 'graded');

  const analyst = departments.find((d) => d.id === '06-analyst');
  assert.equal(analyst.cells[0].frontmatter.cell, 'spotting-ai-slop');
});

test('parseGatesFromLane extracts HITL gate rows from lane1 and lane6 fixtures', () => {
  const lane1Gates = parseGatesFromLane(FIXTURE_LANE1, 'lane1', /HITL gates/i);
  assert.ok(lane1Gates.length >= 3);
  assert.ok(lane1Gates.every((gate) => gate.source === 'lane1'));
  const g02 = lane1Gates.find((gate) => gate.id === 'G-02');
  assert.ok(g02);
  assert.match(g02.fields['Gate / decision'], /Calendar row/);

  const lane6Gates = parseGatesFromLane(FIXTURE_LANE6, 'lane6', /^[A-C]\./);
  const d5 = lane6Gates.find((gate) => gate.id === 'D5');
  assert.ok(d5);
  assert.equal(d5.category, 'A. MUST-DECIDE-FIRST (each unblocks the most)');
});

test('parseGatesFromLane returns empty array for missing file', () => {
  assert.deepEqual(parseGatesFromLane(null, 'lane1', /x/), []);
  assert.deepEqual(parseGatesFromLane('/does/not/exist.md', 'lane1', /x/), []);
});

test('CLI writes a schema-shaped growth-index.v1.json from fixtures', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'growth-index-'));
  const outPath = join(tempDir, 'growth-index.v1.json');
  try {
    const result = spawnSync(process.execPath, [
      GENERATOR,
      '--vault-root', FIXTURE_VAULT,
      '--lane1', FIXTURE_LANE1,
      '--lane6', FIXTURE_LANE6,
      '--out', outPath
    ], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(outPath));

    const index = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(index.schema, 'thoughtseed.growth-index.v1');
    assert.equal(index.sourceRoot, FIXTURE_VAULT);
    assert.ok(index.departments.length >= 2);
    assert.ok(index.calendar.rows.length >= 1);
    assert.ok(index.gates.length >= 4);

    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    assert.equal(schema.$id, 'https://thoughtseed.local/schemas/growth-index.v1.json');
    assertMatchesSchemaShape(index, schema);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('CLI fails clearly when vault root is missing', () => {
  const result = spawnSync(process.execPath, [
    GENERATOR,
    '--vault-root', '/no/such/vault',
    '--out', join(mkdtempSync(join(tmpdir(), 'growth-index-')), 'out.json')
  ], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /vault root not found/);
});

// Minimal structural check (not a full JSON Schema validator, but no extra
// dependency is available in this repo): confirms required top-level keys
// and the required calendar row keys are present with matching types.
function assertMatchesSchemaShape(index, schema) {
  for (const key of schema.required) {
    assert.ok(Object.prototype.hasOwnProperty.call(index, key), `index missing required key: ${key}`);
  }
  assert.equal(typeof index.schema, 'string');
  assert.equal(typeof index.generatedAt, 'string');
  const rowRequired = schema.$defs.calendarRow.required;
  for (const row of index.calendar.rows) {
    for (const key of rowRequired) {
      assert.ok(Object.prototype.hasOwnProperty.call(row, key), `calendar row missing key: ${key}`);
    }
  }
  const gateRequired = schema.$defs.gate.required;
  for (const gate of index.gates) {
    for (const key of gateRequired) {
      assert.ok(Object.prototype.hasOwnProperty.call(gate, key), `gate missing key: ${key}`);
    }
  }
}
