import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';

import {
  APPROVED_PREFIXES,
  CLASSIFICATIONS,
  sha256Stream,
  collectPrefixInventory,
  classifyInventory,
  writeRedactedReceipt,
} from './cloudflare-r2-source-inventory.mjs';

import {
  createSyntheticR2Store,
} from './cloudflare-r2-inventory-local-worker.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

const NOW = new Date('2026-09-28T12:00:00Z').toISOString();
const OLDER = new Date('2026-09-20T08:00:00Z').toISOString();
const NEWER = new Date('2026-09-28T18:00:00Z').toISOString();

const VAULT_PREFIX = 'portfolio/thoughtseed/workobjects/';
const CONTEXT_PREFIX = 'context/v1/daily-standup-digest/standups/';

function readBody(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (d) => chunks.push(d));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

/**
 * Wrap a synthetic R2 store into the injected-client interface that
 * collectPrefixInventory expects (async list/head/get with no write methods).
 */
function storeClient(store) {
  return {
    list: (args) => store.list(args),
    head: (key) => store.head(key),
    get: (key) => store.get(key),
  };
}

// ---------------------------------------------------------------------------
// sha256Stream
// ---------------------------------------------------------------------------

test('sha256Stream computes correct digest for known content', async () => {
  const expected = sha256('hello cambium');
  const stream = Readable.from([Buffer.from('hello cambium')]);
  const result = await sha256Stream(stream);
  assert.equal(result, expected);
});

test('sha256Stream handles empty stream', async () => {
  const expected = sha256('');
  const stream = Readable.from([]);
  const result = await sha256Stream(stream);
  assert.equal(result, expected);
});

test('sha256Stream handles multi-chunk stream', async () => {
  const content = 'chunk1-chunk2-chunk3';
  const expected = sha256(content);
  const stream = Readable.from([Buffer.from('chunk1-'), Buffer.from('chunk2-'), Buffer.from('chunk3')]);
  const result = await sha256Stream(stream);
  assert.equal(result, expected);
});

// ---------------------------------------------------------------------------
// Synthetic R2 store
// ---------------------------------------------------------------------------

test('synthetic store list returns objects with correct metadata', async () => {
  const store = createSyntheticR2Store({
    [VAULT_PREFIX + 'obj-a.json']: { body: '{"a":1}' },
  });
  const result = await store.list({ prefix: VAULT_PREFIX });
  assert.equal(result.objects.length, 1);
  assert.equal(result.objects[0].key, VAULT_PREFIX + 'obj-a.json');
  assert.equal(result.objects[0].size, Buffer.byteLength('{"a":1}'));
  assert.equal(result.truncated, false);
});

test('synthetic store head returns metadata for known key', async () => {
  const store = createSyntheticR2Store({
    [VAULT_PREFIX + 'obj-b.md']: { body: '# Doc' },
  });
  const result = await store.head(VAULT_PREFIX + 'obj-b.md');
  assert.ok(result);
  assert.equal(result.key, VAULT_PREFIX + 'obj-b.md');
  assert.equal(result.size, Buffer.byteLength('# Doc'));
});

test('synthetic store head returns null for unknown key', async () => {
  const store = createSyntheticR2Store({});
  const result = await store.head(VAULT_PREFIX + 'missing.json');
  assert.equal(result, null);
});

test('synthetic store get returns body stream', async () => {
  const store = createSyntheticR2Store({
    [VAULT_PREFIX + 'obj-c.txt']: { body: 'content' },
  });
  const result = await store.get(VAULT_PREFIX + 'obj-c.txt');
  assert.ok(result);
  assert.ok(result.body);
  const text = await readBody(result.body);
  assert.equal(text, 'content');
});

test('synthetic store get returns null for missing key', async () => {
  const store = createSyntheticR2Store({});
  const result = await store.get(VAULT_PREFIX + 'nope.txt');
  assert.equal(result, null);
});

test('synthetic store list paginates correctly', async () => {
  const objects = {};
  for (let i = 0; i < 5; i++) {
    objects[VAULT_PREFIX + `item-${String(i).padStart(3, '0')}.json`] = { body: `{"i":${i}}` };
  }
  const store = createSyntheticR2Store(objects);

  const page1 = await store.list({ prefix: VAULT_PREFIX, limit: 2 });
  assert.equal(page1.objects.length, 2);
  assert.equal(page1.truncated, true);
  assert.ok(page1.cursor);

  const page2 = await store.list({ prefix: VAULT_PREFIX, cursor: page1.cursor, limit: 2 });
  assert.equal(page2.objects.length, 2);
  assert.equal(page2.truncated, true);

  const page3 = await store.list({ prefix: VAULT_PREFIX, cursor: page2.cursor, limit: 2 });
  assert.equal(page3.objects.length, 1);
  assert.equal(page3.truncated, false);
});

// ---------------------------------------------------------------------------
// collectPrefixInventory — with injected mock clients
// ---------------------------------------------------------------------------

test('collectPrefixInventory rejects non-approved prefix', async () => {
  const store = createSyntheticR2Store({});
  await assert.rejects(
    () => collectPrefixInventory({ client: storeClient(store), binding: 'THOUGHTSEED_VAULT', prefix: 'bad/prefix/' }),
    /not in the approved scope/,
  );
});

test('collectPrefixInventory rejects client with write methods', async () => {
  const client = {
    async list() { return { objects: [], truncated: false }; },
    async head() { return null; },
    async get() { return null; },
    async put() { /* forbidden */ },
  };
  await assert.rejects(
    () => collectPrefixInventory({ client, binding: 'THOUGHTSEED_VAULT', prefix: VAULT_PREFIX }),
    /write method "put"/,
  );
});

test('collectPrefixInventory fails closed on truncated page with no cursor', async () => {
  const client = {
    async list() {
      return { objects: [{ key: 'k', size: 1, lastModified: NOW, etag: '"a"' }], truncated: true, cursor: undefined };
    },
    async head(key) { return { key, size: 1, lastModified: NOW, etag: '"a"' }; },
    async get(key) { return { body: Readable.from([Buffer.from('x')]) }; },
  };
  await assert.rejects(
    () => collectPrefixInventory({ client, binding: 'THOUGHTSEED_VAULT', prefix: VAULT_PREFIX }),
    /truncated.*no cursor/,
  );
});

test('collectPrefixInventory fails closed on duplicate keys across pages', async () => {
  let calls = 0;
  const client = {
    async list() {
      calls += 1;
      if (calls === 1) {
        return { objects: [{ key: 'dup', size: 1, lastModified: NOW, etag: '"a"' }], truncated: true, cursor: 'dup' };
      }
      return { objects: [{ key: 'dup', size: 2, lastModified: NOW, etag: '"b"' }], truncated: false };
    },
    async head(key) { return { key, size: 1, lastModified: NOW, etag: '"a"' }; },
    async get(key) { return { body: Readable.from([Buffer.from('x')]) }; },
  };
  await assert.rejects(
    () => collectPrefixInventory({ client, binding: 'THOUGHTSEED_VAULT', prefix: VAULT_PREFIX }),
    /Duplicate key/,
  );
});

test('collectPrefixInventory collects single object with correct digest', async () => {
  const body = '{"vault":"item"}';
  const expectedHash = sha256(body);
  const key = VAULT_PREFIX + 'item-001.json';

  const store = createSyntheticR2Store({ [key]: { body } });
  const inv = await collectPrefixInventory({ client: storeClient(store), binding: 'THOUGHTSEED_VAULT', prefix: VAULT_PREFIX });

  assert.equal(inv.size, 1);
  const rec = inv.get(key);
  assert.equal(rec.sha256, expectedHash);
  assert.equal(rec.size, Buffer.byteLength(body));
});

test('collectPrefixInventory paginates across multiple pages', async () => {
  const key1 = VAULT_PREFIX + 'a.json';
  const key2 = VAULT_PREFIX + 'b.json';
  const key3 = VAULT_PREFIX + 'c.json';
  const body1 = 'aaa', body2 = 'bbb', body3 = 'ccc';

  // Use the synthetic store with small pages — it handles pagination internally
  const store = createSyntheticR2Store({
    [key1]: { body: body1 },
    [key2]: { body: body2 },
    [key3]: { body: body3 },
  });
  const inv = await collectPrefixInventory({
    client: storeClient(store),
    binding: 'THOUGHTSEED_VAULT',
    prefix: VAULT_PREFIX,
    pageSize: 1,
  });

  assert.equal(inv.size, 3);
  assert.equal(inv.get(key1).sha256, sha256(body1));
  assert.equal(inv.get(key2).sha256, sha256(body2));
  assert.equal(inv.get(key3).sha256, sha256(body3));
});

test('collectPrefixInventory returns empty map for empty store', async () => {
  const store = createSyntheticR2Store({});
  const inv = await collectPrefixInventory({ client: storeClient(store), binding: 'THOUGHTSEED_VAULT', prefix: VAULT_PREFIX });
  assert.equal(inv.size, 0);
});

// ---------------------------------------------------------------------------
// classifyInventory
// ---------------------------------------------------------------------------

test('classifyInventory correctly classifies all categories', () => {
  const sourceInv = new Map([
    ['identical.json', { key: 'identical.json', sha256: sha256('same'), lastModified: OLDER }],
    ['source-only.json', { key: 'source-only.json', sha256: sha256('src'), lastModified: OLDER }],
    ['conflicting.json', { key: 'conflicting.json', sha256: sha256('src-v'), lastModified: OLDER }],
    ['newer.json', { key: 'newer.json', sha256: sha256('src-old'), lastModified: OLDER }],
  ]);
  const targetInv = new Map([
    ['identical.json', { key: 'identical.json', sha256: sha256('same'), lastModified: OLDER }],
    ['target-only.json', { key: 'target-only.json', sha256: sha256('tgt'), lastModified: NOW }],
    ['conflicting.json', { key: 'conflicting.json', sha256: sha256('tgt-v'), lastModified: OLDER }],
    ['newer.json', { key: 'newer.json', sha256: sha256('tgt-new'), lastModified: NEWER }],
  ]);

  const { classified, unresolved } = classifyInventory({ sourceInventory: sourceInv, targetInventory: targetInv });

  assert.equal(unresolved.length, 0);
  assert.equal(classified.size, 5);
  assert.equal(classified.get('identical.json').classification, CLASSIFICATIONS.IDENTICAL);
  assert.equal(classified.get('source-only.json').classification, CLASSIFICATIONS.SOURCE_ONLY);
  assert.equal(classified.get('target-only.json').classification, CLASSIFICATIONS.TARGET_ONLY);
  assert.equal(classified.get('conflicting.json').classification, CLASSIFICATIONS.CONFLICTING);
  assert.equal(classified.get('newer.json').classification, CLASSIFICATIONS.TARGET_NEWER);
});

test('classifyInventory marks missing sha256 as unresolved', () => {
  const sourceInv = new Map([
    ['no-hash.json', { key: 'no-hash.json', sha256: null, lastModified: OLDER }],
  ]);
  const targetInv = new Map([
    ['no-hash.json', { key: 'no-hash.json', sha256: sha256('x'), lastModified: NOW }],
  ]);

  const { classified, unresolved } = classifyInventory({ sourceInventory: sourceInv, targetInventory: targetInv });
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0], 'no-hash.json');
  assert.equal(classified.get('no-hash.json').classification, CLASSIFICATIONS.UNRESOLVED);
});

test('classifyInventory handles empty inventories', () => {
  const empty = new Map();
  const { classified, unresolved } = classifyInventory({ sourceInventory: empty, targetInventory: empty });
  assert.equal(classified.size, 0);
  assert.equal(unresolved.length, 0);
});

test('classifyInventory marks both-null-digest as unresolved', () => {
  const sourceInv = new Map([
    ['both-null.json', { key: 'both-null.json', sha256: null, lastModified: OLDER }],
  ]);
  const targetInv = new Map([
    ['both-null.json', { key: 'both-null.json', sha256: null, lastModified: NOW }],
  ]);
  const { classified, unresolved } = classifyInventory({ sourceInventory: sourceInv, targetInventory: targetInv });
  assert.equal(unresolved.length, 1);
  assert.equal(classified.get('both-null.json').classification, CLASSIFICATIONS.UNRESOLVED);
});

test('classifyInventory uses same timestamp as conflicting when timestamps match', () => {
  const sourceInv = new Map([
    ['diff.json', { key: 'diff.json', sha256: sha256('a'), lastModified: NOW }],
  ]);
  const targetInv = new Map([
    ['diff.json', { key: 'diff.json', sha256: sha256('b'), lastModified: NOW }],
  ]);
  const { classified } = classifyInventory({ sourceInventory: sourceInv, targetInventory: targetInv });
  assert.equal(classified.get('diff.json').classification, CLASSIFICATIONS.CONFLICTING);
});

// ---------------------------------------------------------------------------
// writeRedactedReceipt — privacy boundary
// ---------------------------------------------------------------------------

test('writeRedactedReceipt contains no per-object metadata in receipt body', () => {
  const srcKey = VAULT_PREFIX + 'secret.json';
  const sourceInv = new Map([
    [srcKey, { key: srcKey, size: 42, sha256: sha256('x') }],
  ]);
  const targetInv = new Map([
    [srcKey, { key: srcKey, size: 42, sha256: sha256('x') }],
  ]);
  const classification = {
    classified: new Map([
      [srcKey, { key: srcKey, classification: CLASSIFICATIONS.IDENTICAL }],
    ]),
    unresolved: [],
  };

  const dir = mkdtempSync(join(tmpdir(), 'cambium-receipt-'));
  const outputPath = join(dir, 'receipt.json');

  const receipt = writeRedactedReceipt({
    classification,
    sourceInventory: sourceInv,
    targetInventory: targetInv,
    outputPath,
    runStart: new Date('2026-09-28T10:00:00Z'),
    runEnd: new Date('2026-09-28T10:05:00Z'),
  });

  const raw = readFileSync(outputPath, 'utf-8');
  const parsed = JSON.parse(raw);

  // Privacy: no per-object keys, sizes, ETags, or digests
  assert.ok(!raw.includes('secret.json'), 'receipt must not contain object key filenames');
  assert.ok(!parsed.size, 'receipt top level must not contain size field');
  assert.ok(!parsed.etag, 'receipt top level must not contain etag field');
  assert.ok(!parsed.key, 'receipt top level must not contain key field');

  // Structure
  assert.equal(parsed.schema, 'cambium.cloudflare-r2-inventory-receipt.v1');
  assert.equal(parsed.version, 1);
  assert.equal(parsed.sourceObjectCount, 1);
  assert.equal(parsed.targetObjectCount, 1);
  assert.ok(parsed.inventoryDigest, 'must have inventory digest');
  assert.equal(parsed.classificationTotals.identical, 1);
  assert.equal(parsed.unresolvedCount, 0);
  assert.equal(parsed.scopes.length, 2);

  // Scopes match approved prefixes
  assert.equal(parsed.scopes[0].prefix, VAULT_PREFIX);
  assert.equal(parsed.scopes[1].prefix, CONTEXT_PREFIX);
});

test('writeRedactedReceipt aggregates classification totals correctly', () => {
  const sourceInv = new Map([
    ['a.json', { key: 'a.json', sha256: sha256('a') }],
    ['b.json', { key: 'b.json', sha256: sha256('b') }],
    ['c.json', { key: 'c.json', sha256: sha256('c') }],
  ]);
  const targetInv = new Map([
    ['a.json', { key: 'a.json', sha256: sha256('a') }],
    ['b.json', { key: 'b.json', sha256: sha256('b-new') }],
    ['d.json', { key: 'd.json', sha256: sha256('d') }],
  ]);
  const classification = {
    classified: new Map([
      ['a.json', { key: 'a.json', classification: CLASSIFICATIONS.IDENTICAL }],
      ['b.json', { key: 'b.json', classification: CLASSIFICATIONS.CONFLICTING }],
      ['c.json', { key: 'c.json', classification: CLASSIFICATIONS.SOURCE_ONLY }],
      ['d.json', { key: 'd.json', classification: CLASSIFICATIONS.TARGET_ONLY }],
    ]),
    unresolved: [],
  };

  const dir = mkdtempSync(join(tmpdir(), 'cambium-receipt-'));
  const receipt = writeRedactedReceipt({
    classification,
    sourceInventory: sourceInv,
    targetInventory: targetInv,
    outputPath: join(dir, 'receipt.json'),
  });

  assert.equal(receipt.classificationTotals.identical, 1);
  assert.equal(receipt.classificationTotals.conflicting, 1);
  assert.equal(receipt.classificationTotals['source-only'], 1);
  assert.equal(receipt.classificationTotals['target-only'], 1);
  assert.equal(receipt.classificationTotals['source-only'], 1);
});

test('writeRedactedReceipt reports unresolved count', () => {
  const sourceInv = new Map([['x.json', { key: 'x.json', sha256: null }]]);
  const targetInv = new Map([['x.json', { key: 'x.json', sha256: sha256('v') }]]);
  const classification = {
    classified: new Map([['x.json', { key: 'x.json', classification: CLASSIFICATIONS.UNRESOLVED }]]),
    unresolved: ['x.json'],
  };

  const dir = mkdtempSync(join(tmpdir(), 'cambium-receipt-'));
  const receipt = writeRedactedReceipt({
    classification,
    sourceInventory: sourceInv,
    targetInventory: targetInv,
    outputPath: join(dir, 'receipt.json'),
  });

  assert.equal(receipt.unresolvedCount, 1);
});

// ---------------------------------------------------------------------------
// End-to-end: collect → classify → receipt via synthetic stores
// ---------------------------------------------------------------------------

test('end-to-end synthetic inventory with both approved prefixes', async () => {
  const vSrcStore = createSyntheticR2Store({
    [VAULT_PREFIX + 'shared.json']: { body: '{"shared":true}', lastModified: OLDER },
    [VAULT_PREFIX + 'src-unique.md']: { body: 'unique to source' },
    [VAULT_PREFIX + 'conflict.json']: { body: '{"v":"source"}', lastModified: OLDER },
    [VAULT_PREFIX + 'newer-tgt.json']: { body: '{"v":"old"}', lastModified: OLDER },
  });
  const vTgtStore = createSyntheticR2Store({
    [VAULT_PREFIX + 'shared.json']: { body: '{"shared":true}', lastModified: OLDER },
    [VAULT_PREFIX + 'tgt-unique.md']: { body: 'unique to target' },
    [VAULT_PREFIX + 'conflict.json']: { body: '{"v":"target"}', lastModified: OLDER },
    [VAULT_PREFIX + 'newer-tgt.json']: { body: '{"v":"new"}', lastModified: NEWER },
  });
  const cSrcStore = createSyntheticR2Store({
    [CONTEXT_PREFIX + 'digest-001.json']: { body: '{"d":1}' },
  });
  const cTgtStore = createSyntheticR2Store({
    [CONTEXT_PREFIX + 'digest-001.json']: { body: '{"d":1}' },
  });

  const runStart = new Date();

  // Collect all four scopes
  const srcVaultInv = await collectPrefixInventory({
    client: storeClient(vSrcStore), binding: 'THOUGHTSEED_VAULT', prefix: VAULT_PREFIX,
  });
  const tgtVaultInv = await collectPrefixInventory({
    client: storeClient(vTgtStore), binding: 'THOUGHTSEED_VAULT', prefix: VAULT_PREFIX,
  });
  const srcCtxInv = await collectPrefixInventory({
    client: storeClient(cSrcStore), binding: 'CONTEXT_PROJECTIONS', prefix: CONTEXT_PREFIX,
  });
  const tgtCtxInv = await collectPrefixInventory({
    client: storeClient(cTgtStore), binding: 'CONTEXT_PROJECTIONS', prefix: CONTEXT_PREFIX,
  });

  // Merge for classification
  const allSrc = new Map([...srcVaultInv, ...srcCtxInv]);
  const allTgt = new Map([...tgtVaultInv, ...tgtCtxInv]);

  assert.equal(allSrc.size, 5); // 4 vault + 1 context
  assert.equal(allTgt.size, 5);

  const classification = classifyInventory({ sourceInventory: allSrc, targetInventory: allTgt });
  assert.equal(classification.unresolved.length, 0);
  assert.equal(classification.classified.size, 6); // 4 unique vault keys + shared + context

  // Verify specific classifications
  assert.equal(
    classification.classified.get(VAULT_PREFIX + 'shared.json').classification,
    CLASSIFICATIONS.IDENTICAL,
  );
  assert.equal(
    classification.classified.get(VAULT_PREFIX + 'src-unique.md').classification,
    CLASSIFICATIONS.SOURCE_ONLY,
  );
  assert.equal(
    classification.classified.get(VAULT_PREFIX + 'tgt-unique.md').classification,
    CLASSIFICATIONS.TARGET_ONLY,
  );
  assert.equal(
    classification.classified.get(VAULT_PREFIX + 'conflict.json').classification,
    CLASSIFICATIONS.CONFLICTING,
  );
  assert.equal(
    classification.classified.get(VAULT_PREFIX + 'newer-tgt.json').classification,
    CLASSIFICATIONS.TARGET_NEWER,
  );
  assert.equal(
    classification.classified.get(CONTEXT_PREFIX + 'digest-001.json').classification,
    CLASSIFICATIONS.IDENTICAL,
  );

  // Write receipt
  const dir = mkdtempSync(join(tmpdir(), 'cambium-e2e-'));
  const receipt = writeRedactedReceipt({
    classification,
    sourceInventory: allSrc,
    targetInventory: allTgt,
    outputPath: join(dir, 'e2e-receipt.json'),
    runStart,
    runEnd: new Date(),
  });

  assert.equal(receipt.sourceObjectCount, 5);
  assert.equal(receipt.targetObjectCount, 5);
  assert.equal(receipt.unresolvedCount, 0);
  assert.equal(receipt.classificationTotals.identical, 2);
  assert.equal(receipt.classificationTotals['source-only'], 1);
  assert.equal(receipt.classificationTotals['target-only'], 1);
  assert.equal(receipt.classificationTotals.conflicting, 1);
  assert.equal(receipt.classificationTotals['target-newer'], 1);

  // Verify SHA-256 digests were computed
  for (const [, rec] of allSrc) {
    assert.ok(rec.sha256, `source key ${rec.key} must have sha256`);
  }
  for (const [, rec] of allTgt) {
    assert.ok(rec.sha256, `target key ${rec.key} must have sha256`);
  }
});

// ---------------------------------------------------------------------------
// Write-operation safety guard
// ---------------------------------------------------------------------------

test('client with delete method is rejected by collectPrefixInventory', async () => {
  const client = {
    async list() { return { objects: [], truncated: false }; },
    async head() { return null; },
    async get() { return null; },
    async delete() {},
  };
  await assert.rejects(
    () => collectPrefixInventory({ client, binding: 'THOUGHTSEED_VAULT', prefix: VAULT_PREFIX }),
    /write method/,
  );
});

// ---------------------------------------------------------------------------
// Metadata drift detection
// ---------------------------------------------------------------------------

test('collectPrefixInventory fails on size drift between list and head', async () => {
  const key = VAULT_PREFIX + 'drift.json';
  const client = {
    async list() {
      return { objects: [{ key, size: 100, lastModified: NOW, etag: '"e1"' }], truncated: false };
    },
    async head(key) {
      return { key, size: 200, lastModified: NOW, etag: '"e1"' };
    },
    async get(key) {
      return { body: Readable.from([Buffer.from('data')]) };
    },
  };
  await assert.rejects(
    () => collectPrefixInventory({ client, binding: 'THOUGHTSEED_VAULT', prefix: VAULT_PREFIX }),
    /Metadata drift/,
  );
});

test('collectPrefixInventory fails on ETag drift between list and head', async () => {
  const key = VAULT_PREFIX + 'etag-drift.json';
  const client = {
    async list() {
      return { objects: [{ key, size: 50, lastModified: NOW, etag: '"old"' }], truncated: false };
    },
    async head(key) {
      return { key, size: 50, lastModified: NOW, etag: '"new"' };
    },
    async get(key) {
      return { body: Readable.from([Buffer.from('data')]) };
    },
  };
  await assert.rejects(
    () => collectPrefixInventory({ client, binding: 'THOUGHTSEED_VAULT', prefix: VAULT_PREFIX }),
    /ETag drift/,
  );
});

test('collectPrefixInventory succeeds when head has no etag but list does', async () => {
  const key = VAULT_PREFIX + 'no-head-etag.json';
  const body = 'test-body';
  const client = {
    async list() {
      return { objects: [{ key, size: Buffer.byteLength(body), lastModified: NOW, etag: '"e1"' }], truncated: false };
    },
    async head(key) {
      return { key, size: Buffer.byteLength(body), lastModified: NOW, etag: null };
    },
    async get(key) {
      return { body: Readable.from([Buffer.from(body)]) };
    },
  };
  const inv = await collectPrefixInventory({ client, binding: 'THOUGHTSEED_VAULT', prefix: VAULT_PREFIX });
  assert.equal(inv.size, 1);
  assert.equal(inv.get(key).sha256, sha256(body));
});

// ---------------------------------------------------------------------------
// Local worker module — synthetic store test
// ---------------------------------------------------------------------------

test('local worker synthetic store supports prefix filtering', async () => {
  const store = createSyntheticR2Store({
    [VAULT_PREFIX + 'a.json']: { body: 'a' },
    [CONTEXT_PREFIX + 'b.json']: { body: 'b' },
  });
  const vaultResult = await store.list({ prefix: VAULT_PREFIX });
  assert.equal(vaultResult.objects.length, 1);
  assert.equal(vaultResult.objects[0].key, VAULT_PREFIX + 'a.json');

  const ctxResult = await store.list({ prefix: CONTEXT_PREFIX });
  assert.equal(ctxResult.objects.length, 1);
  assert.equal(ctxResult.objects[0].key, CONTEXT_PREFIX + 'b.json');
});

test('local worker synthetic store get returns fresh streams for repeated reads', async () => {
  const store = createSyntheticR2Store({
    [VAULT_PREFIX + 'repeated.json']: { body: 'same' },
  });
  const r1 = await store.get(VAULT_PREFIX + 'repeated.json');
  const r2 = await store.get(VAULT_PREFIX + 'repeated.json');
  assert.equal(await readBody(r1.body), 'same');
  assert.equal(await readBody(r2.body), 'same');
});

test('local worker storeClient adapter does not expose write methods', () => {
  const store = createSyntheticR2Store({});
  const client = storeClient(store);
  assert.equal(typeof client.put, 'undefined');
  assert.equal(typeof client.delete, 'undefined');
  assert.equal(typeof client.copy, 'undefined');
  assert.equal(typeof client.createMultipartUpload, 'undefined');
  assert.equal(typeof client.list, 'function');
  assert.equal(typeof client.head, 'function');
  assert.equal(typeof client.get, 'function');
});
