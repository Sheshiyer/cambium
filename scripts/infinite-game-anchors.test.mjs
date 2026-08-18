import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const approvedGoal = "Consolidate Cambium's doctrine into a provenance-preserving infinite-game architecture anchored by canonical VISION.md and renewable MISSION.md, with ISA and GSD as the only goal/planning authorities. Map vision → mission → finite goals → tasks → evidence → learning as a fractal graph, and expose Ralph next actions, skill-cluster and OmniRoute flows, gates, and stop conditions through Temperance.";

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

function isCoherentIsaPhaseState(frontmatter, phase3Checks, phase4Checks) {
  const phase3Complete = Object.values(phase3Checks).every(Boolean);
  const phase4Pending = Object.values(phase4Checks).every((value) => !value);
  const phase4GapExecution = ['ISC-1277', 'ISC-1278', 'ISC-1279', 'ISC-1281'].every((id) => phase4Checks[id] === true)
    && phase4Checks['ISC-1280'] === false;
  const phase4Complete = Object.values(phase4Checks).every(Boolean);
  return (
    (/^phase: verify$/m.test(frontmatter) && /^progress: 4\/4$/m.test(frontmatter) && phase3Complete && phase4Pending)
    || (/^(?:phase: plan|phase: execute)$/m.test(frontmatter) && /^progress: 0\/5$/m.test(frontmatter) && phase3Complete && phase4Pending)
    || (/^phase: execute$/m.test(frontmatter) && /^progress: 4\/5$/m.test(frontmatter) && phase3Complete && phase4GapExecution)
    || (/^phase: verify$/m.test(frontmatter) && /^progress: 5\/5$/m.test(frontmatter) && phase3Complete && phase4Complete)
  );
}

test('ISA lifecycle accepts only coherent completed Phase 3 and Phase 4 states', () => {
  const phase3Complete = Object.fromEntries(['ISC-1273', 'ISC-1274', 'ISC-1275', 'ISC-1276'].map((id) => [id, true]));
  const phase4Pending = Object.fromEntries(['ISC-1277', 'ISC-1278', 'ISC-1279', 'ISC-1280', 'ISC-1281'].map((id) => [id, false]));
  const phase4GapExecution = { ...Object.fromEntries(Object.keys(phase4Pending).map((id) => [id, true])), 'ISC-1280': false };
  const phase4Complete = Object.fromEntries(Object.keys(phase4Pending).map((id) => [id, true]));

  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Pending), true);
  assert.equal(isCoherentIsaPhaseState('phase: plan\nprogress: 0/5', phase3Complete, phase4Pending), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 0/5', phase3Complete, phase4Pending), true);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 4/5', phase3Complete, phase4GapExecution), true);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 5/5', phase3Complete, phase4Complete), true);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 4/4', phase3Complete, phase4Complete), false);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 1/5', phase3Complete, phase4Pending), false);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 4/5', phase3Complete, phase4Pending), false);
  assert.equal(isCoherentIsaPhaseState('phase: execute\nprogress: 4/5', phase3Complete, phase4Complete), false);
  assert.equal(isCoherentIsaPhaseState('phase: verify\nprogress: 5/5', phase3Complete, phase4Pending), false);
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
  assert.ok(
    isCoherentIsaPhaseState(frontmatter, phase3Checks, phase4Checks),
    'ISA must be coherent at completed Phase 3, active Phase 4, or verified Phase 4',
  );
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
