import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformRegistryToRawData, formatRawDataModule } from './generate-portfolio-catalog-data.mjs';

test('transforms a Sapling workObject with empty linkedWorkIds and populated aliases, emitting an explicit undefined hole for the empty earlier field', () => {
  const registry = {
    workObjects: [
      {
        workId: 'sapling:fitcheck',
        name: 'Fitcheck',
        kind: 'sapling',
        promotionState: 'supervised-branch',
        tenantIdentity: { status: 'canonical-parent', tenantId: 'cambium' },
        identityAliases: [
          { value: 'FitCheck', namespace: 'legacy-product-name', tenantAuthority: false },
          { value: 'getfitcheck', namespace: 'brand-alias', tenantAuthority: false },
        ],
        linkedWorkIds: [],
        sourceRefs: ['repo:fitcheck-landing/README.md', 'cambium:docs/plans/product-branches/fitcheck.md'],
      },
    ],
    historicalProductSurfaces: [],
    unresolvedCandidates: [],
    operationalGaps: [],
  };
  const result = transformRegistryToRawData(registry);
  assert.deepEqual(result.saplings, [
    [
      'sapling:fitcheck',
      'Fitcheck',
      'supervised-branch',
      'canonical-parent',
      'cambium',
      ['repo:fitcheck-landing/README.md', 'cambium:docs/plans/product-branches/fitcheck.md'],
      undefined,
      [['FitCheck', 'legacy-product-name'], ['getfitcheck', 'brand-alias']],
    ],
  ]);
});

test('transforms a Sapling with commercialReuse but no aliases, emitting an explicit undefined hole', () => {
  const registry = {
    workObjects: [
      {
        workId: 'sapling:hostscale',
        name: 'HostScale',
        kind: 'sapling',
        promotionState: 'proof-only',
        commercialReuse: 'white-labelable',
        tenantIdentity: { status: 'unresolved', tenantId: null },
        linkedWorkIds: ['branch:co-property'],
        sourceRefs: ['repo:hostscalev0', 'cambium:docs/evidence/2026-08-06-classification-needed-findings.md'],
      },
    ],
    historicalProductSurfaces: [],
    unresolvedCandidates: [],
    operationalGaps: [],
  };
  const result = transformRegistryToRawData(registry);
  assert.deepEqual(result.saplings, [
    [
      'sapling:hostscale',
      'HostScale',
      'proof-only',
      'unresolved',
      null,
      ['repo:hostscalev0', 'cambium:docs/evidence/2026-08-06-classification-needed-findings.md'],
      ['branch:co-property'],
      undefined,
      'white-labelable',
    ],
  ]);
});

test('transforms a Program with paused overlay and accountId', () => {
  const registry = {
    workObjects: [
      {
        workId: 'branch:sandboxlife',
        name: 'SandBoxLife',
        kind: 'program',
        programKind: 'client',
        accountId: 'valore-ventures',
        lifecycle: 'approved',
        operationalStatus: 'paused',
        tenantIdentity: { status: 'unresolved', tenantId: null },
        linkedWorkIds: [],
        sourceRefs: ['vault:60-client-ecosystem/valore-ventures/project-brief.md'],
      },
    ],
    historicalProductSurfaces: [],
    unresolvedCandidates: [],
    operationalGaps: [],
  };
  const result = transformRegistryToRawData(registry);
  assert.deepEqual(result.programs, [
    [
      'branch:sandboxlife',
      'SandBoxLife',
      'client',
      'approved',
      'unresolved',
      null,
      ['vault:60-client-ecosystem/valore-ventures/project-brief.md'],
      'valore-ventures',
      undefined,
      'paused',
    ],
  ]);
});

test('transforms historicalProductSurfaces, unresolvedCandidates, and operationalGaps', () => {
  const registry = {
    workObjects: [],
    historicalProductSurfaces: [
      { id: 'historical-product:bezly', name: 'Bezly', status: 'archived', linkedWorkId: null, sourceRef: 'vault:40-products/01-bezly/product-overview.md' },
    ],
    unresolvedCandidates: [
      { workId: 'review:example', name: 'Example', needed: 'owner and commercial outcome' },
    ],
    operationalGaps: [
      { workId: 'sapling:cambium', fieldSet: 'mission-core-v1', tenantActivation: 'not-authorized-by-registry' },
    ],
  };
  const result = transformRegistryToRawData(registry);
  assert.deepEqual(result.historicalProducts, [
    ['historical-product:bezly', 'Bezly', 'archived', null, 'vault:40-products/01-bezly/product-overview.md'],
  ]);
  assert.deepEqual(result.classificationReview, [
    ['review:example', 'Example', 'owner and commercial outcome'],
  ]);
  assert.deepEqual(result.operationalGapWorkIds, ['sapling:cambium']);
});

test('throws naming the workId for a Sapling missing tenantIdentity', () => {
  const registry = {
    workObjects: [{ workId: 'sapling:broken', name: 'Broken', kind: 'sapling', promotionState: 'proof-only', sourceRefs: ['vault:x.md'] }],
    historicalProductSurfaces: [],
    unresolvedCandidates: [],
    operationalGaps: [],
  };
  assert.throws(() => transformRegistryToRawData(registry), /sapling:broken.*tenantIdentity/);
});

test('throws naming the workId for a Program with an unrecognized programKind', () => {
  const registry = {
    workObjects: [{
      workId: 'program:broken',
      name: 'Broken',
      kind: 'program',
      programKind: 'not-a-real-kind',
      lifecycle: 'executing',
      tenantIdentity: { status: 'not-applicable', tenantId: null },
      sourceRefs: ['vault:x.md'],
    }],
    historicalProductSurfaces: [],
    unresolvedCandidates: [],
    operationalGaps: [],
  };
  assert.throws(() => transformRegistryToRawData(registry), /program:broken.*programKind/);
});

test('throws naming the workId for a workObject with no sourceRefs', () => {
  const registry = {
    workObjects: [{
      workId: 'sapling:no-refs',
      name: 'No Refs',
      kind: 'sapling',
      promotionState: 'proof-only',
      tenantIdentity: { status: 'unresolved', tenantId: null },
      sourceRefs: [],
    }],
    historicalProductSurfaces: [],
    unresolvedCandidates: [],
    operationalGaps: [],
  };
  assert.throws(() => transformRegistryToRawData(registry), /sapling:no-refs.*sourceRefs/);
});

test('formatRawDataModule renders valid, trailing-trimmed TS source', () => {
  const raw = {
    saplings: [['sapling:a', 'A', 'proof-only', 'unresolved', null, ['vault:x.md']]],
    programs: [],
    historicalProducts: [],
    classificationReview: [],
    operationalGapWorkIds: [],
  };
  const text = formatRawDataModule(raw, ['// header line one']);
  assert.match(text, /\/\/ header line one/);
  assert.match(text, /export const RAW_SAPLINGS: readonly RawSapling\[\] = \[\n {2}\['sapling:a', 'A', 'proof-only', 'unresolved', null, \['vault:x\.md'\]\],\n\];/);
  assert.match(text, /export const RAW_CLASSIFICATION_REVIEW = \[\] as const;/);
});
