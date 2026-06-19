import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runbook = fs.readFileSync(new URL('../docs/adopters/new-adopter-30-minutes.md', import.meta.url), 'utf8');
const privateLeak = /(thoughtseed|curious\.thoughtseed\.space|\/Users\/|\/Volumes\/|cs_live_|@[a-z0-9.-]+\.(com|io))/i;

test('new adopter runbook preserves the standalone demo commands', () => {
  assert.match(runbook, /npm run demo:tenant -- --tenant demo-org --force/);
  assert.match(runbook, /npm run demo:quests -- --tenant demo-org/);
  assert.match(runbook, /npm run tapestry:snapshot -- --tenant demo-org --out \/tmp\/demo-org\.tapestry\.json/);
  assert.match(runbook, /npm run standalone:smoke/);
});

test('new adopter runbook speaks to the expected adopter profiles', () => {
  assert.match(runbook, /founder-led org/);
  assert.match(runbook, /marketing team/);
  assert.match(runbook, /dev\/AI team/);
});

test('new adopter runbook keeps adapters optional and fixtures synthetic', () => {
  assert.match(runbook, /docs\/adapters\/README\.md/);
  assert.match(runbook, /example\.com/);
  assert.match(runbook, /zero adapters/);
  assert.doesNotMatch(runbook, privateLeak);
});
