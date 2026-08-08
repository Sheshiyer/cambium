import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildMissionFabricProjection } from './mission-fabric.ts';
import { FABRIC_SOURCE_FIXTURE } from './mission-fabric-fixture.ts';
import {
  buildPortfolioJoinReport,
  PORTFOLIO_CATALOG,
  PORTFOLIO_CLASSIFICATION_DIGEST,
  portfolioCatalogForViewer,
  portfolioPairDigest,
  validatePortfolioCatalog,
} from './portfolio-catalog.ts';

function mutableCatalog(): Record<string, any> {
  return JSON.parse(JSON.stringify(PORTFOLIO_CATALOG)) as Record<string, any>;
}

test('static catalog has the pinned schema, provenance, authority, counts, and digests', () => {
  validatePortfolioCatalog(PORTFOLIO_CATALOG);
  assert.equal(PORTFOLIO_CATALOG.schema, 'cambium.portfolio-catalog.v1');
  assert.equal(PORTFOLIO_CATALOG.sourceSchema, 'thoughtseed.work-object-registry.v1');
  assert.equal(PORTFOLIO_CATALOG.sourceGeneratedAt, '2026-07-29T06:46:00Z');
  assert.equal(PORTFOLIO_CATALOG.status, 'proposed-read-only');
  assert.equal(PORTFOLIO_CATALOG.readOnly, true);
  assert.deepEqual(PORTFOLIO_CATALOG.authority, {
    classification: 'vault',
    operational: 'd1-goal-graph',
  });
  assert.equal(PORTFOLIO_CATALOG.classificationDigest, PORTFOLIO_CLASSIFICATION_DIGEST);
  assert.equal(PORTFOLIO_CLASSIFICATION_DIGEST, '18d5efd69376923be383043894124e7cdda27958a5f47aafe4a6db6342afe542');
  assert.equal(PORTFOLIO_CATALOG.catalogDigest, 'sha256:2afdfd8d8f5642546a75daa395c51a73e6fe032d84ddd5d19af3d08b7b93b45c');
  assert.deepEqual(PORTFOLIO_CATALOG.summary, {
    total: 74,
    saplings: 21,
    clientBranches: 38,
    internalPrograms: 15,
    classificationReview: 0,
    historicalProducts: 20,
    operationalGaps: 49,
  });
  assert.equal(PORTFOLIO_CATALOG.records.length, 74);
  assert.equal(PORTFOLIO_CATALOG.historicalProducts.length, 20);
  assert.equal(PORTFOLIO_CATALOG.classificationReview.length, 0);
  assert.equal(PORTFOLIO_CATALOG.operationalGaps.length, 49);
});

test('catalog identities are unique, canonical, type-correct, and enum bounded', () => {
  const ids = PORTFOLIO_CATALOG.records.map((record) => record.workId);
  assert.equal(new Set(ids).size, 74);
  assert.equal(PORTFOLIO_CATALOG.records.filter((record) => record.classification === 'sapling').length, 21);
  assert.equal(PORTFOLIO_CATALOG.records.filter((record) => record.classification === 'client-branch').length, 38);
  assert.equal(PORTFOLIO_CATALOG.records.filter((record) => record.classification === 'internal-program').length, 15);

  for (const record of PORTFOLIO_CATALOG.records) {
    assert.equal(record.canonicalId, record.workId);
    assert.match(record.workId, /^(?:sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*$/);
    if (record.classification === 'sapling') {
      assert.equal(record.kind, 'sapling');
      assert.match(record.workId, /^sapling:/);
      assert.ok(record.promotionState === 'proof-only' || record.promotionState === 'supervised-branch');
      assert.equal(record.programKind, undefined);
      assert.equal(record.lifecycle, undefined);
    } else {
      assert.equal(record.kind, 'program');
      assert.ok(['client', 'company', 'capability', 'operations'].includes(record.programKind!));
      assert.ok(['proposed', 'approved', 'executing', 'verifying', 'complete', 'retired'].includes(record.lifecycle!));
      assert.match(record.workId, record.programKind === 'client' ? /^branch:/ : /^program:/);
      assert.equal(record.promotionState, undefined);
    }
  }
});

test('validation fails closed on digest drift, duplicate identity, invalid enum, and live fields', () => {
  const digestDrift = mutableCatalog();
  digestDrift.records[0].name = 'Drifted name';
  assert.throws(() => validatePortfolioCatalog(digestDrift), /catalog digest does not match/);

  const classificationDrift = mutableCatalog();
  classificationDrift.classificationDigest = '0'.repeat(64);
  assert.throws(() => validatePortfolioCatalog(classificationDrift), /classification digest drifted/);

  const duplicate = mutableCatalog();
  duplicate.records[1] = duplicate.records[0];
  assert.throws(() => validatePortfolioCatalog(duplicate), /duplicate WorkObject identity/);

  const invalidEnum = mutableCatalog();
  invalidEnum.records.find((record: any) => record.kind === 'program').lifecycle = 'paused';
  assert.throws(() => validatePortfolioCatalog(invalidEnum), /lifecycle has an invalid enum value/);

  const operationalLeak = mutableCatalog();
  operationalLeak.records[0].currentState = 'active';
  assert.throws(() => validatePortfolioCatalog(operationalLeak), /live operational field/);
});

test('catalog contains no absolute path and rejects path leakage', () => {
  assert.doesNotMatch(JSON.stringify(PORTFOLIO_CATALOG), /(?:^|")\/Volumes\//);
  const leaked = mutableCatalog();
  leaked.records[0].provenance = ['/Volumes/private/source.md'];
  assert.throws(() => validatePortfolioCatalog(leaked), /absolute path/);
});

test('Fitcheck keeps exact parent and aliases without tenant authority', () => {
  const fitcheck = PORTFOLIO_CATALOG.records.find((record) => record.workId === 'sapling:fitcheck')!;
  assert.ok(fitcheck);
  assert.equal(fitcheck.parentTenant, 'cambium');
  assert.deepEqual(fitcheck.tenantIdentity, { status: 'canonical-parent', tenantId: 'cambium' });
  assert.deepEqual(fitcheck.aliases.map((alias) => alias.value), ['FitCheck', 'getfitcheck']);
  assert.ok(fitcheck.aliases.every((alias) => alias.tenantAuthority === false));
  assert.equal(PORTFOLIO_CATALOG.records.some((record) => record.workId === 'sapling:getfitcheck'), false);
});

test('mixed-source linked identities remain separate records', () => {
  for (const [left, right] of [
    ['sapling:parkarea', 'branch:parkarea'],
    ['sapling:tirak', 'branch:tirak'],
    ['sapling:seedforge', 'program:teamforge-control-plane'],
  ]) {
    const leftRecord = PORTFOLIO_CATALOG.records.find((record) => record.workId === left)!;
    const rightRecord = PORTFOLIO_CATALOG.records.find((record) => record.workId === right)!;
    assert.ok(leftRecord);
    assert.ok(rightRecord);
    assert.notEqual(leftRecord, rightRecord);
    assert.ok(leftRecord.linkedCanonicalIds.includes(right));
    assert.ok(rightRecord.linkedCanonicalIds.includes(left));
  }
});

test('viewer projection returns founder detail and aggregate-only viewer output', () => {
  const founder = portfolioCatalogForViewer(PORTFOLIO_CATALOG, 'founder');
  assert.equal(founder.detail, PORTFOLIO_CATALOG);
  assert.equal(founder.summary, PORTFOLIO_CATALOG.summary);
  const viewer = portfolioCatalogForViewer(PORTFOLIO_CATALOG, 'viewer');
  assert.equal(viewer.detail, null);
  assert.equal(viewer.summary, PORTFOLIO_CATALOG.summary);
  assert.doesNotMatch(JSON.stringify(viewer), /Fitcheck|ParkArea|SeedForge/);
});

test('type-aware canonical joins accept only exact or allowed legacy wire forms', () => {
  const report = buildPortfolioJoinReport(PORTFOLIO_CATALOG, [
    { kind: 'work', value: { kind: 'sapling', workId: 'sapling-fitcheck' } },
    { kind: 'program', programKind: 'client', workId: 'parkarea' },
    { kind: 'work', value: { kind: 'program', programKind: 'capability', workId: 'teamforge-control-plane' } },
    { kind: 'sapling', workId: 'sapling:cambium' },
    { kind: 'program', programKind: 'client', workId: 'program:cambium-operating-fabric' },
    { kind: 'program', programKind: 'capability', workId: 'branch:parkarea' },
    { kind: 'sapling', workId: 'fitcheck' },
    { kind: 'program', programKind: 'unknown', workId: 'operator-utilities' },
  ]);
  assert.deepEqual(report.matches.map((match) => match.canonicalId), [
    'program:teamforge-control-plane',
    'sapling:cambium',
    'sapling:fitcheck',
  ]);
  assert.equal(report.matchedCount, 3);
  assert.deepEqual(report.runtimeOrphans, ['branch:parkarea']);
  assert.equal(report.catalogOrphanCount, 71);
});

test('canonical join never falls back to matching names or aliases', () => {
  const report = buildPortfolioJoinReport(PORTFOLIO_CATALOG, [
    { kind: 'sapling', workId: 'sapling:not-fitcheck', name: 'Fitcheck' },
    { kind: 'program', programKind: 'client', workId: 'getfitcheck', name: 'FitCheck' },
  ]);
  assert.equal(report.matchedCount, 0);
  assert.deepEqual(report.runtimeOrphans, ['branch:getfitcheck', 'sapling:not-fitcheck']);
});

test('unresolved, unverified, and tenant-mismatched records cannot create an operational join', () => {
  const unresolved = buildPortfolioJoinReport(PORTFOLIO_CATALOG, [
    { kind: 'sapling', workId: 'sapling:iverif' },
    { kind: 'program', programKind: 'client', workId: 'mathis' },
  ], 'cambium');
  assert.equal(unresolved.matchedCount, 0);
  assert.deepEqual(unresolved.runtimeOrphans, ['branch:mathis', 'sapling:iverif']);

  const mismatched = buildPortfolioJoinReport(PORTFOLIO_CATALOG, [
    { kind: 'sapling', workId: 'sapling:cambium' },
    { kind: 'sapling', workId: 'sapling:fitcheck' },
  ], 'other-tenant');
  assert.equal(mismatched.matchedCount, 0);
  assert.deepEqual(mismatched.runtimeOrphans, ['sapling:cambium', 'sapling:fitcheck']);
});

test('canonical Mission Fabric fixture dry-run yields 2 matches, 72 catalog orphans, and 0 runtime orphans', () => {
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, {
    clock: { now: () => '2026-07-28T09:00:01.000Z' },
    tenantId: 'cambium-synthetic',
  });
  const runtimeWorkNodes = projection.nodes.filter((node) => node.kind === 'work');
  const wrappers = buildPortfolioJoinReport(PORTFOLIO_CATALOG, runtimeWorkNodes);
  const values = buildPortfolioJoinReport(PORTFOLIO_CATALOG, runtimeWorkNodes.map((node) => node.value));
  assert.deepEqual(wrappers, values, 'join accepts both FabricNode wrappers and their value objects');
  assert.deepEqual(wrappers.matches.map((match) => match.canonicalId), [
    'program:cambium-operating-fabric',
    'sapling:cambium',
  ]);
  assert.equal(wrappers.matchedCount, 2);
  assert.equal(wrappers.catalogOrphanCount, 72);
  assert.equal(wrappers.runtimeOrphanCount, 0);
});

test('pair digest deterministically binds graph and catalog digests', () => {
  const graphDigest = `sha256:${'a'.repeat(64)}`;
  const first = portfolioPairDigest(graphDigest, PORTFOLIO_CATALOG.catalogDigest);
  const second = portfolioPairDigest(graphDigest, PORTFOLIO_CATALOG.catalogDigest);
  assert.match(first, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first, second);
  assert.notEqual(first, portfolioPairDigest(`sha256:${'b'.repeat(64)}`, PORTFOLIO_CATALOG.catalogDigest));
  assert.throws(() => portfolioPairDigest('bad', PORTFOLIO_CATALOG.catalogDigest), /graphDigest/);
});

test('the exported catalog is deeply frozen', () => {
  assert.equal(Object.isFrozen(PORTFOLIO_CATALOG), true);
  assert.equal(Object.isFrozen(PORTFOLIO_CATALOG.records), true);
  assert.equal(Object.isFrozen(PORTFOLIO_CATALOG.records[0]), true);
  assert.throws(() => {
    (PORTFOLIO_CATALOG as unknown as { status: string }).status = 'approved';
  }, /read only|Cannot assign/i);
});
