import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { planPipeline, formatPlan, loadJson, parseRunArgs } from './compose.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const registry = loadJson(join(root, 'registry.json'));
const pipeline = loadJson(join(root, 'composition', 'pipeline.json'));
const machineReadableContractGroups = new Set([
  'idea',
  'brand_system',
  'copy_system',
  'visual_system',
  'taste_brief',
  'asset_plan',
  'section_plan',
  'interaction_plan',
  'acceptance_checks',
  'artifact',
  'brand_docs',
  'business',
]);
const dedupe = (values) => [...new Set(values)];

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

test('pipeline stages declare required and produced variable groups', async () => {
  const pipeline = JSON.parse(await fs.readFile(join(root, 'composition', 'pipeline.json'), 'utf8'));
  for (const stage of pipeline.stages) {
    assert.ok(Array.isArray(stage.requires), `${stage.id} missing requires`);
    assert.ok(Array.isArray(stage.produces), `${stage.id} missing produces`);
    assert.ok(Array.isArray(stage.blocking), `${stage.id} missing blocking`);
    assert.ok(Array.isArray(stage.downstream_effects), `${stage.id} missing downstream_effects`);
  }
});

test('registry organs declare machine-readable contract metadata', async () => {
  const registry = JSON.parse(await fs.readFile(join(root, 'registry.json'), 'utf8'));
  for (const [organId, organ] of Object.entries(registry.organs)) {
    assert.ok(Array.isArray(organ.capabilities), `${organId} missing capabilities`);
    assert.ok(organ.capabilities.length > 0, `${organId} capabilities empty`);
    assert.ok(Array.isArray(organ.contract_requires), `${organId} missing contract_requires`);
    assert.ok(Array.isArray(organ.contract_produces), `${organId} missing contract_produces`);
    assert.deepEqual(
      organ.capabilities,
      dedupe([...organ.contract_requires, ...organ.contract_produces]),
      `${organId} capabilities must be the canonical union of requires + produces`,
    );
  }
});

test('adapters declare contract metadata', async () => {
  const adapters = JSON.parse(await fs.readFile(join(root, 'adapters.json'), 'utf8'));
  for (const [adapterId, adapter] of Object.entries(adapters.adapters)) {
    assert.ok(Array.isArray(adapter.contract_requires), `${adapterId} missing contract_requires`);
    assert.ok(Array.isArray(adapter.contract_produces), `${adapterId} missing contract_produces`);
    assert.equal(typeof adapter.contract_version, 'string', `${adapterId} missing contract_version`);
  }
});

test('contracts doc defines the variable contract vocabulary', async () => {
  const text = await fs.readFile(join(root, 'composition', 'CONTRACTS.md'), 'utf8');
  assert.match(text, /Variable contract/i);
  assert.match(text, /brand_system/i);
  assert.match(text, /copy_system/i);
  assert.match(text, /copy_slots/i);
  assert.match(text, /visual_system/i);
  assert.match(text, /asset_plan/i);
  assert.match(text, /section_plan/i);
  assert.match(text, /interaction_plan/i);
  assert.match(text, /acceptance_checks/i);
});

test('sample variable contract includes brand, copy, asset, and section groups', async () => {
  const sample = JSON.parse(await fs.readFile(join(root, 'examples', 'sample-variable-contract.json'), 'utf8'));
  assert.ok(sample.brand_system);
  assert.ok(sample.copy_system);
  assert.ok(sample.visual_system);
  assert.ok(sample.asset_plan);
  assert.ok(sample.section_plan);
  assert.ok(sample.interaction_plan);
  assert.ok(sample.acceptance_checks);
});

test('machine-readable contracts stay within the documented vocabulary', async () => {
  const pipeline = JSON.parse(await fs.readFile(join(root, 'composition', 'pipeline.json'), 'utf8'));
  const registry = JSON.parse(await fs.readFile(join(root, 'registry.json'), 'utf8'));
  const adapters = JSON.parse(await fs.readFile(join(root, 'adapters.json'), 'utf8'));
  const seen = [];

  for (const stage of pipeline.stages) {
    seen.push(...stage.requires, ...stage.produces);
  }

  for (const adapter of Object.values(adapters.adapters)) {
    seen.push(...adapter.contract_requires, ...adapter.contract_produces);
  }

  for (const organ of Object.values(registry.organs)) {
    seen.push(...organ.capabilities, ...organ.contract_requires, ...organ.contract_produces);
  }

  for (const group of seen) {
    assert.ok(
      machineReadableContractGroups.has(group),
      `undocumented machine-readable contract group: ${group}`,
    );
  }
});

test('registry stage-organ contracts align with adapter contracts', async () => {
  const registry = JSON.parse(await fs.readFile(join(root, 'registry.json'), 'utf8'));
  const adapters = JSON.parse(await fs.readFile(join(root, 'adapters.json'), 'utf8'));

  for (const adapterId of Object.keys(adapters.adapters)) {
    const organ = registry.organs[adapterId];
    assert.ok(organ, `${adapterId} missing registry organ`);
    assert.deepEqual(
      organ.contract_requires,
      adapters.adapters[adapterId].contract_requires,
      `${adapterId} registry/adapters contract_requires drifted`,
    );
    assert.deepEqual(
      organ.contract_produces,
      adapters.adapters[adapterId].contract_produces,
      `${adapterId} registry/adapters contract_produces drifted`,
    );
  }
});

test('stage requirements are satisfiable from prior stage hand-offs', async () => {
  const pipeline = JSON.parse(await fs.readFile(join(root, 'composition', 'pipeline.json'), 'utf8'));
  const available = new Set(['idea']);

  for (const stage of pipeline.stages) {
    for (const requirement of stage.requires) {
      assert.ok(
        available.has(requirement),
        `${stage.id} requires ${requirement}, but no prior stage produces it`,
      );
    }

    for (const produced of stage.produces) {
      available.add(produced);
    }
  }
});

test('parseRunArgs parses tenant + execute + approve', () => {
  assert.deepEqual(parseRunArgs(['acme', '--execute', '--approve', 'taste']), {
    tenant: 'acme', execute: true, approve: 'taste', stage: null, input: null, intent: null,
  });
});

test('parseRunArgs treats a dangling --approve (followed by a flag) as no approval', () => {
  // operator reorders flags: `--approve --execute` must NOT approve a stage named "--execute"
  assert.equal(parseRunArgs(['acme', '--approve', '--execute']).approve, null);
});
