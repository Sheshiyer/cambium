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
  assert.equal(PORTFOLIO_CLASSIFICATION_DIGEST, '43630e6e65dfa78cd5c5e486b389308a8dede9d7bda012b400f4976107cdb309');
  assert.equal(PORTFOLIO_CATALOG.catalogDigest, 'sha256:1fcdc4dc690447ebd4bd23e228cd1a306440d8c37d65e6e56ea21e692eeacc24');
  assert.deepEqual(PORTFOLIO_CATALOG.summary, {
    total: 72,
    saplings: 17,
    clientBranches: 40,
    internalPrograms: 15,
    classificationReview: 0,
    historicalProducts: 20,
    operationalGaps: 48,
  });
  assert.equal(PORTFOLIO_CATALOG.records.length, 72);
  assert.equal(PORTFOLIO_CATALOG.historicalProducts.length, 20);
  assert.equal(PORTFOLIO_CATALOG.classificationReview.length, 0);
  assert.equal(PORTFOLIO_CATALOG.operationalGaps.length, 48);
});

test('catalog identities are unique, canonical, type-correct, and enum bounded', () => {
  const ids = PORTFOLIO_CATALOG.records.map((record) => record.workId);
  assert.equal(new Set(ids).size, 72);
  assert.equal(PORTFOLIO_CATALOG.records.filter((record) => record.classification === 'sapling').length, 17);
  assert.equal(PORTFOLIO_CATALOG.records.filter((record) => record.classification === 'client-branch').length, 40);
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
  const hdilint = PORTFOLIO_CATALOG.records.find((record) => record.workId === 'program:hdilint')!;
  assert.ok(fitcheck);
  assert.ok(hdilint);
  assert.equal(fitcheck.parentTenant, 'cambium');
  assert.deepEqual(fitcheck.tenantIdentity, { status: 'canonical-parent', tenantId: 'cambium' });
  assert.deepEqual(fitcheck.aliases.map((alias) => alias.value), ['FitCheck', 'getfitcheck']);
  assert.ok(fitcheck.aliases.every((alias) => alias.tenantAuthority === false));
  assert.equal(PORTFOLIO_CATALOG.records.some((record) => record.workId === 'sapling:getfitcheck'), false);
  assert.deepEqual(fitcheck.linkedCanonicalIds, ['program:hdilint']);
  assert.deepEqual(hdilint.linkedCanonicalIds, ['sapling:fitcheck']);
  assert.equal(hdilint.classification, 'internal-program');
  assert.notEqual(fitcheck.workId, hdilint.workId);
});

test('mixed-source linked identities remain separate records', () => {
  for (const [left, right] of [
    ['sapling:hostscale', 'branch:co-property'],
    ['sapling:cambium', 'program:cambium-operating-fabric'],
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

test('type-aware canonical joins reject legacy, bare, and type-mismatched wire forms', () => {
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
  assert.deepEqual(report.matches, [{ canonicalId: 'sapling:cambium', runtimeWorkId: 'sapling:cambium' }]);
  assert.equal(report.matchedCount, 1);
  assert.deepEqual(report.runtimeOrphans, [
    'branch:parkarea',
    'fitcheck',
    'operator-utilities',
    'parkarea',
    'program:cambium-operating-fabric',
    'sapling-fitcheck',
    'teamforge-control-plane',
  ]);
  assert.equal(report.catalogOrphanCount, 71);
  assert.equal(report.runtimeIdentityCollisionCount, 0);
});

test('canonical join never falls back to matching names or aliases', () => {
  const report = buildPortfolioJoinReport(PORTFOLIO_CATALOG, [
    { kind: 'sapling', workId: 'sapling:not-fitcheck', name: 'Fitcheck' },
    { kind: 'program', programKind: 'client', workId: 'getfitcheck', name: 'FitCheck' },
  ]);
  assert.equal(report.matchedCount, 0);
  assert.deepEqual(report.runtimeOrphans, ['getfitcheck', 'sapling:not-fitcheck']);
});

test('founder-bound cohort tenants join exactly while unresolved and mismatched records remain held', () => {
  const cambium = buildPortfolioJoinReport(PORTFOLIO_CATALOG, [
    { kind: 'sapling', workId: 'sapling:iverif' },
    { kind: 'sapling', workId: 'sapling:dlock' },
    { kind: 'program', programKind: 'client', workId: 'branch:mathis' },
  ], 'cambium');
  assert.deepEqual(cambium.matches, [
    { canonicalId: 'sapling:dlock', runtimeWorkId: 'sapling:dlock' },
    { canonicalId: 'sapling:iverif', runtimeWorkId: 'sapling:iverif' },
  ]);
  assert.deepEqual(cambium.runtimeOrphans, ['branch:mathis']);

  const mismatched = buildPortfolioJoinReport(PORTFOLIO_CATALOG, [
    { kind: 'sapling', workId: 'sapling:cambium' },
    { kind: 'sapling', workId: 'sapling:fitcheck' },
  ], 'other-tenant');
  assert.equal(mismatched.matchedCount, 0);
  assert.deepEqual(mismatched.runtimeOrphans, ['sapling:cambium', 'sapling:fitcheck']);
});

test('legacy Mission Fabric fixture remains unmapped until its source emits canonical workIds', () => {
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, {
    clock: { now: () => '2026-07-28T09:00:01.000Z' },
    tenantId: 'cambium-synthetic',
  });
  const runtimeWorkNodes = projection.nodes.filter((node) => node.kind === 'work');
  const wrappers = buildPortfolioJoinReport(PORTFOLIO_CATALOG, runtimeWorkNodes);
  const values = buildPortfolioJoinReport(PORTFOLIO_CATALOG, runtimeWorkNodes.map((node) => node.value));
  assert.deepEqual(wrappers, values, 'join accepts both FabricNode wrappers and their value objects');
  assert.deepEqual(wrappers.matches, []);
  assert.equal(wrappers.matchedCount, 0);
  assert.equal(wrappers.catalogOrphanCount, 72);
  assert.deepEqual(wrappers.runtimeOrphans, ['cambium-operating-fabric', 'sapling-cambium']);
  assert.equal(wrappers.runtimeIdentityCollisionCount, 0);
});

test('duplicate runtime work identities fail closed and remain visible as collisions', () => {
  const report = buildPortfolioJoinReport(PORTFOLIO_CATALOG, [
    { kind: 'sapling', workId: 'sapling:cambium' },
    { kind: 'work', value: { kind: 'sapling', workId: 'sapling:cambium' } },
  ]);

  assert.equal(report.matchedCount, 0);
  assert.deepEqual(report.matches, []);
  assert.deepEqual(report.runtimeOrphans, ['sapling:cambium']);
  assert.deepEqual(report.runtimeIdentityCollisions, [{ workId: 'sapling:cambium', occurrences: 2 }]);
  assert.equal(report.runtimeIdentityCollisionCount, 1);
  assert.ok(report.catalogOrphans.includes('sapling:cambium'));
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
