import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveBranchLoopLibrary, loopCanRunUnattended } from './branch-loop-library.ts';
import type { BranchStoryArc } from './branch-stories.ts';

const stories = [{
  branchId: 'fitcheck',
  productId: 'fitcheck',
  name: 'Fitcheck',
  role: 'Supervised product branch',
  arcId: 'fitcheck-supervised-launch-hardening',
  arcTitle: 'Supervised Launch Hardening',
  vision: { statement: 'Launch proof.' },
  icp: { primary: 'Shopify founder.' },
  kpis: [],
  questline: [],
  missions: [],
  loops: [{
    loopId: 'fitcheck-launch-gate-loop',
    title: 'Fitcheck launch gate loop',
    cadence: 'manual weekly',
    objective: 'Move one launch blocker.',
    metric: 'One gate changes status.',
    boundaryColor: 'yellow',
    oneChangeRule: 'Select exactly one launch gate.',
    stateFile: '.operator/branch-loops/fitcheck-launch-gate-loop.md',
    stopRule: 'Stop after 3 rounds.',
    modelRoute: 'cheap-first',
    proofRequired: 'Updated gate row.',
  }, {
    loopId: 'fitcheck-public-send-loop',
    title: 'Fitcheck public send loop',
    cadence: 'manual only',
    objective: 'Prepare outbound copy.',
    metric: 'One approval request.',
    boundaryColor: 'red',
    oneChangeRule: 'Select exactly one outbound decision.',
    stateFile: '.operator/branch-loops/fitcheck-public-send-loop.md',
    stopRule: 'Stop before sending.',
    modelRoute: 'cheap-first',
    proofRequired: 'Approval note.',
  }],
  gates: [],
  proofPaths: [],
  promotion: { state: 'supervised-branch', currentGate: 'Launch proof', rule: 'proof first' },
  controls: {
    productSeed: {},
    organRouting: [],
    variableContractPayloads: [],
    adapterServiceMap: [],
    evidenceLedger: [],
    approvals: [],
    autonomyBoundary: 'founder approval required',
    dispatchHints: [],
    loops: [],
    policySignals: [],
    ui: { headline: 'Fitcheck', currentFrontier: 'Launch proof', missionVerb: 'Launch', narrativeVoice: 'operator', blockedCopy: 'proof first' },
  },
  source: { tenant: 'cambium', schema: 'cambium.product_branch_packet.v1', indexFile: 'docs/plans/product-branches/index.md', packetFile: 'docs/plans/product-branches/fitcheck.md' },
  gaps: [],
}] satisfies BranchStoryArc[];

const readyStories = [{
  ...stories[0],
  loops: [stories[0].loops[0], { ...stories[0].loops[1], boundaryColor: 'green' }],
}] satisfies BranchStoryArc[];

test('deriveBranchLoopLibrary counts boundary colors and run permissions', () => {
  const library = deriveBranchLoopLibrary(stories);

  assert.equal(library.source, 'product-branch-packets@v1');
  assert.equal(library.total, 2);
  assert.equal(library.status, 'blocked');
  assert.equal(library.green, 0);
  assert.equal(library.yellow, 1);
  assert.equal(library.red, 1);
  assert.equal(library.rows[0].runMode, 'approval-required');
  assert.equal(library.rows[1].runMode, 'never-alone');
  assert.equal(library.rows[0].stateFile, '.operator/branch-loops/fitcheck-launch-gate-loop.md');
});

test('deriveBranchLoopLibrary reports empty, ready, and blocked statuses', () => {
  assert.equal(deriveBranchLoopLibrary([]).status, 'empty');
  assert.equal(deriveBranchLoopLibrary(readyStories).status, 'ready');
  assert.equal(deriveBranchLoopLibrary(stories).status, 'blocked');
});

test('loopCanRunUnattended keeps manual-first default unless scheduling is approved', () => {
  assert.equal(loopCanRunUnattended(stories[0].loops[0]), false);
  assert.equal(loopCanRunUnattended({ ...stories[0].loops[0], boundaryColor: 'green' }), false);
  assert.equal(loopCanRunUnattended({ ...stories[0].loops[0], boundaryColor: 'green' }, { schedulingApproved: true }), true);
  assert.equal(loopCanRunUnattended(stories[0].loops[0], { schedulingApproved: true }), false);
  assert.equal(loopCanRunUnattended(stories[0].loops[1], { schedulingApproved: true }), false);
});
