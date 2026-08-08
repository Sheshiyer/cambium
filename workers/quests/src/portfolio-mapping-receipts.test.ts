import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import {
  PortfolioMappingReceiptConflictError,
  PortfolioMappingReceiptValidationError,
  canonicalMappingReceiptJson,
  createPortfolioMappingReceiptStore,
  preparePortfolioMappingReceipt,
} from './portfolio-mapping-receipts.ts';
import { PORTFOLIO_CATALOG } from './portfolio-catalog.ts';
import { PORTFOLIO_ROOT_MAP_DIGEST } from './portfolio-root-map.generated.ts';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

function input(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'thoughtseed.portfolio-mapping-receipt.v1',
    portfolioId: 'thoughtseed',
    batchId: 'github-batch-003-sapling-provenance',
    founderApprovalId: 'founder-direct-2026-08-09-batch3-mapping-receipts',
    decision: 'map-reviewed-repository',
    workObjectId: 'sapling:iverif',
    workObjectKind: 'sapling',
    originAssertion: 'thoughtseed-origin',
    repositoryRole: 'product-source',
    repository: {
      nameWithOwner: 'Sheshiyer/iverif-wiki',
      repositoryId: 'R_kgDOSwXJ7Q',
      databaseId: 1258670573,
      isFork: false,
      defaultBranchRef: 'main',
      pushedAt: '2026-08-07T00:45:09Z',
    },
    rootMap: {
      folder: 'iverif',
      additionalFolders: [],
      proposedKind: 'sapling',
      accountId: null,
      workIds: ['sapling:iverif'],
      status: 'mapping-proposal',
    },
    lifecycle: 'proposed',
    catalogDigest: PORTFOLIO_CATALOG.catalogDigest,
    classificationDigest: '18d5efd69376923be383043894124e7cdda27958a5f47aafe4a6db6342afe542',
    rootMapDigest: PORTFOLIO_ROOT_MAP_DIGEST,
    repositoryEvidenceDigest: '5f745a2cc079aa56b3799d7a719bc1f41d3239c5fc7eba300d5882ed8639530f',
    ...overrides,
  };
}

test('prepares one deterministic, digest-bound canonical mapping receipt', async () => {
  const first = await preparePortfolioMappingReceipt(input());
  const second = await preparePortfolioMappingReceipt(input());
  assert.deepEqual(second, first);
  assert.match(first.receiptId, /^pmr_[0-9a-f]{24}$/);
  assert.match(first.contentDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.r2Key, `portfolio/thoughtseed/workobjects/sapling:iverif/mapping/${first.receiptId}.json`);
  assert.equal(first.idempotencyKey, 'thoughtseed:github-batch-003-sapling-provenance:sapling:iverif:R_kgDOSwXJ7Q');
  assert.equal(first.status, 'prepared');
});

test('rejects stale provenance pins and non-canonical WorkObject identity', async () => {
  await assert.rejects(() => preparePortfolioMappingReceipt(input({ catalogDigest: `sha256:${'0'.repeat(64)}` })), PortfolioMappingReceiptValidationError);
  await assert.rejects(() => preparePortfolioMappingReceipt(input({ classificationDigest: '0'.repeat(64) })), PortfolioMappingReceiptValidationError);
  await assert.rejects(() => preparePortfolioMappingReceipt(input({ rootMapDigest: '0'.repeat(64) })), PortfolioMappingReceiptValidationError);
  await assert.rejects(() => preparePortfolioMappingReceipt(input({ workObjectId: 'sapling:not-catalogued' })), PortfolioMappingReceiptValidationError);
  await assert.rejects(() => preparePortfolioMappingReceipt(input({ workObjectKind: 'branch' })), PortfolioMappingReceiptValidationError);
});

test('rejects incomplete repository identity and inconsistent provenance', async () => {
  await assert.rejects(
    () => preparePortfolioMappingReceipt(input({ repository: { ...input().repository, databaseId: null } })),
    PortfolioMappingReceiptValidationError,
  );
  await assert.rejects(
    () => preparePortfolioMappingReceipt(input({ originAssertion: 'client-origin' })),
    PortfolioMappingReceiptValidationError,
  );
  await assert.rejects(
    () => preparePortfolioMappingReceipt(input({ rootMap: { ...input().rootMap, workIds: [] } })),
    PortfolioMappingReceiptValidationError,
  );
});

test('accepts a strict folderless root context without inventing a folder', async () => {
  const receipt = await preparePortfolioMappingReceipt(input({
    workObjectId: 'sapling:10869-space',
    repository: { ...input().repository, nameWithOwner: 'Sheshiyer/10869-space-v1', repositoryId: 'R_kgDOTH-UWA', databaseId: 1283429464 },
    rootMap: { folder: null, additionalFolders: [], proposedKind: null, accountId: null, workIds: [], status: 'no-shallow-folder' },
  }));
  assert.equal(receipt.rootMap.status, 'no-shallow-folder');
  assert.equal(receipt.rootMap.folder, null);
});

test('stores immutable evidence with exact replay and conflict semantics', async () => {
  const receipt = await preparePortfolioMappingReceipt(input());
  const values = new Map<string, string>();
  const bucket = {
    async get(key: string) {
      const value = values.get(key);
      return value === undefined ? null : { async text() { return value; } };
    },
    async put(key: string, bytes: Uint8Array, options?: { onlyIf?: { etagDoesNotMatch?: string } }) {
      assert.equal(options?.onlyIf?.etagDoesNotMatch, '*');
      if (values.has(key)) return null;
      const value = new TextDecoder().decode(bytes);
      values.set(key, value);
      return { async text() { return value; } };
    },
  };
  const store = createPortfolioMappingReceiptStore(bucket);
  assert.deepEqual(await store.record(receipt), { duplicate: false });
  assert.deepEqual(await store.record(receipt), { duplicate: true });
  assert.equal(values.get(receipt.r2Key), canonicalMappingReceiptJson(receipt));
  values.set(receipt.r2Key, canonicalMappingReceiptJson({ ...receipt, lifecycle: 'complete' }));
  await assert.rejects(() => store.record(receipt), PortfolioMappingReceiptConflictError);
});

test('store rejects a tampered compiled receipt before any R2 write', async () => {
  const receipt = await preparePortfolioMappingReceipt(input());
  let writes = 0;
  const store = createPortfolioMappingReceiptStore({
    async get() { return null; },
    async put() { writes += 1; return null; },
  });
  await assert.rejects(
    () => store.record({ ...receipt, contentDigest: `sha256:${'0'.repeat(64)}` }),
    PortfolioMappingReceiptValidationError,
  );
  assert.equal(writes, 0);
});
