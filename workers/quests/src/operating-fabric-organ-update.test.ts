import assert from 'node:assert/strict';
import test from 'node:test';

import type { MissionFabricProjectionV1 } from './mission-fabric.ts';
import {
  ORGAN_UPDATE_PLAN,
  ORGAN_UPDATE_SUMMARY,
  compileOrganUpdateDelivery,
  organUpdatePlanForFounder,
} from './organ-update-delivery.ts';
import { renderCanopy } from './page/operating-fabric/canopy.ts';
import {
  ORGAN_UPDATE_BROWSER_JS,
  normalizeOrganUpdateView,
  renderOrganUpdateCanopy,
  renderOrganUpdateSceneContext,
} from './page/operating-fabric/organ-update.ts';
import { OPERATING_FABRIC_BOOT } from './page/operating-fabric/client.ts';
import { OPERATING_FABRIC_STYLES } from './page/operating-fabric/styles.ts';

const PROJECTION = {
  schema: 'cambium.mission-fabric-projection.v1',
  graphVersion: 9,
  nodes: [{
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
  }],
  edges: [],
  gaps: [],
} as unknown as MissionFabricProjectionV1;

const PORTFOLIO = {
  schema: 'cambium.portfolio-catalog.v1',
  classificationDigest: '93b90ed7cee268ac7ee87321a88efefced7980349658cf3c640657a71c361281',
  records: [{
    canonicalId: 'sapling:fitcheck',
    name: 'Fitcheck',
    classification: 'sapling',
    parentTenant: 'cambium',
  }],
  classificationReview: [],
  historicalProducts: [],
};

const PORTFOLIO_SUMMARY = {
  saplings: 12,
  clientBranches: 28,
  internalPrograms: 14,
  classificationReview: 16,
  historicalProducts: 19,
};

test('founder organ plan normalizes and renders all five topic-aware workflows', () => {
  const normalized = normalizeOrganUpdateView({ organUpdateDelivery: ORGAN_UPDATE_PLAN });
  assert.equal(normalized.mode, 'detail');
  assert.deepEqual(normalized.workflows.map((workflow) => [workflow.name, workflow.defaultTopic.topicName]), [
    ['Genesis', 'Inbox'],
    ['Taste', 'Digests'],
    ['Hands', 'Dev'],
    ['Will', 'Clients'],
    ['Cortex', 'Agent Ops'],
  ]);
  const html = renderOrganUpdateCanopy(normalized, 'sapling:fitcheck');
  assert.match(html, /data-component="OrganUpdatePlan"/);
  assert.match(html, /No receipt-backed organ update/);
  assert.match(html, /skills · brand discovery, visual identity · hints only/);
  assert.match(html, /client delivery · Gate approval required/);
  assert.match(html, /No General fallback/);
  assert.doesNotMatch(html, /assigned|executing skills|schedule armed/i);
});

test('selected WorkObject remains inactive until a compiled receipt names its organ', () => {
  const delivery = compileOrganUpdateDelivery({
    schema: 'cambium.organ-update-signal.v1',
    tenantId: 'cambium',
    workObjectId: 'sapling:fitcheck',
    organ: 'hands',
    trigger: 'verification',
    status: 'complete',
    audience: 'internal',
    summary: 'Verification receipt is ready.',
    observedAt: '2026-07-29T10:00:00.000Z',
    proof: { ref: 'receipt:fitcheck-verification', digest: `sha256:${'a'.repeat(64)}` },
  });
  const plan = organUpdatePlanForFounder([delivery]);
  const normalized = normalizeOrganUpdateView({ organUpdateDelivery: plan });
  assert.match(renderOrganUpdateCanopy(normalized, 'sapling:fitcheck'), /data-organ="hands" aria-current="true"/);
  assert.match(renderOrganUpdateSceneContext('mission', normalized, 'sapling:fitcheck'), /Hands · complete · Dev/);
  assert.match(renderOrganUpdateSceneContext('flow', normalized, 'sapling:fitcheck'), /verification → Dev · receipt-backed/);
  assert.match(renderOrganUpdateSceneContext('workforce', normalized, 'sapling:fitcheck'), /capability hints · engineering, verification · not assignments/);
  assert.match(renderOrganUpdateSceneContext('forge', normalized, 'sapling:fitcheck'), /not execution state/);
  assert.match(renderOrganUpdateSceneContext('gate', normalized, 'sapling:fitcheck'), /no Gate action synthesized/);
  assert.match(renderOrganUpdateSceneContext('mission', normalized, 'sapling:other'), /No active organ update/);
});

test('aggregate viewers get fixed counts without workflow or topic identities', () => {
  const normalized = normalizeOrganUpdateView({ organUpdateDeliverySummary: ORGAN_UPDATE_SUMMARY });
  assert.equal(normalized.mode, 'aggregate');
  assert.equal(normalized.workflowCount, 5);
  assert.deepEqual(normalized.workflows, []);
  const html = renderOrganUpdateCanopy(normalized);
  assert.match(html, /5 workflows · event-driven/);
  assert.doesNotMatch(html, /Genesis|Inbox|Hands|Dev|Clients|Agent Ops/);
});

test('malformed supplied plan fails closed while absent plan stays backward compatible', () => {
  assert.throws(
    () => normalizeOrganUpdateView({
      organUpdateDelivery: { ...ORGAN_UPDATE_PLAN, scheduleArmed: true },
    }),
    /invalid/,
  );
  assert.throws(
    () => normalizeOrganUpdateView({
      organUpdateDelivery: {
        ...ORGAN_UPDATE_PLAN,
        workflows: ORGAN_UPDATE_PLAN.workflows.map((workflow, index) => index === 2
          ? { ...workflow, triggers: ['ship', 'fabricated-trigger'] }
          : workflow),
      },
    }),
    /canonical digest/,
  );
  const delivery = compileOrganUpdateDelivery({
    schema: 'cambium.organ-update-signal.v1',
    tenantId: 'cambium',
    workObjectId: 'sapling:fitcheck',
    organ: 'hands',
    trigger: 'verification',
    status: 'complete',
    audience: 'internal',
    summary: 'Verification receipt is ready.',
    observedAt: '2026-07-29T10:00:00.000Z',
    proof: { ref: 'receipt:fitcheck-verification', digest: `sha256:${'b'.repeat(64)}` },
  });
  const routeSpoof = organUpdatePlanForFounder([{
    ...delivery,
    route: ORGAN_UPDATE_PLAN.workflows[3].defaultTopic,
  }]);
  assert.throws(
    () => normalizeOrganUpdateView({ organUpdateDelivery: routeSpoof }),
    /active delivery is invalid/,
  );
  assert.deepEqual(normalizeOrganUpdateView({}), {
    mode: 'none',
    planDigest: null,
    workflows: [],
    activeDeliveries: [],
    workflowCount: 0,
    eventDriven: false,
    scheduleArmed: false,
  });
});

test('Canopy composes portfolio and organ plan without changing legacy absence behavior', () => {
  const html = renderCanopy(PROJECTION, {
    portfolioCatalog: PORTFOLIO,
    portfolioCatalogSummary: PORTFOLIO_SUMMARY,
    organUpdateDelivery: ORGAN_UPDATE_PLAN,
    selectedPortfolioId: 'sapling:fitcheck',
  });
  assert.match(html, /PortfolioCanopy/);
  assert.match(html, /OrganUpdatePlan/);
  assert.match(html, /Genesis/);
  assert.doesNotMatch(renderCanopy(PROJECTION), /OrganUpdatePlan/);
});

test('browser bundle consumes both delivery fields and preserves mobile bounds', () => {
  assert.match(OPERATING_FABRIC_BOOT, /body\.organUpdateDelivery/);
  assert.match(OPERATING_FABRIC_BOOT, /body\.organUpdateDeliverySummary/);
  assert.match(OPERATING_FABRIC_BOOT, /ofNormalizeOrganUpdateView/);
  assert.match(ORGAN_UPDATE_BROWSER_JS, /canonical digest is invalid/);
  assert.match(OPERATING_FABRIC_BOOT, /ofRenderOrganUpdateSceneContext\('mission'/);
  assert.doesNotMatch(ORGAN_UPDATE_BROWSER_JS, /\bimport\b|\bexport\b|\binterface\b|\btype\s+[A-Z]/);
  assert.match(OPERATING_FABRIC_STYLES, /\.of-organ-grid\{[^}]*minmax\(min\(100%,180px\),1fr\)/);
  assert.match(OPERATING_FABRIC_STYLES, /\.of-organ-context\{[^}]*overflow-wrap:anywhere/);
  assert.match(OPERATING_FABRIC_STYLES, /@media \(max-width:640px\)/);
});
