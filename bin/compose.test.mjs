import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { planPipeline, formatPlan, loadJson, parseRunArgs } from './compose.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const registry = loadJson(join(root, 'registry.json'));
const pipeline = loadJson(join(root, 'composition', 'pipeline.json'));

test('registry resolves every pipeline organ (repo + entrypoint)', () => {
  const plan = planPipeline({ registry, pipeline, tenant: 't' });
  assert.equal(plan.steps.length, 4);
  for (const s of plan.steps) {
    assert.ok(s.repo, `stage ${s.stage} resolved a repo`);
    assert.ok(s.entrypoint, `stage ${s.stage} resolved an entrypoint`);
  }
});

test('stages are ordered genesis -> taste -> build -> ops', () => {
  const plan = planPipeline({ registry, pipeline, tenant: 't' });
  assert.deepEqual(
    plan.steps.map((s) => s.stage),
    ['genesis', 'taste', 'build', 'ops'],
  );
});

test('plan marks free vs paid tiers per stage', () => {
  const plan = planPipeline({ registry, pipeline, tenant: 't' });
  const byStage = Object.fromEntries(plan.steps.map((s) => [s.stage, s.tier]));
  assert.equal(byStage.genesis, 'free');
  assert.equal(byStage.taste, 'paid');
  assert.equal(byStage.build, 'free');
  assert.equal(byStage.ops, 'paid');
});

test('unknown organ in a pipeline stage fails loud', () => {
  const bad = { stages: [{ id: 'x', organ: 'nope', title: 't', input: 'a', output: 'b' }] };
  assert.throws(
    () => planPipeline({ registry, pipeline: bad, tenant: 't' }),
    /unknown organ/,
  );
});

test('cortex is cross-cutting, not a stage', () => {
  const plan = planPipeline({ registry, pipeline, tenant: 't' });
  assert.ok(!plan.steps.some((s) => s.stage === 'cortex'), 'cortex is not a stage');
  assert.ok(plan.crosscutting.some((c) => c.id === 'cortex'), 'cortex is crosscutting');
});

test('formatPlan renders the tenant and all four numbered stages in order', () => {
  const plan = planPipeline({ registry, pipeline, tenant: 'acme' });
  const out = formatPlan(plan);
  assert.match(out, /tenant: acme/);
  const i1 = out.indexOf('1. genesis');
  const i2 = out.indexOf('2. taste');
  const i3 = out.indexOf('3. build');
  const i4 = out.indexOf('4. ops');
  assert.ok(i1 >= 0 && i1 < i2 && i2 < i3 && i3 < i4, 'numbered stages appear in order');
});

test('missing registry.organs throws', () => {
  assert.throws(() => planPipeline({ registry: {}, pipeline, tenant: 't' }), /registry\.organs/);
});

test('missing pipeline.stages throws', () => {
  assert.throws(() => planPipeline({ registry, pipeline: {}, tenant: 't' }), /pipeline\.stages/);
});

test('parseRunArgs parses tenant + execute + approve', () => {
  assert.deepEqual(parseRunArgs(['acme', '--execute', '--approve', 'taste']), {
    tenant: 'acme', execute: true, approve: 'taste',
  });
});

test('parseRunArgs treats a dangling --approve (followed by a flag) as no approval', () => {
  // operator reorders flags: `--approve --execute` must NOT approve a stage named "--execute"
  assert.equal(parseRunArgs(['acme', '--approve', '--execute']).approve, null);
});
