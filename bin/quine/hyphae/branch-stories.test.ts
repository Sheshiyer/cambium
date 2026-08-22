import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadBranchStories } from './branch-stories.ts';

test('loads branch stories from branch packets without flattening controls', () => {
  const stories = loadBranchStories({ root: process.cwd() }, 'cambium');
  const fitcheck = stories.find((story) => story.productId === 'fitcheck');

  assert.ok(fitcheck);
  assert.equal(fitcheck.promotion.state, 'supervised-branch');
  assert.equal(fitcheck.branchId, 'fitcheck');
  assert.equal(fitcheck.branchKind, 'product');
  assert.equal(fitcheck.canonicalWorkId, 'sapling:fitcheck');
  assert.equal(fitcheck.arcId, 'fitcheck-supervised-launch-hardening');
  assert.ok(fitcheck.controls.organRouting.length);
  assert.ok(fitcheck.controls.variableContractPayloads.length);
  assert.ok(fitcheck.controls.adapterServiceMap.length);
  assert.ok(fitcheck.controls.dispatchHints.length);
  assert.ok(fitcheck.missions.length);
  assert.ok(fitcheck.kpis.length);
  assert.ok(fitcheck.proofPaths.length);
  assert.match(fitcheck.controls.ui.currentFrontier, /supervised launch/i);
  assert.match(fitcheck.controls.ui.narrativeVoice, /operator voice/i);
  assert.match(fitcheck.controls.autonomyBoundary, /founder approval/i);
  assert.ok(fitcheck.questline.some((quest) => quest.id === 'fitcheck-shopify-listing-price-submission' && quest.status === 'external-wait'));
  assert.ok(fitcheck.questline.some((quest) => quest.id === 'fitcheck-privacy-consent-review' && quest.status === 'blocked'));
  assert.ok(fitcheck.questline.some((quest) => quest.id === 'fitcheck-crm-minimum-viable-flow' && quest.status === 'ready-for-review'));
  assert.equal(fitcheck.questline.some((quest) => quest.status === 'complete'), false);
  assert.ok(fitcheck.controls.organRouting.some((organ) => organ.organ === 'Will' && organ.status === 'ready-for-review'));
  assert.ok(fitcheck.controls.organRouting.some((organ) => organ.organ === 'Cortex' && organ.status === 'complete'));
});

test('loads branch loop controls from branch packets', () => {
  const stories = loadBranchStories({ root: process.cwd() }, 'cambium');
  const fitcheck = stories.find((story) => story.productId === 'fitcheck');

  assert.ok(fitcheck);
  assert.ok(fitcheck.loops);
  assert.equal(fitcheck.loops[0].loopId, 'fitcheck-launch-gate-loop');
  assert.equal(fitcheck.loops[0].boundaryColor, 'yellow');
  assert.match(fitcheck.loops[0].oneChangeRule, /exactly one/i);
  assert.equal(fitcheck.loops[0].stateFile, '.operator/branch-loops/fitcheck-launch-gate-loop.md');
  assert.match(fitcheck.loops[0].stopRule, /Stop after 3 rounds/i);
  assert.deepEqual(fitcheck.controls.loops, fitcheck.loops);

  const vantyx = stories.find((story) => story.productId === 'vantyx');
  assert.ok(vantyx);
  assert.match(vantyx.loops[0].proofRequired, /`new-client` receipt/);

  const clientDelivery = stories.find((story) => story.productId === 'client-delivery');
  assert.ok(clientDelivery);
  assert.equal(clientDelivery.branchKind, 'client');
  assert.equal(clientDelivery.canonicalWorkId, undefined);
  assert.equal(clientDelivery.loops[0].loopId, 'client-delivery-handoff-loop');
  assert.equal(clientDelivery.loops[0].boundaryColor, 'yellow');
});

test('records blocked packet gaps without promoting weak evidence', () => {
  const stories = loadBranchStories({ root: process.cwd() }, 'cambium');
  const iverif = stories.find((story) => story.productId === 'iverif');

  assert.ok(iverif);
  assert.equal(iverif.promotion.state, 'proof-only');
  assert.ok(iverif.gaps.some((gap) => gap.status === 'blocked' && /privacy|public claims|human approvals/i.test(gap.detail)));
  assert.equal(iverif.proofPaths.some((path) => /autonomous/i.test(path.promotes)), false);
});

test('projects the redacted Cortex ingestion receipt without changing unrelated branch gates', () => {
  const stories = loadBranchStories({ root: process.cwd() }, 'cambium');
  const expected = ['fitcheck', 'vantyx', 'snow-gloves-os', 'iverif', 'dlock'];

  for (const branchId of expected) {
    const story = stories.find((candidate) => candidate.branchId === branchId);
    assert.ok(story, `missing canonical branch ${branchId}`);
    const cortex = story.controls.organRouting.find((organ) => organ.organ === 'Cortex');
    assert.ok(cortex, `missing Cortex organ for ${branchId}`);
    assert.equal(cortex.status, 'complete');
    assert.match(cortex.proofPath, /2026-08-12-cambium-branch-cortex-ingestion\.v1\.json/);
    assert.ok(story.controls.evidenceLedger.some((row) =>
      row.status === 'verified' && /Cortex receipt-derived read model/i.test(row.evidence),
    ));
  }

  const fitcheck = stories.find((story) => story.branchId === 'fitcheck');
  assert.ok(fitcheck);
  assert.equal(fitcheck.gates.some((gate) => gate.gate === 'Credentials' && gate.status === 'blocked'), true);
  assert.equal(fitcheck.promotion.state, 'supervised-branch');
});

test('fails soft when an indexed packet is missing required control sections', () => {
  const root = mkdtempSync(join(tmpdir(), 'cambium-branch-stories-'));
  const packetDir = join(root, 'docs', 'plans', 'product-branches');
  mkdirSync(packetDir, { recursive: true });
  writeFileSync(join(packetDir, 'index.md'), [
    '# Test Product Branch Packets',
    '',
    '| product_id | branch_kind | name | role | promotion_state | current_gate | packet |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| demo | product | Demo | Proof candidate | proof-only | Missing controls | demo.md |',
    '',
  ].join('\n'));
  writeFileSync(join(packetDir, 'demo.md'), [
    '---',
    'schema: cambium.product_branch_packet.v1',
    'product_id: demo',
    'name: Demo',
    'role: Proof candidate',
    'promotion_state: proof-only',
    'current_gate: Missing controls',
    'packet_owner: cambium',
    '---',
    '',
    '# Demo',
    '',
    '## Product Seed',
    '',
    '| Field | Value |',
    '| --- | --- |',
    '| autonomy_boundary | Human approval required. |',
    '',
  ].join('\n'));

  const [story] = loadBranchStories({ root }, 'cambium');

  assert.equal(story.productId, 'demo');
  assert.equal(story.canonicalWorkId, undefined);
  assert.equal(story.missions.length, 0);
  assert.ok(story.gaps.some((gap) => gap.status === 'blocked' && /Mission Control Inputs/.test(gap.detail)));
});

test('fails soft when loop control inputs section is missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'cambium-branch-stories-missing-loops-'));
  const packetDir = join(root, 'docs', 'plans', 'product-branches');
  mkdirSync(packetDir, { recursive: true });
  writeFileSync(join(packetDir, 'index.md'), [
    '# Test Product Branch Packets',
    '',
    '| product_id | branch_kind | name | role | promotion_state | current_gate | packet |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| demo | product | Demo | Proof candidate | proof-only | Missing loops | demo.md |',
    '',
  ].join('\n'));
  writeFileSync(join(packetDir, 'demo.md'), [
    '---',
    'schema: cambium.product_branch_packet.v1',
    'product_id: demo',
    'name: Demo',
    'role: Proof candidate',
    'promotion_state: proof-only',
    'current_gate: Missing loops',
    'packet_owner: cambium',
    '---',
    '',
    '# Demo',
    '',
    '## Product Seed',
    '',
    '| Field | Value |',
    '| --- | --- |',
    '| autonomy_boundary | Human approval required. |',
    '',
    '## Branch Story Controls',
    '',
    '| Control | Value |',
    '| --- | --- |',
    '| arc_title | Missing Loop Controls |',
    '',
    '## Mission Control Inputs',
    '',
    '| mission_id | title | type | owner | gate | proof_required | dispatch_target |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| demo-mission | Demo mission | proof | operator | Gate 1 | Evidence | review |',
    '',
    '## KPI Control Inputs',
    '',
    '| kpi_id | label | survival | better_than_survival | source | current_state |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| demo-kpi | Demo KPI | 1 | 2 | ledger | pending |',
    '',
    '## Policy / Permission Inputs',
    '',
    '| permission | status | required_approval | failure_mode |',
    '| --- | --- | --- | --- |',
    '| founder-approval | pending | Founder sign-off | Blocked until approved |',
    '',
    '## Dispatch Inputs',
    '',
    '| route | payload_hint | allowed_when | blocked_when |',
    '| --- | --- | --- | --- |',
    '| review | summary | proof exists | approval missing |',
    '',
    '## Proof Foldback',
    '',
    '| proof_id | source_path | validates | promotes |',
    '| --- | --- | --- | --- |',
    '| proof-1 | docs/proof.md | Gate 1 | supervised-branch |',
    '',
  ].join('\n'));

  const [story] = loadBranchStories({ root }, 'cambium');

  assert.equal(story.productId, 'demo');
  assert.equal(story.loops.length, 0);
  assert.ok(story.gaps.some((gap) => gap.status === 'blocked' && /Loop Control Inputs/.test(gap.detail)));
});

test('fails closed when loop control inputs section contains prose instead of a table', () => {
  const root = mkdtempSync(join(tmpdir(), 'cambium-branch-stories-prose-loops-'));
  const packetDir = join(root, 'docs', 'plans', 'product-branches');
  mkdirSync(packetDir, { recursive: true });
  writeFileSync(join(packetDir, 'index.md'), [
    '# Test Product Branch Packets',
    '',
    '| product_id | branch_kind | name | role | promotion_state | current_gate | packet |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| demo | product | Demo | Proof candidate | proof-only | Prose loops | demo.md |',
    '',
  ].join('\n'));
  writeFileSync(join(packetDir, 'demo.md'), [
    '---',
    'schema: cambium.product_branch_packet.v1',
    'product_id: demo',
    'name: Demo',
    'role: Proof candidate',
    'promotion_state: proof-only',
    'current_gate: Prose loops',
    'packet_owner: cambium',
    '---',
    '',
    '# Demo',
    '',
    '## Product Seed',
    '',
    '| Field | Value |',
    '| --- | --- |',
    '| autonomy_boundary | Human approval required. |',
    '',
    '## Branch Story Controls',
    '',
    '| Control | Value |',
    '| --- | --- |',
    '| arc_title | Prose Loop Controls |',
    '',
    '## Loop Control Inputs',
    '',
    'This loop section exists, but it is prose only and should fail closed.',
    '',
    '## Mission Control Inputs',
    '',
    '| mission_id | title | type | owner | gate | proof_required | dispatch_target |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| demo-mission | Demo mission | proof | operator | Gate 1 | Evidence | review |',
    '',
    '## KPI Control Inputs',
    '',
    '| kpi_id | label | survival | better_than_survival | source | current_state |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| demo-kpi | Demo KPI | 1 | 2 | ledger | pending |',
    '',
    '## Policy / Permission Inputs',
    '',
    '| permission | status | required_approval | failure_mode |',
    '| --- | --- | --- | --- |',
    '| founder-approval | pending | Founder sign-off | Blocked until approved |',
    '',
    '## Dispatch Inputs',
    '',
    '| route | payload_hint | allowed_when | blocked_when |',
    '| --- | --- | --- | --- |',
    '| review | summary | proof exists | approval missing |',
    '',
    '## Proof Foldback',
    '',
    '| proof_id | source_path | validates | promotes |',
    '| --- | --- | --- | --- |',
    '| proof-1 | docs/proof.md | Gate 1 | supervised-branch |',
    '',
  ].join('\n'));

  const [story] = loadBranchStories({ root }, 'cambium');

  assert.equal(story.productId, 'demo');
  assert.equal(story.loops.length, 0);
  assert.ok(story.gaps.some((gap) => gap.status === 'blocked' && /Loop Control Inputs table is malformed/.test(gap.detail)));
});

test('records malformed table gaps when a control section cannot be parsed', () => {
  const root = mkdtempSync(join(tmpdir(), 'cambium-branch-stories-malformed-'));
  const packetDir = join(root, 'docs', 'plans', 'product-branches');
  mkdirSync(packetDir, { recursive: true });
  writeFileSync(join(packetDir, 'index.md'), [
    '# Test Product Branch Packets',
    '',
    '| product_id | branch_kind | name | role | promotion_state | current_gate | packet |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| demo | product | Demo | Proof candidate | proof-only | Table shape | demo.md |',
    '',
  ].join('\n'));
  writeFileSync(join(packetDir, 'demo.md'), [
    '---',
    'schema: cambium.product_branch_packet.v1',
    'product_id: demo',
    'name: Demo',
    'role: Proof candidate',
    'promotion_state: proof-only',
    'current_gate: Table shape',
    'packet_owner: cambium',
    '---',
    '',
    '# Demo',
    '',
    '## Product Seed',
    '',
    '| Field | Value |',
    '| --- | --- |',
    '| autonomy_boundary | Human approval required. |',
    '',
    '## Branch Story Controls',
    '',
    '| Control | Value |',
    '| arc_title | Malformed Controls |',
    '| vision | This should produce a gap. |',
    '',
  ].join('\n'));

  const [story] = loadBranchStories({ root }, 'cambium');

  assert.equal(story.productId, 'demo');
  assert.ok(story.gaps.some((gap) => gap.status === 'blocked' && /Branch Story Controls table is malformed/.test(gap.detail)));
});

test('records malformed table gaps when loop control inputs cannot be parsed', () => {
  const root = mkdtempSync(join(tmpdir(), 'cambium-branch-stories-malformed-loops-'));
  const packetDir = join(root, 'docs', 'plans', 'product-branches');
  mkdirSync(packetDir, { recursive: true });
  writeFileSync(join(packetDir, 'index.md'), [
    '# Test Product Branch Packets',
    '',
    '| product_id | branch_kind | name | role | promotion_state | current_gate | packet |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| demo | product | Demo | Proof candidate | proof-only | Malformed loops | demo.md |',
    '',
  ].join('\n'));
  writeFileSync(join(packetDir, 'demo.md'), [
    '---',
    'schema: cambium.product_branch_packet.v1',
    'product_id: demo',
    'name: Demo',
    'role: Proof candidate',
    'promotion_state: proof-only',
    'current_gate: Malformed loops',
    'packet_owner: cambium',
    '---',
    '',
    '# Demo',
    '',
    '## Product Seed',
    '',
    '| Field | Value |',
    '| --- | --- |',
    '| autonomy_boundary | Human approval required. |',
    '',
    '## Branch Story Controls',
    '',
    '| Control | Value |',
    '| --- | --- |',
    '| arc_title | Malformed Loop Controls |',
    '',
    '## Loop Control Inputs',
    '',
    '| loop_id | title | cadence | objective | metric | boundary_color | one_change_rule | state_file | stop_rule | model_route | proof_required |',
    '| demo-loop | Demo loop | weekly | Move one blocker | One move | yellow | exactly one change | .operator/branch-loops/demo-loop.md | stop after proof | cheap-first | ledger update |',
    '',
    '## Mission Control Inputs',
    '',
    '| mission_id | title | type | owner | gate | proof_required | dispatch_target |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| demo-mission | Demo mission | proof | operator | Gate 1 | Evidence | review |',
    '',
    '## KPI Control Inputs',
    '',
    '| kpi_id | label | survival | better_than_survival | source | current_state |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| demo-kpi | Demo KPI | 1 | 2 | ledger | pending |',
    '',
    '## Policy / Permission Inputs',
    '',
    '| permission | status | required_approval | failure_mode |',
    '| --- | --- | --- | --- |',
    '| founder-approval | pending | Founder sign-off | Blocked until approved |',
    '',
    '## Dispatch Inputs',
    '',
    '| route | payload_hint | allowed_when | blocked_when |',
    '| --- | --- | --- | --- |',
    '| review | summary | proof exists | approval missing |',
    '',
    '## Proof Foldback',
    '',
    '| proof_id | source_path | validates | promotes |',
    '| --- | --- | --- | --- |',
    '| proof-1 | docs/proof.md | Gate 1 | supervised-branch |',
    '',
  ].join('\n'));

  const [story] = loadBranchStories({ root }, 'cambium');

  assert.equal(story.productId, 'demo');
  assert.equal(story.loops.length, 0);
  assert.ok(story.gaps.some((gap) => gap.status === 'blocked' && /Loop Control Inputs table is malformed/.test(gap.detail)));
});

test('rejects unsafe packet paths at runtime before reading packet files', () => {
  const root = mkdtempSync(join(tmpdir(), 'cambium-branch-stories-unsafe-'));
  const packetDir = join(root, 'docs', 'plans', 'product-branches');
  mkdirSync(packetDir, { recursive: true });
  writeFileSync(join(packetDir, 'index.md'), [
    '# Test Product Branch Packets',
    '',
    '| product_id | branch_kind | name | role | promotion_state | current_gate | packet |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| demo | product | Demo | Proof candidate | proof-only | Unsafe path | ../outside.md |',
    '',
  ].join('\n'));

  assert.throws(
    () => loadBranchStories({ root }, 'cambium'),
    /unsafe branch packet path for demo/,
  );
});
