import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, linkSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install, COMMANDS } from './install.mjs';
import { lifecycle, parseArgs } from './lifecycle.mjs';
import { validateGraph, mermaid } from './graph.mjs';

function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'sapling-pack-test-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const sourceRoot = join(base, 'cambium');
  const home = join(base, 'home');
  const vaultRoot = join(base, 'vault');
  const appRoot = join(base, 'app');
  const siteRoot = join(base, 'site');
  for (const path of [home, sourceRoot, vaultRoot, appRoot, siteRoot]) mkdirSync(path);
  const pack = join(sourceRoot, '.agents/skills/sapling-lifecycle');
  mkdirSync(pack, { recursive: true });
  writeFileSync(join(pack, 'SKILL.md'), '---\nname: sapling-lifecycle\ndescription: test\n---\nTest pack\n');
  writeFileSync(join(sourceRoot, 'PROJECT.md'), '# Cambium');
  mkdirSync(join(sourceRoot, 'docs/plans/product-branches'), { recursive: true });
  writeFileSync(join(sourceRoot, 'docs/plans/product-branches/index.md'), '| product_id | canonical_work_id | branch_kind | name | promotion_state | current_gate | packet |\n| --- | --- | --- | --- | --- | --- | --- |\n| temperance | sapling:temperance | product | Temperance Engine | proof-only | v1.1 held | temperance.md |\n| lumen-bar | sapling:lumen-bar | product | LumenBar | proof-only | Scheduled November 3, 2026, 12:01 AM PST | lumen-bar.md |\n| iverif | sapling:iverif | product | IVerif | proof-only | evidence held | iverif.md |\n');
  for (const name of ['temperance', 'lumen-bar', 'iverif']) writeFileSync(join(sourceRoot, `docs/plans/product-branches/${name}.md`), `# ${name}\n## Gate Ledger\n| gate | status |\n| --- | --- |\n| ${name === 'temperance' ? 'v1.1 clean-host' : 'evidence'} | held |\n`);
  writeFileSync(join(appRoot, 'VERSION'), '0.8.0\n');
  writeFileSync(join(siteRoot, 'README.md'), 'Public site source\n');
  const graph = { confirmed: true, packet: [{ node_id: 'release', status: 'shipped', evidence: join(appRoot, 'VERSION'), publishes: false }, { node_id: 'website', status: 'draft', evidence: join(siteRoot, 'README.md'), publishes: false }], edges: [{ from_id: 'release', to_id: 'website' }] };
  return { base, sourceRoot, home, vaultRoot, appRoot, siteRoot, graph, pack };
}

test('dry-run is default, has no filesystem effects, and plans every command', (t) => {
  const fx = fixture(t);
  const result = install(fx);
  assert.equal(result.mode, 'dry-run');
  assert.equal(result.ok, true);
  assert.equal(result.artifacts.length, COMMANDS.length * 4 + 1);
  assert.equal(existsSync(join(fx.home, '.codex')), false);
});

test('install, check, repeated install, source drift and uninstall ownership', (t) => {
  const fx = fixture(t);
  assert.equal(install({ ...fx, mode: 'install' }).ok, true);
  const path = join(fx.home, '.grok/commands/sapling-run.md');
  const body = readFileSync(path, 'utf8');
  assert.match(body, /\$ARGUMENTS/);
  assert.match(body, /\*\*run\*\*/);
  assert.match(body, /SKILL\.md/);
  assert.equal(install({ ...fx, mode: 'check' }).ok, true);
  assert.equal(install({ ...fx, mode: 'install' }).artifacts.every((row) => row.state === 'unchanged'), true);
  writeFileSync(join(fx.pack, 'SKILL.md'), readFileSync(join(fx.pack, 'SKILL.md'), 'utf8') + 'Updated source\n');
  assert.equal(install({ ...fx, mode: 'check' }).ok, false);
  assert.equal(install({ ...fx, mode: 'install' }).ok, true);
  assert.equal(install({ ...fx, mode: 'check' }).ok, true);
  const removed = install({ ...fx, mode: 'uninstall' });
  assert.equal(removed.ok, true);
  assert.equal(removed.removed.length, 33);
  assert.equal(existsSync(path), false);
});

test('unowned conflicts preflight all mutations and preserve existing content', (t) => {
  const fx = fixture(t);
  mkdirSync(join(fx.home, '.claude/commands'), { recursive: true });
  const conflict = join(fx.home, '.claude/commands/sapling-review.md');
  writeFileSync(conflict, 'existing user command');
  assert.equal(install({ ...fx, mode: 'install' }).ok, false);
  assert.equal(readFileSync(conflict, 'utf8'), 'existing user command');
  assert.equal(existsSync(join(fx.home, '.codex')), false);
});

test('modified owned files survive reinstall and uninstall', (t) => {
  const fx = fixture(t);
  install({ ...fx, mode: 'install' });
  const path = join(fx.home, '.codex/prompts/sapling-new.md');
  writeFileSync(path, 'user modification');
  assert.equal(install({ ...fx, mode: 'check' }).ok, false);
  assert.equal(install({ ...fx, mode: 'install' }).ok, false);
  const result = install({ ...fx, mode: 'uninstall' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.preserved, ['.codex/prompts/sapling-new.md']);
  assert.equal(readFileSync(path, 'utf8'), 'user modification');
});

test('symlinked destination trees and forged manifests are refused', (t) => {
  const fx = fixture(t);
  symlinkSync(fx.appRoot, join(fx.home, '.codex'));
  assert.equal(install({ ...fx, mode: 'install' }).ok, false);
  assert.equal(existsSync(join(fx.appRoot, 'prompts')), false);
  rmSync(join(fx.home, '.codex'));
  mkdirSync(join(fx.home, '.local/state/cambium-sapling-lifecycle'), { recursive: true });
  writeFileSync(join(fx.home, '.local/state/cambium-sapling-lifecycle/install.json'), JSON.stringify({ owner: 'cambium-sapling-lifecycle-v1', artifacts: [{ path: '../../../app/VERSION', digest: 'a'.repeat(64) }] }));
  assert.throws(() => install({ ...fx, mode: 'uninstall' }), /invalid owned artifact/);
});

test('optional Grok workflow copies are regular files with provenance and drift checks', (t) => {
  const fx = fixture(t);
  mkdirSync(join(fx.vaultRoot, '.grok/workflows'), { recursive: true });
  for (const name of ['sapling-product-loop', 'brand-case-loop', 'cambium-social-thread', 'search-stack-run']) writeFileSync(join(fx.vaultRoot, `.grok/workflows/${name}.rhai`), 'let meta = #{};\n');
  assert.equal(install({ ...fx, mode: 'install', withWorkflows: true }).ok, true);
  assert.match(readFileSync(join(fx.home, '.grok/workflows/sapling-product-loop.rhai'), 'utf8'), /^\/\/ managed-by:.*sha256:/);
  writeFileSync(join(fx.vaultRoot, '.grok/workflows/sapling-product-loop.rhai'), 'changed\n');
  assert.equal(install({ ...fx, mode: 'check', withWorkflows: true }).ok, false);
});

test('selected workflow copy preserves other pre-existing user workflows', (t) => {
  const fx = fixture(t);
  mkdirSync(join(fx.vaultRoot, '.grok/workflows'), { recursive: true });
  mkdirSync(join(fx.home, '.grok/workflows'), { recursive: true });
  writeFileSync(join(fx.vaultRoot, '.grok/workflows/sapling-product-loop.rhai'), 'let meta = #{};\n');
  const user = join(fx.home, '.grok/workflows/brand-case-loop.rhai');
  writeFileSync(user, 'user managed workflow');
  const options = { ...fx, withWorkflows: true, workflows: ['sapling-product-loop'] };
  assert.equal(install({ ...options, mode: 'install' }).ok, true);
  assert.equal(readFileSync(user, 'utf8'), 'user managed workflow');
  assert.equal(install({ ...options, mode: 'check' }).ok, true);
  install({ ...fx, mode: 'uninstall' });
  assert.equal(readFileSync(user, 'utf8'), 'user managed workflow');
});

test('graph checks roots, unique nodes, status, publishing and edge identity', (t) => {
  const fx = fixture(t);
  const good = validateGraph(fx.graph, fx);
  assert.equal(good.ok, true);
  assert.equal(good.confirmed, false);
  assert.equal(good.fence_accepted, true);
  assert.equal(good.nodes[0].verification, 'file-observed');
  assert.equal(good.trace_verified, false);
  assert.ok(good.findings.some((finding) => /Trace provenance unverified/.test(finding)));
  assert.match(mermaid(good), /n0 --> n1/);
  assert.equal(validateGraph(fx.graph, { ...fx, appRoot: join(fx.base, 'absent') }).ok, false);
  assert.equal(validateGraph({ ...fx.graph, packet: [...fx.graph.packet, fx.graph.packet[0]] }, fx).ok, false);
  assert.equal(validateGraph({ ...fx.graph, edges: [{ from_id: 'release', to_id: 'missing' }] }, fx).ok, false);
  assert.equal(validateGraph({ ...fx.graph, packet: [{ ...fx.graph.packet[0], publishes: true }] }, fx).ok, false);
  assert.equal(validateGraph({ ...fx.graph, packet: [{ ...fx.graph.packet[0], status: 'live' }] }, fx).ok, false);
});

test('trace binding rejects invented nodes, duplicate identities and proof/status substitution', (t) => {
  const fx = fixture(t);
  const trace = fx.graph.packet.map((node) => ({ ...node, id: node.node_id }));
  assert.equal(validateGraph({ ...fx.graph, traced_nodes: trace }, fx).trace_verified, true);
  const invented = validateGraph({ ...fx.graph, traced_nodes: [{ id: 'original' }] }, fx);
  assert.equal(invented.ok, false);
  assert.ok(invented.errors.some((error) => /absent from traced_nodes/.test(error)));
  assert.equal(validateGraph({ ...fx.graph, traced_nodes: [...trace, trace[0]] }, fx).ok, false);
  assert.equal(validateGraph({ ...fx.graph, traced_nodes: trace, packet: [{ ...fx.graph.packet[0], evidence: fx.graph.packet[1].evidence }] }, fx).ok, false);
  assert.equal(validateGraph({ ...fx.graph, traced_nodes: trace, packet: [{ ...fx.graph.packet[0], status: 'draft' }] }, fx).ok, false);
  const incomplete = validateGraph({ ...fx.graph, traced_nodes: trace.map(({ id }) => ({ id })) }, fx);
  assert.equal(incomplete.trace_verified, false);
  assert.ok(incomplete.findings.some((finding) => /trace evidence\/status incomplete/.test(finding)));
});

test('graph refuses rejected fences, recording, stale and contradictory claims', (t) => {
  const fx = fixture(t);
  assert.equal(validateGraph({ ...fx.graph, confirmed: false }, fx).ok, false);
  assert.equal(validateGraph(fx.graph, { ...fx, record: true }).ok, false);
  assert.equal(validateGraph(fx.graph, { ...fx, approved: true }).ok, false);
  assert.equal(validateGraph({ ...fx.graph, packet: [{ ...fx.graph.packet[0], verification: 'conflicting' }] }, fx).ok, false);
  assert.equal(validateGraph({ ...fx.graph, packet: [{ ...fx.graph.packet[0], source_digest: 'a'.repeat(64) }] }, fx).ok, false);
});

test('HTTPS is unverified and symlink evidence cannot escape approved roots', (t) => {
  const fx = fixture(t);
  const url = validateGraph({ confirmed: true, nodes: [{ id: 'page', status: 'draft', evidence: 'https://example.com/', publishes: false }], edges: [] }, fx);
  assert.equal(url.nodes[0].verification, 'unverified');
  assert.equal(url.confirmed, false);
  assert.ok(url.findings.some((finding) => /URL alone/.test(finding)));
  writeFileSync(join(fx.base, 'private'), 'not permitted');
  symlinkSync(join(fx.base, 'private'), join(fx.appRoot, 'escape'));
  assert.equal(validateGraph({ confirmed: true, nodes: [{ id: 'escape', status: 'draft', evidence: join(fx.appRoot, 'escape'), publishes: false }] }, fx).ok, false);
});

test('review and status retain holds and schedule without declaring admission', (t) => {
  const fx = fixture(t);
  const temperance = lifecycle('status', 'temperance', undefined, fx);
  assert.equal(temperance.observations[0].admitted, false);
  assert.match(temperance.observations[0].gates, /v1\.1 clean-host/);
  const lumen = lifecycle('status', 'lumen-bar', undefined, fx);
  assert.match(lumen.observations[0].current_gate, /Scheduled November 3, 2026, 12:01 AM PST/);
  assert.equal(lifecycle('review', 'all', undefined, fx).observations.length, 3);
  assert.equal(lifecycle('new', 'new-product', undefined, fx).status, 'candidate-preparation');
  assert.equal(lifecycle('new', 'iverif', undefined, fx).status, 'already-indexed');
});

test('one selected step prepares no external action and completed steps never replay', (t) => {
  const fx = fixture(t);
  assert.equal(lifecycle('run', 'iverif', undefined, fx).status, 'selection-required');
  const options = { ...fx, state: '.local/sapling-lifecycle/iverif.json', stepKey: 'campaign-1' };
  const first = lifecycle('run', 'iverif', 'draft', options);
  assert.equal(first.prepared_steps, 1);
  assert.equal(first.external_action_performed, false);
  const statePath = join(fx.sourceRoot, options.state);
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  state.steps[0].status = 'completed';
  state.steps[0].proof_ref = 'owning-service:observed-result';
  writeFileSync(statePath, JSON.stringify(state));
  assert.equal(lifecycle('run', 'iverif', 'draft', options).status, 'already-completed');
  assert.equal(lifecycle('status', 'iverif', undefined, options).progress.steps[0].proof_ref, 'owning-service:observed-result');
  assert.throws(() => lifecycle('run', 'iverif', 'draft', { ...options, state: '../external.json' }), /output\/state/);
  assert.throws(() => lifecycle('run', 'iverif', 'draft; schedule', fx), /unsupported step/);
});

test('read route refuses record/approved flags and CLI rejects extra step arguments', (t) => {
  const fx = fixture(t);
  assert.throws(() => lifecycle('graph', 'temperance', undefined, { ...fx, record: true }), /record must be false/);
  assert.throws(() => parseArgs(['graph', 'temperance', '--record=true']), /record=false/);
  assert.throws(() => parseArgs(['run', 'iverif', 'draft', 'release']), /at most one/);
  assert.deepEqual(parseArgs(['run', 'iverif', 'draft', '--step-key', 'one']).selection, 'draft');
  assert.throws(() => lifecycle('new', '../unsafe', undefined, fx), /safe slug/);
});

test('local roots config refreshes catalog source evidence without copying contents', (t) => {
  const fx = fixture(t);
  mkdirSync(join(fx.pack, 'references'), { recursive: true });
  writeFileSync(join(fx.vaultRoot, 'workflow.md'), 'private source');
  writeFileSync(join(fx.pack, 'references/catalog.json'), JSON.stringify({ components: [{ id: 'test', source: { root: 'vault', path: 'workflow.md' } }] }));
  mkdirSync(join(fx.sourceRoot, '.local/sapling-lifecycle'), { recursive: true });
  writeFileSync(join(fx.sourceRoot, '.local/sapling-lifecycle/roots.json'), JSON.stringify({ vaultRoot: fx.vaultRoot }));
  const report = lifecycle('review', 'all', undefined, { sourceRoot: fx.sourceRoot });
  assert.equal(report.workflows.components[0].verification, 'file-observed');
  assert.equal(JSON.stringify(report).includes('private source'), false);
});

test('hardlinked report and progress outputs cannot overwrite source files', (t) => {
  const fx = fixture(t);
  const local = join(fx.sourceRoot, '.local/sapling-lifecycle');
  mkdirSync(local, { recursive: true });
  const source = join(fx.sourceRoot, 'PROJECT.md');
  const before = readFileSync(source, 'utf8');
  linkSync(source, join(local, 'report.json'));
  assert.throws(() => lifecycle('status', 'iverif', undefined, { ...fx, out: '.local/sapling-lifecycle/report.json' }), /hardlinked/);
  assert.equal(readFileSync(source, 'utf8'), before);
  linkSync(source, join(local, 'progress.json'));
  assert.throws(() => lifecycle('run', 'iverif', 'draft', { ...fx, state: '.local/sapling-lifecycle/progress.json' }), /hardlinked/);
  assert.equal(readFileSync(source, 'utf8'), before);
});

test('a local output symlink into the same repository cannot overwrite tracked docs', (t) => {
  const fx = fixture(t);
  const docs = join(fx.sourceRoot, 'docs');
  writeFileSync(join(docs, 'README.md'), 'tracked docs remain intact');
  mkdirSync(join(fx.sourceRoot, '.local'));
  symlinkSync(docs, join(fx.sourceRoot, '.local/sapling-lifecycle'));
  assert.throws(() => lifecycle('status', 'iverif', undefined, { ...fx, out: '.local/sapling-lifecycle/README.md' }), /symlink refused/);
  assert.equal(readFileSync(join(docs, 'README.md'), 'utf8'), 'tracked docs remain intact');
});
