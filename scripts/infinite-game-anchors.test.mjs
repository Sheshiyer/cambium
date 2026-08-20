import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  renderDocumentationInventoryMarkdown,
  validateDocumentationInventory,
} from './documentation-inventory.mjs';

const root = new URL('..', import.meta.url);
const repositoryRoot = fs.realpathSync(path.resolve(new URL('.', root).pathname));
const approvedGoal = "Consolidate Cambium's doctrine into a provenance-preserving infinite-game architecture anchored by canonical VISION.md and renewable MISSION.md, with ISA and GSD as the only goal/planning authorities. Map vision → mission → finite goals → tasks → evidence → learning as a fractal graph, and expose Ralph next actions, skill-cluster and OmniRoute flows, gates, and stop conditions through Temperance.";

function run(command, args, { encoding = 'utf8' } = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
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

function phaseBaseSha() {
  const summary = read('.planning/phases/06-documentation-stewardship/06-01-SUMMARY.md');
  const matches = [...summary.matchAll(/^phase_base_sha: ([0-9a-f]{40})$/gm)];
  assert.equal(matches.length, 1, '06-01 summary must declare one unique full phase_base_sha');
  assert.equal(spawnSync('/usr/bin/git', ['merge-base', '--is-ancestor', matches[0][1], 'HEAD'], { cwd: repositoryRoot }).status, 0,
    'phase_base_sha must be an ancestor of current HEAD');
  return matches[0][1];
}

function nameStatus(rangeArgs) {
  return nulList(run('/usr/bin/git', ['diff', '--name-status', '-z', ...rangeArgs]));
}

function changedPathsAndKinds(baseSha) {
  const collections = [
    nameStatus([`${baseSha}...HEAD`]),
    nameStatus(['--cached']),
    nameStatus([]),
  ];
  const paths = new Set(nulList(run('/usr/bin/git', ['ls-files', '-z', '--others', '--exclude-standard'])));
  for (const records of collections) {
    for (let index = 0; index < records.length;) {
      const status = records[index++];
      assert.doesNotMatch(status, /^[DR]/, `Phase 6 must not delete or rename paths (${status})`);
      const relativePath = records[index++];
      if (relativePath) paths.add(relativePath);
    }
  }
  return [...paths].sort();
}

const syntheticPrivacyFixtures = new Map([
  ['scripts/documentation-inventory.test.mjs', [
    /presentPurpose = 'Bearer abcdefghijklmnop'/,
    /promptBody = 'private prompt'/,
  ]],
  ['scripts/generate-documentation-inventory.test.mjs', [
    /docs\/private-shaped-body\.md.*fixture-private-value/,
    /assert\.doesNotMatch.*(?:Users|Volumes|Bearer|promptBody|responseBody)/,
  ]],
  ['scripts/generate-temperance-flow.test.mjs', [
    /credential.*promptBody.*responseBody/,
    /nativeSessionId.*receiptPath/,
    /normalizeVerifiedManifestResult.*Bearer.*top-secret-token/,
  ]],
  ['scripts/infinite-game-anchors.test.mjs', [
    /presentPurpose.*Bearer abcdefghijklmnop/,
    /promptBody.*private prompt/,
    /(?:credential|nativeSessionId|normalizeVerifiedManifestResult).*top-secret-token/,
  ]],
]);

function privacyViolations(relativePath, source) {
  const fixtureRules = syntheticPrivacyFixtures.get(relativePath) ?? [];
  const patterns = [
    new RegExp(`(?:file:\\/\\/(?:\\/|[A-Za-z]:)|\\/(?:${'Us' + 'ers'}|${'Vol' + 'umes'}|home)\\/[A-Za-z0-9._~-][^\\s'\"]*|[A-Za-z]:\\\\${'Us' + 'ers'}\\\\)`),
    /\b(?:authorization\s*[:=]\s*|bearer\s+)[A-Za-z0-9._~-]{12,}/i,
    /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|native[_-]?session(?:[_-]?(?:id|token))?)\s*[:=]\s*['"]?[A-Za-z0-9._~+\/-]{8,}/i,
    /\b(?:prompt|request|response|message)[_-]?(?:body|content|payload)\s*[:=]\s*['"{\[]/i,
    new RegExp(`(?:\\.${'claude'}\\/${'MEMORY'}|${'MEMORY'}\\/(?:LEARNING|SIGNALS|STATE))`, 'i'),
    /\b(?:rawMemory|raw_memory|serializedMemory)\s*[:=]/i,
  ];
  const violations = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (fixtureRules.some((rule) => rule.test(line))) continue;
    for (const pattern of patterns) {
      if (pattern.test(line)) violations.push(`${relativePath}:${index + 1}`);
    }
  }
  return violations;
}

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

function isCoherentIsaPhaseState(frontmatter, phase3Checks, phase4Checks, phase5Checks = {}, phase6Checks = {}) {
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
  return phase3Complete
    && phase4Complete
    && phase5Complete
    && (phase6PlanStart || phase6ExecuteStart || phase6ExecutePrefix || phase6Verified);
}

test('ISA lifecycle accepts only coherent completed Phase 3, Phase 4, Phase 5, and Phase 6 states', () => {
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
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 0/4', phase3Complete, phase4Complete, phase5Complete, phase6Pending), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 0/4', phase3Complete, phase4Complete, phase5Complete, phase6Pending), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 2/4', phase3Complete, phase4Complete, phase5Complete, phase6Prefix2), true);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Complete, phase5Complete, phase6Complete), true);
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 1/4', phase3Complete, phase4Complete, phase5Complete, phase6Pending), false);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 2/4', phase3Complete, phase4Complete, phase5Complete, phase6NonPrefix), false);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Complete, phase5Complete, phase6Pending), false);
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
test('ISA binds the approved v0.4 goal without erasing history', () => {
  const isa = read('ISA.md');
  const frontmatter = (isa.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  const activeGoal = (isa.split('\n## Goal\n')[1] || '').trimStart();

  assert.ok(frontmatter.includes(`task: "${approvedGoal}"`), 'ISA frontmatter must bind the approved v0.4 goal exactly');
  assert.ok(activeGoal.startsWith(approvedGoal), 'ISA Goal must lead with the approved v0.4 goal exactly');
  assert.match(isa, /historical acceptance evidence/i);
  assert.match(isa, /historical[\s\S]{0,160}issue #331|issue #331[\s\S]{0,160}historical/i);
  assert.match(isa, /ISC-1273\.\.1276[\s\S]*scripts\/infinite-game-anchors\.test\.mjs/i);
  assert.match(isa, /CanonicalInfiniteGameAnchors[\s\S]*ISC-1273\.\.1276/);

  const phase3Checks = Object.fromEntries(['ISC-1273', 'ISC-1274', 'ISC-1275', 'ISC-1276'].map((id) => [id, checkbox(isa, id)]));
  const phase4Checks = Object.fromEntries(['ISC-1277', 'ISC-1278', 'ISC-1279', 'ISC-1280', 'ISC-1281'].map((id) => [id, checkbox(isa, id)]));
  const phase5Checks = Object.fromEntries(PHASE5_CRITERIA.map((id) => [id, checkbox(isa, id)]));
  const phase6Checks = Object.fromEntries(PHASE6_CRITERIA.map((id) => [id, checkbox(isa, id)]));
  assert.ok(
    isCoherentIsaPhaseState(frontmatter, phase3Checks, phase4Checks, phase5Checks, phase6Checks),
    'ISA must be coherent at completed Phase 3, active or verified Phase 4, Phase 5, or Phase 6',
  );
});

test('Phase 6 acceptance binds documentation stewardship without creating authority', () => {
  const isa = read('ISA.md');

  assert.match(isa, /^### (?:Active|Completed) Phase 6 acceptance$/m);
  assert.match(isa, /ISC-1286:[^\n]*five-class lifecycle map[^\n]*(?:doctrine|Vision|Mission)[^\n]*(?:ISA|GSD)/i);
  assert.match(isa, /ISC-1287:[^\n]*explicit[^\n]*commit[^\n]*on-demand inventory[^\n]*machine[^\n]*human/i);
  assert.match(isa, /ISC-1288:[^\n]*additive[^\n]*(?:owner|authority)[^\n]*links[^\n]*STATE/i);
  assert.match(isa, /ISC-1289:[^\n]*recoverable[^\n]*evidence[^\n]*exception[^\n]*non-destructive/i);
  assert.match(isa, /RalphAndTemperanceFlowProjection[^\n]*satisfies ISC-1282\.\.1285/);
  assert.match(isa, /DocumentationStewardship[^\n]*satisfies ISC-1286\.\.1289[^\n]*depends_on RalphAndTemperanceFlowProjection/);
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

test('DOCS-01 / D-01: documentation stewardship preserves the closed lifecycle and owner precedence', () => {
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

test('DOCS-02 / D-02: explicit-revision inventory is exhaustive, deterministic, matching, and zero-write', () => {
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

test('DOCS-04 / D-04: evidence stays recoverable and exceptions remain source-backed and non-destructive', () => {
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

test('DOCS-PRIVACY / T-06-22: Phase 6 bytes and inventory stdout expose no sensitive local state', () => {
  const baseSha = phaseBaseSha();
  const revision = git('rev-parse', '--verify', 'HEAD^{commit}');
  const auditedPaths = changedPathsAndKinds(baseSha);
  const violations = [];
  for (const relativePath of auditedPaths) {
    const absolute = path.join(repositoryRoot, relativePath);
    if (!fs.existsSync(absolute)) continue;
    const bytes = fs.readFileSync(absolute);
    const body = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    violations.push(...privacyViolations(relativePath, body));
  }

  for (const args of [[`${baseSha}...HEAD`], ['--cached'], []]) {
    const diff = run('/usr/bin/git', ['diff', '--unified=0', '--no-ext-diff', ...args]);
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
