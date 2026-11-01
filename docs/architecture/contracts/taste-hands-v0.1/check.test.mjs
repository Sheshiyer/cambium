import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { contrastRatio, experimentInputs, loadReport, parseYaml, reviewPackets } from './check.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));

test('yaml subset reads nested lists and quoted scalars', () => {
  const value = parseYaml(`
version: cambium.taste-hands.v0.1
tokens:
  color:
    ink: "#00272B"
  motion:
    reducedMotionQuery: '(prefers-reduced-motion: reduce)'
    allowedProperties:
      - transform
      - opacity
do:
  - "Use signal or mist for text placed on ink."
surface_bindings: []
`);
  assert.equal(value.tokens.color.ink, '#00272B');
  assert.equal(value.tokens.motion.reducedMotionQuery, '(prefers-reduced-motion: reduce)');
  assert.deepEqual(value.tokens.motion.allowedProperties, ['transform', 'opacity']);
  assert.equal(value.do[0], 'Use signal or mist for text placed on ink.');
  assert.deepEqual(value.surface_bindings, []);
});

test('signal on ink clears the published two-decimal ratio', () => {
  assert.equal(contrastRatio('#E0FF4F', '#00272B').toFixed(2), '14.03');
  assert.ok(contrastRatio('#E0FF4F', '#D6FFF6') < 3);
});

test('the experiment packet passes and cuts token drift without a proof claim', () => {
  const report = loadReport(root);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.equal(report.runs.A.token_drift, 4);
  assert.equal(report.runs.B.token_drift, 0);
  assert.equal(report.runs.A.contrast_failures, 0);
  assert.equal(report.runs.B.contrast_failures, 0);
  assert.equal(report.runs.A.adherence, 2);
  assert.equal(report.runs.B.adherence, 5);
  assert.equal(report.runs.B.type_gaps, 0);
  assert.equal(report.revision_rounds, 0);
  assert.equal(report.blind_owner_score, null);
  assert.equal(report.gates.marketing_create_send_spend_publish, 'disabled');
  assert.equal(report.references.uninspected.length, 0);
  assert.equal(report.stop_rules.pass, true);
});

test('publish keys and released proof fail closed', () => {
  const inputs = experimentInputs(root);
  const published = { ...inputs, example: structuredClone(inputs.example) };
  published.example.publish = true;
  const publishedReport = reviewPackets(published);
  assert.equal(publishedReport.ok, false);
  assert.ok(publishedReport.errors.some((error) => error.includes('forbidden key')));

  const proved = { ...inputs, example: structuredClone(inputs.example) };
  proved.example.render_proof.viewport = 'passed';
  const provedReport = reviewPackets(proved);
  assert.equal(provedReport.ok, false);
  assert.ok(provedReport.errors.some((error) => error.includes('render_proof')));

  const missing = { ...inputs, example: structuredClone(inputs.example), contract: structuredClone(inputs.contract) };
  missing.example.reference_board[0].ref = 'docs/experiments/taste-hands-v0.1/missing-plate.png';
  missing.contract.reference_board[0].ref = missing.example.reference_board[0].ref;
  const missingReport = reviewPackets(missing);
  assert.equal(missingReport.ok, false);
  assert.ok(missingReport.errors.some((error) => error.includes('reference missing')));
});
