import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isMemoryRecord } from './operator/cortex-memory.ts';

const doc = fs.readFileSync(new URL('../docs/memory/README.md', import.meta.url), 'utf8');
const fixture = JSON.parse(fs.readFileSync(new URL('../docs/memory/fixtures/demo-memory-export.json', import.meta.url), 'utf8'));
const privateLeak = /(thoughtseed|curious\.thoughtseed\.space|\/Users\/|\/Volumes\/|cs_live_|@[a-z0-9.-]+\.(com|io))/i;

test('memory portability docs define export, import, reset, and deletion semantics', () => {
  assert.match(doc, /## Export/);
  assert.match(doc, /## Import/);
  assert.match(doc, /## Reset and Deletion/);
  assert.match(doc, /## Threat Model/);
  assert.match(doc, /CortexStore/);
  assert.match(doc, /tenantScopedStore/);
});

test('synthetic memory export fixture uses valid MemoryRecord records', () => {
  assert.equal(fixture.schema, 'cambium.memory-export.v1');
  assert.equal(fixture.tenant, 'demo-org');
  assert.equal(fixture.generatedFrom, 'synthetic-fixture');
  assert.ok(fixture.records.length > 0);
  for (const record of fixture.records) {
    assert.ok(isMemoryRecord(record));
    assert.equal(record.tenant, fixture.tenant);
    assert.equal(record.vector.length, 4);
  }
});

test('memory portability docs and fixture stay free of private host data', () => {
  assert.doesNotMatch(doc, privateLeak);
  assert.doesNotMatch(JSON.stringify(fixture), privateLeak);
  assert.match(JSON.stringify(fixture), /example\.com/);
});
