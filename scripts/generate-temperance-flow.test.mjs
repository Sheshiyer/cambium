import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatorPath = path.join(repositoryRoot, 'scripts/generate-temperance-flow.mjs');
const FLOW_SCHEMA = 'cambium.temperance-flow-projection.v1';
const MANIFEST_SCHEMA = 'temperance.manifest-verification.v1';
const FIXED_ISSUER = 'temperance-manifest-bridge';
const FIXED_AUDIENCE = 'cambium-temperance-flow';
const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
let sourceApi = null;

try {
  sourceApi = await import('./temperance-flow-sources.mjs');
} catch {
  // Semantic RED failures below must name the missing contract.
}

function requireSourceApi(label) {
  assert.equal(typeof sourceApi?.buildTemperanceFlowSources, 'function', `${label}: FLOW source adapter is not implemented`);
  assert.equal(typeof sourceApi?.normalizeVerifiedManifestResult, 'function', `${label}: receipt normalizer is not implemented`);
  return sourceApi;
}

function runGenerator(root, args, { succeeds = true } = {}) {
  assert.equal(existsSync(generatorPath), true, 'FLOW generator is not implemented');
  const result = spawnSync(process.execPath, [generatorPath, '--root', root, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (succeeds) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, 'generator was expected to fail');
  return result;
}

function copyPath(root, relativePath) {
  const source = path.join(repositoryRoot, relativePath);
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

function makeFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'cambium-temperance-readback-'));
  for (const relativePath of [
    'ISA.md',
    '.planning/STATE.md',
    '.project/HANDOFF.md',
    '.planning/phases/05-ralph-and-temperance-flow-projection/05-01-PLAN.md',
    '.planning/phases/05-ralph-and-temperance-flow-projection/05-02-PLAN.md',
    '.planning/phases/05-ralph-and-temperance-flow-projection/05-03-PLAN.md',
    '.planning/phases/05-ralph-and-temperance-flow-projection/05-01-SUMMARY.md',
    'docs/architecture/intent-graph.v1.json',
  ]) copyPath(root, relativePath);
  return {
    root,
    json: path.join(root, 'docs/architecture/temperance-flow.v1.json'),
    markdown: path.join(root, 'docs/architecture/temperance-flow.md'),
    cleanup() { rmSync(root, { recursive: true, force: true }); },
  };
}

function outputArgs(fixture, mode) {
  return [mode, '--json-output', fixture.json, '--markdown-output', fixture.markdown];
}

function walkFiles(root, current = root) {
  const paths = [];
  for (const name of readdirSync(current)) {
    const pathname = path.join(current, name);
    const relative = path.relative(root, pathname).split(path.sep).join('/');
    if (lstatSync(pathname).isDirectory()) paths.push(...walkFiles(root, pathname));
    else paths.push(relative);
  }
  return paths.sort();
}

function snapshot(root, excluded = new Set()) {
  return Object.fromEntries(walkFiles(root)
    .filter((relativePath) => !excluded.has(relativePath))
    .map((relativePath) => [relativePath, readFileSync(path.join(root, relativePath))]));
}

function verifiedManifest(overrides = {}) {
  const base = {
    schema: MANIFEST_SCHEMA,
    verified: true,
    issuer: FIXED_ISSUER,
    audience: FIXED_AUDIENCE,
    issuedAt: '2026-08-19T07:00:00.000Z',
    expiresAt: '2026-08-19T08:00:00.000Z',
    nonce: 'nonce-phase5-plan02-task01',
    status: 'verified',
    receiptRef: 'manifest:phase5/plan02/task01',
    evidencePointer: 'manifest:event/phase5-plan02-task01',
    taskId: 'phase5-plan02-task01',
    projectionDigest: digest('projection'),
    command: '/gsd:execute-phase 5',
    route: { skillCluster: 'gsd-execute-phase', combo: 'te-dispatch-paid', lane: 'paid_execution' },
    attribution: { provider: 'redacted-provider', model: 'redacted-model' },
    payloadDigest: digest('payload'),
  };
  return { ...base, ...overrides };
}

test('FLOW-01 / D-01 / D-02: actual repository sources produce exactly one ready-or-blocked flow', () => {
  const api = requireSourceApi('actual repository');
  const model = api.buildTemperanceFlowSources(repositoryRoot);
  assert.equal(model.authorities.isa.goal.length > 0, true);
  assert.equal(model.authorities.gsd.command.startsWith('/gsd:'), true);
  assert.equal(model.tasks.filter(({ status }) => status === 'ready').length <= 1, true);
  assert.equal(model.intentGraphRef.schema, 'cambium.intent-graph-projection.v1');
});

test('FLOW-04 / D-09 / D-10 / D-11: write/check are deterministic and JSON/Markdown stay digest-identical', (t) => {
  requireSourceApi('parity');
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  const before = snapshot(fixture.root);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  const firstJson = readFileSync(fixture.json);
  const firstMarkdown = readFileSync(fixture.markdown);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  runGenerator(fixture.root, outputArgs(fixture, '--check'));
  runGenerator(fixture.root, outputArgs(fixture, '--check'));
  assert.deepEqual(readFileSync(fixture.json), firstJson);
  assert.deepEqual(readFileSync(fixture.markdown), firstMarkdown);
  const graph = JSON.parse(firstJson);
  const markdown = firstMarkdown.toString('utf8');
  assert.equal(graph.schema, FLOW_SCHEMA);
  assert.equal(graph.projectionAuthority, 'read_only');
  for (const value of [graph.flowDigest, graph.sourceSetDigest, graph.result.status]) assert.ok(markdown.includes(value), value);
  assert.equal(graph.references.intentGraph.schema, 'cambium.intent-graph-projection.v1');
  assert.equal(graph.route.intent.combo, 'te-dispatch-paid');
  assert.equal(graph.route.resolved, null);
  for (const [relativePath, bytes] of Object.entries(before)) {
    assert.deepEqual(readFileSync(path.join(fixture.root, relativePath)), bytes, relativePath);
  }
});

test('FLOW-01: missing selected state and selected-source drift fail closed with named evidence', (t) => {
  requireSourceApi('stale source');
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  rmSync(path.join(fixture.root, '.planning/STATE.md'));
  let result = runGenerator(fixture.root, outputArgs(fixture, '--check'), { succeeds: false });
  assert.match(result.stderr, /STATE\.md|missing/i);
  copyPath(fixture.root, '.planning/STATE.md');
  writeFileSync(path.join(fixture.root, '.planning/STATE.md'), readFileSync(path.join(fixture.root, '.planning/STATE.md'), 'utf8').replace('/gsd:plan-phase 5', '/gsd:verify-phase 5'));
  result = runGenerator(fixture.root, outputArgs(fixture, '--check'), { succeeds: false });
  assert.match(result.stderr, /STATE\.md|Operator Next Step|source changed|stale/i);
});

test('FLOW-04: stale output, path escape, symlink output, and mixed modes are rejected without source writes', (t) => {
  requireSourceApi('contained generator');
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  writeFileSync(fixture.markdown, `${readFileSync(fixture.markdown, 'utf8')}stale\n`);
  assert.match(runGenerator(fixture.root, outputArgs(fixture, '--check'), { succeeds: false }).stderr, /stale|temperance-flow\.md/i);
  const outside = mkdtempSync(path.join(tmpdir(), 'cambium-flow-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  assert.match(runGenerator(fixture.root, ['--write', '--json-output', path.join(outside, 'flow.json'), '--markdown-output', fixture.markdown], { succeeds: false }).stderr, /outside|escape|contain/i);
  const link = path.join(fixture.root, 'docs/architecture/flow-link.json');
  symlinkSync(path.join(outside, 'flow.json'), link);
  assert.match(runGenerator(fixture.root, ['--write', '--json-output', link, '--markdown-output', fixture.markdown], { succeeds: false }).stderr, /symlink|outside|escape|contain/i);
  assert.match(runGenerator(fixture.root, ['--write', '--check'], { succeeds: false }).stderr, /exactly one|mutually exclusive/i);
});

test('FLOW-03 / D-06 / D-07 / D-08: route intent never implies resolved attribution', (t) => {
  requireSourceApi('route intent');
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  const result = runGenerator(fixture.root, ['--json']);
  const graph = JSON.parse(result.stdout);
  assert.equal(graph.route.intent.skillCluster, 'gsd-execute-phase');
  assert.equal(graph.route.intent.combo, 'te-dispatch-paid');
  assert.equal(graph.route.intent.lane, 'paid_execution');
  assert.equal(graph.route.intent.approvalRequired, true);
  assert.equal(graph.route.resolved, null);
  assert.equal(graph.freshness.receipt, 'missing');
  assert.equal(graph.gates.some(({ kind, satisfied }) => kind === 'approval_boundary' && !satisfied), true);
});

test('FLOW-03: only a bounded fixed-boundary fresh Manifest verification result normalizes', () => {
  const api = requireSourceApi('receipt');
  const value = verifiedManifest();
  const normalized = api.normalizeVerifiedManifestResult(value, {
    now: '2026-08-19T07:30:00.000Z',
    receiptRef: value.receiptRef,
    taskId: value.taskId,
    projectionDigest: value.projectionDigest,
    command: value.command,
    route: value.route,
  });
  assert.deepEqual(normalized.attribution, value.attribution);
  assert.equal(normalized.status, 'verified');
  assert.equal(normalized.freshness, 'fresh');
  assert.equal(normalized.evidencePointer, value.evidencePointer);
  assert.equal('issuer' in normalized, false);
  assert.equal('payloadDigest' in normalized, false);
});

test('FLOW-03: unverified, wrong-boundary, stale, future, unbound, and replay-conflicting results are rejected', () => {
  const api = requireSourceApi('receipt rejection');
  const base = verifiedManifest();
  const expected = {
    now: '2026-08-19T07:30:00.000Z', receiptRef: base.receiptRef, taskId: base.taskId,
    projectionDigest: base.projectionDigest, command: base.command, route: base.route,
  };
  const mutations = [
    { verified: false },
    { issuer: 'attacker-verifier' },
    { audience: 'attacker-audience' },
    { expiresAt: '2026-08-19T07:29:59.000Z' },
    { issuedAt: '2026-08-19T07:30:01.000Z' },
    { taskId: 'other-task' },
    { projectionDigest: digest('other-projection') },
    { receiptRef: 'manifest:other' },
    { route: { ...base.route, combo: 'te-fast' } },
    { payloadDigest: digest('conflicting-payload'), nonce: base.nonce },
  ];
  for (const mutation of mutations) {
    assert.throws(() => api.normalizeVerifiedManifestResult({ ...base, ...mutation }, expected), /verified|issuer|audience|fresh|future|task|projection|receipt|route|replay|digest|bound/i);
  }
});

test('FLOW-03: policy, secret, session, absolute-path, prompt, and unredacted result fields are rejected', () => {
  const api = requireSourceApi('receipt privacy');
  const base = verifiedManifest();
  const expected = {
    now: '2026-08-19T07:30:00.000Z', receiptRef: base.receiptRef, taskId: base.taskId,
    projectionDigest: base.projectionDigest, command: base.command, route: base.route,
  };
  for (const extra of [
    { providerStack: ['private'] }, { quota: 99 }, { failoverPolicy: 'private' },
    { credential: 'secret=value' }, { promptBody: 'private prompt' }, { responseBody: 'private response' },
    { nativeSessionId: 'session-1' }, { receiptPath: '/Users/example/private.json' },
  ]) assert.throws(() => api.normalizeVerifiedManifestResult({ ...base, ...extra }, expected), /field|forbidden|redact|path|policy|credential|prompt|session/i);
  assert.throws(() => api.normalizeVerifiedManifestResult({ ...base, attribution: { provider: 'Bearer top-secret-token', model: 'm' } }, expected), /redact|secret|provider/i);
});

test('FLOW-03: CLI rejects raw receipts, caller trust roots, custom endpoints, and custom verifier arguments', (t) => {
  requireSourceApi('fixed verifier boundary');
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  for (const args of [
    ['--json', '--receipt-file', 'receipt.json'],
    ['--json', '--public-key', 'attacker.pem'],
    ['--json', '--manifest-endpoint', 'https://attacker.invalid'],
    ['--json', '--verifier', 'attacker-command'],
  ]) assert.match(runGenerator(fixture.root, args, { succeeds: false }).stderr, /unknown|forbidden|receipt|verifier|endpoint|key/i);
});

test('FLOW-04: generated-digest receipts are excluded from source identity while semantic handoff changes are selected', (t) => {
  const api = requireSourceApi('source-set self-reference');
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  const initial = api.buildTemperanceFlowSources(fixture.root);
  const handoffPath = path.join(fixture.root, '.project/HANDOFF.md');
  const original = readFileSync(handoffPath, 'utf8');
  writeFileSync(handoffPath, original.replace(
    '- Exact continuation is `/gsd:execute-phase 5`;',
    `- Generated flowDigest: ${digest('generated-flow')}\n- Generated sourceSetDigest: ${digest('generated-source')}\n- Exact continuation is \`/gsd:execute-phase 5\`;`,
  ));
  const excluded = api.buildTemperanceFlowSources(fixture.root);
  assert.deepEqual(excluded, initial);
  writeFileSync(handoffPath, readFileSync(handoffPath, 'utf8').replace('reviewed planning checkpoint', 'unreviewed planning checkpoint'));
  const changed = api.buildTemperanceFlowSources(fixture.root);
  assert.notDeepEqual(changed, initial);
});

test('FLOW-04: JSON output is private, source-bounded, and performs zero runtime writes', (t) => {
  requireSourceApi('privacy and zero writes');
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  const before = snapshot(fixture.root);
  const result = runGenerator(fixture.root, ['--json']);
  const graph = JSON.parse(result.stdout);
  assert.equal(graph.schema, FLOW_SCHEMA);
  assert.doesNotMatch(result.stdout, /\/Users\/|\/Volumes\/|credential|api[_-]?key|promptBody|responseBody|providerStack|quota|failoverPolicy/i);
  assert.equal(JSON.stringify(graph).includes('Consolidate Cambium\'s doctrine into'), false);
  assert.deepEqual(snapshot(fixture.root), before);
});
