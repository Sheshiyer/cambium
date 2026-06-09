import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRoot, buildInvocation, gateStage, runStage, runPipeline, extractOutput } from './lib/invoke.mjs';

const registry = {
  organs: {
    taste: { repo: 'Sheshiyer/skill-clusters' },
    genesis: { repo: 'Sheshiyer/brandmint-oracle-aleph' },
  },
};
const adapters = {
  taste: {
    root_id: 'taste',
    cmd: 'node',
    args: ['taste/scripts/taste-resolve.mjs', '{input}', '--brand', '{tenant}', '--json'],
    spend: 'gated',
    input_default: 'brand system',
  },
  genesis: {
    root_id: 'genesis',
    cmd: 'brandmint',
    args: ['launch', '--waves', '0-8', '--brand', '{tenant}'],
    spend: 'gated',
  },
};
const ctx = { registry, adapters, cambiumRoot: '/x/cambium', env: {} };

// ── resolveRoot ──
test('resolveRoot uses the sibling-dir convention by default', () => {
  assert.equal(resolveRoot('taste', ctx), '/x/skill-clusters');
});

test('resolveRoot honors the CAMBIUM_ORGAN_ROOTS override', () => {
  const env = { CAMBIUM_ORGAN_ROOTS: JSON.stringify({ taste: '/custom/sc' }) };
  assert.equal(resolveRoot('taste', { ...ctx, env }), '/custom/sc');
});

test('resolveRoot fails loud on an organ with no adapter', () => {
  assert.throws(() => resolveRoot('nope', ctx), /no adapter/);
});

// ── buildInvocation (pure) ──
test('buildInvocation injects tenant + input for taste', () => {
  const inv = buildInvocation(adapters.taste, { tenant: 'acme', input: 'landing page', root: '/x/skill-clusters' });
  assert.deepEqual(inv.args, ['taste/scripts/taste-resolve.mjs', 'landing page', '--brand', 'acme', '--json']);
  assert.equal(inv.cwd, '/x/skill-clusters');
  assert.equal(inv.spend, 'gated');
});

test('buildInvocation falls back to input_default when input is empty', () => {
  const inv = buildInvocation(adapters.taste, { tenant: 'acme', input: '', root: '/r' });
  assert.ok(inv.args.includes('brand system'));
});

test('buildInvocation builds the genesis waves command', () => {
  const inv = buildInvocation(adapters.genesis, { tenant: 'acme', input: '', root: '/x/bm' });
  assert.deepEqual(inv.args, ['launch', '--waves', '0-8', '--brand', 'acme']);
});

// ── gateStage (the fail-closed spend gate) ──
test('gate: dry-run never allows (default)', () => {
  assert.equal(gateStage('taste', adapters.taste, { execute: false }).allowed, false);
});

test('gate: --execute on a gated stage WITHOUT approval is refused (fail-closed)', () => {
  const g = gateStage('taste', adapters.taste, { execute: true, approve: null });
  assert.equal(g.allowed, false);
  assert.match(g.reason, /--approve taste/);
});

test('gate: --execute on a gated stage WITH matching approval is allowed', () => {
  assert.equal(gateStage('taste', adapters.taste, { execute: true, approve: 'taste' }).allowed, true);
});

test('gate: approval for a DIFFERENT stage does not allow this one', () => {
  assert.equal(gateStage('taste', adapters.taste, { execute: true, approve: 'genesis' }).allowed, false);
});

test('gate: a spend:none stage is allowed under --execute without approval', () => {
  assert.equal(gateStage('x', { spend: 'none' }, { execute: true, approve: null }).allowed, true);
});

// ── runStage (gate + injected runner; tests NEVER spawn a real process) ──
test('runStage dry-run does NOT call the runner', async () => {
  let calls = 0;
  const runner = () => { calls++; return { status: 0 }; };
  const res = await runStage('taste', { ...ctx, tenant: 'acme', execute: false, runner });
  assert.equal(res.spawned, false);
  assert.equal(calls, 0);
});

test('runStage refused-execute does NOT call the runner (zero spawn)', async () => {
  let calls = 0;
  const runner = () => { calls++; return { status: 0 }; };
  const res = await runStage('taste', { ...ctx, tenant: 'acme', execute: true, approve: null, runner });
  assert.equal(res.spawned, false);
  assert.equal(calls, 0);
});

test('runStage approved-execute calls the runner exactly once', async () => {
  let calls = 0;
  const runner = () => { calls++; return { status: 0, stdout: 'ok' }; };
  const res = await runStage('taste', { ...ctx, tenant: 'acme', execute: true, approve: 'taste', runner });
  assert.equal(res.spawned, true);
  assert.equal(calls, 1);
});

// ── hardening (defense-in-depth on the spend gate) ──
test('gate: an UNKNOWN spend value fails closed even WITH a matching approval', () => {
  // a future tier like spend:"never" must NOT be spawnable just because it is not "none"
  assert.equal(gateStage('x', { spend: 'never' }, { execute: true, approve: 'x' }).allowed, false);
});

test('gate: an unknown spend value under --execute is refused (not silently allowed)', () => {
  const g = gateStage('x', { spend: 'chaos' }, { execute: true, approve: 'x' });
  assert.equal(g.allowed, false);
  assert.match(g.reason, /unknown spend/);
});

test('resolveRoot honors an adapter local_dir override (case-exact local dir)', () => {
  const a = { taste: { ...adapters.taste, local_dir: 'Skill-clusters' } };
  assert.equal(resolveRoot('taste', { ...ctx, adapters: a }), '/x/Skill-clusters');
});

test('resolveRoot env override still beats local_dir', () => {
  const a = { taste: { ...adapters.taste, local_dir: 'Skill-clusters' } };
  const env = { CAMBIUM_ORGAN_ROOTS: JSON.stringify({ taste: '/custom/sc' }) };
  assert.equal(resolveRoot('taste', { ...ctx, adapters: a, env }), '/custom/sc');
});

// ── the pipeline hand-off (stage N output → stage N+1 input) ──
const hoReg = { organs: { a: { repo: 'x/a' }, b: { repo: 'x/b' } } };
const hoAdapters = {
  a: { root_id: 'a', cmd: 'echo', args: ['{input}'], spend: 'none', input_default: 'DEF_A' },
  b: { root_id: 'b', cmd: 'echo', args: ['{input}'], spend: 'none', input_default: 'DEF_B' },
};
const hoStages = [{ id: 'sa', organ: 'a' }, { id: 'sb', organ: 'b' }];
const hoBase = { stages: hoStages, registry: hoReg, adapters: hoAdapters, cambiumRoot: '/x/cambium', tenant: 't' };

test('extractOutput returns the trimmed stdout', () => {
  assert.equal(extractOutput({}, { stdout: '  hello\n' }), 'hello');
});

test('extractOutput honors a json: output contract (parsed JSON, not banner lines)', () => {
  const out = extractOutput({ output: 'json:dispatch-plan' }, { stdout: 'banner line\n{"plan":[1,2]}\n' });
  assert.equal(out, '{"plan":[1,2]}');
});

test('extractOutput falls back to trimmed stdout for a non-json output contract', () => {
  assert.equal(extractOutput({ output: 'brand-dna' }, { stdout: '  hi\n' }), 'hi');
});

test('buildInvocation builds the hands resolve-task command (spend:none)', () => {
  const hands = { cmd: 'node', args: ['scripts/resolve-task.mjs', '{input}', '--json'], spend: 'none', input_default: 'tasks.md' };
  const inv = buildInvocation(hands, { tenant: 'acme', input: 'plan.md', root: '/x/sc' });
  assert.deepEqual(inv.args, ['scripts/resolve-task.mjs', 'plan.md', '--json']);
  assert.equal(inv.spend, 'none');
});

test('hand-off: stage A output feeds stage B input', async () => {
  let n = 0;
  const runner = () => ({ status: 0, stdout: n++ === 0 ? 'FROM_A' : 'FROM_B' });
  const results = await runPipeline({ ...hoBase, execute: true, runner });
  const bInv = results.find((r) => r.stage === 'sb').invocation;
  assert.ok(bInv.args.includes('FROM_A'), `B should receive A's output; got ${JSON.stringify(bInv.args)}`);
});

test('hand-off: a refused stage breaks the chain (next uses input_default)', async () => {
  const ad = { a: { ...hoAdapters.a, spend: 'gated' }, b: hoAdapters.b };
  let calls = 0;
  const runner = () => { calls++; return { status: 0, stdout: 'SHOULD_NOT_FEED' }; };
  const results = await runPipeline({ ...hoBase, adapters: ad, execute: true, approve: null, runner });
  const bInv = results.find((r) => r.stage === 'sb').invocation;
  assert.ok(bInv.args.includes('DEF_B'), 'B uses its default when A is refused');
  assert.equal(calls, 1, 'only B ran (A was refused, no spawn)');
});

test('runPipeline dry-run calls the runner zero times', async () => {
  let calls = 0;
  const runner = () => { calls++; return { status: 0, stdout: 'x' }; };
  await runPipeline({ ...hoBase, execute: false, runner });
  assert.equal(calls, 0);
});

test('runPipeline marks each stage input source (default vs prev-stage)', async () => {
  let n = 0;
  const runner = () => ({ status: 0, stdout: n++ === 0 ? 'FROM_A' : 'FROM_B' });
  const results = await runPipeline({ ...hoBase, execute: true, runner });
  assert.equal(results.find((r) => r.stage === 'sa').inputFrom, 'default');
  assert.equal(results.find((r) => r.stage === 'sb').inputFrom, 'prev-stage');
});
