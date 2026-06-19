import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const policy = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs/assets/provenance.json'), 'utf8'));
const doc = fs.readFileSync(path.join(repoRoot, 'docs/assets/README.md'), 'utf8');
const privateLeak = /(thoughtseed|curious\.thoughtseed\.space|\/Users\/|\/Volumes\/|cs_live_|@[a-z0-9.-]+\.(com|io))/i;

function walk(dir) {
  const found = [];
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    if (entry.isFile()) found.push(path.relative(repoRoot, full));
  }
  return found;
}

function globToRegExp(glob) {
  let source = '^';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    const next = glob[i + 1];
    if (char === '*' && next === '*') {
      source += '.*';
      i += 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else {
      source += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`${source}$`);
}

function matchingGroups(file) {
  return policy.groups.filter((group) => group.paths.some((glob) => globToRegExp(glob).test(file)));
}

const visualAssets = [
  ...walk(path.join(repoRoot, 'apps/cambium-r3f/public/assets')).filter((file) => /\.(glb|png|jpe?g|webp|svg)$/i.test(file)),
  ...walk(path.join(repoRoot, 'docs/plans/assets')).filter((file) => /\.(png|jpe?g|webp|svg)$/i.test(file)),
];

test('asset provenance policy defines release size decisions', () => {
  assert.equal(policy.schema, 'cambium.asset-provenance.v1');
  assert.equal(policy.policy.runtimeGlbMaxBytes, 15 * 1024 * 1024);
  assert.match(policy.policy.oversizedRuntimeAction, /release-asset-or-lfs/);
  assert.match(doc, /Runtime GLB assets stay below 15 MB each/);
  assert.match(doc, /Image-to-3D master GLBs remain in git only as QA evidence/);
});

test('tracked visual assets are covered by provenance groups', () => {
  const uncovered = visualAssets.filter((file) => matchingGroups(file).length === 0);
  assert.deepEqual(uncovered, []);
});

test('runtime assets respect the runtime budget and QA masters stay unpromoted', () => {
  for (const file of visualAssets.filter((asset) => asset.endsWith('.glb'))) {
    const groups = matchingGroups(file);
    const stat = fs.statSync(path.join(repoRoot, file));
    const runtime = groups.some((group) => group.kind === 'runtime');
    const qaOnly = groups.every((group) => group.approvalStatus === 'qa-only-not-promoted');

    if (runtime) {
      assert.ok(stat.size < policy.policy.runtimeGlbMaxBytes, `${file} should stay under runtime GLB budget`);
    } else {
      assert.ok(qaOnly, `${file} should be marked qa-only if it is not a runtime GLB`);
      assert.ok(stat.size < policy.policy.qaReferenceGlbMaxBytes, `${file} should stay under QA reference cap`);
    }
  }
});

test('asset governance docs avoid private company state', () => {
  assert.doesNotMatch(doc, privateLeak);
  assert.doesNotMatch(JSON.stringify(policy), privateLeak);
});

