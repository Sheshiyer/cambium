import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { compileTemperanceFlow } from './temperance-flow.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatorPath = path.join(repositoryRoot, 'scripts/generate-temperance-flow.mjs');
const FLOW_SCHEMA = 'cambium.temperance-flow-projection.v1';
const MANIFEST_SCHEMA = 'temperance.manifest-verification.v1';
const FIXED_ISSUER = 'temperance-manifest-bridge';
const FIXED_AUDIENCE = 'cambium-temperance-flow';
const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
let sourceApi = null;
let transactionApi = null;

try {
  sourceApi = await import('./temperance-flow-sources.mjs');
  transactionApi = await import('./two-file-transaction.mjs');
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

test('FLOW-01 / CR-04: the phase-wide command binds one phase-wide remaining-plan unit', (t) => {
  const api = requireSourceApi('phase-wide unit');
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  const model = api.buildTemperanceFlowSources(fixture.root);
  assert.equal(model.tasks.length, 1);
  assert.equal(model.tasks[0].id, 'phase5-remaining-plans');
  assert.match(model.tasks[0].name, /05-02, 05-03/);
  assert.equal(model.tasks[0].source.selector, 'whole-file');
  assert.equal(model.tasks[0].command, '/gsd:execute-phase 5');
  assert.equal(model.tasks[0].gates.filter(({ kind }) => kind === 'declared_verification').length, 2);
  const before = compileTemperanceFlow({ repositoryRoot: fixture.root, ...model });
  const laterPlan = path.join(fixture.root, '.planning/phases/05-ralph-and-temperance-flow-projection/05-03-PLAN.md');
  writeFileSync(laterPlan, `${readFileSync(laterPlan, 'utf8')}\n<!-- phase-wide binding probe -->\n`);
  const after = compileTemperanceFlow({ repositoryRoot: fixture.root, ...api.buildTemperanceFlowSources(fixture.root) });
  assert.notEqual(after.sourceSetDigest, before.sourceSetDigest, 'every remaining plan must be approval-bound');
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
  writeFileSync(handoffPath, original
    .replace(/- Generated flowDigest: sha256:[a-f0-9]{64}/, `- Generated flowDigest: ${digest('generated-flow')}`)
    .replace(/- Generated sourceSetDigest: sha256:[a-f0-9]{64}/, `- Generated sourceSetDigest: ${digest('generated-source')}`)
    .replace(/(`implementation_head` is `)[a-f0-9]{40}(`)/, `$1${'a'.repeat(40)}$2`));
  const excluded = api.buildTemperanceFlowSources(fixture.root);
  assert.deepEqual(excluded, initial);
  writeFileSync(handoffPath, readFileSync(handoffPath, 'utf8').replace('reviewed planning checkpoint', 'unreviewed planning checkpoint'));
  const changed = api.buildTemperanceFlowSources(fixture.root);
  assert.notDeepEqual(changed, initial);
});

test('FLOW-04 / WR-03: every readiness decision byte has a named source digest', (t) => {
  const api = requireSourceApi('decision provenance');
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  const cases = [
    ['ISA.md', 'ISC-1282', 'ISC-9999', (model) => model.authorities.isa.source],
    ['.planning/STATE.md', 'Phase: 5 of 7', 'Phase: 4 of 7', (model) => model.supportingSources.find(({ path: pathname, selector }) => pathname === '.planning/STATE.md' && selector.startsWith('text.line:Phase:'))],
    ['.project/HANDOFF.md', 'reviewed planning checkpoint', 'unreviewed planning checkpoint', (model) => model.supportingSources.find(({ path: pathname }) => pathname === '.project/HANDOFF.md')],
    ['.planning/phases/05-ralph-and-temperance-flow-projection/05-01-SUMMARY.md', 'Self-Check: PASSED', 'Self-Check: PASSED\n\nDecision evidence changed.', (model) => model.supportingSources.find(({ path: pathname }) => pathname.endsWith('05-01-SUMMARY.md'))],
  ];
  for (const [relative, beforeText, afterText, pick] of cases) {
    const before = api.buildTemperanceFlowSources(fixture.root);
    const beforeRef = pick(before);
    assert.ok(beforeRef, `${relative} must have a named decision reference`);
    const target = path.join(fixture.root, relative);
    writeFileSync(target, readFileSync(target, 'utf8').replace(beforeText, afterText));
    const after = api.buildTemperanceFlowSources(fixture.root);
    const afterRef = pick(after);
    assert.ok(afterRef, `${relative} reference must remain addressable after mutation`);
    assert.notEqual(afterRef.digest, beforeRef.digest, `${relative} decision mutation must change its named digest`);
    writeFileSync(target, readFileSync(target, 'utf8').replace(afterText, beforeText));
  }
});

test('FLOW-04 / WR-03: reviewed readiness binds the full checkpoint, implementation head, and generated pair', (t) => {
  const api = requireSourceApi('reviewed checkpoint binding');
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  mkdirSync(path.join(fixture.root, 'scripts'), { recursive: true });
  const runtimePath = path.join(fixture.root, 'scripts/runtime.mjs');
  writeFileSync(runtimePath, 'export const runtime = true;\n');
  const git = (...args) => {
    const result = spawnSync('/usr/bin/git', ['-C', fixture.root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout.trim();
  };
  git('init', '-q');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'user.name', 'Fixture');
  git('add', '.');
  git('reset', '-q', '--', '.project/HANDOFF.md');
  git('commit', '-qm', 'fixture implementation');
  const implementationHead = git('rev-parse', 'HEAD');
  const projection = JSON.parse(readFileSync(fixture.json, 'utf8'));
  const handoffPath = path.join(fixture.root, '.project/HANDOFF.md');
  writeFileSync(handoffPath, readFileSync(handoffPath, 'utf8')
    .replace(/(`implementation_head` is `)[a-f0-9]{40}(`)/, `$1${implementationHead}$2`)
    .replace(/- Generated flowDigest: sha256:[a-f0-9]{64}/, `- Generated flowDigest: ${projection.flowDigest}`)
    .replace(/- Generated sourceSetDigest: sha256:[a-f0-9]{64}/, `- Generated sourceSetDigest: ${projection.sourceSetDigest}`));
  git('add', '.project/HANDOFF.md');
  git('commit', '-qm', 'review fixture checkpoint');

  let model = api.buildTemperanceFlowSources(fixture.root);
  assert.equal(model.tasks[0].status, 'ready');
  const reviewedRef = model.supportingSources.find(({ kind }) => kind === 'reviewed_handoff');
  assert.match(reviewedRef.selector, /^markdown\.heading:/);
  const reviewPath = path.join(fixture.root, '.planning/phases/05-ralph-and-temperance-flow-projection/05-REVIEW.md');
  writeFileSync(reviewPath, '# Derived review artifact\n');
  writeFileSync(fixture.markdown, `${readFileSync(fixture.markdown, 'utf8')}\nDerived publication note.\n`);
  git('add', reviewPath, fixture.markdown);
  git('commit', '-qm', 'publish derived review artifacts');
  assert.equal(api.buildTemperanceFlowSources(fixture.root).tasks[0].status, 'ready');
  writeFileSync(runtimePath, 'export const runtime = false;\n');
  assert.equal(api.buildTemperanceFlowSources(fixture.root).tasks[0].status, 'pending');
  git('checkout', '--', 'scripts/runtime.mjs');
  assert.equal(api.buildTemperanceFlowSources(fixture.root).tasks[0].status, 'ready');
  writeFileSync(handoffPath, readFileSync(handoffPath, 'utf8')
    .replace('- Generated flowDigest:', '- Semantic checkpoint evidence changed.\n- Generated flowDigest:'));
  model = api.buildTemperanceFlowSources(fixture.root);
  assert.notEqual(model.supportingSources.find(({ kind }) => kind === 'reviewed_handoff').digest, reviewedRef.digest);
  git('add', '.project/HANDOFF.md');
  git('commit', '-qm', 'change reviewed evidence');
  assert.equal(api.buildTemperanceFlowSources(fixture.root).tasks[0].status, 'pending');

  git('reset', '--hard', 'HEAD^');
  writeFileSync(fixture.json, `${JSON.stringify({ ...projection, flowDigest: digest('stale-flow') }, null, 2)}\n`);
  assert.equal(api.buildTemperanceFlowSources(fixture.root).tasks[0].status, 'pending');
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

test('FLOW-04 / WR-04: a second publication rename failure restores the prior JSON/Markdown pair', (t) => {
  assert.equal(typeof transactionApi?.publishFilePair, 'function');
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  const priorJson = readFileSync(fixture.json, 'utf8');
  const priorMarkdown = readFileSync(fixture.markdown, 'utf8');
  let stagedRenames = 0;
  assert.throws(() => transactionApi.publishFilePair([
    { target: fixture.json, bytes: '{"next":true}\n', validate: JSON.parse },
    { target: fixture.markdown, bytes: '# next\n', validate: () => {} },
  ], {
    rename(from, to) {
      if (from.endsWith('.stage')) {
        stagedRenames += 1;
        if (stagedRenames === 2) throw new Error('forced second rename failure');
      }
      return renameSync(from, to);
    },
  }), /forced second rename failure/);
  assert.equal(readFileSync(fixture.json, 'utf8'), priorJson);
  assert.equal(readFileSync(fixture.markdown, 'utf8'), priorMarkdown);
  assert.equal(walkFiles(fixture.root).some((name) => /\.(?:stage|backup)$/.test(name)), false);
});

test('FLOW-04 / WR-04: restore failure preserves the durable journal and backups for retry', (t) => {
  assert.equal(typeof transactionApi?.recoverFilePair, 'function');
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  const priorJson = readFileSync(fixture.json, 'utf8');
  const priorMarkdown = readFileSync(fixture.markdown, 'utf8');
  const entries = [
    { target: fixture.json, bytes: '{"next":true}\n', validate: JSON.parse },
    { target: fixture.markdown, bytes: '# next\n', validate: () => {} },
  ];
  let stagedRenames = 0;
  assert.throws(() => transactionApi.publishFilePair(entries, {
    rename(from, to) {
      if (from.endsWith('.stage') && ++stagedRenames === 2) throw new Error('forced publish failure');
      if (from.endsWith('.backup')) throw new Error('forced restore failure');
      return renameSync(from, to);
    },
  }), /recovery remains pending.*forced restore failure/i);
  const pending = walkFiles(fixture.root);
  assert.equal(pending.some((name) => name.endsWith('.backup')), true);
  assert.equal(pending.some((name) => name.endsWith('.publication-transaction.json')), true);

  assert.equal(transactionApi.recoverFilePair(entries).status, 'rolled_back');
  assert.equal(readFileSync(fixture.json, 'utf8'), priorJson);
  assert.equal(readFileSync(fixture.markdown, 'utf8'), priorMarkdown);
  assert.equal(walkFiles(fixture.root).some((name) => /\.(?:stage|backup)$|publication-transaction\.json$/.test(name)), false);
});

test('FLOW-04 / WR-04: startup recovery repairs a process killed between pair renames', (t) => {
  assert.equal(typeof transactionApi?.recoverFilePair, 'function');
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  const priorJson = readFileSync(fixture.json, 'utf8');
  const priorMarkdown = readFileSync(fixture.markdown, 'utf8');
  const entries = [
    { target: fixture.json, bytes: '{"next":true}\n' },
    { target: fixture.markdown, bytes: '# next\n' },
  ];
  const transactionUrl = new URL('./two-file-transaction.mjs', import.meta.url).href;
  const child = `
    import { renameSync } from 'node:fs';
    const { publishFilePair } = await import(${JSON.stringify(transactionUrl)});
    const entries = ${JSON.stringify(entries)};
    let published = 0;
    publishFilePair(entries, { rename(from, to) {
      renameSync(from, to);
      if (from.endsWith('.stage') && ++published === 1) process.kill(process.pid, 'SIGKILL');
    }});
  `;
  const interrupted = spawnSync(process.execPath, ['--input-type=module', '--eval', child], { encoding: 'utf8' });
  assert.equal(interrupted.signal, 'SIGKILL', interrupted.stderr || interrupted.stdout);
  assert.equal(walkFiles(fixture.root).some((name) => name.endsWith('.publication-transaction.json')), true);

  assert.equal(transactionApi.recoverFilePair(entries).status, 'rolled_back');
  assert.equal(readFileSync(fixture.json, 'utf8'), priorJson);
  assert.equal(readFileSync(fixture.markdown, 'utf8'), priorMarkdown);
  assert.equal(walkFiles(fixture.root).some((name) => /\.(?:stage|backup)$|publication-transaction\.json$/.test(name)), false);
});

test('FLOW-04 / WR-04: concurrent publishers cannot recover or overwrite a live transaction', async (t) => {
  const fixture = makeFixture();
  t.after(fixture.cleanup);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  const transactionUrl = new URL('./two-file-transaction.mjs', import.meta.url).href;
  const marker = path.join(fixture.root, 'writer-paused');
  const entriesOne = [
    { target: fixture.json, bytes: '{"writer":1}\n' },
    { target: fixture.markdown, bytes: '# writer 1\n' },
  ];
  const entriesTwo = [
    { target: fixture.json, bytes: '{"writer":2}\n' },
    { target: fixture.markdown, bytes: '# writer 2\n' },
  ];
  const firstScript = `
    import { renameSync, writeFileSync } from 'node:fs';
    const { publishFilePair } = await import(${JSON.stringify(transactionUrl)});
    let published = 0;
    publishFilePair(${JSON.stringify(entriesOne)}, { rename(from, to) {
      renameSync(from, to);
      if (from.endsWith('.stage') && ++published === 1) {
        writeFileSync(${JSON.stringify(marker)}, 'paused');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
      }
    }});
  `;
  const secondScript = `
    const { publishFilePair } = await import(${JSON.stringify(transactionUrl)});
    publishFilePair(${JSON.stringify(entriesTwo)});
  `;
  const runChild = (script) => new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '--eval', script], { encoding: 'utf8' });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('exit', (code, signal) => resolve({ code, signal, stderr }));
  });
  const first = runChild(firstScript);
  for (let attempt = 0; attempt < 100 && !existsSync(marker); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(existsSync(marker), true, 'first writer must pause inside its live transaction');
  const second = runChild(secondScript);
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.code, 0, firstResult.stderr);
  assert.equal(secondResult.code, 0, secondResult.stderr);
  assert.equal(readFileSync(fixture.json, 'utf8'), entriesTwo[0].bytes);
  assert.equal(readFileSync(fixture.markdown, 'utf8'), entriesTwo[1].bytes);
  assert.equal(walkFiles(fixture.root).some((name) => /publication-(?:transaction\.json|transaction\.json\.lock)$|\.(?:stage|backup)$/.test(name)), false);
});
