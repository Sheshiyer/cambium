import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  renderDocumentationInventoryMarkdown,
  validateDocumentationInventory,
} from './documentation-inventory.mjs';
import { buildDocumentationInventorySources } from './documentation-inventory-sources.mjs';

const root = new URL('..', import.meta.url);
const repositoryRoot = fs.realpathSync(path.resolve(new URL('.', root).pathname));
const approvedGoal = "Consolidate Cambium's doctrine into a provenance-preserving infinite-game architecture anchored by canonical VISION.md and renewable MISSION.md, with ISA and GSD as the only goal/planning authorities. Map vision → mission → finite goals → tasks → evidence → learning as a fractal graph, and expose Ralph next actions, skill-cluster and OmniRoute flows, gates, and stop conditions through Temperance.";
const labsConsolidationGoal = "Consolidate Cambium's production Cloudflare authority in the Thoughtseed Labs account, reconcile exact 9d9d source assets through provenance-bound gates, and retire the legacy source only after verified parity and a founder-approved rollback window.";

function run(command, args, { encoding = 'utf8', cwd = repositoryRoot } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding,
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
  });
  assert.equal(result.status, 0, Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : result.stderr || result.stdout);
  return result.stdout;
}

function git(...args) {
  return String(run('/usr/bin/git', args)).trim();
}

const hasLiveCheckout = spawnSync('/usr/bin/git', ['rev-parse', '--verify', 'HEAD^{commit}'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).status === 0;

function requireLiveCheckout(t) {
  if (!hasLiveCheckout) t.skip('requires a live git checkout (standalone smoke clean copy has no .git)');
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function nulList(value) {
  return String(value).split('\0').filter(Boolean);
}

function repositorySnapshot() {
  const files = nulList(run('/usr/bin/git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard']));
  const records = files.map((relativePath) => {
    const absolute = path.join(repositoryRoot, relativePath);
    const metadata = fs.lstatSync(absolute, { bigint: true });
    return {
      path: relativePath,
      mode: metadata.mode.toString(),
      mtimeNs: metadata.mtimeNs.toString(),
      bytes: metadata.isSymbolicLink() ? `link:${fs.readlinkSync(absolute)}` : digest(fs.readFileSync(absolute)),
    };
  });
  const indexPath = git('rev-parse', '--git-path', 'index');
  const absoluteIndex = path.isAbsolute(indexPath) ? indexPath : path.join(repositoryRoot, indexPath);
  const index = fs.readFileSync(absoluteIndex);
  return {
    records,
    index: digest(index),
    status: run('/usr/bin/git', ['status', '--porcelain=v1', '-z']),
  };
}

function runInventoryCommand(script, revision) {
  const before = repositorySnapshot();
  const result = spawnSync('npm', ['run', '--silent', script, '--', '--source-revision', revision], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(repositorySnapshot(), before, `${script} must not write repository or Git-index state`);
  return result.stdout;
}

function runSafetyCheck(revision) {
  const before = repositorySnapshot();
  const result = spawnSync('npm', ['run', '--silent', 'safety:check', '--', '--source-revision', revision], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(repositorySnapshot(), before, 'safety:check must not write repository or Git-index state');
  assert.match(result.stdout, new RegExp(`^deterministic safety check passed: ${revision} sha256:[0-9a-f]{64} entries=\\d+\\n$`));
  assert.doesNotMatch(`${result.stdout}${result.stderr || ''}`, /MEMORY\/private|dirty-body/);
  return result;
}

function runFocusedNodeTests(relativeFile, pattern) {
  const result = spawnSync(process.execPath, ['--test', `--test-name-pattern=${pattern}`, relativeFile], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function corpusPathsAt(revision) {
  return nulList(run('/usr/bin/git', ['ls-tree', '-r', '-z', '--name-only', revision]))
    .filter((relativePath) => (
      (!relativePath.includes('/') && relativePath.endsWith('.md'))
      || relativePath.startsWith('docs/')
      || relativePath.startsWith('.planning/')
    ))
    .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
}

function markdownLinks(source) {
  return [...source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
}

function assertRepositoryLinksResolve(relativePath, source) {
  for (const target of markdownLinks(source)) {
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const withoutFragment = target.split('#', 1)[0];
    if (withoutFragment.length === 0 || /[<{]/.test(withoutFragment)) continue;
    const resolved = path.resolve(repositoryRoot, path.dirname(relativePath), decodeURIComponent(withoutFragment));
    assert.equal(resolved === repositoryRoot || resolved.startsWith(`${repositoryRoot}${path.sep}`), true, `${relativePath} link escapes repository: ${target}`);
    assert.equal(fs.existsSync(resolved), true, `${relativePath} contains unresolved link ${target}`);
  }
}

function assertNonAuthoritativeProjection(inventory) {
  assert.equal(inventory.projectionAuthority, 'read_only');
  for (const entry of inventory.entries) {
    assert.match(entry.recommendedDisposition, /^retain-/);
    assert.doesNotMatch(entry.recommendedDisposition, /delete|move|relocate|externalize|archive/i);
  }
}

function resolvePhaseBaseSha(summaryLabel, declaredSha) {
  const ancestry = spawnSync('/usr/bin/git', ['merge-base', '--is-ancestor', declaredSha, 'HEAD'], { cwd: repositoryRoot }).status;
  if (ancestry === 0) return declaredSha;
  // Squash merges orphan declared phase_base_sha commits: they stay on the
  // server but drop out of advertised refs once their feature branches are
  // pruned, so fresh CI clones never receive them. Try an explicit by-SHA
  // fetch first — GitHub serves such objects even when unreachable.
  const fetched = spawnSync('/usr/bin/git', ['fetch', '--quiet', 'origin', declaredSha], { cwd: repositoryRoot });
  if (fetched.status === 0) {
    const retry = spawnSync('/usr/bin/git', ['merge-base', declaredSha, 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' });
    if (retry.status === 0 && /^[0-9a-f]{40}$/.test((retry.stdout || '').trim())) {
      return retry.stdout.trim();
    }
  }
  // Offline or remote-less environments: widen to the merge base with HEAD if
  // one exists locally (an earlier base — the audit set grows, never shrinks).
  const merged = spawnSync('/usr/bin/git', ['merge-base', declaredSha, 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' });
  if (merged.status === 0 && /^[0-9a-f]{40}$/.test((merged.stdout || '').trim())) {
    return merged.stdout.trim();
  }
  throw new Error(`${summaryLabel} declared phase_base_sha is unreachable from HEAD and no merge base exists`);
}

function phaseBaseSha() {
  const summary = read('.planning/phases/06-documentation-stewardship/06-01-SUMMARY.md');
  const matches = [...summary.matchAll(/^phase_base_sha: ([0-9a-f]{40})$/gm)];
  assert.equal(matches.length, 1, '06-01 summary must declare one unique full phase_base_sha');
  return resolvePhaseBaseSha('06-01', matches[0][1]);
}

function phase7BaseSha() {
  const summary = read('.planning/phases/07-deterministic-safety-and-handoff/07-01-SUMMARY.md');
  const matches = [...summary.matchAll(/^phase_base_sha: ([0-9a-f]{40})$/gm)];
  assert.equal(matches.length, 1, '07-01 summary must declare one unique full phase_base_sha');
  return resolvePhaseBaseSha('07-01', matches[0][1]);
}

function nameStatus(rangeArgs, cwd = repositoryRoot) {
  return nulList(run('/usr/bin/git', ['diff', '--name-status', '-z', '--no-renames', ...rangeArgs], { cwd }));
}

function isApprovedV04RequirementsArchiveDeletion(status, relativePath, cwd) {
  if (status !== 'D' || relativePath !== '.planning/REQUIREMENTS.md') return false;
  const archivePath = path.join(cwd, '.planning/milestones/v0.4-REQUIREMENTS.md');
  if (!fs.existsSync(archivePath)) return false;
  const archive = fs.readFileSync(archivePath, 'utf8');
  return /^# Requirements Archive: v0\.4 Cambium Infinite-Game Doctrine and Intent Graph$/m.test(archive)
    && /^\*\*Status:\*\* SHIPPED$/m.test(archive);
}

function changedPathsAndKinds(baseSha, cwd = repositoryRoot, phaseLabel = 'Phase 6') {
  const collections = [
    // Two-dot (not three-dot): the fallback base can be the empty tree, which
    // three-dot symmetric difference rejects. For an ancestor base the two
    // forms are identical; for a fallback base two-dot is strictly wider
    // (includes both-side changes), so the audit set stays conservative.
    nameStatus([`${baseSha}..HEAD`], cwd),
    nameStatus(['--cached'], cwd),
    nameStatus([], cwd),
  ];
  const paths = new Set(nulList(run('/usr/bin/git', ['ls-files', '-z', '--others', '--exclude-standard'], { cwd })));
  for (const records of collections) {
    for (let index = 0; index < records.length;) {
      const status = records[index++];
      const relativePath = records[index++];
      if (!isApprovedV04RequirementsArchiveDeletion(status, relativePath, cwd)) {
        assert.doesNotMatch(status, /^[DR]/, `${phaseLabel} must not delete or rename paths (${status})`);
      }
      if (relativePath) paths.add(relativePath);
    }
  }
  return [...paths].sort();
}

const syntheticPrivacyFixtures = new Map([
  ['README.md', [
    ['/tmp/', 'demo-org.tapestry.json'].join(''),
  ]],
  ['scripts/documentation-inventory.test.mjs', [
    ["presentPurpose = 'Bearer ", "abcdefghijklmnop'"].join(''),
    ["prompt", "Body = 'private prompt'"].join(''),
    ['secret=', 'do-not-read'].join(''),
  ]],
  ['scripts/generate-documentation-inventory.test.mjs', [
    ['Bearer fixture-', 'private-value'].join(''),
    ['prompt', 'Body=never-emit'].join(''),
    ['/', 'Users/example/private'].join(''),
  ]],
  ['scripts/generate-temperance-flow.test.mjs', [
    ["credential: 'secret", "=value'"].join(''),
    ["prompt", "Body: 'private prompt'"].join(''),
    ["response", "Body: 'private response'"].join(''),
    ["native", "SessionId: 'session-1'"].join(''),
    ["receiptPath: '", "/", "Users/example/private.json'"].join(''),
    ["provider: 'Bearer ", "top-secret-token'"].join(''),
  ]],
  ['scripts/prove-marketing-create-prepare.sh', [
    ['request_', 'body="$proof_tmp/request.json"'].join(''),
  ]],
  ['scripts/prove-marketing-create-prepare.test.mjs', [
    ['/tmp/', 'cambium-curl-argv-'].join(''),
    ['file://', '/dev/null'].join(''),
    ['/tmp/', 'cambium-curl-home-'].join(''),
  ]],
  ['scripts/infinite-game-anchors.test.mjs', [
    ["presentPurpose = 'Bearer ", "abcdefghijklmnop'"].join(''),
    ["prompt", "Body = 'private prompt'"].join(''),
    ['Bearer otherwise-', 'long-enough-but-'].join(''),
  ]],
  ['.planning/phases/07-deterministic-safety-and-handoff/07-PATTERNS.md', [
    ['/', 'Users/', 'sheshnarayaniyer'].join(''),
    ['/', 'Volumes/', 'madara'].join(''),
  ]],
  ['.planning/phases/06-documentation-stewardship/06-04-PLAN.md', [
    ['.', 'claude', '/', 'MEMORY'].join(''),
    ['MEMORY', '/', 'LEARNING'].join(''),
  ]],
  ['scripts/ralph-iteration.test.mjs', [
    ['Bearer ', 'attacker-secret'].join(''),
    ['Bearer ', 'injected-secret'].join(''),
  ]],
  ['scripts/temperance-flow.test.mjs', [
    ['Bearer ', 'abcdefghijklmnop'].join(''),
    ['/', 'Users', '/operator/private-model'].join(''),
  ]],
  ['.planning/phases/07-deterministic-safety-and-handoff/07-RESEARCH.md', [
    ['/', 'Users/', 'sheshnarayaniyer'].join(''),
    ['/', 'Volumes/', 'madara'].join(''),
  ]],
  ['.planning/phases/07-deterministic-safety-and-handoff/07-01-SUMMARY.md', [
    ['/', 'Users/', 'sheshnarayaniyer'].join(''),
    ['/', 'Volumes/', 'madara'].join(''),
  ]],
  ['scripts/deterministic-safety.test.mjs', [
    ['/', 'Users/'].join(''),
    ['/', 'Volumes/'].join(''),
    ['prompt', 'Body='].join(''),
  ]],
  ['scripts/check-deterministic-safety.test.mjs', [
    ['/', 'Users/'].join(''),
    ['/', 'Volumes/'].join(''),
    ['prompt', 'Body='].join(''),
  ]],
  ['bin/invoke.test.mjs', [
    ['/tmp/', 'meristem-sidecar-proof'].join(''),
  ]],
  ['bin/quine/hyphae/quests.test.ts', [
    ['Bearer super-', 'secret-token'].join(''),
  ]],
  ['.planning/FITCHECK-RELEASE-HANDOFF-2026-08-11.md', [
    ['/tmp/', 'cambium-fitcheck-release.aTYxcV'].join(''),
  ]],
  ['MEMORY/WORK/d1-fitcheck-anchor/ISA.md', [
    ['/tmp/', 'fitcheck_proposal_validate.mjs'].join(''),
  ]],
  ['MEMORY/WORK/d1-iverif-anchor/ISA.md', [
    ['/tmp/', 'iverif_proposal_validate.mjs'].join(''),
  ]],
  ['workers/quests/src/operating-fabric-page.test.ts', [
    ['Bearer ', 'eyJhbGciOiJIUzI1NiJ9'].join(''),
    ['Bearer ', 'secret-token'].join(''),
  ]],
  ['workers/quests/src/handler.ts', [
    ['secret', ': deps.inviteSecret'].join(''),
    ['apiKey', ': deps.marketingRenderer'].join(''),
  ]],
  ['workers/quests/src/handler.test.ts', [
    ['Bearer ', 'context-token'].join(''),
    ['secret-', 'nebius-key'].join(''),
    ['Bearer secret-', 'nebius-'].join(''),
    ['secret-', 'kimi-key'].join(''),
    ['secret-', 'cc-key'].join(''),
    ['Bearer secret-', 'cc-key'].join(''),
    ['request', 'Body'].join(''),
    ['Bearer raw-', 'secret-must-not-render'].join(''),
    ['Bearer ', 'secret-token'].join(''),
    ['Bearer should-', 'never-render'].join(''),
    ['/tmp/', 'cambium-test-'].join(''),
    ['Bearer raw-', 'secret-must-not-persist'].join(''),
    ['Bearer not-the-', 'bridge-token'].join(''),
    ['Bearer ', 'candidate-secret'].join(''),
    ['Bearer ', 'task-secret'].join(''),
    ['/tmp/', 'claimed-proof'].join(''),
    ['Bearer otherwise-long-enough-but-', 'unnamespaced-read-token'].join(''),
    ['exclusive-worker-', 'secret-value'].join(''),
  ]],
]);

const D16_WORKER_VERSION = '089181f6-ed60-4710-aab6-cd10855360e0';
const D16_GRAPH_DIGEST = '846400e1fa23704849d48a3ae0d3bf26b7e96d47e353abc0e26075f1cf89b05e';
const PHASE7_CHECKPOINT_HEADING = /^### \d{4}-\d{2}-\d{2} Phase 7 deterministic safety and handoff implementation checkpoint$/m;
const D05_SURFACES = [
  'docs/architecture/intent-graph.v1.json',
  'docs/architecture/intent-graph.md',
  'docs/architecture/temperance-flow.v1.json',
  'docs/architecture/temperance-flow.md',
  '.temperance/project.json',
  'PROJECT.md',
  'README.md',
  'docs/README.md',
  'docs/doctrine/README.md',
  'docs/LIFECYCLE.md',
  '.planning/README.md',
  'INFINITE-GAME.md',
];

function t07Allowlisted(source) {
  return String(source)
    .replaceAll(D16_WORKER_VERSION, '<d16-worker-version>')
    .replaceAll(D16_GRAPH_DIGEST, '<d16-graph-digest>')
    .replace(/sha256:[0-9a-f]{64}/gi, 'sha256:<digest>');
}

function privacyViolations(relativePath, source) {
  const fixtureLiterals = syntheticPrivacyFixtures.get(relativePath) ?? [];
  const patterns = [
    new RegExp(`(?:file:\\/\\/(?:\\/|[A-Za-z]:)|\\/(?:${'Us' + 'ers'}|${'Vol' + 'umes'}|home)\\/[A-Za-z0-9._~-][^\\s'\"]*|[A-Za-z]:\\\\${'Us' + 'ers'}\\\\)`),
    new RegExp(`\\/(?:${'pri' + 'vate'}\\/(?:tmp|var\\/folders)|tmp)\\/[A-Za-z0-9._~-][^\\s'\"]*`),
    /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/i,
    /\b(?:authorization\s*[:=]\s*|bearer\s+)[A-Za-z0-9._~-]{12,}/i,
    /["'](?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|credential|password|secret|native[_-]?session(?:[_-]?(?:id|token))?)["']\s*:\s*["'][A-Za-z0-9._~+\/-]{8,}/i,
    /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|native[_-]?session(?:[_-]?(?:id|token))?)\s*[:=]\s*["']?[A-Za-z0-9._~+\/-]{8,}/i,
    /\b(?:credential|password|secret)\s*:\s*["']?[A-Za-z0-9._~+\/-]{8,}/i,
    /["']?(?:prompt|request|response|message)[_-]?(?:body|content|payload)["']?\s*[:=]\s*['"{\[]/i,
    new RegExp(`(?:\\.${'claude'}\\/${'MEMORY'}|${'MEMORY'}\\/(?:LEARNING|SIGNALS|STATE))`, 'i'),
    /["']?(?:rawMemory|raw_memory|serializedMemory)["']?\s*[:=]/i,
  ];
  const violations = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    let candidate = line;
    for (const literal of fixtureLiterals) candidate = candidate.replaceAll(literal, '<synthetic-sensitive-fixture>');
    for (const pattern of patterns) {
      if (pattern.test(candidate)) violations.push(`${relativePath}:${index + 1}`);
    }
  }
  return violations;
}

test('DOCS-PRIVACY: scanner rejects key material, quoted tokens, temporary paths, and fixture-line smuggling', () => {
  const privateKeyMarker = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
  const quotedToken = ['"access_', 'token": "abcdefghijklmnop"'].join('');
  const privateCheckout = ['/', 'pri', 'vate/', 'tm', 'p/cambium-phase6/private.md'].join('');
  const fixtureAndSecret = [
    "presentPurpose = 'Bearer ",
    "abcdefghijklmnop' ",
    '"access_',
    'token": "another-private-value"',
  ].join('');

  for (const [relativePath, source] of [
    ['key.md', privateKeyMarker],
    ['config.json', quotedToken],
    ['path.md', privateCheckout],
    ['scripts/documentation-inventory.test.mjs', fixtureAndSecret],
  ]) {
    assert.deepEqual(privacyViolations(relativePath, source), [`${relativePath}:1`]);
  }
});

test('DOCS-PRIVACY: exact copies remain visible when repository copy detection is enabled', (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cambium-privacy-copy-'));
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));
  run('/usr/bin/git', ['init', '--quiet'], { cwd: fixtureRoot });
  run('/usr/bin/git', ['config', 'user.name', 'Cambium Test'], { cwd: fixtureRoot });
  run('/usr/bin/git', ['config', 'user.email', 'cambium@example.invalid'], { cwd: fixtureRoot });
  const sensitive = ['"access_', 'token": "abcdefghijklmnop"\n'].join('');
  fs.writeFileSync(path.join(fixtureRoot, 'source.json'), sensitive);
  run('/usr/bin/git', ['add', '--', 'source.json'], { cwd: fixtureRoot });
  run('/usr/bin/git', ['commit', '--quiet', '-m', 'base'], { cwd: fixtureRoot });
  const baseSha = String(run('/usr/bin/git', ['rev-parse', 'HEAD'], { cwd: fixtureRoot })).trim();
  run('/usr/bin/git', ['config', 'diff.renames', 'copies'], { cwd: fixtureRoot });
  fs.copyFileSync(path.join(fixtureRoot, 'source.json'), path.join(fixtureRoot, 'copied.json'));
  run('/usr/bin/git', ['add', '--', 'copied.json'], { cwd: fixtureRoot });
  run('/usr/bin/git', ['commit', '--quiet', '-m', 'copy'], { cwd: fixtureRoot });

  const changed = changedPathsAndKinds(baseSha, fixtureRoot);
  assert.deepEqual(changed, ['copied.json']);
  assert.deepEqual(privacyViolations('copied.json', fs.readFileSync(path.join(fixtureRoot, 'copied.json'), 'utf8')),
    ['copied.json:1']);
});

function read(path) {
  const file = new URL(path, root);
  assert.equal(fs.existsSync(file), true, `${path} must exist`);
  assert.equal(fs.statSync(file).isFile(), true, `${path} must be a regular file`);
  return fs.readFileSync(file, 'utf8');
}

function assertHeadings(source, headings, path) {
  for (const heading of headings) {
    assert.match(source, new RegExp(`^${heading}$`, 'm'), `${path} must contain ${heading}`);
  }
}

function checkbox(source, id) {
  const match = source.match(new RegExp(`^- \\[(x| )\\] ${id}:`, 'm'));
  assert.ok(match, `${id} must have one active checkbox`);
  assert.equal(source.match(new RegExp(`^- \\[(?:x| )\\] ${id}:`, 'gm')).length, 1, `${id} must be stable and unique`);
  return match[1] === 'x';
}

const PHASE5_CRITERIA = ['ISC-1282', 'ISC-1283', 'ISC-1284', 'ISC-1285'];
const PHASE6_CRITERIA = ['ISC-1286', 'ISC-1287', 'ISC-1288', 'ISC-1289'];
const PHASE7_CRITERIA = ['ISC-1290', 'ISC-1291', 'ISC-1292', 'ISC-1293'];
const PHASE8_CRITERIA = ['ISC-2470', 'ISC-2471', 'ISC-2472', 'ISC-2473'];

function isCoherentIsaPhaseState(
  frontmatter,
  phase3Checks,
  phase4Checks,
  phase5Checks = {},
  phase6Checks = {},
  phase6AcceptanceHeading = null,
  phase7Checks = {},
  phase7AcceptanceHeading = null,
  phase8Checks = {},
  phase8AcceptanceHeading = null,
) {
  const phase3Complete = Object.values(phase3Checks).every(Boolean);
  const phase4Pending = Object.values(phase4Checks).every((value) => !value);
  const phase4GapExecution = ['ISC-1277', 'ISC-1278', 'ISC-1279', 'ISC-1281'].every((id) => phase4Checks[id] === true)
    && phase4Checks['ISC-1280'] === false;
  const phase4Complete = Object.values(phase4Checks).every(Boolean);
  const phase5Pending = PHASE5_CRITERIA.every((id) => phase5Checks[id] === false);
  const phase5Complete = PHASE5_CRITERIA.every((id) => phase5Checks[id] === true);
  const phase5AnyChecked = PHASE5_CRITERIA.some((id) => phase5Checks[id] === true);
  const phase5Prefix = PHASE5_CRITERIA.findIndex((id) => phase5Checks[id] !== true);
  const checkedPrefix = phase5Prefix === -1 ? PHASE5_CRITERIA.length : phase5Prefix;
  const progress = frontmatter.match(/^progress: (\d+)\/4$/m);
  const phase5Progress = progress ? Number(progress[1]) : null;
  const phase5PlanStart = /^phase: plan$/m.test(frontmatter) && phase5Progress === 0 && phase5Pending;
  const phase5ExecuteStart = /^phase: execute$/m.test(frontmatter) && phase5Progress === 0 && phase5Pending;
  const phase5ExecutePrefix = /^phase: execute$/m.test(frontmatter)
    && phase5Progress === checkedPrefix
    && checkedPrefix > 0
    && checkedPrefix === PHASE5_CRITERIA.filter((id) => phase5Checks[id] === true).length;
  const phase5Verified = /^phase: verify$/m.test(frontmatter) && phase5Progress === 4 && phase5Complete;
  const priorLifecycleState = (
    (!phase5AnyChecked && phase3Complete && phase4Pending && /^phase: verify$/m.test(frontmatter) && /^progress: 4\/4$/m.test(frontmatter))
    || (!phase5AnyChecked && phase3Complete && phase4Pending && /^(?:phase: plan|phase: execute)$/m.test(frontmatter) && /^progress: 0\/5$/m.test(frontmatter))
    || (!phase5AnyChecked && phase3Complete && phase4GapExecution && /^phase: execute$/m.test(frontmatter) && /^progress: 4\/5$/m.test(frontmatter))
    || (!phase5AnyChecked && phase3Complete && phase4Complete && /^phase: verify$/m.test(frontmatter) && /^progress: 5\/5$/m.test(frontmatter) && phase5Pending)
    || (phase3Complete && phase4Complete && (phase5PlanStart || phase5ExecuteStart || phase5ExecutePrefix || phase5Verified))
  );
  const phase6Known = PHASE6_CRITERIA.every((id) => typeof phase6Checks[id] === 'boolean');
  if (!phase6Known) return priorLifecycleState;

  const phase6Pending = PHASE6_CRITERIA.every((id) => phase6Checks[id] === false);
  const phase6Complete = PHASE6_CRITERIA.every((id) => phase6Checks[id] === true);
  const phase6Prefix = PHASE6_CRITERIA.findIndex((id) => phase6Checks[id] !== true);
  const checkedPhase6Prefix = phase6Prefix === -1 ? PHASE6_CRITERIA.length : phase6Prefix;
  const phase6Progress = progress ? Number(progress[1]) : null;
  const phase6PlanStart = /^phase: plan$/m.test(frontmatter) && phase6Progress === 0 && phase6Pending;
  const phase6ExecuteStart = /^phase: execute$/m.test(frontmatter) && phase6Progress === 0 && phase6Pending;
  const phase6ExecutePrefix = /^phase: execute$/m.test(frontmatter)
    && phase6Progress === checkedPhase6Prefix
    && checkedPhase6Prefix > 0
    && checkedPhase6Prefix < PHASE6_CRITERIA.length
    && checkedPhase6Prefix === PHASE6_CRITERIA.filter((id) => phase6Checks[id] === true).length;
  const phase6Verified = /^phase: verify$/m.test(frontmatter) && phase6Progress === 4 && phase6Complete;
  const phase6Active = phase6AcceptanceHeading === 'Active Phase 6 acceptance';
  const phase6Completed = phase6AcceptanceHeading === 'Completed Phase 6 acceptance';
  const phase6Result = phase3Complete
    && phase4Complete
    && phase5Complete
    && ((phase6Active && (phase6PlanStart || phase6ExecuteStart || phase6ExecutePrefix))
      || (phase6Completed && phase6Verified));
  const phase7Known = PHASE7_CRITERIA.every((id) => typeof phase7Checks[id] === 'boolean');
  if (!phase7Known) return phase6Result;

  const phase7Pending = PHASE7_CRITERIA.every((id) => phase7Checks[id] === false);
  const phase7Complete = PHASE7_CRITERIA.every((id) => phase7Checks[id] === true);
  const phase7Prefix = PHASE7_CRITERIA.findIndex((id) => phase7Checks[id] !== true);
  const checkedPhase7Prefix = phase7Prefix === -1 ? PHASE7_CRITERIA.length : phase7Prefix;
  const phase7Progress = progress ? Number(progress[1]) : null;
  const phase7PlanStart = /^phase: plan$/m.test(frontmatter) && phase7Progress === 0 && phase7Pending;
  const phase7ExecuteStart = /^phase: execute$/m.test(frontmatter) && phase7Progress === 0 && phase7Pending;
  const phase7ExecutePrefix = /^phase: execute$/m.test(frontmatter)
    && phase7Progress === checkedPhase7Prefix
    && checkedPhase7Prefix > 0
    && checkedPhase7Prefix < PHASE7_CRITERIA.length
    && checkedPhase7Prefix === PHASE7_CRITERIA.filter((id) => phase7Checks[id] === true).length;
  const phase7Verified = /^phase: verify$/m.test(frontmatter) && phase7Progress === 4 && phase7Complete;
  const phase7Active = phase7AcceptanceHeading === 'Active Phase 7 acceptance';
  const phase7Completed = phase7AcceptanceHeading === 'Completed Phase 7 acceptance';
  const phase7Result = phase3Complete
    && phase4Complete
    && phase5Complete
    && phase6Complete
    && ((phase7Active && (phase7PlanStart || phase7ExecuteStart || phase7ExecutePrefix))
      || (phase7Completed && phase7Verified));
  const phase8Known = PHASE8_CRITERIA.every((id) => typeof phase8Checks[id] === 'boolean');
  if (!phase8Known) return phase7Result;

  const phase8Pending = PHASE8_CRITERIA.every((id) => phase8Checks[id] === false);
  const phase8Complete = PHASE8_CRITERIA.every((id) => phase8Checks[id] === true);
  const phase8Prefix = PHASE8_CRITERIA.findIndex((id) => phase8Checks[id] !== true);
  const checkedPhase8Prefix = phase8Prefix === -1 ? PHASE8_CRITERIA.length : phase8Prefix;
  const phase8Progress = progress ? Number(progress[1]) : null;
  const phase8PlanStart = /^phase: plan$/m.test(frontmatter) && phase8Progress === 0 && phase8Pending;
  const phase8ExecuteStart = /^phase: execute$/m.test(frontmatter) && phase8Progress === 0 && phase8Pending;
  const phase8ExecutePrefix = /^phase: execute$/m.test(frontmatter)
    && phase8Progress === checkedPhase8Prefix
    && checkedPhase8Prefix > 0
    && checkedPhase8Prefix < PHASE8_CRITERIA.length
    && checkedPhase8Prefix === PHASE8_CRITERIA.filter((id) => phase8Checks[id] === true).length;
  const phase8Verified = /^phase: verify$/m.test(frontmatter) && phase8Progress === 4 && phase8Complete;
  const phase8Active = phase8AcceptanceHeading === 'Active Phase 8 acceptance';
  const phase8Completed = phase8AcceptanceHeading === 'Completed Phase 8 acceptance';
  return phase3Complete
    && phase4Complete
    && phase5Complete
    && phase6Complete
    && phase7Complete
    && ((phase8Active && (phase8PlanStart || phase8ExecuteStart || phase8ExecutePrefix))
      || (phase8Completed && phase8Verified));
}

test('ISA lifecycle accepts only coherent completed Phase 3 through active or completed Phase 8 states', () => {
  const phase3Complete = Object.fromEntries(['ISC-1273', 'ISC-1274', 'ISC-1275', 'ISC-1276'].map((id) => [id, true]));
  const phase4Pending = Object.fromEntries(['ISC-1277', 'ISC-1278', 'ISC-1279', 'ISC-1280', 'ISC-1281'].map((id) => [id, false]));
  const phase4GapExecution = { ...Object.fromEntries(Object.keys(phase4Pending).map((id) => [id, true])), 'ISC-1280': false };
  const phase4Complete = Object.fromEntries(Object.keys(phase4Pending).map((id) => [id, true]));
  const phase5Pending = Object.fromEntries(PHASE5_CRITERIA.map((id) => [id, false]));
  const phase5Prefix2 = { ...Object.fromEntries(PHASE5_CRITERIA.map((id) => [id, false])), 'ISC-1282': true, 'ISC-1283': true };
  const phase5Complete = Object.fromEntries(PHASE5_CRITERIA.map((id) => [id, true]));
  const phase6Pending = Object.fromEntries(PHASE6_CRITERIA.map((id) => [id, false]));
  const phase6Prefix2 = { ...phase6Pending, 'ISC-1286': true, 'ISC-1287': true };
  const phase6NonPrefix = { ...phase6Pending, 'ISC-1286': true, 'ISC-1288': true };
  const phase6Complete = Object.fromEntries(PHASE6_CRITERIA.map((id) => [id, true]));

  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Pending), true);
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 0/5', phase3Complete, phase4Pending), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 0/5', phase3Complete, phase4Pending), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 4/5', phase3Complete, phase4GapExecution), true);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 5/5', phase3Complete, phase4Complete, phase5Pending), true);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Complete), false);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 1/5', phase3Complete, phase4Pending), false);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 4/5', phase3Complete, phase4Pending), false);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 4/5', phase3Complete, phase4Complete), false);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 5/5', phase3Complete, phase4Pending), false);
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 0/4', phase3Complete, phase4Complete, phase5Pending), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 0/4', phase3Complete, phase4Complete, phase5Pending), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 2/4', phase3Complete, phase4Complete, phase5Prefix2), true);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Complete, phase5Complete), true);
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 1/4', phase3Complete, phase4Complete, phase5Pending), false);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 2/4', phase3Complete, phase4Complete, phase5Pending), false);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Complete, phase5Pending), false);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Pending, phase5Complete), false);
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 0/4', phase3Complete, phase4Complete, phase5Complete, phase6Pending,
    'Active Phase 6 acceptance'), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 0/4', phase3Complete, phase4Complete, phase5Complete, phase6Pending,
    'Active Phase 6 acceptance'), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 2/4', phase3Complete, phase4Complete, phase5Complete, phase6Prefix2,
    'Active Phase 6 acceptance'), true);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance'), true);
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 1/4', phase3Complete, phase4Complete, phase5Complete, phase6Pending,
    'Active Phase 6 acceptance'), false);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 2/4', phase3Complete, phase4Complete, phase5Complete, phase6NonPrefix,
    'Active Phase 6 acceptance'), false);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Complete, phase5Complete, phase6Pending,
    'Completed Phase 6 acceptance'), false);
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 0/4', phase3Complete, phase4Complete, phase5Complete, phase6Pending,
    'Completed Phase 6 acceptance'), false);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Active Phase 6 acceptance'), false);

  const phase7Pending = Object.fromEntries(PHASE7_CRITERIA.map((id) => [id, false]));
  const phase7Prefix2 = { ...phase7Pending, 'ISC-1290': true, 'ISC-1291': true };
  const phase7NonPrefix = { ...phase7Pending, 'ISC-1290': true, 'ISC-1292': true };
  const phase7Complete = Object.fromEntries(PHASE7_CRITERIA.map((id) => [id, true]));
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 0/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7Pending, 'Active Phase 7 acceptance'), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 0/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7Pending, 'Active Phase 7 acceptance'), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 2/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7Prefix2, 'Active Phase 7 acceptance'), true);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7Complete, 'Completed Phase 7 acceptance'), true);
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 1/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7Pending, 'Active Phase 7 acceptance'), false);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 2/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7NonPrefix, 'Active Phase 7 acceptance'), false);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7Pending, 'Completed Phase 7 acceptance'), false);
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 0/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7Pending, 'Completed Phase 7 acceptance'), false);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7Complete, 'Active Phase 7 acceptance'), false);
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 0/4', phase3Complete, phase4Complete, phase5Complete, phase6Pending,
    'Active Phase 6 acceptance', phase7Pending, 'Active Phase 7 acceptance'), false);

  const phase8Pending = Object.fromEntries(PHASE8_CRITERIA.map((id) => [id, false]));
  const phase8Prefix2 = { ...phase8Pending, 'ISC-2470': true, 'ISC-2471': true };
  const phase8NonPrefix = { ...phase8Pending, 'ISC-2470': true, 'ISC-2472': true };
  const phase8Complete = Object.fromEntries(PHASE8_CRITERIA.map((id) => [id, true]));
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 0/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7Complete, 'Completed Phase 7 acceptance', phase8Pending, 'Active Phase 8 acceptance'), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 0/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7Complete, 'Completed Phase 7 acceptance', phase8Pending, 'Active Phase 8 acceptance'), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 2/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7Complete, 'Completed Phase 7 acceptance', phase8Prefix2, 'Active Phase 8 acceptance'), true);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7Complete, 'Completed Phase 7 acceptance', phase8Complete, 'Completed Phase 8 acceptance'), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 2/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7Complete, 'Completed Phase 7 acceptance', phase8NonPrefix, 'Active Phase 8 acceptance'), false);
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 0/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete,
    'Completed Phase 6 acceptance', phase7Pending, 'Active Phase 7 acceptance', phase8Pending, 'Active Phase 8 acceptance'), false);
});

// ANCHOR-01 and ANCHOR-02: one enduring Vision and one renewable Mission.
test('canonical root anchors declare singular doctrine and authority', () => {
  const vision = read('VISION.md');
  const mission = read('MISSION.md');

  assertHeadings(vision, [
    '# Cambium Vision',
    '## Just Cause',
    '## Infinite-game commitments',
    '## Non-goals',
    '## Authority and change',
    '## Supporting references',
  ], 'VISION.md');
  assert.match(vision, /singular[\s\S]{0,100}near-invariant/i);
  assert.match(vision, /continued meaningful play[\s\S]{0,120}coordinated finite games/i);
  assert.match(vision, /revenue[\s\S]*growth[\s\S]*feature completion[\s\S]*(?:single|one) product endpoint[\s\S]*(?:not|never) the finish line/i);
  assert.match(vision, /only[\s\S]{0,80}doctrine review[\s\S]{0,80}changes? (?:the )?Vision/i);

  assertHeadings(mission, [
    '# Cambium Mission',
    '## Authority and lifecycle',
    '## Current pursuit',
    '## Horizon',
    '## Evidence of progress',
    '## Renewal triggers',
    '## Retirement or replacement',
    '## Inherited boundaries',
    '## Supporting references',
  ], 'MISSION.md');
  assert.match(mission, /singular[\s\S]{0,100}Repository Mission/i);
  assert.match(mission, /renewable/i);
  assert.match(mission, /reviewed verification[\s\S]{0,120}release completion[\s\S]{0,80}v0\.4/i);
  assert.match(mission, /checked requirements[\s\S]*summaries[\s\S]*verification[\s\S]*reviewed handoff/i);
  assert.match(mission, /renew/i);
  assert.match(mission, /replace(?:ment|d)?[\s\S]{0,120}retire(?:ment|d)?|retire(?:ment|d)?[\s\S]{0,120}replace(?:ment|d)?/i);

  for (const [path, source] of [['VISION.md', vision], ['MISSION.md', mission]]) {
    assert.match(source, /ISA[\s\S]{0,100}approved goals[\s\S]{0,100}acceptance/i, `${path} must preserve ISA authority`);
    assert.match(source, /GSD[\s\S]{0,100}(?:finite )?planning/i, `${path} must preserve GSD authority`);
    assert.doesNotMatch(source, /^\s*[-*]\s+\[ \]/m, `${path} must not become a task planner`);
  }
});

// ANCHOR-04: the anchors remain subordinate to ISA/GSD goal and planning authority.
test('ISA binds the approved v0.5 Labs goal without erasing v0.4 history', () => {
  const isa = read('ISA.md');
  const frontmatter = (isa.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  const activeGoal = (isa.split('\n## Goal\n')[1] || '').trimStart();

  assert.ok(frontmatter.includes(`task: "${labsConsolidationGoal}"`), 'ISA frontmatter must bind the approved v0.5 goal exactly');
  assert.ok(activeGoal.startsWith(labsConsolidationGoal), 'ISA Goal must lead with the approved v0.5 goal exactly');
  assert.ok(isa.includes(`Historical v0.4 goal: ${approvedGoal}`), 'ISA must retain the approved v0.4 goal as history');
  assert.match(isa, /historical acceptance evidence/i);
  assert.match(isa, /historical[\s\S]{0,160}issue #331|issue #331[\s\S]{0,160}historical/i);
  assert.match(isa, /ISC-1273\.\.1276[\s\S]*scripts\/infinite-game-anchors\.test\.mjs/i);
  assert.match(isa, /CanonicalInfiniteGameAnchors[\s\S]*ISC-1273\.\.1276/);

  const phase3Checks = Object.fromEntries(['ISC-1273', 'ISC-1274', 'ISC-1275', 'ISC-1276'].map((id) => [id, checkbox(isa, id)]));
  const phase4Checks = Object.fromEntries(['ISC-1277', 'ISC-1278', 'ISC-1279', 'ISC-1280', 'ISC-1281'].map((id) => [id, checkbox(isa, id)]));
  const phase5Checks = Object.fromEntries(PHASE5_CRITERIA.map((id) => [id, checkbox(isa, id)]));
  const phase6Checks = Object.fromEntries(PHASE6_CRITERIA.map((id) => [id, checkbox(isa, id)]));
  const phase7Checks = Object.fromEntries(PHASE7_CRITERIA.map((id) => [id, checkbox(isa, id)]));
  const phase8Checks = Object.fromEntries(PHASE8_CRITERIA.map((id) => [id, checkbox(isa, id)]));
  const phase6AcceptanceHeadings = [...isa.matchAll(/^### ((?:Active|Completed) Phase 6 acceptance)$/gm)].map((match) => match[1]);
  const phase7AcceptanceHeadings = [...isa.matchAll(/^### ((?:Active|Completed) Phase 7 acceptance)$/gm)].map((match) => match[1]);
  const phase8AcceptanceHeadings = [...isa.matchAll(/^### ((?:Active|Completed) Phase 8 acceptance)$/gm)].map((match) => match[1]);
  assert.equal(phase6AcceptanceHeadings.length, 1, 'ISA must declare exactly one Phase 6 acceptance heading');
  assert.equal(phase7AcceptanceHeadings.length, 1, 'ISA must declare exactly one Phase 7 acceptance heading');
  assert.equal(phase8AcceptanceHeadings.length, 1, 'ISA must declare exactly one Phase 8 acceptance heading');
  assert.ok(
    isCoherentIsaPhaseState(
      frontmatter,
      phase3Checks,
      phase4Checks,
      phase5Checks,
      phase6Checks,
      phase6AcceptanceHeadings[0],
      phase7Checks,
      phase7AcceptanceHeadings[0],
      phase8Checks,
      phase8AcceptanceHeadings[0],
    ),
    'ISA must be coherent at completed Phase 3–7 and active or verified Phase 8',
  );
});

test('Phase 6 acceptance binds documentation stewardship without creating authority', () => {
  const isa = read('ISA.md');

  assert.match(isa, /^### Completed Phase 6 acceptance$/m);
  assert.match(isa, /ISC-1286:[^\n]*five-class lifecycle map[^\n]*(?:doctrine|Vision|Mission)[^\n]*(?:ISA|GSD)/i);
  assert.match(isa, /ISC-1287:[^\n]*explicit[^\n]*commit[^\n]*on-demand inventory[^\n]*machine[^\n]*human/i);
  assert.match(isa, /ISC-1288:[^\n]*additive[^\n]*(?:owner|authority)[^\n]*links[^\n]*STATE/i);
  assert.match(isa, /ISC-1289:[^\n]*recoverable[^\n]*evidence[^\n]*exception[^\n]*non-destructive/i);
  assert.match(isa, /RalphAndTemperanceFlowProjection[^\n]*satisfies ISC-1282\.\.1285/);
  assert.match(isa, /DocumentationStewardship[^\n]*satisfies ISC-1286\.\.1289[^\n]*depends_on RalphAndTemperanceFlowProjection/);
});

test('Phase 7 acceptance binds deterministic safety without creating authority', () => {
  const isa = read('ISA.md');
  const frontmatter = (isa.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  const headings = [...isa.matchAll(/^### ((?:Active|Completed) Phase 7 acceptance)$/gm)].map((match) => match[1]);
  assert.equal(headings.length, 1, 'ISA must declare exactly one Phase 7 acceptance heading');
  assert.equal(checkbox(isa, 'ISC-1289'), true);
  assert.match(isa, /ISC-1290:[^\n]*SAFE-01[^\n]*(?:doctrine|vision|mission)/i);
  assert.match(isa, /ISC-1291:[^\n]*SAFE-02[^\n]*(?:authority|manifest|overlay)/i);
  assert.match(isa, /ISC-1292:[^\n]*SAFE-03[^\n]*(?:freshness|privacy|digest)/i);
  assert.match(isa, /ISC-1293:[^\n]*SAFE-04[^\n]*handoff/i);
  assert.match(isa, /ISC-1290\.\.1293[^\n]*deterministic safety and handoff/);
  assert.match(isa, /DeterministicSafetyAndHandoff[^\n]*satisfies ISC-1290\.\.1293[^\n]*depends_on DocumentationStewardship/);
  if (headings[0] === 'Active Phase 7 acceptance') {
    assert.match(frontmatter, /^phase: plan$/m);
    assert.match(frontmatter, /^progress: 0\/4$/m);
    assert.equal(checkbox(isa, 'ISC-1290'), false);
    assert.equal(checkbox(isa, 'ISC-1291'), false);
    assert.equal(checkbox(isa, 'ISC-1292'), false);
    assert.equal(checkbox(isa, 'ISC-1293'), false);
  } else {
    assert.equal(headings[0], 'Completed Phase 7 acceptance');
    if (!/^### (?:Active|Completed) Phase 8 acceptance$/m.test(isa)) {
      assert.match(frontmatter, /^phase: verify$/m);
      assert.match(frontmatter, /^progress: 4\/4$/m);
    }
    assert.equal(checkbox(isa, 'ISC-1290'), true);
    assert.equal(checkbox(isa, 'ISC-1291'), true);
    assert.equal(checkbox(isa, 'ISC-1292'), true);
    assert.equal(checkbox(isa, 'ISC-1293'), true);
  }
});

// ANCHOR-04: discovery surfaces reference canonical anchors without copying them.
test('reference-only discovery surfaces point to canonical anchors', () => {
  const references = [
    ['INFINITE-GAME.md', /\]\(\.\/VISION\.md\)/, /\]\(\.\/MISSION\.md\)/],
    ['PROJECT.md', /\]\(\.\/VISION\.md\)/, /\]\(\.\/MISSION\.md\)/],
    ['docs/doctrine/README.md', /\]\(\.\.\/\.\.\/VISION\.md\)/, /\]\(\.\.\/\.\.\/MISSION\.md\)/],
    ['docs/README.md', /\]\(\.\.\/VISION\.md\)/, /\]\(\.\.\/MISSION\.md\)/],
  ];

  for (const [path, visionLink, missionLink] of references) {
    const source = read(path);
    assert.match(source, visionLink, `${path} must point directly to VISION.md`);
    assert.match(source, missionLink, `${path} must point directly to MISSION.md`);
  }

  const lifecycle = read('docs/LIFECYCLE.md');
  assert.match(lifecycle, /VISION\.md[\s\S]{0,160}near-invariant/i);
  assert.match(lifecycle, /MISSION\.md[\s\S]{0,160}renewable/i);
  assert.match(lifecycle, /VISION\.md[\s\S]*MISSION\.md[\s\S]*(?:do not|never|no)[\s\S]{0,100}(?:task|plan)/i);
});

// ANCHOR-03: Repository Mission and bounded FabricMission keep separate authority.
test('Repository Mission and FabricMission remain distinct', () => {
  const repositoryMission = read('MISSION.md');
  const runtime = read('workers/quests/src/mission-fabric.ts');

  assert.match(repositoryMission, /Repository Mission/);
  assert.match(repositoryMission, /no `FabricMission`[\s\S]{0,100}(?:inherits|inherit)[\s\S]{0,100}(?:rewrites|rewrite)/i);
  assert.match(runtime, /export interface FabricMission\s*{/);
  assert.match(runtime, /sourceOfTruth: 'd1-goal-graph'/);
  assert.match(runtime, /readOnly: true/);

  for (const path of [
    'docs/architecture/cambium-operating-fabric.md',
    'docs/architecture/contracts/mission-fabric-v1.md',
  ]) {
    const source = read(path);
    assert.match(source, /Repository Mission/, `${path} must name Repository Mission`);
    assert.match(source, /FabricMission/, `${path} must preserve FabricMission terminology`);
    assert.match(source, /D1 Goal Graph/, `${path} must preserve D1 authority`);
    assert.match(source, /read-only/i, `${path} must preserve projection authority`);
    assert.match(source, /(?:does not|never)[\s\S]{0,120}(?:inherit|rewrite|replace)[\s\S]{0,120}Repository Mission/i);
  }
});

test('DOCS-01 / D-01: documentation stewardship preserves the closed lifecycle and owner precedence', (t) => {
  requireLiveCheckout(t);
  const lifecycle = read('docs/LIFECYCLE.md');
  const classes = ['canonical', 'derived', 'historical', 'evidentiary', 'local-only'];
  assert.match(lifecycle, /lifecycle vocabulary is closed/i);
  for (const lifecycleClass of classes) {
    assert.equal(lifecycle.split(/\r?\n/).filter((line) => line.startsWith(`| \`${lifecycleClass}\` |`)).length, 1,
      `${lifecycleClass} must have exactly one lifecycle definition`);
  }
  const orderedOwners = [
    ['VISION.md', /Near-invariant enduring repository doctrine/i],
    ['MISSION.md', /Renewable repository doctrine horizon/i],
    ['ISA.md', /Approved goals, acceptance, and verification/i],
    ['.planning/STATE.md', /Current finite planning transition/i],
    ['docs/architecture/contracts/', /Runtime and data contracts/i],
    ['docs/runbooks/', /Operator procedures/i],
  ];
  let prior = -1;
  for (const [owner, truth] of orderedOwners) {
    const index = lifecycle.indexOf(owner);
    assert.ok(index > prior, `${owner} must appear once in owner precedence after the prior owner`);
    assert.match(lifecycle.slice(index, index + 240), truth, `${owner} must retain its bounded authority`);
    prior = index;
  }
  assert.match(lifecycle, /Classification is descriptive and non-destructive/i);
  assert.match(lifecycle, /never treat the view as authority/i);

  const revision = git('rev-parse', '--verify', 'HEAD^{commit}');
  const inventory = validateDocumentationInventory(JSON.parse(runInventoryCommand('docs:inventory:json', revision)));
  assert.deepEqual(inventory.lifecycleClasses, classes);
  assertNonAuthoritativeProjection(inventory);

  const elevated = structuredClone(inventory);
  elevated.projectionAuthority = 'planning';
  assert.throws(() => validateDocumentationInventory(elevated), /read_only|authority/i);
  const destructive = structuredClone(inventory);
  destructive.entries[0].recommendedDisposition = 'delete';
  assert.throws(() => validateDocumentationInventory(destructive), /disposition|retain/i);
  const copiedStatus = structuredClone(inventory);
  copiedStatus.entries[0].command = '/gsd:execute-phase 7';
  assert.throws(() => validateDocumentationInventory(copiedStatus), /forbidden field command/i);
});

test('DOCS-02 / D-02: explicit-revision inventory is exhaustive, deterministic, matching, and zero-write', (t) => {
  requireLiveCheckout(t);
  const revision = git('rev-parse', '--verify', 'HEAD^{commit}');
  assert.match(revision, /^[0-9a-f]{40}$/);
  const jsonOne = runInventoryCommand('docs:inventory:json', revision);
  const jsonTwo = runInventoryCommand('docs:inventory:json', revision);
  const markdownOne = runInventoryCommand('docs:inventory:markdown', revision);
  const markdownTwo = runInventoryCommand('docs:inventory:markdown', revision);
  const check = runInventoryCommand('docs:inventory:check', revision);
  assert.equal(jsonTwo, jsonOne);
  assert.equal(markdownTwo, markdownOne);
  assert.match(check, new RegExp(`^documentation inventory check passed: ${revision} sha256:[0-9a-f]{64} entries=\\d+\\n$`));

  const inventory = validateDocumentationInventory(JSON.parse(jsonOne));
  assert.equal(inventory.sourceRevision, revision);
  assert.equal(markdownOne, renderDocumentationInventoryMarkdown(inventory));
  assert.match(inventory.schema, /^cambium\.documentation-inventory\.v1$/);
  assert.match(inventory.sourceSetDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(inventory.inventoryDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(typeof inventory.rootMemory.tracked, 'boolean');

  const expectedPaths = corpusPathsAt(revision);
  const actualPaths = inventory.entries.map((entry) => entry.path);
  assert.deepEqual(actualPaths, expectedPaths);
  assert.equal(new Set(actualPaths).size, actualPaths.length);
  for (const entry of inventory.entries) {
    const committedBytes = run('/usr/bin/git', ['show', `${revision}:${entry.path}`], { encoding: null });
    assert.equal(entry.provenance.sourceRevision, revision);
    assert.equal(entry.provenance.contentDigest, `sha256:${digest(committedBytes)}`);
    assert.equal(entry.provenance.bytes, committedBytes.length);
  }
  assert.doesNotMatch(jsonOne, /(?:sourceBody|promptBody|requestBody|responseBody|messageBody)/i);
  assert.doesNotMatch(markdownOne, /(?:sourceBody|promptBody|requestBody|responseBody|messageBody)/i);
});

test('DOCS-03 / D-03: additive navigation resolves direct owners without copied live state', () => {
  const indexes = [
    'PROJECT.md',
    'README.md',
    'docs/README.md',
    'docs/doctrine/README.md',
    '.planning/README.md',
    'docs/plans/README.md',
    'docs/plans/product-branches/index.md',
  ];
  const sources = new Map(indexes.map((relativePath) => [relativePath, read(relativePath)]));
  for (const [relativePath, source] of sources) {
    assertRepositoryLinksResolve(relativePath, source);
    assert.doesNotMatch(source, /documentation-inventory(?:\.v1)?\.(?:json|md)/i, `${relativePath} must not link a generated inventory readback`);
    assert.doesNotMatch(source, /^progress:\s*\d+\/\d+|^status:\s*(?:active|blocked|complete)|next (?:command|step) (?:is|:)\s*`/gim,
      `${relativePath} must not freeze mutable STATE values`);
  }
  assert.match(sources.get('PROJECT.md'), /docs\/LIFECYCLE\.md/);
  assert.match(sources.get('PROJECT.md'), /documentation-inventory-v1\.md/);
  assert.match(sources.get('docs/README.md'), /\.planning\/STATE\.md/);
  assert.match(sources.get('.planning/README.md'), /\[.*STATE\.md.*\]\(STATE\.md\)/);
  assert.match(sources.get('docs/doctrine/README.md'), /VISION\.md[\s\S]*MISSION\.md/);
  assert.match(read('.planning/STATE.md'), /^# Project State$/m);

  const rejectCopiedLiveStatus = (source) => {
    if (/^progress:\s*\d+\/\d+|^status:\s*(?:active|blocked|complete)|next command is/mi.test(source)) {
      throw new TypeError('navigation must delegate mutable status to STATE');
    }
  };
  assert.throws(() => rejectCopiedLiveStatus('status: active\nnext command is `/gsd:execute-phase 7`'), /delegate mutable status/i);
});

test('DOCS-03 / D-03: live STATE preserves archived v0.4 and one coherent active v0.5 transition', () => {
  const state = read('.planning/STATE.md');
  const roadmap = read('.planning/ROADMAP.md');
  const roadmapArchive = read('.planning/milestones/v0.4-ROADMAP.md');
  const requirements = read('.planning/milestones/v0.4-REQUIREMENTS.md');
  const frontmatter = state.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';

  assert.match(frontmatter, /^milestone: v0\.5$/m);
  assert.match(frontmatter, /^status: Active$/m);
  assert.match(frontmatter, /^stopped_at: Phase 8 Plan 08-01 implementation in progress$/m);
  assert.match(frontmatter, /^\s+total_phases: 3$/m);
  assert.match(frontmatter, /^\s+completed_phases: 0$/m);
  assert.match(frontmatter, /^\s+total_plans: 1$/m);
  assert.match(frontmatter, /^\s+completed_plans: 0$/m);
  assert.match(frontmatter, /^\s+percent: 0$/m);

  assert.match(state, /^\*\*Current focus:\*\* Freeze Thoughtseed Labs production authority while keeping$/m);
  assert.match(state, /^Phase: 8 of 10 \(Labs Authority and Profile Safety\)$/m);
  assert.match(state, /^Plan: 08-01 \(in progress\)$/m);
  assert.match(state, /^Status: Active$/m);
  assert.match(state, /^Stopped at: Phase 8 Plan 08-01 implementation in progress$/m);
  assert.match(state, /^Resume file: \.planning\/phases\/08-labs-authority-and-profile-safety\/08-01-PLAN\.md$/m);
  assert.match(state, /`\/gsd:execute-phase 8`/);
  assert.doesNotMatch(state, /\/gsd:plan-phase 7/);
  assert.doesNotMatch(state, /\/gsd:secure-phase 6/);

  assert.match(roadmap, /^- ✅ \*\*v0\.4 Cambium Infinite-Game Doctrine and Intent Graph\*\* — Phases 3–7 shipped 2026-08-29 \(\[archive\]\(\.\/milestones\/v0\.4-ROADMAP\.md\)\)$/m);
  assert.match(roadmap, /^- \[x\] \*\*Phase 6: Documentation Stewardship\*\* — Added source-backed lifecycle classification and direct-owner navigation\.$/m);
  assert.match(roadmap, /^\| 6\. Documentation Stewardship \| v0\.4 \| 4\/4 \| Complete\s+\| 2026-08-20 \|$/m);
  assert.match(roadmap, /^- \[x\] \*\*Phase 7: Deterministic Safety and Handoff\*\* — Enforced authority, freshness, privacy, and reviewed-continuation checks\.$/m);
  assert.match(roadmapArchive, /^- \[x\] 07-03-PLAN.md /m);
  assert.match(roadmap, /^\| 7\. Deterministic Safety and Handoff \| v0\.4 \| 3\/3 \| Verified\s+\| 2026-08-22 \|$/m);
  for (const requirement of ['DOCS-01', 'DOCS-02', 'DOCS-03', 'DOCS-04']) {
    assert.match(requirements, new RegExp(`^\\| ${requirement} \\| Phase 6 \\| Complete \\|$`, 'm'));
  }
  for (const requirement of ['SAFE-01', 'SAFE-02', 'SAFE-03', 'SAFE-04']) {
    assert.match(requirements, new RegExp(`^\\| ${requirement} \\| Phase 7 \\| Complete \\|$`, 'm'));
    assert.match(requirements, new RegExp(`^- \\[x\\] \\*\\*${requirement}\\*\\*`, 'm'));
  }
});

test('Labs consolidation planning keeps production and legacy authority separate', () => {
  const isa = read('ISA.md');
  const state = read('.planning/STATE.md');
  const roadmap = read('.planning/ROADMAP.md');
  const project = read('.planning/PROJECT.md');
  const requirements = read('.planning/REQUIREMENTS.md');
  const milestoneContext = read('.planning/v0.5-MILESTONE-CONTEXT.md');
  const phaseContext = read('.planning/phases/08-labs-authority-and-profile-safety/08-CONTEXT.md');
  const phasePlan = read('.planning/phases/08-labs-authority-and-profile-safety/08-01-PLAN.md');
  const goal = JSON.parse(read('.temperance/goal.json'));
  const config = JSON.parse(read('.planning/config.json'));

  assert.ok(isa.includes(`task: "${labsConsolidationGoal}"`));
  assert.match(isa, /^### Active Phase 8 acceptance$/m);
  for (const id of ['ISC-2470', 'ISC-2471', 'ISC-2472', 'ISC-2473']) {
    assert.equal(checkbox(isa, id), false, `${id} must remain pending until Phase 8 verification`);
  }

  assert.match(state, /^milestone: v0\.5$/m);
  assert.match(state, /^status: Active$/m);
  assert.match(state, /^Phase: 8 of 10 \(Labs Authority and Profile Safety\)$/m);
  assert.match(state, /^Plan: 08-01 \(in progress\)$/m);
  assert.match(roadmap, /^- 🚧 \*\*v0\.5 Thoughtseed Labs Consolidation and Governed 9d9d Retirement\*\* — Phases 8–10 active$/m);
  assert.match(roadmap, /^- \[ \] \*\*Phase 8: Labs Authority and Profile Safety\*\*/m);

  for (const source of [project, requirements, milestoneContext, phaseContext, phasePlan]) {
    assert.match(source, /thoughtseed-labs/i);
    assert.match(source, /9d9d/i);
    assert.match(source, /read-only/i);
  }
  for (const requirement of ['AUTH-01', 'MAP-01', 'RUN-01']) {
    assert.ok(requirements.includes(`- [ ] **${requirement}**`));
    assert.ok(requirements.includes(`| ${requirement} | Phase 8 | Pending |`));
  }
  assert.equal(goal.text, labsConsolidationGoal);
  assert.equal(goal.gsd_command, 'execute-phase');
  assert.equal(config.temperance.fleet_combo, 'noesis-execute');
});

test('DOCS-04 / D-04: evidence stays recoverable and exceptions remain source-backed and non-destructive', (t) => {
  requireLiveCheckout(t);
  const revision = git('rev-parse', '--verify', 'HEAD^{commit}');
  const inventory = validateDocumentationInventory(JSON.parse(runInventoryCommand('docs:inventory:json', revision)));
  assertNonAuthoritativeProjection(inventory);
  const indexed = read('docs/plans/product-branches/index.md');
  const exceptionEntries = inventory.entries.filter((entry) => entry.exception !== null);
  assert.ok(exceptionEntries.length > 0, 'product-branch evidence index must yield explicit item exceptions');
  for (const entry of exceptionEntries) {
    assert.equal(entry.lifecycle, 'evidentiary');
    assert.equal(entry.exception.kind, 'indexed-product-branch-packet');
    assert.equal(entry.exception.evidencePath, 'docs/plans/product-branches/index.md');
    assert.equal(entry.exception.directoryDefault, 'historical');
    assert.equal(indexed.includes(path.posix.basename(entry.path)), true, `${entry.path} exception must be named by its evidence index`);
  }
  const unindexedHistorical = inventory.entries.filter((entry) => entry.path.startsWith('docs/plans/product-branches/') && entry.exception === null);
  for (const entry of unindexedHistorical) assert.equal(entry.lifecycle, entry.path.endsWith('/index.md') ? 'historical' : 'historical');

  const recoverable = inventory.entries.filter((entry) => ['historical', 'evidentiary'].includes(entry.lifecycle));
  assert.ok(recoverable.length > 0);
  for (const entry of recoverable) {
    assert.equal(spawnSync('/usr/bin/git', ['cat-file', '-e', `${revision}:${entry.path}`], { cwd: repositoryRoot }).status, 0,
      `${entry.path} must remain recoverable at the selected revision`);
  }
  changedPathsAndKinds(phaseBaseSha());

  const rejectUnindexedPromotion = (entry) => {
    if (entry.path.startsWith('docs/plans/product-branches/') && entry.lifecycle === 'evidentiary' && entry.exception === null) {
      throw new TypeError('unindexed exception promotion is forbidden');
    }
  };
  assert.throws(() => rejectUnindexedPromotion({ path: 'docs/plans/product-branches/lookalike.md', lifecycle: 'evidentiary', exception: null }),
    /unindexed exception promotion/i);
});

test('DOCS-PRIVACY / T-06-22: Phase 6 bytes and inventory stdout expose no sensitive local state', (t) => {
  requireLiveCheckout(t);
  const baseSha = phaseBaseSha();
  const revision = git('rev-parse', '--verify', 'HEAD^{commit}');
  const auditedPaths = changedPathsAndKinds(baseSha);
  const violations = [];
  for (const relativePath of auditedPaths) {
    const absolute = path.join(repositoryRoot, relativePath);
    if (!fs.existsSync(absolute)) continue;
    const bytes = fs.readFileSync(absolute);
    // The fallback base can widen the audit set to every tracked file,
    // including binaries. Decode lossily so ASCII literals stay scannable
    // without a fatal throw on non-UTF-8 bytes.
    const body = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    violations.push(...privacyViolations(relativePath, body));
  }

  for (const args of [[baseSha], ['--cached'], []]) {
    const diff = run('/usr/bin/git', ['diff', '--unified=0', '--no-ext-diff', '--no-renames', ...args]);
    let currentPath = '<diff>';
    for (const line of diff.split(/\r?\n/)) {
      if (line.startsWith('+++ b/')) currentPath = line.slice(6);
      if (!line.startsWith('+') || line.startsWith('+++')) continue;
      violations.push(...privacyViolations(currentPath, line.slice(1)));
    }
  }

  const json = runInventoryCommand('docs:inventory:json', revision);
  const markdown = runInventoryCommand('docs:inventory:markdown', revision);
  violations.push(...privacyViolations('<inventory-json-stdout>', json));
  violations.push(...privacyViolations('<inventory-markdown-stdout>', markdown));
  assert.deepEqual([...new Set(violations)], [], `T-06-22 privacy violations: ${[...new Set(violations)].join(', ')}`);
});

test('SAFE-01 / D-01: SHA-bound safety:check fails copied doctrine and passes unmodified HEAD', (t) => {
  requireLiveCheckout(t);
  const revision = git('rev-parse', '--verify', 'HEAD^{commit}');
  assert.match(revision, /^[0-9a-f]{40}$/);
  const checked = runSafetyCheck(revision);
  assert.match(checked.stdout, new RegExp(`^deterministic safety check passed: ${revision} `));
  const sources = buildDocumentationInventorySources({
    repositoryRoot,
    sourceRevision: revision,
  });
  assert.deepEqual(sources.corpusPaths, corpusPathsAt(revision));
  runFocusedNodeTests('scripts/deterministic-safety.test.mjs', 'SAFE-01');
});

test('SAFE-02 / D-02: SHA-bound safety:check fails D-05 self-claims and keeps ISA/STATE/LIFECYCLE allowlists', (t) => {
  requireLiveCheckout(t);
  const revision = git('rev-parse', '--verify', 'HEAD^{commit}');
  runSafetyCheck(revision);
  const contract = read('docs/architecture/contracts/deterministic-safety-v1.md');
  for (const surface of D05_SURFACES) {
    assert.match(contract, new RegExp(surface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(contract, /Do not substring-scan historical `docs\/plans\/`/);
  assert.match(contract, /Allowed claimants are `ISA\.md` and `\.planning\/STATE\.md`/);
  runFocusedNodeTests('scripts/deterministic-safety.test.mjs', 'SAFE-02');
});

test('SAFE-03 / D-03: SHA-bound safety:check fails stale selectors and privacy tokens without D-11 false hits', (t) => {
  requireLiveCheckout(t);
  const revision = git('rev-parse', '--verify', 'HEAD^{commit}');
  runSafetyCheck(revision);
  const contract = read('docs/architecture/contracts/deterministic-safety-v1.md');
  assert.match(contract, /Do not freshness-check ephemeral\s+documentation-inventory stdout/);
  assert.match(contract, /Cloudflare\s+account-id-shaped 32-hex values/);
  assert.match(contract, /Worker Version UUIDs/);
  runFocusedNodeTests('scripts/deterministic-safety.test.mjs', 'SAFE-03');
});

test('SAFE-04 / D-16: reviewed handoff records write set, fixtures, D-15 holds, D-16 identities, and verify-work 7', () => {
  const isa = read('ISA.md');
  const handoff = read('.project/HANDOFF.md');
  const frontmatter = (isa.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  const headings = [...isa.matchAll(/^### ((?:Active|Completed) Phase 7 acceptance)$/gm)].map((match) => match[1]);
  assert.equal(headings.length, 1, 'ISA must declare exactly one Phase 7 acceptance heading');
  if (headings[0] === 'Active Phase 7 acceptance') {
    assert.match(frontmatter, /^phase: plan$/m);
    assert.match(frontmatter, /^progress: 0\/4$/m);
    for (const id of PHASE7_CRITERIA) assert.equal(checkbox(isa, id), false, `${id} remains unchecked until Task 2`);
    assert.doesNotMatch(handoff, PHASE7_CHECKPOINT_HEADING);
    assert.doesNotMatch(handoff, /\/gsd:verify-work 7/);
    return;
  }

  assert.equal(headings[0], 'Completed Phase 7 acceptance');
  if (!/^### (?:Active|Completed) Phase 8 acceptance$/m.test(isa)) {
    assert.match(frontmatter, /^phase: verify$/m);
    assert.match(frontmatter, /^progress: 4\/4$/m);
  }
  for (const id of PHASE7_CRITERIA) assert.equal(checkbox(isa, id), true, `${id} must be checked at implementation close`);
  assert.match(handoff, PHASE7_CHECKPOINT_HEADING);
  const checkpointHeading = (handoff.match(PHASE7_CHECKPOINT_HEADING) ?? []).at(-1) ?? '';
  assert.match(checkpointHeading, /Phase 7 deterministic safety and handoff implementation checkpoint/);
  const checkpointStart = handoff.lastIndexOf(checkpointHeading);
  const nextHeading = handoff.indexOf('\n### ', checkpointStart + checkpointHeading.length);
  const checkpoint = handoff.slice(checkpointStart, nextHeading < 0 ? undefined : nextHeading);
  assert.match(checkpoint, /npm run --silent safety:check -- --source-revision /);
  assert.match(checkpoint, new RegExp(D16_WORKER_VERSION));
  assert.match(checkpoint, /100 percent/);
  assert.match(checkpoint, /git-21d4908/);
  assert.match(checkpoint, new RegExp(D16_GRAPH_DIGEST));
  assert.match(checkpoint, /8360c04/);
  assert.match(checkpoint, /\/gsd:verify-work 7/);
  assert.doesNotMatch(checkpoint, /\/gsd:plan-phase 7/);
  assert.match(checkpoint, /copied paragraph/);
  assert.match(checkpoint, /active_planner/);
  assert.match(checkpoint, /self-claim/);
  assert.match(checkpoint, /path#selector/);
  assert.match(checkpoint, /D1 CAS/);
  assert.match(checkpoint, /Vectorize ingest/);
  assert.match(checkpoint, /getfitcheck/);
  assert.match(checkpoint, /TeamForge/);
});

test('SAFE-PRIVACY / T-07: Phase 7 bytes and safety:check stdout expose no sensitive local state', (t) => {
  requireLiveCheckout(t);
  const baseSha = phase7BaseSha();
  const revision = git('rev-parse', '--verify', 'HEAD^{commit}');
  const auditedPaths = changedPathsAndKinds(baseSha, repositoryRoot, 'Phase 7');
  const violations = [];
  for (const relativePath of auditedPaths) {
    const absolute = path.join(repositoryRoot, relativePath);
    if (!fs.existsSync(absolute)) continue;
    const bytes = fs.readFileSync(absolute);
    // Lossy decode: the widened audit set may include binaries.
    const body = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    violations.push(...privacyViolations(relativePath, t07Allowlisted(body)));
  }

  for (const args of [[baseSha], ['--cached'], []]) {
    const diff = run('/usr/bin/git', ['diff', '--unified=0', '--no-ext-diff', '--no-renames', ...args]);
    let currentPath = '<diff>';
    for (const line of diff.split(/\r?\n/)) {
      if (line.startsWith('+++ b/')) currentPath = line.slice(6);
      if (!line.startsWith('+') || line.startsWith('+++')) continue;
      violations.push(...privacyViolations(currentPath, t07Allowlisted(line.slice(1))));
    }
  }

  const checked = runSafetyCheck(revision);
  violations.push(...privacyViolations('<safety-check-stdout>', t07Allowlisted(checked.stdout)));
  if (checked.stderr) {
    violations.push(...privacyViolations('<safety-check-stderr>', t07Allowlisted(checked.stderr)));
  }
  assert.deepEqual([...new Set(violations)], [], `T-07 privacy violations: ${[...new Set(violations)].join(', ')}`);
});
