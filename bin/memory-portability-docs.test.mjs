import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isMemoryRecord } from './operator/cortex-memory.ts';

const doc = fs.readFileSync(new URL('../docs/memory/README.md', import.meta.url), 'utf8');
const fixture = JSON.parse(fs.readFileSync(new URL('../docs/memory/fixtures/demo-memory-export.json', import.meta.url), 'utf8'));
const boundary = JSON.parse(fs.readFileSync(new URL('../docs/memory/boundary.json', import.meta.url), 'utf8'));
const privateLeak = /(thoughtseed|curious\.thoughtseed\.space|\/Users\/|\/Volumes\/|cs_live_|@[a-z0-9.-]+\.(com|io))/i;
const legacyMemoryIdentity = /(taste-nim|DESIGN_MEMORY_WORKER|aesthetic-memory NIM Worker|I3 follow-up)/;
const releaseFacingFiles = [
  '../README.md',
  '../ARCHITECTURE.md',
  '../HOMEOSTASIS.md',
  '../INFINITE-GAME.md',
  '../docs/architecture.html',
  '../docs/infinite-game-architecture.html',
  '../docs/organs.html',
  '../docs/organs/cortex.html',
  '../bin/lib/cortex.mjs',
];

test('memory portability docs define export, import, reset, and deletion semantics', () => {
  assert.match(doc, /## Export/);
  assert.match(doc, /## Import/);
  assert.match(doc, /## Reset and Deletion/);
  assert.match(doc, /## Threat Model/);
  assert.match(doc, /CortexStore/);
  assert.match(doc, /tenantScopedStore/);
  assert.match(doc, /docs\/memory\/boundary\.json/);
  assert.match(doc, /Runtime vs Adapter Memory/);
});

test('memory boundary classifies runtime adapter structural and synthetic surfaces', () => {
  assert.equal(boundary.schema, 'cambium.memory-boundary.v1');
  const scopes = new Set(boundary.surfaces.map((surface) => surface.scope));
  assert.ok(scopes.has('product-runtime'));
  assert.ok(scopes.has('adapter'));
  assert.ok(scopes.has('regenerated-structural-lane'));
  assert.ok(scopes.has('docs-and-tests'));
  assert.ok(boundary.surfaces.some((surface) => surface.id === 'taste-design-memory' && surface.commitPolicy.includes('outside the product repo')));
  assert.ok(boundary.forbiddenInProductRepo.includes('company-specific taste/design worker state'));
});

test('release-facing memory docs use provider-neutral identity', () => {
  for (const file of releaseFacingFiles) {
    const text = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(text, legacyMemoryIdentity, file);
  }
  assert.match(doc, /Taste\/design memory\*\* is an adapter capability/);
  assert.match(doc, /Product runtime memory/);
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
  assert.doesNotMatch(JSON.stringify(boundary), privateLeak);
  assert.match(JSON.stringify(fixture), /example\.com/);
});
