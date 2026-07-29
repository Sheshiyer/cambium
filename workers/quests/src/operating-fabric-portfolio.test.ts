import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { MissionFabricProjectionV1 } from './mission-fabric.ts';
import { PORTFOLIO_CATALOG } from './portfolio-catalog.ts';
import {
  normalizePortfolioPayload,
  PORTFOLIO_BROWSER_JS,
  PORTFOLIO_LIFECYCLE_TEMPLATES,
  renderPortfolioSceneContext,
} from './page/operating-fabric/portfolio.ts';
import { renderCanopy } from './page/operating-fabric/canopy.ts';
import { OPERATING_FABRIC_BOOT } from './page/operating-fabric/client.ts';
import { OPERATING_FABRIC_SCENES } from './page/operating-fabric/scaffold.ts';
import { OPERATING_FABRIC_STYLES } from './page/operating-fabric/styles.ts';

const SUMMARY = {
  saplings: 12,
  clientBranches: 28,
  internalPrograms: 14,
  classificationReview: 16,
  historicalProducts: 19,
};

const CATALOG = {
  schema: 'cambium.portfolio-catalog.v1',
  classificationDigest: '93b90ed7cee268ac7ee87321a88efefced7980349658cf3c640657a71c361281',
  records: [
    {
      canonicalId: 'sapling:fitcheck',
      name: 'Fitcheck',
      classification: 'sapling',
      parentTenant: 'cambium',
      tenantIdentity: { status: 'canonical-parent', tenantId: 'cambium' },
      aliases: [
        { value: 'FitCheck', namespace: 'legacy-product-name', tenantAuthority: false },
        { value: 'getfitcheck', namespace: 'brand-alias', tenantAuthority: false },
      ],
      provenance: ['vault:40-products/fitcheck/product-overview.md', '/never/render/me'],
    },
    {
      canonicalId: 'sapling:name-collision',
      name: 'Runtime Name Collision',
      classification: 'sapling',
    },
    {
      canonicalId: 'branch:parkarea-client',
      name: 'ParkArea Client',
      classification: 'client-branch',
      linkedCanonicalIds: ['historical-product:parkarea-product'],
    },
    {
      canonicalId: 'branch:tirak-client',
      name: 'Tirak Client',
      classification: 'client-branch',
      linkedCanonicalIds: ['historical-product:tirak-product'],
    },
    {
      canonicalId: 'sapling:seedforge',
      name: 'SeedForge',
      classification: 'sapling',
      linkedCanonicalIds: ['program:seedforge-capability'],
    },
    {
      canonicalId: 'program:seedforge-capability',
      name: 'SeedForge capability',
      classification: 'internal-program',
      operationalOverlay: 'paused',
      linkedCanonicalIds: ['sapling:seedforge'],
    },
  ],
  classificationReview: [
    {
      canonicalId: 'review:unclassified',
      source: 'Needs classification',
      needed: 'canonical product or client note',
    },
  ],
  historicalProducts: [
    {
      canonicalId: 'historical-product:parkarea-product',
      name: 'ParkArea Product',
      status: 'archived',
      linkedCanonicalId: 'branch:parkarea-client',
      provenance: ['vault:40-products/parkarea/product-overview.md'],
    },
    {
      canonicalId: 'historical-product:tirak-product',
      name: 'Tirak Product',
      status: 'archived',
      linkedCanonicalId: 'branch:tirak-client',
      provenance: ['vault:40-products/tirak/product-overview.md'],
    },
  ],
};

const PROJECTION = {
  schema: 'cambium.mission-fabric-projection.v1',
  graphVersion: 8,
  nodes: [
    {
      kind: 'work',
      value: {
        kind: 'sapling',
        workId: 'sapling:fitcheck',
        name: 'Fitcheck',
        status: 'active',
        currentState: 'ready',
        promotionState: 'proof-only',
        currentGate: 'gate:fitcheck',
      },
    },
    {
      kind: 'work',
      value: {
        kind: 'sapling',
        workId: 'sapling:different-id',
        name: 'Runtime Name Collision',
        status: 'active',
        currentState: 'ready',
        promotionState: 'proof-only',
        currentGate: 'gate:collision',
      },
    },
    {
      kind: 'task',
      value: {
        taskId: 'task:fitcheck',
        missionId: 'mission:fitcheck',
        workId: 'sapling:fitcheck',
        title: 'Fitcheck task',
        status: 'active',
        desiredState: 'complete',
      },
    },
    {
      kind: 'agent',
      value: {
        agentId: 'agent:fitcheck',
        role: 'builder',
        runtime: 'codex',
        status: 'assigned',
      },
    },
    {
      kind: 'skill-cluster',
      value: {
        clusterId: 'cluster:fitcheck',
        name: 'Fitcheck cluster',
        status: 'active',
        skillIds: [],
        eligibleAgentIds: ['agent:fitcheck'],
      },
    },
  ],
  edges: [
    { kind: 'contains', fromId: 'sapling:fitcheck', toId: 'task:fitcheck' },
    { kind: 'assigned-to', fromId: 'task:fitcheck', toId: 'agent:fitcheck' },
    { kind: 'requires-cluster', fromId: 'task:fitcheck', toId: 'cluster:fitcheck' },
    { kind: 'pins-loadout', fromId: 'sapling:fitcheck', toId: 'loadout:fitcheck' },
  ],
  gaps: [],
} as unknown as MissionFabricProjectionV1;

test('portfolio payload normalizes canonical records and exact aggregate counts', () => {
  const normalized = normalizePortfolioPayload({
    portfolioCatalog: CATALOG,
    portfolioCatalogSummary: SUMMARY,
  });

  assert.equal(normalized.mode, 'detail');
  assert.deepEqual(normalized.counts, {
    saplings: 12,
    clients: 28,
    programs: 14,
    review: 16,
    historical: 19,
  });
  assert.equal(
    normalized.records.length,
    CATALOG.records.length + CATALOG.classificationReview.length + CATALOG.historicalProducts.length,
  );
  assert.equal(
    normalized.records.find((record) => record.canonicalId === 'sapling:fitcheck')?.parentTenant,
    'cambium',
  );
  assert.equal(
    normalized.records.find((record) => record.canonicalId === 'sapling:fitcheck')?.sourceDigest,
    CATALOG.classificationDigest,
  );
});

test('the real checked-in catalog renders every mapped WorkObject and review surface', () => {
  const normalized = normalizePortfolioPayload({
    portfolioCatalog: PORTFOLIO_CATALOG,
    portfolioCatalogSummary: PORTFOLIO_CATALOG.summary,
  });
  assert.equal(normalized.mode, 'detail');
  assert.equal(normalized.records.filter((record) => ['saplings', 'clients', 'programs'].includes(record.zone)).length, 54);
  assert.equal(normalized.records.filter((record) => record.zone === 'review').length, 16);
  assert.equal(normalized.records.filter((record) => record.zone === 'historical').length, 19);

  const html = renderCanopy(PROJECTION, {
    portfolioCatalog: PORTFOLIO_CATALOG,
    portfolioCatalogSummary: PORTFOLIO_CATALOG.summary,
  });
  assert.equal([...html.matchAll(/data-portfolio-card/g)].length, 89);
  for (const identity of [
    'sapling:fitcheck',
    'sapling:parkarea',
    'branch:parkarea',
    'sapling:tirak',
    'branch:tirak',
    'sapling:seedforge',
    'program:teamforge-control-plane',
    'branch:bwssb',
    'program:cambium-operating-fabric',
  ]) {
    assert.match(html, new RegExp(`data-portfolio-id="${identity}"`));
  }
  assert.doesNotMatch(html, /\/Volumes\/|\/Users\/|file:\/\//);
});

test('Canopy renders four zones, exact counts, filters, and progressive disclosure', () => {
  const html = renderCanopy(PROJECTION, {
    portfolioCatalog: CATALOG,
    portfolioCatalogSummary: SUMMARY,
  });

  assert.match(html, /data-component="PortfolioCanopy"/);
  assert.deepEqual(
    [...html.matchAll(/data-portfolio-zone="([^"]+)"/g)].map((match) => match[1]),
    ['saplings', 'clients', 'programs', 'review'],
  );
  for (const [key, value] of [
    ['saplings', 12],
    ['clients', 28],
    ['programs', 14],
    ['review', 16],
    ['historical', 19],
  ] as const) {
    assert.match(html, new RegExp(`data-portfolio-count="${key}"[^>]*>${value}<`));
  }
  assert.match(html, /role="toolbar" aria-label="Filter portfolio zones"/);
  assert.match(html, /data-of-portfolio-filter="all"[^>]*aria-pressed="true"/);
  assert.match(html, /data-of-portfolio-filter="review"[^>]*aria-pressed="false"/);
  assert.match(html, /<details class="of-portfolio-more"/);
});

test('Canopy presents lifecycle templates as templates and paused as an overlay', () => {
  const html = renderCanopy(PROJECTION, {
    portfolioCatalog: CATALOG,
    portfolioCatalogSummary: SUMMARY,
  });

  for (const template of Object.values(PORTFOLIO_LIFECYCLE_TEMPLATES)) {
    assert.ok(html.includes(template), `renders lifecycle template: ${template}`);
  }
  assert.match(html, /data-lifecycle-overlay="paused"/);
  assert.match(html, /Paused overlay/);
  assert.match(html, /Complete\/Retired/);
  assert.match(html, /template only · not live state/i);
  assert.doesNotMatch(html, /data-live-lifecycle=/);
});

test('Fitcheck aliases remain non-authoritative under cambium', () => {
  const html = renderCanopy(PROJECTION, {
    portfolioCatalog: CATALOG,
    portfolioCatalogSummary: SUMMARY,
  });
  const fitcheck = html.slice(
    html.indexOf('data-portfolio-id="sapling:fitcheck"'),
    html.indexOf('</article>', html.indexOf('data-portfolio-id="sapling:fitcheck"')),
  );

  assert.match(fitcheck, /parent tenant<\/dt><dd>cambium/);
  assert.match(fitcheck, /FitCheck/);
  assert.match(fitcheck, /getfitcheck/);
  assert.match(fitcheck, /data-alias-authority="false"/);
  assert.match(fitcheck, /aliases are display-only · not tenant authority/);
});

test('mixed linked records stay separate and classification remains read-only', () => {
  const html = renderCanopy(PROJECTION, {
    portfolioCatalog: CATALOG,
    portfolioCatalogSummary: SUMMARY,
  });

  for (const canonicalId of [
    'branch:parkarea-client',
    'historical-product:parkarea-product',
    'branch:tirak-client',
    'historical-product:tirak-product',
    'sapling:seedforge',
    'program:seedforge-capability',
  ]) {
    assert.equal(
      [...html.matchAll(new RegExp(`data-portfolio-id="${canonicalId}"`, 'g'))].length,
      1,
      `${canonicalId} remains one separate record`,
    );
  }
  assert.match(html, /classification · read-only/);
  assert.match(html, /linked record · separate identity/);
});

test('selection contexts join only by exact canonical workId and expose unmapped states honestly', () => {
  const normalized = normalizePortfolioPayload({
    portfolioCatalog: CATALOG,
    portfolioCatalogSummary: SUMMARY,
    portfolioJoinReport: {
      matches: [{ canonicalId: 'sapling:fitcheck', runtimeWorkId: 'sapling:fitcheck' }],
    },
  });
  const fitcheck = normalized.records.find((record) => record.canonicalId === 'sapling:fitcheck')!;
  const collision = normalized.records.find((record) => record.canonicalId === 'sapling:name-collision')!;

  const exactMission = renderPortfolioSceneContext('mission', PROJECTION, fitcheck);
  assert.match(exactMission, /data-portfolio-join="exact"/);
  assert.match(exactMission, /Goal Graph exact match/);
  assert.doesNotMatch(exactMission, /status|current state|ready|active/i);

  assert.match(renderPortfolioSceneContext('flow', PROJECTION, fitcheck), /Idea → Proposal → Evidence/);
  assert.match(renderPortfolioSceneContext('workforce', PROJECTION, fitcheck), /agent:fitcheck/);
  const forge = renderPortfolioSceneContext('forge', PROJECTION, fitcheck);
  assert.match(forge, /cluster:fitcheck/);
  assert.match(forge, /loadout:fitcheck/);
  const inspect = renderPortfolioSceneContext('inspect', PROJECTION, fitcheck);
  assert.match(inspect, new RegExp(CATALOG.classificationDigest));
  assert.match(inspect, /vault:40-products\/fitcheck\/product-overview\.md/);
  assert.doesNotMatch(inspect, /never\/render|absolutePath/);
  const gate = renderPortfolioSceneContext('gate', PROJECTION, fitcheck);
  assert.match(gate, /read-only/);
  assert.doesNotMatch(gate, /<button|data-action|approve/i);

  const missingMission = renderPortfolioSceneContext('mission', PROJECTION, collision);
  assert.match(missingMission, /data-portfolio-join="missing"/);
  assert.match(missingMission, /Goal Graph missing/);
  assert.match(renderPortfolioSceneContext('workforce', PROJECTION, collision), /assignments unmapped/);
  assert.match(renderPortfolioSceneContext('forge', PROJECTION, collision), /skills unmapped/);
  assert.match(renderPortfolioSceneContext('forge', PROJECTION, collision), /loadout unmapped/);
  assert.equal(renderPortfolioSceneContext('canopy', PROJECTION, fitcheck), '');
  assert.equal(renderPortfolioSceneContext('unknown', PROJECTION, fitcheck), '');
});

test('server join report maps canonical selection to an exact legacy runtime workId', () => {
  const legacyProjection = structuredClone(PROJECTION) as unknown as MissionFabricProjectionV1;
  for (const node of legacyProjection.nodes) {
    if (node.kind === 'work' && node.value.workId === 'sapling:fitcheck') {
      node.value.workId = 'sapling-fitcheck';
    }
    if (node.kind === 'task' && node.value.workId === 'sapling:fitcheck') {
      node.value.workId = 'sapling-fitcheck';
    }
  }
  legacyProjection.edges = legacyProjection.edges.map((edge) => ({
    ...edge,
    fromId: edge.fromId === 'sapling:fitcheck' ? 'sapling-fitcheck' : edge.fromId,
  }));
  const input = {
    portfolioCatalog: CATALOG,
    portfolioCatalogSummary: SUMMARY,
    portfolioJoinReport: {
      matches: [{ canonicalId: 'sapling:fitcheck', runtimeWorkId: 'sapling-fitcheck' }],
    },
  };
  const normalized = normalizePortfolioPayload(input);
  const fitcheck = normalized.records.find((record) => record.canonicalId === 'sapling:fitcheck')!;

  assert.equal(fitcheck.runtimeWorkId, 'sapling-fitcheck');
  assert.match(
    renderCanopy(legacyProjection, input),
    /data-portfolio-id="sapling:fitcheck"[^>]*data-portfolio-kind="saplings"[^>]*data-portfolio-join="exact"/,
  );
  assert.match(renderPortfolioSceneContext('mission', legacyProjection, fitcheck), /Goal Graph exact match/);
  assert.match(renderPortfolioSceneContext('workforce', legacyProjection, fitcheck), /agent:fitcheck/);

  const withoutReport = normalizePortfolioPayload({
    portfolioCatalog: CATALOG,
    portfolioCatalogSummary: SUMMARY,
  }).records.find((record) => record.canonicalId === 'sapling:fitcheck')!;
  assert.match(renderPortfolioSceneContext('mission', legacyProjection, withoutReport), /Goal Graph missing/);
});

test('aggregate-only non-founder response renders no detail cards or selection controls', () => {
  const html = renderCanopy(PROJECTION, { portfolioCatalogSummary: SUMMARY });

  assert.match(html, /data-portfolio-mode="aggregate-only"/);
  assert.match(html, /portfolio details restricted/i);
  assert.match(html, /data-portfolio-count="clients"[^>]*>28</);
  assert.doesNotMatch(html, /data-portfolio-card/);
  assert.doesNotMatch(html, /data-of-open-portfolio/);
  assert.doesNotMatch(html, /ParkArea|Fitcheck|SeedForge/);
});

test('absent catalog material preserves the byte-identical legacy Canopy renderer', () => {
  assert.equal(
    renderCanopy(PROJECTION, {}),
    renderCanopy(PROJECTION),
  );
  assert.doesNotMatch(renderCanopy(PROJECTION), /PortfolioCanopy|data-portfolio-mode/);
});

test('boot consumes top-level catalog fields without weakening activation or navigation ceilings', () => {
  assert.match(OPERATING_FABRIC_BOOT, /body\.portfolioCatalog/);
  assert.match(OPERATING_FABRIC_BOOT, /body\.portfolioCatalogSummary/);
  assert.match(OPERATING_FABRIC_BOOT, /body\.portfolioJoinReport/);
  assert.match(OPERATING_FABRIC_BOOT, /res\.status !== 200/);
  assert.match(OPERATING_FABRIC_BOOT, /body\.delivery\.operatingFabricEnabled === true/);
  assert.match(OPERATING_FABRIC_BOOT, /data-of-portfolio-filter/);
  assert.match(OPERATING_FABRIC_BOOT, /data-of-open-portfolio/);
  assert.match(OPERATING_FABRIC_BOOT, /gateBody\.insertAdjacentHTML/);
  assert.doesNotMatch(OPERATING_FABRIC_BOOT, /gateBody\.innerHTML\s*\+=/);
  assert.match(PORTFOLIO_BROWSER_JS, /function ofNormalizePortfolioPayload/);
  assert.doesNotMatch(PORTFOLIO_BROWSER_JS, /\bimport\b|\bexport\b|\binterface\b|\btype\s+[A-Z]/);
  assert.equal([...OPERATING_FABRIC_SCENES.matchAll(/data-of-tab="/g)].length, 5);
});

test('portfolio density preserves safe areas, keyboard focus, touch size, contrast, and reduced motion', () => {
  assert.match(OPERATING_FABRIC_STYLES, /env\(safe-area-inset-top/);
  assert.match(OPERATING_FABRIC_STYLES, /env\(safe-area-inset-bottom/);
  assert.match(OPERATING_FABRIC_STYLES, /100dvh/);
  assert.match(OPERATING_FABRIC_STYLES, /\.of-control\{[^}]*min-height:44px/);
  assert.match(
    renderCanopy(PROJECTION, { portfolioCatalog: CATALOG, portfolioCatalogSummary: SUMMARY }),
    /class="of-control of-portfolio-filter"/,
  );
  assert.match(OPERATING_FABRIC_STYLES, /\.of-tab:focus-visible,\.of-control:focus-visible/);
  assert.match(OPERATING_FABRIC_STYLES, /@media \(max-width:640px\)/);
  assert.match(OPERATING_FABRIC_STYLES, /prefers-reduced-motion/);
  assert.match(OPERATING_FABRIC_STYLES, /color:var\(--ink\)|color:var\(--soft\)/);
});
